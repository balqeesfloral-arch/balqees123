-- Balqees Floral v10.43 — B2B portal post-migration preflight
-- READ-ONLY validation. Run after the B2B migrations; it raises if a required
-- portal object or private Storage bucket is missing.

do $$
declare
  v_missing text[] := array[]::text[];
  v_name text;
begin
  foreach v_name in array array[
    'public.organizations',
    'public.organization_members',
    'public.organization_service_requests',
    'public.quotations',
    'public.contracts',
    'public.organization_sites',
    'public.client_documents',
    'public.organization_document_user_state',
    'public.organization_custom_roles',
    'public.organization_member_site_access',
    'public.care_settings',
    'public.care_tool_audit',
    'public.notification_events',
    'public.notification_deliveries',
    'public.notification_preferences',
    'public.user_devices',
    'public.organization_portal_settings',
    'public.organization_role_portal_settings',
    'public.portal_user_preferences'
  ] loop
    if to_regclass(v_name) is null then v_missing := array_append(v_missing,v_name); end if;
  end loop;

  if array_length(v_missing,1) is not null then
    raise exception 'BALQEES_B2B_PREFLIGHT_MISSING_TABLES: %', array_to_string(v_missing,', ');
  end if;

  if to_regprocedure('public.get_organization_document_center(uuid)') is null then
    raise exception 'BALQEES_B2B_PREFLIGHT_MISSING_RPC: public.get_organization_document_center(uuid)';
  end if;
  if to_regprocedure('public.get_my_organization_access_v2(uuid)') is null then
    raise exception 'BALQEES_B2B_PREFLIGHT_MISSING_RPC: public.get_my_organization_access_v2(uuid)';
  end if;

  if exists(
    select 1 from (values
      ('organization-request-files'),
      ('organization-site-files'),
      ('client-documents'),
      ('organization-assets')
    ) as required(id)
    where not exists(select 1 from storage.buckets b where b.id=required.id)
  ) then
    raise exception 'BALQEES_B2B_PREFLIGHT_MISSING_STORAGE_BUCKET';
  end if;
end $$;

select 'BALQEES_B2B_PREFLIGHT_OK' as result;
