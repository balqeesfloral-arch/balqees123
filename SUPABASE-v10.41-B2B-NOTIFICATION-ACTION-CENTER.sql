-- Balqees Floral v10.41 — B2B Notification Action Center / App-ready notification core
-- Apply AFTER v10.40. This migration is idempotent where practical.
-- Design: event-first compatible, recipient state separate from business state,
-- provider-agnostic deliveries, per-device registry, site-aware deep links.

-- ---------------------------------------------------------------------------
-- 1) Extend current notification records without breaking Individual Account.
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists event_id uuid,
  add column if not exists event_type text,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists action_required boolean not null default false,
  add column if not exists action_key text,
  add column if not exists group_key text,
  add column if not exists dedupe_key text,
  add column if not exists channels text[] not null default array['in_app']::text[],
  add column if not exists critical boolean not null default false;

drop index if exists public.notifications_dedupe_key_uq;
create unique index notifications_dedupe_key_uq on public.notifications(dedupe_key);
create index if not exists notifications_org_time_idx on public.notifications(organization_id,coalesce(published_at,scheduled_at,created_at) desc);
create index if not exists notifications_entity_idx on public.notifications(entity_type,entity_id);
create index if not exists notifications_action_idx on public.notifications(organization_id,action_required,status);

alter table public.notification_reads
  add column if not exists action_completed_at timestamptz,
  add column if not exists snoozed_until timestamptz,
  add column if not exists last_opened_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2) Canonical event ledger. Existing direct inserts are mirrored here by a
--    compatibility trigger; new features should call emit_b2b_notification_event.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  entity_type text,
  entity_id uuid,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text,
  actor_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
drop index if exists public.notification_events_dedupe_uq;
create unique index notification_events_dedupe_uq on public.notification_events(dedupe_key);
create index if not exists notification_events_org_time_idx on public.notification_events(organization_id,occurred_at desc);
alter table public.notification_events enable row level security;
grant select on public.notification_events to authenticated;
drop policy if exists notification_events_admin_read on public.notification_events;
create policy notification_events_admin_read on public.notification_events for select to authenticated
using (private.is_balqees_admin());

-- ---------------------------------------------------------------------------
-- 3) Provider-agnostic delivery ledger.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('in_app','push','email','whatsapp','ios','android')),
  status text not null default 'pending' check (status in ('scheduled','pending','sent','delivered','failed','cancelled')),
  provider text,
  provider_message_id text,
  error_code text,
  attempt_count integer not null default 0,
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notification_id,user_id,channel)
);
create index if not exists notification_deliveries_user_idx on public.notification_deliveries(user_id,created_at desc);
create index if not exists notification_deliveries_status_idx on public.notification_deliveries(status,channel,created_at desc);
alter table public.notification_deliveries enable row level security;
grant select on public.notification_deliveries to authenticated;
drop policy if exists notification_deliveries_read on public.notification_deliveries;
create policy notification_deliveries_read on public.notification_deliveries for select to authenticated
using (user_id=auth.uid() or private.is_balqees_admin());

-- ---------------------------------------------------------------------------
-- 4) User / org notification preferences and category matrix.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quiet_start time,
  quiet_end time,
  timezone text not null default 'Asia/Riyadh',
  digest_mode text not null default 'morning' check (digest_mode in ('none','morning','evening')),
  lock_screen_preview text not null default 'brief' check (lock_screen_preview in ('full','brief')),
  last_center_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(user_id,organization_id)
);
alter table public.notification_preferences enable row level security;
grant select,insert,update on public.notification_preferences to authenticated;
drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences for all to authenticated
using ((user_id=auth.uid() and private.is_org_member(organization_id)) or private.is_balqees_admin())
with check ((user_id=auth.uid() and private.is_org_member(organization_id)) or private.is_balqees_admin());

create table if not exists public.notification_category_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null,
  in_app boolean not null default true,
  push boolean not null default false,
  email boolean not null default true,
  whatsapp boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,organization_id,category)
);
alter table public.notification_category_preferences enable row level security;
grant select,insert,update,delete on public.notification_category_preferences to authenticated;
drop policy if exists notification_category_preferences_own on public.notification_category_preferences;
create policy notification_category_preferences_own on public.notification_category_preferences for all to authenticated
using ((user_id=auth.uid() and private.is_org_member(organization_id)) or private.is_balqees_admin())
with check ((user_id=auth.uid() and private.is_org_member(organization_id)) or private.is_balqees_admin());

-- ---------------------------------------------------------------------------
-- 5) App-ready per-device registry. Push credentials are private to owner/admin.
-- ---------------------------------------------------------------------------
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  device_label text,
  platform text not null default 'web' check (platform in ('web','ios','android','ipad','iphone','desktop')),
  provider text not null default 'web_push',
  push_subscription jsonb,
  app_version text,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_devices_user_idx on public.user_devices(user_id,is_active,last_seen_at desc);
alter table public.user_devices enable row level security;
grant select,insert,update,delete on public.user_devices to authenticated;
drop policy if exists user_devices_own on public.user_devices;
create policy user_devices_own on public.user_devices for all to authenticated
using ((user_id=auth.uid() and (organization_id is null or private.is_org_member(organization_id))) or private.is_balqees_admin())
with check ((user_id=auth.uid() and (organization_id is null or private.is_org_member(organization_id))) or private.is_balqees_admin());

-- ---------------------------------------------------------------------------
-- 6) Follow a business entity for more detailed updates.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_entity_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  detailed boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(user_id,organization_id,entity_type,entity_id)
);
alter table public.notification_entity_follows enable row level security;
grant select,insert,update,delete on public.notification_entity_follows to authenticated;
drop policy if exists notification_entity_follows_own on public.notification_entity_follows;
create policy notification_entity_follows_own on public.notification_entity_follows for all to authenticated
using ((user_id=auth.uid() and private.is_org_member(organization_id)) or private.is_balqees_admin())
with check ((user_id=auth.uid() and private.is_org_member(organization_id)) or private.is_balqees_admin());

