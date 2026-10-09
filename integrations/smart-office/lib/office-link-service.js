import { PortalError, uuid, verifyTransfer } from './portal-domain.js';
import { SOURCES, sourceKind, sourceMatchesLink, clientPayload, importPayload, verifyImportedRecord, validateQuoteInput, operationInput, officeSource } from './office-link-domain.js';

export function createOfficeLinkService({store,ledger}) {
  const needSource=async(kind,id)=>{
    const source=await store.one(SOURCES[kind].table,uuid(id));
    if(!source)throw new PortalError('NOT_FOUND','السجل غير موجود في الموقع.',404);
    return source;
  };
  const needLink=async id=>{
    const link=await store.one('accounting_links',uuid(id));
    if(!link?.is_active)throw new PortalError('LINK_REQUIRED','اربط العميل بالمكتب أولًا.',409);
    return link;
  };
  async function target(kind,id) {
    if(!['individual','organization'].includes(kind))throw new PortalError('TARGET_REQUIRED','اختر نوع الحساب.');
    const row=await store.one(kind==='individual'?'customer_profiles':'organizations',uuid(id));
    if(!row||(kind==='individual'&&row.account_type!=='individual')||(kind==='organization'&&row.status!=='active'))throw new PortalError('TARGET_REQUIRED','حساب العميل غير موجود أو غير نشط.');
    return row;
  }
  async function performImport(kind,sourceId,linkId,payload,actor) {
    const claim=await store.rpc('office_sync_claim',{p_kind:kind,p_source:sourceId,p_link:linkId,p_payload:payload,p_actor:actor});
    const job=claim.job;
    if(job.status==='recorded')return job;
    const finish=(success)=>store.rpc('office_sync_finish',{p_id:job.id,p_token:claim.token,p_recorded:success,p_actor:actor});
    try {
      const found=verifyImportedRecord(await ledger.findRecord(job.payload.entity,job.id),job);
      if(found)return await finish(true);
      if(!claim.can_append)throw new PortalError('RECONCILE_REQUIRED','لم يظهر القيد بعد. أعد التحقق لاحقًا أو راجع سجل المكتب؛ لن تُضف نسخة أخرى.',409);
      const prepared=await ledger.prepareRecord(job);
      await store.rpc('office_sync_mark_append',{p_id:job.id,p_token:claim.token});
      await ledger.appendRecord(prepared);
      return await finish(true);
    } catch(error) {
      if(claim.can_append)await finish(false).catch(()=>{});
      throw error;
    }
  }
  async function sourceDetails(kind,source) {
    let items=[],financial=null;
    if(kind==='orders'||kind==='quotations')items=await store.select(kind==='orders'?'order_items':'quotation_items',{
      [kind==='orders'?'order_id':'quotation_id']:`eq.${source.id}`,select:'*',limit:'500',...(kind==='quotations'?{order:'sort_order.asc'}:{})});
    if(kind==='contracts')financial=(await store.select('contract_financials',{contract_id:`eq.${source.id}`,select:'*',limit:'1'}))[0]||null;
    return {items,financial};
  }
  return async function execute(action,input={},actor) {
    if(action==='operations') {
      const kind=sourceKind(input.kind||'orders'),offset=Math.max(0,Math.min(Number(input.offset)||0,100000));
      const filters={select:'*',order:'created_at.desc,id.desc',limit:'51',offset:String(Math.trunc(offset))};
      if(['requests','contracts','quotations'].includes(kind))filters.status='neq.draft';
      const rows=await store.select(SOURCES[kind].table,filters),more=rows.length>50;
      const list=rows.slice(0,50),ids=list.map(r=>r.id);
      const jobs=ids.length?await store.rpc('office_sync_state',{p_kind:kind,p_sources:ids}):[];
      const userIds=[...new Set(list.map(r=>r.user_id||r.created_by).filter(Boolean))];
      const orgIds=[...new Set(list.map(r=>r.organization_id).filter(Boolean))];
      const [profiles,organizations]=await Promise.all([
        userIds.length?store.select('customer_profiles',{id:`in.(${userIds.join(',')})`,select:'id,full_name,email,phone',limit:'50'}):[],
        orgIds.length?store.select('organizations',{id:`in.(${orgIds.join(',')})`,select:'id,display_name,legal_name',limit:'50'}):[],
      ]);
      return {kind,rows:list.map(officeSource),jobs,profiles,organizations,offset,more,limit:50};
    }
    if(action==='operation') {
      const {kind,id}=operationInput(input),source=await needSource(kind,id);
      const [detail,jobs]=await Promise.all([sourceDetails(kind,source),store.rpc('office_sync_state',{p_kind:kind,p_sources:[id]})]);
      return {kind,source:officeSource(source),...detail,job:jobs[0]||null};
    }
    if(action==='createClient') {
      const row=await target(input.kind,input.targetId);
      const links=await store.select('accounting_links',{[input.kind==='individual'?'user_id':'organization_id']:`eq.${row.id}`,select:'*',limit:'1'});
      if(links.length) {
        if(!links[0].is_active)throw new PortalError('LINK_REQUIRED','ربط هذا الحساب موقوف. راجع الربط الموجود.',409);
        return links[0];
      }
      const job=await performImport(`client_${input.kind}`,row.id,null,clientPayload(input.kind,row),actor);
      return store.rpc('accounting_bind_client',{p_office_id:job.id,p_name:job.payload.record.name,p_user:input.kind==='individual'?row.id:null,p_org:input.kind==='organization'?row.id:null,p_actor:actor});
    }
    if(action==='importOperation') {
      const {kind,id}=operationInput(input),[source,link]=await Promise.all([needSource(kind,id),needLink(input.linkId)]);
      const detail=await sourceDetails(kind,source);
      return performImport(kind,id,link.id,importPayload(kind,source,link,{...detail,vatRate:input.vatRate}),actor);
    }
    if(action==='updateOperation') {
      const {kind,id}=operationInput(input);
      if(!['orders','rfq','requests'].includes(kind))throw new PortalError('SOURCE_INVALID','هذا السجل يُدار من صفحة العروض أو العقود.');
      const patch={status:String(input.status||'')};
      if(kind==='rfq')Object.assign(patch,{reply:String(input.reply||''),amount:input.status==='quoted'?Number(input.amount):null,valid_until:input.status==='quoted'?input.validUntil||null:null});
      if(kind==='orders')patch.admin_note=String(input.note||'').slice(0,4000);
      if(kind==='rfq'&&input.status==='quoted')validateQuoteInput(input);
      return officeSource(await store.rpc('office_update_request',{p_id:id,p_kind:kind,p_patch:patch,p_expected:input.expectedUpdatedAt,p_command:uuid(input.commandId),p_actor:actor}));
    }
    if(action==='createOrganizationQuote') {
      const source=await needSource('requests',input.id),q=validateQuoteInput(input);
      return store.rpc('office_quote_organization',{p_id:uuid(input.commandId),p_request:source.id,p_amount:q.amount,p_vat:q.vat,p_reply:q.reply,p_valid_until:q.validUntil,p_expected:input.expectedUpdatedAt,p_actor:actor});
    }
    if(action==='applyOrderPayment') {
      const payment=await store.one('accounting_payments',uuid(input.paymentId));
      if(payment?.status!=='recorded')throw new PortalError('PAYMENT_REQUIRED','اختر إيصالًا معتمدًا ومسجلًا في المكتب.',409);
      const link=await needLink(payment.link_id),order=await needSource('orders',input.id);
      if(!sourceMatchesLink('orders',order,link)||Number(payment.amount)!==Number(order.total))throw new PortalError('PAYMENT_MISMATCH','الإيصال لا يطابق عميل الطلب وإجماليه.',409);
      if(!verifyTransfer(await ledger.find(payment.id),payment,link))throw new PortalError('PAYMENT_REQUIRED','الحوالة غير موجودة في المكتب. راجع السداد قبل اعتماده للطلب.',409);
      return officeSource(await store.rpc('office_apply_order_payment',{p_order:order.id,p_payment:payment.id,p_expected:input.expectedUpdatedAt,p_actor:actor}));
    }
    if(action==='officeDocuments') {
      const link=await needLink(input.linkId);
      return ledger.documents(link.office_client_id);
    }
    if(action==='publishOfficeDocument') {
      const id=uuid(input.id),link=await needLink(input.linkId);
      const existing=await store.one('accounting_documents',id);
      if(existing) {
        if(existing.link_id!==link.id)throw new PortalError('REQUEST_REUSED','مرجع الإرسال مستخدم لحساب آخر.',409);
        return existing;
      }
      const file=await ledger.document(input.entity,String(input.recordId),link.office_client_id);
      const path=`${link.id}/${id}.${file.ext}`;
      await store.upload(path,file);
      return store.rpc('accounting_publish_document',{p_id:id,p_link:link.id,p_title:file.title,p_type:file.documentType,p_path:path,p_name:file.name,p_actor:actor});
    }
    return undefined;
  };
}
