-- Balqees Floral v10.42 — B2B Portal Settings / Page 12
-- Apply AFTER v10.41. Does not run automatically from the frontend bundle.
-- Policy precedence: system defaults -> organization defaults -> role defaults -> user preferences.

-- Organization public profile extension required by Page 12.
alter table public.organizations add column if not exists sector text;

create table if not exists public.portal_user_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  theme text not null default 'system' check(theme in ('light','dark','system')),
  accent_preset text not null default 'olive' check(accent_preset in ('olive','gold','forest','sand','hotel')),
  density text not null default 'balanced' check(density in ('comfortable','balanced','compact')),
  font_scale text not null default 'medium' check(font_scale in ('small','medium','large','xlarge')),
  interface_style text not null default 'luxury' check(interface_style in ('calm','luxury','lively')),
  reduced_motion boolean not null default false,
  decorations text not null default 'balanced' check(decorations in ('none','light','balanced','rich')),
  glass_effect text not null default 'balanced' check(glass_effect in ('light','balanced','clear')),
  background_motion text not null default 'subtle' check(background_motion in ('static','subtle','full')),
  card_style text not null default 'soft' check(card_style in ('soft','glass','flat')),
  sidebar_mode text not null default 'auto' check(sidebar_mode in ('wide','compact','auto')),
  homepage_mode text not null default 'mixed' check(homepage_mode in ('visual','operational','mixed')),
  widget_order jsonb not null default '["attention","operations","insights","milestones","recent"]'::jsonb,
  widget_visibility jsonb not null default '{"attention":true,"operations":true,"insights":true,"milestones":true,"recent":true}'::jsonb,
  number_style text not null default 'latin' check(number_style in ('arabic_indic','latin')),
  display_profile text not null default 'custom' check(display_profile in ('custom','executive','operations','finance','minimal')),
  high_contrast boolean not null default false,
  clear_borders boolean not null default false,
  reduce_transparency boolean not null default false,
  larger_touch_targets boolean not null default false,
  performance_mode text not null default 'auto' check(performance_mode in ('auto','high','balanced','performance')),
  image_loading text not null default 'auto' check(image_loading in ('full','auto','data_saver')),
  preferred_language text not null default 'ar' check(preferred_language in ('ar','en')),
  date_system text not null default 'dual' check(date_system in ('gregorian','hijri','dual')),
  time_format text not null default '24h' check(time_format in ('12h','24h')),
  timezone text not null default 'Asia/Riyadh',
  updated_at timestamptz not null default now(),
  primary key(user_id,organization_id)
);
alter table public.portal_user_preferences enable row level security;
grant select,insert,update,delete on public.portal_user_preferences to authenticated;
drop policy if exists portal_user_preferences_own on public.portal_user_preferences;
create policy portal_user_preferences_own on public.portal_user_preferences for all to authenticated
using ((user_id=auth.uid() and private.is_org_member(organization_id)) or private.is_balqees_admin())
with check ((user_id=auth.uid() and private.is_org_member(organization_id)) or private.is_balqees_admin());

create table if not exists public.organization_portal_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  display_defaults jsonb not null default '{}'::jsonb,
  default_site_id uuid references public.organization_sites(id) on delete set null,
  default_receiving_contact_id uuid references public.organization_site_contacts(id) on delete set null,
  po_required boolean not null default false,
  cost_center_enabled boolean not null default false,
  internal_approval_enabled boolean not null default false,
  price_visibility_rule text not null default 'permission' check(price_visibility_rule in ('permission','approvers_finance','finance_only')),
  show_vat_separately boolean not null default true,
  finance_amount_mode text not null default 'context' check(finance_amount_mode in ('context','before_tax','tax_inclusive')),
  document_grouping text not null default 'type' check(document_grouping in ('type','month','site')),
  mfa_policy text not null default 'sensitive_roles' check(mfa_policy in ('none','sensitive_roles','all_members')),
  locked_display_keys text[] not null default '{}'::text[],
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.organization_portal_settings enable row level security;
grant select on public.organization_portal_settings to authenticated;
drop policy if exists organization_portal_settings_read on public.organization_portal_settings;
create policy organization_portal_settings_read on public.organization_portal_settings for select to authenticated
using(private.is_org_member(organization_id) or private.is_balqees_admin());

