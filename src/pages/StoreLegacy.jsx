import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Filter, Heart, LoaderCircle, LockKeyhole, PackageOpen, Search, ShoppingBag, Sparkles, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { formatSar, resolveProductPrice } from '../lib/storePricing';
import { useSystemSettings } from '../lib/systemSettings';
import useLiveDataRefresh from '../lib/useLiveDataRefresh';
import StoreCartDrawer from '../components/StoreCartDrawer';
import { removeFavorite, saveFavorite } from '../lib/favorites';

const OCCASION_CONTEXT = {
  ramadan:['رمضان','Ramadan',['ramadan','رمضان']], eid_fitr:['عيد الفطر','Eid al-Fitr',['eid','fitr','عيد','فطر']], eid_adha:['عيد الأضحى','Eid al-Adha',['adha','eid','أضحى','اضحى','عيد']], hajj:['الحج','Hajj',['hajj','حج']], wedding:['زواج','Wedding',['wedding','bride','groom','زواج','عروس','عريس']], malka:['مَلْكة','Malka',['malka','nikah','ملكة','ملكه','عقد']], engagement:['خطبة','Engagement',['engagement','خطبة','خطبه']], return_from_travel:['قدوم من سفر','Return from travel',['welcome','travel','arrival','ترحيب','سفر','عودة','عوده']], usual_gift:['هدية معتادة','Usual gift',['gift','هدية','هديه']], new_baby:['مولود جديد','New baby',['baby','newborn','مولود']], graduation:['تخرج','Graduation',['graduation','graduate','تخرج','خريج']], party:['حفلة','Party',['party','celebration','حفلة','حفله','احتفال']],
};
function occasionBudgetMax(band){ return band==='under_150'?150:band==='150_300'?300:band==='300_500'?500:band==='500_plus'?Infinity:Infinity; }
function occasionBudgetLabel(band, ar){ return band==='under_150'?(ar?'أقل من 150 ر.س':'Under SAR 150'):band==='150_300'?(ar?'150–300 ر.س':'SAR 150–300'):band==='300_500'?(ar?'300–500 ر.س':'SAR 300–500'):band==='500_plus'?(ar?'500 ر.س فأكثر':'SAR 500+'):(ar?'بدون حد محدد':'No set budget'); }
function occasionProductScore(product, rules, context){
  if(!context?.type) return 0;
  const meta=OCCASION_CONTEXT[context.type]; if(!meta) return 0;
  const text=[product.name_ar,product.name_en,product.short_description_ar,product.short_description_en,...(product.tags||[])].filter(Boolean).join(' ').toLowerCase();
  let score=0; meta[2].forEach(k=>{ if(text.includes(String(k).toLowerCase())) score+=7; });
  if(['service','maintenance','landscape','garden','vase','planter','pot','تنسيق','صيانة','حديقة','فازة','فازه','مركن','مراكن'].some(k=>text.includes(k))) score-=12;
  const price=resolveProductPrice(product,rules).effective; const max=occasionBudgetMax(context.budget);
  if(price!==null&&price!==undefined&&Number.isFinite(max)){ if(Number(price)<=max) score+=3; else score-=2; }
  return score;
}

