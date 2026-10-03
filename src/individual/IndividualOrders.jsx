import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Bell, Check, ChevronLeft, ChevronRight,
  CircleAlert, CircleCheck, Clock3, CreditCard, Download, FileCheck2, FileText, Heart, Home, LoaderCircle, MapPin, MessageCircle,
  PackageCheck, PackageSearch, PencilLine, Printer, ReceiptText, RefreshCw, RotateCcw, Search, ShieldCheck,
  ShoppingBag, Sparkles, Store, Truck, UserRound, Wifi, X,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { formatSar, resolveProductPrice } from '../lib/storePricing';
import { saveFavorite } from '../lib/favorites';
import {
  ACTIVE_ORDER_STATUSES as ACTIVE, COMPLETED_ORDER_STATUSES as COMPLETED,
  EDITABLE_ORDER_STATUSES, ORDER_FLOW as FLOW, ORDER_STATUS as STATUS,
  actionReason, addressText, fmtDate, fmtRelative, historyBucket, orderAddress,
  orderNo, orderSearchText, productName, recipientName, requiresAction, statusMeta, currentMilestoneIndex,
} from './individualUtils';
import './individual-account.css';

function useAccountProfile(session) {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    if (!supabase || !session?.user?.id) return;
    supabase.from('customer_profiles').select('id,full_name,email,phone').eq('id', session.user.id).maybeSingle().then(({ data }) => setProfile(data || null));
  }, [session?.user?.id]);
  return profile;
}

function AccountChrome({ lang, session, active = 'orders', children }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const cart = useBalqeesCart(session?.user?.id || null);
  const profile = useAccountProfile(session);
  const fullName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || (ar ? 'عميل بلقيس' : 'Balqees client');
  const firstName = fullName.trim().split(/\s+/)[0];
  useEffect(() => { document.body.classList.add('individual-account-active'); return () => document.body.classList.remove('individual-account-active'); }, []);
  return <div className="individual-account-app individual-orders-app" dir={ar ? 'rtl' : 'ltr'}>
    <header className="individual-topbar"><div className="individual-shell individual-topbar-inner"><Link to="/" className="individual-brand"><BrandMark/></Link><div className="individual-topbar-center"><span>{ar ? 'طلباتي' : 'MY ORDERS'}</span><small>{ar ? 'حساب فردي' : 'INDIVIDUAL ACCOUNT'}</small></div><div className="individual-top-actions"><button type="button" className="individual-icon-button" onClick={() => navigate('/account/notifications')} aria-label={ar ? 'الإشعارات' : 'Notifications'}><Bell size={19}/></button><button type="button" className="individual-icon-button" onClick={() => navigate('/account/cart')} aria-label={ar ? 'السلة' : 'Cart'}><ShoppingBag size={19}/>{cart.count > 0 && <b>{Math.min(cart.count, 99)}</b>}</button><button type="button" className="individual-profile-chip" onClick={() => navigate('/account/profile')}><span>{fullName.slice(0, 1).toUpperCase()}</span><div><small>{ar ? 'مرحبًا' : 'Welcome'}</small><strong>{firstName}</strong></div></button></div></div></header>
    {children}
    <nav className="individual-mobile-dock"><Link className={active === 'home' ? 'active' : ''} to="/account"><Home/><span>{ar ? 'الرئيسية' : 'Home'}</span></Link><Link className={active === 'orders' ? 'active' : ''} to="/account/orders"><PackageSearch/><span>{ar ? 'طلباتي' : 'Orders'}</span></Link><Link to="/store"><Store/><span>{ar ? 'المتجر' : 'Store'}</span></Link><Link to="/account/favorites"><Heart/><span>{ar ? 'المفضلة' : 'Favorites'}</span></Link><Link to="/account/profile"><UserRound/><span>{ar ? 'حسابي' : 'Account'}</span></Link></nav>
  </div>;
}

function lastRelevantEvent(eventsByOrder, orderId) {
  const rows = eventsByOrder[orderId] || [];
  return rows.length ? rows[rows.length - 1] : null;
}

