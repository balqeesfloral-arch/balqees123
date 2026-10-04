import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign,
  Clock3, Flower2, Gift, Heart, Home, Layers, LoaderCircle, Maximize2, MessageCircleMore,
  Minus, PackageOpen, PackageSearch, Plus, Send, Share2, ShoppingBag, Sparkles, Store,
  UserRound, WandSparkles, X, ZoomIn,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { useSystemSettings } from '../lib/systemSettings';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { removeFavorite, saveFavorite } from '../lib/favorites';
import {
  loadCustomerPreferences, normalizeCustomerPreferences, recordCustomerInterest,
} from '../lib/customerPreferences';
import { formatSar, resolveProductPrice } from '../lib/storePricing';
import {
  SMART_BUDGET_BANDS, SMART_STORE_OCCASIONS, buildTasteProfile, occasionLabel,
  productAvailability, productKind, productMatchesOccasion, productMatchesStyle,
  productSearchText, tasteScore,
} from '../lib/smartStore';
import './individual-account.css';
import './individual-product-details.css';

const COMPARE_KEY = 'balqees-store-compare-v1';
const ORDER_DONE = new Set(['delivered', 'completed']);

function label(product, ar) { return ar ? product?.name_ar : (product?.name_en || product?.name_ar); }
function categoryLabel(category, ar) { return category ? (ar ? category.name_ar : (category.name_en || category.name_ar)) : ''; }
function uniqueRows(rows = []) { return Array.from(new Map(rows.filter(Boolean).map(row => [String(row.id), row])).values()); }
function commonTags(a, b) {
  const aTags = new Set((a?.tags || []).map(x => String(x).toLowerCase()));
  return (b?.tags || []).reduce((n, tag) => n + (aTags.has(String(tag).toLowerCase()) ? 1 : 0), 0);
}
function budgetRange(key) {
  if (!key) return { min: null, max: null };
  const direct = SMART_BUDGET_BANDS.find(item => item.key === key);
  if (direct) return { min: direct.min, max: direct.max };
  if (key === 'under_150') return { min: 0, max: 150 };
  if (key === '150_300') return { min: 150, max: 300 };
  if (key === '300_500') return { min: 300, max: 500 };
  if (key === '500_plus') return { min: 500, max: Infinity };
  return { min: null, max: null };
}
function budgetLabel(key, ar) {
  const direct = SMART_BUDGET_BANDS.find(item => item.key === key);
  if (direct) return ar ? direct.ar : direct.en;
  const labels = {
    under_150: ar ? 'أقل من 150 ر.س' : 'Under SAR 150',
    '150_300': ar ? '150–300 ر.س' : 'SAR 150–300',
    '300_500': ar ? '300–500 ر.س' : 'SAR 300–500',
    '500_plus': ar ? '500 ر.س فأكثر' : 'SAR 500+',
  };
  return labels[key] || key || '';
}
function availabilityCopy(value, ar) {
  if (value === 'ready') return ar ? 'متوفر الآن' : 'Available now';
  if (value === 'made_to_order') return ar ? 'يُجهّز حسب الطلب' : 'Made to order';
  if (value === 'unavailable') return ar ? 'غير متوفر حاليًا' : 'Currently unavailable';
  return ar ? 'متاح للطلب' : 'Available to order';
}
function productTypeCopy(kind, ar) {
  if (kind === 'bouquet') return ar ? 'باقة' : 'Bouquet';
  if (kind === 'gift') return ar ? 'هدية' : 'Gift';
  if (kind === 'combo') return ar ? 'باقة + هدية' : 'Bouquet + gift';
  return ar ? 'منتج' : 'Product';
}
function fmtRemaining(value, lang) { return formatSar(Math.max(0, Number(value || 0)), lang); }

function ProductChrome({ lang, session, cart, children }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    if (!session?.user?.id) return undefined;
    let live = true;
    supabase.from('customer_profiles').select('full_name').eq('id', session.user.id).maybeSingle().then(({ data }) => live && setProfile(data || null));
    return () => { live = false; };
  }, [session?.user?.id]);
  const fullName = profile?.full_name || session?.user?.email?.split('@')[0] || (ar ? 'عميل بلقيس' : 'Balqees client');
  const firstName = fullName.trim().split(/\s+/)[0];
  return <div className="individual-account-app product-detail-account" dir={ar ? 'rtl' : 'ltr'}>
    <header className="individual-topbar"><div className="individual-shell individual-topbar-inner">
      <Link to="/" className="individual-brand"><BrandMark/></Link>
      <div className="individual-topbar-center"><span>{ar ? 'تفاصيل المنتج' : 'PRODUCT DETAILS'}</span><small>{ar ? 'المتجر الذكي' : 'SMART STORE'}</small></div>
      <div className="individual-top-actions">
        <button type="button" className="individual-icon-button" onClick={() => navigate('/account/notifications')} aria-label={ar ? 'الإشعارات' : 'Notifications'}><Bell size={19}/></button>
        <button type="button" className="individual-icon-button" onClick={() => navigate('/account/cart')} aria-label={ar ? 'السلة' : 'Cart'}><ShoppingBag size={19}/>{cart.count > 0 && <b>{Math.min(cart.count, 99)}</b>}</button>
        <button type="button" className="individual-profile-chip" onClick={() => navigate('/account/profile')}><span>{fullName.slice(0, 1).toUpperCase()}</span><div><small>{ar ? 'مرحبًا' : 'Welcome'}</small><strong>{firstName}</strong></div></button>
      </div>
    </div></header>
    {children}
    <nav className="individual-mobile-dock"><Link to="/account"><Home/><span>{ar ? 'الرئيسية' : 'Home'}</span></Link><Link to="/account/orders"><PackageSearch/><span>{ar ? 'طلباتي' : 'Orders'}</span></Link><Link className="active" to="/store"><Store/><span>{ar ? 'المتجر' : 'Store'}</span></Link><Link to="/account/favorites"><Heart/><span>{ar ? 'المفضلة' : 'Favorites'}</span></Link><Link to="/account/profile"><UserRound/><span>{ar ? 'حسابي' : 'Account'}</span></Link></nav>
  </div>;
}