-- ---------------------------------------------------------------------------
-- 7) Entity visibility and action-state helpers.
-- ---------------------------------------------------------------------------
create or replace function private.b2b_notification_entity_visible(p_org uuid,p_user uuid,p_type text,p_id uuid,p_meta jsonb default '{}'::jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_site uuid;
begin
  if p_user is null or p_user is distinct from auth.uid() then return false; end if;
  if private.is_balqees_admin() then return true; end if;
  if not private.is_org_member(p_org) then return false; end if;
  if p_id is null or coalesce(p_type,'')='' then
    v_site:=nullif(p_meta->>'site_id','')::uuid;
    return private.b2b_resource_site_allowed(p_org,p_user,v_site);
  end if;
  case p_type
    when 'order' then return private.b2b_order_visible(p_id,p_user);
    when 'quotation' then return private.b2b_quotation_visible(p_id,p_user);
    when 'contract' then return private.b2b_contract_visible(p_id,p_user);
    when 'site' then return coalesce((private.b2b_effective_permissions(p_org,p_user)->>'view_sites')::boolean,false) and private.b2b_resource_site_allowed(p_org,p_user,p_id);
    when 'document' then return private.organization_document_source_accessible(p_user,p_org,coalesce(nullif(p_meta->>'source_kind',''),'client_document'),p_id);
    when 'care' then return exists(select 1 from public.support_conversations c where c.id=p_id and c.user_id=p_user and c.organization_id=p_org);
    when 'request' then return exists(select 1 from public.organization_service_requests r where r.id=p_id and r.organization_id=p_org and private.b2b_resource_site_allowed(p_org,p_user,r.site_id));
    else
      v_site:=nullif(p_meta->>'site_id','')::uuid;
      return private.b2b_resource_site_allowed(p_org,p_user,v_site);
  end case;
end;$$;
revoke all on function private.b2b_notification_entity_visible(uuid,uuid,text,uuid,jsonb) from public,anon;
grant execute on function private.b2b_notification_entity_visible(uuid,uuid,text,uuid,jsonb) to authenticated;

create or replace function private.b2b_notification_action_available(n public.notifications,p_user uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_site uuid;
begin
  if not coalesce(n.action_required,false) then return false; end if;
  v_site:=nullif(n.metadata->>'site_id','')::uuid;
  if n.entity_type='quotation' and n.entity_id is not null then
    select coalesce(q.site_id,o.service_site_id,r.site_id) into v_site
    from public.quotations q
    left join public.orders o on o.id=q.order_id
    left join public.organization_service_requests r on r.id=q.service_request_id
    where q.id=n.entity_id;
  end if;
  case coalesce(n.action_key,'')
    when 'quotation_decision' then return private.b2b_has_permission(n.organization_id,'approve_quotations',v_site);
    when 'finance_review' then return private.b2b_has_permission(n.organization_id,'view_financial_documents',v_site);
    when 'site_action' then return private.b2b_has_permission(n.organization_id,'manage_sites',v_site);
    when 'team_action' then return private.b2b_has_permission(n.organization_id,'manage_team',null);
    when 'contract_renewal' then return private.b2b_has_permission(n.organization_id,'approve_quotations',v_site);
    else return true;
  end case;
end;$$;
revoke all on function private.b2b_notification_action_available(public.notifications,uuid) from public,anon;
grant execute on function private.b2b_notification_action_available(public.notifications,uuid) to authenticated;

create or replace function private.b2b_notification_action_resolved(n public.notifications,p_user uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_done boolean:=false;
begin
  if not coalesce(n.action_required,false) then return true; end if;
  if exists(select 1 from public.notification_reads r where r.notification_id=n.id and r.user_id=p_user and r.action_completed_at is not null) then return true; end if;
  case coalesce(n.action_key,'')
    when 'quotation_decision' then
      select coalesce(q.status not in ('sent','viewed'),true) into v_done from public.quotations q where q.id=n.entity_id;
      return coalesce(v_done,true);
    when 'contract_renewal' then
      select coalesce(c.renewal_status in ('review_requested','in_review','renewed','not_renewing'),false) into v_done from public.contracts c where c.id=n.entity_id;
      return coalesce(v_done,false);
    when 'document_review' then
      return exists(select 1 from public.organization_document_user_state s where s.user_id=p_user and s.organization_id=n.organization_id and s.source_id=n.entity_id and s.reviewed_at is not null);
    when 'care_reply' then
      return exists(select 1 from public.support_conversations c where c.id=n.entity_id and c.user_id=p_user and c.customer_last_read_at is not null and c.customer_last_read_at>=coalesce(n.published_at,n.created_at));
    else return false;
  end case;
end;$$;
revoke all on function private.b2b_notification_action_resolved(public.notifications,uuid) from public,anon;
grant execute on function private.b2b_notification_action_resolved(public.notifications,uuid) to authenticated;

-- Tighten B2B organization notification visibility using entity/site scope.
drop policy if exists notifications_read_audience on public.notifications;
create policy notifications_read_audience on public.notifications for select to authenticated
using (
  private.is_balqees_admin()
  or (
    coalesce((select (s.value->>'inApp')::boolean from public.system_settings s where s.key='notifications'),true)
    and (status='published' or (status='scheduled' and scheduled_at is not null and scheduled_at<=now()))
    and (expires_at is null or expires_at>now())
    and (
      audience='all'
      or (audience='user' and user_id=auth.uid())
      or (audience in ('company','individual') and audience=(select account_type from public.customer_profiles where id=auth.uid()))
      or (audience='organization' and organization_id is not null and private.is_org_member(organization_id))
    )
    and (
      organization_id is null
      or private.b2b_notification_entity_visible(organization_id,auth.uid(),entity_type,entity_id,metadata)
    )
  )
);

-- Channel preferences are evaluated by the core engine, never by the provider adapter.
create or replace function private.b2b_notification_channel_allowed(p_user uuid,p_org uuid,p_category text,p_channel text,p_critical boolean)
returns boolean language sql stable security definer set search_path='' as $$
  select case
    when p_channel='in_app' and coalesce(p_critical,false) then true
    when p_channel='in_app' then coalesce((select c.in_app from public.notification_category_preferences c where c.user_id=p_user and c.organization_id=p_org and c.category=coalesce(p_category,'system')),true)
    when p_channel='push' then coalesce((select c.push from public.notification_category_preferences c where c.user_id=p_user and c.organization_id=p_org and c.category=coalesce(p_category,'system')),false)
    when p_channel='email' then coalesce((select c.email from public.notification_category_preferences c where c.user_id=p_user and c.organization_id=p_org and c.category=coalesce(p_category,'system')),true)
    when p_channel='whatsapp' then coalesce((select c.whatsapp from public.notification_category_preferences c where c.user_id=p_user and c.organization_id=p_org and c.category=coalesce(p_category,'system')),false)
    when p_channel in ('ios','android') then coalesce((select c.push from public.notification_category_preferences c where c.user_id=p_user and c.organization_id=p_org and c.category=coalesce(p_category,'system')),false)
    else false
  end;
$$;
revoke all on function private.b2b_notification_channel_allowed(uuid,uuid,text,text,boolean) from public,anon;
grant execute on function private.b2b_notification_channel_allowed(uuid,uuid,text,text,boolean) to authenticated;

-- Non-critical external delivery is postponed until quiet hours end. In-app remains recorded immediately.
create or replace function private.b2b_notification_not_before(p_user uuid,p_org uuid,p_channel text,p_critical boolean)
returns timestamptz language plpgsql stable security definer set search_path='' as $$
declare v_start time;v_end time;v_tz text:='Asia/Riyadh';v_local timestamp;v_t time;v_target timestamp;
begin
  if p_channel='in_app' or coalesce(p_critical,false) then return now(); end if;
  select quiet_start,quiet_end,coalesce(timezone,'Asia/Riyadh') into v_start,v_end,v_tz from public.notification_preferences where user_id=p_user and organization_id=p_org;
  if v_start is null or v_end is null or v_start=v_end then return now(); end if;
  v_local:=timezone(v_tz,now()); v_t:=v_local::time;
  if v_start<v_end then
    if v_t>=v_start and v_t<v_end then v_target:=date_trunc('day',v_local)+v_end; else return now(); end if;
  else
    if v_t>=v_start then v_target:=date_trunc('day',v_local)+interval '1 day'+v_end;
    elsif v_t<v_end then v_target:=date_trunc('day',v_local)+v_end;
    else return now(); end if;
  end if;
  return v_target at time zone v_tz;
end;$$;
revoke all on function private.b2b_notification_not_before(uuid,uuid,text,boolean) from public,anon;
grant execute on function private.b2b_notification_not_before(uuid,uuid,text,boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) Compatibility event mirror + delivery planning.
-- ---------------------------------------------------------------------------
create or replace function private.notification_event_mirror()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_event uuid;
begin
  if new.event_id is null then
    insert into public.notification_events(event_type,organization_id,entity_type,entity_id,priority,payload,dedupe_key,actor_id,occurred_at)
    values(coalesce(nullif(new.event_type,''),coalesce(nullif(new.category,''),'notification.created')),new.organization_id,new.entity_type,new.entity_id,coalesce(new.priority,'normal'),coalesce(new.metadata,'{}'::jsonb),case when new.dedupe_key is null then null else 'event:'||new.dedupe_key end,new.created_by,coalesce(new.published_at,new.scheduled_at,new.created_at,now()))
    on conflict(dedupe_key) do update set occurred_at=excluded.occurred_at,payload=excluded.payload
    returning id into v_event;
    new.event_id:=v_event;
  end if;
  return new;
end;$$;
revoke all on function private.notification_event_mirror() from public,anon,authenticated;
drop trigger if exists notification_event_mirror on public.notifications;
create trigger notification_event_mirror before insert on public.notifications for each row execute function private.notification_event_mirror();

create or replace function private.notification_plan_deliveries()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_channel text; v_due boolean; v_status text; v_not_before timestamptz; v_org uuid;
begin
  if new.status not in ('published','scheduled') then
    update public.notification_deliveries set status='cancelled',updated_at=now() where notification_id=new.id and status in ('scheduled','pending');
    return new;
  end if;
  v_due := new.status='published' or (new.scheduled_at is not null and new.scheduled_at<=now());
  for v_user in
    select distinct x.user_id from (
      select new.user_id user_id where new.audience='user' and new.user_id is not null
      union all
      select m.user_id from public.organization_members m where new.audience='organization' and m.organization_id=new.organization_id and m.status='active' and (m.access_expires_at is null or m.access_expires_at>now())
      union all
      select p.id from public.customer_profiles p where new.audience='company' and p.account_type='company'
      union all
      select p.id from public.customer_profiles p where new.audience='individual' and p.account_type='individual'
      union all
      select p.id from public.customer_profiles p where new.audience='all'
    ) x where x.user_id is not null
  loop
    v_org:=new.organization_id;
    foreach v_channel in array coalesce(new.channels,array['in_app']::text[]) loop
      if v_org is not null and not private.b2b_notification_channel_allowed(v_user,v_org,new.category,v_channel,new.critical) then continue; end if;
      v_not_before:=case when v_org is null then now() else private.b2b_notification_not_before(v_user,v_org,v_channel,new.critical) end;
      v_status:=case
        when not v_due then 'scheduled'
        when v_channel='in_app' then 'delivered'
        when v_not_before>now() then 'scheduled'
        else 'pending'
      end;
      insert into public.notification_deliveries(notification_id,user_id,channel,status,scheduled_at,delivered_at,updated_at)
      values(new.id,v_user,v_channel,v_status,greatest(coalesce(new.scheduled_at,now()),v_not_before),case when v_status='delivered' then now() else null end,now())
      on conflict(notification_id,user_id,channel) do update set
        status=case when notification_deliveries.status in ('sent','delivered') then notification_deliveries.status else excluded.status end,
        scheduled_at=excluded.scheduled_at,updated_at=now();
    end loop;
  end loop;
  return new;
end;$$;
revoke all on function private.notification_plan_deliveries() from public,anon,authenticated;
drop trigger if exists notification_plan_deliveries_insert on public.notifications;
create trigger notification_plan_deliveries_insert after insert on public.notifications for each row execute function private.notification_plan_deliveries();
drop trigger if exists notification_plan_deliveries_update on public.notifications;
create trigger notification_plan_deliveries_update after update of status,scheduled_at,channels on public.notifications for each row execute function private.notification_plan_deliveries();

-- ---------------------------------------------------------------------------
-- 9) Action Center RPC. Read state and action state are deliberately separate.
-- ---------------------------------------------------------------------------
create or replace function private.get_my_b2b_notification_center_v1_impl(p_org uuid,p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_last timestamptz; v_items jsonb; v_now timestamptz:=now(); v_unread int; v_action int; v_snoozed int; v_away jsonb;
begin
  if p_user is null or p_user is distinct from auth.uid() then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_org_member(p_org) then raise exception 'ORG_PERMISSION_DENIED'; end if;
  -- Lazy materialization keeps scheduled in-app delivery truthful even before an external worker is connected.
  update public.notification_deliveries d
    set status=case when d.channel='in_app' then 'delivered' else 'pending' end,
        delivered_at=case when d.channel='in_app' then coalesce(d.delivered_at,now()) else d.delivered_at end,
        updated_at=now()
  from public.notifications n
  where d.notification_id=n.id and d.user_id=p_user and n.organization_id=p_org
    and d.status='scheduled' and d.scheduled_at is not null and d.scheduled_at<=now()
    and n.status in ('published','scheduled');
  select last_center_seen_at into v_last from public.notification_preferences where user_id=p_user and organization_id=p_org;

  with visible as (
    select n.*,r.read_at,r.action_completed_at,r.snoozed_until,r.last_opened_at,
      private.b2b_notification_action_resolved(n,p_user) action_resolved,
      private.b2b_notification_action_available(n,p_user) action_available,
      exists(select 1 from public.notification_entity_follows f where f.user_id=p_user and f.organization_id=p_org and f.entity_type=n.entity_type and f.entity_id=n.entity_id) followed
    from public.notifications n
    left join public.notification_reads r on r.notification_id=n.id and r.user_id=p_user
    where (n.organization_id=p_org or (n.organization_id is null and n.audience in ('company','all')))
      and (n.status='published' or (n.status='scheduled' and n.scheduled_at is not null and n.scheduled_at<=v_now))
      and (n.expires_at is null or n.expires_at>v_now)
      and (n.audience='organization' or (n.audience='user' and n.user_id=p_user) or (n.organization_id is null and n.audience in ('company','all')))
      and (n.organization_id is null or private.b2b_notification_entity_visible(p_org,p_user,n.entity_type,n.entity_id,n.metadata))
    order by coalesce(n.published_at,n.scheduled_at,n.created_at) desc
    limit 250
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'title_ar',title_ar,'title_en',title_en,'body_ar',body_ar,'body_en',body_en,
    'type',type,'category',category,'priority',priority,'critical',critical,'organization_id',organization_id,
    'event_type',event_type,'entity_type',entity_type,'entity_id',entity_id,'action_required',action_required,
    'action_key',action_key,'action_url',action_url,'action_label_ar',action_label_ar,'action_label_en',action_label_en,
    'group_key',coalesce(group_key,entity_type||':'||entity_id::text,category),'metadata',metadata,
    'published_at',published_at,'created_at',created_at,'read_at',read_at,'action_completed_at',action_completed_at,
    'snoozed_until',snoozed_until,'action_resolved',action_resolved,'action_available',action_available,'followed',followed
  ) order by coalesce(published_at,created_at) desc),'[]'::jsonb),
  count(*) filter(where read_at is null),
  count(*) filter(where action_required and action_available and not action_resolved and (snoozed_until is null or snoozed_until<=v_now)),
  count(*) filter(where snoozed_until>v_now)
  into v_items,v_unread,v_action,v_snoozed from visible;

  with since_rows as (
    select n.category,n.event_type,n.action_required,private.b2b_notification_action_resolved(n,p_user) action_resolved
    from public.notifications n
    where (n.organization_id=p_org or (n.organization_id is null and n.audience in ('company','all'))) and v_last is not null and coalesce(n.published_at,n.created_at)>v_last
      and (n.status='published' or (n.status='scheduled' and n.scheduled_at<=v_now))
      and (n.organization_id is null or private.b2b_notification_entity_visible(p_org,p_user,n.entity_type,n.entity_id,n.metadata))
  ) select jsonb_build_object(
      'since',v_last,
      'count',count(*),
      'orders',count(*) filter(where category in ('orders','order')),
      'finance',count(*) filter(where category in ('finance','documents','payment')),
      'contracts',count(*) filter(where category='contracts'),
      'care',count(*) filter(where category in ('care','support')),
      'decisions',count(*) filter(where action_required and not action_resolved)
    ) into v_away from since_rows;

  return jsonb_build_object('items',v_items,'unread_count',coalesce(v_unread,0),'action_count',coalesce(v_action,0),'snoozed_count',coalesce(v_snoozed,0),'last_seen_at',v_last,'away',coalesce(v_away,jsonb_build_object('since',v_last,'count',0,'orders',0,'finance',0,'contracts',0,'care',0,'decisions',0)));
end;$$;
revoke all on function private.get_my_b2b_notification_center_v1_impl(uuid,uuid) from public,anon,authenticated;

create or replace function public.get_my_b2b_notification_center_v1(p_organization_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select private.get_my_b2b_notification_center_v1_impl(p_organization_id,auth.uid());
$$;
revoke all on function public.get_my_b2b_notification_center_v1(uuid) from public,anon;
grant execute on function public.get_my_b2b_notification_center_v1(uuid) to authenticated;

create or replace function public.get_my_b2b_notification_badge_v1(p_organization_id uuid)
returns integer language sql security invoker set search_path='' as $$
  select coalesce((private.get_my_b2b_notification_center_v1_impl(p_organization_id,auth.uid())->>'action_count')::integer,0);
$$;
revoke all on function public.get_my_b2b_notification_badge_v1(uuid) from public,anon;
grant execute on function public.get_my_b2b_notification_badge_v1(uuid) to authenticated;

create or replace function private.mark_b2b_notification_read_v1_impl(p_organization_id uuid,p_notification_id uuid,p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_user is null or p_user is distinct from auth.uid() then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.notifications n where n.id=p_notification_id and n.organization_id=p_organization_id and private.b2b_notification_entity_visible(p_organization_id,p_user,n.entity_type,n.entity_id,n.metadata)) then raise exception 'NOTIFICATION_ACCESS_DENIED'; end if;
  insert into public.notification_reads(notification_id,user_id,read_at,last_opened_at) values(p_notification_id,p_user,now(),now())
  on conflict(notification_id,user_id) do update set read_at=coalesce(notification_reads.read_at,now()),last_opened_at=now();
  update public.notification_deliveries set read_at=coalesce(read_at,now()),updated_at=now() where notification_id=p_notification_id and user_id=p_user and channel='in_app';
end;$$;
revoke all on function private.mark_b2b_notification_read_v1_impl(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.mark_b2b_notification_read_v1(p_organization_id uuid,p_notification_id uuid)
returns void language sql security invoker set search_path='' as $$
  select private.mark_b2b_notification_read_v1_impl(p_organization_id,p_notification_id,auth.uid());
$$;
revoke all on function public.mark_b2b_notification_read_v1(uuid,uuid) from public,anon;
grant execute on function public.mark_b2b_notification_read_v1(uuid,uuid) to authenticated;

create or replace function public.snooze_b2b_notification_v1(p_organization_id uuid,p_notification_id uuid,p_until timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_until is not null and (p_until<=now() or p_until>now()+interval '14 days') then raise exception 'INVALID_SNOOZE_TIME'; end if;
  if not exists(select 1 from public.notifications n where n.id=p_notification_id and n.organization_id=p_organization_id and private.b2b_notification_entity_visible(p_organization_id,auth.uid(),n.entity_type,n.entity_id,n.metadata)) then raise exception 'NOTIFICATION_ACCESS_DENIED'; end if;
  insert into public.notification_reads(notification_id,user_id,read_at,snoozed_until) values(p_notification_id,auth.uid(),now(),p_until)
  on conflict(notification_id,user_id) do update set read_at=coalesce(notification_reads.read_at,now()),snoozed_until=excluded.snoozed_until;
end;$$;
revoke all on function public.snooze_b2b_notification_v1(uuid,uuid,timestamptz) from public,anon;
grant execute on function public.snooze_b2b_notification_v1(uuid,uuid,timestamptz) to authenticated;

create or replace function public.follow_b2b_notification_entity_v1(p_organization_id uuid,p_entity_type text,p_entity_id uuid,p_follow boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not private.b2b_notification_entity_visible(p_organization_id,auth.uid(),p_entity_type,p_entity_id,'{}'::jsonb) then raise exception 'ENTITY_ACCESS_DENIED'; end if;
  if p_follow then
    insert into public.notification_entity_follows(user_id,organization_id,entity_type,entity_id) values(auth.uid(),p_organization_id,p_entity_type,p_entity_id)
    on conflict(user_id,organization_id,entity_type,entity_id) do update set detailed=true;
  else
    delete from public.notification_entity_follows where user_id=auth.uid() and organization_id=p_organization_id and entity_type=p_entity_type and entity_id=p_entity_id;
  end if;
end;$$;
revoke all on function public.follow_b2b_notification_entity_v1(uuid,text,uuid,boolean) from public,anon;
grant execute on function public.follow_b2b_notification_entity_v1(uuid,text,uuid,boolean) to authenticated;

create or replace function public.mark_b2b_notification_center_seen_v1(p_organization_id uuid)
returns void language sql security invoker set search_path='' as $$
  insert into public.notification_preferences(user_id,organization_id,last_center_seen_at,updated_at)
  values(auth.uid(),p_organization_id,now(),now())
  on conflict(user_id,organization_id) do update set last_center_seen_at=now(),updated_at=now();
$$;
revoke all on function public.mark_b2b_notification_center_seen_v1(uuid) from public,anon;
grant execute on function public.mark_b2b_notification_center_seen_v1(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10) Admin manual announcement RPC (audited, relative deep-link only).
-- ---------------------------------------------------------------------------
create or replace function public.admin_publish_notification_v1(
  p_title_ar text,p_title_en text,p_body_ar text,p_body_en text,
  p_audience text,p_organization_id uuid,p_user_id uuid,
  p_category text,p_priority text,p_action_url text,p_action_label_ar text,p_action_label_en text,
  p_action_required boolean,p_action_key text,p_entity_type text,p_entity_id uuid,
  p_channels text[],p_scheduled_at timestamptz,p_publish_now boolean
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_status text;
begin
  if not private.is_balqees_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if btrim(coalesce(p_title_ar,''))='' or btrim(coalesce(p_body_ar,''))='' then raise exception 'TITLE_BODY_REQUIRED'; end if;
  if p_audience not in ('all','company','individual','organization','user') then raise exception 'INVALID_AUDIENCE'; end if;
  if p_audience='organization' and p_organization_id is null then raise exception 'ORGANIZATION_REQUIRED'; end if;
  if p_audience='user' and (p_user_id is null or p_organization_id is null) then raise exception 'USER_AND_ORGANIZATION_REQUIRED'; end if;
  if p_audience='user' and not exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=p_user_id and m.status='active') then raise exception 'USER_NOT_ORG_MEMBER'; end if;
  if p_audience in ('all','company','individual') and (coalesce(p_action_required,false) or p_entity_id is not null) then raise exception 'BROADCAST_CANNOT_REQUIRE_ENTITY_ACTION'; end if;
  if coalesce(p_action_required,false) and (p_organization_id is null or p_entity_id is null or coalesce(p_action_key,'') not in ('quotation_decision','contract_renewal','document_review','care_reply')) then raise exception 'ACTION_REQUIRES_RESOLVABLE_ENTITY'; end if;
  if p_action_key='quotation_decision' and p_entity_type is distinct from 'quotation' then raise exception 'ACTION_ENTITY_MISMATCH'; end if;
  if p_action_key='contract_renewal' and p_entity_type is distinct from 'contract' then raise exception 'ACTION_ENTITY_MISMATCH'; end if;
  if p_action_key='document_review' and p_entity_type is distinct from 'document' then raise exception 'ACTION_ENTITY_MISMATCH'; end if;
  if p_action_key='care_reply' and p_entity_type is distinct from 'care' then raise exception 'ACTION_ENTITY_MISMATCH'; end if;
  if p_action_url is not null and p_action_url<>'' and left(p_action_url,1)<>'/' then raise exception 'INTERNAL_DEEP_LINK_REQUIRED'; end if;
  if p_priority not in ('low','normal','high','urgent') then raise exception 'INVALID_PRIORITY'; end if;
  v_status:=case when p_publish_now then 'published' when p_scheduled_at is not null then 'scheduled' else 'draft' end;
  insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,user_id,organization_id,status,scheduled_at,published_at,category,priority,action_url,action_label_ar,action_label_en,metadata,event_type,entity_type,entity_id,action_required,action_key,group_key,channels,critical,created_by)
  values(btrim(p_title_ar),nullif(btrim(coalesce(p_title_en,'')),''),btrim(p_body_ar),nullif(btrim(coalesce(p_body_en,'')),''),case when p_priority in ('high','urgent') then 'warning' else 'info' end,p_audience,p_user_id,p_organization_id,v_status,p_scheduled_at,case when p_publish_now then now() else null end,coalesce(nullif(p_category,''),'system'),p_priority,nullif(btrim(coalesce(p_action_url,'')),''),nullif(btrim(coalesce(p_action_label_ar,'')),''),nullif(btrim(coalesce(p_action_label_en,'')),''),jsonb_build_object('manual',true),coalesce(nullif(p_category,''),'manual.announcement'),p_entity_type,p_entity_id,coalesce(p_action_required,false),nullif(p_action_key,''),case when p_entity_type is not null and p_entity_id is not null then p_entity_type||':'||p_entity_id::text else null end,coalesce(p_channels,array['in_app']::text[]),p_priority='urgent',auth.uid()) returning id into v_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'publish_notification','notification',v_id::text,jsonb_build_object('audience',p_audience,'organization_id',p_organization_id,'priority',p_priority,'status',v_status,'channels',p_channels));
  return v_id;
end;$$;
revoke all on function public.admin_publish_notification_v1(text,text,text,text,text,uuid,uuid,text,text,text,text,text,boolean,text,text,uuid,text[],timestamptz,boolean) from public,anon;
grant execute on function public.admin_publish_notification_v1(text,text,text,text,text,uuid,uuid,text,text,text,text,text,boolean,text,text,uuid,text[],timestamptz,boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 11) Scheduled business reminders. They remain rows in the same engine and
--     are cancelled automatically when the underlying business action resolves.
-- ---------------------------------------------------------------------------
create or replace function private.schedule_b2b_quote_reminder()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_when timestamptz;
begin
  if new.organization_id is null then return new; end if;
  if new.is_current and new.status in ('sent','viewed') and new.valid_until is not null then
    v_when:=(new.valid_until::timestamptz - interval '2 days');
    if v_when<now() then v_when:=now(); end if;
    insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,organization_id,status,scheduled_at,category,priority,action_url,action_label_ar,action_label_en,event_type,entity_type,entity_id,action_required,action_key,group_key,dedupe_key,channels,metadata)
    values('عرض سعر يحتاج قرارك','Quotation awaiting your decision','تبقى مدة قصيرة على صلاحية عرض السعر. راجع النسخة الحالية قبل انتهاء الصلاحية.','A quotation is nearing expiry. Review the current version before validity ends.','warning','organization',new.organization_id,'scheduled',v_when,'quotations','high','/portal/quotes/'||new.id::text,'مراجعة العرض','Review quotation','quotation.expiring','quotation',new.id,true,'quotation_decision','quotation:'||new.id::text,'quote-expiry:'||new.id::text,array['in_app','push','email']::text[],jsonb_build_object('quotation_id',new.id,'site_id',new.site_id,'valid_until',new.valid_until))
    on conflict(dedupe_key) do update set scheduled_at=excluded.scheduled_at,status='scheduled',entity_id=excluded.entity_id,metadata=excluded.metadata,updated_at=now();
  else
    update public.notifications set status='archived',updated_at=now() where dedupe_key='quote-expiry:'||new.id::text and status in ('scheduled','published');
  end if;
  return new;
end;$$;
revoke all on function private.schedule_b2b_quote_reminder() from public,anon,authenticated;
drop trigger if exists schedule_b2b_quote_reminder on public.quotations;
create trigger schedule_b2b_quote_reminder after insert or update of status,valid_until,is_current on public.quotations for each row execute function private.schedule_b2b_quote_reminder();

create or replace function private.schedule_b2b_contract_reminder()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_when timestamptz;
begin
  if new.organization_id is null then return new; end if;
  if new.status in ('active','expiring') and new.ends_on is not null and coalesce(new.renewal_status,'none') not in ('review_requested','in_review','renewed','not_renewing') then
    v_when:=(new.ends_on::timestamptz - interval '60 days'); if v_when<now() then v_when:=now(); end if;
    insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,organization_id,status,scheduled_at,category,priority,action_url,action_label_ar,action_label_en,event_type,entity_type,entity_id,action_required,action_key,group_key,dedupe_key,channels,metadata)
    values('موعد مراجعة العقد يقترب','Contract review is approaching','اقتربت نافذة مراجعة وتجديد العقد. افتح العقد لمراجعة المدة والخطوة التالية.','The contract review and renewal window is approaching. Open the contract to review the term and next step.','warning','organization',new.organization_id,'scheduled',v_when,'contracts','high','/portal/contracts/'||new.id::text,'مراجعة العقد','Review contract','contract.expiring','contract',new.id,true,'contract_renewal','contract:'||new.id::text,'contract-expiry:'||new.id::text,array['in_app','push','email']::text[],jsonb_build_object('contract_id',new.id,'ends_on',new.ends_on))
    on conflict(dedupe_key) do update set scheduled_at=excluded.scheduled_at,status='scheduled',metadata=excluded.metadata,updated_at=now();
  else
    update public.notifications set status='archived',updated_at=now() where dedupe_key='contract-expiry:'||new.id::text and status in ('scheduled','published');
  end if;
  return new;
end;$$;
revoke all on function private.schedule_b2b_contract_reminder() from public,anon,authenticated;
drop trigger if exists schedule_b2b_contract_reminder on public.contracts;
create trigger schedule_b2b_contract_reminder after insert or update of status,ends_on,renewal_status on public.contracts for each row execute function private.schedule_b2b_contract_reminder();

create or replace function private.schedule_b2b_order_reminder()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_when timestamptz;
begin
  if new.organization_id is null then return new; end if;
  if new.status not in ('completed','cancelled','delivered') and new.requested_delivery_date is not null then
    v_when:=(new.requested_delivery_date::timestamptz - interval '24 hours'); if v_when<now() then v_when:=now(); end if;
    insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,organization_id,status,scheduled_at,category,priority,action_url,action_label_ar,action_label_en,event_type,entity_type,entity_id,action_required,group_key,dedupe_key,channels,metadata)
    values('موعد تنفيذ قريب','Upcoming execution date','موعد التنفيذ المطلوب لهذا الطلب يقترب. راجع الموقع وتعليمات الاستلام إذا احتاجت تحديثًا.','The requested execution date is approaching. Review the site and receiving instructions if needed.','info','organization',new.organization_id,'scheduled',v_when,'orders','normal','/portal/orders/'||new.id::text,'فتح الطلب','Open order','order.execution_soon','order',new.id,false,'order:'||new.id::text,'order-execution:'||new.id::text,array['in_app','push']::text[],jsonb_build_object('order_id',new.id,'site_id',new.service_site_id,'requested_delivery_date',new.requested_delivery_date))
    on conflict(dedupe_key) do update set scheduled_at=excluded.scheduled_at,status='scheduled',metadata=excluded.metadata,updated_at=now();
  else
    update public.notifications set status='archived',updated_at=now() where dedupe_key='order-execution:'||new.id::text and status in ('scheduled','published');
  end if;
  return new;
