-- Balqees Floral v10.38 — B2B Team & Permissions / Page 9
-- Apply after the existing organizations + organization_members + organization_sites schema.

alter table public.organization_members
  add column if not exists approval_limit numeric(14,2),
  add column if not exists access_expires_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists removed_at timestamptz,
  add column if not exists mfa_required boolean not null default false,
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.organization_member_site_access (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.organization_sites(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id,site_id)
);

create table if not exists public.organization_member_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  full_name text,
  member_role text not null default 'viewer',
  site_ids uuid[] not null default '{}'::uuid[],
  approval_limit numeric(14,2),
  access_expires_at timestamptz,
  status text not null default 'pending' check(status in ('pending','accepted','expired','cancelled')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists organization_member_invites_pending_email_uq on public.organization_member_invites(organization_id,lower(email)) where status='pending';

create table if not exists public.organization_member_audit (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.organization_member_site_access enable row level security;
alter table public.organization_member_invites enable row level security;
alter table public.organization_member_audit enable row level security;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.organization_members m where m.organization_id=p_org and m.user_id=auth.uid() and m.status='active' and (m.access_expires_at is null or m.access_expires_at>now()));
$$;
create or replace function public.can_manage_org_team(p_org uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.organization_members m where m.organization_id=p_org and m.user_id=auth.uid() and m.status='active' and (m.member_role in ('owner','admin','organization_manager') or coalesce(m.can_manage_team,false)) and (m.access_expires_at is null or m.access_expires_at>now()));
$$;

drop policy if exists "team site scope visible to members" on public.organization_member_site_access;
create policy "team site scope visible to members" on public.organization_member_site_access for select to authenticated using(public.is_org_member(organization_id));
drop policy if exists "team site scope managed by team managers" on public.organization_member_site_access;
create policy "team site scope managed by team managers" on public.organization_member_site_access for all to authenticated using(public.can_manage_org_team(organization_id)) with check(public.can_manage_org_team(organization_id));

drop policy if exists "team invites visible to managers" on public.organization_member_invites;
create policy "team invites visible to managers" on public.organization_member_invites for select to authenticated using(public.can_manage_org_team(organization_id));
drop policy if exists "team audit visible to managers" on public.organization_member_audit;
create policy "team audit visible to managers" on public.organization_member_audit for select to authenticated using(public.can_manage_org_team(organization_id));

create or replace function public.get_organization_team_center(p_organization_id uuid)
returns table(user_id uuid,full_name text,email text,member_role text,status text,joined_at timestamptz,last_sign_in_at timestamptz,mfa_enabled boolean,mfa_required boolean,approval_limit numeric,access_expires_at timestamptz,site_ids uuid[],permissions jsonb)
language plpgsql security definer set search_path=public,auth as $$
begin
  if not public.is_org_member(p_organization_id) then raise exception 'not_authorized'; end if;
  return query
  select m.user_id,p.full_name,coalesce(p.email,u.email)::text,m.member_role,m.status,m.joined_at,u.last_sign_in_at,
    coalesce((select bool_or(f.factor_type in ('totp','phone') and f.status='verified') from auth.mfa_factors f where f.user_id=m.user_id),false),
    m.mfa_required,m.approval_limit,m.access_expires_at,
    coalesce((select array_agg(a.site_id order by a.site_id) from public.organization_member_site_access a where a.organization_id=m.organization_id and a.user_id=m.user_id),'{}'::uuid[]),
    m.permissions
  from public.organization_members m
  left join public.customer_profiles p on p.id=m.user_id
  left join auth.users u on u.id=m.user_id
  where m.organization_id=p_organization_id and m.status <> 'removed'
  order by case when m.member_role='owner' then 0 else 1 end,coalesce(p.full_name,p.email,u.email);
end $$;

create or replace function public.create_organization_member_invite(p_organization_id uuid,p_email text,p_full_name text default null,p_role text default 'viewer',p_site_ids uuid[] default '{}'::uuid[],p_expires_at timestamptz default null,p_approval_limit numeric default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.can_manage_org_team(p_organization_id) then raise exception 'not_authorized'; end if;
  if p_role='owner' then raise exception 'owner_requires_transfer_flow'; end if;
  if p_role not in ('organization_manager','procurement_manager','approver','finance','site_manager','receiving_officer','viewer') then raise exception 'invalid_role'; end if;
  if exists(select 1 from unnest(p_site_ids) x where not exists(select 1 from public.organization_sites s where s.id=x and s.organization_id=p_organization_id)) then raise exception 'invalid_site_scope'; end if;
  update public.organization_member_invites set status='expired',updated_at=now() where organization_id=p_organization_id and status='pending' and access_expires_at is not null and access_expires_at<=now();
  insert into public.organization_member_invites(organization_id,email,full_name,member_role,site_ids,approval_limit,access_expires_at,invited_by)
  values(p_organization_id,lower(trim(p_email)),nullif(trim(p_full_name),''),p_role,p_site_ids,p_approval_limit,p_expires_at,auth.uid()) returning id into v_id;
  insert into public.organization_member_audit(organization_id,actor_user_id,action,after_state) values(p_organization_id,auth.uid(),'invite_created',jsonb_build_object('invite_id',v_id,'email',lower(trim(p_email)),'role',p_role,'site_ids',p_site_ids));
  return v_id;
end $$;

create or replace function public.manage_organization_member(p_organization_id uuid,p_member_user_id uuid,p_action text,p_value text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_before jsonb; v_role text; v_owner_count int;
begin
  if not public.can_manage_org_team(p_organization_id) then raise exception 'not_authorized'; end if;
  select to_jsonb(m),m.member_role into v_before,v_role from public.organization_members m where m.organization_id=p_organization_id and m.user_id=p_member_user_id for update;
  if v_before is null then raise exception 'member_not_found'; end if;
  select count(*) into v_owner_count from public.organization_members where organization_id=p_organization_id and member_role='owner' and status='active';
  if v_role='owner' and v_owner_count<=1 and p_action in ('suspend','remove','set_role') then raise exception 'last_owner_protected'; end if;
  if p_action='suspend' then update public.organization_members set status='suspended',suspended_at=now(),updated_at=now() where organization_id=p_organization_id and user_id=p_member_user_id;
  elsif p_action='activate' then update public.organization_members set status='active',suspended_at=null,removed_at=null,updated_at=now() where organization_id=p_organization_id and user_id=p_member_user_id;
  elsif p_action='remove' then update public.organization_members set status='removed',removed_at=now(),updated_at=now() where organization_id=p_organization_id and user_id=p_member_user_id;
  elsif p_action='set_role' then
    if p_value='owner' then raise exception 'owner_requires_transfer_flow'; end if;
    if p_value not in ('organization_manager','procurement_manager','approver','finance','site_manager','receiving_officer','viewer') then raise exception 'invalid_role'; end if;
    update public.organization_members set member_role=p_value,updated_at=now() where organization_id=p_organization_id and user_id=p_member_user_id;
  else raise exception 'invalid_action'; end if;
  insert into public.organization_member_audit(organization_id,target_user_id,actor_user_id,action,before_state,after_state) select p_organization_id,p_member_user_id,auth.uid(),p_action,v_before,to_jsonb(m) from public.organization_members m where m.organization_id=p_organization_id and m.user_id=p_member_user_id;
end $$;

grant execute on function public.get_organization_team_center(uuid) to authenticated;
grant execute on function public.create_organization_member_invite(uuid,text,text,text,uuid[],timestamptz,numeric) to authenticated;
grant execute on function public.manage_organization_member(uuid,uuid,text,text) to authenticated;
