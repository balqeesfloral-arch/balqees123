import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createOfficeLinkService} from '../integrations/smart-office/lib/office-link-service.js';
import {importPayload,clientPayload,validateQuoteInput,verifyImportedRecord,officeSource} from '../integrations/smart-office/lib/office-link-domain.js';
const id='20000000-0000-4000-8000-000000000001',linkId='20000000-0000-4000-8000-000000000002',userId='20000000-0000-4000-8000-000000000003',jobId='20000000-0000-4000-8000-000000000004',paymentId='20000000-0000-4000-8000-000000000005';
const link={id:linkId,user_id:userId,is_active:true,office_client_id:'office-one',office_client_name:'العميل'};
const order={id,user_id:userId,status:'approved',order_number:42,total:115,updated_at:'2026-10-09T12:00:00Z',created_at:'2026-10-09T11:00:00Z',payment_status:'pending'};
function fixture({lostAppend=false,lostMark=false,lostFinish=false,prepareFailure=false}={}) {
  const state={job:null,record:null,appends:0,calls:[],sources:{orders:order},proof:null};
  const store={
    async one(table,key){if(table==='accounting_links')return key===linkId?link:null;if(table==='orders')return state.sources.orders;if(table==='accounting_payments')return state.proof;return null;},
    async select(){return [];},
    async rpc(name,p){state.calls.push({name,p});
      if(name==='office_sync_claim'){
        if(state.job?.status==='importing')throw Error('busy');
        state.job||={id:jobId,source_id:p.p_source,source_kind:p.p_kind,link_id:p.p_link,payload:p.p_payload,append_started:false,status:'pending'};
        if(state.job.status!=='recorded')state.job.status='importing';
        return {job:{...state.job},token:id,can_append:!state.job.append_started};
      }
      if(name==='office_sync_mark_append'){state.job.append_started=true;if(lostMark){lostMark=false;throw Error('lost marker response');}return;}
      if(name==='office_sync_finish'){
        if(lostFinish&&p.p_recorded){lostFinish=false;throw Error('lost finish response');}
        state.job.status=p.p_recorded?'recorded':state.job.append_started?'needs_review':'pending';return {...state.job};
      }
      if(name==='office_apply_order_payment')return {...order,payment_status:'paid'};
      if(name==='office_update_request')return {...order,status:p.p_patch.status};
      throw Error(`Unexpected RPC ${name}`);
    },
  };
  const ledger={
    async findRecord(){return state.record;},
    async prepareRecord(job){if(prepareFailure)throw Error('schema unavailable');return {id:job.id,...job.payload.record};},
    async appendRecord(record){state.appends++;state.record=record;if(lostAppend)throw Error('Google append accepted; response lost');},
    async find(){return state.transfer;},
  };
  return {state,store,ledger,service:createOfficeLinkService({store,ledger})};
}
const input={kind:'orders',id,linkId};
test('an imported order uses website totals and an exact accounting identity',async()=>{
  const f=fixture();await f.service('importOperation',{...input,total:1,client_id:'attacker'},'office:qa');
  assert.equal(f.state.record.contract_value,115);assert.equal(f.state.record.client_id,'office-one');assert.equal(f.state.appends,1);
  await f.service('importOperation',input,'office:qa');assert.equal(f.state.appends,1);
  assert.deepEqual(f.state.calls.map(c=>c.name).slice(0,3),['office_sync_claim','office_sync_mark_append','office_sync_finish']);
});
test('lost append and lost finish responses reconcile without another Sheets append',async()=>{
  for(const options of [{lostAppend:true},{lostFinish:true}]){
    const f=fixture(options);await assert.rejects(f.service('importOperation',input,'office:qa'));
    assert.equal(f.state.job.status,'needs_review');await f.service('importOperation',input,'office:qa');assert.equal(f.state.appends,1);assert.equal(f.state.job.status,'recorded');
  }
});
test('a lost durable marker with no row cannot cause a second append',async()=>{
  const f=fixture({lostMark:true});await assert.rejects(f.service('importOperation',input,'office:qa'));
  assert.equal(f.state.job.status,'needs_review');assert.equal(f.state.appends,0);
  await assert.rejects(f.service('importOperation',input,'office:qa'),{code:'RECONCILE_REQUIRED'});assert.equal(f.state.appends,0);
});
test('a failed preparation does not mark or append an import',async()=>{
  const f=fixture({prepareFailure:true});await assert.rejects(f.service('importOperation',input,'office:qa'));
  assert.equal(f.state.job.status,'pending');assert.equal(f.state.job.append_started,false);assert.equal(f.state.appends,0);
});
test('parallel imports get at most one writer',async()=>{
  const f=fixture();const r=await Promise.allSettled([f.service('importOperation',input,'office:a'),f.service('importOperation',input,'office:b')]);
  assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.state.appends,1);
});
test('order and organization imports reject a cross-account mapping',()=>{
  assert.throws(()=>importPayload('orders',order,{...link,user_id:id}),{code:'CLIENT_MISMATCH'});
  assert.throws(()=>importPayload('requests',{...order,organization_id:id},link),{code:'CLIENT_MISMATCH'});
});
test('RFQ quote import preserves VAT-inclusive totals and cannot import unpriced requests',()=>{
  const rfq={...order,request_number:3,status:'quoted',quote_amount:115,admin_reply:'توريد شامل الضريبة'};
  const p=importPayload('rfq',rfq,link,{vatRate:15});assert.equal(p.record.total,115);assert.equal(p.record.subtotal,100);assert.equal(p.record.vat_amount,15);
  assert.throws(()=>importPayload('rfq',{...rfq,status:'in_review'},link),{code:'PRICE_REQUIRED'});
  assert.throws(()=>importPayload('orders',{...order,status:'cancelled'},link),{code:'SOURCE_NOT_READY'});
});
test('B2B quotations and contract finance use the authoritative sources',()=>{
  const org='20000000-0000-4000-8000-000000000010',l={...link,user_id:null,organization_id:org};
  const q=importPayload('quotations',{...order,organization_id:org,status:'sent',subtotal:110,discount_total:10,vat_total:15,vat_rate:15,quote_number:2},l,{items:[{description_ar:'ورد',quantity:2}]});
  assert.equal(q.record.subtotal,100);assert.equal(q.record.total,115);
  const c=importPayload('contracts',{...order,organization_id:org,status:'active',contract_number:'C-01',contract_value:999},l,{financial:{contract_value:250}});
  assert.equal(c.record.value,250);
});
test('VAT-inclusive B2B quotes are not taxed twice when imported into Office',()=>{
  const org='20000000-0000-4000-8000-000000000010',l={...link,user_id:null,organization_id:org};
  const source={...order,organization_id:org,status:'sent',quote_number:2,vat_rate:15,subtotal:125,discount_total:10,vat_total:15,total:115,prices_include_vat:true};
  const result=importPayload('quotations',source,l);assert.equal(result.record.subtotal,100);assert.equal(result.record.vat_amount,15);assert.equal(result.record.total,115);
});
test('reconciliation rejects deleted, altered or nonnumeric ledger records',()=>{
  const job={id:jobId,payload:{record:{client_id:'c1',contract_value:115}}};
  assert.equal(verifyImportedRecord({id:jobId,client_id:'c1',contract_value:'115'},job).id,jobId);
  for(const value of [{id:jobId,client_id:'c2',contract_value:115},{id:jobId,client_id:'c1',contract_value:'bad'},{id:jobId,client_id:'c1',contract_value:115,deleted_at:'2026-10-09'}])assert.throws(()=>verifyImportedRecord(value,job),{code:'LEDGER_CONFLICT'});
});
test('new Office clients contain an allowlist and never inherit customer metadata',()=>{
  const p=clientPayload('individual',{id:userId,full_name:'عميل',email:'qa@example.test',role:'admin',personal:{private_id:'secret'}});
  assert.equal(p.record.name,'عميل');assert.equal(p.record.credit_limit,0);assert.equal(p.record.personal,undefined);assert.equal(p.record.role,undefined);
});
test('quote inputs reject invalid dates, zero prices and excessive VAT',()=>{
  assert.equal(validateQuoteInput({amount:115,reply:'نطاق العرض',vatRate:15}).amount,115);
  for(const p of [{amount:0,reply:'scope'},{amount:1,reply:'scope',validUntil:'2099-13-01'},{amount:1,reply:'scope',vatRate:101}])assert.throws(()=>validateQuoteInput(p));
});
test('order updates whitelist lifecycle fields and cannot certify payment',async()=>{
  const f=fixture();await f.service('updateOperation',{kind:'orders',id,commandId:jobId,status:'approved',payment_status:'paid',total:1,note:'ملاحظة',expectedUpdatedAt:order.updated_at},'office:qa');
  const call=f.state.calls[0];assert.equal(call.name,'office_update_request');assert.deepEqual(call.p.p_patch,{status:'approved',admin_note:'ملاحظة'});
});
test('allocating a proof rechecks the actual Google transfer and exact order total',async()=>{
  const f=fixture();f.state.proof={id:paymentId,link_id:linkId,status:'recorded',amount:115,payment_date:'2026-10-09',bank_reference:'BANK-QA'};
  f.state.transfer={id:paymentId,transfer_no:`WEB-${paymentId}`,party_id:link.office_client_id,party_type:'عميل',direction:'وارد',date:'2026-10-09',amount:115,bank_ref:'BANK-QA'};
  assert.equal((await f.service('applyOrderPayment',{id,paymentId,expectedUpdatedAt:order.updated_at},'office:qa')).payment_status,'paid');
  f.state.transfer.amount=1;await assert.rejects(f.service('applyOrderPayment',{id,paymentId,expectedUpdatedAt:order.updated_at},'office:qa'),{code:'LEDGER_CONFLICT'});
  f.state.proof.amount=110;await assert.rejects(f.service('applyOrderPayment',{id,paymentId,expectedUpdatedAt:order.updated_at},'office:qa'),{code:'PAYMENT_MISMATCH'});
});
test('office attachment publication ignores browser title and document type',async()=>{
  const f=fixture();let published;
  f.store.upload=async(path,file)=>{assert.equal(file.name,'quotation.pdf');};
  f.store.rpc=async(name,p)=>{published=p;return {id:p.p_id};};
  f.ledger.document=async(entity,recordId,clientId)=>{assert.equal(clientId,link.office_client_id);return {name:'quotation.pdf',title:'عرض سعر Q-1',documentType:'quotation',ext:'pdf'};};
  await f.service('publishOfficeDocument',{id:jobId,linkId,entity:'quotes',recordId:'quote-one',title:'forged',type:'invoice'},'office:qa');
  assert.equal(published.p_type,'quotation');assert.equal(published.p_title,'عرض سعر Q-1');
});
test('inbox payloads omit confirmation and idempotency tokens',()=>{
  assert.deepEqual(officeSource({id,status:'pending',cod_confirmation_token:'private',checkout_idempotency_key:'private',request_token:'private'}),{id,status:'pending'});
});
test('Google adapter enforces document ownership, content type and one operational append',async()=>{
  const keys=['BALQEES_SPREADSHEET_ID','GOOGLE_SERVICE_ACCOUNT_JSON'],saved=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
  process.env.BALQEES_SPREADSHEET_ID='office-link-fixture';process.env.GOOGLE_SERVICE_ACCOUNT_JSON=JSON.stringify({client_email:'qa-service@example.test',private_key:privateKey});
  const quoteHeaders=['id','quote_no','client_id','client_name','date','description','subtotal','vat_rate','vat_amount','total','valid_until','status','followup_date','probability','notes','file_id','created_at','updated_at','version','deleted_at'];
  const sheets={
    'العملاء':[['id','client_no','name','email','phone','deleted_at'],['office-one','C-1','العميل','qa@example.test','0500000000','']],
    'عروض الأسعار':[quoteHeaders,['quote-existing','Q-1','office-one','العميل','','عرض محفوظ',100,15,15,115,'','أرسل','','','','file-qa-abcdefghijk','','',1,'']],
    'المستحقات':[['id','client_id','invoice_no','invoice_file_id','deleted_at'],['invoice-other','other-client','INV-X','file-other-abcdefghijk','']],
    'الإعدادات':[['key','value']],
  };
  let appends=0,driveReads=0;
  globalThis.fetch=async(url,options={})=>{
    const u=new URL(url);
    if(u.hostname==='oauth2.googleapis.com')return Response.json({access_token:'fixture',expires_in:3600});
    if(u.hostname==='sheets.googleapis.com'){
      if(u.pathname.endsWith(':append')){appends++;const body=JSON.parse(options.body);assert.equal(body.values.length,1);assert.equal(body.values[0][0],jobId);return Response.json({});}
      if(u.pathname.endsWith(':batchGet'))return Response.json({valueRanges:u.searchParams.getAll('ranges').map(r=>({values:sheets[r.match(/^'(.*)'!/)[1]]||[]}))});
      const sheet=decodeURIComponent(u.pathname).split("'")[1];return Response.json({values:sheets[sheet]||[]});
    }
    assert.equal(u.hostname,'www.googleapis.com');assert.ok(u.pathname.includes('file-qa-abcdefghijk'));driveReads++;
    if(u.searchParams.get('alt')==='media')return new Response(Buffer.from('%PDF-1.7\nfixture'));
    return Response.json({id:'file-qa-abcdefghijk',name:'quote.pdf',mimeType:'application/pdf',size:18});
  };
  try {
    const db=await import('../integrations/smart-office/lib/balqees-db.js');
    const list=await db.getPortalDocuments('office-one');assert.equal(list.length,1);assert.equal(list[0].document_type,'quotation');
    await assert.rejects(db.getPortalDocument('receivables','invoice-other','office-one'),{code:'CLIENT_MISMATCH'});assert.equal(driveReads,0);
    const file=await db.getPortalDocument('quotes','quote-existing','office-one');assert.equal(file.documentType,'quotation');assert.equal(file.bytes.subarray(0,5).toString(),'%PDF-');assert.equal(driveReads,2);
    const payload=importPayload('rfq',{...order,status:'quoted',request_number:1,quote_amount:115,admin_reply:'عرض شامل الضريبة'},link,{vatRate:15});
    const prepared=await db.preparePortalRecord({id:jobId,payload});await db.appendPortalRecord(prepared);assert.equal(appends,1);
  } finally {globalThis.fetch=originalFetch;for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
