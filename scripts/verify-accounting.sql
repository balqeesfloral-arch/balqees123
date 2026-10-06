-- Real Postgres/RLS verification. The entire transaction is rolled back.
-- No Drive/Sheets calls, real customers, persistent notifications or files.
begin;
create temporary table acct_qa as select gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() admin,
 gen_random_uuid() org,gen_random_uuid() finance,gen_random_uuid() viewer,gen_random_uuid() scoped,
 gen_random_uuid() site,gen_random_uuid() payment,gen_random_uuid() payment2,
 gen_random_uuid() statement,gen_random_uuid() doc,null::uuid link_a,null::uuid link_b,null::uuid link_org;
grant select,update on acct_qa to authenticated,anon,service_role;
create temporary table acct_results(check_name text);
grant insert,select on acct_results to authenticated,anon,service_role;
create function pg_temp.acct_assert(ok boolean,msg text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',msg;end if;end $$;
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data)
 select v.id,'accounting-qa-'||v.id||'@example.test','authenticated','authenticated',jsonb_build_object('role',v.role),'{}'::jsonb
 from acct_qa q cross join lateral (values(q.a,'individual'),(q.b,'individual'),(q.admin,'admin'),(q.finance,'individual'),(q.viewer,'individual'),(q.scoped,'individual')) v(id,role);
insert into public.organizations(id,legal_name,display_name) select org,'Accounting test organization','Accounting QA' from acct_qa;
insert into public.organization_members(organization_id,user_id,member_role,status)
 select org,finance,'finance','active' from acct_qa union all select org,viewer,'viewer','active' from acct_qa union all select org,scoped,'finance','active' from acct_qa;
insert into public.organization_sites(id,organization_id,name_ar) select site,org,'موقع اختبار' from acct_qa;
insert into public.organization_member_site_access(organization_id,user_id,site_id) select org,scoped,site from acct_qa;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
update acct_qa set link_a=(public.accounting_bind_client('QA-A-'||a,'عميل اختبار أ',a,null,'qa')).id,
 link_b=(public.accounting_bind_client('QA-B-'||b,'عميل اختبار ب',b,null,'qa')).id,
 link_org=(public.accounting_bind_client('QA-ORG-'||org,'منشأة اختبار',null,org,'qa')).id;
do $$ declare q record;begin
 select * into q from acct_qa;
 perform pg_temp.acct_assert((public.accounting_bind_client('QA-A-'||q.a,'عميل اختبار أ',q.a,null,'qa')).id=q.link_a,'mapping is idempotent');
 begin perform public.accounting_bind_client('QA-A-'||q.a,'other',q.b,null,'qa');raise exception 'FAILED: remapping allowed';exception when others then if sqlerrm not like '%MAPPING_IMMUTABLE%' then raise;end if;end;
 insert into acct_results values('explicit mapping is idempotent and cannot be reassigned');
end $$;
reset role;
insert into storage.objects(bucket_id,name,owner_id,metadata)
 select 'accounting-proofs',a||'/'||payment||'.pdf',a::text,'{"mimetype":"application/pdf","size":100}'::jsonb from acct_qa union all
 select 'accounting-proofs',a||'/'||payment2||'.pdf',a::text,'{"mimetype":"application/pdf","size":100}'::jsonb from acct_qa union all
 select 'accounting-documents',link_a||'/'||doc||'.pdf',null,'{"mimetype":"application/pdf","size":100}'::jsonb from acct_qa;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('role','individual'),'user_metadata',jsonb_build_object('role','admin'))::text,true) from acct_qa;
