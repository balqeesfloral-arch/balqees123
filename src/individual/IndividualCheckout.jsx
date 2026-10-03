import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Bell, Check, ChevronDown,
  CircleAlert, CircleCheck, Gift, Heart, Home, LoaderCircle, MapPin, PackageOpen,
  RefreshCw, ShieldCheck, ShoppingBag, Sparkles, Store, Tag, UserRound, WalletCards,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { formatSar } from '../lib/storePricing';
import { addressText } from './individualUtils';
import './individual-checkout.css';

const DRAFT_KEY = userId => `balqees-individual-checkout-draft-v1:${userId}`;
const EARLY_STATUSES = new Set(['pending','under_review','quoted','approved']);

const ERROR_COPY = {
  EMPTY_CART: ['السلة فارغة.', 'Your cart is empty.'],
  ADDRESS_REQUIRED: ['اختر عنوان التسليم أولًا.', 'Choose a delivery address first.'],
  ADDRESS_INCOMPLETE: ['العنوان يحتاج معلومات إضافية قبل تأكيد الطلب.', 'The address needs more detail before checkout.'],
  RECIPIENT_INVALID: ['المستلم المختار لم يعد متاحًا.', 'The selected recipient is no longer available.'],
  RECIPIENT_REQUIRED_FOR_PAYER: ['اختر المستلم المسؤول عن السداد.', 'Choose the recipient responsible for payment.'],
  PAYER_PHONE_REQUIRED: ['رقم تواصل المسؤول عن السداد مطلوب.', 'The payer contact number is required.'],
  EMAIL_VERIFICATION_REQUIRED: ['أكد بريدك الإلكتروني قبل اعتماد الدفع عند الاستلام.', 'Verify your email before using cash on delivery.'],
  QUOTE_ITEMS_REQUIRE_REVIEW: ['يوجد منتج سعره حسب الطلب ويحتاج تسعيرًا قبل تأكيد الطلب.', 'An on-request item must be priced before checkout can be confirmed.'],
  GIFT_SENDER_PAYMENT_ARRANGEMENT_REQUIRED: ['المستلم شخص آخر وأنت المسؤول عن السداد؛ لأن الدفع عند الاستلام يتم قبل التسليم، نحتاج ترتيب السداد مع فريق بلقيس أولًا.', 'Another person will receive the order while you are the payer; because COD is collected before handover, payment must be arranged with Balqees first.'],
  RECIPIENT_PAYMENT_AWARENESS_REQUIRED: ['أكد أن المستلم يعلم أنه المسؤول عن السداد.', 'Confirm that the recipient knows they are responsible for payment.'],
  TERMS_REQUIRED: ['وافق على شروط الدفع عند الاستلام قبل التأكيد.', 'Accept the cash-on-delivery terms before confirming.'],
  IDEMPOTENCY_REQUIRED: ['تعذر تجهيز مفتاح أمان الطلب. أعد تحميل الصفحة.', 'We could not prepare the order safety key. Reload the page.'],
  COD_ACCOUNT_REVIEW_REQUIRED: ['الدفع عند الاستلام يحتاج مراجعة لحسابك قبل إنشاء طلب جديد. تواصل مع فريق بلقيس.', 'Cash on delivery needs an account review before a new order can be created. Contact Balqees Care.'],
  INVALID_COUPON: ['رمز الخصم غير صالح أو انتهت صلاحيته.', 'The coupon is invalid or expired.'],
  COUPON_MIN_ORDER: ['السلة أقل من الحد الأدنى المطلوب للكوبون.', 'The cart is below the coupon minimum.'],
  COUPON_LIMIT_REACHED: ['وصل الكوبون إلى حد الاستخدام.', 'The coupon usage limit has been reached.'],
  COUPON_USER_LIMIT_REACHED: ['وصل حسابك إلى حد استخدام هذا الكوبون.', 'Your account has reached this coupon usage limit.'],
  PRODUCT_UNAVAILABLE: ['أحد المنتجات لم يعد متاحًا.', 'A product is no longer available.'],
  INSUFFICIENT_STOCK: ['إحدى الكميات أكبر من المتاح حاليًا.', 'One quantity is higher than current stock.'],
  MIN_QUANTITY: ['إحدى الكميات أقل من الحد الأدنى للمنتج.', 'One quantity is below the product minimum.'],
  MAX_QUANTITY: ['إحدى الكميات تجاوزت الحد الأعلى للمنتج.', 'One quantity exceeds the product maximum.'],
  STORE_DISABLED: ['المتجر متوقف مؤقتًا.', 'The store is temporarily unavailable.'],
  STORE_MIN_ORDER: ['السلة أقل من الحد الأدنى للطلب.', 'The cart is below the store minimum.'],
  INDIVIDUAL_ACCOUNT_REQUIRED: ['إتمام الطلب هذا مخصص للحساب الفردي.', 'This checkout is restricted to individual accounts.'],
};

function errorCopy(error, ar) {
  const message = String(error?.message || error || '');
  const key = Object.keys(ERROR_COPY).find(code => message.includes(code));
  return key ? ERROR_COPY[key][ar ? 0 : 1] : (ar ? 'تعذر إكمال العملية الآن. راجع البيانات وحاول مرة أخرى.' : 'We could not complete this step. Review the details and try again.');
}

function orderNumber(value) { return `#${String(value || '').padStart(5,'0')}`; }
function recipientName(recipient, ar) { return recipient?.label || recipient?.full_name || (ar ? 'مستلم محفوظ' : 'Saved recipient'); }
function itemName(item, ar) { return ar ? (item?.name_ar || item?.name_en || 'منتج بلقيس') : (item?.name_en || item?.name_ar || 'Balqees product'); }
function safeLocalDraft(userId) {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY(userId)) || '{}'); } catch { return {}; }
}
function newIdempotencyKey() {
  try { return crypto.randomUUID(); } catch {
    const hex = () => Math.floor(Math.random()*0xffffffff).toString(16).padStart(8,'0');
    const a=hex(), b=hex(), c=hex(), d=hex();
    return `${a}-${b.slice(0,4)}-4${b.slice(5,8)}-8${c.slice(1,4)}-${c.slice(4)}${d}`.slice(0,36);
  }
}

