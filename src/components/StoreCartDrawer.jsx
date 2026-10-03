import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LoaderCircle, Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { formatSar, resolveProductPrice } from '../lib/storePricing';

const errorText = {
  INVALID_COUPON: ['كود الخصم غير صحيح أو غير نشط.', 'Coupon is invalid or inactive.'],
  COUPONS_DISABLED: ['استخدام كوبونات الخصم متوقف حاليًا.', 'Coupons are currently disabled.'],
  COUPON_MIN_ORDER: ['قيمة السلة أقل من الحد الأدنى لهذا الخصم.', 'Cart value is below this coupon minimum.'],
  COUPON_LIMIT_REACHED: ['تم الوصول إلى الحد الإجمالي لاستخدام الخصم.', 'Coupon usage limit has been reached.'],
  COUPON_USER_LIMIT_REACHED: ['استخدمت هذا الخصم الحد المسموح لحسابك.', 'You reached your usage limit for this coupon.'],
  INSUFFICIENT_STOCK: ['إحدى الكميات المطلوبة أكبر من المخزون المتاح.', 'One quantity exceeds available stock.'],
  PRODUCT_UNAVAILABLE: ['أحد المنتجات لم يعد متاحًا.', 'A product is no longer available.'],
  STORE_DISABLED: ['المتجر متوقف مؤقتًا.', 'The store is temporarily disabled.'],
  STORE_MIN_ORDER: ['قيمة الطلب أقل من الحد الأدنى المطلوب.', 'Order value is below the store minimum.'],
  MIN_QUANTITY: ['إحدى الكميات أقل من الحد الأدنى للمنتج.', 'One quantity is below the product minimum.'],
  MAX_QUANTITY: ['إحدى الكميات تجاوزت الحد الأعلى للمنتج.', 'One quantity exceeds the product maximum.'],
};
function niceError(error, ar) {
  const message = String(error?.message || '');
  const key = Object.keys(errorText).find(k => message.includes(k));
  return key ? errorText[key][ar ? 0 : 1] : (ar ? 'تعذر إكمال العملية الآن. حاول مرة أخرى.' : 'Could not complete this action right now. Please try again.');
}

