import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight, BadgeCheck, CalendarDays, Check, ChevronLeft, CircleAlert, Clock3,
  FileClock, FileText, History, LoaderCircle, MapPin, MessageSquareText, RefreshCw,
  RotateCcw, Search, Send, ShieldCheck, Sparkles, TrendingDown, TrendingUp, X
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useClientPortal } from '../ClientPortalContext';
import { daysUntil, fmtDate, openPrivateDocument, quoteLabels, sar, statusTone } from '../portalUtils';
import '../quotation-decision-room.css';

const ACTIONABLE = new Set(['sent','viewed']);
const FILTERS = ['action','revision','accepted','expired','all'];

function qref(q){ return `Q-${String(q?.quote_number || 0).padStart(5,'0')}`; }
function versionLabel(q){ return `V${Number(q?.version_number || 1)}`; }
function localName(row, ar, fallback='—'){ return row ? (ar ? (row.name_ar || row.title_ar || fallback) : (row.name_en || row.title_en || row.name_ar || row.title_ar || fallback)) : fallback; }
function expired(q){ return Boolean(q?.valid_until && daysUntil(q.valid_until) < 0 && !['accepted','declined','cancelled'].includes(q.status)); }

function buildDiff(current, previous){
  if(!current || !previous) return null;
  const now = new Map((current.quotation_items || []).map(i => [i.line_key || i.id, i]));
  const old = new Map((previous.quotation_items || []).map(i => [i.line_key || i.id, i]));
  const added=[]; const removed=[]; const changed=[];
  for(const [key,item] of now){
    if(!old.has(key)){ added.push(item); continue; }
    const before=old.get(key); const fields=[];
    if(Number(item.quantity)!==Number(before.quantity)) fields.push({field:'quantity',before:Number(before.quantity),after:Number(item.quantity)});
    if(Number(item.unit_price)!==Number(before.unit_price)) fields.push({field:'price',before:Number(before.unit_price),after:Number(item.unit_price)});
    if(Number(item.discount)!==Number(before.discount)) fields.push({field:'discount',before:Number(before.discount),after:Number(item.discount)});
    if((item.description_ar||'')!==(before.description_ar||'')) fields.push({field:'description',before:before.description_ar,after:item.description_ar});
    if(fields.length) changed.push({item,before,fields});
  }
  for(const [key,item] of old){ if(!now.has(key)) removed.push(item); }
  return {added,removed,changed,valueDelta:Number(current.total||0)-Number(previous.total||0)};
}

function statusCopy(q, ar){
  if(expired(q)) return ar ? 'انتهت صلاحية هذا الإصدار' : 'This version has expired';
  if(q.status==='sent' || q.status==='viewed') return ar ? 'ينتظر قرار المنشأة' : 'Awaiting organization decision';
  if(q.status==='revision_requested') return ar ? 'التعديل لدى بلقيس' : 'Revision with Balqees';
  if(q.status==='accepted') return ar ? 'تم اعتماد هذا الإصدار' : 'This version is approved';
  if(q.status==='declined') return ar ? 'تم رفض هذا الإصدار' : 'This version was declined';
  if(q.status==='cancelled') return ar ? 'تم إلغاء هذا الإصدار' : 'This version was cancelled';
  return ar ? 'عرض سعر' : 'Quotation';
}

