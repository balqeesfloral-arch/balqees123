import {normalizeSearch} from '../assets/office-tools.js';

const numbers = {
  clients:'client_no',suppliers:'supplier_no',projects:'project_no',receivables:'receivable_no',
  transfers:'transfer_no',purchases:'purchase_no',expenses:'expense_no',personal:'personal_no',
  quotes:'quote_no',contracts:'contract_no',letters:'letter_no',archive:'archive_no'
};
const searchFields = ['name','client_name','supplier_name','project_name','party_name','contact_name',
  'phone','email','city','invoice_no','reference_no','description','subject','recipient','status'];

export function prepareSearch(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('خيارات البحث غير صحيحة.');
  const query = normalizeSearch(options.query).slice(0,120);
  const entity = String(options.entity || '');
  if (entity && !Object.hasOwn(numbers,entity)) throw new Error('قسم البحث غير معروف.');
  const requested = Number(options.limit);
  const limit = Number.isFinite(requested) && requested > 0 ? Math.max(1,Math.min(50,Math.floor(requested))) : 30;
  return {query,terms:query.length < 2 ? [] : query.split(' '),entity,limit};
}

export function searchOfficeRows(rowsByEntity, prepared) {
  const {terms,query,entity:scope,limit} = prepared;
  const hits = [];
  let scanned = 0, order = 0;
  if (!terms.length) return {items:[],matched:0,scanned:0,limit};
  for (const entity of scope ? [scope] : Object.keys(numbers)) {
    for (const row of rowsByEntity[entity] || []) {
      if (!row.id || row.deleted_at) continue;
      scanned++;
      const reference = String(row[numbers[entity]] || row.invoice_no || row.reference_no || '');
      const text = normalizeSearch([reference,...searchFields.map(field=>row[field])].join(' '));
      if (!terms.every(term=>text.includes(term))) continue;
      const title = String(row.name || row.client_name || row.party_name || row.supplier_name || row.recipient || row.subject || row.description || reference || 'سجل');
      const detail = [...new Set([row.project_name,row.invoice_no,row.subject,row.description].filter(Boolean).map(String))].join(' • ').slice(0,180);
      const rank = normalizeSearch(reference) === query ? 3 : normalizeSearch(title) === query ? 2 : 1;
      hits.push({rank,order:order++,item:{
        id:String(row.id),entity,reference,title,detail,
        date:String(row.updated_at || row.created_at || row.date || row.invoice_date || '').slice(0,10),
        status:String(row.status || '')
      }});
    }
  }
  hits.sort((a,b)=>b.rank-a.rank || b.item.date.localeCompare(a.item.date) || a.order-b.order);
  return {items:hits.slice(0,limit).map(hit=>hit.item),matched:hits.length,scanned,limit};
}
