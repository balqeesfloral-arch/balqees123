import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8"}});
const safeText=(v:unknown,n=1200)=>String(v??"").slice(0,n);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context={type?:"order"|"quotation"|"contract"|"document"|"site";id?:string;title?:string;sourceKind?:string};
type Intent={intent:string;query?:string};

const TOOL_MAP:Record<string,string>={
  active_orders:"care_get_active_orders_v2",
  order_details:"care_get_order_details_v2",
  quotation:"care_get_quotation_v2",
  quotation_compare:"care_compare_quotation_versions_v2",
  contract:"care_get_contract_summary_v2",
  site:"care_get_site_details_v2",
  financial:"care_get_financial_documents_v2",
  catalog:"care_search_catalog_v2",
  knowledge:"care_search_knowledge_v2",
  repeat_order:"care_prepare_repeat_order_v2",
  request_draft:"care_create_request_draft_v2",
};

function expectedIntentFromContext(ctx:Context|undefined,q:string){
  const t=(q||"").toLowerCase();
  if(ctx?.type==="quotation"&&/(تغير|تغيير|فرق|ليش|compare|change|difference)/i.test(t))return "quotation_compare";
  if(ctx?.type==="quotation")return "quotation";
  if(ctx?.type==="order"&&/(كرر|إعادة|repeat)/i.test(t))return "repeat_order";
  if(ctx?.type==="order")return "order_details";
  if(ctx?.type==="contract")return "contract";
  if(ctx?.type==="site")return "site";
  if(ctx?.type==="document")return "financial";
  return null;
}

async function modelJson(baseUrl:string,key:string,model:string,messages:Array<{role:string;content:string}>,maxTokens=500){
  const r=await fetch(baseUrl,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},body:JSON.stringify({model,messages,temperature:0.1,max_tokens:maxTokens,response_format:{type:"json_object"}})});
  if(!r.ok)throw new Error(`AI_PROVIDER_${r.status}`);
  const d=await r.json(); const content=d?.choices?.[0]?.message?.content;
  if(!content)throw new Error("AI_EMPTY");
  return JSON.parse(content);
}

async function classify(baseUrl:string,key:string,model:string,question:string,context:Context|undefined):Promise<Intent>{
  const contextual=expectedIntentFromContext(context,question);
  if(contextual)return {intent:contextual,query:question};
  const system=`You classify requests for Balqees Floral B2B customer care. Output JSON only. Never invent IDs. Allowed intents: active_orders, order_details, quotation, quotation_compare, contract, site, financial, catalog, knowledge, repeat_order, request_draft, handoff, unknown. Use handoff for refunds, compensation, cancellation after fulfillment has begun, money changes, ambiguous legal interpretation, or sensitive exceptions. Use request_draft only to prepare a non-binding draft. Do not choose any tool outside this list.`;
  const result=await modelJson(baseUrl,key,model,[{role:"system",content:system},{role:"user",content:JSON.stringify({question:safeText(question,1200),context:context||null})}],250);
  return {intent:TOOL_MAP[result.intent]?result.intent:(result.intent==="handoff"?"handoff":"unknown"),query:safeText(result.query||question,500)};
}

function rpcArgs(intent:string,org:string,context:Context|undefined,question:string){
  const id=context?.id&&UUID.test(context.id)?context.id:null;
  switch(intent){
    case "active_orders":return {p_organization_id:org,p_site_id:context?.type==="site"?id:null};
    case "order_details":return id?{p_organization_id:org,p_order_id:id}:null;
    case "quotation":return id?{p_organization_id:org,p_quotation_id:id}:null;
    case "quotation_compare":return id?{p_organization_id:org,p_quotation_id:id}:null;
    case "contract":return id?{p_organization_id:org,p_contract_id:id}:null;
    case "site":return id?{p_organization_id:org,p_site_id:id}:null;
    case "financial":return {p_organization_id:org,p_limit:context?.type==="document"?1:12,p_source_kind:context?.type==="document"?(context.sourceKind||"client_document"):null,p_source_id:context?.type==="document"?id:null};
    case "catalog":return {p_organization_id:org,p_query:safeText(question,500),p_site_id:context?.type==="site"?id:null,p_limit:6};
    case "knowledge":return {p_organization_id:org,p_query:safeText(question,500),p_limit:4};
    case "repeat_order":return id?{p_organization_id:org,p_order_id:id}:null;
    case "request_draft":return {p_organization_id:org,p_site_id:context?.type==="site"?id:null,p_payload:{description:safeText(question,1000),source_context:context||null}};
    default:return null;
  }
}

