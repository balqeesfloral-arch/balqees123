-- Run as postgres against the configured Supabase project. The transaction is
-- rolled back; no QA users, products, quotations or notifications are retained.
-- No schema objects are created or changed by this verification.
begin;
do $$
declare
  v_a uuid:=gen_random_uuid(); v_b uuid:=gen_random_uuid(); v_admin uuid:=gen_random_uuid();
  v_p1 uuid:=gen_random_uuid(); v_p2 uuid:=gen_random_uuid(); v_token uuid:=gen_random_uuid();
  v_request public.quote_requests%rowtype; v_repeat public.quote_requests%rowtype; v_quote public.quote_requests%rowtype;
  v_payload jsonb; v_count integer; v_checks text[]:='{}'::text[];
begin
  insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data) values
    (v_a,'rfq-wa-a-'||v_a||'@example.test','authenticated','authenticated','{"role":"individual"}','{"role":"admin","account_type":"individual"}'),
    (v_b,'rfq-wa-b-'||v_b||'@example.test','authenticated','authenticated','{"role":"individual"}','{"account_type":"individual"}'),
    (v_admin,'rfq-wa-admin-'||v_admin||'@example.test','authenticated','authenticated','{"role":"admin"}','{}');
  insert into public.products(id,name_ar,name_en,slug,base_price,price_on_request,is_active,visibility,stock_mode,stock_quantity,min_order_quantity,max_order_quantity) values
    (v_p1,'ورد اختبار واتساب','QA WhatsApp flowers','qa-wa-'||v_p1,null,true,true,'public','made_to_order',0,1,10),
    (v_p2,'مركن اختبار واتساب','QA WhatsApp planter','qa-wa-'||v_p2,null,true,true,'public','made_to_order',0,1,10);
  update public.system_settings set value=jsonb_set(value,'{enabled}','true') where key='store';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated','app_metadata',jsonb_build_object('role','individual'),'user_metadata',jsonb_build_object('role','admin'))::text,true);
  v_payload:=jsonb_build_object('request_token',v_token,'kind','products','contact_name','عميل اختبار واتساب','phone','0500000000','location','مكة — موقع اختبار','description','اختبار تسعير منتجات من دون عميل حقيقي','items',jsonb_build_array(jsonb_build_object('product_id',v_p1,'quantity',2,'name_ar','FORGED','price',1),jsonb_build_object('product_id',v_p2,'quantity',3)));
  v_request:=public.submit_quote_request(v_payload);
  v_repeat:=public.submit_quote_request(v_payload);
  if v_request.id<>v_repeat.id or v_request.request_number is null or v_request.status<>'submitted' then raise exception 'FAILED: saved receipt/idempotency'; end if;
  if jsonb_array_length(v_request.product_snapshot)<>2 or v_request.product_snapshot->0->>'name_ar'<>'ورد اختبار واتساب' or (v_request.product_snapshot->0->>'quantity')::numeric<>2 or (v_request.product_snapshot->1->>'quantity')::numeric<>3 or v_request.product_snapshot->0->>'reference_base_price' is not null then raise exception 'FAILED: canonical quote-only cart'; end if;
  v_checks:=array_append(v_checks,'PASS: quote-only cart saved once with number and canonical product quantities');
  begin
    perform public.admin_review_quote_request(v_request.id,'quoted','Forged customer price',1,null,v_request.updated_at);
    raise exception 'FAILED: customer set price';
  exception when others then if sqlerrm not like '%ADMIN_REQUIRED%' then raise; end if; end;
  update public.quote_requests set status='quoted',quote_amount=1 where id=v_request.id;
  get diagnostics v_count=row_count; if v_count<>0 then raise exception 'FAILED: direct customer price update'; end if;
  v_checks:=array_append(v_checks,'PASS: customer and forged user_metadata cannot price the request');

  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated','app_metadata',jsonb_build_object('role','individual'))::text,true);
  if exists(select 1 from public.quote_requests where id=v_request.id) then raise exception 'FAILED: foreign request deep link'; end if;
  v_checks:=array_append(v_checks,'PASS: another customer cannot read the linked RFQ');

  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true);
  if not exists(select 1 from public.quote_requests where id=v_request.id) then raise exception 'FAILED: admin linked request'; end if;
  if not exists(select 1 from public.notifications where user_id=v_admin and entity_id=v_request.id and event_type='quote_request_submitted' and action_url='/admin/quote-requests?request='||v_request.id) then raise exception 'FAILED: admin request notification'; end if;
  v_quote:=public.admin_review_quote_request(v_request.id,'quoted','يشمل العرض المنتجات المطلوبة والتوريد والضريبة وفق النطاق المذكور.',1500.50,current_date+7,v_request.updated_at);
  if v_quote.quote_amount<>1500.50 or v_quote.status<>'quoted' then raise exception 'FAILED: saved quotation'; end if;
  begin
    perform public.admin_review_quote_request(v_request.id,'quoted','Stale quotation',10,null,v_request.updated_at);
    raise exception 'FAILED: stale price overwrite';
  exception when others then if sqlerrm not like '%REQUEST_CHANGED%' then raise; end if; end;
  v_checks:=array_append(v_checks,'PASS: authorized admin saves price; stale edits are rejected');

  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated','app_metadata',jsonb_build_object('role','individual'))::text,true);
  select * into v_quote from public.quote_requests where id=v_request.id;
  if v_quote.status<>'quoted' or v_quote.quote_amount<>1500.50 then raise exception 'FAILED: customer quotation read'; end if;
  if not exists(select 1 from public.notifications where user_id=v_a and entity_id=v_request.id and event_type='quote_request_updated' and action_url='/request-quote?request='||v_request.id) then raise exception 'FAILED: customer quotation notification'; end if;
  v_checks:=array_append(v_checks,'PASS: saved price and quotation notification visible in customer account');

  execute 'set local role anon';
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  begin perform 1 from public.quote_requests where id=v_request.id; raise exception 'FAILED: public review link'; exception when insufficient_privilege then null; end;
  begin perform public.admin_review_quote_request(v_request.id,'quoted','Anonymous quotation',1,null,null); raise exception 'FAILED: anonymous pricing'; exception when insufficient_privilege then null; end;
  v_checks:=array_append(v_checks,'PASS: link grants no anonymous read or pricing permission');
  execute 'reset role';
  perform set_config('balqees.qa_rfq_whatsapp_results',array_to_json(v_checks)::text,true);
end $$;
select json_array_elements_text(current_setting('balqees.qa_rfq_whatsapp_results')::json) as passed;
rollback;
