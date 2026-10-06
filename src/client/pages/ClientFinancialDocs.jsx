import AccountingPortal from '../../accounting/AccountingPortal';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, CircleDollarSign, Download,
  ExternalLink, FileArchive, FileCheck2, FileSpreadsheet, FileText, Filter, Link2,
  MapPinned, MessageSquareText, Pin, PinOff, ReceiptText, RefreshCw,
  ScrollText, Search, ShieldCheck
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useClientPortal } from '../ClientPortalContext';
import { contractLabels, fmtDate, openPrivateDocument, paymentLabels, quoteLabels, sar, statusTone } from '../portalUtils';
import '../financial-document-center.css';

const typeLabels={
  ar:{invoice_copy:'فاتورة رسمية',receipt:'إيصال',credit_note:'إشعار دائن',debit_note:'إشعار مدين',purchase_order:'أمر شراء',statement:'كشف/بيان',other:'مستند',quotation:'عرض سعر',contract:'عقد',amendment:'ملحق عقد'},
  en:{invoice_copy:'Official invoice',receipt:'Receipt',credit_note:'Credit note',debit_note:'Debit note',purchase_order:'Purchase order',statement:'Statement',other:'Document',quotation:'Quotation',contract:'Contract',amendment:'Contract amendment'}
};
const sourceIcons={client_document:ReceiptText,quotation:FileText,contract:ScrollText,amendment:FileCheck2};
const tabs=[
  ['all','الكل','All'],['new','جديد لكم','New'],['invoice','الفواتير','Invoices'],['quotation','العروض','Quotations'],
  ['contract','العقود','Contracts'],['receipt','الإيصالات','Receipts'],['notes','إشعارات مالية','Notes'],['other','أخرى','Other']
];
const financialTypes=new Set(['invoice_copy','receipt','credit_note','debit_note','statement']);

function monthKey(value,lang){
  if(!value)return '—';
  const d=new Date(value);if(Number.isNaN(d.getTime()))return '—';
  return new Intl.DateTimeFormat(lang==='ar'?'ar-SA':'en-GB',{month:'long',year:'numeric',timeZone:'Asia/Riyadh'}).format(d);
}
function matchesTab(row,tab){
  if(tab==='all')return true;
  if(tab==='new')return !row.last_opened_at;
  if(tab==='invoice')return row.document_type==='invoice_copy';
  if(tab==='quotation')return row.source_kind==='quotation';
  if(tab==='contract')return row.source_kind==='contract'||row.source_kind==='amendment';
  if(tab==='receipt')return row.document_type==='receipt';
  if(tab==='notes')return ['credit_note','debit_note','statement'].includes(row.document_type);
  return row.source_kind==='client_document'&&!financialTypes.has(row.document_type)&&row.document_type!=='receipt';
}
function csvEscape(value){const s=String(value??'');return `"${s.replaceAll('"','""')}"`;}