function minimizeForModel(intent:string,result:any){
  const arr=(v:any)=>Array.isArray(v)?v:[];
  const take=(obj:any,keys:string[])=>Object.fromEntries(keys.filter(k=>obj&&obj[k]!==undefined).map(k=>[k,obj[k]]));
  switch(intent){
    case "active_orders":
      return arr(result).slice(0,8).map(x=>take(x,["order_number","reference","status","created_at","updated_at","requested_delivery_date"]));
    case "order_details":
      return result?{
        order:take(result.order||result,["order_number","reference","status","created_at","updated_at","requested_delivery_date","notes"]),
        item_count:arr(result.items).length,
        items:arr(result.items).slice(0,8).map((x:any)=>({
          quantity:x?.quantity,
          name_ar:x?.item_name_ar||x?.name_ar||x?.product_snapshot?.name_ar||x?.product_snapshot?.title_ar||null,
          name_en:x?.item_name_en||x?.name_en||x?.product_snapshot?.name_en||x?.product_snapshot?.title_en||null,
        })),
        recent_events:arr(result.events).slice(0,6).map((x:any)=>take(x,["title_ar","title_en","body_ar","body_en","created_at"])),
      }:null;
    case "quotation":
      return result?{
        ...take(result,["quote_number","version_number","status","valid_until","title_ar","title_en","total","subtotal","vat_total"]),
        items:arr(result.items).slice(0,8).map((x:any)=>take(x,["description_ar","description_en","quantity","unit_ar","unit_en","unit_price","line_total"])),
      }:null;
    case "quotation_compare":
      return result?{
        ...take(result,["current_version","previous_version","current_total","previous_total","message"]),
        changes:arr(result.changes).slice(0,12).map((x:any)=>take(x,["description_ar","description_en","change_type","before_quantity","after_quantity","before_unit_price","after_unit_price"])),
      }:null;
    case "contract":
      return result?{
        contract:take(result.contract,["contract_number","title_ar","title_en","status","starts_on","ends_on","services_summary_ar","services_summary_en","coverage_notes_ar","coverage_notes_en","next_review_on","renewal_status"]),
        coverage_is_structured:Boolean(result.coverage_is_structured),
        sites:arr(result.sites).slice(0,20).map((x:any)=>take(x,["coverage_status","notes_ar","notes_en","site_id"])),
        services:arr(result.services).slice(0,20).map((x:any)=>take(x,["service_key","title_ar","title_en","coverage_status","summary_ar","summary_en","conditions_ar","conditions_en"])),
      }:null;
    case "site":
      return result?take(result,["name_ar","name_en","site_type","is_active","address","access_notes","access_details","last_verified_at"]):null;
    case "financial":
      return arr(result).slice(0,12).map(x=>take(x,["document_number","document_type","title_ar","title_en","issued_on","status","amount","vat_amount","total_amount","currency"]));
    case "catalog":
      return arr(result).slice(0,8).map(x=>take(x,["name_ar","name_en","pricing_mode","display_price","base_price","availability","availability_status","sku"]));
    case "knowledge":
      return arr(result).slice(0,5).map(x=>take(x,["category","title_ar","title_en","body_ar","body_en"]));
    case "repeat_order":
    case "request_draft":
      return result?take(result,["route"]):null;
    default:
      return null;
  }
}

function routeFor(intent:string,context:Context|undefined,result:any){
  if(intent==="active_orders"){const x=Array.isArray(result)?result[0]:null;return x?.id?`/portal/orders/${x.id}`:"/portal/orders";}
  if(intent==="order_details")return context?.id?`/portal/orders/${context.id}`:"/portal/orders";
  if(intent==="quotation"||intent==="quotation_compare")return context?.id?`/portal/quotes/${context.id}`:"/portal/quotes";
  if(intent==="contract")return context?.id?`/portal/contracts/${context.id}`:"/portal/contracts";
  if(intent==="site")return context?.id?`/portal/sites/${context.id}`:"/portal/sites";
  if(intent==="financial")return context?.type==="document"&&context?.id?`/portal/financial/${context.sourceKind||"client_document"}/${context.id}`:"/portal/financial";
  if(intent==="catalog")return "/portal/catalog";
  if(intent==="repeat_order"||intent==="request_draft")return result?.route||"/portal/request/new";
  return null;
}