do $$ declare q record; p public.accounting_payments; p2 public.accounting_payments;begin
 select * into q from acct_qa;
 perform pg_temp.acct_assert((select count(*)=1 from public.accounting_links where id in (q.link_a,q.link_b,q.link_org)),'individual reads only own account');
 begin perform public.accounting_admin_access();raise exception 'FAILED: user_metadata admin accepted';exception when others then if sqlerrm not like '%ADMIN_REQUIRED%' then raise;end if;end;
 begin perform public.accounting_bind_client('bad','bad',q.a,null,'forged');raise exception 'FAILED: browser linked client';exception when insufficient_privilege then null;end;
 p:=public.accounting_submit_payment(q.payment,q.link_a,125.50,current_date,'bank_transfer','BANK-QA','Test',q.a||'/'||q.payment||'.pdf');
 p2:=public.accounting_submit_payment(q.payment,q.link_a,125.50,current_date,'bank_transfer','BANK-QA','Test',q.a||'/'||q.payment||'.pdf');
 perform pg_temp.acct_assert(p.id=p2.id and p.status='pending' and p.office_transfer_id is null,'upload is one unverified pending proof');
 perform public.accounting_submit_payment(q.payment2,q.link_a,10,current_date,'cash','CASH-QA','',q.a||'/'||q.payment2||'.pdf');
 begin perform public.accounting_submit_payment(q.payment,q.link_a,1,current_date,'bank_transfer','BANK-QA','Test',q.a||'/'||q.payment||'.pdf');raise exception 'FAILED: reused id with changed amount';exception when others then if sqlerrm not like '%REQUEST_REUSED%' then raise;end if;end;
 begin update public.accounting_payments set status='recorded',office_transfer_id='FORGED' where id=q.payment;raise exception 'FAILED: customer self-certifies';exception when insufficient_privilege then null;end;
 begin perform public.accounting_claim_payment(q.payment,'forged');raise exception 'FAILED: customer imports';exception when insufficient_privilege then null;end;
 begin perform public.accounting_submit_payment(gen_random_uuid(),q.link_b,1,current_date,'cash','BAD','',q.a||'/'||q.payment||'.pdf');raise exception 'FAILED: cross-client proof';exception when others then if sqlerrm not like '%ACCESS_DENIED%' then raise;end if;end;
 begin delete from storage.objects where bucket_id='accounting-proofs' and name=q.a||'/'||q.payment||'.pdf';exception when insufficient_privilege then null;end;
 perform pg_temp.acct_assert(exists(select 1 from storage.objects where bucket_id='accounting-proofs' and name=q.a||'/'||q.payment||'.pdf'),'evidence is immutable');
 insert into acct_results values('customer isolation, proof idempotency, immutable evidence and no self-certification');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated','app_metadata',jsonb_build_object('role','individual'))::text,true) from acct_qa;
do $$declare q record;begin select * into q from acct_qa;
 perform pg_temp.acct_assert(not exists(select 1 from public.accounting_payments where id=q.payment),'other customer cannot read proof');
 perform pg_temp.acct_assert(not exists(select 1 from storage.objects where bucket_id='accounting-proofs' and name=q.a||'/'||q.payment||'.pdf'),'other customer cannot download proof');
 insert into acct_results values('cross-customer financial rows and private files are inaccessible');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',finance,'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('role','individual'))::text,true) from acct_qa;
select pg_temp.acct_assert(exists(select 1 from public.accounting_links where id=(select link_org from acct_qa)),'finance member sees organization account');
select set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','app_metadata',jsonb_build_object('role','individual'))::text,true) from acct_qa;
select pg_temp.acct_assert(not exists(select 1 from public.accounting_links where id=(select link_org from acct_qa)),'viewer cannot see organization finance');
select set_config('request.jwt.claims',jsonb_build_object('sub',scoped,'role','authenticated','app_metadata',jsonb_build_object('role','individual'))::text,true) from acct_qa;
select pg_temp.acct_assert(not exists(select 1 from public.accounting_links where id=(select link_org from acct_qa)),'site-scoped finance cannot read whole organization statement');
insert into acct_results values('organization financial permission and site scope are enforced');
reset role;
update public.organization_members set mfa_required=true where user_id=(select finance from acct_qa);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',finance,'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('role','individual'))::text,true) from acct_qa;
select pg_temp.acct_assert(not exists(select 1 from public.accounting_links where id=(select link_org from acct_qa)),'organization required MFA enforced');
select set_config('request.jwt.claims',jsonb_build_object('sub',finance,'role','authenticated','aal','aal2','app_metadata',jsonb_build_object('role','individual'))::text,true) from acct_qa;
select pg_temp.acct_assert(exists(select 1 from public.accounting_links where id=(select link_org from acct_qa)),'aal2 restores authorized finance access');
reset role;
update public.organization_members set status='removed' where user_id=(select finance from acct_qa);
set local role authenticated;
select pg_temp.acct_assert(not exists(select 1 from public.accounting_links where id=(select link_org from acct_qa)),'removed member is immediately denied');
insert into acct_results values('MFA requirements and current organization membership are checked');
select set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('role','admin'))::text,true) from acct_qa;
select pg_temp.acct_assert((public.accounting_admin_access()->>'user_id')=(select admin::text from acct_qa),'fresh admin verification');
select pg_temp.acct_assert(exists(select 1 from public.notifications where user_id=(select admin from acct_qa) and action_url='/admin/accounting'),'admin receives proof inbox notification');
reset role;
update auth.users set raw_app_meta_data='{"role":"individual"}'::jsonb where id=(select admin from acct_qa);
set local role authenticated;
do $$begin
 begin perform public.accounting_admin_access();raise exception 'FAILED: stale admin accepted';exception when others then if sqlerrm not like '%ADMIN_REQUIRED%' then raise;end if;end;
 perform pg_temp.acct_assert(not exists(select 1 from public.accounting_links where id in(select link_a from acct_qa union all select link_org from acct_qa)),'stale admin cannot read through B2B helpers');
 insert into acct_results values('revoked admin JWT is denied immediately');
