-- Public service and product RFQs; all submissions require a verified account.
-- Column grants and a canonicalizing invoker trigger protect derived data even
-- when a client bypasses the RPC and inserts through the Data API.
create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  user_id uuid not null default auth.uid() references auth.users(id),
  request_token uuid not null,
  kind text not null check (kind in ('service','products')),
  service_type text,
  contact_name text not null,
  phone text not null,
  email text,
  location text not null,
  description text not null,
  preferred_date date,
  frequency text,
  duration_months integer,
  items jsonb not null default '[]'::jsonb,
  product_snapshot jsonb not null default '[]'::jsonb,
  status text not null default 'submitted' check (status in ('submitted','in_review','needs_info','quoted','closed')),
  admin_reply text,
  quote_amount numeric(14,2),
  quote_valid_until date,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, request_token),
  check (quote_amount is null or quote_amount > 0)
);
create index quote_requests_customer_created_idx on public.quote_requests(user_id, created_at desc);
create index quote_requests_status_created_idx on public.quote_requests(status, created_at desc);
alter table public.quote_requests enable row level security;

create or replace function private.rfq_is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select auth.uid() is not null and coalesce(auth.jwt()->'app_metadata'->>'role','') = 'admin'
    and coalesce(auth.jwt()->'app_metadata'->>'status','active') not in ('blocked','suspended')
    and not exists (select 1 from public.admin_user_state s where s.user_id = auth.uid() and s.status in ('blocked','suspended'));
$$;
revoke all on function private.rfq_is_admin() from public, anon;
grant execute on function private.rfq_is_admin() to authenticated;
create policy quote_requests_read on public.quote_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select private.rfq_is_admin()));
create policy quote_requests_submit on public.quote_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'submitted');
create policy quote_requests_admin_update on public.quote_requests for update to authenticated
  using ((select private.rfq_is_admin())) with check ((select private.rfq_is_admin()));
revoke all on public.quote_requests from anon, authenticated;
grant select on public.quote_requests to authenticated;
grant insert (request_token,kind,service_type,contact_name,phone,email,location,description,preferred_date,frequency,duration_months,items) on public.quote_requests to authenticated;
grant update (status,admin_reply,quote_amount,quote_valid_until) on public.quote_requests to authenticated;
grant usage on sequence public.quote_requests_request_number_seq to authenticated;

create or replace function private.validate_quote_request() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_item jsonb; v_product public.products%rowtype; v_qty numeric;
  v_seen uuid[] := '{}'::uuid[]; v_snapshot jsonb := '[]'::jsonb;
  v_store jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
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
$$;
revoke all on function private.validate_quote_request() from public, anon, authenticated;
create trigger quote_requests_validate before insert or update on public.quote_requests
  for each row execute function private.validate_quote_request();

create or replace function public.submit_quote_request(p_request jsonb) returns public.quote_requests
language plpgsql security invoker set search_path = '' as $$
declare v_row public.quote_requests%rowtype; v_token uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_token := (p_request->>'request_token')::uuid;
  if v_token is null then raise exception 'REQUEST_TOKEN_REQUIRED'; end if;
  select * into v_row from public.quote_requests where user_id = auth.uid() and request_token = v_token;
  if found then return v_row; end if;
  insert into public.quote_requests(request_token,kind,service_type,contact_name,phone,email,location,description,preferred_date,frequency,duration_months,items)
    values(v_token,p_request->>'kind',p_request->>'service_type',p_request->>'contact_name',p_request->>'phone',p_request->>'email',p_request->>'location',p_request->>'description',nullif(p_request->>'preferred_date','')::date,nullif(p_request->>'frequency',''),nullif(p_request->>'duration_months','')::integer,coalesce(p_request->'items','[]'::jsonb))
    on conflict(user_id,request_token) do nothing returning * into v_row;
  if v_row.id is null then select * into v_row from public.quote_requests where user_id = auth.uid() and request_token = v_token; end if;
  return v_row;
end;
$$;
create or replace function public.admin_review_quote_request(p_id uuid,p_status text,p_reply text,p_amount numeric default null,p_valid_until date default null,p_expected_updated_at timestamptz default null) returns public.quote_requests
language plpgsql security invoker set search_path = '' as $$
declare v_row public.quote_requests%rowtype;
begin
  if not private.rfq_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.quote_requests set status = p_status,admin_reply = p_reply,quote_amount = p_amount,quote_valid_until = p_valid_until
    where id = p_id and (p_expected_updated_at is null or updated_at = p_expected_updated_at) returning * into v_row;
  if v_row.id is null then raise exception 'REQUEST_CHANGED'; end if;
  return v_row;
end;
$$;
revoke all on function public.submit_quote_request(jsonb) from public, anon;
revoke all on function public.admin_review_quote_request(uuid,text,text,numeric,date,timestamptz) from public, anon;
grant execute on function public.submit_quote_request(jsonb) to authenticated;
grant execute on function public.admin_review_quote_request(uuid,text,text,numeric,date,timestamptz) to authenticated;

