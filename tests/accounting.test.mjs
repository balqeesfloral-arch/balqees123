import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortalService } from '../integrations/smart-office/lib/portal-service.js';
import { createHandler } from '../integrations/smart-office/api/portal.js';
import { createPortalStore } from '../integrations/smart-office/lib/portal-store.js';
import { PortalError, strictClientRows, statementFilters, publicStatement, validateAttachment, possibleDuplicateTransfer } from '../integrations/smart-office/lib/portal-domain.js';
import { requestIdentity } from '../src/accounting/requestIdentity.js';
import { statementDocument } from '../src/accounting/statementDocument.js';

const id='10000000-0000-4000-8000-000000000001',linkId='10000000-0000-4000-8000-000000000002';
const customerId='10000000-0000-4000-8000-000000000003';
function fixture({lostAppend=false,lostFinish=false,proofFailure=false,conflict=false}={}) {
  const state={status:'pending',started:false,appendMarked:false,appends:0,ledger:null,token:'claim-token',calls:[]};
  const payment={id,link_id:linkId,amount:125.50,payment_date:'2026-10-06',payment_method:'bank_transfer',bank_reference:'BANK-1',proof_path:`${customerId}/${id}.pdf`};
  const link={id:linkId,is_active:true,user_id:customerId,office_client_id:'office-client',office_client_name:'Client'};
  const record={id,transfer_no:`WEB-${id}`,amount:125.50,date:payment.payment_date,bank_ref:'BANK-1',direction:'وارد',party_type:'عميل',party_id:'office-client'};
  if(conflict)state.ledger={...record,amount:1};
  const store={
    async rpc(name,args){
      state.calls.push(name);
      if(name==='accounting_claim_payment'){
        const can=!state.started;state.started=true;
        return {payment:{...payment,status:state.status},link,token:state.token,can_append:can};
      }
      if(name==='accounting_mark_append'){state.appendMarked=true;state.status='importing';return true;}
      if(name==='accounting_finish_payment'){
        if(args.p_recorded&&lostFinish){lostFinish=false;throw new Error('lost finish response');}
        state.status=args.p_recorded?'recorded':state.appendMarked?'needs_review':'pending';
        if(!state.appendMarked)state.started=false;
        return {...payment,status:state.status};
      }
      if(name==='accounting_publish_statement')return {id:args.p_id,link_id:args.p_link,payload:args.p_payload};
      throw new Error(`Unexpected RPC: ${name}`);
    },
    async proof(){if(proofFailure)throw new Error('private storage unavailable');return {};},
    async one(table){return table==='accounting_links'?link:null;},
  };
  const ledger={
    async find(){return state.ledger;},async prepare(){return record;},
    async append(){state.appends++;state.ledger={...record};if(lostAppend)throw new Error('Google accepted append; response lost');},
    async company(){return {company_name:'Balqees',transfers_folder_id:'private-folder'};},
    async statement(filters){state.filters=filters;return {type:'client_statement',statementNo:'ST-1',client:{id:'office-client',name:'Client',notes:'PRIVATE'},summary:{closingBalance:500},rows:[]};},
  };
  return {state,store,ledger,service:createPortalService({store,ledger})};
}
test('repeated approval creates one incoming transfer',async()=>{
  const f=fixture();await f.service('reviewPayment',{id},'admin');await f.service('reviewPayment',{id},'admin');
  assert.equal(f.state.appends,1);assert.equal(f.state.status,'recorded');
  assert.ok(f.state.calls.indexOf('accounting_mark_append')<f.state.calls.indexOf('accounting_finish_payment'));
});
test('lost Google append response is reconciled without another append',async()=>{
  const f=fixture({lostAppend:true});await assert.rejects(f.service('reviewPayment',{id},'admin'));
  assert.equal(f.state.status,'needs_review');
  await f.service('reviewPayment',{id},'admin');assert.equal(f.state.appends,1);assert.equal(f.state.status,'recorded');
});
test('DB failure after successful append is reconciled',async()=>{
  const f=fixture({lostFinish:true});await assert.rejects(f.service('reviewPayment',{id},'admin'));
  await f.service('reviewPayment',{id},'admin');assert.equal(f.state.appends,1);assert.equal(f.state.status,'recorded');
});
test('ambiguous append with no visible Google row never appends on retry',async()=>{
  const f=fixture({lostAppend:true});await assert.rejects(f.service('reviewPayment',{id},'admin'));
  f.state.ledger=null;
  await assert.rejects(f.service('reviewPayment',{id},'admin'),{code:'RECONCILE_REQUIRED'});
  assert.equal(f.state.appends,1);
});
test('a failure before append preserves a pending proof',async()=>{
  const f=fixture({proofFailure:true});await assert.rejects(f.service('reviewPayment',{id},'admin'));
  assert.equal(f.state.appends,0);assert.equal(f.state.status,'pending');assert.equal(f.state.appendMarked,false);
});
test('an existing ledger reference with a different amount is rejected',async()=>{
  const f=fixture({conflict:true});await assert.rejects(f.service('reviewPayment',{id},'admin'),{code:'LEDGER_CONFLICT'});assert.equal(f.state.appends,0);
});
test('parallel approval does not acquire a second append',async()=>{
  const f=fixture();const results=await Promise.allSettled([f.service('reviewPayment',{id},'a'),f.service('reviewPayment',{id},'b')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.state.appends,1);
});
test('browser-supplied balances and client IDs are never trusted at publication',async()=>{
  const f=fixture();const result=await f.service('publishStatement',{id,linkId,payload:{summary:{closingBalance:0}},client:'other-client',from:'2026-01-01'},'admin');
  assert.equal(result.payload.summary.closingBalance,500);assert.equal(f.state.filters.client,'office-client');
  assert.equal(f.state.filters.strict_client_identity,true);assert.equal(result.payload.client.notes,undefined);assert.equal(result.payload.company.transfers_folder_id,undefined);
});
test('legacy name-only ledger entries stop customer publication',()=>{
  const c={id:'c1',name:'Hotel'},others=[c,{id:'c2',name:'Hotel'}];
  assert.throws(()=>strictClientRows(others,[{client_name:'Hotel'}],[],c),{code:'CLIENT_IDENTITY_REQUIRED'});
  const rows=strictClientRows(others,[{client_id:'c1'},{client_id:'c2'}],[{party_id:'c2',party_type:'عميل'}],c);
  assert.equal(rows.recs.length,1);assert.equal(rows.transfers.length,0);
});
test('date ranges and file contents are validated',()=>{
  assert.throws(()=>statementFilters({from:'2026-02-30'}));assert.throws(()=>statementFilters({from:'2026-10-02',to:'2026-10-01'}));
  assert.throws(()=>validateAttachment({type:'application/pdf',base64:Buffer.from('<html>wrong</html>').toString('base64')}));
  assert.equal(validateAttachment({type:'application/pdf',base64:Buffer.from('%PDF-1.7\n').toString('base64')}).ext,'pdf');
});
test('statement HTML escapes client and ledger text',()=>{
  const html=statementDocument({client:{name:'<script>alert(1)</script>'},rows:[{description:'<img onerror=alert(1)>',debit:123.45}],summary:{closingBalance:123.45}});
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img onerror'));assert.ok(html.includes('123.45'));assert.ok(html.includes('dir="rtl"'));
});
function responseRecorder(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(c){this.statusCode=c;return this;},json(body){this.body=body;return this;},end(){return this;}};}
test('Office endpoint rejects hostile origins, missing JWTs and untrusted content types',async()=>{
  let created=0;
  const handler=createHandler({makeStore:()=>{created++;throw Error('should not run');},officeSession:()=>null,env:{}});
  for(const [headers,status] of [
    [{origin:'https://evil.example','content-type':'application/json'},403],
    [{origin:'https://balqees123.vercel.app','content-type':'application/json'},401],
    [{origin:'https://balqees-smart-office.vercel.app','content-type':'text/plain'},415],
  ]){const res=responseRecorder();await handler({method:'POST',headers,body:{action:'state'}},res);assert.equal(res.statusCode,status);}
  assert.equal(created,0);
});
test('valid website origin does not grant admin access without fresh verification',async()=>{
  let executed=0;
  const handler=createHandler({makeStore:()=>({authenticate:async()=>{throw new PortalError('FORBIDDEN','No admin',403);}}),officeSession:()=>({email:'office@example.test'}),accounting:{clients:()=>{executed++;}},env:{}});
  const res=responseRecorder();await handler({method:'POST',headers:{origin:'https://balqees123.vercel.app','content-type':'application/json',authorization:'Bearer stale-token'},body:{action:'state'}},res);
  assert.equal(res.statusCode,403);assert.equal(executed,0);
});
test('secret apikey stays on server; user JWT is forwarded only for admin verification',async()=>{
  const calls=[];const store=createPortalStore({BALQEES_PORTAL_URL:'https://test.supabase.co',BALQEES_PORTAL_SECRET_KEY:'sb_secret_test',BALQEES_PORTAL_PUBLISHABLE_KEY:'sb_publishable_test'},async(url,options)=>{
    calls.push({url,options});return new Response(JSON.stringify(url.includes('/rpc/')?{user_id:customerId}:[]),{status:200});
  });
  await store.authenticate('user-jwt');await store.select('accounting_links',{select:'id'});
  assert.equal(calls[0].options.headers.Authorization,'Bearer user-jwt');assert.equal(calls[0].options.headers.apikey,'sb_publishable_test');assert.equal(calls[1].options.headers.Authorization,undefined);
  assert.equal(calls[1].options.headers.apikey,'sb_secret_test');assert.ok(calls.every(c=>!c.url.includes('secret')));
});
test('a document retry only accepts an existing immutable object with identical bytes',async()=>{
  const bytes=Buffer.from('%PDF-1.7 same');
  let stored=bytes;
  const store=createPortalStore({BALQEES_PORTAL_URL:'https://test.supabase.co',BALQEES_PORTAL_SECRET_KEY:'sb_secret_test',BALQEES_PORTAL_PUBLISHABLE_KEY:'sb_publishable_test'},async(url,options)=>
    options.method==='POST'?new Response('{}',{status:409}):new Response(stored,{status:200}));
  await store.upload('test.pdf',{bytes,type:'application/pdf'});
  stored=Buffer.from('different');await assert.rejects(store.upload('test.pdf',{bytes,type:'application/pdf'}),{code:'UPLOAD_FAILED'});
});
test('published client data is an allowlist, not a copy of the internal customer record',()=>{
  const report=publicStatement({client:{id:'1',name:'Hotel',notes:'private',drive_folder_id:'private'}},{company_name:'Balqees',api_key:'private'});
  assert.equal(report.client.name,'Hotel');assert.equal(report.client.notes,undefined);assert.equal(report.company.api_key,undefined);
});
test('a payment already entered manually in Office is detected before append',()=>{
  const client={id:'hotel',name:'Hotel'},payment={amount:50,payment_date:'2026-10-06',bank_reference:'Bank 123'};
  const old={party_id:'hotel',party_type:'عميل',direction:'وارد',date:'2026-10-06',amount:50,bank_ref:'bank 123'};
  assert.equal(possibleDuplicateTransfer([old],payment,client),old);
  assert.equal(possibleDuplicateTransfer([{...old,party_id:'other'}],payment,client),undefined);
  assert.equal(possibleDuplicateTransfer([{...old,amount:500}],payment,client),undefined);
});
test('network retry keeps a stable request ID when browser sessionStorage is unavailable',()=>{
  const first=requestIdentity('storage-disabled-test'),retry=requestIdentity('storage-disabled-test');
  assert.equal(first.id,retry.id);first.clear();assert.notEqual(requestIdentity('storage-disabled-test').id,first.id);
});