end $$;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$declare q record;c jsonb;c2 jsonb;p public.accounting_payments;s public.accounting_statements;d public.accounting_documents;begin
 select * into q from acct_qa;
 c:=public.accounting_claim_payment(q.payment,'qa');c2:=public.accounting_claim_payment(q.payment,'qa');
 perform pg_temp.acct_assert((c->>'can_append')::boolean and not (c2->>'can_append')::boolean,'one append claim');
 begin perform public.accounting_finish_payment(q.payment,(c->>'token')::uuid,true,'forged','qa');raise exception 'FAILED: finish without append marker';exception when others then if sqlerrm not like '%NOT_APPENDED%' then raise;end if;end;
 perform public.accounting_mark_append(q.payment,(c->>'token')::uuid);
 begin perform public.accounting_mark_append(q.payment,(c->>'token')::uuid);raise exception 'FAILED: repeated append allowed';exception when others then if sqlerrm not like '%ALREADY_STARTED%' then raise;end if;end;
 p:=public.accounting_finish_payment(q.payment,(c->>'token')::uuid,false,'timeout','qa');
 perform pg_temp.acct_assert(p.status='needs_review','ambiguous append needs reconciliation');
 c2:=public.accounting_claim_payment(q.payment,'qa');perform pg_temp.acct_assert(not (c2->>'can_append')::boolean,'retry after timeout cannot append');
 p:=public.accounting_finish_payment(q.payment,(c2->>'token')::uuid,true,'matched ledger','qa');
 perform pg_temp.acct_assert(p.status='recorded' and p.office_transfer_id='WEB-'||q.payment::text,'verified import records canonical reference');
 c2:=public.accounting_claim_payment(q.payment,'qa');perform pg_temp.acct_assert(not (c2->>'can_append')::boolean and c2->'payment'->>'status'='recorded','recorded import is idempotent');
 p:=public.accounting_reject_payment(q.payment2,'مرجع غير واضح','qa');perform pg_temp.acct_assert(p.status='rejected','rejection records reason');
 s:=public.accounting_publish_statement(q.statement,q.link_a,jsonb_build_object('type','client_statement','client',jsonb_build_object('id','QA-A-'||q.a),'statementNo','QA-ST','rows','[]'::jsonb,'summary',jsonb_build_object('closingBalance',125.50)),'qa');
 perform pg_temp.acct_assert(s.id=q.statement,'statement published');
 d:=public.accounting_publish_document(q.doc,q.link_a,'فاتورة اختبار','invoice',q.link_a||'/'||q.doc||'.pdf','test.pdf','qa');
 perform pg_temp.acct_assert(d.id=q.doc,'private document published');
 insert into acct_results values('claim locking, durable append marker, timeout reconciliation, rejection and publication');
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','app_metadata',jsonb_build_object('role','individual'))::text,true) from acct_qa;
do $$declare q record;begin select * into q from acct_qa;
 perform pg_temp.acct_assert(exists(select 1 from public.accounting_statements where id=q.statement),'customer receives statement');
 perform pg_temp.acct_assert(exists(select 1 from storage.objects where bucket_id='accounting-documents' and name=q.link_a||'/'||q.doc||'.pdf'),'customer can access published file');
 perform pg_temp.acct_assert((select count(*)=4 from public.notifications where user_id=q.a and category='finance' and dedupe_key like 'accounting-%'),'publication and payment review notify customer');
 insert into acct_results values('customer delivery, private download access and in-app notifications');
end $$;
reset role;
update auth.users set banned_until=now()+interval '1 day' where id=(select a from acct_qa);
set local role authenticated;
select pg_temp.acct_assert(not exists(select 1 from public.accounting_links where id=(select link_a from acct_qa)),'blocked customer cannot read link');
select pg_temp.acct_assert(not exists(select 1 from storage.objects where bucket_id='accounting-proofs' and name=(select a||'/'||payment||'.pdf' from acct_qa)),'blocked customer cannot download evidence');
insert into acct_results values('blocked users lose row and file access');
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$begin
 begin perform 1 from public.accounting_links;raise exception 'FAILED: anonymous read';exception when insufficient_privilege then null;end;
 begin perform public.accounting_admin_access();raise exception 'FAILED: anonymous RPC';exception when insufficient_privilege then null;end;
 insert into acct_results values('anonymous reads and RPCs are denied');
end $$;
reset role;
select check_name as passed from acct_results;
rollback;
