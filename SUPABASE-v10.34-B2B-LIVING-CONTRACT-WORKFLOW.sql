-- Balqees Floral v10.34 — B2B Living Contract workflow delta
-- Live migration applied: b2b_living_contract_workflow_v10_34 (20261001202702)
-- Depends on the two live foundation migrations:
--   b2b_living_contracts_v10_34 (20261001202200)
--   b2b_contract_financial_privacy_v10_34 (20261001202236)
-- This file records the v10.34 workflow delta added after those foundations.

alter table public.quotations
  add column if not exists contract_id uuid references public.contracts(id) on delete set null;

alter table public.contracts
  add column if not exists renewal_note text,
  add column if not exists renewed_contract_id uuid references public.contracts(id) on delete set null,
  add column if not exists next_review_on date;

create index if not exists contracts_renewed_contract_idx
  on public.contracts(renewed_contract_id) where renewed_contract_id is not null;

alter table public.contract_obligations
  add column if not exists site_id uuid references public.organization_sites(id) on delete set null,
  add column if not exists visible_to_client boolean not null default true;

create index if not exists contract_obligations_site_idx
  on public.contract_obligations(site_id) where site_id is not null;

create table if not exists public.contract_contacts (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  side text not null check (side in ('balqees','organization')),
  name text not null,
  role_ar text,
  role_en text,
  email text,
  phone text,
  is_primary boolean not null default false,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists contract_contacts_contract_sort_idx
  on public.contract_contacts(contract_id,sort_order,id);
create index if not exists contract_contacts_org_idx
  on public.contract_contacts(organization_id);

alter table public.contract_contacts enable row level security;
revoke all on public.contract_contacts from anon,authenticated;
grant select,insert,update,delete on public.contract_contacts to authenticated;

create or replace function private.contract_visible_to_member(p_contract uuid,p_org uuid)
returns boolean
language sql stable security definer
set search_path=''
as $$
  select private.is_balqees_admin()
    or exists (
      select 1
      from public.contracts c
      where c.id=p_contract
        and c.organization_id=p_org
        and c.status <> 'draft'
        and c.published_at is not null
        and private.is_org_member(c.organization_id)
    );
$$;
revoke all on function private.contract_visible_to_member(uuid,uuid) from public,anon,authenticated;

drop policy if exists contract_sites_read on public.contract_sites;
create policy contract_sites_read on public.contract_sites for select to authenticated
using (private.contract_visible_to_member(contract_id,organization_id));

drop policy if exists contract_services_read on public.contract_services;
create policy contract_services_read on public.contract_services for select to authenticated
using (private.contract_visible_to_member(contract_id,organization_id));

drop policy if exists contract_obligations_read on public.contract_obligations;
create policy contract_obligations_read on public.contract_obligations for select to authenticated
using (
  private.is_balqees_admin()
  or (
    visible_to_client
    and private.contract_visible_to_member(contract_id,organization_id)
  )
);

drop policy if exists contract_amendments_read on public.contract_amendments;
create policy contract_amendments_read on public.contract_amendments for select to authenticated
using (
  private.is_balqees_admin()
  or (
    status <> 'draft'
    and published_at is not null
    and private.contract_visible_to_member(contract_id,organization_id)
  )
);

drop policy if exists contract_events_read on public.contract_events;
create policy contract_events_read on public.contract_events for select to authenticated
using (private.contract_visible_to_member(contract_id,organization_id));

drop policy if exists contract_contacts_read on public.contract_contacts;
create policy contract_contacts_read on public.contract_contacts for select to authenticated
using (
  private.is_balqees_admin()
  or (
    is_visible
    and private.contract_visible_to_member(contract_id,organization_id)
  )
);

drop policy if exists contract_contacts_admin_write on public.contract_contacts;
create policy contract_contacts_admin_write on public.contract_contacts for all to authenticated
using (private.is_balqees_admin())
with check (private.is_balqees_admin());

drop trigger if exists contract_contacts_validate_org on public.contract_contacts;
create trigger contract_contacts_validate_org
before insert or update on public.contract_contacts
for each row execute function private.validate_contract_child_org();

create or replace function private.validate_contract_reference()
returns trigger
language plpgsql
set search_path=''
as $$
declare v_org uuid;
begin
  if new.contract_id is null then return new; end if;
  select organization_id into v_org from public.contracts where id=new.contract_id;
  if v_org is null then raise exception 'CONTRACT_NOT_FOUND'; end if;
  if new.organization_id is null or new.organization_id is distinct from v_org then
    raise exception 'CONTRACT_ORGANIZATION_MISMATCH';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_contract_reference() from public,anon,authenticated;

drop trigger if exists orders_validate_contract on public.orders;
create trigger orders_validate_contract
before insert or update of contract_id,organization_id on public.orders
for each row execute function private.validate_contract_reference();

drop trigger if exists quotations_validate_contract on public.quotations;
create trigger quotations_validate_contract
before insert or update of contract_id,organization_id on public.quotations
for each row execute function private.validate_contract_reference();

drop trigger if exists client_documents_validate_contract on public.client_documents;
create trigger client_documents_validate_contract
before insert or update of contract_id,organization_id on public.client_documents
for each row execute function private.validate_contract_reference();

drop trigger if exists organization_service_requests_validate_contract on public.organization_service_requests;
create trigger organization_service_requests_validate_contract
before insert or update of contract_id,organization_id on public.organization_service_requests
for each row execute function private.validate_contract_reference();

create index if not exists organization_service_requests_contract_idx
  on public.organization_service_requests(contract_id) where contract_id is not null;
create index if not exists orders_contract_idx
  on public.orders(contract_id) where contract_id is not null;
create index if not exists quotations_contract_idx
  on public.quotations(contract_id) where contract_id is not null;
create index if not exists client_documents_contract_idx
  on public.client_documents(contract_id) where contract_id is not null;

create or replace function private.contract_status_audit()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_actor_type text:='system';
  v_title_ar text;
  v_title_en text;
  v_body_ar text;
  v_body_en text;
  v_type text:='info';
  v_priority text:='normal';
  v_notify boolean:=false;
begin
  if private.is_balqees_admin() then v_actor_type='admin';
  elsif v_actor is not null then v_actor_type='client';
  end if;

  if tg_op='INSERT' then
    insert into public.contract_events(contract_id,organization_id,event_type,title_ar,title_en,body_ar,body_en,actor_type,actor_id)
    values(new.id,new.organization_id,'created','تم إنشاء العقد','Contract created',
      'تم إنشاء سجل العقد '||new.contract_number||'.','Contract record '||new.contract_number||' was created.',
      v_actor_type,v_actor);
    return new;
  end if;

  if old.status is distinct from new.status then
    v_notify := new.status <> 'draft';
    case new.status
      when 'active' then
        v_title_ar:='أصبح العقد ساريًا'; v_title_en:='Contract is active';
        v_body_ar:='العقد '||new.contract_number||' أصبح ساريًا داخل بوابة المنشأة.';
        v_body_en:='Contract '||new.contract_number||' is now active in your organization portal.';
        v_type:='success';
      when 'expiring' then
        v_title_ar:='العقد يقترب من الانتهاء'; v_title_en:='Contract nearing expiry';
        v_body_ar:='العقد '||new.contract_number||' يحتاج مراجعة قبل انتهاء مدته.';
        v_body_en:='Contract '||new.contract_number||' should be reviewed before its end date.';
        v_type:='warning'; v_priority:='high';
      when 'expired' then
        v_title_ar:='انتهت مدة العقد'; v_title_en:='Contract expired';
        v_body_ar:='انتهت مدة العقد '||new.contract_number||'.';
        v_body_en:='Contract '||new.contract_number||' has expired.';
        v_type:='warning';
      when 'terminated' then
        v_title_ar:='تم إنهاء العقد'; v_title_en:='Contract terminated';
        v_body_ar:='تم إنهاء العقد '||new.contract_number||'.';
        v_body_en:='Contract '||new.contract_number||' was terminated.';
        v_type:='warning';
      when 'cancelled' then
        v_title_ar:='تم إلغاء العقد'; v_title_en:='Contract cancelled';
        v_body_ar:='تم إلغاء العقد '||new.contract_number||'.';
        v_body_en:='Contract '||new.contract_number||' was cancelled.';
        v_type:='warning';
      else
        v_title_ar:='تم تحديث حالة العقد'; v_title_en:='Contract status updated';
        v_body_ar:='تم تحديث حالة العقد '||new.contract_number||'.';
        v_body_en:='Contract '||new.contract_number||' status was updated.';
    end case;

    insert into public.contract_events(contract_id,organization_id,event_type,title_ar,title_en,body_ar,body_en,actor_type,actor_id,metadata)
    values(new.id,new.organization_id,'status_'||new.status,v_title_ar,v_title_en,v_body_ar,v_body_en,v_actor_type,v_actor,
      jsonb_build_object('old_status',old.status,'new_status',new.status));

    if v_notify then
      insert into public.notifications(
        title_ar,title_en,body_ar,body_en,type,audience,organization_id,status,published_at,
        category,priority,action_url,action_label_ar,action_label_en,metadata,created_by
      ) values (
        v_title_ar,v_title_en,v_body_ar,v_body_en,v_type,'organization',new.organization_id,'published',now(),
        'contracts',v_priority,'/portal/contracts/'||new.id::text,'فتح العقد','Open contract',
        jsonb_build_object('contract_id',new.id,'status',new.status),
        case when v_actor_type='admin' then v_actor else null end
      );
    end if;
  end if;

  if old.renewal_status is distinct from new.renewal_status then
    v_notify:=false; v_type:='info'; v_priority:='normal';
    case new.renewal_status
      when 'review_requested' then
        v_title_ar:='تم طلب مراجعة التجديد'; v_title_en:='Renewal review requested';
        v_body_ar:='تم تسجيل طلب مراجعة تجديد العقد '||new.contract_number||'.';
        v_body_en:='A renewal review was requested for contract '||new.contract_number||'.';
      when 'in_review' then
        v_title_ar:='بدأت مراجعة تجديد العقد'; v_title_en:='Renewal review started';
        v_body_ar:='بدأ فريق بلقيس مراجعة تجديد العقد '||new.contract_number||'.';
        v_body_en:='Balqees has started reviewing renewal for contract '||new.contract_number||'.';
        v_notify:=true;
      when 'renewed' then
        v_title_ar:='تم تجديد العقد'; v_title_en:='Contract renewed';
        v_body_ar:='اكتملت مراجعة وتجديد العقد '||new.contract_number||'.';
        v_body_en:='Renewal of contract '||new.contract_number||' is complete.';
        v_notify:=true; v_type:='success';
      when 'not_renewing' then
        v_title_ar:='تم إغلاق مسار التجديد'; v_title_en:='Renewal path closed';
        v_body_ar:='تم إغلاق مراجعة تجديد العقد '||new.contract_number||'.';
        v_body_en:='Renewal review for contract '||new.contract_number||' was closed.';
        v_notify:=true; v_type:='warning';
      else
        v_title_ar:='حالة التجديد'; v_title_en:='Renewal status';
        v_body_ar:='تم تحديث حالة تجديد العقد.'; v_body_en:='Contract renewal status was updated.';
    end case;

    insert into public.contract_events(contract_id,organization_id,event_type,title_ar,title_en,body_ar,body_en,actor_type,actor_id,metadata)
    values(new.id,new.organization_id,'renewal_'||new.renewal_status,v_title_ar,v_title_en,v_body_ar,v_body_en,v_actor_type,v_actor,
      jsonb_build_object('old_status',old.renewal_status,'new_status',new.renewal_status));

    if v_notify then
      insert into public.notifications(
        title_ar,title_en,body_ar,body_en,type,audience,organization_id,status,published_at,
        category,priority,action_url,action_label_ar,action_label_en,metadata,created_by
      ) values (
        v_title_ar,v_title_en,v_body_ar,v_body_en,v_type,'organization',new.organization_id,'published',now(),
        'contracts',v_priority,'/portal/contracts/'||new.id::text,'فتح العقد','Open contract',
        jsonb_build_object('contract_id',new.id,'renewal_status',new.renewal_status),
        case when v_actor_type='admin' then v_actor else null end
      );
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.contract_status_audit() from public,anon,authenticated;

drop trigger if exists contract_status_audit on public.contracts;
create trigger contract_status_audit
after insert or update of status,renewal_status on public.contracts
for each row execute function private.contract_status_audit();

create or replace function private.request_contract_renewal_review_impl(p_user uuid,p_contract uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare c public.contracts%rowtype;
begin
  if p_user is null or p_user is distinct from auth.uid() then raise exception 'AUTH_REQUIRED'; end if;
  select * into c from public.contracts where id=p_contract;
  if not found then raise exception 'CONTRACT_NOT_FOUND'; end if;
  if not private.org_permission(c.organization_id,'accept_quotes') then raise exception 'CONTRACT_PERMISSION_DENIED'; end if;
  if c.status not in ('active','expiring') then raise exception 'CONTRACT_NOT_RENEWABLE'; end if;
  if c.renewal_status in ('review_requested','in_review','renewed') then return; end if;

  update public.contracts
  set renewal_status='review_requested',
      renewal_review_requested_at=now(),
      renewal_review_requested_by=p_user,
      updated_at=now()
  where id=p_contract;
end;
$$;
revoke all on function private.request_contract_renewal_review_impl(uuid,uuid) from public,anon,authenticated;

drop trigger if exists contract_obligations_touch on public.contract_obligations;
create trigger contract_obligations_touch
before update on public.contract_obligations
for each row execute function private.touch_contract_obligation();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='contracts') then alter publication supabase_realtime add table public.contracts; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='contract_sites') then alter publication supabase_realtime add table public.contract_sites; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='contract_services') then alter publication supabase_realtime add table public.contract_services; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='contract_obligations') then alter publication supabase_realtime add table public.contract_obligations; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='contract_amendments') then alter publication supabase_realtime add table public.contract_amendments; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='contract_events') then alter publication supabase_realtime add table public.contract_events; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='contract_contacts') then alter publication supabase_realtime add table public.contract_contacts; end if;
end $$;
