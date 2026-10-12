import {normalizeQuotation,quotationFromRecord,quoteMoney} from './quotation-model.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const image=value=>/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(String(value||''))?value:'';
function date(value,lang){if(!value)return '—';return new Intl.DateTimeFormat(lang==='ar'?'ar-SA-u-ca-gregory-nu-latn':'en-GB',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Riyadh'}).format(new Date(value+'T12:00:00Z'));}
export function quotationDocument(record,{company={},client={},project={},assets={},language,origin='https://balqees-smart-office.vercel.app'}={}) {
  const doc=normalizeQuotation({...quotationFromRecord(record),...(language?{language}:{})},record.status||'مسودة');
  const ar=doc.language!=='en',en=doc.language!=='ar',both=ar&&en;
  const pair=(a,e,tag='span',className='')=>`<${tag} class="pair ${className}">${ar?`<span lang="ar" dir="rtl">${esc(a)}</span>`:''}${en?`<span lang="en" dir="ltr">${esc(e)}</span>`:''}</${tag}>`;
  const paragraphs=(a,e)=>pair(a,e,'p','prose');
  const title=both?'عرض سعر | Commercial Quotation':ar?'عرض سعر':'Commercial Quotation';
  const logo=image(assets.logo),signature=image(assets.signature),stamp=image(assets.stamp);
  const originUrl=new URL(origin);if(!['https:','http:'].includes(originUrl.protocol))throw new Error('Print origin invalid');
  const fonts=new URL('/assets/quote-fonts/',originUrl.origin).href;
  const cityEn=({'مكة':'Makkah','مكة المكرمة':'Makkah','جدة':'Jeddah','الرياض':'Riyadh'})[company.city]||'';
  const reference=record.quote_no||'DRAFT',companyAr=company.company_name||'بلقيس الورد للزهور والنباتات',companyEn=company.company_name_en||'Balqees Floral';
  const contact=[company.phone1||company.phone||'',company.email1||company.email||'',company.website||''].filter(Boolean);
  const termsAr=doc.terms_ar.split('\n'),termsEn=doc.terms_en.split('\n');
  const vatRow=`<tr><td>${pair('ضريبة القيمة المضافة','Value added tax (VAT)')}</td><td class="numeric">${quoteMoney(doc.totals.vat)}</td></tr>`;
  const footerText=both?'بلقيس الورد | Balqees Floral':ar?'بلقيس الورد':'Balqees Floral';
  const signoff=`<section class="signoff"><div>${pair('اعتماد بلقيس','Issued by Balqees','div','section-caption')}<div class="sign-images">${doc.show_signature&&signature?`<img src="${signature}" alt="${ar?'التوقيع':'Signature'}">`:''}${doc.show_signature&&stamp?`<img src="${stamp}" alt="${ar?'الختم':'Stamp'}">`:''}</div></div><div>${pair('اعتماد العميل','Customer acceptance','div','section-caption')}<div class="acceptance-line"></div></div></section>`;
  return `<!doctype html><html lang="${ar?'ar':'en'}" dir="${ar?'rtl':'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(reference)} · ${title}</title><style>
@font-face{font-family:QuoteNaskh;src:url('${fonts}naskh-regular.ttf') format('truetype');font-weight:400;font-display:block}@font-face{font-family:QuoteNaskh;src:url('${fonts}naskh-bold.ttf') format('truetype');font-weight:700;font-display:block}@font-face{font-family:QuoteDM;src:url('${fonts}dm-regular.ttf') format('truetype');font-weight:400;font-display:block}@font-face{font-family:QuoteDM;src:url('${fonts}dm-semibold.ttf') format('truetype');font-weight:600 900;font-display:block}
@page{size:A4;margin:12mm 13mm 15mm;
  @bottom-center{content:counter(page) ' / ' counter(pages);direction:ltr;font-family:QuoteDM,Arial;font-size:8pt;color:#68705f}
  @bottom-left{content:'${footerText}';font-family:QuoteNaskh,Arial;font-size:8pt;color:#68705f}
}
*{box-sizing:border-box}html,body{margin:0;padding:0;color:#25342b;background:white}
body{font-family:${ar?'QuoteNaskh':'QuoteDM'},Tahoma,Arial;font-size:${ar?'11':'9.5'}pt;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:184mm;margin:0 auto;padding:0}h1,h2,p{margin:0}
.pair{display:flex;flex-direction:column;gap:.25mm}
.pair>[lang=en]{font-family:QuoteDM,Arial;font-size:8.5pt;line-height:1.35}
.pair>[lang=ar]{font-family:QuoteNaskh,Tahoma;line-height:1.45}
.numeric{font-family:QuoteDM,Arial;font-size:9pt;font-variant-numeric:tabular-nums;direction:ltr;text-align:end;white-space:nowrap}
.letterhead{display:flex;align-items:center;justify-content:space-between;gap:10mm;padding-bottom:3mm;border-bottom:.75mm solid #b79a58;break-inside:avoid}
.brand-logo{width:29mm;height:24mm;object-fit:contain;object-position:center}
.brand-name{max-width:140mm;flex:1}
.brand-name>.pair>[lang=ar]{font-size:18pt;font-weight:700;line-height:1.4}
.brand-name>.pair>[lang=en]{font-size:12pt;font-weight:600;letter-spacing:.045em}
.issuer-details{font-size:9pt;color:#647060;margin-top:1mm}
.issuer-details .pair{display:inline-flex;flex-direction:row;gap:3mm}
.issuer-contact{display:flex;flex-wrap:wrap;gap:1mm 4mm;direction:ltr;justify-content:${ar?'flex-end':'flex-start'};font-family:QuoteDM,Arial;font-size:8pt;margin-top:1mm;color:#647060}
.document-title{display:flex;justify-content:space-between;align-items:center;gap:7mm;padding:4mm 0 3mm;border-bottom:.25mm solid #d6d8cc;break-inside:avoid}
.document-title h1 [lang=ar]{font-size:21pt;color:#2a4232;font-weight:700}
.document-title h1 [lang=en]{font-family:Georgia,serif;font-size:${both?'13':'23'}pt;letter-spacing:.02em;color:#2a4232}
.document-title h1 .pair{flex-direction:${both?'row':'column'};align-items:baseline;gap:4mm}
.reference{text-align:end}.reference strong{display:block;font-family:QuoteDM,Arial;font-size:10pt;letter-spacing:.02em;color:#3c5140;white-space:nowrap}
.reference .pair{color:#79816f;font-size:9pt;margin-bottom:1mm}
.parties{display:grid;grid-template-columns:1.1fr 1fr;gap:9mm;margin:3mm 0}
.recipient,.document-meta{padding-top:1mm;break-inside:avoid}
.section-caption [lang=ar]{font-size:10pt;font-weight:700;color:#63744e}
.section-caption [lang=en]{font-size:7.5pt;text-transform:uppercase;letter-spacing:.065em;color:#63744e}
.section-caption{display:flex;flex-direction:row;gap:3mm;align-items:baseline}
.customer-name{margin:1.5mm 0;font-size:13pt;font-weight:700}.customer-name [lang=en]{font-size:10.5pt}
.recipient-extra{font-size:9pt;color:#5f6a5b}.recipient-extra .pair{margin:.75mm 0}
.document-meta dl{display:grid;grid-template-columns:auto 1fr;gap:1mm 3mm;margin:1.5mm 0}
.document-meta dt{font-weight:400;color:#6b7564}.document-meta dd{margin:0;text-align:end}
.document-meta .pair{font-size:9.5pt}.document-meta .pair>[lang=en]{font-size:7.5pt}
.document-meta dd .pair{flex-direction:row;justify-content:flex-end;gap:3mm;align-items:center}
.intro{margin:2mm 0 3mm;color:#53604c;font-size:9.5pt}.intro .pair>[lang=en]{font-size:8pt}
.items{border-collapse:collapse;width:100%;table-layout:fixed;margin-bottom:2mm}
.items thead{display:table-header-group;break-inside:avoid;break-after:avoid}.items th{background:#edf0e7;color:#384c34;border-top:.5mm solid #667950;border-bottom:.3mm solid #aeb6a3;font-size:9.5pt;padding:2mm 1.6mm;text-align:start;font-weight:700;vertical-align:middle}
.items th .pair>[lang=en]{font-size:7pt;font-weight:600;letter-spacing:0}
.items td{padding:2.5mm 1.6mm;border-bottom:.25mm solid #dfe3d7;vertical-align:top}
.items tr{break-inside:avoid}.items th:first-child,.items td:first-child{text-align:center;color:#809073}
.item-name{font-weight:700;font-size:10.5pt}.item-name>[lang=en]{font-size:8.5pt;font-weight:600}
.item-details{font-weight:400;font-size:9pt;color:#646e5d;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:.75mm}
.item-details>[lang=en]{font-size:7.5pt}
.item-kind{display:flex;flex-direction:row;align-items:center;gap:2mm;color:#8b784a;font-size:8pt;margin-bottom:.5mm}.item-kind>[lang=en]{font-size:6.5pt}
.sku{font-family:QuoteDM;font-size:7pt;direction:ltr;display:block;color:#7e8478;margin-top:.5mm}
.qty-unit{text-align:center}.qty-unit .numeric{text-align:center;display:block}.qty-unit .pair{font-size:8.5pt;color:#6e7863}.qty-unit .pair>[lang=en]{font-size:7pt}
.line-total{font-weight:600;color:#2b4731}.basis-note{font-size:8.5pt;color:#777e6f;margin:1mm 0 3mm}.basis-note .pair>[lang=en]{font-size:7.5pt}
.settlement{display:grid;grid-template-columns:1fr 90mm;gap:9mm;margin:3mm 0;align-items:start}
.financials{border-collapse:collapse;width:100%;break-inside:avoid}
.financials td{padding:1.3mm 0;border-bottom:.2mm solid #e3e6da;vertical-align:middle}
.financials td:first-child{padding-inline-end:3mm}.financials .pair{display:flex;flex-direction:${both?'row':'column'};gap:2mm;align-items:center;justify-content:space-between;font-size:9pt}
.financials .pair>[lang=en]{font-size:7.5pt;max-width:${both?'35mm':'none'}}
.financials .grand td{border-top:.65mm solid #ad9153;border-bottom:0;padding:2.5mm 1.5mm;background:#f4f0e6;color:#294530;font-weight:700}
.financials .grand .pair{flex-direction:column;align-items:flex-start}.financials .grand .numeric{font-size:16pt;font-weight:600}
.financials .currency{font-family:QuoteDM;font-size:7pt;display:block;color:#7f876d;margin-top:.5mm}
.notes-section h2,.terms-section h2{margin-bottom:1.5mm}
.notes-section p,.terms-section p{white-space:pre-wrap;overflow-wrap:anywhere}
.notes-section .prose{color:#5d6952;font-size:9pt}.notes-section .prose>[lang=en]{font-size:7.5pt}
.terms-section{margin:4mm 0 3mm;border-top:.3mm solid #c6cdbb;padding-top:2mm}
.terms-section .prose{display:grid;grid-template-columns:${both?'1fr 1fr':'1fr'};gap:5mm;margin:1.5mm 0;orphans:2;widows:2;color:#4e5d46;font-size:9pt;break-inside:avoid}
.terms-section .prose>[lang=en]{font-size:7.5pt}
.signoff{display:grid;grid-template-columns:1fr 1fr;gap:14mm;margin:4mm 0 2mm;border-top:.3mm solid #c9cfbf;padding-top:2mm;break-inside:avoid}
.signoff .section-caption{display:flex;flex-direction:row;gap:3mm;align-items:center}
.sign-images{display:flex;align-items:center;gap:5mm;height:18mm;margin-top:1mm}.sign-images img{width:27mm;height:18mm;object-fit:contain}
.acceptance-line{margin-top:16mm;border-bottom:.25mm solid #929e85;width:65mm}
.document-footer{margin:3mm 0 0;padding-top:2mm;border-top:.25mm solid #b5bea6;color:#67715f;break-inside:avoid;font-size:8pt}
.document-footer>.pair{display:grid;grid-template-columns:${both?'1fr 1fr':'1fr'};gap:5mm}.document-footer .pair>[lang=en]{font-size:7pt}
.closing{break-inside:avoid}
.agreement{break-inside:avoid}
${both?`
.brand-logo{height:20mm;width:26mm}.letterhead{padding-bottom:2mm}
.brand-name>.pair{flex-direction:row;align-items:baseline;justify-content:space-between;gap:3mm}.brand-name>.pair>[lang=en]{font-size:11pt;letter-spacing:.025em}
.reference .pair{flex-direction:row;gap:2mm;align-items:baseline;font-size:8.5pt}.reference .pair>[lang=en]{font-size:7.5pt}
.document-title{padding:3mm 0 2mm}.document-title h1 [lang=ar]{font-size:20pt}
.document-meta dt .pair{flex-direction:row;align-items:baseline;gap:2mm;font-size:9pt}.document-meta dt .pair>[lang=en]{font-size:7pt}
.document-meta dl{gap:1.5mm 3mm}.parties{margin:2mm 0}.intro{margin:1mm 0 2mm}
.customer-name{flex-direction:row;justify-content:space-between;align-items:baseline;gap:3mm}.customer-name>span{max-width:58%}.customer-name>[lang=en]{font-size:9.5pt}
.items td{padding:1mm 1.6mm}.item-details>[lang=ar]{line-height:1.3}.item-details>[lang=en]{line-height:1.25}
.settlement{margin:2mm 0}.financials td{padding:1mm 0}.financials .grand td{padding:2mm 1.5mm}
.financials .grand .pair{flex-direction:row;gap:2mm;align-items:baseline}.financials .grand .numeric{font-size:15pt}
.financials .grand .currency{display:inline;margin-inline-start:2mm}
.terms-section{margin:3mm 0 2mm;padding-top:1.5mm}.terms-section .prose{margin:1mm 0}
.signoff{margin:2mm 0;padding-top:1.5mm}.sign-images,.sign-images img{height:16mm}.acceptance-line{margin-top:14mm}
.document-footer{margin-top:2mm;padding-top:1.5mm}
.settlement .signoff{gap:4mm;margin-top:3mm}.settlement .signoff .section-caption{flex-direction:column;align-items:flex-start;gap:0}
.settlement .sign-images{height:14mm;gap:1mm}.settlement .sign-images img{width:18mm;height:14mm}
.settlement .acceptance-line{width:100%;margin-top:13mm}
`:''}
.legal-ids{display:flex;flex-wrap:wrap;gap:1mm 5mm;margin-top:1mm}.legal-ids .pair{display:inline-flex}
.draft-label{font-family:QuoteDM,QuoteNaskh;color:#946e38;border:.3mm solid #b49562;display:inline-block;padding:.75mm 3mm;margin-top:1mm;font-size:9pt}
.print-actions{padding:15px;display:flex;justify-content:center;gap:12px;font-family:QuoteDM,Tahoma;background:#f3f5ef;margin-bottom:20px}
.print-actions button{padding:10px 18px;background:#29452e;color:white;border:0;cursor:pointer;border-radius:4px}.print-note{font-family:QuoteNaskh,Arial;font-size:12pt;color:#6e765f}
@media screen{body{background:#e9ece3}.sheet{background:white;padding:11mm 0;margin:20px auto;box-shadow:0 8px 40px #1d2d2020}.page-content{padding:0}}
@media print{.print-actions{display:none}.sheet{width:auto;margin:0;padding:0;box-shadow:none}.page-content{padding:0}}
</style></head><body><div class="print-actions"><button id="quotePrintButton">${ar?'طباعة / حفظ PDF':'Print / Save PDF'}</button><span class="print-note">${ar?'اختر حجم A4، وألغِ رؤوس وتذييلات المتصفح.':'Select A4 and disable browser headers and footers.'}</span></div><main class="sheet"><div class="page-content">
<header class="letterhead"><div class="brand-name">${pair(companyAr,companyEn)}<div class="issuer-details">${pair(company.city||'',cityEn)}</div><div class="issuer-contact">${contact.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>${logo?`<img class="brand-logo" src="${logo}" alt="${ar?'شعار بلقيس':'Balqees logo'}">`:''}</header>
<section class="document-title"><h1>${pair(doc.title_ar,doc.title_en)}</h1><div class="reference">${pair('رقم العرض','Quotation reference')}<strong dir="ltr">${esc(reference)}</strong>${record.status==='مسودة'?`<span class="draft-label">${both?'مسودة / DRAFT':ar?'مسودة':'DRAFT'}</span>`:''}</div></section>
<section class="parties"><div class="recipient">${pair('مقدم إلى','Prepared for','div','section-caption')}${pair(record.client_name||client.name||'',doc.customer_name_en,'div','customer-name')}<div class="recipient-extra">${(client.address||doc.customer_address_en)?pair(client.address||'',doc.customer_address_en):''}${(record.project_name||project.name)?pair(record.project_name||project.name||'',doc.project_name_en||project.project_no||''):''}${client.vat_no?pair(`الرقم الضريبي: ${client.vat_no}`,`VAT registration no.: ${client.vat_no}`):''}</div></div><div class="document-meta">${pair('بيانات العرض','Quotation details','div','section-caption')}<dl><dt>${pair('تاريخ الإصدار','Issue date')}</dt><dd>${pair(date(doc.date,'ar'),date(doc.date,'en'))}</dd><dt>${pair('صالح حتى','Valid until')}</dt><dd>${pair(doc.valid_until?date(doc.valid_until,'ar'):'حسب الاتفاق',doc.valid_until?date(doc.valid_until,'en'):'As agreed')}</dd></dl></div></section>
<section class="intro">${paragraphs('يسرّنا أن نقدم لكم عرضنا وفق البنود والمواصفات والشروط الموضحة أدناه.','We are pleased to submit our quotation in accordance with the items, specifications and terms set out below.')}</section>
<table class="items"><colgroup><col style="width:5%"><col style="width:37%"><col style="width:11%"><col style="width:15%"><col style="width:8%"><col style="width:9%"><col style="width:15%"></colgroup><thead><tr><th>#</th><th>${pair('المنتج / الخدمة','Item / Service')}</th><th>${pair('الكمية','Quantity')}</th><th>${pair('سعر الوحدة','Unit price')}</th><th>${pair('الخصم','Discount')}</th><th>${pair('الضريبة','VAT')}</th><th>${pair('الإجمالي','Total')}</th></tr></thead><tbody>${doc.lines.map((line,i)=>`<tr><td class="numeric">${i+1}</td><td>${pair(line.kind==='service'?'خدمة':'منتج',line.kind==='service'?'Service':'Product','div','item-kind')}${pair(line.name_ar,line.name_en,'div','item-name')}${(line.details_ar||line.details_en)?pair(line.details_ar,line.details_en,'div','item-details'):''}${line.sku?`<span class="sku">${esc(line.sku)}</span>`:''}</td><td class="qty-unit"><b class="numeric">${line.quantity}</b>${pair(line.unit_ar,line.unit_en)}</td><td class="numeric">${quoteMoney(line.unit_price)}</td><td class="numeric">${line.discount_percent}%</td><td class="numeric">${line.vat_rate}%</td><td class="numeric line-total">${quoteMoney(line.total)}</td></tr>`).join('')}</tbody></table>
<div class="basis-note">${pair(doc.price_basis==='inclusive'?'أسعار الوحدات شاملة الضريبة. إجمالي كل بند شامل الضريبة بعد الخصم.':'أسعار الوحدات قبل الضريبة. إجمالي كل بند شامل الضريبة بعد الخصم.',doc.price_basis==='inclusive'?'Unit prices include VAT. Each line total includes VAT after discount.':'Unit prices exclude VAT. Each line total includes VAT after discount.')}</div>
<section class="settlement"><div class="notes-section">${(doc.notes_ar||doc.notes_en)?`${pair('ملاحظات العرض','Quotation notes','h2','section-caption')}${paragraphs(doc.notes_ar,doc.notes_en)}`:''}${both?signoff:''}</div><table class="financials"><tbody><tr><td>${pair('المجموع قبل الخصم','Subtotal before discount')}</td><td class="numeric">${quoteMoney(doc.totals.subtotal)}</td></tr>${doc.totals.discount?`<tr><td>${pair('إجمالي الخصم','Total discount')}</td><td class="numeric">${quoteMoney(doc.totals.discount)}</td></tr>`:''}<tr><td>${pair('الصافي قبل الضريبة','Net amount (excl. VAT)')}</td><td class="numeric">${quoteMoney(doc.totals.net)}</td></tr>${vatRow}<tr class="grand"><td>${pair('إجمالي العرض','Quotation total')}</td><td class="numeric">${quoteMoney(doc.totals.total)}<span class="currency">SAR</span></td></tr></tbody></table></section>
<div class="agreement">${(doc.terms_ar||doc.terms_en)?`<section class="terms-section">${pair('الشروط والأحكام','Terms and Conditions','h2','section-caption')}${Array.from({length:Math.max(termsAr.length,termsEn.length)},(_,i)=>paragraphs(termsAr[i]||'',termsEn[i]||'')).join('')}</section>`:''}
<div class="closing">${both?'':signoff}
<footer class="document-footer">${pair('هذا المستند عرض سعر تجاري، ولا يُعد فاتورة ضريبية أو إثباتًا للسداد.','This document is a commercial quotation, not a tax invoice or proof of payment.')}<div class="legal-ids">${company.vat_no?pair(`الرقم الضريبي: ${company.vat_no}`,`VAT registration no.: ${company.vat_no}`):''}${company.cr_no?pair(`السجل التجاري: ${company.cr_no}`,`Commercial registration no.: ${company.cr_no}`):''}${company.unified_no?pair(`الرقم الوطني الموحد: ${company.unified_no}`,`Unified national no.: ${company.unified_no}`):''}</div></footer>
</div></div></div></main><script>document.getElementById('quotePrintButton').addEventListener('click',function(){Promise.all([document.fonts.ready,...Array.from(document.images).map(function(im){return im.decode().catch(function(){})})]).then(function(){window.print()})});</script></body></html>`;
}