create table if not exists public.organization_role_portal_settings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_key text not null,
  display_defaults jsonb not null default '{}'::jsonb,
  locked_display_keys text[] not null default '{}'::text[],
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(organization_id,role_key)
);
alter table public.organization_role_portal_settings enable row level security;
grant select on public.organization_role_portal_settings to authenticated;
drop policy if exists organization_role_portal_settings_read on public.organization_role_portal_settings;
create policy organization_role_portal_settings_read on public.organization_role_portal_settings for select to authenticated
using(private.is_org_member(organization_id) or private.is_balqees_admin());

create table if not exists public.organization_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  request_type text not null default 'verified_profile_change' check(request_type in ('verified_profile_change','legal_identity','billing_identity')),
  requested_changes jsonb not null,
  reason text,
  status text not null default 'pending' check(status in ('pending','in_review','approved','rejected','cancelled')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists organization_change_requests_org_idx on public.organization_change_requests(organization_id,status,created_at desc);
alter table public.organization_change_requests enable row level security;
grant select on public.organization_change_requests to authenticated;
drop policy if exists organization_change_requests_read on public.organization_change_requests;
create policy organization_change_requests_read on public.organization_change_requests for select to authenticated
using(private.is_balqees_admin() or (requested_by=auth.uid() and private.is_org_member(organization_id)) or private.b2b_has_permission(organization_id,'manage_settings',null));

create table if not exists public.organization_integrations (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_key text not null check(integration_key in ('accounting','email','erp','webhook')),
  status text not null default 'disconnected' check(status in ('disconnected','connected','attention','disabled')),
  provider_label text,
  public_metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(organization_id,integration_key)
);
alter table public.organization_integrations enable row level security;
grant select on public.organization_integrations to authenticated;
drop policy if exists organization_integrations_read on public.organization_integrations;
create policy organization_integrations_read on public.organization_integrations for select to authenticated
using(private.is_org_member(organization_id) or private.is_balqees_admin());

-- Organization logo bucket. Object name convention: <organization_id>/logo/<filename>
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('organization-assets','organization-assets',false,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists organization_assets_read on storage.objects;
create policy organization_assets_read on storage.objects for select to authenticated using(
  bucket_id='organization-assets' and array_length(storage.foldername(name),1)>=2 and
  (private.is_balqees_admin() or private.is_org_member(((storage.foldername(name))[1])::uuid))
);
drop policy if exists organization_assets_write on storage.objects;
create policy organization_assets_write on storage.objects for insert to authenticated with check(
  bucket_id='organization-assets' and array_length(storage.foldername(name),1)>=2 and
  (private.b2b_has_permission(((storage.foldername(name))[1])::uuid,'manage_settings',null) or private.b2b_has_permission(((storage.foldername(name))[1])::uuid,'manage_profile',null))
);
drop policy if exists organization_assets_update on storage.objects;
create policy organization_assets_update on storage.objects for update to authenticated using(
  bucket_id='organization-assets' and (private.b2b_has_permission(((storage.foldername(name))[1])::uuid,'manage_settings',null) or private.b2b_has_permission(((storage.foldername(name))[1])::uuid,'manage_profile',null))
) with check(
  bucket_id='organization-assets' and (private.b2b_has_permission(((storage.foldername(name))[1])::uuid,'manage_settings',null) or private.b2b_has_permission(((storage.foldername(name))[1])::uuid,'manage_profile',null))
);
drop policy if exists organization_assets_delete on storage.objects;
create policy organization_assets_delete on storage.objects for delete to authenticated using(
  bucket_id='organization-assets' and (private.b2b_has_permission(((storage.foldername(name))[1])::uuid,'manage_settings',null) or private.b2b_has_permission(((storage.foldername(name))[1])::uuid,'manage_profile',null))
);

create or replace function private.portal_display_defaults()
returns jsonb language sql immutable set search_path='' as $$
select jsonb_build_object(
 'theme','system','accent_preset','olive','density','balanced','font_scale','medium','interface_style','luxury',
 'reduced_motion',false,'decorations','balanced','glass_effect','balanced','background_motion','subtle',
 'card_style','soft','sidebar_mode','auto','homepage_mode','mixed','widget_order','["attention","operations","insights","milestones","recent"]'::jsonb,'widget_visibility','{"attention":true,"operations":true,"insights":true,"milestones":true,"recent":true}'::jsonb,
 'number_style','latin','display_profile','custom','high_contrast',false,'clear_borders',false,'reduce_transparency',false,
 'larger_touch_targets',false,'performance_mode','auto','image_loading','auto','preferred_language','ar','date_system','dual',
 'time_format','24h','timezone','Asia/Riyadh'
); $$;
revoke all on function private.portal_display_defaults() from public,anon;
grant execute on function private.portal_display_defaults() to authenticated;

create or replace function private.portal_display_json(p public.portal_user_preferences)
returns jsonb language sql stable set search_path='' as $$
select jsonb_build_object(
 'theme',p.theme,'accent_preset',p.accent_preset,'density',p.density,'font_scale',p.font_scale,'interface_style',p.interface_style,
 'reduced_motion',p.reduced_motion,'decorations',p.decorations,'glass_effect',p.glass_effect,'background_motion',p.background_motion,
 'card_style',p.card_style,'sidebar_mode',p.sidebar_mode,'homepage_mode',p.homepage_mode,'widget_order',p.widget_order,
 'widget_visibility',p.widget_visibility,'number_style',p.number_style,'display_profile',p.display_profile,'high_contrast',p.high_contrast,
 'clear_borders',p.clear_borders,'reduce_transparency',p.reduce_transparency,'larger_touch_targets',p.larger_touch_targets,
 'performance_mode',p.performance_mode,'image_loading',p.image_loading,'preferred_language',p.preferred_language,
 'date_system',p.date_system,'time_format',p.time_format,'timezone',p.timezone
); $$;
revoke all on function private.portal_display_json(public.portal_user_preferences) from public,anon;
grant execute on function private.portal_display_json(public.portal_user_preferences) to authenticated;

create or replace function private.portal_validate_display(p jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare r jsonb:=coalesce(p,'{}'::jsonb); k text;
begin
  -- Keep only known keys; table checks perform final validation after extraction.
  for k in select key from jsonb_each(r) where key not in (
    'theme','accent_preset','density','font_scale','interface_style','reduced_motion','decorations','glass_effect','background_motion',
    'card_style','sidebar_mode','homepage_mode','widget_order','widget_visibility','number_style','display_profile','high_contrast',
    'clear_borders','reduce_transparency','larger_touch_targets','performance_mode','image_loading','preferred_language','date_system','time_format','timezone'
  ) loop r:=r-k; end loop;
  if r ? 'widget_order' then
    if jsonb_typeof(r->'widget_order') <> 'array' then raise exception 'INVALID_WIDGET_ORDER'; end if;
    if exists(
      select 1 from jsonb_array_elements_text(r->'widget_order') as w(key)
      where w.key not in ('attention','operations','insights','milestones','recent')
    ) then raise exception 'INVALID_WIDGET_ORDER'; end if;
  end if;
  if r ? 'widget_visibility' then
    if jsonb_typeof(r->'widget_visibility') <> 'object' then raise exception 'INVALID_WIDGET_VISIBILITY'; end if;
    if exists(
      select 1 from jsonb_each(r->'widget_visibility') e
      where e.key not in ('attention','operations','insights','milestones','recent') or jsonb_typeof(e.value) <> 'boolean'
    ) then raise exception 'INVALID_WIDGET_VISIBILITY'; end if;
  end if;
  return r;
end; $$;
revoke all on function private.portal_validate_display(jsonb) from public,anon;
grant execute on function private.portal_validate_display(jsonb) to authenticated;

create or replace function private.save_my_portal_preferences_v1_impl(p_org uuid,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb:=private.portal_validate_display(p_value); r public.portal_user_preferences%rowtype;
begin
 if auth.uid() is null or not private.is_org_member(p_org) then raise exception 'ORG_PERMISSION_DENIED'; end if;
 insert into public.portal_user_preferences(
  user_id,organization_id,theme,accent_preset,density,font_scale,interface_style,reduced_motion,decorations,glass_effect,background_motion,
  card_style,sidebar_mode,homepage_mode,widget_order,widget_visibility,number_style,display_profile,high_contrast,clear_borders,reduce_transparency,
  larger_touch_targets,performance_mode,image_loading,preferred_language,date_system,time_format,timezone,updated_at
 ) values(
  auth.uid(),p_org,coalesce(v->>'theme','system'),coalesce(v->>'accent_preset','olive'),coalesce(v->>'density','balanced'),coalesce(v->>'font_scale','medium'),coalesce(v->>'interface_style','luxury'),coalesce((v->>'reduced_motion')::boolean,false),coalesce(v->>'decorations','balanced'),coalesce(v->>'glass_effect','balanced'),coalesce(v->>'background_motion','subtle'),
  coalesce(v->>'card_style','soft'),coalesce(v->>'sidebar_mode','auto'),coalesce(v->>'homepage_mode','mixed'),coalesce(v->'widget_order','[]'::jsonb),coalesce(v->'widget_visibility','{}'::jsonb),coalesce(v->>'number_style','latin'),coalesce(v->>'display_profile','custom'),coalesce((v->>'high_contrast')::boolean,false),coalesce((v->>'clear_borders')::boolean,false),coalesce((v->>'reduce_transparency')::boolean,false),
  coalesce((v->>'larger_touch_targets')::boolean,false),coalesce(v->>'performance_mode','auto'),coalesce(v->>'image_loading','auto'),coalesce(v->>'preferred_language','ar'),coalesce(v->>'date_system','dual'),coalesce(v->>'time_format','24h'),coalesce(nullif(v->>'timezone',''),'Asia/Riyadh'),now()
 ) on conflict(user_id,organization_id) do update set
  theme=excluded.theme,accent_preset=excluded.accent_preset,density=excluded.density,font_scale=excluded.font_scale,interface_style=excluded.interface_style,reduced_motion=excluded.reduced_motion,
  decorations=excluded.decorations,glass_effect=excluded.glass_effect,background_motion=excluded.background_motion,card_style=excluded.card_style,sidebar_mode=excluded.sidebar_mode,homepage_mode=excluded.homepage_mode,
  widget_order=excluded.widget_order,widget_visibility=excluded.widget_visibility,number_style=excluded.number_style,display_profile=excluded.display_profile,high_contrast=excluded.high_contrast,clear_borders=excluded.clear_borders,
  reduce_transparency=excluded.reduce_transparency,larger_touch_targets=excluded.larger_touch_targets,performance_mode=excluded.performance_mode,image_loading=excluded.image_loading,preferred_language=excluded.preferred_language,
  date_system=excluded.date_system,time_format=excluded.time_format,timezone=excluded.timezone,updated_at=now()
 returning * into r;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'portal_preferences_saved','organization',p_org::text,jsonb_build_object('scope','user_display'));
 return private.portal_display_json(r);
end; $$;
revoke all on function private.save_my_portal_preferences_v1_impl(uuid,jsonb) from public,anon;
grant execute on function private.save_my_portal_preferences_v1_impl(uuid,jsonb) to authenticated;
create or replace function public.save_my_portal_preferences_v1(p_organization_id uuid,p_preferences jsonb)
returns jsonb language sql security invoker set search_path='' as $$select private.save_my_portal_preferences_v1_impl(p_organization_id,p_preferences);$$;
revoke all on function public.save_my_portal_preferences_v1(uuid,jsonb) from public,anon;
grant execute on function public.save_my_portal_preferences_v1(uuid,jsonb) to authenticated;

create or replace function private.save_organization_portal_settings_v1_impl(p_org uuid,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.organization_portal_settings%rowtype; v_mfa text; v_site uuid; v_contact uuid;
begin
 if auth.uid() is null or not private.b2b_has_permission(p_org,'manage_settings',null) then raise exception 'SETTINGS_PERMISSION_DENIED'; end if;
 v_mfa:=coalesce(p_value->>'mfa_policy','sensitive_roles');
 if v_mfa not in ('none','sensitive_roles','all_members') then raise exception 'INVALID_MFA_POLICY'; end if;
 if v_mfa is distinct from coalesce((select mfa_policy from public.organization_portal_settings where organization_id=p_org),'sensitive_roles')
    and not private.b2b_current_aal2() then raise exception 'MFA_AAL2_REQUIRED'; end if;
 begin v_site:=nullif(p_value->>'default_site_id','')::uuid; exception when invalid_text_representation then raise exception 'INVALID_DEFAULT_SITE'; end;
 begin v_contact:=nullif(p_value->>'default_receiving_contact_id','')::uuid; exception when invalid_text_representation then raise exception 'INVALID_DEFAULT_CONTACT'; end;
 if v_site is not null and not exists(select 1 from public.organization_sites s where s.id=v_site and s.organization_id=p_org and s.is_active) then raise exception 'INVALID_DEFAULT_SITE'; end if;
 if v_contact is not null and not exists(select 1 from public.organization_site_contacts c where c.id=v_contact and c.organization_id=p_org and c.is_visible and (v_site is null or c.site_id=v_site)) then raise exception 'INVALID_DEFAULT_CONTACT'; end if;
 insert into public.organization_portal_settings(organization_id,display_defaults,default_site_id,default_receiving_contact_id,po_required,cost_center_enabled,internal_approval_enabled,price_visibility_rule,show_vat_separately,finance_amount_mode,document_grouping,mfa_policy,locked_display_keys,updated_by,updated_at)
 values(p_org,private.portal_validate_display(coalesce(p_value->'display_defaults','{}'::jsonb)),v_site,v_contact,coalesce((p_value->>'po_required')::boolean,false),coalesce((p_value->>'cost_center_enabled')::boolean,false),coalesce((p_value->>'internal_approval_enabled')::boolean,false),coalesce(p_value->>'price_visibility_rule','permission'),coalesce((p_value->>'show_vat_separately')::boolean,true),coalesce(p_value->>'finance_amount_mode','context'),coalesce(p_value->>'document_grouping','type'),v_mfa,coalesce(array(select jsonb_array_elements_text(coalesce(p_value->'locked_display_keys','[]'::jsonb))),'{}'::text[]),auth.uid(),now())
 on conflict(organization_id) do update set display_defaults=excluded.display_defaults,default_site_id=excluded.default_site_id,default_receiving_contact_id=excluded.default_receiving_contact_id,po_required=excluded.po_required,cost_center_enabled=excluded.cost_center_enabled,internal_approval_enabled=excluded.internal_approval_enabled,price_visibility_rule=excluded.price_visibility_rule,show_vat_separately=excluded.show_vat_separately,finance_amount_mode=excluded.finance_amount_mode,document_grouping=excluded.document_grouping,mfa_policy=excluded.mfa_policy,locked_display_keys=excluded.locked_display_keys,updated_by=auth.uid(),updated_at=now()
 returning * into r;
 -- Keep existing role/member-specific MFA stricter than org policy, never silently weaken explicit member requirement.
 if v_mfa='all_members' then update public.organization_members set mfa_required=true,updated_at=now() where organization_id=p_org and status='active';
 elsif v_mfa='sensitive_roles' then update public.organization_members set mfa_required=true,updated_at=now() where organization_id=p_org and status='active' and member_role in ('owner','admin','procurement_manager','approver','finance','organization_manager'); end if;
 update public.organizations set procurement_settings=coalesce(procurement_settings,'{}'::jsonb)||jsonb_build_object('po_required',r.po_required,'cost_center_enabled',r.cost_center_enabled,'internal_approval_enabled',r.internal_approval_enabled,'price_visibility_rule',r.price_visibility_rule),updated_at=now() where id=p_org;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'organization_settings_saved','organization',p_org::text,jsonb_build_object('mfa_policy',r.mfa_policy,'po_required',r.po_required,'cost_center_enabled',r.cost_center_enabled));
 return to_jsonb(r);
end; $$;
revoke all on function private.save_organization_portal_settings_v1_impl(uuid,jsonb) from public,anon;
grant execute on function private.save_organization_portal_settings_v1_impl(uuid,jsonb) to authenticated;
create or replace function public.save_organization_portal_settings_v1(p_organization_id uuid,p_settings jsonb)
returns jsonb language sql security invoker set search_path='' as $$select private.save_organization_portal_settings_v1_impl(p_organization_id,p_settings);$$;
revoke all on function public.save_organization_portal_settings_v1(uuid,jsonb) from public,anon;
grant execute on function public.save_organization_portal_settings_v1(uuid,jsonb) to authenticated;

create or replace function private.update_organization_public_profile_v1_impl(p_org uuid,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.organizations%rowtype;
begin
 if not (private.b2b_has_permission(p_org,'manage_settings',null) or private.b2b_has_permission(p_org,'manage_profile',null)) then raise exception 'PROFILE_PERMISSION_DENIED'; end if;
 update public.organizations set
  display_name=coalesce(nullif(trim(p_value->>'display_name'),''),display_name),
  contact_email=nullif(trim(p_value->>'contact_email'),''),contact_phone=nullif(trim(p_value->>'contact_phone'),''),
  billing_email=nullif(trim(p_value->>'billing_email'),''),website=nullif(trim(p_value->>'website'),''),
  sector=nullif(trim(p_value->>'sector'),''),
  logo_path=coalesce(nullif(trim(p_value->>'logo_path'),''),logo_path),preferred_language=coalesce(nullif(p_value->>'preferred_language',''),preferred_language),updated_at=now()
 where id=p_org returning * into r;
 if not found then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'organization_public_profile_updated','organization',p_org::text,jsonb_build_object('display_name',r.display_name));
 return to_jsonb(r);
end; $$;
revoke all on function private.update_organization_public_profile_v1_impl(uuid,jsonb) from public,anon;
grant execute on function private.update_organization_public_profile_v1_impl(uuid,jsonb) to authenticated;
create or replace function public.update_organization_public_profile_v1(p_organization_id uuid,p_profile jsonb)
returns jsonb language sql security invoker set search_path='' as $$select private.update_organization_public_profile_v1_impl(p_organization_id,p_profile);$$;
revoke all on function public.update_organization_public_profile_v1(uuid,jsonb) from public,anon;
grant execute on function public.update_organization_public_profile_v1(uuid,jsonb) to authenticated;

create or replace function private.create_organization_change_request_v1_impl(p_org uuid,p_changes jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$declare v_id uuid;begin
 if auth.uid() is null or not private.is_org_member(p_org) then raise exception 'ORG_PERMISSION_DENIED'; end if;
 if not (private.b2b_has_permission(p_org,'manage_settings',null) or private.b2b_has_permission(p_org,'manage_profile',null)) then raise exception 'PROFILE_PERMISSION_DENIED'; end if;
 if not (p_changes ?| array['legal_name','commercial_number','vat_number','entity_type']) then raise exception 'NO_VERIFIED_FIELDS'; end if;
 if exists(select 1 from jsonb_object_keys(p_changes) as j(key) where j.key not in ('legal_name','commercial_number','vat_number','entity_type')) then raise exception 'INVALID_VERIFIED_FIELD'; end if;
 insert into public.organization_change_requests(organization_id,requested_by,requested_changes,reason) values(p_org,auth.uid(),p_changes,nullif(trim(p_reason),'')) returning id into v_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'verified_profile_change_requested','organization_change_request',v_id::text,jsonb_build_object('organization_id',p_org));
 return v_id;
end; $$;
revoke all on function private.create_organization_change_request_v1_impl(uuid,jsonb,text) from public,anon;
grant execute on function private.create_organization_change_request_v1_impl(uuid,jsonb,text) to authenticated;
create or replace function public.create_organization_change_request_v1(p_organization_id uuid,p_changes jsonb,p_reason text default null)
returns uuid language sql security invoker set search_path='' as $$select private.create_organization_change_request_v1_impl(p_organization_id,p_changes,p_reason);$$;
revoke all on function public.create_organization_change_request_v1(uuid,jsonb,text) from public,anon;
grant execute on function public.create_organization_change_request_v1(uuid,jsonb,text) to authenticated;

create or replace function private.get_my_portal_settings_v1_impl(p_org uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.organization_members%rowtype; u public.portal_user_preferences%rowtype; o public.organization_portal_settings%rowtype; role_defaults jsonb:='{}'::jsonb; role_locks text[]:='{}'; locked_keys text[]:='{}'; locked_key text; system_defaults jsonb; user_json jsonb; effective jsonb; n_pref jsonb:='{}'::jsonb; n_cat jsonb:='[]'::jsonb; devices jsonb:='[]'::jsonb; integrations jsonb:='[]'::jsonb; recent_security jsonb:='[]'::jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into m from public.organization_members where organization_id=p_org and user_id=auth.uid() and status='active' and (access_expires_at is null or access_expires_at>now());
 if not found then raise exception 'ORG_PERMISSION_DENIED'; end if;
 select * into u from public.portal_user_preferences where user_id=auth.uid() and organization_id=p_org;
 if not found then insert into public.portal_user_preferences(user_id,organization_id,preferred_language) values(auth.uid(),p_org,coalesce((select preferred_language from public.customer_profiles where id=auth.uid()),'ar')) returning * into u; end if;
 select * into o from public.organization_portal_settings where organization_id=p_org;
 if not found then insert into public.organization_portal_settings(organization_id) values(p_org) returning * into o; end if;
 select coalesce(r.display_defaults,'{}'::jsonb),coalesce(r.locked_display_keys,'{}'::text[]) into role_defaults,role_locks from public.organization_role_portal_settings r where r.organization_id=p_org and r.role_key=m.member_role;
 system_defaults:=private.portal_display_defaults(); user_json:=private.portal_display_json(u);
 locked_keys:=coalesce(o.locked_display_keys,'{}'::text[])||coalesce(role_locks,'{}'::text[]);
 foreach locked_key in array locked_keys loop user_json:=user_json-locked_key; end loop;
 effective:=system_defaults||coalesce(o.display_defaults,'{}'::jsonb)||coalesce(role_defaults,'{}'::jsonb)||user_json;
 if to_regclass('public.notification_preferences') is not null then
   execute 'select coalesce(to_jsonb(n),''{}''::jsonb) from public.notification_preferences n where user_id=$1 and organization_id=$2' into n_pref using auth.uid(),p_org;
   execute 'select coalesce(jsonb_agg(to_jsonb(c) order by c.category),''[]''::jsonb) from public.notification_category_preferences c where user_id=$1 and organization_id=$2' into n_cat using auth.uid(),p_org;
 end if;
 if to_regclass('public.user_devices') is not null then execute 'select coalesce(jsonb_agg((to_jsonb(d)-''push_subscription'')||jsonb_build_object(''push_enabled'',d.push_subscription is not null) order by d.last_seen_at desc),''[]''::jsonb) from public.user_devices d where user_id=$1 and (organization_id=$2 or organization_id is null)' into devices using auth.uid(),p_org; end if;
 select coalesce(jsonb_agg(to_jsonb(i) order by i.integration_key),'[]'::jsonb) into integrations from public.organization_integrations i where i.organization_id=p_org;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into recent_security from (select jsonb_build_object('action',a.action,'created_at',a.created_at,'details',a.details) x from public.audit_logs a where a.actor_id=auth.uid() and a.action in ('portal_preferences_saved','organization_settings_saved','verified_profile_change_requested','organization_public_profile_updated') order by a.created_at desc limit 12) s;
 return jsonb_build_object(
  'system_policy',system_defaults,'user_preferences',user_json,'organization_settings',to_jsonb(o),'role_defaults',role_defaults,
  'locked_display_keys',(select coalesce(jsonb_agg(distinct x),'[]'::jsonb) from unnest(locked_keys) as u(x)),
  'effective_display',effective,'notification_preferences',coalesce(n_pref,'{}'::jsonb),'notification_categories',coalesce(n_cat,'[]'::jsonb),
  'devices',devices,'integrations',integrations,'recent_security',recent_security,'can_manage_settings',private.b2b_has_permission(p_org,'manage_settings',null)
 );
end; $$;
revoke all on function private.get_my_portal_settings_v1_impl(uuid) from public,anon;
grant execute on function private.get_my_portal_settings_v1_impl(uuid) to authenticated;
create or replace function public.get_my_portal_settings_v1(p_organization_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.get_my_portal_settings_v1_impl(p_organization_id);$$;
revoke all on function public.get_my_portal_settings_v1(uuid) from public,anon;
grant execute on function public.get_my_portal_settings_v1(uuid) to authenticated;

-- Keep notification preference timezone aligned with the Portal timezone when Page 11 exists.
create or replace function private.sync_portal_notification_timezone_v1()
returns trigger language plpgsql security definer set search_path='' as $$begin
 if to_regclass('public.notification_preferences') is not null then
   execute 'update public.notification_preferences set timezone=$1,updated_at=now() where user_id=$2 and organization_id=$3' using new.timezone,new.user_id,new.organization_id;
 end if; return new;
end; $$;
drop trigger if exists portal_user_preferences_sync_notification_tz on public.portal_user_preferences;
create trigger portal_user_preferences_sync_notification_tz after insert or update of timezone on public.portal_user_preferences for each row execute function private.sync_portal_notification_timezone_v1();

-- Admin review surface for verified organization changes.
grant select,update on public.organization_change_requests to authenticated;
drop policy if exists organization_change_requests_admin_update on public.organization_change_requests;
create policy organization_change_requests_admin_update on public.organization_change_requests for update to authenticated
using(private.is_balqees_admin()) with check(private.is_balqees_admin());

select pg_notify('pgrst','reload schema');

-- Administrative review workflow for verified organization data.
grant insert,update,delete on public.organization_integrations to authenticated;
drop policy if exists organization_integrations_admin_write on public.organization_integrations;
create policy organization_integrations_admin_write on public.organization_integrations for all to authenticated
using(private.is_balqees_admin()) with check(private.is_balqees_admin());

create or replace function private.review_organization_change_request_v1_impl(p_request uuid,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.organization_change_requests%rowtype; c jsonb; o public.organizations%rowtype;
begin
 if not private.is_balqees_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'INVALID_DECISION'; end if;
 select * into r from public.organization_change_requests where id=p_request for update;
 if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
 if r.status not in ('pending','in_review') then raise exception 'REQUEST_ALREADY_DECIDED'; end if;
 c:=r.requested_changes;
 if p_decision='approved' then
   update public.organizations set
    legal_name=coalesce(nullif(trim(c->>'legal_name'),''),legal_name),
    commercial_number=coalesce(nullif(trim(c->>'commercial_number'),''),commercial_number),
    vat_number=coalesce(nullif(trim(c->>'vat_number'),''),vat_number),
    entity_type=coalesce(nullif(trim(c->>'entity_type'),''),entity_type),updated_at=now()
   where id=r.organization_id returning * into o;
 end if;
 update public.organization_change_requests set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),admin_note=nullif(trim(p_note),''),updated_at=now() where id=p_request returning * into r;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'organization_change_request_'||p_decision,'organization_change_request',p_request::text,jsonb_build_object('organization_id',r.organization_id,'review_note',p_note));
 return to_jsonb(r);
end; $$;
revoke all on function private.review_organization_change_request_v1_impl(uuid,text,text) from public,anon;
grant execute on function private.review_organization_change_request_v1_impl(uuid,text,text) to authenticated;
create or replace function public.review_organization_change_request_v1(p_request_id uuid,p_decision text,p_note text default null)
returns jsonb language sql security invoker set search_path='' as $$select private.review_organization_change_request_v1_impl(p_request_id,p_decision,p_note);$$;
revoke all on function public.review_organization_change_request_v1(uuid,text,text) from public,anon;
grant execute on function public.review_organization_change_request_v1(uuid,text,text) to authenticated;

select pg_notify('pgrst','reload schema');
