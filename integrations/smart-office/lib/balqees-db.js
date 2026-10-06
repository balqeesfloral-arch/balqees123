
import crypto from 'node:crypto';
import { PortalError, strictClientRows, verifyTransfer, possibleDuplicateTransfer } from './portal-domain.js';
import {
  batchGetSheets, getSheetValues, updateRow, appendRow, batchUpdateRows,
  createDriveFolder, uploadDriveFile, copyDriveFile
} from './google.js';

export const APP_VERSION = '8.6.2';
const DB_ID = process.env.BALQEES_SPREADSHEET_ID || '';
const TZ = 'Asia/Riyadh';

const ENTITY = {
  clients:      {sheet:'العملاء', seq:'client', number:'client_no'},
  suppliers:    {sheet:'الموردون', seq:'supplier', number:'supplier_no'},
  projects:     {sheet:'المشاريع', seq:'project', number:'project_no'},
  receivables:  {sheet:'المستحقات', seq:'receivable', number:'receivable_no', file:'invoice_file_id', folder:'attachments_folder_id'},
  transfers:    {sheet:'الحوالات', seq:'transfer', number:'transfer_no', file:'attachment_file_id', folder:'transfers_folder_id'},
  purchases:    {sheet:'المشتريات', seq:'purchase', number:'purchase_no', file:'attachment_file_id', folder:'finance_docs_folder_id'},
  expenses:     {sheet:'مصروفات العمل', seq:'expense', number:'expense_no', file:'attachment_file_id', folder:'finance_docs_folder_id'},
  personal:     {sheet:'الحساب الشخصي', seq:'personal', number:'personal_no', file:'attachment_file_id', folder:'attachments_folder_id'},
  quotes:       {sheet:'عروض الأسعار', seq:'quote', number:'quote_no', file:'file_id', folder:'quotes_folder_id'},
  contracts:    {sheet:'العقود', seq:'contract', number:'contract_no', file:'file_id', folder:'contracts_folder_id'},
  letters:      {sheet:'الخطابات', seq:'letter', number:'letter_no', file:'file_id', folder:'letters_folder_id'},
  archive:      {sheet:'الأرشيف', seq:'archive', number:'archive_no', file:'file_id', folder:'attachments_folder_id'}
};

