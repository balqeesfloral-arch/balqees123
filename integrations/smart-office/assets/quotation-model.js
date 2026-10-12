export const QUOTATION_EDITION='10.2.5';
export const QUOTE_STATUSES=['مسودة','أرسل','قيد المتابعة','مقبول','مرفوض','منتهي'];
export const QUOTE_MODES=['ar','en','both'];
export class QuoteError extends Error {constructor(message,code='QUOTE_INVALID'){super(message);this.code=code;}}
const text=(v,max=160)=>String(v??'').trim().slice(0,max);
const required=(v,name,max=160)=>{const s=text(v,max);if(!s)throw new QuoteError(`أكمل ${name}.`);return s;};
export const quoteMoney=v=>new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0);
export function decimal(value,places=2) {
  let raw=String(value??'').trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/٬/g,',').replace(/٫/g,'.');
  if(raw.includes(',')){if(!/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(raw))throw new QuoteError('راجع مواضع فواصل الآلاف.');raw=raw.replaceAll(',','');}
  if(!/^\d+(?:\.\d+)?$/.test(raw)||raw.split('.')[1]?.length>places)throw new QuoteError(`استخدم رقمًا موجبًا حتى ${places} منازل عشرية.`);
  const parts=raw.split('.'),n=Number(parts[0])*10**places+Number((parts[1]||'').padEnd(places,'0'));
  if(!Number.isSafeInteger(n)||n>1e12)throw new QuoteError('القيمة الرقمية أكبر من الحد المسموح.');return n;
}
const roundedRatio=(a,b,d)=>{const den=BigInt(d);const n=Number((BigInt(a)*BigInt(b)+den/2n)/den);if(!Number.isSafeInteger(n)||n>1e11)throw new QuoteError('إجمالي العرض أكبر من الحد المسموح.');return n;};
export function calculateQuote(lines,priceBasis='exclusive') {
  if(!Array.isArray(lines)||!lines.length||lines.length>50)throw new QuoteError('أضف من بند واحد إلى 50 بندًا.');
  const computed=lines.map((line,index)=>{
    try {
      const qty=decimal(line.quantity,3),price=decimal(line.unit_price,2),rate=decimal(line.vat_rate??15,2),discount=decimal(line.discount_percent??0,2);
      if(!qty||qty>1e9)throw new QuoteError('الكمية يجب أن تكون أكبر من صفر.');
      if(rate>10000||discount>10000)throw new QuoteError('الضريبة والخصم يجب أن يكونا بين 0 و100%.');
      const gross=roundedRatio(price,qty,1000),discountInBasis=roundedRatio(gross,discount,10000),base=gross-discountInBasis;
      const net=priceBasis==='inclusive'?roundedRatio(base,10000,10000+rate):base;
      const tax=priceBasis==='inclusive'?base-net:roundedRatio(net,rate,10000);
      const originalNet=priceBasis==='inclusive'?roundedRatio(gross,10000,10000+rate):gross;
      return {...line,quantity:qty/1000,unit_price:price/100,vat_rate:rate/100,discount_percent:discount/100,
        subtotal:originalNet/100,discount_amount:(originalNet-net)/100,net:net/100,vat_amount:tax/100,total:(net+tax)/100,
        _cents:{subtotal:originalNet,discount:originalNet-net,net,vat:tax,total:net+tax}};
    } catch(e){throw new QuoteError(`البند ${index+1}: ${e.message}`);}
  });
  const totals={subtotal:0,discount:0,net:0,vat:0,total:0},rates=new Map();
  for(const line of computed){for(const k of Object.keys(totals))totals[k]+=line._cents[k];const r=rates.get(line.vat_rate)||{rate:line.vat_rate,net:0,vat:0};r.net+=line._cents.net;r.vat+=line._cents.vat;rates.set(line.vat_rate,r);}
  if(totals.total>1e11)throw new QuoteError('إجمالي العرض يتجاوز الحد المسموح.');
  return {lines:computed.map(({_cents,...line})=>line),totals:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,v/100])),taxes:[...rates.values()].sort((a,b)=>a.rate-b.rate).map(r=>({...r,net:r.net/100,vat:r.vat/100}))};
}
function iso(value,name,optional=false) {const s=text(value,10);if(!s&&optional)return '';if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw new QuoteError(`راجع ${name}.`);return s;}
export function normalizeQuotation(input={},status='مسودة') {
  if(!input||typeof input!=='object'||!Array.isArray(input.lines)||input.lines.some(l=>!l||typeof l!=='object'))throw new QuoteError('بيانات بنود العرض غير صالحة.');
  if(!QUOTE_MODES.includes(input.language)||!['exclusive','inclusive'].includes(input.price_basis)||!QUOTE_STATUSES.includes(status))throw new QuoteError('لغة العرض أو حالته أو أساس الضريبة غير صالح.');
  const lines=(input.lines||[]).map(l=>({id:text(l.id,80),kind:l.kind==='service'?'service':'product',sku:text(l.sku,80),name_ar:text(l.name_ar,160),name_en:text(l.name_en,160),details_ar:text(l.details_ar,600),details_en:text(l.details_en,600),quantity:l.quantity,unit_ar:text(l.unit_ar,30),unit_en:text(l.unit_en,30),unit_price:l.unit_price,vat_rate:l.vat_rate,discount_percent:l.discount_percent}));
  const result=calculateQuote(lines,input.price_basis);
  const doc={schema_version:1,edition:QUOTATION_EDITION,language:input.language,price_basis:input.price_basis,title_ar:text(input.title_ar,200),title_en:text(input.title_en,200),
    customer_name_en:text(input.customer_name_en,200),project_name_en:text(input.project_name_en,200),customer_address_en:text(input.customer_address_en,500),
    date:iso(input.date,'تاريخ العرض'),valid_until:iso(input.valid_until,'تاريخ الصلاحية',true),terms_ar:text(input.terms_ar,6000),terms_en:text(input.terms_en,6000),notes_ar:text(input.notes_ar,3000),notes_en:text(input.notes_en,3000),
    show_signature:input.show_signature!==false,lines:result.lines,totals:result.totals,taxes:result.taxes};
  if(doc.valid_until&&doc.valid_until<doc.date)throw new QuoteError('صلاحية العرض يجب أن تكون في تاريخ العرض أو بعده.');
  if(status!=='مسودة'&&!doc.totals.total)throw new QuoteError('أدخل أسعار البنود قبل إرسال العرض أو اعتماده.');
  for(const [i,line] of doc.lines.entries()) {
    if(doc.language!=='en'){required(line.name_ar,`اسم البند ${i+1} بالعربية`);required(line.unit_ar,`وحدة البند ${i+1} بالعربية`);}
    if(doc.language==='both'&&line.details_en&&!line.details_ar)throw new QuoteError(`أضف تفاصيل البند ${i+1} بالعربية للنسخة الثنائية.`);
    if(doc.language!=='ar'){required(line.name_en,`اسم البند ${i+1} بالإنجليزية`);required(line.unit_en,`وحدة البند ${i+1} بالإنجليزية`);if(line.details_ar&&!line.details_en)throw new QuoteError(`أضف ترجمة تفاصيل البند ${i+1} أو اختر الطباعة بالعربية.`);}
  }
  if(doc.language!=='en')required(doc.title_ar,'عنوان العرض بالعربية',200);
  if(doc.language==='both'&&((doc.terms_en&&!doc.terms_ar)||(doc.notes_en&&!doc.notes_ar)))throw new QuoteError('أكمل الشروط والملاحظات بالعربية للنسخة الثنائية.');
  if(doc.language!=='ar') {
    required(doc.title_en,'عنوان العرض بالإنجليزية',200);required(doc.customer_name_en,'اسم العميل بالإنجليزية',200);
    if(doc.terms_ar&&!doc.terms_en)throw new QuoteError('أضف الشروط بالإنجليزية أو اختر العربية.');
    if(doc.notes_ar&&!doc.notes_en)throw new QuoteError('أضف الملاحظات بالإنجليزية أو اختر العربية.');
  }
  if(JSON.stringify(doc).length>44000)throw new QuoteError('تفاصيل العرض طويلة جدًا للحفظ. اختصر التفاصيل أو قسم العرض إلى عروض مستقلة.');
  return doc;
}
export function quotationFromRecord(record={}) {
  if(record.quote_details_json){try{const d=typeof record.quote_details_json==='string'?JSON.parse(record.quote_details_json):record.quote_details_json;if(d.schema_version===1&&Array.isArray(d.lines))return structuredClone(d);}catch{throw new QuoteError('تفاصيل العرض المحفوظة غير قابلة للقراءة. لم تُغيّر البيانات.','QUOTE_DATA_INVALID');}}
  return {schema_version:1,edition:QUOTATION_EDITION,language:'ar',price_basis:'exclusive',title_ar:'عرض سعر',title_en:'Commercial Quotation',date:record.date||new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Riyadh'}).format(new Date()),valid_until:record.valid_until||'',customer_name_en:'',customer_address_en:'',project_name_en:'',terms_ar:'',terms_en:'',notes_ar:record.notes||'',notes_en:'',show_signature:true,
    lines:[{id:'legacy',kind:'service',name_ar:record.description?'نطاق العرض':'',name_en:'',details_ar:record.description||'',details_en:'',quantity:1,unit_ar:'عرض',unit_en:'quotation',unit_price:record.subtotal||0,vat_rate:record.vat_rate??15,discount_percent:0}]};
}
export const QUOTE_TEMPLATES=[
 {key:'flowers',kind:'product',name_ar:'توريد زهور طبيعية',name_en:'Fresh Flower Supply',details_ar:'زهور طبيعية مختارة وفق النوع واللون والمواصفات المعتمدة.',details_en:'Selected fresh flowers supplied in accordance with the approved varieties, colours and specifications.',unit_ar:'باقة',unit_en:'bouquet'},
 {key:'plants',kind:'product',name_ar:'توريد أشجار ونباتات',name_en:'Tree and Plant Supply',details_ar:'أشجار ونباتات بالمقاسات والأصناف المتفق عليها، مع بيان مواصفات كل صنف.',details_en:'Trees and plants supplied in the agreed sizes and varieties, with specifications stated for each item.',unit_ar:'قطعة',unit_en:'unit'},
 {key:'planters',kind:'product',name_ar:'توريد مراكن وأحواض نباتات',name_en:'Planter and Plant Pot Supply',details_ar:'مراكن وأحواض حسب الخامة والمقاس واللون والتشطيب المعتمد.',details_en:'Planters and plant pots supplied in the approved material, size, colour and finish.',unit_ar:'قطعة',unit_en:'unit'},
 {key:'vases',kind:'product',name_ar:'توريد فازات',name_en:'Vase Supply',details_ar:'فازات وفق المقاسات والخامات والتشطيبات المحددة في العرض.',details_en:'Vases supplied in accordance with the sizes, materials and finishes specified in this quotation.',unit_ar:'قطعة',unit_en:'unit'},
 {key:'arrangements',kind:'service',name_ar:'تنسيق زهور وفازات',name_en:'Floral and Vase Arrangement',details_ar:'تنسيق وترتيب الزهور والفازات ضمن المواقع والنطاق المعتمد.',details_en:'Professional floral and vase arrangements for the designated locations within the approved scope.',unit_ar:'خدمة',unit_en:'service'},
 {key:'maintenance',kind:'service',name_ar:'صيانة دورية للنباتات',name_en:'Scheduled Plant Maintenance',details_ar:'العناية الدورية بالنباتات وفق جدول الزيارات والأعمال المتفق عليها.',details_en:'Scheduled plant care in accordance with the agreed visit schedule and maintenance scope.',unit_ar:'زيارة',unit_en:'visit'},
 {key:'weekly',kind:'service',name_ar:'خدمة ورد أسبوعية',name_en:'Weekly Floral Service',details_ar:'توريد وتنسيق الورد أسبوعيًا حسب المواقع والكميات والجدول المعتمد.',details_en:'Weekly flower supply and arrangement in accordance with the approved locations, quantities and schedule.',unit_ar:'أسبوع',unit_en:'week'},
 {key:'monthly',kind:'service',name_ar:'خدمة ورد شهرية',name_en:'Monthly Floral Service',details_ar:'خدمة زهور شهرية ضمن نطاق التوريد والتنسيق وجدول الاستبدال المتفق عليه.',details_en:'A monthly floral service covering the agreed supply, arrangement and replacement schedule.',unit_ar:'شهر',unit_en:'month'},
];
export const DEFAULT_QUOTE_TERMS={ar:'نطاق العرض: تقتصر الأسعار على البنود والمواصفات المذكورة، وأي تعديل أو إضافة يُعتمد كتابيًا قبل التنفيذ.\nالتوريد والتنفيذ: يُؤكد الجدول بعد الاعتماد الكتابي للعرض والتحقق من توافر الأصناف وترتيبات الموقع.\nالسداد: تُحدد آلية ومواعيد السداد بموجب الاتفاق المكتوب بين الطرفين.',en:'Scope: Prices cover only the listed items and specifications. Any variation or additional work requires written approval before execution.\nSupply and execution: The schedule will be confirmed following written acceptance of this quotation, verification of item availability and coordination of site arrangements.\nPayment: The payment method and schedule shall be agreed in writing by both parties.'};
