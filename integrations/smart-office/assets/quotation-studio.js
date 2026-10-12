import {QUOTATION_EDITION,QUOTE_STATUSES,QUOTE_TEMPLATES,DEFAULT_QUOTE_TERMS,quoteMoney,calculateQuote,normalizeQuotation,quotationFromRecord} from './quotation-model.js';
import {quotationDocument} from './quotation-print.js';
import {normalizeSearch,buildCsv} from './office-tools.js';

const $=s=>document.querySelector(s),h=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!=null)e.textContent=value;return e;};
const icons=name=>{const e=h('span','qs-icon');e.innerHTML=window.ico(name);e.setAttribute('aria-hidden','true');return e;};
const button=(label,cls,fn,icon)=>{const e=h('button',cls,label);e.type='button';if(icon)e.prepend(icons(icon));if(fn)e.addEventListener('click',fn);return e;};
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Riyadh'}).format(new Date());
const number=v=>Number(v)||0;
const state={rows:[],query:'',status:'',sort:'newest',context:null,record:null,doc:null,loading:false,saving:false,dirty:false,uncertain:null,lastPayload:null,requestId:null};
const labels={ar:'العربية',en:'English',both:'العربية / English'};
const editor=h('dialog','qs-editor');editor.id='quotationEditor';editor.setAttribute('aria-labelledby','qsEditorTitle');
const preview=h('dialog','qs-preview');preview.id='quotationPreview';preview.setAttribute('aria-labelledby','qsPreviewTitle');
document.body.append(editor,preview);
let form,linesHost,summaryHost,message,previewFrame,previewRecord,previewContext,previewLanguage,previewURL;
const RECOVERY_KEY='balqees-quotation-pending';
function remember(payload){try{sessionStorage.setItem(RECOVERY_KEY,JSON.stringify({id:payload.id||payload.quotation_request_id,requestId:payload.quotation_request_id}));}catch{}}
function forget(){try{sessionStorage.removeItem(RECOVERY_KEY);}catch{}}
function pending(){try{return JSON.parse(sessionStorage.getItem(RECOVERY_KEY)||'null');}catch{return null;}}
async function api(action,args=[]) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try {const r=await fetch('/api/balqees',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,args}),signal:controller.signal});const body=await r.json().catch(()=>null);
    if(!r.ok||!body?.ok){const error=new Error(body?.error||'تعذر الاتصال بالمكتب.');error.status=r.status;error.code=body?.code;throw error;}return body.data;
  } finally{clearTimeout(timer);}
}
function notice(value,bad=false){if(!message)return;message.textContent=value;message.hidden=!value;message.className='qs-message '+(bad?'error':'success');}
function escapeClose(){if(state.saving)return false;if(state.uncertain&&!window.confirm('حالة الحفظ غير مؤكدة. سنحتفظ بمرجع طلب الحفظ للتحقق منه من قائمة العروض. لا تنشئ نسخة بديلة قبل التحقق. هل تريد إغلاق المحرر؟'))return false;if(!state.uncertain&&state.dirty&&!window.confirm('توجد تعديلات لم تحفظ. هل تريد إغلاق المحرر دون حفظها؟'))return false;editor.close();return true;}
editor.addEventListener('cancel',e=>{e.preventDefault();escapeClose();});
editor.addEventListener('close',()=>{if(!state.saving){state.doc=null;state.dirty=false;}});
preview.addEventListener('close',()=>{if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}preview.replaceChildren();});
document.addEventListener('keydown',e=>{if((editor.open||preview.open)&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('beforeunload',e=>{if(state.dirty||state.saving||state.uncertain){e.preventDefault();e.returnValue='';}});
function option(value,label){return new Option(label,value);}
function field(label,key,type='text',options={}) {
  const wrap=h('label','qs-field');wrap.append(h('span','qs-field-label',label));
  const input=type==='textarea'?h('textarea'):type==='select'?h('select'):h('input');input.name=key;input.setAttribute('aria-label',label);
  if(type==='textarea'){input.rows=options.rows||3;input.maxLength=options.max||6000;}
  else if(type==='select')for(const [v,t] of options.options||[])input.append(option(v,t));
  else{input.type=type;input.maxLength=options.max||200;if(options.decimal)input.inputMode='decimal';}
  if(options.required)input.required=true;if(options.dir)input.dir=options.dir;if(options.placeholder)input.placeholder=options.placeholder;
  if(options.min)input.min=options.min;input.value=options.value??state.doc?.[key]??'';
  input.addEventListener(type==='select'?'change':'input',()=>{state.dirty=true;if(state.doc&&key in state.doc)state.doc[key]=input.value;options.onChange?.(input.value,input);});
  wrap.append(input);if(options.hint)wrap.append(h('small','qs-field-hint',options.hint));return wrap;
}
function section(number,title,hint) {const e=h('section','qs-section'),header=h('header','qs-section-head');header.append(h('span','qs-section-number',number));const copy=h('div');copy.append(h('h3',null,title),h('p',null,hint));header.append(copy);e.append(header);return e;}
function box(fields,cls='qs-grid'){const e=h('div',cls);e.append(...fields);return e;}
function newLine(kind='product') {return {id:crypto.randomUUID(),kind,name_ar:'',name_en:'',details_ar:'',details_en:'',sku:'',quantity:1,unit_ar:kind==='service'?'خدمة':'قطعة',unit_en:kind==='service'?'service':'unit',unit_price:0,vat_rate:15,discount_percent:0};}
function selectedClient(){return state.context?.clients.find(c=>String(c.id)===String(form?.elements.client_id.value));}
function filteredProjects(){return state.context.projects.filter(p=>String(p.client_id)===String(form.elements.client_id.value));}
function syncCustomer(){const select=form.elements.project_id;select.replaceChildren(option('','دون مشروع'));for(const p of filteredProjects())select.append(option(p.id,p.name));const c=selectedClient();$('#qsCustomerInfo').textContent=c?[c.client_no,c.phone,c.email,c.vat_no?`الرقم الضريبي ${c.vat_no}`:''].filter(Boolean).join(' · '):'اختر العميل الذي سيصدر له العرض.';}
function totalsPanel(){const e=h('aside','qs-summary');e.append(h('span','qs-eyebrow','QUOTATION SUMMARY'),h('h3',null,'ملخص العرض'));summaryHost=h('div','qs-summary-values');e.append(summaryHost,h('p','qs-summary-note','مبالغ دقيقة إلى منزلتين عشريتين. جميع الأرقام بالأرقام الإنجليزية.'));return e;}
function updateTotals(){
  if(!state.doc||!summaryHost)return;
  try{const c=calculateQuote(state.doc.lines,state.doc.price_basis);summaryHost.replaceChildren();for(const [label,key] of [['المجموع قبل الخصم','subtotal'],['إجمالي الخصم','discount'],['الصافي قبل الضريبة','net'],['إجمالي الضريبة','vat'],['الإجمالي شامل الضريبة','total']]){const row=h('div',key==='total'?'qs-total':'');row.append(h('span',null,label));const value=h('strong',null,quoteMoney(c.totals[key]));value.dir='ltr';row.append(value);summaryHost.append(row);}summaryHost.append(h('small',null,'SAR · الريال السعودي'));
    for(const [i,line] of c.lines.entries()){const value=linesHost?.querySelector(`[data-line-index="${i}"] .qs-line-total`);if(value)value.textContent=quoteMoney(line.total)+' SAR';}
  }catch(e){summaryHost.replaceChildren(h('p','qs-calculation-error',e.message));}
}
function setMode(){const mode=state.doc.language;for(const field of editor.querySelectorAll('[data-lang-field]'))field.hidden=mode==='ar'?field.dataset.langField==='en':mode==='en'?field.dataset.langField==='ar':false;for(const f of editor.querySelectorAll('[name=customer_name_en]'))f.required=mode!=='ar';updateTotals();}
function translatedField(label,key,type,options={}){const e=field(label,key,type,options);e.dataset.langField=key.endsWith('_en')?'en':'ar';return e;}
function renderLines(){
  linesHost.replaceChildren();state.doc.lines.forEach((line,i)=>{
    const card=h('article','qs-line');card.dataset.lineIndex=i;const head=h('header','qs-line-head');const label=h('div');label.append(h('span','qs-line-number',String(i+1)),h('strong',null,line.kind==='service'?'خدمة':'منتج'));const actions=h('div','qs-line-actions');actions.append(button('نسخ البند','qs-text-button',()=>{if(state.doc.lines.length>=50)return notice('الحد الأقصى 50 بندًا.',true);state.doc.lines.splice(i+1,0,{...line,id:crypto.randomUUID()});state.dirty=true;renderLines();},'archive'),button('حذف','qs-text-button qs-delete',()=>{if(state.doc.lines.length===1)return notice('يجب أن يبقى بند واحد على الأقل.',true);if((line.name_ar||line.name_en)&&!confirm('حذف هذا البند من العرض؟'))return;state.doc.lines.splice(i,1);state.dirty=true;renderLines();},'trash'));head.append(label,actions);card.append(head);
    const lineField=(title,key,type='text',options={})=>{const e=field(`${title} · البند ${i+1}`,`line_${i}_${key}`,type,{...options,value:line[key],onChange:value=>{line[key]=value;options.onChange?.(value);updateTotals();}});if(key.endsWith('_ar'))e.dataset.langField='ar';if(key.endsWith('_en'))e.dataset.langField='en';return e;};
    card.append(box([lineField('النوع','kind','select',{options:[['product','منتج'],['service','خدمة']],onChange:value=>{line.kind=value;head.querySelector('strong').textContent=value==='service'?'خدمة':'منتج';}}),lineField('مرجع الصنف / SKU','sku','text',{max:80,dir:'ltr'})],'qs-line-top-grid'));
    card.append(box([lineField('اسم المنتج أو الخدمة بالعربية','name_ar','text',{max:160,placeholder:'مثال: مركن معدني بتشطيب ذهبي'}),lineField('Item or service name in English','name_en','text',{max:160,dir:'ltr',placeholder:'Example: Gold-finish metal planter'})]));
    card.append(box([lineField('المواصفات والتفاصيل بالعربية','details_ar','textarea',{max:600,rows:3,placeholder:'الخامة، المقاس، اللون، نطاق الخدمة…'}),lineField('Specifications and scope in English','details_en','textarea',{max:600,rows:3,dir:'ltr',placeholder:'Material, dimensions, colour, service scope…'})]));
    card.append(box([lineField('الكمية','quantity','text',{decimal:true,dir:'ltr',max:15}),lineField('الوحدة بالعربية','unit_ar','text',{max:30}),lineField('Unit in English','unit_en','text',{max:30,dir:'ltr'}),lineField('سعر الوحدة (SAR)','unit_price','text',{decimal:true,dir:'ltr',max:15}),lineField('الخصم %','discount_percent','text',{decimal:true,dir:'ltr',max:6}),lineField('الضريبة %','vat_rate','text',{decimal:true,dir:'ltr',max:6})],'qs-numbers-grid'));
    const bottom=h('footer','qs-line-bottom');bottom.append(h('span',null,'إجمالي البند بعد الخصم والضريبة'),h('strong','qs-line-total'));card.append(bottom);linesHost.append(card);
  });setMode();updateTotals();
}
async function openEditor(record={}){
  if(document.body.classList.contains('auth-pending')||state.loading||state.saving)return;
  state.loading=true;
  try {
    const ctx=await api('getQuotationData',[record.id||'']);if(record.id&&!ctx.record)throw new Error('العرض غير موجود أو تم حذفه.');
    state.context=ctx;state.record=ctx.record||{};state.doc=quotationFromRecord(state.record);if(!record.id){state.doc.lines=[newLine()];state.doc.terms_ar=DEFAULT_QUOTE_TERMS.ar;state.doc.terms_en=DEFAULT_QUOTE_TERMS.en;}
    state.requestId=crypto.randomUUID();state.lastPayload=null;state.uncertain=null;state.dirty=false;buildEditor();editor.showModal();form.elements.client_id.focus();
  }catch(e){window.toast(e.message,true);}finally{state.loading=false;}
}
function buildEditor(){
  editor.replaceChildren();const head=h('header','qs-dialog-head'),copy=h('div');const eyebrow=h('span','qs-eyebrow',`BALQEES · QUOTATION STUDIO ${QUOTATION_EDITION}`),title=h('h2',null,state.record.id?'تعديل عرض السعر':'إنشاء عرض سعر');title.id='qsEditorTitle';copy.append(eyebrow,title,h('p',null,'بنود واضحة، تفاصيل مكتملة، وإصدار رسمي يليق ببلقيس.'));head.append(copy,button('إغلاق','qs-close',escapeClose,'close'));editor.append(head);
  message=h('div','qs-message');message.hidden=true;message.setAttribute('role','alert');editor.append(message);
  form=h('form','qs-editor-form');form.id='detailedQuoteForm';form.addEventListener('submit',e=>{e.preventDefault();save();});
  const left=h('div','qs-editor-main');const info=section('01','هوية العرض والعميل','اختر العميل واللغة وبيانات العرض قبل إضافة البنود.');
  info.append(box([field('العميل','client_id','select',{required:true,value:state.record.client_id||'',options:[['','اختر العميل'],...state.context.clients.map(c=>[c.id,`${c.name} · ${c.client_no||c.id}`])],onChange:()=>{state.doc.customer_name_en='';form.elements.customer_name_en.value='';syncCustomer();}}),field('لغة العرض والطباعة','language','select',{options:[['ar','العربية'],['en','English only'],['both','العربية / English']],onChange:setMode})]));
  const customer=h('p','qs-customer-info');customer.id='qsCustomerInfo';info.append(customer);
  info.append(box([translatedField('اسم العميل بالإنجليزية','customer_name_en','text',{max:200,dir:'ltr',placeholder:'الاسم الرسمي كما يرغب العميل في ظهوره',hint:'حقل مطلوب للنسخة الإنجليزية والثنائية.'}),translatedField('عنوان العميل بالإنجليزية (اختياري)','customer_address_en','text',{max:500,dir:'ltr'})]));
  info.append(box([field('المشروع (اختياري)','project_id','select',{value:state.record.project_id||'',options:[['','دون مشروع'],...state.context.projects.filter(p=>String(p.client_id)===String(state.record.client_id)).map(p=>[p.id,p.name])]}),translatedField('اسم المشروع بالإنجليزية (اختياري)','project_name_en','text',{dir:'ltr'})]));
  info.append(box([translatedField('عنوان العرض بالعربية','title_ar','text',{max:200}),translatedField('Quotation title in English','title_en','text',{max:200,dir:'ltr'})]));
  info.append(box([field('تاريخ العرض','date','date',{required:true}),field('صالح حتى (اختياري)','valid_until','date',{min:state.doc.date}),field('حالة العرض','status','select',{value:state.record.status||'مسودة',options:QUOTE_STATUSES.map(s=>[s,s])}),field('أساس أسعار الوحدات','price_basis','select',{options:[['exclusive','الأسعار غير شاملة الضريبة'],['inclusive','الأسعار شاملة الضريبة']],onChange:updateTotals})],'qs-grid qs-grid-four'));
  info.append(box([field('موعد المتابعة (داخلي، اختياري)','followup_date','date',{value:state.record.followup_date||''}),field('احتمالية الإغلاق % (داخلية)','probability','text',{value:state.record.probability||0,decimal:true,dir:'ltr',max:6})]));
  left.append(info);
  const items=section('02','المنتجات والخدمات','يمكن الجمع بين عدة منتجات وخدمات، مع ضريبة وخصم مستقلين لكل بند.');
  const add=h('div','qs-add-lines'),templates=h('select');templates.setAttribute('aria-label','قالب بند مهني');templates.append(option('','قوالب مهنية بالعربية والإنجليزية'),...QUOTE_TEMPLATES.map(t=>option(t.key,t.name_ar)));templates.addEventListener('change',()=>{const t=QUOTE_TEMPLATES.find(x=>x.key===templates.value);if(!t)return;const empty=state.doc.lines.length===1&&!state.doc.lines[0].name_ar&&!state.doc.lines[0].name_en;if(!empty&&state.doc.lines.length>=50)return notice('الحد الأقصى 50 بندًا.',true);const line={...newLine(t.kind),...t,id:crypto.randomUUID()};if(empty)state.doc.lines[0]=line;else state.doc.lines.push(line);state.dirty=true;templates.value='';renderLines();});
  const addLine=kind=>{if(state.doc.lines.length>=50)return notice('الحد الأقصى 50 بندًا.',true);state.doc.lines.push(newLine(kind));state.dirty=true;renderLines();};
  add.append(button('إضافة منتج','qs-button',()=>addLine('product'),'plants'),button('إضافة خدمة','qs-button',()=>addLine('service'),'quotes'),templates);items.append(add);linesHost=h('div','qs-lines');items.append(linesHost);left.append(items);
  const conditions=section('03','الشروط والملاحظات','الشروط تظهر في العرض؛ راجع صياغتها وترجمتها حسب اتفاقك مع العميل.');conditions.append(box([translatedField('الشروط والأحكام بالعربية','terms_ar','textarea',{max:6000,rows:5}),translatedField('Terms and Conditions in English','terms_en','textarea',{max:6000,rows:5,dir:'ltr'})]));conditions.append(box([translatedField('ملاحظات العرض بالعربية','notes_ar','textarea',{max:3000,rows:3}),translatedField('Quotation notes in English','notes_en','textarea',{max:3000,rows:3,dir:'ltr'})]));
  const signature=h('label','qs-checkbox'),check=h('input');check.type='checkbox';check.name='show_signature';check.checked=state.doc.show_signature!==false;check.addEventListener('change',()=>{state.doc.show_signature=check.checked;state.dirty=true;});signature.append(check,h('span',null,'إظهار التوقيع والختم المعتمدين في الطباعة'));conditions.append(signature,h('p','qs-translation-note','القوالب تتضمن صياغات مهنية جاهزة باللغتين. لا تُترجم التفاصيل الخاصة آليًا؛ أكمل الحقول الإنجليزية عند اختيار الإنجليزية أو النسخة الثنائية.'));
  left.append(conditions);form.append(left,totalsPanel());editor.append(form);
  const foot=h('footer','qs-dialog-foot'),meta=h('span','qs-muted',state.record.quote_no||'يُنشأ رقم العرض عند الحفظ');const actions=h('div');const print=button('معاينة الطباعة','qs-button',previewDraft,'reports');print.id='qsDraftPreview';const saveBtn=button('حفظ عرض السعر','qs-button qs-primary',save,'archive');saveBtn.id='qsSaveQuotation';actions.append(print,saveBtn);foot.append(meta,actions);editor.append(foot);renderLines();syncCustomer();form.elements.project_id.value=state.record.project_id||'';setMode();
}
function payload(){const doc=normalizeQuotation(state.doc,form.elements.status.value);return {id:state.record.id||'',version:state.record.version??0,client_id:form.elements.client_id.value,project_id:form.elements.project_id.value,status:form.elements.status.value,followup_date:form.elements.followup_date.value,probability:form.elements.probability.value,quotation_request_id:state.requestId,quote_details:doc};}
function draftRecord(){const p=payload(),c=selectedClient(),project=state.context.projects.find(p=>p.id===form.elements.project_id.value);if(!c)throw new Error('اختر العميل قبل المعاينة.');return {...state.record,...p,client_name:c.name,project_name:project?.name||'',quote_details_json:JSON.stringify(p.quote_details)};}
async function previewDraft(){try{if(!form.reportValidity())return;openPreview(draftRecord(),state.context);}catch(e){notice(e.message,true);}}
function savedDraftMatches(row,p){try{const d=JSON.parse(row.quote_details_json);return d.request_id===p.quotation_request_id&&row.status===p.status&&String(row.client_id)===p.client_id;}catch{return false;}}
function recoveryId(){return state.lastPayload?.id||state.lastPayload?.quotation_request_id;}
async function reconcile(){
  if(!state.lastPayload)return false;
  const ctx=await api('getQuotationData',[recoveryId()]);
  if(ctx.record&&savedDraftMatches(ctx.record,state.lastPayload)){state.record=ctx.record;state.doc=quotationFromRecord(ctx.record);state.uncertain=null;state.dirty=false;state.requestId=crypto.randomUUID();state.lastPayload=null;forget();buildEditor();notice('تم التحقق: العرض محفوظ في المكتب، ولم يُنشأ عرض آخر.');await refreshQuotes();return true;}
  return false;
}
async function save(){
  if(state.saving)return;
  if(state.uncertain){state.saving=true;setBusy(true);try{if(!await reconcile())notice('لم يظهر تأكيد الحفظ بعد. تحقّق لاحقًا؛ لن نرسل إنشاءً ثانيًا أثناء عدم وضوح حالة الحفظ.',true);}catch(e){notice(e.message,true);}finally{state.saving=false;setBusy(false);}return;}
  let p;try{if(!form.reportValidity())return;p=payload();}catch(e){notice(e.message,true);return;}
  state.saving=true;state.lastPayload=p;remember(p);setBusy(true);notice('جاري حفظ البنود والحسابات في المكتب…');
  try{const response=await api('saveRecord',['quotes',p]);state.record=response.record;state.doc=quotationFromRecord(state.record);state.requestId=crypto.randomUUID();state.dirty=false;state.lastPayload=null;forget();buildEditor();notice('حُفظ عرض السعر وبنوده. يمكنك معاينته وطباعته الآن.');await refreshQuotes();}
  catch(e){if(e.status===400||e.status===409){state.lastPayload=null;forget();notice(e.message,true);}else{state.uncertain=true;try{if(!await reconcile())notice('لم نتمكن من تأكيد الحفظ. اضغط «التحقق من حفظ العرض» قبل أي محاولة أخرى.',true);}catch{notice('تعذر تأكيد الحفظ. أبقِ هذه النافذة مفتوحة وتحقق لاحقًا.',true);}}}
  finally{state.saving=false;setBusy(false);}
}
function setBusy(busy){for(const e of editor.querySelectorAll('input,textarea,select,button'))e.disabled=busy||!!state.uncertain;const btn=$('#qsSaveQuotation');if(btn){btn.disabled=busy;btn.textContent=busy?'جاري التحقق…':state.uncertain?'التحقق من حفظ العرض':'حفظ عرض السعر';}const close=editor.querySelector('.qs-close');if(close)close.disabled=busy;}
async function refreshQuotes(){if(window.APP.current==='quotes')await window.renderEntity('quotes');}
async function viewSaved(row){try{const ctx=await api('getQuotationData',[row.id]);if(!ctx.record)throw new Error('العرض غير موجود.');openPreview(ctx.record,ctx);}catch(e){window.toast(e.message,true);}}
function openPreview(record,ctx){
  const doc=quotationFromRecord(record);previewRecord=record;previewContext=ctx;previewLanguage=doc.language;
  preview.replaceChildren();const head=h('header','qs-preview-head'),copy=h('div');const title=h('h2',null,'معاينة عرض السعر');title.id='qsPreviewTitle';copy.append(title,h('p',null,'تنسيق A4 رسمي. اختر اللغة ثم اطبع أو احفظ PDF.'));const language=h('select');language.setAttribute('aria-label','لغة معاينة الطباعة');language.append(...Object.entries(labels).map(([key,label])=>option(key,label)));language.value=previewLanguage;language.addEventListener('change',()=>{previewLanguage=language.value;drawPreview();});const actions=h('div');actions.append(language,button('طباعة / حفظ PDF','qs-button qs-primary',printPreview,'reports'),button('إغلاق المعاينة','qs-close',()=>preview.close(),'close'));head.append(copy,actions);preview.append(head);
  const status=h('p','qs-preview-status');status.id='qsPreviewStatus';status.setAttribute('role','alert');preview.append(status);previewFrame=h('iframe','qs-print-frame');previewFrame.title='معاينة مستند عرض السعر';preview.append(previewFrame);drawPreview();if(!preview.open)preview.showModal();
}
function drawPreview(){
  const status=$('#qsPreviewStatus');try{const client=previewContext.clients.find(c=>c.id===previewRecord.client_id)||{},project=previewContext.projects.find(p=>p.id===previewRecord.project_id)||{};
    const assets={logo:window.PDF_BRAND_LOGO||window.ASSET?.logo||window.BRAND_MARK,signature:window.PDF_SIGNATURE||window.ASSET?.signature,stamp:window.PDF_STAMP||window.ASSET?.stamp};
    const html=quotationDocument(previewRecord,{company:previewContext.company,client,project,assets,language:previewLanguage,origin:location.origin});status.textContent='';status.hidden=true;previewFrame.hidden=false;
    if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(new Blob([html],{type:'text/html'}));previewFrame.src=previewURL;
    previewFrame.onload=()=>{const d=previewFrame.contentDocument;if(d){const style=d.createElement('style');style.textContent='@media screen{.print-actions{display:none}body{zoom:var(--qs-screen-scale,1)}}@media print{body{zoom:1!important}}';d.head.append(style);d.body.style.setProperty('--qs-screen-scale',String(Math.min(1,previewFrame.clientWidth/740)));}};
  }catch(e){status.hidden=false;status.textContent=e.message+' افتح تعديل العرض لاستكمال الترجمة.';previewFrame.hidden=true;}
}
async function printPreview(){
  if(previewFrame.hidden)return;const d=previewFrame.contentDocument;if(!d)return;
  await Promise.all([d.fonts.ready,...[...d.images].map(im=>im.decode().catch(()=>{}))]);previewFrame.contentWindow.focus();previewFrame.contentWindow.print();
}
window.addEventListener('resize',()=>{if(preview.open&&previewFrame?.contentDocument)previewFrame.contentDocument.body.style.setProperty('--qs-screen-scale',String(Math.min(1,previewFrame.clientWidth/740)));});

function renderQuotes(rows){
  state.rows=rows;state.query='';state.status='';window.setTitle('عروض الأسعار','منتجات وخدمات، بشروط واضحة وإصدار رسمي.');const page=$('#page');page.replaceChildren();const root=h('div','qs-workspace');
  const hero=h('section','qs-hero'),copy=h('div');copy.append(h('span','qs-eyebrow',`BALQEES · QUOTATION STUDIO ${QUOTATION_EDITION}`),h('h2',null,'عروض تليق بأعمالك.'),h('p',null,'من أول بند إلى النسخة المعتمدة؛ اصنع عرضًا واضحًا للعميل، دقيقًا في الأسعار، وراقيًا في الإخراج.'));hero.append(copy,button('إنشاء عرض سعر','qs-button qs-primary',()=>openEditor(),'quotes'));root.append(hero);
  if(pending())root.append(button('التحقق من طلب حفظ سابق','qs-button',async()=>{try{const p=pending();if(!p)return;const ctx=await api('getQuotationData',[p.id]);if(!ctx.record)return window.toast('لم يظهر العرض بعد. تحقق لاحقًا قبل إنشاء بديل.',true);forget();await openEditor(ctx.record);notice('عُثر على العرض المحفوظ. راجع بياناته قبل أي تعديل.');}catch(e){window.toast(e.message,true);}}));
  const stats=h('div','qs-stats');for(const [title,value] of [['العروض المعروضة',String(rows.length)],['عروض قيد المتابعة',String(rows.filter(r=>['أرسل','قيد المتابعة'].includes(r.status)).length)],['قيمة العروض المقبولة',quoteMoney(rows.filter(r=>r.status==='مقبول').reduce((sum,r)=>sum+number(r.total),0))+' SAR']]){const e=h('article');e.append(h('small',null,title),h('strong',null,value));stats.append(e);}root.append(stats);
  const tools=h('div','qs-list-tools'),search=h('input');search.type='search';search.placeholder='العميل، رقم العرض، المنتج أو الخدمة…';search.setAttribute('aria-label','البحث في عروض الأسعار');search.addEventListener('input',()=>{state.query=search.value;drawCards();});const status=h('select');status.setAttribute('aria-label','حالة عروض الأسعار');status.append(option('','كل الحالات'),...QUOTE_STATUSES.map(s=>option(s,s)));status.addEventListener('change',()=>{state.status=status.value;drawCards();});const sort=h('select');sort.setAttribute('aria-label','ترتيب عروض الأسعار');sort.append(option('newest','الأحدث أولًا'),option('total-desc','الإجمالي: الأعلى أولًا'),option('total-asc','الإجمالي: الأقل أولًا'));sort.addEventListener('change',()=>{state.sort=sort.value;drawCards();});tools.append(search,status,sort,button('تصدير القائمة CSV','qs-button',exportQuotes,'archive'));root.append(tools);
  const list=h('div','qs-quote-list');list.id='qsQuoteList';root.append(list,h('p','qs-list-note',rows.length>=800?'المعروض أحدث 800 عرض. استخدم البحث الشامل للوصول إلى العروض الأقدم.':'اختيار اللغة والشروط والبنود محفوظ داخل كل عرض. القيم المعروضة هي إجماليات العروض، وليست مستحقات مالية.'));page.append(root);drawCards();
}
function visibleQuotes(){const terms=normalizeSearch(state.query).split(' ').filter(Boolean);const rows=state.rows.filter(r=>(!state.status||r.status===state.status)&&terms.every(t=>normalizeSearch(JSON.stringify(r)).includes(t)));return rows.sort((a,b)=>state.sort==='total-desc'?number(b.total)-number(a.total):state.sort==='total-asc'?number(a.total)-number(b.total):String(b.created_at||b.date||'').localeCompare(String(a.created_at||a.date||'')));}
function drawCards(){const host=$('#qsQuoteList');if(!host)return;host.replaceChildren();const rows=visibleQuotes();for(const r of rows){const card=h('article','qs-quote-card'),copy=h('div','qs-quote-copy');let d;try{d=quotationFromRecord(r);}catch{d={};}copy.append(h('span','qs-reference',r.quote_no||'—'),h('h3',null,r.client_name||'عميل'),h('p',null,d.title_ar||r.description||'عرض سعر'));const meta=h('div','qs-quote-meta');meta.append(h('span','qs-status '+(r.status==='مقبول'?'accepted':''),r.status||'مسودة'),h('span',null,`${r.date||'—'} · ${d.lines?.length||1} بند · ${labels[d.language]||'العربية'}`));copy.append(meta);const amount=h('div','qs-card-amount');const val=h('strong',null,quoteMoney(r.total));val.dir='ltr';amount.append(val,h('small',null,'SAR · شامل الضريبة'));const actions=h('div','qs-card-actions');actions.append(button('معاينة وطباعة','qs-button',()=>viewSaved(r),'reports'),button('تعديل العرض','qs-button',()=>openEditor(r),'quotes'));card.append(copy,amount,actions);host.append(card);}if(!rows.length){const e=h('div','qs-empty');e.append(icons('quotes'),h('h3',null,state.rows.length?'لا توجد عروض مطابقة':'ابدأ بأول عرض سعر'),h('p',null,'أضف منتجاتك وخدماتك، ثم قدمها للعميل في عرض رسمي متكامل.'),button('إنشاء عرض سعر','qs-button qs-primary',()=>openEditor()));host.append(e);}}
function exportQuotes(){const rows=visibleQuotes();if(!rows.length)return window.toast('لا توجد عروض للتصدير.',true);const cols=[['quote_no','رقم العرض'],['date','التاريخ'],['client_name','العميل'],['description','البنود'],['subtotal','الصافي قبل الضريبة'],['vat_amount','الضريبة'],['total','الإجمالي'],['status','الحالة']];const url=URL.createObjectURL(new Blob([buildCsv(cols,rows)],{type:'text/csv;charset=utf-8'})),a=h('a');a.href=url;a.download=`Balqees-Quotations-${today()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const oldDraw=window.drawEntity,oldOpen=window.openForm,oldEdit=window.editRecord,oldPrint=window.printRecord,oldFilter=window.filterCurrent;
window.drawEntity=(entity,rows)=>entity==='quotes'?renderQuotes(rows):oldDraw(entity,rows);
window.openForm=(entity,row)=>entity==='quotes'?openEditor(row||{}):oldOpen(entity,row);
window.editRecord=(entity,row)=>entity==='quotes'?openEditor(row):oldEdit(entity,row);
window.printRecord=(entity,row)=>entity==='quotes'?viewSaved(row):oldPrint(entity,row);
window.filterCurrent=query=>{if(window.APP?.current==='quotes'){$('[aria-label="البحث في عروض الأسعار"]').value=query;state.query=query;drawCards();}else oldFilter(query);};
