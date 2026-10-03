import { useEffect, useMemo, useState } from 'react';
import {
  AlarmClock, Bell, BellRing, BrainCircuit, Check, CheckCheck, CheckCircle2, ChevronDown,
  CircleAlert, Clock3, Eye, FileText, Filter, Layers3, MessageSquareText, PackageSearch,
  Radio, ReceiptText, RefreshCw, ScrollText, Settings2, ShieldCheck, Sparkles, Star,
  StarOff, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useClientPortal } from '../ClientPortalContext';
import { fmtDate, safeUuid } from '../portalUtils';
import '../notification-action-center.css';

const nowIso=()=>new Date().toISOString();
const timeOf=(n)=>new Date(n.published_at||n.created_at||0).getTime();
const textOf=(n,ar,key)=>key==='title'?(ar?n.title_ar:(n.title_en||n.title_ar)):(ar?n.body_ar:(n.body_en||n.body_ar));
const isFuture=(v)=>v&&new Date(v).getTime()>Date.now();

function categoryMeta(category,ar){
  const key=String(category||'system').toLowerCase();
  const map={
    orders:[PackageSearch,'الطلبات','Orders'], order:[PackageSearch,'الطلبات','Orders'], quotations:[FileText,'عروض الأسعار','Quotations'],
    finance:[ReceiptText,'المالية','Finance'], documents:[ReceiptText,'المستندات','Documents'], payment:[ReceiptText,'المالية','Finance'],
    contracts:[ScrollText,'العقود','Contracts'], care:[MessageSquareText,'العناية','Care'], support:[MessageSquareText,'العناية','Care'],
    security:[ShieldCheck,'الأمان','Security'], system:[Bell,'النظام','System'], team:[ShieldCheck,'الفريق','Team'],
  };
  const row=map[key]||[Bell,'تحديث','Update']; return {Icon:row[0],label:ar?row[1]:row[2],key};
}

function deepLinkLabel(item,ar){
  if(ar&&item.action_label_ar)return item.action_label_ar;
  if(!ar&&item.action_label_en)return item.action_label_en;
  return ar?'فتح التفاصيل':'Open details';
}

function compactGroup(items){
  const m=new Map();
  items.forEach(item=>{
    const key=item.group_key||`${item.entity_type||item.category||'notification'}:${item.entity_id||item.id}`;
    const current=m.get(key);
    if(!current)m.set(key,{...item,_updates:[item]});
    else current._updates.push(item);
  });
  return [...m.values()].sort((a,b)=>timeOf(b)-timeOf(a));
}