export default function IndividualOrders({ lang, session, onSignOut }) {
  const ar = lang === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const navigate = useNavigate();
  const cart = useBalqeesCart(session?.user?.id || null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [priceRules, setPriceRules] = useState([]);
  const [eventsByOrder, setEventsByOrder] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState('');

  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 3800); return () => window.clearTimeout(timer); }, [toast]);

  async function load(silent = false) {
    if (!supabase || !session?.user?.id) return;
    silent ? setRefreshing(true) : setLoading(true);
    setError('');
    const [ordersResult, productsResult, rulesResult] = await Promise.all([
      supabase.from('orders').select('*,order_items(*)').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('visibility', 'public').eq('is_active', true),
      supabase.from('price_rules').select('*').eq('is_active', true),
    ]);
    const cacheKey = `balqees-individual-orders:${session.user.id}`;
    let rows = ordersResult.data || [];
    let grouped = {};
    if (ordersResult.error) {
      try {
        const cached = JSON.parse(window.localStorage.getItem(cacheKey) || 'null');
        if (cached?.orders?.length) {
          rows = cached.orders;
          grouped = cached.events || {};
          setError(ar ? `تعذر التحديث الآن؛ نعرض آخر حالة محفوظة من ${fmtDate(cached.saved_at, lang, true)}.` : `Could not refresh right now; showing the last saved status from ${fmtDate(cached.saved_at, lang, true)}.`);
        } else {
          setError(ar ? 'تعذر تحميل طلباتك الآن. جرّب التحديث مرة أخرى.' : 'Your orders could not be loaded. Please refresh and try again.');
        }
      } catch {
        setError(ar ? 'تعذر تحميل طلباتك الآن. جرّب التحديث مرة أخرى.' : 'Your orders could not be loaded. Please refresh and try again.');
      }
    } else {
      const ids = rows.map(x => x.id);
      if (ids.length) {
        const { data } = await supabase.from('order_events').select('*').in('order_id', ids).order('created_at', { ascending: true });
        (data || []).forEach(event => { (grouped[event.order_id] ||= []).push(event); });
      }
      try { window.localStorage.setItem(cacheKey, JSON.stringify({ saved_at: new Date().toISOString(), orders: rows, events: grouped })); } catch {}
    }
    setOrders(rows); setProducts(productsResult.data || []); setPriceRules(rulesResult.data || []); setEventsByOrder(grouped);
    setLoading(false); setRefreshing(false);
  }
  useEffect(() => { load(); }, [session?.user?.id]);

  const productMap = useMemo(() => Object.fromEntries(products.map(product => [String(product.id), product])), [products]);
  const counts = useMemo(() => ({ all: orders.length, active: orders.filter(order => ACTIVE.has(order.status)).length, action: orders.filter(requiresAction).length, completed: orders.filter(order => COMPLETED.has(order.status)).length, cancelled: orders.filter(order => order.status === 'cancelled').length }), [orders]);
  const visible = useMemo(() => { const needle = query.trim().toLowerCase(); return orders.filter(order => { const queryMatch = !needle || orderSearchText(order).includes(needle); const filterMatch = filter === 'all' || (filter === 'active' && ACTIVE.has(order.status)) || (filter === 'action' && requiresAction(order)) || (filter === 'completed' && COMPLETED.has(order.status)) || (filter === 'cancelled' && order.status === 'cancelled'); return queryMatch && filterMatch; }); }, [orders, query, filter]);
  const attentionOrders = useMemo(() => visible.filter(requiresAction), [visible]);
  const activeOrders = useMemo(() => visible.filter(order => ACTIVE.has(order.status) && !requiresAction(order)), [visible]);
  const historyOrders = useMemo(() => visible.filter(order => COMPLETED.has(order.status) || order.status === 'cancelled'), [visible]);
  const historyGroups = useMemo(() => { const groups = []; historyOrders.forEach(order => { const bucket = historyBucket(order.created_at, lang); let group = groups.find(x => x.key === bucket.key); if (!group) { group = { ...bucket, rows: [] }; groups.push(group); } group.rows.push(order); }); return groups; }, [historyOrders, lang]);

  function reorderAnalysis(order) {
    const analysis = { available: [], unavailable: 0, changed: 0 };
    (order.order_items || []).forEach(item => {
      const product = productMap[String(item.product_id)];
      const canUse = product && product.visibility === 'public' && product.is_active !== false && (product.stock_mode !== 'tracked' || Number(product.stock_quantity || 0) >= Number(item.quantity || 1));
      if (!canUse) { analysis.unavailable += 1; return; }
      const currentPrice = Number(resolveProductPrice(product, priceRules).effective || 0);
      if (!product.price_on_request && Math.abs(currentPrice - Number(item.unit_price || 0)) > 0.009) analysis.changed += 1;
      analysis.available.push({ item, product });
    });
    return analysis;
  }

  function repeatOrder(order, openCart = false) {
    const analysis = reorderAnalysis(order);
    if (!analysis.available.length) return setToast(ar ? 'عناصر هذا الطلب غير متاحة حاليًا. افتح المتجر لاختيار بدائل.' : 'Items from this order are not currently available. Open the store for alternatives.');
    analysis.available.forEach(({ item, product }) => cart.add(product, Number(item.quantity || 1), { unit_price_snapshot: resolveProductPrice(product, priceRules).effective }));
    const parts = [];
    if (analysis.unavailable) parts.push(ar ? `${analysis.unavailable} غير متاح` : `${analysis.unavailable} unavailable`);
    if (analysis.changed) parts.push(ar ? `${analysis.changed} بسعر محدث` : `${analysis.changed} with updated pricing`);
    setToast(parts.length ? (ar ? `أضفنا ${analysis.available.length} للسلة؛ ${parts.join('، ')}.` : `Added ${analysis.available.length} to cart; ${parts.join(', ')}.`) : (ar ? 'أضفنا الطلب للسلة بالسعر والتوفر الحاليين.' : 'The order was added using current price and availability.'));
    if (openCart) window.setTimeout(() => navigate('/account/cart'), 150);
  }

  const filters = [['all', ar ? 'الكل' : 'All'], ['active', ar ? 'نشطة' : 'Active'], ['action', ar ? 'تحتاج إجراء' : 'Needs action'], ['completed', ar ? 'مكتملة' : 'Completed'], ['cancelled', ar ? 'ملغاة' : 'Cancelled']];

  return <AccountChrome lang={lang} session={session} onSignOut={onSignOut} active="orders"><main className="individual-main individual-orders-main"><div className="individual-shell">
    <section className="individual-orders-hero"><div><Link to="/account" className="individual-back-link"><Arrow size={15}/>{ar ? 'مساحتي' : 'My Balqees'}</Link><span className="individual-overline"><PackageSearch size={14}/>{ar ? 'مركز المتابعة الشخصي' : 'PERSONAL ORDER CENTER'}</span><h1>{ar ? 'طلباتي' : 'My orders'}</h1><p>{ar ? 'شوف وش يحدث الآن، وش المطلوب منك، وآخر تحديث والخطوة التالية لكل طلب.' : 'See what is happening now, what needs you, the latest update and the next step for every order.'}</p></div><div className="individual-orders-hero-actions"><button type="button" className="individual-refresh" onClick={() => load(true)} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={17}/><span>{ar ? 'تحديث' : 'Refresh'}</span></button><Link to="/store" className="individual-order-new"><ShoppingBag size={17}/>{ar ? 'طلب جديد' : 'New order'}</Link></div></section>
    {error && <div className="individual-system-note error"><CircleAlert size={17}/><span>{error}</span></div>}
    <section className="individual-orders-tools"><label className="individual-orders-search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? 'ابحث برقم الطلب، المنتج، المستلم، العنوان أو الملاحظة…' : 'Search order, product, recipient, address or note…'}/>{query && <button type="button" onClick={() => setQuery('')}><X size={15}/></button>}</label><div className="individual-orders-filters">{filters.map(([key, label]) => <button type="button" key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}><span>{label}</span><b>{counts[key]}</b></button>)}</div></section>

    {loading ? <div className="individual-loading-state"><LoaderCircle className="spin" size={26}/><strong>{ar ? 'نجمع طلباتك…' : 'Loading your orders…'}</strong><span>{ar ? 'نرتب الأهم أولًا ثم باقي الطلبات.' : 'Putting the most important orders first.'}</span></div> : visible.length ? <>
      {attentionOrders.length > 0 && <OrdersSection title={ar ? 'يحتاج إجراء منك' : 'Needs your action'} eyebrow={ar ? 'الأولوية الآن' : 'PRIORITY NOW'} count={attentionOrders.length} tone="attention">{attentionOrders.map(order => <OrderJourneyCard key={order.id} order={order} lang={lang} event={lastRelevantEvent(eventsByOrder, order.id)} onOpen={() => navigate(`/account/orders/${order.id}`)} featured/>)}</OrdersSection>}
      {activeOrders.length > 0 && <OrdersSection title={ar ? 'الطلبات الجارية' : 'Active orders'} eyebrow={ar ? 'ماذا يحدث الآن؟' : 'WHAT IS HAPPENING NOW'} count={activeOrders.length}>{activeOrders.map((order, index) => <OrderJourneyCard key={order.id} order={order} lang={lang} event={lastRelevantEvent(eventsByOrder, order.id)} onOpen={() => navigate(`/account/orders/${order.id}`)} featured={index === 0}/>)}</OrdersSection>}
      {historyGroups.length > 0 && <section className="individual-orders-history-section"><div className="individual-section-heading"><div><span>{ar ? 'السجل' : 'HISTORY'}</span><h2>{ar ? 'الطلبات السابقة' : 'Previous orders'}</h2></div><em>{historyOrders.length}</em></div>{historyGroups.map(group => <div className="individual-history-group" key={group.key}><h3>{group.label}</h3><div className="individual-order-history-list">{group.rows.map(order => <OrderHistoryRow key={order.id} order={order} lang={lang} onOpen={() => navigate(`/account/orders/${order.id}`)} onRepeat={COMPLETED.has(order.status) ? () => repeatOrder(order) : null}/>)}</div></div>)}</section>}
    </> : <OrdersEmpty ar={ar} hasOrders={orders.length > 0} onReset={() => { setQuery(''); setFilter('all'); }}/>} 
  </div></main>{toast && <div className="individual-toast"><Check size={15}/><span>{toast}</span></div>}</AccountChrome>;
}

function OrdersSection({ title, eyebrow, count, tone = '', children }) { return <section className={`individual-orders-section ${tone}`}><div className="individual-section-heading"><div><span>{eyebrow}</span><h2>{title}</h2></div><em>{count}</em></div><div className="individual-orders-stack">{children}</div></section>; }

function OrderJourneyCard({ order, lang, event, onOpen, featured = false }) {
  const ar = lang === 'ar'; const Arrow = ar ? ChevronLeft : ChevronRight; const meta = statusMeta(order, lang); const items = order.order_items || []; const images = items.map(item => item.product_snapshot?.image_url).filter(Boolean).slice(0, 4); const address = addressText(orderAddress(order), ar, true); const reason = requiresAction(order) ? actionReason(order, lang) : null;
  const milestone = order.status === 'cancelled' ? -1 : currentMilestoneIndex(order.status);
  const labels = ar ? ['استلام','مراجعة','اعتماد','تجهيز','تسليم','مكتمل'] : ['Received','Review','Approved','Prep','Delivery','Complete'];
  return <article className={`individual-order-journey-card ${featured ? 'featured' : ''} tone-${meta.tone}`}><button className="individual-order-journey-main" type="button" onClick={onOpen}>
    <div className="individual-order-card-top"><div className="individual-order-identity"><span className="individual-order-status-orb"/><div><small>{ar ? 'طلب' : 'ORDER'}</small><strong>{orderNo(order)}</strong><time>{fmtDate(order.created_at, lang)}</time></div></div>{images.length > 0 && <div className="individual-order-card-images">{images.map((image, index) => <img src={image} alt="" key={`${image}-${index}`}/>)}</div>}<div className="individual-order-card-total"><small>{ar ? 'الإجمالي' : 'TOTAL'}</small><strong>{formatSar(order.total, lang)}</strong></div></div>
    <div className="individual-order-card-facts">{order.customer_label && <span><Sparkles size={13}/>{order.customer_label}</span>}<span><ShoppingBag size={13}/>{ar ? `${items.reduce((sum,item)=>sum+Number(item.quantity||0),0)} قطعة` : `${items.reduce((sum,item)=>sum+Number(item.quantity||0),0)} pcs`}</span>{address && <span><MapPin size={13}/>{address}</span>}</div>
    {reason && <div className="individual-order-inline-action"><AlertTriangle size={15}/><div><strong>{reason.title}</strong><span>{reason.body}</span></div></div>}
    <div className="individual-order-now-grid"><div><small>{ar ? 'ماذا يحدث الآن؟' : 'WHAT IS HAPPENING NOW?'}</small><strong>{meta.title}</strong><p>{event ? (ar ? (event.body_ar || meta.desc) : (event.body_en || event.body_ar || meta.desc)) : meta.desc}</p></div><div><small>{ar ? 'المتوقع بعد ذلك' : 'NEXT'}</small><strong>{meta.next}</strong><p>{ar ? 'سنظهر أي تغيير جديد هنا مباشرة عند تسجيله على الطلب.' : 'Any newly recorded change will appear here immediately.'}</p></div></div>
    {order.status !== 'cancelled' && order.status !== 'delivery_failed_payment' && <div className="individual-order-mini-timeline">{labels.map((label,index) => <span key={label} className={index < milestone ? 'done' : index === milestone ? 'current' : ''}><i>{index < milestone ? <Check size={9}/> : index+1}</i><b>{label}</b></span>)}</div>}
    <footer className="individual-order-journey-footer"><span><Clock3 size={14}/>{ar ? 'آخر تحديث' : 'Last update'}: {fmtRelative(order.last_status_at || event?.created_at || order.updated_at || order.created_at, lang)}</span><b>{reason ? (ar ? 'نفّذ الإجراء' : 'Take action') : order.status === 'completed' ? (ar ? 'تفاصيل وإعادة الطلب' : 'Details & reorder') : (ar ? 'أين طلبي؟' : 'Where is my order?')}<Arrow size={15}/></b></footer>
  </button></article>;
}

