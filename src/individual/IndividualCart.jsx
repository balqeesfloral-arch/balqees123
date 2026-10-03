import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Bell, Check, ChevronDown,
  CircleAlert, CircleCheck, Heart, Home, LoaderCircle, Minus, PackageOpen, Plus,
  RefreshCw, ShieldCheck, ShoppingBag, Sparkles, Store, Tag, Trash2, UserRound, X,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { formatSar, resolveProductPrice } from '../lib/storePricing';
import { useSystemSettings } from '../lib/systemSettings';
import './individual-account.css';

const ERROR_COPY = {
  EMPTY_CART: ['السلة فارغة.', 'Your cart is empty.'],
  INVALID_COUPON: ['هذا الرمز غير فعال أو انتهت صلاحيته.', 'This code is inactive or has expired.'],
  COUPONS_DISABLED: ['استخدام كوبونات الخصم متوقف حاليًا.', 'Coupons are currently disabled.'],
  COUPON_MIN_ORDER: ['قيمة السلة أقل من الحد الأدنى المطلوب لهذا الكوبون.', 'Your cart is below this coupon’s minimum order.'],
  COUPON_LIMIT_REACHED: ['تم الوصول إلى الحد الإجمالي لاستخدام هذا الكوبون.', 'This coupon has reached its total usage limit.'],
  COUPON_USER_LIMIT_REACHED: ['استخدمت هذا الكوبون الحد المسموح لحسابك.', 'You have reached your usage limit for this coupon.'],
  INSUFFICIENT_STOCK: ['إحدى الكميات أكبر من المتاح حاليًا.', 'One quantity is higher than current stock.'],
  PRODUCT_UNAVAILABLE: ['أحد المنتجات لم يعد متاحًا.', 'A product is no longer available.'],
  STORE_DISABLED: ['المتجر متوقف مؤقتًا.', 'The store is temporarily unavailable.'],
  STORE_MIN_ORDER: ['قيمة السلة أقل من الحد الأدنى للطلب.', 'Your cart is below the store minimum.'],
  MIN_QUANTITY: ['إحدى الكميات أقل من الحد الأدنى للمنتج.', 'One quantity is below the product minimum.'],
  MAX_QUANTITY: ['إحدى الكميات تجاوزت الحد الأعلى للمنتج.', 'One quantity exceeds the product maximum.'],
};

const COMPLEMENT_TERMS = [
  'vase','فازة','فازه','card','بطاقة','بطاقه','wrap','تغليف','pot','أصيص','اصيص','plant','نبات',
  'gift','هدية','هديه','chocolate','شوكولاتة','شوكولاته','accessory','إضافة','اضافة','ribbon','شريط',
];

function niceError(error, ar) {
  const message = String(error?.message || error || '');
  const key = Object.keys(ERROR_COPY).find(code => message.includes(code));
  return key ? ERROR_COPY[key][ar ? 0 : 1] : (ar ? 'تعذر تحديث السلة الآن. حاول مرة أخرى.' : 'We could not refresh the cart right now. Please try again.');
}

function productTitle(product, ar) {
  return ar ? (product?.name_ar || product?.name_en || 'منتج بلقيس') : (product?.name_en || product?.name_ar || 'Balqees product');
}

function unitTitle(product, ar) {
  return ar ? (product?.unit_ar || 'قطعة') : (product?.unit_en || product?.unit_ar || 'piece');
}

function snapshotDifference(item, currentPrice) {
  if (item?.unit_price_snapshot === null || item?.unit_price_snapshot === undefined || currentPrice === null || currentPrice === undefined) return 0;
  return Number((Number(currentPrice) - Number(item.unit_price_snapshot)).toFixed(2));
}

function hasComplementTag(product) {
  const text = `${product?.name_ar || ''} ${product?.name_en || ''} ${(product?.tags || []).join(' ')}`.toLowerCase();
  return COMPLEMENT_TERMS.some(term => text.includes(term.toLowerCase()));
}

