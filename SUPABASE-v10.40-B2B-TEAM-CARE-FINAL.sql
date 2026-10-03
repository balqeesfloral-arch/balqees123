-- Balqees Floral v10.40 — Page 9 + Page 10 finalization
-- Apply AFTER v10.38 and v10.39. This migration hardens Identity & Access and completes Smart Care.
-- All privileged implementations live in private; public functions are security-invoker wrappers only.

create schema if not exists private;
grant usage on schema private to authenticated;

-- =========================================================
-- PAGE 9 — IDENTITY & ACCESS CENTER
-- =========================================================

alter table public.organization_members
  add column if not exists custom_role_id uuid,
  add column if not exists permission_overrides jsonb not null default '{}'::jsonb;

create table if not exists public.organization_custom_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name_ar text not null,
  name_en text,
  description_ar text,
  description_en text,
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists organization_custom_roles_org_idx on public.organization_custom_roles(organization_id,is_active,created_at);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname='organization_members_custom_role_id_fkey'
  ) then
    alter table public.organization_members
      add constraint organization_members_custom_role_id_fkey
      foreign key (custom_role_id) references public.organization_custom_roles(id) on delete set null;
  end if;
end $$;

alter table public.organization_member_invites
  add column if not exists custom_role_id uuid references public.organization_custom_roles(id) on delete set null,
  add column if not exists permission_overrides jsonb not null default '{}'::jsonb,
  add column if not exists mfa_required boolean not null default false,
  add column if not exists invite_token uuid not null default gen_random_uuid();
create unique index if not exists organization_member_invites_token_uq on public.organization_member_invites(invite_token);

create table if not exists public.organization_access_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  require_mfa_managers boolean not null default false,
  require_mfa_approvers boolean not null default false,
  require_mfa_finance boolean not null default false,
  inactivity_warning_days integer not null default 60 check(inactivity_warning_days between 7 and 365),
  temporary_access_warning_days integer not null default 7 check(temporary_access_warning_days between 1 and 60),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_responsibilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  responsibility_key text not null check(responsibility_key in ('procurement','finance','contracts','approval','site')),
  site_id uuid references public.organization_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((responsibility_key='site' and site_id is not null) or (responsibility_key<>'site' and site_id is null))
);
create unique index if not exists organization_responsibilities_scope_uq
  on public.organization_responsibilities(organization_id,responsibility_key,coalesce(site_id,'00000000-0000-0000-0000-000000000000'::uuid));

alter table public.organization_custom_roles enable row level security;
alter table public.organization_access_policies enable row level security;
alter table public.organization_responsibilities enable row level security;

revoke all on public.organization_custom_roles, public.organization_access_policies, public.organization_responsibilities from anon;
revoke all on public.organization_custom_roles, public.organization_access_policies, public.organization_responsibilities from authenticated;
grant select on public.organization_custom_roles, public.organization_access_policies, public.organization_responsibilities to authenticated;

create or replace function private.b2b_builtin_permissions(p_role text)
returns jsonb language sql immutable set search_path='' as $$
select case p_role
  when 'owner' then '{"view_orders":true,"create_orders":true,"edit_orders":true,"view_quotations":true,"approve_quotations":true,"view_contracts":true,"view_financial_documents":true,"view_sites":true,"manage_sites":true,"view_team":true,"manage_team":true,"manage_settings":true,"manage_profile":true,"view_catalog":true,"create_support_cases":true,"place_orders":true,"accept_quotes":true,"view_finance":true}'::jsonb
  when 'admin' then '{"view_orders":true,"create_orders":true,"edit_orders":true,"view_quotations":true,"approve_quotations":true,"view_contracts":true,"view_financial_documents":true,"view_sites":true,"manage_sites":true,"view_team":true,"manage_team":true,"manage_settings":true,"manage_profile":true,"view_catalog":true,"create_support_cases":true,"place_orders":true,"accept_quotes":true,"view_finance":true}'::jsonb
  when 'organization_manager' then '{"view_orders":true,"create_orders":true,"edit_orders":true,"view_quotations":true,"approve_quotations":true,"view_contracts":true,"view_financial_documents":true,"view_sites":true,"manage_sites":true,"view_team":true,"manage_team":true,"manage_settings":true,"manage_profile":true,"view_catalog":true,"create_support_cases":true,"place_orders":true,"accept_quotes":true,"view_finance":true}'::jsonb
  when 'procurement_manager' then '{"view_orders":true,"create_orders":true,"edit_orders":true,"view_quotations":true,"approve_quotations":false,"view_contracts":true,"view_financial_documents":false,"view_sites":true,"manage_sites":false,"view_team":true,"manage_team":false,"manage_settings":false,"manage_profile":false,"view_catalog":true,"create_support_cases":true,"place_orders":true,"accept_quotes":false,"view_finance":false}'::jsonb
  when 'approver' then '{"view_orders":true,"create_orders":false,"edit_orders":false,"view_quotations":true,"approve_quotations":true,"view_contracts":true,"view_financial_documents":true,"view_sites":true,"manage_sites":false,"view_team":true,"manage_team":false,"manage_settings":false,"manage_profile":false,"view_catalog":true,"create_support_cases":true,"place_orders":false,"accept_quotes":true,"view_finance":true}'::jsonb
  when 'finance' then '{"view_orders":true,"create_orders":false,"edit_orders":false,"view_quotations":true,"approve_quotations":false,"view_contracts":true,"view_financial_documents":true,"view_sites":true,"manage_sites":false,"view_team":true,"manage_team":false,"manage_settings":false,"manage_profile":false,"view_catalog":false,"create_support_cases":true,"place_orders":false,"accept_quotes":false,"view_finance":true}'::jsonb
  when 'site_manager' then '{"view_orders":true,"create_orders":true,"edit_orders":true,"view_quotations":true,"approve_quotations":false,"view_contracts":true,"view_financial_documents":false,"view_sites":true,"manage_sites":true,"view_team":true,"manage_team":false,"manage_settings":false,"manage_profile":false,"view_catalog":true,"create_support_cases":true,"place_orders":true,"accept_quotes":false,"view_finance":false}'::jsonb
  when 'receiving_officer' then '{"view_orders":true,"create_orders":false,"edit_orders":false,"view_quotations":false,"approve_quotations":false,"view_contracts":false,"view_financial_documents":false,"view_sites":true,"manage_sites":false,"view_team":false,"manage_team":false,"manage_settings":false,"manage_profile":false,"view_catalog":false,"create_support_cases":true,"place_orders":false,"accept_quotes":false,"view_finance":false}'::jsonb
  else '{"view_orders":true,"create_orders":false,"edit_orders":false,"view_quotations":true,"approve_quotations":false,"view_contracts":true,"view_financial_documents":false,"view_sites":true,"manage_sites":false,"view_team":false,"manage_team":false,"manage_settings":false,"manage_profile":false,"view_catalog":true,"create_support_cases":true,"place_orders":false,"accept_quotes":false,"view_finance":false}'::jsonb
end;
$$;

create or replace function private.b2b_validate_permission_map(p_map jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; v_allowed text[]:=array[
  'view_orders','create_orders','edit_orders','view_quotations','approve_quotations',
  'view_contracts','view_financial_documents','view_sites','manage_sites','view_team',
  'manage_team','manage_settings','manage_profile','view_catalog','create_support_cases',
  'place_orders','accept_quotes','view_finance'
];
begin
 if p_map is null then return '{}'::jsonb; end if;
 if jsonb_typeof(p_map)<>'object' then raise exception 'INVALID_PERMISSION_MAP'; end if;
 for k,v in select key,value from jsonb_each(p_map) loop
   if not (k=any(v_allowed)) then raise exception 'UNKNOWN_PERMISSION_KEY:%',k; end if;
   if jsonb_typeof(v)<>'boolean' then raise exception 'PERMISSION_VALUE_MUST_BE_BOOLEAN:%',k; end if;
 end loop;
 return p_map;
end $$;
revoke all on function private.b2b_validate_permission_map(jsonb) from public,anon,authenticated;

create or replace function private.b2b_effective_permissions(p_org uuid,p_user uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select coalesce(private.b2b_builtin_permissions(m.member_role),'{}'::jsonb)
       || coalesce(r.permissions,'{}'::jsonb)
       || coalesce(m.permissions,'{}'::jsonb)
       || coalesce(m.permission_overrides,'{}'::jsonb)
from public.organization_members m
left join public.organization_custom_roles r
  on r.id=m.custom_role_id and r.organization_id=m.organization_id and r.is_active
where m.organization_id=p_org and m.user_id=p_user
  and m.status='active' and (m.access_expires_at is null or m.access_expires_at>now())
limit 1;
$$;
revoke all on function private.b2b_effective_permissions(uuid,uuid) from public,anon;
grant execute on function private.b2b_effective_permissions(uuid,uuid) to authenticated;

create or replace function private.b2b_site_allowed(p_org uuid,p_user uuid,p_site uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
  select 1 from public.organization_members m
  where m.organization_id=p_org and m.user_id=p_user and m.status='active'
    and (m.access_expires_at is null or m.access_expires_at>now())
    and (
      p_site is null
      or not exists(select 1 from public.organization_member_site_access a where a.organization_id=p_org and a.user_id=p_user)
      or exists(select 1 from public.organization_member_site_access a where a.organization_id=p_org and a.user_id=p_user and a.site_id=p_site)
    )
);
$$;
revoke all on function private.b2b_site_allowed(uuid,uuid,uuid) from public,anon;
grant execute on function private.b2b_site_allowed(uuid,uuid,uuid) to authenticated;

create or replace function private.b2b_has_permission(p_org uuid,p_permission text,p_site uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
select coalesce((private.b2b_effective_permissions(p_org,auth.uid())->>p_permission)::boolean,false)
  and private.b2b_site_allowed(p_org,auth.uid(),p_site);
$$;
revoke all on function private.b2b_has_permission(uuid,text,uuid) from public,anon;
grant execute on function private.b2b_has_permission(uuid,text,uuid) to authenticated;

-- Preserve compatibility with the portal's existing permission helper while using v10.40 effective permissions.
create or replace function private.org_permission(p_org uuid,p_permission text)
returns boolean language sql stable security definer set search_path='' as $$
select private.b2b_has_permission(
  p_org,
  case p_permission
    when 'place_orders' then 'place_orders'
    when 'accept_quotes' then 'accept_quotes'
    when 'view_finance' then 'view_finance'
    when 'manage_sites' then 'manage_sites'
    when 'manage_team' then 'manage_team'
    when 'manage_profile' then 'manage_profile'
    else p_permission
  end,
  null
);
$$;
revoke all on function private.org_permission(uuid,text) from public,anon;
grant execute on function private.org_permission(uuid,text) to authenticated;

create or replace function private.b2b_role_mfa_required(p_org uuid,p_role text,p_member_required boolean)
returns boolean language sql stable security definer set search_path='' as $$
select coalesce(p_member_required,false)
  or case
    when p_role in ('owner','organization_manager','admin') then coalesce(p.require_mfa_managers,false)
    when p_role='approver' then coalesce(p.require_mfa_approvers,false)
    when p_role='finance' then coalesce(p.require_mfa_finance,false)
    else false end
from (select 1) x
left join public.organization_access_policies p on p.organization_id=p_org;
$$;
revoke all on function private.b2b_role_mfa_required(uuid,text,boolean) from public,anon;
grant execute on function private.b2b_role_mfa_required(uuid,text,boolean) to authenticated;

create or replace function private.b2b_current_aal2()
returns boolean language sql stable set search_path='' as $$
select coalesce(auth.jwt()->>'aal','aal1')='aal2';
$$;

create or replace function private.b2b_team_manage_allowed(p_org uuid)
returns boolean language sql stable security definer set search_path='' as $$
select private.b2b_has_permission(p_org,'manage_team',null)
  and (
    not private.b2b_role_mfa_required(p_org,m.member_role,m.mfa_required)
    or private.b2b_current_aal2()
  )
from public.organization_members m
where m.organization_id=p_org and m.user_id=auth.uid() and m.status='active'
limit 1;
$$;
revoke all on function private.b2b_team_manage_allowed(uuid) from public,anon;
grant execute on function private.b2b_team_manage_allowed(uuid) to authenticated;

-- Harden v10.38 compatibility helpers used by existing RLS policies. Public helpers
-- are security-invoker wrappers; privileged membership checks stay in private.
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security invoker set search_path='' as $$
select private.b2b_site_allowed(p_org,auth.uid(),null);
$$;
revoke all on function public.is_org_member(uuid) from public,anon;
grant execute on function public.is_org_member(uuid) to authenticated;

create or replace function public.can_manage_org_team(p_org uuid)
returns boolean language sql stable security invoker set search_path='' as $$
select private.b2b_team_manage_allowed(p_org);
$$;
revoke all on function public.can_manage_org_team(uuid) from public,anon;
grant execute on function public.can_manage_org_team(uuid) to authenticated;

-- Retire the broad v10.38 SECURITY DEFINER mutation/read RPCs. Their v10.40
-- replacements below enforce effective permissions, site scope, MFA and Audit.
revoke all on function public.get_organization_team_center(uuid) from public,anon,authenticated;
drop function if exists public.get_organization_team_center(uuid);
revoke all on function public.create_organization_member_invite(uuid,text,text,text,uuid[],timestamptz,numeric) from public,anon,authenticated;
drop function if exists public.create_organization_member_invite(uuid,text,text,text,uuid[],timestamptz,numeric);
revoke all on function public.manage_organization_member(uuid,uuid,text,text) from public,anon,authenticated;
drop function if exists public.manage_organization_member(uuid,uuid,text,text);

create or replace function private.get_my_organization_memberships_v2_impl()
returns jsonb language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object(
  'organization_id',m.organization_id,
  'display_name',o.display_name,
  'member_role',m.member_role,
  'status',case when m.access_expires_at is not null and m.access_expires_at<=now() then 'expired' else m.status end,
  'joined_at',m.joined_at,
  'access_expires_at',m.access_expires_at
) order by m.joined_at),'[]'::jsonb)
from public.organization_members m
join public.organizations o on o.id=m.organization_id
where m.user_id=auth.uid() and m.status='active' and (m.access_expires_at is null or m.access_expires_at>now());
$$;
revoke all on function private.get_my_organization_memberships_v2_impl() from public,anon;
grant execute on function private.get_my_organization_memberships_v2_impl() to authenticated;
create or replace function public.get_my_organization_memberships_v2() returns jsonb language sql security invoker set search_path='' as $$ select private.get_my_organization_memberships_v2_impl(); $$;
revoke all on function public.get_my_organization_memberships_v2() from public,anon;
grant execute on function public.get_my_organization_memberships_v2() to authenticated;

create or replace function private.get_my_organization_access_v2_impl(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.organization_members%rowtype; v_sites jsonb; v_mfa_enabled boolean; v_required boolean;
begin
  select * into m from public.organization_members where organization_id=p_org and user_id=auth.uid() and status='active' and (access_expires_at is null or access_expires_at>now());
  if not found then raise exception 'ORG_ACCESS_DENIED'; end if;
  select coalesce(jsonb_agg(site_id),'[]'::jsonb) into v_sites from public.organization_member_site_access where organization_id=p_org and user_id=auth.uid();
  select exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status='verified') into v_mfa_enabled;
  v_required:=private.b2b_role_mfa_required(p_org,m.member_role,m.mfa_required);
  return jsonb_build_object('membership',to_jsonb(m),'permissions',private.b2b_effective_permissions(p_org,auth.uid()),'site_ids',v_sites,'mfa_enabled',v_mfa_enabled,'mfa_required',v_required,'aal2',private.b2b_current_aal2());
end $$;
revoke all on function private.get_my_organization_access_v2_impl(uuid) from public,anon;
grant execute on function private.get_my_organization_access_v2_impl(uuid) to authenticated;
create or replace function public.get_my_organization_access_v2(p_organization_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_my_organization_access_v2_impl(p_organization_id); $$;
revoke all on function public.get_my_organization_access_v2(uuid) from public,anon;
grant execute on function public.get_my_organization_access_v2(uuid) to authenticated;

create or replace function private.get_organization_team_center_v2_impl(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_members jsonb; v_invites jsonb; v_roles jsonb; v_policy jsonb; v_resp jsonb; v_care jsonb; v_audit jsonb; v_inactive int:=60; v_temp int:=7;
begin
  if not private.b2b_has_permission(p_org,'view_team',null) and not private.b2b_has_permission(p_org,'manage_team',null) then raise exception 'TEAM_ACCESS_DENIED'; end if;
  select coalesce(to_jsonb(p),'{}'::jsonb),coalesce(p.inactivity_warning_days,60),coalesce(p.temporary_access_warning_days,7) into v_policy,v_inactive,v_temp
  from public.organization_access_policies p where p.organization_id=p_org;
  if v_policy='{}'::jsonb then v_policy:=jsonb_build_object('require_mfa_managers',false,'require_mfa_approvers',false,'require_mfa_finance',false,'inactivity_warning_days',60,'temporary_access_warning_days',7); end if;

  select coalesce(jsonb_agg(x.obj order by x.sort_owner,x.name_sort),'[]'::jsonb) into v_members from (
    select jsonb_build_object(
      'user_id',m.user_id,'full_name',p.full_name,'email',coalesce(p.email,u.email),'member_role',m.member_role,
      'custom_role_id',m.custom_role_id,'custom_role_name_ar',cr.name_ar,'custom_role_name_en',cr.name_en,
      'status',case when m.access_expires_at is not null and m.access_expires_at<=now() then 'expired' else m.status end,
      'joined_at',m.joined_at,'last_sign_in_at',u.last_sign_in_at,
      'mfa_enabled',exists(select 1 from auth.mfa_factors f where f.user_id=m.user_id and f.status='verified'),
      'mfa_required',private.b2b_role_mfa_required(p_org,m.member_role,m.mfa_required),
      'approval_limit',m.approval_limit,'access_expires_at',m.access_expires_at,
      'site_ids',coalesce((select jsonb_agg(a.site_id) from public.organization_member_site_access a where a.organization_id=p_org and a.user_id=m.user_id),'[]'::jsonb),
      'permissions',private.b2b_effective_permissions(p_org,m.user_id),'permission_overrides',coalesce(m.permission_overrides,'{}'::jsonb)
    ) obj,
    case when m.member_role='owner' then 0 else 1 end sort_owner,
    lower(coalesce(p.full_name,p.email,u.email,m.user_id::text)) name_sort
    from public.organization_members m
    left join public.customer_profiles p on p.id=m.user_id
    left join auth.users u on u.id=m.user_id
    left join public.organization_custom_roles cr on cr.id=m.custom_role_id
    where m.organization_id=p_org and m.status<>'removed'
  ) x;

  if private.b2b_has_permission(p_org,'manage_team',null) then
    select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at desc),'[]'::jsonb) into v_invites from public.organization_member_invites i where i.organization_id=p_org and i.status in ('pending','expired');
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at),'[]'::jsonb) into v_roles from public.organization_custom_roles r where r.organization_id=p_org and r.is_active;
    select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'responsibility_key',r.responsibility_key,'site_id',r.site_id,'user_id',r.user_id,'full_name',p.full_name,'email',p.email) order by r.responsibility_key),'[]'::jsonb) into v_resp from public.organization_responsibilities r left join public.customer_profiles p on p.id=r.user_id where r.organization_id=p_org;
    select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb) into v_audit from (select * from public.organization_member_audit where organization_id=p_org order by created_at desc limit 60) a;
  else v_invites:='[]'::jsonb;v_roles:='[]'::jsonb;v_resp:='[]'::jsonb;v_audit:='[]'::jsonb; end if;

  select coalesce(jsonb_agg(c.obj),'[]'::jsonb) into v_care from (
    select jsonb_build_object('type','mfa','severity','high','user_id',m.user_id,'label',coalesce(p.full_name,p.email,u.email),'detail','sensitive_without_mfa') obj
      from public.organization_members m left join public.customer_profiles p on p.id=m.user_id left join auth.users u on u.id=m.user_id
      where m.organization_id=p_org and m.status='active' and private.b2b_role_mfa_required(p_org,m.member_role,m.mfa_required)
        and not exists(select 1 from auth.mfa_factors f where f.user_id=m.user_id and f.status='verified')
    union all
    select jsonb_build_object('type','inactive','severity','medium','user_id',m.user_id,'label',coalesce(p.full_name,p.email,u.email),'detail','inactive_member')
      from public.organization_members m left join public.customer_profiles p on p.id=m.user_id left join auth.users u on u.id=m.user_id
      where m.organization_id=p_org and m.status='active' and coalesce(u.last_sign_in_at,m.joined_at,now()) < now()-(v_inactive||' days')::interval
    union all
    select jsonb_build_object('type','expiry','severity','medium','user_id',m.user_id,'label',coalesce(p.full_name,p.email,u.email),'detail','temporary_access_expiring','expires_at',m.access_expires_at)
      from public.organization_members m left join public.customer_profiles p on p.id=m.user_id left join auth.users u on u.id=m.user_id
      where m.organization_id=p_org and m.status='active' and m.access_expires_at between now() and now()+(v_temp||' days')::interval
    union all
    select jsonb_build_object('type','site_owner','severity','medium','site_id',s.id,'label',coalesce(s.name_ar,s.name_en),'detail','site_without_manager')
      from public.organization_sites s where s.organization_id=p_org and s.is_active
      and not exists(
        select 1 from public.organization_members m
        where m.organization_id=p_org and m.status='active' and m.member_role in ('owner','organization_manager','site_manager')
          and (not exists(select 1 from public.organization_member_site_access a where a.organization_id=p_org and a.user_id=m.user_id)
               or exists(select 1 from public.organization_member_site_access a where a.organization_id=p_org and a.user_id=m.user_id and a.site_id=s.id))
      )
  ) c;
  return jsonb_build_object('members',v_members,'invites',v_invites,'custom_roles',v_roles,'policy',v_policy,'responsibilities',v_resp,'care',v_care,'audit',v_audit);
