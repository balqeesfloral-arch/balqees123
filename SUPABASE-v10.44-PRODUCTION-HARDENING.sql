-- Balqees Floral v10.44 — Production hardening & runtime recovery follow-up
-- Apply after the v10.43 baseline. Idempotent where practical.

create schema if not exists private;
grant usage on schema private to authenticated;

-- 1) Retire legacy v10.38 public SECURITY DEFINER RPCs.
do $$ begin
  if to_regprocedure('public.get_organization_team_center(uuid)') is not null then
    revoke all on function public.get_organization_team_center(uuid) from public,anon,authenticated;
    drop function public.get_organization_team_center(uuid);
  end if;
  if to_regprocedure('public.create_organization_member_invite(uuid,text,text,text,uuid[],timestamptz,numeric)') is not null then
    revoke all on function public.create_organization_member_invite(uuid,text,text,text,uuid[],timestamptz,numeric) from public,anon,authenticated;
    drop function public.create_organization_member_invite(uuid,text,text,text,uuid[],timestamptz,numeric);
  end if;
  if to_regprocedure('public.manage_organization_member(uuid,uuid,text,text)') is not null then
    revoke all on function public.manage_organization_member(uuid,uuid,text,text) from public,anon,authenticated;
    drop function public.manage_organization_member(uuid,uuid,text,text);
  end if;
end $$;

-- New functions must be explicitly granted instead of inheriting PUBLIC execution.
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public revoke execute on functions from authenticated;

-- 2) Smart Care: the live orders schema uses po_number, not reference.
-- Keep the private implementation architecture from v10.40 and expose only invoker wrappers.
create or replace function private.care_setting_enabled(p_key text)
returns boolean language sql stable security definer set search_path='' as $$
select coalesce(case p_key
  when 'ai' then s.ai_enabled
  when 'human' then s.human_handoff_enabled
  when 'catalog' then s.catalog_search_enabled
  when 'finance' then s.finance_lookup_enabled
  when 'contract' then s.contract_lookup_enabled
  when 'orders' then coalesce(s.order_lookup_enabled,true)
  when 'quotations' then coalesce(s.quotation_lookup_enabled,true)
  when 'sites' then coalesce(s.site_lookup_enabled,true)
  when 'drafts' then coalesce(s.request_draft_enabled,true)
  when 'employee_assist' then coalesce(s.employee_assist_enabled,true)
  when 'knowledge' then coalesce(s.knowledge_enabled,true)
  else false end,false)
from public.care_settings s where s.id=true;
$$;
revoke all on function private.care_setting_enabled(text) from public,anon;
grant execute on function private.care_setting_enabled(text) to authenticated;

alter table public.care_tool_audit
  add column if not exists safe_parameters jsonb not null default '{}'::jsonb,
  add column if not exists result_summary jsonb not null default '{}'::jsonb;

create or replace function private.care_log_tool(
  p_org uuid,p_tool text,p_entity_type text,p_entity_id text,
  p_params jsonb,p_result jsonb,p_success boolean default true
) returns void
language plpgsql security definer set search_path='' as $$
begin
  insert into public.care_tool_audit(
    organization_id,user_id,tool_name,entity_type,entity_id,success,safe_parameters,result_summary
  ) values(
    p_org,auth.uid(),p_tool,p_entity_type,p_entity_id,coalesce(p_success,true),coalesce(p_params,'{}'),coalesce(p_result,'{}')
  );
end $$;
revoke all on function private.care_log_tool(uuid,text,text,text,jsonb,jsonb,boolean) from public,anon,authenticated;

