import {normalizeSearch,compareValues,buildCsv} from './office-tools.js';

const VERSION = '26.2.4';
const $ = selector => document.querySelector(selector);
const create = (tag,className,text) => {
  const node=document.createElement(tag);
  if(className) node.className=className;
  if(text!=null) node.textContent=text;
  return node;
};
const ready = () => !document.body.classList.contains('auth-pending');
const labels = () => window.LABEL || {};
const icon = name => {
  const node=create('span');
  // ico contains only the application's fixed SVG definitions.
  node.innerHTML=window.ico(name); node.setAttribute('aria-hidden','true');
  return node;
};
const page=$('#page'),side=$('#side'),menu=$('#menu'),modal=$('#modalBack');
const tableStates=new WeakMap();

// Version labels outside the original report/print code.
function versionLabels() {
  const badge=$('.hero-kicker span');
  if(badge && badge.textContent!=='v'+VERSION+' • Secure') badge.textContent='v'+VERSION+' • Secure';
}

function addWorkspace() {
  versionLabels();
  if(window.APP?.current!=='dashboard' || !$('.hero') || $('#officeWorkspace')) return;
  const card=create('section','card office-workspace'); card.id='officeWorkspace';
  card.setAttribute('aria-labelledby','officeWorkspaceTitle');
  const head=create('div','section-head'),copy=create('div');
  const heading=create('h3',null,'مركز العمل'); heading.id='officeWorkspaceTitle';
  copy.append(heading,create('p',null,'ابحث عن السجل، أو انتقل إلى حسابات العملاء وطلبات التسعير.'));
  head.append(copy,create('span','badge gold','الإصدار '+VERSION));
  const grid=create('div','office-work-grid');
  function shortcut(tag,name,title,description,action) {
    const link=create(tag,'office-work-link'),visual=create('span','office-work-icon'),text=create('span');
    if(tag==='button') link.type='button';
    visual.append(icon(name)); text.append(create('b',null,title),create('small',null,description));
    link.append(visual,text); action(link); return link;
  }
  grid.append(
    shortcut('button','search','البحث في المكتب','عميل، فاتورة، مشروع أو مستند.',link=>link.addEventListener('click',openSearch)),
    shortcut('button','wallet','حسابات العملاء والموقع','مطابقة الحوالات ونشر كشوف الحساب.',link=>link.dataset.nav='portal'),
    shortcut('a','quotes','طلبات تسعير الموقع','فتح لوحة المبيعات لمراجعة الطلبات وتسعيرها.',link=>{
      link.href='https://balqeesfloral.vercel.app/admin/quote-requests';link.target='_blank';link.rel='noopener noreferrer';
      link.append(create('span','office-external','↗'));
      link.setAttribute('aria-label','طلبات تسعير الموقع — فتح في نافذة جديدة');
    })
  );
  card.append(head,grid); $('.hero').after(card);
}
new MutationObserver(addWorkspace).observe(page,{childList:true});

// Global search stays in memory and reads every office section through the authenticated API.
const dialog=create('dialog','office-search-dialog'); dialog.id='officeSearchDialog';
dialog.setAttribute('aria-labelledby','officeSearchTitle');
dialog.setAttribute('aria-describedby','officeSearchDescription');
const searchHead=create('header','office-search-head'),searchCopy=create('div');
const searchTitle=create('h2',null,'البحث في مكتب بلقيس'); searchTitle.id='officeSearchTitle';
const searchDescription=create('p',null,'ابحث بالاسم أو رقم الفاتورة أو الجوال في جميع الأقسام.');searchDescription.id='officeSearchDescription';
searchCopy.append(searchTitle,searchDescription);
const searchClose=create('button','iconbtn');searchClose.type='button';searchClose.setAttribute('aria-label','إغلاق البحث');searchClose.append(icon('close'));
searchHead.append(searchCopy,searchClose);
const searchForm=create('form','office-search-form'),searchFields=create('div','office-search-fields');
const searchInput=create('input');searchInput.type='search';searchInput.placeholder='اسم العميل أو رقم المستند…';searchInput.maxLength=120;
searchInput.setAttribute('aria-label','كلمة البحث');searchInput.autocomplete='off';
const searchScope=create('select');searchScope.setAttribute('aria-label','قسم البحث');
searchScope.append(new Option('كل الأقسام',''));
for(const [entity,label] of Object.entries(labels())) searchScope.append(new Option(label,entity));
searchFields.append(searchInput,searchScope);searchForm.append(searchFields);
const searchStatus=create('div','office-search-status');searchStatus.setAttribute('role','status');searchStatus.setAttribute('aria-live','polite');
const results=create('div','office-search-results');results.setAttribute('aria-label','نتائج البحث');
dialog.append(searchHead,searchForm,searchStatus,results);document.body.append(dialog);
let debounce,requestController,openingController,searchEpoch=0,opening=false;

