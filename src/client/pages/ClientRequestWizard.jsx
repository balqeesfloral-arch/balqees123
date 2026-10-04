import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Building2, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  CircleDollarSign, Clock3, FileText, Flower2, ImagePlus, Layers3, LoaderCircle, MapPinned,
  PackagePlus, Palette, Plus, RefreshCw, Save, ShieldCheck, Sparkles, Trash2, UploadCloud, WandSparkles,
  Wrench, X
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useBalqeesCart } from '../../lib/cart';
import { useClientPortal } from '../ClientPortalContext';
import { fmtDate, safeUuid } from '../portalUtils';

const SERVICE_TYPES = [
  ['supply', Flower2, 'توريد زهور ونباتات', 'Flowers & plants supply', 'توريد عناصر طبيعية أو صناعية للموقع.'],
  ['vases', PackagePlus, 'تجهيز فازات', 'Vase preparation', 'تنسيقات فازات للمداخل واللوبي والطاولات.'],
  ['space_design', Palette, 'تنسيق مساحة', 'Space styling', 'تصميم وتنسيق مساحة داخلية أو خارجية.'],
  ['maintenance', Wrench, 'صيانة وعناية', 'Maintenance & care', 'زيارة عناية وصيانة للنباتات والتنسيقات.'],
  ['recurring', RefreshCw, 'توريد دوري', 'Recurring supply', 'احتياج متكرر بجدول منتظم.'],
  ['custom', Sparkles, 'طلب مخصص', 'Custom request', 'طلب لا يندرج ضمن الخيارات السابقة.'],
];

const AREAS = [
  ['lobby','اللوبي','Lobby'],['reception','الاستقبال','Reception'],['entrance','المدخل الرئيسي','Main entrance'],
  ['restaurant','المطعم','Restaurant'],['meeting','قاعات الاجتماعات','Meeting rooms'],['suites','الأجنحة','Suites'],
  ['corridors','الممرات','Corridors'],['offices','المكاتب','Offices'],['garden','الحديقة الخارجية','Outdoor garden'],['custom','منطقة أخرى','Other area'],
];

const EMPTY = {
  service_type:'', site_id:'', service_area:'', service_area_custom:'', description:'',
  budget_mode:'unspecified', budget_range:'', budget_amount:'', timing_mode:'nearest', requested_date:'', preferred_time:'',
  access_details:{ gate:'', permit_required:false, loading_dock:'', receiver_name:'', receiver_phone:'', access_hours:'', notes:'' },
  service_details:{ material_preference:'unspecified', approximate_quantity:'', preferred_style:'', space_size:'', maintenance_focus:'', frequency:'weekly', duration_months:'', fixed_quantity:false },
  procurement_details:{ po_number:'', department:'', cost_center:'', internal_reference:'', requester:'' },
  submission_goal:'review', priority:'normal', priority_reason:'',
};

function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
function fileSafe(name='file'){ return name.replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-90) || 'file'; }
function score(form, attachments, cartCount){
  let s=0;
  if(form.service_type) s+=18;
  if(form.site_id) s+=18;
  if(form.service_area) s+=10;
  if((form.description||'').trim().length>=20) s+=20;
  if(form.timing_mode!=='exact' || form.requested_date) s+=8;
  if(form.access_details?.receiver_name || form.access_details?.receiver_phone) s+=8;
  if(attachments.length || cartCount>0) s+=8;
  if(form.submission_goal) s+=5;
  if(form.procurement_details?.po_number || form.procurement_details?.department || form.procurement_details?.cost_center) s+=5;
  return clamp(s,0,100);
}

