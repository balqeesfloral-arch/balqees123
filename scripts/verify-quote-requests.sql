-- Integration checks against real PostgreSQL permissions. All fixtures, requests,
-- orders and notifications are rolled back; no customer records are changed.
begin;
create temporary table rfq_qa_ids as select gen_random_uuid() user_a,gen_random_uuid() user_b,gen_random_uuid() admin_id,gen_random_uuid() quote_product,gen_random_uuid() fixed_product;
grant select on rfq_qa_ids to authenticated,anon;
create temporary table rfq_qa_results(check_name text);
grant insert,select on rfq_qa_results to authenticated,anon;
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data)
  select user_a,'rfq-a-'||user_a||'@example.test','authenticated','authenticated','{"role":"individual"}'::jsonb,'{"account_type":"individual"}'::jsonb from rfq_qa_ids union all
  select user_b,'rfq-b-'||user_b||'@example.test','authenticated','authenticated','{"role":"individual"}'::jsonb,'{"account_type":"individual"}'::jsonb from rfq_qa_ids union all
  select admin_id,'rfq-admin-'||admin_id||'@example.test','authenticated','authenticated','{"role":"admin"}'::jsonb,'{}'::jsonb from rfq_qa_ids;
insert into public.products(id,name_ar,name_en,slug,base_price,price_on_request,is_active,visibility,stock_mode,stock_quantity,min_order_quantity,max_order_quantity)
  select quote_product,'نبتة اختبار تسعير','QA quotation plant','qa-rfq-'||quote_product,null,true,true,'public','tracked',5,1,4 from rfq_qa_ids union all
  select fixed_product,'ورد اختبار سعر محدد','QA fixed flowers','qa-fixed-'||fixed_product,100,false,true,'public','made_to_order',0,1,10 from rfq_qa_ids;
update public.system_settings set value=jsonb_set(value,'{enabled}','true') where key='store';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',user_a,'role','authenticated','app_metadata',jsonb_build_object('role','individual'),'user_metadata',jsonb_build_object('role','admin'))::text,true) from rfq_qa_ids;
do $$
declare v public.quote_requests%rowtype; v_repeat public.quote_requests%rowtype; v_token uuid:=gen_random_uuid(); v_payload jsonb; v_count integer; v_order jsonb;
begin
  v_payload:=jsonb_build_object('request_token',v_token,'kind','service','service_type','weekly_flowers','frequency','monthly','duration_months',6,'contact_name','عميل الاختبار','phone','0500000000','location','مكة — موقع اختبار','description','اختبار عقد أسبوعي من دون بيانات عميل حقيقي');
  v:=public.submit_quote_request(v_payload);v_repeat:=public.submit_quote_request(v_payload);
  if v.id<>v_repeat.id or v.frequency<>'weekly' or v.status<>'submitted' then raise exception 'FAILED: service/idempotency';end if;
  insert into rfq_qa_results values('weekly service normalized; duplicate submission returns one request');
  v_payload:=v_payload||jsonb_build_object('request_token',gen_random_uuid(),'service_type','monthly_flowers','frequency','weekly');
  v:=public.submit_quote_request(v_payload);
  if v.frequency<>'monthly' then raise exception 'FAILED: monthly schedule';end if;
  v_payload:=v_payload||jsonb_build_object('request_token',gen_random_uuid(),'service_type','maintenance','frequency','custom');
  v:=public.submit_quote_request(v_payload);
  if v.service_type<>'maintenance' then raise exception 'FAILED: maintenance';end if;
  insert into rfq_qa_results values('monthly flower and maintenance requests accepted');
  select v_payload||jsonb_build_object('request_token',gen_random_uuid(),'kind','products','items',jsonb_build_array(jsonb_build_object('product_id',quote_product,'quantity',2,'price',0,'name_ar','FORGED'),jsonb_build_object('product_id',fixed_product,'quantity',1))) into v_payload from rfq_qa_ids;
  v:=public.submit_quote_request(v_payload);
  if jsonb_array_length(v.product_snapshot)<>2 or (v.product_snapshot->0->>'name_ar')='FORGED' or v.product_snapshot->0->>'reference_base_price' is not null or v.items->0 ? 'price' then raise exception 'FAILED: canonical mixed items';end if;
  insert into rfq_qa_results values('mixed fixed/quotation products snapshotted from canonical catalog; unpriced value stays null');
  begin
    perform public.admin_review_quote_request(v.id,'quoted','Spoofed customer reply',1,null,null);
    raise exception 'FAILED: customer impersonated admin';
  exception when others then if sqlerrm not like '%ADMIN_REQUIRED%' then raise;end if;end;
  update public.quote_requests set status='quoted',quote_amount=1 where id=v.id;
  get diagnostics v_count=row_count;if v_count<>0 then raise exception 'FAILED: customer updated status';end if;
  begin
    insert into public.quote_requests(request_token,kind,contact_name,phone,location,description,status) values(gen_random_uuid(),'service','QA','0500000000','QA','forged derived status','quoted');
    raise exception 'FAILED: derived status writable';
  exception when insufficient_privilege then null;end;
  insert into rfq_qa_results values('customer cannot set derived fields, review a request, or gain admin via user_metadata');
  begin
    perform public.submit_quote_request(v_payload||jsonb_build_object('request_token',gen_random_uuid(),'items',jsonb_build_array(jsonb_build_object('product_id',(select quote_product from rfq_qa_ids),'quantity',9))));
    raise exception 'FAILED: max quantity accepted';
  exception when others then if sqlerrm not like '%MAX_QUANTITY%' then raise;end if;end;
  begin
    perform public.create_customer_order(jsonb_build_array(jsonb_build_object('product_id',(select quote_product from rfq_qa_ids),'quantity',1)),null,null,'{}'::jsonb);
    raise exception 'FAILED: unpriced checkout accepted';
  exception when others then if sqlerrm not like '%QUOTE_ITEMS_REQUIRE_REVIEW%' then raise;end if;end;
  insert into rfq_qa_results values('invalid quantity and zero-price legacy checkout blocked');
  v_order:=public.create_customer_order(jsonb_build_array(jsonb_build_object('product_id',(select fixed_product from rfq_qa_ids),'quantity',1)),null,null,'{}'::jsonb);
  if v_order->>'order_id' is null or v_order->>'status'<>'pending' then raise exception 'FAILED: fixed-price checkout regression';end if;
  insert into rfq_qa_results values('fixed-price products retain the existing order checkout');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',user_b,'role','authenticated','app_metadata',jsonb_build_object('role','individual'))::text,true) from rfq_qa_ids;