function clearRequests() {
  clearTimeout(debounce);requestController?.abort();openingController?.abort();searchEpoch++;
}
function status(text,busy=false) {
  searchStatus.replaceChildren();
  if(busy){const spinner=create('span','spin');spinner.setAttribute('aria-hidden','true');searchStatus.append(spinner);}
  searchStatus.append(create('span',null,text));results.setAttribute('aria-busy',String(busy));
}
function empty(title,note) {
  const node=create('div','office-search-empty');node.append(create('strong',null,title),create('span',null,note));results.replaceChildren(node);return node;
}
function openSearch() {
  if(!ready() || modal.classList.contains('show') || dialog.open) return;
  searchInput.value='';searchScope.value='';searchInput.disabled=false;searchScope.disabled=false;
  status('أدخل حرفين على الأقل لبدء البحث.');empty('الوصول إلى السجل أسرع','يمكنك البحث بالأرقام العربية أو الإنجليزية، ومع التشكيل أو بدونه.');
  dialog.showModal();searchInput.focus();
}
searchClose.addEventListener('click',()=>dialog.close());
dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dialog.close();}});
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) dialog.close();}});
dialog.addEventListener('close',()=>{clearRequests();opening=false;results.replaceChildren();status('');});

async function apiRequest(action,args,controller) {
  const timer=setTimeout(()=>controller.abort('timeout'),20000);
  try {
    const response=await fetch('/api/balqees',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,args}),signal:controller.signal,cache:'no-store'});
    const body=await response.json().catch(()=>null);
    if(!response.ok || !body?.ok) {
      const error=new Error(response.status===401?'انتهت جلسة المكتب. أعد تسجيل الدخول ثم ابحث مجددًا.':'تعذر البحث الآن. تحقق من الاتصال ثم أعد المحاولة.');
      error.status=response.status;throw error;
    }
    return body.data;
  } finally {clearTimeout(timer);}
}
function scheduleSearch(immediate=false) {
  clearTimeout(debounce);requestController?.abort();searchEpoch++;
  if(opening) return;
  if(normalizeSearch(searchInput.value).length<2) {
    status('أدخل حرفين على الأقل لبدء البحث.');empty('ابدأ بكلمة أو رقم','مثال: اسم عميل، رقم عرض السعر، أو آخر أرقام الجوال.');return;
  }
  results.replaceChildren();status('جاري البحث في سجلات المكتب…',true);
  debounce=setTimeout(runSearch,immediate?0:400);
}
async function runSearch() {
  const epoch=++searchEpoch,controller=new AbortController();requestController=controller;
  try {
    const response=await apiRequest('searchRecords',[{query:searchInput.value,entity:searchScope.value,limit:30}],controller);
    if(epoch!==searchEpoch || !dialog.open) return;
    const items=Array.isArray(response?.items)?response.items:[];
    status(response.matched>items.length?'أول '+items.length+' من '+response.matched+' نتيجة. حدّد القسم أو أضف كلمة لتضييق البحث.':items.length+' نتيجة في '+response.scanned+' سجل.');
    results.replaceChildren();
    if(!items.length) {empty('لم نجد سجلًا مطابقًا','جرّب اسمًا آخر أو رقم المستند، أو اختر كل الأقسام.');return;}
    for(const item of items) {
      if(!labels()[item.entity] || !item.id) continue;
      const button=create('button','office-search-result');button.type='button';
      const visual=create('span','office-result-icon');visual.append(icon(item.entity));
      const content=create('span','office-result-body');content.append(create('b',null,item.title));
      if(item.detail) content.append(create('small',null,item.detail));
      const meta=create('span','office-result-meta');meta.append(create('span','badge',labels()[item.entity]));
      if(item.reference) meta.append(create('span','badge gold',item.reference));
      if(item.status) meta.append(create('span','badge',item.status));
      if(item.date){const date=create('time',null,item.date);date.dateTime=item.date;meta.append(date);}
      content.append(meta);button.append(visual,content,create('span','office-result-open','فتح السجل ←'));
      button.addEventListener('click',()=>openSearchRecord(item));results.append(button);
    }
  } catch(error) {
    if(epoch!==searchEpoch || !dialog.open) return;
    status('');const node=empty('تعذر إكمال البحث',controller.signal.aborted?'استغرق الاتصال وقتًا طويلًا. حاول مرة أخرى.':error.message);
    const retry=create('button','btn soft office-search-retry',error.status===401?'إعادة تسجيل الدخول':'إعادة المحاولة');retry.type='button';
    retry.addEventListener('click',()=>error.status===401?location.reload():scheduleSearch(true));node.append(retry);
  }
}
async function openSearchRecord(item) {
  if(opening) return;
  opening=true;clearTimeout(debounce);requestController?.abort();searchEpoch++;
  const controller=new AbortController();openingController=controller;
  searchInput.disabled=true;searchScope.disabled=true;
  for(const button of results.querySelectorAll('button')) button.disabled=true;
  status('جاري تحميل أحدث بيانات السجل…',true);
  try {
    const rows=await apiRequest('listEntity',[item.entity,{query:item.id,limit:1000}],controller);
    if(!dialog.open || controller.signal.aborted) return;
    const row=Array.isArray(rows)?rows.find(record=>String(record.id)===String(item.id)):null;
    if(!row) throw new Error('لم يعد هذا السجل متاحًا. أعد البحث لتحديث النتائج.');
    dialog.close();window.editRecord(item.entity,row);
  } catch(error) {
    if(!dialog.open || controller.signal.aborted && controller.signal.reason!=='timeout') return;
    status(controller.signal.reason==='timeout'?'استغرق تحميل السجل وقتًا طويلًا. حاول مرة أخرى.':error.message||'تعذر فتح السجل. حاول مرة أخرى.');
  } finally {
    opening=false;searchInput.disabled=false;searchScope.disabled=false;
    for(const button of results.querySelectorAll('button')) button.disabled=false;
    results.setAttribute('aria-busy','false');
  }
}
searchInput.addEventListener('input',()=>scheduleSearch());searchScope.addEventListener('change',()=>scheduleSearch(true));
searchForm.addEventListener('submit',event=>{event.preventDefault();scheduleSearch(true);});
const trigger=create('button','btn office-search-trigger');trigger.type='button';trigger.id='officeGlobalSearch';
trigger.setAttribute('aria-label','البحث في جميع أقسام المكتب');trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',dialog.id);
trigger.append(icon('search'),create('span','office-trigger-label','بحث شامل'),create('kbd',null,'Ctrl K'));trigger.addEventListener('click',openSearch);
$('.top-actions').prepend(trigger);
const sectionSearch=$('#globalSearch');sectionSearch.placeholder='بحث في القسم الحالي';sectionSearch.setAttribute('aria-label','بحث في القسم الحالي');
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='k' && ready() && !modal.classList.contains('show')) {event.preventDefault();openSearch();}
});

