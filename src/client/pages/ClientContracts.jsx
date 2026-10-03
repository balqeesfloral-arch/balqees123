import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Building2, CalendarClock, CheckCircle2,
  CircleDollarSign, Download, FileCheck2, FileClock, FileText, Gauge, Handshake, HelpCircle,
  History, MapPin, MessageSquareText, RefreshCw, Search, ShieldCheck, Sparkles, UsersRound,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useClientPortal } from '../ClientPortalContext';
import { contractLabels, orderLabels, daysUntil, fmtDate, openPrivateDocument, sar, statusTone } from '../portalUtils';
import '../living-contract.css';

const coverageLabels = {
  ar: { covered: 'مشمول', conditional: 'مشروط', excluded: 'غير مشمول' },
  en: { covered: 'Covered', conditional: 'Conditional', excluded: 'Not covered' },
};
const renewalLabels = {
  ar: { none: 'لم تبدأ المراجعة', review_requested: 'تم طلب المراجعة', in_review: 'قيد مراجعة بلقيس', renewed: 'تم التجديد', not_renewing: 'مسار التجديد مغلق' },
  en: { none: 'Not started', review_requested: 'Review requested', in_review: 'Under Balqees review', renewed: 'Renewed', not_renewing: 'Renewal path closed' },
};
const obligationLabels = {
  ar: { upcoming: 'قادم', completed: 'مكتمل', waived: 'معفى', overdue: 'متأخر' },
  en: { upcoming: 'Upcoming', completed: 'Completed', waived: 'Waived', overdue: 'Overdue' },
};

