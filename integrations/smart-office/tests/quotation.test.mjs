import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {calculateQuote,normalizeQuotation,quotationFromRecord,decimal,DEFAULT_QUOTE_TERMS,QUOTE_TEMPLATES} from '../assets/quotation-model.js';
import {quotationDocument} from '../assets/quotation-print.js';
const line={id:'line',kind:'product',name_ar:'مركن ذهبي',name_en:'Gold-finish Planter',details_ar:'ارتفاع 100 سم',details_en:'Height: 100 cm',quantity:2,unit_ar:'قطعة',unit_en:'unit',unit_price:100,vat_rate:15,discount_percent:10};
const doc={language:'both',price_basis:'exclusive',date:'2026-10-12',valid_until:'2026-11-12',title_ar:'عرض سعر',title_en:'Commercial Quotation',customer_name_en:'QA Hotel',terms_ar:DEFAULT_QUOTE_TERMS.ar,terms_en:DEFAULT_QUOTE_TERMS.en,notes_ar:'ملاحظة',notes_en:'Note',lines:[line]};
test('multiple products/services preserve discounts and tax amounts to the cent',()=>{
 const r=calculateQuote([line,{...line,id:'service',kind:'service',quantity:1,unit_price:50,discount_percent:0,vat_rate:0}]);
 assert.deepEqual(r.totals,{subtotal:250,discount:20,net:230,vat:27,total:257});assert.equal(r.lines[0].total,207);assert.equal(r.taxes.length,2);
});
test('VAT-inclusive prices are never taxed twice',()=>{
 const r=calculateQuote([{...line,quantity:1,unit_price:115,discount_percent:0}],'inclusive');assert.equal(r.totals.net,100);assert.equal(r.totals.vat,15);assert.equal(r.totals.total,115);
});
test('Arabic digits, fractional quantities and explicit decimal rounding work',()=>{
 assert.equal(decimal('١٬٢٣٤٫٥٠'),123450);assert.equal(decimal('۱۲۳٫۴۵'),12345);
 const r=calculateQuote([{...line,quantity:'0.333',unit_price:'9.99',discount_percent:0}]);assert.equal(r.totals.net,3.33);assert.equal(r.totals.vat,.5);assert.equal(r.totals.total,3.83);
});
test('invalid numeric input and excessive line/total amounts are blocked',()=>{
 for(const value of ['-1','NaN','Infinity','1e9','1.001',''])assert.throws(()=>decimal(value));
 for(const l of [{...line,quantity:0},{...line,discount_percent:101},{...line,vat_rate:101}])assert.throws(()=>calculateQuote([l]));
 assert.throws(()=>calculateQuote(Array.from({length:51},()=>line)));
});
test('canonical totals cannot be forged in a saved document',()=>{
 const d=normalizeQuotation({...doc,totals:{total:1},lines:[{...line,total:1,vat_amount:0}]},'أرسل');assert.equal(d.totals.total,207);assert.equal(d.lines[0].vat_amount,27);
});
test('English and bilingual versions require reviewed names and details, not fake translations',()=>{
 assert.throws(()=>normalizeQuotation({...doc,customer_name_en:''}));assert.throws(()=>normalizeQuotation({...doc,lines:[{...line,details_en:''}]}));
 assert.throws(()=>normalizeQuotation({...doc,notes_en:''}));assert.doesNotThrow(()=>normalizeQuotation({...doc,language:'ar',customer_name_en:'',notes_en:'',lines:[{...line,name_en:'',details_en:''}]}));
});
test('dates, zero-value issued quotations and oversized cell payloads are validated',()=>{
 assert.throws(()=>normalizeQuotation({...doc,date:'2026-02-30'}));assert.throws(()=>normalizeQuotation({...doc,valid_until:'2026-10-11'}));
 assert.throws(()=>normalizeQuotation({...doc,lines:[{...line,unit_price:0}]},'أرسل'));
 assert.doesNotThrow(()=>normalizeQuotation({...doc,lines:[{...line,unit_price:0}]},'مسودة'));
 assert.throws(()=>normalizeQuotation({...doc,lines:Array.from({length:50},(_,i)=>({...line,id:String(i),details_ar:'م'.repeat(600),details_en:'x'.repeat(600)}))}));
});
test('professional bilingual templates preserve neutral, non-invented terms',()=>{
 assert.equal(QUOTE_TEMPLATES.length,8);for(const t of QUOTE_TEMPLATES){assert.ok(t.name_ar&&t.name_en&&t.details_ar&&t.details_en&&t.unit_ar&&t.unit_en);}
 assert.ok(!DEFAULT_QUOTE_TERMS.en.includes('30%'));
});
test('legacy quotes retain their original scope, subtotal, rate and attachment record',()=>{
 const d=quotationFromRecord({date:'2026-10-12',description:'Legacy scope',subtotal:250,vat_rate:15,notes:'legacy note',file_id:'existing-file'});assert.equal(d.lines[0].unit_price,250);assert.equal(d.lines[0].details_ar,'Legacy scope');assert.equal(d.notes_ar,'legacy note');assert.equal(d.language,'ar');
});
test('all three print modes escape customer content and retain official branding',()=>{
 const r={quote_no:'BQ-TEST',client_name:'<img src=x onerror=evil>',status:'أرسل',quote_details_json:JSON.stringify(normalizeQuotation({...doc,customer_name_en:'<script>evil</script>'}))};
 for(const mode of ['ar','en','both']){const html=quotationDocument(r,{language:mode,company:{company_name:'بلقيس الورد',company_name_en:'Balqees Floral'},assets:{logo:'javascript:evil'}});assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('<script>evil'));assert.ok(!html.includes('src="javascript:'));assert.ok(html.includes('@page{size:A4'));assert.ok(html.includes('BQ-TEST'));if(mode==='en')assert.ok(!html.includes('المنتج / الخدمة'));if(mode==='ar')assert.ok(!html.includes('Terms and Conditions'));}
});
test('authenticated storage adds one column, recomputes totals, reconciles retries and preserves prior records',async()=>{
 const savedFetch=globalThis.fetch,keys=['GOOGLE_SERVICE_ACCOUNT_JSON','BALQEES_SPREADSHEET_ID','BALQEES_ALLOWED_EMAIL','BALQEES_API_SECRET'],saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 Object.assign(process.env,{GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'qa@example.test',private_key:privateKey}),BALQEES_SPREADSHEET_ID:'quotation-fixture',BALQEES_ALLOWED_EMAIL:'office@example.test',BALQEES_API_SECRET:'local-quotation-fixture'});
 const headers=['id','quote_no','date','client_id','client_name','project_id','project_name','description','subtotal','vat_rate','vat_amount','total','valid_until','status','followup_date','probability','file_id','notes','created_at','updated_at','version','deleted_at'];
 const sheets={'عروض الأسعار':[headers,['old','Q-OLD','','c1','QA','','','Old offer',100,15,15,115,'','مسودة','','','kept-file','kept notes','','',1,'']],
 'العملاء':[['id','name','client_no'],['c1','QA','C1']],'الموردون':[['id','name']],'المشاريع':[['id','name','client_id'],['p1','Lobby','c1']],
 'الإعدادات':[['key','value'],['company_name','بلقيس']],'التسلسلات':[['key','value']], 'سجل التدقيق':[['id','date','user','action','entity','record_id','summary','payload']]};
 let appended=0,headerWrites=0,driveCalls=0,dimensionAdds=0,columns=headers.length;
 globalThis.fetch=async(url,options={})=>{const u=new URL(url);if(u.hostname==='oauth2.googleapis.com')return Response.json({access_token:'fixture',expires_in:3600});if(u.hostname.includes('drive')){driveCalls++;throw Error('Drive must not be used for quote creation');}
  assert.equal(u.hostname,'sheets.googleapis.com');if(u.searchParams.has('fields'))return Response.json({sheets:[{properties:{sheetId:3,title:'عروض الأسعار',gridProperties:{columnCount:columns}}}]});
  if(u.pathname.endsWith(':batchUpdate')){const body=JSON.parse(options.body);assert.equal(body.requests[0].appendDimension.sheetId,3);columns+=body.requests[0].appendDimension.length;dimensionAdds++;return Response.json({});}
  if(u.pathname.endsWith(':batchGet'))return Response.json({valueRanges:u.searchParams.getAll('ranges').map(range=>({values:sheets[range.match(/^'(.*)'!/)[1]]||[]}))});
  const decoded=decodeURIComponent(u.pathname),sheet=decoded.split("'")[1];
  if(u.pathname.endsWith(':append')){const body=JSON.parse(options.body);sheets[sheet]||=[[]];sheets[sheet].push(body.values[0]);if(sheet==='عروض الأسعار')appended++;return Response.json({});}
  if(options.method==='PUT'){const body=JSON.parse(options.body),row=Number(body.range.match(/!A(\d+)/)[1]);sheets[sheet][row-1]=body.values[0];if(sheet==='عروض الأسعار'&&row===1)headerWrites++;return Response.json({});}
  return Response.json({values:sheets[sheet]||[]});
 };
 try{
  const {saveRecord,getQuotationData}=await import('../lib/balqees-db.js');const id='40000000-0000-4000-8000-000000000001';const p={client_id:'c1',status:'أرسل',followup_date:'2026-10-20',probability:'٧٥',quotation_request_id:id,quote_details:{...doc,totals:{total:1}}};
  const r=await saveRecord('office@example.test','quotes',p);assert.equal(r.record.id,id);assert.equal(r.record.total,207);assert.equal(headerWrites,1);assert.equal(dimensionAdds,1);assert.equal(appended,1);assert.equal(driveCalls,0);
  const retry=await saveRecord('office@example.test','quotes',p);assert.equal(retry.reconciled,true);assert.equal(appended,1);
  assert.equal(sheets['عروض الأسعار'][1][16],'kept-file');assert.equal(sheets['عروض الأسعار'][1][17],'kept notes');
  const ctx=await getQuotationData(id);assert.equal(JSON.parse(ctx.record.quote_details_json).lines.length,1);assert.equal(ctx.clients[0].name,'QA');
  const updated=await saveRecord('office@example.test','quotes',{...p,id,version:1,quotation_request_id:'40000000-0000-4000-8000-000000000002',quote_details:{...doc,lines:[{...line,unit_price:200}]}});assert.equal(updated.record.version,2);assert.equal(updated.record.total,414);
  assert.equal(updated.record.followup_date,'2026-10-20');assert.equal(updated.record.probability,75);
  await assert.rejects(saveRecord('office@example.test','quotes',{...p,probability:101}));await assert.rejects(saveRecord('office@example.test','quotes',{...p,followup_date:'2026-02-30'}));
  await assert.rejects(saveRecord('office@example.test','quotes',{...p,id,version:1,quotation_request_id:'40000000-0000-4000-8000-000000000003'}),{code:'QUOTE_CONFLICT'});
  await assert.rejects(saveRecord('office@example.test','quotes',{...p,quotation_request_id:'40000000-0000-4000-8000-000000000004',project_id:'missing'}));
  const upgraded=await saveRecord('office@example.test','quotes',{...p,id:'old',version:1,followup_date:undefined,probability:undefined,quotation_request_id:'40000000-0000-4000-8000-000000000005'});assert.equal(upgraded.record.file_id,'kept-file');assert.equal(upgraded.record.probability,0);assert.equal(appended,1);
  const {default:handler}=await import('../api/balqees.js');const res={code:200,setHeader(){},status(c){this.code=c;return this;},json(data){this.data=data;return this;}};await handler({method:'POST',headers:{},body:{action:'getQuotationData',args:[id]}},res);assert.equal(res.code,401);
 }finally{globalThis.fetch=savedFetch;for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