// Filter, status, sort and export share exactly the same visible row set.
const originalDraw=window.drawEntity;
window.drawEntity=function(entity,rows) {
  originalDraw(entity,rows);
  const card=$('.table-card'),table=card?.querySelector('table');if(!table) return;
  const state={entity,card,table,columns:window.COLS[entity],query:'',status:'',sortKey:'',descending:false,
    entries:[...table.querySelectorAll('tbody tr[data-search]')].map((tr,index)=>({tr,row:rows[index],index})),visible:[]};
  tableStates.set(table,state);
  const tools=create('div','office-table-tools'),statusFilter=create('select');statusFilter.setAttribute('aria-label','تصفية حسب الحالة');
  statusFilter.append(new Option('كل الحالات',''));
  const statuses=[...new Set(rows.map(row=>row.status).filter(Boolean))].sort((a,b)=>compareValues(a,b,false,false));
  for(const value of statuses) statusFilter.append(new Option(value,value));
  if(statuses.length){tools.append(statusFilter);statusFilter.addEventListener('change',()=>{state.status=statusFilter.value;updateTable(state);});}
  const reset=create('button','mini','مسح التصفية');reset.type='button';reset.addEventListener('click',()=>{
    state.query='';state.status='';statusFilter.value='';$('#tableSearch').value='';sectionSearch.value='';updateTable(state);
  });
  const download=create('button','mini office-export','تصدير النتائج CSV');download.type='button';download.append(icon('archive'));
  download.addEventListener('click',()=>{
    if(!state.visible.length){window.toast('لا توجد نتائج للتصدير',true);return;}
    const blob=new Blob([buildCsv(state.columns,state.visible.map(entry=>entry.row))],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=create('a');link.href=url;link.download='Balqees-'+entity+'-'+window.todayISO()+'.csv';
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    window.toast('تم تصدير '+state.visible.length+' سجل من النتائج الظاهرة');
  });
  tools.append(reset,download,create('span','office-table-note',rows.length>=800?'المعروض أحدث 800 سجل. استخدم البحث الشامل للسجلات الأقدم.':'اضغط عنوان العمود للفرز. التصدير يشمل النتائج الظاهرة.'));
  card.querySelector('.toolbar').after(tools);
  const hint=create('p','office-scroll-hint','↔ اسحب الجدول أفقيًا لعرض بقية الأعمدة.');tools.after(hint);
  const input=$('#tableSearch');input.setAttribute('aria-label','بحث داخل '+labels()[entity]);
  input.oninput=event=>window.filterCurrent(event.target.value);
  state.count=card.querySelector('.toolbar .badge');state.count.setAttribute('role','status');
  state.empty=create('tr','office-table-empty');const cell=create('td',null,rows.length?'لا توجد نتائج مطابقة للتصفية.':'لا توجد سجلات بعد. أضف أول سجل من زر إضافة.');cell.colSpan=state.columns.length+2;state.empty.append(cell);
  if(state.entries.length) table.querySelector('tbody').append(state.empty);
  for(const [index,[key,label]] of state.columns.entries()) {
    const th=table.querySelectorAll('thead th')[index],button=create('button','office-sort',label);button.type='button';
    const arrow=create('span','office-sort-arrow','↕');arrow.setAttribute('aria-hidden','true');button.append(arrow);th.replaceChildren(button);th.setAttribute('aria-sort','none');
    button.addEventListener('click',()=>{
      state.descending=state.sortKey===key?!state.descending:false;state.sortKey=key;
      for(const heading of table.querySelectorAll('thead th')) {heading.setAttribute('aria-sort','none');const marker=heading.querySelector('.office-sort-arrow');if(marker)marker.textContent='↕';}
      th.setAttribute('aria-sort',state.descending?'descending':'ascending');arrow.textContent=state.descending?'↓':'↑';updateTable(state);
    });
  }
  updateTable(state);
};
function updateTable(state) {
  const terms=normalizeSearch(state.query).split(' ').filter(Boolean);
  const sorted=[...state.entries];
  if(state.sortKey) sorted.sort((a,b)=>compareValues(a.row[state.sortKey],b.row[state.sortKey],state.descending,window.MONEY_KEYS.has(state.sortKey))||a.index-b.index);
  state.visible=[];
  const tbody=state.table.querySelector('tbody'),fragment=document.createDocumentFragment();
  for(const entry of sorted) {
    const text=normalizeSearch(JSON.stringify(entry.row));
    const visible=(!state.status||String(entry.row.status)===state.status)&&terms.every(term=>text.includes(term));
    entry.tr.hidden=!visible;entry.tr.style.display=visible?'':'none';fragment.append(entry.tr);
    if(visible)state.visible.push(entry);
  }
  state.empty.hidden=state.visible.length>0;fragment.append(state.empty);tbody.replaceChildren(fragment);
  state.count.textContent=state.visible.length+' من '+state.entries.length+' سجل';
}
window.filterCurrent=function(query) {
  const state=tableStates.get($('.table-card table'));if(!state)return;
  state.query=String(query||'');$('#tableSearch').value=state.query;sectionSearch.value=state.query;updateTable(state);
};

// Existing weekly/report CSV exports use the same quoting and formula protection.
window.exportRows=function(name,rows) {
  if(!rows?.length)return window.toast('لا توجد بيانات للتصدير',true);
  const columns=[...new Set(rows.flatMap(Object.keys))].map(key=>[key,key]);
  const blob=new Blob([buildCsv(columns,rows)],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=create('a');link.href=url;link.download=name+'-'+window.todayISO()+'.csv';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

// Drawer and the existing record modal get keyboard/focus support without changing their forms.
menu.setAttribute('aria-label','فتح القائمة');menu.setAttribute('aria-controls','side');menu.setAttribute('aria-expanded','false');
$('#quickAdd').setAttribute('aria-label','إجراء جديد');$('#modalClose').setAttribute('aria-label','إغلاق النافذة');
const scrim=create('button','office-scrim');scrim.type='button';scrim.tabIndex=-1;scrim.setAttribute('aria-label','إغلاق القائمة');document.body.append(scrim);
const sideClose=create('button','office-side-close','إغلاق القائمة');sideClose.type='button';side.querySelector('.brand').after(sideClose);
const mobile=matchMedia('(max-width:1100px)');
let wasDrawerOpen=false,modalOpen=false,modalOrigin;
const focusables=root=>[...root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(node=>node.getClientRects().length&&!node.closest('[inert]'));
function closeDrawer(){side.classList.remove('open');}
scrim.addEventListener('click',closeDrawer);sideClose.addEventListener('click',closeDrawer);
function syncDrawer() {
  const open=mobile.matches&&side.classList.contains('open');
  side.inert=mobile.matches&&!open;$('.main').inert=open;$('.mobile-dock').inert=open;
  document.body.classList.toggle('office-drawer-open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'إغلاق القائمة':'فتح القائمة');
  if(open&&!wasDrawerOpen) sideClose.focus();
  if(!open&&wasDrawerOpen&&mobile.matches)menu.focus();
  wasDrawerOpen=open;
}
new MutationObserver(syncDrawer).observe(side,{attributes:true,attributeFilter:['class']});
mobile.addEventListener('change',syncDrawer);syncDrawer();
function syncRecordModal() {
  const isOpen=modal.classList.contains('show'),section=modal.querySelector('.modal');
  section.setAttribute('role','dialog');section.setAttribute('aria-modal','true');section.setAttribute('aria-labelledby','modalTitle');section.setAttribute('aria-describedby','modalHint');
  for(const field of modal.querySelectorAll('.field')) {
    const label=field.querySelector('label'),input=field.querySelector('input,select,textarea');
    if(label&&input){if(!input.id)input.id='office-field-'+input.name;label.htmlFor=input.id;}
  }
  if(isOpen&&!modalOpen){modalOrigin=document.activeElement;queueMicrotask(()=>{if(modal.classList.contains('show')) (modal.querySelector('#recordForm input:not([type=hidden]),#recordForm select,#recordForm textarea')||focusables(modal)[0])?.focus();});}
  if(!isOpen&&modalOpen&&modalOrigin?.isConnected)modalOrigin.focus();
  $('.app').inert=isOpen;
  if(!wasDrawerOpen)$('.mobile-dock').inert=isOpen;
  modalOpen=isOpen;
}
new MutationObserver(syncRecordModal).observe(modal,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
syncRecordModal();
document.addEventListener('keydown',event=>{
  if(dialog.open)return;
  const root=modalOpen?modal:wasDrawerOpen?side:null;if(!root)return;
  if(event.key==='Escape'){
    event.preventDefault();if(modalOpen){if(!$('#saveBtn')?.disabled)window.closeModal();}else closeDrawer();
  }
  if(event.key==='Tab'){
    const list=focusables(root),first=list[0],last=list.at(-1);
    if(!first){event.preventDefault();return;}
    if(event.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement))){event.preventDefault();last.focus();}
    if(!event.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){event.preventDefault();first.focus();}
  }
});

const density=create('button','office-density');density.type='button';density.id='officeDensity';
let compact=false;try{compact=localStorage.getItem('balqees-office-density')==='compact';}catch{}
function setDensity(){
  document.body.classList.toggle('office-compact',compact);density.setAttribute('aria-pressed',String(compact));density.textContent=compact?'العرض المريح':'العرض المكثّف';
}
density.addEventListener('click',()=>{compact=!compact;setDensity();try{localStorage.setItem('balqees-office-density',compact?'compact':'comfortable');}catch{}});
side.querySelector('.sidefoot').append(density);setDensity();addWorkspace();