create or replace function private.care_get_active_orders_v2_impl(p_org uuid,p_site uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
  if not private.care_setting_enabled('orders') then raise exception 'CARE_TOOL_DISABLED'; end if;
  if not private.b2b_has_permission(p_org,'view_orders',p_site) then raise exception 'CARE_ORDER_ACCESS_DENIED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,'order_number',o.order_number,'reference',o.po_number,'po_number',o.po_number,
    'status',o.status,'site_id',o.service_site_id,'created_at',o.created_at,'updated_at',o.updated_at,
    'requested_delivery_date',o.requested_delivery_date
  ) order by o.created_at desc),'[]'::jsonb) into v
  from public.orders o
  where o.organization_id=p_org
    and (p_site is null or o.service_site_id=p_site)
    and o.status not in ('completed','cancelled','delivered')
    and private.b2b_site_allowed(p_org,auth.uid(),o.service_site_id);
  perform private.care_log_tool(p_org,'get_active_orders','organization',p_org::text,jsonb_build_object('site_id',p_site),jsonb_build_object('count',jsonb_array_length(v)));
  return v;
end $$;
revoke all on function private.care_get_active_orders_v2_impl(uuid,uuid) from public,anon;
grant execute on function private.care_get_active_orders_v2_impl(uuid,uuid) to authenticated;

create or replace function public.care_get_active_orders_v2(p_organization_id uuid,p_site_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
  select private.care_get_active_orders_v2_impl(p_organization_id,p_site_id);
$$;
revoke all on function public.care_get_active_orders_v2(uuid,uuid) from public,anon;
grant execute on function public.care_get_active_orders_v2(uuid,uuid) to authenticated;

create or replace function private.care_get_order_details_v2_impl(p_org uuid,p_order uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; v_items jsonb; v_events jsonb; v jsonb;
begin
  if not private.care_setting_enabled('orders') then raise exception 'CARE_TOOL_DISABLED'; end if;
  select * into o from public.orders where id=p_order and organization_id=p_org;
  if not found or not private.b2b_has_permission(p_org,'view_orders',o.service_site_id) then raise exception 'CARE_ORDER_ACCESS_DENIED'; end if;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb) into v_items
  from public.order_items i where i.order_id=p_order;
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_type',e.event_type,'title_ar',e.title_ar,'title_en',e.title_en,
    'body_ar',e.body_ar,'body_en',e.body_en,'created_at',e.created_at
  ) order by e.created_at desc),'[]'::jsonb) into v_events
  from public.order_events e where e.order_id=p_order;
  v:=jsonb_build_object(
    'id',o.id,'order_number',o.order_number,'reference',o.po_number,'po_number',o.po_number,
    'status',o.status,'site_id',o.service_site_id,'requested_delivery_date',o.requested_delivery_date,
    'created_at',o.created_at,'updated_at',o.updated_at,'items',v_items,'events',v_events
  );
  perform private.care_log_tool(p_org,'get_order_details','order',p_order::text,'{}',jsonb_build_object('status',o.status,'items',jsonb_array_length(v_items)));
  return v;
end $$;
revoke all on function private.care_get_order_details_v2_impl(uuid,uuid) from public,anon;
grant execute on function private.care_get_order_details_v2_impl(uuid,uuid) to authenticated;

create or replace function public.care_get_order_details_v2(p_organization_id uuid,p_order_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select private.care_get_order_details_v2_impl(p_organization_id,p_order_id);
$$;
revoke all on function public.care_get_order_details_v2(uuid,uuid) from public,anon;
grant execute on function public.care_get_order_details_v2(uuid,uuid) to authenticated;

-- 3) RLS init-plan optimizations for v10.41/v10.42/v10.44 tables.
drop policy if exists care_request_drafts_own_v1044 on public.care_request_drafts;
drop policy if exists care_request_drafts_own_v1040 on public.care_request_drafts;
create policy care_request_drafts_own_v1044 on public.care_request_drafts
for select to authenticated
using ((user_id=(select auth.uid())) and private.b2b_has_permission(organization_id,'create_orders',site_id));

drop policy if exists notification_category_preferences_own on public.notification_category_preferences;
create policy notification_category_preferences_own on public.notification_category_preferences
for all to authenticated
using ((user_id=(select auth.uid())) and private.is_org_member(organization_id))
with check ((user_id=(select auth.uid())) and private.is_org_member(organization_id));

