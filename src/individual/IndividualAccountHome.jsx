import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Bell, CalendarDays, Check, ChevronLeft, ChevronRight,
  CircleAlert, Clock3, Flower2, Gift, Heart, Home, LoaderCircle, LogOut, MapPin,
  PackageCheck, PackageSearch, RefreshCw, RotateCcw, ShoppingBag, Sparkles, Store,
  Trees, UserRound,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { formatSar, resolveProductPrice } from '../lib/storePricing';
import { useSystemSettings } from '../lib/systemSettings';
import { getSaudiSeason } from '../lib/season';
import { notificationAllowed } from '../lib/customerPreferences';
import {
  ACTIVE_ORDER_STATUSES, COMPLETED_ORDER_STATUSES, HOME_MILESTONES, ORDER_STATUS,
  actionReason, addressText, currentMilestoneIndex, fmtDate, occasionLabel, orderNo,
  productName, requiresAction,
} from './individualUtils';
import './individual-account.css';

function greeting(ar) {
  const hour = new Date().getHours();
  if (ar) return hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور';
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

function safeInternalUrl(value, fallback = '/store') {
  if (!value) return fallback;
  if (value.startsWith('/')) return value;
  return fallback;
}

export default function IndividualAccountHome({ lang, session, onSignOut }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const SmallChevron = ar ? ChevronLeft : ChevronRight;
  const cart = useBalqeesCart(session?.user?.id || null);
  const { settings: systemSettings } = useSystemSettings();
  const pricingRulesEnabled = systemSettings?.store?.showPrices !== false;

  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [reads, setReads] = useState(new Set());
  const [products, setProducts] = useState([]);
  const [priceRules, setPriceRules] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [occasions, setOccasions] = useState([]);
  const [offers, setOffers] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [interestEvents, setInterestEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    document.body.classList.add('individual-account-active');
    return () => document.body.classList.remove('individual-account-active');
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!loading && window.location.hash) {
      const id = window.location.hash.slice(1);
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
    }
  }, [loading]);

  async function load(silent = false) {
    if (!supabase || !session?.user?.id) return;
    silent ? setRefreshing(true) : setLoading(true);
    setError('');
    const uid = session.user.id;
    try { await supabase.rpc('customer_sync_occasion_reminders'); } catch { /* best-effort in-account reminders */ }
    const results = await Promise.all([
      supabase.from('customer_profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('orders').select('*,order_items(*)').eq('user_id', uid).order('created_at', { ascending: false }).limit(24),
      supabase.from('notifications').select('*').eq('status', 'published').order('priority', { ascending: false }).order('published_at', { ascending: false, nullsFirst: false }).limit(30),
      supabase.from('notification_reads').select('notification_id').eq('user_id', uid),
      supabase.from('products').select('*').eq('visibility', 'public').eq('is_active', true).order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(40),
      supabase.from('price_rules').select('*').eq('is_active', true),
      supabase.from('customer_addresses').select('*').eq('user_id', uid).eq('is_active', true).order('is_default', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('customer_favorites').select('product_id,created_at,collection_name,note').eq('user_id', uid).order('created_at', { ascending: false }).limit(12),
      supabase.from('customer_occasions').select('*').eq('user_id', uid).eq('is_active', true).order('occasion_date', { ascending: true, nullsFirst: false }).limit(20),
      supabase.from('offers').select('*').eq('is_active', true).order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(10),
      supabase.from('customer_preferences').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('customer_interest_events').select('event_type,product_id,category_id,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(80),
    ]);
    const firstError = results.find(result => result.error)?.error;
    if (firstError) setError(ar ? 'تعذر تحميل جزء من بيانات حسابك. يمكنك التحديث والمحاولة مرة أخرى.' : 'Some account data could not be loaded. Refresh and try again.');
    setProfile(results[0].data || null);
    setOrders(results[1].data || []);
    const nowIso = Date.now();
    const loadedPreferences = results[10].data || null;
    const relevantNotifications = (results[2].data || []).filter(item => {
      const audienceOk = item.audience === 'all' || item.audience === 'individual' || (item.audience === 'user' && item.user_id === uid);
      const notExpired = !item.expires_at || new Date(item.expires_at).getTime() >= nowIso;
      return audienceOk && notExpired && notificationAllowed(item, loadedPreferences);
    });
    setNotifications(relevantNotifications);
    setReads(new Set((results[3].data || []).map(x => x.notification_id)));
    setProducts(results[4].data || []);
    setPriceRules(results[5].data || []);
    setAddresses(results[6].data || []);
    setFavorites(results[7].data || []);
    setOccasions(results[8].data || []);
    setOffers(results[9].data || []);
    setPreferences(loadedPreferences);
    setInterestEvents(results[11].data || []);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, [session?.user?.id]);

  const fullName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || (ar ? 'عميل بلقيس' : 'Balqees client');
  const firstName = fullName.trim().split(/\s+/)[0];
  const activeOrder = useMemo(() => orders.find(order => ACTIVE_ORDER_STATUSES.has(order.status)), [orders]);
  const completedOrders = useMemo(() => orders.filter(order => COMPLETED_ORDER_STATUSES.has(order.status)).slice(0, 4), [orders]);
  const unreadNotifications = useMemo(() => notifications.filter(item => !reads.has(item.id)), [notifications, reads]);
  const latestNotifications = useMemo(() => notifications.slice(0, 3), [notifications]);
  const productMap = useMemo(() => Object.fromEntries(products.map(product => [String(product.id), product])), [products]);
  const favoriteProducts = useMemo(() => favorites.map(item => productMap[String(item.product_id)]).filter(Boolean).slice(0, 4), [favorites, productMap]);
  const defaultAddress = useMemo(() => addresses.find(item => item.id === preferences?.default_address_id) || addresses.find(item => item.is_default) || addresses[0] || null, [addresses, preferences]);
  const upcomingOccasion = useMemo(() => {
    const start = new Date(); start.setHours(0,0,0,0);
    return occasions.filter(item => item.occasion_date && new Date(`${item.occasion_date}T12:00:00`) >= start)[0] || null;
  }, [occasions]);
  const upcomingOccasionReminderDue = useMemo(() => {
    if (!upcomingOccasion?.occasion_date || !Array.isArray(upcomingOccasion.reminder_days) || !upcomingOccasion.reminder_days.length) return false;
    const start = new Date(); start.setHours(0,0,0,0);
    const eventDate = new Date(`${upcomingOccasion.occasion_date}T12:00:00`);
    const days = Math.ceil((eventDate.getTime() - start.getTime()) / 86400000);
    return upcomingOccasion.reminder_days.includes(days);
  }, [upcomingOccasion]);

  const liveOffers = useMemo(() => {
    const now = Date.now();
    return offers.filter(item => (!item.starts_at || new Date(item.starts_at).getTime() <= now) && (!item.ends_at || new Date(item.ends_at).getTime() >= now));
  }, [offers]);
  const heroOffer = liveOffers[0] || null;
  const season = getSaudiSeason();

  const recommendationData = useMemo(() => {
    const scores = new Map();
    const add = (id, value) => { if (id) scores.set(String(id), (scores.get(String(id)) || 0) + value); };
    if (preferences?.personalized_recommendations !== false) {
      favorites.forEach(item => add(item.product_id, 9));
      cart.items.forEach(item => add(item.product_id, 8));
      orders.flatMap(order => order.order_items || []).forEach(item => add(item.product_id, 11));
      interestEvents.forEach(event => add(event.product_id, ({ purchase: 11, cart_add: 8, favorite: 9, view: 2 }[event.event_type] || 3)));
    }
    const ranked = [...products].sort((a, b) => (scores.get(String(b.id)) || 0) - (scores.get(String(a.id)) || 0) || Number(b.is_featured) - Number(a.is_featured) || new Date(b.created_at) - new Date(a.created_at));
    const personalized = ranked.filter(item => (scores.get(String(item.id)) || 0) > 0).slice(0, 4);
    return { rows: personalized.length ? personalized : ranked.slice(0, 4), personalized: personalized.length > 0 && preferences?.personalized_recommendations !== false };
  }, [products, favorites, cart.items, orders, interestEvents, preferences]);

  const attention = useMemo(() => {
    const order = orders.find(requiresAction);
    if (order) return { kind: 'order', order, ...actionReason(order, lang) };
    const notification = unreadNotifications.find(item => ['urgent', 'high'].includes(item.priority) || ['warning', 'action', 'support'].includes(item.type));
    if (notification) return { kind: 'notification', notification, title: ar ? notification.title_ar : (notification.title_en || notification.title_ar), body: ar ? notification.body_ar : (notification.body_en || notification.body_ar) };
    return null;
  }, [orders, unreadNotifications, lang, ar]);

  const cartTotal = useMemo(() => cart.items.reduce((sum, line) => {
    const product = productMap[String(line.product_id)];
    if (!product || product.price_on_request || !pricingRulesEnabled) return sum;
    return sum + Number(resolveProductPrice(product, priceRules).effective || 0) * Number(line.quantity || 0);
  }, 0), [cart.items, productMap, priceRules, pricingRulesEnabled]);

  async function markRead(item) {
    if (!item?.id || reads.has(item.id) || !supabase) return;
    const { error: readError } = await supabase.from('notification_reads').upsert({ notification_id: item.id, user_id: session.user.id }, { onConflict: 'notification_id,user_id' });
    if (!readError) setReads(current => new Set([...current, item.id]));
  }

  async function activateNotification(item) {
    await markRead(item);
    if (!item?.action_url) return;
    if (item.action_url.startsWith('/')) navigate(item.action_url);
    else if (/^https?:\/\//i.test(item.action_url)) window.open(item.action_url, '_blank', 'noopener,noreferrer');
  }

  function openCart() { navigate('/account/cart'); }

  function repeatOrder(order) {
    const items = order?.order_items || [];
    let added = 0, missing = 0, changed = 0;
    items.forEach(item => {
      const product = productMap[String(item.product_id)];
      const available = product && product.is_active !== false && product.visibility === 'public' && (product.stock_mode !== 'tracked' || Number(product.stock_quantity || 0) >= Number(item.quantity || 1));
      if (!available) { missing += 1; return; }
      const current = Number(resolveProductPrice(product, priceRules).effective || 0);
      if (!product.price_on_request && Math.abs(current - Number(item.unit_price || 0)) > 0.009) changed += 1;
      cart.add(product, Number(item.quantity || 1), { unit_price_snapshot: resolveProductPrice(product, priceRules).effective });
      added += 1;
    });
    if (!added) return setToast(ar ? 'منتجات هذا الطلب غير متاحة حاليًا في الكتالوج.' : 'Products from this order are not currently available.');
    const bits = [];
    if (missing) bits.push(ar ? `${missing} غير متاح` : `${missing} unavailable`);
    if (changed) bits.push(ar ? `${changed} بسعر محدث` : `${changed} with updated pricing`);
    setToast(bits.length ? (ar ? `أضفنا ${added} للسلة للمراجعة؛ ${bits.join('، ')}.` : `Added ${added} to cart for review; ${bits.join(', ')}.`) : (ar ? 'أضفنا عناصر الطلب للسلة بالسعر والتوفر الحاليين.' : 'The order was added using current price and availability.'));
  }

  function openSupport() { navigate('/account/support'); }
  function scrollToId(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function openFavorites() { navigate('/account/favorites'); }

  const campaignTitle = heroOffer ? (ar ? heroOffer.title_ar : (heroOffer.title_en || heroOffer.title_ar)) : season.key !== 'default' ? (ar ? season.ar : season.en) : (ar ? 'تفاصيل تليق بالمناسبة.' : 'Details made for meaningful moments.');
  const campaignBody = heroOffer ? (ar ? heroOffer.description_ar : (heroOffer.description_en || heroOffer.description_ar)) : (ar ? 'اكتشف باقات وهدايا بلقيس في تجربة هادئة ومختصرة.' : 'Explore Balqees bouquets and gifts in a calm, focused experience.');
  const campaignImage = heroOffer?.image_url || recommendationData.rows[0]?.image_url || null;
  const campaignUrl = safeInternalUrl(heroOffer?.action_url, '/store');

  return <div className="individual-account-app" dir={ar ? 'rtl' : 'ltr'}>
    <header className="individual-topbar">
      <div className="individual-shell individual-topbar-inner">
        <Link to="/" className="individual-brand" aria-label={ar ? 'العودة إلى موقع بلقيس' : 'Back to Balqees website'}><BrandMark/></Link>
        <div className="individual-topbar-center"><span>{ar ? 'مساحتي' : 'MY BALQEES'}</span><small>{ar ? 'حساب فردي' : 'INDIVIDUAL ACCOUNT'}</small></div>
        <div className="individual-top-actions">
          <button type="button" className="individual-icon-button" onClick={() => navigate('/account/notifications')} aria-label={ar ? 'الإشعارات' : 'Notifications'}><Bell size={19}/>{unreadNotifications.length > 0 && <b>{Math.min(unreadNotifications.length, 9)}</b>}</button>
          <button type="button" className="individual-icon-button" onClick={openCart} aria-label={ar ? 'السلة' : 'Cart'}><ShoppingBag size={19}/>{cart.count > 0 && <b>{Math.min(cart.count, 99)}</b>}</button>
          <button type="button" className="individual-profile-chip" onClick={() => navigate('/account/profile')}><span>{fullName.slice(0, 1).toUpperCase()}</span><div><small>{ar ? 'مرحبًا' : 'Welcome'}</small><strong>{firstName}</strong></div></button>
        </div>
      </div>
    </header>

    <main className="individual-main">
      <div className="individual-shell">
        <section className="individual-welcome" id="account-profile-summary"><div><span className="individual-overline"><Sparkles size={14}/>{ar ? 'مساحتك في بلقيس' : 'YOUR BALQEES SPACE'}</span><h1>{greeting(ar)}، {firstName}</h1><p>{attention ? (ar ? 'عندك شيء يحتاج انتباهك أولًا؛ وبعده كل شيء مرتب لطلبك القادم.' : 'Something needs your attention first; everything else is ready for your next order.') : activeOrder ? (ar ? 'كل ما تحتاجه عن طلبك الحالي موجود هنا، مع وصول سريع للمتجر والسلة.' : 'Everything about your current order is here, with quick access to the store and cart.') : (ar ? 'كل شيء جاهز لطلبك القادم. تصفح بهدوء وارجع لما يعجبك وقت ما يناسبك.' : 'Everything is ready for your next order. Browse calmly and return whenever you like.')}</p></div><button className="individual-refresh" type="button" onClick={() => load(true)} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={17}/><span>{ar ? 'تحديث' : 'Refresh'}</span></button></section>
        {error && <div className="individual-system-note error"><CircleAlert size={17}/><span>{error}</span></div>}

        {loading ? <DashboardSkeleton ar={ar}/> : <>
          {attention && <section className="individual-attention"><span className="attention-icon"><CircleAlert size={20}/></span><div><small>{ar ? 'يحتاج انتباهك' : 'NEEDS YOUR ATTENTION'}</small><strong>{attention.title}</strong><p>{attention.body}</p></div><button type="button" onClick={() => attention.kind === 'order' ? navigate(`/account/orders/${attention.order.id}`) : activateNotification(attention.notification)}>{ar ? 'راجع الآن' : 'Review now'}<Arrow size={15}/></button></section>}

          {!preferences?.quiet_mode && preferences?.marketing_in_app !== false && <section className={`individual-campaign ${campaignImage ? 'has-image' : ''}`} style={campaignImage ? { '--campaign-image': `url("${campaignImage}")` } : undefined}><div className="individual-campaign-copy"><span>{heroOffer ? ((ar ? heroOffer.badge_ar : heroOffer.badge_en) || 'BALQEES CAMPAIGN') : (season.key !== 'default' ? 'SEASON AT BALQEES' : 'FROM BALQEES, FOR YOU')}</span><h2>{campaignTitle}</h2><p>{campaignBody}</p><Link to={campaignUrl}>{ar ? 'اكتشف الآن' : 'Explore now'}<Arrow size={16}/></Link></div><div className="individual-campaign-mark"><Sparkles size={25}/><span>BALQEES</span></div></section>}

          <section className="individual-primary-grid" id="account-order-overview"><ActiveOrderCard order={activeOrder} lang={lang}/><CartCard cartCount={cart.count} cartTotal={cartTotal} lang={lang} onOpen={openCart}/></section>

          <section className="individual-quick-section"><div className="individual-section-heading"><div><span>{ar ? 'اختصارات' : 'QUICK ACCESS'}</span><h2>{ar ? 'وش تحتاج الآن؟' : 'What do you need now?'}</h2></div></div><div className="individual-quick-grid">
            <Link to="/store"><span><Store size={20}/></span><div><strong>{ar ? 'طلب جديد' : 'New order'}</strong><small>{ar ? 'ابدأ من المتجر' : 'Start from the store'}</small></div><SmallChevron size={17}/></Link>
            <button type="button" onClick={() => completedOrders[0] ? repeatOrder(completedOrders[0]) : navigate('/account/orders')}><span><RotateCcw size={20}/></span><div><strong>{ar ? 'إعادة طلب سابق' : 'Repeat an order'}</strong><small>{completedOrders[0] ? (ar ? 'آخر طلب مكتمل' : 'Your latest completed order') : (ar ? 'اختر من طلباتك السابقة' : 'Choose from your order history')}</small></div><SmallChevron size={17}/></button>
            <button type="button" onClick={openFavorites}><span><Heart size={20}/></span><div><strong>{ar ? 'المفضلة' : 'Favorites'}</strong><small>{favoriteProducts.length ? (ar ? `${favoriteProducts.length} من آخر ما حفظت` : `${favoriteProducts.length} recent saved items`) : (ar ? 'احفظ ما يعجبك من المتجر' : 'Save what you like in the store')}</small></div><SmallChevron size={17}/></button>
            <button type="button" onClick={openSupport}><span><PackageSearch size={20}/></span><div><strong>{ar ? 'مركز العناية' : 'Balqees Care'}</strong><small>{ar ? 'حل مباشر أو تواصل مع الفريق' : 'Direct solutions or team help'}</small></div><SmallChevron size={17}/></button>
          </div></section>

          {cart.count > 0 && <section className="individual-cart-reminder"><div><span><ShoppingBag size={18}/></span><div><small>{ar ? 'سلتك بانتظارك' : 'YOUR CART IS WAITING'}</small><strong>{ar ? `${cart.count} ${cart.count === 1 ? 'منتج' : 'منتجات'}${cartTotal > 0 ? ` — ${formatSar(cartTotal, lang)}` : ''}` : `${cart.count} item${cart.count === 1 ? '' : 's'}${cartTotal > 0 ? ` — ${formatSar(cartTotal, lang)}` : ''}`}</strong></div></div><button type="button" onClick={openCart}>{ar ? 'إكمال الطلب' : 'Continue'}<Arrow size={15}/></button></section>}

          {!preferences?.quiet_mode && completedOrders.length > 0 && <section className="individual-section" id="account-repeat"><div className="individual-section-heading"><div><span>{ar ? 'أسهل من البداية من الصفر' : 'PICK UP WHERE YOU LEFT OFF'}</span><h2>{ar ? 'اطلب مرة أخرى' : 'Order again'}</h2></div><Link to="/account/orders">{ar ? 'كل الطلبات' : 'All orders'}<Arrow size={15}/></Link></div><div className="individual-repeat-grid">{completedOrders.slice(0,3).map(order => <RepeatOrderCard key={order.id} order={order} lang={lang} onRepeat={() => repeatOrder(order)}/>)}</div></section>}

          {!preferences?.quiet_mode && recommendationData.rows.length > 0 && <section className="individual-section"><div className="individual-section-heading"><div><span>{recommendationData.personalized ? (ar ? 'حسب نشاطك في المتجر' : 'BASED ON YOUR STORE ACTIVITY') : (ar ? 'وصل حديثًا' : 'NEW AT BALQEES')}</span><h2>{recommendationData.personalized ? (ar ? 'مختارات تناسب اهتمامك' : 'Selections that match your interests') : (ar ? 'أحدث مختارات بلقيس' : 'Latest Balqees selections')}</h2></div><Link to="/store">{ar ? 'عرض المتجر' : 'View store'}<Arrow size={15}/></Link></div><div className="individual-product-strip">{recommendationData.rows.map(product => <ProductTile key={product.id} product={product} lang={lang} rules={priceRules} showPrice={pricingRulesEnabled}/>)}</div></section>}

          {!preferences?.quiet_mode && preferences?.marketing_in_app !== false && liveOffers.length > 1 && <section className="individual-section individual-marketing-section"><div className="individual-section-heading"><div><span>{ar ? 'حملات بلقيس' : 'BALQEES CAMPAIGNS'}</span><h2>{ar ? 'عروض نشطة الآن' : 'Active offers'}</h2></div></div><div className="individual-offers-grid">{liveOffers.slice(1,3).map(offer => <Link key={offer.id} to={safeInternalUrl(offer.action_url)} className="individual-offer-card">{offer.image_url && <img src={offer.image_url} alt=""/>}<div><small>{(ar ? offer.badge_ar : offer.badge_en) || 'BALQEES'}</small><strong>{ar ? offer.title_ar : (offer.title_en || offer.title_ar)}</strong><p>{ar ? offer.description_ar : (offer.description_en || offer.description_ar)}</p></div><Arrow size={16}/></Link>)}</div></section>}

          {upcomingOccasion && <section className="individual-occasion-card"><span><CalendarDays size={22}/></span><div><small>{upcomingOccasionReminderDue ? (ar ? 'تذكير مناسبة' : 'OCCASION REMINDER') : (ar ? 'مناسبة محفوظة قريبة' : 'UPCOMING SAVED OCCASION')}</small><strong>{occasionLabel(upcomingOccasion, lang)}</strong><p>{fmtDate(`${upcomingOccasion.occasion_date}T12:00:00`, lang)}{upcomingOccasion.budget ? ` · ${ar ? 'الميزانية' : 'Budget'} ${formatSar(upcomingOccasion.budget, lang)}` : ''}</p></div><Link to="/account/occasions">{ar ? 'استعد الآن' : 'Prepare now'}<Arrow size={15}/></Link></section>}

          {!preferences?.quiet_mode && <section className="individual-section"><div className="individual-section-heading"><div><span>{ar ? 'أكثر من متجر' : 'MORE THAN A STORE'}</span><h2>{ar ? 'وش تقدر بلقيس ترتب لك؟' : 'What can Balqees arrange for you?'}</h2></div><Link to="/services">{ar ? 'كل الخدمات' : 'All services'}<Arrow size={15}/></Link></div><div className="individual-service-grid"><ServiceCard icon={Flower2} title={ar ? 'باقات وهدايا زهرية' : 'Bouquets & floral gifts'} text={ar ? 'اختيارات شخصية للمناسبات والهدايا.' : 'Personal selections for occasions and gifting.'}/><ServiceCard icon={Trees} title={ar ? 'نباتات داخلية' : 'Indoor plants'} text={ar ? 'نباتات مختارة للمنازل والمساحات الراقية.' : 'Curated plants for homes and premium spaces.'}/><ServiceCard to="/account/occasions" icon={Gift} title={ar ? 'هدية مخصصة' : 'Tailored gifting'} text={ar ? 'نساعدك تختار هدية تناسب الشخص والميزانية.' : 'We help match the gift to the person and budget.'}/><ServiceCard icon={Sparkles} title={ar ? 'فازات ومراكن' : 'Vases & planters'} text={ar ? 'قطع مختارة تكمل المشهد.' : 'Selected pieces that complete the scene.'}/></div></section>}

          {favoriteProducts.length > 0 && <section className="individual-section" id="account-favorites"><div className="individual-section-heading"><div><span>{ar ? 'آخر ما حفظت' : 'RECENTLY SAVED'}</span><h2>{ar ? 'المفضلة مؤخرًا' : 'Recent favorites'}</h2></div></div><div className="individual-product-strip">{favoriteProducts.map(product => <FavoriteTile key={product.id} product={product} lang={lang} rules={priceRules} showPrice={pricingRulesEnabled} onAdd={() => { cart.add(product, product.min_order_quantity || 1, { unit_price_snapshot: resolveProductPrice(product, priceRules).effective }); setToast(ar ? 'تمت الإضافة للسلة.' : 'Added to cart.'); }}/>)}</div></section>}

          <section className="individual-address-card"><div><span><MapPin size={20}/></span><div><small>{defaultAddress ? (ar ? 'العنوان الافتراضي' : 'DEFAULT ADDRESS') : (ar ? 'جهّز طلبك القادم' : 'PREPARE YOUR NEXT ORDER')}</small><strong>{defaultAddress ? addressText(defaultAddress, ar, true) : (ar ? 'أضف عنوانك أو مستلميك مرة واحدة' : 'Save an address or recipient once')}</strong><p>{defaultAddress ? (ar ? 'هذا هو العنوان الذي سيظهر أولًا عند تجهيز طلبك القادم.' : 'This address will appear first when preparing your next order.') : (ar ? 'وبعدها تختصر خطوات التوصيل في كل طلب جديد.' : 'Then shorten delivery setup on every future order.')}</p></div></div><Link to="/account/addresses" className="individual-address-card-link">{defaultAddress?.label || (ar ? 'العناوين والمستلمون' : 'Addresses & recipients')}<Arrow size={14}/></Link></section>

          <section className="individual-section" id="account-notifications"><div className="individual-section-heading"><div><span>{ar ? 'آخر النشاط' : 'LATEST ACTIVITY'}</span><h2>{ar ? 'الإشعارات' : 'Notifications'}</h2></div>{unreadNotifications.length > 0 && <em>{ar ? `${unreadNotifications.length} جديد` : `${unreadNotifications.length} new`}</em>}</div>{latestNotifications.length ? <><div className="individual-notifications-list">{latestNotifications.map(item => <button type="button" key={item.id} className={reads.has(item.id) ? 'read' : 'unread'} onClick={() => activateNotification(item)}><span className="notification-dot"/><div><strong>{ar ? item.title_ar : (item.title_en || item.title_ar)}</strong><p>{ar ? item.body_ar : (item.body_en || item.body_ar)}</p><small><Clock3 size={12}/>{fmtDate(item.published_at || item.created_at, lang, true)}</small></div>{!reads.has(item.id) && <em>{ar ? 'جديد' : 'New'}</em>}<SmallChevron size={16}/></button>)}</div>{notifications.length > 3 && <button className="individual-show-more" type="button" onClick={() => navigate('/account/notifications')}>{ar ? 'فتح مركز الإشعارات' : 'Open notification center'}</button>}</> : <div className="individual-empty-inline"><Bell size={21}/><div><strong>{ar ? 'ما عندك إشعارات جديدة' : 'No notifications yet'}</strong><span>{ar ? 'تحديثات الطلبات ورسائل بلقيس ستظهر هنا.' : 'Order updates and Balqees messages will appear here.'}</span></div></div>}</section>

          <section className="individual-account-footer"><div><BrandMark/><p>{ar ? 'مساحتك الشخصية في بلقيس، مصممة لتكون أخف وأسرع في كل طلب.' : 'Your personal Balqees space, designed to make every order lighter and faster.'}</p></div><button type="button" onClick={onSignOut}><LogOut size={16}/>{ar ? 'تسجيل الخروج' : 'Sign out'}</button></section>
        </>}
      </div>
    </main>

    <nav className="individual-mobile-dock" aria-label={ar ? 'تنقل الحساب الفردي' : 'Individual account navigation'}><button className="active" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Home/><span>{ar ? 'الرئيسية' : 'Home'}</span></button><Link to="/account/orders"><PackageSearch/><span>{ar ? 'طلباتي' : 'Orders'}</span></Link><Link to="/store"><Store/><span>{ar ? 'المتجر' : 'Store'}</span></Link><button type="button" onClick={openFavorites}><Heart/><span>{ar ? 'المفضلة' : 'Favorites'}</span></button><button type="button" onClick={() => navigate('/account/profile')}><UserRound/><span>{ar ? 'حسابي' : 'Account'}</span></button></nav>
    {toast && <div className="individual-toast"><Check size={15}/><span>{toast}</span></div>}
  </div>;
}

function ActiveOrderCard({ order, lang }) {
  const ar = lang === 'ar';
  if (!order) return <article className="individual-order-card empty"><div className="individual-card-kicker"><PackageCheck size={18}/><span>{ar ? 'الطلب النشط' : 'ACTIVE ORDER'}</span></div><div className="individual-order-empty-icon"><PackageSearch size={30}/></div><h3>{ar ? 'ما عندك طلبات نشطة حاليًا' : 'No active orders right now'}</h3><p>{ar ? 'إذا احتجت هدية أو باقة، ابدأ من المتجر وسنحتفظ بكل تحديث هنا.' : 'When you need a bouquet or gift, start in the store and every update will stay here.'}</p><Link to="/store">{ar ? 'تصفح المنتجات' : 'Browse products'}</Link></article>;
  const info = ORDER_STATUS[lang]?.[order.status] || { title: order.status, desc: ar ? 'آخر حالة مسجلة لطلبك.' : 'Latest recorded order status.' };
  const currentIndex = currentMilestoneIndex(order.status);
  const images = (order.order_items || []).map(item => item.product_snapshot?.image_url).filter(Boolean).slice(0, 3);
  const labels = ar ? ['تم الاستلام','المراجعة','الاعتماد','التجهيز','التسليم','مكتمل'] : ['Received','Review','Approved','Preparing','Delivery','Complete'];
  return <article className="individual-order-card active"><div className="individual-card-kicker"><PackageCheck size={18}/><span>{ar ? 'طلبك الحالي' : 'YOUR CURRENT ORDER'}</span><em>{info.title}</em></div><div className="individual-order-head"><div><small>{ar ? 'رقم الطلب' : 'ORDER'}</small><strong>{orderNo(order)}</strong><span>{fmtDate(order.created_at, lang)}</span></div>{images.length > 0 && <div className="individual-order-thumbs">{images.map((image, index) => <img key={`${image}-${index}`} src={image} alt=""/>)}</div>}<b>{formatSar(order.total, lang)}</b></div><div className="individual-now-card"><span/><div><small>{ar ? 'ماذا يحدث الآن؟' : 'WHAT IS HAPPENING NOW?'}</small><strong>{info.title}</strong><p>{info.desc}</p></div></div><div className="individual-timeline" aria-label={ar ? 'مراحل الطلب' : 'Order timeline'}>{HOME_MILESTONES.map((step, index) => <div key={step.key} className={`${index < currentIndex ? 'done' : ''} ${index === currentIndex ? 'current' : ''}`}><i>{index < currentIndex ? <Check size={11}/> : index + 1}</i><span>{labels[index]}</span></div>)}</div><div className="individual-order-foot"><span><Clock3 size={14}/>{ar ? 'آخر تحديث' : 'Last update'}: {fmtDate(order.last_status_at || order.updated_at || order.created_at, lang, true)}</span><Link to={`/account/orders/${order.id}`}>{ar ? 'تفاصيل الطلب' : 'Order details'}</Link></div></article>;
}

function CartCard({ cartCount, cartTotal, lang, onOpen }) {
  const ar = lang === 'ar';
  return <article className={`individual-cart-card ${cartCount ? 'has-items' : ''}`}><div className="individual-card-kicker"><ShoppingBag size={18}/><span>{ar ? 'السلة' : 'CART'}</span>{cartCount > 0 && <em>{cartCount}</em>}</div><div className="individual-cart-visual"><ShoppingBag size={30}/><span>{cartCount || 0}</span></div><h3>{cartCount ? (ar ? 'عندك اختيارات محفوظة' : 'You have saved selections') : (ar ? 'سلتك جاهزة لاختيارك' : 'Your cart is ready')}</h3><p>{cartCount ? (cartTotal > 0 ? (ar ? `الإجمالي الحالي ${formatSar(cartTotal, lang)} — راجعه قبل الإرسال.` : `Current total ${formatSar(cartTotal, lang)} — review it before submitting.`) : (ar ? 'راجع المنتجات قبل متابعة الطلب.' : 'Review your items before continuing.')) : (ar ? 'لما تضيف منتجات من المتجر، ستظهر هنا مباشرة.' : 'Products you add from the store will appear here instantly.')}</p><button type="button" onClick={onOpen}>{cartCount ? (ar ? 'راجع السلة' : 'Review cart') : (ar ? 'ابدأ التسوق' : 'Start shopping')}</button></article>;
}

function RepeatOrderCard({ order, lang, onRepeat }) { const ar = lang === 'ar'; const first = order.order_items?.[0]; const count = order.order_items?.length || 0; return <article className="individual-repeat-card"><div className="individual-repeat-visual">{first?.product_snapshot?.image_url ? <img src={first.product_snapshot.image_url} alt=""/> : <ShoppingBag size={24}/>}</div><div><small>{orderNo(order)} · {fmtDate(order.created_at, lang)}</small><strong>{first ? productName(first.product_snapshot, ar) : (ar ? 'طلب سابق' : 'Previous order')}</strong><span>{count > 1 ? (ar ? `+ ${count - 1} عناصر أخرى` : `+ ${count - 1} more items`) : formatSar(order.total, lang)}</span></div><button type="button" onClick={onRepeat}><RotateCcw size={15}/>{ar ? 'أعد الطلب' : 'Repeat'}</button></article>; }
function ProductTile({ product, lang, rules, showPrice }) { const ar = lang === 'ar'; const pricing = resolveProductPrice(product, rules); return <Link to={`/store/${product.slug || product.id}`} className="individual-product-tile"><div>{product.image_url ? <img src={product.image_url} alt={ar ? product.name_ar : (product.name_en || product.name_ar)}/> : <ShoppingBag size={25}/>}</div><small>{product.sku || 'BALQEES'}</small><strong>{ar ? product.name_ar : (product.name_en || product.name_ar)}</strong><span>{product.price_on_request || !showPrice ? (ar ? 'السعر حسب الطلب' : 'Price on request') : formatSar(pricing.effective, lang)}</span></Link>; }
function FavoriteTile({ product, lang, rules, showPrice, onAdd }) { const ar = lang === 'ar'; const pricing = resolveProductPrice(product, rules); return <article className="individual-product-tile individual-favorite-tile"><Link to={`/store/${product.slug || product.id}`}><div>{product.image_url ? <img src={product.image_url} alt=""/> : <Heart size={25}/>}</div><small>{product.sku || 'BALQEES'}</small><strong>{ar ? product.name_ar : (product.name_en || product.name_ar)}</strong><span>{product.price_on_request || !showPrice ? (ar ? 'السعر حسب الطلب' : 'Price on request') : formatSar(pricing.effective, lang)}</span></Link><button type="button" onClick={onAdd}><ShoppingBag size={14}/>{ar ? 'أضف للسلة' : 'Add to cart'}</button></article>; }
function ServiceCard({ icon: Icon, title, text, to = '/services' }) { return <Link to={to} className="individual-service-card"><span><Icon size={21}/></span><strong>{title}</strong><p>{text}</p></Link>; }
function DashboardSkeleton({ ar }) { return <div className="individual-loading-state"><LoaderCircle className="spin" size={26}/><strong>{ar ? 'نجهز مساحتك…' : 'Preparing your space…'}</strong><span>{ar ? 'نجمع طلباتك وسلتك وآخر التحديثات.' : 'Loading your orders, cart and latest updates.'}</span></div>; }
