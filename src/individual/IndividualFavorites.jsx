import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownUp, ArrowLeft, ArrowRight, Bell, Check, CheckCircle2,
  CircleAlert, Columns3, Eye, FolderHeart, FolderPlus, Heart, Home, Layers3,
  LoaderCircle, MessageSquareText, Minus, PackageOpen, Plus, Search, ShoppingBag,
  SlidersHorizontal, Sparkles, Store, Tag, Trash2, UserRound, X,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { formatSar, resolveProductPrice } from '../lib/storePricing';
import { useSystemSettings } from '../lib/systemSettings';
import { favoriteSnapshot, saveFavorite, updateFavoriteMeta } from '../lib/favorites';
import { recordCustomerInterest } from '../lib/customerPreferences';
import './individual-account.css';

const DEFAULT_COLLECTION = '__all__';
const UNFILED_COLLECTION = '__unfiled__';

function titleOf(product, snapshot, ar) {
  return ar ? (product?.name_ar || snapshot?.name_ar || product?.name_en || snapshot?.name_en || 'منتج بلقيس') : (product?.name_en || snapshot?.name_en || product?.name_ar || snapshot?.name_ar || 'Balqees product');
}
function unitOf(product, snapshot, ar) {
  return ar ? (product?.unit_ar || snapshot?.unit_ar || 'قطعة') : (product?.unit_en || snapshot?.unit_en || product?.unit_ar || snapshot?.unit_ar || 'piece');
}
function imageOf(product, snapshot) { return product?.image_url || snapshot?.image_url || ''; }
function categoryIdOf(product, snapshot) { return product?.category_id || snapshot?.category_id || null; }
function slugOf(product, snapshot) { return product?.slug || snapshot?.slug || product?.id || snapshot?.id || ''; }
function snapshotPrice(row) { return row?.unit_price_snapshot === null || row?.unit_price_snapshot === undefined ? null : Number(row.unit_price_snapshot); }
function normalizeText(value) { return String(value || '').trim().toLowerCase(); }

function FavoritesChrome({ lang, session, cartCount, children }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    if (!session?.user?.id || !supabase) return;
    supabase.from('customer_profiles').select('full_name').eq('id', session.user.id).maybeSingle().then(({ data }) => setProfile(data || null));
  }, [session?.user?.id]);
  useEffect(() => { document.body.classList.add('individual-account-active'); return () => document.body.classList.remove('individual-account-active'); }, []);
  const fullName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || (ar ? 'عميل بلقيس' : 'Balqees client');
  const firstName = fullName.trim().split(/\s+/)[0];
  return <div className="individual-account-app individual-favorites-app" dir={ar ? 'rtl' : 'ltr'}>
    <header className="individual-topbar"><div className="individual-shell individual-topbar-inner">
      <Link to="/" className="individual-brand"><BrandMark/></Link>
      <div className="individual-topbar-center"><span>{ar ? 'المفضلة' : 'FAVORITES'}</span><small>{ar ? 'حساب فردي' : 'INDIVIDUAL ACCOUNT'}</small></div>
      <div className="individual-top-actions">
        <button type="button" className="individual-icon-button" onClick={() => navigate('/account/notifications')} aria-label={ar ? 'الإشعارات' : 'Notifications'}><Bell size={19}/></button>
        <button type="button" className="individual-icon-button" onClick={() => navigate('/account/cart')} aria-label={ar ? 'السلة' : 'Cart'}><ShoppingBag size={19}/>{cartCount > 0 && <b>{Math.min(cartCount, 99)}</b>}</button>
        <button type="button" className="individual-profile-chip" onClick={() => navigate('/account/profile')}><span>{fullName.slice(0,1).toUpperCase()}</span><div><small>{ar ? 'مرحبًا' : 'Welcome'}</small><strong>{firstName}</strong></div></button>
      </div>
    </div></header>
    {children}
    <nav className="individual-mobile-dock">
      <Link to="/account"><Home/><span>{ar ? 'الرئيسية' : 'Home'}</span></Link>
      <Link to="/account/orders"><PackageOpen/><span>{ar ? 'طلباتي' : 'Orders'}</span></Link>
      <Link to="/store"><Store/><span>{ar ? 'المتجر' : 'Store'}</span></Link>
      <Link className="active" to="/account/favorites"><Heart/><span>{ar ? 'المفضلة' : 'Favorites'}</span></Link>
      <Link to="/account/profile"><UserRound/><span>{ar ? 'حسابي' : 'Account'}</span></Link>
    </nav>
  </div>;
}

