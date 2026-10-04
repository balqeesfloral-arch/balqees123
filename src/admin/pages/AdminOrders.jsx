import { useEffect, useMemo, useState } from 'react';
import {
  Check, ClipboardList, Download, FileCheck2, FileText, LoaderCircle, MoreHorizontal,
  PackageCheck, RefreshCw, Search, UploadCloud, X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAdminLiveRefresh, { notifyAdminChange } from '../useAdminLiveRefresh';
import { supabase } from '../../lib/supabase';
import { dateTime, logAdminAction, money } from '../adminUtils';

const statusAr = {
  pending: 'تم الاستلام', under_review: 'قيد المراجعة', quoted: 'تمت مراجعة التسعير', approved: 'معتمد',
  in_progress: 'قيد التجهيز', ready: 'جاهز للتسليم', out_for_delivery: 'في الطريق', delivered: 'تم التسليم',
  delivery_failed_payment: 'تعثر التسليم/السداد', completed: 'مكتمل', cancelled: 'ملغي',
};
const statusEn = {
  pending: 'Received', under_review: 'Under review', quoted: 'Pricing reviewed', approved: 'Approved',
  in_progress: 'Preparing', ready: 'Ready', out_for_delivery: 'Out for delivery', delivered: 'Delivered',
  delivery_failed_payment: 'Delivery/payment issue', completed: 'Completed', cancelled: 'Cancelled',
};
const documentTypes = {
  invoice_copy: ['فاتورة رسمية', 'Official invoice'], receipt: ['إيصال', 'Receipt'],
  credit_note: ['إشعار دائن', 'Credit note'], debit_note: ['إشعار مدين', 'Debit note'], other: ['مستند رسمي', 'Official document'],
};

function orderReference(order) {
  const date = new Date(order?.created_at || Date.now());
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Riyadh' }).format(date);
  return `BLQ-${year}-${String(order?.order_number || '').padStart(5, '0')}`;
}

export default function AdminOrders({ lang }) {
  const ar = lang === 'ar';
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const labels = ar ? statusAr : statusEn;
  const [orders, setOrders] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [draftStatus, setDraftStatus] = useState('pending');
  const [draftContract, setDraftContract] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [documentFile, setDocumentFile] = useState(null);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentMessage, setDocumentMessage] = useState('');
  const [documentForm, setDocumentForm] = useState({ document_type: 'invoice_copy', document_number: '', issue_date: '', total_amount: '' });

  async function load() {
    setLoading(true);
    const [{ data, error: orderError },{ data: contractRows, error: contractError }] = await Promise.all([supabase.from('orders').select('*').order('created_at', { ascending: false }),supabase.from('contracts').select('id,organization_id,contract_number,title_ar,status').neq('status','draft').order('created_at',{ascending:false})]);
    setError(orderError || contractError ? (ar ? 'تعذر تحميل جزء من الطلبات. حاول مجددًا.' : 'Some order data could not load. Please retry.') : '');
    setContracts(contractRows || []);
    const rows = data || [];
    setOrders(rows);
    const ids = [...new Set(rows.map(x => x.user_id).filter(Boolean))];
    if (ids.length) {
      const { data: p } = await supabase.from('customer_profiles').select('id,full_name,email,establishment_display_name').in('id', ids);
      setProfiles(Object.fromEntries((p || []).map(x => [x.id, x])));
    } else setProfiles({});
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useAdminLiveRefresh(() => { if (!selected) load(); }, ['orders', 'customer_documents']);
  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(location.search);
    const id = params.get('order');
    if (!id) return;
    const order = orders.find(row => row.id === id);
    if (order) openOrder(order);
    else setError(ar ? 'الطلب المطلوب غير موجود أو تعذرت قراءته.' : 'This order was not found or could not be read.');
    params.delete('order');
    navigate({ pathname: '/admin/orders', search: params.toString() ? `?${params}` : '' }, { replace: true });
  }, [loading, location.search, orders]);

  const filtered = useMemo(() => orders.filter(order => {
    const p = profiles[order.user_id] || {};
    const hay = `${orderReference(order)} #${order.order_number} ${p.full_name || ''} ${p.email || ''} ${p.establishment_display_name || ''}`.toLowerCase();
    return (!query || hay.includes(query.toLowerCase())) && (status === 'all' || order.status === status);
  }), [orders, profiles, query, status]);

  async function loadOrderDocuments(orderId) {
    const { data } = await supabase.from('customer_documents').select('*').eq('order_id', orderId).order('created_at', { ascending: false });
    setDocuments(data || []);
  }

  async function openOrder(order) {
    setSelected(order);
    setDraftStatus(order.status);
    setDraftContract(order.contract_id || '');
    setAdminNote(order.admin_note || '');
    setDocumentMessage('');
    const [itemsResult] = await Promise.all([
      supabase.from('order_items').select('*').eq('order_id', order.id).order('created_at'),
      order.organization_id ? Promise.resolve({ data: [] }) : loadOrderDocuments(order.id),
    ]);
    setItems(itemsResult.data || []);
    if (order.organization_id) setDocuments([]);
  }

  async function saveOrder() {
    const { error } = await supabase.from('orders').update({ status: draftStatus, admin_note: adminNote || null, contract_id: selected.organization_id ? (draftContract || null) : selected.contract_id }).eq('id', selected.id);
    if (!error) {
      await logAdminAction('update_order', 'order', selected.id, { status: draftStatus, contract_id: draftContract || null });
      setSelected(current => current ? { ...current, status: draftStatus, admin_note: adminNote || null } : current);
      notifyAdminChange('orders');
      await load();
    } else setError(ar ? 'تعذر حفظ الطلب. تحقق من الاتصال والصلاحيات.' : 'Could not save the order. Check your connection and permissions.');
  }

  function startDocumentUpload() {
    setDocumentFile(null);
    setDocumentMessage('');
    setDocumentForm({
      document_type: 'invoice_copy', document_number: '',
      issue_date: new Date().toISOString().slice(0, 10),
      total_amount: selected?.total == null ? '' : String(selected.total),
    });
    setDocumentOpen(true);
  }

  async function uploadDocument(event) {
    event.preventDefault();
    if (!selected || !documentFile) return;
    if (documentFile.type !== 'application/pdf') return setDocumentMessage(ar ? 'ارفع ملف PDF الأصلي الصادر من برنامج المحاسبة.' : 'Upload the original PDF exported from the accounting system.');
    if (documentFile.size > 15 * 1024 * 1024) return setDocumentMessage(ar ? 'حجم الملف يتجاوز 15MB.' : 'The file exceeds 15MB.');
    setDocumentBusy(true); setDocumentMessage('');
    let path = '';
    try {
      const user = (await supabase.auth.getUser()).data.user;
      path = `${selected.user_id}/${selected.id}/${crypto.randomUUID()}.pdf`;
      const { error: storageError } = await supabase.storage.from('customer-documents').upload(path, documentFile, { contentType: 'application/pdf', upsert: false });
      if (storageError) throw storageError;
      const pair = documentTypes[documentForm.document_type] || documentTypes.other;
      const { error: insertError } = await supabase.from('customer_documents').insert({
        user_id: selected.user_id,
        order_id: selected.id,
        document_type: documentForm.document_type,
        document_number: documentForm.document_number.trim() || null,
        title_ar: pair[0], title_en: pair[1],
        issue_date: documentForm.issue_date || null,
        subtotal: selected.subtotal == null ? null : Number(selected.subtotal),
        vat_amount: selected.vat_total == null ? null : Number(selected.vat_total),
        total_amount: documentForm.total_amount === '' ? null : Number(documentForm.total_amount),
        file_path: path,
        source_system: 'external_accounting', is_visible: true, created_by: user?.id || null,
      });
      if (insertError) throw insertError;
      await logAdminAction('publish_individual_order_document', 'order', selected.id, { document_type: documentForm.document_type, document_number: documentForm.document_number || null });
      await loadOrderDocuments(selected.id);
      setDocumentOpen(false);
    } catch (error) {
      if (path) await supabase.storage.from('customer-documents').remove([path]).catch(() => {});
      setDocumentMessage(ar ? 'تعذر نشر المستند الآن. تحقق من صلاحيات الإدارة واتصال التخزين ثم أعد المحاولة.' : 'Could not publish the document. Check admin permissions and storage connectivity, then try again.');
    }
    setDocumentBusy(false);
  }

  async function openDocument(document) {
    const { data, error } = await supabase.storage.from('customer-documents').createSignedUrl(document.file_path, 120);
    if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  return <div className="admin-page">
    {error && <div className="admin-feedback error" role="alert">{error}</div>}
    <div className="admin-page-head"><div><span>{ar ? 'تدفق الطلبات' : 'ORDER FLOW'}</span><h2>{ar ? 'إدارة الطلبات' : 'Order management'}</h2><p>{ar ? 'إدارة الطلب من الاستلام إلى الإكمال، مع نشر المستندات الرسمية للأفراد من نفس الطلب.' : 'Manage the full order journey and publish official individual documents from the same order.'}</p></div><button className="admin-secondary-button" onClick={load}><RefreshCw className={loading ? 'spin' : ''} size={16}/>{ar ? 'تحديث' : 'Refresh'}</button></div>
    <section className="admin-panel admin-table-shell"><div className="admin-toolbar"><div className="admin-search-field"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? 'رقم الطلب أو العميل…' : 'Order number or client…'}/></div><select className="admin-select-filter" value={status} onChange={e => setStatus(e.target.value)}><option value="all">{ar ? 'كل الحالات' : 'All statuses'}</option>{Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div>
      <div className="admin-table-responsive"><table className="admin-table"><thead><tr><th>{ar ? 'الطلب' : 'Order'}</th><th>{ar ? 'العميل' : 'Client'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th>{ar ? 'الإجمالي' : 'Total'}</th><th>{ar ? 'التاريخ' : 'Date'}</th><th/></tr></thead><tbody>{filtered.map(order => { const p = profiles[order.user_id] || {}; return <tr key={order.id}><td><strong>{orderReference(order)}</strong></td><td><div className="admin-text-stack"><strong>{p.full_name || p.establishment_display_name || '—'}</strong><small>{p.email || '—'}</small></div></td><td><span className={`admin-order-status ${order.status}`}>{labels[order.status] || order.status}</span></td><td><strong>{money(order.total, lang)}</strong></td><td>{dateTime(order.created_at, lang)}</td><td><button className="admin-row-action" onClick={() => openOrder(order)}><MoreHorizontal size={18}/></button></td></tr>; })}</tbody></table></div>
      {!loading && !filtered.length && <div className="admin-empty-state"><ClipboardList size={28}/><strong>{ar ? 'لا توجد طلبات حتى الآن' : 'No orders yet'}</strong></div>}
    </section>

    {selected && <div className="admin-drawer-overlay" onMouseDown={e => e.target === e.currentTarget && setSelected(null)}><aside className="admin-drawer admin-order-center-drawer"><div className="admin-drawer-head"><div><small>{ar ? 'مركز الطلب' : 'ORDER CENTER'}</small><h3>{orderReference(selected)}</h3></div><button onClick={() => setSelected(null)}><X size={19}/></button></div><div className="admin-drawer-scroll">
      <div className="admin-order-total-card"><PackageCheck size={24}/><div><span>{ar ? 'إجمالي الطلب' : 'Order total'}</span><strong>{money(selected.total, lang)}</strong></div></div>
      <div className="admin-detail-grid"><div><span>{ar ? 'العميل' : 'Client'}</span><strong>{profiles[selected.user_id]?.full_name || '—'}</strong></div><div><span>{ar ? 'التاريخ' : 'Date'}</span><strong>{dateTime(selected.created_at, lang)}</strong></div></div>
      <div className="admin-form-section">{selected.organization_id&&<label>{ar?'العقد المرتبط':'Linked contract'}<select value={draftContract} onChange={e=>setDraftContract(e.target.value)}><option value="">{ar?'بدون عقد':'No contract'}</option>{contracts.filter(c=>c.organization_id===selected.organization_id).map(c=><option key={c.id} value={c.id}>{c.contract_number} · {c.title_ar}</option>)}</select></label>}<label>{ar ? 'حالة الطلب' : 'Order status'}<select value={draftStatus} onChange={e => setDraftStatus(e.target.value)}>{Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label>{ar ? 'ملاحظة إدارية' : 'Admin note'}<textarea rows="4" value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder={ar ? 'ملاحظة داخلية عن الطلب…' : 'Internal order note…'}/></label></div>
      <div className="admin-line-items"><strong>{ar ? 'عناصر الطلب' : 'Order items'}</strong>{items.length ? items.map(item => <div key={item.id}><span>{item.product_snapshot?.name_ar || item.product_snapshot?.name_en || (ar ? 'منتج' : 'Product')} × {item.quantity}</span><b>{money(item.line_total, lang)}</b></div>) : <p>{ar ? 'لا توجد عناصر مسجلة.' : 'No line items recorded.'}</p>}</div>
      {!selected.organization_id && <section className="admin-individual-documents"><header><div><small>OFFICIAL DOCUMENT DELIVERY</small><strong>{ar ? 'الفاتورة والمستندات الرسمية' : 'Official invoice & documents'}</strong><p>{ar ? 'ارفع فقط الملف الصادر من برنامج المحاسبة. عند النشر يظهر فورًا للعميل ويُنشأ إشعار «فاتورتك أصبحت جاهزة».' : 'Upload only the file issued by the accounting system. Publishing makes it visible to the customer and creates an invoice-ready notification.'}</p></div><button className="admin-primary-button small" onClick={startDocumentUpload}><UploadCloud size={15}/>{ar ? 'رفع مستند' : 'Upload document'}</button></header>
        <div className="admin-individual-document-list">{documents.length ? documents.map(document => <button key={document.id} type="button" onClick={() => openDocument(document)}><FileCheck2 size={18}/><span><strong>{ar ? (document.title_ar || documentTypes[document.document_type]?.[0]) : (document.title_en || document.title_ar || documentTypes[document.document_type]?.[1])}</strong><small>{document.document_number || (ar ? 'بدون رقم' : 'No number')} · {document.issue_date || document.created_at?.slice(0,10) || '—'}</small></span><b>{document.total_amount == null ? '—' : money(document.total_amount, lang)}</b><Download size={15}/></button>) : <div className="admin-document-empty"><FileText size={20}/><span>{ar ? 'لا توجد فاتورة رسمية منشورة لهذا الطلب بعد.' : 'No official document has been published for this order yet.'}</span></div>}</div>
      </section>}
    </div><div className="admin-drawer-actions"><button className="admin-secondary-button" onClick={() => setSelected(null)}>{ar ? 'إغلاق' : 'Close'}</button><button className="admin-primary-button" onClick={saveOrder}><Check size={16}/>{ar ? 'حفظ حالة الطلب' : 'Save order status'}</button></div></aside></div>}

    {documentOpen && selected && <div className="admin-modal-overlay" onMouseDown={e => e.target === e.currentTarget && !documentBusy && setDocumentOpen(false)}><form className="admin-modal admin-order-document-upload" onSubmit={uploadDocument}><header><div><small>EXTERNAL ACCOUNTING DOCUMENT</small><h3>{ar ? 'نشر مستند رسمي للعميل' : 'Publish an official customer document'}</h3></div><button type="button" disabled={documentBusy} onClick={() => setDocumentOpen(false)}><X/></button></header><div className="admin-compliance-mini">{ar ? 'هذه الشاشة لا تنشئ فاتورة ضريبية. ارفع PDF الأصلي بعد إصداره من برنامج المحاسبة.' : 'This screen does not issue a tax invoice. Upload the original PDF after it is issued by your accounting system.'}</div><div className="admin-form-grid"><label>{ar ? 'نوع المستند' : 'Document type'}<select value={documentForm.document_type} onChange={e => setDocumentForm(current => ({ ...current, document_type: e.target.value }))}>{Object.entries(documentTypes).map(([key, pair]) => <option key={key} value={key}>{pair[ar ? 0 : 1]}</option>)}</select></label><label>{ar ? 'رقم المستند' : 'Document number'}<input value={documentForm.document_number} onChange={e => setDocumentForm(current => ({ ...current, document_number: e.target.value }))} placeholder="INV-1028"/></label><label>{ar ? 'تاريخ الإصدار' : 'Issue date'}<input type="date" value={documentForm.issue_date} onChange={e => setDocumentForm(current => ({ ...current, issue_date: e.target.value }))}/></label><label>{ar ? 'إجمالي المستند' : 'Document total'}<input type="number" step="0.01" min="0" value={documentForm.total_amount} onChange={e => setDocumentForm(current => ({ ...current, total_amount: e.target.value }))}/></label></div><label className="admin-file-drop"><UploadCloud/><div><strong>{documentFile?.name || (ar ? 'اختر ملف PDF الرسمي' : 'Choose the official PDF')}</strong><small>{ar ? 'PDF فقط · حتى 15MB · تخزين خاص' : 'PDF only · up to 15MB · private storage'}</small></div><input type="file" accept="application/pdf" required onChange={e => setDocumentFile(e.target.files?.[0] || null)}/></label>{documentMessage && <div className="admin-form-error">{documentMessage}</div>}<footer><button type="button" className="admin-secondary-button" disabled={documentBusy} onClick={() => setDocumentOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</button><button className="admin-primary-button" disabled={documentBusy || !documentFile}>{documentBusy ? <LoaderCircle className="spin"/> : <UploadCloud/>}{ar ? 'نشر للعميل' : 'Publish to customer'}</button></footer></form></div>}
  </div>;
}
