import { PortalError, uuid, statementFilters, publicStatement, validateAttachment, verifyTransfer } from './portal-domain.js';
import { createOfficeLinkService } from './office-link-service.js';

export function createPortalService({store, ledger}) {
  const officeLink=createOfficeLinkService({store,ledger});
  const needLink = async id => {
    const link = await store.one('accounting_links',uuid(id));
    if (!link?.is_active) throw new PortalError('LINK_REQUIRED','اختر ربطًا نشطًا للعميل.',404);
    return link;
  };
  const finish = (claim, recorded, note, actor) => store.rpc('accounting_finish_payment',{
    p_id:claim.payment.id,p_token:claim.token,p_recorded:recorded,p_note:note,p_actor:actor,
  });
  async function statement(link, input) {
    const [report, company] = await Promise.all([
      ledger.statement({...statementFilters(input),client:link.office_client_id,strict_client_identity:true}),ledger.company(),
    ]);
    if (String(report.client?.id) !== link.office_client_id) throw new PortalError('CLIENT_MISMATCH','هوية العميل في الكشف لا تطابق الربط.',409);
    return publicStatement(report,company);
  }
  async function reviewPayment(input, actor) {
    const claim = await store.rpc('accounting_claim_payment',{p_id:uuid(input.id),p_actor:actor});
    if (claim.payment.status === 'recorded') return claim.payment;
    // All attempts first reconcile the deterministic ledger reference. Once an
    // append may have started, no retry can append another row, even on timeout.
    try {
      const existing = verifyTransfer(await ledger.find(claim.payment.id),claim.payment,claim.link);
      if (existing) return await finish(claim,true,'تمت مطابقة الحوالة في المكتب.',actor);
      if (!claim.can_append) {
        throw new PortalError('RECONCILE_REQUIRED','لم تظهر الحوالة بعد. حدّث المطابقة لاحقًا؛ لا تعِد إدخالها يدويًا قبل مراجعة سجل المكتب.',409);
      }
      const proof = await store.proof(claim.payment.proof_path);
      const prepared = await ledger.prepare(claim.payment,claim.link,proof);
      await store.rpc('accounting_mark_append',{p_id:claim.payment.id,p_token:claim.token});
      // Exactly one HTTP append per durable claim; there is no automatic retry.
      await ledger.append(prepared);
      return await finish(claim,true,'تم اعتماد الإيصال وتسجيل حوالة واردة في المكتب.',actor);
    } catch (error) {
      if (claim.can_append) {
        // The DB decides pending vs needs_review based on its durable marker,
        // including the case where the mark-append response itself was lost.
        await finish(claim,false,'تحتاج العملية إلى تحقق من حالة التسجيل قبل المتابعة.',actor).catch(() => {});
      }
      throw error;
    }
  }
  return async function execute(action, input = {}, actor) {
    if (action === 'state') {
      const [clients,links,profiles,organizations,payments,statements,documents] = await Promise.all([
        ledger.clients(),store.select('accounting_links',{select:'*',order:'created_at.desc',limit:'1000'}),
        store.select('customer_profiles',{select:'id,full_name,email,phone,account_type',account_type:'eq.individual',limit:'1000'}),
        store.select('organizations',{select:'id,legal_name,display_name,contact_email,commercial_number',limit:'1000'}),
        store.select('accounting_payments',{select:'*',order:'created_at.desc',limit:'250'}),
        store.select('accounting_statements',{select:'id,link_id,statement_number,created_at',order:'created_at.desc',limit:'100'}),
        store.select('accounting_documents',{select:'*',order:'created_at.desc',limit:'100'}),
      ]);
      return {version:'10.50',clients,links,profiles,organizations,payments,statements,documents,limits:{payments:250,statements:100,documents:100,targets:1000}};
    }
    if (action === 'bind') {
      const clients = await ledger.clients();
      const client = clients.find(c => String(c.id) === String(input.officeId));
      if (!client) throw new PortalError('CLIENT_NOT_FOUND','اختر عميلًا موجودًا في المكتب.',404);
      const kind = input.kind === 'organization' ? 'organization' : input.kind === 'individual' ? 'individual' : '';
      if (!kind) throw new PortalError('TARGET_REQUIRED','حدد نوع حساب الموقع.');
      const target = await store.one(kind === 'individual' ? 'customer_profiles' : 'organizations',uuid(input.targetId));
      if (!target || (kind === 'individual' && target.account_type !== 'individual')) throw new PortalError('TARGET_REQUIRED','حساب العميل غير موجود أو لا يطابق النوع.');
      return store.rpc('accounting_bind_client',{p_office_id:String(client.id),p_name:client.name,
        p_user:kind === 'individual' ? target.id : null,p_org:kind === 'organization' ? target.id : null,p_actor:actor});
    }
    if (action === 'preview') return statement(await needLink(input.linkId),input);
    if (action === 'publishStatement') {
      const id = uuid(input.id), link = await needLink(input.linkId);
      const existing = await store.one('accounting_statements',id);
      if (existing) {
        if (existing.link_id !== link.id) throw new PortalError('REQUEST_REUSED','مرجع الإرسال مستخدم لعميل آخر.',409);
        return existing;
      }
      // The browser cannot supply balances or statement rows.
      const report = await statement(link,input);
      return store.rpc('accounting_publish_statement',{p_id:id,p_link:link.id,p_payload:report,p_actor:actor});
    }
    if (action === 'getStatement') {
      const item = await store.one('accounting_statements',uuid(input.id));
      if (!item) throw new PortalError('NOT_FOUND','الكشف غير موجود.',404);
      return item.payload;
    }
    if (action === 'publishDocument') {
      const id = uuid(input.id),link = await needLink(input.linkId);
      const existing = await store.one('accounting_documents',id);
      if (existing) {
        if (existing.link_id !== link.id) throw new PortalError('REQUEST_REUSED','مرجع الإرسال مستخدم لعميل آخر.',409);
        return existing;
      }
      const title = String(input.title || '').trim();
      if (!title || title.length > 200 || !['invoice','receipt','statement','credit_note','debit_note','quotation','contract','other'].includes(input.type)) throw new PortalError('DOCUMENT_INVALID','أكمل عنوان المستند ونوعه.');
      const file = validateAttachment(input.file), path = `${link.id}/${id}.${file.ext}`;
      // Immutable objects. A lost upload response can be retried only if the
      // existing object has exactly the same bytes (checked by upload adapter).
      await store.upload(path,file);
      return store.rpc('accounting_publish_document',{p_id:id,p_link:link.id,p_title:title,p_type:input.type,p_path:path,p_name:file.name,p_actor:actor});
    }
    if (action === 'reviewPayment') return reviewPayment(input,actor);
    if (action === 'rejectPayment') return store.rpc('accounting_reject_payment',{p_id:uuid(input.id),p_reason:String(input.reason || ''),p_actor:actor});
    if (action === 'proof' || action === 'document') {
      const item = await store.one(action === 'proof' ? 'accounting_payments' : 'accounting_documents',uuid(input.id));
      if (!item) throw new PortalError('NOT_FOUND','المستند غير موجود.',404);
      return {url:await store.signed(action === 'proof' ? 'accounting-proofs' : 'accounting-documents',item.proof_path || item.file_path)};
    }
    const result=await officeLink(action,input,actor);
    if(result!==undefined)return result;
    throw new PortalError('UNKNOWN_ACTION','الإجراء غير معروف.');
  };
}
