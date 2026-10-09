-- Every fixture, audit event and notification is rolled back. No Google writes.
begin;
create temporary table office_qa as select gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() admin,
 gen_random_uuid() org,gen_random_uuid() request,gen_random_uuid() rfq,gen_random_uuid() order_a,gen_random_uuid() order_b,
 gen_random_uuid() payment,gen_random_uuid() job,gen_random_uuid() quote,null::uuid link_a,null::uuid link_b;
grant select,update on office_qa to authenticated,anon,service_role;
create temporary table office_results(check_name text);
grant select,insert on office_results to authenticated,anon,service_role;
create function pg_temp.office_assert(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAILED: %',msg;end if;end $$;
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data)
 select x.id,'office-link-qa-'||x.id||'@example.test','authenticated','authenticated',jsonb_build_object('role',x.role),'{}'::jsonb
 from office_qa q cross join lateral(values(q.a,'individual'),(q.b,'individual'),(q.admin,'admin'))x(id,role);
insert into public.customer_profiles(id,account_type,role,username,full_name,phone)
 select a,'individual','customer','qa'||replace(a::text,'-',''),'Office link QA','0500000000' from office_qa on conflict(id) do nothing;
insert into public.organizations(id,legal_name,display_name) select org,'Office link QA org','Office link QA' from office_qa;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('role','individual'))::text,true) from office_qa;
with inserted as (insert into public.quote_requests(request_token,kind,service_type,contact_name,phone,location,description,frequency)
 select gen_random_uuid(),'service','weekly_flowers','QA customer','0500000000','مكة','توريد ورد أسبوعي للاختبار','weekly' from office_qa returning id)
 update office_qa set rfq=(select id from inserted);
reset role;
insert into public.organization_service_requests(id,organization_id,created_by,status,description,service_type,service_area,submission_goal)
 select request,org,a,'submitted','توريد أسبوعي للاختبار','supply','reception','quotation' from office_qa;
insert into public.orders(id,user_id,status,subtotal,vat_total,total,payment_method,payment_status)
 select order_a,a,'pending',100,15,115,'external','pending' from office_qa union all
 select order_b,a,'pending',100,15,115,'external','pending' from office_qa;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
update office_qa set link_a=(public.accounting_bind_client('OFFICE-QA-A-'||a,'QA customer',a,null,'office:qa')).id,
 link_b=(public.accounting_bind_client('OFFICE-QA-B-'||b,'Other QA customer',b,null,'office:qa')).id;
do $$ declare q record; c jsonb; again jsonb; token uuid; payload jsonb;begin
 select * into q from office_qa;
 payload:=jsonb_build_object('entity','projects','record',jsonb_build_object('client_id','OFFICE-QA-A-'||q.a,'name','QA order','contract_value',115));
 c:=public.office_sync_claim('orders',q.order_a,q.link_a,payload,'office:qa');
 token:=(c->>'token')::uuid;
 perform pg_temp.office_assert((c->>'can_append')::boolean,'first claim can append');
 begin perform public.office_sync_claim('orders',q.order_a,q.link_a,payload,'office:qa');raise exception 'FAILED: two writers';exception when others then if sqlerrm not like '%IMPORT_BUSY%' then raise;end if;end;
 perform public.office_sync_mark_append((c->'job'->>'id')::uuid,token);
 perform public.office_sync_finish((c->'job'->>'id')::uuid,token,false,'office:qa');
 again:=public.office_sync_claim('orders',q.order_a,q.link_a,payload,'office:qa');
 perform pg_temp.office_assert(not (again->>'can_append')::boolean,'ambiguous append is never retried');
 begin perform public.office_sync_mark_append((c->'job'->>'id')::uuid,token);raise exception 'FAILED: stale token accepted';exception when others then if sqlerrm not like '%IMPORT_CHANGED%' then raise;end if;end;
 perform public.office_sync_finish((again->'job'->>'id')::uuid,(again->>'token')::uuid,true,'office:qa');
 c:=public.office_sync_claim('orders',q.order_a,q.link_a,payload,'office:qa');
 perform pg_temp.office_assert(c->'job'->>'status'='recorded' and not (c->>'can_append')::boolean,'recorded import is idempotent');
 begin perform public.office_sync_claim('orders',q.order_a,q.link_b,jsonb_build_object('entity','projects','record',jsonb_build_object('client_id','OFFICE-QA-B-'||q.b)),'office:qa');raise exception 'FAILED: remapped job';exception when others then if sqlerrm not like '%MAPPING_IMMUTABLE%' then raise;end if;end;
 insert into office_results values('durable claim, one writer, stale token rejection, reconciliation and immutable mapping');