function OrderHistoryRow({ order, lang, onOpen, onRepeat }) { const ar = lang === 'ar'; const Arrow = ar ? ChevronLeft : ChevronRight; const first = order.order_items?.[0]; const meta = statusMeta(order, lang); return <article className={`individual-order-history-row tone-${meta.tone}`}><button type="button" className="individual-order-history-open" onClick={onOpen}><div className="individual-order-history-image">{first?.product_snapshot?.image_url ? <img src={first.product_snapshot.image_url} alt=""/> : <PackageCheck size={23}/>}</div><div className="individual-order-history-copy"><small>{orderNo(order)} · {fmtDate(order.created_at, lang)}</small><strong>{order.customer_label || (first ? productName(first.product_snapshot, ar) : (ar ? 'طلب سابق' : 'Previous order'))}</strong><span>{order.customer_label && first ? `${productName(first.product_snapshot, ar)} · ` : ''}{meta.title} · {ar ? `${order.order_items?.length || 0} عنصر` : `${order.order_items?.length || 0} items`}</span></div><b>{formatSar(order.total, lang)}</b><Arrow size={16}/></button>{onRepeat && <button type="button" className="individual-history-repeat" onClick={onRepeat}><RotateCcw size={14}/>{ar ? 'أعد الطلب' : 'Repeat'}</button>}</article>; }
function OrdersEmpty({ ar, hasOrders, onReset }) { return <div className="individual-orders-empty"><div><PackageSearch size={34}/></div><span>{ar ? 'مساحة هادئة للطلبات' : 'YOUR ORDER SPACE'}</span><h3>{hasOrders ? (ar ? 'ما لقينا طلبات تطابق البحث' : 'No orders match your search') : (ar ? 'ما عندك طلبات حتى الآن' : 'No orders yet')}</h3><p>{hasOrders ? (ar ? 'غيّر البحث أو الفلتر وشوف باقي طلباتك.' : 'Change your search or filter to see the rest of your orders.') : (ar ? 'أول طلب لك يبدأ من المتجر، وبعدها تتابع كل خطوة من هنا.' : 'Your first order starts in the store, then every step is tracked here.')}</p>{hasOrders ? <button type="button" onClick={onReset}>{ar ? 'عرض كل الطلبات' : 'Show all orders'}</button> : <div className="individual-empty-choices"><Link to="/store?intent=gift">{ar ? 'هدية' : 'Gift'}</Link><Link to="/store">{ar ? 'للمنزل' : 'Home'}</Link><Link to="/store?intent=occasion">{ar ? 'مناسبة' : 'Occasion'}</Link></div>}</div>; }