export default function ClientFinancialDocs(){
  const {lang,organization,permissions,portalSettings}=useClientPortal();
  const ar=lang==='ar';const navigate=useNavigate();const {sourceKind,sourceId}=useParams();
  const[rows,setRows]=useState([]);const[sites,setSites]=useState([]);const[contracts,setContracts]=useState([]);const[quotes,setQuotes]=useState([]);const[orders,setOrders]=useState([]);
  const[loading,setLoading]=useState(true);const[error,setError]=useState('');const[q,setQ]=useState('');const[tab,setTab]=useState('all');const[siteFilter,setSiteFilter]=useState('');const[yearFilter,setYearFilter]=useState('');const[statusFilter,setStatusFilter]=useState('');const[versions,setVersions]=useState([]);const[actionBusy,setActionBusy]=useState('');

  async function load(){
    if(!organization?.id){setLoading(false);return;}
    setLoading(true);setError('');
    const [docs,s,c,qu,o]=await Promise.all([
      supabase.rpc('get_organization_document_center',{p_organization_id:organization.id}),
      supabase.from('organization_sites').select('id,name_ar,name_en').eq('organization_id',organization.id).order('name_ar'),
      supabase.from('contracts').select('id,contract_number,title_ar,title_en,status').eq('organization_id',organization.id).neq('status','draft').order('created_at',{ascending:false}),
      supabase.from('quotations').select('id,quote_number,version_number,title_ar,title_en,status').eq('organization_id',organization.id).neq('status','draft').order('created_at',{ascending:false}),
      supabase.from('orders').select('id,order_number,status,created_at').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(250),
    ]);
    const firstError=docs.error||s.error||c.error||qu.error||o.error;
    if(firstError)setError(firstError.message||'load_failed');
    setRows(docs.data||[]);setSites(s.data||[]);setContracts(c.data||[]);setQuotes(qu.data||[]);setOrders(o.data||[]);setLoading(false);
  }
  useEffect(()=>{load();},[organization?.id]);
  useEffect(()=>{
    if(!organization?.id)return;
    const channel=supabase.channel(`org-document-center-${organization.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'client_documents',filter:`organization_id=eq.${organization.id}`},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'organization_document_user_state',filter:`organization_id=eq.${organization.id}`},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'quotations',filter:`organization_id=eq.${organization.id}`},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'contracts',filter:`organization_id=eq.${organization.id}`},load)
      .subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[organization?.id]);

  const maps=useMemo(()=>({
    site:Object.fromEntries(sites.map(x=>[x.id,x])),contract:Object.fromEntries(contracts.map(x=>[x.id,x])),quote:Object.fromEntries(quotes.map(x=>[x.id,x])),order:Object.fromEntries(orders.map(x=>[x.id,x]))
  }),[sites,contracts,quotes,orders]);

  const years=useMemo(()=>[...new Set(rows.map(r=>new Date(r.issue_date||r.created_at).getFullYear()).filter(Boolean))].sort((a,b)=>b-a),[rows]);
  const shown=useMemo(()=>rows.filter(r=>{
    if(!matchesTab(r,tab))return false;
    if(siteFilter&&r.site_id!==siteFilter)return false;
    if(yearFilter&&String(new Date(r.issue_date||r.created_at).getFullYear())!==yearFilter)return false;
    if(statusFilter&&r.record_status!==statusFilter&&r.payment_status!==statusFilter)return false;
    const hay=`${r.document_number||''} ${r.title_ar||''} ${r.title_en||''} ${r.purchase_order_number||''} ${r.cost_center||''} ${r.internal_reference||''}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  }),[rows,tab,siteFilter,yearFilter,statusFilter,q]);
  const documentGrouping=portalSettings?.organization_settings?.document_grouping||'type';
  const groups=useMemo(()=>{
    const out=[];const index=new Map();
    shown.forEach(r=>{
      const key=documentGrouping==='month'
        ? monthKey(r.issue_date||r.created_at,lang)
        : documentGrouping==='site'
          ? (maps.site[r.site_id]?(ar?(maps.site[r.site_id].name_ar||maps.site[r.site_id].name_en):(maps.site[r.site_id].name_en||maps.site[r.site_id].name_ar)):(ar?'بدون موقع':'No site'))
          : (typeLabels[lang][r.document_type]||r.document_type||r.source_kind);
      if(!index.has(key)){index.set(key,out.length);out.push({key,rows:[]});}out[index.get(key)].rows.push(r);
    });
    return out;
  },[shown,lang,ar,maps.site,documentGrouping]);
  const selected=useMemo(()=>rows.find(r=>r.source_kind===sourceKind&&r.source_id===sourceId)||null,[rows,sourceKind,sourceId]);
  useEffect(()=>{
    if(!selected||selected.last_opened_at||!organization?.id)return;
    let active=true;
    supabase.rpc('mark_organization_document_opened',{p_organization_id:organization.id,p_source_kind:selected.source_kind,p_source_id:selected.source_id}).then(()=>{if(active)load();});
    return()=>{active=false;};
  },[selected?.source_kind,selected?.source_id,selected?.last_opened_at,organization?.id]);
  const newCount=rows.filter(r=>!r.last_opened_at).length;const reviewCount=rows.filter(r=>!r.reviewed_at).length;const pinnedCount=rows.filter(r=>r.is_pinned).length;const financeCount=rows.filter(r=>r.source_kind==='client_document'&&financialTypes.has(r.document_type)).length;

  useEffect(()=>{
    let alive=true;
    (async()=>{
      if(!selected||selected.source_kind!=='client_document'||!organization?.id){setVersions([]);return;}
      if(!selected.document_number){setVersions([selected]);return;}
      const {data}=await supabase.from('client_documents').select('*').eq('organization_id',organization.id).eq('document_type',selected.document_type).eq('document_number',selected.document_number).neq('status','draft').order('revision_number',{ascending:false});
      if(alive)setVersions(data||[]);
    })();
    return()=>{alive=false;};
  },[selected?.source_id,organization?.id]);

  async function setState(row,action,value=null){
    if(!organization?.id||!row)return;
    setActionBusy(`${action}:${row.source_kind}:${row.source_id}`);
    const fn=action==='opened'?'mark_organization_document_opened':action==='reviewed'?'acknowledge_organization_document':'pin_organization_document';
    const args=action==='pin'?{p_organization_id:organization.id,p_source_kind:row.source_kind,p_source_id:row.source_id,p_pinned:value}:{p_organization_id:organization.id,p_source_kind:row.source_kind,p_source_id:row.source_id};
    await supabase.rpc(fn,args);await load();setActionBusy('');
  }
  async function openRow(row){await setState(row,'opened');if(row.file_path)await openPrivateDocument(row.file_path);}
  function selectRow(row){navigate(`/portal/financial/${row.source_kind}/${row.source_id}`);if(!row.last_opened_at)setState(row,'opened');}
  function exportCsv(){
    const headers=['type','number','title','issue_date','site','po','cost_center','status','amount'];
    const body=shown.map(r=>[typeLabels.en[r.document_type]||r.document_type,r.document_number,ar?r.title_ar:(r.title_en||r.title_ar),r.issue_date||'',maps.site[r.site_id]?.name_ar||'',r.purchase_order_number||'',r.cost_center||'',r.record_status,r.total_amount??'']);
    const csv=[headers,...body].map(row=>row.map(csvEscape).join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`balqees-documents-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  }
  function sourceStatus(row){
    if(row.source_kind==='quotation')return quoteLabels[lang][row.record_status]||row.record_status;
    if(row.source_kind==='contract')return contractLabels[lang][row.record_status]||row.record_status;
    return row.record_status;
  }
  function contextAction(row){
    if(row.source_kind==='quotation'&&permissions.viewQuotes)return ['/portal/quotes/'+row.source_id,ar?'فتح العرض':'Open quotation'];
    if(row.source_kind==='contract'&&permissions.viewContracts)return ['/portal/contracts/'+row.source_id,ar?'فتح العقد':'Open contract'];
    if(row.source_kind==='amendment'&&row.contract_id&&permissions.viewContracts)return ['/portal/contracts/'+row.contract_id,ar?'فتح العقد':'Open contract'];
    if(row.order_id&&permissions.viewOrders)return ['/portal/orders/'+row.order_id,ar?'فتح الطلب':'Open order'];
    if(row.quotation_id&&permissions.viewQuotes)return ['/portal/quotes/'+row.quotation_id,ar?'فتح العرض':'Open quotation'];
    if(row.contract_id&&permissions.viewContracts)return ['/portal/contracts/'+row.contract_id,ar?'فتح العقد':'Open contract'];
    return null;
  }

  return <div className="client-page document-center-page">
    <header className="client-page-head document-center-head"><div><span><FileArchive/>{ar?'مركز الثقة المالي والمستندي':'FINANCIAL & DOCUMENT CENTER'}</span><h2>{ar?'المركز المالي والمستندات':'Financial & Document Center'}</h2><p>{ar?'كل نسخة رسمية في سياقها: الطلب، العرض، العقد، الموقع وبيانات المشتريات — مع فصل صارم للصلاحيات المالية.':'Official documents in context: order, quotation, contract, site and procurement references — with strict finance permissions.'}</p></div><div><button className="client-secondary" onClick={exportCsv}><FileSpreadsheet/>{ar?'تصدير البيانات':'Export data'}</button><button className="client-secondary" onClick={load}><RefreshCw className={loading?'spin':''}/>{ar?'تحديث':'Refresh'}</button></div></header>

    <AccountingPortal lang={lang} organizationId={organization?.id}/>

    <section className="document-trust-banner"><ShieldCheck/><div><strong>{ar?'المستند الرسمي يبقى كما صدر':'The official document stays original'}</strong><p>{ar?'بلقيس لا تعيد إنشاء الفاتورة داخل البوابة. النسخ المالية هنا مرفوعة بعد إصدارها من النظام المحاسبي، وأي استبدال يحفظ النسخة السابقة في السجل.':'Balqees does not regenerate invoices in the portal. Financial copies are uploaded after accounting issuance, and replacements preserve previous versions.'}</p></div></section>

    <section className="document-pulse-grid">
      <article className={newCount?'attention':''}><span><FileArchive/></span><div><small>{ar?'جديد لكم':'NEW FOR YOU'}</small><strong>{newCount}</strong><p>{ar?'لم تفتحها بعد':'Not opened yet'}</p></div></article>
      <article><span><CheckCircle2/></span><div><small>{ar?'لم تتم مراجعتها':'NOT REVIEWED'}</small><strong>{reviewCount}</strong><p>{ar?'القراءة لا تعني المراجعة':'Opening is not review'}</p></div></article>
      <article><span><Pin/></span><div><small>{ar?'مثبتة':'PINNED'}</small><strong>{pinnedCount}</strong><p>{ar?'للرجوع السريع':'Quick access'}</p></div></article>
      <article><span><CircleDollarSign/></span><div><small>{ar?'مستندات مالية ظاهرة':'FINANCE DOCS'}</small><strong>{financeCount}</strong><p>{permissions.viewFinance?(ar?'حسب صلاحيتك المالية':'Based on your finance access'):(ar?'البيانات المالية محجوبة':'Financial data is restricted')}</p></div></article>
    </section>

    <div className="document-tabs">{tabs.map(([k,a,e])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{ar?a:e}{k==='new'&&newCount>0?<b>{newCount}</b>:null}</button>)}</div>
    <div className="document-toolbar">
      <div className="client-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={ar?'ابحث بالرقم، PO، مركز التكلفة أو المرجع الداخلي…':'Search number, PO, cost center or internal reference…'}/></div>
      <label><MapPinned/><select value={siteFilter} onChange={e=>setSiteFilter(e.target.value)}><option value="">{ar?'كل المواقع':'All sites'}</option>{sites.map(s=><option key={s.id} value={s.id}>{ar?s.name_ar:(s.name_en||s.name_ar)}</option>)}</select></label>
      <label><CalendarDays/><select value={yearFilter} onChange={e=>setYearFilter(e.target.value)}><option value="">{ar?'كل السنوات':'All years'}</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label>
      <label><Filter/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">{ar?'كل الحالات':'All statuses'}</option><option value="published">Published</option><option value="replaced">Replaced</option><option value="cancelled">Cancelled</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="overdue">Overdue</option></select></label>
    </div>

    {error&&<div className="document-error"><AlertTriangle/><span>{ar?'تعذر تحميل بعض بيانات المركز.':'Some document center data could not be loaded.'}</span></div>}

    <div className={`document-center-layout ${selected?'has-detail':''}`}>
      <div className="document-stream">
        {loading?<div className="document-loading"><RefreshCw className="spin"/><span>{ar?'جاري تجميع المستندات الرسمية…':'Loading official documents…'}</span></div>:groups.length?groups.map(group=><section key={group.key} className="document-month-group"><header><strong>{group.key}</strong><span>{group.rows.length} {ar?'مستند':'documents'}</span></header><div>{group.rows.map(row=>{const Icon=sourceIcons[row.source_kind]||FileArchive;const site=maps.site[row.site_id];const fresh=!row.last_opened_at;return <article key={`${row.source_kind}:${row.source_id}`} className={`${fresh?'fresh':''} ${row.is_pinned?'pinned':''} ${selected?.source_kind===row.source_kind&&selected?.source_id===row.source_id?'selected':''}`} onClick={()=>selectRow(row)}><span className="document-card-icon"><Icon/></span><div className="document-card-main"><div className="document-card-kicker"><b>{typeLabels[lang][row.document_type]||row.document_type}</b>{fresh&&<em>{ar?'جديد':'NEW'}</em>}{row.revision_number>1&&<em>R{row.revision_number}</em>}</div><strong>{ar?row.title_ar:(row.title_en||row.title_ar)}</strong><p>{row.document_number||'—'}{site?` · ${ar?site.name_ar:(site.name_en||site.name_ar)}`:''}{row.purchase_order_number?` · PO ${row.purchase_order_number}`:''}</p></div><div className="document-card-meta">{row.total_amount!=null&&<b>{sar(row.total_amount,lang)}</b>}<span className={`client-status ${statusTone(row.payment_status!=='not_applicable'?row.payment_status:row.record_status)}`}>{row.payment_status!=='not_applicable'?(paymentLabels[lang][row.payment_status]||row.payment_status):sourceStatus(row)}</span><small>{fmtDate(row.issue_date||row.created_at,lang)}</small></div><button className="document-pin-button" onClick={e=>{e.stopPropagation();setState(row,'pin',!row.is_pinned)}} title={row.is_pinned?(ar?'إلغاء التثبيت':'Unpin'):(ar?'تثبيت':'Pin')}>{row.is_pinned?<PinOff/>:<Pin/>}</button></article>})}</div></section>):<div className="client-empty-large"><FileCheck2/><h3>{ar?'كل شيء مرتب هنا':'Everything is organized'}</h3><p>{ar?'لا توجد مستندات تطابق الفلاتر الحالية.':'No documents match the current filters.'}</p></div>}
      </div>

      {selected&&<aside className="document-detail-panel"><header><button className="document-detail-back" onClick={()=>navigate('/portal/financial')}><ArrowLeft/></button><div><small>{typeLabels[lang][selected.document_type]||selected.document_type}</small><h3>{ar?selected.title_ar:(selected.title_en||selected.title_ar)}</h3><p>{selected.document_number||'—'} · {fmtDate(selected.issue_date||selected.created_at,lang)}</p></div><button className={`document-pin-button static ${selected.is_pinned?'active':''}`} onClick={()=>setState(selected,'pin',!selected.is_pinned)}>{selected.is_pinned?<PinOff/>:<Pin/>}</button></header>
        <section className="document-detail-hero"><div><small>{ar?'الحالة':'STATUS'}</small><strong>{sourceStatus(selected)}</strong></div>{selected.total_amount!=null&&<div><small>{ar?'القيمة الظاهرة':'VISIBLE VALUE'}</small><strong>{sar(selected.total_amount,lang)}</strong></div>}<div><small>{ar?'المراجعة':'REVIEW'}</small><strong>{selected.reviewed_at?(ar?'تمت المراجعة':'Reviewed'):(ar?'لم تتم بعد':'Not reviewed')}</strong></div></section>

        <div className="document-detail-actions"><button className="client-primary" onClick={()=>openRow(selected)} disabled={!selected.file_path||actionBusy.startsWith('opened')}><Download/>{ar?'فتح المستند الرسمي':'Open official document'}</button>{!selected.reviewed_at&&<button className="client-secondary" onClick={()=>setState(selected,'reviewed')}><CheckCircle2/>{ar?'تأكيد أني راجعته':'Mark as reviewed'}</button>}</div>

        <section className="document-context-card"><header><Link2/><div><small>{ar?'سلسلة السياق':'DOCUMENT CONTEXT'}</small><h4>{ar?'مرتبط بأي عملية؟':'What is this linked to?'}</h4></div></header><div className="document-context-grid">{selected.site_id&&<span><small>{ar?'الموقع':'SITE'}</small><strong>{ar?maps.site[selected.site_id]?.name_ar:(maps.site[selected.site_id]?.name_en||maps.site[selected.site_id]?.name_ar)||'—'}</strong></span>}{selected.order_id&&<span><small>{ar?'الطلب':'ORDER'}</small><strong>BLQ-{String(maps.order[selected.order_id]?.order_number||'').padStart(5,'0')}</strong></span>}{selected.quotation_id&&<span><small>{ar?'العرض':'QUOTE'}</small><strong>Q-{String(maps.quote[selected.quotation_id]?.quote_number||'').padStart(5,'0')}</strong></span>}{selected.contract_id&&<span><small>{ar?'العقد':'CONTRACT'}</small><strong>{maps.contract[selected.contract_id]?.contract_number||'—'}</strong></span>}{selected.purchase_order_number&&<span><small>PO</small><strong>{selected.purchase_order_number}</strong></span>}{selected.cost_center&&<span><small>{ar?'مركز التكلفة':'COST CENTER'}</small><strong>{selected.cost_center}</strong></span>}{selected.internal_reference&&<span><small>{ar?'مرجعكم الداخلي':'INTERNAL REF'}</small><strong>{selected.internal_reference}</strong></span>}</div>{contextAction(selected)&&<button className="client-secondary" onClick={()=>navigate(contextAction(selected)[0])}><ExternalLink/>{contextAction(selected)[1]}</button>}</section>

        {selected.source_kind==='client_document'&&versions.length>1&&<section className="document-version-card"><header><FileArchive/><div><small>{ar?'الإصدارات المحفوظة':'PRESERVED VERSIONS'}</small><h4>{ar?'سجل النسخ الرسمية':'Official version history'}</h4></div></header>{versions.map(v=><button key={v.id} className={v.id===selected.source_id?'active':''} onClick={()=>navigate(`/portal/financial/client_document/${v.id}`)}><span>R{v.revision_number}</span><div><strong>{v.status}</strong><small>{fmtDate(v.published_at||v.created_at,lang,true)}</small></div>{v.id===selected.source_id&&<b>{ar?'الحالية':'CURRENT'}</b>}</button>)}</section>}

        <section className="document-meta-card"><span><small>{ar?'تاريخ الإصدار':'ISSUE DATE'}</small><strong>{fmtDate(selected.issue_date,lang)}</strong></span><span><small>{ar?'تاريخ الاستحقاق':'DUE DATE'}</small><strong>{fmtDate(selected.due_date,lang)}</strong></span><span><small>{ar?'آخر فتح':'LAST OPENED'}</small><strong>{fmtDate(selected.last_opened_at,lang,true)}</strong></span><span><small>{ar?'الخصوصية':'VISIBILITY'}</small><strong>{selected.visibility==='finance'?(ar?'المالية فقط':'Finance only'):(ar?'أعضاء المنشأة':'Organization members')}</strong></span></section>
        {permissions.createSupportCases&&<button className="document-care-link" onClick={()=>navigate(`/portal/support?document=${selected.source_kind}:${selected.source_id}`)}><MessageSquareText/><div><strong>{ar?'استفسر عن هذا المستند':'Ask about this document'}</strong><small>{ar?'يفتح عناية بلقيس مع سياق المستند محفوظًا.':'Opens Balqees Care with the document context attached.'}</small></div></button>}
      </aside>}
    </div>
  </div>;
}
