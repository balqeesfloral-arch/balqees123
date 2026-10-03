import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Bell, CalendarDays, Check, ChevronLeft, ChevronRight,
  CircleAlert, Clock3, Flower2, Gem, Gift, Heart, Home, LoaderCircle, MapPin,
  MoonStar, MoreHorizontal, PackageOpen, Pencil, Plus, RefreshCw, ShoppingBag,
  Sparkles, Store, Tag, Trash2, UserRound, Users, WalletCards, X,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { formatSar, resolveProductPrice } from '../lib/storePricing';
import { useSystemSettings } from '../lib/systemSettings';
import { getSaudiSeason } from '../lib/season';
import { occasionLabel } from './individualUtils';
import './individual-account.css';

const CHECKOUT_DRAFT_KEY = userId => `balqees-individual-checkout-draft-v1:${userId}`;
const OCCASION_TYPES = ['wedding','malka','engagement','return_from_travel','usual_gift','new_baby','graduation','party'];
const SEASON_TYPES = new Set(['ramadan','eid_fitr','eid_adha','hajj']);
const REMINDER_OPTIONS = [14,7,3];
const BUDGET_BANDS = ['under_150','150_300','300_500','500_plus','unspecified'];
const GIFT_PREFS = ['bouquet','gift','bouquet_gift','surprise'];
const USUAL_GIFT_TYPES = ['visit','thanks','hospitality','other'];
const ACTIVE_ORDER_STATUSES = new Set(['pending','under_review','quoted','approved','in_progress','ready','out_for_delivery','delivered','delivery_failed_payment']);

const TYPE_META = {
  wedding: { ar:'زواج', en:'Wedding', icon:Gem, keywords:['wedding','bride','groom','زواج','عروس','عريس'] },
  malka: { ar:'مَلْكة', en:'Malka', icon:Sparkles, keywords:['malka','nikah','ملكة','ملكه','عقد'] },
  engagement: { ar:'خطبة', en:'Engagement', icon:Heart, keywords:['engagement','خطبة','خطبه'] },
  return_from_travel: { ar:'قدوم من سفر', en:'Return from travel', icon:MapPin, keywords:['welcome','travel','arrival','ترحيب','سفر','عودة','عوده'] },
  usual_gift: { ar:'هدية معتادة', en:'Usual gift', icon:Gift, keywords:['gift','هدية','هديه'] },
  new_baby: { ar:'مولود جديد', en:'New baby', icon:Flower2, keywords:['baby','newborn','مولود','بيبي'] },
  graduation: { ar:'تخرج', en:'Graduation', icon:Tag, keywords:['graduation','graduate','تخرج','خريج'] },
  party: { ar:'حفلة', en:'Party', icon:Users, keywords:['party','celebration','حفلة','حفله','احتفال'] },
  ramadan: { ar:'رمضان', en:'Ramadan', icon:MoonStar, keywords:['ramadan','رمضان'] },
  eid_fitr: { ar:'عيد الفطر', en:'Eid al-Fitr', icon:Sparkles, keywords:['eid','fitr','عيد','فطر'] },
  eid_adha: { ar:'عيد الأضحى', en:'Eid al-Adha', icon:Sparkles, keywords:['adha','eid','أضحى','اضحى','عيد'] },
  hajj: { ar:'الحج', en:'Hajj', icon:MoonStar, keywords:['hajj','حج'] },
};

const GRAD_LEVELS = {
  secondary: ['ثانوي','Secondary school'], bachelor: ['بكالوريوس','Bachelor'],
  master: ['ماجستير','Master'], doctorate: ['دكتوراه','Doctorate'],
};
const RECIPIENT_ROLES = {
  wedding: [['bride','العروس','Bride'],['groom','العريس','Groom'],['couple','الزوجان','Couple'],['family','الأسرة','Family'],['other','شخص آخر','Other']],
  malka: [['bride','العروس','Bride'],['groom','العريس','Groom'],['couple','الزوجان','Couple'],['family','الأسرة','Family'],['other','شخص آخر','Other']],
  engagement: [['bride','المخطوبة','Bride-to-be'],['groom','الخاطب','Groom-to-be'],['couple','الاثنان','Couple'],['family','الأسرة','Family'],['other','شخص آخر','Other']],
};