end;$$;
revoke all on function private.schedule_b2b_order_reminder() from public,anon,authenticated;
drop trigger if exists schedule_b2b_order_reminder on public.orders;
create trigger schedule_b2b_order_reminder after insert or update of status,requested_delivery_date on public.orders for each row execute function private.schedule_b2b_order_reminder();

-- Backfill semantic entity/action fields where existing metadata already provides identity.
update public.notifications set
  entity_type=coalesce(entity_type,
    case when metadata ? 'quotation_id' then 'quotation' when metadata ? 'contract_id' then 'contract' when metadata ? 'order_id' then 'order' when metadata ? 'request_id' then 'request' when metadata ? 'site_id' then 'site' else null end),
  entity_id=coalesce(entity_id,
    case when metadata ? 'quotation_id' then nullif(metadata->>'quotation_id','')::uuid when metadata ? 'contract_id' then nullif(metadata->>'contract_id','')::uuid when metadata ? 'order_id' then nullif(metadata->>'order_id','')::uuid when metadata ? 'request_id' then nullif(metadata->>'request_id','')::uuid when metadata ? 'site_id' then nullif(metadata->>'site_id','')::uuid else null end),
  event_type=coalesce(event_type,category),
  group_key=coalesce(group_key,category)
where organization_id is not null;

