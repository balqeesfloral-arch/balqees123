import AccountingPortal from '../accounting/AccountingPortal';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Bell, CalendarDays, CheckCircle2, Download, FileCheck2,
  FileSearch, FileText, Heart, Home, LoaderCircle, LockKeyhole, PackageOpen,
  Printer, ReceiptText, RefreshCw, Search, ShieldCheck, ShoppingBag, Store,
  UserRound, Wifi, X,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { formatSar } from '../lib/storePricing';
import { fmtDate, productName, recipientName, orderAddress, addressText } from './individualUtils';
import './individual-account.css';
import './individual-documents.css';

const TYPE_LABELS = {
  ar: { invoice_copy: 'فاتورة رسمية', receipt: 'إيصال', credit_note: 'إشعار دائن', debit_note: 'إشعار مدين', other: 'مستند رسمي' },
  en: { invoice_copy: 'Official invoice', receipt: 'Receipt', credit_note: 'Credit note', debit_note: 'Debit note', other: 'Official document' },
};

function orderReference(order) {
  const created = order?.created_at ? new Date(order.created_at) : new Date();
  const year = Number.isNaN(created.getTime()) ? new Date().getFullYear() : Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Riyadh' }).format(created));
  const raw = String(order?.order_number || '').trim();
  const number = raw ? raw.padStart(5, '0') : String(order?.id || '').slice(0, 8).toUpperCase();
  return `BLQ-${year}-${number}`;
}

function monthKey(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(value, lang) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return lang === 'ar' ? 'أقدم' : 'Earlier';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh',
  }).format(date);
}

