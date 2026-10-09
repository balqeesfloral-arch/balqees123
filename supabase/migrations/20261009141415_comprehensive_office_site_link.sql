-- Website owns customer requests and their lifecycle. Sheets owns the ledger.
-- Server imports are reserved durably before any non-transactional append.
create table private.office_sync_jobs (
 id uuid primary key default gen_random_uuid(),
 source_kind text not null check(source_kind in ('client_individual','client_organization','orders','rfq','requests','quotations','contracts')),
 source_id uuid not null,
 link_id uuid references public.accounting_links(id) on delete restrict,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<300000),
 status text not null default 'pending' check(status in ('pending','importing','needs_review','recorded')),
 token uuid not null default gen_random_uuid(),
 append_started boolean not null default false,
 lease_until timestamptz,
 actor text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(source_kind,source_id)
);
create index office_sync_link_idx on private.office_sync_jobs(link_id) where link_id is not null;
create table private.office_commands (
 id uuid primary key,
 kind text not null,
 source_id uuid not null,
 intent jsonb not null,
 result jsonb not null,
 actor text not null,
 created_at timestamptz not null default now()
);
alter table private.office_sync_jobs enable row level security;
alter table private.office_commands enable row level security;
revoke all on private.office_sync_jobs,private.office_commands from public,anon,authenticated;
grant all on private.office_sync_jobs,private.office_commands to service_role;
create table private.office_order_payments (
 payment_id uuid primary key references public.accounting_payments(id) on delete restrict,
 order_id uuid not null unique references public.orders(id) on delete restrict,
 actor text not null,
 created_at timestamptz not null default now()
);
alter table private.office_order_payments enable row level security;
revoke all on private.office_order_payments from public,anon,authenticated;
grant all on private.office_order_payments to service_role;

create function private.office_require_service(p_actor text default 'office:server') returns void
language plpgsql security invoker set search_path='' as $$
begin
 if current_user<>'service_role' or coalesce(auth.role(),'')<>'service_role' then raise exception 'OFFICE_SERVICE_REQUIRED'; end if;
 if p_actor is null or p_actor !~ '^(office|site):.{1,180}$' then raise exception 'OFFICE_ACTOR_REQUIRED'; end if;
end;
$$;
revoke all on function private.office_require_service(text) from public,anon,authenticated;
grant execute on function private.office_require_service(text) to service_role;

