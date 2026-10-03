import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Flower2, CheckCircle2, CircleHelp, FileText,
  Inbox, LoaderCircle, MessageCircleMore, MessageSquarePlus, PackageSearch, ReceiptText,
  Search, Send, ShieldCheck, ShoppingBag, Sparkles, UserRoundCheck, X, ScrollText,
  MapPinned, RotateCcw, ClipboardPlus, BrainCircuit, Power
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useClientPortal } from '../ClientPortalContext';
import { fmtDate } from '../portalUtils';
import './smart-care.css';

const QUICK=[
  ['orders',PackageSearch,'وين وصل طلبي؟','Where is my order?'],
  ['quote',FileText,'وش تغير في عرض السعر؟','What changed in the quotation?'],
  ['finance',ReceiptText,'ما آخر مستند مالي؟','Latest financial document'],
  ['contract',ScrollText,'هل العقد يغطي الخدمة؟','Contract coverage'],
  ['catalog',ShoppingBag,'ابحث لي في الكتالوج','Search the catalog'],
  ['draft',ClipboardPlus,'جهز لي مسودة طلب','Prepare a request draft'],
];
const lower=(s)=>String(s||'').toLowerCase();
const includesAny=(text,...terms)=>terms.some(x=>text.includes(x));
const titleFor=(ar,ctx)=>ctx?.title||(ar?'بدون سياق محدد':'No specific context');
const money=(v,lang)=>v==null?'—':new Intl.NumberFormat(lang==='ar'?'ar-SA':'en-SA',{style:'currency',currency:'SAR',maximumFractionDigits:2}).format(Number(v));
const withTimeout=(promise,ms=6500)=>Promise.race([promise,new Promise((_,reject)=>window.setTimeout(()=>reject(new Error('AI_TIMEOUT')),ms))]);

function entityContext(params,ar){
  const defs=[['order','order',ar?'طلب':'Order'],['quote','quotation',ar?'عرض سعر':'Quotation'],['contract','contract',ar?'عقد':'Contract'],['site','site',ar?'موقع':'Site']];
  for(const [key,type,label] of defs){const id=params.get(key);if(id)return {type,id,title:`${label} · ${String(id).slice(0,8)}`};}
  const document=params.get('document');
  if(document){
    const split=document.indexOf(':');
    const sourceKind=split>0?document.slice(0,split):'client_document';
    const id=split>0?document.slice(split+1):document;
    return {type:'document',id,sourceKind,title:`${ar?'مستند':'Document'} · ${String(id).slice(0,8)}`};
  }
  return null;
}
function noData(ar,summary,tools=[]){return {tone:'warn',title:ar?'لا توجد معلومة مؤكدة مسجلة':'No confirmed information is recorded',summary,actions:[{kind:'human',label:ar?'تحويل لفريق بلقيس':'Hand over to Balqees team'}],tools};}
function actionRoute(route,label){return {kind:'route',route,label};}