drop policy if exists notification_deliveries_admin_or_own_v1044 on public.notification_deliveries;
create policy notification_deliveries_admin_or_own_v1044 on public.notification_deliveries
for select to authenticated
using (private.is_balqees_admin() or user_id=(select auth.uid()));

drop policy if exists notification_entity_follows_own on public.notification_entity_follows;
create policy notification_entity_follows_own on public.notification_entity_follows
for all to authenticated
using ((user_id=(select auth.uid())) and private.is_org_member(organization_id))
with check ((user_id=(select auth.uid())) and private.is_org_member(organization_id));

drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences
for all to authenticated
using ((user_id=(select auth.uid())) and private.is_org_member(organization_id))
with check ((user_id=(select auth.uid())) and private.is_org_member(organization_id));

drop policy if exists organization_change_requests_read on public.organization_change_requests;
create policy organization_change_requests_read on public.organization_change_requests
for select to authenticated
using (
  private.is_balqees_admin()
  or requested_by=(select auth.uid())
  or private.b2b_has_permission(organization_id,'manage_settings',null)
);

drop policy if exists portal_user_preferences_own on public.portal_user_preferences;
create policy portal_user_preferences_own on public.portal_user_preferences
for all to authenticated
using ((user_id=(select auth.uid())) and private.is_org_member(organization_id))
with check ((user_id=(select auth.uid())) and private.is_org_member(organization_id));

drop policy if exists user_devices_own on public.user_devices;
create policy user_devices_own on public.user_devices
for all to authenticated
using ((user_id=(select auth.uid())) and (organization_id is null or private.is_org_member(organization_id)))
with check ((user_id=(select auth.uid())) and (organization_id is null or private.is_org_member(organization_id)));

-- 4) Avoid overlapping SELECT evaluation from ALL policies.
drop policy if exists "care settings admin write" on public.care_settings;
drop policy if exists care_settings_admin_insert_v1044 on public.care_settings;
drop policy if exists care_settings_admin_update_v1044 on public.care_settings;
drop policy if exists care_settings_admin_delete_v1044 on public.care_settings;
create policy care_settings_admin_insert_v1044 on public.care_settings for insert to authenticated with check(private.is_balqees_admin());
create policy care_settings_admin_update_v1044 on public.care_settings for update to authenticated using(private.is_balqees_admin()) with check(private.is_balqees_admin());
create policy care_settings_admin_delete_v1044 on public.care_settings for delete to authenticated using(private.is_balqees_admin());

drop policy if exists organization_integrations_admin_write_v1044 on public.organization_integrations;
drop policy if exists organization_integrations_admin_insert_v1044 on public.organization_integrations;
drop policy if exists organization_integrations_admin_update_v1044 on public.organization_integrations;
drop policy if exists organization_integrations_admin_delete_v1044 on public.organization_integrations;
create policy organization_integrations_admin_insert_v1044 on public.organization_integrations for insert to authenticated with check(private.is_balqees_admin());
create policy organization_integrations_admin_update_v1044 on public.organization_integrations for update to authenticated using(private.is_balqees_admin()) with check(private.is_balqees_admin());
create policy organization_integrations_admin_delete_v1044 on public.organization_integrations for delete to authenticated using(private.is_balqees_admin());

drop policy if exists "team site scope managed by team managers" on public.organization_member_site_access;
drop policy if exists team_site_scope_manager_insert_v1044 on public.organization_member_site_access;
drop policy if exists team_site_scope_manager_update_v1044 on public.organization_member_site_access;
drop policy if exists team_site_scope_manager_delete_v1044 on public.organization_member_site_access;
create policy team_site_scope_manager_insert_v1044 on public.organization_member_site_access for insert to authenticated with check(public.can_manage_org_team(organization_id));
create policy team_site_scope_manager_update_v1044 on public.organization_member_site_access for update to authenticated using(public.can_manage_org_team(organization_id)) with check(public.can_manage_org_team(organization_id));
create policy team_site_scope_manager_delete_v1044 on public.organization_member_site_access for delete to authenticated using(public.can_manage_org_team(organization_id));

