import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {normalizeQuotation,quotationFromRecord,QUOTE_TEMPLATES,DEFAULT_QUOTE_TERMS} from '../integrations/smart-office/assets/quotation-model.js';
import {quotationDocument} from '../integrations/smart-office/assets/quotation-print.js';
const root=path.resolve('integrations/smart-office'),output=path.resolve('preview/quotation-studio');await fs.mkdir(output,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root+path.sep))throw Error('scope');const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
const company={company_name:'بلقيس الورد للزهور والنباتات',company_name_en:'Balqees Floral',city:'مكة المكرمة',phone1:'0599076267',email1:'balqeesfloral@gmail.com',website:'balqeesfloral.vercel.app'};
const clients=[{id:'c1',client_no:'C-001',name:'الفندق التجريبي',phone:'0500000000',address:'مكة المكرمة'}],projects=[{id:'p1',client_id:'c1',project_no:'PR-001',name:'تنسيق الاستقبال'}];
const rows=[{id:'legacy',quote_no:'Q-OLD',client_id:'c1',client_name:clients[0].name,date:'2026-10-12',description:'العرض القديم المحفوظ',subtotal:100,vat_rate:15,vat_amount:15,total:115,status:'مسودة',notes:'ملاحظات قديمة',version:1,file_id:'legacy-attachment'}];
const dashboard={kpi:{outstanding:0,overdue:0,overdueCount:0,receiptsMonth:0,costsMonth:0,quoteFollowups:0,contractsSoon:0,unpostedCosts:0},cashflow:Array.from({length:12},()=>({receipts:0,costs:0})),topOverdue:[],projectStats:[],followQuotes:[],upcomingContracts:[]};
const calls=[],errors=[];let appends=0,lostResponse=true,browser;
const launch=()=>chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined,args:['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage']});
try {
 browser=await launch();const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ar-SA'});
 await context.addInitScript(()=>{window.print=()=>{};});
 await context.route('**/api/session',r=>r.fulfill({json:{authenticated:true,user:{email:'office@example.test'}}}));await context.route('**/api/config',r=>r.fulfill({json:{googleClientId:''}}));
 await context.route('**/api/balqees',async route=>{const {action,args=[]}=route.request().postDataJSON();calls.push({action,args});let data;
  if(action==='getInitialData')data={bootstrap:{version:'26.3.0',company,user:{email:'office@example.test'}},lookups:{clients,projects,suppliers:[]},dashboard};
  else if(action==='getQuotationData')data={record:rows.find(r=>r.id===args[0])||null,company,clients,projects};
  else if(action==='listEntity')data=args[0]==='quotes'?rows:args[0]==='clients'?clients:[];
  else if(action==='getLookups')data={clients,projects,suppliers:[]};else if(action==='refreshDashboard')data=dashboard;else if(action==='getBootstrap')data={company,user:{email:'office@example.test'}};
  else if(action==='saveRecord'){
   assert.equal(args[0],'quotes');const p=args[1],d=normalizeQuotation(p.quote_details,p.status);d.request_id=p.quotation_request_id;const id=p.id||p.quotation_request_id;let row=rows.find(r=>r.id===id);
   if(!row){row={id,quote_no:'BQ-2026-TEST0123ABCD',client_id:p.client_id,client_name:clients[0].name,created_at:'2026-10-12T05:00:00Z',version:0};rows.push(row);appends++;}
   Object.assign(row,{quote_details_json:JSON.stringify(d),version:row.version+1,subtotal:d.totals.net,vat_amount:d.totals.vat,total:d.totals.total,date:d.date,status:p.status,followup_date:p.followup_date,probability:Number(p.probability)});data={ok:true,record:row};
   if(lostResponse){lostResponse=false;return route.fulfill({status:503,json:{ok:false,error:'lost confirmation'}});}
  }else throw Error('Unexpected action '+action);
  await route.fulfill({json:{ok:true,data}});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(12000);await page.goto(url);
 await page.waitForFunction(()=>!document.body.classList.contains('auth-pending')&&window.APP?.company);
 await page.locator('#nav [data-nav=quotes]').click();await page.getByRole('heading',{name:'عروض تليق بأعمالك.'}).waitFor();
 await page.getByRole('button',{name:'إنشاء عرض سعر',exact:true}).click();await page.getByRole('dialog',{name:'إنشاء عرض سعر'}).waitFor();
 await page.getByLabel('العميل',{exact:true}).selectOption('c1');await page.getByLabel('لغة العرض والطباعة',{exact:true}).selectOption('both');await page.getByLabel('اسم العميل بالإنجليزية',{exact:true}).fill('Sample Hospitality Client');
 await page.getByLabel('قالب بند مهني',{exact:true}).selectOption('planters');await page.getByLabel('الكمية · البند 1',{exact:true}).fill('٢');await page.getByLabel('سعر الوحدة (SAR) · البند 1',{exact:true}).fill('١٠٠');await page.getByLabel('الخصم % · البند 1',{exact:true}).fill('10');
 await page.getByLabel('قالب بند مهني',{exact:true}).selectOption('maintenance');await page.getByLabel('سعر الوحدة (SAR) · البند 2',{exact:true}).fill('50');await page.getByLabel('الضريبة % · البند 2',{exact:true}).fill('0');
 await page.getByLabel('صالح حتى (اختياري)',{exact:true}).fill('2026-11-12');await page.getByLabel('حالة العرض',{exact:true}).selectOption('أرسل');
 await page.getByLabel('موعد المتابعة (داخلي، اختياري)',{exact:true}).fill('2026-10-20');await page.getByLabel('احتمالية الإغلاق % (داخلية)',{exact:true}).fill('75');
 await page.getByLabel('ملاحظات العرض بالعربية',{exact:true}).fill('نموذج توضيحي لمراجعة التصميم - ليس عرضًا صادرًا لعميل فعلي.');await page.getByLabel('Quotation notes in English',{exact:true}).fill('Demonstration for design review only - not an issued quotation for an actual customer.');
 assert.equal(await page.locator('.qs-summary-values .qs-total strong').textContent(),'257.00');
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Page overflow ${width}`);assert.ok(await page.locator('#quotationEditor').evaluate(e=>e.scrollWidth<=e.clientWidth+1),`Editor overflow ${width}`);await page.screenshot({path:path.join(output,`editor-${width}.png`),fullPage:true});}
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'حفظ عرض السعر',exact:true}).click();await page.getByRole('alert').filter({hasText:'تم التحقق: العرض محفوظ'}).waitFor();assert.equal(appends,1);assert.equal(calls.filter(c=>c.action==='saveRecord').length,1);assert.equal(rows[1].total,257);assert.equal(rows[0].file_id,'legacy-attachment');
 await page.getByRole('button',{name:'معاينة الطباعة',exact:true}).click();await page.getByRole('dialog',{name:'معاينة عرض السعر'}).waitFor();const frame=page.frameLocator('#quotationPreview iframe');await frame.locator('.financials .grand .numeric').waitFor();assert.match(await frame.locator('.financials .grand .numeric').textContent(),/^257\.00/);
 for(const mode of ['ar','en','both']){
  await page.getByLabel('لغة معاينة الطباعة',{exact:true}).selectOption(mode);await frame.locator('.items tbody tr').first().waitFor();await page.waitForTimeout(100);
  const f=page.frames().find(f=>f.url().startsWith('blob:'));await f.evaluate(()=>Promise.all([document.fonts.ready,...Array.from(document.images).map(im=>im.decode())]));assert.equal(await frame.locator('.items tbody tr').count(),2);
  assert.equal(await frame.locator('img.brand-logo').count(),1,'Official logo is present');assert.equal(await frame.locator('.sign-images img').count(),2,'Original signature and stamp are present');assert.ok(await f.evaluate(()=>Array.from(document.images).every(im=>im.naturalWidth>0)),'Brand assets decode correctly');
  const text=await frame.locator('body').innerText();if(mode==='en')assert.ok(!/[\u0600-\u06ff]/.test(text),'English quotation contains Arabic content');if(mode==='ar')assert.ok(!text.includes('Terms and Conditions'));assert.ok(text.includes('257.00'));
  await f.page().screenshot({path:path.join(output,`preview-${mode}.png`),fullPage:true});
  const html=await f.content();const printPage=await context.newPage();await printPage.goto(url);await printPage.setContent(html,{waitUntil:'networkidle'});await printPage.emulateMedia({media:'print'});await printPage.evaluate(()=>Promise.all([document.fonts.ready,document.fonts.load('11pt QuoteNaskh'),document.fonts.load('700 11pt QuoteNaskh'),document.fonts.load('9pt QuoteDM'),document.fonts.load('600 9pt QuoteDM')]));assert.ok(await printPage.evaluate(()=>document.fonts.check('11pt QuoteNaskh')&&document.fonts.check('9pt QuoteDM')),'Embedded quotation fonts load');await printPage.pdf({path:path.join(output,`quotation-${mode}.pdf`),format:'A4',printBackground:true,preferCSSPageSize:true});await printPage.close();
 }
 await page.getByRole('button',{name:'إغلاق المعاينة',exact:true}).click();await page.getByRole('button',{name:'إغلاق',exact:true}).click();
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`List overflow ${width}`);await page.screenshot({path:path.join(output,`list-${width}.png`),fullPage:true});}
 await page.setViewportSize({width:1440,height:1000});await page.locator('.qs-quote-card').filter({hasText:'BQ-2026-TEST0123ABCD'}).getByRole('button',{name:'تعديل العرض',exact:true}).click();await page.getByRole('dialog',{name:'تعديل عرض السعر'}).waitFor();assert.equal(await page.getByLabel('سعر الوحدة (SAR) · البند 1',{exact:true}).inputValue(),'100');assert.equal(await page.locator('.qs-line').count(),2);assert.equal(await page.getByLabel('موعد المتابعة (داخلي، اختياري)',{exact:true}).inputValue(),'2026-10-20');assert.equal(await page.getByLabel('احتمالية الإغلاق % (داخلية)',{exact:true}).inputValue(),'75');
 await page.getByRole('button',{name:'إغلاق',exact:true}).click();await page.locator('#nav [data-nav=clients]').click();await page.locator('.office-table-tools').waitFor();assert.equal(await page.locator('.qs-workspace').count(),0);
 const assets=await page.evaluate(()=>({logo:PDF_BRAND_LOGO,signature:PDF_SIGNATURE,stamp:PDF_STAMP}));
 const long=quotationFromRecord(rows[1]);long.lines=Array.from({length:24},(_,i)=>({...long.lines[i%2],id:`long-${i}`,name_ar:`${i+1} - ${QUOTE_TEMPLATES[i%QUOTE_TEMPLATES.length].name_ar}`,name_en:`${i+1} - ${QUOTE_TEMPLATES[i%QUOTE_TEMPLATES.length].name_en}`}));
 const longRow={...rows[1],quote_details_json:JSON.stringify(normalizeQuotation(long,'أرسل'))};const longPage=await context.newPage();await longPage.goto(url);await longPage.setContent(quotationDocument(longRow,{company,client:clients[0],assets,origin:url}),{waitUntil:'networkidle'});await longPage.emulateMedia({media:'print'});await longPage.evaluate(()=>document.fonts.ready);assert.ok(await longPage.evaluate(()=>document.fonts.check('11pt QuoteNaskh')));await longPage.pdf({path:path.join(output,'quotation-multipage.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});await longPage.close();
 const printPages={};for(const mode of ['ar','en','both','multipage']){const bytes=await fs.readFile(path.join(output,`quotation-${mode}.pdf`));printPages[mode]=(bytes.toString('latin1').match(/\/Type \/Page\b/g)||[]).length;if(mode!=='multipage')assert.equal(printPages[mode],1,`Short ${mode} quotation is one complete A4 page`);}assert.ok(printPages.multipage>=2);
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'QA.json'),JSON.stringify({passed:true,date:new Date().toISOString(),widths:[1440,768,390,320],linesSaved:2,appends,saveRequests:1,printedModes:['ar','en','both'],printPages,embeddedFontsVerified:true,logoSignatureStampVerified:true,followupFieldsVerified:true,multipageLines:24,pageErrors:errors},null,2));console.log('PASS quotation studio: products/services, taxes, bilingual validation, persistence/reconciliation, current record edit, legacy attachment, three print modes, mobile widths and 24-line pagination');
} finally{await browser?.close();server.close();}