function typeMeta(type){ return TYPE_META[type] || { ar:'مناسبة', en:'Occasion', icon:CalendarDays, keywords:[] }; }
function arDate(value, lang, hijri = false){
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(`${String(value).slice(0,10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  const locale = lang === 'ar' ? 'ar-SA' : 'en-GB';
  try {
    if (hijri) return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-GB-u-ca-islamic-umalqura',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Riyadh'}).format(d);
    return new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Riyadh'}).format(d);
  } catch { return d.toLocaleDateString(); }
}
function daysUntil(value){
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`); const now = new Date();
  const a = new Date(now.getFullYear(),now.getMonth(),now.getDate(),12); return Math.round((d-a)/86400000);
}
function budgetLabel(band, lang){
  const ar = lang === 'ar';
  const map = {
    under_150:[ar?'أقل من 150 ر.س':'Under SAR 150'],
    '150_300':[ar?'150–300 ر.س':'SAR 150–300'],
    '300_500':[ar?'300–500 ر.س':'SAR 300–500'],
    '500_plus':[ar?'500 ر.س فأكثر':'SAR 500+'],
    unspecified:[ar?'بدون تحديد':'No set budget'],
  };
  return map[band]?.[0] || (ar?'بدون تحديد':'No set budget');
}
function budgetRange(row){
  if (Number(row?.budget) > 0) return { min:0, max:Number(row.budget) * (row.allow_budget_overrun ? 1.1 : 1), exact:Number(row.budget) };
  const ranges = { under_150:[0,150], '150_300':[150,300], '300_500':[300,500], '500_plus':[500,Infinity], unspecified:[0,Infinity] };
  const [min,maxRaw] = ranges[row?.budget_band] || [0,Infinity];
  const max = Number.isFinite(maxRaw) && row?.allow_budget_overrun ? maxRaw*1.1 : maxRaw;
  return { min,max,exact:null };
}
function giftPrefLabel(value, ar){
  const labels = { bouquet:['باقة ورد','Bouquet'], gift:['هدية','Gift'], bouquet_gift:['باقة + هدية','Bouquet + gift'], surprise:['خلّها علينا','Surprise me'] };
  return labels[value]?.[ar?0:1] || (ar?'غير محدد':'Not set');
}
function usualGiftLabel(value, ar){
  const map={visit:['هدية زيارة','Visit gift'],thanks:['هدية شكر','Thank-you gift'],hospitality:['هدية ضيافة','Hospitality gift'],other:['هدية معتادة','Usual gift']};
  return map[value]?.[ar?0:1] || (ar?'هدية معتادة':'Usual gift');
}
function recipientRoleLabel(type,value,ar){
  const row=(RECIPIENT_ROLES[type]||[]).find(x=>x[0]===value);
  return row ? row[ar?1:2] : value || '';
}
function disallowedOccasionProduct(text,kind){
  if(kind!=='other') return false;
  return ['service','maintenance','landscape','garden','vase','planter','pot','تنسيق','صيانة','حديقة','حدائق','فازة','فازه','مركن','مراكن'].some(k=>text.includes(k));
}
function readinessMeta(value, ar){
  const map = {
    not_started:[ar?'لم تبدأ':'Not started','idle'],
    preparing:[ar?'جاري التجهيز':'Preparing','progress'],
    ready:[ar?'جاهزة':'Ready','ready'],
  };
  return map[value] || map.not_started;
}
function seasonalOccasion(){
  const mapping = { ramadan:'ramadan', eid:'eid_fitr', adha:'eid_adha', hajj:'hajj' };
  const today = new Date();
  let previousKey = null;
  for (let i=0;i<=400;i++) {
    const date = new Date(today); date.setDate(today.getDate()+i);
    const s = getSaudiSeason(date);
    const type = mapping[s.key];
    if (type && type !== previousKey) return { type, date, days:i, live:i===0 };
    previousKey = type || null;
  }
  return null;
}
function productText(product, categoryName=''){
  return [product?.name_ar,product?.name_en,product?.description_ar,product?.description_en,categoryName,...(product?.tags||[])].filter(Boolean).join(' ').toLowerCase();
}
function classifyProduct(text){
  const bouquet = ['bouquet','flower','flowers','rose','ورد','زهور','باقة','باقه'].some(k=>text.includes(k));
  const gift = ['gift','هدية','هديه','chocolate','شوكولات','box','بوكس'].some(k=>text.includes(k));
  return bouquet && gift ? 'both' : bouquet ? 'bouquet' : gift ? 'gift' : 'other';
}
function recipientDisplay(row, recipients, ar){
  const r = recipients.find(x=>x.id===row?.recipient_id);
  return r?.label || r?.full_name || row?.custom_recipient_name || (ar?'غير محدد':'Not set');
}
function orderStatusLabel(status, ar){
  const map = { pending:['جديد','New'],under_review:['قيد المراجعة','Under review'],quoted:['تم التسعير','Quoted'],approved:['معتمد','Approved'],in_progress:['قيد التجهيز','Preparing'],ready:['جاهز','Ready'],out_for_delivery:['في الطريق','On the way'],delivered:['تم التسليم','Delivered'],completed:['مكتمل','Completed'],cancelled:['ملغي','Cancelled'],delivery_failed_payment:['تعذر التسليم','Delivery issue'] };
  return map[status]?.[ar?0:1] || status || '—';
}
function writeCheckoutDraft(userId, payload){
  if (!userId) return;
  try {
    const key = CHECKOUT_DRAFT_KEY(userId); const current = JSON.parse(localStorage.getItem(key)||'{}');
    localStorage.setItem(key,JSON.stringify({...current,...payload,updated_at:new Date().toISOString(),source:'occasion'}));
    window.dispatchEvent(new CustomEvent('balqees:checkout-draft',{detail:payload}));
  } catch { /* storage can be unavailable */ }
}

function OccasionsChrome({ lang, session, cartCount, children }){
  const ar=lang==='ar'; const navigate=useNavigate(); const [profile,setProfile]=useState(null);
  useEffect(()=>{ if(session?.user?.id&&supabase) supabase.from('customer_profiles').select('full_name').eq('id',session.user.id).maybeSingle().then(({data})=>setProfile(data||null)); },[session?.user?.id]);
  useEffect(()=>{ document.body.classList.add('individual-account-active'); return()=>document.body.classList.remove('individual-account-active'); },[]);
  const fullName=profile?.full_name||session?.user?.user_metadata?.full_name||session?.user?.email?.split('@')[0]||(ar?'عميل بلقيس':'Balqees client'); const firstName=fullName.trim().split(/\s+/)[0];
  return <div className="individual-account-app individual-occasions-app" dir={ar?'rtl':'ltr'}>
    <header className="individual-topbar"><div className="individual-shell individual-topbar-inner"><Link to="/" className="individual-brand"><BrandMark/></Link><div className="individual-topbar-center"><span>{ar?'مناسباتي':'MY OCCASIONS'}</span><small>{ar?'حساب فردي':'INDIVIDUAL ACCOUNT'}</small></div><div className="individual-top-actions"><button type="button" className="individual-icon-button" onClick={()=>navigate('/account/notifications')}><Bell size={19}/></button><button type="button" className="individual-icon-button" onClick={()=>navigate('/account/cart')}><ShoppingBag size={19}/>{cartCount>0&&<b>{Math.min(cartCount,99)}</b>}</button><button type="button" className="individual-profile-chip" onClick={()=>navigate('/account/profile')}><span>{fullName.slice(0,1).toUpperCase()}</span><div><small>{ar?'مرحبًا':'Welcome'}</small><strong>{firstName}</strong></div></button></div></div></header>
    {children}
    <nav className="individual-mobile-dock"><Link to="/account"><Home/><span>{ar?'الرئيسية':'Home'}</span></Link><Link to="/account/orders"><PackageOpen/><span>{ar?'طلباتي':'Orders'}</span></Link><Link to="/store"><Store/><span>{ar?'المتجر':'Store'}</span></Link><Link to="/account/favorites"><Heart/><span>{ar?'المفضلة':'Favorites'}</span></Link><Link className="active" to="/account/profile"><UserRound/><span>{ar?'حسابي':'Account'}</span></Link></nav>
  </div>;
}