-- Recommended future adapter contract: delivery workers update notification_deliveries only.
-- They must never decide business recipients or business priority themselves.

-- Admin operational projection: delivery/read/action state without exposing provider secrets.
create or replace function public.admin_get_notification_operations_v1(p_limit integer default 200)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;
begin
  if not private.is_balqees_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  with rows as (
    select n.*,
      (select count(distinct d.user_id) from public.notification_deliveries d where d.notification_id=n.id) recipient_count,
      (select count(*) from public.notification_deliveries d where d.notification_id=n.id and d.status in ('sent','delivered')) delivered_count,
      (select count(*) from public.notification_deliveries d where d.notification_id=n.id and d.status='pending') pending_count,
      (select count(*) from public.notification_deliveries d where d.notification_id=n.id and d.status='failed') failed_count,
      (select count(*) from public.notification_reads r where r.notification_id=n.id and r.read_at is not null) read_count,
      case
        when not n.action_required then 'not_required'
        when n.action_key='quotation_decision' and exists(select 1 from public.quotations q where q.id=n.entity_id and q.status not in ('sent','viewed')) then 'completed'
        when n.action_key='contract_renewal' and exists(select 1 from public.contracts c where c.id=n.entity_id and c.renewal_status in ('review_requested','in_review','renewed','not_renewing')) then 'completed'
        when exists(select 1 from public.notification_reads r where r.notification_id=n.id and r.action_completed_at is not null) then 'partially_completed'
        else 'pending'
      end action_state
    from public.notifications n order by n.created_at desc limit least(greatest(coalesce(p_limit,200),1),500)
  )
  select coalesce(jsonb_agg(to_jsonb(rows) order by created_at desc),'[]'::jsonb) into v_result from rows;
  return v_result;