function entityCfg(entity) {
  const cfg = ENTITY[entity];
  if (!cfg) throw new Error('قسم غير معروف.');
  return cfg;
}
function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function round2(v) {
  return Math.round((n(v) + Number.EPSILON) * 100) / 100;
}
function now() {
  return new Date(Date.now() + 3 * 3600000).toISOString().replace('Z','').slice(0,19);
}
function today() { return now().slice(0,10); }
function dateAdd(iso, days) {
  const d = new Date(`${String(iso).slice(0,10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0,10);
}
function weekStart() {
  const t = today();
  const d = new Date(`${t}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0,10);
}
function daysBetween(a,b) {
  return Math.max(0, Math.floor((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`))/86400000));
}
function serialToIso(v, withTime=false) {
  if (typeof v !== 'number' || v < 20000 || v > 100000) return v;
  const ms = Math.round((v - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return withTime ? d.toISOString().replace('Z','').slice(0,19) : d.toISOString().slice(0,10);
}
function normalizeCell(header, value) {
  if (value === undefined || value === null) return '';
  const h = String(header || '');
  if (typeof value === 'number' && (h === 'date' || h.endsWith('_date') || h.endsWith('_at'))) {
    return serialToIso(value, h.endsWith('_at'));
  }
  return value;
}
function rowsFromValues(values, includeDeleted=false) {
  if (!Array.isArray(values) || !values.length) return [];
  const headers = (values[0] || []).map(String);
  const rows = [];
  for (let i=1;i<values.length;i++) {
    const row = values[i] || [];
    if (!row.some(v => v !== '' && v !== null && v !== undefined)) continue;
    const o = {};
    headers.forEach((h,j) => o[h] = normalizeCell(h,row[j]));
    o.__row = i + 1;
    if (includeDeleted || !o.deleted_at) rows.push(o);
  }
  return rows;
}
function headersFromValues(values) {
  return ((values && values[0]) || []).map(String);
}
function rowValues(headers, obj) {
  return headers.map(h => {
    const v = obj[h];
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  });
}
function stripMeta(o) {
  if (!o || typeof o !== 'object') return o;
  const x = {...o};
  delete x.__row;
  return x;
}
function settingsFromValues(values) {
  const rows = rowsFromValues(values, true);
  const out = {};
  rows.forEach(r => out[r.key] = r.type === 'number' ? n(r.value) : r.value);
  return out;
}
function byId(rows,id) { return rows.find(x => String(x.id) === String(id)) || {}; }

function normalizeBusinessFields(entity,r,settings) {
  const vatDefault=n(settings.vat_rate || 15);
  if(entity==='purchases'){
    r.qty=n(r.qty||1); r.unit_price=n(r.unit_price); r.subtotal=round2(r.qty*r.unit_price); r.vat_rate=n(r.vat_rate===''?vatDefault:r.vat_rate); r.vat_amount=round2(r.subtotal*r.vat_rate/100); r.total=round2(r.subtotal+r.vat_amount);
  }
  if(entity==='expenses'){
    r.amount_before_vat=n(r.amount_before_vat); r.vat_rate=n(r.vat_rate===''?vatDefault:r.vat_rate); r.vat_amount=round2(r.amount_before_vat*r.vat_rate/100); r.total=round2(r.amount_before_vat+r.vat_amount);
  }
  if(entity==='quotes'){
    r.subtotal=n(r.subtotal); r.vat_rate=n(r.vat_rate===''?vatDefault:r.vat_rate); r.vat_amount=round2(r.subtotal*r.vat_rate/100); r.total=round2(r.subtotal+r.vat_amount); r.probability=n(r.probability);
  }
  if(entity==='receivables') r.invoice_total=n(r.invoice_total);
  if(entity==='transfers'||entity==='personal') r.amount=n(r.amount);
  if(entity==='projects') r.contract_value=n(r.contract_value);
  if(entity==='contracts') r.value=n(r.value);
  if(entity==='clients') r.credit_limit=n(r.credit_limit);
  return r;
}
function enrichNames(entity,r,clients,suppliers,projects) {
  if(r.client_id) r.client_name=byId(clients,r.client_id).name||r.client_name||'';
  if(r.supplier_id) r.supplier_name=byId(suppliers,r.supplier_id).name||r.supplier_name||'';
  if(r.project_id) r.project_name=byId(projects,r.project_id).name||r.project_name||'';
  if(entity==='projects'&&r.client_id) r.client_name=byId(clients,r.client_id).name||'';
  if(entity==='transfers'&&r.party_type==='عميل'&&r.party_id) r.party_name=byId(clients,r.party_id).name||r.party_name||'';
  if(entity==='transfers'&&r.party_type==='مورد'&&r.party_id) r.party_name=byId(suppliers,r.party_id).name||r.party_name||'';
}

function partyKeyFromReceivable(r){
  if(r.client_id) return 'id:'+String(r.client_id);
  return 'name:'+String(r.client_name||'').trim().toLowerCase();
}
function partyKeyFromTransfer(t){
  if(String(t.party_type||'') && String(t.party_type||'')!=='عميل') return '';
  if(t.party_id) return 'id:'+String(t.party_id);
  return 'name:'+String(t.party_name||'').trim().toLowerCase();
}
function buildReceivableAllocation(recs,transfers){
  const invoices=recs.map(r=>({r,remaining:n(r.invoice_total)}))
    .sort((a,b)=>String(a.r.invoice_date||a.r.created_at||'').localeCompare(String(b.r.invoice_date||b.r.created_at||'')));
  const paidByInvoice={};
  const addPaid=(inv,amount)=>{
    const a=Math.min(Math.max(0,amount),Math.max(0,inv.remaining));
    if(a<=0) return 0;
    inv.remaining=round2(inv.remaining-a);
    const key=String(inv.r.invoice_no||'');
    paidByInvoice[key]=round2((paidByInvoice[key]||0)+a);
    return a;
  };
  const incoming=(transfers||[]).filter(t=>String(t.direction||'')==='وارد'&&n(t.amount)>0)
    .sort((a,b)=>String(a.date||a.created_at||'').localeCompare(String(b.date||b.created_at||'')));
  incoming.forEach(t=>{
    let left=n(t.amount);
    const invoiceNo=String(t.invoice_no||'').trim();
    if(invoiceNo){
      const linked=invoices.find(x=>String(x.r.invoice_no||'').trim()===invoiceNo);
      if(linked) left=round2(left-addPaid(linked,left));
    }
    if(left<=0) return;
    const pkey=partyKeyFromTransfer(t);
    if(!pkey) return;
    for(const inv of invoices){
      if(left<=0) break;
      if(inv.remaining<=0) continue;
      if(partyKeyFromReceivable(inv.r)!==pkey) continue;
      left=round2(left-addPaid(inv,left));
    }
  });
  return paidByInvoice;
}

function receivableState(r,paidMap=null,asOf=today()) {
  const paid=n((paidMap||{})[r.invoice_no]||0), total=n(r.invoice_total), balance=Math.max(0,total-paid);
  const due=String(r.due_date||'').slice(0,10), t=asOf;
  let status='غير مستحق',days=0,aging='غير مستحق';
  if(balance<=0) status='مدفوع';
  else if(!due) status='بدون استحقاق';
  else if(due<t){status='متأخر';days=daysBetween(due,t);aging=days<=30?'1-30 يوم':days<=60?'31-60 يوم':days<=90?'61-90 يوم':'أكثر من 90 يوم';}
  else if(due<=dateAdd(t,7)) status='مستحق قريباً';
  return {paid_amount:paid,balance,days_overdue:days,status,aging};
}
function summaryName(entity,r) {
  return r.name||r.client_name||r.supplier_name||r.party_name||r.subject||r.description||'';
}

async function audit(userEmail, action, entity, id, summary, payload) {
  try {
    const vals = await getSheetValues('سجل العمليات');
    const headers = headersFromValues(vals);
    await appendRow('سجل العمليات', rowValues(headers, {
      id: crypto.randomUUID(), timestamp: now(), user_email:userEmail||'',
      action, entity, entity_id:id, summary, payload_json:JSON.stringify(stripMeta(payload)||{})
    }));
  } catch {}
}

class SequenceManager {
  constructor(values) {
    this.values = values;
    this.headers = headersFromValues(values);
    this.rows = rowsFromValues(values, true);
    this.changed = [];
  }
  next(key) {
    const r = this.rows.find(x => String(x.key)===String(key));
    if (!r) throw new Error(`تسلسل غير موجود: ${key}`);
    const next = n(r.current_value)+1;
    r.current_value = next;
    r.updated_at = now();
    this.changed.push(r);
    return `${String(r.prefix||String(key).toUpperCase())}-${String(next).padStart(5,'0')}`;
  }
  async flush() {
    if (!this.changed.length) return;
    await batchUpdateRows(this.changed.map(r => ({
      sheet:'التسلسلات', row:r.__row, values:rowValues(this.headers,r)
    })));
    this.changed = [];
  }
}

function dashboardFromData(data) {
  const recs=data.recs, transfers=data.transfers, purchases=data.purchases, expenses=data.expenses, quotes=data.quotes, contracts=data.contracts, projects=data.projects;
  const paid=buildReceivableAllocation(recs,transfers);
  const r2=recs.map(r=>Object.assign({},r,receivableState(r,paid)));
  const month=today().slice(0,7);
  const receiptsMonth=transfers.filter(x=>x.direction==='وارد'&&String(x.date||'').slice(0,7)===month).reduce((s,x)=>s+n(x.amount),0);
  const purchaseMonth=purchases.filter(x=>String(x.date||'').slice(0,7)===month).reduce((s,x)=>s+n(x.total),0);
  const expenseMonth=expenses.filter(x=>String(x.date||'').slice(0,7)===month).reduce((s,x)=>s+n(x.total),0);
  const outstanding=r2.reduce((s,x)=>s+n(x.balance),0), overdue=r2.filter(x=>x.status==='متأخر').reduce((s,x)=>s+n(x.balance),0);
  const topOverdue=r2.filter(x=>x.status==='متأخر').sort((a,b)=>n(b.balance)-n(a.balance)).slice(0,5);
  const t=today(), plus30=dateAdd(t,30);
  const upcomingContractsAll=contracts.filter(x=>x.end_date&&x.end_date>=t&&x.end_date<=plus30&&String(x.status||'ساري')!=='ملغي').sort((a,b)=>String(a.end_date).localeCompare(String(b.end_date)));
  const followQuotesAll=quotes.filter(x=>x.followup_date&&x.followup_date<=t&&['أرسل','قيد المتابعة'].includes(String(x.status||''))).sort((a,b)=>String(a.followup_date).localeCompare(String(b.followup_date)));
  const cashflow=[], year=t.slice(0,4);
  for(let m=1;m<=12;m++){
    const mm=year+'-'+String(m).padStart(2,'0');
    cashflow.push({
      month:mm,
      receipts:transfers.filter(x=>x.direction==='وارد'&&String(x.date||'').slice(0,7)===mm).reduce((s,x)=>s+n(x.amount),0),
      costs:purchases.filter(x=>String(x.date||'').slice(0,7)===mm).reduce((s,x)=>s+n(x.total),0)+expenses.filter(x=>String(x.date||'').slice(0,7)===mm).reduce((s,x)=>s+n(x.total),0)
    });
  }
  const projectStats=projects.map(p=>{
    const billed=recs.filter(r=>r.project_id===p.id).reduce((s,r)=>s+n(r.invoice_total),0);
    const collected=transfers.filter(t=>t.direction==='وارد'&&t.project_id===p.id).reduce((s,t)=>s+n(t.amount),0);
    const costs=purchases.filter(x=>x.project_id===p.id).reduce((s,x)=>s+n(x.total),0)+expenses.filter(x=>x.project_id===p.id).reduce((s,x)=>s+n(x.total),0);
    return {id:p.id,name:p.name,client_name:p.client_name,billed,collected,costs,profit:billed-costs,margin:billed?((billed-costs)/billed):0,status:p.status};
  }).sort((a,b)=>n(b.billed)-n(a.billed)).slice(0,8);

  return {
    kpi:{
      outstanding,overdue,receiptsMonth,costsMonth:purchaseMonth+expenseMonth,
      overdueCount:r2.filter(x=>x.status==='متأخر').length,
      quoteFollowups:followQuotesAll.length,
      contractsSoon:upcomingContractsAll.length,
      unpostedCosts:purchases.filter(x=>x.accounting_status==='غير مرحّل').length+expenses.filter(x=>x.accounting_status==='غير مرحّل').length
    },
    topOverdue,
    upcomingContracts:upcomingContractsAll.slice(0,5),
    followQuotes:followQuotesAll.slice(0,5),
    cashflow, projectStats
  };
}

export async function getInitialData(userEmail) {
  const names=['الإعدادات','العملاء','الموردون','المشاريع','المستحقات','الحوالات','المشتريات','مصروفات العمل','عروض الأسعار','العقود'];
  const all=await batchGetSheets(names);
  const clients=rowsFromValues(all['العملاء']);
  const suppliers=rowsFromValues(all['الموردون']);
  const projects=rowsFromValues(all['المشاريع']);
  const dashboard=dashboardFromData({
    recs:rowsFromValues(all['المستحقات']),
    transfers:rowsFromValues(all['الحوالات']),
    purchases:rowsFromValues(all['المشتريات']),
    expenses:rowsFromValues(all['مصروفات العمل']),
    quotes:rowsFromValues(all['عروض الأسعار']),
    contracts:rowsFromValues(all['العقود']),
    projects
  });
  return {
    bootstrap:{version:APP_VERSION,company:settingsFromValues(all['الإعدادات']),user:{email:userEmail||''}},
    lookups:{
      clients:clients.map(r=>({id:r.id,client_no:r.client_no,name:r.name,payment_terms_days:r.payment_terms_days})),
      suppliers:suppliers.map(r=>({id:r.id,supplier_no:r.supplier_no,name:r.name})),
      projects:projects.map(r=>({id:r.id,project_no:r.project_no,name:r.name,client_id:r.client_id,client_name:r.client_name,status:r.status}))
    },
    dashboard
  };
}

export async function health() {
  const vals=await getSheetValues('الإعدادات');
  return {ok:true,version:APP_VERSION,time:now(),database:DB_ID,settingsRows:Math.max(0,vals.length-1),mode:'direct-google-api'};
}

export async function getBootstrap(userEmail) {
  const vals=await getSheetValues('الإعدادات');
  return {version:APP_VERSION,company:settingsFromValues(vals),user:{email:userEmail||''}};
}

export async function getLookups() {
  const all=await batchGetSheets(['العملاء','الموردون','المشاريع']);
  const clients=rowsFromValues(all['العملاء']), suppliers=rowsFromValues(all['الموردون']), projects=rowsFromValues(all['المشاريع']);
  return {
    clients:clients.map(r=>({id:r.id,client_no:r.client_no,name:r.name,payment_terms_days:r.payment_terms_days})),
    suppliers:suppliers.map(r=>({id:r.id,supplier_no:r.supplier_no,name:r.name})),
    projects:projects.map(r=>({id:r.id,project_no:r.project_no,name:r.name,client_id:r.client_id,client_name:r.client_name,status:r.status}))
  };
}

export async function refreshDashboard() {
  const all=await batchGetSheets(['المستحقات','الحوالات','المشتريات','مصروفات العمل','عروض الأسعار','العقود','المشاريع']);
  return dashboardFromData({
    recs:rowsFromValues(all['المستحقات']),
    transfers:rowsFromValues(all['الحوالات']),
    purchases:rowsFromValues(all['المشتريات']),
    expenses:rowsFromValues(all['مصروفات العمل']),
    quotes:rowsFromValues(all['عروض الأسعار']),
    contracts:rowsFromValues(all['العقود']),
    projects:rowsFromValues(all['المشاريع'])
  });
}

export async function listEntity(entity, options={}) {
  const cfg=entityCfg(entity);
  const need=[cfg.sheet];
  if(entity==='receivables') need.push('الحوالات');
  if(entity==='projects') need.push('المستحقات','الحوالات','المشتريات','مصروفات العمل');
  const all=await batchGetSheets([...new Set(need)]);
  let rows=rowsFromValues(all[cfg.sheet]);

  if(entity==='receivables'){
    const transfers=rowsFromValues(all['الحوالات']);
    const paid=buildReceivableAllocation(rows,transfers);
    rows=rows.map(r=>Object.assign({},r,receivableState(r,paid)));
  }
  if(entity==='projects'){
    const recs=rowsFromValues(all['المستحقات']), tr=rowsFromValues(all['الحوالات']), pur=rowsFromValues(all['المشتريات']), exp=rowsFromValues(all['مصروفات العمل']);
    rows=rows.map(p=>{
      const billed=recs.filter(r=>r.project_id===p.id).reduce((s,r)=>s+n(r.invoice_total),0);
      const collected=tr.filter(t=>t.direction==='وارد'&&t.project_id===p.id).reduce((s,t)=>s+n(t.amount),0);
      const costs=pur.filter(x=>x.project_id===p.id).reduce((s,x)=>s+n(x.total),0)+exp.filter(x=>x.project_id===p.id).reduce((s,x)=>s+n(x.total),0);
      return Object.assign({},p,{billed,collected,costs,profit:billed-costs,margin:billed?(billed-costs)/billed:0});
    });
  }
  if(options.query){
    const q=String(options.query).trim().toLowerCase();
    rows=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
  }
  rows.sort((a,b)=>String(b.updated_at||b.created_at||b.date||'').localeCompare(String(a.updated_at||a.created_at||a.date||'')));
  const limit=Math.max(1,Math.min(Number(options.limit||500),1000));
  return rows.slice(0,limit).map(stripMeta);
}

export async function saveRecord(userEmail, entity, payload={}) {
  const cfg=entityCfg(entity);
  const sheetNames=[cfg.sheet,'الإعدادات','التسلسلات','العملاء','الموردون','المشاريع'];
  if(entity==='purchases'||entity==='expenses') sheetNames.push('الحساب الشخصي');
  const all=await batchGetSheets([...new Set(sheetNames)]);
  const settings=settingsFromValues(all['الإعدادات']);
  const targetHeaders=headersFromValues(all[cfg.sheet]);
  const targetRows=rowsFromValues(all[cfg.sheet],true);
  const clients=rowsFromValues(all['العملاء']);
  const suppliers=rowsFromValues(all['الموردون']);
  const projects=rowsFromValues(all['المشاريع']);
  const seq=new SequenceManager(all['التسلسلات']);

  const isNew=!payload.id;
  let existing={}, rec, rowNum=-1;
  if(!isNew){
    existing=targetRows.find(r=>String(r.id)===String(payload.id));
    if(!existing) throw new Error('السجل غير موجود أو تم حذفه.');
    rowNum=existing.__row;
    const sentVersion=Number(payload.version||0), currentVersion=Number(existing.version||0);
    if(sentVersion&&currentVersion&&sentVersion!==currentVersion) throw new Error('تم تعديل السجل من جهاز آخر. حدّث الصفحة ثم أعد المحاولة.');
  }

  rec=Object.assign({},existing,payload);
  delete rec.attachment;
  delete rec.__row;
  normalizeBusinessFields(entity,rec,settings);

  if(isNew){
    rec.id=crypto.randomUUID();
    rec[cfg.number]=seq.next(cfg.seq);
    rec.created_at=now();
    rec.version=1;
    rec.deleted_at='';
  } else {
    rec.created_at=existing.created_at||now();
    rec.version=Number(existing.version||0)+1;
  }
  rec.updated_at=now();
  enrichNames(entity,rec,clients,suppliers,projects);

  if(isNew&&entity==='clients'&&targetHeaders.includes('drive_folder_id')){
    rec.drive_folder_id=await createDriveFolder(`${rec.client_no||'C'} - ${String(rec.name||'عميل').slice(0,80)}`,settings.clients_projects_folder_id);
  }

  if(payload.attachment&&cfg.file){
    const folderId=settings[cfg.folder]||settings.attachments_folder_id;
    const safe=String(payload.attachment.name||'file').replace(/[\\/:*?"<>|]/g,'_').slice(-120);
    const stamp=now().replace(/[-:T]/g,'').slice(0,14);
    rec[cfg.file]=await uploadDriveFile({
      name:`${rec[cfg.number]||rec.id} - ${stamp} - ${safe}`,
      mimeType:payload.attachment.mimeType||'application/octet-stream',
      dataBase64:payload.attachment.dataBase64,
      parentId:folderId
    });
  }

  if(isNew) await appendRow(cfg.sheet,rowValues(targetHeaders,rec));
  else await updateRow(cfg.sheet,rowNum,rowValues(targetHeaders,rec));

  if(entity==='purchases'||entity==='expenses'){
    const pVals=all['الحساب الشخصي'], pHeaders=headersFromValues(pVals), pRows=rowsFromValues(pVals,true);
    let auto=pRows.find(x=>x.related_type===entity&&x.related_id===rec.id&&!x.deleted_at);
    const should=String(rec.payment_source||'')==='حسابي الشخصي'&&n(rec.total)>0;
    if(should){
      const existed=!!auto;
      auto=auto?{...auto}:{
        id:crypto.randomUUID(),personal_no:seq.next('personal'),created_at:now(),version:0,deleted_at:''
      };
      auto.date=rec.date||today();
      auto.type='دفعت من مالي الخاص للمؤسسة';
      auto.amount=n(rec.total);
      auto.related_type=entity; auto.related_id=rec.id;
      auto.description=(entity==='purchases'?'شراء ':'مصروف ')+(rec.description||rec.category||'');
      auto.project_id=rec.project_id||''; auto.project_name=rec.project_name||'';
      auto.attachment_file_id=rec.attachment_file_id||'';
      auto.notes='قيد تلقائي مرتبط بـ '+(entity==='purchases'?rec.purchase_no:rec.expense_no);
      auto.updated_at=now(); auto.version=Number(auto.version||0)+1;
      if(existed) await updateRow('الحساب الشخصي',auto.__row,rowValues(pHeaders,auto));
      else await appendRow('الحساب الشخصي',rowValues(pHeaders,auto));
      await audit(userEmail,existed?'update':'create','personal',auto.id,'قيد شخصي تلقائي '+auto.personal_no,auto);
    } else if(auto){
      auto.deleted_at=now(); auto.updated_at=now(); auto.version=Number(auto.version||0)+1;
      await updateRow('الحساب الشخصي',auto.__row,rowValues(pHeaders,auto));
      await audit(userEmail,'delete','personal',auto.id,'إلغاء القيد الشخصي التلقائي',auto);
    }
  }

  await seq.flush();
  await audit(userEmail,isNew?'create':'update',entity,rec.id,`${rec[cfg.number]||''} ${summaryName(entity,rec)}`,rec);
  return {ok:true,record:stripMeta(rec)};
}

export async function deleteRecord(userEmail,entity,id,version) {
  const cfg=entityCfg(entity);
  const need=[cfg.sheet];
  if(entity==='purchases'||entity==='expenses') need.push('الحساب الشخصي');
  const all=await batchGetSheets(need);
  const headers=headersFromValues(all[cfg.sheet]), rows=rowsFromValues(all[cfg.sheet],true);
  const rec=rows.find(r=>String(r.id)===String(id));
  if(!rec) throw new Error('السجل غير موجود.');
  if(Number(version||0)&&Number(rec.version||0)!==Number(version)) throw new Error('السجل تغير من جهاز آخر. حدّث الصفحة.');
  rec.deleted_at=now(); rec.updated_at=now(); rec.version=Number(rec.version||0)+1;
  await updateRow(cfg.sheet,rec.__row,rowValues(headers,rec));

  if(entity==='purchases'||entity==='expenses'){
    const pHeaders=headersFromValues(all['الحساب الشخصي']), pRows=rowsFromValues(all['الحساب الشخصي'],true);
    const auto=pRows.find(x=>x.related_type===entity&&x.related_id===rec.id&&!x.deleted_at);
    if(auto){
      auto.deleted_at=now(); auto.updated_at=now(); auto.version=Number(auto.version||0)+1;
      await updateRow('الحساب الشخصي',auto.__row,rowValues(pHeaders,auto));
    }
  }
  await audit(userEmail,'delete',entity,id,summaryName(entity,rec),rec);
  return {ok:true};
}

export async function saveCompanySettings(userEmail,values={}) {
  const allowed=['company_name','unified_no','vat_no','city','district','street','building_no','secondary_no','postal_code','short_address','phone1','phone2','email1','email2','website','vat_rate'];
  const vals=await getSheetValues('الإعدادات');
  const headers=headersFromValues(vals), rows=rowsFromValues(vals,true);
  const updates=[], appends=[];
  for(const k of allowed){
    if(!(k in values)) continue;
    const existing=rows.find(r=>String(r.key)===k);
    if(existing){
      existing.value=values[k];
      updates.push({sheet:'الإعدادات',row:existing.__row,values:rowValues(headers,existing)});
    } else {
      appends.push({key:k,value:values[k],type:typeof values[k]==='number'?'number':'text',notes:''});
    }
  }
  await batchUpdateRows(updates);
  for(const r of appends) await appendRow('الإعدادات',rowValues(headers,r));
  await audit(userEmail,'settings','settings','company','تحديث بيانات المؤسسة',values);
  const refreshed=await getSheetValues('الإعدادات');
  return {ok:true,company:settingsFromValues(refreshed)};
}

export async function getWeeklyReport(fromDate,toDate) {
  const all=await batchGetSheets(['الحوالات','المشتريات','مصروفات العمل','الحساب الشخصي']);
  const from=fromDate||weekStart(),to=toDate||today();
  const inRange=d=>d&&String(d).slice(0,10)>=from&&String(d).slice(0,10)<=to;
  const transfers=rowsFromValues(all['الحوالات']).filter(r=>inRange(r.date));
  const purchases=rowsFromValues(all['المشتريات']).filter(r=>inRange(r.date));
  const expenses=rowsFromValues(all['مصروفات العمل']).filter(r=>inRange(r.date));
  const personal=rowsFromValues(all['الحساب الشخصي']).filter(r=>inRange(r.date));
  const rows=[];
  transfers.forEach(r=>rows.push({date:r.date,type:'حوالة '+r.direction,ref:r.transfer_no,party:r.party_name||'',project:r.project_name||'',description:r.bank_ref||r.notes||'',inflow:r.direction==='وارد'?n(r.amount):0,outflow:r.direction==='صادر'?n(r.amount):0,source:'الحوالات'}));
  purchases.forEach(r=>rows.push({date:r.date,type:'شراء',ref:r.purchase_no,party:r.supplier_name||'',project:r.project_name||'',description:r.description||r.category||'',inflow:0,outflow:n(r.total),source:r.payment_source||''}));
  expenses.forEach(r=>rows.push({date:r.date,type:'مصروف عمل',ref:r.expense_no,party:r.supplier_name||'',project:r.project_name||'',description:r.description||r.category||'',inflow:0,outflow:n(r.total),source:r.payment_source||''}));
  personal.forEach(r=>rows.push({date:r.date,type:'حساب شخصي',ref:r.personal_no,party:'',project:r.project_name||'',description:r.type+(r.description?' — '+r.description:''),inflow:(r.type==='إيداع شخصي للمؤسسة'||r.type==='دفعت من مالي الخاص للمؤسسة')?n(r.amount):0,outflow:(r.type==='سحب شخصي من أموال المؤسسة'||r.type==='استرداد مبلغ لي')?n(r.amount):0,source:'شخصي'}));
  rows.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const businessPurchases=purchases.filter(r=>String(r.payment_source||'')==='حساب المؤسسة').reduce((s,r)=>s+n(r.total),0);
  const businessExpenses=expenses.filter(r=>String(r.payment_source||'')==='حساب المؤسسة').reduce((s,r)=>s+n(r.total),0);
  const receipts=transfers.filter(r=>r.direction==='وارد').reduce((s,r)=>s+n(r.amount),0);
  const outgoing=transfers.filter(r=>r.direction==='صادر').reduce((s,r)=>s+n(r.amount),0);
  const personalWithdrawals=personal.filter(r=>r.type==='سحب شخصي من أموال المؤسسة'||r.type==='استرداد مبلغ لي').reduce((s,r)=>s+n(r.amount),0);
  const personalFunding=personal.filter(r=>r.type==='دفعت من مالي الخاص للمؤسسة'||r.type==='إيداع شخصي للمؤسسة').reduce((s,r)=>s+n(r.amount),0);
  return {from,to,summary:{receipts,outgoingTransfers:outgoing,purchases:purchases.reduce((s,r)=>s+n(r.total),0),businessExpenses:expenses.reduce((s,r)=>s+n(r.total),0),personalWithdrawals,personalFunding,netBusinessCash:receipts-outgoing-businessPurchases-businessExpenses-personalWithdrawals+personal.filter(r=>r.type==='إيداع شخصي للمؤسسة').reduce((s,r)=>s+n(r.amount),0)},rows};
}


async function getClientStatement(filters={}){
  const all=await batchGetSheets(['العملاء','المستحقات','الحوالات']);
  const clients=rowsFromValues(all['العملاء']);
  let recs=rowsFromValues(all['المستحقات']);
  let transfers=rowsFromValues(all['الحوالات']).filter(t=>String(t.direction||'')==='وارد');
  const from=filters.from||'',to=filters.to||today(),project=filters.project||'';
  const partyText=String(filters.party||'').trim().toLowerCase();

  let client=null;
  if(filters.client) client=clients.find(c=>String(c.id)===String(filters.client))||null;
  if(!client&&partyText){
    client=clients.find(c=>String(c.name||'').trim().toLowerCase()===partyText)||
           clients.find(c=>String(c.name||'').trim().toLowerCase().includes(partyText))||null;
  }
  if(!client) throw new Error('اختر العميل لإصدار كشف حساب المستحقات.');

  if(filters.strict_client_identity){
    ({recs,transfers}=strictClientRows(clients,recs,transfers,client));
    // Normalize legacy invoice references for allocation only within this
    // verified client. Duplicate invoice numbers would distort paid totals.
    const numbers=recs.map(r=>String(r.invoice_no||'').trim());
    if(numbers.some(x=>!x)||new Set(numbers).size!==numbers.length)
      throw new PortalError('INVOICE_REFERENCE_REQUIRED','صحّح أرقام الفواتير الفارغة أو المكررة لهذا العميل قبل إرسال الكشف.',409);
  }

  const sameClientRec=r=>String(r.client_id||'')===String(client.id)||
    (!r.client_id&&String(r.client_name||'').trim().toLowerCase()===String(client.name||'').trim().toLowerCase());
  const sameClientTransfer=t=>String(t.party_id||'')===String(client.id)||
    (!t.party_id&&String(t.party_name||'').trim().toLowerCase()===String(client.name||'').trim().toLowerCase());
  const projectOk=r=>!project||String(r.project_id||'')===String(project);

  const relevantRecs=recs.filter(r=>sameClientRec(r)&&projectOk(r)&&(!to||String(r.invoice_date||'').slice(0,10)<=to));
  const relevantTransfers=transfers.filter(t=>sameClientTransfer(t)&&projectOk(t)&&(!to||String(t.date||'').slice(0,10)<=to));

  const movements=[];
  relevantRecs.forEach(r=>movements.push({
    date:String(r.invoice_date||'').slice(0,10),sort:0,type:'مستحق',ref:r.invoice_no||r.receivable_no||'',
    receivable_no:r.receivable_no||'',invoice_no:r.invoice_no||'',project:r.project_name||'',
    description:r.notes||'فاتورة مستحقة',debit:n(r.invoice_total),credit:0,due_date:String(r.due_date||'').slice(0,10),
    payment_method:'',source:'مستحق'
  }));
  relevantTransfers.forEach(t=>movements.push({
    date:String(t.date||'').slice(0,10),sort:1,type:'سداد',ref:t.transfer_no||'',
    invoice_no:t.invoice_no||'',project:t.project_name||'',
    description:t.bank_ref||t.notes||'حوالة واردة',debit:0,credit:n(t.amount),due_date:'',
    payment_method:t.payment_method||'',source:'حوالة واردة'
  }));
  movements.sort((a,b)=>String(a.date).localeCompare(String(b.date))||(a.sort-b.sort)||String(a.ref).localeCompare(String(b.ref)));

  let openingBalance=0;
  const before=[],period=[];
  movements.forEach(m=>{
    if(from&&m.date<from) before.push(m); else if((!from||m.date>=from)&&(!to||m.date<=to)) period.push(m);
  });
  before.forEach(m=>openingBalance=round2(openingBalance+n(m.debit)-n(m.credit)));

  let running=openingBalance;
  const rows=period.map(m=>{
    running=round2(running+n(m.debit)-n(m.credit));
    return Object.assign({},m,{running_balance:running});
  });

  const alloc=buildReceivableAllocation(relevantRecs,relevantTransfers);
  const invoiceStates=relevantRecs.map(r=>Object.assign({},r,receivableState(r,alloc,filters.strict_client_identity?to:today())));
  const openStates=invoiceStates.filter(r=>n(r.balance)>0);

  const aging={not_due:0,d1_30:0,d31_60:0,d61_90:0,d90_plus:0};
  openStates.forEach(r=>{
    const bal=n(r.balance);
    if(r.status!=='متأخر') aging.not_due=round2(aging.not_due+bal);
    else if(n(r.days_overdue)<=30) aging.d1_30=round2(aging.d1_30+bal);
    else if(n(r.days_overdue)<=60) aging.d31_60=round2(aging.d31_60+bal);
    else if(n(r.days_overdue)<=90) aging.d61_90=round2(aging.d61_90+bal);
    else aging.d90_plus=round2(aging.d90_plus+bal);
  });

  const overdueBalance=openStates.filter(r=>r.status==='متأخر').reduce((s,r)=>s+n(r.balance),0);
  const overdueInvoices=openStates.filter(r=>r.status==='متأخر').length;
  const openInvoices=openStates.length;
  const totalReceivables=period.reduce((s,r)=>s+n(r.debit),0);
  const totalPayments=period.reduce((s,r)=>s+n(r.credit),0);
  const lastPaymentRows=relevantTransfers.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  const lastPayment=lastPaymentRows.length?lastPaymentRows[lastPaymentRows.length-1]:null;
  const lastPaymentDate=lastPayment?String(lastPayment.date||'').slice(0,10):'';
  const lastPaymentAmount=lastPayment?n(lastPayment.amount):0;
  const creditLimit=n(client.credit_limit);
  const closingBalance=running;
  const availableCredit=creditLimit>0?Math.max(0,round2(creditLimit-closingBalance)):0;
  const creditUsagePct=creditLimit>0?Math.max(0,Math.round((closingBalance/creditLimit)*1000)/10):0;
  const creditExceeded=creditLimit>0&&closingBalance>creditLimit;
  const accountState=creditExceeded?'متجاوز الحد الائتماني':overdueBalance>0?'يوجد رصيد متأخر':closingBalance>0?'رصيد قائم':'مسدد بالكامل';
  const clientNo=String(client.client_no||client.id||'CLIENT').replace(/[^A-Za-z0-9_-]/g,'').slice(-20);
  const statementNo='ST-'+String(to||today()).replaceAll('-','')+'-'+clientNo;

  return {
    type:'client_statement',
    version:'v25.30.21',
    statementNo,
    generatedAt:now(),
    filters:{from,to,project,client:client.id},
    client:stripMeta(client),
    summary:{
      openingBalance,totalReceivables,totalPayments,closingBalance,
      openInvoices,overdueInvoices,overdueBalance,lastPaymentDate,lastPaymentAmount,
      creditLimit,availableCredit,creditUsagePct,creditExceeded,accountState,aging
    },
    openInvoices:openStates.map(r=>({
      invoice_no:r.invoice_no,invoice_date:r.invoice_date,due_date:r.due_date,
      invoice_total:n(r.invoice_total),paid_amount:n(r.paid_amount),balance:n(r.balance),
      days_overdue:n(r.days_overdue),status:r.status,project_name:r.project_name||''
    })).sort((a,b)=>String(a.due_date||a.invoice_date||'').localeCompare(String(b.due_date||b.invoice_date||''))),
    rows
  };
}

export async function getReport(reportType,filters={}) {
  if(reportType==='client_statement') return getClientStatement(filters);

  const all=await batchGetSheets(['المستحقات','الحوالات','المشتريات','مصروفات العمل','الحساب الشخصي']);
  const from=filters.from||'',to=filters.to||'',project=filters.project||'',party=String(filters.party||'').toLowerCase();
  const inRange=d=>(!from||String(d||'').slice(0,10)>=from)&&(!to||String(d||'').slice(0,10)<=to);
  const ok=(r,dateField,projectField,partyFields)=>inRange(r[dateField])&&(!project||r[projectField]===project)&&(!party||partyFields.some(k=>String(r[k]||'').toLowerCase().includes(party)));
  const rows=[],add=x=>rows.push(x);
  if(reportType==='all'||reportType==='receivables') rowsFromValues(all['المستحقات']).forEach(r=>{if(ok(r,'invoice_date','project_id',['client_name','invoice_no'])) add({date:r.invoice_date,type:'مستحق',ref:r.invoice_no,party:r.client_name,project:r.project_name,description:r.notes||'',amount:n(r.invoice_total),status:'مستحق'});});
  if(reportType==='all'||reportType==='transfers') rowsFromValues(all['الحوالات']).forEach(r=>{if(ok(r,'date','project_id',['party_name','invoice_no','bank_ref'])) add({date:r.date,type:'حوالة '+r.direction,ref:r.transfer_no,party:r.party_name,project:r.project_name,description:r.bank_ref||r.notes||'',amount:n(r.amount),status:r.payment_method||''});});
  if(reportType==='all'||reportType==='purchases') rowsFromValues(all['المشتريات']).forEach(r=>{if(ok(r,'date','project_id',['supplier_name','description','category'])) add({date:r.date,type:'شراء',ref:r.purchase_no,party:r.supplier_name,project:r.project_name,description:r.description||r.category,amount:n(r.total),status:r.document_type||''});});
  if(reportType==='all'||reportType==='expenses') rowsFromValues(all['مصروفات العمل']).forEach(r=>{if(ok(r,'date','project_id',['supplier_name','description','category'])) add({date:r.date,type:'مصروف عمل',ref:r.expense_no,party:r.supplier_name,project:r.project_name,description:r.description||r.category,amount:n(r.total),status:r.accounting_status||''});});
  if(reportType==='all'||reportType==='personal') rowsFromValues(all['الحساب الشخصي']).forEach(r=>{if(ok(r,'date','project_id',['type','description'])) add({date:r.date,type:'حساب شخصي',ref:r.personal_no,party:'',project:r.project_name,description:r.type+(r.description?' — '+r.description:''),amount:n(r.amount),status:''});});
  rows.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  return {type:reportType,filters,rows,total:rows.reduce((s,r)=>s+n(r.amount),0)};
}

export async function createBackup(userEmail) {
  const settings=settingsFromValues(await getSheetValues('الإعدادات'));
  const name=`Balqees-DB-manual-${now().slice(0,16).replace('T','_').replaceAll(':','-')}`;
  try{
    const copy=await copyDriveFile(DB_ID,name,settings.backups_folder_id);
    await audit(userEmail,'backup','system',copy.id,'نسخة احتياطية manual',{fileId:copy.id});
    return {ok:true,id:copy.id,url:copy.webViewLink||`https://drive.google.com/file/d/${copy.id}/view`,name};
  }catch(e){
    throw new Error('تعذر إنشاء النسخة الاحتياطية في Drive: '+(e.message||e));
  }
}


// Website imports use their immutable UUID as both record ID and reference.
// The Supabase claim/append marker is acquired before appendPortalTransfer.
export async function getPortalClients() {
  return rowsFromValues(await getSheetValues('العملاء')).map(r => ({id:String(r.id),name:String(r.name),client_no:r.client_no || ''}));
}
export async function findPortalTransfer(id) {
  const rows = rowsFromValues(await getSheetValues('الحوالات'),true).filter(r => r.id === id || r.transfer_no === `WEB-${id}`);
  if (rows.length > 1) throw new PortalError('LEDGER_CONFLICT','مرجع الإيصال مكرر في المكتب ويحتاج مراجعة يدوية.',409);
  return rows[0] || null;
}
export async function preparePortalTransfer(payment,link,proof) {
  const all = await batchGetSheets(['الحوالات','العملاء','الإعدادات']);
  const headers = headersFromValues(all['الحوالات']);
  for (const key of ['id','transfer_no','date','direction','party_type','party_id','party_name','amount','payment_method','bank_ref','attachment_file_id','notes','created_at','updated_at','version','deleted_at']) {
    if (!headers.includes(key)) throw new PortalError('LEDGER_SCHEMA','جدول الحوالات غير مكتمل. راجع عناوين أعمدته قبل التسجيل.',409);
  }
  const client = rowsFromValues(all['العملاء']).find(c => String(c.id) === link.office_client_id);
  if (!client) throw new PortalError('CLIENT_NOT_FOUND','عميل المكتب محذوف أو غير موجود.',409);
  const matches = rowsFromValues(all['الحوالات'],true).filter(r => r.id === payment.id || r.transfer_no === `WEB-${payment.id}`);
  if (matches.length) { verifyTransfer(matches[0],payment,link); throw new PortalError('RECONCILE_REQUIRED','ظهر القيد في المكتب. حدّث المطابقة قبل المتابعة.',409); }
  if (possibleDuplicateTransfer(rowsFromValues(all['الحوالات']),payment,client))
    throw new PortalError('POSSIBLE_DUPLICATE','يوجد في المكتب سداد بنفس العميل والمبلغ والتاريخ والمرجع. راجع القيد الموجود؛ لم تُضف حوالة جديدة.',409);
  const settings = settingsFromValues(all['الإعدادات']);
  if (!settings.transfers_folder_id) throw new PortalError('DRIVE_FOLDER_REQUIRED','مجلد إيصالات الحوالات في المكتب غير معدّ.',409);
  const attachment = await uploadDriveFile({...proof,name:`WEB-${payment.id}-${proof.name}`,parentId:settings.transfers_folder_id});
  const record = {
    id:payment.id,transfer_no:`WEB-${payment.id}`,date:payment.payment_date,direction:'وارد',party_type:'عميل',
    party_id:link.office_client_id,party_name:client.name,amount:Number(payment.amount),
    payment_method:({bank_transfer:'تحويل بنكي',card:'بطاقة',cash:'نقدي'})[payment.payment_method],
    bank_ref:payment.bank_reference,attachment_file_id:attachment.id,
    notes:`إيصال معتمد من موقع بلقيس | ${payment.id}${payment.note ? ' | '+payment.note : ''}`,
    created_at:now(),updated_at:now(),version:1,deleted_at:'',
  };
  return {headers,record};
}
export async function appendPortalTransfer(prepared) {
  // Google append is invoked once. A timeout must be reconciled, never retried.
  return appendRow('الحوالات',rowValues(prepared.headers,prepared.record));
}
