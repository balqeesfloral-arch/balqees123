create table if not exists public.organization_service_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique default ('BLQ-REQ-' || to_char(now(),'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  site_id uuid null references public.organization_sites(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','submitted','under_review','needs_info','converted','cancelled')),
  service_type text null check (service_type is null or service_type in ('supply','vases','space_design','maintenance','recurring','custom')),
  service_area text null,
  service_area_custom text null,
  description text null,
  budget_mode text not null default 'unspecified' check (budget_mode in ('unspecified','range','exact')),
  budget_range text null,
  budget_amount numeric(14,2) null check (budget_amount is null or budget_amount >= 0),
  timing_mode text not null default 'nearest' check (timing_mode in ('nearest','this_week','exact')),
  requested_date date null,
  preferred_time text null,
  access_details jsonb not null default '{}'::jsonb,
  service_details jsonb not null default '{}'::jsonb,
  procurement_details jsonb not null default '{}'::jsonb,
  submission_goal text not null default 'review' check (submission_goal in ('review','quotation','proposal')),
  priority text not null default 'normal' check (priority in ('normal','priority_review')),
  priority_reason text null,
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  cart_snapshot jsonb not null default '[]'::jsonb,
  submitted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_service_requests_org_status_idx
  on public.organization_service_requests(organization_id,status,updated_at desc);
create index if not exists organization_service_requests_site_idx
  on public.organization_service_requests(site_id,updated_at desc) where site_id is not null;
create index if not exists organization_service_requests_creator_idx
  on public.organization_service_requests(created_by,updated_at desc);

create table if not exists public.organization_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.organization_service_requests(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null,
  mime_type text null,
  size_bytes bigint null check (size_bytes is null or size_bytes >= 0),
  label text null,
  created_at timestamptz not null default now()
);

create index if not exists organization_request_attachments_request_idx
  on public.organization_request_attachments(request_id,created_at);
create index if not exists organization_request_attachments_org_idx
  on public.organization_request_attachments(organization_id,created_at desc);

alter table public.organizations
  add column if not exists procurement_settings jsonb not null default '{"po_mode":"optional","cost_center_enabled":true,"department_enabled":true,"internal_reference_enabled":true}'::jsonb;

alter table public.organization_service_requests enable row level security;
alter table public.organization_request_attachments enable row level security;

revoke all on table public.organization_service_requests from anon;
revoke all on table public.organization_request_attachments from anon;
revoke all on table public.organization_service_requests from authenticated;
revoke all on table public.organization_request_attachments from authenticated;
grant select,insert,update,delete on table public.organization_service_requests to authenticated;
grant select,insert,delete on table public.organization_request_attachments to authenticated;

-- Recreate named policies idempotently.
drop policy if exists organization_service_requests_read on public.organization_service_requests;
create policy organization_service_requests_read
on public.organization_service_requests for select to authenticated
using (private.is_org_member(organization_id));

drop policy if exists organization_service_requests_insert on public.organization_service_requests;
create policy organization_service_requests_insert
on public.organization_service_requests for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.org_permission(organization_id,'place_orders')
  and status = 'draft'
);

drop policy if exists organization_service_requests_update on public.organization_service_requests;
create policy organization_service_requests_update
on public.organization_service_requests for update to authenticated
using (
  (created_by = (select auth.uid()) and status = 'draft' and private.org_permission(organization_id,'place_orders'))
  or private.is_balqees_admin()
)
with check (
  (created_by = (select auth.uid()) and private.org_permission(organization_id,'place_orders'))
  or private.is_balqees_admin()
);

drop policy if exists organization_service_requests_delete on public.organization_service_requests;
create policy organization_service_requests_delete
on public.organization_service_requests for delete to authenticated
using (
  (created_by = (select auth.uid()) and status = 'draft' and private.org_permission(organization_id,'place_orders'))
  or private.is_balqees_admin()
);

drop policy if exists organization_request_attachments_read on public.organization_request_attachments;
create policy organization_request_attachments_read
on public.organization_request_attachments for select to authenticated
using (private.is_org_member(organization_id));

drop policy if exists organization_request_attachments_insert on public.organization_request_attachments;
create policy organization_request_attachments_insert
on public.organization_request_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and private.org_permission(organization_id,'place_orders')
  and exists (
    select 1 from public.organization_service_requests r
    where r.id=request_id and r.organization_id=organization_id and r.created_by=(select auth.uid()) and r.status='draft'
  )
);

drop policy if exists organization_request_attachments_delete on public.organization_request_attachments;
create policy organization_request_attachments_delete
on public.organization_request_attachments for delete to authenticated
using (
  private.is_balqees_admin()
  or (
    uploaded_by=(select auth.uid())
    and exists (
      select 1 from public.organization_service_requests r
      where r.id=request_id and r.status='draft' and r.created_by=(select auth.uid())
    )
  )
);

