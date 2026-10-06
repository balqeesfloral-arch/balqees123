-- Balqees v10.49: scoped accounting delivery and payment-proof inbox.
-- Google Sheets remains the ledger. A proof is never treated as a verified payment.
create table public.accounting_links (
  id uuid primary key default gen_random_uuid(),
  office_client_id text not null unique check (length(office_client_id) between 1 and 100),
  office_client_name text not null check (length(office_client_name) between 1 and 200),
  user_id uuid references auth.users(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (num_nonnulls(user_id,organization_id)=1)
);
create unique index accounting_link_user on public.accounting_links(user_id) where user_id is not null;
create unique index accounting_link_org on public.accounting_links(organization_id) where organization_id is not null;

-- These two private lookups deliberately read current auth state instead of
-- trusting editable user_metadata or a stale admin claim.
create function private.accounting_actor_active() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u where u.id=auth.uid()
      and coalesce(u.raw_app_meta_data->>'status','active') not in ('blocked','suspended')
      and (u.banned_until is null or u.banned_until < now())
      and not exists(select 1 from public.admin_user_state s where s.user_id=u.id and s.status in ('blocked','suspended'))
      and (not exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified') or auth.jwt()->>'aal'='aal2')
  );
$$;
create function private.accounting_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select private.accounting_actor_active()
    and exists(select 1 from auth.users u where u.id=auth.uid() and u.raw_app_meta_data->>'role'='admin')
    and (not exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status='verified')
      or auth.jwt()->>'aal'='aal2');
$$;
create function private.accounting_can_read(p_link uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.accounting_actor_active()
    -- Older B2B helpers recognize an admin JWT. A revoked admin or an admin
    -- with incomplete MFA must never regain access through that fallback.
    and (coalesce(auth.jwt()->'app_metadata'->>'role','')<>'admin' or private.accounting_is_admin())
    and exists (
    select 1 from public.accounting_links l where l.id=p_link and l.is_active
      and (private.accounting_is_admin() or l.user_id=auth.uid() or (
        l.organization_id is not null
        and exists(select 1 from public.organizations o where o.id=l.organization_id and o.status='active')
        and exists(select 1 from public.organization_members m where m.organization_id=l.organization_id and m.user_id=auth.uid()
          and m.status='active' and (m.access_expires_at is null or m.access_expires_at>now())
          and (not m.mfa_required or auth.jwt()->>'aal'='aal2'))
        and private.b2b_has_permission(l.organization_id,'view_financial_documents',null)
        and private.b2b_document_visible(l.organization_id,auth.uid(),null,null,null,null)
      ))
  );
$$;
revoke all on function private.accounting_actor_active(),private.accounting_is_admin(),private.accounting_can_read(uuid) from public,anon;
grant execute on function private.accounting_actor_active(),private.accounting_is_admin(),private.accounting_can_read(uuid) to authenticated,service_role;

create table public.accounting_statements (
  id uuid primary key,
  link_id uuid not null references public.accounting_links(id) on delete restrict,
  statement_number text not null,
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=1500000),
  published_by text not null,
  created_at timestamptz not null default now()
);
create index accounting_statement_link_date on public.accounting_statements(link_id,created_at desc);
create table public.accounting_documents (
  id uuid primary key,
  link_id uuid not null references public.accounting_links(id) on delete restrict,
  title text not null check(length(title) between 1 and 200),
  document_type text not null check(document_type in ('invoice','receipt','statement','credit_note','debit_note','other')),
  file_path text not null unique,
  file_name text not null,
  published_by text not null,
  created_at timestamptz not null default now()
);
create index accounting_document_link_date on public.accounting_documents(link_id,created_at desc);
create table public.accounting_payments (
  id uuid primary key,
  link_id uuid not null references public.accounting_links(id) on delete restrict,
  submitted_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  amount numeric not null check(amount>0 and amount<=1000000000 and amount=round(amount,2)),
  payment_date date not null,
  payment_method text not null default 'bank_transfer' check(payment_method in ('bank_transfer','card','cash')),
  bank_reference text not null check(length(bank_reference) between 1 and 120),
  note text not null default '' check(length(note)<=1200),
  proof_path text not null unique,
  status text not null default 'pending' check(status in ('pending','importing','needs_review','recorded','rejected')),
  office_transfer_id text unique,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status='recorded')=(office_transfer_id is not null))
);
create index accounting_payment_link_date on public.accounting_payments(link_id,created_at desc);
create index accounting_payment_status_date on public.accounting_payments(status,created_at);
create index accounting_payment_submitter on public.accounting_payments(submitted_by);
create table private.accounting_imports (
  payment_id uuid primary key references public.accounting_payments(id) on delete restrict,
  token uuid not null default gen_random_uuid(),
  append_started boolean not null default false,
  started_at timestamptz not null default now()
);
alter table private.accounting_imports enable row level security;
revoke all on private.accounting_imports from public,anon,authenticated;
grant all on private.accounting_imports to service_role;
grant usage on schema private to service_role;