export default function IndividualFavorites({ lang, session }) {
  const ar = lang === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const navigate = useNavigate();
  const cart = useBalqeesCart(session?.user?.id || null);
  const { settings: systemSettings } = useSystemSettings();
  const showPrices = systemSettings?.store?.showPrices !== false;

  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState(DEFAULT_COLLECTION);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('recent');
  const [editor, setEditor] = useState(null);
  const [editorCollection, setEditorCollection] = useState('');
  const [editorNote, setEditorNote] = useState('');
  const [editorBusy, setEditorBusy] = useState(false);
  const [removeRow, setRemoveRow] = useState(null);
  const [quickRow, setQuickRow] = useState(null);
  const [quickQty, setQuickQty] = useState(1);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [personalizedRecommendations, setPersonalizedRecommendations] = useState(true);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function load(silent = false) {
    if (!supabase || !session?.user?.id) return;
    silent ? setRefreshing(true) : setLoading(true);
    setError('');
    const uid = session.user.id;
    const [favoritesResult, rulesResult, categoriesResult, viewsResult, allProductsResult, preferencesResult] = await Promise.all([
      supabase.from('customer_favorites').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('price_rules').select('*').eq('is_active', true),
      supabase.from('product_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('customer_interest_events').select('product_id,event_type,created_at').eq('user_id', uid).eq('event_type', 'view').order('created_at', { ascending: false }).limit(500),
      supabase.from('products').select('*').eq('visibility','public').eq('is_active',true).order('is_featured',{ascending:false}).order('created_at',{ascending:false}).limit(120),
      supabase.from('customer_preferences').select('personalized_recommendations').eq('user_id', uid).maybeSingle(),
    ]);
    const favoriteRows = favoritesResult.data || [];
    const ids = favoriteRows.map(row => row.product_id).filter(Boolean);
    const productResult = ids.length
      ? await supabase.from('products').select('*').in('id', ids)
      : { data: [], error: null };
    if (favoritesResult.error || rulesResult.error || categoriesResult.error || productResult.error) {
      setError(ar ? 'تعذر تحميل جزء من المفضلة الآن. يمكنك التحديث والمحاولة مرة أخرى.' : 'Some favorite data could not be loaded. Refresh and try again.');
    }
    setRows(favoriteRows);
    setRules(rulesResult.data || []);
    setCategories(categoriesResult.data || []);
    setViews(viewsResult.data || []);
    setProducts(productResult.data || []);
    setAllProducts(allProductsResult.data || []);
    setPersonalizedRecommendations(preferencesResult.data?.personalized_recommendations !== false);
    setLoading(false); setRefreshing(false);

    // Backfill a lightweight snapshot for older favorites created before v10.16.
    const productMap = Object.fromEntries((productResult.data || []).map(p => [String(p.id), p]));
    const backfills = favoriteRows.filter(row => {
      const product = productMap[String(row.product_id)];
      return product && (!row.product_snapshot || !Object.keys(row.product_snapshot).length || row.unit_price_snapshot === null || row.unit_price_snapshot === undefined);
    });
    if (backfills.length) {
      const now = new Date().toISOString();
      await Promise.all(backfills.map(row => {
        const product = productMap[String(row.product_id)];
        const price = resolveProductPrice(product, rulesResult.data || []).effective;
        return supabase.from('customer_favorites').update({
          product_snapshot: favoriteSnapshot(product),
          unit_price_snapshot: price,
          price_snapshot_at: price === null || price === undefined ? null : now,
          updated_at: now,
        }).eq('user_id', uid).eq('product_id', row.product_id);
      }));
      setRows(current => current.map(row => {
        const product = productMap[String(row.product_id)];
        if (!product || (row.product_snapshot && Object.keys(row.product_snapshot).length && row.unit_price_snapshot !== null && row.unit_price_snapshot !== undefined)) return row;
        const price = resolveProductPrice(product, rulesResult.data || []).effective;
        return { ...row, product_snapshot: favoriteSnapshot(product), unit_price_snapshot: price, price_snapshot_at: price === null || price === undefined ? null : now, updated_at: now };
      }));
    }
  }

  useEffect(() => { load(); }, [session?.user?.id]);

  const productMap = useMemo(() => Object.fromEntries(products.map(product => [String(product.id), product])), [products]);
  const categoryMap = useMemo(() => Object.fromEntries(categories.map(item => [String(item.id), item])), [categories]);
  const viewCounts = useMemo(() => views.reduce((map, event) => { if (event.product_id) map[String(event.product_id)] = (map[String(event.product_id)] || 0) + 1; return map; }, {}), [views]);
  const hydrated = useMemo(() => rows.map(row => {
    const product = productMap[String(row.product_id)] || null;
    const snapshot = row.product_snapshot || {};
    const pricing = product ? resolveProductPrice(product, rules) : { regular: snapshotPrice(row), effective: null, onSale: false };
    const currentPrice = product && !product.price_on_request ? pricing.effective : null;
    const savedPrice = snapshotPrice(row);
    return {
      ...row, product, snapshot, pricing, currentPrice, savedPrice,
      available: !!product,
      categoryId: categoryIdOf(product, snapshot),
      title: titleOf(product, snapshot, ar),
      image: imageOf(product, snapshot),
      unit: unitOf(product, snapshot, ar),
      slug: slugOf(product, snapshot),
      views: viewCounts[String(row.product_id)] || 0,
    };
  }), [rows, productMap, rules, ar, viewCounts]);

  const collections = useMemo(() => {
    const values = [...new Set(rows.map(row => row.collection_name?.trim()).filter(Boolean))];
    return values.sort((a,b) => a.localeCompare(b, ar ? 'ar' : 'en'));
  }, [rows, ar]);

  const favoriteCategoryIds = useMemo(() => [...new Set(hydrated.map(row => row.categoryId).filter(Boolean))], [hydrated]);
  const filtered = useMemo(() => {
    const q = normalizeText(query);
    let list = hydrated.filter(row => {
      if (collection === UNFILED_COLLECTION && row.collection_name) return false;
      if (collection !== DEFAULT_COLLECTION && collection !== UNFILED_COLLECTION && row.collection_name !== collection) return false;
      if (category !== 'all' && row.categoryId !== category) return false;
      if (q) {
        const categoryName = categoryMap[String(row.categoryId)];
        const hay = normalizeText(`${row.title} ${row.note || ''} ${row.collection_name || ''} ${categoryName?.name_ar || ''} ${categoryName?.name_en || ''} ${(row.product?.tags || row.snapshot?.tags || []).join(' ')}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...list].sort((a,b) => {
      if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (sort === 'price-low') return Number(a.currentPrice ?? Infinity) - Number(b.currentPrice ?? Infinity);
      if (sort === 'price-high') return Number(b.currentPrice ?? -1) - Number(a.currentPrice ?? -1);
      if (sort === 'views') return b.views - a.views || new Date(b.created_at) - new Date(a.created_at);
      if (sort === 'offers') return Number(b.pricing?.onSale) - Number(a.pricing?.onSale) || new Date(b.created_at) - new Date(a.created_at);
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [hydrated, collection, category, query, sort, categoryMap]);

  const recent = useMemo(() => hydrated.slice(0, 4), [hydrated]);

  const recommendations = useMemo(() => {
    if (!personalizedRecommendations) return [];
    const favoriteIds = new Set(rows.map(row => String(row.product_id)));
    const wantedCategories = new Set(hydrated.map(row => row.categoryId).filter(Boolean));
    const wantedTags = new Set(hydrated.flatMap(row => row.product?.tags || row.snapshot?.tags || []).map(normalizeText).filter(Boolean));
    const prices = hydrated.map(row => row.currentPrice ?? row.savedPrice).filter(value => value !== null && value !== undefined).map(Number).filter(Number.isFinite);
    const median = prices.length ? [...prices].sort((a,b) => a-b)[Math.floor(prices.length / 2)] : null;
    const allCandidates = allProducts.filter(product => !favoriteIds.has(String(product.id)));
    return allCandidates.map(product => {
      const pricing = resolveProductPrice(product, rules);
      let score = 0;
      if (wantedCategories.has(product.category_id)) score += 5;
      (product.tags || []).forEach(tag => { if (wantedTags.has(normalizeText(tag))) score += 2; });
      if (median !== null && pricing.effective !== null && Math.abs(Number(pricing.effective) - median) <= Math.max(50, median * .25)) score += 2;
      if (product.is_featured) score += 1;
      return { product, pricing, score };
    }).filter(item => item.score > 0).sort((a,b) => b.score - a.score || new Date(b.product.created_at) - new Date(a.product.created_at)).slice(0,3);
  }, [allProducts, rows, hydrated, rules, personalizedRecommendations]);

  async function removeFavorite(row) {
    if (!row) return;
    const { error: removeError } = await supabase.from('customer_favorites').delete().eq('user_id', session.user.id).eq('product_id', row.product_id);
    if (removeError) return setToast(ar ? 'تعذر حذف المنتج من المفضلة.' : 'Could not remove this favorite.');
    setRows(current => current.filter(item => item.product_id !== row.product_id));
    if (row.product) recordCustomerInterest({ user_id: session.user.id, event_type: 'unfavorite', product_id: row.product.id, category_id: row.product.category_id || null, metadata: { source: 'favorites_page' } });
    setRemoveRow(null);
    setToast(ar ? 'تمت إزالة المنتج من المفضلة.' : 'Removed from favorites.');
  }

  function addToCart(row, quantity = null) {
    if (!row?.product) return setToast(ar ? 'هذا المنتج غير متاح حاليًا.' : 'This product is currently unavailable.');
    const product = row.product;
    const qty = quantity ?? Number(product.min_order_quantity || 1);
    cart.add(product, qty, { unit_price_snapshot: row.currentPrice });
    setToast(ar ? 'تمت إضافته للسلة — وبقي محفوظًا في مفضلتك.' : 'Added to cart — and kept in your favorites.');
  }

  async function addCollectionToCart() {
    const source = collection === DEFAULT_COLLECTION
      ? hydrated
      : hydrated.filter(row => collection === UNFILED_COLLECTION ? !row.collection_name : row.collection_name === collection);
    const available = source.filter(row => row.product);
    if (!available.length) return setToast(ar ? 'لا توجد منتجات متاحة في هذه المجموعة الآن.' : 'There are no available products in this collection right now.');
    available.forEach(row => cart.add(row.product, row.product.min_order_quantity || 1, { unit_price_snapshot: row.currentPrice }));
    const unavailable = source.length - available.length;
    setToast(unavailable ? (ar ? `أضفنا ${available.length} منتجًا متاحًا للسلة، وتركنا ${unavailable} غير متاح.` : `Added ${available.length} available item(s); ${unavailable} unavailable item(s) were left out.`) : (ar ? 'أضفنا المنتجات المتاحة إلى السلة.' : 'Available products were added to cart.'));
  }

  function openEditor(row) {
    setEditor(row); setEditorCollection(row.collection_name || ''); setEditorNote(row.note || '');
  }

  async function saveEditor() {
    if (!editor) return;
    setEditorBusy(true);
    const result = await updateFavoriteMeta({ userId: session.user.id, productId: editor.product_id, collectionName: editorCollection, note: editorNote });
    setEditorBusy(false);
    if (result.error) return setToast(ar ? 'تعذر حفظ التعديل.' : 'Could not save changes.');
    setRows(current => current.map(row => row.product_id === editor.product_id ? { ...row, collection_name: editorCollection.trim() || null, note: editorNote.trim() || null, updated_at: new Date().toISOString() } : row));
    setEditor(null); setToast(ar ? 'تم حفظ تنظيم المفضلة.' : 'Favorite organization saved.');
  }

  function openQuick(row) {
    if (!row?.product) return;
    setQuickRow(row); setQuickQty(Number(row.product.min_order_quantity || 1));
  }

  function toggleCompare(row) {
    if (!row.available) return;
    setCompareIds(current => {
      const id = String(row.product_id);
      if (current.includes(id)) return current.filter(x => x !== id);
      const selectedRows = hydrated.filter(item => current.includes(String(item.product_id)));
      if (selectedRows.length && selectedRows[0].categoryId !== row.categoryId) {
        setToast(ar ? 'المقارنة السريعة تكون بين منتجات من نفس الفئة.' : 'Quick comparison works between products in the same category.');
        return current;
      }
      if (current.length >= 3) {
        setToast(ar ? 'اختر حتى 3 منتجات للمقارنة.' : 'Choose up to 3 products to compare.');
        return current;
      }
      return [...current, id];
    });
  }

  const compared = useMemo(() => hydrated.filter(row => compareIds.includes(String(row.product_id))), [hydrated, compareIds]);
  const comparisonCategory = compared[0]?.categoryId || null;
  const canCompare = filtered.filter(row => row.available).length >= 2;

  if (loading) return <FavoritesChrome lang={lang} session={session} cartCount={cart.count}><main className="individual-main individual-shell"><div className="individual-loading-state"><LoaderCircle className="spin" size={24}/><strong>{ar ? 'نرتب مفضلتك…' : 'Organizing your favorites…'}</strong><span>{ar ? 'نراجع الأسعار والتوفر والقوائم المحفوظة.' : 'Checking prices, availability and saved collections.'}</span></div></main></FavoritesChrome>;

  return <FavoritesChrome lang={lang} session={session} cartCount={cart.count}>
    <main className="individual-main individual-shell individual-favorites-main">
      <section className="individual-favorites-head">
        <div><span className="individual-overline"><Heart size={14}/>{ar ? 'YOUR SAVED EDIT' : 'YOUR SAVED EDIT'}</span><h1>{ar ? 'مفضلتي' : 'My favorites'}</h1><p>{ar ? 'احتفظ بالأشياء التي أعجبتك، رتّبها بطريقتك، وارجع لها عندما يحين وقت القرار.' : 'Keep what caught your eye, organize it your way, and return when the time feels right.'}</p></div>
        <div className="individual-favorites-head-meta"><span><Heart size={14}/>{rows.length}</span><button className="individual-refresh" type="button" onClick={() => load(true)} disabled={refreshing}><LoaderCircle className={refreshing ? 'spin' : ''} size={15}/>{ar ? 'تحديث' : 'Refresh'}</button></div>
      </section>

      {error && <div className="individual-system-note"><CircleAlert size={15}/><span>{error}</span></div>}

      {!rows.length ? <EmptyFavorites lang={lang} categories={categories.slice(0,3)}/> : <>
        {rows.length >= 7 && recent.length > 0 && <section className="individual-favorites-recent">
          <div className="individual-section-heading"><div><span>{ar ? 'أضيف مؤخرًا' : 'RECENTLY SAVED'}</span><h2>{ar ? 'آخر ما حفظت' : 'Recently saved'}</h2></div></div>
          <div className="individual-favorites-recent-strip">{recent.map(row => <button key={row.product_id} onClick={() => openQuick(row)} className={!row.available ? 'unavailable' : ''}>{row.image ? <img src={row.image} alt=""/> : <PackageOpen/>}<span><strong>{row.title}</strong><small>{row.available ? (row.currentPrice !== null && showPrices ? formatSar(row.currentPrice, lang) : (ar ? 'متاح' : 'Available')) : (ar ? 'غير متاح حاليًا' : 'Unavailable')}</small></span></button>)}</div>
        </section>}

        <section className="individual-favorites-collections">
          <div className="individual-section-heading"><div><span>{ar ? 'COLLECTIONS' : 'COLLECTIONS'}</span><h2>{ar ? 'قوائمك' : 'Your collections'}</h2></div><button className="individual-favorites-all-cart" onClick={addCollectionToCart}><ShoppingBag size={15}/>{ar ? 'أضف المتاح للسلة' : 'Add available to cart'}</button></div>
          <div className="individual-favorites-collection-pills">
            <button className={collection === DEFAULT_COLLECTION ? 'active' : ''} onClick={() => setCollection(DEFAULT_COLLECTION)}><Layers3 size={14}/><span>{ar ? 'كل المفضلة' : 'All favorites'}</span><b>{rows.length}</b></button>
            {collections.map(name => <button key={name} className={collection === name ? 'active' : ''} onClick={() => setCollection(name)}><FolderHeart size={14}/><span>{name}</span><b>{rows.filter(row => row.collection_name === name).length}</b></button>)}
            {rows.some(row => !row.collection_name) && <button className={collection === UNFILED_COLLECTION ? 'active' : ''} onClick={() => setCollection(UNFILED_COLLECTION)}><FolderPlus size={14}/><span>{ar ? 'بدون قائمة' : 'Unfiled'}</span><b>{rows.filter(row => !row.collection_name).length}</b></button>}
          </div>
          <p className="individual-favorites-collections-hint"><Sparkles size={13}/>{ar ? 'لإنشاء قائمة جديدة: افتح «تنظيم» لأي منتج واكتب اسم القائمة الجديدة.' : 'To create a new collection, open Organize on any favorite and enter a new collection name.'}</p>
        </section>

        <section className="individual-favorites-toolbar">
          <div className="individual-favorites-search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? 'ابحث في مفضلتك…' : 'Search your favorites…'}/>{query && <button onClick={() => setQuery('')}><X size={14}/></button>}</div>
          <button className={`individual-favorites-filter-toggle ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(v => !v)}><SlidersHorizontal size={16}/>{ar ? 'تصفية وترتيب' : 'Filter & sort'}</button>
          {canCompare && <button className={`individual-favorites-compare-toggle ${compareMode ? 'active' : ''}`} onClick={() => { setCompareMode(v => !v); if (compareMode) setCompareIds([]); }}><Columns3 size={16}/>{ar ? 'قارن الخيارات' : 'Compare options'}</button>}
          {compareIds.length >= 2 && <button className="individual-favorites-compare-ready" onClick={() => setCompareOpen(true)}><CheckCircle2 size={15}/>{ar ? `عرض المقارنة (${compareIds.length})` : `Compare (${compareIds.length})`}</button>}
        </section>

        {showFilters && <section className="individual-favorites-filters">
          <label><span>{ar ? 'الفئة' : 'Category'}</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">{ar ? 'كل الفئات' : 'All categories'}</option>{favoriteCategoryIds.map(id => { const item = categoryMap[String(id)]; return <option value={id} key={id}>{item ? (ar ? item.name_ar : item.name_en || item.name_ar) : (ar ? 'فئة أخرى' : 'Other')}</option>; })}</select></label>
          <label><span>{ar ? 'الترتيب' : 'Sort'}</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="recent">{ar ? 'الأحدث أولًا' : 'Newest first'}</option><option value="oldest">{ar ? 'الأقدم' : 'Oldest'}</option><option value="price-low">{ar ? 'السعر: الأقل' : 'Price: low to high'}</option><option value="price-high">{ar ? 'السعر: الأعلى' : 'Price: high to low'}</option><option value="views">{ar ? 'الأكثر مشاهدة عندي' : 'Most viewed by me'}</option><option value="offers">{ar ? 'العروض أولًا' : 'Offers first'}</option></select></label>
        </section>}

        <section className="individual-favorites-content">
          <div className="individual-favorites-content-head"><div><small>{collection === DEFAULT_COLLECTION ? (ar ? 'كل العناصر المحفوظة' : 'ALL SAVED ITEMS') : (collection === UNFILED_COLLECTION ? (ar ? 'غير مصنفة' : 'UNFILED') : collection)}</small><h2>{ar ? `${filtered.length} ${filtered.length === 1 ? 'اختيار محفوظ' : 'اختيارات محفوظة'}` : `${filtered.length} saved item${filtered.length === 1 ? '' : 's'}`}</h2></div>{compareMode && <span>{ar ? 'اختر 2–3 منتجات من نفس الفئة' : 'Choose 2–3 items from the same category'}</span>}</div>
          {filtered.length ? <div className="individual-favorites-grid">{filtered.map(row => <FavoriteCard key={row.product_id} row={row} lang={lang} showPrices={showPrices} compareMode={compareMode} selected={compareIds.includes(String(row.product_id))} comparisonCategory={comparisonCategory} onCompare={() => toggleCompare(row)} onAdd={() => addToCart(row)} onRemove={() => setRemoveRow(row)} onEdit={() => openEditor(row)} onQuick={() => openQuick(row)} />)}</div> : <div className="individual-favorites-no-results"><Search size={26}/><strong>{ar ? 'ما لقينا شيئًا بهذا التحديد' : 'Nothing matches this view'}</strong><p>{ar ? 'غيّر البحث أو الفئة أو ارجع لكل المفضلة.' : 'Change the search, category, or return to all favorites.'}</p><button onClick={() => { setQuery(''); setCategory('all'); setCollection(DEFAULT_COLLECTION); }}>{ar ? 'إظهار الكل' : 'Show all'}</button></div>}
        </section>

        {recommendations.length > 0 && <section className="individual-favorites-taste">
          <div className="individual-section-heading"><div><span>{ar ? 'CALM DISCOVERY' : 'CALM DISCOVERY'}</span><h2>{ar ? 'قد يناسب ذوقك' : 'May fit your taste'}</h2><p>{ar ? 'ثلاثة اقتراحات فقط مرتبطة بما حفظته — بدون سيل منتجات.' : 'Only three suggestions related to what you saved — no endless carousel.'}</p></div></div>
          <div className="individual-favorites-taste-grid">{recommendations.map(({ product, pricing }) => <article key={product.id}><Link to={`/store/${product.slug || product.id}`} className="visual">{product.image_url ? <img src={product.image_url} alt={titleOf(product,{},ar)}/> : <PackageOpen/>}</Link><div><small>{categoryMap[String(product.category_id)] ? (ar ? categoryMap[String(product.category_id)].name_ar : categoryMap[String(product.category_id)].name_en || categoryMap[String(product.category_id)].name_ar) : 'BALQEES'}</small><Link to={`/store/${product.slug || product.id}`}><strong>{titleOf(product,{},ar)}</strong></Link>{showPrices && !product.price_on_request && <span>{formatSar(pricing.effective,lang)}</span>}</div><button onClick={async () => { const result = await saveFavorite({ userId: session.user.id, product, unitPrice: pricing.effective }); if (result.error) return setToast(ar ? 'تعذر الحفظ.' : 'Could not save.'); setToast(ar ? 'أضفناه لمفضلتك.' : 'Saved to favorites.'); load(true); }}><Heart size={15}/>{ar ? 'حفظ' : 'Save'}</button></article>)}</div>
        </section>}
      </>}
    </main>

    {toast && <div className="individual-toast"><Check size={14}/><span>{toast}</span>{cart.count > 0 && <button onClick={() => navigate('/account/cart')}>{ar ? 'عرض السلة' : 'View cart'}</button>}</div>}

    {editor && <div className="individual-modal-overlay" onMouseDown={e => e.target === e.currentTarget && setEditor(null)}><section className="individual-favorite-editor"><button className="individual-modal-close" onClick={() => setEditor(null)}><X size={17}/></button><span><FolderHeart size={24}/></span><small>{ar ? 'ORGANIZE FAVORITE' : 'ORGANIZE FAVORITE'}</small><h3>{editor.title}</h3><label><span>{ar ? 'القائمة' : 'Collection'}</span><input list="favorite-collections" value={editorCollection} maxLength={80} onChange={e => setEditorCollection(e.target.value)} placeholder={ar ? 'مثال: للمنزل' : 'Example: Home ideas'}/><datalist id="favorite-collections">{collections.map(name => <option key={name} value={name}/>)}</datalist><small>{ar ? 'اتركها فارغة لإبقائه ضمن كل المفضلة فقط.' : 'Leave blank to keep it only in All favorites.'}</small></label><label><span>{ar ? 'لماذا حفظته؟' : 'Why did you save it?'}</span><textarea value={editorNote} maxLength={240} onChange={e => setEditorNote(e.target.value)} placeholder={ar ? 'ملاحظة اختيارية: للصالة، ممكن هدية، أعجبني اللون…' : 'Optional note: living room, possible gift, liked the color…'}/><small>{editorNote.length}/240</small></label><button className="individual-favorite-editor-save" onClick={saveEditor} disabled={editorBusy}>{editorBusy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>} {ar ? 'حفظ التنظيم' : 'Save organization'}</button></section></div>}

    {removeRow && <div className="individual-modal-overlay" onMouseDown={e => e.target === e.currentTarget && setRemoveRow(null)}><section className="individual-favorite-remove"><button className="individual-modal-close" onClick={() => setRemoveRow(null)}><X size={17}/></button><span><Heart size={24}/></span><h3>{ar ? 'إزالة من المفضلة؟' : 'Remove from favorites?'}</h3><p>{ar ? 'سيختفي من قوائمك المحفوظة، ولن يتأثر إذا كان موجودًا في السلة.' : 'It will disappear from your saved lists. Anything already in cart stays there.'}</p><div><button className="ghost" onClick={() => setRemoveRow(null)}>{ar ? 'إبقاء' : 'Keep'}</button><button className="danger" onClick={() => removeFavorite(removeRow)}><Trash2 size={15}/>{ar ? 'إزالة' : 'Remove'}</button></div></section></div>}

    {quickRow && <div className="individual-modal-overlay individual-quick-overlay" onMouseDown={e => e.target === e.currentTarget && setQuickRow(null)}><section className="individual-favorite-quick"><button className="individual-modal-close" onClick={() => setQuickRow(null)}><X size={17}/></button><div className="individual-favorite-quick-visual">{quickRow.image ? <img src={quickRow.image} alt=""/> : <PackageOpen size={34}/>}</div><div className="individual-favorite-quick-copy"><small>{ar ? 'QUICK VIEW' : 'QUICK VIEW'}</small><h3>{quickRow.title}</h3>{quickRow.product?.short_description_ar && <p>{ar ? quickRow.product.short_description_ar : (quickRow.product.short_description_en || quickRow.product.short_description_ar)}</p>}<div className="individual-favorite-quick-price">{showPrices && quickRow.currentPrice !== null ? <strong>{formatSar(quickRow.currentPrice,lang)}</strong> : <strong>{ar ? 'السعر حسب الطلب' : 'Price on request'}</strong>}<span>{quickRow.unit}</span></div><div className="individual-favorite-quick-actions"><div className="individual-favorite-qty"><button disabled={quickQty <= Number(quickRow.product?.min_order_quantity || 1)} onClick={() => setQuickQty(v => Math.max(Number(quickRow.product?.min_order_quantity || 1), Number(v)-1))}><Minus size={14}/></button><span>{quickQty}</span><button disabled={(quickRow.product?.max_order_quantity && quickQty >= Number(quickRow.product.max_order_quantity)) || (quickRow.product?.stock_mode === 'tracked' && quickQty >= Number(quickRow.product.stock_quantity || 0))} onClick={() => setQuickQty(v => Number(v)+1)}><Plus size={14}/></button></div><button className="add" onClick={() => { addToCart(quickRow, quickQty); setQuickRow(null); }}><ShoppingBag size={16}/>{ar ? 'أضف للسلة' : 'Add to cart'}</button></div><Link className="details" to={`/store/${quickRow.slug}`}><Eye size={15}/>{ar ? 'عرض صفحة المنتج' : 'Open product page'}<Arrow size={14}/></Link></div></section></div>}

    {compareOpen && compared.length >= 2 && <div className="individual-modal-overlay" onMouseDown={e => e.target === e.currentTarget && setCompareOpen(false)}><section className="individual-favorite-compare"><button className="individual-modal-close" onClick={() => setCompareOpen(false)}><X size={17}/></button><div className="individual-favorite-compare-head"><span><Columns3 size={20}/></span><div><small>{ar ? 'QUICK COMPARISON' : 'QUICK COMPARISON'}</small><h3>{ar ? 'قارن اختياراتك بهدوء' : 'Compare your choices calmly'}</h3><p>{ar ? 'فقط المعلومات التي تساعد القرار — بدون جدول ضخم.' : 'Only the details that help your decision — no oversized spec table.'}</p></div></div><div className={`individual-favorite-compare-grid cols-${compared.length}`}>{compared.map(row => <article key={row.product_id}>{row.image ? <img src={row.image} alt=""/> : <div className="placeholder"><PackageOpen/></div>}<strong>{row.title}</strong><dl><div><dt>{ar ? 'السعر' : 'Price'}</dt><dd>{row.currentPrice !== null && showPrices ? formatSar(row.currentPrice,lang) : (ar ? 'حسب الطلب' : 'On request')}</dd></div><div><dt>{ar ? 'الوحدة' : 'Unit'}</dt><dd>{row.unit}</dd></div><div><dt>{ar ? 'التوفر' : 'Availability'}</dt><dd>{row.available ? (ar ? 'متاح' : 'Available') : (ar ? 'غير متاح' : 'Unavailable')}</dd></div>{row.note && <div><dt>{ar ? 'ملاحظتك' : 'Your note'}</dt><dd>{row.note}</dd></div>}</dl><button onClick={() => addToCart(row)} disabled={!row.available}><ShoppingBag size={14}/>{ar ? 'أضف للسلة' : 'Add to cart'}</button></article>)}</div></section></div>}
  </FavoritesChrome>;
}

function FavoriteCard({ row, lang, showPrices, compareMode, selected, comparisonCategory, onCompare, onAdd, onRemove, onEdit, onQuick }) {
  const ar = lang === 'ar';
  const categoryMismatch = compareMode && comparisonCategory && row.categoryId !== comparisonCategory && !selected;
  const priceDiff = row.currentPrice !== null && row.savedPrice !== null ? Number((row.currentPrice - row.savedPrice).toFixed(2)) : 0;
  const priceDown = priceDiff < -0.009;
  const priceUp = priceDiff > 0.009;
  return <article className={`individual-favorite-card ${!row.available ? 'unavailable' : ''} ${selected ? 'selected' : ''}`}>
    <div className="individual-favorite-card-visual">
      {row.image ? <img src={row.image} alt={row.title}/> : <span><PackageOpen size={31}/></span>}
      {row.pricing?.onSale && row.available && <em><Tag size={11}/>{ar ? 'عرض متاح الآن' : 'Offer available'}</em>}
      {!row.available && <em className="offline"><CircleAlert size={11}/>{ar ? 'غير متاح حاليًا' : 'Unavailable now'}</em>}
      {compareMode && <button className="individual-favorite-compare-pick" disabled={categoryMismatch} onClick={onCompare}>{selected ? <Check size={14}/> : <Columns3 size={14}/>}<span>{selected ? (ar ? 'مختار' : 'Selected') : (ar ? 'للمقارنة' : 'Compare')}</span></button>}
      {row.available && <button className="individual-favorite-quick-open" onClick={onQuick}><Eye size={16}/></button>}
    </div>
    <div className="individual-favorite-card-copy">
      <div className="individual-favorite-card-kicker"><span>{row.collection_name || (ar ? 'مفضلتك' : 'Favorites')}</span>{row.views > 1 && <small><Eye size={11}/>{row.views}</small>}</div>
      {row.available ? <Link to={`/store/${row.slug}`}><h3>{row.title}</h3></Link> : <h3>{row.title}</h3>}
      {row.note && <p className="individual-favorite-note"><MessageSquareText size={12}/>{row.note}</p>}
      <div className="individual-favorite-price">
        {row.available && row.product?.price_on_request ? <strong>{ar ? 'السعر حسب الطلب' : 'Price on request'}</strong> : row.currentPrice !== null && showPrices ? <><strong>{formatSar(row.currentPrice, lang)}</strong>{row.pricing?.onSale && row.pricing.regular !== null && <del>{formatSar(row.pricing.regular, lang)}</del>}</> : <strong className="muted">{row.available ? (ar ? 'السعر يظهر عند الطلب' : 'Price shown on request') : (ar ? 'آخر سعر محفوظ' : 'Last saved price')}</strong>}
      </div>
      {(priceDown || priceUp) && row.available && <div className={`individual-favorite-price-change ${priceDown ? 'down' : 'up'}`}><ArrowDownUp size={12}/><span>{priceDown ? (ar ? `انخفض السعر منذ حفظه — كان ${formatSar(row.savedPrice,lang)}` : `Price dropped since you saved it — was ${formatSar(row.savedPrice,lang)}`) : (ar ? `تم تحديث السعر — كان ${formatSar(row.savedPrice,lang)}` : `Price updated — was ${formatSar(row.savedPrice,lang)}`)}</span></div>}
      {!row.available && row.savedPrice !== null && showPrices && <div className="individual-favorite-last-price">{ar ? 'آخر سعر محفوظ:' : 'Last saved price:'} <strong>{formatSar(row.savedPrice,lang)}</strong></div>}
      <div className="individual-favorite-card-actions"><button className="primary" onClick={row.available ? onAdd : () => {}} disabled={!row.available}><ShoppingBag size={15}/>{row.available ? (ar ? 'أضف للسلة' : 'Add to cart') : (ar ? 'غير متاح' : 'Unavailable')}</button><button className="organize" onClick={onEdit}><FolderHeart size={15}/>{ar ? 'تنظيم' : 'Organize'}</button><button className="remove" onClick={onRemove} aria-label={ar ? 'إزالة من المفضلة' : 'Remove favorite'}><Trash2 size={15}/></button></div>
      {!row.available && <Link to={`/store${row.categoryId ? `?category=${encodeURIComponent(row.categoryId)}` : ''}`} className="individual-favorite-alternatives"><Sparkles size={14}/>{ar ? 'اعرض بدائل مشابهة' : 'See similar alternatives'}</Link>}
    </div>
  </article>;
}

function EmptyFavorites({ lang, categories }) {
  const ar = lang === 'ar';
  return <section className="individual-favorites-empty"><div className="individual-favorites-empty-mark"><Heart size={36}/><Sparkles size={15}/></div><span>{ar ? 'مساحة اختياراتك' : 'YOUR SAVED SPACE'}</span><h2>{ar ? 'احفظ الأشياء التي تعجبك هنا' : 'Save the things you like here'}</h2><p>{ar ? 'اضغط ♡ على أي منتج في المتجر، وسيبقى هنا للرجوع إليه والمقارنة والشراء لاحقًا.' : 'Tap ♡ on any store product and it will stay here for later comparison and purchase.'}</p><Link to="/store" className="individual-favorites-empty-main"><Store size={17}/>{ar ? 'اكتشف المتجر' : 'Discover store'}</Link>{categories.length > 0 && <div className="individual-favorites-empty-categories">{categories.map(category => <Link key={category.id} to={`/store?category=${encodeURIComponent(category.id)}`}>{ar ? category.name_ar : category.name_en || category.name_ar}</Link>)}</div>}</section>;
}
