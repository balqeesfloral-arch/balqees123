import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AtSign, BadgeCheck, Bell, CalendarDays, Check, ChevronDown, ChevronUp,
  CircleAlert, CircleCheck, FileText, Globe2, Heart, Home, Languages, LoaderCircle,
  Mail, MapPin, PackageOpen, Pencil, Phone, RefreshCw,
  ShieldCheck, Settings2, ShoppingBag, Smartphone, Store, UserRound, UsersRound,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { isValidUsername } from '../lib/authValidation';
import { cacheCustomerPreferences, CUSTOMER_PREFERENCE_DEFAULTS } from '../lib/customerPreferences';
import { countryOptions } from './countries';
import './individual-account.css';

function fmtDateTime(value, lang) {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return '—'; }
}
function normalizePhone(value = '') {
  let v = String(value || '').trim().replace(/[\s()-]/g, '');
  if (/^05\d{8}$/.test(v)) v = `+966${v.slice(1)}`;
  else if (/^9665\d{8}$/.test(v)) v = `+${v}`;
  else if (/^5\d{8}$/.test(v)) v = `+966${v}`;
  return v;
}
function phoneValid(value) { return /^\+[1-9]\d{7,14}$/.test(normalizePhone(value)); }
function countryLabel(code, options) { return options.find(x => x.code === code)?.label || code || '—'; }
function addressLabel(row, ar) {
  if (!row) return ar ? 'لا يوجد عنوان افتراضي' : 'No default address';
  return [row.label, row.district, row.city].filter(Boolean).join(' — ');
}
function errorText(error, ar) {
  const msg = String(error?.message || '').toUpperCase();
  if (msg.includes('USERNAME_TAKEN') || String(error?.message || '').includes('customer_profiles_username_key')) return ar ? 'اسم المستخدم مستخدم بالفعل.' : 'That username is already in use.';
  if (msg.includes('INVALID_USERNAME')) return ar ? 'اسم المستخدم يجب أن يكون بين 3 و30 حرفًا وبدون مسافات.' : 'Username must be 3–30 characters with no spaces.';
  if (msg.includes('INVALID_PHONE')) return ar ? 'اكتب رقمًا صحيحًا بصيغة دولية مثل +9665…' : 'Enter a valid international number such as +9665…';
  if (msg.includes('INVALID_FULL_NAME')) return ar ? 'تحقق من الاسم الكامل.' : 'Check the full name.';
  return ar ? 'تعذر حفظ التغيير الآن. حاول مرة أخرى.' : 'Could not save this change right now.';
}

function FieldRow({ icon: Icon, label, value, hint, verified, action, actionText, muted = false }) {
  return <div className={`individual-profile-row ${muted ? 'muted' : ''}`}>
    <span className="individual-profile-row-icon"><Icon size={17}/></span>
    <div><small>{label}</small><strong>{value || '—'}</strong>{hint && <em>{hint}</em>}</div>
    {verified && <span className="individual-profile-verified"><BadgeCheck size={14}/>{verified}</span>}
    {action && <button type="button" onClick={action}><Pencil size={13}/>{actionText}</button>}
  </div>;
}

