export class PortalError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
export function uuid(value) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(value || ''))) {
    throw new PortalError('INVALID_ID', 'مرجع العملية غير صالح.');
  }
  return value.toLowerCase();
}
export const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o?.[k] ?? '']));
export function statementFilters(input = {}) {
  const dates = {};
  for (const key of ['from', 'to']) {
    const value = String(input[key] || '');
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) {
      throw new PortalError('INVALID_DATE', 'اختر تاريخًا صحيحًا للكشف.');
    }
    dates[key] = value;
  }
  if (dates.from && dates.to && dates.from > dates.to) throw new PortalError('INVALID_RANGE', 'بداية الفترة يجب أن تسبق نهايتها.');
  return dates;
}
// Portal statements require ledger IDs. Legacy name-only rows must be assigned
// in the Office before delivery; names can never establish customer identity.
export function strictClientRows(clients, recs, transfers, client) {
  const name = String(client.name || '').trim().toLowerCase();
  const sameName = value => name && String(value || '').trim().toLowerCase() === name;
  const legacy = recs.some(r => !r.client_id && sameName(r.client_name)) ||
    transfers.some(t => (!t.party_type || t.party_type === 'عميل') && !t.party_id && sameName(t.party_name));
  const malformed = transfers.some(t => String(t.party_id) === String(client.id) && t.party_type !== 'عميل');
  if (legacy || malformed || clients.filter(c => String(c.id) === String(client.id)).length !== 1) {
    throw new PortalError('CLIENT_IDENTITY_REQUIRED', 'توجد قيود غير مرتبطة بمعرّف العميل. صحّح جهة الفاتورة أو الحوالة في المكتب قبل إرسال الكشف.', 409);
  }
  return {
    recs: recs.filter(r => String(r.client_id) === String(client.id)),
    transfers: transfers.filter(t => t.party_type === 'عميل' && String(t.party_id) === String(client.id)),
  };
}
export function publicStatement(report, company = {}) {
  // Never deliver internal client notes, Drive folder IDs or company secrets.
  return { ...report,
    client: pick(report.client, ['id','client_no','name','vat_no','city','address']),
    company: pick(company, ['company_name','company_name_en','vat_no','cr_no','unified_no','city','phone','email','website','address']),
  };
}
export function verifyTransfer(record, payment, link) {
  if (!record) return null;
  if (record.deleted_at || String(record.id) !== payment.id || record.transfer_no !== `WEB-${payment.id}` ||
      record.direction !== 'وارد' || record.party_type !== 'عميل' || String(record.party_id) !== link.office_client_id ||
      Math.round(Number(record.amount) * 100) !== Math.round(Number(payment.amount) * 100) ||
      String(record.date).slice(0,10) !== payment.payment_date || String(record.bank_ref) !== payment.bank_reference) {
    throw new PortalError('LEDGER_CONFLICT', 'يوجد قيد يحمل مرجع الإيصال ببيانات مختلفة أو محذوفة. يحتاج مطابقة يدوية في المكتب.', 409);
  }
  return record;
}
export function possibleDuplicateTransfer(rows,payment,client) {
  const normalize=value=>String(value || '').trim().replace(/\s+/g,' ').toLowerCase();
  return rows.find(r=>!r.deleted_at && r.direction==='وارد' && (!r.party_type || r.party_type==='عميل') &&
    (String(r.party_id)===String(client.id) || (!r.party_id && normalize(r.party_name)===normalize(client.name))) &&
    normalize(r.bank_ref)===normalize(payment.bank_reference) && String(r.date).slice(0,10)===payment.payment_date &&
    Math.round(Number(r.amount)*100)===Math.round(Number(payment.amount)*100));
}
export function validateAttachment(file) {
  const allowed = {'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
  const ext = allowed[file?.type];
  if (!ext || typeof file?.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64)) {
    throw new PortalError('FILE_TYPE', 'ارفع ملف PDF أو صورة PNG أو JPG أو WebP.');
  }
  const bytes = Buffer.from(file.base64, 'base64');
  if (!bytes.length || bytes.length > 3 * 1024 * 1024) throw new PortalError('FILE_SIZE', 'الحد الأقصى للمستند 3 ميجابايت.');
  const hex = bytes.subarray(0,12).toString('hex');
  const valid = ext === 'pdf' ? bytes.subarray(0,5).toString() === '%PDF-' : ext === 'png' ? hex.startsWith('89504e470d0a1a0a') :
    ext === 'jpg' ? hex.startsWith('ffd8ff') : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
  if (!valid) throw new PortalError('FILE_CONTENT', 'محتوى الملف لا يطابق نوعه.');
  return {bytes,ext,type:file.type,name:String(file.name || `document.${ext}`).replace(/[\r\n]/g,' ').slice(0,200)};
}