function OccasionWizard({ lang, initial, recipients, onClose, onSaved }){
  const ar=lang==='ar'; const Back=ar?ChevronRight:ChevronLeft; const Next=ar?ChevronLeft:ChevronRight;
  const editing=Boolean(initial?.id); const [step,setStep]=useState(editing?2:0); const [saving,setSaving]=useState(false); const [error,setError]=useState('');
  const [data,setData]=useState({
    occasion_type:initial?.occasion_type||'', graduation_level:initial?.graduation_level||'', occasion_date:initial?.occasion_date||'', recipient_id:initial?.recipient_id||'', custom_recipient_name:initial?.custom_recipient_name||'', recipient_role:initial?.recipient_role||'', budget_band:initial?.budget_band||'unspecified', gift_preference:initial?.gift_preference||'surprise', allow_budget_overrun:!!initial?.allow_budget_overrun, reminder_days:Array.isArray(initial?.reminder_days)?initial.reminder_days:[], note:initial?.note||'', usual_gift_type:initial?.usual_gift_type||'', party_type:initial?.party_type||'', guest_count:initial?.guest_count||'', venue:initial?.venue||'', reminder_channels:Array.isArray(initial?.reminder_channels)?initial.reminder_channels:[]
  });
  const meta=typeMeta(data.occasion_type); const TypeIcon=meta.icon; const isUsual=data.occasion_type==='usual_gift'; const roles=RECIPIENT_ROLES[data.occasion_type]||[];
  function patch(next){ setData(v=>({...v,...next})); setError(''); }
  function validate(){
    if(!data.occasion_type) return ar?'اختر نوع المناسبة أولًا.':'Choose an occasion type first.';
    if(data.occasion_type==='graduation'&&!data.graduation_level) return ar?'حدد مرحلة التخرج.':'Choose the graduation level.';
    if(!isUsual&&!data.occasion_date) return ar?'حدد تاريخ المناسبة.':'Choose the occasion date.';
    if(data.guest_count&&Number(data.guest_count)<1) return ar?'عدد الحضور يجب أن يكون أكبر من صفر.':'Guest count must be greater than zero.';
    return '';
  }
  async function save(){
    const validation=validate(); if(validation){setError(validation);return;} if(!supabase)return;
    setSaving(true); setError('');
    const reminderDays=isUsual?[]:(data.reminder_days||[]);
    const payload={ occasion_type:data.occasion_type, graduation_level:data.occasion_type==='graduation'?data.graduation_level:null, occasion_date:isUsual?null:data.occasion_date||null, recipient_id:data.recipient_id||null, custom_recipient_name:data.recipient_id?null:(data.custom_recipient_name.trim()||null), recipient_role:data.recipient_role||null, budget_band:data.budget_band||'unspecified', gift_preference:data.gift_preference||'surprise', allow_budget_overrun:!!data.allow_budget_overrun, reminder_days:reminderDays, reminder_channels:reminderDays.length?['in_app']:[], note:data.note.trim()||null, usual_gift_type:data.occasion_type==='usual_gift'?(data.usual_gift_type||null):null, party_type:data.occasion_type==='party'?(data.party_type.trim()||null):null, guest_count:data.occasion_type==='party'&&data.guest_count?Number(data.guest_count):null, venue:data.occasion_type==='party'?(data.venue.trim()||null):null, updated_at:new Date().toISOString() };
    let result;
    if(editing) result=await supabase.from('customer_occasions').update(payload).eq('id',initial.id).eq('user_id',initial.user_id).select('*').single();
    else result=await supabase.from('customer_occasions').insert({...payload,user_id:initial?.user_id}).select('*').single();
    setSaving(false); if(result.error){setError(ar?'تعذر حفظ المناسبة. راجع البيانات وحاول مرة أخرى.':'Could not save the occasion. Review the details and try again.');return;} onSaved(result.data);
  }
  return <div className="individual-occasion-modal-overlay" role="dialog" aria-modal="true"><div className="individual-occasion-wizard">
    <div className="individual-occasion-modal-head"><div><span>{editing?(ar?'تعديل المناسبة':'EDIT OCCASION'):(ar?'مناسبة جديدة':'NEW OCCASION')}</span><h2>{step===0?(ar?'وش المناسبة؟':'What is the occasion?'):step===1?(ar?'لمن هذه المناسبة؟':'Who is it for?'):(ar?'رتّب التفاصيل':'Set the details')}</h2></div><button type="button" onClick={onClose}><X size={19}/></button></div>
    <div className="individual-occasion-progress">{[0,1,2].map(i=><i key={i} className={i<=step?'active':''}/>)}</div>
    <div className="individual-occasion-wizard-body">
      {step===0&&<><p className="individual-occasion-step-copy">{ar?'نلتزم بالمناسبات المعتمدة فقط، بدون افتراض مناسبات شخصية من عندنا.':'Only approved occasion types are used—no personal occasions are inferred.'}</p><div className="individual-occasion-type-grid">{OCCASION_TYPES.map(type=>{const m=typeMeta(type);const Icon=m.icon;return <button key={type} type="button" className={data.occasion_type===type?'active':''} onClick={()=>patch({occasion_type:type,graduation_level:type==='graduation'?data.graduation_level:'',occasion_date:type==='usual_gift'?'':data.occasion_date})}><span><Icon size={21}/></span><strong>{ar?m.ar:m.en}</strong><small>{type==='usual_gift'?(ar?'بدون تاريخ إلزامي':'No date required'):type==='graduation'?(ar?'مع تحديد المرحلة':'Choose a level'):(ar?'هدية أو باقة مناسبة':'A fitting gift or bouquet')}</small></button>})}</div>{data.occasion_type==='graduation'&&<div className="individual-graduation-levels"><small>{ar?'مرحلة التخرج':'GRADUATION LEVEL'}</small><div>{Object.entries(GRAD_LEVELS).map(([key,label])=><button type="button" className={data.graduation_level===key?'active':''} onClick={()=>patch({graduation_level:key})} key={key}>{label[ar?0:1]}</button>)}</div></div>}</>}
      {step===1&&<><p className="individual-occasion-step-copy">{ar?'اختيار المستلم اختياري، لكنه يجعل تجهيز الطلب لاحقًا أسرع بكثير.':'Recipient selection is optional, but it makes checkout much faster later.'}</p>{roles.length>0&&<div className="individual-role-select"><small>{ar?'لمن تحديدًا؟ — اختياري':'WHO IS IT FOR? — OPTIONAL'}</small><div>{roles.map(([key,a,e])=><button type="button" className={data.recipient_role===key?'active':''} onClick={()=>patch({recipient_role:data.recipient_role===key?'':key})} key={key}>{ar?a:e}</button>)}</div></div>}<div className="individual-recipient-picker"><button type="button" className={!data.recipient_id&&!data.custom_recipient_name?'active':''} onClick={()=>patch({recipient_id:'',custom_recipient_name:''})}><span><Users size={18}/></span><div><strong>{ar?'بدون مستلم محدد الآن':'No recipient yet'}</strong><small>{ar?'تقدر تحدده لاحقًا':'You can choose later'}</small></div></button>{recipients.filter(r=>r.is_active!==false).map(r=><button type="button" key={r.id} className={data.recipient_id===r.id?'active':''} onClick={()=>patch({recipient_id:r.id,custom_recipient_name:''})}><span><UserRound size={18}/></span><div><strong>{r.label||r.full_name}</strong><small>{r.label&&r.full_name?r.full_name:r.phone}</small></div></button>)}</div><label className="individual-occasion-custom-name"><span>{ar?'أو اسم مختصر بدون حفظ مستلم جديد':'Or a short name without saving a recipient'}</span><input value={data.custom_recipient_name} onChange={e=>patch({recipient_id:'',custom_recipient_name:e.target.value})} maxLength={120} placeholder={ar?'مثال: العروس أو محمد':'Example: the bride or Mohammed'}/></label></>}
      {step===2&&<div className="individual-occasion-detail-form"><div className="individual-occasion-summary-chip"><span><TypeIcon size={18}/></span><div><small>{ar?'المناسبة':'OCCASION'}</small><strong>{ar?meta.ar:meta.en}{data.occasion_type==='graduation'&&data.graduation_level?` · ${GRAD_LEVELS[data.graduation_level][ar?0:1]}`:''}</strong></div></div>{!isUsual&&<label><span>{data.occasion_type==='return_from_travel'?(ar?'موعد الوصول':'Arrival date'):(ar?'تاريخ المناسبة':'Occasion date')}</span><input type="date" value={data.occasion_date} onChange={e=>patch({occasion_date:e.target.value})}/></label>}{isUsual&&<div className="individual-gift-preference individual-usual-gift-types"><small>{ar?'نوع الهدية المعتادة':'USUAL GIFT TYPE'}</small><div>{USUAL_GIFT_TYPES.map(kind=><button type="button" key={kind} className={data.usual_gift_type===kind?'active':''} onClick={()=>patch({usual_gift_type:data.usual_gift_type===kind?'':kind})}>{usualGiftLabel(kind,ar)}</button>)}</div></div>}<div className="individual-budget-box"><small>{ar?'الميزانية — اختيارية':'BUDGET — OPTIONAL'}</small><div>{BUDGET_BANDS.map(b=><button key={b} type="button" className={data.budget_band===b?'active':''} onClick={()=>patch({budget_band:b})}>{budgetLabel(b,lang)}</button>)}</div><label className="individual-overrun-toggle"><input type="checkbox" checked={data.allow_budget_overrun} onChange={e=>patch({allow_budget_overrun:e.target.checked})}/><span>{ar?'ممكن أتجاوز الميزانية قليلًا — بحد أقصى 10%':'Allow up to 10% over budget'}</span></label></div><div className="individual-gift-preference"><small>{ar?'وش تفضّل؟':'WHAT WOULD YOU PREFER?'}</small><div>{GIFT_PREFS.map(v=><button type="button" key={v} className={data.gift_preference===v?'active':''} onClick={()=>patch({gift_preference:v})}>{giftPrefLabel(v,ar)}</button>)}</div></div>{!isUsual&&<div className="individual-reminder-box"><div><Bell size={16}/><span><strong>{ar?'ذكّرني داخل الحساب':'In-account reminder'}</strong><small>{ar?'لن نرسل بريدًا أو WhatsApp بدون تكامل رسمي.':'No email or WhatsApp without an official integration.'}</small></span></div><div className="individual-reminder-days">{REMINDER_OPTIONS.map(day=><button type="button" key={day} className={(data.reminder_days||[]).includes(day)?'active':''} onClick={()=>patch({reminder_days:(data.reminder_days||[]).includes(day)?data.reminder_days.filter(x=>x!==day):[...(data.reminder_days||[]),day].sort((a,b)=>b-a)})}>{ar?`قبل ${day} يوم`:`${day} days before`}</button>)}</div></div>}{data.occasion_type==='party'&&<div className="individual-party-fields"><label><span>{ar?'نوع الحفل — اختياري':'Party type — optional'}</span><input value={data.party_type} onChange={e=>patch({party_type:e.target.value})} maxLength={100} placeholder={ar?'مثال: حفل عائلي':'Example: family celebration'}/></label><label><span>{ar?'عدد الحضور التقريبي':'Approx. guests'}</span><input type="number" min="1" value={data.guest_count} onChange={e=>patch({guest_count:e.target.value})}/></label><label className="wide"><span>{ar?'المكان — اختياري':'Venue — optional'}</span><input value={data.venue} onChange={e=>patch({venue:e.target.value})} maxLength={240}/></label></div>}<label><span>{ar?'ملاحظة — اختيارية':'Note — optional'}</span><textarea value={data.note} onChange={e=>patch({note:e.target.value})} maxLength={500} rows="3" placeholder={ar?'شيء يساعدك تتذكر المطلوب لاحقًا…':'Anything useful to remember later…'}/></label></div>}
      {error&&<div className="individual-inline-error"><CircleAlert size={15}/><span>{error}</span></div>}
    </div>
    <div className="individual-occasion-modal-actions">{step>0&&<button type="button" className="ghost" onClick={()=>setStep(s=>s-1)}><Back size={16}/>{ar?'السابق':'Back'}</button>}<button type="button" className="primary" disabled={saving} onClick={()=>{ if(step<2){ if(step===0&&!data.occasion_type){setError(ar?'اختر نوع المناسبة أولًا.':'Choose an occasion type first.');return;} if(step===0&&data.occasion_type==='graduation'&&!data.graduation_level){setError(ar?'حدد مرحلة التخرج.':'Choose the graduation level.');return;} setStep(s=>s+1); } else save(); }}>{saving?<LoaderCircle className="spin" size={16}/>:step<2?<Next size={16}/>:<Check size={16}/>} {step<2?(ar?'متابعة':'Continue'):(ar?'حفظ المناسبة':'Save occasion')}</button></div>
  </div></div>;
}