end;$$;
revoke all on function public.admin_get_notification_operations_v1(integer) from public,anon;
grant execute on function public.admin_get_notification_operations_v1(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 12) Followed entities receive richer event-level updates for that user only.
-- ---------------------------------------------------------------------------
create or replace function private.notify_followed_order_event_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_user uuid; v_site uuid;
begin
  select organization_id,service_site_id into v_org,v_site from public.orders where id=new.order_id;
  if v_org is null then return new; end if;
  for v_user in
    select f.user_id from public.notification_entity_follows f
    join public.organization_members m on m.organization_id=f.organization_id and m.user_id=f.user_id and m.status='active' and (m.access_expires_at is null or m.access_expires_at>now())
    where f.organization_id=v_org and f.entity_type='order' and f.entity_id=new.order_id and f.detailed
      and private.b2b_site_allowed(v_org,f.user_id,v_site)
  loop
    insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,user_id,organization_id,status,published_at,category,priority,action_url,action_label_ar,action_label_en,event_type,entity_type,entity_id,group_key,dedupe_key,channels,metadata)
    values(coalesce(new.title_ar,'تحديث على الطلب'),coalesce(new.title_en,'Order update'),coalesce(new.body_ar,'تم تسجيل تحديث جديد على الطلب الذي تتابعه.'),coalesce(new.body_en,'A new update was recorded for the order you follow.'),'info','user',v_user,v_org,'published',now(),'orders','low','/portal/orders/'||new.order_id::text,'فتح الطلب','Open order','followed.order.'||coalesce(new.event_type,'update'),'order',new.order_id,'order:'||new.order_id::text,'follow:order:'||new.id::text||':'||v_user::text,array['in_app','push']::text[],coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('followed',true,'site_id',v_site,'order_event_id',new.id))
    on conflict(dedupe_key) do nothing;
  end loop;
  return new;