async function present(baseUrl:string,key:string,model:string,language:string,question:string,intent:string,result:any,route:string|null){
  const system=`You are the language layer for Balqees Floral B2B Care. You may ONLY summarize the supplied authorized tool result. Never add facts, prices, legal interpretation, promises, SLA, availability, or status not present in the result. If data is missing say it is not confirmed. For contract coverage: if coverage_is_structured is false, state that human review is required and do not interpret legal text. Reply as JSON only with: title (string), summary (string), facts (array max 6 strings). Language must be ${language==="en"?"English":"Arabic"}. Keep it concise and professional. Do not reveal internal reasoning or chain of thought.`;
  const payload={question:safeText(question,800),intent,tool_result:result};
  const out=await modelJson(baseUrl,key,model,[{role:"system",content:system},{role:"user",content:JSON.stringify(payload).slice(0,18000)}],650);
  const facts=Array.isArray(out.facts)?out.facts.slice(0,6).map((x:unknown)=>safeText(x,300)):[];
  const label=language==="en"?"Open related record":"فتح السجل المرتبط";
  return {title:safeText(out.title,180),summary:safeText(out.summary,1200),facts,actions:route?[{kind:"route",route,label}]:[]};
}

async function presentAgentAssist(baseUrl:string,key:string,model:string,language:string,base:any){
  const messages=Array.isArray(base?.messages)?base.messages.slice(-12).map((m:any)=>({role:m?.role,body:safeText(m?.body,700)})):[];
  const refs=Array.isArray(base?.knowledge_refs)?base.knowledge_refs.slice(0,3).map((k:any)=>({
    title_ar:safeText(k?.title_ar,180),title_en:safeText(k?.title_en,180),
    body_ar:safeText(k?.body_ar,1000),body_en:safeText(k?.body_en,1000),
  })):[];
  const rawContext=base?.context&&typeof base.context==="object"?base.context:{};
  const context={
    entity_type:safeText(rawContext.entity_type,40),entity_id:safeText(rawContext.entity_id,80),
    question:safeText(rawContext.question,700),tool_names:Array.isArray(rawContext.tool_names)?rawContext.tool_names.slice(0,10).map((x:unknown)=>safeText(x,80)):[],
    assistant_history:Array.isArray(rawContext.assistant_history)?rawContext.assistant_history.slice(-6).map((h:any)=>({question:safeText(h?.question,500),title:safeText(h?.title,180),summary:safeText(h?.summary,700),tools:Array.isArray(h?.tools)?h.tools.slice(0,8).map((x:unknown)=>safeText(x,80)):[]})):[],
  };
  const system=`You are Balqees Care Agent Assist for a human employee. Draft assistance only; the human must review before sending. Use ONLY the supplied conversation, handoff context, and reviewed knowledge references. Never invent order state, price, SLA, refund, policy, availability, legal interpretation or promises. If the evidence is insufficient, explicitly recommend verifying the linked record or asking one precise clarification. Output JSON only with summary and suggestion. Language must be ${language==="en"?"English":"Arabic"}. Do not output hidden reasoning or chain of thought.`;
  const payload={existing_summary:safeText(base?.summary,1200),conversation:messages,handoff_context:context,knowledge_refs:refs};
  const out=await modelJson(baseUrl,key,model,[{role:"system",content:system},{role:"user",content:JSON.stringify(payload).slice(0,16000)}],700);
  return {...base,summary:safeText(out.summary||base?.summary,1400),suggestion:safeText(out.suggestion||base?.suggestion,1600),source:"ai"};
}