create table public.accounting_events (
  id bigint generated always as identity primary key,
  entity_id uuid not null,
  event text not null,
  actor text not null,
  created_at timestamptz not null default now()
);
create index accounting_events_entity_date on public.accounting_events(entity_id,created_at desc);
alter table public.accounting_links enable row level security;
alter table public.accounting_statements enable row level security;
alter table public.accounting_documents enable row level security;
alter table public.accounting_payments enable row level security;
alter table public.accounting_events enable row level security;
revoke all on public.accounting_links,public.accounting_statements,public.accounting_documents,public.accounting_payments,public.accounting_events from public,anon,authenticated;
grant select on public.accounting_links,public.accounting_statements,public.accounting_documents,public.accounting_payments,public.accounting_events to authenticated;
grant insert (id,link_id,amount,payment_date,payment_method,bank_reference,note,proof_path) on public.accounting_payments to authenticated;
grant all on public.accounting_links,public.accounting_statements,public.accounting_documents,public.accounting_payments,public.accounting_events to service_role;
grant usage,select on sequence public.accounting_events_id_seq to service_role;
create policy accounting_links_read on public.accounting_links for select to authenticated using(private.accounting_is_admin() or private.accounting_can_read(id));
create policy accounting_statements_read on public.accounting_statements for select to authenticated using(private.accounting_is_admin() or private.accounting_can_read(link_id));
create policy accounting_documents_read on public.accounting_documents for select to authenticated using(private.accounting_is_admin() or private.accounting_can_read(link_id));
create policy accounting_payments_read on public.accounting_payments for select to authenticated using(private.accounting_is_admin() or private.accounting_can_read(link_id));
create policy accounting_payments_submit on public.accounting_payments for insert to authenticated
  with check(private.accounting_can_read(link_id) and submitted_by=auth.uid() and status='pending' and office_transfer_id is null);