export default function IndividualProfile({ lang, setLang, session }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const cart = useBalqeesCart(session?.user?.id || null);
  const countries = useMemo(() => countryOptions(lang), [lang]);
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState(null);
  const [basicOpen, setBasicOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [form, setForm] = useState({ full_name:'', username:'', phone:'', nationality_code:'', birth_date:'', gender:'', residence_city:'' });
  const [emailDraft, setEmailDraft] = useState('');
  const [countrySearch, setCountrySearch] = useState('');

  async function load(background = false) {
    if (!supabase || !session?.user?.id) return;
    background ? setRefreshing(true) : setLoading(true);
    const uid = session.user.id;
    const [p, pref, addr] = await Promise.all([
      supabase.from('customer_profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('customer_preferences').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('customer_addresses').select('*').eq('user_id', uid).eq('is_active', true).order('is_default', { ascending:false }).order('updated_at', { ascending:false }),
    ]);
    if (p.data) {
      setProfile(p.data);
      const personal = p.data.personal || {};
      setForm({
        full_name: p.data.full_name || '', username: p.data.username || '', phone: p.data.phone || '',
        nationality_code: personal.nationality_code || '', birth_date: personal.birth_date || '',
        gender: personal.gender || '', residence_city: personal.residence_city || '',
      });
      setEmailDraft(session.user.email || p.data.email || '');
      const code = personal.nationality_code || '';
      setCountrySearch(code ? (countries.find(x => x.code === code)?.label || code) : '');
    }
    setPreferences(pref.data || null);
    setAddresses(addr.data || []);
    setLoading(false); setRefreshing(false);
  }
  useEffect(() => { load(); }, [session?.user?.id]);
  useEffect(() => {
    document.body.classList.add('individual-account-active');
    return () => document.body.classList.remove('individual-account-active');
  }, []);
  useEffect(() => {
    if (!form.nationality_code) { if (!countrySearch) setCountrySearch(''); return; }
    const label = countries.find(x => x.code === form.nationality_code)?.label;
    if (label && (countrySearch === form.nationality_code || !countrySearch)) setCountrySearch(label);
  }, [lang, countries]);

  const defaultAddress = useMemo(() => {
    const id = preferences?.default_address_id;
    return addresses.find(x => x.id === id) || addresses.find(x => x.is_default) || null;
  }, [addresses, preferences]);
  const personal = profile?.personal || {};
  const fullName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || (ar ? 'عميل بلقيس' : 'Balqees client');
  const firstName = fullName.trim().split(/\s+/)[0];
  const emailVerified = Boolean(session?.user?.email_confirmed_at);
  const phoneVerified = Boolean(session?.user?.phone_confirmed_at && session?.user?.phone && normalizePhone(session.user.phone) === normalizePhone(profile?.phone));
  const profileReady = Boolean(profile?.full_name && profile?.phone && session?.user?.email && emailVerified && defaultAddress);
  const nextNeed = !profile?.full_name ? (ar ? 'أكمل اسمك ليتضح في الطلبات.' : 'Add your name for clearer orders.')
    : !profile?.phone ? (ar ? 'أضف رقم تواصل لاستخدامه في الطلبات.' : 'Add a contact number for orders.')
    : !emailVerified ? (ar ? 'أكد بريدك الإلكتروني لحماية الحساب.' : 'Verify your email to protect your account.')
    : !defaultAddress ? (ar ? 'أضف عنوانًا افتراضيًا لتسريع طلباتك القادمة.' : 'Add a default address to speed up future orders.') : '';

  function flash(type, text) { setNotice({ type, text }); window.setTimeout(() => setNotice(null), 4200); }

  async function saveProfile(section) {
    if (!supabase) return;
    const normalized = normalizePhone(form.phone);
    if (!isValidUsername(form.username)) return flash('error', ar ? 'اسم المستخدم 3–30 حرفًا وبدون مسافات أو رموز متكررة.' : 'Username must be 3–30 characters with no spaces or repeated symbols.');
    if (!phoneValid(normalized)) return flash('error', ar ? 'اكتب رقم التواصل بصيغة دولية صحيحة.' : 'Enter a valid international contact number.');
    const countryNeedle = countrySearch.trim().toLocaleLowerCase(lang === 'ar' ? 'ar' : 'en');
    const countryMatch = !countryNeedle ? null : countries.find(c => c.code.toLowerCase() === countryNeedle || c.label.toLocaleLowerCase(lang === 'ar' ? 'ar' : 'en') === countryNeedle);
    if (countryNeedle && !countryMatch) return flash('error', ar ? 'اختر بلد الجنسية من القائمة.' : 'Choose a nationality country from the list.');
    setSaving(section);
    const { data, error } = await supabase.rpc('customer_update_individual_profile', {
      p_full_name: form.full_name.trim(), p_username: form.username.trim(), p_phone: normalized,
      p_nationality_code: countryMatch?.code || null, p_birth_date: form.birth_date || null,
      p_gender: form.gender || null, p_residence_city: form.residence_city.trim() || null,
    });
    setSaving('');
    if (error) return flash('error', errorText(error, ar));
    setProfile(prev => ({ ...prev, ...data }));
    section === 'basic' ? setBasicOpen(false) : setExtraOpen(false);
    flash('success', ar ? 'تم تحديث بياناتك بنجاح.' : 'Your profile was updated.');
  }

  async function changeEmail(e) {
    e.preventDefault();
    const next = emailDraft.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) return flash('error', ar ? 'اكتب بريدًا إلكترونيًا صحيحًا.' : 'Enter a valid email address.');
    if (next === String(session?.user?.email || '').toLowerCase()) { setEmailOpen(false); return; }
    setSaving('email');
    const { error } = await supabase.auth.updateUser({ email: next });
    setSaving('');
    if (error) return flash('error', ar ? 'تعذر بدء تغيير البريد. حاول مرة أخرى.' : 'Could not start the email change.');
    setEmailOpen(false);
    flash('success', ar ? 'تم إرسال طلب تغيير البريد. حسب إعدادات الأمان قد تحتاج تأكيد البريد الحالي والجديد قبل اعتماد التغيير.' : 'Email change requested. Depending on security settings, you may need to confirm both your current and new email.');
  }

  async function changeLanguage(next) {
    if (!supabase || next === lang) return;
    setSaving('language');
    const uid = session.user.id;
    const request = preferences?.user_id
      ? supabase.from('customer_preferences').update({ preferred_language: next, updated_at: new Date().toISOString() }).eq('user_id', uid)
      : supabase.from('customer_preferences').insert({ user_id: uid, ...CUSTOMER_PREFERENCE_DEFAULTS, preferred_language: next });
    const { error } = await request;
    setSaving('');
    if (error) return flash('error', ar ? 'تعذر حفظ اللغة.' : 'Could not save language.');
    const nextPreferences = { ...(preferences || {}), user_id: uid, preferred_language: next };
    setPreferences(nextPreferences);
    cacheCustomerPreferences(uid, nextPreferences);
    setLang?.(next);
  }

  if (loading) return <div className="individual-page"><div className="individual-center-state"><LoaderCircle className="spin"/><strong>{ar ? 'نجهز ملفك…' : 'Preparing your profile…'}</strong></div></div>;

  return <div className="individual-page individual-profile-page" dir={ar ? 'rtl' : 'ltr'}>
    <header className="individual-topbar"><div className="individual-shell individual-topbar-inner">
      <Link to="/" className="individual-brand"><BrandMark/></Link>
      <div className="individual-topbar-center"><span>{ar ? 'ملفي الشخصي' : 'MY PROFILE'}</span><small>{ar ? 'حساب فردي' : 'INDIVIDUAL ACCOUNT'}</small></div>
      <div className="individual-top-actions"><button type="button" className="individual-icon-button" onClick={() => navigate('/account/notifications')}><Bell size={19}/></button><button type="button" className="individual-icon-button" onClick={() => navigate('/account/cart')}><ShoppingBag size={19}/>{cart.count > 0 && <b>{Math.min(cart.count,99)}</b>}</button><button type="button" className="individual-profile-chip active" onClick={() => window.scrollTo({ top:0, behavior:'smooth' })}><span>{fullName.slice(0,1).toUpperCase()}</span><div><small>{ar ? 'حسابي' : 'Account'}</small><strong>{firstName}</strong></div></button></div>
    </div></header>

    <main className="individual-shell individual-profile-main">
      {notice && <div className={`individual-inline-notice ${notice.type}`}>{notice.type === 'success' ? <CircleCheck/> : <CircleAlert/>}<span>{notice.text}</span></div>}

      <section className="individual-profile-identity">
        <div className="individual-profile-avatar">{fullName.slice(0,1).toUpperCase()}</div>
        <div className="individual-profile-identity-copy"><small>{ar ? 'هويتك في بلقيس' : 'YOUR BALQEES IDENTITY'}</small><h1>{fullName}</h1><p>{session?.user?.email}</p><span><UserRound size={13}/>{ar ? 'حساب فردي' : 'Individual account'}</span></div>
        <div className={`individual-profile-readiness ${profileReady ? 'ready' : ''}`}>{profileReady ? <CircleCheck/> : <CircleAlert/>}<div><strong>{profileReady ? (ar ? 'ملفك جاهز للطلبات' : 'Your profile is ready for orders') : (ar ? 'خطوة بسيطة وتكون جاهز' : 'One small step to be ready')}</strong>{!profileReady && <p>{nextNeed}</p>}</div>{!defaultAddress && <Link to="/account/addresses">{ar ? 'إضافة عنوان' : 'Add address'}</Link>}</div>
        <button className="individual-refresh" type="button" onClick={() => load(true)} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={16}/><span>{ar ? 'تحديث' : 'Refresh'}</span></button>
      </section>

      <section className="individual-profile-section">
        <div className="individual-profile-section-head"><div><small>{ar ? 'البيانات الأساسية' : 'BASIC DETAILS'}</small><h2>{ar ? 'بياناتي الأساسية' : 'My basic details'}</h2><p>{ar ? 'المعلومات التي نستخدمها لتشغيل الحساب والطلبات.' : 'Information used to operate your account and orders.'}</p></div><button type="button" onClick={() => setBasicOpen(v=>!v)}>{basicOpen ? <ChevronUp/> : <Pencil/>}{basicOpen ? (ar ? 'إغلاق' : 'Close') : (ar ? 'تعديل' : 'Edit')}</button></div>
        {!basicOpen ? <div className="individual-profile-rows">
          <FieldRow icon={UserRound} label={ar ? 'الاسم الكامل' : 'Full name'} value={profile?.full_name}/>
          <FieldRow icon={AtSign} label={ar ? 'اسم المستخدم' : 'Username'} value={`@${profile?.username || ''}`}/>
          <FieldRow icon={Phone} label={ar ? 'رقم التواصل' : 'Contact number'} value={profile?.phone} verified={phoneVerified ? (ar ? 'موثق' : 'Verified') : null} hint={!phoneVerified ? (ar ? 'رقم تواصل محفوظ — لا يوجد تحقق OTP مفعّل لهذا الرقم حاليًا.' : 'Saved contact number — OTP verification is not active for this number yet.') : null}/>
          <FieldRow icon={Mail} label={ar ? 'البريد الإلكتروني' : 'Email'} value={session?.user?.email || profile?.email} verified={emailVerified ? (ar ? 'مؤكد' : 'Verified') : null} hint={!emailVerified ? (ar ? 'بانتظار تأكيد البريد الإلكتروني.' : 'Email verification is pending.') : null} action={() => { setEmailDraft(session?.user?.email || ''); setEmailOpen(true); }} actionText={ar ? 'تغيير' : 'Change'}/>
        </div> : <div className="individual-profile-edit-grid">
          <label><span>{ar ? 'الاسم الكامل' : 'Full name'}</span><input value={form.full_name} onChange={e=>setForm(v=>({...v,full_name:e.target.value}))} maxLength={120}/></label>
          <label><span>{ar ? 'اسم المستخدم' : 'Username'}</span><input dir="ltr" value={form.username} onChange={e=>setForm(v=>({...v,username:e.target.value}))} maxLength={30}/><small>{ar ? '3–30 حرفًا، بدون مسافات.' : '3–30 characters, no spaces.'}</small></label>
          <label className="wide"><span>{ar ? 'رقم التواصل' : 'Contact number'}</span><input dir="ltr" type="tel" value={form.phone} onChange={e=>setForm(v=>({...v,phone:e.target.value}))} placeholder="+9665XXXXXXXX"/><small>{ar ? 'هذا رقم تواصل للطلبات. لن نضع علامة موثق إلا عند تفعيل OTP فعليًا.' : 'This number is used for orders. It is only marked verified when real OTP verification is active.'}</small></label>
          <div className="individual-profile-form-actions wide"><button type="button" onClick={()=>{ setBasicOpen(false); load(true); }}>{ar ? 'إلغاء' : 'Cancel'}</button><button className="primary" type="button" onClick={()=>saveProfile('basic')} disabled={saving==='basic'}>{saving==='basic' ? <LoaderCircle className="spin"/> : <Check/>}{ar ? 'حفظ التغييرات' : 'Save changes'}</button></div>
        </div>}
        {emailOpen && <form className="individual-profile-email-edit" onSubmit={changeEmail}><Mail/><div><strong>{ar ? 'تغيير البريد الإلكتروني' : 'Change email'}</strong><p>{ar ? 'التغيير يمر عبر نظام Auth. قد يطلب Supabase تأكيد البريد الحالي والجديد قبل اعتماد العنوان الجديد.' : 'This change goes through Auth. Supabase may require confirmation from both the current and new address.'}</p><input type="email" value={emailDraft} onChange={e=>setEmailDraft(e.target.value)} required/></div><span><button type="button" onClick={()=>setEmailOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</button><button className="primary" disabled={saving==='email'}>{saving==='email' ? <LoaderCircle className="spin"/> : <Check/>}{ar ? 'إرسال طلب التغيير' : 'Request change'}</button></span></form>}
      </section>

      <section className="individual-profile-section secondary">
        <button className="individual-profile-collapse-head" type="button" onClick={()=>setExtraOpen(v=>!v)}><span><UsersRound/><div><small>{ar ? 'اختياري' : 'OPTIONAL'}</small><strong>{ar ? 'معلومات إضافية' : 'Additional information'}</strong><p>{ar ? 'نحتفظ فقط بما له فائدة حقيقية للخدمة، ولا نستخدم الجنسية أو الميلاد لتحديد الأسعار.' : 'We only keep what helps service delivery; nationality and birth date are not used for pricing.'}</p></div></span>{extraOpen ? <ChevronUp/> : <ChevronDown/>}</button>
        {extraOpen && <div className="individual-profile-edit-grid optional-grid">
          <label><span>{ar ? 'بلد الجنسية' : 'Nationality country'}</span><input list="balqees-country-options" value={countrySearch} onChange={e=>setCountrySearch(e.target.value)} placeholder={ar ? 'ابحث باسم الدولة…' : 'Search country…'}/><datalist id="balqees-country-options">{countries.map(c=><option key={c.code} value={c.label}>{c.code}</option>)}</datalist><small>{ar ? 'قائمة قابلة للبحث. لبيانات الحساب فقط؛ لا تدخل في التسعير أو الاقتراحات.' : 'Searchable list. Account information only; never used for pricing or recommendations.'}</small></label>
          <label><span>{ar ? 'مدينة / منطقة الإقامة' : 'City / area of residence'}</span><input value={form.residence_city} onChange={e=>setForm(v=>({...v,residence_city:e.target.value}))} maxLength={120}/></label>
          <label><span>{ar ? 'تاريخ الميلاد' : 'Birth date'}</span><input type="date" value={form.birth_date} max={new Date().toISOString().slice(0,10)} onChange={e=>setForm(v=>({...v,birth_date:e.target.value}))}/><small>{ar ? 'اختياري، ولا يتحول تلقائيًا إلى مناسبة تسويقية.' : 'Optional and never turned into a marketing occasion automatically.'}</small></label>
          <label><span>{ar ? 'الجنس' : 'Gender'}</span><select value={form.gender} onChange={e=>setForm(v=>({...v,gender:e.target.value}))}><option value="">{ar ? 'غير محدد' : 'Not specified'}</option><option value="male">{ar ? 'ذكر' : 'Male'}</option><option value="female">{ar ? 'أنثى' : 'Female'}</option><option value="prefer_not_to_say">{ar ? 'أفضل عدم التحديد' : 'Prefer not to say'}</option></select></label>
          <div className="individual-profile-form-actions wide"><button type="button" onClick={()=>{ setExtraOpen(false); load(true); }}>{ar ? 'إلغاء' : 'Cancel'}</button><button className="primary" type="button" onClick={()=>saveProfile('extra')} disabled={saving==='extra'}>{saving==='extra' ? <LoaderCircle className="spin"/> : <Check/>}{ar ? 'حفظ المعلومات' : 'Save information'}</button></div>
        </div>}
      </section>

      <section className="individual-profile-grid-two">
        <article className="individual-profile-mini-card"><span className="icon"><Languages/></span><div><small>{ar ? 'تفضيلات الحساب' : 'ACCOUNT PREFERENCES'}</small><h3>{ar ? 'اللغة' : 'Language'}</h3><p>{ar ? 'تتغير الواجهة فورًا وتُحفظ للحساب.' : 'Changes immediately and is saved to your account.'}</p><div className="individual-profile-segment"><button className={lang==='ar'?'active':''} onClick={()=>changeLanguage('ar')} disabled={saving==='language'}>العربية</button><button className={lang==='en'?'active':''} onClick={()=>changeLanguage('en')} disabled={saving==='language'}>English</button></div></div></article>
        <article className="individual-profile-mini-card"><span className="icon"><Smartphone/></span><div><small>{ar ? 'طريقة التواصل' : 'CONTACT'}</small><h3>{ar ? 'داخل حساب بلقيس' : 'Inside your Balqees account'}</h3><p>{ar ? 'تحديثات الطلب وردود مركز العناية تعمل داخل الحساب. لن نظهر واتساب أو بريد آلي كقنوات مفعلة قبل ربطها فعليًا.' : 'Order updates and Care replies work in-app. Automated email or WhatsApp channels are not shown as active until they are truly connected.'}</p></div></article>
      </section>

      <section className="individual-profile-section address-summary"><div className="individual-profile-section-head"><div><small>{ar ? 'التوصيل' : 'DELIVERY'}</small><h2>{ar ? 'العنوان الافتراضي' : 'Default address'}</h2></div><Link to="/account/addresses">{ar ? 'إدارة العناوين' : 'Manage addresses'}</Link></div>
        <div className={`individual-profile-address ${defaultAddress ? '' : 'empty'}`}><span><MapPin/></span><div><strong>{addressLabel(defaultAddress, ar)}</strong>{defaultAddress ? <p>{[defaultAddress.street, defaultAddress.building_number && `${ar?'مبنى':'Bldg'} ${defaultAddress.building_number}`].filter(Boolean).join(' · ')}</p> : <p>{ar ? 'أضف عنوانك مرة واحدة واستخدمه في طلباتك القادمة.' : 'Add an address once and reuse it for future orders.'}</p>}</div><Link to="/account/addresses">{defaultAddress ? (ar ? 'تغيير' : 'Change') : (ar ? 'إضافة عنوان' : 'Add address')}</Link></div>
      </section>

      <section className="individual-profile-section security-section individual-profile-documents-link">
        <div className="individual-profile-section-head"><div><small>{ar ? 'الطلبات والمستندات' : 'ORDERS & DOCUMENTS'}</small><h2>{ar ? 'مستنداتي' : 'My documents'}</h2><p>{ar ? 'ملخصات الطلبات والفواتير الرسمية التي تنشرها بلقيس، محفوظة في خزنة واحدة داخل حسابك.' : 'Order summaries and official documents published by Balqees, kept in one vault inside your account.'}</p></div><Link to="/account/documents"><FileText/>{ar ? 'فتح مستنداتي' : 'Open documents'}</Link></div>
      </section>

      <section className="individual-profile-section security-section">
        <div className="individual-profile-section-head"><div><small>{ar ? 'الأمان والخصوصية' : 'SECURITY & PRIVACY'}</small><h2>{ar ? 'تدار من الإعدادات' : 'Managed from Settings'}</h2><p>{ar ? 'كلمة المرور، التحقق بخطوتين، الجلسات وطلبات الخصوصية موجودة في مركز واحد تابع للإعدادات.' : 'Password, two-factor authentication, sessions and privacy requests live in one center under Settings.'}</p></div><Link to="/account/settings/security"><ShieldCheck/>{ar ? 'فتح المركز' : 'Open center'}</Link></div>
      </section>

      <section className="individual-profile-privacy"><span><Globe2/></span><div><small>{ar ? 'الخصوصية والبيانات' : 'PRIVACY & DATA'}</small><h2>{ar ? 'بياناتك لخدمتك، لا لتغيير السعر عليك' : 'Your data serves your account, not your price'}</h2><p>{ar ? 'الجنسية والجنس وتاريخ الميلاد لا تدخل في التسعير أو محرك المخاطر. التخصيص الذكي للمتجر مستقل ويمكن التحكم فيه من الإعدادات.' : 'Nationality, gender and birth date do not affect pricing or risk scoring. Store personalization is separate and can be controlled from Settings.'}</p><div><span className={preferences?.personalized_recommendations === false ? 'off' : 'on'}>{preferences?.personalized_recommendations === false ? (ar ? 'تخصيص المتجر متوقف' : 'Store personalization off') : (ar ? 'تخصيص المتجر مفعّل' : 'Store personalization on')}</span><button type="button" onClick={()=>navigate('/account/settings')}><Settings2 size={13}/>{ar ? 'الإعدادات' : 'Settings'}</button><button type="button" onClick={()=>navigate('/account/support')}>{ar ? 'مساعدة بخصوص بياناتي' : 'Help with my data'}</button></div></div></section>
    </main>

    <nav className="individual-mobile-dock"><Link to="/account"><Home/><span>{ar ? 'الرئيسية' : 'Home'}</span></Link><Link to="/account/orders"><PackageOpen/><span>{ar ? 'طلباتي' : 'Orders'}</span></Link><Link to="/store"><Store/><span>{ar ? 'المتجر' : 'Store'}</span></Link><Link to="/account/favorites"><Heart/><span>{ar ? 'المفضلة' : 'Favorites'}</span></Link><Link className="active" to="/account/profile"><UserRound/><span>{ar ? 'حسابي' : 'Account'}</span></Link></nav>
  </div>;
}
