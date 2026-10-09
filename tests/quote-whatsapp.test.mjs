import test from 'node:test';
import assert from 'node:assert/strict';
import { adminQuoteRequestPath, safeAdminQuoteReturn } from '../src/lib/quoteRequests.js';
import { quoteSalesReviewUrl, quoteWhatsAppHref, quoteWhatsAppMessage } from '../src/lib/quoteWhatsApp.js';

const id='7b91f3a4-c820-4e30-9488-d44b1bca43e1';
const siteUrl='https://balqees123.vercel.app';
const request={id,request_number:42,kind:'products',status:'submitted',contact_name:'عميل بلقيس',phone:'0500000000',location:'مكة',description:'ورد أبيض & مراكن للموقع',items:[{name_ar:'غير محفوظ',quantity:999}],product_snapshot:[{name_ar:'ورد أبيض',name_en:'White flowers',quantity:2.5,sku:'FLOWER-1',unit_ar:'ربطة',unit_en:'bundle',price_on_request:true},{name_ar:'مركن حجري',name_en:'Stone planter',quantity:3,sku:'POT-2',unit_ar:'قطعة',unit_en:'piece',price_on_request:true}]};

test('sales draft uses the saved catalog snapshot and keeps every requested quantity',()=>{
  const before=structuredClone(request);
  const href=new URL(quoteWhatsAppHref(request,{siteUrl}));
  assert.equal(href.origin,'https://wa.me');
  assert.equal(href.pathname,'/966599076267');
  const message=href.searchParams.get('text');
  for(const text of ['RFQ #42','ورد أبيض [FLOWER-1] — 2.5 ربطة','مركن حجري [POT-2] — 3 قطعة','ورد أبيض & مراكن للموقع',`${siteUrl}/admin/quote-requests?request=${id}`]) assert.ok(message.includes(text),text);
  assert.ok(!message.includes('999'));
  assert.ok(!message.includes('undefined'));
  assert.deepEqual(request,before);
});
test('service and English drafts carry scheduling and the same protected review link',()=>{
  const service={...request,kind:'service',service_type:'weekly_flowers',frequency:'weekly',duration_months:6,preferred_date:'2026-12-01',product_snapshot:[]};
  const message=quoteWhatsAppMessage(service,{ar:false,siteUrl});
  for(const text of ['Weekly flower contract','Schedule: Weekly','Duration: 6 months','2026-12-01','admin sign-in required']) assert.ok(message.includes(text),text);
  const products=quoteWhatsAppMessage(request,{ar:false,siteUrl});
  assert.ok(products.includes('White flowers [FLOWER-1] — 2.5 bundle'));
});
test('maximum cart keeps all fifty lines while shortening only descriptive text',()=>{
  const product_snapshot=Array.from({length:50},(_,i)=>({name_ar:'نبتة '+('س'.repeat(200)),sku:`P-${i+1}`,quantity:i+1,unit_ar:'قطعة'}));
  const message=quoteWhatsAppMessage({...request,product_snapshot,description:'تفاصيل '.repeat(700)},{siteUrl});
  assert.equal(message.split('\n').filter(l=>/^\d+\. /.test(l)).length,50);
  assert.ok(message.includes('[P-50] — 50 قطعة'));
  assert.ok(message.includes('…'));
  assert.ok(message.endsWith(`${siteUrl}/admin/quote-requests?request=${id}`));
});
test('only a saved RFQ and a web origin can produce a WhatsApp handoff',()=>{
  for(const row of [{...request,id:null},{...request,id:'not-a-uuid'},{...request,request_number:null},{...request,request_number:0}]) assert.equal(quoteWhatsAppHref(row,{siteUrl}),'');
  for(const origin of ['javascript:alert(1)','https://user:pass@example.test','invalid']) assert.equal(quoteSalesReviewUrl(request,origin),'');
  assert.equal(quoteSalesReviewUrl(request,siteUrl+'/ignored?next=external#x'),`${siteUrl}/admin/quote-requests?request=${id}`);
});
test('admin login return accepts the RFQ path without opening an external redirect',()=>{
  const path=adminQuoteRequestPath(id);
  assert.equal(safeAdminQuoteReturn(path),path);
  assert.equal(safeAdminQuoteReturn('/admin/quote-requests?request='+id.toUpperCase()),path);
  for(const value of [`https://example.test${path}`,`/${path}`,`${path}&next=https://example.test`,`${path}&request=${id}`,`${path}#x`,`${path}\n`,'/admin/quote-requests?request=broken','/admin/users?request='+id,'/admin/quote-requests/other?request='+id]) assert.equal(safeAdminQuoteReturn(value),null,value);
});