export default function ClientNotifications(){
  const {lang,session,organization}=useClientPortal();
  const ar=lang==='ar'; const navigate=useNavigate();
  const [center,setCenter]=useState({items:[],unread_count:0,action_count:0,snoozed_count:0,away:{count:0}});
  const [loading,setLoading]=useState(true); const[refreshing,setRefreshing]=useState(false); const[busy,setBusy]=useState('');
  const [filter,setFilter]=useState('all'); const[notice,setNotice]=useState(null); const[ai,setAi]=useState(null); const[aiBusy,setAiBusy]=useState(false);

  async function fallbackLoad(){
    const [n,r]=await Promise.all([
      supabase.from('notifications').select('*').eq('organization_id',organization.id).order('published_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(200),
      supabase.from('notification_reads').select('*').eq('user_id',session.user.id),
    ]);
    const states=new Map((r.data||[]).map(x=>[String(x.notification_id),x]));
    const items=(n.data||[]).map(x=>({...x,...(states.get(String(x.id))||{}),action_resolved:Boolean(states.get(String(x.id))?.action_completed_at),action_available:true,followed:false}));
    return {items,unread_count:items.filter(x=>!x.read_at).length,action_count:items.filter(x=>x.action_required&&!x.action_resolved&&!isFuture(x.snoozed_until)).length,snoozed_count:items.filter(x=>isFuture(x.snoozed_until)).length,away:{count:0}};
  }

  async function load(silent=false){
    if(!organization?.id)return;
    silent?setRefreshing(true):setLoading(true); setNotice(null);
    const {data,error}=await supabase.rpc('get_my_b2b_notification_center_v1',{p_organization_id:organization.id});
    const next=!error&&data?data:await fallbackLoad();
    setCenter(next||{items:[],away:{count:0}});
    silent?setRefreshing(false):setLoading(false);
    if(error&&String(error.message||'').includes('get_my_b2b_notification_center_v1')===false)setNotice({type:'error',text:ar?'تعذر تحديث بعض بيانات مركز الإشعارات.':'Some notification center data could not be refreshed.'});
    supabase.rpc('mark_b2b_notification_center_seen_v1',{p_organization_id:organization.id}).then(()=>{});
  }

  useEffect(()=>{load();},[organization?.id,session?.user?.id]);
  useEffect(()=>{
    if(!organization?.id||!session?.user?.id||typeof window==='undefined')return;
    const key=`balqees-device-${session.user.id}-${organization.id}`;
    let id=localStorage.getItem(key);
    if(!id){id=safeUuid();localStorage.setItem(key,id);}
    const ua=navigator.userAgent||'';
    const platform=/iPad/i.test(ua)?'ipad':/iPhone/i.test(ua)?'iphone':/Android/i.test(ua)?'android':'web';
    const label=platform==='iphone'?'iPhone':platform==='ipad'?'iPad':platform==='android'?'Android':(ar?'متصفح الويب':'Web browser');
    (async()=>{
      const {data:existing}=await supabase.from('user_devices').select('id').eq('id',id).eq('user_id',session.user.id).maybeSingle();
      const passive={device_label:label,platform,provider:'web_push',user_agent:ua,last_seen_at:nowIso(),updated_at:nowIso()};
      if(existing?.id)await supabase.from('user_devices').update(passive).eq('id',id).eq('user_id',session.user.id);
      else await supabase.from('user_devices').insert({id,user_id:session.user.id,organization_id:organization.id,...passive,is_active:true});
    })().catch(()=>{});
  },[organization?.id,session?.user?.id,ar]);
  useEffect(()=>{
    if(!organization?.id)return;
    const ch=supabase.channel(`portal-notifications-${organization.id}-${session.user.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`organization_id=eq.${organization.id}`},()=>load(true))
      .on('postgres_changes',{event:'*',schema:'public',table:'notification_reads',filter:`user_id=eq.${session.user.id}`},()=>load(true))
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[organization?.id,session.user.id]);

  const items=useMemo(()=>Array.isArray(center.items)?center.items:[],[center.items]);
  const active=useMemo(()=>items.filter(x=>!isFuture(x.snoozed_until)),[items]);
  const actionItems=useMemo(()=>active.filter(x=>x.action_required&&!x.action_resolved).sort((a,b)=>(b.action_available?1:0)-(a.action_available?1:0)||timeOf(b)-timeOf(a)),[active]);
  const updateItems=useMemo(()=>active.filter(x=>!x.action_required||x.action_resolved),[active]);
  const grouped=useMemo(()=>compactGroup(updateItems),[updateItems]);
  const filters=useMemo(()=>[
    ['all',ar?'الكل':'All'],['orders',ar?'الطلبات':'Orders'],['finance',ar?'المالية':'Finance'],['contracts',ar?'العقود':'Contracts'],['care',ar?'العناية':'Care'],['security',ar?'الأمان':'Security'],['snoozed',ar?'مؤجل':'Snoozed'],
  ],[ar]);
  const filtered=useMemo(()=>{
    if(filter==='snoozed')return compactGroup(items.filter(x=>isFuture(x.snoozed_until)));
    if(filter==='all')return grouped;
    const aliases={orders:['orders','order','quotations'],finance:['finance','documents','payment'],contracts:['contracts'],care:['care','support'],security:['security','system','team']};
    return grouped.filter(x=>(aliases[filter]||[]).includes(String(x.category||'').toLowerCase()));
  },[filter,grouped,items]);
  const today=useMemo(()=>active.filter(x=>Date.now()-timeOf(x)<86400000),[active]);

  async function markRead(item){
    if(item.read_at)return;
    const {error}=await supabase.rpc('mark_b2b_notification_read_v1',{p_organization_id:organization.id,p_notification_id:item.id});
    if(error)await supabase.from('notification_reads').upsert({notification_id:item.id,user_id:session.user.id,read_at:nowIso()},{onConflict:'notification_id,user_id'});
    setCenter(v=>({...v,items:(v.items||[]).map(x=>x.id===item.id?{...x,read_at:x.read_at||nowIso()}:x),unread_count:Math.max(0,(v.unread_count||0)-1)}));
  }
  async function openItem(item){
    await markRead(item);
    if(item.action_url?.startsWith('/'))navigate(item.action_url);
  }
  async function markAll(){
    setBusy('all');
    for(const item of items.filter(x=>!x.read_at))await markRead(item);
    setBusy('');
  }
  function snoozeUntil(kind){
    const d=new Date();
    if(kind==='hour')d.setHours(d.getHours()+1);
    if(kind==='evening'){d.setHours(19,0,0,0);if(d<=new Date())d.setDate(d.getDate()+1);}
    if(kind==='tomorrow'){d.setDate(d.getDate()+1);d.setHours(9,0,0,0);}
    return d.toISOString();
  }
  async function snooze(item,kind){
    setBusy(`snooze-${item.id}`);const until=snoozeUntil(kind);
    const{error}=await supabase.rpc('snooze_b2b_notification_v1',{p_organization_id:organization.id,p_notification_id:item.id,p_until:until});
    setBusy('');
    if(error)return setNotice({type:'error',text:ar?'تعذر تأجيل هذا التنبيه.':'Could not snooze this notification.'});
    setCenter(v=>({...v,items:(v.items||[]).map(x=>x.id===item.id?{...x,snoozed_until:until,read_at:x.read_at||nowIso()}:x),snoozed_count:(v.snoozed_count||0)+1}));
    setNotice({type:'success',text:ar?'تم تأجيل التنبيه بدون تغيير حالة الطلب أو العرض.':'Notification snoozed without changing the business state.'});
  }
  async function follow(item){
    if(!item.entity_type||!item.entity_id)return;
    setBusy(`follow-${item.id}`);
    const next=!item.followed;
    const{error}=await supabase.rpc('follow_b2b_notification_entity_v1',{p_organization_id:organization.id,p_entity_type:item.entity_type,p_entity_id:item.entity_id,p_follow:next});
    setBusy('');
    if(error)return setNotice({type:'error',text:ar?'تعذر تحديث المتابعة.':'Could not update follow preference.'});
    setCenter(v=>({...v,items:(v.items||[]).map(x=>x.entity_type===item.entity_type&&x.entity_id===item.entity_id?{...x,followed:next}:x)}));
  }
  function localSummary(){
    if(!actionItems.length&&!today.length)return ar?'لا توجد قرارات أو تحديثات مهمة تحتاج انتباهك الآن.':'There are no important decisions or updates requiring your attention right now.';
    const pieces=[];
    if(actionItems.filter(x=>x.action_available).length)pieces.push(ar?`${actionItems.filter(x=>x.action_available).length} إجراء يحتاج قرارك`:`${actionItems.filter(x=>x.action_available).length} item(s) require your action`);
    const categories=new Set(today.map(x=>categoryMeta(x.category,ar).label));
    if(categories.size)pieces.push(ar?`تحديثات اليوم تشمل ${[...categories].slice(0,3).join('، ')}`:`Today's updates include ${[...categories].slice(0,3).join(', ')}`);
    return pieces.join(ar?'، و':'; ')+'.';
  }
  async function summarize(){
    setAiBusy(true);setAi(null);
    try{
      const{data,error}=await supabase.functions.invoke('balqees-care',{body:{mode:'notification_summary',organization_id:organization.id,language:lang}});
      if(!error&&data?.summary)setAi({source:'ai',text:data.summary});else setAi({source:'local',text:localSummary()});
    }catch{setAi({source:'local',text:localSummary()});}
    setAiBusy(false);
  }

  if(loading)return <div className="notification-center-loading"><Sparkles className="spin"/><strong>{ar?'نجمع ما يحتاج انتباهك…':'Preparing your action center…'}</strong></div>;

  return <div className="client-page notification-action-center">
    <header className="client-page-head notification-head"><div><span><BellRing/>{ar?'مركز التنبيهات والقرارات':'ACTION & NOTIFICATION CENTER'}</span><h2>{ar?'التنبيهات':'Notifications'}</h2><p>{ar?'تابع ما يحتاج انتباهك.' : 'See what needs your attention.'}</p></div><div><button className="client-secondary" onClick={()=>load(true)} disabled={refreshing}><RefreshCw className={refreshing?'spin':''}/>{ar?'تحديث':'Refresh'}</button><button className="client-secondary" onClick={markAll} disabled={!center.unread_count||busy==='all'}><CheckCheck/>{ar?'قراءة الكل':'Mark read'}</button><button className="client-primary" onClick={summarize} disabled={aiBusy}><BrainCircuit/>{aiBusy?(ar?'ألخّص…':'Summarizing…'):(ar?'لخّص لي المهم':'Summarize what matters')}</button></div></header>

    {notice&&<div className={`notification-inline ${notice.type}`}>{notice.type==='success'?<Check/>:<CircleAlert/>}<span>{notice.text}</span><button onClick={()=>setNotice(null)}><X/></button></div>}

    <section className="notification-command-strip">
      <Metric icon={CircleAlert} value={center.action_count||0} label={ar?'يحتاج إجراء منك':'Requires your action'} emphasis/>
      <Metric icon={BellRing} value={center.unread_count||0} label={ar?'غير مقروء':'Unread'}/>
      <Metric icon={AlarmClock} value={center.snoozed_count||0} label={ar?'مؤجل':'Snoozed'}/>
      <Metric icon={Radio} value={today.length} label={ar?'تحديث خلال 24 ساعة':'Updates in 24h'}/>
    </section>

    {ai&&<section className="notification-ai-summary"><span><BrainCircuit/></span><div><small>{ai.source==='ai'?(ar?'ملخص ذكي مبني على بياناتك المصرح بها':'AI SUMMARY · AUTHORIZED DATA ONLY'):(ar?'ملخص محلي آمن':'SAFE LOCAL SUMMARY')}</small><p>{ai.text}</p></div><button onClick={()=>setAi(null)}><X/></button></section>}

    {(center.away?.count||0)>0&&<section className="notification-away"><div><span><Clock3/>{ar?'بينما كنت بعيدًا':'WHILE YOU WERE AWAY'}</span><h3>{ar?`${center.away.count} تحديث منذ آخر زيارة`:`${center.away.count} update(s) since your last visit`}</h3></div><div className="notification-away-stats"><b>{center.away.orders||0}<small>{ar?'طلبات':'Orders'}</small></b><b>{center.away.finance||0}<small>{ar?'مالية':'Finance'}</small></b><b>{center.away.contracts||0}<small>{ar?'عقود':'Contracts'}</small></b><b>{center.away.decisions||0}<small>{ar?'قرارات':'Decisions'}</small></b></div></section>}

    <section className="notification-action-section">
      <div className="notification-section-title"><div><span><CircleAlert/></span><div><small>{ar?'ACTION REQUIRED':'ACTION REQUIRED'}</small><h3>{ar?'يحتاج منك إجراء':'Requires your action'}</h3></div></div><em>{actionItems.length}</em></div>
      {actionItems.length?<div className="notification-action-grid">{actionItems.map(item=><ActionCard key={item.id} item={item} ar={ar} lang={lang} busy={busy} onOpen={openItem} onSnooze={snooze} onFollow={follow}/>)}</div>:<div className="notification-clear-state"><CheckCircle2/><div><strong>{ar?'كل شيء مرتب ✓':'Everything is in order ✓'}</strong><p>{ar?'لا توجد إجراءات مطلوبة منك حاليًا.':'There are no actions required from you right now.'}</p></div></div>}
    </section>

    <section className="notification-daily"><div><span><Layers3/>{ar?'ملخص اليوم':'TODAY AT A GLANCE'}</span><h3>{ar?'اليوم في سطر واحد':'Today, without the noise'}</h3></div><p>{localSummary()}</p></section>

    <section className="notification-feed-section">
      <div className="notification-feed-head"><div><small>{ar?'LIVE FEED':'LIVE FEED'}</small><h3>{ar?'الآن':'Now'}</h3></div><button className="client-secondary" onClick={()=>navigate('/portal/settings?tab=notifications')}><Settings2/>{ar?'إعدادات التنبيهات':'Notification settings'}</button></div>
      <div className="notification-filters"><Filter/>{filters.map(([k,l])=><button key={k} className={filter===k?'active':''} onClick={()=>setFilter(k)}>{l}{k==='snoozed'&&center.snoozed_count>0?<b>{center.snoozed_count}</b>:null}</button>)}</div>
      {filtered.length?<div className="notification-feed">{filtered.map(item=><NotificationThread key={`${item.group_key||item.id}`} item={item} ar={ar} lang={lang} busy={busy} onOpen={openItem} onSnooze={snooze} onFollow={follow}/>)}</div>:<div className="notification-clear-state quiet"><Bell/><div><strong>{ar?'كل شيء هادئ هنا ✓':'Everything is quiet here ✓'}</strong><p>{ar?'لا توجد تحديثات ضمن هذا القسم.':'No updates in this section.'}</p></div></div>}
    </section>

    <footer className="notification-privacy-note"><ShieldCheck/><div><strong>{ar?'الإشعارات لا تغيّر حالة العمل':'Notifications never replace business state'}</strong><p>{ar?'القراءة والتأجيل والمتابعة تخص تجربتك فقط. حالة الطلب أو العرض أو العقد لا تتغير إلا من الإجراء الأصلي المصرح به.':'Read, snooze and follow affect your experience only. Order, quotation and contract states change only through their authorized business actions.'}</p></div></footer>
  </div>;
}

function Metric({icon:Icon,value,label,emphasis}) {return <div className={emphasis?'emphasis':''}><span><Icon/></span><div><strong>{value}</strong><small>{label}</small></div></div>}

function ActionCard({item,ar,lang,busy,onOpen,onSnooze,onFollow}){
  const meta=categoryMeta(item.category,ar);const Icon=meta.Icon;const canAct=item.action_available!==false;
  return <article className={`notification-action-card ${String(item.priority||'normal')}`}><header><span><Icon/></span><div><small>{meta.label}</small><time>{fmtDate(item.published_at||item.created_at,lang,true)}</time></div>{!item.read_at&&<em>{ar?'جديد':'New'}</em>}</header><h4>{textOf(item,ar,'title')}</h4><p>{textOf(item,ar,'body')}</p>{!canAct&&<div className="notification-permission-note"><ShieldCheck/>{ar?'هذا الإجراء يحتاج مستخدمًا مخولًا داخل المنشأة. يمكنك مراجعة التفاصيل فقط.':'This action requires an authorized organization member. You can still review the details.'}</div>}<footer><button className="client-primary" onClick={()=>onOpen(item)}>{canAct?<CircleAlert/>:<Eye/>}{canAct?deepLinkLabel(item,ar):(ar?'عرض التفاصيل':'View details')}</button><SnoozeMenu ar={ar} busy={busy===`snooze-${item.id}`} onSelect={(k)=>onSnooze(item,k)}/>{item.entity_type&&item.entity_id&&<button className="client-secondary icon-only" onClick={()=>onFollow(item)} disabled={busy===`follow-${item.id}`} title={item.followed?(ar?'إيقاف المتابعة':'Unfollow'):(ar?'تابع هذا العنصر':'Follow this item')}>{item.followed?<Star/>:<StarOff/>}</button>}</footer></article>
}

function NotificationThread({item,ar,lang,busy,onOpen,onSnooze,onFollow}){
  const meta=categoryMeta(item.category,ar);const Icon=meta.Icon;const count=item._updates?.length||1;
  return <article className={`notification-thread ${item.read_at?'read':'unread'}`}><button className="notification-thread-main" onClick={()=>onOpen(item)}><span className="notification-thread-icon"><Icon/></span><div><header><small>{meta.label}</small>{count>1&&<em>{ar?`${count} تحديثات`:`${count} updates`}</em>}{item.followed&&<i><Star/>{ar?'متابع':'Following'}</i>}</header><strong>{textOf(item,ar,'title')}</strong><p>{textOf(item,ar,'body')}</p><time><Clock3/>{fmtDate(item.published_at||item.created_at,lang,true)}</time></div>{!item.read_at&&<b/>}</button><div className="notification-thread-actions">{item.action_url&&<button onClick={()=>onOpen(item)}><Eye/>{deepLinkLabel(item,ar)}</button>}<SnoozeMenu ar={ar} busy={busy===`snooze-${item.id}`} onSelect={(k)=>onSnooze(item,k)} compact/>{item.entity_type&&item.entity_id&&<button onClick={()=>onFollow(item)} disabled={busy===`follow-${item.id}`}>{item.followed?<Star/>:<StarOff/>}{item.followed?(ar?'إيقاف المتابعة':'Unfollow'):(ar?'متابعة':'Follow')}</button>}</div></article>
}

function SnoozeMenu({ar,busy,onSelect,compact=false}){
  return <details className={`notification-snooze ${compact?'compact':''}`}><summary className={compact?'':'client-secondary'}><AlarmClock/>{!compact&&(busy?(ar?'تأجيل…':'Snoozing…'):(ar?'ذكّرني لاحقًا':'Remind me later'))}<ChevronDown/></summary><div><button onClick={()=>onSelect('hour')}>{ar?'بعد ساعة':'In one hour'}</button><button onClick={()=>onSelect('evening')}>{ar?'مساء اليوم':'This evening'}</button><button onClick={()=>onSelect('tomorrow')}>{ar?'غدًا':'Tomorrow'}</button></div></details>
}