export default function ClientSupport(){
  const {lang,organization,permissions}=useClientPortal(); const ar=lang==='ar'; const nav=useNavigate(); const[params,setParams]=useSearchParams();
  const context=useMemo(()=>entityContext(params,ar),[params,ar]);
  const contextKey=`${organization?.id||''}:${context?.type||''}:${context?.id||''}`;
  const [rows,setRows]=useState([]); const [selected,setSelected]=useState(null); const [messages,setMessages]=useState([]); const [reply,setReply]=useState('');
  const [query,setQuery]=useState(''); const [answer,setAnswer]=useState(null); const [thinking,setThinking]=useState(false); const [showNew,setShowNew]=useState(false);
  const [subject,setSubject]=useState(''); const [first,setFirst]=useState(''); const [busy,setBusy]=useState(false); const [settings,setSettings]=useState({ai_enabled:true,human_handoff_enabled:true});
  const [serviceNotice,setServiceNotice]=useState(''); const [history,setHistory]=useState([]);

  async function load({quiet=false}={}){
    if(!organization?.id)return;
    const [c,s]=await Promise.all([
      supabase.from('support_conversations').select('*').eq('organization_id',organization.id).order('last_message_at',{ascending:false}),
      supabase.from('care_settings').select('*').eq('id',true).maybeSingle(),
    ]);
    setRows(c.data||[]); if(s.data)setSettings(s.data);
    if(!quiet&&c.error)setServiceNotice(c.error.message||'care_load_failed');
  }
  useEffect(()=>{load();},[organization?.id]);
  useEffect(()=>{
    const requested=params.get('conversation');
    if(!requested||!rows.length)return;
    const match=rows.find(row=>row.id===requested);
    if(match&&selected?.id!==match.id)open(match);
  },[params,rows,selected?.id]);
  useEffect(()=>{setHistory([]);setAnswer(null);setQuery('');},[contextKey]);
  useEffect(()=>{
    if(!organization?.id)return undefined;
    const ch=supabase.channel(`b2b-care-final-${organization.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'support_conversations',filter:`organization_id=eq.${organization.id}`},()=>load({quiet:true}))
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[organization?.id]);

  async function open(c){setSelected(c);const{data,error}=await supabase.from('support_messages').select('*').eq('conversation_id',c.id).order('created_at');if(!error)setMessages(data||[]);}
  async function tool(name,args){const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data;}

  async function tryExternalAI(question){
    if(!settings.ai_enabled)return null;
    try{
      const {data,error}=await withTimeout(supabase.functions.invoke('balqees-care',{body:{organization_id:organization.id,question,context,language:lang}}));
      if(error||!data?.answer)return null;
      return {...data.answer,tools:data.tools||[],source:'ai'};
    }catch{return null;}
  }

  async function resolveGrounded(question){
    const q=lower(question); const tools=[]; const org=organization.id;
    const financeAllowed=Boolean(permissions.viewFinance||permissions.view_financial_documents||permissions.acceptQuotes);
    const add=(toolName)=>tools.push({tool:toolName,ok:true});

    if(context?.type==='quotation'&&(includesAny(q,'تغير','تغيير','فرق','ليش','compare','change','difference')||params.get('topic')==='changes')){
      const d=await tool('care_compare_quotation_versions_v2',{p_organization_id:org,p_quotation_id:context.id});add('compare_quotation_versions');
      const changes=d?.changes||[]; if(!d?.previous_version)return noData(ar,ar?'هذا أول إصدار منشور، لذلك لا يوجد إصدار سابق للمقارنة.':'This is the first published version, so there is no previous version to compare.',tools);
      return {title:ar?`التغييرات من V${d.previous_version} إلى V${d.current_version}`:`Changes from V${d.previous_version} to V${d.current_version}`,summary:changes.length?(ar?`وجدت ${changes.length} تغييرًا مسجلًا بين الإصدارين.`:`${changes.length} recorded changes were found between the versions.`):(ar?'لا توجد تغييرات في البنود المسجلة.':'No recorded line-item changes were found.'),facts:changes.slice(0,8).map(x=>`${x.change_type}: ${ar?(x.description_ar||x.description_en):(x.description_en||x.description_ar)||x.line_key}`),actions:[actionRoute(`/portal/quotes/${context.id}`,ar?'فتح العرض':'Open quotation')],tools};
    }

    if(context?.type==='quotation'||includesAny(q,'عرض سعر','عرض السعر','quotation','quote')){
      if(context?.id){const d=await tool('care_get_quotation_v2',{p_organization_id:org,p_quotation_id:context.id});add('get_quotation');return {title:ar?`عرض السعر ${d.quote_number||''}`:`Quotation ${d.quote_number||''}`,summary:ar?`الإصدار ${d.version_number} حالته ${d.status}. صالح حتى ${d.valid_until?fmtDate(d.valid_until,lang):'—'}.`:`Version ${d.version_number} is ${d.status}. Valid until ${d.valid_until?fmtDate(d.valid_until,lang):'—'}.`,facts:[financeAllowed&&d.total!=null?`${ar?'الإجمالي':'Total'}: ${money(d.total,lang)}`:null,`${ar?'عدد البنود':'Items'}: ${(d.items||[]).length}`].filter(Boolean),actions:[actionRoute(`/portal/quotes/${d.id}`,ar?'مراجعة العرض':'Review quotation')],tools};}
      return noData(ar,ar?'افتح عرض السعر المطلوب واضغط «اسأل عناية بلقيس» حتى أعرف الإصدار المقصود بدقة.':'Open the quotation and choose “Ask Balqees Care” so I can use the exact version.',tools);
    }

    if(includesAny(q,'كرر','إعادة الطلب','اطلب مثله','repeat order')&&context?.type==='order'){
      const d=await tool('care_prepare_repeat_order_v2',{p_organization_id:org,p_order_id:context.id});add('prepare_repeat_order');
      return {title:ar?'جهزت مسودة من الطلب السابق':'Repeat-order draft prepared',summary:ar?'لم أنشئ طلبًا ملزمًا. جهزت مسودة آمنة لتراجع المنتجات والموقع قبل الإرسال.':'No binding order was created. A safe draft is ready for review before submission.',actions:[actionRoute(d.route,ar?'مراجعة المسودة':'Review draft')],tools};
    }

    if(context?.type==='order'){
      const d=await tool('care_get_order_details_v2',{p_organization_id:org,p_order_id:context.id});add('get_order_details');
      const last=d.events?.[0];
      return {title:ar?`طلب ${d.order_number||d.reference||''}`:`Order ${d.order_number||d.reference||''}`,summary:ar?`الحالة الحالية: ${d.status}.${last?` آخر تحديث: ${last.title_ar||last.title_en}.`:''}`:`Current status: ${d.status}.${last?` Latest update: ${last.title_en||last.title_ar}.`:''}`,facts:[d.requested_delivery_date?`${ar?'التاريخ المطلوب':'Requested date'}: ${fmtDate(d.requested_delivery_date,lang)}`:null,`${ar?'عدد البنود':'Items'}: ${(d.items||[]).length}`].filter(Boolean),actions:[actionRoute(`/portal/orders/${d.id}`,ar?'فتح الطلب':'Open order'),{kind:'repeat',label:ar?'جهز طلبًا مشابهًا':'Prepare similar order',orderId:d.id}],tools};
    }

    if(includesAny(q,'طلبي','الطلب','order','وين وصل','الحالة')){
      const list=await tool('care_get_active_orders_v2',{p_organization_id:org,p_site_id:context?.type==='site'?context.id:null});add('get_active_orders');
      const d=(list||[])[0]; if(!d)return noData(ar,ar?'لا توجد طلبات نشطة مؤكدة في نطاق وصولك حاليًا.':'There are no confirmed active orders in your access scope right now.',tools);
      return {title:ar?`أحدث طلب نشط ${d.order_number||d.reference||''}`:`Latest active order ${d.order_number||d.reference||''}`,summary:ar?`حالته الحالية: ${d.status}.`:`Current status: ${d.status}.`,facts:(list||[]).slice(0,4).map(x=>`${x.order_number||x.reference||String(x.id).slice(0,8)} · ${x.status}`),actions:[actionRoute(`/portal/orders/${d.id}`,ar?'عرض الطلب':'View order')],tools};
    }

    if(context?.type==='contract'||includesAny(q,'العقد','تغطية','مشمول','covered','contract')){
      if(!context?.id)return noData(ar,ar?'افتح العقد الذي تريد مراجعته ثم اسألني من داخله؛ لا أفسر عقدًا غير محدد.':'Open the contract you want to review and ask from there; I will not interpret an unspecified contract.');
      const d=await tool('care_get_contract_summary_v2',{p_organization_id:org,p_contract_id:context.id});add('get_contract_summary');
      if(!d.coverage_is_structured)return {tone:'warn',title:ar?'تحتاج مراجعة بشرية':'Human review required',summary:ar?'بيانات التغطية المهيكلة غير مكتملة لهذا العقد، لذلك لن أفسر النص القانوني من عندي.':'Structured coverage is incomplete for this contract, so I will not independently interpret legal text.',actions:[{kind:'human',label:ar?'مراجعة مع فريق بلقيس':'Review with Balqees team'}],tools};
      const services=d.services||[];return {title:ar?'ملخص التغطية المسجلة':'Recorded coverage summary',summary:ar?`العقد يحتوي ${services.length} خدمة مهيكلة و${(d.sites||[]).length} موقعًا مهيكلًا في نطاق وصولك.`:`The contract has ${services.length} structured services and ${(d.sites||[]).length} structured sites within your scope.`,facts:services.slice(0,7).map(x=>`${ar?(x.title_ar||x.title_en):(x.title_en||x.title_ar)||x.service_key} · ${x.coverage_status}`),actions:[actionRoute(`/portal/contracts/${context.id}`,ar?'فتح العقد':'Open contract')],tools};
    }

    if(context?.type==='site'||includesAny(q,'الموقع','الفرع','site','branch')){
      if(!context?.id)return noData(ar,ar?'افتح الموقع المطلوب أولًا حتى أحافظ على نطاق الصلاحية الصحيح.':'Open the target site first so I can preserve the correct access scope.');
      const d=await tool('care_get_site_details_v2',{p_organization_id:org,p_site_id:context.id});add('get_site_details');
      return {title:ar?(d.name_ar||d.name_en||'الموقع'):(d.name_en||d.name_ar||'Site'),summary:ar?`الموقع ${d.is_active?'نشط':'مؤرشف'}، ويمكن مراجعة تعليمات الوصول والعنوان من مركز الموقع.`:`The site is ${d.is_active?'active':'archived'}; access instructions and address are available in its command center.`,facts:[d.contact_name?`${ar?'جهة الاتصال':'Contact'}: ${d.contact_name}`:null,d.last_verified_at?`${ar?'آخر تحقق':'Last verified'}: ${fmtDate(d.last_verified_at,lang)}`:null].filter(Boolean),actions:[actionRoute(`/portal/sites/${d.id}`,ar?'فتح الموقع':'Open site')],tools};
    }

    if(includesAny(q,'فاتورة','مستند','مالي','invoice','document','finance')||context?.type==='document'){
      if(!financeAllowed)return {tone:'warn',title:ar?'الصلاحية المالية مطلوبة':'Finance permission required',summary:ar?'حسابك لا يملك صلاحية عرض البيانات المالية لهذه المنشأة.':'Your account cannot view this organization’s financial data.',actions:[{kind:'human',label:ar?'التواصل مع الفريق':'Contact team'}],tools};
      const list=await tool('care_get_financial_documents_v2',{p_organization_id:org,p_limit:context?.type==='document'?1:12,p_source_kind:context?.type==='document'?(context.sourceKind||'client_document'):null,p_source_id:context?.type==='document'?context.id:null});add('get_financial_documents');
      const d=(list||[])[0];
      if(!d)return noData(ar,ar?'لا توجد مستندات مالية منشورة في نطاق وصولك حاليًا.':'No published financial documents are available in your access scope.',tools);
      return {title:ar?'المستند المالي':'Financial document',summary:ar?`${d.document_number||d.title_ar||'مستند منشور'} · ${d.record_status||d.status||''}`:`${d.document_number||d.title_en||'Published document'} · ${d.record_status||d.status||''}`,facts:[d.total_amount!=null?`${ar?'القيمة':'Amount'}: ${money(d.total_amount,lang)}`:null,d.issue_date?`${ar?'التاريخ':'Date'}: ${fmtDate(d.issue_date,lang)}`:null].filter(Boolean),actions:[actionRoute(context?.type==='document'?`/portal/financial/${context.sourceKind||'client_document'}/${context.id}`:'/portal/financial',ar?'فتح مركز المستندات':'Open document center')],tools};
    }

    if(includesAny(q,'كرر','مسودة','طلب جديد','جهز لي','prepare request','draft')){
      const d=await tool('care_create_request_draft_v2',{p_organization_id:org,p_site_id:context?.type==='site'?context.id:null,p_payload:{description:question,source_context:context}});add('create_order_draft');
      return {title:ar?'تم تجهيز مسودة آمنة':'Safe draft prepared',summary:ar?'المساعد لم يرسل الطلب ولم ينشئ التزامًا. افتح المسودة وأكمل البيانات ثم راجعها بنفسك.':'The assistant did not submit anything or create a binding action. Open the draft, complete the details, then review it yourself.',actions:[actionRoute(d.route,ar?'فتح المسودة':'Open draft')],tools};
    }

    if(includesAny(q,'منتج','كتالوج','ورد','نبات','فاز','catalog','product','flower','plant')){
      const list=await tool('care_search_catalog_v2',{p_organization_id:org,p_query:question,p_site_id:context?.type==='site'?context.id:null,p_limit:6});add('search_catalog');
      if(!list?.length)return noData(ar,ar?'لم أجد عناصر منشورة مطابقة في الكتالوج المؤسسي.':'No matching published items were found in the institutional catalog.',tools);
      return {title:ar?'نتائج من الكتالوج المؤسسي':'Institutional catalog results',summary:ar?`وجدت ${list.length} خيارات من الكتالوج الحقيقي.`:`I found ${list.length} options from the live catalog.`,facts:list.slice(0,6).map(x=>`${ar?(x.name_ar||x.title_ar||x.name_en):(x.name_en||x.title_en||x.name_ar)||'—'}${x.display_price!=null?` · ${money(x.display_price,lang)}`:''}`),actions:[actionRoute('/portal/catalog',ar?'فتح الكتالوج':'Open catalog')],tools};
    }

    const kb=await tool('care_search_knowledge_v2',{p_organization_id:org,p_query:question,p_limit:4});add('search_knowledge');
    if(kb?.length){const k=kb[0];return {title:ar?(k.title_ar||k.title_en):(k.title_en||k.title_ar),summary:ar?(k.body_ar||k.body_en):(k.body_en||k.body_ar),facts:kb.slice(1).map(x=>ar?(x.title_ar||x.title_en):(x.title_en||x.title_ar)),actions:[],tools};}
    return noData(ar,ar?'لم أجد معلومة مؤكدة مسجلة تطابق سؤالك. أقدر أحول السؤال لفريق بلقيس مع كامل السياق الحالي.':'I could not find confirmed recorded information matching your question. I can hand it to Balqees team with the current context.',tools);
  }

  async function ask(text=query){
    const q=String(text||'').trim();if(!q||!organization?.id)return;setQuery(q);setThinking(true);setAnswer(null);setServiceNotice('');
    try{
      let result=null;
      if(settings.ai_enabled)result=await tryExternalAI(q);
      if(!result)result=await resolveGrounded(q);
      setAnswer(result);
      setHistory(h=>[...h,{question:q,title:result?.title||'',summary:result?.summary||'',tools:(result?.tools||[]).map(x=>x.tool),source:result?.source||'grounded'}].slice(-6));
    }catch(e){setAnswer({tone:'warn',title:ar?'تعذر إكمال الأداة بأمان':'The tool could not complete safely',summary:ar?'لم أستخدم بيانات بديلة أو أخمّن. يمكنك إعادة المحاولة أو تحويل الحالة لفريق بلقيس.':'I did not substitute data or guess. Retry or hand the case to Balqees team.',facts:[e?.message||'tool_error'],actions:[{kind:'human',label:ar?'تحويل للفريق':'Hand over'}],tools:[]});}
    setThinking(false);
  }

  async function prepareRepeat(orderId){setThinking(true);try{const d=await tool('care_prepare_repeat_order_v2',{p_organization_id:organization.id,p_order_id:orderId});nav(d.route);}catch(e){setServiceNotice(e.message||'repeat_failed');}setThinking(false);}
  function handoff(){if(!settings.human_handoff_enabled){setServiceNotice(ar?'التحويل البشري متوقف مؤقتًا.':'Human handoff is temporarily disabled.');return;}setSubject(answer?.title||query||'Balqees Care');setFirst(query||answer?.summary||'');setShowNew(true);}

  async function createCase(e){e.preventDefault();if(!organization?.id||!subject.trim()||!first.trim())return;setBusy(true);
    const currentTurn=query&&answer?{question:query,title:answer.title||'',summary:answer.summary||'',tools:(answer.tools||[]).map(x=>x.tool),source:answer.source||'grounded'}:null;
    const assistantHistory=[...history];
    if(currentTurn&&assistantHistory.at(-1)?.question!==currentTurn.question)assistantHistory.push(currentTurn);
    const snapshot={entity_type:context?.type||null,entity_id:context?.id||null,source_kind:context?.sourceKind||null,question:query||null,ai_summary:answer?.summary||null,tool_names:(answer?.tools||[]).map(x=>x.tool),assistant_history:assistantHistory.slice(-6),route:window.location.pathname+window.location.search};
    const {data:id,error}=await supabase.rpc('open_organization_care_case_v2',{p_organization_id:organization.id,p_subject:subject.trim(),p_message:first.trim(),p_context:snapshot,p_ai_summary:answer?.summary||null});
    setBusy(false);if(error){setServiceNotice(error.message||'handoff_failed');return;}setShowNew(false);setSubject('');setFirst('');await load();const created=(await supabase.from('support_conversations').select('*').eq('id',id).maybeSingle()).data;if(created)open(created);
  }
  async function send(e){e.preventDefault();if(!selected||!reply.trim())return;setBusy(true);const body=reply.trim();const{error}=await supabase.rpc('add_organization_care_message_v2',{p_organization_id:organization.id,p_conversation_id:selected.id,p_message:body});setBusy(false);if(error){setServiceNotice(error.message||'message_failed');return;}setReply('');await open(selected);await load({quiet:true});}

  function quick(key,label){if(key==='human'){handoff();return;}const map={orders:ar?'وين وصل طلبي؟':'Where is my order?',quote:context?.type==='quotation'?(ar?'وش تغير في عرض السعر؟':'What changed in the quotation?'):(ar?'أبغا أراجع عرض السعر':'I want to review a quotation'),finance:ar?'وش آخر مستند مالي؟':'What is the latest financial document?',contract:ar?'هل الخدمة مشمولة بالعقد؟':'Is the service covered by the contract?',catalog:ar?'ابحث لي في الكتالوج عن الخيارات المناسبة':'Search the catalog for suitable options',draft:ar?'جهز لي مسودة طلب جديدة بدون إرسالها':'Prepare a new request draft without submitting it'};ask(map[key]||label);}
  function doAction(a){if(a.kind==='route')nav(a.route);else if(a.kind==='human')handoff();else if(a.kind==='repeat')prepareRepeat(a.orderId);}

  return <div className="care-center">
    <section className="care-hero"><div className="care-orb"><Sparkles/><i/><b/></div><div><span>{ar?'عناية بلقيس':'BALQEES CARE'}</span><h2>{ar?'كيف نقدر نخدمكم؟':'How can we help?'}</h2><p>{ar?'اسأل عن طلباتكم، عروضكم أو خدماتكم.' : 'Ask about your orders, quotations or services.'}</p></div><button className="care-human" onClick={handoff}><UserRoundCheck/>{ar?'فريق بلقيس':'Balqees team'}</button></section>

    {serviceNotice&&<div className="care-service-notice"><AlertTriangle/><span>{serviceNotice}</span><button onClick={()=>setServiceNotice('')}><X/></button></div>}
    <div className={`care-mode-strip ${settings.ai_enabled?'ai':'human'}`}>{settings.ai_enabled?<BrainCircuit/>:<Power/>}<div><strong>{settings.ai_enabled?(ar?'المساعد متاح':'Assistant available'):(ar?'فريق العناية متاح':'Care team available')}</strong></div></div>

    <div className="care-grid"><main className="care-main"><section className="care-ask"><header><div><Flower2/><span><strong>{ar?'مساعد بلقيس':'Balqees Assistant'}</strong><small>{ar?'اسأل مباشرة':'Ask directly'}</small></span></div></header><div className="care-search"><Search/><textarea rows="2" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask();}}} placeholder={ar?'اسأل عن طلب، عرض سعر، عقد، موقع، مستند أو منتج…':'Ask about an order, quotation, contract, site, document or product…'}/><button onClick={()=>ask()} disabled={thinking||!query.trim()}>{thinking?<LoaderCircle className="spin"/>:<Send/>}</button></div><div className="care-quick">{QUICK.map(([key,Icon,a,e])=><button key={key} onClick={()=>quick(key,ar?a:e)}><Icon/><span>{ar?a:e}</span></button>)}</div></section>

      {(thinking||answer)&&<section className={`care-answer ${answer?.tone||''}`}>{thinking?<div className="care-thinking"><div className="care-flower"><Sparkles/></div><div><strong>{ar?'جاري البحث…':'Searching…'}</strong></div></div>:<><header><div><CheckCircle2/><span><small>{ar?'النتيجة':'ANSWER'}</small><h3>{answer.title}</h3></span></div></header><p>{answer.summary}</p>{answer.facts?.length>0&&<ul>{answer.facts.map((x,i)=><li key={i}>{x}</li>)}</ul>}<footer>{(answer.actions||[]).map((a,i)=><button key={i} className={i===0?'client-primary':'client-secondary'} onClick={()=>doAction(a)}>{a.kind==='human'?<UserRoundCheck/>:a.kind==='repeat'?<RotateCcw/>:<ArrowLeft/>}{a.label}</button>)}</footer></>}</section>}

      <section className="care-cases"><header><div><span>{ar?'المتابعات البشرية':'HUMAN CARE'}</span><h3>{ar?'حالات العناية':'Care cases'}</h3></div><button onClick={()=>{setSubject('');setFirst('');setShowNew(true)}}><MessageSquarePlus/>{ar?'حالة جديدة':'New case'}</button></header><div className="care-case-layout"><aside>{rows.length?rows.map(c=><button key={c.id} className={selected?.id===c.id?'active':''} onClick={()=>open(c)}><i className={c.status}/><div><strong>{c.subject}</strong><small>{fmtDate(c.last_message_at,lang,true)}</small></div><em>{c.care_status==='waiting_customer'?(ar?'بانتظار ردك':'Waiting for you'):c.care_status==='needs_human'?(ar?'بانتظار الفريق':'Needs human'):c.status==='closed'?(ar?'محلولة':'Resolved'):(ar?'قيد العناية':'In care')}</em></button>):<div className="care-empty"><Inbox/><strong>{ar?'لا توجد حالات بعد':'No care cases yet'}</strong><p>{ar?'ابدأ حالة جديدة للتواصل مع الفريق.':'Start a new case to contact the team.'}</p></div>}</aside><div className="care-thread">{selected?<><header><div><small>{ar?'حالة العناية':'CARE CASE'}</small><h4>{selected.subject}</h4></div><span>{selected.care_status||selected.status}</span></header>{selected.claimed_at&&<div className="care-human-joined"><UserRoundCheck/><span>{ar?'انضم أحد أعضاء فريق عناية بلقيس وتولى الحالة.':'A Balqees Care team member joined and took over the case.'}</span></div>}<div className="care-messages">{messages.map(m=>{const joined=m.sender_role==='admin'&&String(m.body||'').startsWith('انضم ');return <article key={m.id} className={joined?'system':m.sender_role==='admin'?'admin':'user'}><b>{joined?(ar?'تحويل بشري':'Human takeover'):m.sender_role==='admin'?(ar?'فريق بلقيس':'Balqees team'):(ar?'أنت':'You')}</b><p>{m.body}</p><time>{fmtDate(m.created_at,lang,true)}</time></article>})}</div>{selected.status!=='closed'&&<form onSubmit={send}><textarea rows="2" value={reply} onChange={e=>setReply(e.target.value)} placeholder={ar?'اكتب ردك…':'Write your reply…'}/><button disabled={busy||!reply.trim()}>{busy?<LoaderCircle className="spin"/>:<Send/>}</button></form>}</>:<div className="care-empty large"><MessageCircleMore/><strong>{ar?'اختر حالة لمتابعتها':'Choose a care case'}</strong><p>{ar?'اختر حالة من القائمة.' : 'Choose a case from the list.'}</p></div>}</div></div></section>
    </main>

    <aside className="care-side"><section className="care-context"><span>{ar?'السياق الحالي':'CURRENT CONTEXT'}</span><h3>{titleFor(ar,context)}</h3><p>{context?(ar?'المحادثة مرتبطة بهذا العنصر.':'This conversation is linked to this item.'):(ar?'اختر طلبًا أو عرضًا أو عقدًا عند الحاجة.':'Choose an order, quotation or contract when needed.')}</p>{context&&<button onClick={()=>setParams({}, {replace:true})}><X/>{ar?'مسح السياق':'Clear context'}</button>}</section></aside></div>

    {showNew&&<div className="client-modal-wrap" onMouseDown={e=>e.target===e.currentTarget&&setShowNew(false)}><form className="client-modal small" onSubmit={createCase}><header><div><small>{ar?'فريق بلقيس':'BALQEES TEAM'}</small><h3>{ar?'التحدث مع فريق بلقيس':'Talk to Balqees team'}</h3></div><button type="button" onClick={()=>setShowNew(false)}><X/></button></header>{answer?.summary&&<div className="client-inline-note"><strong>{ar?'السياق سينتقل للفريق':'Context will be handed over'}</strong><span>{answer.summary}</span></div>}<label>{ar?'الموضوع':'Subject'}<input value={subject} onChange={e=>setSubject(e.target.value)} required/></label><label>{ar?'ما الذي تحتاجه؟':'What do you need?'}<textarea rows="6" value={first} onChange={e=>setFirst(e.target.value)} required/></label><footer><button type="button" className="client-secondary" onClick={()=>setShowNew(false)}>{ar?'إلغاء':'Cancel'}</button><button className="client-primary" disabled={busy}><Send/>{ar?'إرسال الحالة للفريق':'Send case to team'}</button></footer></form></div>}
  </div>;
}
