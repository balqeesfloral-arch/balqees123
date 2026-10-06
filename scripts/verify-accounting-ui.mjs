// All financial APIs are intercepted. No live records or customer messages.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const origin='http://127.0.0.1:5191',api='https://accounting-ui-test.supabase.co',office='https://balqees-smart-office.vercel.app/api/portal';
const uid='10000000-0000-4000-8000-000000000003',linkId='10000000-0000-4000-8000-000000000002',pid='10000000-0000-4000-8000-000000000001';
const now='2026-10-06T10:00:00Z';
const user={id:uid,role:'authenticated',aud:'authenticated',email:'test@example.test',app_metadata:{role:'admin'},user_metadata:{},factors:[]};
const link={id:linkId,is_active:true,user_id:uid,office_client_id:'hotel-one',office_client_name:'فندق بلقيس للاختبار'};
const report={type:'client_statement',statementNo:'ST-20261006-QA',generatedAt:now,client:{id:'hotel-one',name:'فندق بلقيس للاختبار'},company:{company_name:'بلقيس الورد'},filters:{from:'2026-10-01',to:'2026-10-06'},summary:{openingBalance:0,totalReceivables:1250,totalPayments:500,closingBalance:750,overdueBalance:250},rows:[{date:'2026-10-01',ref:'INV-01',description:'توريد ورد شهري',debit:1250,credit:0,running_balance:1250},{date:'2026-10-04',ref:'PAY-01',description:'حوالة واردة',debit:0,credit:500,running_balance:750}],openInvoices:[{invoice_no:'INV-01',invoice_date:'2026-10-01',due_date:'2026-10-04',invoice_total:1250,paid_amount:500,balance:750}]};
const state={links:[link],clients:[{id:'hotel-one',name:link.office_client_name,client_no:'C-01'},{id:'hotel-two',name:'عميل ثانٍ للاختبار',client_no:'C-02'}],profiles:[{id:uid,full_name:'عميل الاختبار',email:'test@example.test',account_type:'individual'},{id:'10000000-0000-4000-8000-000000000004',full_name:'حساب ثانٍ للاختبار',email:'second@example.test',account_type:'individual'}],organizations:[],payments:[{id:pid,link_id:linkId,amount:500,payment_date:'2026-10-04',payment_method:'bank_transfer',bank_reference:'BANK-QA',note:'سداد من العميل',status:'pending',review_note:'',proof_path:`${uid}/${pid}.pdf`,created_at:now}],statements:[],documents:[]};
const store={published:new Map(),uploads:new Set(),submitted:new Map(),publishIds:[],submitIds:[],reviews:0,offline:false,lostPublish:true,lostProof:true};
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5191','--strictPort'],{env:{...process.env,VITE_SUPABASE_URL:api,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'},stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
let browser;const errors=[];const screenshots=path.resolve('preview/accounting');fs.mkdirSync(screenshots,{recursive:true});
function response(route,body,status=200){return route.fulfill({status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type,apikey,x-client-info'},body:JSON.stringify(body)});}
try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));if(i===99)throw new Error(log);}
  browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||undefined,headless:true,args:process.env.CHROME_EXECUTABLE?['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage']:[]});
  const context=await browser.newContext({viewport:{width:1360,height:1000},reducedMotion:'reduce'});
  await context.addInitScript(({api,user})=>{
    const payload=btoa(JSON.stringify({sub:user.id,role:'authenticated',app_metadata:user.app_metadata,exp:Math.floor(Date.now()/1000)+7200}));
    localStorage.setItem('sb-accounting-ui-test-auth-token',JSON.stringify({access_token:`e30.${payload}.fixture`,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+7200,user,token_type:'bearer'}));
  },{api,user});
  await context.route('https://balqees123.vercel.app/assets/brand/**',route=>route.fulfill({path:path.resolve('public/assets/brand/balqees-logo.webp'),contentType:'image/webp'}));
  await context.route(office,async route=>{
    if(route.request().method()==='OPTIONS')return response(route,{});
    assert.match(route.request().headers().authorization,/^Bearer /);
    const {action,input}=route.request().postDataJSON();
    if(store.offline)return response(route,{ok:false,error:'ربط المكتب غير متاح حاليًا.'},503);
    if(action==='state')return response(route,{ok:true,data:state});
    if(action==='preview')return response(route,{ok:true,data:report});
    if(action==='publishStatement'){
      store.publishIds.push(input.id);
      if(!store.published.has(input.id)){const row={id:input.id,link_id:input.linkId,statement_number:report.statementNo,created_at:now,payload:report};store.published.set(input.id,row);state.statements.unshift({...row,payload:undefined});}
      if(store.lostPublish){store.lostPublish=false;return response(route,{ok:false,error:'انقطع تأكيد الإرسال. أعد المحاولة بنفس البيانات.'},503);}
      return response(route,{ok:true,data:store.published.get(input.id)});
    }
    if(action==='getStatement')return response(route,{ok:true,data:report});
    if(action==='publishDocument'){state.documents.push({id:input.id,link_id:input.linkId,title:input.title,file_name:input.file.name,created_at:now});return response(route,{ok:true,data:state.documents.at(-1)});}
    if(action==='reviewPayment'){
      store.reviews++;const p=state.payments.find(p=>p.id===input.id);
      if(store.reviews===1){p.status='needs_review';return response(route,{ok:false,error:'تحتاج العملية إلى مطابقة في المكتب.'},409);}
      p.status='recorded';p.office_transfer_id=`WEB-${p.id}`;return response(route,{ok:true,data:p});
    }
    if(action==='bind'){const l={...link,id:crypto.randomUUID(),office_client_id:input.officeId,user_id:input.targetId,office_client_name:'عميل ثانٍ للاختبار'};state.links.push(l);return response(route,{ok:true,data:l});}
    throw new Error(`Unexpected Office action ${action}`);
  });
  await context.route(`${api}/**`,async route=>{
    const r=route.request(),url=new URL(r.url());
    if(r.method()==='OPTIONS')return response(route,{});
    if(url.pathname.startsWith('/auth/'))return response(route,user);
    if(url.pathname.startsWith('/storage/v1/object/sign/'))return response(route,{signedURL:'/object/sign/accounting-proofs/test.pdf?token=fixture'});
    if(url.pathname.startsWith('/storage/v1/object/')&&r.method()==='POST'){
      if(store.uploads.has(url.pathname))return response(route,{message:'The resource already exists',statusCode:'409',error:'Duplicate'},409);
      store.uploads.add(url.pathname);return response(route,{Key:url.pathname});
    }
    if(url.pathname.endsWith('/rpc/accounting_submit_payment')){
      const b=r.postDataJSON();store.submitIds.push(b.p_id);
      const p={id:b.p_id,link_id:b.p_link_id,amount:b.p_amount,payment_date:b.p_payment_date,payment_method:b.p_payment_method,bank_reference:b.p_reference,note:b.p_note,proof_path:b.p_proof_path,status:'pending',created_at:now};
      if(!store.submitted.has(b.p_id)){store.submitted.set(b.p_id,p);state.payments.unshift(p);}
      if(store.lostProof){store.lostProof=false;return response(route,{message:'Lost confirmation',code:'PGRST000'},503);}
      return response(route,store.submitted.get(b.p_id));
    }
    const table=url.pathname.split('/').at(-1);
    let rows=({accounting_links:state.links,accounting_statements:[...store.published.values()],accounting_documents:state.documents,accounting_payments:state.payments})[table]||[];
    rows=rows.filter(row=>[...url.searchParams].every(([key,value])=>!value.startsWith('eq.')||String(row[key])===value.slice(3)));
    if(url.searchParams.has('limit'))rows=rows.slice(0,Number(url.searchParams.get('limit')));
    return response(route,r.headers().accept?.includes('object')?rows[0]||null:rows);
  });
  await context.routeWebSocket(`${api.replace('https','wss')}/**`,socket=>{socket.onMessage(message=>{const [join,ref,topic,event]=JSON.parse(String(message));socket.send(JSON.stringify([join,ref,topic,'phx_reply',{status:'ok',response:event==='phx_join'?{postgres_changes:[]}: {}}]));});});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
  await page.goto(`${origin}/tests/accounting-ui.html`);await page.getByText('الموقع والمكتب متصلان',{exact:true}).waitFor();
  for(const width of [1360,768,390,320]){
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Console overflows at ${width}`);
    await page.screenshot({path:path.join(screenshots,`admin-${width}.png`),fullPage:true});
  }
  await page.setViewportSize({width:1360,height:1000});
  await page.getByRole('button',{name:'اعتماد وتسجيل حوالة',exact:true}).click();await page.getByRole('alert').filter({hasText:'مطابقة'}).waitFor();
  await page.getByRole('button',{name:'تحديث',exact:true}).click();await page.getByRole('button',{name:'التحقق من تسجيل الحوالة',exact:true}).click();
  await page.getByRole('status').filter({hasText:'تمت مطابقة الحوالة'}).waitFor();assert.equal(store.reviews,2);
  await page.getByRole('button',{name:'الكشوف والمستندات',exact:true}).click();await page.getByLabel('حساب العميل المرتبط').selectOption(linkId);
  await page.getByRole('button',{name:'معاينة الكشف والمستحقات',exact:true}).click();
  await page.getByRole('dialog').waitFor();const frame=page.frameLocator('iframe');await frame.getByRole('heading',{name:'كشف حساب العميل'}).waitFor();assert.equal(await frame.locator('html').getAttribute('dir'),'rtl');
  await page.getByRole('button',{name:'إغلاق المعاينة'}).click();
  await page.getByRole('button',{name:'إرسال كشف للعميل',exact:true}).click();await page.getByRole('alert').filter({hasText:'انقطع'}).waitFor();
  await page.getByRole('button',{name:'إرسال كشف للعميل',exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal(store.publishIds.length,2);assert.equal(new Set(store.publishIds).size,1);assert.equal(store.published.size,1);
  await page.getByRole('button',{name:'إغلاق المعاينة'}).click();
  await page.getByLabel('عنوان المستند',{exact:true}).fill('فاتورة توريد شهر أكتوبر');await page.locator('input[type=file]').setInputFiles({name:'invoice.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nfixture')});
  await page.getByRole('button',{name:'إرسال المستند',exact:true}).click();await page.getByRole('status').filter({hasText:'تم إرسال المستند'}).waitFor();assert.equal(state.documents.length,1);
  await page.getByRole('button',{name:'ربط العملاء',exact:true}).click();await page.getByLabel('عميل المكتب').selectOption('hotel-two');await page.getByLabel('حساب العميل في الموقع').selectOption('10000000-0000-4000-8000-000000000004');await page.getByRole('button',{name:'مراجعة وتأكيد الربط'}).click();await page.getByRole('status').filter({hasText:'تم ربط العميل'}).waitFor();assert.equal(state.links.length,2);
  store.offline=true;await page.getByRole('button',{name:'تحديث',exact:true}).click();await page.getByText('الربط غير متاح حاليًا',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'إرسال كشف للعميل',exact:true}).isDisabled(),true);store.offline=false;
  await page.goto(`${origin}/tests/accounting-ui.html?mode=customer`);await page.getByRole('heading',{name:'حسابك مع مكتب بلقيس'}).waitFor();await page.getByText('750.00',{exact:false}).first().waitFor();
  for(const width of [1360,390,320]){await page.setViewportSize({width,height:1100});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Customer overflows at ${width}`);await page.screenshot({path:path.join(screenshots,`customer-${width}.png`),fullPage:true});}
  await page.setViewportSize({width:1000,height:1100});
  await page.getByLabel('المبلغ بالريال',{exact:true}).fill('320.50');await page.getByLabel('تاريخ السداد',{exact:true}).fill('2026-10-06');await page.getByLabel('مرجع الحوالة أو إيصال السداد',{exact:true}).fill('CUSTOMER-TRANSFER');await page.locator('input[type=file]').setInputFiles({name:'proof.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\ncustomer fixture')});
  await page.getByRole('button',{name:'إرسال الإيصال للمراجعة',exact:true}).click();await page.getByRole('alert').filter({hasText:'لم نتمكن من تأكيد'}).waitFor();
  await page.getByRole('button',{name:'إرسال الإيصال للمراجعة',exact:true}).click();await page.getByRole('status').filter({hasText:'وصل إيصالك'}).waitFor();
  assert.equal(store.submitIds.length,2);assert.equal(new Set(store.submitIds).size,1);assert.equal(store.submitted.size,1);assert.equal(store.uploads.size,1);
  assert.equal(store.submitted.values().next().value.status,'pending');await page.getByRole('heading',{name:'CUSTOMER-TRANSFER'}).waitFor();
  await page.getByRole('button',{name:'عرض آخر كشف',exact:true}).click();await page.getByRole('dialog').waitFor();await frame.getByRole('heading',{name:'حركة الحساب'}).waitFor();await page.getByRole('button',{name:'إغلاق المعاينة'}).click();
  assert.deepEqual(errors,[]);
  console.log('PASS: admin mapping, statement preview/publication retry, financial document delivery, approval/reconciliation and disconnected state');
  console.log('PASS: customer statements, pending proof submission, retry after lost response without duplicate upload/payment');
  console.log('PASS: Arabic RTL, desktop/tablet/390px/320px layouts, statement dialog and no browser errors');
}finally{await browser?.close();server.kill('SIGTERM');}