create or replace function private.guard_organization_service_request_update()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.organization_id is distinct from old.organization_id then raise exception 'REQUEST_ORGANIZATION_IMMUTABLE'; end if;
  if new.created_by is distinct from old.created_by then raise exception 'REQUEST_CREATOR_IMMUTABLE'; end if;
  if old.status <> 'draft' and not private.is_balqees_admin() then raise exception 'REQUEST_LOCKED'; end if;
  return new;
end;
$$;

revoke all on function private.guard_organization_service_request_update() from public,anon,authenticated;

drop trigger if exists organization_service_requests_guard_update on public.organization_service_requests;
create trigger organization_service_requests_guard_update
before update on public.organization_service_requests
for each row execute function private.guard_organization_service_request_update();

drop trigger if exists organization_service_requests_touch_updated_at on public.organization_service_requests;
create trigger organization_service_requests_touch_updated_at
before update on public.organization_service_requests
for each row execute function private.touch_generic_updated_at();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'organization-request-files',
  'organization-request-files',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
on conflict (id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

-- Private request file access: path = organization_id/request_id/random-file.
drop policy if exists organization_request_files_select on storage.objects;
create policy organization_request_files_select
on storage.objects for select to authenticated
using (
  bucket_id='organization-request-files'
  and array_length(storage.foldername(name),1) >= 2
  and private.is_org_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists organization_request_files_insert on storage.objects;
create policy organization_request_files_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='organization-request-files'
  and array_length(storage.foldername(name),1) >= 2
  and private.org_permission((storage.foldername(name))[1]::uuid,'place_orders')
  and exists (
    select 1 from public.organization_service_requests r
    where r.id=((storage.foldername(name))[2])::uuid
      and r.organization_id=((storage.foldername(name))[1])::uuid
      and r.created_by=(select auth.uid())
      and r.status='draft'
  )
);

drop policy if exists organization_request_files_delete on storage.objects;
create policy organization_request_files_delete
on storage.objects for delete to authenticated
using (
  bucket_id='organization-request-files'
  and array_length(storage.foldername(name),1) >= 2
  and exists (
    select 1 from public.organization_service_requests r
    where r.id=((storage.foldername(name))[2])::uuid
      and r.organization_id=((storage.foldername(name))[1])::uuid
      and r.created_by=(select auth.uid())
      and r.status='draft'
      and private.org_permission(r.organization_id,'place_orders')
  )
);

-- A submitted request creates a customer notification once.
create or replace function private.notify_organization_request_submitted()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.status='submitted' and old.status='draft' then
    insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,user_id,status,published_at)
    values(
      'تم استلام طلب المنشأة',
      'Organization request received',
      'استلمنا طلبكم '||new.request_code||' وسنراجعه من فريق بلقيس.',
      'We received request '||new.request_code||' and the Balqees team will review it.',
      'success','user',new.created_by,'published',now()
    );
  end if;
  return new;
end;
$$;

revoke all on function private.notify_organization_request_submitted() from public,anon,authenticated;

drop trigger if exists organization_request_submitted_notification on public.organization_service_requests;
create trigger organization_request_submitted_notification
after update of status on public.organization_service_requests
for each row when (old.status is distinct from new.status)
execute function private.notify_organization_request_submitted();

-- Realtime for cross-tab / future admin workflow.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='organization_service_requests'
  ) then
    alter publication supabase_realtime add table public.organization_service_requests;
  end if;
end $$;


-- v10.32 follow-up: site must belong to the same organization.
create or replace function private.validate_organization_service_request_site()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.site_id is not null and not exists (
    select 1 from public.organization_sites s
    where s.id=new.site_id and s.organization_id=new.organization_id and s.is_active
  ) then
    raise exception 'REQUEST_SITE_INVALID';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_organization_service_request_site() from public,anon,authenticated;
drop trigger if exists organization_service_requests_validate_site on public.organization_service_requests;
create trigger organization_service_requests_validate_site
before insert or update of site_id,organization_id on public.organization_service_requests
for each row execute function private.validate_organization_service_request_site();

create index if not exists organization_request_attachments_uploaded_by_idx
  on public.organization_request_attachments(uploaded_by);

alter table public.organization_service_requests add column if not exists service_details jsonb not null default '{}'::jsonb;

-- v10.32 final alignment: hardened attachment delete + full request workflow notifications.
drop policy if exists organization_request_attachments_delete on public.organization_request_attachments;
create policy organization_request_attachments_delete
on public.organization_request_attachments for delete to authenticated
using (
  private.is_balqees_admin()
  or (
    uploaded_by=(select auth.uid())
    and private.org_permission(organization_id,'place_orders')
    and exists (
      select 1 from public.organization_service_requests r
      where r.id=request_id
        and r.organization_id=organization_id
        and r.status='draft'
        and r.created_by=(select auth.uid())
    )
  )
);

drop trigger if exists organization_request_submitted_notification on public.organization_service_requests;
drop trigger if exists organization_request_status_notification on public.organization_service_requests;

