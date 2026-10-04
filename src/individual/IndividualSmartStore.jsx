import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Bell, Check, ChevronLeft, ChevronRight, CircleDollarSign,
  Clock3, Filter, Flower2, Gift, Heart, Home, Layers, LoaderCircle, PackageOpen,
  PackageSearch, Plus, Search, ShoppingBag, SlidersHorizontal, Sparkles, Store,
  Tag, UserRound, WandSparkles, X,
} from 'lucide-react';
import { useSystemSettings } from '../lib/systemSettings';
import useLiveDataRefresh from '../lib/useLiveDataRefresh';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { formatSar, resolveProductPrice } from '../lib/storePricing';
import { removeFavorite, saveFavorite } from '../lib/favorites';
import {
  cacheCustomerPreferences, loadCustomerPreferences, normalizeCustomerPreferences,
  recordCustomerInterest,
} from '../lib/customerPreferences';
import { getSaudiSeason } from '../lib/season';
import {
  SMART_BUDGET_BANDS, SMART_STORE_OCCASIONS, SMART_STORE_STYLES,
  buildTasteProfile, budgetBandMatch, extractSmartSearchIntent, isGiftAssistantProduct,
  normalizeSmartText, occasionLabel, productAvailability, productIsOnOffer,
  productKind, productMatchesOccasion, productMatchesStyle, productSearchText,
  scoreProductForIntent, tasteScore,
} from '../lib/smartStore';
import './individual-account.css';
import './individual-smart-store.css';

const ORDER_DONE = new Set(['delivered','completed']);
const SEASON_COPY = {
  ramadan: { ar:['رمضان في بلقيس','هدايا وباقات هادئة للموسم، من المنتجات المتاحة فعلًا.'], en:['Ramadan at Balqees','Calm seasonal bouquets and gifts from the real catalog.'] },
  eid: { ar:['عيد الفطر','جهّز هديتك بهدوء واختصر الخيارات حسب ميزانيتك.'], en:['Eid al-Fitr','Prepare your gift with fewer, budget-aware choices.'] },
  adha: { ar:['عيد الأضحى','اختيارات موسمية أنيقة، بدون ازدحام أو عروض مصطنعة.'], en:['Eid al-Adha','Elegant seasonal choices without clutter or artificial urgency.'] },
  hajj: { ar:['موسم الحج','هدايا ترحيب وتقدير من الكتالوج المتاح.'], en:['Hajj season','Welcome and appreciation gifts from the available catalog.'] },
  default: { ar:['وش تدور عليه اليوم؟','خلّ بلقيس يختصر عليك الوصول للهدية أو الباقة المناسبة.'], en:['What are you looking for today?','Let Balqees narrow the catalog to the bouquet or gift that fits.'] },
};

const budgetRangeFromKey = key => {
  const direct = SMART_BUDGET_BANDS.find(item => item.key === key);
  if (direct) return { min: direct.min, max: direct.max };
  if (key === '150_300') return { min: 150, max: 300 };
  if (key === '300_500') return { min: 300, max: 500 };
  if (key === '500_plus') return { min: 500, max: Infinity };
  if (key === 'under_150') return { min: 0, max: 150 };
  return { min: null, max: null };
};
const daysUntil = value => value ? Math.ceil((new Date(`${value}T12:00:00`).getTime() - Date.now()) / 86400000) : null;
const unique = rows => Array.from(new Map((rows || []).filter(Boolean).map(row => [String(row.id), row])).values());

function useProfile(uid) {
  const [profile,setProfile] = useState(null);
  useEffect(()=>{ if(!uid)return; let live=true; supabase.from('customer_profiles').select('id,full_name,email,phone').eq('id',uid).maybeSingle().then(({data})=>live&&setProfile(data||null)); return()=>{live=false;}; },[uid]);
  return profile;
}

function SmartStoreChrome({ lang, session, cart, children }) {
  const ar = lang === 'ar'; const navigate = useNavigate(); const profile = useProfile(session?.user?.id);
  const fullName = profile?.full_name || session?.user?.email?.split('@')[0] || (ar?'عميل بلقيس':'Balqees client');
  const firstName = fullName.trim().split(/\s+/)[0];
  return <div className="individual-account-app smart-store-account" dir={ar?'rtl':'ltr'}>
    <header className="individual-topbar"><div className="individual-shell individual-topbar-inner"><Link to="/" className="individual-brand"><BrandMark/></Link><div className="individual-topbar-center"><span>{ar?'المتجر الذكي':'SMART STORE'}</span><small>{ar?'حساب فردي':'INDIVIDUAL ACCOUNT'}</small></div><div className="individual-top-actions"><button type="button" className="individual-icon-button" onClick={()=>navigate('/account/notifications')} aria-label={ar?'الإشعارات':'Notifications'}><Bell size={19}/></button><button type="button" className="individual-icon-button" onClick={()=>navigate('/account/cart')} aria-label={ar?'السلة':'Cart'}><ShoppingBag size={19}/>{cart.count>0&&<b>{Math.min(cart.count,99)}</b>}</button><button type="button" className="individual-profile-chip" onClick={()=>navigate('/account/profile')}><span>{fullName.slice(0,1).toUpperCase()}</span><div><small>{ar?'مرحبًا':'Welcome'}</small><strong>{firstName}</strong></div></button></div></div></header>
    {children}
    <nav className="individual-mobile-dock"><Link to="/account"><Home/><span>{ar?'الرئيسية':'Home'}</span></Link><Link to="/account/orders"><PackageSearch/><span>{ar?'طلباتي':'Orders'}</span></Link><Link className="active" to="/store"><Store/><span>{ar?'المتجر':'Store'}</span></Link><Link to="/account/favorites"><Heart/><span>{ar?'المفضلة':'Favorites'}</span></Link><Link to="/account/profile"><UserRound/><span>{ar?'حسابي':'Account'}</span></Link></nav>
  </div>;
}

function productLabel(product, ar){ return ar ? product.name_ar : (product.name_en || product.name_ar); }
function categoryLabel(category, ar){ return category ? (ar ? category.name_ar : (category.name_en || category.name_ar)) : ''; }

function budgetCeiling(preferences) {
  const value = Number(preferences?.store_budget_limit || 0);
  if (!value) return null;
  return value * (preferences?.store_budget_overrun ? 1.1 : 1);
}

function withinSmartBudget(product, rules, preferences) {
  const ceiling = budgetCeiling(preferences);
  if (!ceiling) return true;
  const price = resolveProductPrice(product,rules).effective;
  return price !== null && price !== undefined && Number(price) <= ceiling;
}

function withinBudgetRange(product, rules, min = null, max = null) {
  if (!min && !max) return true;
  const price = resolveProductPrice(product,rules).effective;
  if (price === null || price === undefined) return false;
  const value = Number(price);
  if (min && value < Number(min)) return false;
  if (max && value > Number(max)) return false;
  return true;
}

function nearestOccasion(rows = []) {
  return rows.filter(x=>x.is_active && x.occasion_type !== 'usual_gift' && x.occasion_date && daysUntil(x.occasion_date) >= 0).sort((a,b)=>String(a.occasion_date).localeCompare(String(b.occasion_date)))[0] || null;
}

function productBadge(product, rules, ar) {
  if (productIsOnOffer(product,rules)) return ar ? 'عرض' : 'Offer';
  const age = Date.now() - new Date(product.created_at).getTime();
  if (Number.isFinite(age) && age >= 0 && age <= 30*86400000) return ar ? 'جديد' : 'New';
  return null;
}

