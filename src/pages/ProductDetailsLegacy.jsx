import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, Heart, LoaderCircle, LockKeyhole, PackageOpen, ShoppingBag, Sparkles } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { formatSar, resolveProductPrice } from '../lib/storePricing';
import { useSystemSettings } from '../lib/systemSettings';
import StoreCartDrawer from '../components/StoreCartDrawer';
import { removeFavorite, saveFavorite } from '../lib/favorites';
import { recordCustomerInterest } from '../lib/customerPreferences';

export default function ProductDetails({ lang }) {
  const ar = lang === 'ar'; const Back = ar ? ArrowRight : ArrowLeft;
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const storeBack = `/store${location.search || ''}`;
  const [cartUserId, setCartUserId] = useState(null);
  const cart = useBalqeesCart(cartUserId);
  const { settings: systemSettings } = useSystemSettings();
  const settings = systemSettings.store;
  const [session,setSession] = useState(null);
  const [isFavorite,setIsFavorite] = useState(false);
  const [product,setProduct] = useState(null); const [category,setCategory] = useState(null); const [rules,setRules] = useState([]); const [loading,setLoading]=useState(true); const [activeImage,setActiveImage]=useState(''); const [cartOpen,setCartOpen]=useState(false); const [qty,setQty]=useState(1);

  useEffect(()=>{ let live=true; (async()=>{
    let q = supabase.from('products').select('*').eq('visibility','public').eq('is_active',true);
    q = /^[0-9a-f-]{36}$/i.test(slug) ? q.eq('id',slug) : q.eq('slug',slug);
    const { data:p } = await q.maybeSingle();
    const [{data:r},{data:c},{data:a}] = await Promise.all([
      supabase.from('price_rules').select('*').eq('is_active',true),
      p?.category_id ? supabase.from('product_categories').select('*').eq('id',p.category_id).maybeSingle() : Promise.resolve({data:null}),
      supabase.auth.getSession(),
    ]);
    if(!live)return; setProduct(p||null); setRules(r||[]); setCategory(c||null); setSession(a?.session||null); setActiveImage(p?.image_url||p?.gallery?.[0]||''); setQty(Number(p?.min_order_quantity||1)); setLoading(false);
  })(); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,next)=>live&&setSession(next)); return()=>{live=false;subscription.unsubscribe();}; },[slug]);


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
    if (!cartUserId || !product?.id) { setIsFavorite(false); return () => { live = false; }; }
    supabase.from('customer_favorites').select('product_id').eq('user_id', cartUserId).eq('product_id', product.id).maybeSingle().then(({ data }) => { if (live) setIsFavorite(!!data); });
    return () => { live = false; };
  }, [cartUserId, product?.id]);

  useEffect(() => {
    if (!cartUserId || !product?.id) return;
    const key = `balqees-view:${cartUserId}:${product.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    recordCustomerInterest({
      user_id: cartUserId,
      event_type: 'view',
      product_id: product.id,
      category_id: product.category_id || null,
      metadata: { source: 'product_details' },
    });
  }, [cartUserId, product?.id]);

  const images = useMemo(()=>product?[product.image_url,...(Array.isArray(product.gallery)?product.gallery:[])].filter((x,i,a)=>x&&a.indexOf(x)===i):[],[product]);
  if(loading) return <div className="store-detail-loading shell"><LoaderCircle className="spin" size={28}/></div>;
  if(!settings.enabled) return <section className="store-detail-missing shell"><PackageOpen size={36}/><h1>{ar?'المتجر متوقف مؤقتًا':'Store is temporarily unavailable'}</h1><Link className="btn primary" to="/services">{ar?'عرض الخدمات':'View services'}</Link></section>;
  if(settings.guestBrowse===false&&!session) return <section className="store-detail-missing shell"><LockKeyhole size={36}/><h1>{ar?'سجّل الدخول لعرض المنتج':'Sign in to view this product'}</h1><button className="btn primary" onClick={()=>navigate(`/account?next=/store/${slug}`)}>{ar?'تسجيل الدخول':'Sign in'}</button></section>;
  if(!product) return <section className="store-detail-missing shell"><PackageOpen size={36}/><h1>{ar?'المنتج غير متاح':'Product unavailable'}</h1><Link className="btn primary" to={storeBack}>{ar?'العودة للمتجر':'Back to store'}</Link></section>;
  const pricing=resolveProductPrice(product,rules); const badge=pricing.rule?((ar?pricing.rule.badge_ar:pricing.rule.badge_en)||pricing.rule.badge_ar||pricing.rule.name_ar):null;
  const guestLocked=!session&&settings.guestCart===false;
  const showPrices=settings.showPrices!==false;
  const priceNote=settings.pricesIncludeVat!==false?(ar?'شامل الضريبة عند انطباقها':'VAT included where applicable'):(ar?'تُضاف الضريبة عند إنهاء الطلب':'VAT is added at checkout');

  async function toggleFavorite(){
    if(!session){navigate(`/account?next=/store/${slug}`);return;}
    if(!cartUserId||!product)return;
    if(isFavorite){const result=await removeFavorite({userId:cartUserId,product});if(!result.error)setIsFavorite(false);return;}
    const result=await saveFavorite({userId:cartUserId,product,unitPrice:resolveProductPrice(product,rules).effective});
    if(!result.error)setIsFavorite(true);
  }

  function addToCart(){
    if(guestLocked){navigate(`/account?next=/store/${slug}`);return;}
    cart.add(product, qty, { unit_price_snapshot: resolveProductPrice(product, rules).effective });setCartOpen(true);
  }

  return <div className="store-detail-page" dir={ar?'rtl':'ltr'}>
    <div className="shell"><Link className="store-back-link" to={storeBack}><Back size={16}/>{ar?'العودة للمتجر':'Back to store'}</Link>
      <section className="store-detail-grid">
        <div className="store-detail-media"><div className="store-detail-main">{(!session || cartUserId) && <button type="button" className={`store-detail-favorite ${isFavorite?'active':''}`} onClick={toggleFavorite} aria-label={ar ? (isFavorite?'إزالة من المفضلة':'إضافة للمفضلة') : (isFavorite?'Remove from favorites':'Save favorite')}><Heart size={20} fill={isFavorite?'currentColor':'none'}/><span>{isFavorite ? (ar?'محفوظ':'Saved') : (ar?'حفظ':'Save')}</span></button>}{activeImage?<img src={activeImage} alt={ar?product.name_ar:(product.name_en||product.name_ar)}/>:<PackageOpen size={48}/>} {badge&&<span>{badge}</span>}</div>{images.length>1&&<div className="store-detail-thumbs">{images.map(src=><button key={src} className={src===activeImage?'active':''} onClick={()=>setActiveImage(src)}><img src={src} alt=""/></button>)}</div>}</div>
        <div className="store-detail-copy"><div className="store-detail-kicker"><span>{category?(ar?category.name_ar:(category.name_en||category.name_ar)):'BALQEES'}</span>{product.is_featured&&<em><Sparkles size={13}/>{ar?'مختار من بلقيس':'Balqees selection'}</em>}</div><h1>{ar?product.name_ar:(product.name_en||product.name_ar)}</h1>{product.short_description_ar&&<p className="store-detail-lead">{ar?product.short_description_ar:(product.short_description_en||product.short_description_ar)}</p>}
          <div className="store-detail-price">{product.price_on_request || !showPrices?<><strong>{ar?'السعر حسب الطلب':'Price on request'}</strong><small>{ar?'سنراجع الكمية والتجهيز ثم نتواصل معك.':'We will review quantity and preparation before confirming price.'}</small></>:<><div><strong>{formatSar(pricing.effective,lang)}</strong>{pricing.onSale&&<del>{formatSar(pricing.regular,lang)}</del>}</div><small>{priceNote}</small></>}</div>
          <div className="store-detail-facts"><span><Check size={15}/>{ar?`وحدة البيع: ${product.unit_ar||'قطعة'}`:`Unit: ${product.unit_en||'piece'}`}</span>{(product.lead_time_ar||product.lead_time_en)&&<span><Clock3 size={15}/>{ar?(product.lead_time_ar||product.lead_time_en):(product.lead_time_en||product.lead_time_ar)}</span>}<span><Check size={15}/>{ar?`الحد الأدنى: ${product.min_order_quantity||1}`:`Minimum: ${product.min_order_quantity||1}`}</span></div>
          <div className="store-detail-order"><div className="store-detail-qty"><button onClick={()=>setQty(v=>Math.max(Number(product.min_order_quantity||1),Number(v)-1))}>−</button><input type="number" min={product.min_order_quantity||1} max={product.max_order_quantity||undefined} value={qty} onChange={e=>setQty(Number(e.target.value||1))}/><button onClick={()=>setQty(v=>product.max_order_quantity?Math.min(Number(product.max_order_quantity),Number(v)+1):Number(v)+1)}>+</button></div><button className="store-add-main" onClick={addToCart}>{guestLocked?<LockKeyhole size={18}/>:<ShoppingBag size={18}/>} {guestLocked?(ar?'سجّل الدخول للإضافة':'Sign in to add'):(product.price_on_request?(ar?'أضف لطلب عرض السعر':'Add to quote request'):(ar?'إضافة إلى السلة':'Add to cart'))}</button></div>
          <div className="store-detail-description"><h2>{ar?'تفاصيل المنتج':'Product details'}</h2><p>{ar?(product.description_ar||product.short_description_ar||''):(product.description_en||product.description_ar||product.short_description_en||product.short_description_ar||'')}</p></div>
          {!!product.tags?.length&&<div className="store-detail-tags">{product.tags.map(tag=><span key={tag}>#{tag}</span>)}</div>}
        </div>
      </section>
    </div>
    {(session||settings.guestCart!==false)&&<button className="store-floating-cart" onClick={()=>setCartOpen(true)}><ShoppingBag size={20}/>{cart.count>0&&<b>{cart.count}</b>}</button>}
    <StoreCartDrawer lang={lang} open={cartOpen} onClose={()=>setCartOpen(false)} rules={rules} settings={settings} cartUserId={cartUserId}/>
  </div>;
}