function clamp(n, min = 0, max = 100) { return Math.min(max, Math.max(min, n)); }
function contractProgress(contract) {
  if (!contract?.starts_on || !contract?.ends_on) return 0;
  const start = new Date(`${contract.starts_on}T00:00:00`).getTime();
  const end = new Date(`${contract.ends_on}T23:59:59`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return clamp(Math.round(((Date.now() - start) / (end - start)) * 100));
}
function derivedStatus(contract) {
  if (!contract) return 'draft';
  if (['cancelled','terminated','expired','draft'].includes(contract.status)) return contract.status;
  const left = daysUntil(contract.ends_on);
  if (left !== null && left < 0) return 'expired';
  if (left !== null && left <= 60) return 'expiring';
  return contract.status;
}
function orderReference(order) {
  const d = new Date(order?.created_at || Date.now());
  const year = Number.isNaN(d.getTime()) ? new Date().getFullYear() : new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Riyadh'}).format(d);
  return `BLQ-${year}-${String(order?.order_number || '').padStart(5,'0')}`;
}
function normalize(value='') { return String(value).trim().toLocaleLowerCase(); }

export default function ClientContracts(){
  const { id } = useParams();
  const navigate = useNavigate();
  const { lang, organization, permissions } = useClientPortal();
  const ar = lang === 'ar';
  const [rows,setRows]=useState([]);
  const [financialMap,setFinancialMap]=useState({});
  const [overviewMeta,setOverviewMeta]=useState({ sites:[], obligations:[] });
  const [loading,setLoading]=useState(true);
  const [detail,setDetail]=useState(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [tab,setTab]=useState('summary');
  const [coverageQuery,setCoverageQuery]=useState('');
  const [renewBusy,setRenewBusy]=useState(false);
  const [renewMessage,setRenewMessage]=useState('');

  async function load(){
    if(!organization?.id)return;
    setLoading(true);
    const tasks=[
      supabase.from('contracts').select('*').eq('organization_id',organization.id).order('ends_on',{ascending:true,nullsFirst:false}),
      supabase.from('contract_sites').select('contract_id,coverage_status').eq('organization_id',organization.id),
      supabase.from('contract_obligations').select('id,contract_id,status,due_on,owner_type').eq('organization_id',organization.id),
    ];
    if(permissions.viewFinance) tasks.push(supabase.from('contract_financials').select('*').eq('organization_id',organization.id));
    const result=await Promise.all(tasks);
    setRows(result[0].data||[]);
    setOverviewMeta({sites:result[1].data||[],obligations:result[2].data||[]});
    if(permissions.viewFinance){
      const financeRows=result[3]?.data||[];
      setFinancialMap(Object.fromEntries(financeRows.map(x=>[x.contract_id,x])));
    }else setFinancialMap({});
    setLoading(false);
  }

  async function loadDetail(contractId){
    if(!organization?.id||!contractId)return;
    setDetailLoading(true);setRenewMessage('');
    const baseSelect=permissions.viewFinance
      ? 'id,order_number,status,total,created_at,service_site_id,contract_id'
      : 'id,order_number,status,created_at,service_site_id,contract_id';
    const tasks=[
      supabase.from('contracts').select('*').eq('id',contractId).eq('organization_id',organization.id).maybeSingle(),
      supabase.from('contract_sites').select('*,organization_sites(id,name_ar,name_en,site_type,address)').eq('contract_id',contractId).order('created_at'),
      supabase.from('contract_services').select('*').eq('contract_id',contractId).order('sort_order').order('created_at'),
      supabase.from('contract_obligations').select('*,organization_sites(id,name_ar,name_en)').eq('contract_id',contractId).order('due_on',{ascending:true,nullsFirst:false}),
      supabase.from('contract_amendments').select('*').eq('contract_id',contractId).order('effective_on',{ascending:false,nullsFirst:false}),
      supabase.from('contract_events').select('*').eq('contract_id',contractId).order('created_at',{ascending:false}).limit(80),
      supabase.from('contract_contacts').select('*').eq('contract_id',contractId).order('sort_order').order('created_at'),
      supabase.from('orders').select(baseSelect).eq('organization_id',organization.id).eq('contract_id',contractId).order('created_at',{ascending:false}),
      supabase.from('organization_service_requests').select('id,request_code,status,service_type,site_id,submitted_at,created_at').eq('organization_id',organization.id).eq('contract_id',contractId).order('created_at',{ascending:false}),
      supabase.from('quotations').select('id,quote_number,status,version_number,is_current,total,created_at').eq('organization_id',organization.id).eq('contract_id',contractId).neq('status','draft').order('created_at',{ascending:false}),
    ];
    if(permissions.viewFinance){
      tasks.push(supabase.from('contract_financials').select('*').eq('contract_id',contractId).maybeSingle());
      tasks.push(supabase.from('client_documents').select('id,document_type,document_number,title_ar,title_en,issue_date,total_amount,payment_status,file_path,created_at').eq('organization_id',organization.id).eq('contract_id',contractId).order('created_at',{ascending:false}));
    }
    const res=await Promise.all(tasks);
    const contract=res[0].data||null;
    if(!contract){setDetail(null);setDetailLoading(false);return;}
    setDetail({
      contract,
      sites:res[1].data||[], services:res[2].data||[], obligations:res[3].data||[], amendments:res[4].data||[],
      events:res[5].data||[], contacts:res[6].data||[], orders:res[7].data||[], requests:res[8].data||[], quotes:res[9].data||[],
      financial:permissions.viewFinance?(res[10]?.data||null):null,
      documents:permissions.viewFinance?(res[11]?.data||[]):[],
    });
    setDetailLoading(false);
  }

  useEffect(()=>{load();},[organization?.id,permissions.viewFinance]);
  useEffect(()=>{if(id){setTab('summary');setCoverageQuery('');loadDetail(id);}else setDetail(null);},[id,organization?.id,permissions.viewFinance]);
  useEffect(()=>{
    if(!organization?.id)return undefined;
    const channel=supabase.channel(`client-contracts-${organization.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'contracts',filter:`organization_id=eq.${organization.id}`},()=>{load();if(id)loadDetail(id);})
      .on('postgres_changes',{event:'*',schema:'public',table:'contract_obligations',filter:`organization_id=eq.${organization.id}`},()=>{if(id)loadDetail(id);})
      .on('postgres_changes',{event:'*',schema:'public',table:'contract_events',filter:`organization_id=eq.${organization.id}`},()=>{if(id)loadDetail(id);})
      .subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[organization?.id,id]);

  const selected=detail?.contract||rows.find(x=>x.id===id)||null;
  const health=useMemo(()=>{
    if(!detail)return null;
    const status=derivedStatus(detail.contract);
    const overdue=detail.obligations.filter(o=>o.status==='overdue'||(o.status==='upcoming'&&o.due_on&&daysUntil(o.due_on)<0));
    if(['expired','terminated','cancelled'].includes(status)) return {tone:'danger',title:ar?'العقد غير نشط':'Contract is not active',body:ar?'راجع حالة العقد أو مسار التجديد قبل إنشاء عمليات جديدة مرتبطة به.':'Review the contract status or renewal path before creating new linked operations.'};
    if(overdue.length) return {tone:'danger',title:ar?'العقد يحتاج متابعة':'Contract needs attention',body:ar?`${overdue.length} التزام متأخر يحتاج متابعة.`:`${overdue.length} overdue obligation(s) need attention.`};
    const left=daysUntil(detail.contract.ends_on);
    if(left!==null&&left<=60) return {tone:'warn',title:ar?'مراجعة التجديد قريبة':'Renewal review is approaching',body:ar?`متبقي ${Math.max(left,0)} يوم على نهاية العقد.`:`${Math.max(left,0)} day(s) remain until the contract ends.`};
    if(!detail.sites.length||!detail.services.length) return {tone:'warn',title:ar?'بيانات التغطية تحتاج استكمال':'Coverage data needs completion',body:ar?'التغطية المهيكلة للمواقع أو الخدمات غير مكتملة بعد.':'Structured site or service coverage is not complete yet.'};
    return {tone:'good',title:ar?'العناية بالعقد مستقرة':'Contract care is stable',body:ar?'لا توجد التزامات متأخرة أو إشارات تشغيلية تتطلب تدخلك الآن.':'There are no overdue obligations or operational signals requiring your attention right now.'};
  },[detail,ar]);

  const matchedServices=useMemo(()=>{
    if(!detail||!coverageQuery.trim())return [];
    const q=normalize(coverageQuery);
    return detail.services.filter(s=>normalize([s.service_key,s.title_ar,s.title_en,s.summary_ar,s.summary_en,s.conditions_ar,s.conditions_en].filter(Boolean).join(' ')).includes(q));
  },[detail,coverageQuery]);

  const monthActivity=useMemo(()=>{
    if(!detail)return [];
    const year=new Date(detail.contract.starts_on||Date.now()).getFullYear();
    return Array.from({length:12},(_,month)=>{
      const events=detail.events.filter(e=>{const d=new Date(e.created_at);return d.getFullYear()===year&&d.getMonth()===month;}).length;
      const obligations=detail.obligations.filter(o=>{if(!o.due_on)return false;const d=new Date(`${o.due_on}T12:00:00`);return d.getFullYear()===year&&d.getMonth()===month;}).length;
      return {month,count:events+obligations};
    });
  },[detail]);

  async function requestRenewal(){
    if(!selected||renewBusy)return;
    setRenewBusy(true);setRenewMessage('');
    const{error}=await supabase.rpc('request_contract_renewal_review',{p_contract_id:selected.id});
    if(error)setRenewMessage(ar?'تعذر إرسال طلب مراجعة التجديد. تحقق من صلاحية الاعتماد وحالة العقد.':'Could not request a renewal review. Check your approval permission and contract status.');
    else{setRenewMessage(ar?'تم تسجيل طلب مراجعة التجديد لدى فريق بلقيس.':'Renewal review request sent to Balqees.');await loadDetail(selected.id);await load();}
    setRenewBusy(false);
  }

  if(id){
    if(detailLoading&&!detail)return <div className="client-contract-loading"><Sparkles className="spin"/><strong>{ar?'جاري تجهيز العقد الحي…':'Preparing the living contract…'}</strong></div>;
    if(!selected)return <div className="client-empty-large"><FileCheck2/><h3>{ar?'العقد غير متاح':'Contract unavailable'}</h3><button className="client-secondary" onClick={()=>navigate('/portal/contracts')}>{ar?'العودة للعقود':'Back to contracts'}</button></div>;
    const status=derivedStatus(selected);const left=daysUntil(selected.ends_on);const progress=contractProgress(selected);
    const nextObligation=detail?.obligations.find(o=>o.status==='upcoming'||o.status==='overdue')||null;
    const completedOrders=detail?.orders.filter(o=>['completed','delivered'].includes(o.status)).length||0;
    const activeOrders=detail?.orders.filter(o=>!['completed','cancelled','delivered'].includes(o.status)).length||0;
    const financial=detail?.financial;
    const spend=permissions.viewFinance?detail?.orders.reduce((sum,o)=>sum+Number(o.total||0),0)||0:0;
    const budget=Number(financial?.budget_ceiling||0);
    const renewalAllowed=permissions.acceptQuotes&&['active','expiring'].includes(status)&&['none','not_renewing'].includes(selected.renewal_status||'none')&&(left===null||left<=120);
    const Back=ar?ArrowRight:ArrowLeft;
    return <div className="client-page living-contract-page">
      <header className="living-contract-nav"><button className="client-secondary" onClick={()=>navigate('/portal/contracts')}><Back/>{ar?'كل العقود':'All contracts'}</button><div className="living-contract-nav-actions">{permissions.createSupportCases&&<button className="client-secondary" onClick={()=>navigate(`/portal/support?contract=${selected.id}`)}><MessageSquareText/>{ar?'اسأل عناية بلقيس':'Ask Balqees Care'}</button>}{selected.document_path&&<button className="client-secondary" onClick={()=>openPrivateDocument(selected.document_path)}><Download/>{ar?'العقد الرسمي':'Official contract'}</button>}{renewalAllowed&&<button className="client-primary" disabled={renewBusy} onClick={requestRenewal}><RefreshCw className={renewBusy?'spin':''}/>{ar?'بدء مراجعة التجديد':'Start renewal review'}</button>}</div></header>

      <section className="living-contract-hero">
        <div className="living-contract-ring" style={{'--contract-progress':`${progress*3.6}deg`}}><div><small>{ar?'مدة العقد':'TERM'}</small><strong>{progress}%</strong><span>{left===null?'—':left>=0?(ar?`${left} يوم متبقي`:`${left} days left`):(ar?'انتهت المدة':'Term ended')}</span></div></div>
        <div className="living-contract-hero-copy"><div className="living-contract-eyebrow"><Handshake/><span>{selected.contract_number}</span><em className={`client-status ${statusTone(status)}`}>{contractLabels[lang][status]||status}</em></div><h2>{ar?selected.title_ar:(selected.title_en||selected.title_ar)}</h2><p>{ar?(selected.coverage_notes_ar||selected.services_summary_ar||'نطاق العقد والخدمات والمواقع المرتبطة به متاح من مركز العقود الحي.'):(selected.coverage_notes_en||selected.services_summary_en||selected.coverage_notes_ar||selected.services_summary_ar||'Coverage, services and linked sites are available from the living contract center.')}</p><div className="living-contract-date-line"><span><small>{ar?'البداية':'START'}</small><b>{fmtDate(selected.starts_on,lang)}</b></span><i/><span><small>{ar?'النهاية':'END'}</small><b>{fmtDate(selected.ends_on,lang)}</b></span></div></div>
        <div className="living-contract-health-card"><span className={`contract-health-orb ${health?.tone||'neutral'}`}><ShieldCheck/></span><small>{ar?'عناية العقد':'CONTRACT CARE'}</small><strong>{health?.title}</strong><p>{health?.body}</p>{nextObligation&&<div className="contract-next-mini"><CalendarClock/><span><small>{ar?'التالي':'NEXT'}</small><b>{ar?nextObligation.title_ar:(nextObligation.title_en||nextObligation.title_ar)}</b><em>{fmtDate(nextObligation.due_on,lang)}</em></span></div>}</div>
      </section>
      {renewMessage&&<div className="contract-feedback"><CheckCircle2/>{renewMessage}</div>}

      <nav className="living-contract-tabs">
        {[['summary',Gauge,ar?'الملخص':'Summary'],['coverage',ShieldCheck,ar?'التغطية':'Coverage'],['activity',History,ar?'النشاط':'Activity'],['documents',FileText,ar?'المستندات':'Documents']].map(([key,Icon,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}><Icon/>{label}</button>)}
      </nav>

      {tab==='summary'&&<div className="living-contract-section-stack">
        <section className="contract-pulse-grid">
          <article><span><Building2/></span><small>{ar?'المواقع المشمولة':'COVERED SITES'}</small><strong>{detail?.sites.filter(s=>s.coverage_status!=='excluded').length||0}</strong><p>{ar?'موقع مرتبط بنطاق العقد':'sites linked to this contract'}</p></article>
          <article><span><ShieldCheck/></span><small>{ar?'الخدمات المنظمة':'STRUCTURED SERVICES'}</small><strong>{detail?.services.length||0}</strong><p>{ar?'خدمة موثقة ضمن التغطية':'services documented in coverage'}</p></article>
          <article><span><FileClock/></span><small>{ar?'عمليات مكتملة':'COMPLETED OPERATIONS'}</small><strong>{completedOrders}</strong><p>{ar?`${activeOrders} عملية نشطة الآن`:`${activeOrders} active now`}</p></article>
          <article><span><FileText/></span><small>{ar?'الملاحق المنشورة':'PUBLISHED ADDENDA'}</small><strong>{detail?.amendments.filter(a=>a.status==='published').length||0}</strong><p>{ar?'ملاحق مرتبطة بهذا العقد':'addenda attached to this contract'}</p></article>
        </section>

        {permissions.viewFinance&&financial&&<section className="contract-finance-panel"><div><span><CircleDollarSign/></span><div><small>{ar?'ملخص مالي للعقد':'CONTRACT FINANCIAL VIEW'}</small><h3>{financial.contract_value==null?(ar?'حسب الاتفاق':'As agreed'):sar(financial.contract_value,lang)}</h3><p>{budget>0?(ar?`قيمة العمليات المرتبطة: ${sar(spend,lang)} من سقف ${sar(budget,lang)}`:`Linked operations: ${sar(spend,lang)} of ${sar(budget,lang)} ceiling`):(ar?'لا يوجد سقف ميزانية منظم على هذا العقد.':'No structured budget ceiling is configured for this contract.')}</p></div></div>{budget>0&&<div className="contract-budget-meter"><i style={{width:`${clamp(spend/budget*100)}%`}}/><span>{Math.round(clamp(spend/budget*100))}%</span></div>}</section>}

        <section className="living-contract-two-col">
          <article className="living-contract-panel"><header><div><small>{ar?'الالتزام القادم':'NEXT OBLIGATION'}</small><h3>{ar?'ما التالي؟':'What comes next?'}</h3></div><CalendarClock/></header>{nextObligation?<div className="contract-obligation-feature"><span className={`obligation-owner ${nextObligation.owner_type}`}>{nextObligation.owner_type==='balqees'?(ar?'على بلقيس':'Balqees'):(ar?'على المنشأة':'Organization')}</span><h4>{ar?nextObligation.title_ar:(nextObligation.title_en||nextObligation.title_ar)}</h4><p>{ar?(nextObligation.notes_ar||''):(nextObligation.notes_en||nextObligation.notes_ar||'')}</p><time>{fmtDate(nextObligation.due_on,lang)}</time></div>:<div className="client-empty-soft"><CheckCircle2/><strong>{ar?'لا توجد التزامات قادمة':'No upcoming obligations'}</strong><p>{ar?'لا يوجد موعد أو التزام ظاهر للعميل يحتاج متابعة الآن.':'There is no client-visible commitment requiring follow-up right now.'}</p></div>}</article>
          <article className="living-contract-panel"><header><div><small>{ar?'مسار التجديد':'RENEWAL PATH'}</small><h3>{renewalLabels[lang][selected.renewal_status]||selected.renewal_status}</h3></div><RefreshCw/></header><div className="renewal-path"><span className={['review_requested','in_review','renewed'].includes(selected.renewal_status)?'done':'active'}>{ar?'مراجعة':'Review'}</span><i/><span className={['in_review','renewed'].includes(selected.renewal_status)?'done':''}>{ar?'مناقشة':'Reviewing'}</span><i/><span className={selected.renewal_status==='renewed'?'done':''}>{ar?'تجديد':'Renewed'}</span></div>{selected.renewal_review_requested_at&&<p>{ar?'طُلبت المراجعة في ':'Review requested on '}{fmtDate(selected.renewal_review_requested_at,lang,true)}</p>}{renewalAllowed&&<button className="client-secondary" disabled={renewBusy} onClick={requestRenewal}>{ar?'ابدأ مراجعة التجديد':'Start renewal review'}</button>}</article>
        </section>

        <section className="living-contract-panel"><header><div><small>{ar?'خريطة التغطية':'COVERAGE MAP'}</small><h3>{ar?'المواقع تحت هذا العقد':'Sites under this contract'}</h3></div><MapPin/></header><div className="contract-site-strip">{detail?.sites.length?detail.sites.map(s=><button key={s.id} onClick={()=>setTab('coverage')}><span className={`coverage-dot ${s.coverage_status}`}/><div><strong>{ar?(s.organization_sites?.name_ar||'—'):(s.organization_sites?.name_en||s.organization_sites?.name_ar||'—')}</strong><small>{coverageLabels[lang][s.coverage_status]||s.coverage_status}</small></div></button>):<div className="client-empty-soft"><MapPin/><strong>{ar?'لم تُنظّم مواقع التغطية بعد':'Coverage sites are not structured yet'}</strong></div>}</div></section>

        {detail?.contacts.length>0&&<section className="living-contract-panel"><header><div><small>{ar?'جهات التواصل':'CONTRACT CONTACTS'}</small><h3>{ar?'من المسؤول عن العقد؟':'Who owns the relationship?'}</h3></div><UsersRound/></header><div className="contract-contact-grid">{detail.contacts.map(c=><article key={c.id}><span>{c.name?.slice(0,1)}</span><div><strong>{c.name}</strong><small>{ar?(c.role_ar||c.side):(c.role_en||c.role_ar||c.side)}</small>{c.email&&<a href={`mailto:${c.email}`}>{c.email}</a>}</div><em>{c.side==='balqees'?(ar?'بلقيس':'Balqees'):(ar?'المنشأة':'Organization')}</em></article>)}</div></section>}
      </div>}

      {tab==='coverage'&&<div className="living-contract-section-stack">
        <section className="living-contract-panel contract-coverage-checker"><header><div><small>{ar?'فاحص التغطية':'COVERAGE CHECKER'}</small><h3>{ar?'هل هذه الخدمة مشمولة؟':'Is this service covered?'}</h3><p>{ar?'البحث يعتمد على التغطية المهيكلة التي أدخلها فريق بلقيس، وليس تفسيرًا آليًا للنص القانوني.':'Search uses structured coverage entered by Balqees, not automated legal interpretation.'}</p></div><ShieldCheck/></header><div className="coverage-search"><Search/><input value={coverageQuery} onChange={e=>setCoverageQuery(e.target.value)} placeholder={ar?'مثال: صيانة النباتات، تنسيق موسمي، توريد زهور…':'Example: plant maintenance, seasonal styling, flower supply…'}/></div>{coverageQuery.trim()?(matchedServices.length?<div className="coverage-search-results">{matchedServices.map(s=><article key={s.id} className={s.coverage_status}><header><strong>{ar?s.title_ar:(s.title_en||s.title_ar)}</strong><span>{coverageLabels[lang][s.coverage_status]||s.coverage_status}</span></header><p>{ar?(s.summary_ar||s.conditions_ar||''):(s.summary_en||s.summary_ar||s.conditions_en||s.conditions_ar||'')}</p>{(ar?s.conditions_ar:s.conditions_en||s.conditions_ar)&&<small>{ar?'الشروط: ':'Conditions: '}{ar?s.conditions_ar:(s.conditions_en||s.conditions_ar)}</small>}</article>)}</div>:<div className="coverage-unclear"><HelpCircle/><div><strong>{ar?'غير واضح من التغطية المهيكلة الحالية':'Not clear from the current structured coverage'}</strong><p>{ar?'هذا لا يعني أن الخدمة مستبعدة؛ تحتاج النقطة مراجعة بشرية مع فريق بلقيس أو الرجوع للنص التعاقدي الرسمي.':'This does not mean the service is excluded. The point needs human review or reference to the official contract text.'}</p>{permissions.createSupportCases&&<button className="client-secondary" onClick={()=>navigate(`/portal/support?contract=${selected.id}&topic=coverage&q=${encodeURIComponent(coverageQuery)}`)}><MessageSquareText/>{ar?'اسأل فريق العناية':'Ask the care team'}</button>}</div></div>):<div className="coverage-hint"><Search/><span>{ar?'اكتب اسم الخدمة أو نوعها لبحث التغطية المهيكلة.':'Type a service name or type to search structured coverage.'}</span></div>}</section>

        <section className="living-contract-panel"><header><div><small>{ar?'الخدمات':'SERVICE SCOPE'}</small><h3>{ar?'نطاق الخدمات المنظم':'Structured service scope'}</h3></div><BadgeCheck/></header><div className="contract-service-grid">{detail?.services.length?detail.services.map(s=><article key={s.id} className={`service-coverage-card ${s.coverage_status}`}><header><span><ShieldCheck/></span><em>{coverageLabels[lang][s.coverage_status]||s.coverage_status}</em></header><h4>{ar?s.title_ar:(s.title_en||s.title_ar)}</h4><p>{ar?(s.summary_ar||''):(s.summary_en||s.summary_ar||'')}</p>{(ar?s.conditions_ar:s.conditions_en||s.conditions_ar)&&<small>{ar?s.conditions_ar:(s.conditions_en||s.conditions_ar)}</small>}</article>):<div className="client-empty-soft"><ShieldCheck/><strong>{ar?'لا توجد خدمات منظمة بعد':'No structured services yet'}</strong></div>}</div></section>

        <section className="living-contract-panel"><header><div><small>{ar?'المواقع':'SITE COVERAGE'}</small><h3>{ar?'تغطية المواقع والفروع':'Site & branch coverage'}</h3></div><Building2/></header><div className="contract-site-grid">{detail?.sites.length?detail.sites.map(s=><article key={s.id} className={s.coverage_status}><header><MapPin/><span>{coverageLabels[lang][s.coverage_status]||s.coverage_status}</span></header><h4>{ar?(s.organization_sites?.name_ar||'—'):(s.organization_sites?.name_en||s.organization_sites?.name_ar||'—')}</h4><p>{ar?(s.notes_ar||''):(s.notes_en||s.notes_ar||'')}</p></article>):<div className="client-empty-soft"><MapPin/><strong>{ar?'لا توجد مواقع مرتبطة':'No linked sites'}</strong></div>}</div></section>
      </div>}

      {tab==='activity'&&<div className="living-contract-section-stack">
        <section className="living-contract-panel"><header><div><small>{ar?'الخريطة السنوية':'ANNUAL MAP'}</small><h3>{ar?'نبض العقد خلال السنة':'Contract pulse across the year'}</h3></div><History/></header><div className="contract-year-map">{monthActivity.map(m=><div key={m.month} className={m.count?'has-activity':''}><span>{new Intl.DateTimeFormat(ar?'ar-SA':'en',{month:'short'}).format(new Date(2026,m.month,1))}</span><i>{m.count||''}</i></div>)}</div></section>

        <section className="living-contract-two-col"><article className="living-contract-panel"><header><div><small>{ar?'العمليات المرتبطة':'LINKED OPERATIONS'}</small><h3>{ar?'الطلبات وطلبات الخدمة':'Orders & service requests'}</h3></div><FileClock/></header><div className="contract-operation-list">{detail?.orders.slice(0,8).map(o=><button key={o.id} onClick={()=>navigate(`/portal/orders/${o.id}`)}><div><strong>{orderReference(o)}</strong><small>{orderLabels[lang][o.status]||o.status}</small></div><span>{fmtDate(o.created_at,lang)}</span></button>)}{detail?.requests.slice(0,8).map(r=><button key={r.id} onClick={()=>navigate(`/portal/request/${r.id}`)}><div><strong>{r.request_code}</strong><small>{r.status}</small></div><span>{fmtDate(r.submitted_at||r.created_at,lang)}</span></button>)}{!detail?.orders.length&&!detail?.requests.length&&<div className="client-empty-soft"><FileClock/><strong>{ar?'لا توجد عمليات مرتبطة حتى الآن':'No linked operations yet'}</strong></div>}</div></article>
          <article className="living-contract-panel"><header><div><small>{ar?'التزامات الطرفين':'OBLIGATIONS'}</small><h3>{ar?'ما على بلقيس وما على المنشأة':'Balqees & organization commitments'}</h3></div><Handshake/></header><div className="contract-obligation-list">{detail?.obligations.length?detail.obligations.map(o=>{const isOver=o.status==='overdue'||(o.status==='upcoming'&&o.due_on&&daysUntil(o.due_on)<0);return <article key={o.id} className={isOver?'overdue':''}><span>{o.owner_type==='balqees'?(ar?'بلقيس':'Balqees'):(ar?'المنشأة':'Organization')}</span><div><strong>{ar?o.title_ar:(o.title_en||o.title_ar)}</strong><small>{fmtDate(o.due_on,lang)} · {isOver?(ar?'متأخر':'Overdue'):(obligationLabels[lang][o.status]||o.status)}</small></div></article>}):<div className="client-empty-soft"><CheckCircle2/><strong>{ar?'لا توجد التزامات منشورة':'No published obligations'}</strong></div>}</div></article></section>

        <section className="living-contract-panel"><header><div><small>{ar?'السجل':'CONTRACT TIMELINE'}</small><h3>{ar?'تاريخ العقد':'Contract history'}</h3></div><History/></header><div className="contract-timeline">{detail?.events.length?detail.events.map(e=><article key={e.id}><i/><div><time>{fmtDate(e.created_at,lang,true)}</time><strong>{ar?e.title_ar:(e.title_en||e.title_ar)}</strong>{(ar?e.body_ar:e.body_en||e.body_ar)&&<p>{ar?e.body_ar:(e.body_en||e.body_ar)}</p>}</div></article>):<div className="client-empty-soft"><History/><strong>{ar?'لا توجد أحداث مسجلة':'No recorded events'}</strong></div>}</div></section>
      </div>}

      {tab==='documents'&&<div className="living-contract-section-stack">
        <section className="living-contract-panel"><header><div><small>{ar?'المستند الرسمي':'OFFICIAL CONTRACT'}</small><h3>{ar?'نسخة العقد المعتمدة':'Approved contract copy'}</h3></div><FileCheck2/></header>{selected.document_path?<button className="contract-document-hero" onClick={()=>openPrivateDocument(selected.document_path)}><span><FileCheck2/></span><div><strong>{ar?selected.title_ar:(selected.title_en||selected.title_ar)}</strong><small>{selected.contract_number} · {fmtDate(selected.starts_on,lang)} — {fmtDate(selected.ends_on,lang)}</small></div><Download/></button>:<div className="client-empty-soft"><FileText/><strong>{ar?'لم تُرفع نسخة رسمية بعد':'No official copy uploaded yet'}</strong></div>}</section>
        <section className="living-contract-panel"><header><div><small>{ar?'الملاحق':'ADDENDA'}</small><h3>{ar?'الملاحق والتعديلات المنشورة':'Published amendments'}</h3></div><FileText/></header><div className="contract-amendment-list">{detail?.amendments.length?detail.amendments.map(a=><article key={a.id}><span><FileText/></span><div><strong>{a.amendment_number} · {ar?a.title_ar:(a.title_en||a.title_ar)}</strong><small>{fmtDate(a.effective_on,lang)} · {a.status}</small><p>{ar?(a.summary_ar||''):(a.summary_en||a.summary_ar||'')}</p></div>{a.document_path&&<button className="client-secondary small" onClick={()=>openPrivateDocument(a.document_path)}><Download/>{ar?'فتح':'Open'}</button>}</article>):<div className="client-empty-soft"><FileText/><strong>{ar?'لا توجد ملاحق منشورة':'No published amendments'}</strong></div>}</div></section>
        {permissions.viewFinance&&<section className="living-contract-panel"><header><div><small>{ar?'المستندات المالية':'FINANCIAL DOCUMENTS'}</small><h3>{ar?'المستندات المرتبطة بالعقد':'Documents linked to this contract'}</h3></div><CircleDollarSign/></header><div className="contract-amendment-list">{detail?.documents.length?detail.documents.map(d=><article key={d.id}><span><FileText/></span><div><strong>{ar?d.title_ar:(d.title_en||d.title_ar)}</strong><small>{d.document_number||'—'} · {fmtDate(d.issue_date||d.created_at,lang)}</small></div><b>{d.total_amount==null?'—':sar(d.total_amount,lang)}</b><button className="client-secondary small" onClick={async()=>{const{data}=await supabase.storage.from('client-documents').createSignedUrl(d.file_path,90);if(data?.signedUrl)window.open(data.signedUrl,'_blank','noopener,noreferrer')}}><Download/>{ar?'فتح':'Open'}</button></article>):<div className="client-empty-soft"><FileText/><strong>{ar?'لا توجد مستندات مالية مرتبطة':'No linked financial documents'}</strong></div>}</div></section>}
      </div>}
    </div>;
  }

  const activeCount=rows.filter(c=>['active','expiring'].includes(derivedStatus(c))).length;
  const expiringCount=rows.filter(c=>derivedStatus(c)==='expiring').length;
  const attentionCount=rows.filter(c=>{
    const obs=overviewMeta.obligations.filter(o=>o.contract_id===c.id);
    return obs.some(o=>o.status==='overdue'||(o.status==='upcoming'&&o.due_on&&daysUntil(o.due_on)<0));
  }).length;

  return <div className="client-page living-contract-list-page">
    <header className="client-page-head"><div><span><FileCheck2/>{ar?'مركز العقود الحي':'LIVING CONTRACT CENTER'}</span><h2>{ar?'العقود والشراكات':'Contracts & partnerships'}</h2><p>{ar?'التغطية، المدة، المواقع، الالتزامات والتجديد — وليس مجرد ملف PDF.':'Coverage, term, sites, obligations and renewal — not just a PDF file.'}</p></div><button className="client-secondary" onClick={load}><RefreshCw className={loading?'spin':''}/>{ar?'تحديث':'Refresh'}</button></header>
    <section className="contract-list-pulse"><div><small>{ar?'حالة العقود':'CONTRACT HEALTH'}</small><h3>{attentionCount?ar?`${attentionCount} عقد يحتاج متابعة`:`${attentionCount} contract(s) need attention`:ar?'عقود منشأتكم مستقرة':'Your contracts are stable'}</h3><p>{ar?`${activeCount} عقد نشط · ${expiringCount} قريب الانتهاء`:`${activeCount} active · ${expiringCount} nearing expiry`}</p></div><span className={attentionCount?'warn':'good'}>{attentionCount?<AlertTriangle/>:<ShieldCheck/>}</span></section>
    <div className="living-contract-card-grid">{rows.length?rows.map(c=>{const status=derivedStatus(c);const left=daysUntil(c.ends_on);const progress=contractProgress(c);const siteCount=overviewMeta.sites.filter(x=>x.contract_id===c.id&&x.coverage_status!=='excluded').length;const obs=overviewMeta.obligations.filter(o=>o.contract_id===c.id);const overdue=obs.filter(o=>o.status==='overdue'||(o.status==='upcoming'&&o.due_on&&daysUntil(o.due_on)<0)).length;const financial=financialMap[c.id];const Arrow=ar?ArrowLeft:ArrowRight;return <button key={c.id} className="living-contract-card" onClick={()=>navigate(`/portal/contracts/${c.id}`)}><header><div className="mini-contract-ring" style={{'--contract-progress':`${progress*3.6}deg`}}><span>{progress}%</span></div><div><small>{c.contract_number}</small><h3>{ar?c.title_ar:(c.title_en||c.title_ar)}</h3></div><em className={`client-status ${statusTone(status)}`}>{contractLabels[lang][status]||status}</em></header><div className="contract-card-health"><span className={overdue?'danger':status==='expiring'?'warn':'good'}>{overdue?<AlertTriangle/>:<ShieldCheck/>}</span><div><strong>{overdue?(ar?'يحتاج متابعة':'Needs attention'):status==='expiring'?(ar?'مراجعة التجديد قريبة':'Renewal review approaching'):(ar?'مستقر':'Stable')}</strong><small>{left===null?'—':left>=0?(ar?`${left} يوم متبقي`:`${left} days left`):(ar?'انتهت المدة':'Term ended')}</small></div></div><div className="contract-card-meta"><span><MapPin/><b>{siteCount}</b><small>{ar?'مواقع':'sites'}</small></span><span><CalendarClock/><b>{obs.filter(o=>o.status==='upcoming').length}</b><small>{ar?'التزامات':'obligations'}</small></span>{permissions.viewFinance&&<span><CircleDollarSign/><b>{financial?.contract_value==null?'—':sar(financial.contract_value,lang)}</b><small>{ar?'القيمة':'value'}</small></span>}</div><footer><span>{fmtDate(c.starts_on,lang)} — {fmtDate(c.ends_on,lang)}</span><Arrow/></footer></button>}):<div className="client-empty-large"><FileCheck2/><h3>{ar?'لا توجد عقود منشورة':'No published contracts'}</h3><p>{ar?'العقود المعتمدة التي تربط منشأتك ببلقيس ستظهر هنا بعد نشرها من الإدارة.':'Approved contracts between your organization and Balqees will appear here after publication.'}</p></div>}</div>
  </div>;
}