export default function Store({ lang }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const location = useLocation();
  const [cartUserId, setCartUserId] = useState(null);
  const cart = useBalqeesCart(cartUserId);
  const { settings: systemSettings, loading: settingsLoading, error: settingsError } = useSystemSettings();
  const settings = systemSettings.store;
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [session, setSession] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('featured');
  const [cartOpen, setCartOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [occasionContext, setOccasionContext] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('cart') === '1') setCartOpen(true);
    if (params.get('category')) setCategory(params.get('category'));
    if (params.get('q')) setQuery(params.get('q'));
    const occasionType = params.get('occasion');
    if (occasionType && OCCASION_CONTEXT[occasionType]) {
      const next = { type: occasionType, budget: params.get('budget') || 'unspecified' };
      setOccasionContext(next);
      try { localStorage.setItem('balqees-store-occasion-context', JSON.stringify({ occasion_type: occasionType, budget_band: next.budget, source: 'occasion_page', created_at: new Date().toISOString() })); } catch { /* ignore */ }
    } else setOccasionContext(null);
  }, [location.search]);

  const loadCatalog = useCallback(async () => {
    if (!supabase) { setLoadError(ar ? 'تعذر الاتصال بالمتجر.' : 'Store connection is unavailable.'); setLoading(false); return; }
    setLoadError('');
    try {
      const [p, c, r, a] = await Promise.all([
        supabase.from('products').select('*').eq('visibility', 'public').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('product_categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('price_rules').select('*').eq('is_active', true),
        supabase.auth.getSession(),
      ]);
      if (p.error || c.error || r.error) throw p.error || c.error || r.error;
      setProducts(p.data || []); setCategories(c.data || []); setRules(r.data || []); setSession(a.data?.session || null);
    } catch { setLoadError(ar ? 'تعذر تحديث المنتجات والأسعار. أعد المحاولة.' : 'Could not refresh products and pricing. Please retry.'); }
    finally { setLoading(false); }
  }, [ar]);
  useEffect(() => {
    loadCatalog();
    if (!supabase) return undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, [loadCatalog]);
  useLiveDataRefresh(loadCatalog, ['products', 'product_categories', 'price_rules']);
  useEffect(() => { if (!settingsLoading && settings.enabled) loadCatalog(); }, [settingsLoading, settings.enabled, settings.guestBrowse, loadCatalog]);



  useEffect(() => {
    let live = true;
    if (!session?.user?.id) { setCartUserId(null); return () => { live = false; }; }
    supabase.from('customer_profiles').select('account_type').eq('id', session.user.id).maybeSingle().then(({ data }) => {
      if (live) setCartUserId(data?.account_type === 'individual' ? session.user.id : null);
    });
    return () => { live = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    let live = true;
    if (!cartUserId) { setFavoriteIds(new Set()); return () => { live = false; }; }
    supabase.from('customer_favorites').select('product_id').eq('user_id', cartUserId).then(({ data }) => {
      if (live) setFavoriteIds(new Set((data || []).map(row => String(row.product_id))));
    });
    return () => { live = false; };
  }, [cartUserId]);

  async function toggleFavorite(product) {
    if (!session) { navigate(`/account?next=/store`); return; }
    if (!cartUserId) return;
    const id = String(product.id);
    if (favoriteIds.has(id)) {
      const result = await removeFavorite({ userId: cartUserId, product });
      if (!result.error) setFavoriteIds(current => { const next = new Set(current); next.delete(id); return next; });
      return;
    }
    const result = await saveFavorite({ userId: cartUserId, product, unitPrice: resolveProductPrice(product, rules).effective });
    if (!result.error) setFavoriteIds(current => new Set([...current, id]));
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = products.filter(p => (category === 'all' || p.category_id === category) && (!q || `${p.name_ar} ${p.name_en||''} ${p.short_description_ar||''} ${p.short_description_en||''} ${(p.tags||[]).join(' ')}`.toLowerCase().includes(q)));
    return [...rows].sort((a,b) => {
      if (sort === 'newest') return new Date(b.created_at)-new Date(a.created_at);
      if (sort === 'price-low') return Number(resolveProductPrice(a,rules).effective ?? Infinity) - Number(resolveProductPrice(b,rules).effective ?? Infinity);
      if (sort === 'price-high') return Number(resolveProductPrice(b,rules).effective ?? -1) - Number(resolveProductPrice(a,rules).effective ?? -1);
      if (occasionContext?.type) {
        const diff = occasionProductScore(b,rules,occasionContext) - occasionProductScore(a,rules,occasionContext);
        if (diff) return diff;
      }
      return Number(b.is_featured)-Number(a.is_featured) || new Date(b.created_at)-new Date(a.created_at);
    });
  }, [products,category,query,sort,rules,occasionContext]);

  const canGuestCart = settings.guestCart !== false;
  const canBrowse = settings.guestBrowse !== false || !!session;
  const showPrices = settings.showPrices !== false;
  function addProduct(product) {
    if (loadError || settingsError || !settings.enabled) return;
    if (!session && !canGuestCart) {
      navigate('/account?next=/store');
      return;
    }
    cart.add(product, product.min_order_quantity || 1, { unit_price_snapshot: resolveProductPrice(product, rules).effective });
    setCartOpen(true);
  }

  return <div className="store-page" dir={ar?'rtl':'ltr'}>
    <section className="store-hero shell">
      <div className="store-hero-copy"><span><Sparkles size={15}/>{ar?'مختارات بلقيس':'BALQEES COLLECTION'}</span><h1>{ar?'منتجات مختارة للمكان والضيافة':'Curated pieces for spaces & hospitality'}</h1><p>{ar?'تسوّق المنتجات التي نختارها بعناية، أو أرسل طلب عرض سعر للقطع والخدمات التي تحتاج تجهيزًا خاصًا.':'Shop carefully selected pieces, or request a tailored quote for products and services that need custom preparation.'}</p></div>
      {(session || canGuestCart) && <button className="store-cart-hero" onClick={()=>setCartOpen(true)}><ShoppingBag size={20}/><span>{ar?'السلة':'Cart'}</span>{cart.count>0&&<b>{cart.count}</b>}</button>}
    </section>

    {occasionContext?.type && <section className="store-occasion-context shell"><div><Sparkles size={17}/><span>{ar ? 'تصفح بسياق المناسبة' : 'BROWSING FOR AN OCCASION'}</span><strong>{ar ? OCCASION_CONTEXT[occasionContext.type][0] : OCCASION_CONTEXT[occasionContext.type][1]}</strong><small>{occasionBudgetLabel(occasionContext.budget, ar)} · {ar ? 'نرتب الأنسب أولًا ولا نخفي بقية المتجر.' : 'We prioritize relevant options without hiding the rest of the store.'}</small></div><button type="button" onClick={()=>{setOccasionContext(null); navigate('/store',{replace:true});}}><X size={14}/>{ar ? 'إلغاء التخصيص' : 'Clear context'}</button></section>}

    {loadError && <div className="store-loading shell" role="alert"><p>{loadError}</p><button className="btn primary" onClick={loadCatalog}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></div>}
    {settingsError ? <section className="store-closed shell" role="alert"><h2>{ar ? 'تعذر التحقق من إعدادات المتجر' : 'Store settings are unavailable'}</h2><button className="btn primary" onClick={() => window.location.reload()}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></section> : settingsLoading ? <div className="store-loading shell"><LoaderCircle className="spin"/></div> : !settings.enabled ? <section className="store-closed shell"><PackageOpen size={34}/><h2>{ar?'المتجر متوقف مؤقتًا':'Store is temporarily unavailable'}</h2><p>{ar?'أوقفت الإدارة المتجر مؤقتًا. ما زالت خدمات بلقيس متاحة من صفحة الخدمات والتواصل.':'The store is temporarily disabled by administration. Balqees services remain available through Services and Support.'}</p></section> : !canBrowse ? <section className="store-closed shell"><LockKeyhole size={34}/><h2>{ar?'المتجر مخصص للحسابات المسجلة':'Store access requires an account'}</h2><p>{ar?'سجّل الدخول لعرض المنتجات والأسعار وإرسال الطلبات.':'Sign in to browse products, pricing and submit orders.'}</p><button className="btn primary" onClick={()=>navigate('/account?next=/store')}>{ar?'تسجيل الدخول':'Sign in'}</button></section> : <>
      <section className="store-controls shell">
        <div className="store-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'ابحث باسم المنتج أو الوصف…':'Search products…'}/>{query&&<button onClick={()=>setQuery('')}><X size={15}/></button>}</div>
        <div className="store-filter"><Filter size={16}/><select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">{ar?'كل الأصناف':'All categories'}</option>{categories.map(c=><option key={c.id} value={c.id}>{ar?c.name_ar:(c.name_en||c.name_ar)}</option>)}</select></div>
        <select className="store-sort" value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">{ar?'المميز أولًا':'Featured first'}</option><option value="newest">{ar?'الأحدث':'Newest'}</option><option value="price-low">{ar?'السعر: الأقل':'Price: low to high'}</option><option value="price-high">{ar?'السعر: الأعلى':'Price: high to low'}</option></select>
      </section>
      {loading ? <div className="store-loading shell"><LoaderCircle className="spin" size={28}/><span>{ar?'جاري تجهيز المتجر…':'Loading store…'}</span></div> : <section className="store-grid shell">
        {visible.map(product => <ProductCard key={product.id} product={product} rules={rules} lang={lang} showPrices={showPrices} onAdd={()=>addProduct(product)} guestLocked={!session&&!canGuestCart} favoriteEnabled={!session || !!cartUserId} isFavorite={favoriteIds.has(String(product.id))} onFavorite={()=>toggleFavorite(product)} detailSearch={occasionContext?.type ? location.search : ''}/>) }
        {!loadError&&!visible.length&&<div className="store-empty"><PackageOpen size={30}/><strong>{ar?'لا توجد منتجات مطابقة':'No matching products'}</strong><p>{ar?'جرّب صنفًا مختلفًا أو غيّر كلمة البحث.':'Try another category or search term.'}</p></div>}
      </section>}
    </>}

    {settings.enabled && canBrowse && (session || canGuestCart) && <button className="store-floating-cart" onClick={()=>setCartOpen(true)} aria-label={ar?'فتح السلة':'Open cart'}><ShoppingBag size={20}/>{cart.count>0&&<b>{cart.count}</b>}</button>}
    <StoreCartDrawer lang={lang} open={cartOpen} onClose={()=>setCartOpen(false)} rules={rules} settings={settings} cartUserId={cartUserId}/>
  </div>;
}

function ProductCard({ product, rules, lang, showPrices, onAdd, guestLocked, favoriteEnabled, isFavorite, onFavorite, detailSearch='' }) {
  const ar = lang === 'ar'; const Arrow = ar ? ArrowLeft : ArrowRight;
  const pricing = resolveProductPrice(product,rules);
  const badge = pricing.rule ? (ar ? pricing.rule.badge_ar : pricing.rule.badge_en) || pricing.rule.badge_ar || pricing.rule.name_ar : null;
  return <article className={`store-product-card ${product.is_featured?'featured':''}`}>
    <div className="store-product-visual-wrap">{favoriteEnabled && <button type="button" className={`store-favorite-button ${isFavorite?'active':''}`} onClick={onFavorite} aria-label={ar ? (isFavorite?'إزالة من المفضلة':'إضافة للمفضلة') : (isFavorite?'Remove from favorites':'Save favorite')}><Heart size={18} fill={isFavorite?'currentColor':'none'}/></button>}<Link to={`/store/${product.slug || product.id}${detailSearch}`} className="store-product-visual">{product.image_url?<img src={product.image_url} alt={ar?product.name_ar:(product.name_en||product.name_ar)}/>:<span><PackageOpen size={34}/></span>}{product.is_featured&&<em><Sparkles size={12}/>{ar?'مختار':'Featured'}</em>}{badge&&<b>{badge}</b>}</Link></div>
    <div className="store-product-copy"><small>{product.sku || 'BALQEES'}</small><Link to={`/store/${product.slug || product.id}${detailSearch}`}><h2>{ar?product.name_ar:(product.name_en||product.name_ar)}</h2></Link><p>{ar?(product.short_description_ar||product.description_ar):(product.short_description_en||product.description_en||product.short_description_ar||product.description_ar)}</p>
      <div className="store-product-bottom"><div className="store-product-price">{product.price_on_request||!showPrices?<><strong>{ar?'حسب الطلب':'On request'}</strong><small>{ar?'يُراجع قبل التسعير':'Reviewed before pricing'}</small></>:<><strong>{formatSar(pricing.effective,lang)}</strong>{pricing.onSale&&<small>{formatSar(pricing.regular,lang)}</small>}</>}</div><button onClick={onAdd}>{guestLocked?<LockKeyhole size={16}/>:<ShoppingBag size={16}/>} {guestLocked?(ar?'سجّل للإضافة':'Sign in'):(product.price_on_request?(ar?'أضف لطلب السعر':'Request quote'):(ar?'إضافة':'Add'))}</button></div>
      <Link className="store-product-more" to={`/store/${product.slug || product.id}${detailSearch}`}>{ar?'عرض التفاصيل':'View details'}<Arrow size={15}/></Link>
    </div>
  </article>;
}