export function IndividualOrderDetails({ lang, session, onSignOut, orderId }) {
  const ar = lang === 'ar'; const Arrow = ar ? ArrowLeft : ArrowRight; const navigate = useNavigate(); const location = useLocation(); const cart = useBalqeesCart(session?.user?.id || null);
  const [order, setOrder] = useState(null); const [events, setEvents] = useState([]); const [documents, setDocuments] = useState([]); const [products, setProducts] = useState([]); const [priceRules, setPriceRules] = useState([]); const [addresses, setAddresses] = useState([]); const [recipients, setRecipients] = useState([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(''); const [toast, setToast] = useState(''); const [editMode, setEditMode] = useState(null); const [editValue, setEditValue] = useState(''); const [saving, setSaving] = useState(false); const [documentBusy, setDocumentBusy] = useState(''); const [liveStatus, setLiveStatus] = useState('connecting'); const [problemOpen, setProblemOpen] = useState(false);
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const justCreated = query.get('created') === '1';
  const focusedDocumentId = query.get('document');
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 3800); return () => window.clearTimeout(timer); }, [toast]);

  async function load(silent = false) {
    if (!supabase || !session?.user?.id || !orderId) return;
    silent ? setRefreshing(true) : setLoading(true); setError('');
    const { data: orderData, error: orderError } = await supabase.from('orders').select('*,order_items(*)').eq('id', orderId).eq('user_id', session.user.id).maybeSingle();
    const recoveryKey = `balqees-order-status:${session.user.id}:${orderId}`;
    if (orderError || !orderData) {
      try {
        const cached = JSON.parse(window.localStorage.getItem(recoveryKey) || 'null');
        if (cached?.status) {
          const cachedMeta = statusMeta({ status: cached.status }, lang);
          setError(ar ? `تعذر تحديث الطلب الآن. آخر حالة محفوظة: ${cachedMeta.title} — ${fmtRelative(cached.saved_at, lang)}.` : `Could not refresh this order. Last saved status: ${cachedMeta.title} — ${fmtRelative(cached.saved_at, lang)}.`);
        } else setError(ar ? 'تعذر العثور على هذا الطلب ضمن حسابك.' : 'This order could not be found in your account.');
      } catch { setError(ar ? 'تعذر العثور على هذا الطلب ضمن حسابك.' : 'This order could not be found in your account.'); }
      setOrder(null); setLoading(false); setRefreshing(false); return;
    }
    setOrder(orderData);
    try { window.localStorage.setItem(recoveryKey, JSON.stringify({ status: orderData.status, saved_at: new Date().toISOString() })); } catch {}
    const productIds = [...new Set((orderData.order_items || []).map(item => item.product_id).filter(Boolean))];
    const [eventsResult, documentsResult, productsResult, rulesResult, addressResult, recipientResult] = await Promise.all([
      supabase.from('order_events').select('*').eq('order_id', orderData.id).order('created_at', { ascending: true }),
      supabase.from('customer_documents').select('*').eq('order_id', orderData.id).eq('user_id', session.user.id).eq('is_visible', true).order('created_at', { ascending: false }),
      productIds.length ? supabase.from('products').select('*').in('id', productIds).eq('visibility', 'public').eq('is_active', true) : Promise.resolve({ data: [], error: null }),
      supabase.from('price_rules').select('*').eq('is_active', true),
      supabase.from('customer_addresses').select('*').eq('user_id', session.user.id).eq('is_active', true).order('is_default', { ascending: false }),
      supabase.from('customer_recipients').select('*').eq('user_id', session.user.id).eq('is_active', true).order('is_favorite', { ascending: false }).order('updated_at', { ascending: false }),
    ]);
    setEvents(eventsResult.data || []); setDocuments(documentsResult.data || []); setProducts(productsResult.data || []); setPriceRules(rulesResult.data || []); setAddresses(addressResult.data || []); setRecipients(recipientResult.data || []); setLoading(false); setRefreshing(false);
  }
  useEffect(() => { load(); }, [orderId, session?.user?.id]);
  useEffect(() => {
    if (!supabase || !session?.user?.id || !orderId) return undefined;
    const channel = supabase.channel(`individual-order-center:${orderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_events', filter: `order_id=eq.${orderId}` }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_documents', filter: `order_id=eq.${orderId}` }, () => load(true))
      .subscribe(status => setLiveStatus(status === 'SUBSCRIBED' ? 'live' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'offline' : 'connecting'));
    return () => { supabase.removeChannel(channel); };
  }, [orderId, session?.user?.id]);
  useEffect(() => {
    if (!focusedDocumentId || !documents.some(item => String(item.id) === String(focusedDocumentId))) return;
    const timer = window.setTimeout(() => document.getElementById('individual-order-documents')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180);
    return () => window.clearTimeout(timer);
  }, [focusedDocumentId, documents]);

  const productMap = useMemo(() => Object.fromEntries(products.map(product => [String(product.id), product])), [products]);
  const meta = statusMeta(order, lang); const isEditableStage = EDITABLE_ORDER_STATUSES.has(order?.status); const actionNeeded = order ? requiresAction(order) : false; const detailsConfirmed = events.some(event => event.event_type === 'customer_details_confirmed');
  const reorder = useMemo(() => { const out = { available: [], unavailable: 0, changed: 0 }; (order?.order_items || []).forEach(item => { const product = productMap[String(item.product_id)]; const canUse = product && product.visibility === 'public' && product.is_active !== false && (product.stock_mode !== 'tracked' || Number(product.stock_quantity || 0) >= Number(item.quantity || 1)); if (!canUse) { out.unavailable += 1; return; } const current = Number(resolveProductPrice(product, priceRules).effective || 0); if (!product.price_on_request && Math.abs(current - Number(item.unit_price || 0)) > .009) out.changed += 1; out.available.push({ item, product }); }); return out; }, [order, productMap, priceRules]);

  function openSupport(category = 'order_support', preset = '') { const search = new URLSearchParams({ order: order?.id || '', category, ...(preset ? { message: preset } : {}) }); navigate(`/account/support?${search.toString()}`); }
  function repeatOrder(openCart = false) { if (!reorder.available.length) return setToast(ar ? 'منتجات هذا الطلب غير متاحة حاليًا. شاهد بدائل من المتجر.' : 'Products from this order are not currently available. Browse alternatives in the store.'); reorder.available.forEach(({ item, product }) => cart.add(product, Number(item.quantity || 1), { unit_price_snapshot: resolveProductPrice(product, priceRules).effective })); const parts=[]; if (reorder.unavailable) parts.push(ar ? `${reorder.unavailable} غير متاح` : `${reorder.unavailable} unavailable`); if (reorder.changed) parts.push(ar ? `${reorder.changed} بسعر محدث` : `${reorder.changed} with updated pricing`); setToast(parts.length ? (ar ? `أضفنا ${reorder.available.length} للسلة؛ ${parts.join('، ')}.` : `Added ${reorder.available.length} to cart; ${parts.join(', ')}.`) : (ar ? 'أضفنا عناصر الطلب للسلة للمراجعة.' : 'Order items were added to your cart for review.')); if (openCart) window.setTimeout(() => navigate('/account/cart'), 120); }

  async function saveSafeEdit(action, payload = {}) {
    if (!order) return; setSaving(true);
    const request = action === 'label'
      ? supabase.rpc('customer_set_order_label', { p_order_id: order.id, p_label: payload.text ?? null })
      : supabase.rpc('customer_update_order_safe', { p_order_id: order.id, p_action: action, p_address_id: payload.addressId || null, p_recipient_id: payload.recipientId || null, p_text: payload.text ?? null });
    const { error: rpcError } = await request;
    setSaving(false);
    if (rpcError) { const locked = String(rpcError.message || '').includes('ORDER_LOCKED'); setToast(locked ? (ar ? 'بدأ تنفيذ الطلب، لذلك يحتاج هذا التعديل إلى فريق بلقيس.' : 'Fulfillment has started, so this change needs Balqees support.') : (ar ? 'تعذر حفظ التعديل الآن.' : 'Could not save this change.')); if (locked) openSupport('order_change', ar ? 'أحتاج تعديلًا بعد بدء التنفيذ.' : 'I need a change after fulfillment started.'); return; }
    setEditMode(null); setEditValue(''); setToast(ar ? 'تم تحديث الطلب وتسجيل التغيير.' : 'The order was updated and the change was recorded.'); await load(true);
  }

  async function addOrderToFavorites() {
    if (!reorder.available.length) return setToast(ar ? 'لا توجد منتجات متاحة لإضافتها للمفضلة.' : 'No available products can be added to favorites.');
    const results = await Promise.all(reorder.available.map(({ product }) => saveFavorite({
      userId: session.user.id,
      product,
      unitPrice: resolveProductPrice(product, priceRules).effective,
    })));
    const failed = results.filter(result => result.error).length;
    setToast(failed ? (ar ? 'تعذر حفظ بعض المنتجات في المفضلة.' : 'Some products could not be saved to favorites.') : (ar ? 'حفظنا المنتجات المتاحة في المفضلة.' : 'Available products were saved to favorites.'));
  }

  async function openOfficialDocument(document, download = false) {
    if (!document?.file_path) return;
    const busyKey = `${document.id}:${download ? 'download' : 'view'}`;
    setDocumentBusy(busyKey);
    const { data, error: signedError } = await supabase.storage.from('customer-documents').createSignedUrl(document.file_path, 120, download ? { download: true } : undefined);
    setDocumentBusy('');
    if (signedError || !data?.signedUrl) return setToast(ar ? 'تعذر فتح المستند الآن. حاول مرة أخرى.' : 'Could not open the document. Please try again.');
    if (download) await supabase.from('customer_document_delivery_events').insert({ document_id: document.id, channel: 'download', created_by: session.user.id });
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function sharePayerConfirmation() {
    if (!order?.cod_confirmation_token) return;
    const url = `${window.location.origin}/cod/confirm/${order.cod_confirmation_token}`;
    try {
      if (navigator.share) await navigator.share({ title: ar ? 'تأكيد مسؤولية سداد طلب بلقيس' : 'Balqees payment responsibility confirmation', url });
      else { await navigator.clipboard.writeText(url); setToast(ar ? 'تم نسخ رابط تأكيد السداد.' : 'Payment confirmation link copied.'); }
    } catch { /* sharing was cancelled */ }
  }

  function printOrderSummary() {
    window.print();
  }

  return <AccountChrome lang={lang} session={session} onSignOut={onSignOut} active="orders"><main className="individual-main individual-order-detail-main"><div className="individual-shell">
    <section className="individual-order-detail-heading"><div><button type="button" className="individual-back-link" onClick={() => navigate('/account/orders')}><Arrow size={15}/>{ar ? 'طلباتي' : 'My orders'}</button><span className="individual-overline"><PackageCheck size={14}/>{ar ? 'تفاصيل الطلب' : 'ORDER DETAILS'}</span><h1>{order ? (order.customer_label || orderNo(order)) : (ar ? 'تفاصيل الطلب' : 'Order details')}</h1>{order && <p>{order.customer_label ? `${orderNo(order)} · ` : ''}{ar ? 'الحالة الآن، الخطوة التالية، المنتجات، التسليم وكل تحديث مسجل.' : 'Current status, next step, products, delivery and every recorded update.'}</p>}</div>{order && <button type="button" className="individual-refresh" onClick={() => load(true)} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={17}/><span>{ar ? 'تحديث' : 'Refresh'}</span></button>}</section>
    {error && <div className="individual-system-note error"><CircleAlert size={17}/><span>{error}</span></div>}
    {loading ? <div className="individual-loading-state"><LoaderCircle className="spin" size={26}/><strong>{ar ? 'نفتح مركز طلبك…' : 'Opening your order center…'}</strong><span>{ar ? 'نجمع الحالة والمستندات والتحديثات المباشرة.' : 'Loading status, documents and live updates.'}</span></div> : order ? <>
      {justCreated && <OrderReceivedHero order={order} lang={lang} liveStatus={liveStatus}/>}
      <div className={`individual-order-sticky-summary tone-${meta.tone}`}><div><span className="individual-order-status-orb"/><strong>{orderReference(order)}</strong><em>{meta.title}</em></div><div className={`individual-live-pill ${liveStatus}`}><Wifi size={13}/><span>{liveStatus === 'live' ? (ar ? 'تحديث مباشر' : 'Live updates') : liveStatus === 'offline' ? (ar ? 'تحديث يدوي' : 'Manual refresh') : (ar ? 'جارٍ الاتصال' : 'Connecting')}</span></div><b>{formatSar(order.total, lang)}</b></div>
      {actionNeeded && <OrderActionBanner order={order} lang={lang} onAction={() => actionReason(order, lang)?.action === 'address' ? setEditMode('address') : openSupport('order_action')}/>} 
      <section className="individual-order-status-grid"><article className="individual-order-status-card current"><span><Sparkles size={18}/></span><div><small>{ar ? 'الحالة الآن' : 'STATUS NOW'}</small><h2>{meta.title}</h2><p>{meta.desc}</p><time><Clock3 size={13}/>{fmtDate(order.last_status_at || order.updated_at || order.created_at, lang, true)}</time></div></article><article className="individual-order-status-card next"><span><Truck size={18}/></span><div><small>{ar ? 'ما التالي؟' : 'WHAT IS NEXT?'}</small><h2>{meta.next}</h2><p>{order.status === 'completed' ? (ar ? 'اكتمل الطلب. يمكنك إعادة المنتجات المتاحة بالسعر الحالي.' : 'The order is complete. Available products can be ordered again at current pricing.') : (ar ? 'هذه هي المرحلة التالية المتوقعة وفق الحالة المسجلة.' : 'This is the next expected stage based on the current status.')}</p></div></article></section>
      <OrderPaymentResponsibility order={order} lang={lang} onShareConfirmation={sharePayerConfirmation}/>
      <OrderTimeline order={order} events={events} lang={lang}/>
      {isEditableStage && !detailsConfirmed && <section className="individual-order-review-card"><ShieldCheck size={21}/><div><small>{ar ? 'راجع قبل التجهيز' : 'REVIEW BEFORE PREPARATION'}</small><strong>{ar ? 'هل المستلم والعنوان والتفاصيل صحيحة؟' : 'Are the recipient, address and details correct?'}</strong><p>{ar ? 'راجعها الآن؛ وبعد بدء التجهيز تتحول التعديلات الحساسة إلى طلب لفريق بلقيس.' : 'Review them now; after preparation begins, sensitive changes become a request to Balqees.'}</p></div><button type="button" disabled={saving} onClick={() => saveSafeEdit('confirm_details')}>{ar ? 'كل شيء صحيح' : 'Everything is correct'}<Check size={15}/></button></section>}
      <div className="individual-order-detail-layout"><div className="individual-order-detail-primary"><OrderDocumentsPanel order={order} documents={documents} lang={lang} focusedDocumentId={focusedDocumentId} busy={documentBusy} onOpen={doc=>openOfficialDocument(doc,false)} onDownload={doc=>openOfficialDocument(doc,true)} onPrintSummary={printOrderSummary}/><OrderItems order={order} lang={lang}/><OrderDelivery order={order} lang={lang}/>{order.is_gift && <OrderGift order={order} lang={lang}/>}<OrderEvents events={events} order={order} lang={lang}/>{order.status === 'completed' && <PostOrderActions lang={lang} reorder={reorder} onRepeat={() => repeatOrder(true)} onFavorite={addOrderToFavorites}/>}</div><aside className="individual-order-detail-aside"><OrderTotals order={order} lang={lang}/><article className="individual-order-aside-card"><small>{ar ? 'الدفع' : 'PAYMENT'}</small><div className="individual-payment-row"><CreditCard size={19}/><div><strong>{order.payment_method === 'cash_on_delivery' ? (ar ? 'الدفع عند الاستلام' : 'Cash on delivery') : (order.payment_method || '—')}</strong><span>{order.payment_status === 'paid' ? (ar ? 'تم تسجيل السداد' : 'Payment recorded') : order.payment_status === 'pending' ? (ar ? 'السداد معلّق حتى الاستلام' : 'Payment pending until delivery') : (order.payment_status || '—')}</span></div></div>{order.payer_name && <p>{ar ? 'المسؤول عن السداد' : 'Payer'}: <b>{order.payer_name}</b></p>}</article>
        <article className="individual-order-aside-card actions"><small>{ar ? 'الإجراء الأهم الآن' : 'NEXT BEST ACTION'}</small>{order.status === 'completed' ? <button type="button" className="primary" onClick={() => repeatOrder(true)}><RotateCcw size={16}/>{ar ? 'اطلبه مرة أخرى' : 'Order again'}</button> : actionNeeded ? <button type="button" className="primary" onClick={() => actionReason(order,lang)?.action === 'address' ? setEditMode('address') : openSupport('order_action')}><AlertTriangle size={16}/>{actionReason(order,lang)?.title}</button> : <button type="button" className="primary" onClick={() => document.querySelector('.individual-detail-timeline')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><PackageSearch size={16}/>{ar ? 'أين طلبي؟' : 'Where is my order?'}</button>}
          <button type="button" onClick={() => { setEditValue(order.customer_label || ''); setEditMode('label'); }}><PencilLine size={16}/>{ar ? 'اسم مخصص للطلب' : 'Order label'}</button>
          {isEditableStage && <><button type="button" onClick={() => setEditMode('address')}><MapPin size={16}/>{ar ? 'تعديل العنوان' : 'Change address'}</button><button type="button" onClick={() => setEditMode('recipient')}><UserRound size={16}/>{ar ? 'تعديل المستلم' : 'Change recipient'}</button><button type="button" onClick={() => { setEditValue(order.recipient_snapshot?.phone || ''); setEditMode('recipient_phone'); }}><UserRound size={16}/>{ar ? 'تعديل رقم التواصل' : 'Change contact number'}</button>{order.is_gift && <button type="button" onClick={() => { setEditValue(order.gift_message || ''); setEditMode('gift_message'); }}><PencilLine size={16}/>{ar ? 'تعديل رسالة الإهداء' : 'Edit gift message'}</button>}<button type="button" onClick={() => { setEditValue(order.customer_note || ''); setEditMode('customer_note'); }}><PencilLine size={16}/>{ar ? 'تعديل الملاحظة' : 'Edit order note'}</button><button type="button" onClick={() => openSupport('product_change', ar ? 'أريد طلب تغيير المنتجات في هذا الطلب.' : 'I would like to request a product change for this order.')}><MessageCircle size={16}/>{ar ? 'طلب تغيير المنتجات' : 'Request product change'}</button><button type="button" onClick={() => openSupport('cancel_request', ar ? 'أرغب في طلب إلغاء هذا الطلب قبل بدء التجهيز.' : 'I would like to request cancellation before preparation starts.')}><X size={16}/>{ar ? 'طلب إلغاء' : 'Request cancellation'}</button></>}
          {!isEditableStage && order.status !== 'completed' && <button type="button" onClick={() => openSupport('urgent_change', ar ? 'بدأ تجهيز الطلب ولدي تعديل عاجل.' : 'Fulfillment has started and I have an urgent change.')}><MessageCircle size={16}/>{ar ? 'عندي تعديل عاجل' : 'I have an urgent change'}</button>}
          <button type="button" onClick={() => openSupport('order_support')}><MessageCircle size={16}/>{ar ? 'تواصل بخصوص الطلب' : 'Contact about order'}</button><button type="button" onClick={() => setProblemOpen(true)}><AlertTriangle size={16}/>{ar ? 'عندي مشكلة' : 'I have a problem'}</button><Link to="/store"><Store size={16}/>{ar ? 'تصفح المتجر' : 'Browse store'}</Link>
        </article><article className="individual-order-reassurance"><Check size={17}/><div><strong>{ar ? 'طلبك محفوظ ومتابَع من فريق بلقيس' : 'Your order is saved and followed by Balqees'}</strong><p>{ar ? 'أي تحديث مسجل يظهر هنا ضمن الحالة وسجل الطلب، والمستند الرسمي يظهر تلقائيًا عند نشره.' : 'Every recorded update appears here, and official documents appear automatically when published.'}</p></div></article></aside></div>
      <OrderPrintSummary order={order} lang={lang}/>
    </> : <div className="individual-orders-empty"><div><PackageSearch size={34}/></div><h3>{ar ? 'الطلب غير متاح' : 'Order unavailable'}</h3><p>{ar ? 'قد يكون الرابط غير صحيح أو أن الطلب لا يخص هذا الحساب.' : 'The link may be incorrect or this order does not belong to this account.'}</p><Link to="/account/orders">{ar ? 'العودة إلى طلباتي' : 'Back to my orders'}</Link></div>}
  </div></main>
  {editMode && <EditOrderSheet mode={editMode} lang={lang} addresses={addresses} recipients={recipients} value={editValue} saving={saving} onChange={setEditValue} onClose={() => { setEditMode(null); setEditValue(''); }} onSave={payload => saveSafeEdit(editMode, payload)}/>} 
  {problemOpen && <ProblemSheet lang={lang} onClose={() => setProblemOpen(false)} onChoose={(category,preset) => { setProblemOpen(false); openSupport(category,preset); }}/>} 
  {toast && <div className="individual-toast"><Check size={15}/><span>{toast}</span></div>}
  </AccountChrome>;
}


function orderReference(order) {
  const date = new Date(order?.created_at || Date.now());
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Riyadh' }).format(date);
  return `BLQ-${year}-${String(order?.order_number || '').padStart(5, '0')}`;
}

function payerState(order, lang) {
  const ar = lang === 'ar';
  if (order?.payment_status === 'paid') return { tone: 'success', title: ar ? 'تم تسجيل السداد' : 'Payment recorded', body: ar ? 'اكتملت عملية التحصيل المسجلة لهذا الطلب.' : 'Payment collection has been recorded for this order.' };
  if (order?.payer_type === 'recipient') {
    if (order?.cod_confirmation_status === 'recipient_confirmed') return { tone: 'success', title: ar ? 'المسؤول عن السداد أكد قبوله' : 'Payer responsibility confirmed', body: ar ? 'أكد المستلم مسؤوليته عن سداد قيمة الطلب عند الاستلام.' : 'The recipient confirmed responsibility for payment on delivery.' };
    if (order?.cod_confirmation_status === 'expired') return { tone: 'danger', title: ar ? 'انتهت صلاحية تأكيد السداد' : 'Payment confirmation expired', body: ar ? 'يحتاج الطلب إلى متابعة مع فريق بلقيس قبل بدء التنفيذ.' : 'The order needs Balqees follow-up before fulfillment can start.' };
    return { tone: 'warning', title: ar ? 'بانتظار تأكيد المسؤول عن السداد' : 'Waiting for payer confirmation', body: ar ? 'لن يبدأ تجهيز الطلب حتى يؤكد المستلم مسؤوليته عن السداد.' : 'Preparation will not start until the recipient confirms payment responsibility.' };
  }
  if (order?.cod_review_status === 'pending') return { tone: 'warning', title: ar ? 'الدفع عند الاستلام قيد مراجعة إضافية' : 'Cash on delivery is under review', body: ar ? 'فريق بلقيس يراجع الطلب قبل بدء التجهيز.' : 'Balqees is reviewing the order before preparation starts.' };
  return { tone: 'success', title: ar ? 'أنت المسؤول عن السداد عند الاستلام' : 'You are responsible for payment on delivery', body: ar ? 'سيتم تحصيل قيمة الطلب قبل تسليمه فعليًا.' : 'The order amount will be collected before the order is handed over.' };
}

function OrderReceivedHero({ order, lang, liveStatus }) {
  const ar = lang === 'ar';
  const payment = payerState(order, lang);
  return <section className="individual-order-received-hero">
    <div className="individual-order-received-icon"><CircleCheck size={34}/></div>
    <div className="individual-order-received-copy"><span>{ar ? 'تم استلام طلبك بنجاح' : 'ORDER RECEIVED SUCCESSFULLY'}</span><h2>{orderReference(order)}</h2><p>{payment.title}. {ar ? 'من هنا تتابع كل شيء يخص الطلب بدون ما تضيع بين الصفحات.' : 'This is your single place to follow everything about this order.'}</p></div>
    <div className="individual-order-received-facts"><div><small>{ar ? 'الإجمالي شامل الضريبة' : 'TOTAL incl. VAT'}</small><strong>{formatSar(order.total, lang)}</strong></div><div><small>{ar ? 'طريقة الدفع' : 'PAYMENT'}</small><strong>{order.payment_method === 'cash_on_delivery' ? (ar ? 'الدفع عند الاستلام' : 'Cash on delivery') : (order.payment_method || '—')}</strong></div><div><small>{ar ? 'التحديثات' : 'UPDATES'}</small><strong className={`live-${liveStatus}`}>{liveStatus === 'live' ? (ar ? 'مباشرة الآن' : 'Live now') : (ar ? 'تعمل مع التحديث اليدوي' : 'Manual refresh available')}</strong></div></div>
  </section>;
}

function OrderPaymentResponsibility({ order, lang, onShareConfirmation }) {
  const ar = lang === 'ar';
  const state = payerState(order, lang);
  const payer = order?.payer_type === 'recipient' ? (order.payer_name || recipientName(order, ar)) : (ar ? 'صاحب الحساب' : 'Account owner');
  return <section className={`individual-payment-responsibility ${state.tone}`}>
    <div className="individual-payment-responsibility-icon"><ShieldCheck size={24}/></div>
    <div className="individual-payment-responsibility-copy"><small>{ar ? 'حالة مسؤولية السداد' : 'PAYMENT RESPONSIBILITY'}</small><h2>{state.title}</h2><p>{state.body}</p><span>{ar ? 'المسؤول المسجل' : 'Registered payer'}: <b>{payer}</b></span></div>
    {order?.payer_type === 'recipient' && order?.cod_confirmation_status === 'recipient_confirmation_required' && order?.cod_confirmation_token && <button type="button" onClick={onShareConfirmation}>{ar ? 'مشاركة رابط التأكيد' : 'Share confirmation link'}<ArrowLeft size={15}/></button>}
  </section>;
}

const documentTypeLabels = {
  ar: { invoice_copy: 'فاتورة رسمية', receipt: 'إيصال', credit_note: 'إشعار دائن', debit_note: 'إشعار مدين', other: 'مستند رسمي' },
  en: { invoice_copy: 'Official invoice', receipt: 'Receipt', credit_note: 'Credit note', debit_note: 'Debit note', other: 'Official document' },
};

function OrderDocumentsPanel({ order, documents, lang, focusedDocumentId, busy, onOpen, onDownload, onPrintSummary }) {
  const ar = lang === 'ar';
  return <section className="individual-detail-section individual-order-documents" id="individual-order-documents">
    <div className="individual-detail-section-title individual-order-documents-title"><div><span>{ar ? 'المستندات' : 'DOCUMENTS'}</span><h2>{ar ? 'ملخص الطلب والفاتورة الرسمية' : 'Order summary & official invoice'}</h2></div><Link to={`/account/documents?order=${order.id}`}>{ar ? 'كل مستنداتي' : 'All documents'}<FileText size={14}/></Link></div>
    <div className="individual-order-document-stack">
      <article className="individual-order-summary-document"><div className="individual-document-icon"><FileText size={23}/></div><div className="individual-document-copy"><small>{ar ? 'متاح فور إنشاء الطلب' : 'AVAILABLE NOW'}</small><strong>{ar ? 'ملخص الطلب' : 'Order summary'}</strong><span>{orderReference(order)} · {fmtDate(order.created_at, lang)}</span><em>{ar ? 'ملخص طلب — ليس فاتورة ضريبية' : 'Order summary — not a tax invoice'}</em></div><div className="individual-document-amount"><strong>{formatSar(order.total, lang)}</strong><button type="button" onClick={onPrintSummary}><Printer size={15}/>{ar ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</button></div></article>
      {documents.length ? documents.map(document => <article key={document.id} className={`individual-official-document ${String(document.id) === String(focusedDocumentId) ? 'focused' : ''}`}><div className="individual-document-icon official"><ReceiptText size={23}/></div><div className="individual-document-copy"><small>{ar ? 'صادر من برنامج المحاسبة' : 'EXTERNAL ACCOUNTING DOCUMENT'}</small><strong>{ar ? (document.title_ar || documentTypeLabels.ar[document.document_type]) : (document.title_en || document.title_ar || documentTypeLabels.en[document.document_type])}</strong><span>{document.document_number ? `${ar ? 'رقم' : 'No.'} ${document.document_number} · ` : ''}{fmtDate(document.issue_date || document.created_at, lang)}</span><em><FileCheck2 size={13}/>{ar ? 'الموقع يعرض الملف الأصلي كما رُفع، ولا يعيد إنشاء الفاتورة.' : 'The original uploaded file is shown without regenerating the invoice.'}</em></div><div className="individual-document-amount"><strong>{document.total_amount != null ? formatSar(document.total_amount, lang) : formatSar(order.total, lang)}</strong><div className="individual-document-actions"><button type="button" onClick={() => onOpen(document)} disabled={busy === `${document.id}:view`}>{busy === `${document.id}:view` ? <LoaderCircle className="spin" size={14}/> : <FileText size={14}/>} {ar ? 'عرض' : 'View'}</button><button type="button" onClick={() => onDownload(document)} disabled={busy === `${document.id}:download`}>{busy === `${document.id}:download` ? <LoaderCircle className="spin" size={14}/> : <Download size={14}/>} {ar ? 'تحميل PDF' : 'Download PDF'}</button><button type="button" onClick={() => onOpen(document)}><Printer size={14}/>{ar ? 'طباعة' : 'Print'}</button></div></div></article>) : <article className="individual-document-waiting"><div className="individual-document-icon waiting"><Clock3 size={22}/></div><div><small>{ar ? 'الفاتورة الرسمية' : 'OFFICIAL INVOICE'}</small><strong>{ar ? 'لم تُرفع بعد' : 'Not uploaded yet'}</strong><p>{ar ? 'لا نعرض مستندًا وهميًا. ستظهر الفاتورة هنا تلقائيًا عندما ترفعها بلقيس من برنامج المحاسبة.' : 'No placeholder invoice is generated. The official file will appear here automatically after Balqees uploads it from the accounting system.'}</p></div></article>}
    </div>
  </section>;
}

function OrderPrintSummary({ order, lang }) {
  const ar = lang === 'ar';
  const address = orderAddress(order);
  const recipient = order?.recipient_snapshot || {};
  return <section className="individual-order-print-sheet" dir={ar ? 'rtl' : 'ltr'}>
    <header><BrandMark/><div><small>BALQEES FLORAL</small><h1>{ar ? 'ملخص طلب' : 'Order Summary'}</h1><p>{ar ? 'هذا المستند ملخص للطلب وليس فاتورة ضريبية.' : 'This document is an order summary, not a tax invoice.'}</p></div><strong>{orderReference(order)}</strong></header>
    <div className="individual-print-meta"><div><span>{ar ? 'تاريخ الطلب' : 'Order date'}</span><b>{fmtDate(order.created_at, lang, true)}</b></div><div><span>{ar ? 'طريقة الدفع' : 'Payment method'}</span><b>{order.payment_method === 'cash_on_delivery' ? (ar ? 'الدفع عند الاستلام' : 'Cash on delivery') : (order.payment_method || '—')}</b></div><div><span>{ar ? 'المستلم' : 'Recipient'}</span><b>{recipientName(order, ar)}</b></div><div><span>{ar ? 'العنوان' : 'Address'}</span><b>{addressText(address, ar) || '—'}</b></div></div>
    <table><thead><tr><th>{ar ? 'المنتج' : 'Product'}</th><th>{ar ? 'الكمية' : 'Qty'}</th><th>{ar ? 'سعر الوحدة' : 'Unit'}</th><th>{ar ? 'الإجمالي' : 'Total'}</th></tr></thead><tbody>{(order.order_items || []).map(item => <tr key={item.id}><td>{productName(item.product_snapshot, ar)}</td><td>{Number(item.quantity || 0)}</td><td>{formatSar(item.unit_price, lang)}</td><td>{formatSar(item.line_total, lang)}</td></tr>)}</tbody></table>
    <div className="individual-print-totals"><div><span>{ar ? 'المجموع قبل الخصم' : 'Subtotal'}</span><b>{formatSar(order.subtotal, lang)}</b></div>{Number(order.discount_total || 0) > 0 && <div><span>{ar ? 'الخصم' : 'Discount'}</span><b>- {formatSar(order.discount_total, lang)}</b></div>}<div><span>{ar ? 'ضريبة القيمة المضافة' : 'VAT'}</span><b>{formatSar(order.vat_total, lang)}</b></div><div className="total"><span>{ar ? 'الإجمالي شامل الضريبة' : 'Total incl. VAT'}</span><strong>{formatSar(order.total, lang)}</strong></div></div>
    <footer>{ar ? 'بلقيس الورد للزهور والنباتات · ملخص إلكتروني للطلب' : 'Balqees Floral · Electronic order summary'}</footer>
  </section>;
}

function OrderActionBanner({ order, lang, onAction }) { const ar=lang==='ar'; const reason=actionReason(order,lang); return <section className="individual-order-action-banner"><AlertTriangle size={21}/><div><small>{ar ? 'يحتاج انتباهك' : 'NEEDS YOUR ATTENTION'}</small><strong>{reason?.title}</strong><p>{reason?.body}</p></div><button type="button" onClick={onAction}>{reason?.action === 'address' ? (ar ? 'أكمل العنوان' : 'Complete address') : (ar ? 'حل المشكلة' : 'Resolve issue')}<MessageCircle size={16}/></button></section>; }

function OrderTimeline({ order, events, lang }) { const ar = lang === 'ar'; const current = FLOW.indexOf(order.status); if (order.status === 'cancelled') return <section className="individual-detail-section"><div className="individual-detail-section-title"><span>{ar ? 'رحلة الطلب' : 'ORDER JOURNEY'}</span><h2>{ar ? 'تم إيقاف رحلة هذا الطلب' : 'This order journey was stopped'}</h2></div><div className="individual-cancelled-state"><X size={20}/><div><strong>{ar ? 'الطلب ملغي' : 'Order cancelled'}</strong><p>{ar ? 'لا توجد مراحل تنفيذ إضافية بعد الإلغاء.' : 'There are no further fulfillment stages after cancellation.'}</p></div></div></section>; if (order.status === 'delivery_failed_payment') return <section className="individual-detail-section"><div className="individual-detail-section-title"><span>{ar ? 'رحلة الطلب' : 'ORDER JOURNEY'}</span><h2>{ar ? 'توقفت الرحلة عند التسليم' : 'The journey paused at delivery'}</h2></div><div className="individual-failed-delivery-state"><AlertTriangle size={20}/><div><strong>{ar ? 'يحتاج متابعة قبل الإكمال' : 'Follow-up is required before completion'}</strong><p>{ar ? 'يوجد تعثر مسجل في التسليم أو التحصيل.' : 'A delivery or collection issue was recorded.'}</p></div></div></section>;
  const eventFor = status => events.find(event => event.event_type === status || event.metadata?.status === status || event.metadata?.new_status === status);
  return <section className="individual-detail-section"><div className="individual-detail-section-title"><span>{ar ? 'رحلة الطلب' : 'ORDER JOURNEY'}</span><h2>{ar ? 'من الاستلام إلى الإكمال' : 'From received to completed'}</h2></div><div className="individual-detail-timeline">{FLOW.map((status,index) => { const meta=STATUS[lang][status]; const state=index<current?'done':index===current?'current':'future'; const event=eventFor(status); const time = event?.created_at || (index===0 ? order.created_at : index===current ? (order.last_status_at || order.updated_at) : null); const description = event ? (ar ? (event.body_ar || meta.desc) : (event.body_en || event.body_ar || meta.desc)) : meta.desc; return <div key={status} className={state}><i>{index<current?<Check size={12}/>:index+1}</i><div><strong>{meta.title}</strong>{time && <time>{fmtDate(time,lang,true)}</time>}{index<=current && <span>{description}</span>}</div></div>; })}</div></section>; }

function OrderItems({ order, lang }) { const ar=lang==='ar'; return <section className="individual-detail-section"><div className="individual-detail-section-title"><span>{ar?'عناصر الطلب':'ORDER ITEMS'}</span><h2>{ar?'وش طلبت؟':'What is in this order?'}</h2></div><div className="individual-detail-items">{(order.order_items||[]).map(item=><article key={item.id}><div className="individual-detail-item-image">{item.product_snapshot?.image_url?<img src={item.product_snapshot.image_url} alt=""/>:<ShoppingBag size={25}/>}</div><div className="individual-detail-item-copy"><small>{item.product_snapshot?.sku||'BALQEES'}</small><strong>{productName(item.product_snapshot,ar)}</strong><span>{ar?`الكمية: ${Number(item.quantity||0)}`:`Qty: ${Number(item.quantity||0)}`}</span></div><div className="individual-detail-item-price"><small>{ar?'سعر الوحدة':'UNIT'}</small><span>{formatSar(item.unit_price,lang)}</span>{Number(item.discount_total||0)>0&&<em>{ar?`خصم ${formatSar(item.discount_total,lang)}`:`Discount ${formatSar(item.discount_total,lang)}`}</em>}<strong>{formatSar(item.line_total,lang)}</strong></div></article>)}</div></section>; }
function OrderDelivery({ order, lang }) { const ar=lang==='ar'; const address=orderAddress(order); const recipient=order.recipient_snapshot||{}; return <section className="individual-detail-section"><div className="individual-detail-section-title"><span>{ar?'التسليم':'DELIVERY'}</span><h2>{ar?'المستلم والعنوان':'Recipient and address'}</h2></div><div className="individual-delivery-grid"><article><UserRound size={19}/><div><small>{ar?'المستلم':'RECIPIENT'}</small><strong>{recipientName(order,ar)}</strong>{recipient.phone&&<span>{recipient.phone}</span>}</div></article><article><MapPin size={19}/><div><small>{ar?'عنوان التسليم':'DELIVERY ADDRESS'}</small><strong>{addressText(address,ar)||'—'}</strong>{address?.access_notes&&<span>{address.access_notes}</span>}{address?.maps_url&&<a href={address.maps_url} target="_blank" rel="noreferrer">{ar?'فتح الموقع':'Open map'}</a>}</div></article><article><Clock3 size={19}/><div><small>{ar?'الموعد المطلوب':'REQUESTED DATE'}</small><strong>{fmtDate(order.requested_delivery_date,lang)}</strong>{order.delivery_window&&<span>{order.delivery_window}</span>}</div></article></div>{order.customer_note&&<div className="individual-order-note"><small>{ar?'ملاحظتك على الطلب':'YOUR ORDER NOTE'}</small><p>{order.customer_note}</p></div>}</section>; }
function OrderGift({ order, lang }) { const ar=lang==='ar'; return <section className="individual-detail-section"><div className="individual-detail-section-title"><span>{ar?'الإهداء':'GIFT'}</span><h2>{ar?'تفاصيل الهدية':'Gift details'}</h2></div><article className="individual-gift-card"><Sparkles size={21}/><div><small>{ar?'رسالة الإهداء':'GIFT MESSAGE'}</small><p>{order.gift_message||(ar?'لم تُسجل رسالة إهداء لهذا الطلب.':'No gift message was recorded for this order.')}</p><span>{order.sender_name_visible===false?(ar?'بدون إظهار اسم المرسل':'Sender name hidden'):(ar?'اسم المرسل ظاهر إذا كان مسجلًا':'Sender name is visible if recorded')}</span></div></article></section>; }
function OrderEvents({ events, order, lang }) { const ar=lang==='ar'; const rows=events.length?events:[{id:'created',title_ar:'تم إنشاء الطلب',title_en:'Order created',body_ar:'تم تسجيل الطلب في نظام بلقيس.',body_en:'The order was recorded in Balqees.',created_at:order.created_at}]; return <section className="individual-detail-section"><div className="individual-detail-section-title"><span>{ar?'سجل الطلب':'ORDER ACTIVITY'}</span><h2>{ar?'كل تحديث مسجل':'Recorded updates'}</h2></div><div className="individual-order-events">{rows.map(event=><article key={event.id}><i/><div><strong>{ar?event.title_ar:(event.title_en||event.title_ar)}</strong>{(ar?event.body_ar:(event.body_en||event.body_ar))&&<p>{ar?event.body_ar:(event.body_en||event.body_ar)}</p>}<time>{fmtDate(event.created_at,lang,true)}</time></div></article>)}</div></section>; }
function OrderTotals({ order, lang }) { const ar=lang==='ar'; return <article className="individual-order-totals"><small>{ar?'ملخص السعر':'PRICE SUMMARY'}</small><div><span>{ar?'المنتجات':'Items'}</span><b>{formatSar(order.subtotal,lang)}</b></div>{Number(order.discount_total||0)>0&&<div className="discount"><span>{ar?'الخصم':'Discount'}</span><b>- {formatSar(order.discount_total,lang)}</b></div>}<div><span>{ar?'ضريبة القيمة المضافة':'VAT'}</span><b>{formatSar(order.vat_total,lang)}</b></div><footer><span>{ar?'الإجمالي':'Total'}</span><strong>{formatSar(order.total,lang)}</strong></footer></article>; }

function PostOrderActions({ lang, reorder, onRepeat, onFavorite }) { const ar=lang==='ar'; return <section className="individual-detail-section"><div className="individual-detail-section-title"><span>{ar?'بعد اكتمال الطلب':'AFTER YOUR ORDER'}</span><h2>{ar?'أعجبك هذا الاختيار؟':'Liked this selection?'}</h2></div><div className="individual-post-order-actions"><button type="button" onClick={onRepeat}><RotateCcw size={18}/><strong>{ar?'أعد الطلب':'Order again'}</strong><span>{reorder.unavailable ? (ar?`${reorder.available.length} من ${reorder.available.length+reorder.unavailable} متاح حاليًا`:`${reorder.available.length} of ${reorder.available.length+reorder.unavailable} currently available`) : (ar?'بالسعر والتوفر الحاليين':'Using current price and availability')}</span></button><button type="button" onClick={onFavorite}><Heart size={18}/><strong>{ar?'احفظ المنتجات في المفضلة':'Save products to favorites'}</strong><span>{ar?'للرجوع لها وقت ما يناسبك':'Return to them whenever you like'}</span></button><Link to="/store"><Store size={18}/><strong>{ar?'شاهد خيارات مشابهة':'See similar options'}</strong><span>{ar?'اكتشف بدائل من المتجر':'Discover alternatives in the store'}</span></Link></div></section>; }

function EditOrderSheet({ mode, lang, addresses, recipients, value, saving, onChange, onClose, onSave }) {
  const ar=lang==='ar';
  const title={
    address:ar?'تعديل عنوان التسليم':'Change delivery address',
    recipient:ar?'تعديل المستلم':'Change recipient',
    recipient_phone:ar?'تعديل رقم التواصل':'Change contact number',
    gift_message:ar?'تعديل رسالة الإهداء':'Edit gift message',
    customer_note:ar?'تعديل ملاحظة الطلب':'Edit order note',
    label:ar?'اسم مخصص للطلب':'Order label',
  }[mode];
  const textMode=['recipient_phone','gift_message','customer_note','label'].includes(mode);
  const multiLine=['gift_message','customer_note'].includes(mode);
  const placeholder={
    recipient_phone:ar?'مثال: 05xxxxxxxx':'Example: 05xxxxxxxx',
    gift_message:ar?'اكتب الرسالة كما تريد أن تظهر…':'Write the message as you want it to appear…',
    customer_note:ar?'ملاحظة تساعد فريق بلقيس في تنفيذ الطلب…':'A note that helps Balqees fulfill the order…',
    label:ar?'مثال: هدية الوالدة':'Example: Gift for family',
  }[mode];
  return <div className="individual-sheet-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><aside className="individual-sheet"><header><div><small>{mode==='label'?(ar?'اسم شخصي يظهر لك داخل الحساب':'A personal label visible in your account'):(ar?'تعديل مسموح قبل التجهيز':'EDIT BEFORE PREPARATION')}</small><h3>{title}</h3></div><button onClick={onClose}><X size={18}/></button></header><div className="individual-sheet-body">
    {mode==='address'&&<div className="individual-choice-list">{addresses.length?addresses.map(item=><button type="button" key={item.id} onClick={()=>onSave({addressId:item.id})} disabled={saving}><MapPin size={17}/><div><strong>{item.label|| (ar?'عنوان محفوظ':'Saved address')}</strong><span>{addressText(item,ar)}</span></div><ChevronLeft size={16}/></button>):<div className="individual-sheet-empty">{ar?'ما عندك عناوين محفوظة بعد. أكمل التعديل عبر فريق بلقيس.':'You do not have saved addresses yet. Continue through Balqees support.'}</div>}</div>}
    {mode==='recipient'&&<div className="individual-choice-list">{recipients.length?recipients.map(item=><button type="button" key={item.id} onClick={()=>onSave({recipientId:item.id})} disabled={saving}><UserRound size={17}/><div><strong>{item.label||item.full_name}</strong><span>{item.full_name}{item.phone?` · ${item.phone}`:''}</span></div><ChevronLeft size={16}/></button>):<div className="individual-sheet-empty">{ar?'ما عندك مستلمين محفوظين بعد.':'You do not have saved recipients yet.'}</div>}</div>}
    {textMode&&<><label className="individual-sheet-label">{title}{multiLine?<textarea rows="6" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>:<input value={value} maxLength={mode==='label'?80:30} inputMode={mode==='recipient_phone'?'tel':undefined} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>}</label><button className="individual-sheet-save" type="button" onClick={()=>onSave({text:value})} disabled={saving}>{saving?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>} {ar?'حفظ التعديل':'Save change'}</button></>}
  </div></aside></div>;
}
function ProblemSheet({ lang, onClose, onChoose }) { const ar=lang==='ar'; const options=[[ar?'لم يصل الطلب':'Order did not arrive','delivery_not_received'],[ar?'العنوان غير صحيح':'Address is incorrect','address_problem'],[ar?'أريد تعديل الطلب':'I need to change the order','order_change'],[ar?'أريد إلغاء الطلب':'I want to cancel the order','cancel_request'],[ar?'المنتج مختلف':'Product is different','product_issue'],[ar?'مشكلة أخرى':'Another issue','other_issue']]; return <div className="individual-sheet-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><aside className="individual-sheet"><header><div><small>{ar?'مركز العناية':'BALQEES CARE'}</small><h3>{ar?'وش المشكلة؟':'What is the issue?'}</h3></div><button onClick={onClose}><X size={18}/></button></header><div className="individual-choice-list problem">{options.map(([label,key])=><button type="button" key={key} onClick={()=>onChoose(key,label)}><AlertTriangle size={17}/><div><strong>{label}</strong><span>{ar?'سنرسل رقم الطلب وحالته تلقائيًا لفريق بلقيس.':'Order number and status will be attached automatically.'}</span></div><ChevronLeft size={16}/></button>)}</div></aside></div>; }