end;$$;
revoke all on function private.notify_followed_order_event_v1() from public,anon,authenticated;
drop trigger if exists notify_followed_order_event_v1 on public.order_events;
create trigger notify_followed_order_event_v1 after insert on public.order_events for each row execute function private.notify_followed_order_event_v1();

create or replace function private.notify_followed_quotation_event_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_site uuid;
begin
  select coalesce(q.site_id,o.service_site_id,r.site_id) into v_site from public.quotations q left join public.orders o on o.id=q.order_id left join public.organization_service_requests r on r.id=q.service_request_id where q.id=new.quotation_id;
  for v_user in
    select f.user_id from public.notification_entity_follows f
    join public.organization_members m on m.organization_id=f.organization_id and m.user_id=f.user_id and m.status='active' and (m.access_expires_at is null or m.access_expires_at>now())
    where f.organization_id=new.organization_id and f.entity_type='quotation' and f.entity_id=new.quotation_id and f.detailed
      and private.b2b_site_allowed(new.organization_id,f.user_id,v_site)
  loop
    insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,user_id,organization_id,status,published_at,category,priority,action_url,action_label_ar,action_label_en,event_type,entity_type,entity_id,group_key,dedupe_key,channels,metadata)
    values(coalesce(new.title_ar,'تحديث على عرض السعر'),coalesce(new.title_en,'Quotation update'),coalesce(new.body_ar,'تم تسجيل تحديث جديد على عرض السعر الذي تتابعه.'),coalesce(new.body_en,'A new update was recorded for the quotation you follow.'),'info','user',v_user,new.organization_id,'published',now(),'quotations','low','/portal/quotes/'||new.quotation_id::text,'فتح العرض','Open quotation','followed.quotation.'||coalesce(new.event_type,'update'),'quotation',new.quotation_id,'quotation:'||new.quotation_id::text,'follow:quotation:'||new.id::text||':'||v_user::text,array['in_app','push']::text[],coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('followed',true,'site_id',v_site,'quotation_event_id',new.id))
    on conflict(dedupe_key) do nothing;
  end loop;
  return new;
