// All APIs are intercepted. Fixtures never write Google or notify real clients.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:5193',api='https://accounting-ui-test.supabase.co',office='https://balqees-smart-office.vercel.app/api/portal';
const uid='30000000-0000-4000-8000-000000000001',linkId='30000000-0000-4000-8000-000000000002',orgId='30000000-0000-4000-8000-000000000003';
const orderId='30000000-0000-4000-8000-000000000004',rfqId='30000000-0000-4000-8000-000000000005',requestId='30000000-0000-4000-8000-000000000006',paymentId='30000000-0000-4000-8000-000000000007';
const unbound='30000000-0000-4000-8000-000000000008',now='2026-10-09T12:00:00Z';
const user={id:uid,role:'authenticated',aud:'authenticated',email:'qa@example.test',app_metadata:{role:'admin'},user_metadata:{},factors:[]};
const link={id:linkId,is_active:true,user_id:uid,office_client_id:'office-qa',office_client_name:'عميل الاختبار'};
const orgLink={id:'30000000-0000-4000-8000-000000000009',is_active:true,organization_id:orgId,office_client_id:'office-org',office_client_name:'منشأة الاختبار'};
const state={links:[link,orgLink],clients:[{id:'office-qa',name:link.office_client_name,client_no:'C-1'}],profiles:[{id:uid,full_name:'عميل الاختبار',account_type:'individual',email:'qa@example.test'},{id:unbound,full_name:'عميل جديد',account_type:'individual',email:'new@example.test'}],organizations:[{id:orgId,display_name:'منشأة الاختبار'}],payments:[{id:paymentId,link_id:linkId,status:'recorded',amount:115,bank_reference:'QA-VERIFIED',payment_date:'2026-10-09'}],statements:[],documents:[]};
const rows={orders:[{id:orderId,order_number:42,user_id:uid,total:115,status:'pending',payment_status:'pending',updated_at:now,created_at:now}],rfq:[{id:rfqId,request_number:17,user_id:uid,contact_name:'عميل الاختبار',description:'توريد ورد أسبوعي',status:'submitted',updated_at:now,created_at:now}],requests:[{id:requestId,request_code:'REQ-QA-1',organization_id:orgId,created_by:uid,description:'ورد للاستقبال',status:'submitted',updated_at:now,created_at:now}],quotations:[],contracts:[{id:'30000000-0000-4000-8000-000000000011',contract_number:'CON-QA-1',organization_id:orgId,title_ar:'عقد توريد',status:'active',updated_at:now,created_at:now}]};
const store={jobs:[],appendCount:0,commands:new Map(),commandIds:[],lostUpdate:true,lostImport:true,sentDocuments:0,createdClients:0,quoteCount:0};
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5193','--strictPort'],{env:{...process.env,VITE_SUPABASE_URL:api,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'},stdio:['ignore','pipe','pipe']});
let log='',browser;server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
const errors=[],shots=path.resolve('preview/office-link');fs.mkdirSync(shots,{recursive:true});
const respond=(route,data,status=200)=>route.fulfill({status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type,apikey,x-client-info'},body:JSON.stringify(data)});
try {
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));if(i===99)throw Error(log);}
  browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||undefined,headless:true,args:process.env.CHROME_EXECUTABLE?['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage']:[]});
  const context=await browser.newContext({viewport:{width:1360,height:1000},reducedMotion:'reduce'});
  await context.addInitScript(({user})=>{const payload=btoa(JSON.stringify({sub:user.id,role:'authenticated',app_metadata:user.app_metadata,exp:Math.floor(Date.now()/1000)+7200}));localStorage.setItem('sb-accounting-ui-test-auth-token',JSON.stringify({access_token:`e30.${payload}.fixture`,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+7200,user,token_type:'bearer'}));},{user});
  await context.route(`${api}/**`,route=>respond(route,route.request().url().includes('/auth/')?user:[]));
  await context.route('https://balqees123.vercel.app/assets/brand/**',route=>route.fulfill({path:path.resolve('public/assets/brand/balqees-logo.webp'),contentType:'image/webp'}));
  await context.route(office,async route=>{
    if(route.request().method()==='OPTIONS')return respond(route,{});
    assert.match(route.request().headers().authorization,/^Bearer /);
    const {action,input}=route.request().postDataJSON();
    let data;
    if(action==='state')data=state;
    else if(action==='operations')data={kind:input.kind,rows:rows[input.kind],jobs:store.jobs.filter(j=>j.source_kind===input.kind),profiles:state.profiles,organizations:state.organizations,more:false};
    else if(action==='operation')data={kind:input.kind,source:rows[input.kind].find(r=>r.id===input.id),items:input.kind==='orders'?[{id:'line-one',product_snapshot:{name_ar:'باقة ورد'},quantity:2}]:[],financial:input.kind==='contracts'?{contract_value:2000}:null,job:store.jobs.find(j=>j.source_id===input.id)};
    else if(action==='updateOperation'){
      store.commandIds.push(input.commandId);if(!store.commands.has(input.commandId)){const row=rows[input.kind].find(r=>r.id===input.id);Object.assign(row,{status:input.status,admin_reply:input.reply,quote_amount:input.amount,updated_at:'2026-10-09T12:01:00Z'});store.commands.set(input.commandId,{...row});}
      if(store.lostUpdate){store.lostUpdate=false;return respond(route,{ok:false,error:'انقطع تأكيد التحديث. أعد المحاولة بنفس البيانات.'},503);}data=store.commands.get(input.commandId);
    }
    else if(action==='importOperation'){
      let j=store.jobs.find(j=>j.source_id===input.id);if(!j){j={id:crypto.randomUUID(),source_id:input.id,source_kind:input.kind,status:'needs_review'};store.jobs.push(j);store.appendCount++;}
      if(store.lostImport){store.lostImport=false;return respond(route,{ok:false,error:'يحتاج القيد إلى مطابقة بعد انقطاع الاتصال.'},409);}j.status='recorded';data=j;
    }
    else if(action==='applyOrderPayment'){data=rows.orders[0];data.payment_status='paid';data.updated_at='2026-10-09T12:02:00Z';}
    else if(action==='createOrganizationQuote'){store.quoteCount++;data={id:input.commandId,quote_number:91,status:'sent',organization_id:orgId,subtotal:100,vat_total:15,total:115,vat_rate:15,version_number:1,title_ar:'عرض توريد استقبال',updated_at:now,created_at:now};rows.quotations.push(data);rows.requests[0].status='under_review';}
    else if(action==='createClient'){store.createdClients++;data={id:crypto.randomUUID(),user_id:input.targetId,is_active:true,office_client_id:crypto.randomUUID(),office_client_name:'عميل جديد'};state.links.push(data);}
    else if(action==='officeDocuments')data=[{entity:'quotes',id:'quote-qa',title:'عرض سعر Q-1',document_type:'quotation',date:now}];
    else if(action==='publishOfficeDocument'){store.sentDocuments++;data={id:input.id,link_id:input.linkId,title:'عرض سعر Q-1',document_type:'quotation',created_at:now};state.documents.push(data);}
    else throw Error(`Unhandled fixture action ${action}`);
    return respond(route,{ok:true,data});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(`${origin}/tests/accounting-ui.html`);await page.getByText('الموقع والمكتب متصلان',{exact:true}).waitFor();
  await page.getByRole('button',{name:'طلبات الموقع والتسعير',exact:true}).click();await page.getByRole('button',{name:/BLQ #42/}).click();
  await page.getByRole('heading',{name:'تحديث العميل من المكتب'}).waitFor();await page.getByLabel('الحالة').selectOption('approved');
  await page.getByRole('button',{name:'حفظ وإشعار العميل',exact:true}).click();await page.getByRole('alert').filter({hasText:'انقطع'}).waitFor();
  await page.getByRole('button',{name:'حفظ وإشعار العميل',exact:true}).click();await page.getByRole('status').filter({hasText:'تم حفظ التحديث'}).waitFor();assert.equal(new Set(store.commandIds).size,1);
  await page.getByRole('button',{name:'استيراد إلى المكتب',exact:true}).click();await page.getByRole('alert').filter({hasText:'مطابقة'}).waitFor();
  await page.getByRole('button',{name:'مطابقة الاستيراد',exact:true}).click();await page.getByRole('button',{name:'مستورد إلى المكتب',exact:true}).waitFor();assert.equal(store.appendCount,1);
  await page.getByLabel('الإيصال المعتمد').selectOption(paymentId);await page.getByRole('button',{name:'ربط الإيصال واعتماد سداد الطلب',exact:true}).click();await page.getByRole('status').filter({hasText:'اعتماد سداده'}).waitFor();assert.equal(rows.orders[0].payment_status,'paid');
  await page.getByRole('button',{name:'طلبات عرض السعر',exact:true}).click();await page.getByRole('button',{name:/RFQ #17/}).click();await page.getByLabel('الحالة').selectOption('quoted');await page.getByLabel('الرد ونطاق العرض').fill('توريد أسبوعي شامل الضريبة');await page.getByLabel('الإجمالي شامل الضريبة (ر.س)',{exact:true}).fill('115');await page.getByRole('button',{name:'حفظ وإشعار العميل',exact:true}).click();await page.getByRole('status').filter({hasText:'تم حفظ التحديث'}).waitFor();assert.equal(rows.rfq[0].quote_amount,'115');
  for(const width of [1360,768,390,320]){await page.setViewportSize({width,height:1100});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Inbox overflow ${width}`);await page.screenshot({path:path.join(shots,`rfq-${width}.png`),fullPage:true});}
  await page.setViewportSize({width:1360,height:1100});await page.getByRole('button',{name:'طلبات المنشآت',exact:true}).click();await page.getByRole('button',{name:/REQ-QA-1/}).click();await page.getByLabel('نطاق العرض وشروطه').fill('ورد استقبال أسبوعي شامل الضريبة');await page.getByLabel('الإجمالي شامل الضريبة (ر.س)',{exact:true}).fill('115');await page.getByRole('button',{name:'إرسال العرض إلى بوابة المنشأة',exact:true}).click();await page.getByRole('status').filter({hasText:'أُرسل العرض #91'}).waitFor();assert.equal(store.quoteCount,1);
  await page.getByRole('button',{name:'عروض المنشآت',exact:true}).click();await page.getByRole('button',{name:/Q #91/}).click();await page.getByRole('button',{name:'استيراد إلى المكتب',exact:true}).click();await page.getByRole('button',{name:'مستورد إلى المكتب',exact:true}).waitFor();
  await page.getByRole('button',{name:'العقود',exact:true}).click();await page.getByRole('button',{name:/CON-QA-1/}).click();await page.getByText('2,000.00',{exact:true}).waitFor();
  await page.getByRole('button',{name:'كشف ومستندات العميل',exact:true}).click();await page.getByRole('button',{name:'تحميل ملفات العميل من المكتب',exact:true}).click();await page.getByLabel('مستند المكتب').selectOption('quotes:quote-qa');await page.getByRole('button',{name:'إرسال الملف إلى حساب العميل',exact:true}).click();await page.getByRole('status').filter({hasText:'تم إرسال ملف المكتب'}).waitFor();assert.equal(store.sentDocuments,1);
  await page.getByRole('button',{name:'ربط العملاء',exact:true}).click();await page.getByLabel('حساب العميل في الموقع').selectOption(unbound);await page.getByRole('button',{name:'إنشاء عميل في المكتب من هذا الحساب',exact:true}).click();await page.getByRole('status').filter({hasText:'تم إنشاء العميل'}).waitFor();assert.equal(store.createdClients,1);
  assert.deepEqual(errors,[]);
  console.log('PASS: unified inbox, current details, stable update command retry, one import after reconciliation, verified order payment, RFQ pricing, B2B quotation, contract finance, Office document delivery and new customer mapping');
  console.log('PASS: Arabic RTL at 1360/768/390/320px; no browser errors; no live customer writes');
} finally {await browser?.close();server.kill('SIGTERM');}
