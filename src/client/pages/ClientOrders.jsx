import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowUpLeft, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  CircleAlert, CircleDot, ClipboardList, Clock3, Columns3, FileText, Filter, History,
  ListFilter, MapPin, MessageSquareText, PackageCheck, PackageOpen, PackageSearch, RefreshCw,
  RotateCcw, Search, ShoppingBag, Sparkles, TimerReset, X
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useBalqeesCart } from '../../lib/cart';
import { useClientPortal } from '../ClientPortalContext';
import { daysUntil, fmtDate, orderLabels, sar, statusTone } from '../portalUtils';

const ACTIVE_STATUSES = new Set(['pending', 'under_review', 'quoted', 'approved', 'in_progress']);
const CLOSED_STATUSES = new Set(['completed', 'cancelled']);
const QUOTE_ACTION_STATUSES = new Set(['sent', 'viewed']);
const ORDER_PROGRESS = { pending: 1, under_review: 2, quoted: 3, approved: 4, in_progress: 5, completed: 6, cancelled: 0 };
const ORDER_STEPS = {
  ar: ['استلام الطلب', 'المراجعة', 'التسعير', 'الاعتماد', 'التنفيذ', 'الإغلاق'],
  en: ['Received', 'Review', 'Pricing', 'Approval', 'Execution', 'Closed'],
};

function orderRef(order) {
  return `BLQ-${String(order?.order_number || 0).padStart(5, '0')}`;
}

function siteName(site, ar) {
  if (!site) return ar ? 'بدون موقع محدد' : 'No site assigned';
  return ar ? site.name_ar : (site.name_en || site.name_ar);
}

function orderTitle(order, ar) {
  if (order?.customer_label) return order.customer_label;
  const first = order?.order_items?.[0];
  const name = ar ? first?.product_snapshot?.name_ar : (first?.product_snapshot?.name_en || first?.product_snapshot?.name_ar);
  if (!name) return ar ? 'طلب توريد وخدمة' : 'Supply & service order';
  const extra = Math.max(0, (order.order_items?.length || 0) - 1);
  return extra ? `${name} +${extra}` : name;
}

function addressLabel(order, site, ar) {
  if (site) return siteName(site, ar);
  const address = order?.service_address || {};
  return address.district || address.city || address.short_address || (ar ? 'موقع الخدمة' : 'Service location');
}