function AccountCartChrome({ lang, session, count, children }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.from('customer_profiles').select('full_name').eq('id', session.user.id).maybeSingle().then(({ data }) => setProfile(data || null));
  }, [session?.user?.id]);
  useEffect(() => { document.body.classList.add('individual-account-active'); return () => document.body.classList.remove('individual-account-active'); }, []);
  const fullName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || (ar ? 'عميل بلقيس' : 'Balqees client');
  const firstName = fullName.trim().split(/\s+/)[0];
  return <div className="individual-account-app individual-cart-app" dir={ar ? 'rtl' : 'ltr'}>
    <header className="individual-topbar"><div className="individual-shell individual-topbar-inner">
      <Link to="/" className="individual-brand"><BrandMark/></Link>
      <div className="individual-topbar-center"><span>{ar ? 'السلة' : 'CART'}</span><small>{ar ? 'حساب فردي' : 'INDIVIDUAL ACCOUNT'}</small></div>
      <div className="individual-top-actions">
        <button type="button" className="individual-icon-button" onClick={() => navigate('/account/notifications')} aria-label={ar ? 'الإشعارات' : 'Notifications'}><Bell size={19}/></button>
        <button type="button" className="individual-icon-button active-cart" aria-label={ar ? 'السلة' : 'Cart'}><ShoppingBag size={19}/>{count > 0 && <b>{Math.min(count, 99)}</b>}</button>
        <button type="button" className="individual-profile-chip" onClick={() => navigate('/account/profile')}><span>{fullName.slice(0, 1).toUpperCase()}</span><div><small>{ar ? 'مرحبًا' : 'Welcome'}</small><strong>{firstName}</strong></div></button>
      </div>
    </div></header>
    {children}
    <nav className="individual-mobile-dock"><Link to="/account"><Home/><span>{ar ? 'الرئيسية' : 'Home'}</span></Link><Link to="/account/orders"><PackageOpen/><span>{ar ? 'طلباتي' : 'Orders'}</span></Link><Link to="/store"><Store/><span>{ar ? 'المتجر' : 'Store'}</span></Link><Link to="/account/favorites"><Heart/><span>{ar ? 'المفضلة' : 'Favorites'}</span></Link><Link to="/account/profile"><UserRound/><span>{ar ? 'حسابي' : 'Account'}</span></Link></nav>
  </div>;
}