function normalizedSearch(value = '') {
  return String(value || '').toLowerCase().replace(/[\s#_-]+/g, ' ').trim();
}

function summarySearchText(order, lang) {
  const products = (order?.order_items || []).map(item => [
    item?.product_snapshot?.name_ar,
    item?.product_snapshot?.name_en,
    item?.product_snapshot?.sku,
  ].filter(Boolean).join(' ')).join(' ');
  return normalizedSearch([
    orderReference(order), order?.order_number, products,
    recipientName(order, lang === 'ar'), order?.status,
  ].filter(Boolean).join(' '));
}

function officialSearchText(document, order, lang) {
  return normalizedSearch([
    document?.document_number,
    document?.title_ar,
    document?.title_en,
    TYPE_LABELS[lang]?.[document?.document_type],
    orderReference(order),
    summarySearchText(order, lang),
  ].filter(Boolean).join(' '));
}

function profileName(profile, session, ar) {
  return profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || (ar ? 'عميل بلقيس' : 'Balqees client');
}

function DocumentCard({ item, lang, onPreview, onDownload, busy }) {
  const ar = lang === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const official = item.kind === 'official';
  const order = item.order;
  const invoiceMissing = !official && item.officialCount === 0;
  return <article className={`individual-doc-card ${official ? 'official' : 'summary'}`}>
    <button type="button" className="individual-doc-card-main" onClick={() => onPreview(item)}>
      <span className={`individual-doc-type-icon ${official ? 'official' : ''}`}>{official ? <ReceiptText/> : <FileText/>}</span>
      <div className="individual-doc-card-copy">
        <div className="individual-doc-card-kicker"><span>{official ? (ar ? 'مستند رسمي' : 'OFFICIAL DOCUMENT') : (ar ? 'ملخص الطلب' : 'ORDER SUMMARY')}</span>{official && <em><FileCheck2 size={12}/>{ar ? 'الملف الأصلي' : 'Original file'}</em>}</div>
        <h3>{official ? (ar ? (item.document.title_ar || TYPE_LABELS.ar[item.document.document_type]) : (item.document.title_en || item.document.title_ar || TYPE_LABELS.en[item.document.document_type])) : (ar ? 'ملخص الطلب' : 'Order summary')}</h3>
        <p>{orderReference(order)}{official && item.document.document_number ? ` · ${ar ? 'رقم' : 'No.'} ${item.document.document_number}` : ''}</p>
        <small><CalendarDays size={13}/>{fmtDate(item.date, lang)}{invoiceMissing && <b>{ar ? ' · الفاتورة الرسمية لم تُرفع بعد' : ' · Official invoice not uploaded yet'}</b>}</small>
      </div>
      <div className="individual-doc-card-value"><strong>{formatSar(official && item.document.total_amount != null ? item.document.total_amount : order?.total, lang)}</strong><span>{ar ? 'عرض المستند' : 'Preview'}<Arrow size={14}/></span></div>
    </button>
    <footer>
      <Link to={`/account/orders/${order.id}`}>{ar ? 'عرض الطلب المرتبط' : 'View related order'}<Arrow size={13}/></Link>
      <div>
        {official && <button type="button" disabled={busy === `${item.document.id}:download`} onClick={() => onDownload(item)}>{busy === `${item.document.id}:download` ? <LoaderCircle className="spin"/> : <Download/>}{ar ? 'تحميل PDF' : 'Download PDF'}</button>}
        <button type="button" onClick={() => onPreview(item)}><Printer/>{ar ? 'طباعة' : 'Print'}</button>
      </div>
    </footer>
  </article>;
}

function SummaryPreview({ order, lang }) {
  const ar = lang === 'ar';
  const address = orderAddress(order);
  return <div className="individual-document-summary-preview" dir={ar ? 'rtl' : 'ltr'}>
    <header><BrandMark/><div><small>BALQEES FLORAL</small><h2>{ar ? 'ملخص طلب' : 'Order Summary'}</h2><p>{ar ? 'هذا المستند ملخص للطلب وليس فاتورة ضريبية.' : 'This document is an order summary, not a tax invoice.'}</p></div><strong>{orderReference(order)}</strong></header>
    <div className="individual-document-summary-meta">
      <div><span>{ar ? 'تاريخ الطلب' : 'Order date'}</span><b>{fmtDate(order.created_at, lang, true)}</b></div>
      <div><span>{ar ? 'المستلم' : 'Recipient'}</span><b>{recipientName(order, ar)}</b></div>
      <div><span>{ar ? 'طريقة الدفع' : 'Payment method'}</span><b>{order.payment_method === 'cash_on_delivery' ? (ar ? 'الدفع عند الاستلام' : 'Cash on delivery') : (order.payment_method || '—')}</b></div>
      <div><span>{ar ? 'عنوان التسليم' : 'Delivery address'}</span><b>{addressText(address, ar) || '—'}</b></div>
    </div>
    <div className="individual-document-summary-items">
      {(order.order_items || []).map(item => <div key={item.id}><span><strong>{productName(item.product_snapshot, ar)}</strong><small>{ar ? `الكمية ${Number(item.quantity || 0)}` : `Qty ${Number(item.quantity || 0)}`}</small></span><b>{formatSar(item.line_total, lang)}</b></div>)}
    </div>
    <div className="individual-document-summary-totals">
      <div><span>{ar ? 'المجموع قبل الخصم' : 'Subtotal'}</span><b>{formatSar(order.subtotal, lang)}</b></div>
      {Number(order.discount_total || 0) > 0 && <div><span>{ar ? 'الخصم' : 'Discount'}</span><b>- {formatSar(order.discount_total, lang)}</b></div>}
      <div><span>{ar ? 'ضريبة القيمة المضافة' : 'VAT'}</span><b>{formatSar(order.vat_total, lang)}</b></div>
      <div className="total"><span>{ar ? 'الإجمالي شامل الضريبة' : 'Total incl. VAT'}</span><strong>{formatSar(order.total, lang)}</strong></div>
    </div>
    <footer>{ar ? 'بلقيس الورد للزهور والنباتات · ملخص إلكتروني للطلب' : 'Balqees Floral · Electronic order summary'}</footer>
  </div>;
}

export default function IndividualDocuments({ lang, session }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const location = useLocation();
  const cart = useBalqeesCart(session?.user?.id || null);
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [liveStatus, setLiveStatus] = useState('connecting');

  useEffect(() => { document.body.classList.add('individual-account-active'); return () => document.body.classList.remove('individual-account-active'); }, []);

  async function load(background = false) {
    if (!supabase || !session?.user?.id) return;
    background ? setRefreshing(true) : setLoading(true);
    setError('');
    const uid = session.user.id;
    const [profileResult, ordersResult, documentsResult] = await Promise.all([
      supabase.from('customer_profiles').select('id,full_name,email').eq('id', uid).maybeSingle(),
      supabase.from('orders').select('*,order_items(*)').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('customer_documents').select('*').eq('user_id', uid).eq('is_visible', true).order('created_at', { ascending: false }),
    ]);
    setProfile(profileResult.data || null);
    if (ordersResult.error) setError(ar ? 'تعذر تحميل مستندات طلباتك الآن. جرّب التحديث مرة أخرى.' : 'Your order documents could not be loaded. Please try again.');
    setOrders(ordersResult.data || []);
    if (documentsResult.error) {
      setDocuments([]);
      if (!ordersResult.error) setError(ar ? 'ملخصات الطلبات متاحة، لكن تعذر تحميل المستندات الرسمية الآن.' : 'Order summaries are available, but official documents could not be loaded right now.');
    } else setDocuments(documentsResult.data || []);
    setLoading(false); setRefreshing(false);
  }

  useEffect(() => { load(); }, [session?.user?.id]);
  useEffect(() => {
    if (!supabase || !session?.user?.id) return undefined;
    const channel = supabase.channel(`individual-documents:${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_documents', filter: `user_id=eq.${session.user.id}` }, () => load(true))
      .subscribe(status => setLiveStatus(status === 'SUBSCRIBED' ? 'live' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'offline' : 'connecting'));
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  const orderMap = useMemo(() => new Map(orders.map(order => [String(order.id), order])), [orders]);
  const documentCountByOrder = useMemo(() => documents.reduce((map, document) => {
    const key = String(document.order_id); map.set(key, (map.get(key) || 0) + 1); return map;
  }, new Map()), [documents]);

  const allItems = useMemo(() => {
    const summaries = orders.map(order => ({ kind: 'summary', id: `summary:${order.id}`, order, date: order.created_at, officialCount: documentCountByOrder.get(String(order.id)) || 0 }));
    const official = documents.map(document => {
      const order = orderMap.get(String(document.order_id));
      return order ? { kind: 'official', id: `official:${document.id}`, document, order, date: document.issue_date || document.created_at } : null;
    }).filter(Boolean);
    return [...official, ...summaries].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [orders, documents, orderMap, documentCountByOrder]);

  const filteredItems = useMemo(() => {
    const needle = normalizedSearch(query);
    return allItems.filter(item => {
      if (filter === 'official' && item.kind !== 'official') return false;
      if (filter === 'summaries' && item.kind !== 'summary') return false;
      if (!needle) return true;
      const haystack = item.kind === 'official' ? officialSearchText(item.document, item.order, lang) : summarySearchText(item.order, lang);
      return haystack.includes(needle);
    });
  }, [allItems, filter, query, lang]);

  const grouped = useMemo(() => {
    const map = new Map();
    filteredItems.forEach(item => { const key = monthKey(item.date); if (!map.has(key)) map.set(key, []); map.get(key).push(item); });
    return [...map.entries()];
  }, [filteredItems]);

  async function signedUrl(document, download = false) {
    if (!document?.file_path) throw new Error('DOCUMENT_PATH_MISSING');
    const { data, error: signedError } = await supabase.storage.from('customer-documents').createSignedUrl(document.file_path, 120);
    if (signedError || !data?.signedUrl) throw signedError || new Error('SIGNED_URL_FAILED');
    if (!download) return data.signedUrl;
    const filename = document.document_number ? `${document.document_number}.pdf` : 'balqees-document.pdf';
    const separator = data.signedUrl.includes('?') ? '&' : '?';
    return `${data.signedUrl}${separator}download=${encodeURIComponent(filename)}`;
  }

  async function openPreview(item) {
    setPreview(item); setPreviewError(''); setPreviewUrl('');
    if (item.kind === 'official') {
      setBusy(`${item.document.id}:view`);
      try { setPreviewUrl(await signedUrl(item.document, false)); }
      catch { setPreviewError(ar ? 'تعذر فتح الملف الآن. أعد المحاولة بعد قليل.' : 'The file could not be opened right now. Please try again.'); }
      finally { setBusy(''); }
    }
  }

  async function downloadOfficial(item) {
    setBusy(`${item.document.id}:download`);
    try {
      const url = await signedUrl(item.document, true);
      await supabase.from('customer_document_delivery_events').insert({ document_id: item.document.id, channel: 'download', created_by: session.user.id });
      const anchor = window.document.createElement('a'); anchor.href = url; anchor.rel = 'noopener'; anchor.target = '_blank'; anchor.click();
    } catch { setError(ar ? 'تعذر إنشاء رابط تحميل آمن الآن.' : 'A secure download link could not be created right now.'); }
    finally { setBusy(''); }
  }

  async function printPreview() {
    if (!preview) return;
    if (preview.kind === 'summary') { window.print(); return; }
    try {
      const url = previewUrl || await signedUrl(preview.document, false);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch { setPreviewError(ar ? 'تعذر فتح الملف للطباعة الآن.' : 'The file could not be opened for printing right now.'); }
  }

  useEffect(() => {
    if (loading || !allItems.length) return;
    const params = new URLSearchParams(location.search);
    const documentId = params.get('document');
    const orderId = params.get('order');
    if (documentId) {
      const item = allItems.find(row => row.kind === 'official' && String(row.document.id) === String(documentId));
      if (item) { openPreview(item); return; }
    }
    if (orderId && !query) setQuery(orderReference(orderMap.get(String(orderId)) || { id: orderId }));
  }, [loading]);

  const fullName = profileName(profile, session, ar);
  const firstName = fullName.trim().split(/\s+/)[0];
  const Arrow = ar ? ArrowLeft : ArrowRight;

  if (loading) return <div className="individual-page individual-documents-page" dir={ar ? 'rtl' : 'ltr'}><div className="individual-center-state"><LoaderCircle className="spin"/><strong>{ar ? 'نجهز خزنة مستنداتك…' : 'Preparing your document vault…'}</strong></div></div>;

  return <div className="individual-page individual-documents-page" dir={ar ? 'rtl' : 'ltr'}>
    <header className="individual-topbar"><div className="individual-shell individual-topbar-inner">
      <Link to="/" className="individual-brand"><BrandMark/></Link>
      <div className="individual-topbar-center"><span>{ar ? 'مستنداتي' : 'MY DOCUMENTS'}</span><small>{ar ? 'حساب فردي' : 'INDIVIDUAL ACCOUNT'}</small></div>
      <div className="individual-top-actions"><button type="button" className="individual-icon-button" onClick={() => navigate('/account/notifications')}><Bell size={19}/></button><button type="button" className="individual-icon-button" onClick={() => navigate('/account/cart')}><ShoppingBag size={19}/>{cart.count > 0 && <b>{Math.min(cart.count, 99)}</b>}</button><button type="button" className="individual-profile-chip" onClick={() => navigate('/account/profile')}><span>{fullName.slice(0, 1).toUpperCase()}</span><div><small>{ar ? 'مرحبًا' : 'Welcome'}</small><strong>{firstName}</strong></div></button></div>
    </div></header>

    <main className="individual-shell individual-documents-main">
      <AccountingPortal lang={lang} userId={session?.user?.id}/>
      <section className="individual-documents-hero">
        <div><small>{ar ? 'خزنة الطلبات' : 'ORDER DOCUMENT VAULT'}</small><h1>{ar ? 'مستنداتك' : 'Your documents'}</h1><p>{ar ? 'فواتيرك الرسمية وملخصات طلباتك في مكان واحد، بدون إعادة إنشاء أو تعديل أي فاتورة أصلية.' : 'Your official invoices and order summaries in one place, without recreating or altering any original invoice.'}</p></div>
        <div className={`individual-documents-live ${liveStatus}`}><Wifi size={15}/><span>{liveStatus === 'live' ? (ar ? 'تحديث مباشر' : 'Live updates') : liveStatus === 'offline' ? (ar ? 'التحديث المباشر غير متصل' : 'Live updates offline') : (ar ? 'جاري الاتصال' : 'Connecting')}</span></div>
        <button className="individual-refresh" type="button" onClick={() => load(true)} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''}/><span>{ar ? 'تحديث' : 'Refresh'}</span></button>
      </section>

      {error && <div className="individual-documents-notice"><FileSearch/><span>{error}</span></div>}

      <section className="individual-documents-toolbar">
        <label className="individual-documents-search"><Search/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? 'ابحث برقم الطلب أو الفاتورة أو اسم المنتج' : 'Search order, invoice or product'}/>{query && <button type="button" onClick={() => setQuery('')}><X/></button>}</label>
        <div className="individual-documents-filters">
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{ar ? 'الكل' : 'All'}<b>{allItems.length}</b></button>
          <button type="button" className={filter === 'official' ? 'active' : ''} onClick={() => setFilter('official')}>{ar ? 'المستندات الرسمية' : 'Official'}<b>{documents.length}</b></button>
          <button type="button" className={filter === 'summaries' ? 'active' : ''} onClick={() => setFilter('summaries')}>{ar ? 'ملخصات الطلبات' : 'Order summaries'}<b>{orders.length}</b></button>
        </div>
      </section>

      <section className="individual-documents-security-note"><LockKeyhole/><div><strong>{ar ? 'ملفاتك خاصة بحسابك' : 'Your files are private to your account'}</strong><p>{ar ? 'عرض وتحميل المستند الرسمي يتم عبر رابط موقّع قصير الصلاحية وبعد التحقق من ملكية الطلب.' : 'Official files are viewed and downloaded using short-lived signed links after order ownership is verified.'}</p></div><ShieldCheck/></section>

      {grouped.length ? <div className="individual-documents-groups">{grouped.map(([key, items]) => <section className="individual-documents-group" key={key}><header><span>{monthLabel(items[0]?.date, lang)}</span><b>{ar ? `${items.length} مستند` : `${items.length} document${items.length === 1 ? '' : 's'}`}</b></header><div className="individual-documents-grid">{items.map(item => <DocumentCard key={item.id} item={item} lang={lang} onPreview={openPreview} onDownload={downloadOfficial} busy={busy}/>)}</div></section>)}</div> : <section className="individual-documents-empty"><div><FileText/></div><small>{ar ? 'مستنداتك' : 'YOUR DOCUMENTS'}</small><h2>{allItems.length ? (ar ? 'ما لقينا مستندات تطابق البحث' : 'No documents match your search') : (ar ? 'لا توجد مستندات بعد' : 'No documents yet')}</h2><p>{allItems.length ? (ar ? 'غيّر البحث أو الفلتر لعرض بقية مستنداتك.' : 'Change the search or filter to view the rest of your documents.') : (ar ? 'ستظهر هنا ملخصات طلباتك وفواتيرك الرسمية عندما تصبح متاحة.' : 'Your order summaries and official invoices will appear here when available.')}</p>{allItems.length ? <button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>{ar ? 'عرض كل المستندات' : 'Show all documents'}</button> : <Link to="/account/orders">{ar ? 'عرض طلباتي' : 'View my orders'}<Arrow/></Link>}</section>}
    </main>

    <nav className="individual-mobile-dock"><Link to="/account"><Home/><span>{ar ? 'الرئيسية' : 'Home'}</span></Link><Link to="/account/orders"><PackageOpen/><span>{ar ? 'طلباتي' : 'Orders'}</span></Link><Link to="/store"><Store/><span>{ar ? 'المتجر' : 'Store'}</span></Link><Link to="/account/favorites"><Heart/><span>{ar ? 'المفضلة' : 'Favorites'}</span></Link><Link className="active" to="/account/profile"><UserRound/><span>{ar ? 'حسابي' : 'Account'}</span></Link></nav>

    {preview && <div className={`individual-document-preview-overlay ${preview.kind === 'summary' ? 'summary-preview-open' : ''}`} onMouseDown={e => e.target === e.currentTarget && setPreview(null)}>
      <section className="individual-document-preview-modal">
        <header><div><small>{preview.kind === 'official' ? (ar ? 'الملف الرسمي الأصلي' : 'ORIGINAL OFFICIAL FILE') : (ar ? 'ملخص الطلب' : 'ORDER SUMMARY')}</small><h2>{preview.kind === 'official' ? (ar ? (preview.document.title_ar || TYPE_LABELS.ar[preview.document.document_type]) : (preview.document.title_en || preview.document.title_ar || TYPE_LABELS.en[preview.document.document_type])) : orderReference(preview.order)}</h2></div><button type="button" onClick={() => setPreview(null)}><X/></button></header>
        <div className="individual-document-preview-body">
          {preview.kind === 'summary' ? <SummaryPreview order={preview.order} lang={lang}/> : busy === `${preview.document.id}:view` ? <div className="individual-document-preview-loading"><LoaderCircle className="spin"/><strong>{ar ? 'نجهز العرض الآمن…' : 'Preparing secure preview…'}</strong></div> : previewError ? <div className="individual-document-preview-error"><FileSearch/><strong>{previewError}</strong><button onClick={() => openPreview(preview)}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></div> : previewUrl ? <iframe title={ar ? 'معاينة المستند' : 'Document preview'} src={previewUrl}/> : null}
        </div>
        <footer><Link to={`/account/orders/${preview.order.id}`}>{ar ? 'عرض الطلب المرتبط' : 'View related order'}<Arrow/></Link><div>{preview.kind === 'official' && <button type="button" onClick={() => downloadOfficial(preview)}><Download/>{ar ? 'تحميل PDF' : 'Download PDF'}</button>}<button className="primary" type="button" onClick={printPreview}><Printer/>{ar ? 'طباعة' : 'Print'}</button></div></footer>
      </section>
    </div>}
  </div>;
}