async function presentNotificationSummary(baseUrl:string,key:string,model:string,language:string,center:any){
  const items=Array.isArray(center?.items)?center.items:[];
  const compact=items.slice(0,30).map((n:any)=>({
    category:safeText(n?.category,40),priority:safeText(n?.priority,20),action_required:Boolean(n?.action_required),
    action_resolved:Boolean(n?.action_resolved),action_available:n?.action_available!==false,
    title:safeText(language==="en"?(n?.title_en||n?.title_ar):n?.title_ar,220),
    body:safeText(language==="en"?(n?.body_en||n?.body_ar):n?.body_ar,420),
  }));
  const system=`You summarize Balqees Floral B2B notifications for the signed-in organization member. Use ONLY the supplied authorized notification projection. Focus on decisions first, then meaningful operational changes. Do not invent deadlines, statuses, prices, recipients, SLA, or recommendations not present in the data. If an action is not available to this user, say it needs an authorized organization member rather than telling them to perform it. Output JSON only with summary (string). Language must be ${language==="en"?"English":"Arabic"}. Maximum 120 words. No hidden reasoning or chain of thought.`;
  const payload={action_count:Number(center?.action_count||0),unread_count:Number(center?.unread_count||0),away:center?.away||null,notifications:compact};
  const out=await modelJson(baseUrl,key,model,[{role:"system",content:system},{role:"user",content:JSON.stringify(payload).slice(0,14000)}],450);
  return safeText(out?.summary,1400);
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  try{
    const auth=req.headers.get("Authorization")||"";
    if(!auth.startsWith("Bearer "))return json({error:"AUTH_REQUIRED"},401);
    const url=Deno.env.get("SUPABASE_URL")||"";
    const publicKey=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
    if(!url||!publicKey)return json({error:"SUPABASE_ENV_MISSING"},500);
    // IMPORTANT: this client uses the caller's JWT. No service-role credential is used by Care.
    const sb=createClient(url,publicKey,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userError}=await sb.auth.getUser();
    if(userError||!user)return json({error:"AUTH_REQUIRED"},401);

    const body=await req.json().catch(()=>({}));
    const mode=body.mode==="agent_assist"?"agent_assist":body.mode==="notification_summary"?"notification_summary":"customer";
    const organizationId=safeText(body.organization_id,64); const question=safeText(body.question,1400).trim();
    const context=(body.context&&typeof body.context==="object"?body.context:undefined) as Context|undefined;
    const language=body.language==="en"?"en":"ar";

    const {data:setting,error:settingError}=await sb.from("care_settings").select("ai_enabled,employee_assist_enabled").eq("id",true).maybeSingle();
    if(settingError)return json({fallback:true,reason:"SETTINGS_UNAVAILABLE"},200);
    if(setting&&!setting.ai_enabled)return json({fallback:true,reason:"AI_DISABLED"},200);

    const baseUrl=Deno.env.get("BALQEES_AI_BASE_URL")||"";
    const aiKey=Deno.env.get("BALQEES_AI_API_KEY")||"";
    const model=Deno.env.get("BALQEES_AI_MODEL")||"";
    if(!baseUrl||!aiKey||!model)return json({fallback:true,reason:"AI_PROVIDER_NOT_CONFIGURED"},200);

    if(mode==="notification_summary") {
      if(!UUID.test(organizationId))return json({fallback:true,reason:"INVALID_ORGANIZATION"},200);
      const {data:center,error:centerError}=await sb.rpc("get_my_b2b_notification_center_v1",{p_organization_id:organizationId});
      if(centerError||!center)return json({fallback:true,reason:"NOTIFICATION_CENTER_UNAVAILABLE"},200);
      const summary=await presentNotificationSummary(baseUrl,aiKey,model,language,center);
      return json({summary,source:"ai"});
    }

    if(mode==="agent_assist") {
      const conversationId=safeText(body.conversation_id,64);
      if(!UUID.test(conversationId)||setting?.employee_assist_enabled===false)return json({fallback:true,reason:"AGENT_ASSIST_UNAVAILABLE"},200);
      const {data:baseAssist,error:assistError}=await sb.rpc("admin_get_care_assist_v2",{p_conversation_id:conversationId});
      if(assistError||!baseAssist)return json({fallback:true,reason:"AGENT_ASSIST_ACCESS_DENIED"},200);
      const assist=await presentAgentAssist(baseUrl,aiKey,model,language,baseAssist);
      // Audit only the fact that the external language layer was used; never store prompts or hidden reasoning.
      try{await sb.rpc("admin_log_care_assist_ai_v2",{p_conversation_id:conversationId});}catch{/* audit logging must not block the employee draft */}
      return json({assist,source:"ai"});
    }

    if(!UUID.test(organizationId)||question.length<2)return json({error:"INVALID_REQUEST"},400);
    const classified=await classify(baseUrl,aiKey,model,question,context);
    if(classified.intent==="handoff"||classified.intent==="unknown")return json({fallback:true,reason:classified.intent.toUpperCase()},200);
    const tool=TOOL_MAP[classified.intent]; const args=rpcArgs(classified.intent,organizationId,context,question);
    if(!tool||!args)return json({fallback:true,reason:"EXACT_CONTEXT_REQUIRED"},200);

    // The model never controls the RPC name. The allow-list above is the only tool surface.
    const {data:result,error:toolError}=await sb.rpc(tool,args);
    if(toolError)return json({fallback:true,reason:"AUTHORIZED_TOOL_FAILED"},200);
    const route=routeFor(classified.intent,context,result);
    // Data minimization: the external language provider receives only fields needed
    // to explain the authorized tool result, never the complete database payload.
    const modelResult=minimizeForModel(classified.intent,result);
    const answer=await present(baseUrl,aiKey,model,language,question,classified.intent,modelResult,route);
    return json({answer,tools:[{tool:tool.replace(/^care_|_v2$/g,""),ok:true}],intent:classified.intent});
  }catch(e){
    // Client has deterministic safe-tool fallback; never expose provider/debug internals to the customer.
    console.error("balqees-care",e);
    return json({fallback:true,reason:"AI_LAYER_UNAVAILABLE"},200);
  }
});