-- Private trigger needs elevated rights only to find admins and publish their
-- notifications; request insert/update and canonical products remain invoker-only.
create or replace function private.notify_quote_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or new.user_id <> auth.uid() then raise exception 'AUTH_REQUIRED'; end if;
    for v_admin in select u.id from auth.users u
      where u.raw_app_meta_data->>'role' = 'admin'
        and coalesce(u.raw_app_meta_data->>'status','active') not in ('blocked','suspended')
        and not exists(select 1 from public.admin_user_state s where s.user_id = u.id and s.status in ('blocked','suspended'))
    loop
      insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,user_id,status,published_at,action_url,category,event_type,entity_type,entity_id,dedupe_key)
        values('طلب عرض سعر جديد','New quotation request','طلب #'||new.request_number||' من '||new.contact_name,'Request #'||new.request_number||' from '||new.contact_name,'info','user',v_admin,'published',now(),'/admin/quote-requests?request='||new.id,'quotation','quote_request_submitted','quote_request',new.id,'rfq-new-'||new.id||'-'||v_admin);
    end loop;
  elsif row(new.status,new.admin_reply,new.quote_amount,new.quote_valid_until) is distinct from row(old.status,old.admin_reply,old.quote_amount,old.quote_valid_until) then
    if not private.rfq_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
    insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,user_id,status,published_at,action_url,category,event_type,entity_type,entity_id,dedupe_key)
      values('تحديث طلب عرض السعر','Quotation request updated','تم تحديث طلبك #'||new.request_number||'. افتح الطلب لعرض رد بلقيس.','Request #'||new.request_number||' was updated. Open it to read the reply.','info','user',new.user_id,'published',now(),'/request-quote?request='||new.id,'quotation','quote_request_updated','quote_request',new.id,'rfq-update-'||new.id||'-'||new.updated_at);
  end if;
  return new;
end;
$$;
revoke all on function private.notify_quote_request() from public, anon, authenticated;
create trigger quote_requests_notify after insert or update on public.quote_requests
  for each row execute function private.notify_quote_request();

insert into public.product_categories(name_ar,name_en,slug,is_active,sort_order)
values ('الشجر والنباتات','Trees & plants','trees-plants',true,10),('الورد والباقات','Flowers & bouquets','flowers-bouquets',true,20),('المراكن والأحواض','Planters & pots','planters-pots',true,30)
on conflict(slug) do nothing;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='quote_requests') then
    alter publication supabase_realtime add table public.quote_requests;
  end if;
end $$;

-- A variable-priced item cannot become a zero-priced legacy order.
CREATE OR REPLACE FUNCTION private.create_customer_order_impl(p_user uuid, p_items jsonb, p_coupon_code text, p_customer_note text, p_service_address jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_quote jsonb; v_order public.orders%rowtype; v_item jsonb; v_discount_id uuid; v_org uuid;
begin
  if p_user is null then raise exception 'AUTH_REQUIRED'; end if;
  v_quote:=private.preview_customer_cart_impl(p_user,p_items,p_coupon_code);
  if coalesce((v_quote->>'has_quote_items')::boolean,false) then raise exception 'QUOTE_ITEMS_REQUIRE_REVIEW'; end if;
  v_discount_id:=nullif(v_quote->>'discount_id','')::uuid;
  select organization_id into v_org from public.organization_members
   where user_id=p_user and status='active' order by joined_at limit 1;

  insert into public.orders(user_id,organization_id,status,subtotal,discount_total,vat_total,total,customer_note,service_address)
  values(
    p_user,v_org,
    case when coalesce((v_quote->>'has_quote_items')::boolean,false) then 'under_review' else 'pending' end,
    (v_quote->>'subtotal')::numeric,(v_quote->>'discount_total')::numeric,(v_quote->>'vat_total')::numeric,(v_quote->>'total')::numeric,
    nullif(btrim(coalesce(p_customer_note,'')),''),coalesce(p_service_address,'{}'::jsonb)
  ) returning * into v_order;

  for v_item in select * from jsonb_array_elements(v_quote->'items')
  loop
    insert into public.order_items(order_id,product_id,product_snapshot,quantity,unit_price,discount_total,line_total)
    values(v_order.id,(v_item->>'product_id')::uuid,v_item-'category_id',(v_item->>'quantity')::numeric,(v_item->>'unit_price')::numeric,0,(v_item->>'line_total')::numeric);
  end loop;

  if v_discount_id is not null and (v_quote->>'discount_total')::numeric>0 then
    insert into public.discount_redemptions(discount_id,user_id,order_id,amount)
    values(v_discount_id,p_user,v_order.id,(v_quote->>'discount_total')::numeric);
  end if;

  insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,user_id,status,published_at)
  values(
    'تم استلام طلبك','Your order was received',
    'استلمنا طلبك رقم #'||lpad(v_order.order_number::text,5,'0')||' وسنتابع معك من خلال حسابك.',
    'We received order #'||lpad(v_order.order_number::text,5,'0')||' and will keep you updated in your account.',
    'success','user',p_user,'published',now()
  );

  return jsonb_build_object('order_id',v_order.id,'order_number',v_order.order_number,'status',v_order.status,
    'subtotal',v_order.subtotal,'discount_total',v_order.discount_total,'vat_total',v_order.vat_total,'total',v_order.total);
end;
$function$;