-- 5) Cover remaining foreign keys added by Pages 9–12.
create index if not exists fk_c48a87cf7f43967b on public.care_knowledge_items (created_by);
create index if not exists fk_cff8209928336ad3 on public.care_knowledge_items (organization_id);
create index if not exists fk_0eeae7b5c24211ed on public.care_knowledge_items (updated_by);
create index if not exists fk_de206fb37ed0ac0e on public.care_request_drafts (organization_id);
create index if not exists fk_c24aa52f77b82033 on public.care_request_drafts (site_id);
create index if not exists fk_204cbc1dc50f55fa on public.care_request_drafts (user_id);
create index if not exists fk_025cf4a9033cc29b on public.care_settings (updated_by);
create index if not exists fk_48e138f8e04ff8b3 on public.care_tool_audit (conversation_id);
create index if not exists fk_66707f7f6bbd2a65 on public.care_tool_audit (organization_id);
create index if not exists fk_d01a9982b71b56a9 on public.care_tool_audit (user_id);
create index if not exists fk_42b88d84eb49327f on public.notification_events (created_by);
create index if not exists fk_a49b38c176474a24 on public.notification_events (organization_id);
create index if not exists fk_8c74702644bba18c on public.organization_access_policies (updated_by);
create index if not exists fk_80db2175b860293f on public.organization_change_requests (organization_id);
create index if not exists fk_ba683c42d35ef520 on public.organization_change_requests (requested_by);
create index if not exists fk_f2bba958fc62fd42 on public.organization_change_requests (reviewed_by);
create index if not exists fk_05b23e970ff9d40b on public.organization_custom_roles (created_by);
create index if not exists fk_2d258b91d442d5a5 on public.organization_member_audit (actor_user_id);
create index if not exists fk_a5caae6657e4d33c on public.organization_member_audit (organization_id);
create index if not exists fk_ff5c200577b987aa on public.organization_member_audit (target_user_id);
create index if not exists fk_687e0f004c26e2fa on public.organization_member_invites (accepted_by);
create index if not exists fk_77c880b236237d7f on public.organization_member_invites (custom_role_id);
create index if not exists fk_e997069e45d4e210 on public.organization_member_invites (invited_by);
create index if not exists fk_06776aeb72ca2fef on public.organization_member_site_access (created_by);
create index if not exists fk_88d1daef933f78ab on public.organization_members (custom_role_id);
create index if not exists fk_ad863befb07ada82 on public.organization_portal_settings (default_receiving_contact_id);
create index if not exists fk_9ffa2f2b5dc8f492 on public.organization_portal_settings (default_site_id);
create index if not exists fk_0d71f8cb4f764a8f on public.organization_portal_settings (updated_by);
create index if not exists fk_c275877eb4863521 on public.organization_responsibilities (created_by);
create index if not exists fk_1972d7f91492ed5d on public.organization_responsibilities (site_id);
create index if not exists fk_f066e538f169457d on public.organization_responsibilities (user_id);
create index if not exists fk_5266a2cc523607ff on public.organization_role_portal_settings (updated_by);
create index if not exists fk_d8be822b8b59b92f on public.support_conversations (assigned_admin_id);
create index if not exists fk_8a907f676626ec5b on public.support_conversations (claimed_by);
create index if not exists fk_a38d60138b7e8bec on public.user_devices (organization_id);
create index if not exists fk_notification_category_preferences_org_v1044 on public.notification_category_preferences (organization_id);
create index if not exists fk_notification_deliveries_user_v1044 on public.notification_deliveries (user_id);
create index if not exists fk_notification_entity_follows_org_v1044 on public.notification_entity_follows (organization_id);
create index if not exists fk_notification_preferences_org_v1044 on public.notification_preferences (organization_id);
create index if not exists fk_organization_member_site_access_site_v1044 on public.organization_member_site_access (site_id);
create index if not exists fk_organization_member_site_access_user_v1044 on public.organization_member_site_access (user_id);
create index if not exists fk_portal_user_preferences_org_v1044 on public.portal_user_preferences (organization_id);

select pg_notify('pgrst','reload schema');