function CheckoutChrome({ lang, session, cartCount, children }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    document.body.classList.add('individual-account-active');
    return () => document.body.classList.remove('individual-account-active');
  }, []);
  useEffect(() => {
    if (!session?.user?.id || !supabase) return;
    supabase.from('customer_profiles').select('full_name').eq('id',session.user.id).maybeSingle().then(({data})=>setProfile(data||null));
  }, [session?.user?.id]);
  const fullName = profile?.full_name || session?.user?.email?.split('@')[0] || (ar ? 'عميل بلقيس' : 'Balqees client');
  const firstName = fullName.trim().split(/\s+/)[0];
  return <div className="individual-account-app checkout-app" dir={ar?'rtl':'ltr'}>
    <header className="individual-topbar checkout-topbar"><div className="individual-shell individual-topbar-inner">
      <Link to="/" className="individual-brand"><BrandMark/></Link>
      <div className="individual-topbar-center"><span>{ar?'إتمام الطلب':'CHECKOUT'}</span><small>{ar?'حساب فردي':'INDIVIDUAL ACCOUNT'}</small></div>
      <div className="individual-top-actions">
        <button type="button" className="individual-icon-button" onClick={()=>navigate('/account/notifications')}><Bell size={19}/></button>
        <button type="button" className="individual-icon-button" onClick={()=>navigate('/account/cart')}><ShoppingBag size={19}/>{cartCount>0&&<b>{Math.min(cartCount,99)}</b>}</button>
        <button type="button" className="individual-profile-chip" onClick={()=>navigate('/account/profile')}><span>{fullName.slice(0,1).toUpperCase()}</span><div><small>{ar?'مرحبًا':'Welcome'}</small><strong>{firstName}</strong></div></button>
      </div>
    </div></header>
    {children}
    <nav className="individual-mobile-dock"><Link to="/account"><Home/><span>{ar?'الرئيسية':'Home'}</span></Link><Link to="/account/orders"><PackageOpen/><span>{ar?'طلباتي':'Orders'}</span></Link><Link to="/store"><Store/><span>{ar?'المتجر':'Store'}</span></Link><Link to="/account/favorites"><Heart/><span>{ar?'المفضلة':'Favorites'}</span></Link><Link to="/account/profile"><UserRound/><span>{ar?'حسابي':'Account'}</span></Link></nav>
  </div>;
}