function latestEvent(events = []) {
  return [...events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
}

function StageTrack({ status, ar }) {
  const current = ORDER_PROGRESS[status] || 0;
  if (status === 'cancelled') {
    return <div className="ops-stage-cancelled"><CircleAlert/><span>{ar ? 'تم إلغاء هذه العملية' : 'This operation was cancelled'}</span></div>;
  }
  return <div className="ops-stage-track" aria-label={ar ? 'مراحل الطلب' : 'Order progress'}>
    {ORDER_STEPS[ar ? 'ar' : 'en'].map((label, index) => {
      const step = index + 1;
      const done = current > step;
      const active = current === step;
      return <div key={label} className={`${done ? 'done' : ''} ${active ? 'active' : ''}`}>
        <i>{done ? <CheckCircle2/> : step}</i><span>{label}</span>
      </div>;
    })}
  </div>;
}

function Metric({ icon: Icon, label, value, tone = '' }) {
  return <div className={`ops-metric ${tone}`}><span><Icon/></span><div><strong>{value}</strong><small>{label}</small></div></div>;
}

function EmptyState({ ar, filtered, canCreate }) {
  return <div className="ops-empty"><PackageSearch/><h3>{filtered ? (ar ? 'لا توجد نتائج مطابقة' : 'No matching operations') : (ar ? 'لا توجد عمليات بعد' : 'No operations yet')}</h3><p>{filtered ? (ar ? 'غيّر البحث أو الفلاتر لعرض طلبات أخرى.' : 'Adjust the search or filters to reveal other orders.') : (ar ? 'ابدأ بطلب جديد وستظهر رحلته هنا من الاستلام حتى الإغلاق.' : 'Start a new request and its journey will appear here from receipt to closure.')}</p>{!filtered&&canCreate&&<Link className="client-primary" to="/portal/request"><ShoppingBag/>{ar ? 'بدء طلب جديد' : 'Start a new request'}</Link>}</div>;
}

export default function ClientOrders() {
  const { lang, organization, permissions } = useClientPortal();
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const { id: routeOrderId } = useParams();
  const cart = useBalqeesCart();
  const canSeeMoney = Boolean(permissions.canSeePrices);
  const [data, setData] = useState({ orders: [], sites: [], quotes: [], support: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState('active');
  const [status, setStatus] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [period, setPeriod] = useState('all');
  const [poOnly, setPoOnly] = useState(false);
  const [view, setView] = useState('board');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [repeating, setRepeating] = useState(null);
  const [toast, setToast] = useState('');

  async function load({ quiet = false } = {}) {
    if (!organization?.id) return;
    if (!quiet) setLoading(true);
    setError('');
    const id = organization.id;
    const [orders, sites, quotes, support] = await Promise.all([
      supabase.from('orders').select('*,order_items(*)').eq('organization_id', id).order('created_at', { ascending: false }).limit(120),
      supabase.from('organization_sites').select('id,name_ar,name_en,site_type,address,contact_name,contact_phone,is_active').eq('organization_id', id).order('is_active', { ascending: false }),
      supabase.from('quotations').select('id,order_id,quote_number,status,total,valid_until,title_ar,title_en,updated_at').eq('organization_id', id).eq('is_current', true).order('updated_at', { ascending: false }),
      supabase.from('support_conversations').select('id,order_id,subject,status,priority,last_message_at,requires_human,customer_last_read_at').eq('organization_id', id).in('status', ['open','pending']).order('last_message_at', { ascending: false }),
    ]);
    const orderRows = orders.data || [];
    let events = { data: [], error: null };
    const ids = orderRows.map((x) => x.id);
    if (ids.length) events = await supabase.from('order_events').select('id,order_id,event_type,title_ar,title_en,body_ar,body_en,actor_type,created_at,metadata').in('order_id', ids).order('created_at', { ascending: false }).limit(400);
    const firstError = orders.error || sites.error || quotes.error || support.error || events.error;
    if (firstError) setError(ar ? 'تعذر تحميل جزء من بيانات العمليات الآن. حاول التحديث.' : 'Part of the operations data could not be loaded. Try refreshing.');
    setData({ orders: orderRows, sites: sites.data || [], quotes: quotes.data || [], support: support.data || [], events: events.data || [] });
    if (!quiet) setLoading(false);
  }

  useEffect(() => { load(); }, [organization?.id]);

  useEffect(() => {
    if (!organization?.id || !supabase) return undefined;
    const channel = supabase.channel(`client-ops-${organization.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `organization_id=eq.${organization.id}` }, () => load({ quiet: true }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations', filter: `organization_id=eq.${organization.id}` }, () => load({ quiet: true }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations', filter: `organization_id=eq.${organization.id}` }, () => load({ quiet: true }))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_events' }, (payload) => {
        const known = new Set(data.orders.map((x) => x.id));
        if (known.has(payload.new?.order_id)) load({ quiet: true });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [organization?.id, data.orders.map((x) => x.id).join('|')]);

  const siteMap = useMemo(() => Object.fromEntries(data.sites.map((x) => [x.id, x])), [data.sites]);
  const quotesByOrder = useMemo(() => {
    const map = {};
    data.quotes.forEach((q) => { if (q.order_id && !map[q.order_id]) map[q.order_id] = q; });
    return map;
  }, [data.quotes]);
  const supportByOrder = useMemo(() => {
    const map = {};
    data.support.forEach((c) => { if (c.order_id && !map[c.order_id]) map[c.order_id] = c; });
    return map;
  }, [data.support]);
  const eventsByOrder = useMemo(() => {
    const map = {};
    data.events.forEach((event) => { (map[event.order_id] ||= []).push(event); });
    return map;
  }, [data.events]);

  const enriched = useMemo(() => data.orders.map((order) => {
    const site = siteMap[order.service_site_id] || null;
    const quote = quotesByOrder[order.id] || null;
    const care = supportByOrder[order.id] || null;
    const events = eventsByOrder[order.id] || [];
    const latest = latestEvent(events);
    const awaitingDecision = Boolean(quote && QUOTE_ACTION_STATUSES.has(quote.status));
    const needsDecision = Boolean(awaitingDecision && permissions.acceptQuotes);
    const scheduled = order.status === 'approved' && Boolean(order.requested_delivery_date);
    const requestedKey = order.requested_delivery_date ? String(order.requested_delivery_date).slice(0, 10) : '';
    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const timingNeedsReview = Boolean(ACTIVE_STATUSES.has(order.status) && requestedKey && requestedKey < todayKey);
    const careState = needsDecision ? 'action' : (care ? 'care' : (timingNeedsReview ? 'timing' : (order.status === 'cancelled' ? 'closed' : 'stable')));
    return { ...order, _site: site, _quote: quote, _care: care, _events: events, _latest: latest, _awaitingDecision: awaitingDecision, _needsDecision: needsDecision, _scheduled: scheduled, _careState: careState };
  }), [data.orders, siteMap, quotesByOrder, supportByOrder, eventsByOrder, permissions.acceptQuotes]);

  const counts = useMemo(() => ({
    active: enriched.filter((x) => ACTIVE_STATUSES.has(x.status)).length,
    action: enriched.filter((x) => x._needsDecision).length,
    live: enriched.filter((x) => x.status === 'in_progress').length,
    scheduled: enriched.filter((x) => x._scheduled).length,
    completed: enriched.filter((x) => x.status === 'completed').length,
  }), [enriched]);

  const activeNow = useMemo(() => enriched.find((x) => x.status === 'in_progress') || enriched.find((x) => x.status === 'approved') || null, [enriched]);
  const actionOrders = useMemo(() => enriched.filter((x) => x._needsDecision).slice(0, 3), [enriched]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((order) => {
      if (quick === 'active' && !ACTIVE_STATUSES.has(order.status)) return false;
      if (quick === 'action' && !order._needsDecision) return false;
      if (quick === 'completed' && order.status !== 'completed') return false;
      if (quick === 'cancelled' && order.status !== 'cancelled') return false;
      if (status !== 'all' && order.status !== status) return false;
      if (siteFilter !== 'all' && String(order.service_site_id || '') !== siteFilter) return false;
      if (poOnly && !order.po_number) return false;
      if (period !== 'all') {
        const created = new Date(order.created_at).getTime();
        const now = Date.now();
        if (period === '30' && created < now - 30 * 86400000) return false;
        if (period === '90' && created < now - 90 * 86400000) return false;
        if (period === 'year' && new Date(order.created_at).getFullYear() !== new Date().getFullYear()) return false;
      }
      if (!q) return true;
      const haystack = [
        orderRef(order), String(order.order_number || ''), order.customer_label, order.po_number,
        siteName(order._site, ar), order.service_address?.city, order.service_address?.district,
        ...(order.order_items || []).flatMap((i) => [i.product_snapshot?.name_ar, i.product_snapshot?.name_en, i.product_snapshot?.sku]),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [enriched, query, quick, status, siteFilter, period, poOnly, ar]);

  const selected = enriched.find((x) => x.id === (selectedId || routeOrderId)) || null;

  useEffect(() => {
    if (routeOrderId && enriched.some((x) => x.id === routeOrderId)) setSelectedId(routeOrderId);
  }, [routeOrderId, enriched]);

  useEffect(() => {
    if (!selected) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => { if (event.key === 'Escape') closeOrderDetail(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selected?.id]);

  async function repeatOrder(order) {
    if (!permissions.placeOrders) {
      setToast(ar ? 'حسابك لا يملك صلاحية إنشاء طلبات.' : 'Your account cannot place organization orders.');
      return;
    }
    const ids = (order.order_items || []).map((x) => x.product_id).filter(Boolean);
    if (!ids.length) {
      setToast(ar ? 'لا توجد منتجات قابلة لإعادة الطلب آليًا.' : 'No products in this order can be repeated automatically.');
      return;
    }
    setRepeating(order.id);
    const { data: products, error: productError } = await supabase.from('products').select('*').in('id', ids).eq('is_active', true);
    if (productError || !products?.length) {
      setToast(ar ? 'تعذر العثور على المنتجات الحالية لهذا الطلب.' : 'Current products for this order could not be found.');
      setRepeating(null);
      return;
    }
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
    let added = 0;
    (order.order_items || []).forEach((item) => {
      const product = productMap[item.product_id];
      if (!product) return;
      cart.add(product, Number(item.quantity || 1));
      added += 1;
    });
    setRepeating(null);
    if (!added) setToast(ar ? 'المنتجات السابقة لم تعد متاحة.' : 'The previous products are no longer available.');
    else navigate('/portal/request');
  }

  function openOrderDetail(order) {
    setSelectedId(order.id);
    navigate(`/portal/orders/${order.id}`);
  }

  function closeOrderDetail() {
    setSelectedId(null);
    if (routeOrderId) navigate('/portal/orders');
  }

  function openPrimary(order) {
    if (order._awaitingDecision) return navigate(`/portal/quotes/${order._quote?.id || ''}`);
    openOrderDetail(order);
  }

  const boardGroups = useMemo(() => [
    { key: 'intake', title: ar ? 'الاستلام والمراجعة' : 'Intake & review', statuses: ['pending', 'under_review'], icon: PackageOpen },
    { key: 'decision', title: ar ? 'بانتظار القرار' : 'Decision', statuses: ['quoted'], icon: FileText },
    { key: 'execution', title: ar ? 'التجهيز والتنفيذ' : 'Execution', statuses: ['approved', 'in_progress'], icon: Activity },
    { key: 'closed', title: ar ? 'مكتملة' : 'Completed', statuses: ['completed'], icon: PackageCheck },
  ], [ar]);

  const hasFilters = Boolean(query || status !== 'all' || siteFilter !== 'all' || period !== 'all' || poOnly || quick !== 'active');

  return <div className="client-page client-operations-page">
    <section className="ops-hero">
      <div className="ops-hero-copy"><span><Activity/>{ar ? 'مركز العمليات' : 'OPERATIONS CENTER'}</span><h2>{ar ? 'كل عملية واضحة من البداية حتى الإغلاق.' : 'Every operation, clear from start to close.'}</h2><p>{ar ? 'تابع ما يجري الآن، ما يحتاج قرارك، والمواعيد والمواقع المرتبطة بكل طلب — بدون البحث بين الرسائل.' : 'Track what is live, what needs your decision, and the dates and sites tied to each order — without chasing messages.'}</p><div className="ops-hero-actions">{permissions.placeOrders&&<Link className="client-primary" to="/portal/request"><ShoppingBag/>{ar ? 'طلب جديد' : 'New request'}</Link>}<button className="client-secondary" onClick={() => load()} disabled={loading}><RefreshCw className={loading ? 'spin' : ''}/>{ar ? 'تحديث العمليات' : 'Refresh operations'}</button></div></div>
      <div className="ops-command-orb" aria-hidden="true"><div className="ops-orbit one"/><div className="ops-orbit two"/><div className="ops-orbit three"/><span><PackageSearch/></span><i className="a"/><i className="b"/><i className="c"/><strong>{counts.active}</strong><small>{ar ? 'عملية نشطة' : 'ACTIVE'}</small></div>
    </section>

    {error&&<div className="ops-alert error"><CircleAlert/><span>{error}</span><button onClick={() => load()}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></div>}
    {toast&&<div className="ops-toast"><Sparkles/><span>{toast}</span><button onClick={() => setToast('')}><X/></button></div>}

    <section className="ops-metrics">
      <Metric icon={Activity} label={ar ? 'نشطة الآن' : 'Active now'} value={counts.active}/>
      <Metric icon={CircleAlert} label={ar ? 'تحتاج قرارك' : 'Need your action'} value={counts.action} tone={counts.action ? 'attention' : 'good'}/>
      <Metric icon={CircleDot} label={ar ? 'يجري تنفيذها' : 'Live execution'} value={counts.live} tone={counts.live ? 'live' : ''}/>
      <Metric icon={CalendarDays} label={ar ? 'مجدولة' : 'Scheduled'} value={counts.scheduled}/>
      <Metric icon={PackageCheck} label={ar ? 'مكتملة' : 'Completed'} value={counts.completed} tone="good"/>
    </section>

    {actionOrders.length>0&&<section className="ops-action-zone"><header><div><span><CircleAlert/>{ar ? 'يحتاج منك إجراء' : 'NEEDS YOUR ACTION'}</span><h3>{ar ? 'أمور لا نريد أن تتوقف عليك' : 'Keep these moving'}</h3></div><Link to="/portal/quotes">{ar ? 'كل عروض الأسعار' : 'All quotations'}<ArrowUpLeft/></Link></header><div className="ops-action-grid">{actionOrders.map((order) => <article key={order.id}><div className="ops-action-icon"><FileText/></div><div><small>{orderRef(order)} · {siteName(order._site, ar)}</small><strong>{ar ? `عرض سعر ينتظر قرارك` : 'Quotation awaiting your decision'}</strong><p>{order._quote?.valid_until ? (ar ? `صالح حتى ${fmtDate(order._quote.valid_until, lang)}` : `Valid until ${fmtDate(order._quote.valid_until, lang)}`) : (ar ? 'راجع العرض لتستمر العملية.' : 'Review the quotation to keep the operation moving.')}</p></div>{canSeeMoney&&<b>{sar(order._quote?.total || order.total, lang)}</b>}<button onClick={() => navigate(`/portal/quotes/${order._quote.id}`)}>{ar ? 'مراجعة العرض' : 'Review quotation'}<ChevronLeft/></button></article>)}</div></section>}

    {activeNow&&<section className="ops-live"><div className="ops-live-head"><div><span><i/>{activeNow.status === 'in_progress' ? (ar ? 'يجري الآن' : 'LIVE NOW') : (ar ? 'العملية التالية' : 'NEXT OPERATION')}</span><h3>{orderTitle(activeNow, ar)}</h3><p>{orderRef(activeNow)} · {addressLabel(activeNow, activeNow._site, ar)}</p></div><button className="client-secondary" onClick={() => openOrderDetail(activeNow)}>{ar ? 'فتح العملية' : 'Open operation'}<ArrowUpLeft/></button></div><StageTrack status={activeNow.status} ar={ar}/><div className="ops-live-meta"><span><Clock3/><div><small>{ar ? 'آخر تحديث' : 'Latest update'}</small><strong>{activeNow._latest ? (ar ? activeNow._latest.title_ar : (activeNow._latest.title_en || activeNow._latest.title_ar)) : (orderLabels[lang][activeNow.status] || activeNow.status)}</strong></div></span><span><CalendarDays/><div><small>{ar ? 'الموعد المطلوب' : 'Requested date'}</small><strong>{fmtDate(activeNow.requested_delivery_date, lang)}</strong></div></span><span><MapPin/><div><small>{ar ? 'الموقع' : 'Site'}</small><strong>{addressLabel(activeNow, activeNow._site, ar)}</strong></div></span></div></section>}

    <section className="ops-toolbar"><div className="ops-search"><Search/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ar ? 'ابحث برقم الطلب، الموقع، PO أو المنتج…' : 'Search order, site, PO or product…'}/>{query&&<button onClick={() => setQuery('')}><X/></button>}</div><div className="ops-toolbar-actions"><button className={filtersOpen ? 'active' : ''} onClick={() => setFiltersOpen((x) => !x)}><Filter/>{ar ? 'الفلاتر' : 'Filters'}{(status !== 'all' || siteFilter !== 'all')&&<i/>}</button><div className="ops-view-switch"><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')} aria-label={ar ? 'عرض العمليات' : 'Board view'}><Columns3/></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label={ar ? 'عرض القائمة' : 'List view'}><ListFilter/></button></div></div></section>

    <div className="ops-quick-tabs">{[
      ['active', ar ? 'النشطة' : 'Active', counts.active],
      ['action', ar ? 'تحتاج قراري' : 'My action', counts.action],
      ['completed', ar ? 'المكتملة' : 'Completed', counts.completed],
      ['all', ar ? 'الكل' : 'All', enriched.length],
    ].map(([key, label, count]) => <button key={key} className={quick === key ? 'active' : ''} onClick={() => setQuick(key)}><span>{label}</span><b>{count}</b></button>)}</div>

    {filtersOpen&&<section className="ops-filter-panel"><label><span>{ar ? 'الحالة' : 'Status'}</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">{ar ? 'كل الحالات' : 'All statuses'}</option>{Object.entries(orderLabels[lang]).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label><span>{ar ? 'الموقع' : 'Site'}</span><select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}><option value="all">{ar ? 'كل المواقع' : 'All sites'}</option>{data.sites.filter((x) => x.is_active).map((site) => <option key={site.id} value={site.id}>{siteName(site, ar)}</option>)}</select></label><label><span>{ar ? 'الفترة' : 'Period'}</span><select value={period} onChange={(e) => setPeriod(e.target.value)}><option value="all">{ar ? 'كل الفترات' : 'All time'}</option><option value="30">{ar ? 'آخر 30 يومًا' : 'Last 30 days'}</option><option value="90">{ar ? 'آخر 90 يومًا' : 'Last 90 days'}</option><option value="year">{ar ? 'هذه السنة' : 'This year'}</option></select></label><label className="ops-po-filter"><span>{ar ? 'أمر الشراء' : 'Purchase order'}</span><button type="button" className={poOnly ? 'active' : ''} onClick={() => setPoOnly((x) => !x)}><ClipboardList/>{ar ? 'طلبات لديها PO فقط' : 'PO orders only'}</button></label><button onClick={() => { setStatus('all'); setSiteFilter('all'); setPeriod('all'); setPoOnly(false); setQuery(''); setQuick('active'); }}>{ar ? 'إعادة الضبط' : 'Reset filters'}<TimerReset/></button></section>}

    {loading ? <div className="ops-loading"><RefreshCw className="spin"/><span>{ar ? 'نجمع آخر حالة لكل عملية…' : 'Gathering the latest state for every operation…'}</span></div> : filtered.length === 0 ? <EmptyState ar={ar} filtered={hasFilters} canCreate={permissions.placeOrders}/> : view === 'board' ? <section className="ops-board">{boardGroups.map((group) => { const rows = filtered.filter((x) => group.statuses.includes(x.status)); const Icon = group.icon; return <div className="ops-lane" key={group.key}><header><span><Icon/></span><div><strong>{group.title}</strong><small>{rows.length} {ar ? 'عملية' : rows.length === 1 ? 'operation' : 'operations'}</small></div></header><div className="ops-lane-body">{rows.length ? rows.map((order) => <article className={`ops-card ${order.status === 'in_progress' ? 'live' : ''}`} key={order.id}><div className="ops-card-top"><span className={`ops-status ${statusTone(order.status)}`}><i/>{orderLabels[lang][order.status] || order.status}</span><small>{orderRef(order)}</small></div><button className="ops-card-title" onClick={() => openPrimary(order)}><strong>{orderTitle(order, ar)}</strong><span>{addressLabel(order, order._site, ar)}<MapPin/></span></button><div className="ops-card-progress"><b style={{width: `${Math.max(8, (ORDER_PROGRESS[order.status] || 0) / 6 * 100)}%`}}/></div><div className="ops-card-facts"><span><CalendarDays/><small>{fmtDate(order.requested_delivery_date || order.created_at, lang)}</small></span>{order.po_number&&<span><ClipboardList/><small>{order.po_number}</small></span>}{canSeeMoney&&<span><strong>{sar(order.total, lang)}</strong></span>}</div>{order._latest&&<div className="ops-card-update"><History/><div><small>{ar ? 'آخر تحديث' : 'LATEST'}</small><p>{ar ? order._latest.title_ar : (order._latest.title_en || order._latest.title_ar)}</p></div></div>}<div className="ops-card-care"><i className={order._careState}/><span>{order._careState === 'action' ? (ar ? 'تحتاج قرارك' : 'Needs your action') : order._careState === 'care' ? (ar ? 'عناية مفتوحة' : 'Care open') : order._careState === 'timing' ? (ar ? 'راجع الموعد' : 'Review timing') : order._careState === 'closed' ? (ar ? 'مغلقة' : 'Closed') : (ar ? 'العناية مستقرة' : 'Care stable')}</span></div><div className="ops-card-actions"><button className="primary" onClick={() => openPrimary(order)}>{order._needsDecision ? (ar ? 'راجع العرض' : 'Review quote') : order._awaitingDecision ? (ar ? 'عرض السعر' : 'View quote') : (ar ? 'فتح العملية' : 'Open operation')}<ChevronLeft/></button>{order.status === 'completed'&&permissions.placeOrders&&<button title={ar ? 'إعادة الطلب' : 'Repeat order'} onClick={() => repeatOrder(order)} disabled={repeating === order.id}><RotateCcw className={repeating === order.id ? 'spin' : ''}/></button>}</div></article>) : <div className="ops-lane-empty"><CircleDot/><span>{ar ? 'لا توجد عمليات هنا' : 'No operations here'}</span></div>}</div></div>; })}</section> : <section className="ops-list"><header><span>{ar ? 'العملية' : 'Operation'}</span><span>{ar ? 'الموقع' : 'Site'}</span><span>{ar ? 'الحالة' : 'Status'}</span><span>{ar ? 'الموعد' : 'Date'}</span>{canSeeMoney&&<span>{ar ? 'القيمة' : 'Value'}</span>}<span/></header>{filtered.map((order) => <article key={order.id} onClick={() => openOrderDetail(order)}><div><small>{orderRef(order)}</small><strong>{orderTitle(order, ar)}</strong>{order.po_number&&<em>PO · {order.po_number}</em>}</div><span>{addressLabel(order, order._site, ar)}</span><span className={`ops-status ${statusTone(order.status)}`}><i/>{orderLabels[lang][order.status] || order.status}</span><span>{fmtDate(order.requested_delivery_date || order.created_at, lang)}</span>{canSeeMoney&&<strong>{sar(order.total, lang)}</strong>}<ChevronLeft/></article>)}</section>}

    {selected&&<div className="ops-detail-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) closeOrderDetail(); }}><aside className="ops-detail" role="dialog" aria-modal="true"><header><div><small>{orderRef(selected)}</small><h3>{orderTitle(selected, ar)}</h3><p>{addressLabel(selected, selected._site, ar)}</p></div><button onClick={closeOrderDetail}><X/></button></header><div className="ops-detail-scroll"><section className="ops-detail-status"><div><span className={`ops-status ${statusTone(selected.status)}`}><i/>{orderLabels[lang][selected.status] || selected.status}</span>{selected.status === 'in_progress'&&<em><i/>{ar ? 'يجري الآن' : 'LIVE'}</em>}</div><StageTrack status={selected.status} ar={ar}/></section><section className={`ops-operation-care ${selected._careState}`}><Activity/><div><small>{ar ? 'عناية العملية' : 'OPERATION CARE'}</small><strong>{selected._careState === 'action' ? (ar ? 'تحتاج قرارك' : 'Needs your decision') : selected._careState === 'care' ? (ar ? 'متابعة مفتوحة' : 'Open follow-up') : selected._careState === 'timing' ? (ar ? 'راجع الموعد' : 'Review timing') : selected._careState === 'closed' ? (ar ? 'العملية ملغاة' : 'Operation cancelled') : (ar ? 'مستقرة' : 'Stable')}</strong><p>{selected._careState === 'action' ? (ar ? 'عرض سعر مرتبط بالعملية ينتظر مراجعتك.' : 'A linked quotation is waiting for your review.') : selected._careState === 'care' ? (selected._care?.subject || (ar ? 'هناك حالة عناية مفتوحة مرتبطة بالعملية.' : 'An open care case is linked to this operation.')) : selected._careState === 'timing' ? (ar ? 'الموعد المطلوب المسجل مضى والعملية ما زالت نشطة.' : 'The recorded requested date has passed while the operation remains active.') : selected._careState === 'closed' ? (ar ? 'العملية مغلقة بحالة ملغاة.' : 'This operation is closed as cancelled.') : (ar ? 'لا يوجد إجراء ظاهر مطلوب منك حاليًا.' : 'No visible action is currently required from you.')}</p></div></section><section className="ops-detail-facts"><span><MapPin/><div><small>{ar ? 'الموقع' : 'Site'}</small><strong>{addressLabel(selected, selected._site, ar)}</strong></div></span><span><CalendarDays/><div><small>{ar ? 'الموعد المطلوب' : 'Requested date'}</small><strong>{fmtDate(selected.requested_delivery_date, lang)}</strong></div></span><span><ClipboardList/><div><small>{ar ? 'أمر الشراء' : 'PO number'}</small><strong>{selected.po_number || '—'}</strong></div></span>{canSeeMoney&&<span><PackageCheck/><div><small>{ar ? 'إجمالي الطلب' : 'Order total'}</small><strong>{sar(selected.total, lang)}</strong></div></span>}</section>{selected._quote&&<section className="ops-linked-box quote"><FileText/><div><small>{ar ? 'عرض السعر المرتبط' : 'LINKED QUOTATION'}</small><strong>Q-{String(selected._quote.quote_number).padStart(5, '0')} · {selected._quote.status ? (selected._quote.status === 'sent' ? (permissions.acceptQuotes ? (ar ? 'ينتظر قرارك' : 'Awaiting your decision') : (ar ? 'بانتظار اعتماد مخوّل' : 'Awaiting an authorized approver')) : selected._quote.status) : ''}</strong><p>{selected._quote.valid_until ? (ar ? `صالح حتى ${fmtDate(selected._quote.valid_until, lang)}` : `Valid until ${fmtDate(selected._quote.valid_until, lang)}`) : ''}</p></div><button onClick={() => navigate(`/portal/quotes/${selected._quote.id}`)}>{ar ? 'فتح العرض' : 'Open quote'}<ChevronLeft/></button></section>}{selected._care&&permissions.createSupportCases&&<section className="ops-linked-box care"><MessageSquareText/><div><small>{ar ? 'العناية المرتبطة' : 'LINKED CARE'}</small><strong>{selected._care.subject}</strong><p>{ar ? 'هناك محادثة عناية مرتبطة بهذه العملية.' : 'A care conversation is attached to this operation.'}</p></div><button onClick={() => navigate(`/portal/support?order=${selected.id}`)}>{ar ? 'فتح العناية' : 'Open care'}<ChevronLeft/></button></section>}<section className="ops-detail-section"><header><div><small>{ar ? 'بنود العملية' : 'ORDER ITEMS'}</small><h4>{ar ? 'ما الذي تم طلبه؟' : 'What was requested?'}</h4></div><b>{selected.order_items?.length || 0}</b></header><div className="ops-item-list">{(selected.order_items || []).map((item) => <div key={item.id}><div><strong>{ar ? (item.product_snapshot?.name_ar || 'منتج') : (item.product_snapshot?.name_en || item.product_snapshot?.name_ar || 'Product')}</strong><small>{item.product_snapshot?.sku || ''}</small></div><span>× {Number(item.quantity)}</span>{canSeeMoney&&<strong>{sar(item.line_total, lang)}</strong>}</div>)}</div></section><section className="ops-detail-section"><header><div><small>{ar ? 'سجل العملية' : 'OPERATION HISTORY'}</small><h4>{ar ? 'آخر التحديثات' : 'Latest updates'}</h4></div></header><div className="ops-event-list">{selected._events.length ? [...selected._events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((event, index) => <article key={event.id}><i className={index === 0 ? 'current' : ''}/><div><small>{fmtDate(event.created_at, lang, true)}</small><strong>{ar ? event.title_ar : (event.title_en || event.title_ar)}</strong>{(ar ? event.body_ar : (event.body_en || event.body_ar))&&<p>{ar ? event.body_ar : (event.body_en || event.body_ar)}</p>}</div></article>) : <div className="ops-event-empty"><History/><span>{ar ? 'لا توجد أحداث تفصيلية مسجلة بعد.' : 'No detailed events have been recorded yet.'}</span></div>}</div></section>{selected.customer_note&&<section className="ops-customer-note"><small>{ar ? 'ملاحظتك عند إنشاء الطلب' : 'YOUR ORIGINAL NOTE'}</small><p>{selected.customer_note}</p></section>}</div><footer>{permissions.createSupportCases&&<button className="client-secondary" onClick={() => navigate(`/portal/support?order=${selected.id}`)}><MessageSquareText/>{ar ? 'اسأل عناية بلقيس' : 'Ask Balqees Care'}</button>}{selected.status === 'completed'&&permissions.placeOrders&&<button className="client-secondary" onClick={() => repeatOrder(selected)} disabled={repeating === selected.id}><RotateCcw className={repeating === selected.id ? 'spin' : ''}/>{ar ? 'اطلب مثله' : 'Repeat order'}</button>}{selected._needsDecision&&<button className="client-primary" onClick={() => navigate(`/portal/quotes/${selected._quote.id}`)}><FileText/>{ar ? 'مراجعة العرض' : 'Review quotation'}</button>}</footer></aside></div>}
  </div>;
}