create function public.office_sync_claim(p_kind text,p_source uuid,p_link uuid,p_payload jsonb,p_actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j private.office_sync_jobs; l public.accounting_links;
begin
 perform private.office_require_service(p_actor);
 if p_kind not in ('client_individual','client_organization','orders','rfq','requests','quotations','contracts')
    or p_source is null or p_payload is null or jsonb_typeof(p_payload->'record') is distinct from 'object'
    or p_payload->>'entity' not in ('clients','projects','quotes','contracts') then raise exception 'OFFICE_SOURCE_INVALID'; end if;
 if p_kind like 'client_%' then
   if p_link is not null or p_payload->>'entity'<>'clients' then raise exception 'OFFICE_MAPPING_INVALID'; end if;
   if p_kind='client_individual' and not exists(select 1 from public.customer_profiles where id=p_source and account_type='individual') then raise exception 'OFFICE_TARGET_INVALID'; end if;
   if p_kind='client_organization' and not exists(select 1 from public.organizations where id=p_source and status='active') then raise exception 'OFFICE_TARGET_INVALID'; end if;
 else
   select * into l from public.accounting_links where id=p_link and is_active;
   if l.id is null or p_payload->'record'->>'client_id' is distinct from l.office_client_id then raise exception 'OFFICE_MAPPING_INVALID'; end if;
 end if;
 insert into private.office_sync_jobs(source_kind,source_id,link_id,payload,actor)
 values(p_kind,p_source,p_link,p_payload,p_actor) on conflict(source_kind,source_id) do nothing;
 select * into j from private.office_sync_jobs where source_kind=p_kind and source_id=p_source for update;
 if j.link_id is distinct from p_link then raise exception 'OFFICE_MAPPING_IMMUTABLE'; end if;
 if j.status='recorded' then return jsonb_build_object('job',to_jsonb(j)-'token'-'actor','token',j.token,'can_append',false); end if;
 if j.lease_until>now() then raise exception 'OFFICE_IMPORT_BUSY'; end if;
 if not j.append_started and j.payload is distinct from p_payload then
   update private.office_sync_jobs set payload=p_payload where id=j.id returning * into j;
 end if;
 update private.office_sync_jobs set token=gen_random_uuid(),status='importing',lease_until=now()+interval '2 minutes',updated_at=now(),actor=p_actor
 where id=j.id returning * into j;
 return jsonb_build_object('job',to_jsonb(j)-'token'-'actor','token',j.token,'can_append',not j.append_started);
end;
$$;
create function public.office_sync_mark_append(p_id uuid,p_token uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform private.office_require_service();
 update private.office_sync_jobs set append_started=true,updated_at=now()
 where id=p_id and token=p_token and status='importing' and not append_started and lease_until>now();
 if not found then raise exception 'OFFICE_IMPORT_CHANGED'; end if;
end;
$$;
create function public.office_sync_finish(p_id uuid,p_token uuid,p_recorded boolean,p_actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j private.office_sync_jobs;
begin
 perform private.office_require_service(p_actor);
 select * into j from private.office_sync_jobs where id=p_id for update;
 if not found then raise exception 'OFFICE_IMPORT_CHANGED'; end if;
 if j.status='recorded' then return to_jsonb(j)-'token'-'actor'; end if;
 if j.token is distinct from p_token then raise exception 'OFFICE_IMPORT_CHANGED'; end if;
 update private.office_sync_jobs set status=case when p_recorded then 'recorded' when append_started then 'needs_review' else 'pending' end,
  lease_until=null,updated_at=now(),actor=p_actor where id=p_id returning * into j;
 insert into public.accounting_events(entity_id,event,actor) values(j.id,case when p_recorded then 'office_import_recorded' else 'office_import_review' end,p_actor);
 return to_jsonb(j)-'token'-'actor';
end;
$$;
create function public.office_sync_state(p_kind text,p_sources uuid[]) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 perform private.office_require_service();
 if cardinality(p_sources)>51 then raise exception 'OFFICE_SOURCE_INVALID'; end if;
 return coalesce((select jsonb_agg(to_jsonb(j)-'token'-'actor') from private.office_sync_jobs j where j.source_kind=p_kind and j.source_id=any(p_sources)),'[]'::jsonb);
end;
$$;

create function public.office_update_request(p_id uuid,p_kind text,p_patch jsonb,p_expected timestamptz,p_command uuid,p_actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c private.office_commands; intent jsonb; r public.quote_requests; o public.orders; s public.organization_service_requests; result jsonb;
begin
 perform private.office_require_service(p_actor);
 if p_command is null or p_expected is null or p_kind not in ('orders','rfq','requests') then raise exception 'OFFICE_SOURCE_INVALID'; end if;
 intent:=jsonb_build_object('id',p_id,'patch',p_patch,'expected',p_expected);
 -- The command lock also protects concurrent retries whose first response was lost.
 perform pg_advisory_xact_lock(hashtextextended(p_command::text,0));
 select * into c from private.office_commands where id=p_command;
 if found then
   if c.kind<>p_kind or c.source_id<>p_id or c.intent is distinct from intent then raise exception 'OFFICE_COMMAND_REUSED'; end if;
   return c.result;
 end if;
 if p_kind='rfq' then
   select * into r from public.quote_requests where id=p_id for update;
   if r.id is null then raise exception 'OFFICE_NOT_FOUND'; end if;
   if r.updated_at is distinct from p_expected then raise exception 'OFFICE_SOURCE_CHANGED'; end if;
   if r.status='closed' then raise exception 'REQUEST_CLOSED'; end if;
   if p_patch->>'status' not in ('in_review','needs_info','quoted','closed') then raise exception 'INVALID_STATUS'; end if;
   update public.quote_requests set status=p_patch->>'status',admin_reply=p_patch->>'reply',
     quote_amount=case when p_patch->>'status'='quoted' then (p_patch->>'amount')::numeric else null end,
     quote_valid_until=case when p_patch->>'status'='quoted' then nullif(p_patch->>'valid_until','')::date else null end
   where id=p_id returning * into r;
   result:=to_jsonb(r);
 elsif p_kind='orders' then
   select * into o from public.orders where id=p_id for update;
   if o.id is null then raise exception 'OFFICE_NOT_FOUND'; end if;
   if o.updated_at is distinct from p_expected then raise exception 'OFFICE_SOURCE_CHANGED'; end if;
   if o.status in ('completed','cancelled') then raise exception 'OFFICE_SOURCE_CLOSED'; end if;
   if p_patch->>'status' not in ('pending','under_review','quoted','approved','in_progress','ready','out_for_delivery','delivered','delivery_failed_payment','completed','cancelled') then raise exception 'INVALID_STATUS'; end if;
   update public.orders set status=p_patch->>'status',admin_note=nullif(left(p_patch->>'admin_note',4000),'') where id=p_id returning * into o;
   result:=to_jsonb(o);
   insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,user_id,status,published_at,action_url,category,metadata)
   values('تحديث حالة الطلب','Order status updated','تم تحديث طلبك #'||o.order_number||'. تابع تفاصيله من حسابك.','Order #'||o.order_number||' was updated. View the details in your account.','info','user',o.user_id,'published',now(),case when o.organization_id is null then '/account' else '/portal/orders' end,'orders',jsonb_build_object('order_id',o.id));
 else
   select * into s from public.organization_service_requests where id=p_id for update;
   if s.id is null then raise exception 'OFFICE_NOT_FOUND'; end if;
   if s.updated_at is distinct from p_expected then raise exception 'OFFICE_SOURCE_CHANGED'; end if;
   if s.status in ('draft','cancelled','converted') then raise exception 'OFFICE_SOURCE_CLOSED'; end if;
   if p_patch->>'status' not in ('under_review','needs_info','converted','cancelled') then raise exception 'INVALID_STATUS'; end if;
   update public.organization_service_requests set status=p_patch->>'status' where id=p_id returning * into s;
   result:=to_jsonb(s);
 end if;
 insert into private.office_commands(id,kind,source_id,intent,result,actor) values(p_command,p_kind,p_id,intent,result,p_actor);
 insert into public.accounting_events(entity_id,event,actor) values(p_id,'office_'||p_kind||'_updated',p_actor);
 return result;
end;
$$;

create function public.office_quote_organization(p_id uuid,p_request uuid,p_amount numeric,p_vat numeric,p_reply text,p_valid_until date,p_expected timestamptz,p_actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c private.office_commands; s public.organization_service_requests; q public.quotations; intent jsonb; result jsonb;
begin
 perform private.office_require_service(p_actor);
 if p_id is null or p_expected is null or p_amount is null or p_amount<=0 or p_amount>1000000000 or p_amount<>round(p_amount,2)
   or p_vat is null or p_vat<0 or p_vat>100 or length(btrim(p_reply)) not between 3 and 4000 or p_reply is null
   or (p_valid_until is not null and p_valid_until<current_date) then raise exception 'OFFICE_QUOTE_INVALID'; end if;
 intent:=jsonb_build_object('request',p_request,'amount',p_amount,'vat',p_vat,'reply',p_reply,'valid_until',p_valid_until,'expected',p_expected);
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into c from private.office_commands where id=p_id;
 if found then
   if c.kind<>'organization_quote' or c.source_id<>p_request or c.intent is distinct from intent then raise exception 'OFFICE_COMMAND_REUSED'; end if;
   return c.result;
 end if;
 select * into s from public.organization_service_requests where id=p_request for update;
 if s.id is null or s.status in ('draft','cancelled','converted') then raise exception 'OFFICE_SOURCE_CLOSED'; end if;
 if s.updated_at is distinct from p_expected then raise exception 'OFFICE_SOURCE_CHANGED'; end if;
 if not exists(select 1 from public.organizations where id=s.organization_id and status='active') then raise exception 'OFFICE_TARGET_INVALID'; end if;
 if exists(select 1 from public.quotations where service_request_id=s.id and is_current and status not in ('draft','cancelled')) then raise exception 'OFFICE_QUOTATION_EXISTS'; end if;
 insert into public.quotations(id,organization_id,service_request_id,site_id,contract_id,title_ar,status,vat_rate,prices_include_vat,valid_until,terms_ar)
 values(p_id,s.organization_id,s.id,s.site_id,s.contract_id,'عرض بلقيس · '||s.request_code,'draft',p_vat,true,p_valid_until,btrim(p_reply)) returning * into q;
 insert into public.quotation_items(quotation_id,description_ar,quantity,unit_ar,unit_price,discount,sort_order)
 values(q.id,btrim(p_reply),1,'عرض',p_amount,0,0);
 update public.quotations set status='sent',sent_at=now() where id=q.id returning * into q;
 if abs(q.total-p_amount)>0.01 then raise exception 'OFFICE_QUOTE_TOTAL_MISMATCH'; end if;
 update public.organization_service_requests set status='under_review' where id=s.id;
 result:=to_jsonb(q);
 insert into private.office_commands(id,kind,source_id,intent,result,actor) values(p_id,'organization_quote',s.id,intent,result,p_actor);
 insert into public.accounting_events(entity_id,event,actor) values(q.id,'office_organization_quote_sent',p_actor);
 return result;
end;
$$;

revoke all on function public.office_sync_claim(text,uuid,uuid,jsonb,text),public.office_sync_mark_append(uuid,uuid),public.office_sync_finish(uuid,uuid,boolean,text),public.office_sync_state(text,uuid[]),public.office_update_request(uuid,text,jsonb,timestamptz,uuid,text),public.office_quote_organization(uuid,uuid,numeric,numeric,text,date,timestamptz,text) from public,anon,authenticated;
grant execute on function public.office_sync_claim(text,uuid,uuid,jsonb,text),public.office_sync_mark_append(uuid,uuid),public.office_sync_finish(uuid,uuid,boolean,text),public.office_sync_state(text,uuid[]),public.office_update_request(uuid,text,jsonb,timestamptz,uuid,text),public.office_quote_organization(uuid,uuid,numeric,numeric,text,date,timestamptz,text) to service_role;

create function public.office_apply_order_payment(p_order uuid,p_payment uuid,p_expected timestamptz,p_actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.orders; p public.accounting_payments; l public.accounting_links; allocation private.office_order_payments;
begin
 perform private.office_require_service(p_actor);
 select * into p from public.accounting_payments where id=p_payment for update;
 select * into o from public.orders where id=p_order for update;
 if p.id is null or p.status<>'recorded' or o.id is null or o.status in ('cancelled','delivery_failed_payment') then raise exception 'OFFICE_PAYMENT_INVALID'; end if;
 select * into allocation from private.office_order_payments where payment_id=p_payment;
 if found then
   if allocation.order_id<>p_order then raise exception 'OFFICE_PAYMENT_ALLOCATED'; end if;
   return to_jsonb(o);
 end if;
 if o.payment_status in ('paid','refunded','not_applicable') then raise exception 'OFFICE_PAYMENT_INVALID'; end if;
 if o.updated_at is distinct from p_expected then raise exception 'OFFICE_SOURCE_CHANGED'; end if;
 select * into l from public.accounting_links where id=p.link_id and is_active;
 if l.id is null or p.amount<>o.total or o.total<=0 or
   (case when o.organization_id is not null then l.organization_id is distinct from o.organization_id else l.user_id is distinct from o.user_id end)
 then raise exception 'OFFICE_PAYMENT_MISMATCH'; end if;
 insert into private.office_order_payments(payment_id,order_id,actor) values(p.id,o.id,p_actor);
 update public.orders set payment_status='paid' where id=o.id returning * into o;
 insert into public.accounting_events(entity_id,event,actor) values(o.id,'order_payment_verified',p_actor);
 insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,user_id,status,published_at,action_url,category,metadata)
 values('تم اعتماد سداد الطلب','Order payment verified','تم ربط السداد المعتمد في المكتب بطلبك #'||o.order_number||'.','The payment verified by Office was linked to order #'||o.order_number||'.','success','user',o.user_id,'published',now(),case when o.organization_id is null then '/account' else '/portal/orders' end,'payments',jsonb_build_object('order_id',o.id));
 return to_jsonb(o);
end;
$$;
revoke all on function public.office_apply_order_payment(uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.office_apply_order_payment(uuid,uuid,timestamptz,text) to service_role;

alter table public.accounting_documents drop constraint accounting_documents_document_type_check;
alter table public.accounting_documents add constraint accounting_documents_document_type_check check(document_type in ('invoice','receipt','statement','credit_note','debit_note','quotation','contract','other'));

-- Use fresh admin state for browser reviews; the Office service is trusted only
-- through signed service context, with service-only RPCs above.
create or replace function private.rfq_is_admin() returns boolean language sql stable security invoker set search_path='' as $$
 select auth.role()='service_role' or private.accounting_is_admin();
$$;
grant execute on function private.rfq_is_admin() to service_role;
CREATE OR REPLACE FUNCTION private.validate_quote_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_item jsonb; v_product public.products%rowtype; v_qty numeric;
  v_seen uuid[] := '{}'::uuid[]; v_snapshot jsonb := '[]'::jsonb;
  v_store jsonb;
begin
  if auth.uid() is null and not (tg_op='UPDATE' and auth.role()='service_role') then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(auth.jwt()->'app_metadata'->>'status','active') in ('blocked','suspended')
     or exists(select 1 from public.admin_user_state s where s.user_id = auth.uid() and s.status in ('blocked','suspended'))
  then raise exception 'ACCOUNT_BLOCKED'; end if;
  if tg_op = 'UPDATE' then
    if not private.rfq_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
    if old.status = 'closed' and new.status <> 'closed' then raise exception 'REQUEST_CLOSED'; end if;
    if new.status not in ('submitted','in_review','needs_info','quoted','closed') then raise exception 'INVALID_STATUS'; end if;
    new.admin_reply := nullif(btrim(coalesce(new.admin_reply,'')),'');
    if char_length(coalesce(new.admin_reply,'')) > 4000 then raise exception 'REPLY_TOO_LONG'; end if;
    if new.status in ('quoted','needs_info') and char_length(coalesce(new.admin_reply,'')) < 3 then raise exception 'REPLY_REQUIRED'; end if;
    if new.status = 'quoted' and (new.quote_amount is null or new.quote_amount <= 0) then raise exception 'QUOTE_AMOUNT_REQUIRED'; end if;
    if new.quote_amount::text = 'NaN' then raise exception 'QUOTE_AMOUNT_REQUIRED'; end if;
    if new.quote_valid_until is not null and new.quote_valid_until < current_date then raise exception 'QUOTE_EXPIRED'; end if;
    new.reviewed_by := auth.uid(); new.updated_at := clock_timestamp();
    return new;
  end if;
  if new.user_id <> auth.uid() then raise exception 'OWNER_MISMATCH'; end if;
  new.contact_name := btrim(new.contact_name); new.phone := btrim(new.phone);
  new.email := nullif(btrim(coalesce(new.email,'')),'');
  new.location := btrim(new.location); new.description := btrim(new.description);
  if char_length(new.contact_name) not between 2 and 160 then raise exception 'CONTACT_NAME_REQUIRED'; end if;
  if new.phone !~ '^\+?[0-9 ()-]{8,24}$' then raise exception 'INVALID_PHONE'; end if;
  if new.email is not null and (char_length(new.email) > 254 or new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'INVALID_EMAIL'; end if;
  if char_length(new.location) not between 2 and 500 then raise exception 'LOCATION_REQUIRED'; end if;
  if char_length(new.description) not between 10 and 4000 then raise exception 'DESCRIPTION_REQUIRED'; end if;
  if new.preferred_date is not null and new.preferred_date < current_date then raise exception 'INVALID_DATE'; end if;
  if new.duration_months is not null and new.duration_months not between 1 and 60 then raise exception 'INVALID_DURATION'; end if;
  if new.frequency is not null and new.frequency not in ('weekly','monthly','once','custom') then raise exception 'INVALID_FREQUENCY'; end if;
  if jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) > 50 then raise exception 'INVALID_ITEMS'; end if;
  if new.kind = 'service' then
    if coalesce(new.service_type,'') not in ('weekly_flowers','monthly_flowers','maintenance','hospitality','floral','bouquets','indoor','landscape','planters','seasonal','custom') then raise exception 'INVALID_SERVICE'; end if;
    if jsonb_array_length(new.items) <> 0 then raise exception 'INVALID_ITEMS'; end if;
    if new.service_type = 'weekly_flowers' then new.frequency := 'weekly'; end if;
    if new.service_type = 'monthly_flowers' then new.frequency := 'monthly'; end if;
  elsif new.kind = 'products' then
    if jsonb_array_length(new.items) = 0 then raise exception 'EMPTY_CART'; end if;
    select value into v_store from public.system_settings where key = 'store';
    if not coalesce((v_store->>'enabled')::boolean,true) then raise exception 'STORE_DISABLED'; end if;
    new.service_type := null; new.frequency := null; new.duration_months := null;
    for v_item in select value from jsonb_array_elements(new.items) loop
      select * into v_product from public.products where id = (v_item->>'product_id')::uuid and is_active and visibility = 'public';
      if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
      if v_product.id = any(v_seen) then raise exception 'DUPLICATE_PRODUCT'; end if;
      v_seen := array_append(v_seen,v_product.id);
      v_qty := (v_item->>'quantity')::numeric;
      if v_qty is null or v_qty::text in ('NaN','Infinity','-Infinity') or v_qty <= 0 then raise exception 'INVALID_QUANTITY'; end if;
      if v_qty < v_product.min_order_quantity then raise exception 'MIN_QUANTITY'; end if;
      if v_product.max_order_quantity is not null and v_qty > v_product.max_order_quantity then raise exception 'MAX_QUANTITY'; end if;
      if v_product.stock_mode = 'tracked' and v_qty > coalesce(v_product.stock_quantity,0) then raise exception 'INSUFFICIENT_STOCK'; end if;
      v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
        'product_id',v_product.id,'quantity',v_qty,'name_ar',v_product.name_ar,'name_en',v_product.name_en,
        'sku',v_product.sku,'image_url',v_product.image_url,'unit_ar',v_product.unit_ar,'unit_en',v_product.unit_en,
        'price_on_request',v_product.price_on_request,'reference_base_price',case when v_product.price_on_request then null else v_product.base_price end));
    end loop;
  else raise exception 'INVALID_KIND';
  end if;
  new.product_snapshot := v_snapshot; new.status := 'submitted';
  new.items := coalesce((select jsonb_agg(jsonb_build_object('product_id',x->'product_id','quantity',x->'quantity')) from jsonb_array_elements(v_snapshot) x),'[]'::jsonb);
  new.admin_reply := null; new.quote_amount := null; new.quote_valid_until := null; new.reviewed_by := null;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.guard_organization_service_request_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_po_mode text;
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'REQUEST_ORGANIZATION_IMMUTABLE';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'REQUEST_CREATOR_IMMUTABLE';
  end if;

  if auth.role()='service_role' or private.is_balqees_admin() then
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
$function$;