export default function IndividualCheckout({ lang }) {
  const ar = lang === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const navigate = useNavigate();
  const [authReady,setAuthReady] = useState(false);
  const [session,setSession] = useState(null);
  const cart = useBalqeesCart(session?.user?.id || null);
  const [profile,setProfile] = useState(null);
  const [accountType,setAccountType] = useState(null);
  const [accessStatus,setAccessStatus] = useState('active');
  const [mfaRequired,setMfaRequired] = useState(false);
  const [checkoutGateError,setCheckoutGateError] = useState('');
  const [addresses,setAddresses] = useState([]);
  const [recipients,setRecipients] = useState([]);
  const [relations,setRelations] = useState([]);
  const [preferences,setPreferences] = useState(null);
  const [step,setStep] = useState(1);
  const [recipientId,setRecipientId] = useState(null);
  const [addressId,setAddressId] = useState(null);
  const [payerType,setPayerType] = useState('self');
  const [recipientKnowsPayment,setRecipientKnowsPayment] = useState(false);
  const [isGift,setIsGift] = useState(false);
  const [giftMessage,setGiftMessage] = useState('');
  const [senderNameVisible,setSenderNameVisible] = useState(true);
  const [customerNote,setCustomerNote] = useState('');
  const [occasionId,setOccasionId] = useState(null);
  const [coupon,setCoupon] = useState('');
  const [idempotencyKey,setIdempotencyKey] = useState(null);
  const [quote,setQuote] = useState(null);
  const [health,setHealth] = useState(null);
  const [loading,setLoading] = useState(true);
  const [healthBusy,setHealthBusy] = useState(false);
  const [error,setError] = useState('');
  const [termsAccepted,setTermsAccepted] = useState(false);
  const [termsOpen,setTermsOpen] = useState(false);
  const [submitting,setSubmitting] = useState(false);
  const [success,setSuccess] = useState(null);
  const [verifySending,setVerifySending] = useState(false);
  const hydrated = useRef(false);
  const saveTimer = useRef(null);

  useEffect(()=>{
    if(!supabase){setAuthReady(true);return;}
    let live=true;
    supabase.auth.getSession().then(({data})=>{if(live){setSession(data.session);setAuthReady(true);}});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,next)=>{if(live){setSession(next);setAuthReady(true);}});
    return()=>{live=false;subscription.unsubscribe();};
  },[]);

  useEffect(()=>{
    if(session) return;
    hydrated.current=false;
    setLoading(false);
    setProfile(null);
    setAccountType(null);
    setAccessStatus('active');
    setMfaRequired(false);
    setCheckoutGateError('');
  },[session]);

  useEffect(()=>{
    if(!session?.user?.id||!supabase)return;
    let live=true;
    setLoading(true);
    (async()=>{
      const uid=session.user.id;
      const [p,a,r,rel,pref,draft,last,access,aal] = await Promise.all([
        supabase.from('customer_profiles').select('id,full_name,phone,email,personal,account_type').eq('id',uid).maybeSingle(),
        supabase.from('customer_addresses').select('*').eq('user_id',uid).eq('is_active',true).order('is_default',{ascending:false}).order('updated_at',{ascending:false}),
        supabase.from('customer_recipients').select('*').eq('user_id',uid).eq('is_active',true).order('is_favorite',{ascending:false}).order('updated_at',{ascending:false}),
        supabase.from('customer_recipient_addresses').select('recipient_id,address_id,is_default,last_used_at').eq('user_id',uid),
        supabase.from('customer_preferences').select('*').eq('user_id',uid).maybeSingle(),
        supabase.from('customer_checkout_drafts').select('*').eq('user_id',uid).maybeSingle(),
        supabase.from('orders').select('customer_address_id,customer_recipient_id,payer_type,is_gift,gift_message,sender_name_visible,customer_note,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1).maybeSingle(),
        supabase.from('admin_user_state').select('status').eq('user_id',uid).maybeSingle(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if(!live)return;
      setProfile(p.data||null); setAccountType(p.data?.account_type||null); setAddresses(a.data||[]); setRecipients(r.data||[]); setRelations(rel.data||[]); setPreferences(pref.data||null);
      setAccessStatus(access.data?.status||'active');
      const needsMfa = !aal.error && aal.data?.nextLevel==='aal2' && aal.data?.currentLevel!=='aal2';
      setMfaRequired(needsMfa);
      const gateProblem = p.error || !p.data
        ? (ar?'تعذر التحقق من نوع الحساب. لن نفتح إتمام الطلب قبل اكتمال التحقق.':'We could not verify the account type. Checkout remains locked.')
        : access.error
          ? (ar?'تعذر التحقق من حالة الحساب.':'Could not verify the account access state.')
          : aal.error
            ? (ar?'تعذر التحقق من مستوى حماية الجلسة.':'Could not verify session security.')
            : '';
      setCheckoutGateError(gateProblem);
      if(gateProblem || p.data?.account_type!=='individual' || ['blocked','suspended'].includes(access.data?.status) || needsMfa){
        hydrated.current=false;
        setLoading(false);
        return;
      }
      const local=safeLocalDraft(uid); const remote=draft.data||{};
      const remoteNewer = remote.updated_at && (!local.updated_at || new Date(remote.updated_at)>=new Date(local.updated_at));
      const base = remoteNewer ? {...local,...remote} : {...remote,...local};
      const fallback = pref.data?.reuse_last_checkout_details ? (last.data||{}) : {};
      const pickedRecipient = base.recipient_id ?? base.customer_recipient_id ?? fallback.customer_recipient_id ?? pref.data?.default_recipient_id ?? null;
      const pickedAddress = base.address_id ?? base.customer_address_id ?? fallback.customer_address_id ?? pref.data?.default_address_id ?? (a.data||[]).find(x=>x.is_default)?.id ?? (a.data||[])[0]?.id ?? null;
      setStep(Math.min(3,Math.max(1,Number(base.step||1))));
      setRecipientId(pickedRecipient || null);
      setAddressId(pickedAddress || null);
      setPayerType(base.payer_type || fallback.payer_type || 'self');
      setIsGift(base.is_gift ?? fallback.is_gift ?? cart.items.some(x=>x.is_gift));
      setGiftMessage(base.gift_message ?? fallback.gift_message ?? '');
      setSenderNameVisible(base.sender_name_visible ?? fallback.sender_name_visible ?? true);
      setCustomerNote(base.customer_note ?? fallback.customer_note ?? '');
      setOccasionId(base.occasion_id || null);
      const savedCoupon = base.coupon_code || localStorage.getItem(`balqees-cart-applied-coupon:${uid}`) || '';
      setCoupon(savedCoupon);
      setIdempotencyKey(base.idempotency_key || newIdempotencyKey());
      hydrated.current=true;
      setLoading(false);
    })();
    return()=>{live=false;};
  },[session?.user?.id]);

  useEffect(()=>{
    if(!session?.user?.id||!hydrated.current||!idempotencyKey)return;
    if(saveTimer.current)clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(async()=>{
      const uid=session.user.id;
      const payload={user_id:uid,step,recipient_id:recipientId||null,address_id:addressId||null,payer_type:payerType,is_gift:isGift,gift_message:giftMessage||null,sender_name_visible:senderNameVisible,customer_note:customerNote||null,coupon_code:coupon||null,occasion_id:occasionId||null,idempotency_key:idempotencyKey,updated_at:new Date().toISOString()};
      try{localStorage.setItem(DRAFT_KEY(uid),JSON.stringify({...payload,customer_recipient_id:recipientId||null,customer_address_id:addressId||null}));}catch{}
      await supabase.from('customer_checkout_drafts').upsert(payload,{onConflict:'user_id'});
    },500);
    return()=>clearTimeout(saveTimer.current);
  },[session?.user?.id,step,recipientId,addressId,payerType,isGift,giftMessage,senderNameVisible,customerNote,coupon,occasionId,idempotencyKey]);

  const selectedRecipient=useMemo(()=>recipients.find(x=>x.id===recipientId)||null,[recipients,recipientId]);
  const selectedAddress=useMemo(()=>addresses.find(x=>x.id===addressId)||null,[addresses,addressId]);
  function chooseSelfRecipient(){
    setRecipientId(null);
    setPayerType('self');
    setRecipientKnowsPayment(false);
    const next=preferences?.default_address_id || addresses.find(x=>x.is_default)?.id || addresses[0]?.id || null;
    setAddressId(next);
  }
  function chooseSavedRecipient(recipient){
    setRecipientId(recipient.id);
    setPayerType('recipient');
    setRecipientKnowsPayment(false);
    const linkedDefault=relations.find(x=>x.recipient_id===recipient.id&&x.is_default)?.address_id;
    const next=linkedDefault || recipient.default_address_id || preferences?.default_address_id || addresses.find(x=>x.is_default)?.id || addresses[0]?.id || null;
    setAddressId(next);
  }
  const linkedAddressIds=useMemo(()=>new Set(relations.filter(x=>x.recipient_id===recipientId).map(x=>x.address_id)),[relations,recipientId]);
  const sortedAddresses=useMemo(()=>[...addresses].sort((a,b)=>{
    if(recipientId){const al=linkedAddressIds.has(a.id)?1:0,bl=linkedAddressIds.has(b.id)?1:0;if(al!==bl)return bl-al;}
    return Number(b.is_default)-Number(a.is_default);
  }),[addresses,recipientId,linkedAddressIds]);
  const cartKey=useMemo(()=>cart.items.map(x=>`${x.product_id}:${x.quantity}:${x.is_gift?1:0}`).join('|'),[cart.items]);
  const itemsPayload=useMemo(()=>cart.items.map(x=>({product_id:x.product_id,quantity:Number(x.quantity||1)})),[cartKey]);

  async function refreshHealth({quiet=false}={}){
    if(!session?.user?.id||!cart.items.length)return null;
    setError(''); if(!quiet)setHealthBusy(true);
    if(!addressId){
      const {data,error:e}=await supabase.rpc('preview_customer_cart',{p_items:itemsPayload,p_coupon_code:coupon?.trim()||null});
      if(e)setError(errorCopy(e,ar)); else setQuote(data||null);
      if(!quiet)setHealthBusy(false); return data;
    }
    const {data,error:e}=await supabase.rpc('customer_checkout_health',{p_items:itemsPayload,p_coupon_code:coupon?.trim()||null,p_address_id:addressId,p_recipient_id:recipientId||null,p_payer_type:payerType,p_is_gift:isGift});
    if(e){setHealth(null);setError(errorCopy(e,ar));if(!quiet)setHealthBusy(false);return null;}
    setHealth(data||null);setQuote(data||null);if(!quiet)setHealthBusy(false);return data;
  }

  useEffect(()=>{if(authReady&&session&&!loading&&cart.items.length)refreshHealth({quiet:true});},[authReady,session?.user?.id,loading,cartKey,addressId,recipientId,payerType,isGift,coupon]);

  useEffect(()=>{
    if(recipientId&&selectedRecipient?.default_address_id&&!addressId)setAddressId(selectedRecipient.default_address_id);
    if(!recipientId&&payerType==='recipient')setPayerType('self');
  },[recipientId,selectedRecipient?.default_address_id]);

  async function resendVerification(){
    if(!session?.user?.email)return; setVerifySending(true);
    const {error:e}=await supabase.auth.resend({type:'signup',email:session.user.email,options:{emailRedirectTo:`${window.location.origin}/checkout`}});
    setVerifySending(false);setError(e?errorCopy(e,ar):(ar?'أرسلنا رسالة تحقق جديدة إلى بريدك.':'A new verification email was sent.'));
  }

  function goNext(){
    setError('');
    if(step===1&&!addressId){setError(ar?'اختر عنوان التسليم قبل المتابعة.':'Choose a delivery address before continuing.');return;}
    if(step===2&&payerType==='recipient'&&!recipientKnowsPayment){setError(ERROR_COPY.RECIPIENT_PAYMENT_AWARENESS_REQUIRED[ar?0:1]);return;}
    setStep(s=>Math.min(3,s+1));
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function goBack(){setError('');setStep(s=>Math.max(1,s-1));window.scrollTo({top:0,behavior:'smooth'});}

  async function confirmOrder(){
    if(!termsAccepted){setError(ERROR_COPY.TERMS_REQUIRED[ar?0:1]);return;}
    const checked=await refreshHealth();
    if(!checked?.can_submit){setError(ERROR_COPY[checked?.block_reason]?.[ar?0:1] || (ar?'راجع الملاحظات قبل تأكيد الطلب.':'Review the checkout notes before confirming.'));return;}
    setSubmitting(true);setError('');
    const args={p_items:itemsPayload,p_coupon_code:coupon?.trim()||null,p_customer_note:customerNote?.trim()||null,p_address_id:addressId,p_recipient_id:recipientId||null,p_is_gift:isGift,p_gift_message:isGift?(giftMessage?.trim()||null):null,p_sender_name_visible:senderNameVisible,p_payer_type:payerType,p_recipient_knows_payment:recipientKnowsPayment,p_accept_cod_terms:true,p_idempotency_key:idempotencyKey,p_occasion_id:occasionId||null};
    let {data,error:e}=await supabase.rpc('customer_checkout_create_order',args);
    if(e){
      const {data:existing}=await supabase.from('orders').select('id,order_number,status,subtotal,discount_total,vat_total,total,payment_method,payment_status,cod_confirmation_status,cod_review_required,cod_review_status').eq('user_id',session.user.id).eq('checkout_idempotency_key',idempotencyKey).maybeSingle();
      if(existing)data={order_id:existing.id,order_number:existing.order_number,...existing,recovered:true};
      else {setSubmitting(false);setError(errorCopy(e,ar));return;}
    }
    cart.clear();
    try{localStorage.removeItem(DRAFT_KEY(session.user.id));localStorage.removeItem(`balqees-cart-applied-coupon:${session.user.id}`);localStorage.removeItem(`balqees-cart-coupon:${session.user.id}`);}catch{}
    setSuccess(data);setSubmitting(false);
    navigate(`/account/orders/${data.order_id}?created=1`, { replace: true });
  }

  if(!authReady||(session&&loading))return <div className="checkout-auth-screen"><LoaderCircle className="spin"/><span>{ar?'نجهز إتمام الطلب…':'Preparing checkout…'}</span></div>;
  if(!session)return <section className="checkout-auth-screen"><ShieldCheck size={34}/><h1>{ar?'سجّل الدخول لإتمام الطلب':'Sign in to complete checkout'}</h1><p>{ar?'السلة ستبقى محفوظة، وبعد تسجيل الدخول نكمل بيانات الاستلام والمراجعة.':'Your cart will stay saved and you can continue after signing in.'}</p><Link className="checkout-primary" to="/account?next=/checkout">{ar?'تسجيل الدخول':'Sign in'}<Arrow size={16}/></Link></section>;
  if(checkoutGateError)return <section className="checkout-auth-screen"><ShieldCheck size={34}/><h1>{ar?'تعذر التحقق من الحساب':'Account verification failed'}</h1><p>{checkoutGateError}</p><Link className="checkout-primary" to="/account?next=/checkout">{ar?'العودة لبوابة الأمان':'Return to security gate'}<Arrow size={16}/></Link></section>;
  if(['blocked','suspended'].includes(accessStatus))return <section className="checkout-auth-screen"><ShieldCheck size={34}/><h1>{accessStatus==='blocked'?(ar?'تم إيقاف الحساب':'Account blocked'):(ar?'الحساب معلّق':'Account suspended')}</h1><p>{ar?'إتمام الطلب غير متاح حتى تعود حالة الحساب إلى نشط.':'Checkout is unavailable until the account is active again.'}</p><Link className="checkout-primary" to="/account">{ar?'فتح حسابي':'Open my account'}<Arrow size={16}/></Link></section>;
  if(mfaRequired)return <section className="checkout-auth-screen"><ShieldCheck size={34}/><h1>{ar?'أكمل التحقق بخطوتين':'Complete two-factor authentication'}</h1><p>{ar?'حسابك محمي بعامل ثانٍ، ولن نعتمد أي طلب قبل إكماله.':'Your account uses a second factor, and checkout stays locked until it is verified.'}</p><Link className="checkout-primary" to="/account?next=/checkout">{ar?'فتح بوابة الأمان':'Open security gate'}<Arrow size={16}/></Link></section>;
  if(accountType!=='individual')return <section className="checkout-auth-screen"><ShieldCheck size={34}/><h1>{ar?'هذا الإتمام مخصص للحساب الفردي':'This checkout is for individual accounts'}</h1><p>{ar?'استخدم بوابة المنشأة للطلبات والخدمات الخاصة بحساب المنشأة.':'Use the organization portal for organization orders and services.'}</p><Link className="checkout-primary" to="/portal">{ar?'فتح بوابة المنشأة':'Open organization portal'}<Arrow size={16}/></Link></section>;

  if(success)return <CheckoutChrome lang={lang} session={session} cartCount={0}><main className="checkout-success individual-shell"><div className="checkout-success-mark"><CircleCheck size={38}/></div><span>{ar?'تم استلام طلبك':'ORDER RECEIVED'}</span><h1>{ar?`طلبك ${orderNumber(success.order_number)} وصل لبلقيس`:`Order ${orderNumber(success.order_number)} reached Balqees`}</h1><p>{success.cod_review_required?(ar?'الطلب قيد مراجعة إضافية قبل بدء التجهيز. ستظهر لك أي خطوة مطلوبة في الطلبات والإشعارات.':'Your order is under an additional review before preparation starts. Any required action will appear in Orders and Notifications.'):(success.cod_confirmation_status==='recipient_confirmation_required'?(ar?'الطلب مسجل، ويحتاج تأكيد المستلم لمسؤوليته عن السداد قبل بدء التجهيز.':'The order is recorded and the recipient must confirm payment responsibility before preparation starts.'):(ar?'سنراجع الطلب ونحدث حالته من خلال حسابك. الدفع عند الاستلام.':'We will review the order and keep its status updated in your account. Payment is cash on delivery.'))}</p><div className="checkout-success-card"><div><small>{ar?'رقم الطلب':'Order'}</small><strong>{orderNumber(success.order_number)}</strong></div><div><small>{ar?'الإجمالي الحالي':'Current total'}</small><strong>{formatSar(success.total,lang)}</strong></div><div><small>{ar?'طريقة الدفع':'Payment'}</small><strong>{ar?'الدفع عند الاستلام':'Cash on delivery'}</strong></div></div><div className="checkout-success-actions"><button className="checkout-primary" onClick={()=>navigate(`/account/orders/${success.order_id}`)}>{ar?'تتبع طلبي':'Track my order'}<Arrow size={16}/></button><button className="checkout-secondary" onClick={()=>navigate('/store')}>{ar?'العودة للمتجر':'Back to store'}</button></div>{success.cod_confirmation_status==='recipient_confirmation_required'&&success.cod_confirmation_token&&<div className="checkout-recipient-confirm-box"><ShieldCheck/><div><strong>{ar?'أرسل رابط التأكيد للمستلم':'Send the confirmation link to the recipient'}</strong><span>{ar?'لن يبدأ تجهيز الطلب حتى يؤكد المستلم مسؤوليته عن السداد.':'Preparation will not start until the recipient confirms payment responsibility.'}</span></div><button type="button" onClick={async()=>{const url=`${window.location.origin}/cod/confirm/${success.cod_confirmation_token}`;try{if(navigator.share)await navigator.share({title:ar?'تأكيد سداد طلب بلقيس':'Balqees payment confirmation',url});else{await navigator.clipboard.writeText(url);setError(ar?'تم نسخ رابط التأكيد.':'Confirmation link copied.');}}catch{}}}>{ar?'مشاركة رابط التأكيد':'Share confirmation link'}</button></div>}</main></CheckoutChrome>;

  if(!cart.items.length)return <CheckoutChrome lang={lang} session={session} cartCount={0}><main className="checkout-empty individual-shell"><ShoppingBag size={34}/><h1>{ar?'لا توجد منتجات لإتمام الطلب':'There are no items to checkout'}</h1><p>{ar?'ارجع للمتجر أو للسلة وأضف المنتجات التي تريدها أولًا.':'Return to the store or cart and add items first.'}</p><Link className="checkout-primary" to="/store">{ar?'فتح المتجر':'Open store'}<Arrow size={16}/></Link></main></CheckoutChrome>;

  const total=quote?.total ?? 0;
  const displayItems=quote?.items || [];
  const selectedRecipientLabel=recipientId?recipientName(selectedRecipient,ar):(profile?.full_name||(ar?'أنا المستلم':'I am the recipient'));
  const blockReason=health?.block_reason;
  const canConfirm=step===3&&health?.can_submit&&termsAccepted&&(payerType!=='recipient'||recipientKnowsPayment)&&!submitting;

  return <CheckoutChrome lang={lang} session={session} cartCount={cart.count}>
    <main className="checkout-main individual-shell">
      <section className="checkout-heading"><div><span className="individual-overline"><ShieldCheck size={14}/>{ar?'SECURE CHECKOUT':'SECURE CHECKOUT'}</span><h1>{ar?'إتمام الطلب بدون خطوات زائدة':'Checkout without unnecessary steps'}</h1><p>{ar?'نسأل فقط عن الناقص، ثم نعيد التحقق من السعر والتوفر قبل إنشاء الطلب.':'We only ask for what is missing, then verify price and availability again before creating the order.'}</p></div><Link to="/account/cart" className="checkout-back-cart"><ShoppingBag size={16}/>{ar?'العودة للسلة':'Back to cart'}</Link></section>

      <div className="checkout-steps" aria-label={ar?'مراحل إتمام الطلب':'Checkout steps'}>{[[1,ar?'الاستلام':'Delivery'],[2,ar?'التفاصيل':'Details'],[3,ar?'المراجعة':'Review']].map(([n,label])=><button key={n} className={`${step===n?'active':''} ${step>n?'done':''}`} onClick={()=>n<step&&setStep(n)}><i>{step>n?<Check size={14}/>:n}</i><span>{label}</span></button>)}</div>

      {error&&<div className={`checkout-alert ${error.includes('أرسلنا')||error.includes('verification email')?'success':''}`}><CircleAlert size={17}/><span>{error}</span></div>}

      <div className="checkout-layout">
        <section className="checkout-stage">
          {step===1&&<div className="checkout-panel"><header><small>{ar?'1 · الاستلام':'1 · DELIVERY'}</small><h2>{ar?'مين بيستلم الطلب؟':'Who will receive the order?'}</h2><p>{ar?'نستخدم بياناتك المحفوظة بدل ما نطلب كتابتها من جديد.':'We use your saved details instead of asking you to enter them again.'}</p></header>
            <div className="checkout-choice-grid"><button className={!recipientId?'selected':''} onClick={chooseSelfRecipient}><UserRound/><div><strong>{ar?'أنا المستلم':'I am the recipient'}</strong><span>{profile?.full_name||'—'} · {profile?.phone||'—'}</span></div>{!recipientId&&<Check/>}</button>{recipients.filter(r=>!r.is_self).map(r=><button key={r.id} className={recipientId===r.id?'selected':''} onClick={()=>chooseSavedRecipient(r)}><UserRound/><div><strong>{recipientName(r,ar)}</strong><span>{r.full_name} · {r.phone}</span></div>{recipientId===r.id&&<Check/>}</button>)}</div>
            <Link className="checkout-inline-link" to="/account/addresses?tab=recipients">+ {ar?'إدارة المستلمين':'Manage recipients'}</Link>
            <div className="checkout-divider"/>
            <header className="sub"><small>{ar?'موقع التسليم':'DELIVERY ADDRESS'}</small><h3>{ar?'وين نوصل الطلب؟':'Where should we deliver?'}</h3></header>
            {sortedAddresses.length?<div className="checkout-address-grid">{sortedAddresses.map(a=><button key={a.id} className={addressId===a.id?'selected':''} onClick={()=>setAddressId(a.id)}><MapPin/><div><strong>{a.label||(ar?'عنوان محفوظ':'Saved address')}</strong><span>{addressText(a,ar,false)||a.city}</span>{recipientId&&linkedAddressIds.has(a.id)&&<small>{ar?'مرتبط بهذا المستلم':'Linked to this recipient'}</small>}</div>{addressId===a.id&&<Check/>}</button>)}</div>:<div className="checkout-empty-inline"><MapPin/><span>{ar?'ما عندك عنوان محفوظ بعد.':'You do not have a saved address yet.'}</span></div>}
            <Link className="checkout-inline-link" to="/account/addresses?tab=addresses">+ {ar?'إضافة أو إدارة عنوان':'Add or manage an address'}</Link>
            <div className="checkout-service-note"><CircleAlert size={16}/><div><strong>{ar?'نطاق وموعد التوصيل':'Delivery coverage and timing'}</strong><span>{ar?'لا يوجد حاليًا Scheduler أو جدول مناطق توصيل فعلي في النظام، لذلك لن نعرض موعدًا أو نطاقًا وهميًا. فريق بلقيس يؤكد ذلك بعد مراجعة الطلب.':'There is no live delivery-slot or service-area engine in the system yet, so we do not show fake availability. Balqees confirms it after reviewing the order.'}</span></div></div>
          </div>}

          {step===2&&<div className="checkout-panel"><header><small>{ar?'2 · التفاصيل':'2 · DETAILS'}</small><h2>{ar?'تفاصيل الطلب والدفع':'Order and payment details'}</h2><p>{ar?'هذه الحقول تظهر فقط لأنها تؤثر فعلًا على تجهيز الطلب.' : 'Only fields that actually affect fulfillment are shown here.'}</p></header>
            <label className="checkout-switch"><input type="checkbox" checked={isGift} onChange={e=>setIsGift(e.target.checked)}/><span><Gift/><b>{ar?'هذه هدية':'This is a gift'}</b><small>{ar?'سنحفظ تفاصيل الإهداء مع هذا الطلب.':'Gift details will be saved with this order.'}</small></span></label>
            {isGift&&<div className="checkout-gift-box"><label><span>{ar?'رسالة الإهداء':'Gift message'}</span><textarea value={giftMessage} maxLength={500} onChange={e=>setGiftMessage(e.target.value)} placeholder={ar?'اكتب رسالتك بهدوء…':'Write your message…'}/><small>{giftMessage.length}/500</small></label><label className="checkout-check"><input type="checkbox" checked={!senderNameVisible} onChange={e=>setSenderNameVisible(!e.target.checked)}/><span>{ar?'بدون ذكر اسم المرسل':'Hide sender name'}</span></label></div>}
            <label className="checkout-note"><span>{ar?'ملاحظة لبلقيس — اختيارية':'Note to Balqees — optional'}</span><textarea value={customerNote} maxLength={500} onChange={e=>setCustomerNote(e.target.value)} placeholder={ar?'مثال: يرجى الاتصال قبل الوصول.':'Example: Please call before arrival.'}/></label>
            <div className="checkout-divider"/>
            <header className="sub"><small>{ar?'طريقة الدفع':'PAYMENT'}</small><h3>{ar?'الدفع عند الاستلام فقط':'Cash on delivery only'}</h3></header>
            <div className="checkout-payment-method"><WalletCards/><div><strong>{ar?'الدفع عند الاستلام':'Cash on delivery'}</strong><span>{ar?'لا نطلب أي بيانات بطاقة. يتم تحصيل المبلغ قبل تسليم الطلب فعليًا.':'No card details are requested. Payment is collected before the order is handed over.'}</span></div><BadgeCheck/></div>
            {recipientId&&<div className="checkout-payer"><strong>{ar?'من المسؤول عن السداد؟':'Who is responsible for payment?'}</strong><div><button className={payerType==='self'?'selected':''} onClick={()=>{setPayerType('self');setRecipientKnowsPayment(false);}}>{ar?'أنا المسؤول عن السداد':'I will pay'}</button><button className={payerType==='recipient'?'selected':''} onClick={()=>setPayerType('recipient')}>{ar?'المستلم سيدفع':'Recipient will pay'}</button></div>{payerType==='recipient'&&<label className="checkout-check important"><input type="checkbox" checked={recipientKnowsPayment} onChange={e=>setRecipientKnowsPayment(e.target.checked)}/><span>{ar?`أؤكد أن ${selectedRecipientLabel} يعلم أن قيمة الطلب الحالية ${formatSar(total,lang)} وأنه المسؤول عن السداد عند الاستلام.`:`I confirm ${selectedRecipientLabel} knows the current order amount is ${formatSar(total,lang)} and is responsible for payment on delivery.`}</span></label>}</div>}
            <div className="checkout-delivery-timing"><MapPin/><div><strong>{ar?'موعد التوصيل':'Delivery timing'}</strong><span>{health?.delivery_message_ar&&ar?health.delivery_message_ar:health?.delivery_message_en&&!ar?health.delivery_message_en:(ar?'سيتم تأكيد الموعد بعد مراجعة الطلب.':'Delivery timing is confirmed after order review.')}</span></div></div>
          </div>}

          {step===3&&<div className="checkout-panel checkout-review"><header><small>{ar?'3 · المراجعة':'3 · REVIEW'}</small><h2>{ar?'راجع طلبك قبل التأكيد':'Review before confirming'}</h2><p>{ar?'نعيد التحقق Server-side من السعر والتوفر والكوبون قبل إنشاء الطلب.' : 'Price, availability and coupon validity are checked server-side again before order creation.'}</p></header>
            {healthBusy?<div className="checkout-health-loading"><LoaderCircle className="spin"/><span>{ar?'نجري فحص الطلب النهائي…':'Running final checkout health check…'}</span></div>:<div className={`checkout-health ${health?.can_submit?'good':'warn'}`}><ShieldCheck/><div><strong>{health?.can_submit?(ar?'فحص الطلب سليم':'Checkout health is clear'):(ar?'يوجد شيء يحتاج معالجة':'Something needs attention')}</strong><span>{health?.can_submit?(health?.cod_review_required?(ar?'يمكن إنشاء الطلب، وسيخضع لمراجعة إضافية قبل التجهيز.':'The order can be created and will receive an additional review before preparation.'):(ar?'البيانات والسعر والتوفر جاهزة للتأكيد.':'Details, pricing and availability are ready.')):(ERROR_COPY[blockReason]?.[ar?0:1]||(ar?'حدّث الفحص بعد مراجعة البيانات.':'Refresh after reviewing the details.'))}</span></div><button onClick={()=>refreshHealth()}><RefreshCw size={15}/>{ar?'إعادة الفحص':'Refresh'}</button></div>}
            {!health?.email_verified&&<div className="checkout-action-note"><CircleAlert/><div><strong>{ar?'البريد يحتاج تأكيدًا':'Email verification required'}</strong><span>{session.user.email}</span></div><button onClick={resendVerification} disabled={verifySending}>{verifySending?<LoaderCircle className="spin"/>:(ar?'إعادة إرسال التحقق':'Resend verification')}</button></div>}
            {blockReason==='QUOTE_ITEMS_REQUIRE_REVIEW'&&<div className="checkout-action-note"><Tag/><div><strong>{ar?'التسعير أولًا':'Pricing review first'}</strong><span>{ar?'أحد المنتجات سعره حسب الطلب، لذلك لا نثبت COD قبل التسعير.':'An item is priced on request, so COD is not confirmed before pricing.'}</span></div><button onClick={()=>navigate('/account/support')}>{ar?'مركز العناية':'Smart Care'}</button></div>}
            {blockReason==='GIFT_SENDER_PAYMENT_ARRANGEMENT_REQUIRED'&&<div className="checkout-action-note"><WalletCards/><div><strong>{ar?'نحتاج ترتيب السداد':'Payment arrangement needed'}</strong><span>{ar?'لأن شخصًا آخر سيستلم الطلب وأنت المسؤول عن السداد، رتب طريقة السداد مع فريق بلقيس أولًا.':'Because another person will receive the order while you are the payer, arrange payment with Balqees first.'}</span></div><button onClick={()=>navigate('/account/support')}>{ar?'تواصل مع فريق بلقيس':'Contact Balqees'}</button></div>}
            {blockReason==='COD_ACCOUNT_REVIEW_REQUIRED'&&<div className="checkout-action-note"><ShieldCheck/><div><strong>{ar?'الدفع عند الاستلام يحتاج مراجعة':'COD account review required'}</strong><span>{ar?'لن ننشئ طلب COD جديدًا قبل مراجعة سجل السداد مع فريق بلقيس.':'A new COD order will not be created until Balqees reviews the payment history.'}</span></div><button onClick={()=>navigate('/account/support')}>{ar?'مركز العناية':'Smart Care'}</button></div>}
            {payerType==='recipient'&&!recipientKnowsPayment&&<label className="checkout-review-payer-confirm"><input type="checkbox" checked={recipientKnowsPayment} onChange={e=>setRecipientKnowsPayment(e.target.checked)}/><span>{ar?`أؤكد أن ${selectedRecipientLabel} يعلم أن قيمة الطلب الحالية ${formatSar(total,lang)} وأنه المسؤول عن السداد عند الاستلام.`:`I confirm ${selectedRecipientLabel} knows the current order amount is ${formatSar(total,lang)} and is responsible for payment on delivery.`}</span></label>}
            <div className="checkout-review-block"><header><strong>{ar?'المنتجات':'Items'}</strong><button onClick={()=>navigate('/account/cart')}>{ar?'تعديل':'Edit'}</button></header>{displayItems.map(item=><article key={item.product_id}>{item.image_url?<img src={item.image_url} alt=""/>:<span className="checkout-item-placeholder"><ShoppingBag/></span>}<div><strong>{itemName(item,ar)}</strong><small>{ar?`الكمية ${Number(item.quantity)}`:`Qty ${Number(item.quantity)}`}</small></div><b>{item.price_on_request?(ar?'حسب الطلب':'On request'):formatSar(item.line_total,lang)}</b></article>)}</div>
            <div className="checkout-review-grid"><div><header><strong>{ar?'المستلم':'Recipient'}</strong><button onClick={()=>setStep(1)}>{ar?'تعديل':'Edit'}</button></header><span>{selectedRecipientLabel}</span><small>{recipientId?selectedRecipient?.phone:profile?.phone}</small></div><div><header><strong>{ar?'العنوان':'Address'}</strong><button onClick={()=>setStep(1)}>{ar?'تعديل':'Edit'}</button></header><span>{selectedAddress?addressText(selectedAddress,ar,false):'—'}</span></div><div><header><strong>{ar?'الدفع':'Payment'}</strong><button onClick={()=>setStep(2)}>{ar?'تعديل':'Edit'}</button></header><span>{ar?'الدفع عند الاستلام':'Cash on delivery'}</span><small>{payerType==='recipient'?(ar?`المسؤول: ${selectedRecipientLabel}`:`Payer: ${selectedRecipientLabel}`):(ar?'المسؤول: أنت':'Payer: you')}</small></div>{isGift&&<div><header><strong>{ar?'الإهداء':'Gift'}</strong><button onClick={()=>setStep(2)}>{ar?'تعديل':'Edit'}</button></header><span>{giftMessage||(ar?'بدون رسالة':'No message')}</span><small>{senderNameVisible?(ar?'اسم المرسل ظاهر':'Sender name visible'):(ar?'اسم المرسل مخفي':'Sender name hidden')}</small></div>}</div>
            <div className="checkout-terms"><label><input type="checkbox" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)}/><span>{ar?`أؤكد صحة البيانات وأوافق على شروط الطلب والدفع عند الاستلام بإجمالي ${formatSar(total,lang)}.`:`I confirm the details and accept the order and cash-on-delivery terms for a total of ${formatSar(total,lang)}.`}</span></label><button className="checkout-terms-toggle" onClick={()=>setTermsOpen(v=>!v)}>{ar?'عرض ملخص الشروط':'View terms summary'}<ChevronDown className={termsOpen?'open':''}/></button>{termsOpen&&<div className="checkout-terms-body"><p>{ar?'أقر بأن بيانات الطلب صحيحة، وأنني اطلعت على القيمة الحالية وشروط التسليم والدفع. إذا كان المستلم طرفًا آخر مسؤولًا عن السداد، لا يبدأ تجهيز الطلب حتى يؤكد مسؤوليته عن السداد. الدفع عند الاستلام يتم قبل تسليم الطلب فعليًا.':'I confirm the order details are correct and that I reviewed the current amount, delivery terms and payment terms. If another recipient is responsible for payment, preparation does not start until they confirm responsibility. Cash on delivery is collected before the order is handed over.'}</p></div>}</div>
          </div>}

          <div className="checkout-stage-actions">{step>1?<button className="checkout-secondary" onClick={goBack}>{ar?'السابق':'Back'}</button>:<Link className="checkout-secondary" to="/account/cart">{ar?'السلة':'Cart'}</Link>}{step<3?<button className="checkout-primary" onClick={goNext}>{ar?'متابعة':'Continue'}<Arrow size={16}/></button>:<button className="checkout-primary confirm" onClick={confirmOrder} disabled={!canConfirm}>{submitting?<><LoaderCircle className="spin"/>{ar?'جارٍ التأكد من طلبك…':'Confirming your order…'}</>:<>{health?.cod_review_required?(ar?'إرسال الطلب للمراجعة':'Submit for review'):(ar?`تأكيد الطلب — ${formatSar(total,lang)}`:`Confirm order — ${formatSar(total,lang)}`)}<Arrow size={16}/></>}</button>}</div>
        </section>

        <aside className="checkout-summary"><header><small>{ar?'ملخص آمن':'SECURE SUMMARY'}</small><h2>{ar?'طلبك الحالي':'Your current order'}</h2></header><div className="checkout-summary-count"><ShoppingBag/><span>{ar?`${cart.count} عنصر في السلة`:`${cart.count} item${cart.count===1?'':'s'} in cart`}</span></div>{coupon&&<div className="checkout-coupon"><Tag/><span>{ar?`الكوبون: ${coupon.toUpperCase()}`:`Coupon: ${coupon.toUpperCase()}`}</span><Link to="/account/cart">{ar?'تعديل':'Edit'}</Link></div>}<div className="checkout-totals"><div><span>{ar?'المنتجات':'Products'}</span><strong>{formatSar(quote?.subtotal||0,lang)}</strong></div>{Number(quote?.discount_total||0)>0&&<div className="discount"><span>{ar?'الخصم':'Discount'}</span><strong>- {formatSar(quote.discount_total,lang)}</strong></div>}<div><span>{ar?(quote?.prices_include_vat?'الضريبة ضمن الإجمالي':'الضريبة'):(quote?.prices_include_vat?'VAT included':'VAT')}</span><strong>{formatSar(quote?.vat_total||0,lang)}</strong></div><div className="total"><span>{ar?'الإجمالي الحالي':'Current total'}</span><strong>{formatSar(total,lang)}</strong></div></div><div className="checkout-cod-badge"><ShieldCheck/><div><strong>{ar?'الدفع عند الاستلام':'Cash on delivery'}</strong><span>{ar?'لا توجد أي بيانات بطاقة في هذه الصفحة.':'No card information is collected on this page.'}</span></div></div>{health?.cod_review_required&&<div className="checkout-review-note"><AlertTriangle/><span>{ar?'هذا الطلب سيخضع لمراجعة إضافية قبل بدء التجهيز وفق قواعد COD التشغيلية.':'This order will receive an additional COD review before preparation starts.'}</span></div>}</aside>
      </div>
    </main>
  </CheckoutChrome>;
}