export default function IndividualCart({ lang, session }) {
  const ar = lang === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const navigate = useNavigate();
  const cart = useBalqeesCart(session?.user?.id || null);
  const { settings: systemSettings } = useSystemSettings();
  const store = systemSettings.store;
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [rules, setRules] = useState([]);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serverError, setServerError] = useState('');
  const [couponOpen, setCouponOpen] = useState(false);
  const [coupon, setCoupon] = useState(() => localStorage.getItem(`balqees-cart-coupon:${session?.user?.id || 'guest'}`) || '');
  const [appliedCoupon, setAppliedCoupon] = useState(() => localStorage.getItem(`balqees-cart-applied-coupon:${session?.user?.id || 'guest'}`) || '');
  const [couponMessage, setCouponMessage] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [toast, setToast] = useState('');

  const cartKey = useMemo(() => cart.items.map(x => `${x.product_id}:${x.quantity}`).join('|'), [cart.items]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function load(silent = false) {
    if (!supabase) return;
    silent ? setRefreshing(true) : setLoading(true);
    setServerError('');
    const ids = cart.items.map(x => x.product_id);
    const [productResult, rulesResult, allResult] = await Promise.all([
      ids.length ? supabase.from('products').select('*').in('id', ids) : Promise.resolve({ data: [], error: null }),
      supabase.from('price_rules').select('*').eq('is_active', true),
      supabase.from('products').select('*').eq('visibility', 'public').eq('is_active', true).order('created_at', { ascending: false }).limit(80),
    ]);
    if (productResult.error || rulesResult.error) setServerError(ar ? 'تعذر التحقق من بعض بيانات السلة الآن.' : 'Some cart data could not be verified right now.');
    setProducts(productResult.data || []);
    setRules(rulesResult.data || []);
    setAllProducts(allResult.data || []);
    setLoading(false); setRefreshing(false);
  }

  useEffect(() => { load(); }, [cartKey]);

  const productMap = useMemo(() => Object.fromEntries(products.map(p => [String(p.id), p])), [products]);
  const quoteItemMap = useMemo(() => Object.fromEntries((quote?.items || []).map(item => [String(item.product_id), item])), [quote]);
  const lines = useMemo(() => cart.items.map(item => ({ ...item, product: productMap[String(item.product_id)] || null })), [cart.items, productMap]);

  const estimatedSubtotal = useMemo(() => lines.reduce((sum, line) => {
    if (!line.product) return sum;
    const pricing = resolveProductPrice(line.product, rules);
    return sum + Number(pricing.effective || 0) * Number(line.quantity || 0);
  }, 0), [lines, rules]);

  const automaticSavings = useMemo(() => lines.reduce((sum, line) => {
    if (!line.product) return sum;
    const pricing = resolveProductPrice(line.product, rules);
    if (!pricing.onSale || pricing.regular === null || pricing.effective === null) return sum;
    return sum + Math.max(0, Number(pricing.regular) - Number(pricing.effective)) * Number(line.quantity || 0);
  }, 0), [lines, rules]);

  async function preview(code = appliedCoupon, { quiet = false } = {}) {
    if (!cart.items.length) { setQuote(null); setServerError(''); return null; }
    if (!quiet) setCouponBusy(true);
    const { data, error } = await supabase.rpc('preview_customer_cart', {
      p_items: cart.items.map(({ product_id, quantity }) => ({ product_id, quantity })),
      p_coupon_code: code?.trim() || null,
    });
    if (error) {
      if (code) {
        let message = niceError(error, ar);
        if (String(error?.message || '').includes('COUPON_MIN_ORDER')) {
          const { data: requirement } = await supabase.rpc('customer_coupon_requirement', { p_code: code.trim(), p_subtotal: estimatedSubtotal });
          const needed = Number(requirement?.needed || 0);
          if (needed > 0) message = ar ? `أضف ${formatSar(needed, lang)} لتفعيل هذا الكوبون.` : `Add ${formatSar(needed, lang)} to activate this coupon.`;
        }
        setCouponMessage(message);
        if (code === appliedCoupon) {
          setAppliedCoupon('');
          localStorage.removeItem(`balqees-cart-applied-coupon:${session.user.id}`);
        }
      } else setServerError(niceError(error, ar));
      setQuote(null);
      if (!quiet) setCouponBusy(false);
      return null;
    }
    setQuote(data || null);
    setServerError('');
    if (code && data?.coupon_applied) setCouponMessage(ar ? `تم تطبيق الخصم — وفرت ${formatSar(data.discount_total, lang)}.` : `Coupon applied — you saved ${formatSar(data.discount_total, lang)}.`);
    if (!quiet) setCouponBusy(false);
    return data;
  }

  useEffect(() => { setQuote(null); }, [cartKey]);

  useEffect(() => {
    if (loading || !cart.items.length) { if (!cart.items.length) setQuote(null); return undefined; }
    const timer = window.setTimeout(async () => {
      const data = await preview(appliedCoupon, { quiet: true });
      if (!data?.items?.length) return;
      data.items.forEach(item => {
        const local = cart.items.find(row => String(row.product_id) === String(item.product_id));
        if (local && (local.unit_price_snapshot === null || local.unit_price_snapshot === undefined)) cart.setPriceSnapshot(item.product_id, Number(item.unit_price));
      });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [loading, cartKey, appliedCoupon]);

  async function applyCoupon() {
    if (!store.allowCoupons) return;
    const code = coupon.trim();
    if (!code) { setCouponMessage(ar ? 'اكتب رمز الخصم أولًا.' : 'Enter a coupon code first.'); return; }
    setCouponMessage('');
    const data = await preview(code);
    if (data?.coupon_applied) {
      setAppliedCoupon(code.toUpperCase());
      localStorage.setItem(`balqees-cart-coupon:${session.user.id}`, code.toUpperCase());
      localStorage.setItem(`balqees-cart-applied-coupon:${session.user.id}`, code.toUpperCase());
    }
  }

  async function removeCoupon() {
    setCoupon(''); setAppliedCoupon(''); setCouponMessage('');
    localStorage.removeItem(`balqees-cart-coupon:${session.user.id}`);
    localStorage.removeItem(`balqees-cart-applied-coupon:${session.user.id}`);
    await preview('', { quiet: true });
  }

  const issues = useMemo(() => {
    const rows = [];
    lines.forEach(line => {
      const product = line.product;
      if (!product) {
        rows.push({ key: `missing-${line.product_id}`, blocking: true, tone: 'danger', title: ar ? 'منتج لم يعد متاحًا' : 'A product is no longer available', body: ar ? 'أزل هذا العنصر من السلة قبل المتابعة.' : 'Remove this item before continuing.', productId: line.product_id });
        return;
      }
      if (product.is_active === false || product.visibility !== 'public') {
        rows.push({ key: `unavailable-${line.product_id}`, blocking: true, tone: 'danger', title: ar ? `${productTitle(product, ar)} لم يعد متاحًا` : `${productTitle(product, ar)} is no longer available`, body: ar ? 'أزل هذا العنصر من السلة قبل المتابعة.' : 'Remove this item before continuing.', productId: line.product_id });
        return;
      }
      const qty = Number(line.quantity || 0);
      const min = Number(product.min_order_quantity || 1);
      const max = product.max_order_quantity ? Number(product.max_order_quantity) : null;
      const stock = product.stock_mode === 'tracked' ? Number(product.stock_quantity || 0) : null;
      if (qty < min) rows.push({ key: `min-${line.product_id}`, blocking: true, tone: 'danger', title: ar ? `${productTitle(product, ar)}: الكمية أقل من الحد الأدنى` : `${productTitle(product, ar)}: quantity below minimum`, body: ar ? `الحد الأدنى ${min} ${unitTitle(product, ar)}.` : `Minimum quantity is ${min} ${unitTitle(product, ar)}.`, productId: line.product_id });
      if (max !== null && qty > max) rows.push({ key: `max-${line.product_id}`, blocking: true, tone: 'danger', title: ar ? `${productTitle(product, ar)}: الكمية تجاوزت الحد الأعلى` : `${productTitle(product, ar)}: quantity above maximum`, body: ar ? `الحد الأعلى ${max} ${unitTitle(product, ar)}.` : `Maximum quantity is ${max} ${unitTitle(product, ar)}.`, productId: line.product_id });
      if (stock !== null && qty > stock) rows.push({ key: `stock-${line.product_id}`, blocking: true, tone: 'danger', title: ar ? `${productTitle(product, ar)}: المتاح حاليًا ${stock} فقط` : `${productTitle(product, ar)}: only ${stock} currently available`, body: ar ? 'عدّل الكمية قبل المتابعة.' : 'Adjust the quantity before continuing.', productId: line.product_id });
      const current = quoteItemMap[String(line.product_id)]?.unit_price ?? resolveProductPrice(product, rules).effective;
      const diff = snapshotDifference(line, current);
      if (Math.abs(diff) >= 0.01) rows.push({ key: `price-${line.product_id}`, blocking: false, tone: 'gold', title: ar ? `تغير سعر ${productTitle(product, ar)}` : `${productTitle(product, ar)} price changed`, body: ar ? `كان ${formatSar(line.unit_price_snapshot, lang)} وأصبح ${formatSar(current, lang)}. السعر الحالي هو الذي سيعتمد.` : `It was ${formatSar(line.unit_price_snapshot, lang)} and is now ${formatSar(current, lang)}. The current price will apply.`, productId: line.product_id, currentPrice: current, priceChange: true });
      if (product.price_on_request) rows.push({ key: `quote-${line.product_id}`, blocking: false, tone: 'info', title: ar ? `${productTitle(product, ar)} يحتاج تسعيرًا` : `${productTitle(product, ar)} requires a quote`, body: ar ? 'لن نضع سعرًا وهميًا؛ فريق بلقيس سيراجع هذا العنصر قبل تأكيد السعر.' : 'No placeholder price will be shown; Balqees will review this item before confirming pricing.', productId: line.product_id, quote: true });
    });
    return rows;
  }, [lines, rules, lang, quoteItemMap]);

  const blockingIssues = issues.filter(issue => issue.blocking);
  const priceIssues = issues.filter(issue => issue.priceChange);
  const hasQuoteItems = lines.some(line => line.product?.price_on_request) || !!quote?.has_quote_items;
  const ready = lines.length > 0 && blockingIssues.length === 0 && !serverError && store.enabled !== false;

  const complements = useMemo(() => {
    const inCart = new Set(cart.items.map(x => String(x.product_id)));
    const cartCategories = new Set(lines.map(x => x.product?.category_id).filter(Boolean));
    const candidates = allProducts.filter(p => !inCart.has(String(p.id)) && hasComplementTag(p));
    return candidates.map(product => {
      let score = product.is_featured ? 2 : 0;
      if (!cartCategories.has(product.category_id)) score += 2;
      if (hasComplementTag(product)) score += 4;
      return { product, score };
    }).sort((a, b) => b.score - a.score || new Date(b.product.created_at) - new Date(a.product.created_at)).slice(0, 3).map(x => x.product);
  }, [allProducts, cart.items, lines]);

  const displaySubtotal = quote?.subtotal ?? estimatedSubtotal;
  const displayDiscount = Number(quote?.discount_total || 0);
  const displayVat = Number(quote?.vat_total || 0);
  const displayTotal = quote?.total ?? estimatedSubtotal;
  const minimumShort = !hasQuoteItems && Number(store.minimumOrder || 0) > 0 ? Math.max(0, Number(store.minimumOrder) - Number((quote?.subtotal ?? estimatedSubtotal) - displayDiscount)) : 0;

  function quantityNote(product) {
    if (!product) return '';
    const parts = [];
    const min = Number(product.min_order_quantity || 1);
    if (min > 1) parts.push(ar ? `الحد الأدنى ${min}` : `Min ${min}`);
    if (product.max_order_quantity) parts.push(ar ? `الحد الأعلى ${Number(product.max_order_quantity)}` : `Max ${Number(product.max_order_quantity)}`);
    if (product.stock_mode === 'tracked') parts.push(ar ? `المتاح ${Number(product.stock_quantity || 0)}` : `Available ${Number(product.stock_quantity || 0)}`);
    return parts.join(' · ');
  }

  function proceed() {
    if (!ready) {
      setToast(ar ? 'حل ملاحظات السلة أولًا قبل الانتقال لإتمام الطلب.' : 'Resolve the cart issues before continuing to checkout.');
      return;
    }
    navigate('/checkout');
  }

  if (loading) return <AccountCartChrome lang={lang} session={session} count={cart.count}><main className="individual-main individual-shell"><div className="individual-loading-state"><LoaderCircle className="spin" size={24}/><strong>{ar ? 'نراجع سلتك…' : 'Reviewing your cart…'}</strong><span>{ar ? 'نتحقق من الأسعار والتوفر والمخزون.' : 'Checking pricing, availability and stock.'}</span></div></main></AccountCartChrome>;

  return <AccountCartChrome lang={lang} session={session} count={cart.count}>
    <main className="individual-main individual-shell individual-cart-main">
      <section className="individual-cart-head">
        <div><span className="individual-overline"><ShoppingBag size={14}/>{ar ? 'SMART CART WORKSPACE' : 'SMART CART WORKSPACE'}</span><h1>{ar ? `سلتك — ${cart.count} ${cart.count === 1 ? 'منتج' : 'منتجات'}` : `Your cart — ${cart.count} item${cart.count === 1 ? '' : 's'}`}</h1><p>{ready ? (hasQuoteItems ? (ar ? 'السلة سليمة. بعض العناصر تحتاج تسعيرًا من فريق بلقيس قبل تأكيد السعر.' : 'Your cart is healthy. Some items need Balqees pricing review before price confirmation.') : (ar ? 'سلتك جاهزة. الخطوة التالية ستكون اختيار المستلم والعنوان والموعد في إتمام الطلب.' : 'Your cart is ready. The next step is recipient, address and delivery details in checkout.')) : (ar ? 'نحتاج تعديل ملاحظة واحدة أو أكثر قبل الانتقال للخطوة التالية.' : 'One or more items need attention before you continue.')}</p></div>
        <div className="individual-cart-head-actions"><button type="button" className="individual-refresh" onClick={() => { load(true); preview(appliedCoupon, { quiet: true }); }} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={16}/>{ar ? 'تحديث' : 'Refresh'}</button><Link to="/store" className="individual-cart-shop-more"><Plus size={16}/>{ar ? 'إضافة منتجات' : 'Add products'}</Link></div>
      </section>

      {cart.syncing && <div className="individual-cart-sync"><LoaderCircle className="spin" size={14}/><span>{ar ? 'نزامن السلة مع حسابك…' : 'Syncing your cart with your account…'}</span></div>}
      {cart.synced && !cart.syncing && <div className="individual-cart-saved"><CircleCheck size={14}/><span>{ar ? 'السلة محفوظة في حسابك وتظهر على أجهزتك.' : 'Your cart is saved to your account and available across devices.'}</span></div>}
      {serverError && <div className="individual-system-note"><CircleAlert size={15}/><span>{serverError}</span></div>}

      {!cart.items.length ? <section className="individual-cart-empty"><div className="individual-cart-empty-mark"><ShoppingBag size={34}/><Sparkles size={15}/></div><span>{ar ? 'سلتك هادئة الآن' : 'YOUR CART IS QUIET'}</span><h2>{ar ? 'ابدأ باختيار شيء يليق بالمناسبة' : 'Start with something that fits the moment'}</h2><p>{ar ? 'أضف ما يعجبك من المتجر، وسنرتب لك هنا السعر والتوفر والخصومات قبل الانتقال لإتمام الطلب.' : 'Add what you like from the store and we will organize price, availability and discounts here before checkout.'}</p><Link to="/store" className="individual-cart-primary"><Store size={17}/>{ar ? 'فتح المتجر' : 'Open store'}<Arrow size={15}/></Link></section> : <>
        {issues.length > 0 && <section className="individual-cart-health"><header><div><span><ShieldCheck size={18}/></span><div><small>{ar ? 'SMART CART HEALTH' : 'SMART CART HEALTH'}</small><h2>{blockingIssues.length ? (ar ? 'في السلة ملاحظات تحتاج إصلاحًا' : 'Your cart needs attention') : (ar ? 'ملاحظات قبل المتابعة' : 'A few notes before you continue')}</h2></div></div><b className={blockingIssues.length ? 'danger' : 'good'}>{blockingIssues.length ? (ar ? `${blockingIssues.length} تحتاج إجراء` : `${blockingIssues.length} action${blockingIssues.length === 1 ? '' : 's'}`) : (ar ? 'لا توجد مشكلة مانعة' : 'No blocking issues')}</b></header><div className="individual-cart-health-list">{issues.map(issue => <article key={issue.key} className={issue.tone}><span>{issue.tone === 'danger' ? <AlertTriangle size={16}/> : issue.quote ? <Tag size={16}/> : <CircleAlert size={16}/>}</span><div><strong>{issue.title}</strong><p>{issue.body}</p></div>{issue.priceChange && <button type="button" onClick={() => { cart.setPriceSnapshot(issue.productId, issue.currentPrice); setToast(ar ? 'تم اعتماد السعر الحالي في السلة.' : 'Current price acknowledged.'); }}><Check size={13}/>{ar ? 'اعتماد الحالي' : 'Acknowledge'}</button>}{issue.blocking && issue.productId && <button type="button" onClick={() => setRemoveTarget(issue.productId)}>{ar ? 'مراجعة العنصر' : 'Review item'}</button>}</article>)}</div></section>}

        <div className="individual-cart-layout">
          <section className="individual-cart-lines-panel">
            <header className="individual-cart-panel-title"><div><small>{ar ? 'اختياراتك' : 'YOUR SELECTION'}</small><h2>{ar ? 'المنتجات في السلة' : 'Cart items'}</h2></div><span>{ar ? 'يُحفظ تلقائيًا' : 'Auto-saved'} <CircleCheck size={13}/></span></header>
            <div className="individual-cart-lines">{lines.map(line => {
              const product = line.product;
              if (!product) return <article className="individual-cart-line unavailable" key={line.product_id}><div className="individual-cart-line-image"><PackageOpen size={22}/></div><div className="individual-cart-line-copy"><small>{ar ? 'غير متاح' : 'UNAVAILABLE'}</small><strong>{ar ? 'منتج لم يعد متاحًا' : 'Product unavailable'}</strong><p>{ar ? 'أزل العنصر من السلة للمتابعة.' : 'Remove this item to continue.'}</p></div><button className="individual-cart-remove" onClick={() => setRemoveTarget(line.product_id)}><Trash2 size={17}/></button></article>;
              const pricing = resolveProductPrice(product, rules);
              const serverPrice = quoteItemMap[String(line.product_id)]?.unit_price ?? pricing.effective;
              const diff = snapshotDifference(line, serverPrice);
              const lineTotal = Number(serverPrice || 0) * Number(line.quantity || 0);
              const atMax = (product.max_order_quantity && Number(line.quantity) >= Number(product.max_order_quantity)) || (product.stock_mode === 'tracked' && Number(line.quantity) >= Number(product.stock_quantity || 0));
              const atMin = Number(line.quantity) <= Number(product.min_order_quantity || 1);
              return <article className="individual-cart-line" key={line.product_id}>
                <Link to={`/store/${product.slug || product.id}`} className="individual-cart-line-image">{product.image_url ? <img src={product.image_url} alt={productTitle(product, ar)}/> : <ShoppingBag size={22}/>} {pricing.onSale && <em>{ar ? 'عرض' : 'SALE'}</em>}</Link>
                <div className="individual-cart-line-copy"><small>{product.sku || 'BALQEES'} · {unitTitle(product, ar)}</small><Link to={`/store/${product.slug || product.id}`}><strong>{productTitle(product, ar)}</strong></Link>{quantityNote(product) && <p>{quantityNote(product)}</p>}{Math.abs(diff) >= .01 && <div className="individual-cart-price-change"><CircleAlert size={12}/><span>{ar ? `السعر تغير من ${formatSar(line.unit_price_snapshot, lang)} إلى ${formatSar(serverPrice, lang)}` : `Price changed from ${formatSar(line.unit_price_snapshot, lang)} to ${formatSar(serverPrice, lang)}`}</span></div>}</div>
                <div className="individual-cart-price-block">{product.price_on_request || store.showPrices === false ? <><strong>{ar ? 'حسب الطلب' : 'On request'}</strong><small>{ar ? 'مراجعة قبل التسعير' : 'Reviewed before pricing'}</small></> : <><strong>{formatSar(serverPrice, lang)}</strong>{pricing.onSale && <del>{formatSar(pricing.regular, lang)}</del>}<small>{ar ? `الإجمالي ${formatSar(lineTotal, lang)}` : `Line total ${formatSar(lineTotal, lang)}`}</small></>}</div>
                <div className="individual-cart-qty"><button type="button" disabled={atMin} onClick={() => cart.update(line.product_id, Number(line.quantity) - 1, product)}><Minus size={14}/></button><span>{Number(line.quantity)}</span><button type="button" disabled={atMax} onClick={() => cart.update(line.product_id, Number(line.quantity) + 1, product)}><Plus size={14}/></button></div>
                <button className="individual-cart-remove" type="button" onClick={() => setRemoveTarget(line.product_id)} aria-label={ar ? 'إزالة المنتج' : 'Remove product'}><Trash2 size={16}/></button>
              </article>;
            })}</div>
          </section>

          <aside className="individual-cart-summary-card">
            <header><small>{ar ? 'ملخص السلة' : 'CART SUMMARY'}</small><h2>{hasQuoteItems ? (ar ? 'سعر مؤكد + عناصر تحتاج مراجعة' : 'Confirmed prices + quote items') : (ar ? 'السعر قبل إتمام الطلب' : 'Price before checkout')}</h2></header>
            {store.showPrices !== false && automaticSavings > 0 && <div className="individual-cart-saving"><Sparkles size={16}/><div><small>{ar ? 'خصومات تلقائية فعالة' : 'AUTOMATIC SAVINGS'}</small><strong>{ar ? `وفرت ${formatSar(automaticSavings, lang)} على الأسعار الأساسية` : `You saved ${formatSar(automaticSavings, lang)} from regular prices`}</strong></div></div>}
            {minimumShort > 0 && <div className="individual-cart-minimum"><CircleAlert size={15}/><span>{ar ? `أضف ${formatSar(minimumShort, lang)} للوصول إلى الحد الأدنى للطلب.` : `Add ${formatSar(minimumShort, lang)} to reach the store minimum.`}</span></div>}

            {store.allowCoupons !== false && <div className={`individual-cart-coupon ${couponOpen ? 'open' : ''}`}><button className="individual-cart-coupon-toggle" type="button" onClick={() => setCouponOpen(v => !v)}><span><Tag size={15}/>{appliedCoupon ? (ar ? `الكوبون ${appliedCoupon} مطبق` : `Coupon ${appliedCoupon} applied`) : (ar ? 'عندك رمز خصم؟' : 'Have a coupon?')}</span><ChevronDown size={15}/></button>{couponOpen && <div className="individual-cart-coupon-body"><div><input value={coupon} onChange={e => { setCoupon(e.target.value); localStorage.setItem(`balqees-cart-coupon:${session.user.id}`, e.target.value); }} placeholder={ar ? 'اكتب رمز الخصم' : 'Enter coupon code'}/><button type="button" onClick={applyCoupon} disabled={couponBusy}>{couponBusy ? <LoaderCircle className="spin" size={14}/> : (ar ? 'تطبيق' : 'Apply')}</button></div>{couponMessage && <p className={quote?.coupon_applied ? 'success' : 'error'}>{couponMessage}</p>}{appliedCoupon && <button className="individual-cart-remove-coupon" type="button" onClick={removeCoupon}>{ar ? 'إزالة الكوبون' : 'Remove coupon'}</button>}</div>}</div>}

            <div className="individual-cart-totals">
              {store.showPrices === false ? <div className="total"><span>{ar ? 'التسعير' : 'Pricing'}</span><strong>{ar ? 'بعد المراجعة' : 'After review'}</strong></div> : <>
                <div><span>{ar ? 'المنتجات' : 'Products'}</span><strong>{formatSar(displaySubtotal, lang)}</strong></div>
                {displayDiscount > 0 && <div className="discount"><span>{ar ? 'الخصم' : 'Discount'}</span><strong>- {formatSar(displayDiscount, lang)}</strong></div>}
                {quote && Number(quote.vat_total || 0) > 0 && <div><span>{ar ? (quote.prices_include_vat ? 'الضريبة ضمن الإجمالي' : 'الضريبة') : (quote.prices_include_vat ? 'VAT included' : 'VAT')}</span><strong>{formatSar(displayVat, lang)}</strong></div>}
                <div className="total"><span>{ar ? 'الإجمالي الحالي' : 'Current total'}</span><strong>{formatSar(displayTotal, lang)}</strong></div>
              </>}
            </div>
            <p className="individual-cart-tax-note">{store.pricesIncludeVat !== false ? (ar ? `الأسعار تشمل ضريبة القيمة المضافة (${Number(store.vatRate ?? 15)}٪) عند انطباقها.` : `Prices include VAT (${Number(store.vatRate ?? 15)}%) where applicable.`) : (ar ? `تضاف ضريبة القيمة المضافة (${Number(store.vatRate ?? 15)}٪) في إتمام الطلب.` : `VAT (${Number(store.vatRate ?? 15)}%) is added at checkout.`)} {hasQuoteItems ? (ar ? 'العناصر «حسب الطلب» لا تدخل في إجمالي نهائي قبل المراجعة.' : 'On-request items are not treated as final-priced until reviewed.') : ''}</p>

            <div className="individual-cart-progress"><span className="active"><i>1</i><b>{ar ? 'السلة' : 'Cart'}</b></span><span><i>2</i><b>{ar ? 'الاستلام' : 'Delivery'}</b></span><span><i>3</i><b>{ar ? 'المراجعة' : 'Review'}</b></span></div>
            <button className="individual-cart-primary wide" type="button" onClick={proceed} disabled={!ready}><span>{hasQuoteItems ? (ar ? 'متابعة لطلب التسعير' : 'Continue to quote checkout') : (ar ? 'متابعة لإتمام الطلب' : 'Continue to checkout')}</span>{blockingIssues.length ? <AlertTriangle size={17}/> : <Arrow size={17}/>}</button>
            {!ready && <small className="individual-cart-block-note">{ar ? 'الزر يتفعّل بعد حل الملاحظات المانعة فقط.' : 'The button activates after blocking issues are resolved.'}</small>}
          </aside>
        </div>

        {complements.length > 0 && <section className="individual-cart-complements"><div className="individual-section-heading"><div><span>{ar ? 'إضافات مرتبطة بالسلة' : 'CART COMPLEMENTS'}</span><h2>{ar ? 'يكمل طلبك بشكل جميل' : 'A few additions that complete the order'}</h2><p>{ar ? 'نعرض إضافات قليلة فقط عندما نجد علاقة واضحة بالطلب الحالي.' : 'We only show a few additions when there is a clear relation to your current cart.'}</p></div></div><div className="individual-cart-complement-grid">{complements.map(product => { const pricing = resolveProductPrice(product, rules); return <article key={product.id}><Link to={`/store/${product.slug || product.id}`}>{product.image_url ? <img src={product.image_url} alt={productTitle(product, ar)}/> : <span><ShoppingBag size={20}/></span>}</Link><div><small>{product.sku || 'BALQEES'}</small><strong>{productTitle(product, ar)}</strong>{product.price_on_request || store.showPrices === false ? <em>{ar ? 'حسب الطلب' : 'On request'}</em> : <em>{formatSar(pricing.effective, lang)}</em>}</div><button type="button" onClick={() => { cart.add(product, product.min_order_quantity || 1, { unit_price_snapshot: pricing.effective }); setToast(ar ? 'تمت الإضافة للسلة بدون مغادرة الصفحة.' : 'Added to cart without leaving the page.'); }}><Plus size={14}/>{ar ? 'إضافة' : 'Add'}</button></article>; })}</div></section>}
      </>}
    </main>

    {!!cart.items.length && <div className="individual-cart-mobile-bar"><div><small>{ar ? 'الإجمالي الحالي' : 'CURRENT TOTAL'}</small><strong>{store.showPrices === false ? (ar ? 'بعد المراجعة' : 'After review') : formatSar(displayTotal, lang)}</strong></div><button type="button" onClick={proceed} disabled={!ready}>{hasQuoteItems ? (ar ? 'متابعة للتسعير' : 'Continue') : (ar ? 'متابعة' : 'Continue')}<Arrow size={15}/></button></div>}

    {removeTarget && <div className="individual-modal-overlay" onMouseDown={e => e.target === e.currentTarget && setRemoveTarget(null)}><div className="individual-cart-confirm"><button className="individual-modal-close" onClick={() => setRemoveTarget(null)}><X size={18}/></button><span><Trash2 size={22}/></span><h3>{ar ? 'إزالة هذا المنتج؟' : 'Remove this product?'}</h3><p>{ar ? 'سيُحذف من السلة المحفوظة في حسابك أيضًا.' : 'It will also be removed from the cart saved to your account.'}</p><div><button type="button" className="ghost" onClick={() => setRemoveTarget(null)}>{ar ? 'إبقاء المنتج' : 'Keep item'}</button><button type="button" className="danger" onClick={() => { cart.remove(removeTarget); setRemoveTarget(null); setToast(ar ? 'تمت إزالة المنتج.' : 'Item removed.'); }}>{ar ? 'إزالة' : 'Remove'}</button></div></div></div>}

    {toast && <div className="individual-toast"><CircleCheck size={15}/><span>{toast}</span></div>}
  </AccountCartChrome>;
}