create or replace function private.notify_organization_request_status()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_title_ar text;
  v_title_en text;
  v_body_ar text;
  v_body_en text;
  v_type text := 'info';
  v_priority text := 'normal';
begin
  if old.status is not distinct from new.status then return new; end if;

  case new.status
    when 'submitted' then
      v_title_ar := 'تم استلام طلب المنشأة';
      v_title_en := 'Organization request received';
      v_body_ar := 'استلمنا طلبكم '||new.request_code||' وسنراجعه من فريق بلقيس.';
      v_body_en := 'We received request '||new.request_code||' and the Balqees team will review it.';
      v_type := 'success';
    when 'under_review' then
      v_title_ar := 'بدأت مراجعة طلبكم';
      v_title_en := 'Your request is under review';
      v_body_ar := 'بدأ فريق بلقيس مراجعة الطلب '||new.request_code||'.';
      v_body_en := 'The Balqees team has started reviewing request '||new.request_code||'.';
    when 'needs_info' then
      v_title_ar := 'طلبكم يحتاج معلومات إضافية';
      v_title_en := 'Your request needs more information';
      v_body_ar := 'يحتاج فريق بلقيس معلومات إضافية لإكمال مراجعة '||new.request_code||'.';
      v_body_en := 'The Balqees team needs more information to continue reviewing '||new.request_code||'.';
      v_type := 'warning';
      v_priority := 'high';
    when 'converted' then
      v_title_ar := 'تم تحويل طلبكم للمرحلة التالية';
      v_title_en := 'Your request moved to the next stage';
      v_body_ar := 'تمت معالجة الطلب '||new.request_code||' وتحويله للمرحلة التالية.';
      v_body_en := 'Request '||new.request_code||' has been processed and moved to the next stage.';
      v_type := 'success';
    when 'cancelled' then
      v_title_ar := 'تم إغلاق طلب المنشأة';
      v_title_en := 'Organization request closed';
      v_body_ar := 'تم إغلاق الطلب '||new.request_code||'. يمكنك فتح مركز العناية إذا احتجت متابعة.';
      v_body_en := 'Request '||new.request_code||' has been closed. Open Care if you need follow-up.';
      v_type := 'warning';
    else
      return new;
  end case;

  insert into public.notifications(
    title_ar,title_en,body_ar,body_en,type,audience,user_id,organization_id,
    status,published_at,category,priority,action_url,action_label_ar,action_label_en,metadata
  ) values (
    v_title_ar,v_title_en,v_body_ar,v_body_en,v_type,'user',new.created_by,new.organization_id,
    'published',now(),'orders',v_priority,'/portal/request/'||new.id::text,
    'فتح الطلب','Open request',jsonb_build_object('request_id',new.id,'request_code',new.request_code,'status',new.status)
  );

  return new;
end;
$$;
revoke all on function private.notify_organization_request_status() from public,anon,authenticated;

create trigger organization_request_status_notification
after update of status on public.organization_service_requests
for each row when (old.status is distinct from new.status)
execute function private.notify_organization_request_status();


-- v10.32 final submission guard: customers may only move their own draft to Submitted.
-- Internal workflow states remain admin-controlled and required data is validated server-side.
create or replace function private.guard_organization_service_request_update()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_po_mode text;
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'REQUEST_ORGANIZATION_IMMUTABLE';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'REQUEST_CREATOR_IMMUTABLE';
  end if;

  if private.is_balqees_admin() then
    return new;
  end if;

  if old.status <> 'draft' then
    raise exception 'REQUEST_LOCKED';
  end if;

  if new.status not in ('draft','submitted') then
    raise exception 'REQUEST_STATUS_FORBIDDEN';
  end if;

  if new.status='submitted' and old.status='draft' then
    if new.service_type is null then raise exception 'REQUEST_SERVICE_REQUIRED'; end if;
    if new.site_id is null then raise exception 'REQUEST_SITE_REQUIRED'; end if;
    if new.service_area is null or btrim(new.service_area)='' then raise exception 'REQUEST_AREA_REQUIRED'; end if;
    if new.service_area='custom' and btrim(coalesce(new.service_area_custom,''))='' then
      raise exception 'REQUEST_CUSTOM_AREA_REQUIRED';
    end if;
    if char_length(btrim(coalesce(new.description,''))) < 10 then
      raise exception 'REQUEST_DESCRIPTION_REQUIRED';
    end if;
    if new.timing_mode='exact' and new.requested_date is null then
      raise exception 'REQUEST_DATE_REQUIRED';
    end if;

    select coalesce(procurement_settings->>'po_mode','optional')
      into v_po_mode
      from public.organizations
      where id=new.organization_id;

    if v_po_mode='required' and btrim(coalesce(new.procurement_details->>'po_number',''))='' then
      raise exception 'REQUEST_PO_REQUIRED';
    end if;

    new.submitted_at := now();
  end if;

  return new;
end;
$$;
revoke all on function private.guard_organization_service_request_update() from public,anon,authenticated;