export default function ClientQuotes(){
  const {lang,organization,permissions,membership,securityAccess,portalSettings}=useClientPortal();
  const ar=lang==='ar'; const navigate=useNavigate(); const {id:routeQuoteId}=useParams();
  const canSeeMoney=Boolean(permissions.canSeePrices);
  const financeDisplay=portalSettings?.organization_settings||{};
  const displayedQuoteAmount=(q)=>financeDisplay.finance_amount_mode==='before_tax'?Math.max(0,Number(q?.total||0)-Number(q?.vat_total||0)):Number(q?.total||0);
  const showVatSeparately=financeDisplay.show_vat_separately!==false;
  const [data,setData]=useState({quotes:[],events:[],sites:[],requests:[]});
  const [loading,setLoading]=useState(true); const[message,setMessage]=useState('');
  const [filter,setFilter]=useState('action'); const[query,setQuery]=useState('');
  const [selectedId,setSelectedId]=useState(null); const[decision,setDecision]=useState(null);
  const [note,setNote]=useState(''); const[busy,setBusy]=useState(false);

  async function load({quiet=false}={}){
    if(!organization?.id)return; if(!quiet)setLoading(true); setMessage('');
    const orgId=organization.id;
    const [quotes,events,sites,requests]=await Promise.all([
      supabase.from('quotations').select('*,quotation_items(*)').eq('organization_id',orgId).neq('status','draft').order('created_at',{ascending:false}).limit(200),
      supabase.from('quotation_events').select('*').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(500),
      supabase.from('organization_sites').select('id,name_ar,name_en,address,site_type').eq('organization_id',orgId),
      supabase.from('organization_service_requests').select('id,request_code,status,service_type,site_id,description,created_at').eq('organization_id',orgId).neq('status','draft').order('created_at',{ascending:false}).limit(150),
    ]);
    const err=quotes.error||events.error||sites.error||requests.error;
    if(err)setMessage(ar?'تعذر تحميل جزء من بيانات عروض الأسعار.':'Some quotation data could not be loaded.');
    setData({quotes:quotes.data||[],events:events.data||[],sites:sites.data||[],requests:requests.data||[]});
    if(!quiet)setLoading(false);
  }

  useEffect(()=>{load();},[organization?.id]);
  useEffect(()=>{
    if(!organization?.id||!supabase)return undefined;
    const ch=supabase.channel(`decision-room-${organization.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'quotations',filter:`organization_id=eq.${organization.id}`},()=>load({quiet:true}))
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'quotation_events',filter:`organization_id=eq.${organization.id}`},()=>load({quiet:true}))
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[organization?.id]);

  const siteMap=useMemo(()=>Object.fromEntries(data.sites.map(s=>[s.id,s])),[data.sites]);
  const requestMap=useMemo(()=>Object.fromEntries(data.requests.map(r=>[r.id,r])),[data.requests]);
  const eventsByQuote=useMemo(()=>{const m={};data.events.forEach(e=>(m[e.quotation_id]||=[]).push(e));return m;},[data.events]);
  const series=useMemo(()=>{
    const m={}; data.quotes.forEach(q=>(m[q.series_id]||=[]).push({...q,_events:eventsByQuote[q.id]||[]}));
    return Object.values(m).map(list=>{
      const versions=[...list].sort((a,b)=>Number(b.version_number)-Number(a.version_number));
      const current=versions.find(q=>q.is_current)||versions[0];
      return {seriesId:current.series_id,current,versions};
    }).sort((a,b)=>new Date(b.current.updated_at||b.current.created_at)-new Date(a.current.updated_at||a.current.created_at));
  },[data.quotes,eventsByQuote]);

  const selectedGroup=useMemo(()=>{
    const target=selectedId||routeQuoteId;
    if(target){const found=series.find(g=>g.versions.some(v=>v.id===target));if(found)return found;}
    return series[0]||null;
  },[series,selectedId,routeQuoteId]);
  const selectedVersion=useMemo(()=>{
    if(!selectedGroup)return null; const target=selectedId||routeQuoteId;
    return selectedGroup.versions.find(v=>v.id===target)||selectedGroup.current;
  },[selectedGroup,selectedId,routeQuoteId]);
  const previousVersion=useMemo(()=>selectedGroup&&selectedVersion?selectedGroup.versions.find(v=>Number(v.version_number)===Number(selectedVersion.version_number)-1)||null:null,[selectedGroup,selectedVersion]);
  const diff=useMemo(()=>buildDiff(selectedVersion,previousVersion),[selectedVersion,previousVersion]);

  useEffect(()=>{
    if(!selectedVersion)return;
    if(selectedVersion.status==='sent') supabase.rpc('mark_quotation_viewed',{p_quote_id:selectedVersion.id}).then(()=>load({quiet:true}));
  },[selectedVersion?.id]);

  const actionCount=useMemo(()=>permissions.acceptQuotes&&(!securityAccess?.mfa_required||securityAccess?.aal2)?series.filter(g=>ACTIONABLE.has(g.current.status)&&!expired(g.current)&&(membership?.approval_limit==null||Number(g.current.total||0)<=Number(membership.approval_limit))).length:0,[series,permissions.acceptQuotes,membership?.approval_limit,securityAccess?.mfa_required,securityAccess?.aal2]);
  const filtered=useMemo(()=>series.filter(g=>{
    const q=g.current; const text=query.trim().toLowerCase();
    if(filter==='action'&&(!permissions.acceptQuotes||securityAccess?.mfa_required&&!securityAccess?.aal2||membership?.approval_limit!=null&&Number(q.total||0)>Number(membership.approval_limit)||!(ACTIONABLE.has(q.status)&&!expired(q))))return false;
    if(filter==='revision'&&q.status!=='revision_requested')return false;
    if(filter==='accepted'&&q.status!=='accepted')return false;
    if(filter==='expired'&&!expired(q)&&q.status!=='expired')return false;
    if(text){
      const site=siteMap[q.site_id]; const req=requestMap[q.service_request_id];
      const hay=[qref(q),q.title_ar,q.title_en,localName(site,ar,''),req?.request_code].filter(Boolean).join(' ').toLowerCase();
      if(!hay.includes(text))return false;
    }
    return true;
  }),[series,filter,query,siteMap,requestMap,ar]);

  function openQuote(q){setSelectedId(q.id);navigate(`/portal/quotes/${q.id}`);}
  async function respond(type){
    if(!selectedVersion)return; setBusy(true); setMessage('');
    const{error}=await supabase.rpc('respond_to_quotation',{p_quote_id:selectedVersion.id,p_action:type,p_note:note.trim()||null});
    if(error){
      const map={QUOTE_EXPIRED:ar?'انتهت صلاحية العرض ولا يمكن اعتماده.':'This quotation has expired.',QUOTE_NOT_CURRENT:ar?'هذا إصدار قديم ولا يمكن اتخاذ قرار عليه.':'This is an old version.',QUOTE_NOTE_REQUIRED:ar?'أضف سبب التعديل أو الرفض.':'Add a reason for revision or decline.',APPROVAL_LIMIT_EXCEEDED:ar?'قيمة العرض تتجاوز حد اعتمادك المسجل.':'This quotation exceeds your recorded approval limit.',MFA_AAL2_REQUIRED:ar?'تتطلب سياسة المنشأة تحقق MFA قبل الاعتماد.':'Organization policy requires MFA before approval.',QUOTATION_APPROVAL_PERMISSION_DENIED:ar?'صلاحيتك أو نطاق الموقع لا يسمحان باعتماد هذا العرض.':'Your permission or site scope does not allow approval.'};
      setMessage(map[error.message]||(ar?'تعذر تنفيذ القرار. تحقق من صلاحيتك وحالة العرض.':'Could not complete this decision.'));
    }else{setDecision(null);setNote('');await load({quiet:true});}
    setBusy(false);
  }

  useEffect(()=>{if(filter==='action'&&actionCount===0)setFilter('all');},[actionCount]);

  const currentSite=selectedVersion?siteMap[selectedVersion.site_id]:null;
  const currentRequest=selectedVersion?requestMap[selectedVersion.service_request_id]:null;
  const validDays=selectedVersion?.valid_until?daysUntil(selectedVersion.valid_until):null;
  const approvalWithinLimit=Boolean(!selectedVersion||membership?.approval_limit==null||Number(selectedVersion.total||0)<=Number(membership.approval_limit));
  const approvalMfaReady=Boolean(!securityAccess?.mfa_required||securityAccess?.aal2);
  const actionable=Boolean(selectedVersion&&selectedVersion.is_current&&ACTIONABLE.has(selectedVersion.status)&&!expired(selectedVersion)&&permissions.acceptQuotes&&approvalWithinLimit&&approvalMfaReady);

  return <div className="client-page quotation-room">
    <header className="quote-room-head"><div><span><Sparkles/>{ar?'غرفة القرار التجاري':'COMMERCIAL DECISION ROOM'}</span><h2>{ar?'عروض الأسعار':'Quotations'}</h2><p>{ar?'راجع العروض واتخذ القرار.' : 'Review quotations and decide.'}</p></div><button className="client-secondary" onClick={()=>load()}><RefreshCw className={loading?'spin':''}/>{ar?'تحديث':'Refresh'}</button></header>

    {actionCount>0?<section className="quote-attention"><CircleAlert/><div><small>{ar?'يحتاج قرارك':'NEEDS YOUR DECISION'}</small><strong>{ar?`${actionCount} ${actionCount===1?'عرض ينتظر اعتمادك':'عروض تنتظر اعتمادك'}`:`${actionCount} quotation${actionCount>1?'s':''} awaiting decision`}</strong></div></section>:<section className="quote-attention clear"><BadgeCheck/><div><small>{ar?'الوضع الآن':'CURRENT STATUS'}</small><strong>{ar?'لا توجد عروض متوقفة عليك':'No quotation is blocked on you'}</strong></div></section>}
    {message&&<div className="client-inline-error">{message}</div>}

    <div className="quote-room-toolbar"><div className="quote-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'ابحث برقم العرض أو الموقع أو الطلب…':'Search by quotation, site or request…'}/></div><div className="quote-filters">{FILTERS.map(f=><button key={f} className={filter===f?'active':''} onClick={()=>setFilter(f)}>{ar?({action:'ينتظر قراري',revision:'طلبت تعديلًا',accepted:'معتمد',expired:'منتهي',all:'الكل'}[f]):({action:'Needs action',revision:'Revision',accepted:'Accepted',expired:'Expired',all:'All'}[f])}</button>)}</div></div>

    <div className="quote-room-layout">
      <aside className="quote-series-list">{filtered.length?filtered.map(g=>{const q=g.current;const site=siteMap[q.site_id];const req=requestMap[q.service_request_id];const delta=g.versions[1]?Number(q.total||0)-Number(g.versions[1].total||0):0;return <button key={g.seriesId} className={selectedGroup?.seriesId===g.seriesId?'active':''} onClick={()=>openQuote(q)}><header><span className={`quote-status ${statusTone(expired(q)?'expired':q.status)}`}>{expired(q)?(ar?'منتهي':'Expired'):(quoteLabels[lang][q.status]||q.status)}</span><em>{versionLabel(q)}</em></header><strong>{ar?q.title_ar:(q.title_en||q.title_ar)}</strong><small>{qref(q)}{site?` · ${localName(site,ar)}`:''}</small>{req&&<small>{req.request_code}</small>}<footer>{canSeeMoney?<b>{sar(displayedQuoteAmount(q),lang)}</b>:<b>{ar?'قيمة محمية':'Protected value'}</b>}{g.versions.length>1&&<span className={delta>0?'up':delta<0?'down':''}>{delta>0?<TrendingUp/>:delta<0?<TrendingDown/>:<ArrowLeftRight/>}{ar?`${g.versions.length} إصدارات`:`${g.versions.length} versions`}</span>}</footer></button>}):<div className="quote-list-empty"><FileText/><strong>{ar?'لا توجد عروض ضمن هذا التصنيف':'No quotations in this view'}</strong></div>}</aside>

      <main className="quote-decision-panel">{selectedVersion?<>
        <section className="quote-executive"><div><div className="quote-title-row"><span className={`quote-status ${statusTone(expired(selectedVersion)?'expired':selectedVersion.status)}`}>{expired(selectedVersion)?(ar?'منتهي':'Expired'):(quoteLabels[lang][selectedVersion.status]||selectedVersion.status)}</span><em>{versionLabel(selectedVersion)}</em>{!selectedVersion.is_current&&<em className="old">{ar?'إصدار سابق':'Older version'}</em>}</div><h3>{ar?selectedVersion.title_ar:(selectedVersion.title_en||selectedVersion.title_ar)}</h3><p>{statusCopy(selectedVersion,ar)}</p></div>{canSeeMoney&&<div className="quote-main-value"><small>{ar?'الإجمالي':'TOTAL'}</small><strong>{sar(displayedQuoteAmount(selectedVersion),lang)}</strong><span>{selectedVersion.prices_include_vat?(ar?'شامل الضريبة':'VAT included'):(ar?'قبل الضريبة':'VAT added separately')}</span></div>}</section>

        <section className="quote-fact-grid"><div><MapPin/><span><small>{ar?'الموقع':'Site'}</small><strong>{localName(currentSite,ar,ar?'غير محدد':'Not assigned')}</strong></span></div><div><CalendarDays/><span><small>{ar?'صالح حتى':'Valid until'}</small><strong>{fmtDate(selectedVersion.valid_until,lang)}</strong>{validDays!==null&&<em>{validDays<0?(ar?'انتهت الصلاحية':'Expired'):validDays===0?(ar?'آخر يوم':'Last day'):(ar?`${validDays} يوم متبقٍ`:`${validDays} days left`)}</em>}</span></div><div><FileClock/><span><small>{ar?'الطلب المرتبط':'Linked request'}</small><strong>{currentRequest?.request_code||'—'}</strong></span></div><div><ShieldCheck/><span><small>{ar?'صلاحية القرار':'Decision access'}</small><strong>{permissions.acceptQuotes?(membership?.approval_limit!=null?(ar?`مخول حتى ${sar(membership.approval_limit,lang)}`:`Authorized up to ${sar(membership.approval_limit,lang)}`):(ar?'مخول بدون حد مسجل':'Authorized · no recorded limit')):(ar?'عرض فقط':'View only')}</strong>{permissions.acceptQuotes&&securityAccess?.mfa_required&&!securityAccess?.aal2&&<em>{ar?'يلزم MFA قبل الاعتماد':'MFA required before approval'}</em>}</span></div></section>

        {selectedGroup.versions.length>1&&<section className="quote-version-strip"><div><small>{ar?'إصدارات العرض':'VERSION HISTORY'}</small><strong>{ar?'اختر إصدارًا للمراجعة':'Choose a version to inspect'}</strong></div><div>{[...selectedGroup.versions].sort((a,b)=>a.version_number-b.version_number).map(v=><button key={v.id} className={v.id===selectedVersion.id?'active':''} onClick={()=>openQuote(v)}>{versionLabel(v)}<small>{fmtDate(v.sent_at||v.created_at,lang)}</small></button>)}</div></section>}

        {diff&&<section className="quote-change-card"><header><div><small>{ar?'ما الذي تغير؟':'WHAT CHANGED'}</small><h4>{ar?`مقارنة ${versionLabel(previousVersion)} ← ${versionLabel(selectedVersion)}`:`Compare ${versionLabel(previousVersion)} → ${versionLabel(selectedVersion)}`}</h4></div>{canSeeMoney&&<span className={diff.valueDelta>0?'up':diff.valueDelta<0?'down':''}>{diff.valueDelta>0?'+':''}{sar(diff.valueDelta,lang)}</span>}</header><div className="quote-change-summary"><span><b>{diff.added.length}</b><small>{ar?'مضاف':'Added'}</small></span><span><b>{diff.changed.length}</b><small>{ar?'معدل':'Changed'}</small></span><span><b>{diff.removed.length}</b><small>{ar?'محذوف':'Removed'}</small></span></div>{(diff.added.length||diff.changed.length||diff.removed.length)?<div className="quote-change-lines">{diff.added.map(i=><p key={`a-${i.id}`} className="added">+ {ar?i.description_ar:(i.description_en||i.description_ar)}</p>)}{diff.changed.map(c=><p key={`c-${c.item.id}`} className="changed">↻ {ar?c.item.description_ar:(c.item.description_en||c.item.description_ar)} · {c.fields.map(f=>f.field==='quantity'?(ar?'الكمية':'qty'):f.field==='price'?(ar?'السعر':'price'):f.field==='discount'?(ar?'الخصم':'discount'):(ar?'الوصف':'description')).join('، ')}</p>)}{diff.removed.map(i=><p key={`r-${i.id}`} className="removed">− {ar?i.description_ar:(i.description_en||i.description_ar)}</p>)}</div>:<p className="quote-no-change">{ar?'لا توجد فروقات في البنود عن الإصدار السابق.':'No line-item differences from the previous version.'}</p>}</section>}

        <section className="quote-items-card"><header><div><small>{ar?'بنود العرض':'QUOTATION ITEMS'}</small><h4>{ar?'التفاصيل التجارية':'Commercial details'}</h4></div><b>{selectedVersion.quotation_items?.length||0}</b></header><div className="quote-items-table"><div className="head"><span>{ar?'البند':'Item'}</span><span>{ar?'الكمية':'Qty'}</span>{canSeeMoney&&<><span>{ar?'سعر الوحدة':'Unit price'}</span><span>{ar?'الإجمالي':'Total'}</span></>}</div>{(selectedVersion.quotation_items||[]).sort((a,b)=>a.sort_order-b.sort_order).map(i=><div key={i.id}><span><strong>{ar?i.description_ar:(i.description_en||i.description_ar)}</strong><small>{ar?(i.unit_ar||''):(i.unit_en||i.unit_ar||'')}</small>{permissions.createSupportCases&&<button onClick={()=>navigate(`/portal/support?quote=${selectedVersion.id}&line=${i.line_key}`)}><MessageSquareText/>{ar?'اسأل عن هذا البند':'Ask about this item'}</button>}</span><span>{Number(i.quantity)}</span>{canSeeMoney&&<><span>{sar(i.unit_price,lang)}</span><span>{sar(i.line_total,lang)}</span></>}</div>)}</div>{canSeeMoney&&<div className="quote-total-stack"><span><small>{ar?'قبل الخصم':'Subtotal'}</small><b>{sar(selectedVersion.subtotal,lang)}</b></span>{Number(selectedVersion.discount_total)>0&&<span><small>{ar?'الخصم':'Discount'}</small><b>- {sar(selectedVersion.discount_total,lang)}</b></span>}{showVatSeparately&&<span><small>{ar?'الضريبة':'VAT'}</small><b>{sar(selectedVersion.vat_total,lang)}</b></span>}<span className="total"><small>{ar?'الإجمالي النهائي':'Final total'}</small><b>{sar(displayedQuoteAmount(selectedVersion),lang)}</b></span></div>}</section>

        {(ar?selectedVersion.terms_ar:(selectedVersion.terms_en||selectedVersion.terms_ar))&&<section className="quote-terms"><small>{ar?'الشروط التجارية':'COMMERCIAL TERMS'}</small><p>{ar?selectedVersion.terms_ar:(selectedVersion.terms_en||selectedVersion.terms_ar)}</p></section>}

        <section className="quote-timeline"><header><div><small>{ar?'سجل القرار':'DECISION TIMELINE'}</small><h4>{ar?'ماذا حدث على هذا الإصدار؟':'What happened on this version?'}</h4></div></header><div>{(selectedVersion._events||[]).length?[...selectedVersion._events].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map((e,i)=><article key={e.id}><i className={i===0?'current':''}/><span><small>{fmtDate(e.created_at,lang,true)}</small><strong>{ar?e.title_ar:(e.title_en||e.title_ar)}</strong>{(ar?e.body_ar:(e.body_en||e.body_ar))&&<p>{ar?e.body_ar:(e.body_en||e.body_ar)}</p>}</span></article>):<p className="quote-no-change">{ar?'لا توجد أحداث مسجلة بعد.':'No events recorded yet.'}</p>}</div></section>

        <footer className="quote-decision-actions">{selectedVersion.document_path&&<button className="client-secondary" onClick={()=>openPrivateDocument(selectedVersion.document_path)}><FileText/>{ar?'المستند الرسمي':'Official PDF'}</button>}{permissions.createSupportCases&&<button className="client-secondary" onClick={()=>navigate(`/portal/support?quote=${selectedVersion.id}`)}><MessageSquareText/>{ar?'اسأل عناية بلقيس':'Ask Balqees Care'}</button>}{expired(selectedVersion)&&selectedVersion.is_current&&permissions.createSupportCases&&<button className="client-primary" onClick={()=>navigate(`/portal/support?quote=${selectedVersion.id}&topic=refresh`)}><RefreshCw/>{ar?'طلب تحديث العرض':'Request updated quote'}</button>}{actionable&&<button className="client-primary" onClick={()=>setDecision('open')}><Send/>{ar?'اتخاذ قرار':'Make decision'}</button>}{selectedVersion.is_current&&ACTIONABLE.has(selectedVersion.status)&&!permissions.acceptQuotes&&<span className="quote-permission-note">{ar?'يمكنك مراجعة العرض، لكن الاعتماد متاح للأعضاء المخولين فقط.':'You can review this quote, but only authorized approvers can decide.'}</span>}{selectedVersion.is_current&&ACTIONABLE.has(selectedVersion.status)&&permissions.acceptQuotes&&!approvalWithinLimit&&<span className="quote-permission-note">{ar?`قيمة العرض تتجاوز حد اعتمادك (${sar(membership.approval_limit,lang)}).`: `This quotation exceeds your approval limit (${sar(membership.approval_limit,lang)}).`}</span>}{selectedVersion.is_current&&ACTIONABLE.has(selectedVersion.status)&&permissions.acceptQuotes&&approvalWithinLimit&&!approvalMfaReady&&<span className="quote-permission-note">{ar?'تتطلب سياسة المنشأة تحقق MFA (AAL2) قبل الاعتماد.':'Organization policy requires MFA (AAL2) before approval.'}</span>}</footer>
      </>:<div className="quote-detail-empty"><FileText/><h3>{ar?'اختر عرض سعر':'Choose a quotation'}</h3><p>{ar?'ستظهر هنا المقارنة، البنود، القيمة وسجل القرار.':'Comparison, line items, value and decision history will appear here.'}</p></div>}</main>
    </div>

    {decision&&selectedVersion&&<div className="quote-decision-scrim" onMouseDown={e=>{if(e.target===e.currentTarget){setDecision(null);setNote('')}}}><section className="quote-decision-dialog"><button className="close" onClick={()=>{setDecision(null);setNote('')}}><X/></button><small>{qref(selectedVersion)} · {versionLabel(selectedVersion)}</small><h3>{ar?'اتخاذ قرار على عرض السعر':'Quotation decision'}</h3><p>{ar?'القرار يسجل باسم حسابك وعلى هذا الإصدار تحديدًا.':'Your decision is recorded against this exact version.'}</p><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder={ar?'أضف ملاحظة. السبب مطلوب عند طلب التعديل أو الرفض.':'Add a note. A reason is required for revision or decline.'}/><div><button disabled={busy} className="client-primary" onClick={()=>respond('accepted')}>{busy?<LoaderCircle className="spin"/>:<Check/>}{ar?'تأكيد الاعتماد':'Confirm approval'}</button><button disabled={busy||!note.trim()} className="client-secondary" onClick={()=>respond('revision_requested')}><RotateCcw/>{ar?'طلب تعديل':'Request revision'}</button><button disabled={busy||!note.trim()} className="client-danger" onClick={()=>respond('declined')}><X/>{ar?'رفض العرض':'Decline'}</button></div></section></div>}
  </div>;
}
