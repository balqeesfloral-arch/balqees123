import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, LoaderCircle, RefreshCw, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { QUOTE_STATUSES, quoteServiceLabel, quoteStatusLabel, quoteError } from '../../lib/quoteRequests';
import useAdminLiveRefresh from '../useAdminLiveRefresh';
import '../../pages/requestQuote.css';

const WATCHED=['quote_requests'];
const blank={status:'in_review',reply:'',amount:'',valid_until:''};
export default function AdminQuoteRequests({lang}) {
  const ar=lang==='ar',[params,setParams]=useSearchParams();
  const selectedId=params.get('request');
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[form,setForm]=useState(blank);
  const [saving,setSaving]=useState(false),[notice,setNotice]=useState('');
  const sequence=useRef(0),pending=useRef(false),editingVersion=useRef(null);
  const load=useCallback(async()=>{
    const turn=++sequence.current;setLoading(true);
    const {data,error:e}=await supabase.from('quote_requests').select('*').order('created_at',{ascending:false}).limit(250);
    if(turn!==sequence.current)return;
    if(e)setError(ar?'تعذر تحميل طلبات عروض الأسعار. أعد المحاولة.':'Could not load quotation requests. Please retry.');
    else {setRows(data||[]);setError('');}
    setLoading(false);
  },[ar]);
  useEffect(()=>{load();return()=>{sequence.current++;};},[load]);
  useAdminLiveRefresh(load,WATCHED);
  const selected=rows.find(r=>r.id===selectedId);
  // Keep a draft reply through realtime refreshes. Its original version is sent
  // to the server, which rejects a conflicting edit from another administrator.
  useEffect(()=>{
    if(!selected)return;
    editingVersion.current=selected.updated_at;
    setForm({status:selected.status==='submitted'?'in_review':selected.status,reply:selected.admin_reply||'',amount:selected.quote_amount??'',valid_until:selected.quote_valid_until||''});setNotice('');
  },[selected?.id]);
  const visible=rows.filter(r=>(filter==='all'||r.status===filter)&&`${r.request_number} ${r.contact_name} ${r.phone} ${r.location} ${quoteServiceLabel(r.service_type,ar)} ${r.description}`.toLowerCase().includes(query.trim().toLowerCase()));
  const choose=id=>{setParams({request:id});setError('');};
  const patch=(key,value)=>setForm(f=>({...f,[key]:value}));
  async function save(event) {
    event.preventDefault();if(!selected||pending.current)return;
    if(form.status==='quoted'&&(!Number.isFinite(Number(form.amount))||Number(form.amount)<=0)){setError(ar?'أدخل إجمالي عرض السعر أكبر من صفر.':'Enter a quotation total greater than zero.');return;}
    if(['quoted','needs_info'].includes(form.status)&&form.reply.trim().length<3){setError(ar?'اكتب ردًا للعميل.':'Write a reply to the customer.');return;}
    pending.current=true;setSaving(true);setError('');setNotice('');
    try{
      const {data,error:e}=await supabase.rpc('admin_review_quote_request',{p_id:selected.id,p_status:form.status,p_reply:form.reply.trim()||null,p_amount:form.status==='quoted'?Number(form.amount):null,p_valid_until:form.status==='quoted'?form.valid_until||null:null,p_expected_updated_at:editingVersion.current});
      if(e||!data?.id){setError(quoteError(e,ar));return;}
      editingVersion.current=data.updated_at;setRows(v=>v.map(r=>r.id===data.id?data:r));
      setNotice(ar?'تم حفظ الرد وإرسال إشعار إلى حساب العميل.':'Reply saved and a notification sent to the customer.');
    }catch(e){setError(quoteError(e,ar));}finally{setSaving(false);pending.current=false;}
  }
  function reloadSelected(){if(!selected)return;editingVersion.current=selected.updated_at;setForm({status:selected.status==='submitted'?'in_review':selected.status,reply:selected.admin_reply||'',amount:selected.quote_amount??'',valid_until:selected.quote_valid_until||''});setError('');}
  return <div className="admin-page" dir={ar?'rtl':'ltr'}>
    <header className="admin-page-head"><div><span><ClipboardList size={17}/>{ar?'الخدمات والمنتجات المتغيرة السعر':'SERVICES & VARIABLE PRICING'}</span><h2>{ar?'طلبات عروض الأسعار':'Quotation requests'}</h2><p>{ar?'عقود الورد الأسبوعية والشهرية، الصيانة وطلبات تسعير المنتجات. أحدث ٢٥٠ طلبًا.':'Weekly and monthly flower contracts, maintenance and product pricing requests. Latest 250 requests.'}</p></div><button className="admin-secondary-button" onClick={load} disabled={loading}><RefreshCw size={17}/>{ar?'تحديث':'Refresh'}</button></header>
    <div className="admin-rfq-tools"><input aria-label={ar?'بحث في طلبات عروض الأسعار':'Search quotation requests'} value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'اسم العميل، الجوال، رقم الطلب…':'Customer, phone, request number…'}/><select aria-label={ar?'حالة طلب عرض السعر':'Quotation request status'} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{ar?'كل الحالات':'All statuses'}</option>{QUOTE_STATUSES.map(([id,a,en])=><option key={id} value={id}>{ar?a:en}</option>)}</select><b>{visible.length} {ar?'طلب':'requests'}</b></div>
    {error&&<div className="rfq-error" role="alert">{error}</div>}{notice&&<div className="rfq-reply" role="status">{notice}</div>}
    {loading&&!rows.length?<p><LoaderCircle className="spin"/>{ar?'تحميل الطلبات…':'Loading requests…'}</p>:<div className="admin-rfq-grid"><section className="admin-rfq-list">{visible.length?visible.map(row=><button key={row.id} className={row.id===selectedId?'selected':''} onClick={()=>choose(row.id)}><small>RFQ #{row.request_number} · {new Date(row.created_at).toLocaleDateString(ar?'ar-SA':'en-GB')}</small><strong>{quoteServiceLabel(row.service_type,ar)}</strong><span>{row.contact_name} · {row.location}</span><span className={`rfq-status ${row.status}`}>{quoteStatusLabel(row.status,ar)}</span></button>):<div className="admin-empty-state"><ClipboardList size={30}/><strong>{ar?'لا توجد طلبات مطابقة':'No matching requests'}</strong><p>{ar?'ستظهر الطلبات هنا فور إرسالها من صفحة الخدمات أو المتجر.':'Requests appear here when submitted from services or the store.'}</p></div>}</section>
      {selected?<section className="admin-rfq-detail"><small>RFQ #{selected.request_number}</small><h3>{quoteServiceLabel(selected.service_type,ar)}</h3><dl><dt>{ar?'جهة التواصل':'Contact'}</dt><dd>{selected.contact_name}</dd><dt>{ar?'الجوال':'Phone'}</dt><dd><a href={`tel:${selected.phone}`} dir="ltr">{selected.phone}</a></dd><dt>{ar?'البريد':'Email'}</dt><dd>{selected.email?<a href={`mailto:${selected.email}`}>{selected.email}</a>:'—'}</dd><dt>{ar?'الموقع':'Location'}</dt><dd>{selected.location}</dd><dt>{ar?'الموعد المفضل':'Preferred date'}</dt><dd>{selected.preferred_date||'—'}</dd><dt>{ar?'الجدول':'Schedule'}</dt><dd>{({weekly:ar?'أسبوعي':'Weekly',monthly:ar?'شهري':'Monthly',once:ar?'مرة واحدة':'One time',custom:ar?'حسب الاتفاق':'Custom'})[selected.frequency]||'—'} {selected.duration_months?`· ${selected.duration_months} ${ar?'شهر':'months'}`:''}</dd><dt>{ar?'الاحتياج':'Brief'}</dt><dd>{selected.description}</dd></dl>
        {!!selected.product_snapshot?.length&&<div className="rfq-products">{selected.product_snapshot.map(item=><article key={item.product_id}>{item.image_url&&<img src={item.image_url} alt=""/>}<div><strong>{ar?item.name_ar:item.name_en||item.name_ar}</strong><small>{item.sku} · {item.price_on_request?(ar?'طلب عرض سعر':'Quotation required'):(ar?'سعر محدد':'Fixed pricing')}</small></div><b>{item.quantity} {ar?item.unit_ar:item.unit_en}</b></article>)}</div>}
        {selected.status==='closed'?<div className="rfq-reply"><strong>{ar?'طلب مغلق':'Closed request'}</strong><p>{selected.admin_reply||'—'}</p></div>:<form className="rfq-form" onSubmit={save}><label>{ar?'حالة الطلب':'Request status'}<select value={form.status} onChange={e=>patch('status',e.target.value)}>{QUOTE_STATUSES.filter(s=>s[0]!=='submitted').map(([id,a,en])=><option key={id} value={id}>{ar?a:en}</option>)}</select></label><label>{ar?'الرد للعميل ونطاق العرض':'Customer reply & quotation scope'}<textarea rows="5" maxLength="4000" required={['quoted','needs_info'].includes(form.status)} value={form.reply} onChange={e=>patch('reply',e.target.value)} placeholder={ar?'وضح النطاق والكميات والضريبة والتوريد وشروط التنفيذ، أو التفاصيل المطلوبة.':'Specify scope, quantities, tax, delivery, execution terms or additional information needed.'}/></label>{form.status==='quoted'&&<div className="rfq-field-grid"><label>{ar?'إجمالي عرض السعر (ر.س)':'Quotation total (SAR)'}<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>patch('amount',e.target.value)}/></label><label>{ar?'صالح حتى (اختياري)':'Valid until (optional)'}<input type="date" value={form.valid_until} onChange={e=>patch('valid_until',e.target.value)}/></label></div>}<small>{ar?'الرد والمبلغ يظهران للعميل مع إشعار في حسابه. وضّح في الرد ما يشمله الإجمالي.':'The reply and amount appear in the customer account with a notification. State what the total includes.'}</small><button type="submit" className="admin-primary-button" disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:<Send size={17}/>} {ar?'حفظ وإشعار العميل':'Save & notify customer'}</button><button type="button" className="admin-secondary-button" onClick={reloadSelected} disabled={saving}>{ar?'تحميل آخر رد محفوظ':'Load latest saved reply'}</button></form>}
      </section>:<section className="admin-rfq-detail"><ClipboardList size={32}/><h3>{ar?'اختر طلبًا لمراجعته':'Select a request to review'}</h3><p>{ar?'راجع تفاصيل الخدمة أو المنتجات ثم رد على العميل من هنا.':'Review service or product details and reply to the customer here.'}</p></section>}
    </div>}
  </div>;
}