end;$$;
revoke all on function private.notify_followed_quotation_event_v1() from public,anon,authenticated;
drop trigger if exists notify_followed_quotation_event_v1 on public.quotation_events;
create trigger notify_followed_quotation_event_v1 after insert on public.quotation_events for each row execute function private.notify_followed_quotation_event_v1();

create or replace function private.notify_followed_contract_event_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
  for v_user in
    select f.user_id from public.notification_entity_follows f
    join public.organization_members m on m.organization_id=f.organization_id and m.user_id=f.user_id and m.status='active' and (m.access_expires_at is null or m.access_expires_at>now())
    where f.organization_id=new.organization_id and f.entity_type='contract' and f.entity_id=new.contract_id and f.detailed
      and private.b2b_contract_visible(new.contract_id,f.user_id)
  loop
    insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,user_id,organization_id,status,published_at,category,priority,action_url,action_label_ar,action_label_en,event_type,entity_type,entity_id,group_key,dedupe_key,channels,metadata)
    values(coalesce(new.title_ar,'تحديث على العقد'),coalesce(new.title_en,'Contract update'),coalesce(new.body_ar,'تم تسجيل تحديث جديد على العقد الذي تتابعه.'),coalesce(new.body_en,'A new update was recorded for the contract you follow.'),'info','user',v_user,new.organization_id,'published',now(),'contracts','low','/portal/contracts/'||new.contract_id::text,'فتح العقد','Open contract','followed.contract.'||coalesce(new.event_type,'update'),'contract',new.contract_id,'contract:'||new.contract_id::text,'follow:contract:'||new.id::text||':'||v_user::text,array['in_app','push']::text[],coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('followed',true,'contract_event_id',new.id))
    on conflict(dedupe_key) do nothing;
  end loop;
  return new;