function SuggestionCard({ suggestion, lang, onAdd }){
  const ar=lang==='ar'; const total=suggestion.items.reduce((sum,x)=>sum+Number(x.price||0),0);
  return <article className={`individual-occasion-suggestion ${suggestion.overBudget?'over-budget':''}`}><div className="individual-suggestion-images">{suggestion.items.slice(0,2).map(item=><span key={item.product.id}>{item.product.image_url?<img src={item.product.image_url} alt=""/>:<Gift size={22}/>}</span>)}</div><div className="individual-suggestion-copy"><small>{suggestion.label}</small><strong>{suggestion.items.map(x=>ar?x.product.name_ar:(x.product.name_en||x.product.name_ar)).join(' + ')}</strong><p>{suggestion.reason}</p><b>{formatSar(total,lang)}</b></div><button type="button" disabled={suggestion.overBudget} onClick={()=>onAdd(suggestion)}><ShoppingBag size={15}/>{suggestion.overBudget?(ar?'يتجاوز الميزانية':'Over budget'):(ar?'أضف للسلة':'Add to cart')}</button></article>;
}

function OccasionDetail({ lang, row, recipients, addresses, recipientLinks, orders, products, categories, rules, personalized, favoriteIds, interestEvents, pricingVisible, onClose, onEdit, onArchive, onRefresh, cart, onToast }){
  const ar=lang==='ar'; const navigate=useNavigate(); const meta=typeMeta(row.occasion_type); const Icon=meta.icon;
  const recipient=recipients.find(x=>x.id===row.recipient_id); const recipientLink=recipientLinks.find(x=>x.recipient_id===row.recipient_id&&x.is_default); const addressId=recipientLink?.address_id||recipient?.default_address_id; const address=addresses.find(x=>x.id===addressId); const linkedOrder=orders.find(x=>x.id===row.linked_order_id);
  const computedReadiness=['delivered','completed'].includes(linkedOrder?.status)?'ready':linkedOrder&&ACTIVE_ORDER_STATUSES.has(linkedOrder.status)?'preparing':(row.assistant_context?.selected_product_ids?.length?'preparing':row.readiness||'not_started'); const ready=readinessMeta(computedReadiness,ar);
  const [assistantOpen,setAssistantOpen]=useState(false); const [busy,setBusy]=useState(false); const [localReminders,setLocalReminders]=useState(Array.isArray(row.reminder_days)?row.reminder_days:[]);
  const categoryMap=useMemo(()=>new Map(categories.map(c=>[c.id,ar?(c.name_ar||c.name_en):(c.name_en||c.name_ar)])),[categories,ar]);
  const interestCategoryScores=useMemo(()=>{ const map=new Map(); if(!personalized)return map; interestEvents.forEach(e=>{ if(e.category_id)map.set(e.category_id,(map.get(e.category_id)||0)+(e.event_type==='purchase'?5:e.event_type==='favorite'?4:e.event_type==='cart_add'?3:1)); }); return map; },[interestEvents,personalized]);
  const suggestions=useMemo(()=>{
    if(!pricingVisible||!products.length)return [];
    const range=budgetRange(row); const keywords=meta.keywords||[]; const desired=row.gift_preference||'surprise';
    const scored=products.map(product=>{ const price=resolveProductPrice(product,rules).effective; if(price===null||price===undefined||Number(price)<=0)return null; const text=productText(product,categoryMap.get(product.category_id)||''); const kind=classifyProduct(text); if(disallowedOccasionProduct(text,kind)) return null; let score=0; keywords.forEach(k=>{if(text.includes(String(k).toLowerCase()))score+=5;}); if(desired==='bouquet'&&(kind==='bouquet'||kind==='both'))score+=6; if(desired==='gift'&&(kind==='gift'||kind==='both'))score+=6; if(desired==='bouquet_gift'&&(kind==='bouquet'||kind==='gift'||kind==='both'))score+=3; if(product.is_featured)score+=1; if(personalized){ if(favoriteIds.has(product.id))score+=4; score+=Math.min(4,interestCategoryScores.get(product.category_id)||0); } return {product,price:Number(price),kind,score}; }).filter(x=>x&&x.kind!=='other');
    const within=scored.filter(x=>x.price>=range.min&&x.price<=range.max).sort((a,b)=>b.score-a.score||a.price-b.price);
    const makeSingle=(item,label,reason)=>({items:[item],label,reason});
    const out=[];
    if(desired==='bouquet_gift'){
      const bouquets=within.filter(x=>x.kind==='bouquet'||x.kind==='both'); const gifts=within.filter(x=>x.kind==='gift'||x.kind==='both');
      for(const b of bouquets.slice(0,4)){ for(const g of gifts.slice(0,4)){ if(b.product.id===g.product.id)continue; const total=b.price+g.price; if(total<=range.max&&total>=range.min){out.push({items:[b,g],label:ar?'اختيار متوازن':'Balanced choice',reason:ar?'باقة مع هدية ضمن ميزانيتك الحالية.':'A bouquet and gift inside your current budget.'}); if(out.length>=3)break;} } if(out.length>=3)break; }
    }
    within.slice(0,6).forEach((item,index)=>{ if(out.some(s=>s.items.some(x=>x.product.id===item.product.id)))return; const surpriseLabels=ar?['لمسة بلقيس','اختيار بلقيس','توقيع بلقيس']:['Balqees Touch','Balqees Selection','Balqees Signature']; const defaultLabel=index===0?(ar?'اختيار هادئ':'Calm choice'):index===1?(ar?'اختيار مميز':'Distinct choice'):(ar?'خيار مناسب':'Suitable option'); const label=desired==='surprise'?(surpriseLabels[Math.min(index,2)]||surpriseLabels[2]):defaultLabel; out.push(makeSingle(item,label, item.score>0?(ar?'مرتبط بالمناسبة أو تفضيلاتك المحفوظة.':'Related to the occasion or your saved preferences.'):(ar?'داخل الميزانية الحالية.':'Inside your current budget.'))); });
    if(!out.length){
      const target=Number.isFinite(range.max)?range.max:(range.min||0);
      const below=[...scored].filter(x=>!Number.isFinite(range.max)||x.price<=range.max).sort((a,b)=>Math.abs(a.price-target)-Math.abs(b.price-target)).slice(0,1);
      const above=Number.isFinite(range.max)?[...scored].filter(x=>x.price>range.max).sort((a,b)=>a.price-b.price).slice(0,1):[];
      below.forEach(item=>out.push({...makeSingle(item,ar?'خيار قريب من الميزانية':'Near-budget option',ar?'أقرب خيار متاح من دون تجاوز الحد الذي حددته.':'The closest available option without exceeding your limit.'),overBudget:false}));
      above.forEach(item=>out.push({...makeSingle(item,ar?'خيار أعلى من الميزانية':'Above-budget option',row.allow_budget_overrun?(ar?'هذا الخيار يتجاوز حتى هامش +10% المسموح، لذلك نعرضه للمقارنة فقط.':'This option exceeds even the allowed +10% margin, so it is shown for comparison only.'):(ar?'نعرضه للمقارنة فقط؛ فعّل هامش +10% أو عدّل الميزانية إذا أردته.':'Shown for comparison only; enable the +10% margin or adjust the budget if you want it.')),overBudget:true}));
    }
    return out.slice(0,5);
  },[row,products,rules,categoryMap,meta.keywords,pricingVisible,personalized,favoriteIds,interestCategoryScores,ar]);
  async function updateReminder(day){ const current=localReminders; const next=current.includes(day)?current.filter(x=>x!==day):[...current,day].sort((a,b)=>b-a); setBusy(true); const {error}=await supabase.from('customer_occasions').update({reminder_days:next,reminder_channels:next.length?['in_app']:[],updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',row.user_id); setBusy(false); if(!error){setLocalReminders(next);onRefresh();} }
  async function addSuggestion(suggestion){
    suggestion.items.forEach(item=>cart.add(item.product,item.product.min_order_quantity||1,{unit_price_snapshot:item.price,is_gift:true}));
    const ids=[...(row.assistant_context?.selected_product_ids||[]),...suggestion.items.map(x=>x.product.id)].filter((v,i,a)=>a.indexOf(v)===i);
    await supabase.from('customer_occasions').update({readiness:'preparing',assistant_context:{...(row.assistant_context||{}),selected_product_ids:ids,last_selection_at:new Date().toISOString()},updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',row.user_id);
    writeCheckoutDraft(row.user_id,{occasion_id:row.id,occasion_type:row.occasion_type,recipient_id:row.recipient_id||null,address_id:address?.id||null,is_gift:true,budget_band:row.budget_band||'unspecified'});
    onToast(ar?'تمت إضافة الاختيار للسلة وربطه بهذه المناسبة.':'Selection added to cart and linked to this occasion.'); onRefresh();
  }
  const d=daysUntil(row.occasion_date);
  return <div className="individual-occasion-modal-overlay detail" role="dialog" aria-modal="true"><div className="individual-occasion-detail-sheet">
    <div className="individual-occasion-detail-hero"><div className="individual-occasion-type-orb"><Icon size={25}/></div><div><small>{ar?'مساحة المناسبة':'OCCASION SPACE'}</small><h2>{occasionLabel(row,lang)}</h2><p>{row.occasion_date?`${arDate(row.occasion_date,lang,true)} · ${arDate(row.occasion_date,lang)}`:(ar?'بدون تاريخ محدد':'No set date')}</p></div><button type="button" onClick={onClose}><X size={19}/></button></div>
    <div className="individual-occasion-detail-body">
      <section className="individual-occasion-readiness"><div><span className={ready[1]}/><small>{ar?'جاهزية المناسبة':'READINESS'}</small><strong>{ready[0]}</strong></div>{d!==null&&d>=0&&<b>{d===0?(ar?'اليوم':'Today'):ar?`باقي ${d} يومًا`:`${d} days left`}</b>}</section>
      <div className="individual-occasion-facts"><div><span><UserRound size={17}/></span><small>{ar?'المستلم':'RECIPIENT'}</small><strong>{recipientDisplay(row,recipients,ar)}</strong>{recipient&&<em>{recipient.full_name}</em>}</div><div><span><MapPin size={17}/></span><small>{ar?'العنوان المعتاد':'DEFAULT ADDRESS'}</small><strong>{address?(address.label||address.district||address.city):(ar?'غير محدد':'Not set')}</strong>{address&&<em>{[address.district,address.city].filter(Boolean).join(ar?'، ':', ')}</em>}</div><div><span><WalletCards size={17}/></span><small>{ar?'الميزانية':'BUDGET'}</small><strong>{row.budget?formatSar(row.budget,lang):budgetLabel(row.budget_band||'unspecified',lang)}</strong><em>{row.allow_budget_overrun?(ar?'يسمح +10%':'Allows +10%'):(ar?'بدون تجاوز':'No overrun')}</em></div><div><span><Gift size={17}/></span><small>{ar?'نوع الاختيار':'GIFT STYLE'}</small><strong>{giftPrefLabel(row.gift_preference,ar)}</strong>{row.occasion_type==='usual_gift'&&row.usual_gift_type?<em>{usualGiftLabel(row.usual_gift_type,ar)}</em>:row.recipient_role&&<em>{recipientRoleLabel(row.occasion_type,row.recipient_role,ar)}</em>}</div></div>
      {row.occasion_type==='party'&&(row.party_type||row.guest_count||row.venue)&&<section className="individual-occasion-party-summary"><span><Users size={17}/></span><div><small>{ar?'تفاصيل الحفلة':'PARTY DETAILS'}</small><strong>{row.party_type|| (ar?'حفلة':'Party')}</strong><p>{[row.guest_count?(ar?`${row.guest_count} حضور`:`${row.guest_count} guests`):'',row.venue||''].filter(Boolean).join(' · ')}</p></div></section>}
      {row.occasion_type!=='usual_gift'&&<section className="individual-occasion-reminder-control"><div className="individual-section-heading"><div><span>{ar?'تذكير اختياري':'OPTIONAL REMINDER'}</span><h3>{ar?'متى نذكّرك داخل الحساب؟':'When should we remind you?'}</h3><p>{ar?'التذكير يظهر داخل حساب بلقيس فقط حاليًا.':'Reminders currently appear only inside your Balqees account.'}</p></div></div><div>{REMINDER_OPTIONS.map(day=><button disabled={busy} type="button" key={day} className={localReminders.includes(day)?'active':''} onClick={()=>updateReminder(day)}>{localReminders.includes(day)&&<Check size={13}/>} {ar?`قبل ${day} يوم`:`${day} days before`}</button>)}</div></section>}
      {linkedOrder&&<section className="individual-occasion-linked-order"><div><span><PackageOpen size={18}/></span><div><small>{ar?'طلب مرتبط بالمناسبة':'LINKED ORDER'}</small><strong>#{String(linkedOrder.order_number||'').padStart(5,'0')}</strong><p>{orderStatusLabel(linkedOrder.status,ar)} · {formatSar(linkedOrder.total,lang)}</p></div></div><Link to={`/account/orders/${linkedOrder.id}`}>{ar?'عرض الطلب':'View order'}<ChevronLeft size={15}/></Link></section>}
      <section className="individual-occasion-assistant"><div className="individual-occasion-assistant-head"><span><Sparkles size={21}/></span><div><small>{ar?'مساعد بلقيس للهدايا':'BALQEES GIFT ASSISTANT'}</small><h3>{ar?'ساعدني أختار':'Help me choose'}</h3><p>{ar?'باقات وهدايا فقط، حسب المناسبة والميزانية والذوق المحفوظ.':'Bouquets and gifts only, based on the occasion, budget and saved taste.'}</p></div><button type="button" onClick={()=>setAssistantOpen(v=>!v)}>{assistantOpen?(ar?'إخفاء':'Hide'):(ar?'ابدأ':'Start')}</button></div>{assistantOpen&&<div className="individual-occasion-assistant-body">{!pricingVisible?<div className="individual-occasion-catalog-empty"><CircleAlert size={22}/><strong>{ar?'مطابقة الميزانية تحتاج أسعارًا منشورة':'Budget matching needs published prices'}</strong><p>{ar?'إعداد المتجر الحالي يخفي الأسعار، لذلك لن نخمن أو نعرض أرقامًا غير حقيقية.':'Store settings currently hide prices, so we will not guess or invent numbers.'}</p><button type="button" onClick={()=>navigate('/store')}>{ar?'فتح المتجر':'Open store'}</button></div>:!products.length?<div className="individual-occasion-catalog-empty"><Gift size={24}/><strong>{ar?'ما فيه منتجات منشورة للمساعدة الآن':'No published products are available yet'}</strong><p>{ar?'المساعد جاهز، وسيبدأ تلقائيًا بمجرد نشر منتجات حقيقية في المتجر. لن نعرض اقتراحات وهمية.':'The assistant is ready and will start automatically once real products are published. No fake suggestions will be shown.'}</p><button type="button" onClick={()=>navigate('/store')}>{ar?'الذهاب للمتجر':'Go to store'}</button></div>:<><div className="individual-assistant-context"><span>{occasionLabel(row,lang)}</span><span>{budgetLabel(row.budget_band||'unspecified',lang)}</span><span>{giftPrefLabel(row.gift_preference,ar)}</span>{personalized&&<span>{ar?'يراعي ذوقك المحفوظ':'Uses your saved taste'}</span>}</div>{suggestions.length?<div className="individual-occasion-suggestion-list">{suggestions.map((s,i)=><SuggestionCard key={`${row.id}-${i}`} suggestion={s} lang={lang} onAdd={addSuggestion}/>)}</div>:<div className="individual-occasion-catalog-empty"><CircleAlert size={22}/><strong>{ar?'ما لقينا خيارًا مناسبًا الآن':'No suitable option found right now'}</strong><p>{ar?'غيّر الميزانية أو نوع الهدية، أو استعرض المتجر كاملًا بدون قيود.':'Change the budget or gift type, or browse the full store without restrictions.'}</p></div>}</>}</div>}</section>
      {row.note&&<section className="individual-occasion-note"><small>{ar?'ملاحظتك':'YOUR NOTE'}</small><p>{row.note}</p></section>}
    </div>
    <div className="individual-occasion-detail-actions"><button type="button" className="ghost" onClick={()=>onEdit(row)}><Pencil size={15}/>{ar?'تعديل':'Edit'}</button><button type="button" className="danger" onClick={()=>onArchive(row)}><Trash2 size={15}/>{ar?'أرشفة':'Archive'}</button><button type="button" className="primary" onClick={()=>{writeCheckoutDraft(row.user_id,{occasion_id:row.id,occasion_type:row.occasion_type,recipient_id:row.recipient_id||null,address_id:address?.id||null,is_gift:true,budget_band:row.budget_band||'unspecified'});navigate(`/store?occasion=${encodeURIComponent(row.occasion_type)}&budget=${encodeURIComponent(row.budget_band||'unspecified')}`);}}><Store size={15}/>{ar?'ابدأ باختيار الهدية':'Choose a gift'}</button></div>
  </div></div>;
}

export default function IndividualOccasions({ lang, session }){
  const ar=lang==='ar'; const navigate=useNavigate(); const cart=useBalqeesCart(session?.user?.id||null); const {settings}=useSystemSettings(); const pricingVisible=settings?.store?.showPrices!==false;
  const [rows,setRows]=useState([]); const [recipients,setRecipients]=useState([]); const [addresses,setAddresses]=useState([]); const [recipientLinks,setRecipientLinks]=useState([]); const [orders,setOrders]=useState([]); const [products,setProducts]=useState([]); const [categories,setCategories]=useState([]); const [rules,setRules]=useState([]); const [preferences,setPreferences]=useState(null); const [favoriteIds,setFavoriteIds]=useState(new Set()); const [interestEvents,setInterestEvents]=useState([]); const [loading,setLoading]=useState(true); const [refreshing,setRefreshing]=useState(false); const [error,setError]=useState(''); const [wizard,setWizard]=useState(null); const [selected,setSelected]=useState(null); const [showPast,setShowPast]=useState(false); const [toast,setToast]=useState('');
  const uid=session?.user?.id;
  async function load(silent=false){ if(!uid||!supabase)return; if(silent)setRefreshing(true);else setLoading(true); setError(''); try { await supabase.rpc('customer_sync_occasion_reminders'); } catch { /* reminders are best-effort */ }
    const [o,r,a,links,ord,p,c,pr,prefs,favs,events]=await Promise.all([
      supabase.from('customer_occasions').select('*').eq('user_id',uid).order('occasion_date',{ascending:true,nullsFirst:false}),
      supabase.from('customer_recipients').select('*').eq('user_id',uid).eq('is_active',true).order('is_favorite',{ascending:false}).order('updated_at',{ascending:false}),
      supabase.from('customer_addresses').select('*').eq('user_id',uid).eq('is_active',true),
      supabase.from('customer_recipient_addresses').select('*').eq('user_id',uid),
      supabase.from('orders').select('id,order_number,status,total,customer_recipient_id,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(80),
      supabase.from('products').select('id,category_id,sku,name_ar,name_en,description_ar,description_en,base_price,sale_price,price_on_request,stock_mode,stock_quantity,unit_ar,unit_en,image_url,tags,is_active,is_featured,visibility,slug,sale_starts_at,sale_ends_at,min_order_quantity,max_order_quantity').eq('is_active',true).eq('visibility','public'),
      supabase.from('product_categories').select('id,name_ar,name_en,is_active').eq('is_active',true),
      supabase.from('price_rules').select('*').eq('is_active',true),
      supabase.from('customer_preferences').select('personalized_recommendations').eq('user_id',uid).maybeSingle(),
      supabase.from('customer_favorites').select('product_id').eq('user_id',uid),
      supabase.from('customer_interest_events').select('event_type,product_id,category_id,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(120),
    ]);
    const firstError=[o,r,a,links,ord,p,c,pr,prefs,favs,events].find(x=>x.error)?.error; if(firstError)setError(ar?'تعذر تحميل بيانات المناسبات بالكامل. حاول التحديث.':'Could not load all occasion data. Try refreshing.');
    setRows(o.data||[]); setRecipients(r.data||[]); setAddresses(a.data||[]); setRecipientLinks(links.data||[]); setOrders(ord.data||[]); setProducts(p.data||[]); setCategories(c.data||[]); setRules(pr.data||[]); setPreferences(prefs.data||null); setFavoriteIds(new Set((favs.data||[]).map(x=>x.product_id))); setInterestEvents(events.data||[]); setLoading(false); setRefreshing(false);
  }
  useEffect(()=>{load();},[uid]);
  useEffect(()=>{ if(!toast)return; const t=setTimeout(()=>setToast(''),2600); return()=>clearTimeout(t); },[toast]);
  const active=useMemo(()=>rows.filter(x=>x.is_active),[rows]); const upcoming=useMemo(()=>active.filter(x=>x.occasion_type!=='usual_gift'&&x.occasion_date&&daysUntil(x.occasion_date)>=0).sort((a,b)=>String(a.occasion_date).localeCompare(String(b.occasion_date))),[active]); const usual=useMemo(()=>active.filter(x=>x.occasion_type==='usual_gift'),[active]); const past=useMemo(()=>active.filter(x=>x.occasion_type!=='usual_gift'&&x.occasion_date&&daysUntil(x.occasion_date)<0).sort((a,b)=>String(b.occasion_date).localeCompare(String(a.occasion_date))),[active]); const season=useMemo(()=>seasonalOccasion(),[]); const personalized=preferences?.personalized_recommendations!==false;
  function openNew(){setWizard({user_id:uid});}
  function openEdit(row){setSelected(null);setWizard(row);}
  async function archive(row){ if(!window.confirm(ar?'أرشفة هذه المناسبة؟ ستبقى بيانات الطلبات السابقة محفوظة.':'Archive this occasion? Previous order history will stay intact.'))return; const {error:e}=await supabase.from('customer_occasions').update({is_active:false,updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',uid); if(!e){setSelected(null);setToast(ar?'تمت أرشفة المناسبة.':'Occasion archived.');load(true);} }
  function openSeason(){ const type=season?.type;if(!type)return; localStorage.setItem('balqees-store-occasion-context',JSON.stringify({occasion_type:type,source:'seasonal_occasion',created_at:new Date().toISOString()})); navigate(`/store?occasion=${encodeURIComponent(type)}`); }
  const seasonalMeta=season?typeMeta(season.type):null; const SeasonalIcon=seasonalMeta?.icon || MoonStar;
  return <OccasionsChrome lang={lang} session={session} cartCount={cart.count}><main className="individual-occasions-main"><div className="individual-shell">
    <section className="individual-occasions-head"><div><span><Sparkles size={14}/>{ar?'مساعد شخصي للهدايا':'PERSONAL GIFT PLANNER'}</span><h1>{ar?'مناسباتي':'My occasions'}</h1><p>{ar?'احفظ المناسبات التي تهمك، وخلي بلقيس يساعدك تستعد لها بهدوء وبأقل خطوات.':'Save what matters and let Balqees help you prepare calmly with fewer steps.'}</p></div><div><button className="individual-refresh" type="button" onClick={()=>load(true)} disabled={refreshing}><RefreshCw className={refreshing?'spin':''} size={16}/>{ar?'تحديث':'Refresh'}</button><button className="individual-occasion-add" type="button" onClick={openNew}><Plus size={16}/>{ar?'إضافة مناسبة':'Add occasion'}</button></div></section>
    {error&&<div className="individual-orders-recovery"><CircleAlert size={18}/><div><strong>{ar?'تعذر تحميل كل البيانات':'Some data could not be loaded'}</strong><span>{error}</span></div><button type="button" onClick={()=>load()}>{ar?'إعادة المحاولة':'Retry'}</button></div>}
    {loading?<div className="individual-loading-state"><LoaderCircle className="spin" size={27}/><strong>{ar?'نجهز مناسباتك…':'Preparing your occasions…'}</strong><span>{ar?'نرتب المواعيد والمستلمين والتذكيرات.' :'Organizing dates, recipients and reminders.'}</span></div>:<>
      {upcoming.length>0&&<section className="individual-occasion-section"><div className="individual-section-heading"><div><span>{ar?'الأقرب أولًا':'NEXT UP'}</span><h2>{ar?'المناسبات القادمة':'Upcoming occasions'}</h2><p>{ar?'بطاقات قليلة وواضحة، بدون تقويم مزدحم أو عدادات ضخمة.':'A few clear cards, without a crowded calendar or giant countdowns.'}</p></div></div><div className="individual-occasion-card-grid">{upcoming.slice(0,6).map(row=><OccasionCard key={row.id} row={row} lang={lang} recipients={recipients} onOpen={()=>setSelected(row)}/>)}</div></section>}
      {season&&seasonalMeta&&<section className="individual-seasonal-occasion"><div className="individual-seasonal-icon"><SeasonalIcon size={27}/></div><div><small>{season.live?(ar?'الموسم الحالي':'CURRENT SEASON'):(ar?'الموسم القادم':'NEXT SEASON')}</small><h2>{ar?seasonalMeta.ar:seasonalMeta.en}</h2><p>{season.live?(ar?'اكتشف باقات وهدايا الموسم المنشورة في المتجر.':'Explore published seasonal bouquets and gifts.'):(season.days<=45?(ar?`متبقي تقريبًا ${season.days} يومًا. جهّز هديتك بدري بدون استعجال.`:`About ${season.days} days away. Prepare early without rushing.`):(ar?`يبدأ الموسم القادم تقريبًا في ${arDate(season.date,lang,true)}.`:`The next season begins around ${arDate(season.date,lang,true)}.`))}</p></div><button type="button" onClick={openSeason}>{ar?'استعرض هدايا الموسم':'Explore seasonal gifts'}<ChevronLeft size={15}/></button></section>}
      {usual.length>0&&<section className="individual-occasion-section"><div className="individual-section-heading"><div><span>{ar?'بدون موعد محدد':'NO FIXED DATE'}</span><h2>{ar?'الهدايا المعتادة':'Usual gifts'}</h2><p>{ar?'اختيارات تحفظها للأشخاص أو المواقف التي تتكرر عندك.':'Saved gifting contexts for people or situations you use often.'}</p></div></div><div className="individual-usual-gift-list">{usual.map(row=><OccasionCard key={row.id} row={row} lang={lang} recipients={recipients} compact onOpen={()=>setSelected(row)}/>)}</div></section>}
      {!upcoming.length&&!usual.length&&<section className="individual-occasion-empty"><div><CalendarDays size={34}/></div><span>{ar?'مساحة هادئة للاستعداد':'A CALM PLACE TO PREPARE'}</span><h2>{ar?'ما حفظت مناسبات حتى الآن':'No saved occasions yet'}</h2><p>{ar?'أضف مناسبة بثلاث خطوات فقط، أو استخدم الموسم الحالي بدون حفظ أي تاريخ يدويًا.':'Add one in only three steps, or use the current season without saving a date manually.'}</p><button type="button" onClick={openNew}><Plus size={16}/>{ar?'إضافة أول مناسبة':'Add first occasion'}</button></section>}
      {past.length>0&&<section className="individual-occasion-past"><button type="button" onClick={()=>setShowPast(v=>!v)}><Clock3 size={15}/><span>{showPast?(ar?'إخفاء المناسبات السابقة':'Hide past occasions'):(ar?`عرض المناسبات السابقة (${past.length})`:`Show past occasions (${past.length})`)}</span><ChevronLeft size={14}/></button>{showPast&&<div>{past.map(row=><OccasionCard key={row.id} row={row} lang={lang} recipients={recipients} compact onOpen={()=>setSelected(row)}/>)}</div>}</section>}
      <section className="individual-occasion-privacy"><Bell size={16}/><div><strong>{ar?'التذكير بإرادتك فقط':'Reminders only when you choose'}</strong><p>{ar?'لا نضيف مناسبات من عندنا، ولا نستخدم بيانات المستلمين للتسويق. التذكيرات داخل الحساب لا تعمل إلا للمواعيد التي تختارها أنت.':'We do not invent personal occasions or use recipient details for marketing. In-account reminders only run for dates you choose.'}</p></div></section>
    </>}
  </div></main>
  {wizard&&<OccasionWizard lang={lang} initial={wizard} recipients={recipients} onClose={()=>setWizard(null)} onSaved={()=>{setWizard(null);setToast(ar?'تم حفظ المناسبة.':'Occasion saved.');load(true);}}/>}
  {selected&&<OccasionDetail lang={lang} row={selected} recipients={recipients} addresses={addresses} recipientLinks={recipientLinks} orders={orders} products={products} categories={categories} rules={rules} personalized={personalized} favoriteIds={favoriteIds} interestEvents={interestEvents} pricingVisible={pricingVisible} onClose={()=>setSelected(null)} onEdit={openEdit} onArchive={archive} onRefresh={()=>{load(true);setSelected(prev=>prev?{...prev}:null);}} cart={cart} onToast={setToast}/>} 
  {toast&&<div className="individual-toast"><Check size={15}/><span>{toast}</span></div>}
  </OccasionsChrome>;
}

function OccasionCard({ row, lang, recipients, compact=false, onOpen }){
  const ar=lang==='ar'; const meta=typeMeta(row.occasion_type); const Icon=meta.icon; const d=daysUntil(row.occasion_date); const ready=readinessMeta(row.readiness||'not_started',ar);
  return <article className={`individual-occasion-item ${compact?'compact':''}`}><div className="individual-occasion-item-icon"><Icon size={22}/></div><div className="individual-occasion-item-copy"><small>{row.occasion_date?arDate(row.occasion_date,lang,true):(ar?'بدون تاريخ':'No set date')}</small><h3>{occasionLabel(row,lang)}</h3><p>{recipientDisplay(row,recipients,ar)}{row.occasion_type==='usual_gift'&&row.usual_gift_type?` · ${usualGiftLabel(row.usual_gift_type,ar)}`:''}{row.budget_band&&row.budget_band!=='unspecified'?` · ${budgetLabel(row.budget_band,lang)}`:''}</p><div><span className={ready[1]}>{ready[0]}</span>{d!==null&&d>=0&&<em>{d===0?(ar?'اليوم':'Today'):ar?`بعد ${d} يومًا`:`In ${d} days`}</em>}</div></div><button type="button" onClick={onOpen}>{ar?'استعد للمناسبة':'Prepare'}<ChevronLeft size={15}/></button></article>;
}
