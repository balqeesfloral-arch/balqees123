import { useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, BellRing, CalendarClock, Check, CircleAlert, Clock3, Eye, Filter,
  Mail, Plus, RefreshCw, Send, ShieldCheck, Smartphone, TriangleAlert, UsersRound, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { dateTime } from '../adminUtils';
import '../notification-operations.css';

const blank={
  title_ar:'',title_en:'',body_ar:'',body_en:'',audience:'organization',organization_id:'',user_id:'',
  category:'system',priority:'normal',action_url:'',action_label_ar:'',action_label_en:'',action_required:false,
  action_key:'',entity_type:'',entity_id:'',channels:['in_app'],scheduled_at:'',
};
const CHANNELS=[['in_app','داخل البوابة','In-app'],['push','Push','Push'],['email','البريد','Email'],['whatsapp','واتساب','WhatsApp']];

export default function AdminNotifications({lang,onRefreshBadges}){
  const ar=lang==='ar'; const [rows,setRows]=useState([]); const[orgs,setOrgs]=useState([]); const[users,setUsers]=useState([]); const[members,setMembers]=useState([]);
  const [loading,setLoading]=useState(true); const[filter,setFilter]=useState('all'); const[form,setForm]=useState(null); const[saving,setSaving]=useState(false); const[msg,setMsg]=useState(null);

  async function load(){
    setLoading(true); setMsg(null);
    const [ops,o,u,m]=await Promise.all([
      supabase.rpc('admin_get_notification_operations_v1',{p_limit:300}),
      supabase.from('organizations').select('id,display_name,legal_name').order('display_name'),
      supabase.from('customer_profiles').select('id,full_name,email,account_type').order('full_name').limit(500),
      supabase.from('organization_members').select('organization_id,user_id,status').eq('status','active'),
    ]);
    if(!ops.error)setRows(Array.isArray(ops.data)?ops.data:[]);
    else{
      const fallback=await supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(300);
      setRows((fallback.data||[]).map(x=>({...x,recipient_count:0,delivered_count:0,pending_count:0,failed_count:0,read_count:0,action_state:x.action_required?'pending':'not_required'})));
    }
    setOrgs(o.data||[]);setUsers(u.data||[]);setMembers(m.data||[]);setLoading(false);onRefreshBadges?.();
  }
  useEffect(()=>{load();},[]);

  const stats=useMemo(()=>({
    action:rows.filter(x=>x.action_required&&!['completed'].includes(x.action_state)).length,
    failed:rows.reduce((s,x)=>s+Number(x.failed_count||0),0),
    scheduled:rows.filter(x=>x.status==='scheduled').length,
    today:rows.filter(x=>Date.now()-new Date(x.published_at||x.created_at||0).getTime()<86400000&&x.status==='published').length,
  }),[rows]);
  const shown=useMemo(()=>rows.filter(x=>{
    if(filter==='all')return true;
    if(filter==='action')return x.action_required&&x.action_state!=='completed';
    if(filter==='failed')return Number(x.failed_count||0)>0;
    if(filter==='scheduled')return x.status==='scheduled';
    if(filter==='manual')return x.metadata?.manual===true;
    return String(x.category||'')===filter;
  }),[rows,filter]);

  function toggleChannel(key){setForm(v=>({...v,channels:v.channels.includes(key)?v.channels.filter(x=>x!==key):[...v.channels,key]}));}
  async function submit(publishNow){
    if(!form)return; setSaving(true);setMsg(null);
    const scheduled=form.scheduled_at?new Date(form.scheduled_at).toISOString():null;
    const {error}=await supabase.rpc('admin_publish_notification_v1',{
      p_title_ar:form.title_ar,p_title_en:form.title_en||null,p_body_ar:form.body_ar,p_body_en:form.body_en||null,
      p_audience:form.audience,p_organization_id:['organization','user'].includes(form.audience)?(form.organization_id||null):null,p_user_id:form.audience==='user'?(form.user_id||null):null,
      p_category:form.category,p_priority:form.priority,p_action_url:form.action_url||null,p_action_label_ar:form.action_label_ar||null,p_action_label_en:form.action_label_en||null,
      p_action_required:form.action_required,p_action_key:form.action_required?(form.action_key||null):null,p_entity_type:form.entity_type||null,p_entity_id:form.entity_id||null,
      p_channels:form.channels.length?form.channels:['in_app'],p_scheduled_at:scheduled,p_publish_now:publishNow,
    });
    setSaving(false);
    if(error)return setMsg({type:'error',text:ar?'تعذر حفظ الإعلان. تحقق من الجمهور والرابط والحقول المطلوبة.':'Could not save the announcement. Check audience, deep link and required fields.'});
    setForm(null);setMsg({type:'success',text:publishNow?(ar?'تم إنشاء الحدث ونشر الإشعار.':'Event created and notification published.'):(scheduled?(ar?'تمت جدولة الإشعار.':'Notification scheduled.'):(ar?'تم حفظ المسودة.':'Draft saved.'))});load();
  }

  return <div className="admin-page notification-ops-page">
    <div className="admin-page-head"><div><span>{ar?'NOTIFICATION OPERATIONS':'NOTIFICATION OPERATIONS'}</span><h2>{ar?'مركز عمليات الإشعارات':'Notification Operations Center'}</h2><p>{ar?'راقب الحدث والمستلم والقناة والتسليم والقراءة والإجراء. القنوات الخارجية تبقى Pending حتى يتصل Adapter حقيقي بها.':'Inspect event, recipient, channel, delivery, read and action state. External channels remain Pending until a real provider adapter is connected.'}</p></div><div className="admin-head-actions"><button className="admin-secondary-button" onClick={load}><RefreshCw className={loading?'spin':''}/>{ar?'تحديث':'Refresh'}</button><button className="admin-primary-button" onClick={()=>setForm({...blank})}><Plus/>{ar?'إعلان / تنبيه جديد':'New announcement'}</button></div></div>

    {msg&&<div className={`notification-admin-msg ${msg.type}`}>{msg.type==='success'?<Check/>:<TriangleAlert/>}<span>{msg.text}</span><button onClick={()=>setMsg(null)}><X/></button></div>}

    <section className="notification-ops-stats">
      <OpStat icon={CircleAlert} value={stats.action} label={ar?'إجراءات معلقة':'Pending actions'} tone="attention"/>
      <OpStat icon={TriangleAlert} value={stats.failed} label={ar?'تسليم فشل':'Failed deliveries'} tone="danger"/>
      <OpStat icon={CalendarClock} value={stats.scheduled} label={ar?'مجدول':'Scheduled'}/>
      <OpStat icon={Activity} value={stats.today} label={ar?'نشر اليوم':'Published today'}/>
    </section>

    <section className="notification-ops-panel"><div className="notification-ops-toolbar"><div><Filter/><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>{ar?'الكل':'All'}</button><button className={filter==='action'?'active':''} onClick={()=>setFilter('action')}>{ar?'يحتاج إجراء':'Action required'}</button><button className={filter==='failed'?'active':''} onClick={()=>setFilter('failed')}>{ar?'فشل التسليم':'Failed'}</button><button className={filter==='scheduled'?'active':''} onClick={()=>setFilter('scheduled')}>{ar?'مجدول':'Scheduled'}</button><button className={filter==='manual'?'active':''} onClick={()=>setFilter('manual')}>{ar?'يدوي':'Manual'}</button></div><span>{shown.length} {ar?'سجل':'records'}</span></div>
      <div className="notification-ops-table"><header><span>{ar?'الإشعار':'Notification'}</span><span>{ar?'الجمهور':'Audience'}</span><span>{ar?'التسليم':'Delivery'}</span><span>{ar?'القراءة':'Read'}</span><span>{ar?'الإجراء':'Action'}</span><span>{ar?'الوقت':'Time'}</span></header>{shown.map(row=><OperationRow key={row.id} row={row} ar={ar} lang={lang} orgs={orgs}/>)}</div>
      {!loading&&!shown.length&&<div className="admin-empty-state"><Bell/><strong>{ar?'لا توجد سجلات ضمن هذا الفلتر':'No records match this filter'}</strong></div>}
    </section>

    <section className="notification-adapter-note"><ShieldCheck/><div><strong>{ar?'Event-first + Provider-agnostic':'Event-first + Provider-agnostic'}</strong><p>{ar?'قرار من يستلم، ومتى، وبأي أولوية يُحفظ داخل النظام. Push وEmail وiOS وAndroid مجرد Adapters تنفيذية لاحقًا، ولا تتحكم بمنطق العمل.':'Recipient, timing and priority live in the core engine. Push, Email, iOS and Android remain delivery adapters and never own business logic.'}</p></div></section>

    {form&&<Composer ar={ar} form={form} setForm={setForm} orgs={orgs} users={users} members={members} saving={saving} toggleChannel={toggleChannel} onSave={()=>submit(false)} onPublish={()=>submit(true)} onClose={()=>setForm(null)}/>} 
  </div>;
}

function OpStat({icon:Icon,value,label,tone=''}){return <div className={`notification-op-stat ${tone}`}><span><Icon/></span><div><strong>{value}</strong><small>{label}</small></div></div>}
function audienceLabel(row,ar,orgs){
  if(row.audience==='organization'){const o=orgs.find(x=>x.id===row.organization_id);return o?.display_name||o?.legal_name||(ar?'منشأة':'Organization');}
  if(row.audience==='user')return ar?'مستخدم محدد':'Specific user'; if(row.audience==='company')return ar?'كل المنشآت':'All organizations'; if(row.audience==='individual')return ar?'الأفراد':'Individuals'; return ar?'الجميع':'All users';
}
function OperationRow({row,ar,lang,orgs}){
  const total=Number(row.recipient_count||0);const delivered=Number(row.delivered_count||0);const failed=Number(row.failed_count||0);const pending=Number(row.pending_count||0);const read=Number(row.read_count||0);
  const action=row.action_required?(row.action_state==='completed'?(ar?'مكتمل':'Completed'):row.action_state==='partially_completed'?(ar?'جزئي':'Partial'):(ar?'معلق':'Pending')):(ar?'غير مطلوب':'Not required');
  return <article className={`notification-op-row ${failed?'has-failure':''}`}><div><small>{row.event_type||row.category||'notification'}</small><strong>{ar?row.title_ar:(row.title_en||row.title_ar)}</strong><p>{ar?row.body_ar:(row.body_en||row.body_ar)}</p><em>{row.priority||'normal'}</em></div><div><UsersRound/><span>{audienceLabel(row,ar,orgs)}</span><small>{total?`${total} ${ar?'مستلم':'recipient(s)'}`:''}</small></div><div className="delivery-pills"><i className="ok">{delivered} {ar?'وصل':'delivered'}</i>{pending>0&&<i>{pending} {ar?'معلق':'pending'}</i>}{failed>0&&<i className="bad">{failed} {ar?'فشل':'failed'}</i>}</div><div><Eye/><strong>{read}</strong><small>{ar?'قراءة مسجلة':'read receipt(s)'}</small></div><div><CircleAlert/><strong>{action}</strong><small>{row.action_key||'—'}</small></div><div><Clock3/><strong>{row.status}</strong><small>{dateTime(row.scheduled_at||row.published_at||row.created_at,lang)}</small></div></article>
}

function Composer({ar,form,setForm,orgs,users,members,saving,toggleChannel,onSave,onPublish,onClose}){
  return <div className="admin-modal-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="admin-modal notification-composer"><div className="admin-modal-head"><div><small>EVENT + DELIVERY COMPOSER</small><h3>{ar?'إنشاء تنبيه مؤسسي':'Create organization notification'}</h3></div><button onClick={onClose}><X/></button></div><div className="notification-composer-grid"><section><label>{ar?'العنوان بالعربية':'Arabic title'}<input value={form.title_ar} onChange={e=>setForm(v=>({...v,title_ar:e.target.value}))}/></label><label>{ar?'العنوان بالإنجليزية':'English title'}<input value={form.title_en} onChange={e=>setForm(v=>({...v,title_en:e.target.value}))}/></label><label>{ar?'النص بالعربية':'Arabic body'}<textarea rows="5" value={form.body_ar} onChange={e=>setForm(v=>({...v,body_ar:e.target.value}))}/></label><label>{ar?'النص بالإنجليزية':'English body'}<textarea rows="4" value={form.body_en} onChange={e=>setForm(v=>({...v,body_en:e.target.value}))}/></label></section><section><div className="admin-form-grid two"><label>{ar?'الجمهور':'Audience'}<select value={form.audience} onChange={e=>setForm(v=>({...v,audience:e.target.value}))}><option value="organization">{ar?'منشأة محددة':'Specific organization'}</option><option value="company">{ar?'كل المنشآت':'All organizations'}</option><option value="user">{ar?'مستخدم محدد':'Specific user'}</option></select></label><label>{ar?'الأولوية':'Priority'}<select value={form.priority} onChange={e=>setForm(v=>({...v,priority:e.target.value}))}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label></div>{['organization','user'].includes(form.audience)&&<label>{ar?'المنشأة':'Organization'}<select value={form.organization_id} onChange={e=>setForm(v=>({...v,organization_id:e.target.value}))}><option value="">{ar?'اختر المنشأة':'Choose organization'}</option>{orgs.map(o=><option value={o.id} key={o.id}>{o.display_name||o.legal_name}</option>)}</select></label>}{form.audience==='user'&&<label>{ar?'المستخدم':'User'}<select value={form.user_id} onChange={e=>setForm(v=>({...v,user_id:e.target.value}))}><option value="">{ar?'اختر المستخدم':'Choose user'}</option>{users.filter(u=>!form.organization_id||members.some(m=>m.organization_id===form.organization_id&&m.user_id===u.id)).map(u=><option key={u.id} value={u.id}>{u.full_name||u.email}</option>)}</select></label>}<div className="admin-form-grid two"><label>{ar?'التصنيف':'Category'}<select value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}><option value="orders">Orders</option><option value="quotations">Quotations</option><option value="finance">Finance</option><option value="contracts">Contracts</option><option value="care">Care</option><option value="security">Security</option><option value="system">System</option></select></label><label>{ar?'وقت الجدولة':'Schedule'}<input type="datetime-local" value={form.scheduled_at} onChange={e=>setForm(v=>({...v,scheduled_at:e.target.value}))}/></label></div><label>{ar?'Deep Link داخلي':'Internal deep link'}<input dir="ltr" placeholder="/portal/orders/..." value={form.action_url} onChange={e=>setForm(v=>({...v,action_url:e.target.value}))}/></label><div className="admin-form-grid two"><label>{ar?'entity_type':'Entity type'}<input dir="ltr" placeholder="order / quotation / contract" value={form.entity_type} onChange={e=>setForm(v=>({...v,entity_type:e.target.value}))}/></label><label>{ar?'entity_id':'Entity ID'}<input dir="ltr" placeholder="UUID" value={form.entity_id} onChange={e=>setForm(v=>({...v,entity_id:e.target.value}))}/></label></div><label className="notification-action-toggle"><input type="checkbox" checked={form.action_required} onChange={e=>setForm(v=>({...v,action_required:e.target.checked}))}/><span><strong>{ar?'يحتاج إجراء فعلي':'Requires a real action'}</strong><small>{ar?'لا يختفي من Action Required لمجرد القراءة.':'Reading will not clear it from Action Required.'}</small></span></label>{form.action_required&&<div className="admin-form-grid two"><label>{ar?'Action key':'Action key'}<select value={form.action_key} onChange={e=>setForm(v=>({...v,action_key:e.target.value}))}><option value="">—</option><option value="quotation_decision">quotation_decision</option><option value="contract_renewal">contract_renewal</option><option value="document_review">document_review</option><option value="care_reply">care_reply</option></select></label><label>{ar?'نص الزر':'Action label'}<input value={form.action_label_ar} onChange={e=>setForm(v=>({...v,action_label_ar:e.target.value}))}/></label></div>}<div className="notification-channel-picker"><small>{ar?'خطة القنوات':'CHANNEL PLAN'}</small>{CHANNELS.map(([k,a,e])=><button key={k} className={form.channels.includes(k)?'active':''} onClick={()=>toggleChannel(k)} type="button">{k==='email'?<Mail/>:k==='in_app'?<BellRing/>:<Smartphone/>}{ar?a:e}</button>)}</div><p className="notification-provider-warning"><ShieldCheck/>{ar?'اختيار Push/Email لا يعني أن المزود موصول. ستظهر القناة Pending حتى يرسل Adapter حقيقي ويحدّث Delivery Ledger.':'Selecting Push/Email does not pretend a provider is connected. The channel remains Pending until a real adapter sends it and updates the delivery ledger.'}</p></section></div><div className="admin-modal-actions split"><button className="admin-secondary-button" onClick={onClose}>{ar?'إلغاء':'Cancel'}</button><span><button className="admin-secondary-button" onClick={onSave} disabled={saving}><Check/>{form.scheduled_at?(ar?'جدولة':'Schedule'):(ar?'حفظ مسودة':'Save draft')}</button><button className="admin-primary-button" onClick={onPublish} disabled={saving}><Send/>{ar?'نشر الآن':'Publish now'}</button></span></div></div></div>
}