do $$ begin
  if exists(select 1 from public.quote_requests where user_id=(select user_a from rfq_qa_ids)) then raise exception 'FAILED: customer privacy';end if;
  insert into rfq_qa_results values('another customer cannot read any request from the submitter');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true) from rfq_qa_ids;
do $$
declare v public.quote_requests%rowtype; v_quoted public.quote_requests%rowtype;
begin
  select * into v from public.quote_requests where user_id=(select user_a from rfq_qa_ids) and kind='products';
  if v.id is null then raise exception 'FAILED: admin cannot see request';end if;
  if not exists(select 1 from public.notifications where user_id=(select admin_id from rfq_qa_ids) and entity_id=v.id and event_type='quote_request_submitted') then raise exception 'FAILED: admin notification';end if;
  v_quoted:=public.admin_review_quote_request(v.id,'quoted','يشمل الإجمالي المنتجات والتوريد والضريبة وفق النطاق المذكور.',850,current_date+7,v.updated_at);
  if v_quoted.status<>'quoted' or v_quoted.quote_amount<>850 then raise exception 'FAILED: quotation reply';end if;
  if not exists(select 1 from public.notifications where user_id=(select user_a from rfq_qa_ids) and entity_id=v.id and event_type='quote_request_updated') then raise exception 'FAILED: customer reply notification';end if;
  begin
    perform public.admin_review_quote_request(v.id,'in_review','Stale reply',null,null,v.updated_at);
    raise exception 'FAILED: stale overwrite';
  exception when others then if sqlerrm not like '%REQUEST_CHANGED%' then raise;end if;end;
  insert into rfq_qa_results values('admin receives request notification; quote reply notifies customer; stale edits rejected');
end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
  begin perform public.submit_quote_request('{}'::jsonb);raise exception 'FAILED: anonymous submit';exception when insufficient_privilege then null;end;
  begin perform 1 from public.quote_requests;raise exception 'FAILED: anonymous read';exception when insufficient_privilege then null;end;
  insert into rfq_qa_results values('anonymous submission and request reads are denied');
end $$;
reset role;
select check_name as passed from rfq_qa_results;
rollback;
