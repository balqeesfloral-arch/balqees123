import { useEffect, useMemo, useState } from 'react';
import {
  Building2, CalendarDays, CheckCircle2, CircleAlert, ClipboardPlus, FileText, Filter,
  ImageIcon, LoaderCircle, MapPinned, MoreHorizontal, PackageSearch, RefreshCw, Search,
  ShieldCheck, Sparkles, UserRound, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { dateTime, logAdminAction } from '../adminUtils';

const STATUS = {
  draft: ['مسودة', 'Draft'], submitted: ['تم الإرسال', 'Submitted'], under_review: ['قيد المراجعة', 'Under review'],
  needs_info: ['تحتاج معلومات', 'Needs information'], converted: ['تم تحويله', 'Converted'], cancelled: ['ملغي', 'Cancelled'],
};
const SERVICES = {
  supply: ['توريد زهور ونباتات', 'Flowers & plants supply'], vases: ['تجهيز فازات', 'Vase preparation'],
  space_design: ['تنسيق مساحة', 'Space styling'], maintenance: ['صيانة وعناية', 'Maintenance & care'],
  recurring: ['توريد دوري', 'Recurring supply'], custom: ['طلب مخصص', 'Custom request'],
};
const AREAS = {
  lobby:['اللوبي','Lobby'], reception:['الاستقبال','Reception'], entrance:['المدخل الرئيسي','Main entrance'],
  restaurant:['المطعم','Restaurant'], meeting:['قاعات الاجتماعات','Meeting rooms'], suites:['الأجنحة','Suites'],
  corridors:['الممرات','Corridors'], offices:['المكاتب','Offices'], garden:['الحديقة الخارجية','Outdoor garden'], custom:['منطقة أخرى','Other area'],
};

function pair(map,key,ar){ return map[key]?.[ar?0:1] || key || '—'; }
function requestWhen(row,ar){
  if(row.timing_mode==='exact') return row.requested_date || '—';
  if(row.timing_mode==='this_week') return ar?'هذا الأسبوع':'This week';
  return ar?'أقرب وقت':'Nearest';
}
function serviceDetailRows(row,ar){
  const d=row?.service_details||{};
  const yesNo=v=>v?(ar?'نعم':'Yes'):(ar?'لا':'No');
  if(['supply','vases'].includes(row?.service_type)) return [
    [ar?'الخامة / التفضيل':'Material preference', d.material_preference && d.material_preference!=='unspecified'?d.material_preference:'—'],
    [ar?'الكمية أو النطاق التقريبي':'Approximate quantity / scope', d.approximate_quantity||'—'],
  ];
  if(row?.service_type==='space_design') return [
    [ar?'المساحة التقريبية':'Approximate area', d.space_size||'—'],
    [ar?'الطابع المطلوب':'Preferred style', d.preferred_style||'—'],
  ];
  if(row?.service_type==='maintenance') return [
    [ar?'ما الذي يحتاج عناية؟':'Maintenance focus', d.maintenance_focus||'—'],
  ];
  if(row?.service_type==='recurring') return [
    [ar?'التكرار':'Frequency', ({weekly:ar?'أسبوعي':'Weekly',biweekly:ar?'كل أسبوعين':'Every two weeks',monthly:ar?'شهري':'Monthly',custom:ar?'مخصص':'Custom'})[d.frequency]||d.frequency||'—'],
    [ar?'المدة التقريبية':'Approx. duration', d.duration_months?`${d.duration_months} ${ar?'شهر':'month(s)'}`:'—'],
    [ar?'كمية ثابتة كل دورة':'Fixed quantity each cycle', yesNo(!!d.fixed_quantity)],
  ];
  return [];
}

export default function AdminServiceRequests({ lang }) {
  const ar=lang==='ar';
  const [rows,setRows]=useState([]); const [orgs,setOrgs]=useState({}); const [sites,setSites]=useState({}); const [profiles,setProfiles]=useState({}); const [contracts,setContracts]=useState([]);
  const [query,setQuery]=useState(''); const [status,setStatus]=useState('active'); const [service,setService]=useState('all');
  const [selected,setSelected]=useState(null); const [attachments,setAttachments]=useState([]); const [draftStatus,setDraftStatus]=useState('submitted'); const [draftContract,setDraftContract]=useState('');
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [message,setMessage]=useState('');

  async function load({quiet=false}={}){
    if(!quiet) setLoading(true); setMessage('');
    const {data,error}=await supabase.from('organization_service_requests').select('*').order('updated_at',{ascending:false}).limit(250);
    const list=data||[]; setRows(list);
    const orgIds=[...new Set(list.map(x=>x.organization_id).filter(Boolean))];
    const siteIds=[...new Set(list.map(x=>x.site_id).filter(Boolean))];
    const userIds=[...new Set(list.map(x=>x.created_by).filter(Boolean))];
    const [o,s,p,c]=await Promise.all([
      orgIds.length?supabase.from('organizations').select('id,display_name,legal_name').in('id',orgIds):Promise.resolve({data:[]}),
      siteIds.length?supabase.from('organization_sites').select('id,name_ar,name_en,site_type').in('id',siteIds):Promise.resolve({data:[]}),
      userIds.length?supabase.from('customer_profiles').select('id,full_name,email').in('id',userIds):Promise.resolve({data:[]}),
      orgIds.length?supabase.from('contracts').select('id,organization_id,contract_number,title_ar,status').in('organization_id',orgIds).neq('status','draft'):Promise.resolve({data:[]}),
    ]);
    setOrgs(Object.fromEntries((o.data||[]).map(x=>[x.id,x]))); setSites(Object.fromEntries((s.data||[]).map(x=>[x.id,x]))); setProfiles(Object.fromEntries((p.data||[]).map(x=>[x.id,x]))); setContracts(c.data||[]);
    if(error) setMessage(ar?'تعذر تحميل بعض طلبات المنشآت.':'Some organization requests could not be loaded.');
    if(!quiet) setLoading(false);
  }
  useEffect(()=>{load();},[]);
  useEffect(()=>{
    const channel=supabase.channel('admin-service-requests').on('postgres_changes',{event:'*',schema:'public',table:'organization_service_requests'},()=>load({quiet:true})).subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[]);

  const counts=useMemo(()=>({
    submitted:rows.filter(x=>x.status==='submitted').length,
    review:rows.filter(x=>x.status==='under_review').length,
    needs:rows.filter(x=>x.status==='needs_info').length,
    priority:rows.filter(x=>x.priority==='priority_review' && !['converted','cancelled'].includes(x.status)).length,
  }),[rows]);

  const filtered=useMemo(()=>rows.filter(r=>{
    if(status==='active' && ['draft','converted','cancelled'].includes(r.status)) return false;
    if(status!=='all' && status!=='active' && r.status!==status) return false;
    if(service!=='all' && r.service_type!==service) return false;
    if(!query.trim()) return true;
    const o=orgs[r.organization_id]||{}, s=sites[r.site_id]||{}, p=profiles[r.created_by]||{};
    return [r.request_code,o.display_name,o.legal_name,s.name_ar,s.name_en,p.full_name,p.email,r.procurement_details?.po_number,r.description].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase());
  }),[rows,status,service,query,orgs,sites,profiles]);

  async function openRequest(row){
    setSelected(row); setDraftStatus(row.status); setDraftContract(row.contract_id||''); setAttachments([]); setMessage('');
    const {data}=await supabase.from('organization_request_attachments').select('*').eq('request_id',row.id).order('created_at');
    const docs=await Promise.all((data||[]).map(async item=>{
      const {data:signed}=await supabase.storage.from('organization-request-files').createSignedUrl(item.storage_path,180);
      return {...item,url:signed?.signedUrl||''};
    }));
    setAttachments(docs);
  }

  async function saveStatus(){
    if(!selected || (draftStatus===selected.status && (draftContract||'')===(selected.contract_id||''))) return;
    setSaving(true); setMessage('');
    const {data,error}=await supabase.from('organization_service_requests').update({status:draftStatus,contract_id:draftContract||null}).eq('id',selected.id).select('*').single();
    if(error){ setMessage(ar?'تعذر تحديث حالة الطلب.':'Could not update request status.'); setSaving(false); return; }
    await logAdminAction('update_organization_service_request','organization_service_request',selected.id,{from:selected.status,to:draftStatus,request_code:selected.request_code,contract_id:draftContract||null});
    setSelected(data); setRows(list=>list.map(x=>x.id===data.id?data:x)); setMessage(ar?'تم تحديث الحالة وإشعار العميل عند الحاجة.':'Status updated; the client is notified when applicable.'); setSaving(false);
  }

  const selectedOrg=selected?orgs[selected.organization_id]:null; const selectedSite=selected?sites[selected.site_id]:null; const selectedProfile=selected?profiles[selected.created_by]:null;

  return <div className="admin-page admin-service-requests-page">
    <div className="admin-page-head"><div><span>{ar?'طلبات المنشآت الذكية':'SMART B2B REQUESTS'}</span><h2>{ar?'مركز طلبات المنشآت':'Organization request center'}</h2><p>{ar?'استقبل احتياج الفندق أو المنشأة كاملًا قبل أن يتحول إلى عرض سعر أو عملية تنفيذ.':'Receive the organization brief with site, access, procurement and attachments before it becomes a quote or execution order.'}</p></div><button className="admin-secondary-button" onClick={()=>load()}><RefreshCw className={loading?'spin':''} size={16}/>{ar?'تحديث':'Refresh'}</button></div>

    <section className="admin-request-metrics">
      <article><span><ClipboardPlus/></span><div><strong>{counts.submitted}</strong><small>{ar?'وصلت وتنتظر المراجعة':'Awaiting review'}</small></div></article>
      <article><span><PackageSearch/></span><div><strong>{counts.review}</strong><small>{ar?'قيد المراجعة الآن':'Under review'}</small></div></article>
      <article><span><CircleAlert/></span><div><strong>{counts.needs}</strong><small>{ar?'تحتاج معلومات':'Need information'}</small></div></article>
      <article className="priority"><span><Sparkles/></span><div><strong>{counts.priority}</strong><small>{ar?'طلب أولوية':'Priority review'}</small></div></article>
    </section>

    {message&&<div className={`admin-flash ${message.includes('تعذر')||message.includes('Could not')?'error':'success'}`}>{message}</div>}
    <section className="admin-panel admin-table-shell">
      <div className="admin-toolbar admin-request-toolbar"><div className="admin-search-field"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'رقم الطلب، المنشأة، الموقع، PO…':'Request, organization, site, PO…'}/></div><div className="admin-request-filters"><Filter/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">{ar?'الطلبات النشطة':'Active requests'}</option><option value="all">{ar?'كل الحالات':'All statuses'}</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v[ar?0:1]}</option>)}</select><select value={service} onChange={e=>setService(e.target.value)}><option value="all">{ar?'كل الخدمات':'All services'}</option>{Object.entries(SERVICES).map(([k,v])=><option key={k} value={k}>{v[ar?0:1]}</option>)}</select></div></div>
      <div className="admin-table-responsive"><table className="admin-table"><thead><tr><th>{ar?'الطلب':'Request'}</th><th>{ar?'المنشأة والموقع':'Organization & site'}</th><th>{ar?'الخدمة':'Service'}</th><th>{ar?'الجاهزية':'Readiness'}</th><th>{ar?'الحالة':'Status'}</th><th>{ar?'آخر تحديث':'Updated'}</th><th/></tr></thead><tbody>{filtered.map(r=>{const o=orgs[r.organization_id]||{}, s=sites[r.site_id]||{};return <tr key={r.id} className={r.priority==='priority_review'?'admin-request-priority-row':''}><td><div className="admin-text-stack"><strong>{r.request_code}</strong><small>{r.priority==='priority_review'?(ar?'أولوية مراجعة':'Priority review'):(r.submission_goal==='quotation'?(ar?'عرض سعر أولًا':'Quotation first'):r.submission_goal==='proposal'?(ar?'مقترح قبل التسعير':'Proposal first'):(ar?'مراجعة الطلب':'Review request'))}</small></div></td><td><div className="admin-text-stack"><strong>{o.display_name||o.legal_name||'—'}</strong><small>{ar?(s.name_ar||'—'):(s.name_en||s.name_ar||'—')}</small></div></td><td>{pair(SERVICES,r.service_type,ar)}</td><td><span className="admin-request-readiness"><i style={{width:`${r.readiness_score||0}%`}}/><b>{r.readiness_score||0}%</b></span></td><td><span className={`admin-order-status ${r.status}`}>{pair(STATUS,r.status,ar)}</span></td><td>{dateTime(r.updated_at,lang)}</td><td><button className="admin-row-action" onClick={()=>openRequest(r)}><MoreHorizontal/></button></td></tr>})}</tbody></table></div>
      {!loading&&!filtered.length&&<div className="admin-empty-state"><ClipboardPlus/><strong>{ar?'لا توجد طلبات مطابقة':'No matching requests'}</strong></div>}
    </section>

    {selected&&<div className="admin-drawer-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><aside className="admin-drawer admin-request-drawer">
      <header className="admin-drawer-head"><div><small>{selected.request_code}</small><h3>{pair(SERVICES,selected.service_type,ar)}</h3><p>{selectedOrg?.display_name||selectedOrg?.legal_name||'—'} · {ar?(selectedSite?.name_ar||'—'):(selectedSite?.name_en||selectedSite?.name_ar||'—')}</p></div><button onClick={()=>setSelected(null)}><X/></button></header>
      <div className="admin-request-drawer-body">
        <section className="admin-request-summary-grid">
          <article><MapPinned/><span><small>{ar?'الموقع والمنطقة':'Site & area'}</small><strong>{ar?(selectedSite?.name_ar||'—'):(selectedSite?.name_en||selectedSite?.name_ar||'—')}</strong><em>{selected.service_area==='custom'?(selected.service_area_custom||'—'):pair(AREAS,selected.service_area,ar)}</em></span></article>
          <article><CalendarDays/><span><small>{ar?'الموعد':'Timing'}</small><strong>{requestWhen(selected,ar)}</strong><em>{selected.preferred_time||'—'}</em></span></article>
          <article><ShieldCheck/><span><small>{ar?'الجاهزية':'Readiness'}</small><strong>{selected.readiness_score||0}%</strong><em>{selected.priority==='priority_review'?(ar?'مراجعة أولوية':'Priority review'):(ar?'عادي':'Normal')}</em></span></article>
          <article><UserRound/><span><small>{ar?'مقدم الطلب':'Requester'}</small><strong>{selectedProfile?.full_name||selected.procurement_details?.requester||'—'}</strong><em>{selectedProfile?.email||'—'}</em></span></article>
        </section>

        <section className="admin-request-block"><header><FileText/><strong>{ar?'وصف الاحتياج':'Request brief'}</strong></header><p>{selected.description||'—'}</p></section>
        {serviceDetailRows(selected,ar).length>0&&<section className="admin-request-block"><header><Sparkles/><strong>{ar?'تفاصيل الخدمة':'Service-specific details'}</strong></header><dl>{serviceDetailRows(selected,ar).map(([label,value])=><span key={label}><dt>{label}</dt><dd>{value}</dd></span>)}</dl></section>}
        {selected.priority==='priority_review'&&<section className="admin-request-block priority"><header><Sparkles/><strong>{ar?'سبب طلب الأولوية':'Priority review reason'}</strong></header><p>{selected.priority_reason||'—'}</p></section>}

        <div className="admin-request-two-cols">
          <section className="admin-request-block"><header><Building2/><strong>{ar?'الوصول للموقع':'Site access'}</strong></header><dl><dt>{ar?'البوابة':'Gate'}</dt><dd>{selected.access_details?.gate||'—'}</dd><dt>{ar?'منطقة التحميل':'Loading dock'}</dt><dd>{selected.access_details?.loading_dock||'—'}</dd><dt>{ar?'مسؤول الاستلام':'Receiver'}</dt><dd>{selected.access_details?.receiver_name||'—'}</dd><dt>{ar?'الجوال':'Phone'}</dt><dd>{selected.access_details?.receiver_phone||'—'}</dd><dt>{ar?'التصريح':'Permit'}</dt><dd>{selected.access_details?.permit_required?(ar?'مطلوب':'Required'):(ar?'غير محدد/غير مطلوب':'Not required')}</dd></dl></section>
          <section className="admin-request-block"><header><FileText/><strong>{ar?'المشتريات':'Procurement'}</strong></header><dl><dt>PO</dt><dd>{selected.procurement_details?.po_number||'—'}</dd><dt>{ar?'القسم':'Department'}</dt><dd>{selected.procurement_details?.department||'—'}</dd><dt>{ar?'مركز التكلفة':'Cost center'}</dt><dd>{selected.procurement_details?.cost_center||'—'}</dd><dt>{ar?'المرجع':'Reference'}</dt><dd>{selected.procurement_details?.internal_reference||'—'}</dd></dl></section>
        </div>

        <section className="admin-request-block"><header><ImageIcon/><strong>{ar?'الصور والمرفقات':'Images & attachments'}</strong><small>{attachments.length}</small></header>{attachments.length?<div className="admin-request-files">{attachments.map(a=><a key={a.id} href={a.url||'#'} target="_blank" rel="noreferrer"><span>{a.mime_type?.startsWith('image/')&&a.url?<img src={a.url} alt=""/>:<FileText/>}</span><div><strong>{a.file_name}</strong><small>{a.size_bytes?`${(a.size_bytes/1024/1024).toFixed(1)} MB`:''}</small></div></a>)}</div>:<p>{ar?'لا توجد مرفقات.':'No attachments.'}</p>}</section>

        <section className="admin-request-block"><header><PackageSearch/><strong>{ar?'العناصر المرجعية':'Catalog references'}</strong><small>{Array.isArray(selected.cart_snapshot)?selected.cart_snapshot.length:0}</small></header>{Array.isArray(selected.cart_snapshot)&&selected.cart_snapshot.length?<div className="admin-request-cart-items">{selected.cart_snapshot.map((x,i)=><span key={`${x.product_id}-${i}`}><b>{x.product_id}</b><em>× {x.quantity}</em></span>)}</div>:<p>{ar?'لم يرفق العميل عناصر من الكتالوج.':'No catalog items were attached.'}</p>}</section>

        <section className="admin-request-status-editor"><div><small>{ar?'إدارة الحالة والعقد':'WORKFLOW & CONTRACT'}</small><strong>{ar?'تحديث مسار الطلب وربطه بعقد':'Update workflow & linked contract'}</strong></div><select value={draftContract} onChange={e=>setDraftContract(e.target.value)} disabled={saving}><option value="">{ar?'بدون عقد':'No contract'}</option>{contracts.filter(c=>c.organization_id===selected.organization_id).map(c=><option key={c.id} value={c.id}>{c.contract_number} · {c.title_ar}</option>)}</select><select value={draftStatus} onChange={e=>setDraftStatus(e.target.value)} disabled={saving}>{Object.entries(STATUS).filter(([k])=>k!=='draft').map(([k,v])=><option key={k} value={k}>{v[ar?0:1]}</option>)}</select><button className="admin-primary-button" onClick={saveStatus} disabled={saving||(draftStatus===selected.status&&(draftContract||'')===(selected.contract_id||''))}>{saving?<LoaderCircle className="spin"/>:<CheckCircle2/>}{ar?'حفظ الحالة':'Save status'}</button></section>
      </div>
    </aside></div>}
  </div>;
}
