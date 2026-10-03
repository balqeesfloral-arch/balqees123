import { useEffect, useMemo, useState } from 'react';
import {
  Archive, BookOpenCheck, CheckCheck, ChevronDown, CircleAlert, ClipboardCheck,
  DatabaseZap, Edit3, FileQuestion, Inbox, LibraryBig, MessageSquareText, Plus, Power,
  RefreshCw, Save, Search, Send, ShieldCheck, Sparkles, UserRoundCheck, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { dateTime, initials, logAdminAction } from '../adminUtils';

const KB_EMPTY={id:null,organization_id:'',category:'faq',title_ar:'',title_en:'',body_ar:'',body_en:'',keywords:'',status:'draft',is_ai_enabled:true};
const STATUS=[['all','الكل','All'],['needs_human','يحتاج بشريًا','Needs human'],['human_handling','قيد العناية','Human handling'],['waiting_customer','بانتظار العميل','Waiting customer'],['resolved','تم الحل','Resolved']];
const CATEGORIES=[['faq','سؤال شائع','FAQ'],['policy','سياسة','Policy'],['service','خدمة','Service'],['hours','أوقات العمل','Hours'],['instruction','تعليمات','Instruction'],['change_policy','سياسة تعديل','Change policy'],['organization','خاص بمنشأة','Organization']];
const SETTING_KEYS=[
  ['ai_enabled','الذكاء الاصطناعي','AI assistance'],
  ['human_handoff_enabled','التحويل البشري','Human handoff'],
  ['order_lookup_enabled','الطلبات','Order lookup'],
  ['quotation_lookup_enabled','عروض الأسعار','Quotation lookup'],
  ['contract_lookup_enabled','العقود','Contract lookup'],
  ['site_lookup_enabled','المواقع','Site lookup'],
  ['catalog_search_enabled','الكتالوج','Catalog search'],
  ['finance_lookup_enabled','المستندات المالية','Financial documents'],
  ['request_draft_enabled','مسودات الطلبات','Request drafts'],
  ['knowledge_enabled','قاعدة المعرفة','Knowledge base'],
  ['employee_assist_enabled','مساعد الموظف','Employee assist'],
];

const statusLabel=(s,ar)=>({ai_handling:ar?'يعالجه المساعد':'AI handling',waiting_customer:ar?'بانتظار العميل':'Waiting customer',needs_human:ar?'يحتاج فريق بلقيس':'Needs human',human_handling:ar?'مع فريق بلقيس':'Human handling',resolved:ar?'تم الحل':'Resolved'}[s]||s||'—');
const withTimeout=(promise,ms=8000)=>Promise.race([promise,new Promise((_,reject)=>window.setTimeout(()=>reject(new Error('AI_TIMEOUT')),ms))]);

export default function AdminSupport({lang,session,onRefreshBadges}){
  const ar=lang==='ar';
  const[tab,setTab]=useState('inbox');
  const[conversations,setConversations]=useState([]); const[profiles,setProfiles]=useState({}); const[orgs,setOrgs]=useState([]);
  const[selected,setSelected]=useState(null); const[messages,setMessages]=useState([]); const[reply,setReply]=useState('');
  const[query,setQuery]=useState(''); const[filter,setFilter]=useState('all'); const[loading,setLoading]=useState(true); const[busy,setBusy]=useState('');
  const[assist,setAssist]=useState(null); const[settings,setSettings]=useState(null); const[knowledge,setKnowledge]=useState([]); const[kbForm,setKbForm]=useState(null);
  const[audits,setAudits]=useState([]); const[notice,setNotice]=useState(null);

  async function load(){
    setLoading(true); setNotice(null);
    const[c,o,k,s,a]=await Promise.all([
      supabase.from('support_conversations').select('*').order('last_message_at',{ascending:false}).limit(250),
      supabase.from('organizations').select('id,display_name,legal_name').order('display_name'),
      supabase.from('care_knowledge_items').select('*').order('updated_at',{ascending:false}).limit(300),
      supabase.from('care_settings').select('*').eq('id',true).maybeSingle(),
      supabase.from('care_tool_audit').select('*').order('created_at',{ascending:false}).limit(150),
    ]);
    const rows=c.data||[]; setConversations(rows); setOrgs(o.data||[]); setKnowledge(k.data||[]); setSettings(s.data||null); setAudits(a.data||[]);
    const ids=[...new Set(rows.map(x=>x.user_id).filter(Boolean))];
    if(ids.length){const{data}=await supabase.from('customer_profiles').select('id,full_name,email,establishment_display_name').in('id',ids);setProfiles(Object.fromEntries((data||[]).map(x=>[x.id,x])));}else setProfiles({});
    setLoading(false); onRefreshBadges?.();
  }
  useEffect(()=>{load();},[]);

  const orgMap=useMemo(()=>Object.fromEntries(orgs.map(o=>[o.id,o])),[orgs]);
  const visible=useMemo(()=>conversations.filter(c=>{
    const p=profiles[c.user_id]||{}; const org=orgMap[c.organization_id]||{};
    const hay=`${c.subject||''} ${p.full_name||''} ${p.email||''} ${org.display_name||''} ${org.legal_name||''}`.toLowerCase();
    const care=c.care_status||(c.status==='closed'?'resolved':'human_handling');
    return(!query||hay.includes(query.toLowerCase()))&&(filter==='all'||care===filter);
  }),[conversations,profiles,orgMap,query,filter]);
  const careCounts=useMemo(()=>({needs:conversations.filter(c=>c.care_status==='needs_human').length,human:conversations.filter(c=>c.care_status==='human_handling').length,resolved:conversations.filter(c=>c.care_status==='resolved'||c.status==='closed').length}),[conversations]);

  async function open(c){
    setSelected(c); setAssist(null);
    const{data,error}=await supabase.from('support_messages').select('*').eq('conversation_id',c.id).order('created_at');
    if(!error)setMessages(data||[]);
  }
  async function reloadSelected(id=selected?.id){await load();if(id){const{data}=await supabase.from('support_conversations').select('*').eq('id',id).maybeSingle();if(data)await open(data);}}

  async function claim(){
    if(!selected)return; setBusy('claim'); setNotice(null);
    const{error}=await supabase.rpc('admin_claim_care_case_v2',{p_conversation_id:selected.id});
    if(error)setNotice({type:'error',text:error.message}); else {await logAdminAction('claim_care_case','support_conversation',selected.id,{organization_id:selected.organization_id});await reloadSelected(selected.id);}
    setBusy('');
  }
  async function send(){
    if(!selected||!reply.trim())return; const body=reply.trim(); setBusy('send'); setNotice(null);
    let error=null;
    if(selected.organization_id){({error}=await supabase.rpc('add_organization_care_message_v2',{p_organization_id:selected.organization_id,p_conversation_id:selected.id,p_message:body}));}
    else{
      ({error}=await supabase.from('support_messages').insert({conversation_id:selected.id,sender_id:session.user.id,sender_role:'admin',body}));
      if(!error)({error}=await supabase.from('support_conversations').update({status:'pending',last_message_at:new Date().toISOString()}).eq('id',selected.id));
    }
    if(error)setNotice({type:'error',text:error.message}); else {setReply('');await logAdminAction('reply_support','support_conversation',selected.id,{length:body.length,care:true});await reloadSelected(selected.id);}
    setBusy('');
  }
  async function close(){
    if(!selected)return; setBusy('close');
    const{error}=await supabase.from('support_conversations').update({status:'closed',care_status:'resolved',resolved_at:new Date().toISOString()}).eq('id',selected.id);
    if(error)setNotice({type:'error',text:error.message}); else {await logAdminAction('resolve_care_case','support_conversation',selected.id,{organization_id:selected.organization_id});await reloadSelected(selected.id);}
    setBusy('');
  }
  async function getAssist(){
    if(!selected)return;setBusy('assist');setAssist(null);setNotice(null);
    const{data,error}=await supabase.rpc('admin_get_care_assist_v2',{p_conversation_id:selected.id});
    if(error){setNotice({type:'error',text:error.message});setBusy('');return;}
    setAssist(data);
    if(settings?.ai_enabled&&settings?.employee_assist_enabled!==false){
      try{
        const{data:ai}=await withTimeout(supabase.functions.invoke('balqees-care',{body:{mode:'agent_assist',conversation_id:selected.id,language:lang}}));
        if(ai?.assist)setAssist(ai.assist);
      }catch{/* deterministic authorized assist remains available */}
    }
    setBusy('');
  }
  function suggestKnowledge(){
    const latest=[...messages].reverse().find(m=>m.sender_role==='user')?.body||selected?.subject||'';
    setKbForm({...KB_EMPTY,organization_id:selected?.organization_id||'',title_ar:selected?.subject||'',body_ar:latest,keywords:selected?.category||'',status:'draft'}); setTab('knowledge');
  }

  async function saveKnowledge(e){
    e.preventDefault(); if(!kbForm)return; setBusy('kb'); setNotice(null);
    const payload={organization_id:kbForm.organization_id||null,category:kbForm.category,title_ar:kbForm.title_ar.trim(),title_en:kbForm.title_en.trim()||null,body_ar:kbForm.body_ar.trim(),body_en:kbForm.body_en.trim()||null,keywords:kbForm.keywords.split(',').map(x=>x.trim()).filter(Boolean),status:kbForm.status,is_ai_enabled:Boolean(kbForm.is_ai_enabled),updated_by:session.user.id,updated_at:new Date().toISOString()};
    const req=kbForm.id?supabase.from('care_knowledge_items').update(payload).eq('id',kbForm.id).select().single():supabase.from('care_knowledge_items').insert({...payload,created_by:session.user.id}).select().single();
    const{data,error}=await req;
    if(error)setNotice({type:'error',text:error.message});else{await logAdminAction(kbForm.id?'update_care_knowledge':'create_care_knowledge','care_knowledge',data.id,{status:data.status,organization_id:data.organization_id});setKbForm(null);await load();setTab('knowledge');}
    setBusy('');
  }
  async function archiveKnowledge(row){
    setBusy(`archive-${row.id}`);const{error}=await supabase.from('care_knowledge_items').update({status:'archived',updated_by:session.user.id,updated_at:new Date().toISOString()}).eq('id',row.id);
    if(error)setNotice({type:'error',text:error.message});else{await logAdminAction('archive_care_knowledge','care_knowledge',row.id);await load();setTab('knowledge');}setBusy('');
  }
  async function saveSettings(){
    if(!settings)return;setBusy('settings');setNotice(null);
    const payload={};SETTING_KEYS.forEach(([k])=>payload[k]=Boolean(settings[k]));payload.updated_by=session.user.id;payload.updated_at=new Date().toISOString();
    const{error}=await supabase.from('care_settings').update(payload).eq('id',true);
    if(error)setNotice({type:'error',text:error.message});else{await logAdminAction('update_care_controls','care_settings','global',{...payload,updated_by:undefined});setNotice({type:'success',text:ar?'تم تطبيق إعدادات مركز العناية فعليًا.':'Care controls were applied.'});await load();setTab('controls');}setBusy('');
  }

  return <div className="admin-page admin-care-operations">
    <div className="admin-page-head"><div><span>{ar?'خدمة العملاء الذكية':'SMART CUSTOMER CARE'}</span><h2>{ar?'مركز عناية بلقيس':'Balqees Care Operations'}</h2><p>{ar?'عناية هجينة تجمع الأدوات المصرح بها، المعرفة المراجعة، والتحويل البشري مع تدقيق كامل — بلا SQL مفتوح ولا قرارات مالية تلقائية.':'Hybrid care with authorized tools, reviewed knowledge, human takeover and full audit — no generic SQL or autonomous financial decisions.'}</p></div><div className="admin-head-actions"><button className="admin-secondary-button" onClick={load}><RefreshCw className={loading?'spin':''} size={16}/>{ar?'تحديث':'Refresh'}</button></div></div>

    <div className="admin-care-banner"><span className={settings?.ai_enabled?'on':'off'}>{settings?.ai_enabled?<Sparkles/>:<Power/>}</span><div><strong>{settings?.ai_enabled?(ar?'عناية بلقيس الذكية مفعلة':'Balqees Smart Care is enabled'):(ar?'الوضع البشري فقط مفعّل':'Human-only mode is active')}</strong><p>{settings?.ai_enabled?(ar?'المساعد يعمل فقط عبر الأدوات المسموحة ويحوّل الحالة للفريق عندما لا توجد معلومة مؤكدة.':'The assistant can only use approved tools and hands off when confirmed information is unavailable.'):(ar?'تم إيقاف طبقة AI مركزيًا، بينما يبقى Inbox والتحويل البشري وقاعدة المعرفة متاحة.':'AI is centrally disabled while the inbox, human handoff and knowledge base remain available.')}</p></div><button onClick={()=>setTab('controls')}>{ar?'إدارة الوضع':'Manage mode'}</button></div>
    {notice&&<div className={`admin-care-notice ${notice.type}`}>{notice.type==='error'?<CircleAlert/>:<ClipboardCheck/>}<span>{notice.text}</span><button onClick={()=>setNotice(null)}><X/></button></div>}

    <nav className="admin-care-tabs"><button className={tab==='inbox'?'active':''} onClick={()=>setTab('inbox')}><Inbox/>{ar?'صندوق العناية':'Care Inbox'}<em>{careCounts.needs}</em></button><button className={tab==='knowledge'?'active':''} onClick={()=>setTab('knowledge')}><LibraryBig/>{ar?'قاعدة المعرفة':'Knowledge Base'}<em>{knowledge.filter(k=>k.status==='published').length}</em></button><button className={tab==='controls'?'active':''} onClick={()=>setTab('controls')}><ShieldCheck/>{ar?'الذكاء والأدوات':'AI & Tools'}</button></nav>

    {tab==='inbox'&&<><div className="admin-summary-strip care-summary"><Mini label={ar?'يحتاج فريقًا':'Needs human'} value={careCounts.needs}/><Mini label={ar?'قيد العناية':'Human handling'} value={careCounts.human}/><Mini label={ar?'تم الحل':'Resolved'} value={careCounts.resolved}/><Mini label={ar?'أدوات مدققة':'Audited tools'} value={audits.length}/></div><section className="admin-inbox-shell care-inbox-shell"><aside className="admin-inbox-list"><div className="admin-inbox-tools"><div className="admin-search-field"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'اسم، بريد، منشأة أو موضوع…':'Name, email, organization or subject…'}/></div><div className="admin-filter-group compact care-filters">{STATUS.map(([v,a,e])=><button className={filter===v?'active':''} key={v} onClick={()=>setFilter(v)}>{ar?a:e}</button>)}</div></div><div className="admin-conversation-list">{visible.map(c=>{const p=profiles[c.user_id]||{},org=orgMap[c.organization_id]||{},care=c.care_status||(c.status==='closed'?'resolved':'human_handling');return <button key={c.id} className={selected?.id===c.id?'active':''} onClick={()=>open(c)}><span className="admin-avatar">{initials(p.full_name,p.email)}</span><div><div><strong>{p.full_name||p.email||'—'}</strong><time>{dateTime(c.last_message_at,lang)}</time></div><h4>{c.subject}</h4><p>{org.display_name||org.legal_name||p.establishment_display_name||p.email||''}</p><footer><span className={`admin-priority ${c.priority}`}>{c.priority}</span><span className={`care-case-status ${care}`}>{statusLabel(care,ar)}</span></footer></div></button>})}{!loading&&!visible.length&&<div className="admin-empty-inline"><Inbox/><span>{ar?'لا توجد حالات في هذا التصنيف.':'No cases in this view.'}</span></div>}</div></aside>
      <main className="admin-chat-pane care-chat-pane">{selected?<><header><div><span className="admin-avatar">{initials(profiles[selected.user_id]?.full_name,profiles[selected.user_id]?.email)}</span><div><strong>{profiles[selected.user_id]?.full_name||profiles[selected.user_id]?.email||'—'}</strong><small>{orgMap[selected.organization_id]?.display_name||selected.subject}</small></div></div><div className="care-chat-actions">{selected.care_status!=='human_handling'&&selected.care_status!=='resolved'&&<button className="admin-primary-button small" onClick={claim} disabled={Boolean(busy)}><UserRoundCheck/>{ar?'استلام الحالة':'Take over'}</button>}<button className="admin-secondary-button small" onClick={getAssist} disabled={Boolean(busy)||selected.care_status==='resolved'}><Sparkles/>{ar?'مساعد الموظف':'Agent assist'}</button><button className="admin-secondary-button small" onClick={close} disabled={Boolean(busy)||selected.care_status==='resolved'||selected.status==='closed'}><CheckCheck/>{ar?'تم الحل':'Resolve'}</button></div></header>
      {selected.context_snapshot&&Object.keys(selected.context_snapshot||{}).length>0&&<div className="admin-care-context"><small>{ar?'السياق المنقول من عناية بلقيس':'BALQEES CARE CONTEXT'}</small>{selected.ai_summary&&<p><strong>{ar?'ملخص التحويل: ':'Handoff summary: '}</strong>{selected.ai_summary}</p>}<div>{Object.entries(selected.context_snapshot).filter(([k,v])=>k!=='assistant_history'&&v!=null&&v!=='').slice(0,8).map(([k,v])=><span key={k}>{k}: {typeof v==='object'?JSON.stringify(v).slice(0,120):String(v).slice(0,120)}</span>)}</div>{Array.isArray(selected.context_snapshot.assistant_history)&&selected.context_snapshot.assistant_history.length>0&&<section className="admin-care-history"><b>{ar?'آخر تفاعلات العميل مع المساعد':'RECENT ASSISTANT INTERACTIONS'}</b>{selected.context_snapshot.assistant_history.slice(-6).map((h,i)=><article key={i}><strong>{h.question}</strong><p>{h.summary||h.title||'—'}</p><small>{(h.tools||[]).join(' · ')}{h.source?` · ${h.source}`:''}</small></article>)}</section>}</div>}
      {assist&&<div className="admin-agent-assist"><header><span><Sparkles/><b>{ar?'مساعد الموظف — للمراجعة قبل الإرسال':'Agent Assist — review before sending'}</b><em className={`agent-assist-source ${assist.source==='ai'?'ai':'safe'}`}>{assist.source==='ai'?(ar?'مسودة AI':'AI draft'):(ar?'إرشاد محلي آمن':'Safe local guidance')}</em></span><button onClick={()=>setAssist(null)}><X/></button></header><p><strong>{ar?'الملخص':'Summary'}</strong>{assist.summary}</p><p><strong>{ar?'إرشاد الرد':'Reply guidance'}</strong>{assist.suggestion}</p>{assist.knowledge_refs?.length>0&&<div className="agent-knowledge-refs"><small>{ar?'مراجع المعرفة':'KNOWLEDGE REFERENCES'}</small>{assist.knowledge_refs.map(k=><button key={k.id} onClick={()=>setKbForm({...KB_EMPTY,...k,organization_id:k.organization_id||'',keywords:(k.keywords||[]).join(', ')})}><BookOpenCheck/><span>{ar?k.title_ar:(k.title_en||k.title_ar)}</span></button>)}</div>}<footer><small className="agent-assist-disclaimer">{assist.source==='ai'?(ar?'النص من مزود AI خارجي بعد تقليل البيانات؛ لا يُرسل إلا بعد مراجعتك.':'Generated by the external AI provider after data minimization; never sent until you review it.'):(ar?'تعليمات محلية مبنية على المحادثة والمراجع المنشورة فقط.':'Local guidance based only on the conversation and published knowledge.')}</small><button className="admin-secondary-button small" onClick={suggestKnowledge}><Plus/>{ar?'اقتراح معرفة جديدة':'Suggest knowledge item'}</button><button className="admin-primary-button small" onClick={()=>setReply(assist.suggestion||'')}><Edit3/>{ar?'استخدمه كمسودة':'Use as draft'}</button></footer></div>}
      <div className="admin-chat-messages">{messages.map(m=><div className={`admin-chat-message ${m.sender_role} ${m.body?.startsWith('انضم ')?'join-message':''}`} key={m.id}><span>{m.body?.startsWith('انضم ')?(ar?'نظام العناية':'Care system'):m.sender_role==='admin'?(ar?'فريق بلقيس':'Balqees team'):(ar?'العميل':'Client')}</span><p>{m.body}</p><time>{dateTime(m.created_at,lang)}</time></div>)}</div>
      <footer className="admin-chat-composer"><textarea rows="2" value={reply} onChange={e=>setReply(e.target.value)} placeholder={selected.care_status==='resolved'?(ar?'الحالة محلولة':'Case resolved'):(ar?'اكتب ردك بعد مراجعة السياق…':'Write a reply after reviewing context…')} disabled={selected.care_status==='resolved'}/><button className="admin-primary-button" onClick={send} disabled={!reply.trim()||selected.care_status==='resolved'||Boolean(busy)}><Send/>{ar?'إرسال':'Send'}</button></footer></>:<div className="admin-chat-empty"><MessageSquareText/><strong>{ar?'اختر حالة عناية':'Select a care case'}</strong><p>{ar?'ستظهر المحادثة والسياق ومساعد الموظف هنا.':'Conversation, context and agent assist will appear here.'}</p></div>}</main></section></>}

    {tab==='knowledge'&&<section className="care-admin-panel"><header className="care-panel-head"><div><small>REVIEWED KNOWLEDGE</small><h3>{ar?'قاعدة معرفة عناية بلقيس':'Balqees Care Knowledge Base'}</h3><p>{ar?'لا يتعلم النظام من ردود الموظفين تلقائيًا. كل معلومة تمر بمسودة ثم مراجعة ونشر صريح.':'Employee replies are never learned automatically. Knowledge is drafted, reviewed and explicitly published.'}</p></div><button className="admin-primary-button" onClick={()=>setKbForm({...KB_EMPTY})}><Plus/>{ar?'إضافة معرفة':'New knowledge item'}</button></header><div className="care-kb-grid">{knowledge.map(k=><article className={`care-kb-card ${k.status}`} key={k.id}><header><span>{CATEGORIES.find(x=>x[0]===k.category)?.[ar?1:2]||k.category}</span><em>{k.status}</em></header><h4>{ar?k.title_ar:(k.title_en||k.title_ar)}</h4><p>{ar?k.body_ar:(k.body_en||k.body_ar)}</p><footer><small>{k.organization_id?(orgMap[k.organization_id]?.display_name||(ar?'منشأة محددة':'Specific organization')):(ar?'عام':'Global')}</small><span><button onClick={()=>setKbForm({...k,organization_id:k.organization_id||'',keywords:(k.keywords||[]).join(', ')})}><Edit3/></button>{k.status!=='archived'&&<button onClick={()=>archiveKnowledge(k)} disabled={Boolean(busy)}><Archive/></button>}</span></footer></article>)}{!loading&&!knowledge.length&&<div className="admin-empty-state"><FileQuestion/><strong>{ar?'قاعدة المعرفة فارغة':'Knowledge base is empty'}</strong><p>{ar?'أضف سياسات وخدمات وتعليمات مؤكدة ليستخدمها مركز العناية.':'Add verified policies, services and instructions for Care.'}</p></div>}</div></section>}

    {tab==='controls'&&<section className="care-admin-panel"><header className="care-panel-head"><div><small>CARE CONTROL PLANE</small><h3>{ar?'تحكم الذكاء والأدوات':'AI & Tool Controls'}</h3><p>{ar?'كل مفتاح يغير سلوكًا حقيقيًا. إيقاف AI لا يعطل العناية البشرية أو البيانات التشغيلية.':'Every switch changes real behavior. Disabling AI does not disable human care or operational data.'}</p></div><button className="admin-primary-button" onClick={saveSettings} disabled={Boolean(busy)||!settings}><Save/>{ar?'حفظ الإعدادات':'Save controls'}</button></header>{settings&&<div className="care-control-grid">{SETTING_KEYS.map(([key,a,e])=><label className={`care-control-card ${key==='ai_enabled'?'master':''}`} key={key}><span>{key==='ai_enabled'?<Power/>:<DatabaseZap/>}<div><b>{ar?a:e}</b><small>{key==='ai_enabled'?(ar?'Kill Switch لطبقة AI فقط':'Kill switch for the AI layer only'):(ar?'أداة مصرح بها وقابلة للتدقيق':'Authorized, auditable capability')}</small></div></span><input type="checkbox" checked={Boolean(settings[key])} onChange={ev=>setSettings(v=>({...v,[key]:ev.target.checked}))}/></label>)}</div>}<div className="care-audit-panel"><header><div><small>NO CHAIN OF THOUGHT</small><h4>{ar?'سجل الأدوات والإجراءات':'Tool & Action Audit'}</h4></div><span>{audits.length}</span></header><div className="care-audit-list">{audits.slice(0,80).map(a=><article key={a.id}><span className={a.success?'ok':'fail'}>{a.success?<ClipboardCheck/>:<CircleAlert/>}</span><div><strong>{a.tool_name}</strong><small>{a.entity_type||'—'} · {a.entity_id||'—'}</small></div><div><small>{orgMap[a.organization_id]?.display_name||a.organization_id||'—'}</small><time>{dateTime(a.created_at,lang)}</time></div></article>)}{!audits.length&&<div className="admin-empty-inline">{ar?'لا توجد أدوات مستخدمة بعد.':'No audited tool calls yet.'}</div>}</div></div></section>}

    {kbForm&&<div className="admin-modal-overlay" onMouseDown={e=>e.target===e.currentTarget&&setKbForm(null)}><div className="admin-modal wide care-kb-modal"><div className="admin-modal-head"><div><small>KNOWLEDGE REVIEW</small><h3>{kbForm.id?(ar?'تحرير معرفة':'Edit knowledge'):(ar?'مسودة معرفة جديدة':'New knowledge draft')}</h3></div><button onClick={()=>setKbForm(null)}><X/></button></div><form className="admin-modal-form" onSubmit={saveKnowledge}><div className="admin-form-grid three"><label>{ar?'الفئة':'Category'}<select value={kbForm.category} onChange={e=>setKbForm(v=>({...v,category:e.target.value}))}>{CATEGORIES.map(([v,a,e])=><option key={v} value={v}>{ar?a:e}</option>)}</select></label><label>{ar?'النطاق':'Scope'}<select value={kbForm.organization_id} onChange={e=>setKbForm(v=>({...v,organization_id:e.target.value}))}><option value="">{ar?'عام لجميع المنشآت':'Global'}</option>{orgs.map(o=><option key={o.id} value={o.id}>{o.display_name||o.legal_name}</option>)}</select></label><label>{ar?'الحالة':'Status'}<select value={kbForm.status} onChange={e=>setKbForm(v=>({...v,status:e.target.value}))}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div><div className="admin-form-grid two"><label>{ar?'العنوان بالعربية':'Arabic title'}<input required value={kbForm.title_ar} onChange={e=>setKbForm(v=>({...v,title_ar:e.target.value}))}/></label><label>{ar?'العنوان بالإنجليزية':'English title'}<input value={kbForm.title_en||''} onChange={e=>setKbForm(v=>({...v,title_en:e.target.value}))}/></label></div><label>{ar?'المحتوى العربي المراجع':'Reviewed Arabic content'}<textarea required rows="6" value={kbForm.body_ar} onChange={e=>setKbForm(v=>({...v,body_ar:e.target.value}))}/></label><label>{ar?'المحتوى الإنجليزي':'English content'}<textarea rows="4" value={kbForm.body_en||''} onChange={e=>setKbForm(v=>({...v,body_en:e.target.value}))}/></label><label>{ar?'كلمات مفتاحية — مفصولة بفواصل':'Keywords — comma separated'}<input value={kbForm.keywords||''} onChange={e=>setKbForm(v=>({...v,keywords:e.target.value}))}/></label><label className="admin-check-row"><input type="checkbox" checked={Boolean(kbForm.is_ai_enabled)} onChange={e=>setKbForm(v=>({...v,is_ai_enabled:e.target.checked}))}/><span>{ar?'السماح لمركز العناية باستخدامها بعد النشر':'Allow Care to use it after publication'}</span></label><div className="admin-modal-actions"><button type="button" className="admin-secondary-button" onClick={()=>setKbForm(null)}>{ar?'إلغاء':'Cancel'}</button><button className="admin-primary-button" disabled={Boolean(busy)}><Save/>{ar?'حفظ بعد المراجعة':'Save reviewed item'}</button></div></form></div></div>}
  </div>;
}

function Mini({label,value}){return <div className="admin-summary-item"><span><Sparkles/></span><div><strong>{value}</strong><small>{label}</small></div></div>}