end;$$;
revoke all on function private.notify_followed_contract_event_v1() from public,anon,authenticated;
drop trigger if exists notify_followed_contract_event_v1 on public.contract_events;
create trigger notify_followed_contract_event_v1 after insert on public.contract_events for each row execute function private.notify_followed_contract_event_v1();

-- ---------------------------------------------------------------------------
-- 13) Backfill reminders for already-active business records at migration time.
-- ---------------------------------------------------------------------------
insert into public.notifications(
  title_ar,title_en,body_ar,body_en,type,audience,organization_id,status,scheduled_at,
  category,priority,action_url,action_label_ar,action_label_en,event_type,entity_type,entity_id,
  action_required,action_key,group_key,dedupe_key,channels,metadata
)
select
  'عرض سعر يحتاج قرارك','Quotation awaiting your decision',
  'تبقى مدة قصيرة على صلاحية عرض السعر. راجع النسخة الحالية قبل انتهاء الصلاحية.',
  'A quotation is nearing expiry. Review the current version before validity ends.',
  'warning','organization',q.organization_id,'scheduled',greatest(now(),q.valid_until::timestamptz-interval '2 days'),
  'quotations','high','/portal/quotes/'||q.id::text,'مراجعة العرض','Review quotation','quotation.expiring','quotation',q.id,
  true,'quotation_decision','quotation:'||q.id::text,'quote-expiry:'||q.id::text,array['in_app','push','email']::text[],
  jsonb_build_object('quotation_id',q.id,'site_id',q.site_id,'valid_until',q.valid_until)
from public.quotations q
where q.organization_id is not null and q.is_current and q.status in ('sent','viewed') and q.valid_until is not null and q.valid_until>=current_date
on conflict(dedupe_key) do nothing;

insert into public.notifications(
  title_ar,title_en,body_ar,body_en,type,audience,organization_id,status,scheduled_at,
  category,priority,action_url,action_label_ar,action_label_en,event_type,entity_type,entity_id,
  action_required,action_key,group_key,dedupe_key,channels,metadata
)
select
  'موعد مراجعة العقد يقترب','Contract review is approaching',
  'اقتربت نافذة مراجعة وتجديد العقد. افتح العقد لمراجعة المدة والخطوة التالية.',
  'The contract review and renewal window is approaching. Open the contract to review the term and next step.',
  'warning','organization',c.organization_id,'scheduled',greatest(now(),c.ends_on::timestamptz-interval '60 days'),
  'contracts','high','/portal/contracts/'||c.id::text,'مراجعة العقد','Review contract','contract.expiring','contract',c.id,
  true,'contract_renewal','contract:'||c.id::text,'contract-expiry:'||c.id::text,array['in_app','push','email']::text[],
  jsonb_build_object('contract_id',c.id,'ends_on',c.ends_on)
from public.contracts c
where c.organization_id is not null and c.status in ('active','expiring') and c.ends_on is not null
  and coalesce(c.renewal_status,'none') not in ('review_requested','in_review','renewed','not_renewing')
on conflict(dedupe_key) do nothing;

insert into public.notifications(
  title_ar,title_en,body_ar,body_en,type,audience,organization_id,status,scheduled_at,
  category,priority,action_url,action_label_ar,action_label_en,event_type,entity_type,entity_id,
  action_required,group_key,dedupe_key,channels,metadata
)
select
  'موعد تنفيذ قريب','Upcoming execution date',
  'موعد التنفيذ المطلوب لهذا الطلب يقترب. راجع الموقع وتعليمات الاستلام إذا احتاجت تحديثًا.',
  'The requested execution date is approaching. Review the site and receiving instructions if needed.',
  'info','organization',o.organization_id,'scheduled',greatest(now(),o.requested_delivery_date::timestamptz-interval '24 hours'),
  'orders','normal','/portal/orders/'||o.id::text,'فتح الطلب','Open order','order.execution_soon','order',o.id,
  false,'order:'||o.id::text,'order-execution:'||o.id::text,array['in_app','push']::text[],
  jsonb_build_object('order_id',o.id,'site_id',o.service_site_id,'requested_delivery_date',o.requested_delivery_date)
from public.orders o
where o.organization_id is not null and o.status not in ('completed','cancelled','delivered') and o.requested_delivery_date is not null
on conflict(dedupe_key) do nothing;

-- ---------------------------------------------------------------------------
-- 14) Realtime surfaces used by the portal action badge and center.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
      alter publication supabase_realtime add table public.notifications;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notification_reads') then
      alter publication supabase_realtime add table public.notification_reads;
    end if;
  end if;
end;$$;
