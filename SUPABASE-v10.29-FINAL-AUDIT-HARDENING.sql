-- Balqees Floral v10.29 — Final audit hardening & live-schema alignment
-- Targets the existing live backend (customer_documents / customer-documents).
-- Safe to apply after the live v10.26 migrations.

-- 1) Official customer documents: authenticated-only API surface and hidden-document privacy.
alter table public.customer_documents enable row level security;

drop policy if exists customer_documents_admin_delete on public.customer_documents;
drop policy if exists customer_documents_admin_insert on public.customer_documents;
drop policy if exists customer_documents_admin_update on public.customer_documents;
drop policy if exists customer_documents_select_own on public.customer_documents;

create policy customer_documents_select_own
on public.customer_documents for select
to authenticated
using (
  private.is_balqees_admin()
  or (user_id = (select auth.uid()) and is_visible = true)
);

create policy customer_documents_admin_insert
on public.customer_documents for insert
to authenticated
with check (private.is_balqees_admin());

create policy customer_documents_admin_update
on public.customer_documents for update
to authenticated
using (private.is_balqees_admin())
with check (private.is_balqees_admin());

create policy customer_documents_admin_delete
on public.customer_documents for delete
to authenticated
using (private.is_balqees_admin());

revoke all on public.customer_documents from anon;
grant select, insert, update, delete on public.customer_documents to authenticated;

-- 2) Document delivery/download log: one policy per action, no public/anon access.
alter table public.customer_document_delivery_events enable row level security;

drop policy if exists customer_document_delivery_events_admin_all on public.customer_document_delivery_events;
drop policy if exists customer_document_delivery_events_owner_download on public.customer_document_delivery_events;
drop policy if exists customer_document_delivery_events_owner_insert on public.customer_document_delivery_events;
drop policy if exists customer_document_delivery_events_owner_insert_download on public.customer_document_delivery_events;
drop policy if exists customer_document_delivery_events_owner_read on public.customer_document_delivery_events;

create policy customer_document_delivery_events_select
on public.customer_document_delivery_events for select
to authenticated
using (
  private.is_balqees_admin()
  or exists (
    select 1 from public.customer_documents d
    where d.id = customer_document_delivery_events.document_id
      and d.user_id = (select auth.uid())
      and d.is_visible = true
  )
);

create policy customer_document_delivery_events_insert
on public.customer_document_delivery_events for insert
to authenticated
with check (
  private.is_balqees_admin()
  or (
    channel = 'download'
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.customer_documents d
      where d.id = customer_document_delivery_events.document_id
        and d.user_id = (select auth.uid())
        and d.is_visible = true
    )
  )
);

create policy customer_document_delivery_events_admin_update
on public.customer_document_delivery_events for update
to authenticated
using (private.is_balqees_admin())
with check (private.is_balqees_admin());

create policy customer_document_delivery_events_admin_delete
on public.customer_document_delivery_events for delete
to authenticated
using (private.is_balqees_admin());

revoke all on public.customer_document_delivery_events from anon;
grant select, insert, update, delete on public.customer_document_delivery_events to authenticated;

-- 3) Security activity and privacy requests: authenticated-only ownership policies.
alter table public.customer_security_events enable row level security;

drop policy if exists customer_security_events_insert_own on public.customer_security_events;
drop policy if exists customer_security_events_select_own on public.customer_security_events;
create policy customer_security_events_select_own
on public.customer_security_events for select
to authenticated
using (user_id = (select auth.uid()) or private.is_balqees_admin());
create policy customer_security_events_insert_own
on public.customer_security_events for insert
to authenticated
with check (user_id = (select auth.uid()) or private.is_balqees_admin());
revoke all on public.customer_security_events from anon;
grant select, insert on public.customer_security_events to authenticated;
revoke update, delete on public.customer_security_events from authenticated;

alter table public.customer_security_events
  drop constraint if exists customer_security_events_details_size_check;
alter table public.customer_security_events
  add constraint customer_security_events_details_size_check
  check (octet_length(details::text) <= 4096);

alter table public.customer_privacy_requests enable row level security;

drop policy if exists customer_privacy_requests_admin_update on public.customer_privacy_requests;
drop policy if exists customer_privacy_requests_insert_own on public.customer_privacy_requests;
drop policy if exists customer_privacy_requests_owner_cancel on public.customer_privacy_requests;
drop policy if exists customer_privacy_requests_select_own on public.customer_privacy_requests;

create policy customer_privacy_requests_select_own
on public.customer_privacy_requests for select
to authenticated
using (user_id = (select auth.uid()) or private.is_balqees_admin());

create policy customer_privacy_requests_insert_own
on public.customer_privacy_requests for insert
to authenticated
with check (user_id = (select auth.uid()) or private.is_balqees_admin());