export default function StoreCartDrawer({ lang, open, onClose, rules = [], settings = {}, cartUserId = null }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const cart = useBalqeesCart(cartUserId);
  const showPrices = settings.showPrices !== false;
  const allowCoupons = settings.allowCoupons !== false;
  const [products, setProducts] = useState([]);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [coupon, setCoupon] = useState('');
  const [quote, setQuote] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const cartKey = cart.items.map(x => `${x.product_id}:${x.quantity}`).join('|');

  useEffect(() => {
    if (!open) return;
    let live = true;
    (async () => {
      const ids = cart.items.map(x => x.product_id);
      const [auth, rows] = await Promise.all([
        supabase.auth.getSession(),
        ids.length ? supabase.from('products').select('*').in('id', ids) : Promise.resolve({ data: [] }),
      ]);
      if (!live) return;
      setSession(auth.data.session || null);
      setProducts(rows.data || []);
      if (auth.data.session?.user?.id) {
        const { data } = await supabase.from('customer_profiles').select('national_address').eq('id', auth.data.session.user.id).maybeSingle();
        if (live) setProfile(data || null);
      }
    })();
    return () => { live = false; };
  }, [open, cartKey]);

  useEffect(() => { setQuote(null); setError(''); }, [cart.items, settings.vatRate, settings.pricesIncludeVat, settings.minimumOrder, settings.allowCoupons]);
  useEffect(() => { if (!allowCoupons) { setCoupon(''); setQuote(null); } }, [allowCoupons]);

  const map = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products]);
  const lines = useMemo(() => cart.items.map(item => ({ ...item, product: map[item.product_id] })).filter(x => x.product), [cart.items, map]);
  const estimate = useMemo(() => lines.reduce((sum, line) => {
    const price = resolveProductPrice(line.product, rules).effective;
    return sum + Number(price || 0) * Number(line.quantity || 0);
  }, 0), [lines, rules]);

  async function applyCoupon() {
    if (!allowCoupons) return;
    if (!session) { navigate('/account'); onClose?.(); return; }
    setBusy(true); setError('');
    const { data, error: rpcError } = await supabase.rpc('preview_customer_cart', { p_items: cart.items, p_coupon_code: coupon.trim() || null });
    if (rpcError) { setQuote(null); setError(niceError(rpcError, ar)); }
    else setQuote(data);
    setBusy(false);
  }

  async function checkout() {
    if (!session) { navigate('/account'); onClose?.(); return; }
    let isIndividual = !!cartUserId;
    if (!isIndividual && session?.user?.id) {
      const { data: accountProfile } = await supabase.from('customer_profiles').select('account_type').eq('id', session.user.id).maybeSingle();
      isIndividual = accountProfile?.account_type === 'individual';
    }
    if (isIndividual) { navigate('/account/cart'); onClose?.(); return; }
    if (!cart.items.length) return;
    setBusy(true); setError(''); setSuccess(null);
    const { data, error: rpcError } = await supabase.rpc('create_customer_order', {
      p_items: cart.items,
      p_coupon_code: allowCoupons ? (coupon.trim() || null) : null,
      p_customer_note: note.trim() || null,
      p_service_address: profile?.national_address || {},
    });
    if (rpcError) setError(niceError(rpcError, ar));
    else {
      setSuccess(data); cart.clear(); setQuote(null); setCoupon(''); setNote('');
    }
    setBusy(false);
  }

  const vatNote = settings.pricesIncludeVat !== false
    ? (ar ? `الأسعار تشمل ضريبة القيمة المضافة (${Number(settings.vatRate ?? 15)}٪) عند انطباقها.` : `Prices include VAT (${Number(settings.vatRate ?? 15)}%) where applicable.`)
    : (ar ? `تضاف ضريبة القيمة المضافة (${Number(settings.vatRate ?? 15)}٪) عند إنهاء الطلب.` : `VAT (${Number(settings.vatRate ?? 15)}%) is added at checkout.`);

  if (!open) return null;
  return <div className="store-cart-overlay" onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
    <aside className="store-cart-drawer" dir={ar ? 'rtl' : 'ltr'}>
      <header><div><span><ShoppingBag size={17}/>{ar ? 'سلة بلقيس' : 'BALQEES CART'}</span><h2>{ar ? 'طلبك' : 'Your request'}</h2></div><button onClick={onClose}><X size={21}/></button></header>
      {success ? <div className="store-order-success"><CheckCircle2 size={42}/><h3>{ar ? 'تم استلام طلبك' : 'Order received'}</h3><p>{ar ? `رقم الطلب #${String(success.order_number).padStart(5,'0')}. ستجد تحديثاته في حسابك.` : `Order #${String(success.order_number).padStart(5,'0')} was received. Track updates in your account.`}</p><button className="btn primary" onClick={() => { onClose?.(); navigate('/account'); }}>{ar ? 'فتح حسابي' : 'Open my account'}</button></div> : <>
        <div className="store-cart-lines">{lines.length ? lines.map(line => {
          const pricing = resolveProductPrice(line.product, rules);
          return <article key={line.product_id}><div className="store-cart-image">{line.product.image_url ? <img src={line.product.image_url} alt=""/> : <ShoppingBag size={20}/>}</div><div className="store-cart-line-copy"><strong>{ar ? line.product.name_ar : (line.product.name_en || line.product.name_ar)}</strong><small>{line.product.price_on_request || !showPrices ? (ar ? 'السعر حسب الطلب' : 'Price on request') : formatSar(pricing.effective,lang)}</small><div className="store-qty"><button onClick={() => cart.update(line.product_id, Number(line.quantity)-1, line.product)}><Minus size={14}/></button><span>{line.quantity}</span><button onClick={() => cart.update(line.product_id, Number(line.quantity)+1, line.product)}><Plus size={14}/></button></div></div><button className="store-cart-remove" onClick={() => cart.remove(line.product_id)}><Trash2 size={16}/></button></article>;
        }) : <div className="store-cart-empty"><ShoppingBag size={30}/><strong>{ar ? 'السلة فارغة' : 'Your cart is empty'}</strong><p>{ar ? 'اختر منتجاتك وسيظهر كل شيء هنا.' : 'Choose products and they will appear here.'}</p></div>}</div>

        {!!lines.length && <div className="store-cart-checkout">
          {!cartUserId && allowCoupons && <div className="store-coupon"><Tag size={16}/><input value={coupon} onChange={e=>setCoupon(e.target.value)} placeholder={ar ? 'كود الخصم' : 'Coupon code'}/><button onClick={applyCoupon} disabled={busy}>{ar ? 'تطبيق' : 'Apply'}</button></div>}
          {!cartUserId && error && <div className="store-cart-error">{error}</div>}
          {!cartUserId && <textarea rows="2" value={note} onChange={e=>setNote(e.target.value)} placeholder={ar ? 'ملاحظة على الطلب (اختياري)' : 'Order note (optional)'}/>}
          <div className="store-cart-summary">{showPrices ? <><div><span>{ar ? 'الإجمالي المبدئي' : 'Estimated subtotal'}</span><strong>{formatSar(quote?.subtotal ?? estimate,lang)}</strong></div>{Number(quote?.discount_total||0)>0&&<div className="discount"><span>{ar?'الخصم':'Discount'}</span><strong>- {formatSar(quote.discount_total,lang)}</strong></div>}{quote&&settings.pricesIncludeVat===false&&Number(quote?.vat_total||0)>0&&<div><span>{ar?'الضريبة':'VAT'}</span><strong>{formatSar(quote.vat_total,lang)}</strong></div>}<div className="total"><span>{ar ? 'الإجمالي' : 'Total'}</span><strong>{formatSar(quote?.total ?? estimate,lang)}</strong></div></> : <div className="total"><span>{ar?'التسعير':'Pricing'}</span><strong>{ar?'بعد المراجعة':'After review'}</strong></div>}<small>{vatNote} {ar ? 'المنتجات «حسب الطلب» تُراجع قبل التسعير النهائي.' : '“On request” items are reviewed before final pricing.'}</small>{Number(settings.minimumOrder||0)>0&&<small>{ar?`الحد الأدنى للطلب ${formatSar(settings.minimumOrder,lang)}.`:`Minimum order ${formatSar(settings.minimumOrder,lang)}.`}</small>}</div>
          {cartUserId && <div className="store-cart-error" style={{background:'#f3f7f1',color:'#496452',borderColor:'#dbe5d9'}}>{ar ? 'هذه معاينة سريعة فقط. الخصومات وفحص السعر والتوفر موجودة في السلة الذكية.' : 'This is a quick preview. Discounts and price/availability checks live in the smart cart.'}</div>}
          <button className="store-checkout-button" onClick={checkout} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <ShoppingBag size={18}/>} {session ? (cartUserId ? (ar ? 'فتح السلة الذكية' : 'Open smart cart') : (ar ? 'إرسال الطلب' : 'Submit order')) : (ar ? 'سجل الدخول لإكمال الطلب' : 'Sign in to checkout')}</button>
        </div>}
      </>}
    </aside>
  </div>;
}