end $$;
revoke all on function private.get_organization_team_center_v2_impl(uuid) from public,anon;
grant execute on function private.get_organization_team_center_v2_impl(uuid) to authenticated;
create or replace function public.get_organization_team_center_v2(p_organization_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_organization_team_center_v2_impl(p_organization_id); $$;
revoke all on function public.get_organization_team_center_v2(uuid) from public,anon;
grant execute on function public.get_organization_team_center_v2(uuid) to authenticated;

create or replace function private.create_organization_member_invite_v2_impl(p_org uuid,p_email text,p_full_name text,p_role text,p_custom_role uuid,p_site_ids uuid[],p_expires_at timestamptz,p_approval_limit numeric,p_mfa_required boolean,p_permissions jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_token uuid;
begin
  if not private.b2b_team_manage_allowed(p_org) then raise exception 'TEAM_MANAGE_DENIED_OR_MFA_REQUIRED'; end if;
  if p_role='owner' then raise exception 'OWNER_REQUIRES_TRANSFER'; end if;
  if p_role not in ('organization_manager','procurement_manager','approver','finance','site_manager','receiving_officer','viewer') then raise exception 'INVALID_ROLE'; end if;
  if p_custom_role is not null and not exists(select 1 from public.organization_custom_roles where id=p_custom_role and organization_id=p_org and is_active) then raise exception 'INVALID_CUSTOM_ROLE'; end if;
  if exists(select 1 from unnest(coalesce(p_site_ids,'{}'::uuid[])) x where not exists(select 1 from public.organization_sites s where s.id=x and s.organization_id=p_org and s.is_active)) then raise exception 'INVALID_SITE_SCOPE'; end if;
  update public.organization_member_invites set status='expired',updated_at=now() where organization_id=p_org and status='pending' and access_expires_at is not null and access_expires_at<=now();
  insert into public.organization_member_invites(organization_id,email,full_name,member_role,custom_role_id,site_ids,approval_limit,access_expires_at,mfa_required,permission_overrides,invited_by)
  values(p_org,lower(trim(p_email)),nullif(trim(p_full_name),''),p_role,p_custom_role,coalesce(p_site_ids,'{}'::uuid[]),p_approval_limit,p_expires_at,coalesce(p_mfa_required,false),private.b2b_validate_permission_map(p_permissions),auth.uid()) returning id,invite_token into v_id,v_token;
  insert into public.organization_member_audit(organization_id,actor_user_id,action,after_state) values(p_org,auth.uid(),'invite_created',jsonb_build_object('invite_id',v_id,'email',lower(trim(p_email)),'role',p_role,'sites',p_site_ids,'approval_limit',p_approval_limit));
  return jsonb_build_object('id',v_id,'invite_token',v_token);
end $$;
revoke all on function private.create_organization_member_invite_v2_impl(uuid,text,text,text,uuid,uuid[],timestamptz,numeric,boolean,jsonb) from public,anon;
grant execute on function private.create_organization_member_invite_v2_impl(uuid,text,text,text,uuid,uuid[],timestamptz,numeric,boolean,jsonb) to authenticated;
create or replace function public.create_organization_member_invite_v2(p_organization_id uuid,p_email text,p_full_name text default null,p_role text default 'viewer',p_custom_role_id uuid default null,p_site_ids uuid[] default '{}'::uuid[],p_expires_at timestamptz default null,p_approval_limit numeric default null,p_mfa_required boolean default false,p_permission_overrides jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.create_organization_member_invite_v2_impl(p_organization_id,p_email,p_full_name,p_role,p_custom_role_id,p_site_ids,p_expires_at,p_approval_limit,p_mfa_required,p_permission_overrides); $$;
revoke all on function public.create_organization_member_invite_v2(uuid,text,text,text,uuid,uuid[],timestamptz,numeric,boolean,jsonb) from public,anon;
grant execute on function public.create_organization_member_invite_v2(uuid,text,text,text,uuid,uuid[],timestamptz,numeric,boolean,jsonb) to authenticated;

create or replace function private.accept_organization_member_invite_v2_impl(p_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.organization_member_invites%rowtype; v_email text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select lower(email) into v_email from auth.users where id=auth.uid();
  select * into i from public.organization_member_invites where invite_token=p_token and status='pending' for update;
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;
  if i.access_expires_at is not null and i.access_expires_at<=now() then update public.organization_member_invites set status='expired',updated_at=now() where id=i.id; raise exception 'INVITE_EXPIRED'; end if;
  if lower(i.email)<>v_email then raise exception 'INVITE_EMAIL_MISMATCH'; end if;
  insert into public.organization_members(organization_id,user_id,member_role,status,approval_limit,access_expires_at,mfa_required,permissions,permission_overrides,custom_role_id,joined_at,updated_at)
  values(i.organization_id,auth.uid(),i.member_role,'active',i.approval_limit,i.access_expires_at,i.mfa_required,'{}'::jsonb,i.permission_overrides,i.custom_role_id,now(),now())
  on conflict (organization_id,user_id) do update set member_role=excluded.member_role,status='active',approval_limit=excluded.approval_limit,access_expires_at=excluded.access_expires_at,mfa_required=excluded.mfa_required,permission_overrides=excluded.permission_overrides,custom_role_id=excluded.custom_role_id,updated_at=now();
  delete from public.organization_member_site_access where organization_id=i.organization_id and user_id=auth.uid();
  insert into public.organization_member_site_access(organization_id,user_id,site_id,created_by) select i.organization_id,auth.uid(),x,i.invited_by from unnest(i.site_ids) x;
  update public.organization_member_invites set status='accepted',accepted_by=auth.uid(),accepted_at=now(),updated_at=now() where id=i.id;
  insert into public.organization_member_audit(organization_id,target_user_id,actor_user_id,action,after_state) values(i.organization_id,auth.uid(),auth.uid(),'invite_accepted',jsonb_build_object('invite_id',i.id,'role',i.member_role));
  return jsonb_build_object('organization_id',i.organization_id,'accepted',true);
end $$;
revoke all on function private.accept_organization_member_invite_v2_impl(uuid) from public,anon;
grant execute on function private.accept_organization_member_invite_v2_impl(uuid) to authenticated;
create or replace function public.accept_organization_member_invite_v2(p_invite_token uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.accept_organization_member_invite_v2_impl(p_invite_token); $$;
revoke all on function public.accept_organization_member_invite_v2(uuid) from public,anon;
grant execute on function public.accept_organization_member_invite_v2(uuid) to authenticated;

create or replace function private.update_organization_member_access_v2_impl(p_org uuid,p_user uuid,p_role text,p_custom_role uuid,p_site_ids uuid[],p_approval_limit numeric,p_expires_at timestamptz,p_mfa_required boolean,p_permissions jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_before jsonb; v_after jsonb; v_old_role text; v_owner_count int;
begin
  if not private.b2b_team_manage_allowed(p_org) then raise exception 'TEAM_MANAGE_DENIED_OR_MFA_REQUIRED'; end if;
  select to_jsonb(m),m.member_role into v_before,v_old_role from public.organization_members m where m.organization_id=p_org and m.user_id=p_user for update;
  if v_before is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  if p_role='owner' and v_old_role<>'owner' then raise exception 'OWNER_REQUIRES_TRANSFER'; end if;
  if p_role not in ('owner','organization_manager','procurement_manager','approver','finance','site_manager','receiving_officer','viewer') then raise exception 'INVALID_ROLE'; end if;
  select count(*) into v_owner_count from public.organization_members where organization_id=p_org and member_role='owner' and status='active';
  if v_old_role='owner' and p_role<>'owner' and v_owner_count<=1 then raise exception 'LAST_OWNER_PROTECTED'; end if;
  if p_custom_role is not null and not exists(select 1 from public.organization_custom_roles where id=p_custom_role and organization_id=p_org and is_active) then raise exception 'INVALID_CUSTOM_ROLE'; end if;
  if exists(select 1 from unnest(coalesce(p_site_ids,'{}'::uuid[])) x where not exists(select 1 from public.organization_sites s where s.id=x and s.organization_id=p_org and s.is_active)) then raise exception 'INVALID_SITE_SCOPE'; end if;
  update public.organization_members set member_role=p_role,custom_role_id=p_custom_role,approval_limit=p_approval_limit,access_expires_at=p_expires_at,mfa_required=coalesce(p_mfa_required,false),permission_overrides=private.b2b_validate_permission_map(p_permissions),updated_at=now() where organization_id=p_org and user_id=p_user;
  delete from public.organization_member_site_access where organization_id=p_org and user_id=p_user;
  insert into public.organization_member_site_access(organization_id,user_id,site_id,created_by) select p_org,p_user,x,auth.uid() from unnest(coalesce(p_site_ids,'{}'::uuid[])) x;
  select to_jsonb(m) into v_after from public.organization_members m where m.organization_id=p_org and m.user_id=p_user;
  insert into public.organization_member_audit(organization_id,target_user_id,actor_user_id,action,before_state,after_state,metadata) values(p_org,p_user,auth.uid(),'member_access_updated',v_before,v_after,jsonb_build_object('site_ids',p_site_ids));
  return jsonb_build_object('ok',true);
end $$;
revoke all on function private.update_organization_member_access_v2_impl(uuid,uuid,text,uuid,uuid[],numeric,timestamptz,boolean,jsonb) from public,anon;
grant execute on function private.update_organization_member_access_v2_impl(uuid,uuid,text,uuid,uuid[],numeric,timestamptz,boolean,jsonb) to authenticated;
create or replace function public.update_organization_member_access_v2(p_organization_id uuid,p_member_user_id uuid,p_role text,p_custom_role_id uuid default null,p_site_ids uuid[] default '{}'::uuid[],p_approval_limit numeric default null,p_access_expires_at timestamptz default null,p_mfa_required boolean default false,p_permission_overrides jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.update_organization_member_access_v2_impl(p_organization_id,p_member_user_id,p_role,p_custom_role_id,p_site_ids,p_approval_limit,p_access_expires_at,p_mfa_required,p_permission_overrides); $$;
revoke all on function public.update_organization_member_access_v2(uuid,uuid,text,uuid,uuid[],numeric,timestamptz,boolean,jsonb) from public,anon;
grant execute on function public.update_organization_member_access_v2(uuid,uuid,text,uuid,uuid[],numeric,timestamptz,boolean,jsonb) to authenticated;

create or replace function private.set_organization_member_state_v2_impl(p_org uuid,p_user uuid,p_state text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_before jsonb; v_role text; v_count int;
begin
 if not private.b2b_team_manage_allowed(p_org) then raise exception 'TEAM_MANAGE_DENIED_OR_MFA_REQUIRED'; end if;
 if p_state not in ('active','suspended','removed') then raise exception 'INVALID_STATE'; end if;
 select to_jsonb(m),m.member_role into v_before,v_role from public.organization_members m where m.organization_id=p_org and m.user_id=p_user for update;
 if v_before is null then raise exception 'MEMBER_NOT_FOUND'; end if;
 select count(*) into v_count from public.organization_members where organization_id=p_org and member_role='owner' and status='active';
 if v_role='owner' and v_count<=1 and p_state<>'active' then raise exception 'LAST_OWNER_PROTECTED'; end if;
 update public.organization_members set status=p_state,suspended_at=case when p_state='suspended' then now() else null end,removed_at=case when p_state='removed' then now() else null end,updated_at=now() where organization_id=p_org and user_id=p_user;
 insert into public.organization_member_audit(organization_id,target_user_id,actor_user_id,action,before_state,after_state) select p_org,p_user,auth.uid(),'member_'||p_state,v_before,to_jsonb(m) from public.organization_members m where m.organization_id=p_org and m.user_id=p_user;
 return jsonb_build_object('ok',true,'status',p_state);
end $$;
revoke all on function private.set_organization_member_state_v2_impl(uuid,uuid,text) from public,anon;
grant execute on function private.set_organization_member_state_v2_impl(uuid,uuid,text) to authenticated;
create or replace function public.set_organization_member_state_v2(p_organization_id uuid,p_member_user_id uuid,p_state text) returns jsonb language sql security invoker set search_path='' as $$ select private.set_organization_member_state_v2_impl(p_organization_id,p_member_user_id,p_state); $$;
revoke all on function public.set_organization_member_state_v2(uuid,uuid,text) from public,anon;
grant execute on function public.set_organization_member_state_v2(uuid,uuid,text) to authenticated;

create or replace function private.transfer_organization_ownership_v2_impl(p_org uuid,p_new_owner uuid,p_keep_current_owner boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_current uuid:=auth.uid();
begin
 if not private.b2b_current_aal2() then raise exception 'AAL2_REQUIRED'; end if;
 if not exists(select 1 from public.organization_members where organization_id=p_org and user_id=v_current and member_role='owner' and status='active') then raise exception 'OWNER_REQUIRED'; end if;
 if not exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_new_owner and status='active') then raise exception 'TARGET_NOT_ACTIVE_MEMBER'; end if;
 update public.organization_members set member_role='owner',updated_at=now() where organization_id=p_org and user_id=p_new_owner;
 if not coalesce(p_keep_current_owner,false) and p_new_owner<>v_current then update public.organization_members set member_role='organization_manager',updated_at=now() where organization_id=p_org and user_id=v_current; end if;
 insert into public.organization_member_audit(organization_id,target_user_id,actor_user_id,action,metadata) values(p_org,p_new_owner,v_current,'ownership_transferred',jsonb_build_object('previous_owner',v_current,'keep_current_owner',coalesce(p_keep_current_owner,false)));
 return jsonb_build_object('ok',true,'new_owner',p_new_owner);
end $$;
revoke all on function private.transfer_organization_ownership_v2_impl(uuid,uuid,boolean) from public,anon;
grant execute on function private.transfer_organization_ownership_v2_impl(uuid,uuid,boolean) to authenticated;
create or replace function public.transfer_organization_ownership_v2(p_organization_id uuid,p_new_owner_user_id uuid,p_keep_current_owner boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.transfer_organization_ownership_v2_impl(p_organization_id,p_new_owner_user_id,p_keep_current_owner); $$;
revoke all on function public.transfer_organization_ownership_v2(uuid,uuid,boolean) from public,anon;
grant execute on function public.transfer_organization_ownership_v2(uuid,uuid,boolean) to authenticated;

create or replace function private.save_organization_access_policy_v2_impl(p_org uuid,p_policy jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.b2b_team_manage_allowed(p_org) then raise exception 'TEAM_MANAGE_DENIED_OR_MFA_REQUIRED'; end if;
 insert into public.organization_access_policies(organization_id,require_mfa_managers,require_mfa_approvers,require_mfa_finance,inactivity_warning_days,temporary_access_warning_days,updated_by,updated_at)
 values(p_org,coalesce((p_policy->>'require_mfa_managers')::boolean,false),coalesce((p_policy->>'require_mfa_approvers')::boolean,false),coalesce((p_policy->>'require_mfa_finance')::boolean,false),coalesce((p_policy->>'inactivity_warning_days')::int,60),coalesce((p_policy->>'temporary_access_warning_days')::int,7),auth.uid(),now())
 on conflict(organization_id) do update set require_mfa_managers=excluded.require_mfa_managers,require_mfa_approvers=excluded.require_mfa_approvers,require_mfa_finance=excluded.require_mfa_finance,inactivity_warning_days=excluded.inactivity_warning_days,temporary_access_warning_days=excluded.temporary_access_warning_days,updated_by=auth.uid(),updated_at=now();
 insert into public.organization_member_audit(organization_id,actor_user_id,action,after_state) values(p_org,auth.uid(),'access_policy_updated',p_policy);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function private.save_organization_access_policy_v2_impl(uuid,jsonb) from public,anon;
grant execute on function private.save_organization_access_policy_v2_impl(uuid,jsonb) to authenticated;
create or replace function public.save_organization_access_policy_v2(p_organization_id uuid,p_policy jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.save_organization_access_policy_v2_impl(p_organization_id,p_policy); $$;
revoke all on function public.save_organization_access_policy_v2(uuid,jsonb) from public,anon;
grant execute on function public.save_organization_access_policy_v2(uuid,jsonb) to authenticated;

create or replace function private.save_organization_responsibility_v2_impl(p_org uuid,p_key text,p_site uuid,p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_previous uuid;
begin
 if not private.b2b_team_manage_allowed(p_org) then raise exception 'TEAM_MANAGE_DENIED_OR_MFA_REQUIRED'; end if;
 if p_key not in ('procurement','finance','contracts','approval','site') then raise exception 'INVALID_RESPONSIBILITY'; end if;
 if p_key='site' then if p_site is null or not exists(select 1 from public.organization_sites where id=p_site and organization_id=p_org) then raise exception 'INVALID_SITE'; end if; else p_site:=null; end if;
 if p_user is not null and not exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_user and status='active' and (access_expires_at is null or access_expires_at>now())) then raise exception 'MEMBER_NOT_ACTIVE'; end if;
 select user_id into v_previous from public.organization_responsibilities where organization_id=p_org and responsibility_key=p_key and site_id is not distinct from p_site limit 1;
 delete from public.organization_responsibilities where organization_id=p_org and responsibility_key=p_key and site_id is not distinct from p_site;
 if p_user is not null then
   insert into public.organization_responsibilities(organization_id,responsibility_key,site_id,user_id,created_by) values(p_org,p_key,p_site,p_user,auth.uid());
 end if;
 insert into public.organization_member_audit(organization_id,target_user_id,actor_user_id,action,metadata)
 values(p_org,coalesce(p_user,v_previous),auth.uid(),case when p_user is null then 'responsibility_cleared' else 'responsibility_assigned' end,jsonb_build_object('key',p_key,'site_id',p_site,'previous_user_id',v_previous,'new_user_id',p_user));
 return jsonb_build_object('ok',true,'assigned_user_id',p_user);
end $$;
revoke all on function private.save_organization_responsibility_v2_impl(uuid,text,uuid,uuid) from public,anon;
grant execute on function private.save_organization_responsibility_v2_impl(uuid,text,uuid,uuid) to authenticated;
create or replace function public.save_organization_responsibility_v2(p_organization_id uuid,p_responsibility_key text,p_site_id uuid,p_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.save_organization_responsibility_v2_impl(p_organization_id,p_responsibility_key,p_site_id,p_user_id); $$;
revoke all on function public.save_organization_responsibility_v2(uuid,text,uuid,uuid) from public,anon;
grant execute on function public.save_organization_responsibility_v2(uuid,text,uuid,uuid) to authenticated;

create or replace function private.save_organization_custom_role_v2_impl(p_org uuid,p_id uuid,p_name_ar text,p_name_en text,p_permissions jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.b2b_team_manage_allowed(p_org) then raise exception 'TEAM_MANAGE_DENIED_OR_MFA_REQUIRED'; end if;
 if char_length(trim(coalesce(p_name_ar,'')))<2 then raise exception 'ROLE_NAME_REQUIRED'; end if;
 if p_id is null then
   insert into public.organization_custom_roles(organization_id,name_ar,name_en,permissions,created_by) values(p_org,trim(p_name_ar),nullif(trim(p_name_en),''),private.b2b_validate_permission_map(p_permissions),auth.uid()) returning id into v_id;
 else
   update public.organization_custom_roles set name_ar=trim(p_name_ar),name_en=nullif(trim(p_name_en),''),permissions=private.b2b_validate_permission_map(p_permissions),updated_at=now() where id=p_id and organization_id=p_org returning id into v_id;
   if v_id is null then raise exception 'CUSTOM_ROLE_NOT_FOUND'; end if;
 end if;
 insert into public.organization_member_audit(organization_id,actor_user_id,action,metadata) values(p_org,auth.uid(),'custom_role_saved',jsonb_build_object('role_id',v_id));
 return jsonb_build_object('id',v_id);
end $$;
revoke all on function private.save_organization_custom_role_v2_impl(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function private.save_organization_custom_role_v2_impl(uuid,uuid,text,text,jsonb) to authenticated;
create or replace function public.save_organization_custom_role_v2(p_organization_id uuid,p_role_id uuid default null,p_name_ar text default null,p_name_en text default null,p_permissions jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.save_organization_custom_role_v2_impl(p_organization_id,p_role_id,p_name_ar,p_name_en,p_permissions); $$;
revoke all on function public.save_organization_custom_role_v2(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.save_organization_custom_role_v2(uuid,uuid,text,text,jsonb) to authenticated;

create or replace function private.cancel_organization_member_invite_v2_impl(p_org uuid,p_invite uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.b2b_team_manage_allowed(p_org) then raise exception 'TEAM_MANAGE_DENIED_OR_MFA_REQUIRED'; end if;
 update public.organization_member_invites set status='cancelled',updated_at=now() where id=p_invite and organization_id=p_org and status='pending';
 if not found then raise exception 'INVITE_NOT_FOUND'; end if;
 insert into public.organization_member_audit(organization_id,actor_user_id,action,metadata) values(p_org,auth.uid(),'invite_cancelled',jsonb_build_object('invite_id',p_invite));
 return jsonb_build_object('ok',true);
end $$;
revoke all on function private.cancel_organization_member_invite_v2_impl(uuid,uuid) from public,anon;
grant execute on function private.cancel_organization_member_invite_v2_impl(uuid,uuid) to authenticated;
create or replace function public.cancel_organization_member_invite_v2(p_organization_id uuid,p_invite_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.cancel_organization_member_invite_v2_impl(p_organization_id,p_invite_id); $$;
revoke all on function public.cancel_organization_member_invite_v2(uuid,uuid) from public,anon;
grant execute on function public.cancel_organization_member_invite_v2(uuid,uuid) to authenticated;

-- RLS for page-9 supporting tables uses the effective permission engine.
drop policy if exists organization_custom_roles_read_v1040 on public.organization_custom_roles;
create policy organization_custom_roles_read_v1040 on public.organization_custom_roles for select to authenticated using(private.b2b_has_permission(organization_id,'view_team',null) or private.b2b_has_permission(organization_id,'manage_team',null));
drop policy if exists organization_access_policies_read_v1040 on public.organization_access_policies;
create policy organization_access_policies_read_v1040 on public.organization_access_policies for select to authenticated using(private.b2b_has_permission(organization_id,'view_team',null) or private.b2b_has_permission(organization_id,'manage_team',null));
drop policy if exists organization_responsibilities_read_v1040 on public.organization_responsibilities;
create policy organization_responsibilities_read_v1040 on public.organization_responsibilities for select to authenticated using(private.b2b_has_permission(organization_id,'view_team',null) or private.b2b_has_permission(organization_id,'manage_team',null));

-- Approval-limit + MFA guard: Page 9 settings must affect quotation decisions, not just UI.
create or replace function private.guard_b2b_quotation_approval_v1040()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid:=auth.uid();
  v_member public.organization_members%rowtype;
  v_effective jsonb;
begin
  if new.status is not distinct from old.status or new.status<>'accepted' then return new; end if;
  -- Back-office/service operations are governed by their own admin path.
  if v_uid is null or private.is_balqees_admin() then return new; end if;
  select * into v_member from public.organization_members
    where organization_id=new.organization_id and user_id=v_uid and status='active'
      and (access_expires_at is null or access_expires_at>now())
    for share;
  if not found then raise exception 'APPROVER_MEMBERSHIP_REQUIRED'; end if;
  v_effective:=private.b2b_effective_permissions(new.organization_id,v_uid);
  if not coalesce((v_effective->>'approve_quotations')::boolean,(v_effective->>'accept_quotes')::boolean,false)
     or not private.b2b_site_allowed(new.organization_id,v_uid,new.site_id) then
    raise exception 'QUOTATION_APPROVAL_PERMISSION_DENIED';
  end if;
  if private.b2b_role_mfa_required(new.organization_id,v_member.member_role,v_member.mfa_required)
     and not private.b2b_current_aal2() then
    raise exception 'MFA_AAL2_REQUIRED';
  end if;
  if v_member.approval_limit is not null and coalesce(new.total,0)>v_member.approval_limit then
    raise exception 'APPROVAL_LIMIT_EXCEEDED';
  end if;
  return new;
end $$;
revoke all on function private.guard_b2b_quotation_approval_v1040() from public,anon,authenticated;
drop trigger if exists guard_b2b_quotation_approval_v1040 on public.quotations;
create trigger guard_b2b_quotation_approval_v1040
before update of status on public.quotations
for each row execute function private.guard_b2b_quotation_approval_v1040();

-- =========================================================
-- PAGE 10 — BALQEES SMART CARE
-- =========================================================

-- Retire the v10.39 public SECURITY DEFINER handoff endpoint. The v10.40
-- implementation lives in private with a permission-aware public invoker wrapper.
revoke all on function public.open_organization_care_case(uuid,text,text,jsonb,text) from public,anon,authenticated;
drop function if exists public.open_organization_care_case(uuid,text,text,jsonb,text);

-- Care tool audit contains cross-user operational metadata. Customers receive only
-- the proof chips returned with their own answer; the audit table itself is admin-only.
drop policy if exists "care audit own org read" on public.care_tool_audit;
create policy "care audit admin read v1040" on public.care_tool_audit for select to authenticated using(private.is_balqees_admin());

alter table public.care_settings
  add column if not exists order_lookup_enabled boolean not null default true,
  add column if not exists quotation_lookup_enabled boolean not null default true,
  add column if not exists site_lookup_enabled boolean not null default true,
  add column if not exists request_draft_enabled boolean not null default true,
  add column if not exists employee_assist_enabled boolean not null default true,
  add column if not exists knowledge_enabled boolean not null default true;

alter table public.care_tool_audit
  add column if not exists safe_parameters jsonb not null default '{}'::jsonb,
  add column if not exists result_summary jsonb not null default '{}'::jsonb,
  add column if not exists duration_ms integer;

alter table public.support_conversations
  add column if not exists care_status text not null default 'human_handling',
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by uuid references auth.users(id) on delete set null,
  add column if not exists human_joined_message_at timestamptz;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='support_conversations_care_status_check') then
    alter table public.support_conversations add constraint support_conversations_care_status_check
      check(care_status in ('ai_handling','waiting_customer','needs_human','human_handling','resolved'));
  end if;
end $$;

create table if not exists public.care_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  category text not null default 'faq' check(category in ('faq','policy','service','hours','instruction','change_policy','organization')),
  title_ar text not null,
  title_en text,
  body_ar text not null,
  body_en text,
  keywords text[] not null default '{}'::text[],
  status text not null default 'draft' check(status in ('draft','published','archived')),
  is_ai_enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists care_knowledge_status_org_idx on public.care_knowledge_items(status,organization_id,category);
alter table public.care_knowledge_items enable row level security;
revoke all on public.care_knowledge_items from anon,authenticated;
grant select,insert,update,delete on public.care_knowledge_items to authenticated;
drop policy if exists care_knowledge_read_v1040 on public.care_knowledge_items;
-- Direct table reads are restricted to Balqees admins. Organization users consume
-- published knowledge only through the permission-aware care_search_knowledge_v2 RPC.
create policy care_knowledge_read_v1040 on public.care_knowledge_items for select to authenticated using(private.is_balqees_admin());
drop policy if exists care_knowledge_admin_all_v1040 on public.care_knowledge_items;
create policy care_knowledge_admin_all_v1040 on public.care_knowledge_items for all to authenticated using(private.is_balqees_admin()) with check(private.is_balqees_admin());

create table if not exists public.care_request_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null default 'assistant' check(source_type in ('assistant','repeat_order')),
  source_entity_id uuid,
  site_id uuid references public.organization_sites(id) on delete set null,
  draft_payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check(status in ('draft','consumed','discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists care_request_drafts_user_org_idx on public.care_request_drafts(user_id,organization_id,status,created_at desc);
alter table public.care_request_drafts enable row level security;
revoke all on public.care_request_drafts from anon,authenticated;
grant select,update on public.care_request_drafts to authenticated;
drop policy if exists care_request_drafts_own_v1040 on public.care_request_drafts;
create policy care_request_drafts_own_v1040 on public.care_request_drafts for select to authenticated using(user_id=auth.uid() and private.b2b_has_permission(organization_id,'create_orders',site_id));
drop policy if exists care_request_drafts_update_own_v1040 on public.care_request_drafts;
create policy care_request_drafts_update_own_v1040 on public.care_request_drafts for update to authenticated using(user_id=auth.uid() and private.b2b_has_permission(organization_id,'create_orders',site_id)) with check(user_id=auth.uid() and private.b2b_has_permission(organization_id,'create_orders',site_id));

create or replace function private.care_setting_enabled(p_key text)
returns boolean language sql stable security definer set search_path='' as $$
select coalesce(case p_key
 when 'ai' then s.ai_enabled when 'human' then s.human_handoff_enabled when 'catalog' then s.catalog_search_enabled
 when 'finance' then s.finance_lookup_enabled when 'contract' then s.contract_lookup_enabled when 'orders' then s.order_lookup_enabled
 when 'quotations' then s.quotation_lookup_enabled when 'sites' then s.site_lookup_enabled when 'drafts' then s.request_draft_enabled
 when 'employee_assist' then s.employee_assist_enabled when 'knowledge' then s.knowledge_enabled else false end,false)
from public.care_settings s where s.id=true;
$$;
revoke all on function private.care_setting_enabled(text) from public,anon;
grant execute on function private.care_setting_enabled(text) to authenticated;

create or replace function private.care_log_tool(p_org uuid,p_tool text,p_entity_type text,p_entity_id text,p_params jsonb,p_result jsonb,p_success boolean default true)
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.care_tool_audit(organization_id,user_id,tool_name,entity_type,entity_id,success,safe_parameters,result_summary)
 values(p_org,auth.uid(),p_tool,p_entity_type,p_entity_id,coalesce(p_success,true),coalesce(p_params,'{}'),coalesce(p_result,'{}'));
end $$;
revoke all on function private.care_log_tool(uuid,text,text,text,jsonb,jsonb,boolean) from public,anon,authenticated;

create or replace function private.care_get_active_orders_v2_impl(p_org uuid,p_site uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 if not private.care_setting_enabled('orders') or not private.b2b_has_permission(p_org,'view_orders',p_site) then raise exception 'CARE_ORDER_ACCESS_DENIED'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'reference',o.po_number,'po_number',o.po_number,'status',o.status,'site_id',o.service_site_id,'created_at',o.created_at,'updated_at',o.updated_at,'requested_delivery_date',o.requested_delivery_date) order by o.created_at desc),'[]'::jsonb) into v
 from public.orders o where o.organization_id=p_org and (p_site is null or o.service_site_id=p_site) and o.status not in ('completed','cancelled','delivered') and private.b2b_site_allowed(p_org,auth.uid(),o.service_site_id);
 perform private.care_log_tool(p_org,'get_active_orders','organization',p_org::text,jsonb_build_object('site_id',p_site),jsonb_build_object('count',jsonb_array_length(v)));
 return v;
end $$;
revoke all on function private.care_get_active_orders_v2_impl(uuid,uuid) from public,anon;
grant execute on function private.care_get_active_orders_v2_impl(uuid,uuid) to authenticated;
create or replace function public.care_get_active_orders_v2(p_organization_id uuid,p_site_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.care_get_active_orders_v2_impl(p_organization_id,p_site_id); $$;
revoke all on function public.care_get_active_orders_v2(uuid,uuid) from public,anon;
grant execute on function public.care_get_active_orders_v2(uuid,uuid) to authenticated;

create or replace function private.care_get_order_details_v2_impl(p_org uuid,p_order uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; v_items jsonb; v_events jsonb; v jsonb;
begin
 if not private.care_setting_enabled('orders') then raise exception 'CARE_TOOL_DISABLED'; end if;
 select * into o from public.orders where id=p_order and organization_id=p_org;
 if not found or not private.b2b_has_permission(p_org,'view_orders',o.service_site_id) then raise exception 'CARE_ORDER_ACCESS_DENIED'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'product_snapshot',i.product_snapshot,'quantity',i.quantity,'line_total',case when private.b2b_has_permission(p_org,'view_financial_documents',o.service_site_id) or private.b2b_has_permission(p_org,'approve_quotations',o.service_site_id) then i.line_total else null end)),'[]') into v_items from public.order_items i where i.order_id=p_order;
 select coalesce(jsonb_agg(jsonb_build_object('event_type',e.event_type,'title_ar',e.title_ar,'title_en',e.title_en,'body_ar',e.body_ar,'body_en',e.body_en,'created_at',e.created_at) order by e.created_at desc),'[]') into v_events from public.order_events e where e.order_id=p_order;
 v:=jsonb_build_object('id',o.id,'order_number',o.order_number,'reference',o.po_number,'po_number',o.po_number,'status',o.status,'site_id',o.service_site_id,'requested_delivery_date',o.requested_delivery_date,'created_at',o.created_at,'updated_at',o.updated_at,'items',v_items,'events',v_events);
 perform private.care_log_tool(p_org,'get_order_details','order',p_order::text,'{}',jsonb_build_object('status',o.status,'items',jsonb_array_length(v_items)));
 return v;
end $$;
revoke all on function private.care_get_order_details_v2_impl(uuid,uuid) from public,anon;
grant execute on function private.care_get_order_details_v2_impl(uuid,uuid) to authenticated;
create or replace function public.care_get_order_details_v2(p_organization_id uuid,p_order_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.care_get_order_details_v2_impl(p_organization_id,p_order_id); $$;
revoke all on function public.care_get_order_details_v2(uuid,uuid) from public,anon;
grant execute on function public.care_get_order_details_v2(uuid,uuid) to authenticated;

create or replace function private.care_get_quotation_v2_impl(p_org uuid,p_quote uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quotations%rowtype; v_items jsonb; v jsonb; v_money boolean;
begin
 if not private.care_setting_enabled('quotations') then raise exception 'CARE_TOOL_DISABLED'; end if;
 select * into q from public.quotations where id=p_quote and organization_id=p_org and status<>'draft';
 if not found or not private.b2b_has_permission(p_org,'view_quotations',q.site_id) then raise exception 'CARE_QUOTE_ACCESS_DENIED'; end if;
 v_money:=private.b2b_has_permission(p_org,'view_financial_documents',q.site_id) or private.b2b_has_permission(p_org,'approve_quotations',q.site_id);
 select coalesce(jsonb_agg(jsonb_build_object('line_key',i.line_key,'description_ar',i.description_ar,'description_en',i.description_en,'quantity',i.quantity,'unit_ar',i.unit_ar,'unit_en',i.unit_en,'unit_price',case when v_money then i.unit_price else null end,'line_total',case when v_money then i.line_total else null end) order by i.sort_order),'[]') into v_items from public.quotation_items i where i.quotation_id=p_quote;
 v:=jsonb_build_object('id',q.id,'quote_number',q.quote_number,'version_number',q.version_number,'series_id',q.series_id,'status',q.status,'site_id',q.site_id,'valid_until',q.valid_until,'title_ar',q.title_ar,'title_en',q.title_en,'total',case when v_money then q.total else null end,'subtotal',case when v_money then q.subtotal else null end,'vat_total',case when v_money then q.vat_total else null end,'items',v_items);
 perform private.care_log_tool(p_org,'get_quotation','quotation',p_quote::text,'{}',jsonb_build_object('status',q.status,'version',q.version_number)); return v;
end $$;
revoke all on function private.care_get_quotation_v2_impl(uuid,uuid) from public,anon;
grant execute on function private.care_get_quotation_v2_impl(uuid,uuid) to authenticated;
create or replace function public.care_get_quotation_v2(p_organization_id uuid,p_quotation_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.care_get_quotation_v2_impl(p_organization_id,p_quotation_id); $$;
revoke all on function public.care_get_quotation_v2(uuid,uuid) from public,anon;
grant execute on function public.care_get_quotation_v2(uuid,uuid) to authenticated;

create or replace function private.care_compare_quotation_versions_v2_impl(p_org uuid,p_quote uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quotations%rowtype; prev public.quotations%rowtype; v_changes jsonb; v jsonb; v_money boolean;
begin
 select * into q from public.quotations where id=p_quote and organization_id=p_org and status<>'draft';
 if not found or not private.b2b_has_permission(p_org,'view_quotations',q.site_id) then raise exception 'CARE_QUOTE_ACCESS_DENIED'; end if;
 select * into prev from public.quotations where series_id=q.series_id and version_number<q.version_number and status<>'draft' order by version_number desc limit 1;
 if not found then return jsonb_build_object('current_version',q.version_number,'previous_version',null,'changes','[]'::jsonb,'message','NO_PREVIOUS_VERSION'); end if;
 v_money:=private.b2b_has_permission(p_org,'view_financial_documents',q.site_id) or private.b2b_has_permission(p_org,'approve_quotations',q.site_id);
 select coalesce(jsonb_agg(x),'[]') into v_changes from (
   select jsonb_build_object('line_key',coalesce(c.line_key,p.line_key),'description_ar',coalesce(c.description_ar,p.description_ar),'description_en',coalesce(c.description_en,p.description_en),'change_type',case when p.id is null then 'added' when c.id is null then 'removed' when c.quantity is distinct from p.quantity or c.unit_price is distinct from p.unit_price or c.description_ar is distinct from p.description_ar or c.description_en is distinct from p.description_en then 'changed' else 'unchanged' end,'before_quantity',p.quantity,'after_quantity',c.quantity,'before_unit_price',case when v_money then p.unit_price else null end,'after_unit_price',case when v_money then c.unit_price else null end)
   from public.quotation_items c full join public.quotation_items p on p.quotation_id=prev.id and c.quotation_id=q.id and p.line_key=c.line_key
   where (c.quotation_id=q.id or p.quotation_id=prev.id)
 ) x where x->>'change_type'<>'unchanged';
 v:=jsonb_build_object('current_version',q.version_number,'previous_version',prev.version_number,'current_total',case when v_money then q.total else null end,'previous_total',case when v_money then prev.total else null end,'changes',v_changes);
 perform private.care_log_tool(p_org,'compare_quotation_versions','quotation',p_quote::text,'{}',jsonb_build_object('change_count',jsonb_array_length(v_changes))); return v;
end $$;
revoke all on function private.care_compare_quotation_versions_v2_impl(uuid,uuid) from public,anon;
grant execute on function private.care_compare_quotation_versions_v2_impl(uuid,uuid) to authenticated;
create or replace function public.care_compare_quotation_versions_v2(p_organization_id uuid,p_quotation_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.care_compare_quotation_versions_v2_impl(p_organization_id,p_quotation_id); $$;
revoke all on function public.care_compare_quotation_versions_v2(uuid,uuid) from public,anon;
grant execute on function public.care_compare_quotation_versions_v2(uuid,uuid) to authenticated;

create or replace function private.care_get_contract_summary_v2_impl(p_org uuid,p_contract uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.contracts%rowtype; v_sites jsonb; v_services jsonb; v jsonb;
begin
 if not private.care_setting_enabled('contract') or not private.b2b_has_permission(p_org,'view_contracts',null) then raise exception 'CARE_CONTRACT_ACCESS_DENIED'; end if;
 select * into c from public.contracts where id=p_contract and organization_id=p_org and status<>'draft'; if not found then raise exception 'CONTRACT_NOT_FOUND'; end if;
 -- A site-scoped member may only inspect a contract that covers at least one of their allowed sites.
 if exists(select 1 from public.organization_member_site_access a where a.organization_id=p_org and a.user_id=auth.uid())
    and not exists(select 1 from public.contract_sites cs join public.organization_member_site_access a on a.organization_id=p_org and a.user_id=auth.uid() and a.site_id=cs.site_id where cs.contract_id=p_contract) then
   raise exception 'CARE_CONTRACT_SITE_SCOPE_DENIED';
 end if;
 select coalesce(jsonb_agg(to_jsonb(cs)),'[]') into v_sites from public.contract_sites cs where cs.contract_id=p_contract and private.b2b_site_allowed(p_org,auth.uid(),cs.site_id);
 select coalesce(jsonb_agg(to_jsonb(s) order by s.sort_order,s.created_at),'[]') into v_services from public.contract_services s where s.contract_id=p_contract;
 v:=jsonb_build_object(
   'contract',jsonb_build_object(
     'id',c.id,'contract_number',c.contract_number,'title_ar',c.title_ar,'title_en',c.title_en,
     'status',c.status,'starts_on',c.starts_on,'ends_on',c.ends_on,
     'services_summary_ar',c.services_summary_ar,'services_summary_en',c.services_summary_en,
     'coverage_notes_ar',c.coverage_notes_ar,'coverage_notes_en',c.coverage_notes_en,
     'next_review_on',c.next_review_on,'renewal_status',c.renewal_status
   ),
   'sites',v_sites,'services',v_services,
   'coverage_is_structured',(jsonb_array_length(v_sites)>0 or jsonb_array_length(v_services)>0)
 );
 perform private.care_log_tool(p_org,'get_contract_summary','contract',p_contract::text,'{}',jsonb_build_object('structured',v->'coverage_is_structured')); return v;
end $$;
revoke all on function private.care_get_contract_summary_v2_impl(uuid,uuid) from public,anon;
grant execute on function private.care_get_contract_summary_v2_impl(uuid,uuid) to authenticated;
create or replace function public.care_get_contract_summary_v2(p_organization_id uuid,p_contract_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.care_get_contract_summary_v2_impl(p_organization_id,p_contract_id); $$;
revoke all on function public.care_get_contract_summary_v2(uuid,uuid) from public,anon;
grant execute on function public.care_get_contract_summary_v2(uuid,uuid) to authenticated;

create or replace function private.care_get_site_details_v2_impl(p_org uuid,p_site uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.organization_sites%rowtype; v jsonb;
begin
 if not private.care_setting_enabled('sites') or not private.b2b_has_permission(p_org,'view_sites',p_site) then raise exception 'CARE_SITE_ACCESS_DENIED'; end if;
 select * into s from public.organization_sites where id=p_site and organization_id=p_org; if not found then raise exception 'SITE_NOT_FOUND'; end if;
 v:=to_jsonb(s)-'created_by'-'last_verified_by';
 perform private.care_log_tool(p_org,'get_site_details','site',p_site::text,'{}',jsonb_build_object('is_active',s.is_active)); return v;
end $$;
revoke all on function private.care_get_site_details_v2_impl(uuid,uuid) from public,anon;
grant execute on function private.care_get_site_details_v2_impl(uuid,uuid) to authenticated;
create or replace function public.care_get_site_details_v2(p_organization_id uuid,p_site_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.care_get_site_details_v2_impl(p_organization_id,p_site_id); $$;
revoke all on function public.care_get_site_details_v2(uuid,uuid) from public,anon;
grant execute on function public.care_get_site_details_v2(uuid,uuid) to authenticated;

create or replace function private.care_search_catalog_v2_impl(p_org uuid,p_query text,p_site uuid,p_limit int)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 if not private.care_setting_enabled('catalog') or not private.b2b_has_permission(p_org,'view_catalog',p_site) then raise exception 'CARE_CATALOG_ACCESS_DENIED'; end if;
 select coalesce(jsonb_agg(x.j),'[]') into v from (
   select to_jsonb(r) j from public.get_organization_catalog_products(p_org,p_site) r
   where trim(coalesce(p_query,''))='' or to_jsonb(r)::text ilike '%'||replace(trim(p_query),'%','')||'%'
   limit greatest(1,least(coalesce(p_limit,6),12))
 ) x;
 perform private.care_log_tool(p_org,'search_catalog','organization',p_org::text,jsonb_build_object('query',left(coalesce(p_query,''),120),'site_id',p_site),jsonb_build_object('count',jsonb_array_length(v))); return v;
end $$;
revoke all on function private.care_search_catalog_v2_impl(uuid,text,uuid,int) from public,anon;
grant execute on function private.care_search_catalog_v2_impl(uuid,text,uuid,int) to authenticated;
create or replace function public.care_search_catalog_v2(p_organization_id uuid,p_query text default '',p_site_id uuid default null,p_limit int default 6) returns jsonb language sql security invoker set search_path='' as $$ select private.care_search_catalog_v2_impl(p_organization_id,p_query,p_site_id,p_limit); $$;
revoke all on function public.care_search_catalog_v2(uuid,text,uuid,int) from public,anon;
grant execute on function public.care_search_catalog_v2(uuid,text,uuid,int) to authenticated;

create or replace function private.care_get_financial_documents_v2_impl(p_org uuid,p_limit int,p_source_kind text,p_source_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 if not private.care_setting_enabled('finance') or not private.b2b_has_permission(p_org,'view_financial_documents',null) then raise exception 'CARE_FINANCE_ACCESS_DENIED'; end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v from (
   select * from public.get_organization_document_center(p_org) d
   where (p_source_id is null or (d.source_kind=p_source_kind and d.source_id::text=p_source_id::text))
     and (
       not exists(select 1 from public.organization_member_site_access a where a.organization_id=p_org and a.user_id=auth.uid())
       or (d.site_id is not null and exists(select 1 from public.organization_member_site_access a where a.organization_id=p_org and a.user_id=auth.uid() and a.site_id=d.site_id))
     )
   order by d.created_at desc
   limit greatest(1,least(coalesce(p_limit,8),25))
 ) x;
 perform private.care_log_tool(p_org,'get_financial_documents','organization',p_org::text,jsonb_build_object('limit',p_limit,'source_kind',p_source_kind,'source_id',p_source_id),jsonb_build_object('count',jsonb_array_length(v))); return v;
end $$;
revoke all on function private.care_get_financial_documents_v2_impl(uuid,int,text,uuid) from public,anon;
grant execute on function private.care_get_financial_documents_v2_impl(uuid,int,text,uuid) to authenticated;
create or replace function public.care_get_financial_documents_v2(p_organization_id uuid,p_limit int default 8,p_source_kind text default null,p_source_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.care_get_financial_documents_v2_impl(p_organization_id,p_limit,p_source_kind,p_source_id); $$;
revoke all on function public.care_get_financial_documents_v2(uuid,int,text,uuid) from public,anon;
grant execute on function public.care_get_financial_documents_v2(uuid,int,text,uuid) to authenticated;

create or replace function private.care_prepare_repeat_order_v2_impl(p_org uuid,p_order uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; v_items jsonb; v_id uuid;
begin
 if not private.care_setting_enabled('drafts') then raise exception 'CARE_TOOL_DISABLED'; end if;
 select * into o from public.orders where id=p_order and organization_id=p_org; if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if not private.b2b_has_permission(p_org,'create_orders',o.service_site_id) then raise exception 'CARE_DRAFT_ACCESS_DENIED'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('product_id',i.product_id,'product_snapshot',i.product_snapshot,'quantity',i.quantity)),'[]') into v_items from public.order_items i where i.order_id=p_order;
 insert into public.care_request_drafts(organization_id,user_id,source_type,source_entity_id,site_id,draft_payload)
 values(p_org,auth.uid(),'repeat_order',p_order,o.service_site_id,jsonb_build_object('site_id',o.service_site_id,'cart_snapshot',v_items,'description','Repeat of organization order','source_order_id',p_order)) returning id into v_id;
 perform private.care_log_tool(p_org,'prepare_repeat_order','order',p_order::text,'{}',jsonb_build_object('draft_id',v_id,'items',jsonb_array_length(v_items))); return jsonb_build_object('draft_id',v_id,'route','/portal/request?careDraft='||v_id::text);
end $$;
revoke all on function private.care_prepare_repeat_order_v2_impl(uuid,uuid) from public,anon;
grant execute on function private.care_prepare_repeat_order_v2_impl(uuid,uuid) to authenticated;
create or replace function public.care_prepare_repeat_order_v2(p_organization_id uuid,p_order_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.care_prepare_repeat_order_v2_impl(p_organization_id,p_order_id); $$;
revoke all on function public.care_prepare_repeat_order_v2(uuid,uuid) from public,anon;
grant execute on function public.care_prepare_repeat_order_v2(uuid,uuid) to authenticated;

create or replace function private.care_create_request_draft_v2_impl(p_org uuid,p_site uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.care_setting_enabled('drafts') or not private.b2b_has_permission(p_org,'create_orders',p_site) then raise exception 'CARE_DRAFT_ACCESS_DENIED'; end if;
 insert into public.care_request_drafts(organization_id,user_id,source_type,site_id,draft_payload) values(p_org,auth.uid(),'assistant',p_site,coalesce(p_payload,'{}')) returning id into v_id;
 perform private.care_log_tool(p_org,'create_order_draft','organization',p_org::text,jsonb_build_object('site_id',p_site),jsonb_build_object('draft_id',v_id)); return jsonb_build_object('draft_id',v_id,'route','/portal/request?careDraft='||v_id::text);
end $$;
revoke all on function private.care_create_request_draft_v2_impl(uuid,uuid,jsonb) from public,anon;
grant execute on function private.care_create_request_draft_v2_impl(uuid,uuid,jsonb) to authenticated;
create or replace function public.care_create_request_draft_v2(p_organization_id uuid,p_site_id uuid default null,p_payload jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.care_create_request_draft_v2_impl(p_organization_id,p_site_id,p_payload); $$;
revoke all on function public.care_create_request_draft_v2(uuid,uuid,jsonb) from public,anon;
grant execute on function public.care_create_request_draft_v2(uuid,uuid,jsonb) to authenticated;

create or replace function private.care_search_knowledge_v2_impl(p_org uuid,p_query text,p_limit int)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 if not private.care_setting_enabled('knowledge') then return '[]'::jsonb; end if;
 if not private.b2b_has_permission(p_org,'create_support_cases',null) then raise exception 'CARE_KNOWLEDGE_ACCESS_DENIED'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',k.id,'category',k.category,'title_ar',k.title_ar,'title_en',k.title_en,'body_ar',k.body_ar,'body_en',k.body_en)),'[]') into v
 from (select * from public.care_knowledge_items k where k.status='published' and k.is_ai_enabled and (k.organization_id is null or k.organization_id=p_org) and (trim(coalesce(p_query,''))='' or concat_ws(' ',k.title_ar,k.title_en,k.body_ar,k.body_en,array_to_string(k.keywords,' ')) ilike '%'||replace(trim(p_query),'%','')||'%') order by (k.organization_id is not null) desc,k.updated_at desc limit greatest(1,least(coalesce(p_limit,5),10))) k;
 perform private.care_log_tool(p_org,'search_knowledge','organization',p_org::text,jsonb_build_object('query',left(coalesce(p_query,''),120)),jsonb_build_object('count',jsonb_array_length(v))); return v;
end $$;
revoke all on function private.care_search_knowledge_v2_impl(uuid,text,int) from public,anon;
grant execute on function private.care_search_knowledge_v2_impl(uuid,text,int) to authenticated;
create or replace function public.care_search_knowledge_v2(p_organization_id uuid,p_query text,p_limit int default 5) returns jsonb language sql security invoker set search_path='' as $$ select private.care_search_knowledge_v2_impl(p_organization_id,p_query,p_limit); $$;
revoke all on function public.care_search_knowledge_v2(uuid,text,int) from public,anon;
grant execute on function public.care_search_knowledge_v2(uuid,text,int) to authenticated;

create or replace function private.open_organization_care_case_v2_impl(p_org uuid,p_subject text,p_message text,p_context jsonb,p_ai_summary text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.care_setting_enabled('human') or not private.b2b_has_permission(p_org,'create_support_cases',null) then raise exception 'HUMAN_CARE_ACCESS_DENIED'; end if;
 if char_length(trim(coalesce(p_subject,'')))<2 or char_length(trim(coalesce(p_message,'')))<2 then raise exception 'INVALID_CONTENT'; end if;
 insert into public.support_conversations(user_id,organization_id,subject,status,priority,category,requires_human,context_snapshot,care_mode,care_status,ai_summary,human_handoff_at,care_source,last_message_at)
 values(auth.uid(),p_org,left(trim(p_subject),180),'open','normal','b2b_care',true,coalesce(p_context,'{}'),'hybrid','needs_human',left(p_ai_summary,2000),now(),'portal',now()) returning id into v_id;
 insert into public.support_messages(conversation_id,sender_id,sender_role,body) values(v_id,auth.uid(),'user',left(trim(p_message),6000));
 perform private.care_log_tool(p_org,'create_support_case','support_conversation',v_id::text,jsonb_build_object('context_keys',(select coalesce(jsonb_agg(k),'[]') from jsonb_object_keys(coalesce(p_context,'{}')) k)),jsonb_build_object('created',true));
 return v_id;
end $$;
revoke all on function private.open_organization_care_case_v2_impl(uuid,text,text,jsonb,text) from public,anon;
grant execute on function private.open_organization_care_case_v2_impl(uuid,text,text,jsonb,text) to authenticated;
create or replace function public.open_organization_care_case_v2(p_organization_id uuid,p_subject text,p_message text,p_context jsonb default '{}'::jsonb,p_ai_summary text default null) returns uuid language sql security invoker set search_path='' as $$ select private.open_organization_care_case_v2_impl(p_organization_id,p_subject,p_message,p_context,p_ai_summary); $$;
revoke all on function public.open_organization_care_case_v2(uuid,text,text,jsonb,text) from public,anon;
grant execute on function public.open_organization_care_case_v2(uuid,text,text,jsonb,text) to authenticated;

create or replace function private.add_organization_care_message_v2_impl(p_org uuid,p_conversation uuid,p_message text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.support_conversations where id=p_conversation and organization_id=p_org and (user_id=auth.uid() or private.is_balqees_admin())) then raise exception 'CONVERSATION_ACCESS_DENIED'; end if;
 insert into public.support_messages(conversation_id,sender_id,sender_role,body) values(p_conversation,auth.uid(),case when private.is_balqees_admin() then 'admin' else 'user' end,left(trim(p_message),6000));
 update public.support_conversations set last_message_at=now(),status=case when private.is_balqees_admin() then 'pending' else 'open' end,care_status=case when private.is_balqees_admin() then 'waiting_customer' else 'human_handling' end where id=p_conversation;
 perform private.care_log_tool(p_org,'add_support_message','support_conversation',p_conversation::text,'{}',jsonb_build_object('sent',true)); return jsonb_build_object('ok',true);
end $$;
revoke all on function private.add_organization_care_message_v2_impl(uuid,uuid,text) from public,anon;
grant execute on function private.add_organization_care_message_v2_impl(uuid,uuid,text) to authenticated;
create or replace function public.add_organization_care_message_v2(p_organization_id uuid,p_conversation_id uuid,p_message text) returns jsonb language sql security invoker set search_path='' as $$ select private.add_organization_care_message_v2_impl(p_organization_id,p_conversation_id,p_message); $$;
revoke all on function public.add_organization_care_message_v2(uuid,uuid,text) from public,anon;
grant execute on function public.add_organization_care_message_v2(uuid,uuid,text) to authenticated;

create or replace function private.admin_claim_care_case_v2_impl(p_conversation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.support_conversations%rowtype; v_name text;
begin
 if not private.is_balqees_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 select * into c from public.support_conversations where id=p_conversation for update; if not found then raise exception 'CONVERSATION_NOT_FOUND'; end if;
 select coalesce(full_name,email,'فريق بلقيس') into v_name from public.customer_profiles where id=auth.uid();
 update public.support_conversations set assigned_admin_id=auth.uid(),claimed_by=auth.uid(),claimed_at=now(),care_mode='human',care_status='human_handling',requires_human=true,human_joined_message_at=coalesce(human_joined_message_at,now()) where id=p_conversation;
 if c.human_joined_message_at is null then insert into public.support_messages(conversation_id,sender_id,sender_role,body) values(p_conversation,auth.uid(),'admin','انضم '||coalesce(v_name,'فريق بلقيس')||' من فريق عناية بلقيس إلى المحادثة.'); end if;
 perform private.care_log_tool(c.organization_id,'human_takeover','support_conversation',p_conversation::text,jsonb_build_object('admin_id',auth.uid()),jsonb_build_object('claimed',true));
 return jsonb_build_object('ok',true,'admin_name',v_name);
end $$;
revoke all on function private.admin_claim_care_case_v2_impl(uuid) from public,anon;
grant execute on function private.admin_claim_care_case_v2_impl(uuid) to authenticated;
create or replace function public.admin_claim_care_case_v2(p_conversation_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_claim_care_case_v2_impl(p_conversation_id); $$;
revoke all on function public.admin_claim_care_case_v2(uuid) from public,anon;
grant execute on function public.admin_claim_care_case_v2(uuid) to authenticated;

create or replace function private.admin_get_care_assist_v2_impl(p_conversation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.support_conversations%rowtype; v_messages jsonb; v_refs jsonb; v_latest text; v_summary text; v_suggestion text; v_result jsonb;
begin
 if not private.is_balqees_admin() or not private.care_setting_enabled('employee_assist') then raise exception 'ADMIN_ASSIST_UNAVAILABLE'; end if;
 select * into c from public.support_conversations where id=p_conversation; if not found then raise exception 'CONVERSATION_NOT_FOUND'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('role',sender_role,'body',body,'created_at',created_at) order by created_at),'[]') into v_messages from public.support_messages where conversation_id=p_conversation;
 select body into v_latest from public.support_messages where conversation_id=p_conversation and sender_role='user' order by created_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',k.id,'title_ar',k.title_ar,'title_en',k.title_en,'body_ar',k.body_ar,'body_en',k.body_en,'organization_id',k.organization_id,'keywords',k.keywords)),'[]') into v_refs from (select * from public.care_knowledge_items where status='published' and is_ai_enabled and (organization_id is null or organization_id=c.organization_id) and (v_latest is null or concat_ws(' ',title_ar,title_en,body_ar,body_en,array_to_string(keywords,' ')) ilike '%'||left(v_latest,80)||'%') order by (organization_id is not null) desc,updated_at desc limit 3) k;
 v_summary:=coalesce(c.ai_summary,'')||case when coalesce(c.ai_summary,'')<>'' then E'\n' else '' end||'الموضوع: '||coalesce(c.subject,'—')||'. آخر رسالة للعميل: '||coalesce(left(v_latest,500),'لا توجد رسالة.');
 v_suggestion:=case when jsonb_array_length(v_refs)>0 then 'استخدم المراجع الظاهرة أدناه، وتحقق من بيانات الحالة قبل الإرسال. لا تعد العميل بما لا يظهر في النظام.' else 'لا يوجد مرجع معرفة مطابق بشكل كافٍ. راجع سياق الحساب والكيان المرتبط قبل الرد، أو اطلب توضيحًا محددًا.' end;
 v_result:=jsonb_build_object('summary',v_summary,'suggestion',v_suggestion,'knowledge_refs',v_refs,'messages',v_messages,'context',coalesce(c.context_snapshot,'{}'),'source','deterministic');
 perform private.care_log_tool(c.organization_id,'employee_assist','support_conversation',p_conversation::text,jsonb_build_object('message_count',jsonb_array_length(v_messages)),jsonb_build_object('knowledge_refs',jsonb_array_length(v_refs),'source','deterministic'));
 return v_result;
end $$;
revoke all on function private.admin_get_care_assist_v2_impl(uuid) from public,anon;
grant execute on function private.admin_get_care_assist_v2_impl(uuid) to authenticated;
create or replace function public.admin_get_care_assist_v2(p_conversation_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_get_care_assist_v2_impl(p_conversation_id); $$;
revoke all on function public.admin_get_care_assist_v2(uuid) from public,anon;
grant execute on function public.admin_get_care_assist_v2(uuid) to authenticated;

create or replace function private.admin_log_care_assist_ai_v2_impl(p_conversation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.support_conversations%rowtype;
begin
 if not private.is_balqees_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 select * into c from public.support_conversations where id=p_conversation; if not found then raise exception 'CONVERSATION_NOT_FOUND'; end if;
 perform private.care_log_tool(c.organization_id,'employee_assist_ai','support_conversation',p_conversation::text,jsonb_build_object('provider','external'),jsonb_build_object('source','ai'));
 return jsonb_build_object('ok',true);
end $$;
revoke all on function private.admin_log_care_assist_ai_v2_impl(uuid) from public,anon;
grant execute on function private.admin_log_care_assist_ai_v2_impl(uuid) to authenticated;
create or replace function public.admin_log_care_assist_ai_v2(p_conversation_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_log_care_assist_ai_v2_impl(p_conversation_id); $$;
revoke all on function public.admin_log_care_assist_ai_v2(uuid) from public,anon;
grant execute on function public.admin_log_care_assist_ai_v2(uuid) to authenticated;

create or replace function private.admin_manage_org_member_v2_impl(p_org uuid,p_user uuid,p_state text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_before jsonb; v_role text; v_count int;
begin
 if not private.is_balqees_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 if char_length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
 if p_state not in ('active','suspended') then raise exception 'INVALID_STATE'; end if;
 select to_jsonb(m),m.member_role into v_before,v_role from public.organization_members m where m.organization_id=p_org and m.user_id=p_user for update; if v_before is null then raise exception 'MEMBER_NOT_FOUND'; end if;
 select count(*) into v_count from public.organization_members where organization_id=p_org and member_role='owner' and status='active';
 if v_role='owner' and v_count<=1 and p_state='suspended' then raise exception 'LAST_OWNER_PROTECTED'; end if;
 update public.organization_members set status=p_state,suspended_at=case when p_state='suspended' then now() else null end,updated_at=now() where organization_id=p_org and user_id=p_user;
 insert into public.organization_member_audit(organization_id,target_user_id,actor_user_id,action,before_state,after_state,metadata) select p_org,p_user,auth.uid(),'balqees_admin_'||p_state,v_before,to_jsonb(m),jsonb_build_object('reason',trim(p_reason)) from public.organization_members m where m.organization_id=p_org and m.user_id=p_user;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function private.admin_manage_org_member_v2_impl(uuid,uuid,text,text) from public,anon;
grant execute on function private.admin_manage_org_member_v2_impl(uuid,uuid,text,text) to authenticated;
create or replace function public.admin_manage_org_member_v2(p_organization_id uuid,p_member_user_id uuid,p_state text,p_reason text) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_manage_org_member_v2_impl(p_organization_id,p_member_user_id,p_state,p_reason); $$;
revoke all on function public.admin_manage_org_member_v2(uuid,uuid,text,text) from public,anon;
grant execute on function public.admin_manage_org_member_v2(uuid,uuid,text,text) to authenticated;

-- Explicit API grants for existing Page 9/10 tables used by authenticated clients.
grant select on public.organization_member_invites, public.organization_member_site_access, public.organization_member_audit, public.care_settings, public.care_tool_audit to authenticated;
grant update on public.care_settings to authenticated;
grant select on public.care_knowledge_items, public.care_request_drafts to authenticated;

-- Realtime: do not touch realtime schema; only add public tables to the publication when absent.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='organization_member_invites') then alter publication supabase_realtime add table public.organization_member_invites; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='organization_responsibilities') then alter publication supabase_realtime add table public.organization_responsibilities; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='care_settings') then alter publication supabase_realtime add table public.care_settings; end if;
end $$;

-- =========================================================
-- CROSS-PORTAL ENFORCEMENT — PAGE 9 SITE SCOPE MUST GOVERN
-- PAGES 2–8 TOO, NOT ONLY THE TEAM UI.
-- =========================================================

-- Resource-level site checks are intentionally stricter than b2b_site_allowed(..., null):
-- if a member has explicit site assignments, a resource with no resolvable site is not exposed.
create or replace function private.b2b_has_explicit_site_scope(p_org uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
  select 1 from public.organization_member_site_access a
  where a.organization_id=p_org and a.user_id=p_user
);
$$;
revoke all on function private.b2b_has_explicit_site_scope(uuid,uuid) from public,anon;
grant execute on function private.b2b_has_explicit_site_scope(uuid,uuid) to authenticated;

create or replace function private.b2b_resource_site_allowed(p_org uuid,p_user uuid,p_site uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
  select 1 from public.organization_members m
  where m.organization_id=p_org and m.user_id=p_user and m.status='active'
    and (m.access_expires_at is null or m.access_expires_at>now())
    and (
      not private.b2b_has_explicit_site_scope(p_org,p_user)
      or (p_site is not null and exists(
        select 1 from public.organization_member_site_access a
        where a.organization_id=p_org and a.user_id=p_user and a.site_id=p_site
      ))
    )
);
$$;
revoke all on function private.b2b_resource_site_allowed(uuid,uuid,uuid) from public,anon;
grant execute on function private.b2b_resource_site_allowed(uuid,uuid,uuid) to authenticated;

create or replace function private.b2b_order_visible(p_order uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
  select 1 from public.orders o
  where o.id=p_order and (
    private.is_balqees_admin()
    or o.user_id=p_user
    or (
      o.organization_id is not null
      and coalesce((private.b2b_effective_permissions(o.organization_id,p_user)->>'view_orders')::boolean,false)
      and private.b2b_resource_site_allowed(o.organization_id,p_user,o.service_site_id)
    )
  )
);
$$;
revoke all on function private.b2b_order_visible(uuid,uuid) from public,anon;
grant execute on function private.b2b_order_visible(uuid,uuid) to authenticated;

create or replace function private.b2b_request_visible(p_request uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
  select 1 from public.organization_service_requests r
  where r.id=p_request and (
    private.is_balqees_admin()
    or (
      coalesce((private.b2b_effective_permissions(r.organization_id,p_user)->>'view_orders')::boolean,false)
      and private.b2b_resource_site_allowed(r.organization_id,p_user,r.site_id)
    )
  )
);
$$;
revoke all on function private.b2b_request_visible(uuid,uuid) from public,anon;
grant execute on function private.b2b_request_visible(uuid,uuid) to authenticated;

create or replace function private.b2b_quotation_visible(p_quote uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
  select 1
  from public.quotations q
  left join public.orders o on o.id=q.order_id
  left join public.organization_service_requests r on r.id=q.service_request_id
  where q.id=p_quote and q.status<>'draft' and (
    private.is_balqees_admin()
    or (
      coalesce((private.b2b_effective_permissions(q.organization_id,p_user)->>'view_quotations')::boolean,false)
      and private.b2b_resource_site_allowed(q.organization_id,p_user,coalesce(q.site_id,o.service_site_id,r.site_id))
    )
  )
);
$$;
revoke all on function private.b2b_quotation_visible(uuid,uuid) from public,anon;
grant execute on function private.b2b_quotation_visible(uuid,uuid) to authenticated;

create or replace function private.b2b_contract_visible(p_contract uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
  select 1 from public.contracts c
  where c.id=p_contract and c.status<>'draft' and c.published_at is not null and (
    private.is_balqees_admin()
    or (
      coalesce((private.b2b_effective_permissions(c.organization_id,p_user)->>'view_contracts')::boolean,false)
      and (
        not private.b2b_has_explicit_site_scope(c.organization_id,p_user)
        or exists(
          select 1 from public.contract_sites cs
          where cs.contract_id=c.id
            and private.b2b_resource_site_allowed(c.organization_id,p_user,cs.site_id)
        )
      )
    )
  )
);
$$;
revoke all on function private.b2b_contract_visible(uuid,uuid) from public,anon;
grant execute on function private.b2b_contract_visible(uuid,uuid) to authenticated;

create or replace function private.b2b_document_visible(
  p_org uuid,p_user uuid,p_site uuid,p_order uuid,p_quote uuid,p_contract uuid
)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
  if private.is_balqees_admin() then return true; end if;
  if not exists(select 1 from public.organization_members m where m.organization_id=p_org and m.user_id=p_user and m.status='active' and (m.access_expires_at is null or m.access_expires_at>now())) then return false; end if;
  if not private.b2b_has_explicit_site_scope(p_org,p_user) then return true; end if;
  if p_site is not null and private.b2b_resource_site_allowed(p_org,p_user,p_site) then return true; end if;
  if p_order is not null and private.b2b_order_visible(p_order,p_user) then return true; end if;
  if p_quote is not null and private.b2b_quotation_visible(p_quote,p_user) then return true; end if;
  if p_contract is not null and private.b2b_contract_visible(p_contract,p_user) then return true; end if;
  return false;
end $$;
revoke all on function private.b2b_document_visible(uuid,uuid,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function private.b2b_document_visible(uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;

-- Upgrade legacy visibility helpers used by Pages 5/6 child-table policies.
create or replace function private.contract_visible_to_member(p_contract uuid,p_org uuid)
returns boolean language sql stable security definer set search_path='' as $$
select private.is_balqees_admin()
   or exists(select 1 from public.contracts c where c.id=p_contract and c.organization_id=p_org)
      and private.b2b_contract_visible(p_contract,auth.uid());
$$;
revoke all on function private.contract_visible_to_member(uuid,uuid) from public,anon;
grant execute on function private.contract_visible_to_member(uuid,uuid) to authenticated;

create or replace function private.site_child_visible(p_site uuid,p_org uuid)
returns boolean language sql stable security definer set search_path='' as $$
select private.is_balqees_admin()
   or (
     coalesce((private.b2b_effective_permissions(p_org,auth.uid())->>'view_sites')::boolean,false)
     and private.b2b_resource_site_allowed(p_org,auth.uid(),p_site)
     and exists(select 1 from public.organization_sites s where s.id=p_site and s.organization_id=p_org)
   );
$$;
revoke all on function private.site_child_visible(uuid,uuid) from public,anon;
grant execute on function private.site_child_visible(uuid,uuid) to authenticated;

-- Main B2B entities: replace organization-wide membership reads with permission + site scope.
drop policy if exists orders_read_own_or_admin on public.orders;
create policy orders_read_own_or_admin on public.orders for select to authenticated
using(private.is_balqees_admin() or user_id=auth.uid() or (organization_id is not null and private.b2b_order_visible(id,auth.uid())));

drop policy if exists order_items_read_own_or_admin on public.order_items;
create policy order_items_read_own_or_admin on public.order_items for select to authenticated
using(private.is_balqees_admin() or private.b2b_order_visible(order_id,auth.uid()));

drop policy if exists order_events_select_owner on public.order_events;
create policy order_events_select_owner on public.order_events for select to authenticated
using(private.is_balqees_admin() or private.b2b_order_visible(order_id,auth.uid()));

drop policy if exists quotations_read on public.quotations;
create policy quotations_read on public.quotations for select to authenticated
using(private.is_balqees_admin() or private.b2b_quotation_visible(id,auth.uid()));

drop policy if exists quotation_items_read on public.quotation_items;
create policy quotation_items_read on public.quotation_items for select to authenticated
using(private.is_balqees_admin() or exists(select 1 from public.quotations q where q.id=quotation_id and private.b2b_quotation_visible(q.id,auth.uid())));

drop policy if exists quotation_events_read on public.quotation_events;
create policy quotation_events_read on public.quotation_events for select to authenticated
using(private.is_balqees_admin() or private.b2b_quotation_visible(quotation_id,auth.uid()));

drop policy if exists organization_service_requests_read on public.organization_service_requests;
create policy organization_service_requests_read on public.organization_service_requests for select to authenticated
using(private.is_balqees_admin() or private.b2b_request_visible(id,auth.uid()));

drop policy if exists organization_service_requests_insert on public.organization_service_requests;
create policy organization_service_requests_insert on public.organization_service_requests for insert to authenticated
with check(
  created_by=auth.uid() and status='draft'
  and private.b2b_has_permission(organization_id,'create_orders',null)
  and private.b2b_resource_site_allowed(organization_id,auth.uid(),site_id)
);

drop policy if exists organization_service_requests_update on public.organization_service_requests;
create policy organization_service_requests_update on public.organization_service_requests for update to authenticated
using(
  private.is_balqees_admin()
  or (created_by=auth.uid() and status='draft' and private.b2b_has_permission(organization_id,'create_orders',null)
      and private.b2b_resource_site_allowed(organization_id,auth.uid(),site_id))
)
with check(
  private.is_balqees_admin()
  or (created_by=auth.uid() and private.b2b_has_permission(organization_id,'create_orders',null)
      and private.b2b_resource_site_allowed(organization_id,auth.uid(),site_id))
);

drop policy if exists organization_service_requests_delete on public.organization_service_requests;
create policy organization_service_requests_delete on public.organization_service_requests for delete to authenticated
using(private.is_balqees_admin() or (created_by=auth.uid() and status='draft' and private.b2b_has_permission(organization_id,'create_orders',null) and private.b2b_resource_site_allowed(organization_id,auth.uid(),site_id)));

-- Request attachments follow the parent request's scope.
drop policy if exists organization_request_attachments_read on public.organization_request_attachments;
create policy organization_request_attachments_read on public.organization_request_attachments for select to authenticated
using(private.is_balqees_admin() or private.b2b_request_visible(request_id,auth.uid()));
drop policy if exists organization_request_attachments_insert on public.organization_request_attachments;
create policy organization_request_attachments_insert on public.organization_request_attachments for insert to authenticated
with check(uploaded_by=auth.uid() and exists(select 1 from public.organization_service_requests r where r.id=request_id and r.organization_id=organization_id and r.created_by=auth.uid() and r.status='draft' and private.b2b_has_permission(r.organization_id,'create_orders',null) and private.b2b_resource_site_allowed(r.organization_id,auth.uid(),r.site_id)));
drop policy if exists organization_request_attachments_delete on public.organization_request_attachments;
create policy organization_request_attachments_delete on public.organization_request_attachments for delete to authenticated
using(private.is_balqees_admin() or (uploaded_by=auth.uid() and exists(select 1 from public.organization_service_requests r where r.id=request_id and r.created_by=auth.uid() and r.status='draft' and private.b2b_resource_site_allowed(r.organization_id,auth.uid(),r.site_id))));

-- Sites: scoped users only see/manage assigned sites. Creating a brand-new site requires unrestricted site scope.
drop policy if exists organization_sites_read on public.organization_sites;
create policy organization_sites_read on public.organization_sites for select to authenticated
using(private.is_balqees_admin() or (coalesce((private.b2b_effective_permissions(organization_id,auth.uid())->>'view_sites')::boolean,false) and private.b2b_resource_site_allowed(organization_id,auth.uid(),id)));

drop policy if exists organization_sites_insert on public.organization_sites;
create policy organization_sites_insert on public.organization_sites for insert to authenticated
with check(private.is_balqees_admin() or (private.b2b_has_permission(organization_id,'manage_sites',null) and not private.b2b_has_explicit_site_scope(organization_id,auth.uid())));

drop policy if exists organization_sites_update on public.organization_sites;
create policy organization_sites_update on public.organization_sites for update to authenticated
using(private.is_balqees_admin() or (private.b2b_has_permission(organization_id,'manage_sites',null) and private.b2b_resource_site_allowed(organization_id,auth.uid(),id)))
with check(private.is_balqees_admin() or (private.b2b_has_permission(organization_id,'manage_sites',null) and private.b2b_resource_site_allowed(organization_id,auth.uid(),id)));

drop policy if exists organization_sites_delete on public.organization_sites;
create policy organization_sites_delete on public.organization_sites for delete to authenticated
using(private.is_balqees_admin() or (private.b2b_has_permission(organization_id,'manage_sites',null) and private.b2b_resource_site_allowed(organization_id,auth.uid(),id)));

-- Child site tables inherit exact site access for both reads and mutations.
do $$
declare t text;
begin
  foreach t in array array['organization_site_areas','organization_site_contacts','organization_site_files'] loop
    execute format('drop policy if exists %I on public.%I',t||'_insert',t);
    execute format('create policy %I on public.%I for insert to authenticated with check(private.is_balqees_admin() or (private.b2b_has_permission(organization_id,''manage_sites'',null) and private.b2b_resource_site_allowed(organization_id,auth.uid(),site_id)))',t||'_insert',t);
    execute format('drop policy if exists %I on public.%I',t||'_update',t);
    execute format('create policy %I on public.%I for update to authenticated using(private.is_balqees_admin() or (private.b2b_has_permission(organization_id,''manage_sites'',null) and private.b2b_resource_site_allowed(organization_id,auth.uid(),site_id))) with check(private.is_balqees_admin() or (private.b2b_has_permission(organization_id,''manage_sites'',null) and private.b2b_resource_site_allowed(organization_id,auth.uid(),site_id)))',t||'_update',t);
    execute format('drop policy if exists %I on public.%I',t||'_delete',t);
    execute format('create policy %I on public.%I for delete to authenticated using(private.is_balqees_admin() or (private.b2b_has_permission(organization_id,''manage_sites'',null) and private.b2b_resource_site_allowed(organization_id,auth.uid(),site_id)))',t||'_delete',t);
  end loop;
end $$;

-- Contracts and their children use contract visibility; site rows themselves are filtered to assigned sites.
drop policy if exists contracts_read on public.contracts;
create policy contracts_read on public.contracts for select to authenticated
using(private.is_balqees_admin() or private.b2b_contract_visible(id,auth.uid()));

drop policy if exists contract_sites_read on public.contract_sites;
create policy contract_sites_read on public.contract_sites for select to authenticated
using(private.is_balqees_admin() or (private.b2b_contract_visible(contract_id,auth.uid()) and private.b2b_resource_site_allowed(organization_id,auth.uid(),site_id)));

drop policy if exists contract_obligations_read on public.contract_obligations;
create policy contract_obligations_read on public.contract_obligations for select to authenticated
using(private.is_balqees_admin() or (visible_to_client and private.b2b_contract_visible(contract_id,auth.uid()) and (site_id is null or private.b2b_resource_site_allowed(organization_id,auth.uid(),site_id))));

drop policy if exists contract_financials_read on public.contract_financials;
create policy contract_financials_read on public.contract_financials for select to authenticated
using(private.is_balqees_admin() or (private.b2b_has_permission(organization_id,'view_financial_documents',null) and private.b2b_contract_visible(contract_id,auth.uid())));

-- Financial documents require finance permission + source/site scope.
drop policy if exists client_documents_read on public.client_documents;
create policy client_documents_read on public.client_documents for select to authenticated
using(
  private.is_balqees_admin()
  or (
    status<>'draft'
    and (visibility='all_members' or private.b2b_has_permission(organization_id,'view_financial_documents',null))
    and private.b2b_document_visible(organization_id,auth.uid(),site_id,order_id,quotation_id,contract_id)
  )
);

-- Replace the Page-8 SECURITY DEFINER implementation so the financial center cannot bypass Page-9 site scope.
create or replace function private.get_organization_document_center_impl(p_user uuid,p_org uuid)
returns table(source_kind text, source_id uuid, document_type text, document_number text, title_ar text, title_en text, issue_date date, due_date date, total_amount numeric, payment_status text, file_path text, record_status text, site_id uuid, contract_id uuid, quotation_id uuid, order_id uuid, purchase_order_number text, cost_center text, internal_reference text, revision_number integer, visibility text, created_at timestamptz, reviewed_at timestamptz, last_opened_at timestamptz, is_pinned boolean)
language plpgsql security definer set search_path='' as $$
declare v_finance boolean; declare v_quotes boolean;
begin
  if p_user is null or p_user is distinct from auth.uid() then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.organization_members m where m.organization_id=p_org and m.user_id=p_user and m.status='active' and (m.access_expires_at is null or m.access_expires_at>now())) then raise exception 'ORG_PERMISSION_DENIED'; end if;
  v_finance:=coalesce((private.b2b_effective_permissions(p_org,p_user)->>'view_financial_documents')::boolean,false);
  v_quotes:=coalesce((private.b2b_effective_permissions(p_org,p_user)->>'view_quotations')::boolean,false);

  return query
  select 'client_document'::text,d.id,d.document_type,d.document_number,d.title_ar,d.title_en,d.issue_date,d.due_date,
    case when d.visibility='finance' and not v_finance then null else d.total_amount end,
    case when d.visibility='finance' and not v_finance then 'not_applicable' else d.payment_status end,
    d.file_path,d.status,d.site_id,d.contract_id,d.quotation_id,d.order_id,d.purchase_order_number,d.cost_center,d.internal_reference,d.revision_number,d.visibility,d.created_at,
    s.reviewed_at,s.last_opened_at,coalesce(s.is_pinned,false)
  from public.client_documents d
  left join public.organization_document_user_state s on s.user_id=p_user and s.organization_id=p_org and s.source_kind='client_document' and s.source_id=d.id
  where d.organization_id=p_org and d.status<>'draft'
    and (d.visibility='all_members' or v_finance)
    and private.b2b_document_visible(p_org,p_user,d.site_id,d.order_id,d.quotation_id,d.contract_id)

  union all
  select 'quotation'::text,q.id,'quotation'::text,
    'Q-'||lpad(q.quote_number::text,5,'0')||' · V'||q.version_number::text,q.title_ar,q.title_en,coalesce(q.sent_at::date,q.created_at::date),q.valid_until,
    case when v_finance or v_quotes then q.total else null end,'not_applicable'::text,q.document_path,q.status,q.site_id,q.contract_id,q.id,q.order_id,
    null::text,null::text,null::text,q.version_number,'all_members'::text,q.created_at,s.reviewed_at,s.last_opened_at,coalesce(s.is_pinned,false)
  from public.quotations q
  left join public.organization_document_user_state s on s.user_id=p_user and s.organization_id=p_org and s.source_kind='quotation' and s.source_id=q.id
  where q.organization_id=p_org and q.status<>'draft' and q.document_path is not null
    and private.b2b_quotation_visible(q.id,p_user)

  union all
  select 'contract'::text,c.id,'contract'::text,c.contract_number,c.title_ar,c.title_en,c.starts_on,c.ends_on,
    case when v_finance then cf.contract_value else null end,'not_applicable'::text,c.document_path,c.status,null::uuid,c.id,null::uuid,null::uuid,
    null::text,null::text,null::text,1,'all_members'::text,c.created_at,s.reviewed_at,s.last_opened_at,coalesce(s.is_pinned,false)
  from public.contracts c
  left join public.contract_financials cf on cf.contract_id=c.id
  left join public.organization_document_user_state s on s.user_id=p_user and s.organization_id=p_org and s.source_kind='contract' and s.source_id=c.id
  where c.organization_id=p_org and c.status<>'draft' and c.published_at is not null and c.document_path is not null
    and private.b2b_contract_visible(c.id,p_user)

  union all
  select 'amendment'::text,a.id,'amendment'::text,a.amendment_number,a.title_ar,a.title_en,a.effective_on,null::date,null::numeric,'not_applicable'::text,a.document_path,a.status,null::uuid,a.contract_id,null::uuid,null::uuid,
    null::text,null::text,null::text,1,'all_members'::text,a.created_at,s.reviewed_at,s.last_opened_at,coalesce(s.is_pinned,false)
  from public.contract_amendments a join public.contracts c on c.id=a.contract_id
  left join public.organization_document_user_state s on s.user_id=p_user and s.organization_id=p_org and s.source_kind='amendment' and s.source_id=a.id
  where a.organization_id=p_org and a.status<>'draft' and a.published_at is not null and c.status<>'draft' and c.published_at is not null and a.document_path is not null
    and private.b2b_contract_visible(c.id,p_user);
end $$;
revoke all on function private.get_organization_document_center_impl(uuid,uuid) from public,anon;
grant execute on function private.get_organization_document_center_impl(uuid,uuid) to authenticated;

-- Document state actions inherit the same scoped source access.
create or replace function private.organization_document_source_accessible(p_user uuid,p_org uuid,p_kind text,p_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
  if p_user is null or p_user is distinct from auth.uid() then return false; end if;
  if p_kind='client_document' then
    return exists(select 1 from public.client_documents d where d.id=p_id and d.organization_id=p_org and d.status<>'draft' and (d.visibility='all_members' or private.b2b_has_permission(p_org,'view_financial_documents',null)) and private.b2b_document_visible(p_org,p_user,d.site_id,d.order_id,d.quotation_id,d.contract_id));
  elsif p_kind='quotation' then
    return exists(select 1 from public.quotations q where q.id=p_id and q.organization_id=p_org and private.b2b_quotation_visible(q.id,p_user));
  elsif p_kind='contract' then
    return exists(select 1 from public.contracts c where c.id=p_id and c.organization_id=p_org and private.b2b_contract_visible(c.id,p_user));
  elsif p_kind='amendment' then
    return exists(select 1 from public.contract_amendments a join public.contracts c on c.id=a.contract_id where a.id=p_id and a.organization_id=p_org and a.status<>'draft' and a.published_at is not null and private.b2b_contract_visible(c.id,p_user));
  end if;
  return false;
end $$;
revoke all on function private.organization_document_source_accessible(uuid,uuid,text,uuid) from public,anon,authenticated;

-- SECURITY DEFINER operational RPCs from Pages 4/5 are upgraded to scope-aware checks.
create or replace function private.mark_quotation_viewed_impl(p_user uuid,p_quote uuid)
returns void language plpgsql security definer set search_path='' as $$
declare q public.quotations%rowtype;
begin
  if p_user is null or p_user is distinct from auth.uid() then raise exception 'AUTH_REQUIRED'; end if;
  select * into q from public.quotations where id=p_quote; if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if not private.b2b_quotation_visible(p_quote,p_user) then raise exception 'QUOTE_PERMISSION_DENIED'; end if;
  if not q.is_current then return; end if;
  if q.status='sent' then
    update public.quotations set status='viewed',viewed_at=coalesce(viewed_at,now()),viewed_by=coalesce(viewed_by,p_user),updated_at=now() where id=p_quote and is_current and status='sent';
  elsif q.viewed_at is null and q.status='viewed' then
    update public.quotations set viewed_at=now(),viewed_by=p_user,updated_at=now() where id=p_quote and is_current and viewed_at is null;
  end if;
end $$;
revoke all on function private.mark_quotation_viewed_impl(uuid,uuid) from public,anon;
grant execute on function private.mark_quotation_viewed_impl(uuid,uuid) to authenticated;

create or replace function private.respond_to_quotation_impl(p_user uuid,p_quote uuid,p_action text,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare q public.quotations%rowtype; v_member public.organization_members%rowtype;
begin
  if p_user is null or p_user is distinct from auth.uid() then raise exception 'AUTH_REQUIRED'; end if;
  select * into q from public.quotations where id=p_quote; if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if not private.b2b_quotation_visible(p_quote,p_user) or not private.b2b_has_permission(q.organization_id,'approve_quotations',coalesce(q.site_id,(select o.service_site_id from public.orders o where o.id=q.order_id),(select r.site_id from public.organization_service_requests r where r.id=q.service_request_id))) then raise exception 'QUOTE_PERMISSION_DENIED'; end if;
  select * into v_member from public.organization_members where organization_id=q.organization_id and user_id=p_user and status='active' and (access_expires_at is null or access_expires_at>now());
  if not found then raise exception 'APPROVER_MEMBERSHIP_REQUIRED'; end if;
  if private.b2b_role_mfa_required(q.organization_id,v_member.member_role,v_member.mfa_required) and not private.b2b_current_aal2() then raise exception 'MFA_AAL2_REQUIRED'; end if;
  if p_action='accepted' and v_member.approval_limit is not null and coalesce(q.total,0)>v_member.approval_limit then raise exception 'APPROVAL_LIMIT_EXCEEDED'; end if;
  if not q.is_current then raise exception 'QUOTE_NOT_CURRENT'; end if;
  if q.valid_until is not null and q.valid_until<current_date then raise exception 'QUOTE_EXPIRED'; end if;
  if p_action not in ('accepted','declined','revision_requested') then raise exception 'INVALID_QUOTE_ACTION'; end if;
  if p_action in ('declined','revision_requested') and btrim(coalesce(p_note,''))='' then raise exception 'QUOTE_NOTE_REQUIRED'; end if;
  update public.quotations set status=p_action,client_note=nullif(btrim(coalesce(p_note,'')),''),client_action_at=now(),client_action_by=p_user,updated_at=now() where id=p_quote and is_current and status in ('sent','viewed');
  if not found then raise exception 'QUOTE_NOT_ACTIONABLE'; end if;
end $$;
revoke all on function private.respond_to_quotation_impl(uuid,uuid,text,text) from public,anon;
grant execute on function private.respond_to_quotation_impl(uuid,uuid,text,text) to authenticated;

create or replace function private.request_contract_renewal_review_impl(p_user uuid,p_contract uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c public.contracts%rowtype;
begin
  if p_user is null or p_user is distinct from auth.uid() then raise exception 'AUTH_REQUIRED'; end if;
  select * into c from public.contracts where id=p_contract; if not found then raise exception 'CONTRACT_NOT_FOUND'; end if;
  if not private.b2b_contract_visible(p_contract,p_user) or not private.b2b_has_permission(c.organization_id,'approve_quotations',null) then raise exception 'CONTRACT_PERMISSION_DENIED'; end if;
  if c.status not in ('active','expiring') then raise exception 'CONTRACT_NOT_RENEWABLE'; end if;
  if c.renewal_status in ('review_requested','in_review') then return; end if;
  update public.contracts set renewal_status='review_requested',renewal_review_requested_at=now(),renewal_review_requested_by=p_user,updated_at=now() where id=p_contract;
end $$;
revoke all on function private.request_contract_renewal_review_impl(uuid,uuid) from public,anon;
grant execute on function private.request_contract_renewal_review_impl(uuid,uuid) to authenticated;

-- Storage: signed URLs/downloads respect the same database scope.
drop policy if exists client_documents_storage_read on storage.objects;
create policy client_documents_storage_read on storage.objects for select to authenticated
using(
 bucket_id='client-documents' and (
  private.is_balqees_admin()
  or exists(select 1 from public.client_documents d where d.file_path=storage.objects.name and d.status<>'draft' and (d.visibility='all_members' or private.b2b_has_permission(d.organization_id,'view_financial_documents',null)) and private.b2b_document_visible(d.organization_id,auth.uid(),d.site_id,d.order_id,d.quotation_id,d.contract_id))
  or exists(select 1 from public.quotations q where q.document_path=storage.objects.name and private.b2b_quotation_visible(q.id,auth.uid()))
  or exists(select 1 from public.contracts c where c.document_path=storage.objects.name and private.b2b_contract_visible(c.id,auth.uid()))
  or exists(select 1 from public.contract_amendments a join public.contracts c on c.id=a.contract_id where a.document_path=storage.objects.name and a.status<>'draft' and a.published_at is not null and private.b2b_contract_visible(c.id,auth.uid()))
 )
);

drop policy if exists organization_site_files_storage_select on storage.objects;
create policy organization_site_files_storage_select on storage.objects for select to authenticated
using(bucket_id='organization-site-files' and (private.is_balqees_admin() or exists(select 1 from public.organization_site_files f where f.storage_path=storage.objects.name and f.is_visible and private.site_child_visible(f.site_id,f.organization_id))));

drop policy if exists organization_site_files_storage_insert on storage.objects;
create policy organization_site_files_storage_insert on storage.objects for insert to authenticated
with check(bucket_id='organization-site-files' and array_length(storage.foldername(name),1)>=2 and private.b2b_has_permission(((storage.foldername(name))[1])::uuid,'manage_sites',null) and private.b2b_resource_site_allowed(((storage.foldername(name))[1])::uuid,auth.uid(),((storage.foldername(name))[2])::uuid));

drop policy if exists organization_site_files_storage_update on storage.objects;
create policy organization_site_files_storage_update on storage.objects for update to authenticated
using(bucket_id='organization-site-files' and array_length(storage.foldername(name),1)>=2 and private.b2b_has_permission(((storage.foldername(name))[1])::uuid,'manage_sites',null) and private.b2b_resource_site_allowed(((storage.foldername(name))[1])::uuid,auth.uid(),((storage.foldername(name))[2])::uuid))
with check(bucket_id='organization-site-files' and array_length(storage.foldername(name),1)>=2 and private.b2b_has_permission(((storage.foldername(name))[1])::uuid,'manage_sites',null) and private.b2b_resource_site_allowed(((storage.foldername(name))[1])::uuid,auth.uid(),((storage.foldername(name))[2])::uuid));

drop policy if exists organization_site_files_storage_delete on storage.objects;
create policy organization_site_files_storage_delete on storage.objects for delete to authenticated
using(bucket_id='organization-site-files' and array_length(storage.foldername(name),1)>=2 and private.b2b_has_permission(((storage.foldername(name))[1])::uuid,'manage_sites',null) and private.b2b_resource_site_allowed(((storage.foldername(name))[1])::uuid,auth.uid(),((storage.foldername(name))[2])::uuid));

drop policy if exists organization_request_files_select on storage.objects;
create policy organization_request_files_select on storage.objects for select to authenticated
using(bucket_id='organization-request-files' and array_length(storage.foldername(name),1)>=2 and exists(select 1 from public.organization_service_requests r where r.id=((storage.foldername(storage.objects.name))[2])::uuid and r.organization_id=((storage.foldername(storage.objects.name))[1])::uuid and private.b2b_request_visible(r.id,auth.uid())));

drop policy if exists organization_request_files_insert on storage.objects;
create policy organization_request_files_insert on storage.objects for insert to authenticated
with check(bucket_id='organization-request-files' and array_length(storage.foldername(name),1)>=2 and exists(select 1 from public.organization_service_requests r where r.id=((storage.foldername(storage.objects.name))[2])::uuid and r.organization_id=((storage.foldername(storage.objects.name))[1])::uuid and r.created_by=auth.uid() and r.status='draft' and private.b2b_has_permission(r.organization_id,'create_orders',null) and private.b2b_resource_site_allowed(r.organization_id,auth.uid(),r.site_id)));

drop policy if exists organization_request_files_delete on storage.objects;
create policy organization_request_files_delete on storage.objects for delete to authenticated
using(bucket_id='organization-request-files' and array_length(storage.foldername(name),1)>=2 and exists(select 1 from public.organization_service_requests r where r.id=((storage.foldername(storage.objects.name))[2])::uuid and r.organization_id=((storage.foldername(storage.objects.name))[1])::uuid and r.created_by=auth.uid() and r.status='draft' and private.b2b_has_permission(r.organization_id,'create_orders',null) and private.b2b_resource_site_allowed(r.organization_id,auth.uid(),r.site_id)));

-- Private schema is not exposed through the Data API. Authenticated EXECUTE is required because RLS policies invoke these helpers.

-- =========================================================
-- SMART CARE CONVERSATION PRIVACY — participant + scope
-- =========================================================
create or replace function private.b2b_care_context_allowed(p_org uuid,p_user uuid,p_context jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_type text:=nullif(p_context->>'entity_type',''); v_text text:=nullif(p_context->>'entity_id',''); v_id uuid; v_kind text;
begin
  if private.is_balqees_admin() then return true; end if;
  if not coalesce((private.b2b_effective_permissions(p_org,p_user)->>'create_support_cases')::boolean,false) then return false; end if;
  if v_type is null or v_text is null then return true; end if;
  if v_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return false; end if;
  v_id:=v_text::uuid;
  case v_type
    when 'order' then return private.b2b_order_visible(v_id,p_user);
    when 'quotation' then return private.b2b_quotation_visible(v_id,p_user);
    when 'contract' then return private.b2b_contract_visible(v_id,p_user);
    when 'site' then return coalesce((private.b2b_effective_permissions(p_org,p_user)->>'view_sites')::boolean,false) and private.b2b_resource_site_allowed(p_org,p_user,v_id);
    when 'document' then
      v_kind:=coalesce(nullif(p_context->>'source_kind',''),'client_document');
      return private.organization_document_source_accessible(p_user,p_org,v_kind,v_id);
    else return false;
  end case;
end $$;
revoke all on function private.b2b_care_context_allowed(uuid,uuid,jsonb) from public,anon;
grant execute on function private.b2b_care_context_allowed(uuid,uuid,jsonb) to authenticated;

create or replace function private.b2b_support_conversation_visible(p_conversation uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
  select 1 from public.support_conversations c
  where c.id=p_conversation and (
    private.is_balqees_admin()
    or (c.organization_id is null and c.user_id=p_user)
    or (
      c.organization_id is not null and c.user_id=p_user
      and private.b2b_care_context_allowed(c.organization_id,p_user,coalesce(c.context_snapshot,'{}'::jsonb))
      and (c.order_id is null or private.b2b_order_visible(c.order_id,p_user))
    )
  )
);
$$;
revoke all on function private.b2b_support_conversation_visible(uuid,uuid) from public,anon;
grant execute on function private.b2b_support_conversation_visible(uuid,uuid) to authenticated;

-- Client users see only their own organization-care threads; Balqees admins retain the operational inbox.
drop policy if exists support_conversations_read_own_or_admin on public.support_conversations;
create policy support_conversations_read_own_or_admin on public.support_conversations for select to authenticated
using(private.is_balqees_admin() or private.b2b_support_conversation_visible(id,auth.uid()));

drop policy if exists support_messages_read_own_or_admin on public.support_messages;
create policy support_messages_read_own_or_admin on public.support_messages for select to authenticated
using(private.is_balqees_admin() or private.b2b_support_conversation_visible(conversation_id,auth.uid()));

drop policy if exists support_messages_insert_own_or_admin on public.support_messages;
create policy support_messages_insert_own_or_admin on public.support_messages for insert to authenticated
with check(
 sender_id=auth.uid() and (
   (sender_role='admin' and private.is_balqees_admin())
   or (sender_role='user' and private.b2b_support_conversation_visible(conversation_id,auth.uid()))
 )
);

-- Re-issue the handoff/message implementations after context helpers exist so direct RPC use is scope-safe too.
create or replace function private.open_organization_care_case_v2_impl(p_org uuid,p_subject text,p_message text,p_context jsonb,p_ai_summary text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.care_setting_enabled('human') or not private.b2b_has_permission(p_org,'create_support_cases',null) then raise exception 'HUMAN_CARE_ACCESS_DENIED'; end if;
 if not private.b2b_care_context_allowed(p_org,auth.uid(),coalesce(p_context,'{}'::jsonb)) then raise exception 'CARE_CONTEXT_ACCESS_DENIED'; end if;
 if char_length(trim(coalesce(p_subject,'')))<2 or char_length(trim(coalesce(p_message,'')))<2 then raise exception 'INVALID_CONTENT'; end if;
 insert into public.support_conversations(user_id,organization_id,subject,status,priority,category,requires_human,context_snapshot,care_mode,care_status,ai_summary,human_handoff_at,care_source,last_message_at)
 values(auth.uid(),p_org,left(trim(p_subject),180),'open','normal','b2b_care',true,coalesce(p_context,'{}'),'hybrid','needs_human',left(p_ai_summary,2000),now(),'portal',now()) returning id into v_id;
 insert into public.support_messages(conversation_id,sender_id,sender_role,body) values(v_id,auth.uid(),'user',left(trim(p_message),6000));
 perform private.care_log_tool(p_org,'create_support_case','support_conversation',v_id::text,jsonb_build_object('context_keys',(select coalesce(jsonb_agg(k),'[]') from jsonb_object_keys(coalesce(p_context,'{}')) k)),jsonb_build_object('created',true));
 return v_id;
end $$;
revoke all on function private.open_organization_care_case_v2_impl(uuid,text,text,jsonb,text) from public,anon;
grant execute on function private.open_organization_care_case_v2_impl(uuid,text,text,jsonb,text) to authenticated;

create or replace function private.add_organization_care_message_v2_impl(p_org uuid,p_conversation uuid,p_message text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if char_length(trim(coalesce(p_message,'')))<1 then raise exception 'INVALID_CONTENT'; end if;
 if not private.is_balqees_admin() and not private.b2b_support_conversation_visible(p_conversation,auth.uid()) then raise exception 'CONVERSATION_ACCESS_DENIED'; end if;
 if not exists(select 1 from public.support_conversations c where c.id=p_conversation and c.organization_id=p_org) then raise exception 'CONVERSATION_ACCESS_DENIED'; end if;
 insert into public.support_messages(conversation_id,sender_id,sender_role,body) values(p_conversation,auth.uid(),case when private.is_balqees_admin() then 'admin' else 'user' end,left(trim(p_message),6000));
 update public.support_conversations set last_message_at=now(),status=case when private.is_balqees_admin() then 'pending' else 'open' end,care_status=case when private.is_balqees_admin() then 'waiting_customer' else 'human_handling' end where id=p_conversation;
 perform private.care_log_tool(p_org,'add_support_message','support_conversation',p_conversation::text,'{}',jsonb_build_object('sent',true));
 return jsonb_build_object('ok',true);
end $$;
revoke all on function private.add_organization_care_message_v2_impl(uuid,uuid,text) from public,anon;
grant execute on function private.add_organization_care_message_v2_impl(uuid,uuid,text) to authenticated;