create policy customer_privacy_requests_update
on public.customer_privacy_requests for update
to authenticated
using (
  private.is_balqees_admin()
  or (user_id = (select auth.uid()) and status in ('open','in_review'))
)
with check (
  private.is_balqees_admin()
  or (user_id = (select auth.uid()) and status = 'cancelled')
);

revoke all on public.customer_privacy_requests from anon;
grant select, insert, update on public.customer_privacy_requests to authenticated;
revoke delete on public.customer_privacy_requests from authenticated;

create unique index if not exists customer_privacy_requests_one_open_per_type_idx
on public.customer_privacy_requests(user_id, request_type)
where status in ('open','in_review');

-- Customer preferences are private account settings; remove legacy public role scope.
alter table public.customer_preferences enable row level security;
drop policy if exists customer_preferences_insert_own on public.customer_preferences;
drop policy if exists customer_preferences_select_own on public.customer_preferences;
drop policy if exists customer_preferences_update_own on public.customer_preferences;
create policy customer_preferences_select_own
on public.customer_preferences for select to authenticated
using (user_id = (select auth.uid()) or private.is_balqees_admin());
create policy customer_preferences_insert_own
on public.customer_preferences for insert to authenticated
with check (user_id = (select auth.uid()) or private.is_balqees_admin());
create policy customer_preferences_update_own
on public.customer_preferences for update to authenticated
using (user_id = (select auth.uid()) or private.is_balqees_admin())
with check (user_id = (select auth.uid()) or private.is_balqees_admin());
revoke all on public.customer_preferences from anon;
grant select, insert, update on public.customer_preferences to authenticated;

-- 4) Correct invoice-ready notification deep link to the real order-center route.
create or replace function private.notify_customer_document_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_number bigint;
  v_action_url text;
  v_is_newly_visible boolean;
begin
  v_is_newly_visible :=
    new.is_visible = true
    and new.file_path is not null
    and (
      tg_op = 'INSERT'
      or old.is_visible is distinct from true
      or old.file_path is distinct from new.file_path
    );

  if not v_is_newly_visible then
    return new;
  end if;

  if new.order_id is not null then
    select o.order_number into v_order_number
    from public.orders o
    where o.id = new.order_id and o.user_id = new.user_id;
    v_action_url := '/account/orders/' || new.order_id::text || '?document=' || new.id::text;
  else
    v_action_url := '/account/documents?document=' || new.id::text;
  end if;

  if not exists (
    select 1 from public.notifications n
    where n.user_id = new.user_id
      and n.category = 'document'
      and n.metadata->>'document_id' = new.id::text
      and n.status = 'published'
  ) then
    insert into public.notifications(
      title_ar,title_en,body_ar,body_en,type,category,priority,
      audience,user_id,status,published_at,
      action_url,action_label_ar,action_label_en,metadata
    ) values (
      case when new.document_type='invoice_copy' then 'فاتورتك أصبحت جاهزة' else 'مستند جديد أصبح جاهزًا' end,
      case when new.document_type='invoice_copy' then 'Your invoice is ready' else 'A new document is ready' end,
      case
        when new.document_type='invoice_copy' and v_order_number is not null
          then 'الفاتورة الرسمية للطلب #' || lpad(v_order_number::text,5,'0') || ' متاحة الآن داخل حسابك.'
        when new.document_type='invoice_copy'
          then 'فاتورتك الرسمية متاحة الآن داخل حسابك.'
        else coalesce(new.title_ar,'مستند جديد متاح داخل حسابك.')
      end,
      case
        when new.document_type='invoice_copy' and v_order_number is not null
          then 'The official invoice for order #' || lpad(v_order_number::text,5,'0') || ' is now available in your account.'
        when new.document_type='invoice_copy'
          then 'Your official invoice is now available in your account.'
        else coalesce(new.title_en,new.title_ar,'A new document is available in your account.')
      end,
      'info','document','normal',
      'user',new.user_id,'published',now(),
      v_action_url,
      'عرض المستند','View document',
      jsonb_build_object(
        'document_id',new.id,
        'document_type',new.document_type,
        'order_id',new.order_id
      )
    );
  end if;

  return new;
end;
$$;

-- This trigger function is internal only.
revoke execute on function private.notify_customer_document_ready() from public, anon, authenticated;

-- 5) Close unnecessary anonymous execution of SECURITY DEFINER RPCs.
revoke execute on function public.record_cod_delivery_attempt(uuid,text,text,numeric) from public, anon;
grant execute on function public.record_cod_delivery_attempt(uuid,text,text,numeric) to authenticated;

revoke execute on function public.update_my_order_delivery(uuid,uuid,uuid,text,boolean,text) from public, anon;
grant execute on function public.update_my_order_delivery(uuid,uuid,uuid,text,boolean,text) to authenticated;

-- 6) Realtime must use the existing canonical tables only.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname='supabase_realtime' and schemaname='public' and tablename='customer_documents'
     ) then
    execute 'alter publication supabase_realtime add table public.customer_documents';
  end if;
end $$;