export default function IndividualSmartStore({ lang, session }) {
  const ar = lang === 'ar'; const navigate = useNavigate(); const location = useLocation(); const uid = session?.user?.id;
  const { settings: systemSettings, loading: settingsLoading, error: settingsError } = useSystemSettings();
  const cart = useBalqeesCart(uid || null); const Arrow = ar ? ArrowLeft : ArrowRight;
  const [products,setProducts]=useState([]); const [categories,setCategories]=useState([]); const [rules,setRules]=useState([]);
  const [favorites,setFavorites]=useState([]); const [interests,setInterests]=useState([]); const [orders,setOrders]=useState([]); const [occasions,setOccasions]=useState([]); const [popularIds,setPopularIds]=useState([]);
  const [preferences,setPreferences]=useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [toast,setToast]=useState('');
  const [query,setQuery]=useState(''); const [sort,setSort]=useState('relevant'); const [filters,setFilters]=useState({occasion:'all',kind:'all',budget:'all',style:'all',availability:'all',offers:false});
  const [filterOpen,setFilterOpen]=useState(false); const [quickProduct,setQuickProduct]=useState(null); const [quickQty,setQuickQty]=useState(1); const [compareIds,setCompareIds]=useState(()=>{try{return (JSON.parse(sessionStorage.getItem('balqees-store-compare-v1')||'[]')||[]).map(String).slice(0,3);}catch{return[];}}); const [compareOpen,setCompareOpen]=useState(false);
  const [assistantOpen,setAssistantOpen]=useState(false); const [assistantStep,setAssistantStep]=useState(0); const [assistant,setAssistant]=useState({occasion:null,recipient:'other',budget:'unspecified',kind:'surprise',style:'surprise'});
  const [budgetOpen,setBudgetOpen]=useState(false); const [budgetDraft,setBudgetDraft]=useState(''); const [contextBudgetKey,setContextBudgetKey]=useState(null); const [contextBudgetMin,setContextBudgetMin]=useState(null); const [contextBudgetMax,setContextBudgetMax]=useState(null); const lastSearchRef=useRef(''); const urlSyncReadyRef=useRef(false);

  useEffect(()=>{ document.body.classList.add('individual-account-active','smart-store-active'); return()=>document.body.classList.remove('individual-account-active','smart-store-active'); },[]);
  useEffect(()=>{try{sessionStorage.setItem('balqees-store-compare-v1',JSON.stringify(compareIds.slice(0,3)));}catch{/* best effort */}},[compareIds]);
  useEffect(()=>{ if(!toast)return; const id=setTimeout(()=>setToast(''),3200); return()=>clearTimeout(id); },[toast]);

  useEffect(()=>{
    urlSyncReadyRef.current=false;
    const params=new URLSearchParams(location.search);
    setQuery(params.get('q')||'');
    const occasion=params.get('occasion'); const budget=params.get('budget'); const kind=params.get('kind'); const style=params.get('style'); const availability=params.get('availability');
    setFilters({
      occasion: occasion && SMART_STORE_OCCASIONS[occasion] ? occasion : 'all',
      kind: ['bouquet','gift','combo'].includes(kind) ? kind : 'all',
      budget: budget && SMART_BUDGET_BANDS.some(x=>x.key===budget) ? budget : 'all',
      style: style && SMART_STORE_STYLES.some(x=>x.key===style) ? style : 'all',
      availability: ['ready','made_to_order'].includes(availability) ? availability : 'all',
      offers: params.get('offers') === '1',
    });
    const legacyRanges={ '150_300':[150,300], '300_500':[300,500] }; const legacy=legacyRanges[budget];
    setContextBudgetKey(legacy?budget:null); setContextBudgetMin(legacy?.[0]||null); setContextBudgetMax(legacy?.[1]||null);
    const nextSort=params.get('sort'); setSort(['relevant','newest','price-low','price-high'].includes(nextSort)?nextSort:'relevant');
    const timer=setTimeout(()=>{urlSyncReadyRef.current=true;},0);
    return()=>clearTimeout(timer);
  },[location.search]);

  useEffect(()=>{
    if(!urlSyncReadyRef.current)return;
    const params=new URLSearchParams();
    if(query.trim())params.set('q',query.trim());
    if(filters.occasion!=='all')params.set('occasion',filters.occasion);
    if(filters.kind!=='all')params.set('kind',filters.kind);
    if(filters.budget!=='all')params.set('budget',filters.budget);
    else if(contextBudgetKey)params.set('budget',contextBudgetKey);
    if(filters.style!=='all')params.set('style',filters.style);
    if(filters.availability!=='all')params.set('availability',filters.availability);
    if(filters.offers)params.set('offers','1');
    if(sort!=='relevant')params.set('sort',sort);
    const next=params.toString()?`?${params.toString()}`:'';
    if(next!==location.search)navigate(`/store${next}`,{replace:true});
  },[query,filters,sort,contextBudgetKey,location.search,navigate]);

  useEffect(()=>{
    if(filters.budget==='all'||!contextBudgetKey)return;
    setContextBudgetKey(null);setContextBudgetMin(null);setContextBudgetMax(null);
  },[filters.budget,contextBudgetKey]);

  async function load() {
    if(!uid){setLoading(false);return;} setLoading(true); setError('');
    const results=await Promise.all([
      supabase.from('products').select('*').eq('visibility','public').eq('is_active',true).order('created_at',{ascending:false}),
      supabase.from('product_categories').select('*').eq('is_active',true).order('sort_order'),
      supabase.from('price_rules').select('*').eq('is_active',true),
      supabase.from('customer_favorites').select('product_id,created_at,unit_price_snapshot').eq('user_id',uid).order('created_at',{ascending:false}).limit(120),
      supabase.from('customer_interest_events').select('event_type,product_id,category_id,search_query,metadata,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(500),
      supabase.from('orders').select('id,status,created_at,order_items(product_id,quantity,unit_price,product_snapshot)').eq('user_id',uid).order('created_at',{ascending:false}).limit(60),
      supabase.from('customer_occasions').select('*').eq('user_id',uid).eq('is_active',true).order('occasion_date',{ascending:true,nullsFirst:false}).limit(40),
      supabase.rpc('store_popular_product_ids',{p_limit:12}),
      loadCustomerPreferences(uid),
    ]);
    const firstError=results.slice(0,8).find(r=>r?.error)?.error;
    if(firstError) setError(ar?'تعذر تحميل جزء من المتجر الذكي. يمكنك الاستمرار بالمنتجات المتاحة.':'Part of the smart store could not load. You can continue with the available catalog.');
    setProducts(results[0].data||[]); setCategories(results[1].data||[]); setRules(results[2].data||[]); setFavorites(results[3].data||[]); setInterests(results[4].data||[]); setOrders(results[5].data||[]); setOccasions(results[6].data||[]); setPopularIds((results[7].data||[]).map(x=>String(x.product_id))); setPreferences(normalizeCustomerPreferences(results[8]||{})); setLoading(false);
  }
  useEffect(()=>{load();},[uid,systemSettings.store.enabled]);
  useLiveDataRefresh(() => load(), ['products', 'product_categories', 'price_rules']);

  useEffect(()=>{
    if(!uid || !preferences?.personalized_recommendations || query.trim().length<3)return;
    const normalized=normalizeSmartText(query); if(!normalized||normalized===lastSearchRef.current)return;
    const timer=setTimeout(()=>{ lastSearchRef.current=normalized; const intent=extractSmartSearchIntent(query); recordCustomerInterest({user_id:uid,event_type:'search',search_query:query.trim(),category_id:null,metadata:{source:'smart_store',occasion:intent.occasion,kind:intent.kind,budget_max:intent.budgetMax,style:intent.style}}); },900);
    return()=>clearTimeout(timer);
  },[query,uid,preferences?.personalized_recommendations]);

  const categoryById=useMemo(()=>new Map(categories.map(x=>[String(x.id),x])),[categories]);
  const favoriteIds=useMemo(()=>new Set(favorites.map(x=>String(x.product_id))),[favorites]);
  const taste=useMemo(()=>buildTasteProfile({products,categories,interests,favorites,cartItems:cart.items,orders,personalized:preferences?.personalized_recommendations!==false}),[products,categories,interests,favorites,cart.items,orders,preferences?.personalized_recommendations]);
  const searchIntent=useMemo(()=>extractSmartSearchIntent(query),[query]);
  const upcoming=useMemo(()=>nearestOccasion(occasions),[occasions]);
  const quiet=preferences?.quiet_mode===true;
  const smartBudgetCeiling=useMemo(()=>{const saved=budgetCeiling(preferences);const contextual=Number(contextBudgetMax)||null;if(saved&&contextual)return Math.min(saved,contextual);return saved||contextual||null;},[preferences,contextBudgetMax]);
  const detectedSeason=useMemo(()=>{const s=getSaudiSeason(); return ['ramadan','eid','adha','hajj'].includes(s.key)?s:{key:'default'};},[]);
  const currentSeason=quiet?{key:'default'}:detectedSeason;
  const seasonCopy=SEASON_COPY[currentSeason.key]||SEASON_COPY.default;
  const largeText=Number(preferences?.font_scale||1)>=1.3;

  const purchasedIds=useMemo(()=>{const ids=[];orders.filter(o=>ORDER_DONE.has(o.status)).forEach(o=>(o.order_items||[]).forEach(i=>{const id=i.product_id&&String(i.product_id);if(id&&!ids.includes(id))ids.push(id);}));return ids;},[orders]);
  const personalizedRows=useMemo(()=>products.map(product=>({product,score:tasteScore(product,categoryById.get(String(product.category_id)),rules,taste)})).filter(x=>x.score>0&&withinBudgetRange(x.product,rules,contextBudgetMin,smartBudgetCeiling)).sort((a,b)=>b.score-a.score).map(x=>x.product).slice(0,6),[products,rules,taste,categoryById,contextBudgetMin,smartBudgetCeiling]);
  const resumeRows=useMemo(()=>unique((taste.recentViewIds||[]).map(id=>products.find(p=>String(p.id)===id))).filter(p=>withinBudgetRange(p,rules,contextBudgetMin,smartBudgetCeiling)).slice(0,4),[taste.recentViewIds,products,rules,contextBudgetMin,smartBudgetCeiling]);
  const reorderRows=useMemo(()=>unique(purchasedIds.map(id=>products.find(p=>String(p.id)===id))).filter(p=>withinBudgetRange(p,rules,contextBudgetMin,smartBudgetCeiling)).slice(0,4),[purchasedIds,products,rules,contextBudgetMin,smartBudgetCeiling]);
  const popularRows=useMemo(()=>unique(popularIds.map(id=>products.find(p=>String(p.id)===id))).filter(p=>withinBudgetRange(p,rules,contextBudgetMin,smartBudgetCeiling)).slice(0,6),[popularIds,products,rules,contextBudgetMin,smartBudgetCeiling]);
  const newestRows=useMemo(()=>[...products].filter(p=>withinBudgetRange(p,rules,contextBudgetMin,smartBudgetCeiling)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,6),[products,rules,contextBudgetMin,smartBudgetCeiling]);
  const offerRows=useMemo(()=>products.filter(p=>productIsOnOffer(p,rules)&&withinBudgetRange(p,rules,contextBudgetMin,smartBudgetCeiling)).slice(0,6),[products,rules,contextBudgetMin,smartBudgetCeiling]);

  const occasionRows=useMemo(()=>{
    if(!upcoming)return[]; const range=budgetRangeFromKey(upcoming.budget_band);
    return products
      .map(product=>({product,score:scoreProductForIntent(product,categoryById.get(String(product.category_id)),rules,{occasion:upcoming.occasion_type,budgetMin:range.min,budgetMax:Number.isFinite(range.max)?range.max:null})}))
      .filter(x=>x.score>0&&withinBudgetRange(x.product,rules,range.min,range.max))
      .sort((a,b)=>b.score-a.score)
      .map(x=>x.product).slice(0,6);
  },[upcoming,products,rules,categoryById]);

  const visible=useMemo(()=>{
    const smartCeiling=smartBudgetCeiling;
    const rows=products.filter(product=>{
      const category=categoryById.get(String(product.category_id)); const pricing=resolveProductPrice(product,rules); const price=pricing.effective; const availability=productAvailability(product); const text=productSearchText(product,category);
      if(filters.occasion!=='all'&&!productMatchesOccasion(product,category,filters.occasion))return false;
      if(filters.kind!=='all'&&productKind(product,category)!==filters.kind)return false;
      if(filters.budget!=='all'&&!budgetBandMatch(price,filters.budget))return false;
      if(filters.style!=='all'&&!productMatchesStyle(product,category,filters.style))return false;
      if(filters.availability!=='all'&&availability!==filters.availability)return false;
      if(filters.offers&&!productIsOnOffer(product,rules))return false;
      if(smartCeiling && (price===null||price===undefined||Number(price)>smartCeiling))return false;
      if(contextBudgetMin && (price===null||price===undefined||Number(price)<Number(contextBudgetMin)))return false;
      if(query.trim()){
        const semantic=scoreProductForIntent(product,category,rules,searchIntent);
        const q=normalizeSmartText(query); const direct=text.includes(q) || (searchIntent.freeTerms||[]).some(term=>text.includes(term));
        if(semantic<=0&&!direct)return false;
        if(searchIntent.budgetMax&&price!==null&&price!==undefined&&Number(price)>Number(searchIntent.budgetMax))return false;
        if(searchIntent.budgetMin&&price!==null&&price!==undefined&&Number(price)<Number(searchIntent.budgetMin))return false;
        if(searchIntent.occasion&&!productMatchesOccasion(product,category,searchIntent.occasion))return false;
        if(searchIntent.kind&&productKind(product,category)!==searchIntent.kind&&!(searchIntent.kind==='combo'&&['bouquet','gift'].includes(productKind(product,category))))return false;
        if(searchIntent.style&&!productMatchesStyle(product,category,searchIntent.style))return false;
        if((searchIntent.excludeStyles||[]).some(style=>productMatchesStyle(product,category,style)))return false;
        if(searchIntent.offersOnly&&!productIsOnOffer(product,rules))return false;
        if(searchIntent.availability&&availability!==searchIntent.availability)return false;
      }
      return true;
    });
    return rows.map(product=>({product,searchScore:query.trim()?scoreProductForIntent(product,categoryById.get(String(product.category_id)),rules,searchIntent):0,taste:tasteScore(product,categoryById.get(String(product.category_id)),rules,taste)})).sort((a,b)=>{
      if(sort==='newest')return new Date(b.product.created_at)-new Date(a.product.created_at);
      if(sort==='price-low')return Number(resolveProductPrice(a.product,rules).effective??Infinity)-Number(resolveProductPrice(b.product,rules).effective??Infinity);
      if(sort==='price-high')return Number(resolveProductPrice(b.product,rules).effective??-1)-Number(resolveProductPrice(a.product,rules).effective??-1);
      return (b.searchScore-a.searchScore)||(b.taste-a.taste)||Number(b.product.is_featured)-Number(a.product.is_featured)||new Date(b.product.created_at)-new Date(a.product.created_at);
    }).map(x=>x.product);
  },[products,filters,preferences,query,searchIntent,sort,rules,taste,categoryById,smartBudgetCeiling,contextBudgetMin]);

  async function toggleFavorite(product){
    const id=String(product.id); if(favoriteIds.has(id)){const result=await removeFavorite({userId:uid,product});if(!result.error){setFavorites(rows=>rows.filter(x=>String(x.product_id)!==id));setToast(ar?'أزيل من المفضلة':'Removed from favorites');}return;}
    const price=resolveProductPrice(product,rules).effective; const result=await saveFavorite({userId:uid,product,unitPrice:price}); if(!result.error){setFavorites(rows=>[{product_id:product.id,created_at:new Date().toISOString(),unit_price_snapshot:price},...rows]);setToast(ar?'تم الحفظ في المفضلة':'Saved to favorites');}
  }
  function openQuick(product){
    const availability=productAvailability(product);
    if(availability==='unavailable'){setToast(ar?'هذا المنتج غير متوفر حاليًا':'This product is currently unavailable');return;}
    setQuickProduct(product);setQuickQty(Number(product.min_order_quantity||1));
  }
  function addQuick(){
    if(!quickProduct)return;
    if(productAvailability(quickProduct)==='unavailable'){setQuickProduct(null);setToast(ar?'هذا المنتج غير متوفر حاليًا':'This product is currently unavailable');return;}
    if(quickProduct.price_on_request){navigate(`/store/${quickProduct.slug||quickProduct.id}${location.search||''}`);setQuickProduct(null);return;}
    cart.add(quickProduct,quickQty,{unit_price_snapshot:resolveProductPrice(quickProduct,rules).effective});
    setQuickProduct(null);setToast(ar?'أضفنا المنتج إلى سلتك':'Added to your cart');
  }
  function toggleCompare(id){const key=String(id);setCompareIds(current=>current.includes(key)?current.filter(x=>x!==key):current.length>=3?(setToast(ar?'المقارنة حتى 3 منتجات فقط':'Compare up to 3 products'),current):[...current,key]);}
  function resetFilters(){setFilters({occasion:'all',kind:'all',budget:'all',style:'all',availability:'all',offers:false});setQuery('');setSort('relevant');setContextBudgetKey(null);setContextBudgetMin(null);setContextBudgetMax(null);}

  async function saveBudget(){
    const value=Number(budgetDraft); if(!Number.isFinite(value)||value<1){setToast(ar?'اكتب ميزانية صحيحة':'Enter a valid budget');return;}
    const next={...preferences,store_budget_limit:value,store_budget_overrun:!!preferences?.store_budget_overrun};
    const {error}=await supabase.from('customer_preferences').upsert({user_id:uid,store_budget_limit:value,store_budget_overrun:!!preferences?.store_budget_overrun,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(error){setToast(ar?'تعذر حفظ الميزانية':'Could not save budget');return;} setPreferences(normalizeCustomerPreferences(next));cacheCustomerPreferences(uid,next);setBudgetOpen(false);setToast(ar?'تم تفعيل ميزانيتك على المتجر':'Smart Budget is active');
  }
  async function clearBudget(){const next={...preferences,store_budget_limit:null,store_budget_overrun:false};await supabase.from('customer_preferences').upsert({user_id:uid,store_budget_limit:null,store_budget_overrun:false,updated_at:new Date().toISOString()},{onConflict:'user_id'});setPreferences(normalizeCustomerPreferences(next));cacheCustomerPreferences(uid,next);setBudgetDraft('');setBudgetOpen(false);}
  async function setBudgetOverrun(value){const next={...preferences,store_budget_overrun:value};await supabase.from('customer_preferences').upsert({user_id:uid,store_budget_overrun:value,updated_at:new Date().toISOString()},{onConflict:'user_id'});setPreferences(normalizeCustomerPreferences(next));cacheCustomerPreferences(uid,next);}

  const assistantResults=useMemo(()=>{
    if(!assistant.occasion)return[]; const range=budgetRangeFromKey(assistant.budget); const min=range.min; const max=range.max;
    const intent={occasion:assistant.occasion,kind:assistant.kind==='surprise'?null:assistant.kind,style:assistant.style==='surprise'?null:assistant.style,budgetMin:min,budgetMax:Number.isFinite(max)?max:null};
    const recipientWords={bride:['bride','عروس'],groom:['groom','عريس'],couple:['couple','زوجين','العروسين'],family:['family','اسره','أسرة','عائله','عائلة'],other:[]}[assistant.recipient]||[];
    let scored=products.filter(product=>isGiftAssistantProduct(product,categoryById.get(String(product.category_id)))&&productAvailability(product)!=='unavailable').map(product=>{const category=categoryById.get(String(product.category_id));const text=productSearchText(product,category);const recipientScore=recipientWords.some(word=>text.includes(normalizeSmartText(word)))?4:0;return {product,score:scoreProductForIntent(product,category,rules,intent)+tasteScore(product,category,rules,taste)*.2+recipientScore,price:resolveProductPrice(product,rules).effective};});
    if(min!==null||max!==null){
      const within=scored.filter(x=>x.price!==null&&x.price!==undefined&&(min===null||Number(x.price)>=Number(min))&&(max===null||!Number.isFinite(max)||Number(x.price)<=Number(max))).sort((a,b)=>b.score-a.score||Number(b.price)-Number(a.price));
      if(within.length)return within.slice(0,5).map(x=>x.product);
      const target=Number.isFinite(max)?Number(max):(Number(min)||0);
      scored=scored.filter(x=>x.price!==null&&x.price!==undefined).sort((a,b)=>Math.abs(Number(a.price)-target)-Math.abs(Number(b.price)-target)||b.score-a.score);
    } else scored.sort((a,b)=>b.score-a.score);
    return scored.slice(0,5).map(x=>x.product);
  },[assistant,products,categoryById,rules,taste]);

  if (!settingsLoading && (settingsError || !systemSettings.store.enabled)) return <SmartStoreChrome lang={lang} session={session} cart={cart}><main className="individual-main"><div className="individual-shell"><section className="smart-store-empty" role={settingsError ? 'alert' : 'status'}><PackageOpen size={34}/><h2>{settingsError ? (ar ? 'تعذر التحقق من إعدادات المتجر' : 'Store settings are unavailable') : (ar ? 'المتجر متوقف مؤقتًا' : 'Store is temporarily closed')}</h2><Link className="btn primary" to="/account/support">{ar ? 'تواصل مع بلقيس' : 'Contact Balqees'}</Link></section></div></main></SmartStoreChrome>;
  if(loading) return <SmartStoreChrome lang={lang} session={session} cart={cart}><main className="individual-main"><div className="individual-shell"><div className="smart-store-loading"><LoaderCircle className="spin"/><strong>{ar?'نرتّب المتجر لك…':'Preparing your store…'}</strong></div></div></main></SmartStoreChrome>;

  const modulesPersonal=preferences?.personalized_recommendations!==false && taste.hasSignals;
  const compareProducts=unique(compareIds.map(id=>products.find(p=>String(p.id)===id)));

  return <SmartStoreChrome lang={lang} session={session} cart={cart}><main className={`individual-main smart-store-main ${largeText?'large-text':''}`}><div className="individual-shell">
    <section className={`smart-store-hero season-${currentSeason.key}`}><div className="smart-store-hero-copy"><span><Sparkles size={15}/>{ar?'BALQEES SMART STORE':'BALQEES SMART STORE'}</span><h1>{ar?seasonCopy.ar[0]:seasonCopy.en[0]}</h1><p>{ar?seasonCopy.ar[1]:seasonCopy.en[1]}</p></div><div className="smart-store-hero-actions"><button type="button" className="smart-budget-button" onClick={()=>{setBudgetDraft(preferences?.store_budget_limit||'');setBudgetOpen(true);}}><CircleDollarSign size={17}/><span>{preferences?.store_budget_limit?(ar?`ميزانيتي ${Number(preferences.store_budget_limit).toLocaleString('ar-SA')} ر.س`:`Budget SAR ${Number(preferences.store_budget_limit).toLocaleString('en-US')}`):(ar?'التزم بميزانيتي':'Smart Budget')}</span>{preferences?.store_budget_limit&&<Check size={14}/>}</button><button type="button" className="smart-store-cart-top" onClick={()=>navigate('/account/cart')}><ShoppingBag size={18}/><span>{ar?'السلة':'Cart'}</span>{cart.count>0&&<b>{cart.count}</b>}</button></div></section>

    {error&&<div className="smart-store-note error">{error}</div>}
    {cart.count>0&&<section className="smart-store-cart-strip"><div><ShoppingBag size={18}/><span>{ar?`عندك ${cart.count} منتج بانتظارك`:`${cart.count} item${cart.count===1?'':'s'} waiting in your cart`}</span></div><button onClick={()=>navigate('/account/cart')}>{ar?'أكمل طلبك':'Continue order'}<Arrow size={15}/></button></section>}

    {!quiet&&upcoming&&occasionRows.length>0&&<section className="smart-store-context-strip"><div><Clock3 size={18}/><span>{ar?'مناسبة قريبة':'UPCOMING OCCASION'}</span><strong>{occasionLabel(upcoming.occasion_type,ar)}{daysUntil(upcoming.occasion_date)!==null?` · ${ar?'بعد':'in'} ${daysUntil(upcoming.occasion_date)} ${ar?'يوم':'days'}`:''}</strong><small>{ar?'رتبنا خيارات مناسبة للمناسبة بدون إخفاء بقية المتجر.':'Relevant options are prioritized without hiding the rest of the catalog.'}</small></div><button onClick={()=>setFilters(f=>({...f,occasion:upcoming.occasion_type}))}>{ar?'عرض الخيارات':'View choices'}<Arrow size={14}/></button></section>}

    <section className="smart-store-discovery"><div className="smart-store-search"><Search size={21}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'وش تدور عليه اليوم؟ مثال: باقة ملكة تحت 300':'What are you looking for? e.g. wedding bouquet under 300'}/>{query&&<button type="button" onClick={()=>setQuery('')}><X size={16}/></button>}</div><button type="button" className="smart-assistant-trigger" onClick={()=>{setAssistantOpen(true);setAssistantStep(0);}}><WandSparkles size={19}/><span>{ar?'ساعدني أختار':'Help me choose'}</span></button></section>

    {(query||filters.occasion!=='all'||filters.kind!=='all'||filters.budget!=='all'||filters.style!=='all'||filters.availability!=='all'||filters.offers||preferences?.store_budget_limit||contextBudgetMin||contextBudgetMax)&&<div className="smart-store-active-context"><div>{query&&<span><Search size={12}/>{query}</span>}{filters.occasion!=='all'&&<span>{occasionLabel(filters.occasion,ar)}</span>}{filters.kind!=='all'&&<span>{filters.kind==='bouquet'?(ar?'باقات':'Bouquets'):filters.kind==='gift'?(ar?'هدايا':'Gifts'):(ar?'باقة + هدية':'Bouquet + gift')}</span>}{filters.budget!=='all'&&<span>{(SMART_BUDGET_BANDS.find(x=>x.key===filters.budget)?.[ar?'ar':'en'])} {ar?'ر.س':'SAR'}</span>}{filters.style!=='all'&&<span>{SMART_STORE_STYLES.find(x=>x.key===filters.style)?.[ar?'ar':'en']}</span>}{contextBudgetKey&&<span className="occasion-budget"><Clock3 size={12}/>{ar?`ميزانية المناسبة ${contextBudgetMin||0}–${Number.isFinite(contextBudgetMax)?contextBudgetMax:'+'} ر.س`:`Occasion budget SAR ${contextBudgetMin||0}–${Number.isFinite(contextBudgetMax)?contextBudgetMax:'+'}`}</span>}{preferences?.store_budget_limit&&<span className="budget"><CircleDollarSign size={12}/>{ar?`ميزانيتي حتى ${Math.round(budgetCeiling(preferences))} ر.س`:`My budget up to SAR ${Math.round(budgetCeiling(preferences))}`}</span>}</div><button onClick={resetFilters}>{ar?'عرض كل المنتجات':'Show all products'}<X size={13}/></button></div>}

    <section className="smart-store-occasions"><div className="smart-store-section-head"><div><span>{ar?'استكشف حسب المناسبة':'EXPLORE BY OCCASION'}</span><h2>{ar?'اختصر الطريق من المناسبة':'Start with the occasion'}</h2></div></div><div className="smart-store-occasion-chips">{Object.entries(SMART_STORE_OCCASIONS).map(([key,meta])=><button type="button" key={key} className={filters.occasion===key?'active':''} onClick={()=>setFilters(f=>({...f,occasion:f.occasion===key?'all':key}))}>{ar?meta.ar:meta.en}</button>)}</div></section>

    {!quiet&&occasionRows.length>0&&<ProductModule eyebrow={ar?'مناسبتك القادمة':'YOUR UPCOMING OCCASION'} title={ar?`خيارات مناسبة لـ ${occasionLabel(upcoming?.occasion_type,true)}`:`Options for ${occasionLabel(upcoming?.occasion_type,false)}`} subtitle={upcoming?.budget_band&&upcoming.budget_band!=='unspecified'?(ar?'مرتبة مع مراعاة الميزانية التي حفظتها للمناسبة.':'Ranked with the occasion budget you saved.'):null} rows={occasionRows} ar={ar} lang={lang} rules={rules} categoryById={categoryById} favoriteIds={favoriteIds} compareIds={compareIds} onFavorite={toggleFavorite} onQuick={openQuick} onCompare={toggleCompare}/>}
    {!quiet&&resumeRows.length>0&&<ProductModule eyebrow={ar?'ذاكرة التسوق':'SHOPPING MEMORY'} title={ar?'كمل من وين وقفت':'Continue where you left off'} rows={resumeRows.slice(0,3)} ar={ar} lang={lang} rules={rules} categoryById={categoryById} favoriteIds={favoriteIds} compareIds={compareIds} onFavorite={toggleFavorite} onQuick={openQuick} onCompare={toggleCompare}/>} 
    {!quiet&&modulesPersonal&&personalizedRows.length>0&&<ProductModule eyebrow={ar?'BALQEES TASTE ENGINE':'BALQEES TASTE ENGINE'} title={ar?'مختارات أقرب لذوقك':'Closer to your taste'} subtitle={ar?'اعتمدنا فقط على نشاط التخصيص الذي وافقت عليه، وبقية المتجر ما زالت متاحة بالكامل.':'Based only on the personalization activity you allowed; the full catalog remains available.'} rows={personalizedRows} ar={ar} lang={lang} rules={rules} categoryById={categoryById} favoriteIds={favoriteIds} compareIds={compareIds} onFavorite={toggleFavorite} onQuick={openQuick} onCompare={toggleCompare}/>} 
    {!quiet&&reorderRows.length>0&&<ProductModule eyebrow={ar?'من طلباتك':'FROM YOUR ORDERS'} title={ar?'اطلبها مرة ثانية':'Order again'} rows={reorderRows} ar={ar} lang={lang} rules={rules} categoryById={categoryById} favoriteIds={favoriteIds} compareIds={compareIds} onFavorite={toggleFavorite} onQuick={openQuick} onCompare={toggleCompare}/>} 
    {!quiet&&preferences?.marketing_in_app!==false&&offerRows.length>0&&<ProductModule eyebrow={ar?'العروض الفعلية':'REAL OFFERS'} title={ar?'العروض والجديد':'Offers & new'} rows={offerRows} ar={ar} lang={lang} rules={rules} categoryById={categoryById} favoriteIds={favoriteIds} compareIds={compareIds} onFavorite={toggleFavorite} onQuick={openQuick} onCompare={toggleCompare}/>} 
    {!taste.hasSignals&&<ProductModule eyebrow={ar?'ابدأ من هنا':'START HERE'} title={ar?'أحدث ما في المتجر':'Latest in store'} rows={newestRows} ar={ar} lang={lang} rules={rules} categoryById={categoryById} favoriteIds={favoriteIds} compareIds={compareIds} onFavorite={toggleFavorite} onQuick={openQuick} onCompare={toggleCompare}/>} 
    {!taste.hasSignals&&popularRows.length>0&&<ProductModule eyebrow={ar?'من الطلبات المكتملة':'BASED ON COMPLETED ORDERS'} title={ar?'الأكثر طلبًا':'Frequently ordered'} rows={popularRows} ar={ar} lang={lang} rules={rules} categoryById={categoryById} favoriteIds={favoriteIds} compareIds={compareIds} onFavorite={toggleFavorite} onQuick={openQuick} onCompare={toggleCompare}/>} 

    <section className="smart-store-catalog" id="smart-store-catalog"><div className="smart-store-section-head catalog"><div><span>{ar?'كل المتجر':'FULL CATALOG'}</span><h2>{query?(ar?`نتائج تناسب: ${query}`:`Results for: ${query}`):(ar?'كل المنتجات':'All products')}</h2><p>{ar?`${visible.length} منتج مطابق للإعدادات الحالية`:`${visible.length} products match the current view`}</p></div><div><button type="button" className="smart-filter-button" onClick={()=>setFilterOpen(true)}><SlidersHorizontal size={16}/>{ar?'تصفية':'Filters'}<b>{Object.entries(filters).filter(([key,value])=>key==='offers'?value:value!=='all').length}</b></button><select value={sort} onChange={e=>setSort(e.target.value)}><option value="relevant">{ar?'الأقرب أولًا':'Most relevant'}</option><option value="newest">{ar?'الأحدث':'Newest'}</option><option value="price-low">{ar?'السعر: الأقل':'Price: low to high'}</option><option value="price-high">{ar?'السعر: الأعلى':'Price: high to low'}</option></select></div></div>
      <div className="smart-store-desktop-filters"><FilterChip active={filters.kind==='bouquet'} onClick={()=>setFilters(f=>({...f,kind:f.kind==='bouquet'?'all':'bouquet'}))}>{ar?'باقات':'Bouquets'}</FilterChip><FilterChip active={filters.kind==='gift'} onClick={()=>setFilters(f=>({...f,kind:f.kind==='gift'?'all':'gift'}))}>{ar?'هدايا':'Gifts'}</FilterChip><FilterChip active={filters.kind==='combo'} onClick={()=>setFilters(f=>({...f,kind:f.kind==='combo'?'all':'combo'}))}>{ar?'باقة + هدية':'Bouquet + gift'}</FilterChip><FilterChip active={filters.offers} onClick={()=>setFilters(f=>({...f,offers:!f.offers}))}>{ar?'العروض':'Offers'}</FilterChip><FilterChip active={filters.availability==='ready'} onClick={()=>setFilters(f=>({...f,availability:f.availability==='ready'?'all':'ready'}))}>{ar?'جاهز':'Ready'}</FilterChip><FilterChip active={filters.availability==='made_to_order'} onClick={()=>setFilters(f=>({...f,availability:f.availability==='made_to_order'?'all':'made_to_order'}))}>{ar?'حسب الطلب':'Made to order'}</FilterChip></div>
      {visible.length?<div className="smart-store-grid">{visible.map(product=><SmartProductCard key={product.id} product={product} category={categoryById.get(String(product.category_id))} rules={rules} lang={lang} favorite={favoriteIds.has(String(product.id))} compared={compareIds.includes(String(product.id))} smartBudget={smartBudgetCeiling} onFavorite={()=>toggleFavorite(product)} onQuick={()=>openQuick(product)} onCompare={()=>toggleCompare(product.id)} detailSearch={location.search}/>)}</div>:<div className="smart-store-empty"><PackageOpen size={38}/><h3>{ar?'ما لقينا نتيجة دقيقة بهذا التركيب':'No exact result for this combination'}</h3><p>{ar?'خفف أحد الفلاتر أو اعرض كل المنتجات. ما راح نعوض النتيجة باقتراحات وهمية.':'Remove a filter or view the full catalog. We will not replace missing matches with invented recommendations.'}</p><button onClick={resetFilters}>{ar?'عرض كل المنتجات':'Show all products'}</button></div>}
    </section>
  </div></main>

  {filterOpen&&<FilterSheet ar={ar} filters={filters} setFilters={setFilters} onClose={()=>setFilterOpen(false)}/>} 
  {quickProduct&&<QuickView product={quickProduct} category={categoryById.get(String(quickProduct.category_id))} rules={rules} lang={lang} qty={quickQty} setQty={setQuickQty} smartBudget={smartBudgetCeiling} onClose={()=>setQuickProduct(null)} onAdd={addQuick} detailSearch={location.search}/>} 
  {assistantOpen&&<Assistant ar={ar} lang={lang} step={assistantStep} setStep={setAssistantStep} value={assistant} setValue={setAssistant} results={assistantResults} rules={rules} categoryById={categoryById} onClose={()=>setAssistantOpen(false)} onQuick={product=>{setAssistantOpen(false);openQuick(product);}}/>}
  {budgetOpen&&<BudgetSheet ar={ar} value={budgetDraft} setValue={setBudgetDraft} overrun={!!preferences?.store_budget_overrun} setOverrun={setBudgetOverrun} active={!!preferences?.store_budget_limit} onSave={saveBudget} onClear={clearBudget} onClose={()=>setBudgetOpen(false)}/>} 
  {compareIds.length>0&&<div className="smart-compare-bar"><div><Layers size={17}/><strong>{ar?`مقارنة ${compareIds.length} منتج`:`Compare ${compareIds.length} product${compareIds.length===1?'':'s'}`}</strong><span>{ar?'حتى 3 منتجات':'Up to 3 products'}</span></div><div><button disabled={compareIds.length<2} onClick={()=>setCompareOpen(true)}>{ar?'قارن لي':'Compare'}</button><button className="clear" onClick={()=>setCompareIds([])}><X size={15}/></button></div></div>}
  {compareOpen&&<CompareSheet rows={compareProducts} categoryById={categoryById} rules={rules} lang={lang} onClose={()=>setCompareOpen(false)}/>} 
  {toast&&<div className="individual-toast"><Check size={15}/><span>{toast}</span></div>}
  </SmartStoreChrome>;
}

function FilterChip({active,onClick,children}){return <button type="button" className={active?'active':''} onClick={onClick}>{children}</button>;}

function ProductModule({eyebrow,title,subtitle,rows,ar,lang,rules,categoryById,favoriteIds,compareIds,onFavorite,onQuick,onCompare}){
  if(!rows?.length)return null; return <section className="smart-store-module"><div className="smart-store-section-head"><div><span>{eyebrow}</span><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div></div><div className="smart-store-module-row">{rows.map(product=><SmartProductCard compact key={product.id} product={product} category={categoryById.get(String(product.category_id))} rules={rules} lang={lang} favorite={favoriteIds.has(String(product.id))} compared={compareIds.includes(String(product.id))} onFavorite={()=>onFavorite(product)} onQuick={()=>onQuick(product)} onCompare={()=>onCompare(product.id)}/>)}</div></section>;
}

function SmartProductCard({product,category,rules,lang,favorite,compared,onFavorite,onQuick,onCompare,detailSearch='',compact=false,smartBudget=null}){
  const ar=lang==='ar'; const pricing=resolveProductPrice(product,rules); const badge=productBadge(product,rules,ar); const availability=productAvailability(product); const price=pricing.effective; const remaining=smartBudget&&price!==null&&price!==undefined?Math.max(0,Math.round(smartBudget-Number(price))):null;
  const detailUrl=`/store/${product.slug||product.id}${detailSearch||''}`;
  const canQuickAdd=availability!=='unavailable'&&!product.price_on_request;
  const availabilityLabel=availability==='unavailable'?(ar?'غير متوفر حاليًا':'Unavailable'):availability==='made_to_order'?(ar?'حسب الطلب':'Made to order'):availability==='ready'?(ar?'جاهز':'Ready'):(ar?'متاح للطلب':'Available');
  return <article className={`smart-product-card ${compact?'compact':''} ${availability==='unavailable'?'is-unavailable':''}`}><div className="smart-product-media"><Link to={detailUrl}>{product.image_url?<img src={product.image_url} alt={productLabel(product,ar)}/>:<span><Flower2 size={35}/></span>}</Link>{badge&&<em>{badge}</em>}<button className={`smart-product-heart ${favorite?'active':''}`} onClick={onFavorite} aria-label={ar?'المفضلة':'Favorite'}><Heart size={17} fill={favorite?'currentColor':'none'}/></button></div><div className="smart-product-copy"><small>{categoryLabel(category,ar)||product.sku||'BALQEES'}</small><Link to={detailUrl}><h3>{productLabel(product,ar)}</h3></Link><div className="smart-product-meta"><span className={`availability ${availability}`}>{availabilityLabel}</span>{remaining!==null&&remaining>0&&<span>{ar?`يتبقى ${remaining} ر.س`:`SAR ${remaining} left`}</span>}</div><div className="smart-product-bottom"><div>{product.price_on_request?<strong>{ar?'السعر حسب الطلب':'On request'}</strong>:<><strong>{formatSar(price,lang)}</strong>{pricing.onSale&&<del>{formatSar(pricing.regular,lang)}</del>}</>}</div>{canQuickAdd?<button onClick={onQuick}><ShoppingBag size={15}/>{ar?'إضافة سريعة':'Quick add'}</button>:<Link className="smart-product-detail-cta" to={detailUrl}>{availability==='unavailable'?(ar?'عرض التفاصيل':'View details'):(ar?'طلب تسعير':'Request price')}</Link>}</div><div className="smart-product-actions"><button className={compared?'active':''} onClick={onCompare}><Layers size={13}/>{compared?(ar?'في المقارنة':'Comparing'):(ar?'قارن':'Compare')}</button><Link to={detailUrl}>{ar?'التفاصيل':'Details'}<ChevronRight size={13}/></Link></div></div></article>;
}

function FilterSheet({ar,filters,setFilters,onClose}){
  return <div className="smart-sheet-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="smart-filter-sheet"><header><div><small>{ar?'تصفية ذكية':'SMART FILTERS'}</small><h2>{ar?'ضيّق الخيارات بدون تعقيد':'Narrow the catalog'}</h2></div><button onClick={onClose}><X/></button></header><FilterGroup title={ar?'المناسبة':'Occasion'}>{Object.entries(SMART_STORE_OCCASIONS).map(([key,meta])=><button key={key} className={filters.occasion===key?'active':''} onClick={()=>setFilters(f=>({...f,occasion:f.occasion===key?'all':key}))}>{ar?meta.ar:meta.en}</button>)}</FilterGroup><FilterGroup title={ar?'النوع':'Type'}>{[['bouquet',ar?'باقات':'Bouquets'],['gift',ar?'هدايا':'Gifts'],['combo',ar?'باقة + هدية':'Bouquet + gift']].map(([key,label])=><button key={key} className={filters.kind===key?'active':''} onClick={()=>setFilters(f=>({...f,kind:f.kind===key?'all':key}))}>{label}</button>)}</FilterGroup><FilterGroup title={ar?'الميزانية':'Budget'}>{SMART_BUDGET_BANDS.map(item=><button key={item.key} className={filters.budget===item.key?'active':''} onClick={()=>setFilters(f=>({...f,budget:f.budget===item.key?'all':item.key}))}>{ar?item.ar:item.en}</button>)}</FilterGroup><FilterGroup title={ar?'اللون أو الأسلوب':'Color / style'}>{SMART_STORE_STYLES.map(item=><button key={item.key} className={filters.style===item.key?'active':''} onClick={()=>setFilters(f=>({...f,style:f.style===item.key?'all':item.key}))}>{ar?item.ar:item.en}</button>)}</FilterGroup><FilterGroup title={ar?'التوفر':'Availability'}>{[['ready',ar?'جاهز':'Ready'],['made_to_order',ar?'حسب الطلب':'Made to order']].map(([key,label])=><button key={key} className={filters.availability===key?'active':''} onClick={()=>setFilters(f=>({...f,availability:f.availability===key?'all':key}))}>{label}</button>)}<button className={filters.offers?'active':''} onClick={()=>setFilters(f=>({...f,offers:!f.offers}))}>{ar?'العروض فقط':'Offers only'}</button></FilterGroup><footer><button className="ghost" onClick={()=>setFilters({occasion:'all',kind:'all',budget:'all',style:'all',availability:'all',offers:false})}>{ar?'مسح الفلاتر':'Clear'}</button><button className="primary" onClick={onClose}>{ar?'عرض النتائج':'Show results'}</button></footer></section></div>;
}
function FilterGroup({title,children}){return <div className="smart-filter-group"><strong>{title}</strong><div>{children}</div></div>;}

function QuickView({product,category,rules,lang,qty,setQty,smartBudget,onClose,onAdd,detailSearch=''}){
  const ar=lang==='ar'; const pricing=resolveProductPrice(product,rules); const min=Number(product.min_order_quantity||1); const max=product.max_order_quantity?Number(product.max_order_quantity):product.stock_mode==='tracked'?Number(product.stock_quantity||0):Infinity; const price=pricing.effective; const budgetDiff=smartBudget&&price!==null&&price!==undefined?Math.round(Number(price)-smartBudget):null;
  const availability=productAvailability(product); const detailUrl=`/store/${product.slug||product.id}${detailSearch||''}`; const canAdd=availability!=='unavailable'&&!product.price_on_request;
  return <div className="smart-sheet-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="smart-quick-sheet"><header><button onClick={onClose}><X/></button></header><div className="smart-quick-product"><div className="smart-quick-image">{product.image_url?<img src={product.image_url} alt=""/>:<Flower2/>}</div><div><small>{categoryLabel(category,ar)}</small><h2>{productLabel(product,ar)}</h2>{product.price_on_request?<strong>{ar?'السعر حسب الطلب':'Price on request'}</strong>:<strong>{formatSar(price,lang)}</strong>}{availability==='unavailable'&&<p className="over">{ar?'غير متوفر حاليًا — التفاصيل والبدائل من صفحة المنتج.':'Currently unavailable — see details and alternatives on the product page.'}</p>}{budgetDiff!==null&&availability!=='unavailable'&&<p className={budgetDiff<=0?'within':'over'}>{budgetDiff<=0?(ar?`ضمن ميزانيتك · يتبقى ${Math.abs(budgetDiff)} ر.س`:`Within budget · SAR ${Math.abs(budgetDiff)} left`):(ar?`يتجاوز ميزانيتك بـ ${budgetDiff} ر.س`:`SAR ${budgetDiff} over budget`)}</p>}</div></div>{canAdd&&<div className="smart-quick-qty"><span>{ar?'الكمية':'Quantity'}</span><div><button onClick={()=>setQty(v=>Math.max(min,Number(v)-1))}>−</button><b>{qty}</b><button onClick={()=>setQty(v=>Number.isFinite(max)?Math.min(max,Number(v)+1):Number(v)+1)}>+</button></div></div>}<footer><Link to={detailUrl}>{ar?'عرض التفاصيل':'View details'}</Link>{canAdd?<button onClick={onAdd}><ShoppingBag size={16}/>{ar?'أضف للسلة':'Add to cart'}</button>:<Link className="primary-link" to={detailUrl}>{product.price_on_request?(ar?'طلب تسعير':'Request price'):(ar?'عرض البدائل':'View alternatives')}</Link>}</footer></section></div>;
}

function Assistant({ar,lang,step,setStep,value,setValue,results,rules,categoryById,onClose,onQuick}){
  const steps=['occasion','recipient','budget','kind','style','results']; const current=steps[step];
  const recipientOptions=[['bride',ar?'العروس':'Bride'],['groom',ar?'العريس':'Groom'],['couple',ar?'الزوجين':'Couple'],['family',ar?'الأسرة':'Family'],['other',ar?'شخص آخر':'Someone else']];
  const budgetOptions=[...SMART_BUDGET_BANDS,{key:'unspecified',ar:'بدون حد محدد',en:'No set budget'}];
  const title=current==='occasion'?(ar?'وش المناسبة؟':'What is the occasion?'):current==='recipient'?(ar?'لمن الهدية؟':'Who is it for?'):current==='budget'?(ar?'ميزانيتك تقريبًا؟':'Your approximate budget?'):current==='kind'?(ar?'تفضل وش أكثر؟':'What would you prefer?'):current==='style'?(ar?'وش الأسلوب اللي يعجبك؟':'What style feels right?'):(ar?'اختيارات قليلة، محسوبة على طلبك':'A short list built around your request');
  const choose=(key,val)=>{setValue(v=>({...v,[key]:val}));setStep(s=>Math.min(5,s+1));};
  return <div className="smart-sheet-overlay assistant" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="smart-assistant-sheet"><header><div><span><WandSparkles size={15}/>{ar?'مساعد اختيار بلقيس':'BALQEES GIFT ASSISTANT'}</span><h2>{title}</h2></div><button onClick={onClose}><X/></button></header><div className="smart-assistant-progress">{steps.slice(0,5).map((_,i)=><i key={i} className={i<=step?'active':''}/>)}</div><div className="smart-assistant-body">
    {current==='occasion'&&<div className="smart-assistant-options occasions">{Object.entries(SMART_STORE_OCCASIONS).map(([key,meta])=><button key={key} onClick={()=>choose('occasion',key)}><Gift size={18}/><strong>{ar?meta.ar:meta.en}</strong></button>)}</div>}
    {current==='recipient'&&<div className="smart-assistant-options">{recipientOptions.map(([key,label])=><button key={key} onClick={()=>choose('recipient',key)}><UserRound size={18}/><strong>{label}</strong></button>)}</div>}
    {current==='budget'&&<div className="smart-assistant-options">{budgetOptions.map(item=><button key={item.key} onClick={()=>choose('budget',item.key)}><CircleDollarSign size={18}/><strong>{ar?item.ar:item.en}</strong></button>)}</div>}
    {current==='kind'&&<div className="smart-assistant-options">{[['bouquet',ar?'باقة ورد':'Bouquet',Flower2],['gift',ar?'هدية':'Gift',Gift],['combo',ar?'باقة + هدية':'Bouquet + gift',Layers],['surprise',ar?'خلّها علينا':'Leave it to us',Sparkles]].map(([key,label,Icon])=><button key={key} onClick={()=>choose('kind',key)}><Icon size={18}/><strong>{label}</strong></button>)}</div>}
    {current==='style'&&<div className="smart-assistant-options">{[...SMART_STORE_STYLES,{key:'surprise',ar:'خلّها علينا',en:'Surprise me'}].map(item=><button key={item.key} onClick={()=>choose('style',item.key)}><Sparkles size={18}/><strong>{ar?item.ar:item.en}</strong></button>)}</div>}
    {current==='results'&&<div className="smart-assistant-results">{results.length?results.map((product,index)=><article key={product.id}><div>{product.image_url?<img src={product.image_url} alt=""/>:<Flower2/>}</div><section><small>{value.kind==='surprise'?[ar?'لمسة بلقيس':'Balqees Touch',ar?'اختيار بلقيس':'Balqees Choice',ar?'توقيع بلقيس':'Balqees Signature'][Math.min(index,2)]:(ar?'الأقرب لطلبك':'Closest match')}</small><strong>{productLabel(product,ar)}</strong><span>{product.price_on_request?(ar?'حسب الطلب':'On request'):formatSar(resolveProductPrice(product,rules).effective,lang)}</span></section><button onClick={()=>onQuick(product)}><ShoppingBag size={15}/>{ar?'اختيار':'Choose'}</button></article>):<div className="smart-assistant-empty"><PackageOpen size={34}/><h3>{ar?'ما لقينا خيارًا دقيقًا من الكتالوج الحالي':'No exact match in the current catalog'}</h3><p>{ar?'لن نخترع منتجًا أو سعرًا. غيّر الميزانية أو النوع، أو استعرض المتجر كاملًا.':'We will not invent a product or price. Adjust the budget or type, or browse the full store.'}</p></div>}</div>}
  </div><footer>{step>0&&<button className="ghost" onClick={()=>setStep(s=>Math.max(0,s-1))}>{ar?'السابق':'Back'}</button>}<span>{step+1} / 6</span>{current==='results'&&<button className="primary" onClick={onClose}>{ar?'استعرض المتجر':'Browse store'}</button>}</footer></section></div>;
}

function BudgetSheet({ar,value,setValue,overrun,setOverrun,active,onSave,onClear,onClose}){return <div className="smart-sheet-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="smart-budget-sheet"><header><div><small>{ar?'SMART BUDGET':'SMART BUDGET'}</small><h2>{ar?'خل المتجر يحترم ميزانيتك':'Keep the store inside your budget'}</h2></div><button onClick={onClose}><X/></button></header><label><span>{ar?'ميزانيتي':'My budget'}</span><div><input type="number" min="1" inputMode="numeric" value={value} onChange={e=>setValue(e.target.value)} placeholder="300"/><b>{ar?'ر.س':'SAR'}</b></div></label><button className={`smart-budget-overrun ${overrun?'active':''}`} onClick={()=>setOverrun(!overrun)}><span><strong>{ar?'اسمح بزيادة بسيطة':'Allow a small overrun'}</strong><small>{ar?'حتى 10% فقط فوق الميزانية':'Up to 10% above your budget'}</small></span><i>{overrun&&<Check size={13}/>}</i></button><p>{ar?'المنتجات ذات «السعر حسب الطلب» لا تظهر ضمن وضع الميزانية لأن سعرها غير معروف بعد.':'Products priced “on request” are excluded because their final price is not known yet.'}</p><footer>{active&&<button className="ghost" onClick={onClear}>{ar?'إيقاف الميزانية':'Turn off'}</button>}<button className="primary" onClick={onSave}>{ar?'تطبيق على المتجر':'Apply to store'}</button></footer></section></div>;}

function CompareSheet({rows,categoryById,rules,lang,onClose}){const ar=lang==='ar';return <div className="smart-sheet-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="smart-compare-sheet"><header><div><small>{ar?'مقارنة هادئة':'SIMPLE COMPARISON'}</small><h2>{ar?'قارن المعلومات، والقرار لك':'Compare the facts, then choose'}</h2></div><button onClick={onClose}><X/></button></header><div className="smart-compare-table"><div className="labels"><span>{ar?'المنتج':'Product'}</span><span>{ar?'السعر':'Price'}</span><span>{ar?'النوع':'Type'}</span><span>{ar?'التوفر':'Availability'}</span><span>{ar?'الوحدة':'Unit'}</span></div>{rows.map(product=>{const category=categoryById.get(String(product.category_id));const availability=productAvailability(product);return <div className="column" key={product.id}><span>{product.image_url?<img src={product.image_url} alt=""/>:<Flower2/>}<b>{productLabel(product,ar)}</b></span><strong>{product.price_on_request?(ar?'حسب الطلب':'On request'):formatSar(resolveProductPrice(product,rules).effective,lang)}</strong><em>{productKind(product,category)==='bouquet'?(ar?'باقة':'Bouquet'):productKind(product,category)==='gift'?(ar?'هدية':'Gift'):productKind(product,category)==='combo'?(ar?'باقة + هدية':'Bouquet + gift'):(ar?'منتج':'Product')}</em><em>{availability==='ready'?(ar?'جاهز':'Ready'):availability==='made_to_order'?(ar?'حسب الطلب':'Made to order'):(ar?'متاح':'Available')}</em><em>{ar?(product.unit_ar||'قطعة'):(product.unit_en||product.unit_ar||'piece')}</em></div>})}</div><footer><button onClick={onClose}>{ar?'إغلاق':'Close'}</button></footer></section></div>;}
