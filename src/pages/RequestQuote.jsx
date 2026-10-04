import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Flower2, LoaderCircle, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { formatSar } from '../lib/storePricing';
import { QUOTE_SERVICES, quoteServiceLabel, quoteStatusLabel, quoteError, validateQuoteForm } from '../lib/quoteRequests';
import './requestQuote.css';

const emptyForm = { contact_name:'',phone:'',email:'',location:'',description:'',preferred_date:'',frequency:'once',duration_months:'' };
const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Riyadh'}).format(new Date());
function readDraft(key) {try{return JSON.parse(sessionStorage.getItem(key)||'null')||{};}catch{return {};}}
export default function RequestQuote({lang}) {
  const ar=lang==='ar',location=useLocation();
  const params=useMemo(()=>new URLSearchParams(location.search),[location.search]);
  const source=params.get('source'),productId=params.get('product'),focusId=params.get('request');
  const serviceParam=params.get('service');
  const isProducts=!!productId||source==='cart';
  const draftKey=`balqees-rfq-draft:${isProducts?productId||'cart':serviceParam||'custom'}`;
  const [form,setForm]=useState(()=>({...emptyForm,...readDraft(draftKey).form}));
  const [service,setService]=useState(()=>QUOTE_SERVICES.some(s=>s[0]===serviceParam)?serviceParam:readDraft(draftKey).service||'weekly_flowers');
  const [user,setUser]=useState(null),[authLoading,setAuthLoading]=useState(true),[profile,setProfile]=useState(null);
  const [products,setProducts]=useState([]),[productsLoading,setProductsLoading]=useState(isProducts),[productError,setProductError]=useState('');
  const [history,setHistory]=useState([]),[historyError,setHistoryError]=useState(''),[historyLoading,setHistoryLoading]=useState(false);
  const [receipt,setReceipt]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [quantity,setQuantity]=useState(()=>Number(params.get('quantity')||1));
  const token=useRef(readDraft(draftKey).token||crypto.randomUUID());
  const pending=useRef(false);
  const cart=useBalqeesCart(profile?.account_type==='individual'?user?.id:null);
  const cartKey=cart.items.map(i=>`${i.product_id}:${i.quantity}`).join('|');
  const items=useMemo(()=>productId?products.map(p=>({product_id:p.id,quantity:Number(quantity)})):cart.items.map(i=>({product_id:i.product_id,quantity:Number(i.quantity)})),[productId,products,quantity,cartKey]);

  useEffect(()=>{
    let live=true;
    if(!supabase){setAuthLoading(false);setError(ar?'تعذر الاتصال الآن.':'Connection unavailable.');return;}
    const identify=async()=>{const {data,error:e}=await supabase.auth.getUser();if(live){setUser(e?null:data.user);setAuthLoading(false);}};
    identify();
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{if(live)setUser(session?.user||null);});
    return()=>{live=false;data.subscription.unsubscribe();};
  },[ar]);
  useEffect(()=>{
    let live=true;setProfile(null);
    if(!user?.id)return;
    supabase.from('customer_profiles').select('full_name,phone,email,account_type').eq('id',user.id).maybeSingle().then(({data})=>{
      if(!live)return;setProfile(data||{});
      setForm(f=>({...f,contact_name:f.contact_name||data?.full_name||'',phone:f.phone||data?.phone||'',email:f.email||data?.email||user.email||''}));
    });return()=>{live=false;};
  },[user?.id]);
  useEffect(()=>{
    try{sessionStorage.setItem(draftKey,JSON.stringify({form,service,token:token.current}));}catch{/* The form stays usable when storage is unavailable. */}
  },[draftKey,form,service]);
  useEffect(()=>{
    let live=true;
    if(!isProducts||!supabase){setProductsLoading(false);return;}
    setProductsLoading(true);setProductError('');
    const ids=productId?[productId]:cart.items.map(i=>i.product_id);
    if(!ids.length){setProducts([]);setProductsLoading(false);return;}
    supabase.from('products').select('id,name_ar,name_en,sku,image_url,price_on_request,is_active,visibility,min_order_quantity,max_order_quantity,stock_mode,stock_quantity').in('id',ids).eq('is_active',true).eq('visibility','public').then(({data,error:e})=>{
      if(!live)return;setProducts(data||[]);setProductsLoading(false);
      if(e||data?.length!==ids.length)setProductError(ar?'تعذر تحميل بعض المنتجات. ارجع للسلة وحدّثها قبل الإرسال.':'Some products could not be loaded. Refresh the cart before submitting.');
    });return()=>{live=false;};
  },[isProducts,productId,cartKey,ar]);
  const loadHistory=useCallback(async()=>{
    if(!supabase||!user?.id)return;
    setHistoryLoading(true);
    const {data,error:e}=await supabase.from('quote_requests').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);
    setHistoryError(e?(ar?'تعذر تحميل الطلبات السابقة.':'Could not load previous requests.'):'');
    if(!e)setHistory(data||[]);setHistoryLoading(false);
  },[user?.id,ar]);
  useEffect(()=>{
    loadHistory();if(!supabase||!user?.id)return;
    const channel=supabase.channel(`my-rfq-${user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'quote_requests',filter:`user_id=eq.${user.id}`},loadHistory).subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[loadHistory,user?.id]);
  useEffect(()=>{if(focusId&&history.some(r=>r.id===focusId))document.getElementById(`rfq-${focusId}`)?.scrollIntoView({behavior:'smooth',block:'center'});},[focusId,history]);
  const patch=(key,value)=>setForm(f=>({...f,[key]:value}));
  async function submit(event) {
    event.preventDefault();if(pending.current||!user||!supabase)return;
    const invalid=validateQuoteForm(form,ar);if(invalid){setError(invalid);return;}
    if(isProducts&&(productError||productsLoading||cart.syncing||!items.length)){setError(ar?'راجع المنتجات والكميات قبل الإرسال.':'Review the products and quantities before submitting.');return;}
    if(items.some(i=>!Number.isFinite(i.quantity)||i.quantity<=0)){setError(ar?'أدخل كمية صحيحة.':'Enter a valid quantity.');return;}
    pending.current=true;setBusy(true);setError('');
    try{
      const {data,error:e}=await supabase.rpc('submit_quote_request',{p_request:{...form,kind:isProducts?'products':'service',service_type:isProducts?null:service,frequency:service==='weekly_flowers'?'weekly':service==='monthly_flowers'?'monthly':form.frequency,duration_months:form.duration_months?Number(form.duration_months):null,items:isProducts?items:[],request_token:token.current}});
      if(e||!data?.id){setError(quoteError(e,ar));return;}
      setReceipt(data);try{sessionStorage.removeItem(draftKey);}catch{};await loadHistory();
    }catch(e){setError(quoteError(e,ar));}finally{pending.current=false;setBusy(false);}
  }
  const signIn=`/account?next=${encodeURIComponent(location.pathname+location.search)}`;
  const title=isProducts?(ar?'عرض سعر لمنتجاتك':'A quotation for your products'):(ar?'خدمة تُصمَّم لاحتياجك':'A service designed for your needs');
  return <main className="rfq-page shell" dir={ar?'rtl':'ltr'}>
    <header className="rfq-hero"><img src="/assets/brand/balqees-symbol.webp" alt="" aria-hidden="true"/><span><Flower2 size={17}/>BALQEES · {ar?'طلبات عروض الأسعار':'QUOTATION REQUESTS'}</span><h1>{title}</h1><p>{ar?'شاركنا التفاصيل. تستلم إدارة بلقيس طلبك وتراجع النطاق والتوفر ثم ترسل لك عرض السعر من خلال حسابك.':'Share your needs. Balqees administration reviews the scope and availability, then sends the quotation to your account.'}</p><a href="#my-quote-requests" className="rfq-text-link"><ClipboardList size={17}/>{ar?'متابعة طلباتي وردود بلقيس':'Track my requests & replies'}</a></header>
    {receipt?<section className="rfq-success" role="status"><CheckCircle2 size={44}/><span>RFQ #{receipt.request_number}</span><h2>{ar?'وصل طلبك إلى إدارة بلقيس':'Your request reached Balqees administration'}</h2><p>{ar?'يمكنك متابعة الحالة والرد أدناه. السعر يتحدد في عرض بلقيس بعد مراجعة التفاصيل.':'Track the status and reply below. Pricing is confirmed in the quotation after review.'}</p><div><a className="btn primary" href="#my-quote-requests">{ar?'متابعة الطلب':'Track request'}</a><Link className="btn" to={isProducts?'/store':'/services'}>{ar?'متابعة التصفح':'Continue browsing'}</Link></div></section>:<div className="rfq-layout">
      <form className="rfq-form" onSubmit={submit}>
        <div className="rfq-section-title"><span>01</span><div><h2>{ar?'تفاصيل الطلب':'Request details'}</h2><p>{ar?'كل التفاصيل تساعدنا على تجهيز عرض يناسبك.':'Details help us prepare a suitable quotation.'}</p></div></div>
        {isProducts?<div className="rfq-products">{productsLoading?<p><LoaderCircle className="spin"/>{ar?'تحميل المنتجات…':'Loading products…'}</p>:products.map(product=><article key={product.id}>{product.image_url?<img src={product.image_url} alt=""/>:<Flower2/>}<div><strong>{ar?product.name_ar:product.name_en||product.name_ar}</strong><small>{product.price_on_request?(ar?'طلب عرض سعر':'Quotation required'):(ar?'منتج بسعر محدد ضمن هذا الطلب':'Fixed-price product included in this request')}</small></div><label>{ar?'الكمية':'Qty'}{productId?<input aria-label={ar?'كمية المنتج':'Product quantity'} type="number" step="0.01" min={product.min_order_quantity||1} max={product.max_order_quantity||undefined} value={quantity} onChange={e=>setQuantity(e.target.value)}/>:<b>{items.find(i=>i.product_id===product.id)?.quantity}</b>}</label></article>)}{!productsLoading&&!products.length&&<p role="alert">{ar?'السلة فارغة. أضف المنتجات أولًا.':'The cart is empty. Add products first.'}</p>}{productError&&<p className="rfq-error" role="alert">{productError}</p>}<Link to={profile?.account_type==='company'?'/portal/cart':user?'/account/cart':'/store'} className="rfq-text-link">{ar?'مراجعة السلة':'Review cart'}</Link></div>:<>
          <label>{ar?'نوع الخدمة':'Service type'}<select value={service} onChange={e=>setService(e.target.value)}>{QUOTE_SERVICES.map(([id,a,en])=><option value={id} key={id}>{ar?a:en}</option>)}</select></label>
          <div className="rfq-field-grid"><label>{ar?'جدول الخدمة':'Service schedule'}<select value={service==='weekly_flowers'?'weekly':service==='monthly_flowers'?'monthly':form.frequency} disabled={service==='weekly_flowers'||service==='monthly_flowers'} onChange={e=>patch('frequency',e.target.value)}>{[['once','مرة واحدة','One time'],['weekly','أسبوعي','Weekly'],['monthly','شهري','Monthly'],['custom','حسب الاتفاق','Custom schedule']].map(([id,a,en])=><option key={id} value={id}>{ar?a:en}</option>)}</select></label><label>{ar?'مدة العقد بالأشهر (اختياري)':'Contract months (optional)'}<input type="number" min="1" max="60" step="1" value={form.duration_months} onChange={e=>patch('duration_months',e.target.value)}/></label></div>
        </>}
        <label>{ar?'المدينة والموقع':'City and location'}<input required maxLength="500" value={form.location} onChange={e=>patch('location',e.target.value)} placeholder={ar?'المدينة، الحي، اسم المنشأة أو الموقع':'City, district, property or site name'}/></label>
        <label>{ar?'تفاصيل الاحتياج':'Describe your needs'}<textarea required minLength="10" maxLength="4000" rows="5" value={form.description} onChange={e=>patch('description',e.target.value)} placeholder={ar?'الكميات، المساحة، أنواع الورد أو الشجر، مقاسات المراكن، نطاق الصيانة وأي تفضيلات…':'Quantities, space, flower or tree types, planter dimensions, maintenance scope and preferences…'}/></label>
        <label>{ar?'موعد البدء أو التوريد المفضل (اختياري)':'Preferred start or delivery date (optional)'}<input type="date" min={today()} value={form.preferred_date} onChange={e=>patch('preferred_date',e.target.value)}/></label>
        <div className="rfq-section-title"><span>02</span><div><h2>{ar?'بيانات التواصل':'Contact details'}</h2><p>{ar?'لترتيب المعاينة أو استكمال بيانات عرض السعر.':'For arranging a site visit or completing quotation details.'}</p></div></div>
        <label>{ar?'اسم جهة التواصل':'Contact name'}<input required minLength="2" maxLength="160" autoComplete="name" value={form.contact_name} onChange={e=>patch('contact_name',e.target.value)}/></label>
        <div className="rfq-field-grid"><label>{ar?'رقم الجوال':'Mobile number'}<input required type="tel" dir="ltr" maxLength="24" autoComplete="tel" value={form.phone} onChange={e=>patch('phone',e.target.value)} placeholder="05xxxxxxxx"/></label><label>{ar?'البريد الإلكتروني (اختياري)':'Email (optional)'}<input type="email" dir="ltr" maxLength="254" autoComplete="email" value={form.email} onChange={e=>patch('email',e.target.value)}/></label></div>
        {error&&<div className="rfq-error" role="alert">{error}</div>}
        {authLoading?<p><LoaderCircle className="spin"/>{ar?'التحقق من الحساب…':'Checking your account…'}</p>:!user?<div className="rfq-login"><p>{ar?'احفظ الطلب في حسابك لمتابعة رد المدير. بيانات النموذج تبقى محفوظة عند الانتقال لتسجيل الدخول.':'Sign in to track the administrator’s reply. Your form details are kept while you sign in.'}</p><Link to={signIn} className="btn primary">{ar?'تسجيل الدخول لإرسال الطلب':'Sign in to submit'}</Link><Link to={`/signup?next=${encodeURIComponent(location.pathname+location.search)}`}>{ar?'إنشاء حساب':'Create an account'}</Link></div>:<button className="btn primary rfq-submit" type="submit" disabled={busy||productsLoading||!!productError||(isProducts&&cart.syncing)}>{busy?<LoaderCircle className="spin" size={18}/>:<Send size={18}/>} {busy?(ar?'جاري إرسال الطلب…':'Submitting…'):(ar?'إرسال طلب عرض السعر':'Submit quotation request')}</button>}
      </form>
      <aside className="rfq-note"><span><ShieldCheck size={20}/>{ar?'عرض مخصص من بلقيس':'A tailored Balqees quotation'}</span><h2>{ar?'جمال مستمر، باتفاق واضح.':'Lasting beauty. Clear terms.'}</h2><p>{ar?'عقود الورد الأسبوعية والشهرية والصيانة تتحدد حسب نطاق العمل والكميات والموقع وجدول الزيارات.':'Weekly and monthly flower contracts and maintenance are priced by scope, quantities, location and visit schedule.'}</p><ol><li>{ar?'أرسل احتياجك وتفاصيل الموقع.':'Send your needs and site details.'}</li><li>{ar?'يراجع المدير الطلب ويتواصل عند الحاجة.':'Administration reviews the request and follows up if needed.'}</li><li>{ar?'يظهر عرض السعر والرد في حسابك.':'Your quotation and reply appear in your account.'}</li></ol><small>{ar?'إرسال الطلب لا ينشئ شراءً ولا يحجز المخزون. عرض السعر يوضح السعر والنطاق وشروط التنفيذ.':'Submission creates a quotation request without a purchase or stock reservation. The quotation specifies the price, scope and execution terms.'}</small></aside>
    </div>}
    <section id="my-quote-requests" className="rfq-history"><div className="rfq-history-head"><div><span>MY REQUESTS</span><h2>{ar?'طلباتك وردود بلقيس':'Your requests & Balqees replies'}</h2></div>{user&&<button type="button" onClick={loadHistory} disabled={historyLoading}><RefreshCw size={17}/>{ar?'تحديث':'Refresh'}</button>}</div>{!user?<p>{ar?'سجّل الدخول لمتابعة طلباتك.':'Sign in to track your requests.'}</p>:historyError?<p className="rfq-error" role="alert">{historyError}</p>:historyLoading&&!history.length?<p>{ar?'تحميل الطلبات…':'Loading requests…'}</p>:!history.length?<p>{ar?'ستظهر طلباتك هنا بعد الإرسال.':'Your requests will appear here after submission.'}</p>:history.map(row=><article className={`rfq-history-card ${row.id===focusId?'focused':''}`} key={row.id} id={`rfq-${row.id}`}><header><div><small>RFQ #{row.request_number}</small><h3>{quoteServiceLabel(row.service_type,ar)}</h3></div><span className={`rfq-status ${row.status}`}>{quoteStatusLabel(row.status,ar)}</span></header><p>{row.description}</p><small>{row.location} · {new Date(row.created_at).toLocaleDateString(ar?'ar-SA':'en-GB')}</small>{row.admin_reply&&<div className="rfq-reply"><strong>{ar?'رد إدارة بلقيس':'Balqees administration reply'}</strong><p>{row.admin_reply}</p>{row.status==='quoted'&&row.quote_amount!=null&&<b>{ar?'إجمالي عرض السعر: ':'Quotation total: '}{formatSar(row.quote_amount,lang)}</b>}{row.quote_valid_until&&<small>{ar?'صالح حتى: ':'Valid until: '}{row.quote_valid_until}</small>}</div>}</article>)}</section>
  </main>;
}
