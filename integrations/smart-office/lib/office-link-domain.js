import { PortalError, uuid } from './portal-domain.js';

export const SOURCES = {
  orders:{table:'orders',entity:'projects',number:'order_number',title:'طلب متجر',path:'/admin/orders?order='},
  rfq:{table:'quote_requests',entity:'quotes',number:'request_number',title:'طلب عرض سعر',path:'/admin/quote-requests?request='},
  requests:{table:'organization_service_requests',entity:'projects',number:'request_code',title:'طلب منشأة',path:'/admin/service-requests'},
  quotations:{table:'quotations',entity:'quotes',number:'quote_number',title:'عرض منشأة',path:'/admin/quotes'},
  contracts:{table:'contracts',entity:'contracts',number:'contract_number',title:'عقد',path:'/admin/contracts'},
};
export function sourceKind(value) {
  if (!Object.hasOwn(SOURCES,value)) throw new PortalError('SOURCE_INVALID','اختر نوع السجل.');
  return value;
}
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const round=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
function nonnegative(value) {const n=Number(value||0);if(!Number.isFinite(n)||n<0)throw new PortalError('PRICE_INVALID','راجع القيمة المالية في مصدر الموقع.',409);return n;}
export function officeSource(source) {
  const {cod_confirmation_token,checkout_idempotency_key,request_token,...record}=source;
  return record;
}
const date=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Riyadh'}).format(new Date());
export function sourceMatchesLink(kind,source,link) {
  if (!link?.is_active) return false;
  if (source.organization_id) return link.organization_id===source.organization_id;
  return !!source.user_id && link.user_id===source.user_id;
}
export function validateQuoteInput(input) {
  const amount=Number(input.amount),vat=Number(input.vatRate??15),reply=clean(input.reply,4001);
  if (!Number.isFinite(amount)||amount<=0||amount>1e9||round(amount)!==amount) throw new PortalError('PRICE_INVALID','أدخل إجماليًا صحيحًا أكبر من صفر، بمنزلتين عشريتين.');
  if (!Number.isFinite(vat)||vat<0||vat>100) throw new PortalError('VAT_INVALID','راجع نسبة الضريبة.');
  if (reply.length<3||reply.length>4000) throw new PortalError('REPLY_INVALID','اكتب نطاق العرض وشروطه، حتى 4000 حرف.');
  const validUntil=input.validUntil||null;
  if (validUntil&&(!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)||!Number.isFinite(Date.parse(validUntil))||new Date(`${validUntil}T12:00:00Z`).toISOString().slice(0,10)!==validUntil||validUntil<date())) throw new PortalError('VALIDITY_INVALID','راجع تاريخ صلاحية العرض.');
  return {amount,vat,reply,validUntil};
}
export function clientPayload(kind,target) {
  const org=kind==='organization';
  const name=clean(org?target.display_name||target.legal_name:target.full_name,200);
  if (!name) throw new PortalError('CLIENT_INVALID','أكمل اسم العميل في حساب الموقع قبل الاستيراد.');
  const address=target.national_address||{};
  return {entity:'clients',record:{name,contact_name:org?clean(target.contact_role,160):name,
    phone:clean(org?target.contact_phone:target.phone,40),email:clean(org?target.contact_email:target.email,254),
    vat_no:org&&target.vat_registered?clean(target.vat_number,40):'',city:clean(address.city,100),
    address:[address.building_number,address.street,address.district,address.city,address.postal_code].filter(Boolean).map(x=>clean(x,160)).join('، '),
    payment_terms_days:0,credit_limit:0,notes:`حساب الموقع: ${org?'منشأة':'فرد'} ${target.id}`}};
}
export function importPayload(kind,source,link,{items=[],financial=null,vatRate=15}={}) {
  sourceKind(kind);
  if (!sourceMatchesLink(kind,source,link)) throw new PortalError('CLIENT_MISMATCH','حساب العميل في الطلب لا يطابق الربط. اربط الحساب الصحيح أولًا.',409);
  if (['draft','cancelled'].includes(source.status)) throw new PortalError('SOURCE_NOT_READY','السجل مسودة أو ملغى؛ لم يُضف إلى المكتب.',409);
  const ref=`${SOURCES[kind].title} #${source[SOURCES[kind].number]}`;
  const notes=`${ref} | الموقع: ${source.id} | الحالة عند الاستيراد: ${source.status} | تحديث المصدر: ${source.updated_at}`;
  const record={client_id:link.office_client_id,client_name:link.office_client_name,notes};
  if (kind==='orders'||kind==='requests') {
    const brief=kind==='orders'?items.map(x=>`${clean(x.product_snapshot?.name_ar||x.product_snapshot?.name_en,150)} × ${x.quantity}`).join('، '):clean(source.description,3000);
    return {entity:'projects',record:{...record,name:ref,start_date:source.requested_delivery_date||source.requested_date||date(),end_date:'',
      contract_value:kind==='orders'?nonnegative(source.total):0,status:'قيد التنفيذ',notes:`${notes}\n${brief}\n${clean(source.customer_note,1200)}`}};
  }
  if (kind==='contracts') return {entity:'contracts',record:{...record,start_date:source.starts_on||'',end_date:source.ends_on||'',
    value:nonnegative(financial?.contract_value),billing_cycle:'أخرى',status:({active:'ساري',expiring:'ساري',expired:'منتهي',terminated:'معلق'})[source.status]||'معلق',
    renewal_alert_days:30,responsible:'',notes:`${notes}\n${clean(source.title_ar,200)}\n${clean(source.services_summary_ar,3000)}`}};
  if (kind==='rfq'&&source.status!=='quoted') throw new PortalError('PRICE_REQUIRED','سجّل عرض السعر للعميل أولًا، ثم استورده إلى المكتب.',409);
  if (kind==='quotations'&&!['sent','viewed','accepted','declined','revision_requested','expired'].includes(source.status)) throw new PortalError('SOURCE_NOT_READY','انشر العرض من الموقع قبل استيراده إلى المكتب.',409);
  const total=Number(kind==='rfq'?source.quote_amount:source.total),vat=Number(kind==='rfq'?vatRate:source.vat_rate);
  if (!Number.isFinite(total)||total<=0||!Number.isFinite(vat)||vat<0||vat>100) throw new PortalError('PRICE_INVALID','راجع مبلغ العرض ونسبة الضريبة.',409);
  const subtotal=kind==='rfq'?round(total/(1+vat/100)):Number(source.subtotal)-Number(source.discount_total||0);
  const vatAmount=kind==='rfq'?round(total-subtotal):Number(source.vat_total);
  if (Math.abs(round(subtotal+vatAmount)-total)>.01) throw new PortalError('PRICE_MISMATCH','مجموع العرض والضريبة غير متطابق. راجع العرض في الموقع.',409);
  return {entity:'quotes',record:{...record,date:date(),description:kind==='rfq'?clean(source.admin_reply,4000):`${clean(source.title_ar,200)}\n${items.map(x=>`${clean(x.description_ar,1000)} × ${x.quantity}`).join('\n')}\n${clean(source.terms_ar,4000)}`,
    subtotal,vat_rate:vat,vat_amount:vatAmount,total,valid_until:source.quote_valid_until||source.valid_until||'',status:source.status==='accepted'?'مقبول':source.status==='declined'?'مرفوض':'أرسل',followup_date:'',probability:source.status==='accepted'?100:0}};
}
export function verifyImportedRecord(found,job) {
  if (!found) return null;
  const expected=job.payload.record;
  if (found.deleted_at||found.id!==job.id||Object.entries(expected).some(([key,value])=>
    typeof value==='number'?(!Number.isFinite(Number(found[key]))||Math.abs(Number(found[key])-value)>.005):String(found[key]??'')!==String(value??''))) {
    throw new PortalError('LEDGER_CONFLICT','السجل موجود في المكتب وتغيّرت بياناته. راجع القيد الموجود؛ لم تُضف نسخة أخرى.',409);
  }
  return found;
}
export function operationInput(input) {
  return {kind:sourceKind(input.kind),id:uuid(input.id)};
}