function SmallProductCard({ product, category, rules, lang, onOpen }) {
  const ar = lang === 'ar';
  const price = resolveProductPrice(product, rules);
  const availability = productAvailability(product);
  return <button type="button" className="product-detail-small-card" onClick={() => onOpen(product)}>
    <span className="product-detail-small-image">{product.image_url ? <img src={product.image_url} alt={label(product, ar)}/> : <Flower2 size={28}/>}</span>
    <span className="product-detail-small-copy"><small>{categoryLabel(category, ar) || product.sku || 'BALQEES'}</small><strong>{label(product, ar)}</strong><em>{availabilityCopy(availability, ar)}</em><b>{product.price_on_request ? (ar ? 'السعر حسب الطلب' : 'Price on request') : formatSar(price.effective, lang)}</b></span>
    <ChevronLeft className={ar ? '' : 'ltr-chevron'} size={17}/>
  </button>;
}

function DetailAccordion({ title, children, open, onToggle }) {
  return <section className={`product-detail-accordion ${open ? 'open' : ''}`}><button type="button" onClick={onToggle}><strong>{title}</strong><ChevronDown size={18}/></button>{open && <div>{children}</div>}</section>;
}

export default function IndividualProductDetails({ lang, session }) {
  const { settings: systemSettings, error: settingsError } = useSystemSettings();
  const ar = lang === 'ar';
  const Back = ar ? ArrowRight : ArrowLeft;
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();
  const uid = session?.user?.id;
  const cart = useBalqeesCart(uid || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [product, setProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [preferences, setPreferences] = useState(normalizeCustomerPreferences());
  const [favorites, setFavorites] = useState([]);
  const [interests, setInterests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeImage, setActiveImage] = useState('');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [gift, setGift] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [compareAdded, setCompareAdded] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMode, setAssistantMode] = useState('');
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [accordions, setAccordions] = useState({ details: true, preparation: false, purchase: false });
  const touchStart = useRef(null);

  useEffect(() => {
    document.body.classList.add('individual-account-active', 'individual-product-detail-active');
    return () => document.body.classList.remove('individual-account-active', 'individual-product-detail-active');
  }, []);
  useEffect(() => { if (!toast) return undefined; const timer = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer); }, [toast]);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true); setError('');
      const [productsResult, categoryResult, rulesResult, prefResult, favoriteResult, interestResult, orderResult] = await Promise.all([
        supabase.from('products').select('*').eq('visibility', 'public').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('product_categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('price_rules').select('*').eq('is_active', true),
        loadCustomerPreferences(uid),
        supabase.from('customer_favorites').select('product_id,created_at,unit_price_snapshot').eq('user_id', uid).order('created_at', { ascending: false }).limit(120),
        supabase.from('customer_interest_events').select('event_type,product_id,category_id,search_query,metadata,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(500),
        supabase.from('orders').select('id,status,created_at,order_items(product_id,quantity,unit_price,product_snapshot)').eq('user_id', uid).order('created_at', { ascending: false }).limit(60),
      ]);
      if (!live) return;
      const allProducts = productsResult.data || [];
      const current = allProducts.find(row => String(row.id) === String(slug) || row.slug === slug) || null;
      setProducts(allProducts); setCategories(categoryResult.data || []); setRules(rulesResult.data || []); setPreferences(prefResult || normalizeCustomerPreferences());
      setFavorites(favoriteResult.data || []); setInterests(interestResult.data || []); setOrders(orderResult.data || []); setProduct(current);
      setActiveImage(current?.image_url || current?.gallery?.[0] || ''); setQty(Number(current?.min_order_quantity || 1));
      setIsFavorite(!!(favoriteResult.data || []).find(row => String(row.product_id) === String(current?.id)));
      try { setCompareAdded((JSON.parse(sessionStorage.getItem(COMPARE_KEY) || '[]') || []).map(String).includes(String(current?.id))); } catch { setCompareAdded(false); }
      setLoading(false);
    })().catch(() => { if (live) { setError(ar ? 'تعذر تحميل المنتج الآن.' : 'Could not load this product.'); setLoading(false); } });
    return () => { live = false; };
  }, [slug, uid, ar]);

  useEffect(() => {
    if (!uid || !product?.id) return;
    const key = `balqees-view:${uid}:${product.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    recordCustomerInterest({ user_id: uid, event_type: 'view', product_id: product.id, category_id: product.category_id || null, metadata: { source: 'individual_product_details', query: location.search || null } });
  }, [uid, product?.id, location.search]);

  const categoryById = useMemo(() => new Map(categories.map(row => [String(row.id), row])), [categories]);
  const category = product ? categoryById.get(String(product.category_id)) : null;
  const images = useMemo(() => product ? [product.image_url, ...(Array.isArray(product.gallery) ? product.gallery : [])].filter((x, i, a) => x && a.indexOf(x) === i) : [], [product]);
  const pricing = useMemo(() => resolveProductPrice(product, rules), [product, rules]);
  const availability = useMemo(() => productAvailability(product), [product]);
  const kind = useMemo(() => productKind(product, category), [product, category]);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const contextOccasion = searchParams.get('occasion');
  const contextStyle = searchParams.get('style');
  const contextBudget = budgetRange(searchParams.get('budget'));
  const savedBudgetMax = Number(preferences?.store_budget_limit || 0) || null;
  const effectiveSavedBudgetMax = savedBudgetMax ? savedBudgetMax * (preferences?.store_budget_overrun ? 1.1 : 1) : null;
  const activeBudgetMin = contextBudget.min;
  const activeBudgetMax = Number.isFinite(contextBudget.max) ? contextBudget.max : (contextBudget.max === Infinity ? Infinity : effectiveSavedBudgetMax);
  const currentPrice = pricing.effective;
  const maxQuantity = useMemo(() => {
    const tracked = product?.stock_mode === 'tracked' ? Number(product.stock_quantity || 0) : Infinity;
    const configured = product?.max_order_quantity ? Number(product.max_order_quantity) : Infinity;
    return Math.min(tracked, configured);
  }, [product]);
  const minQuantity = Number(product?.min_order_quantity || 1);
  const canAdd = availability !== 'unavailable' && !product?.price_on_request && currentPrice !== null && currentPrice !== undefined && maxQuantity >= minQuantity;

  const taste = useMemo(() => buildTasteProfile({ products, categories, interests, favorites, cartItems: cart.items, orders, personalized: preferences?.personalized_recommendations !== false }), [products, categories, interests, favorites, cart.items, orders, preferences?.personalized_recommendations]);
  const tasteValue = useMemo(() => product ? tasteScore(product, category, rules, taste) : 0, [product, category, rules, taste]);
  const matchingOccasions = useMemo(() => product ? Object.keys(SMART_STORE_OCCASIONS).filter(key => productMatchesOccasion(product, category, key)) : [], [product, category]);

  const reasons = useMemo(() => {
    if (!product) return [];
    const out = [];
    if (contextOccasion && SMART_STORE_OCCASIONS[contextOccasion] && productMatchesOccasion(product, category, contextOccasion)) out.push(ar ? `يناسب ${occasionLabel(contextOccasion, true)}` : `Matches ${occasionLabel(contextOccasion, false)}`);
    if (activeBudgetMax && currentPrice !== null && currentPrice !== undefined && Number(currentPrice) <= Number(activeBudgetMax) && (!activeBudgetMin || Number(currentPrice) >= Number(activeBudgetMin))) out.push(ar ? 'ضمن الميزانية التي اخترتها' : 'Within your selected budget');
    if (preferences?.personalized_recommendations !== false && tasteValue > 2) out.push(ar ? 'قريب من ذوقك المحفوظ' : 'Close to your saved taste');
    if (contextStyle && productMatchesStyle(product, category, contextStyle)) out.push(ar ? 'يطابق الأسلوب الذي تبحث عنه' : 'Matches the style you searched for');
    return out.slice(0, 3);
  }, [product, category, contextOccasion, contextStyle, activeBudgetMin, activeBudgetMax, currentPrice, preferences?.personalized_recommendations, tasteValue, ar]);

  const relatedRows = useMemo(() => {
    if (!product) return [];
    return products.filter(row => row.id !== product.id && productAvailability(row) !== 'unavailable').map(row => {
      const rowCategory = categoryById.get(String(row.category_id));
      let score = 0;
      if (row.category_id && row.category_id === product.category_id) score += 8;
      score += commonTags(product, row) * 3;
      if (contextOccasion && productMatchesOccasion(row, rowCategory, contextOccasion)) score += 5;
      if (contextStyle && productMatchesStyle(row, rowCategory, contextStyle)) score += 3;
      score += tasteScore(row, rowCategory, rules, taste) * .2;
      return { row, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || new Date(b.row.created_at) - new Date(a.row.created_at)).slice(0, 3).map(x => x.row);
  }, [product, products, categoryById, contextOccasion, contextStyle, rules, taste]);

  const budgetRows = useMemo(() => {
    if (!product || !activeBudgetMax || activeBudgetMax === Infinity) return [];
    return products.filter(row => row.id !== product.id && productAvailability(row) !== 'unavailable' && !row.price_on_request).map(row => ({ row, price: resolveProductPrice(row, rules).effective })).filter(x => x.price !== null && x.price !== undefined && Number(x.price) <= Number(activeBudgetMax) && (!activeBudgetMin || Number(x.price) >= Number(activeBudgetMin))).sort((a, b) => Math.abs(Number(activeBudgetMax) - Number(a.price)) - Math.abs(Number(activeBudgetMax) - Number(b.price))).slice(0, 3).map(x => x.row);
  }, [product, products, rules, activeBudgetMin, activeBudgetMax]);

  const cheaperRows = useMemo(() => {
    if (!product || currentPrice === null || currentPrice === undefined) return [];
    return products.filter(row => row.id !== product.id && productAvailability(row) !== 'unavailable' && !row.price_on_request).map(row => ({ row, price: resolveProductPrice(row, rules).effective, tags: commonTags(product, row), sameCategory: row.category_id === product.category_id })).filter(x => x.price !== null && Number(x.price) < Number(currentPrice) && (x.sameCategory || x.tags > 0)).sort((a, b) => (Number(b.sameCategory) - Number(a.sameCategory)) || (b.tags - a.tags) || Number(b.price) - Number(a.price)).slice(0, 3).map(x => x.row);
  }, [product, products, rules, currentPrice]);

  const assistantRows = assistantMode === 'cheaper' ? cheaperRows : assistantMode === 'budget' ? budgetRows : relatedRows;
  const quietMode = !!preferences?.quiet_mode;
  const storeBack = `/store${location.search || ''}`;

  function setQuantity(next) {
    let value = Math.max(minQuantity, Number(next || minQuantity));
    if (Number.isFinite(maxQuantity)) value = Math.min(maxQuantity, value);
    setQty(value);
  }
  function nextImage(direction) {
    if (images.length < 2) return;
    const index = Math.max(0, images.indexOf(activeImage));
    setActiveImage(images[(index + direction + images.length) % images.length]);
  }
  function addToCart() {
    if (!canAdd) return;
    cart.add(product, qty, { unit_price_snapshot: currentPrice, is_gift: gift });
    setToast(gift ? (ar ? 'أضفناها للسلة كهدية' : 'Added to cart as a gift') : (ar ? 'أضفنا المنتج إلى سلتك' : 'Added to your cart'));
  }
  async function toggleFavorite() {
    if (!product) return;
    if (isFavorite) {
      const result = await removeFavorite({ userId: uid, product });
      if (!result.error) { setIsFavorite(false); setFavorites(rows => rows.filter(row => String(row.product_id) !== String(product.id))); setToast(ar ? 'أزيل من المفضلة' : 'Removed from favorites'); }
      return;
    }
    const result = await saveFavorite({ userId: uid, product, unitPrice: currentPrice });
    if (!result.error) { setIsFavorite(true); setFavorites(rows => [{ product_id: product.id, created_at: new Date().toISOString(), unit_price_snapshot: currentPrice }, ...rows]); setToast(ar ? 'تم الحفظ في المفضلة' : 'Saved to favorites'); }
  }
  function toggleCompare() {
    if (!product) return;
    let ids = [];
    try { ids = (JSON.parse(sessionStorage.getItem(COMPARE_KEY) || '[]') || []).map(String); } catch { ids = []; }
    const key = String(product.id);
    if (ids.includes(key)) ids = ids.filter(id => id !== key);
    else if (ids.length >= 3) { setToast(ar ? 'المقارنة حتى 3 منتجات فقط' : 'Compare up to 3 products'); return; }
    else ids = [...ids, key];
    sessionStorage.setItem(COMPARE_KEY, JSON.stringify(ids));
    setCompareAdded(ids.includes(key));
    setToast(ids.includes(key) ? (ar ? 'أضيف للمقارنة — اختر منتجًا آخر من المتجر' : 'Added to compare — choose another product') : (ar ? 'أزيل من المقارنة' : 'Removed from compare'));
  }
  async function shareProduct() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: label(product, ar), text: ar ? 'شاهد هذا المنتج من بلقيس' : 'View this Balqees product', url });
      else { await navigator.clipboard.writeText(url); setToast(ar ? 'تم نسخ رابط المنتج' : 'Product link copied'); }
    } catch { /* cancelled */ }
  }
  function requestPrice() {
    if(product) navigate(`/request-quote?product=${encodeURIComponent(product.id)}&quantity=${encodeURIComponent(qty)}`);
  }
  async function sendProductQuestion() {
    const body = assistantQuestion.trim();
    if (!body || !product) return;
    setAssistantBusy(true);
    const { data, error: rpcError } = await supabase.rpc('customer_open_support_case', {
      p_order_id: null,
      p_category: 'product_question',
      p_subject: ar ? `سؤال عن ${product.name_ar}` : `Question about ${product.name_en || product.name_ar}`,
      p_automation_attempts: [{ type: 'product_self_service', product_id: product.id, result: 'customer_requested_human_help' }],
      p_context_snapshot: { product_id: product.id, sku: product.sku || null, product_name: product.name_ar, customer_question: body, source: 'product_details' },
    });
    if (!rpcError && data?.id) {
      await supabase.from('support_messages').insert({ conversation_id: data.id, sender_id: uid, sender_role: 'user', body });
      setAssistantQuestion(''); setAssistantBusy(false); navigate(`/account/support?conversation=${encodeURIComponent(data.id)}`); return;
    }
    setAssistantBusy(false); setToast(ar ? 'تعذر إرسال السؤال الآن' : 'Could not send your question');
  }
  function openProduct(row) { navigate(`/store/${row.slug || row.id}${location.search || ''}`); }

  if (settingsError || !systemSettings.store.enabled) return <ProductChrome lang={lang} session={session} cart={cart}><main className="individual-main"><div className="individual-shell"><div className="product-detail-empty" role={settingsError ? 'alert' : 'status'}><PackageOpen/><h1>{settingsError ? (ar ? 'تعذر التحقق من إعدادات المتجر' : 'Store settings are unavailable') : (ar ? 'المتجر متوقف مؤقتًا' : 'Store is temporarily closed')}</h1><Link to={storeBack}>{ar ? 'العودة للمتجر' : 'Back to store'}</Link></div></div></main></ProductChrome>;
  if (loading) return <ProductChrome lang={lang} session={session} cart={cart}><main className="individual-main"><div className="individual-shell"><div className="product-detail-loading"><LoaderCircle className="spin"/><strong>{ar ? 'نجهّز تفاصيل المنتج…' : 'Preparing product details…'}</strong></div></div></main></ProductChrome>;
  if (error) return <ProductChrome lang={lang} session={session} cart={cart}><main className="individual-main"><div className="individual-shell"><div className="product-detail-empty"><PackageOpen/><h1>{error}</h1><Link to={storeBack}>{ar ? 'العودة للمتجر' : 'Back to store'}</Link></div></div></main></ProductChrome>;
  if (!product) return <ProductChrome lang={lang} session={session} cart={cart}><main className="individual-main"><div className="individual-shell"><div className="product-detail-empty"><PackageOpen/><h1>{ar ? 'المنتج غير متاح' : 'Product unavailable'}</h1><p>{ar ? 'قد يكون المنتج متوقفًا أو غير منشور حاليًا.' : 'The product may be inactive or unpublished.'}</p><Link to={storeBack}>{ar ? 'العودة للمتجر' : 'Back to store'}</Link></div></div></main></ProductChrome>;

  const withinBudget = currentPrice !== null && currentPrice !== undefined && activeBudgetMax && Number(currentPrice) <= Number(activeBudgetMax) && (!activeBudgetMin || Number(currentPrice) >= Number(activeBudgetMin));
  const overBudgetBy = activeBudgetMax && currentPrice !== null && currentPrice !== undefined && Number(currentPrice) > Number(activeBudgetMax) ? Number(currentPrice) - Number(activeBudgetMax) : null;
  const budgetRemaining = withinBudget && activeBudgetMax !== Infinity ? Number(activeBudgetMax) - Number(currentPrice) : null;
  const showPrice = !product.price_on_request && currentPrice !== null && currentPrice !== undefined;

  return <ProductChrome lang={lang} session={session} cart={cart}>
    <main className="individual-main individual-product-detail-main"><div className="individual-shell">
      <div className="product-detail-journey"><Link to={storeBack}><Back size={16}/>{ar ? 'العودة لنفس نتائج المتجر' : 'Back to your store results'}</Link>{(searchParams.get('q') || contextOccasion || searchParams.get('budget')) && <div>{searchParams.get('q') && <span>{ar ? 'بحث:' : 'Search:'} {searchParams.get('q')}</span>}{contextOccasion && SMART_STORE_OCCASIONS[contextOccasion] && <span>{occasionLabel(contextOccasion, ar)}</span>}{searchParams.get('budget') && <span>{ar ? 'ميزانية' : 'Budget'} · {budgetLabel(searchParams.get('budget'), ar)}</span>}</div>}</div>

      <section className="product-detail-hero-grid">
        <div className="product-detail-gallery">
          <div className="product-detail-main-image" onTouchStart={e => { touchStart.current = e.touches?.[0]?.clientX || null; }} onTouchEnd={e => { if (touchStart.current === null) return; const delta = (e.changedTouches?.[0]?.clientX || touchStart.current) - touchStart.current; if (Math.abs(delta) > 45) nextImage(delta > 0 ? -1 : 1); touchStart.current = null; }}>
            {activeImage ? <img src={activeImage} alt={label(product, ar)}/> : <Flower2 size={56}/>} 
            {images.length > 1 && <><button className="gallery-prev" onClick={() => nextImage(ar ? 1 : -1)}><ChevronLeft/></button><button className="gallery-next" onClick={() => nextImage(ar ? -1 : 1)}><ChevronRight/></button></>}
            {activeImage && <button className="gallery-zoom" onClick={() => setGalleryOpen(true)}><ZoomIn size={17}/><span>{ar ? 'تكبير' : 'Zoom'}</span></button>}
            <button className={`gallery-favorite ${isFavorite ? 'active' : ''}`} onClick={toggleFavorite}><Heart size={18} fill={isFavorite ? 'currentColor' : 'none'}/><span>{isFavorite ? (ar ? 'محفوظ' : 'Saved') : (ar ? 'حفظ' : 'Save')}</span></button>
          </div>
          {images.length > 1 && <div className="product-detail-thumbs">{images.map(src => <button key={src} className={src === activeImage ? 'active' : ''} onClick={() => setActiveImage(src)}><img src={src} alt=""/></button>)}</div>}
        </div>

        <div className="product-detail-info">
          <div className="product-detail-kicker"><span>{categoryLabel(category, ar) || product.sku || 'BALQEES'}</span>{product.is_featured && <em><Sparkles size={13}/>{ar ? 'مختار من بلقيس' : 'Balqees selection'}</em>}</div>
          <h1>{label(product, ar)}</h1>
          {(ar ? product.short_description_ar : (product.short_description_en || product.short_description_ar)) && <p className="product-detail-lead">{ar ? product.short_description_ar : (product.short_description_en || product.short_description_ar)}</p>}

          <div className="product-detail-price-block">
            {showPrice ? <><div><strong>{formatSar(currentPrice, lang)}</strong>{pricing.onSale && <del>{formatSar(pricing.regular, lang)}</del>}</div><small>{ar ? 'السعر المعروض من محرك التسعير الحالي.' : 'Current price from the store pricing engine.'}</small></> : <><strong>{ar ? 'السعر حسب الطلب' : 'Price on request'}</strong><small>{ar ? 'لن نعرض سعرًا تقديريًا غير معتمد. افتح طلب تسعير حقيقي مع فريق بلقيس.' : 'We will not show an unverified estimate. Open a real pricing request with Balqees Care.'}</small></>}
          </div>

          <div className={`product-detail-availability ${availability}`}><span></span><strong>{availabilityCopy(availability, ar)}</strong>{product.lead_time_ar || product.lead_time_en ? <small><Clock3 size={14}/>{ar ? (product.lead_time_ar || product.lead_time_en) : (product.lead_time_en || product.lead_time_ar)}</small> : null}</div>

          {(activeBudgetMax || savedBudgetMax) && showPrice && <div className={`product-detail-budget ${withinBudget ? 'inside' : overBudgetBy ? 'outside' : ''}`}><CircleDollarSign size={19}/><div><strong>{withinBudget ? (ar ? 'ضمن ميزانيتك ✓' : 'Within your budget ✓') : overBudgetBy ? (ar ? `يتجاوز ميزانيتك بـ ${fmtRemaining(overBudgetBy, lang)}` : `Over budget by ${fmtRemaining(overBudgetBy, lang)}`) : (ar ? 'مقارنة مع ميزانيتك' : 'Compared with your budget')}</strong>{budgetRemaining !== null && budgetRemaining > 0 && <small>{ar ? `يتبقى ${fmtRemaining(budgetRemaining, lang)} من ميزانيتك` : `${fmtRemaining(budgetRemaining, lang)} remains in your budget`}</small>}{overBudgetBy && budgetRows.length > 0 && !quietMode && <button onClick={() => document.getElementById('budget-alternatives')?.scrollIntoView({ behavior: 'smooth' })}>{ar ? 'شاهد خيارات أقرب لميزانيتك' : 'See closer budget options'}</button>}</div></div>}

          {matchingOccasions.length > 0 && <div className="product-detail-occasions"><small>{ar ? 'يناسب' : 'Suitable for'}</small><div>{matchingOccasions.slice(0, 5).map(key => <span key={key}>{occasionLabel(key, ar)}</span>)}</div></div>}

          {reasons.length > 0 && <div className="product-detail-why"><span>{ar ? 'لماذا ظهر لك؟' : 'Why this appeared for you'}</span>{reasons.map(reason => <p key={reason}><Check size={14}/>{reason}</p>)}</div>}

          {canAdd && <div className="product-detail-buybox">
            <div className="product-detail-quantity"><button onClick={() => setQuantity(qty - 1)} disabled={qty <= minQuantity}><Minus size={16}/></button><input value={qty} type="number" min={minQuantity} max={Number.isFinite(maxQuantity) ? maxQuantity : undefined} onChange={e => setQuantity(e.target.value)}/><button onClick={() => setQuantity(qty + 1)} disabled={Number.isFinite(maxQuantity) && qty >= maxQuantity}><Plus size={16}/></button></div>
            <button type="button" className={`product-detail-gift ${gift ? 'active' : ''}`} onClick={() => setGift(value => !value)}><Gift size={17}/><span>{gift ? (ar ? 'هذه هدية ✓' : 'This is a gift ✓') : (ar ? 'أبغاها كهدية' : 'Make it a gift')}</span></button>
            <button type="button" className="product-detail-add" onClick={addToCart}><ShoppingBag size={18}/>{ar ? 'إضافة إلى السلة' : 'Add to cart'}</button>
          </div>}
          {!canAdd && <div className="product-detail-primary-fallback">{product.price_on_request ? <button onClick={requestPrice} disabled={assistantBusy}><MessageCircleMore size={18}/>{assistantBusy ? (ar ? 'جاري فتح الطلب…' : 'Opening request…') : (ar ? 'اطلب تسعيرًا' : 'Request pricing')}</button> : availability === 'unavailable' ? <button onClick={() => quietMode ? navigate(storeBack) : document.getElementById('smart-alternatives')?.scrollIntoView({ behavior: 'smooth' })}><PackageOpen size={18}/>{quietMode ? (ar ? 'العودة للمتجر' : 'Back to store') : (ar ? 'اعرض بدائل مشابهة' : 'Show similar alternatives')}</button> : null}</div>}

          <div className="product-detail-secondary-actions"><button onClick={toggleFavorite}><Heart size={16} fill={isFavorite ? 'currentColor' : 'none'}/>{isFavorite ? (ar ? 'محفوظ' : 'Saved') : (ar ? 'المفضلة' : 'Favorite')}</button><button className={compareAdded ? 'active' : ''} onClick={toggleCompare}><Layers size={16}/>{compareAdded ? (ar ? 'في المقارنة' : 'Comparing') : (ar ? 'قارن' : 'Compare')}</button><button onClick={shareProduct}><Share2 size={16}/>{ar ? 'مشاركة' : 'Share'}</button></div>
        </div>
      </section>

      <section className="product-detail-content-grid">
        <div className="product-detail-accordions">
          <DetailAccordion title={ar ? 'الفكرة والتفاصيل' : 'Concept & details'} open={accordions.details} onToggle={() => setAccordions(v => ({ ...v, details: !v.details }))}><p>{ar ? (product.description_ar || product.short_description_ar || 'لا توجد تفاصيل إضافية منشورة لهذا المنتج.') : (product.description_en || product.description_ar || product.short_description_en || product.short_description_ar || 'No additional published details for this product.')}</p>{product.tags?.length > 0 && <div className="product-detail-tags">{product.tags.map(tag => <span key={tag}>#{tag}</span>)}</div>}</DetailAccordion>
          <DetailAccordion title={ar ? 'التجهيز والتوفر' : 'Preparation & availability'} open={accordions.preparation} onToggle={() => setAccordions(v => ({ ...v, preparation: !v.preparation }))}><ul><li><strong>{ar ? 'الحالة:' : 'Status:'}</strong> {availabilityCopy(availability, ar)}</li>{product.lead_time_ar || product.lead_time_en ? <li><strong>{ar ? 'وقت التجهيز:' : 'Preparation time:'}</strong> {ar ? (product.lead_time_ar || product.lead_time_en) : (product.lead_time_en || product.lead_time_ar)}</li> : null}<li><strong>{ar ? 'مهم:' : 'Important:'}</strong> {ar ? 'وقت التجهيز لا يعني موعد التسليم. الموعد النهائي يُراجع في إتمام الطلب.' : 'Preparation time is not the delivery time. Final delivery timing is checked at checkout.'}</li></ul></DetailAccordion>
          <DetailAccordion title={ar ? 'معلومات الشراء' : 'Purchase information'} open={accordions.purchase} onToggle={() => setAccordions(v => ({ ...v, purchase: !v.purchase }))}><ul><li><strong>{ar ? 'وحدة البيع:' : 'Unit:'}</strong> {ar ? (product.unit_ar || 'قطعة') : (product.unit_en || product.unit_ar || 'piece')}</li><li><strong>{ar ? 'الحد الأدنى:' : 'Minimum:'}</strong> {minQuantity}</li>{Number.isFinite(maxQuantity) && <li><strong>{ar ? 'الحد الأعلى المتاح:' : 'Maximum available:'}</strong> {maxQuantity}</li>}{product.sku && <li><strong>SKU:</strong> {product.sku}</li>}</ul></DetailAccordion>
        </div>

        <aside className="product-detail-assistant"><div className="product-detail-assistant-head"><WandSparkles size={20}/><div><small>BALQEES CARE</small><h2>{ar ? 'عندك سؤال عن هذا المنتج؟' : 'Question about this product?'}</h2><p>{ar ? 'مساعد بلقيس يعرف المنتج الحالي. ابدأ بخيار سريع أو أرسل سؤالك للفريق.' : 'Balqees Care already knows the current product. Start with a quick route or send your question.'}</p></div></div>
          <div className="product-detail-assistant-shortcuts"><button onClick={() => { setAssistantOpen(true); setAssistantMode('occasion'); }}>{ar ? 'يناسب أي مناسبة؟' : 'Which occasions?'}</button><button onClick={() => { setAssistantOpen(true); setAssistantMode('similar'); }}>{ar ? 'أبغا شيء قريب منه' : 'Show similar'}</button><button onClick={() => { setAssistantOpen(true); setAssistantMode('cheaper'); }}>{ar ? 'أبغا شيء أرخص' : 'Show cheaper'}</button>{activeBudgetMax && <button onClick={() => { setAssistantOpen(true); setAssistantMode('budget'); }}>{ar ? 'أقرب لميزانيتي' : 'Closer to budget'}</button>}</div>
          {assistantOpen && <div className="product-detail-assistant-results">{assistantMode === 'occasion' ? <div className="product-detail-assistant-answer">{matchingOccasions.length > 0 ? <><strong>{ar ? 'بحسب بيانات المنتج المنشورة، يناسب:' : 'Based on the published product data, it suits:'}</strong><div>{matchingOccasions.slice(0, 6).map(key => <span key={key}>{occasionLabel(key, ar)}</span>)}</div></> : <><strong>{ar ? 'ما عندنا وسم مناسبة صريح لهذا المنتج' : 'No explicit occasion tag is published for this product'}</strong><p>{ar ? 'ما راح أخمّن. تقدر تسأل فريق بلقيس عن مناسبة محددة من الحقل أدناه.' : 'I will not guess. Ask Balqees Care about a specific occasion below.'}</p></>}</div> : assistantRows.length > 0 ? assistantRows.map(row => <SmallProductCard key={row.id} product={row} category={categoryById.get(String(row.category_id))} rules={rules} lang={lang} onOpen={openProduct}/>) : <div className="product-detail-no-result"><PackageOpen size={23}/><strong>{ar ? 'ما عندنا تطابق حقيقي حاليًا' : 'No real match right now'}</strong><p>{ar ? 'ما راح نعوض النتيجة بمنتج غير مناسب أو سعر غير موجود.' : 'We will not fill the gap with an unrelated product or invented price.'}</p></div>}</div>}
          <div className="product-detail-question"><input value={assistantQuestion} onChange={e => setAssistantQuestion(e.target.value)} placeholder={ar ? 'اكتب سؤالك عن هذا المنتج…' : 'Ask about this product…'} onKeyDown={e => e.key === 'Enter' && sendProductQuestion()}/><button disabled={!assistantQuestion.trim() || assistantBusy} onClick={sendProductQuestion}>{assistantBusy ? <LoaderCircle className="spin" size={17}/> : <Send size={17}/>}</button></div>
        </aside>
      </section>

      {!quietMode && relatedRows.length > 0 && <section id="smart-alternatives" className="product-detail-recommendations"><div className="product-detail-section-head"><small>{ar ? 'بدائل قليلة وذات معنى' : 'FEW, RELEVANT ALTERNATIVES'}</small><h2>{ar ? 'خيارات قريبة من هذا المنتج' : 'Options close to this product'}</h2></div><div className="product-detail-recommendation-grid">{relatedRows.map(row => <SmallProductCard key={row.id} product={row} category={categoryById.get(String(row.category_id))} rules={rules} lang={lang} onOpen={openProduct}/>)}</div></section>}
      {!quietMode && budgetRows.length > 0 && <section id="budget-alternatives" className="product-detail-recommendations"><div className="product-detail-section-head"><small>{ar ? 'SMART BUDGET' : 'SMART BUDGET'}</small><h2>{ar ? 'بدائل في نفس ميزانيتك' : 'Alternatives in your budget'}</h2></div><div className="product-detail-recommendation-grid">{budgetRows.map(row => <SmallProductCard key={row.id} product={row} category={categoryById.get(String(row.category_id))} rules={rules} lang={lang} onOpen={openProduct}/>)}</div></section>}
    </div></main>

    {canAdd && <div className="product-detail-mobile-cta"><div><small>{gift ? (ar ? 'هدية' : 'Gift') : availabilityCopy(availability, ar)}</small><strong>{formatSar(currentPrice, lang)}</strong></div><button onClick={addToCart}><ShoppingBag size={18}/>{ar ? 'أضف للسلة' : 'Add to cart'}</button></div>}
    {compareAdded && <div className="product-detail-compare-toast"><Layers size={17}/><span>{ar ? 'المنتج في المقارنة. اختر منتجًا آخر من المتجر.' : 'Product is in compare. Choose another item in store.'}</span><Link to={storeBack}>{ar ? 'المتجر' : 'Store'}<ArrowLeft className={ar ? '' : 'ltr-arrow'} size={14}/></Link></div>}
    {toast && <div className="individual-toast">{toast}</div>}

    {galleryOpen && <div className="product-gallery-lightbox" onMouseDown={e => e.target === e.currentTarget && setGalleryOpen(false)}><button className="close" onClick={() => setGalleryOpen(false)}><X/></button>{activeImage && <img src={activeImage} alt={label(product, ar)}/>} {images.length > 1 && <><button className="prev" onClick={() => nextImage(ar ? 1 : -1)}><ChevronLeft/></button><button className="next" onClick={() => nextImage(ar ? -1 : 1)}><ChevronRight/></button></>}</div>}
  </ProductChrome>;
}