end $$;
do $$ declare q record; r public.quote_requests; response jsonb; again jsonb; command uuid:=gen_random_uuid(); old_version timestamptz; n int;begin
 select * into q from office_qa;select * into r from public.quote_requests where id=q.rfq;old_version:=r.updated_at;
 response:=public.office_update_request(r.id,'rfq','{"status":"quoted","reply":"توريد أسبوعي شامل الضريبة","amount":115}'::jsonb,old_version,command,'office:qa');
 perform pg_temp.office_assert(response->>'status'='quoted' and (response->>'quote_amount')::numeric=115,'Office prices RFQ without impersonating customer');
 select count(*) into n from public.notifications where user_id=q.a and entity_id=r.id;
 perform pg_temp.office_assert(n>0,'RFQ reply notifies customer');
 again:=public.office_update_request(r.id,'rfq','{"status":"quoted","reply":"توريد أسبوعي شامل الضريبة","amount":115}'::jsonb,old_version,command,'office:qa');
 perform pg_temp.office_assert(response=again,'lost review response returns original result');
 begin perform public.office_update_request(r.id,'rfq','{"status":"closed"}',old_version,gen_random_uuid(),'office:qa');raise exception 'FAILED: stale edit accepted';exception when others then if sqlerrm not like '%SOURCE_CHANGED%' then raise;end if;end;
 begin perform public.office_update_request(r.id,'rfq','{"status":"quoted","amount":1}',old_version,command,'office:qa');raise exception 'FAILED: command reused';exception when others then if sqlerrm not like '%COMMAND_REUSED%' then raise;end if;end;
 insert into office_results values('RFQ pricing, customer notification, command idempotency and optimistic concurrency');
end $$;
do $$ declare q record; s public.organization_service_requests; quote jsonb; again jsonb;begin
 select * into q from office_qa;select * into s from public.organization_service_requests where id=q.request;
 quote:=public.office_quote_organization(q.quote,s.id,115,15,'توريد أسبوعي شامل الضريبة',null,s.updated_at,'office:qa');
 perform pg_temp.office_assert(quote->>'status'='sent' and (quote->>'total')::numeric=115 and (quote->>'vat_total')::numeric=15,'organization quote uses existing VAT rules');
 again:=public.office_quote_organization(q.quote,s.id,115,15,'توريد أسبوعي شامل الضريبة',null,s.updated_at,'office:qa');
 perform pg_temp.office_assert(again=quote,'organization quote retry is idempotent');
 perform pg_temp.office_assert((select count(*)=1 from public.quotation_items where quotation_id=q.quote),'one quotation line');
 select * into s from public.organization_service_requests where id=q.request;
 begin perform public.office_quote_organization(gen_random_uuid(),s.id,115,15,'نفس العرض المكرر',null,s.updated_at,'office:qa');raise exception 'FAILED: duplicated current quote';exception when others then if sqlerrm not like '%QUOTATION_EXISTS%' then raise;end if;end;
 perform pg_temp.office_assert(exists(select 1 from public.notifications where organization_id=q.org and metadata->>'quotation_id'=q.quote::text),'organization quote notifies portal');
 insert into office_results values('organization scope, VAT, quotation publishing, customer notification and duplicate prevention');
end $$;
reset role;
-- Fixtures stand in for a proof already verified by the real ledger adapter.
insert into storage.objects(bucket_id,name,owner_id,metadata)
 select 'accounting-proofs',a||'/'||payment||'.pdf',a::text,'{"mimetype":"application/pdf","size":100}'::jsonb from office_qa;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('role','individual'))::text,true) from office_qa;
select public.accounting_submit_payment(payment,link_a,115,current_date,'bank_transfer','OFFICE-QA','',a||'/'||payment||'.pdf') from office_qa;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
update public.accounting_payments set status='recorded',office_transfer_id='WEB-'||id where id=(select payment from office_qa);
do $$ declare q record; o public.orders; paid jsonb;begin
 select * into q from office_qa;select * into o from public.orders where id=q.order_a;
 paid:=public.office_apply_order_payment(o.id,q.payment,o.updated_at,'office:qa');
 perform pg_temp.office_assert(paid->>'payment_status'='paid','verified Office proof pays matching order');
 perform public.office_apply_order_payment(o.id,q.payment,o.updated_at,'office:qa');
 select * into o from public.orders where id=q.order_b;
 begin perform public.office_apply_order_payment(o.id,q.payment,o.updated_at,'office:qa');raise exception 'FAILED: proof paid two orders';exception when others then if sqlerrm not like '%PAYMENT_ALLOCATED%' then raise;end if;end;
 insert into office_results values('verified order payment, exact account/amount and no proof reuse');
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('role','individual'),'user_metadata',jsonb_build_object('role','admin'))::text,true) from office_qa;
do $$ declare q record;begin
 select * into q from office_qa;
 begin perform public.office_sync_state('orders',array[q.order_a]);raise exception 'FAILED: customer reads jobs';exception when insufficient_privilege then null;end;
 begin perform public.office_update_request(q.order_b,'orders','{"status":"completed"}',now(),gen_random_uuid(),'office:forged');raise exception 'FAILED: customer changes order';exception when insufficient_privilege then null;end;
 begin perform public.office_apply_order_payment(q.order_b,q.payment,now(),'office:forged');raise exception 'FAILED: customer certifies payment';exception when insufficient_privilege then null;end;
 begin perform public.admin_review_quote_request(q.rfq,'quoted','forged',1,null,null);raise exception 'FAILED: metadata role escalated';exception when others then if sqlerrm not like '%ADMIN_REQUIRED%' then raise;end if;end;
 insert into office_results values('customer cannot import, review, read jobs or certify orders via metadata forgery');
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('role','admin'))::text,true) from office_qa;
update auth.users set raw_app_meta_data='{"role":"individual"}' where id=(select admin from office_qa);
set local role authenticated;
do $$begin
 perform pg_temp.office_assert(not private.rfq_is_admin(),'stale admin claim is revoked for RFQ too');
 insert into office_results values('revoked admin JWT cannot review RFQs');
end $$;
reset role;
select jsonb_build_object('passed',jsonb_agg(check_name),'fixture_transaction','rolled_back') result from office_results;
rollback;