create policy accounting_events_admin on public.accounting_events for select to authenticated using(private.accounting_is_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('accounting-proofs','accounting-proofs',false,10485760,array['application/pdf','image/png','image/jpeg','image/webp']),
 ('accounting-documents','accounting-documents',false,10485760,array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
create policy accounting_proof_upload on storage.objects for insert to authenticated with check(
 bucket_id='accounting-proofs' and private.accounting_actor_active() and (storage.foldername(name))[1]=auth.uid()::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|png|jpg|webp)$'
);
create policy accounting_proof_read on storage.objects for select to authenticated using(
 bucket_id='accounting-proofs' and (private.accounting_is_admin() or (
 private.accounting_actor_active() and (storage.foldername(name))[1]=auth.uid()::text
 ) or exists(select 1 from public.accounting_payments p where p.proof_path=name and private.accounting_can_read(p.link_id)))
);
-- No browser DELETE/UPDATE grant: evidence remains immutable even after the
-- submitter loses access to the organization or its accounting link.
create policy accounting_document_read on storage.objects for select to authenticated using(
 bucket_id='accounting-documents' and (private.accounting_is_admin() or exists(
 select 1 from public.accounting_documents d where d.file_path=name and private.accounting_can_read(d.link_id)))
);

create function public.accounting_admin_access() returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not private.accounting_is_admin() then raise exception 'ACCOUNTING_ADMIN_REQUIRED'; end if;
 return jsonb_build_object('user_id',auth.uid());
end;
$$;

create function private.accounting_validate_payment() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not private.accounting_can_read(new.link_id) then raise exception 'ACCOUNTING_ACCESS_DENIED'; end if;
 if new.payment_date < date '2000-01-01' or new.payment_date > (now() at time zone 'Asia/Riyadh')::date then raise exception 'PAYMENT_DATE_INVALID'; end if;
 if new.proof_path !~ ('^'||auth.uid()::text||'/'||new.id::text||'\.(pdf|png|jpg|webp)$') then raise exception 'PAYMENT_PROOF_INVALID'; end if;
 if not exists(select 1 from storage.objects s where s.bucket_id='accounting-proofs' and s.name=new.proof_path and s.owner_id=auth.uid()::text) then raise exception 'PAYMENT_PROOF_MISSING'; end if;
 return new;
end;
$$;
revoke all on function private.accounting_validate_payment() from public,anon,authenticated;
create trigger accounting_validate_payment before insert on public.accounting_payments for each row execute function private.accounting_validate_payment();

create function public.accounting_submit_payment(p_id uuid,p_link_id uuid,p_amount numeric,p_payment_date date,p_payment_method text,p_reference text,p_note text,p_proof_path text)
returns public.accounting_payments language plpgsql security invoker set search_path='' as $$
declare r public.accounting_payments;
begin
 if not private.accounting_can_read(p_link_id) then raise exception 'ACCOUNTING_ACCESS_DENIED'; end if;
 select * into r from public.accounting_payments where id=p_id;
 if found then
   if r.submitted_by<>auth.uid() or r.link_id<>p_link_id or r.amount<>p_amount or r.proof_path<>p_proof_path
      or r.payment_date<>p_payment_date or r.payment_method<>p_payment_method or r.bank_reference<>btrim(p_reference) or r.note<>btrim(coalesce(p_note,'')) then raise exception 'PAYMENT_REQUEST_REUSED'; end if;
   return r;
 end if;
 insert into public.accounting_payments(id,link_id,amount,payment_date,payment_method,bank_reference,note,proof_path)
 values(p_id,p_link_id,p_amount,p_payment_date,p_payment_method,btrim(p_reference),btrim(coalesce(p_note,'')),p_proof_path)
 on conflict(id) do nothing;
 select * into r from public.accounting_payments where id=p_id;
 if r.id is null or r.submitted_by<>auth.uid() or r.link_id<>p_link_id or r.amount<>p_amount or r.proof_path<>p_proof_path
    or r.payment_date<>p_payment_date or r.payment_method<>p_payment_method or r.bank_reference<>btrim(p_reference) or r.note<>btrim(coalesce(p_note,'')) then raise exception 'PAYMENT_REQUEST_REUSED'; end if;
 return r;
end;
$$;

-- Office RPCs are invoker-only, service_role-only. No browser can create a
-- client mapping, publish an accounting snapshot or certify a payment.
create function public.accounting_bind_client(p_office_id text,p_name text,p_user uuid,p_org uuid,p_actor text)
returns public.accounting_links language plpgsql security invoker set search_path='' as $$
declare r public.accounting_links;
begin
 if num_nonnulls(p_user,p_org)<>1 then raise exception 'ACCOUNTING_TARGET_REQUIRED'; end if;
 select * into r from public.accounting_links where office_client_id=p_office_id for update;
 if found then
   if r.user_id is distinct from p_user or r.organization_id is distinct from p_org then raise exception 'ACCOUNTING_MAPPING_IMMUTABLE'; end if;
   return r;
 end if;
 insert into public.accounting_links(office_client_id,office_client_name,user_id,organization_id)
 values(p_office_id,p_name,p_user,p_org) returning * into r;
 insert into public.accounting_events(entity_id,event,actor) values(r.id,'client_linked',left(p_actor,200));
 return r;
end;
$$;
create function public.accounting_publish_statement(p_id uuid,p_link uuid,p_payload jsonb,p_actor text)
returns public.accounting_statements language plpgsql security invoker set search_path='' as $$
declare l public.accounting_links; r public.accounting_statements;
begin
 select * into l from public.accounting_links where id=p_link and is_active;
 if l.id is null or p_payload->'client'->>'id' is distinct from l.office_client_id or p_payload->>'type' is distinct from 'client_statement'
   or jsonb_typeof(p_payload->'rows') is distinct from 'array' or jsonb_typeof(p_payload->'summary') is distinct from 'object'
   or coalesce(length(p_payload->>'statementNo'),0) not between 1 and 120 then raise exception 'ACCOUNTING_STATEMENT_INVALID'; end if;
 select * into r from public.accounting_statements where id=p_id;
 if found then
   if r.link_id<>p_link then raise exception 'ACCOUNTING_REQUEST_REUSED'; end if;
   return r;
 end if;
 insert into public.accounting_statements(id,link_id,statement_number,payload,published_by)
 values(p_id,p_link,p_payload->>'statementNo',p_payload,left(p_actor,200)) returning * into r;
 insert into public.accounting_events(entity_id,event,actor) values(r.id,'statement_published',left(p_actor,200));
 return r;
end;
$$;
create function public.accounting_publish_document(p_id uuid,p_link uuid,p_title text,p_type text,p_path text,p_name text,p_actor text)
returns public.accounting_documents language plpgsql security invoker set search_path='' as $$
declare r public.accounting_documents;
begin
 if not exists(select 1 from public.accounting_links where id=p_link and is_active)
    or split_part(p_path,'/',1)<>p_link::text or not exists(select 1 from storage.objects where bucket_id='accounting-documents' and name=p_path) then raise exception 'ACCOUNTING_DOCUMENT_INVALID'; end if;
 select * into r from public.accounting_documents where id=p_id;
 if found then
   if r.link_id<>p_link or r.file_path<>p_path then raise exception 'ACCOUNTING_REQUEST_REUSED'; end if;
   return r;
 end if;
 insert into public.accounting_documents(id,link_id,title,document_type,file_path,file_name,published_by)
 values(p_id,p_link,btrim(p_title),p_type,p_path,left(p_name,200),left(p_actor,200)) returning * into r;
 insert into public.accounting_events(entity_id,event,actor) values(r.id,'document_published',left(p_actor,200));
 return r;
end;
$$;

create function public.accounting_claim_payment(p_id uuid,p_actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.accounting_payments; i private.accounting_imports; l public.accounting_links;
begin
 select * into p from public.accounting_payments where id=p_id for update;
 if p.id is null then raise exception 'PAYMENT_NOT_FOUND'; end if;
 select * into l from public.accounting_links where id=p.link_id and is_active;
 if l.id is null then raise exception 'ACCOUNTING_LINK_INACTIVE'; end if;
 if p.status='rejected' then raise exception 'PAYMENT_REJECTED'; end if;
 select * into i from private.accounting_imports where payment_id=p_id;
 if p.status='recorded' then return jsonb_build_object('payment',to_jsonb(p),'link',to_jsonb(l),'can_append',false); end if;
 if i.payment_id is not null and (i.append_started or i.started_at>now()-interval '2 minutes') then
   return jsonb_build_object('payment',to_jsonb(p),'link',to_jsonb(l),'token',i.token,'can_append',false);
 end if;
 insert into private.accounting_imports(payment_id) values(p_id)
 on conflict(payment_id) do update set token=gen_random_uuid(),started_at=now(),append_started=false returning * into i;
 update public.accounting_payments set status='importing',updated_at=now(),review_note='' where id=p_id returning * into p;
 insert into public.accounting_events(entity_id,event,actor) values(p_id,'payment_import_claimed',left(p_actor,200));
 return jsonb_build_object('payment',to_jsonb(p),'link',to_jsonb(l),'token',i.token,'can_append',true);
end;
$$;
create function public.accounting_mark_append(p_id uuid,p_token uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.accounting_payments where id=p_id and status='importing' for update;
 if not found then raise exception 'PAYMENT_IMPORT_CHANGED'; end if;
 update private.accounting_imports set append_started=true where payment_id=p_id and token=p_token and not append_started;
 if not found then raise exception 'PAYMENT_APPEND_ALREADY_STARTED'; end if;
 return true;
end;
$$;
create function public.accounting_finish_payment(p_id uuid,p_token uuid,p_recorded boolean,p_note text,p_actor text)
returns public.accounting_payments language plpgsql security invoker set search_path='' as $$
declare p public.accounting_payments; i private.accounting_imports;
begin
 select * into p from public.accounting_payments where id=p_id for update;
 if p.id is null then raise exception 'PAYMENT_NOT_FOUND'; end if;
 if p.status='recorded' then return p; end if;
 select * into i from private.accounting_imports where payment_id=p_id;
 if i.token is distinct from p_token or i.payment_id is null then raise exception 'PAYMENT_IMPORT_CHANGED'; end if;
 if p_recorded and not i.append_started then raise exception 'PAYMENT_NOT_APPENDED'; end if;
 update public.accounting_payments set status=case when p_recorded then 'recorded' when i.append_started then 'needs_review' else 'pending' end,
 office_transfer_id=case when p_recorded then 'WEB-'||p_id::text else null end,
 review_note=left(coalesce(p_note,''),500),updated_at=now() where id=p_id returning * into p;
 if not p_recorded and not i.append_started then delete from private.accounting_imports where payment_id=p_id; end if;
 insert into public.accounting_events(entity_id,event,actor) values(p_id,'payment_'||p.status,left(p_actor,200));
 return p;
end;
$$;
create function public.accounting_reject_payment(p_id uuid,p_reason text,p_actor text)
returns public.accounting_payments language plpgsql security invoker set search_path='' as $$
declare p public.accounting_payments;
begin
 if length(btrim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'PAYMENT_REASON_REQUIRED'; end if;
 update public.accounting_payments set status='rejected',review_note=btrim(p_reason),updated_at=now() where id=p_id and status='pending' returning * into p;
 if p.id is null then raise exception 'PAYMENT_IMPORT_CHANGED'; end if;
 insert into public.accounting_events(entity_id,event,actor) values(p_id,'payment_rejected',left(p_actor,200));
 return p;
end;
$$;

-- Generic notifications disclose no amount or document contents. Document access
-- continues to require the exact financial scope at read/download time.
create function private.accounting_notify() returns trigger
language plpgsql security definer set search_path='' as $$
declare l public.accounting_links; u uuid; title text; path text;
begin
 if tg_table_name='accounting_payments' and tg_op='INSERT' then
   if auth.uid() is null or new.submitted_by<>auth.uid() then raise exception 'AUTH_REQUIRED'; end if;
   for u in select id from auth.users where raw_app_meta_data->>'role'='admin'
      and coalesce(raw_app_meta_data->>'status','active') not in ('blocked','suspended')
      and not exists(select 1 from public.admin_user_state s where s.user_id=auth.users.id and s.status in ('blocked','suspended'))
   loop
    insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,user_id,status,published_at,action_url,category,dedupe_key)
    values('إيصال سداد للمراجعة','Payment proof awaiting review','ورد إيصال جديد في مركز المحاسبة.','A new payment proof is ready for review.','info','user',u,'published',now(),'/admin/accounting','finance','accounting-proof-'||new.id||'-'||u);
   end loop;
   return new;
 end if;
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'ACCOUNTING_SERVICE_REQUIRED'; end if;
 if tg_table_name='accounting_payments' then
   if new.status not in ('recorded','rejected') or new.status=old.status then return new; end if;
   title='تحديث إيصال السداد';
 elsif tg_table_name='accounting_statements' then title='كشف حساب جديد من بلقيس';
 else title='مستند مالي جديد من بلقيس'; end if;
 select * into l from public.accounting_links where id=new.link_id;
 path=case when l.organization_id is not null then '/portal/financial' else '/account/documents' end;
 insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,user_id,organization_id,status,published_at,action_url,category,dedupe_key)
 values(title,'Accounting update','افتح المركز المالي لمراجعة التحديث.','Open your financial center to view this update.','info',
 case when l.user_id is not null then 'user' else 'organization' end,l.user_id,l.organization_id,'published',now(),path,'finance',
 'accounting-'||tg_table_name||'-'||new.id||'-'||tg_op||'-'||coalesce(to_jsonb(new)->>'status','published'));
 return new;
end;
$$;
revoke all on function private.accounting_notify() from public,anon,authenticated;
create trigger accounting_payment_notify after insert or update on public.accounting_payments for each row execute function private.accounting_notify();
create trigger accounting_statement_notify after insert on public.accounting_statements for each row execute function private.accounting_notify();
create trigger accounting_document_notify after insert on public.accounting_documents for each row execute function private.accounting_notify();

revoke all on function public.accounting_admin_access(),public.accounting_submit_payment(uuid,uuid,numeric,date,text,text,text,text) from public,anon;
grant execute on function public.accounting_admin_access(),public.accounting_submit_payment(uuid,uuid,numeric,date,text,text,text,text) to authenticated;
do $$
declare r record;
begin
 for r in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('accounting_bind_client','accounting_publish_statement','accounting_publish_document','accounting_claim_payment','accounting_mark_append','accounting_finish_payment','accounting_reject_payment')
 loop
  execute format('revoke all on function %s from public,anon,authenticated',r.f);
  execute format('grant execute on function %s to service_role',r.f);
 end loop;
end $$;
do $$
declare t text;
begin
 foreach t in array array['accounting_links','accounting_statements','accounting_documents','accounting_payments'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;