export default function ClientRequestWizard(){
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const careDraftId = searchParams.get('careDraft');
  const { lang, organization, session, permissions, preferences, portalSettings } = useClientPortal();
  const ar = lang==='ar';
  const cart = useBalqeesCart();
  const [step,setStep]=useState(1);
  const [form,setForm]=useState(()=>({...EMPTY,submission_goal:searchParams.get('goal')==='quotation'?'quotation':EMPTY.submission_goal}));
  const [request,setRequest]=useState(null);
  const [sites,setSites]=useState([]);
  const [attachments,setAttachments]=useState([]);
  const [recent,setRecent]=useState([]);
  const [recentOrders,setRecentOrders]=useState([]);
  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [savedAt,setSavedAt]=useState(null);
  const [error,setError]=useState('');
  const [uploading,setUploading]=useState(false);
  const [showSuccess,setShowSuccess]=useState(false);
  const [helperOpen,setHelperOpen]=useState(false);
  const [helper,setHelper]=useState({purpose:'',style:'',quantity:'',notes:''});
  const dirtyRef=useRef(false);
  const firstLoad=useRef(true);
  const requestRef=useRef(null);
  const createPromiseRef=useRef(null);
  const draftOwnedByUser=!request || request.created_by===session?.user?.id;
  const readOnly=Boolean(request && (request.status!=='draft' || !draftOwnedByUser || !permissions.placeOrders));
  const effectiveItems=readOnly?(Array.isArray(request?.cart_snapshot)?request.cart_snapshot:[]):cart.items;
  const effectiveCount=useMemo(()=>effectiveItems.reduce((n,x)=>n+Number(x.quantity||0),0),[effectiveItems]);
  const readiness=useMemo(()=>score(form,attachments,effectiveCount),[form,attachments,effectiveCount]);
  const portalProcurement=portalSettings?.organization_settings||{};
  const procurement={...(organization?.procurement_settings||{}),po_mode:portalProcurement.po_required?'required':((organization?.procurement_settings||{}).po_mode||'optional'),cost_center_enabled:portalProcurement.cost_center_enabled??(organization?.procurement_settings||{}).cost_center_enabled,internal_approval_enabled:portalProcurement.internal_approval_enabled??(organization?.procurement_settings||{}).internal_approval_enabled,price_visibility_rule:portalProcurement.price_visibility_rule||'permission'};
  const cartKey=useMemo(()=>cart.items.map(x=>x.product_id).sort().join('|'),[cart.items]);

  useEffect(()=>{
    let live=true;
    (async()=>{
      if(!cartKey){ if(live) setProducts([]); return; }
      const ids=cart.items.map(x=>x.product_id);
      const {data}=await supabase.from('products').select('id,name_ar,name_en,image_url').in('id',ids);
      if(live) setProducts(data||[]);
    })();
    return()=>{live=false;};
  },[cartKey]);

  const patch=useCallback((key,value)=>{ dirtyRef.current=true; setForm(f=>({...f,[key]:value})); },[]);
  const patchNested=useCallback((group,key,value)=>{ dirtyRef.current=true; setForm(f=>({...f,[group]:{...(f[group]||{}),[key]:value}})); },[]);

  const loadAttachments=useCallback(async(reqId)=>{
    if(!reqId) return;
    const {data}=await supabase.from('organization_request_attachments').select('*').eq('request_id',reqId).order('created_at');
    const rows=data||[];
    const enriched=await Promise.all(rows.map(async row=>{
      const {data:signed}=await supabase.storage.from('organization-request-files').createSignedUrl(row.storage_path,3600);
      return {...row,url:signed?.signedUrl||''};
    }));
    setAttachments(enriched);
  },[]);

  const loadRecent=useCallback(async()=>{
    if(!organization?.id) return;
    const {data}=await supabase.from('organization_service_requests')
      .select('id,request_code,status,service_type,service_area,readiness_score,updated_at,submitted_at')
      .eq('organization_id',organization.id).order('updated_at',{ascending:false}).limit(6);
    setRecent(data||[]);
  },[organization?.id]);

  useEffect(()=>{
    if(!organization?.id || !session?.user?.id) return;
    let live=true;
    (async()=>{
      setLoading(true); setError('');
      const defaultContactId=portalSettings?.organization_settings?.default_receiving_contact_id||'';
      const [siteRes,prodRes,orderRes,orgCartRes,contactRes]=await Promise.all([
        supabase.from('organization_sites').select('*').eq('organization_id',organization.id).eq('is_active',true).order('is_default',{ascending:false}),
        cart.items.length?supabase.from('products').select('id,name_ar,name_en,image_url').in('id',cart.items.map(x=>x.product_id)):Promise.resolve({data:[]}),
        supabase.from('orders').select('id,order_number,status,service_site_id,requested_delivery_date,created_at,order_items(product_id,quantity)').eq('organization_id',organization.id).neq('status','cancelled').order('created_at',{ascending:false}).limit(3),
        supabase.from('organization_cart_items').select('product_id,quantity').eq('organization_id',organization.id).eq('user_id',session.user.id),
        defaultContactId?supabase.from('organization_site_contacts').select('id,site_id,name,phone,is_visible').eq('organization_id',organization.id).eq('id',defaultContactId).eq('is_visible',true).maybeSingle():Promise.resolve({data:null,error:null}),
      ]);
      if(!live) return;
      setSites(siteRes.data||[]); setProducts(prodRes.data||[]); setRecentOrders(orderRes.data||[]);
      if(!routeId && (orgCartRes.data||[]).length){
        cart.clear();
        (orgCartRes.data||[]).forEach(item=>cart.add({id:item.product_id,stock_mode:'made_to_order',min_order_quantity:1},Number(item.quantity||1)));
      }
      await loadRecent();
      if(routeId){
        const {data,error:e}=await supabase.from('organization_service_requests').select('*').eq('id',routeId).eq('organization_id',organization.id).maybeSingle();
        if(e||!data){ setError(ar?'تعذر فتح الطلب المطلوب.':'Could not open the requested request.'); }
        else {
          requestRef.current=data; setRequest(data); setForm({...EMPTY,...data,access_details:{...EMPTY.access_details,...(data.access_details||{})},service_details:{...EMPTY.service_details,...(data.service_details||{})},procurement_details:{...EMPTY.procurement_details,...(data.procurement_details||{})}}); setStep(data.status==='draft'?1:6);
          setShowSuccess(false);
          if(data.status==='draft' && data.created_by===session.user.id && Array.isArray(data.cart_snapshot)){
            cart.clear();
            data.cart_snapshot.forEach(item=>{ if(item?.product_id) cart.add({id:item.product_id},Number(item.quantity||1)); });
          }
          const snapshotIds=[...new Set((Array.isArray(data.cart_snapshot)?data.cart_snapshot:[]).map(x=>x.product_id).filter(Boolean))];
          if(snapshotIds.length){ const {data:snapshotProducts}=await supabase.from('products').select('id,name_ar,name_en,image_url').in('id',snapshotIds); setProducts(snapshotProducts||[]); }
          await loadAttachments(data.id);
        }
      } else {
        requestRef.current=null; setRequest(null); setAttachments([]); setShowSuccess(false); setStep(1);
        const defaultSite=portalSettings?.organization_settings?.default_site_id || preferences?.default_site_id || contactRes.data?.site_id || (siteRes.data||[]).find(x=>x.is_default)?.id || (siteRes.data||[])[0]?.id || '';
        setForm(f=>({...f,site_id:defaultSite,access_details:{...f.access_details,receiver_name:contactRes.data?.name||f.access_details?.receiver_name||'',receiver_phone:contactRes.data?.phone||f.access_details?.receiver_phone||''}}));
      }
      firstLoad.current=false; setLoading(false);
    })();
    return()=>{live=false;};
  },[organization?.id,session?.user?.id,routeId,portalSettings?.organization_settings?.default_site_id,portalSettings?.organization_settings?.default_receiving_contact_id]);

  useEffect(()=>{
    if(routeId || !careDraftId || !organization?.id || !session?.user?.id) return;
    let live=true;
    (async()=>{
      const {data,error:e}=await supabase.from('care_request_drafts').select('*').eq('id',careDraftId).eq('organization_id',organization.id).eq('user_id',session.user.id).eq('status','draft').maybeSingle();
      if(!live||e||!data)return;
      const p=data.draft_payload||{};
      dirtyRef.current=true;
      setForm(f=>({...f,site_id:data.site_id||p.site_id||f.site_id,service_type:p.service_type||f.service_type,service_area:p.service_area||f.service_area,description:p.description||f.description,budget_mode:p.budget_mode||f.budget_mode,budget_range:p.budget_range||f.budget_range,budget_amount:p.budget_amount??f.budget_amount,submission_goal:p.submission_goal||f.submission_goal}));
      if(Array.isArray(p.cart_snapshot)&&p.cart_snapshot.length){
        cart.clear();
        p.cart_snapshot.forEach(item=>{if(item?.product_id)cart.add({id:item.product_id,...(item.product_snapshot||{})},Number(item.quantity||1));});
      }
    })();
    return()=>{live=false};
  },[careDraftId,routeId,organization?.id,session?.user?.id]);

  useEffect(()=>{
    if(!request?.id || !organization?.id) return undefined;
    const channel=supabase.channel(`org-request-${request.id}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'organization_service_requests',filter:`id=eq.${request.id}`},payload=>{
        if(!payload.new) return;
        requestRef.current=payload.new;
        setRequest(payload.new);
        if(payload.new.status!=='draft') setStep(6);
      }).subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[request?.id,organization?.id]);

  async function ensureDraft(){
    const existing=requestRef.current || request;
    if(existing?.id) return existing;
    if(!organization?.id || !session?.user?.id) throw new Error('NO_CONTEXT');
    const payload={organization_id:organization.id,created_by:session.user.id,site_id:form.site_id||null,service_type:form.service_type||null,service_area:form.service_area||null,
      service_area_custom:form.service_area_custom||null,description:form.description||null,budget_mode:form.budget_mode,budget_range:form.budget_range||null,
      budget_amount:form.budget_mode==='exact'&&form.budget_amount?Number(form.budget_amount):null,timing_mode:form.timing_mode,requested_date:form.timing_mode==='exact'?(form.requested_date||null):null,
      preferred_time:form.preferred_time||null,access_details:form.access_details,service_details:form.service_details,procurement_details:form.procurement_details,submission_goal:form.submission_goal,priority:form.priority,
      priority_reason:form.priority==='priority_review'?(form.priority_reason||null):null,readiness_score:readiness,cart_snapshot:cart.items};
    if(createPromiseRef.current) return createPromiseRef.current;
    createPromiseRef.current=(async()=>{
      const {data,error:e}=await supabase.from('organization_service_requests').insert(payload).select('*').single();
      if(e) throw e;
      requestRef.current=data; setRequest(data); if(careDraftId) await supabase.from('care_request_drafts').update({status:'consumed',updated_at:new Date().toISOString()}).eq('id',careDraftId).eq('user_id',session.user.id); navigate(`/portal/request/${data.id}`,{replace:true}); await loadRecent(); return data;
    })();
    try{return await createPromiseRef.current;} finally{createPromiseRef.current=null;}
  }

  const saveDraft=useCallback(async(silent=true)=>{
    if(readOnly || !permissions.placeOrders || firstLoad.current || !dirtyRef.current) return;
    const meaningful=form.service_type||form.description||form.service_area||effectiveCount>0;
    if(!meaningful) return;
    try{
      setSaving(true); setError('');
      const current=requestRef.current || request;
      const row=current?.id?current:await ensureDraft();
      const payload={site_id:form.site_id||null,service_type:form.service_type||null,service_area:form.service_area||null,service_area_custom:form.service_area==='custom'?(form.service_area_custom||null):null,
        description:form.description||null,budget_mode:form.budget_mode,budget_range:form.budget_mode==='range'?(form.budget_range||null):null,budget_amount:form.budget_mode==='exact'&&form.budget_amount?Number(form.budget_amount):null,
        timing_mode:form.timing_mode,requested_date:form.timing_mode==='exact'?(form.requested_date||null):null,preferred_time:form.preferred_time||null,
        access_details:form.access_details,service_details:form.service_details,procurement_details:form.procurement_details,submission_goal:form.submission_goal,priority:form.priority,priority_reason:form.priority==='priority_review'?(form.priority_reason||null):null,
        readiness_score:readiness,cart_snapshot:effectiveItems};
      const {data,error:e}=await supabase.from('organization_service_requests').update(payload).eq('id',row.id).select('*').single();
      if(e) throw e;
      requestRef.current=data; setRequest(data); dirtyRef.current=false; setSavedAt(new Date()); if(!silent) await loadRecent();
    }catch(e){ setError(ar?'تعذر حفظ المسودة الآن.':'Could not save the draft right now.'); }
    finally{ setSaving(false); }
  },[readOnly,permissions.placeOrders,form,request?.id,readiness,effectiveItems,effectiveCount,ar]);

  useEffect(()=>{
    if(firstLoad.current||readOnly||!dirtyRef.current) return;
    const t=setTimeout(()=>saveDraft(true),900);
    return()=>clearTimeout(t);
  },[form,cart.items,saveDraft,readOnly]);

  function validateStep(target=step){
    if(target===1 && !form.service_type) return ar?'اختر نوع الخدمة أولًا.':'Choose a service first.';
    if(target===2 && !form.site_id) return ar?'اختر موقع التنفيذ.':'Choose a service site.';
    if(target===2 && !form.service_area) return ar?'حدد المنطقة داخل الموقع.':'Choose the area inside the site.';
    if(target===2 && form.service_area==='custom' && !(form.service_area_custom||'').trim()) return ar?'اكتب اسم المنطقة داخل الموقع.':'Enter the custom area name.';
    if(target===3 && (form.description||'').trim().length<10) return ar?'اكتب وصفًا أوضح للاحتياج (10 أحرف على الأقل).':'Add a clearer description (at least 10 characters).';
    if(target===4 && form.timing_mode==='exact' && !form.requested_date) return ar?'حدد التاريخ المطلوب.':'Choose the requested date.';
    if(target===5 && procurement.po_mode==='required' && !form.procurement_details.po_number) return ar?'رقم أمر الشراء مطلوب حسب إعدادات المنشأة.':'PO number is required by your organization settings.';
    return '';
  }
  async function next(){ const e=validateStep(); if(e){setError(e);return;} setError(''); await saveDraft(false); setStep(s=>Math.min(6,s+1)); window.scrollTo({top:0,behavior:'smooth'}); }
  function back(){ setError(''); setStep(s=>Math.max(1,s-1)); window.scrollTo({top:0,behavior:'smooth'}); }

  async function uploadFiles(files){
    if(!files?.length || readOnly) return;
    try{
      setUploading(true); setError('');
      const current=requestRef.current || request;
      const row=current?.id?current:await ensureDraft();
      if(attachments.length>=8) throw new Error('TOO_MANY_FILES');
      for(const file of [...files].slice(0,Math.max(0,8-attachments.length))){
        if(file.size>15*1024*1024) throw new Error('FILE_TOO_LARGE');
        if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)) throw new Error('BAD_FILE');
        const path=`${organization.id}/${row.id}/${safeUuid()}-${fileSafe(file.name)}`;
        const {error:upErr}=await supabase.storage.from('organization-request-files').upload(path,file,{upsert:false,contentType:file.type});
        if(upErr) throw upErr;
        const {error:metaErr}=await supabase.from('organization_request_attachments').insert({request_id:row.id,organization_id:organization.id,uploaded_by:session.user.id,storage_path:path,file_name:file.name,mime_type:file.type,size_bytes:file.size});
        if(metaErr){ await supabase.storage.from('organization-request-files').remove([path]); throw metaErr; }
      }
      await loadAttachments(row.id); dirtyRef.current=true; await saveDraft(true);
    }catch(e){ setError(e.message==='FILE_TOO_LARGE'?(ar?'الحد الأقصى للملف 15MB.':'Maximum file size is 15MB.'):e.message==='TOO_MANY_FILES'?(ar?'الحد الأقصى 8 مرفقات لكل طلب.':'A request can include up to 8 attachments.'):(ar?'تعذر رفع أحد الملفات.':'One of the files could not be uploaded.')); }
    finally{ setUploading(false); }
  }

  async function removeAttachment(item){
    if(readOnly) return;
    try{
      setUploading(true); setError('');
      const {error:storageError}=await supabase.storage.from('organization-request-files').remove([item.storage_path]);
      if(storageError) throw storageError;
      const {error:metaError}=await supabase.from('organization_request_attachments').delete().eq('id',item.id);
      if(metaError) throw metaError;
      await loadAttachments(request.id);
    }catch(e){ setError(ar?'تعذر حذف المرفق الآن.':'Could not remove the attachment right now.'); }
    finally{ setUploading(false); }
  }

  function usePreviousOrder(order){
    if(readOnly) return;
    cart.clear();
    (order.order_items||[]).forEach(item=>{ if(item.product_id) cart.add({id:item.product_id},Number(item.quantity||1)); });
    setForm(f=>({...f,service_type:f.service_type||'supply',site_id:order.service_site_id||f.site_id,description:[f.description,ar?`طلب مشابه للطلب #${String(order.order_number).padStart(5,'0')} — يرجى مراجعة الكميات والموعد قبل الإرسال.`:`Request similar to order #${String(order.order_number).padStart(5,'0')} — please review quantities and timing before submission.`].filter(Boolean).join('\n')}));
    dirtyRef.current=true;
    setStep(2);
  }

  function generateBrief(){
    const bits=[];
    if(helper.purpose) bits.push(ar?`الهدف من الطلب: ${helper.purpose}.`:`Request goal: ${helper.purpose}.`);
    if(helper.style) bits.push(ar?`الطابع المطلوب: ${helper.style}.`:`Preferred style: ${helper.style}.`);
    if(helper.quantity) bits.push(ar?`الكمية أو النطاق التقريبي: ${helper.quantity}.`:`Approximate quantity/scope: ${helper.quantity}.`);
    if(helper.notes) bits.push(helper.notes);
    patch('description',[form.description,bits.join(' ')].filter(Boolean).join('\n'));
    setHelperOpen(false);
  }

  async function submit(){
    for(let i=1;i<=5;i++){const e=validateStep(i);if(e){setStep(i);setError(e);return;}}
    if(!permissions.placeOrders){setError(ar?'لا تملك صلاحية إرسال الطلبات.':'You do not have permission to submit requests.');return;}
    try{
      setSaving(true); setError(''); dirtyRef.current=true;
      const current=requestRef.current || request;
      const row=current?.id?current:await ensureDraft();
      await saveDraft(true);
      const {data,error:e}=await supabase.from('organization_service_requests').update({status:'submitted',readiness_score:readiness,cart_snapshot:effectiveItems}).eq('id',row.id).select('*').single();
      if(e) throw e;
      requestRef.current=data; setRequest(data); setShowSuccess(true); dirtyRef.current=false;
      if(cart.count) cart.clear();
      await supabase.from('organization_cart_items').delete().eq('organization_id',organization.id).eq('user_id',session.user.id);
      await loadRecent();
    }catch(e){ setError(ar?'تعذر إرسال الطلب. لم يتم فقد المسودة ويمكنك المحاولة مرة أخرى.':'Could not submit the request. Your draft is safe; please try again.'); }
    finally{ setSaving(false); }
  }

  const stepMeta = [
    ['الاحتياج','Need'],['الموقع','Site'],['التفاصيل والصور','Details'],['الموعد والميزانية','Timing'],['المشتريات والتنسيق','Procurement'],['المراجعة','Review']
  ];
  const service = SERVICE_TYPES.find(x=>x[0]===form.service_type);
  const ServiceIcon = service?.[1] || Sparkles;
  const site = sites.find(x=>x.id===form.site_id);
  const productMap=useMemo(()=>Object.fromEntries(products.map(p=>[p.id,p])),[products]);

  if(loading) return <div className="client-request-loading"><LoaderCircle className="spin"/><strong>{ar?'نجهّز الطلب الذكي…':'Preparing smart request…'}</strong></div>;
  if(!permissions.placeOrders && !request) return <div className="client-page"><div className="client-empty-large"><ShieldCheck/><h3>{ar?'صلاحية إنشاء الطلب غير متاحة':'Request creation permission is not available'}</h3><p>{ar?'يمكنك متابعة العمليات الحالية، لكن إنشاء طلب جديد يحتاج صلاحية من مدير المنشأة.':'You can follow current operations, but a new request requires permission from your organization manager.'}</p><Link className="client-primary" to="/portal/orders">{ar?'فتح مركز العمليات':'Open operations center'}</Link></div></div>;

  if(showSuccess && request) return <div className="client-page request-success-page">
    <div className="request-success-orbit"><span/><i/><Flower2/></div>
    <small>{ar?'تم الإرسال بنجاح':'REQUEST SUBMITTED'}</small><h2>{ar?'وصل طلبكم إلى بلقيس':'Your request has reached Balqees'}</h2>
    <p>{ar?'تم حفظ كل التفاصيل والصور والمرفقات، وسيبدأ فريق بلقيس بمراجعتها دون الحاجة لإعادة شرح الطلب.':'All details and attachments are saved. The Balqees team can review them without asking you to repeat the brief.'}</p>
    <div className="request-success-code"><span>{ar?'رقم الطلب':'Request reference'}</span><strong>{request.request_code}</strong></div>
    <div className="request-success-next"><b>{ar?'ماذا سيحدث الآن؟':'What happens next?'}</b><span><Check/> {ar?'مراجعة الاحتياج والموقع':'Need and site review'}</span><span><Check/> {request.submission_goal==='quotation'?(ar?'تجهيز عرض سعر':'Quotation preparation'):request.submission_goal==='proposal'?(ar?'تجهيز مقترح قبل التسعير':'Proposal before pricing'):(ar?'بدء المراجعة التشغيلية':'Operational review')}</span><span><Check/> {ar?'ستصلك التحديثات من البوابة':'Updates will appear in your portal'}</span></div>
    <div className="request-success-actions"><button className="client-primary" onClick={()=>{setShowSuccess(false);setStep(6)}}>{ar?'عرض تفاصيل الطلب':'View request details'}</button><button className="client-secondary" onClick={()=>navigate('/portal')}>{ar?'العودة للرئيسية':'Back to overview'}</button><button className="client-secondary" onClick={()=>navigate('/portal/request')}>{ar?'طلب جديد آخر':'Create another request'}</button></div>
  </div>;

  return <div className="client-page request-wizard-page">
    <header className="request-hero">
      <div className="request-hero-copy"><span><WandSparkles/>{ar?'طلب ذكي للمنشآت':'SMART ORGANIZATION REQUEST'}</span><h2>{ar?'كيف نقدر نخدم منشأتكم اليوم؟':'How can we support your organization today?'}</h2><p>{ar?'اختر احتياجك، وبلقيس ترتّب معك بقية التفاصيل خطوة بخطوة.':'Choose what you need and Balqees will structure the rest with you, step by step.'}</p></div>
      <div className="request-readiness"><div style={{'--score':`${readiness*3.6}deg`}}><strong>{readiness}%</strong><small>{ar?'جاهزية الطلب':'readiness'}</small></div><p>{readiness>=85?(ar?'الطلب غني بالمعلومات وجاهز للمراجعة.':'Your brief is rich and ready for review.'):(ar?'كل معلومة تضيفها تساعدنا نبدأ أسرع.':'Each detail helps us start faster.')}</p></div>
    </header>

    <div className="request-layout">
      <aside className="request-side">
        <div className="request-steps">{stepMeta.map((s,i)=>{const n=i+1;return <button key={n} className={`${step===n?'active':''} ${step>n?'done':''}`} onClick={()=>setStep(n)}><i>{step>n?<Check/>:n}</i><span><b>{ar?s[0]:s[1]}</b><small>{ar?`الخطوة ${n}`:`Step ${n}`}</small></span></button>})}</div>
        {recent.length>0&&<div className="request-recent"><header><span>{ar?'آخر الطلبات':'Recent requests'}</span><small>{recent.length}</small></header>{recent.map(r=><button key={r.id} onClick={()=>navigate(`/portal/request/${r.id}`)}><span className={`request-status-dot ${r.status}`}/><div><strong>{r.request_code}</strong><small>{r.status==='draft'?(ar?'مسودة':'Draft'):r.status==='submitted'?(ar?'تم الإرسال':'Submitted'):(ar?'قيد المتابعة':'In progress')}</small></div><ChevronLeft/></button>)}</div>}
      </aside>

      <main className="request-stage">
        {readOnly&&<div className="request-readonly"><ShieldCheck/><div><strong>{request?.status==='draft'?(ar?'هذه مسودة أنشأها عضو آخر من فريق منشأتكم.':'This draft was created by another member of your organization.'):(ar?`حالة الطلب: ${{submitted:'تم الإرسال',under_review:'قيد المراجعة',needs_info:'تحتاج معلومات',converted:'تم تحويله للتنفيذ',cancelled:'ملغي'}[request?.status]||request?.status}`:`Request status: ${{submitted:'Submitted',under_review:'Under review',needs_info:'Needs information',converted:'Converted',cancelled:'Cancelled'}[request?.status]||request?.status}`)}</strong><small>{request?.status==='draft'?(ar?'يمكنك الاطلاع عليها، والتعديل متاح فقط لمن أنشأ المسودة.':'You can view it, but only its creator can edit the draft.'):(ar?'تم قفل بيانات الطلب بعد الإرسال؛ أي تغيير جديد يمر عبر فريق بلقيس للحفاظ على سجل واضح.':'The request is locked after submission; further changes go through the Balqees team to preserve a clear record.')}</small></div></div>}
        {error&&<div className="request-error"><X/>{error}</div>}

        {step===1&&<section className="request-step"><div className="request-step-head"><small>01</small><div><h3>{ar?'ما الاحتياج؟':'What do you need?'}</h3><p>{ar?'ابدأ بالهدف، وسنظهر التفاصيل المناسبة فقط.':'Start with the intent; we only show details that matter.'}</p></div></div><div className="request-service-grid">{SERVICE_TYPES.map(([id,Icon,a,e,d])=><button disabled={readOnly} key={id} className={form.service_type===id?'selected':''} onClick={()=>patch('service_type',id)}><span><Icon/></span><strong>{ar?a:e}</strong><small>{ar?d:({supply:'Supply of natural or artificial floral items.',vases:'Vase arrangements for hospitality spaces.',space_design:'Styling an indoor or outdoor space.',maintenance:'Care and maintenance visit.',recurring:'A repeated need on a schedule.',custom:'Something outside the standard options.'}[id])}</small>{form.service_type===id&&<i><Check/></i>}</button>)}</div>
          {['supply','vases'].includes(form.service_type)&&<div className="request-recurring-card request-service-context"><header><Flower2/><div><strong>{ar?'تفاصيل تساعدنا في الاختيار':'Selection details'}</strong><small>{ar?'هذه المعلومات اختيارية وتساعد فريق بلقيس في تضييق الخيارات المناسبة.':'Optional details that help Balqees narrow down the right options.'}</small></div></header><div className="request-two"><label className="request-field"><span>{ar?'نوع العناصر المفضل':'Preferred material'}</span><select disabled={readOnly} value={form.service_details.material_preference||'unspecified'} onChange={e=>patchNested('service_details','material_preference',e.target.value)}><option value="unspecified">{ar?'غير محدد':'Not specified'}</option><option value="natural">{ar?'طبيعي':'Natural'}</option><option value="artificial">{ar?'صناعي فاخر':'Premium artificial'}</option><option value="mixed">{ar?'مزيج':'Mixed'}</option></select></label><label className="request-field"><span>{ar?'الكمية أو النطاق التقريبي':'Approximate quantity / scope'}</span><input disabled={readOnly} value={form.service_details.approximate_quantity||''} onChange={e=>patchNested('service_details','approximate_quantity',e.target.value)} placeholder={ar?'مثال: 12 فازة أو 8 نباتات':'Example: 12 vases or 8 plants'}/></label></div></div>}
          {form.service_type==='space_design'&&<div className="request-recurring-card request-service-context"><header><Palette/><div><strong>{ar?'ملامح المساحة':'Space direction'}</strong><small>{ar?'يكفي تقدير أولي؛ التفاصيل النهائية تُراجع مع الفريق.':'An initial estimate is enough; final details are reviewed with the team.'}</small></div></header><div className="request-two"><label className="request-field"><span>{ar?'المساحة التقريبية':'Approximate area'}</span><input disabled={readOnly} value={form.service_details.space_size||''} onChange={e=>patchNested('service_details','space_size',e.target.value)} placeholder={ar?'مثال: 80 م²':'Example: 80 m²'}/></label><label className="request-field"><span>{ar?'الطابع المطلوب':'Preferred style'}</span><input disabled={readOnly} value={form.service_details.preferred_style||''} onChange={e=>patchNested('service_details','preferred_style',e.target.value)} placeholder={ar?'هادئ، فاخر، طبيعي…':'Calm, premium, natural…'}/></label></div></div>}
          {form.service_type==='maintenance'&&<div className="request-recurring-card request-service-context"><header><Wrench/><div><strong>{ar?'حالة العناية الحالية':'Current care need'}</strong><small>{ar?'صف المشكلة الأساسية باختصار، ثم يمكنك إرفاق الصور في الخطوة الثالثة.':'Briefly describe the main issue, then attach photos in step three.'}</small></div></header><label className="request-field"><span>{ar?'ما الذي يحتاج عناية؟':'What needs attention?'}</span><input disabled={readOnly} value={form.service_details.maintenance_focus||''} onChange={e=>patchNested('service_details','maintenance_focus',e.target.value)} placeholder={ar?'مثال: ذبول نباتات اللوبي أو استبدال تنسيقات':'Example: lobby plants wilting or arrangements need replacement'}/></label></div>}
          {recentOrders.length>0&&<div className="request-previous-orders"><header><div><RefreshCw/><span><strong>{ar?'ابدأ من طلب سابق':'Start from a previous order'}</strong><small>{ar?'ننسخ العناصر والموقع كأساس، وتراجع أنت الكميات والموعد.':'We reuse items and site as a starting point; you still review quantities and timing.'}</small></span></div></header><div>{recentOrders.map(o=><button key={o.id} disabled={readOnly} onClick={()=>usePreviousOrder(o)}><span><b>#{String(o.order_number).padStart(5,'0')}</b><small>{fmtDate(o.created_at,lang)}</small></span><em>{ar?'استخدام كأساس':'Use as base'}</em></button>)}</div></div>}</section>}

        {step===2&&<section className="request-step"><div className="request-step-head"><small>02</small><div><h3>{ar?'أين سيتم التنفيذ؟':'Where will this be delivered or executed?'}</h3><p>{ar?'اختر الموقع والمنطقة الداخلية حتى يصل الطلب للفريق الصحيح من البداية.':'Choose the site and internal area so the request starts with the right context.'}</p></div></div>
          <div className="request-site-grid">{sites.map(s=><button disabled={readOnly} key={s.id} className={form.site_id===s.id?'selected':''} onClick={()=>patch('site_id',s.id)}><MapPinned/><div><strong>{ar?s.name_ar:(s.name_en||s.name_ar)}</strong><small>{s.site_type|| (ar?'موقع خدمة':'Service site')}</small></div>{s.is_default&&<em>{ar?'افتراضي':'Default'}</em>}{form.site_id===s.id&&<i><Check/></i>}</button>)}</div>{sites.length===0&&<div className="request-no-sites"><MapPinned/><div><strong>{ar?'لا يوجد موقع خدمة فعّال':'No active service site'}</strong><small>{ar?'أضف موقعًا للمنشأة أولًا ثم ارجع لإكمال الطلب.':'Add an organization site first, then return to complete the request.'}</small></div><Link to="/portal/sites" className="client-secondary">{ar?'إدارة المواقع':'Manage sites'}</Link></div>}
          <h4 className="request-subtitle">{ar?'المنطقة داخل الموقع':'Area inside the site'}</h4><div className="request-area-grid">{AREAS.map(([id,a,e])=><button disabled={readOnly} key={id} className={form.service_area===id?'selected':''} onClick={()=>patch('service_area',id)}>{ar?a:e}</button>)}</div>
          {form.service_area==='custom'&&<label className="request-field"><span>{ar?'اسم المنطقة':'Area name'}</span><input disabled={readOnly} value={form.service_area_custom||''} onChange={e=>patch('service_area_custom',e.target.value)} placeholder={ar?'مثال: التراس العلوي':'Example: rooftop terrace'}/></label>}
        </section>}

        {step===3&&<section className="request-step"><div className="request-step-head"><small>03</small><div><h3>{ar?'صف لنا النتيجة التي تريدها':'Describe the result you want'}</h3><p>{ar?'لا تحتاج صياغة احترافية؛ اكتب بطريقتك أو استخدم مساعد الوصف.':'No formal brief needed. Write naturally or use the guided brief helper.'}</p></div></div>
          <div className="request-description-card"><div className="request-description-toolbar"><button disabled={readOnly} onClick={()=>setHelperOpen(true)}><WandSparkles/>{ar?'ساعدني في الوصف':'Help me structure the brief'}</button><span>{(form.description||'').length}/1800</span></div><textarea disabled={readOnly} maxLength={1800} rows="8" value={form.description||''} onChange={e=>patch('description',e.target.value)} placeholder={ar?'مثال: نحتاج تنسيق اللوبي بشكل هادئ وفاخر يناسب استقبال الضيوف…':'Example: We need a calm, premium lobby arrangement suitable for guest reception…'}/></div>
          {effectiveCount>0&&<div className="request-cart-snapshot"><header><div><Layers3/><span><strong>{ar?'عناصر مختارة من الكتالوج':'Selected catalog items'}</strong><small>{ar?'ستُرفق كمرجع مع الطلب، وليست فاتورة نهائية.':'Attached as request references, not a final invoice.'}</small></span></div><Link to="/portal/catalog">{ar?'إضافة عناصر':'Add items'}</Link></header><div>{effectiveItems.map(x=>{const p=productMap[x.product_id];return <span key={x.product_id}>{p?.image_url?<img src={p.image_url} alt=""/>:<PackagePlus/>}<b>{ar?(p?.name_ar||x.product_id):(p?.name_en||p?.name_ar||x.product_id)}</b><em>× {x.quantity}</em></span>})}</div></div>}
          <div className="request-upload"><input id="request-files" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>uploadFiles(e.target.files)} disabled={readOnly||uploading||attachments.length>=8}/><label htmlFor="request-files"><span>{uploading?<LoaderCircle className="spin"/>:<UploadCloud/>}</span><strong>{ar?'أرنا المكان أو أرفق ملفًا':'Show us the space or attach a file'}</strong><small>{ar?'صور JPG/PNG/WebP أو PDF — حتى 15MB للملف':'JPG/PNG/WebP images or PDF — up to 15MB each'}</small></label></div>
          {attachments.length>0&&<div className="request-attachments">{attachments.map(a=><article key={a.id}>{a.mime_type?.startsWith('image/')&&a.url?<img src={a.url} alt=""/>:<FileText/>}<div><strong>{a.file_name}</strong><small>{a.size_bytes?`${(a.size_bytes/1024/1024).toFixed(1)} MB`:''}</small></div>{!readOnly&&<button onClick={()=>removeAttachment(a)}><Trash2/></button>}</article>)}</div>}
        </section>}

        {step===4&&<section className="request-step"><div className="request-step-head"><small>04</small><div><h3>{ar?'متى وضمن أي نطاق؟':'When and within what range?'}</h3><p>{ar?'الموعد والميزانية يساعداننا على اقتراح حل واقعي، والميزانية اختيارية.':'Timing and budget help us propose a realistic option; budget is optional.'}</p></div></div>
          <div className="request-choice-row">{[['nearest','أقرب وقت','Nearest'],['this_week','هذا الأسبوع','This week'],['exact','تاريخ محدد','Exact date']].map(([id,a,e])=><button disabled={readOnly} className={form.timing_mode===id?'selected':''} onClick={()=>patch('timing_mode',id)} key={id}><CalendarDays/>{ar?a:e}</button>)}</div>
          {form.timing_mode==='exact'&&<div className="request-two"><label className="request-field"><span>{ar?'التاريخ المطلوب':'Requested date'}</span><input disabled={readOnly} type="date" min={new Date().toISOString().slice(0,10)} value={form.requested_date||''} onChange={e=>patch('requested_date',e.target.value)}/></label><label className="request-field"><span>{ar?'الوقت المفضل':'Preferred time'}</span><input disabled={readOnly} value={form.preferred_time||''} onChange={e=>patch('preferred_time',e.target.value)} placeholder={ar?'مثال: 9–11 صباحًا':'Example: 9–11 AM'}/></label></div>}
          {form.service_type==='recurring'&&<div className="request-recurring-card"><header><RefreshCw/><div><strong>{ar?'إعداد التوريد الدوري':'Recurring supply setup'}</strong><small>{ar?'يُرسل كطلب ترتيب دوري، وليس إنشاء أوامر مستقبلية تلقائيًا.':'This requests a recurring arrangement; it does not create future orders automatically.'}</small></div></header><div className="request-two"><label className="request-field"><span>{ar?'التكرار':'Frequency'}</span><select disabled={readOnly} value={form.service_details.frequency||'weekly'} onChange={e=>patchNested('service_details','frequency',e.target.value)}><option value="weekly">{ar?'أسبوعي':'Weekly'}</option><option value="biweekly">{ar?'كل أسبوعين':'Every two weeks'}</option><option value="monthly">{ar?'شهري':'Monthly'}</option><option value="custom">{ar?'مخصص':'Custom'}</option></select></label><label className="request-field"><span>{ar?'المدة التقريبية بالأشهر':'Approx. duration in months'}</span><input disabled={readOnly} type="number" min="1" max="36" value={form.service_details.duration_months||''} onChange={e=>patchNested('service_details','duration_months',e.target.value)}/></label></div><label className="request-toggle"><input disabled={readOnly} type="checkbox" checked={!!form.service_details.fixed_quantity} onChange={e=>patchNested('service_details','fixed_quantity',e.target.checked)}/><span><b>{ar?'الكمية ثابتة في كل دورة':'Fixed quantity each cycle'}</b><small>{ar?'يمكن لفريق بلقيس اقتراح آلية مختلفة بعد المراجعة.':'Balqees can recommend a different arrangement after review.'}</small></span></label></div>}
          <h4 className="request-subtitle">{ar?'الميزانية التقديرية':'Indicative budget'}</h4><div className="request-choice-row">{[['unspecified','بدون ميزانية','No budget'],['range','نطاق تقريبي','Range'],['exact','مبلغ محدد','Exact amount']].map(([id,a,e])=><button disabled={readOnly} className={form.budget_mode===id?'selected':''} onClick={()=>patch('budget_mode',id)} key={id}><CircleDollarSign/>{ar?a:e}</button>)}</div>
          {form.budget_mode==='range'&&<div className="request-budget-ranges">{['أقل من 5,000','5,000 – 10,000','10,000 – 25,000','25,000+'].map(v=><button disabled={readOnly} className={form.budget_range===v?'selected':''} onClick={()=>patch('budget_range',v)} key={v}>{v} {ar?'ر.س':'SAR'}</button>)}</div>}
          {form.budget_mode==='exact'&&<label className="request-field narrow"><span>{ar?'المبلغ التقريبي':'Approximate amount'}</span><input disabled={readOnly} type="number" min="0" value={form.budget_amount||''} onChange={e=>patch('budget_amount',e.target.value)} placeholder="0"/></label>}
          <p className="request-hint">{ar?'الميزانية للتوجيه فقط ولا تعتبر سعرًا أو التزامًا حتى يصدر عرض رسمي من بلقيس.':'Budget is guidance only and is not a price or commitment until Balqees issues an official quotation.'}</p>
        </section>}

        {step===5&&<section className="request-step"><div className="request-step-head"><small>05</small><div><h3>{ar?'تفاصيل الوصول والمشتريات':'Access & procurement details'}</h3><p>{ar?'هذه التفاصيل تمنع التأخير عند البوابات والموافقات الداخلية.':'These details prevent delays at gates and internal procurement.'}</p></div></div>
          <div className="request-section-card"><header><MapPinned/><div><strong>{ar?'الوصول للموقع':'Site access'}</strong><small>{ar?'اختياري لكنه مهم للتنفيذ الميداني':'Optional, but valuable for field execution'}</small></div></header><div className="request-two"><label className="request-field"><span>{ar?'البوابة / نقطة الدخول':'Gate / entry point'}</span><input disabled={readOnly} value={form.access_details.gate||''} onChange={e=>patchNested('access_details','gate',e.target.value)}/></label><label className="request-field"><span>{ar?'منطقة التحميل':'Loading dock'}</span><input disabled={readOnly} value={form.access_details.loading_dock||''} onChange={e=>patchNested('access_details','loading_dock',e.target.value)}/></label><label className="request-field"><span>{ar?'مسؤول الاستلام':'Receiving contact'}</span><input disabled={readOnly} value={form.access_details.receiver_name||''} onChange={e=>patchNested('access_details','receiver_name',e.target.value)}/></label><label className="request-field"><span>{ar?'رقم التواصل':'Contact number'}</span><input disabled={readOnly} value={form.access_details.receiver_phone||''} onChange={e=>patchNested('access_details','receiver_phone',e.target.value)}/></label><label className="request-field"><span>{ar?'ساعات الدخول':'Access hours'}</span><input disabled={readOnly} value={form.access_details.access_hours||''} onChange={e=>patchNested('access_details','access_hours',e.target.value)}/></label><label className="request-toggle"><input disabled={readOnly} type="checkbox" checked={!!form.access_details.permit_required} onChange={e=>patchNested('access_details','permit_required',e.target.checked)}/><span><b>{ar?'يتطلب تصريح دخول':'Entry permit required'}</b><small>{ar?'سيتعامل الفريق مع الطلب على هذا الأساس.':'The team will plan accordingly.'}</small></span></label></div><label className="request-field"><span>{ar?'تعليمات إضافية':'Additional access notes'}</span><textarea disabled={readOnly} rows="3" value={form.access_details.notes||''} onChange={e=>patchNested('access_details','notes',e.target.value)}/></label></div>
          <div className="request-section-card"><header><FileText/><div><strong>{ar?'بيانات المشتريات':'Procurement details'}</strong><small>{procurement.po_mode==='required'?(ar?'رقم أمر الشراء مطلوب في منشأتكم':'PO number is required by your organization'):(ar?'املأ ما تستخدمه منشأتكم فقط':'Fill only what your organization uses')}</small></div></header><div className="request-two"><label className="request-field"><span>{ar?'رقم أمر الشراء PO':'PO number'} {procurement.po_mode==='required'&&<em>*</em>}</span><input disabled={readOnly} value={form.procurement_details.po_number||''} onChange={e=>patchNested('procurement_details','po_number',e.target.value)}/></label>{procurement.department_enabled!==false&&<label className="request-field"><span>{ar?'القسم':'Department'}</span><input disabled={readOnly} value={form.procurement_details.department||''} onChange={e=>patchNested('procurement_details','department',e.target.value)}/></label>}{procurement.cost_center_enabled!==false&&<label className="request-field"><span>{ar?'مركز التكلفة':'Cost center'}</span><input disabled={readOnly} value={form.procurement_details.cost_center||''} onChange={e=>patchNested('procurement_details','cost_center',e.target.value)}/></label>}{procurement.internal_reference_enabled!==false&&<label className="request-field"><span>{ar?'المرجع الداخلي':'Internal reference'}</span><input disabled={readOnly} value={form.procurement_details.internal_reference||''} onChange={e=>patchNested('procurement_details','internal_reference',e.target.value)}/></label>}<label className="request-field"><span>{ar?'اسم مقدم الطلب':'Requester'}</span><input disabled={readOnly} value={form.procurement_details.requester||''} onChange={e=>patchNested('procurement_details','requester',e.target.value)}/></label></div></div>
        </section>}

        {step===6&&<section className="request-step review"><div className="request-step-head"><small>06</small><div><h3>{ar?'راجع الطلب قبل الإرسال':'Review before submission'}</h3><p>{ar?'هذه هي الصورة التي سيبدأ منها فريق بلقيس.':'This is the exact brief the Balqees team will receive.'}</p></div></div>
          <div className="request-review-hero"><div><span><ServiceIcon/></span><div><small>{ar?'الخدمة':'Service'}</small><strong>{service?(ar?service[2]:service[3]):'—'}</strong><p>{site?(ar?site.name_ar:(site.name_en||site.name_ar)):'—'} · {AREAS.find(x=>x[0]===form.service_area)?.[ar?1:2]||form.service_area_custom||'—'}</p></div></div><button disabled={readOnly} onClick={()=>setStep(1)}>{ar?'تعديل':'Edit'}</button></div>
          <div className="request-review-grid"><article><CalendarDays/><span><small>{ar?'الموعد':'Timing'}</small><strong>{form.timing_mode==='exact'?form.requested_date:form.timing_mode==='this_week'?(ar?'هذا الأسبوع':'This week'):(ar?'أقرب وقت':'Nearest')}</strong></span><button disabled={readOnly} onClick={()=>setStep(4)}>{ar?'تعديل':'Edit'}</button></article><article><ImagePlus/><span><small>{ar?'المرفقات':'Attachments'}</small><strong>{attachments.length} {ar?'ملف':'file(s)'}</strong></span><button disabled={readOnly} onClick={()=>setStep(3)}>{ar?'تعديل':'Edit'}</button></article><article><Layers3/><span><small>{ar?'عناصر الكتالوج':'Catalog items'}</small><strong>{effectiveCount}</strong></span><button disabled={readOnly} onClick={()=>setStep(3)}>{ar?'تعديل':'Edit'}</button></article><article><ShieldCheck/><span><small>{ar?'الجاهزية':'Readiness'}</small><strong>{readiness}%</strong></span></article></div>
          <div className="request-review-description"><header><strong>{ar?'وصف الاحتياج':'Request brief'}</strong><button disabled={readOnly} onClick={()=>setStep(3)}>{ar?'تعديل':'Edit'}</button></header><p>{form.description||'—'}</p></div>
          {['supply','vases','space_design','maintenance','recurring'].includes(form.service_type)&&<div className="request-review-description"><header><strong>{ar?'تفاصيل الخدمة':'Service details'}</strong><button disabled={readOnly} onClick={()=>setStep(1)}>{ar?'تعديل':'Edit'}</button></header><div className="request-review-detail-list">
            {['supply','vases'].includes(form.service_type)&&<><span><small>{ar?'الخامة / التفضيل':'Material preference'}</small><b>{form.service_details.material_preference==='unspecified'||!form.service_details.material_preference?'—':form.service_details.material_preference}</b></span><span><small>{ar?'الكمية / النطاق':'Quantity / scope'}</small><b>{form.service_details.approximate_quantity||'—'}</b></span></>}
            {form.service_type==='space_design'&&<><span><small>{ar?'المساحة':'Approx. area'}</small><b>{form.service_details.space_size||'—'}</b></span><span><small>{ar?'الطابع':'Preferred style'}</small><b>{form.service_details.preferred_style||'—'}</b></span></>}
            {form.service_type==='maintenance'&&<span><small>{ar?'محور العناية':'Maintenance focus'}</small><b>{form.service_details.maintenance_focus||'—'}</b></span>}
            {form.service_type==='recurring'&&<><span><small>{ar?'التكرار':'Frequency'}</small><b>{({weekly:ar?'أسبوعي':'Weekly',biweekly:ar?'كل أسبوعين':'Every two weeks',monthly:ar?'شهري':'Monthly',custom:ar?'مخصص':'Custom'})[form.service_details.frequency]||'—'}</b></span><span><small>{ar?'المدة':'Duration'}</small><b>{form.service_details.duration_months?`${form.service_details.duration_months} ${ar?'شهر':'month(s)'}`:'—'}</b></span></>}
          </div></div>}
          <h4 className="request-subtitle">{ar?'كيف تريد أن نبدأ؟':'How should we start?'}</h4><div className="request-goal-grid">{[['review','مراجعة الطلب','Review request','يراجع الفريق الاحتياج ويتواصل عند الحاجة.'],['quotation','عرض سعر أولًا','Quotation first','يبدأ الفريق بتجهيز عرض سعر بناءً على البيانات.'],['proposal','مقترح قبل التسعير','Proposal before pricing','نبدأ بمقترح أو تصور قبل الدخول في التسعير.']].map(([id,a,e,d])=><button disabled={readOnly} className={form.submission_goal===id?'selected':''} onClick={()=>patch('submission_goal',id)} key={id}><CheckCircle2/><strong>{ar?a:e}</strong><small>{ar?d:({review:'The team reviews the need and follows up if needed.',quotation:'Start with a quotation based on the brief.',proposal:'Start with a concept before pricing.'}[id])}</small></button>)}</div>
          <div className="request-priority"><label className="request-toggle"><input disabled={readOnly} type="checkbox" checked={form.priority==='priority_review'} onChange={e=>patch('priority',e.target.checked?'priority_review':'normal')}/><span><b>{ar?'طلب مراجعة أولوية':'Request priority review'}</b><small>{ar?'لا يعني وعدًا بموعد تنفيذ؛ هو طلب للفريق لمراجعة الحالة بأولوية.':'This does not promise an execution time; it asks the team to prioritize review.'}</small></span></label>{form.priority==='priority_review'&&<input disabled={readOnly} value={form.priority_reason||''} onChange={e=>patch('priority_reason',e.target.value)} placeholder={ar?'ما سبب الأولوية؟ مثال: افتتاح الفندق يوم…':'Why is priority review needed?'}/>}</div>
          {!readOnly&&<button className="request-submit" onClick={submit} disabled={saving}><span>{saving?<LoaderCircle className="spin"/>:<Flower2/>}</span><div><strong>{ar?'إرسال الطلب إلى بلقيس':'Send request to Balqees'}</strong><small>{ar?'سيتم قفل المسودة بعد الإرسال للحفاظ على سجل واضح.':'The draft locks after submission to preserve a clean record.'}</small></div><ArrowLeft/></button>}
        </section>}

        {!readOnly&&<footer className="request-footer-actions"><button className="client-secondary" onClick={back} disabled={step===1}>{ar?<ChevronRight/>:<ChevronLeft/>}{ar?'السابق':'Back'}</button><div className="request-save-state">{saving?<><LoaderCircle className="spin"/>{ar?'جاري الحفظ…':'Saving…'}</>:savedAt?<><Check/>{ar?'تم الحفظ تلقائيًا':'Autosaved'}</>:request?.id?<><Save/>{ar?'المسودة محفوظة':'Draft saved'}</>:null}</div>{step<6?<button className="client-primary" onClick={next}>{ar?'التالي':'Next'}{ar?<ChevronLeft/>:<ChevronRight/>}</button>:<button className="client-secondary" onClick={()=>saveDraft(false)}><Save/>{ar?'حفظ المسودة':'Save draft'}</button>}</footer>}
      </main>
    </div>

    {helperOpen&&<div className="request-modal-backdrop" onMouseDown={()=>setHelperOpen(false)}><div className="request-helper" onMouseDown={e=>e.stopPropagation()}><button className="request-helper-close" onClick={()=>setHelperOpen(false)}><X/></button><span className="request-helper-icon"><WandSparkles/></span><h3>{ar?'مساعد صياغة الاحتياج':'Brief helper'}</h3><p>{ar?'جاوب باختصار وسنرتب الإجابات في وصف واضح يمكنك تعديله قبل الحفظ.':'Answer briefly and we will structure it into an editable brief.'}</p><label><span>{ar?'ما الهدف؟':'What is the goal?'}</span><input value={helper.purpose} onChange={e=>setHelper(h=>({...h,purpose:e.target.value}))}/></label><label><span>{ar?'ما الطابع المطلوب؟':'Preferred style?'}</span><input value={helper.style} onChange={e=>setHelper(h=>({...h,style:e.target.value}))}/></label><label><span>{ar?'كمية أو نطاق تقريبي؟':'Approximate quantity or scope?'}</span><input value={helper.quantity} onChange={e=>setHelper(h=>({...h,quantity:e.target.value}))}/></label><label><span>{ar?'أي ملاحظة مهمة؟':'Anything important?'}</span><textarea rows="3" value={helper.notes} onChange={e=>setHelper(h=>({...h,notes:e.target.value}))}/></label><button className="client-primary wide" onClick={generateBrief}><Sparkles/>{ar?'إنشاء وصف منظم':'Build structured brief'}</button></div></div>}
  </div>;
}
