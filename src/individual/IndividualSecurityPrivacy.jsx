import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowLeft, ArrowRight, Bell, Check, ChevronLeft, ChevronRight,
  CircleAlert, CircleCheck, Copy, Database, Eye, EyeOff, Fingerprint, Heart,
  Home, KeyRound, Laptop, LoaderCircle, LockKeyhole, LogOut, MapPin, PackageOpen,
  RefreshCw, ShieldCheck, ShieldEllipsis, ShoppingBag, Smartphone, Store,
  Trash2, UserRound,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { passwordScore } from '../lib/authValidation';
import {
  CUSTOMER_PREFERENCE_DEFAULTS,
  cacheCustomerPreferences,
  normalizeCustomerPreferences,
} from '../lib/customerPreferences';
import './individual-account.css';

function formatDateTime(value, lang) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-SA', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh',
    }).format(new Date(value));
  } catch { return '—'; }
}

function browserLabel() {
  if (typeof navigator === 'undefined') return 'Browser';
  const ua = navigator.userAgent || '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows NT/.test(ua) ? 'Windows' : /iPhone|iPad|iPod/.test(ua) ? 'iOS / iPadOS' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' • ');
}

function safeError(error, ar) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  if (code.includes('reauth') || message.includes('reauth') || message.includes('recent')) return ar ? 'يلزم إعادة التحقق من هويتك قبل هذا الإجراء.' : 'Please reauthenticate before this action.';
  if (message.includes('current') && message.includes('password')) return ar ? 'كلمة المرور الحالية غير صحيحة.' : 'Your current password is incorrect.';
  if (message.includes('same password')) return ar ? 'اختر كلمة مرور مختلفة عن الحالية.' : 'Choose a password different from your current one.';
  if (message.includes('mfa') || message.includes('factor')) return ar ? 'تعذر إكمال إعداد التحقق بخطوتين. تحقق من الرمز وحاول مرة أخرى.' : 'Could not complete two-factor authentication. Check the code and try again.';
  return ar ? 'تعذر إتمام العملية الآن. حاول مرة أخرى.' : 'Could not complete this action right now.';
}

function SecurityTile({ icon: Icon, title, description, status, statusTone = '', to, onClick, disabled = false, children }) {
  const content = <>
    <span className="individual-security-tile-icon"><Icon/></span>
    <div className="individual-security-tile-copy"><strong>{title}</strong><p>{description}</p>{status && <span className={`individual-security-status ${statusTone}`}>{status}</span>}</div>
    <span className="individual-security-tile-arrow">{children}</span>
  </>;
  if (to) return <Link className="individual-security-tile" to={to}>{content}</Link>;
  return <button type="button" className="individual-security-tile" onClick={onClick} disabled={disabled}>{content}</button>;
}

function BackButton({ ar, onClick }) {
  return <button type="button" className="individual-security-back" onClick={onClick}>{ar ? <ArrowRight/> : <ArrowLeft/>}<span>{ar ? 'العودة لمركز الأمان والخصوصية' : 'Back to Security & Privacy'}</span></button>;
}

function PasswordPanel({ ar, lang, session, onNotice, logEvent }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const score = passwordScore(nextPassword);

  async function submit(e) {
    e.preventDefault();
    if (nextPassword.length < 8) return onNotice('error', ar ? 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.' : 'The new password must be at least 8 characters.');
    if (nextPassword !== confirmPassword) return onNotice('error', ar ? 'كلمتا المرور الجديدة غير متطابقتين.' : 'The new passwords do not match.');
    if (!currentPassword) return onNotice('error', ar ? 'اكتب كلمة المرور الحالية أولًا.' : 'Enter your current password first.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: nextPassword, currentPassword });
    setBusy(false);
    if (error) return onNotice('error', safeError(error, ar));
    setCurrentPassword(''); setNextPassword(''); setConfirmPassword('');
    await logEvent('password_changed', { method: 'current_password' });
    onNotice('success', ar ? 'تم تغيير كلمة المرور بنجاح.' : 'Password changed successfully.');
  }

  async function signOutOthers() {
    setBusy(true);
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    setBusy(false);
    if (error) return onNotice('error', safeError(error, ar));
    await logEvent('other_sessions_signed_out');
    onNotice('success', ar ? 'تم إنهاء جلسات الأجهزة الأخرى.' : 'Other device sessions were signed out.');
  }

  return <section className="individual-security-panel">
    <div className="individual-security-panel-heading"><span><KeyRound/></span><div><small>{ar ? 'كلمة المرور' : 'PASSWORD'}</small><h2>{ar ? 'تغيير كلمة المرور بأمان' : 'Change your password securely'}</h2><p>{ar ? 'نطلب كلمة المرور الحالية قبل التغيير. إعدادات Supabase قد تطلب إعادة تحقق إضافية للإجراءات الحساسة.' : 'Your current password is required. Supabase may also require reauthentication for sensitive changes.'}</p></div></div>
    <form className="individual-security-form" onSubmit={submit}>
      <label><span>{ar ? 'كلمة المرور الحالية' : 'Current password'}</span><div className="individual-security-input"><LockKeyhole/><input type={show ? 'text' : 'password'} value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} autoComplete="current-password" required/><button type="button" onClick={()=>setShow(v=>!v)}>{show?<EyeOff/>:<Eye/>}</button></div></label>
      <label><span>{ar ? 'كلمة المرور الجديدة' : 'New password'}</span><div className="individual-security-input"><KeyRound/><input type={show ? 'text' : 'password'} value={nextPassword} onChange={e=>setNextPassword(e.target.value)} autoComplete="new-password" minLength={8} required/></div></label>
      <label><span>{ar ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}</span><div className="individual-security-input"><Check/><input type={show ? 'text' : 'password'} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" minLength={8} required/></div></label>
      <div className="individual-security-password-meter"><div>{[1,2,3,4].map(n=><span key={n} className={n<=score?'active':''}/>)}</div><small>{score<=1?(ar?'ضعيفة':'Weak'):score===2?(ar?'متوسطة':'Fair'):score===3?(ar?'قوية':'Strong'):(ar?'قوية جدًا':'Very strong')}</small></div>
      <button className="individual-security-primary" disabled={busy || !currentPassword || !nextPassword || nextPassword!==confirmPassword}>{busy?<LoaderCircle className="spin"/>:<ShieldCheck/>}{ar ? 'حفظ كلمة المرور الجديدة' : 'Save new password'}</button>
    </form>
    <div className="individual-security-after-action"><div><strong>{ar ? 'بعد التغيير' : 'After changing it'}</strong><p>{ar ? 'إذا كنت تشك أن كلمة المرور عُرفت على جهاز آخر، أنهِ جلسات الأجهزة الأخرى فورًا.' : 'If you suspect another device knows your password, sign out other sessions immediately.'}</p></div><button type="button" onClick={signOutOthers} disabled={busy}><LogOut/>{ar ? 'تسجيل خروج الأجهزة الأخرى' : 'Sign out other devices'}</button></div>
    <div className="individual-security-fact"><ShieldCheck/><span>{ar ? `البريد المرتبط بالحساب: ${session?.user?.email || '—'}` : `Account email: ${session?.user?.email || '—'}`}</span></div>
  </section>;
}

function MfaPanel({ ar, factors, aal, refreshSecurity, onNotice, logEvent }) {
  const [busy, setBusy] = useState('');
  const [enrollment, setEnrollment] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [removeId, setRemoveId] = useState('');
  const [removeCode, setRemoveCode] = useState('');
  const verified = (factors?.totp || []).filter(x => x.status === 'verified');

  async function startEnrollment() {
    setBusy('enroll');
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Balqees Authenticator' });
    setBusy('');
    if (error) return onNotice('error', safeError(error, ar));
    setEnrollment(data);
  }

  async function verifyEnrollment(e) {
    e.preventDefault();
    if (!enrollment?.id || !/^\d{6,8}$/.test(verifyCode.trim())) return;
    setBusy('verify');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.id, code: verifyCode.trim() });
    setBusy('');
    if (error) return onNotice('error', safeError(error, ar));
    await logEvent('mfa_enabled', { factor_id: enrollment.id, factor_type: 'totp' });
    setEnrollment(null); setVerifyCode('');
    await refreshSecurity();
    onNotice('success', ar ? 'تم تفعيل التحقق بخطوتين بنجاح.' : 'Two-factor authentication is now enabled.');
  }

  async function cancelEnrollment() {
    if (enrollment?.id) await supabase.auth.mfa.unenroll({ factorId: enrollment.id });
    setEnrollment(null); setVerifyCode('');
  }

  async function removeFactor(e) {
    e.preventDefault();
    if (!removeId || !/^\d{6,8}$/.test(removeCode.trim())) return;
    setBusy(`remove-${removeId}`);
    const elevated = await supabase.auth.mfa.challengeAndVerify({ factorId: removeId, code: removeCode.trim() });
    if (elevated.error) { setBusy(''); return onNotice('error', safeError(elevated.error, ar)); }
    const { error } = await supabase.auth.mfa.unenroll({ factorId: removeId });
    setBusy('');
    if (error) return onNotice('error', safeError(error, ar));
    await logEvent('mfa_disabled', { factor_id: removeId, factor_type: 'totp' });
    setRemoveId(''); setRemoveCode('');
    await refreshSecurity();
    onNotice('success', ar ? 'تم إلغاء عامل التحقق بخطوتين المحدد.' : 'The selected two-factor method was removed.');
  }

  return <section className="individual-security-panel">
    <div className="individual-security-panel-heading"><span><ShieldEllipsis/></span><div><small>{ar ? 'التحقق بخطوتين' : 'TWO-FACTOR AUTHENTICATION'}</small><h2>{ar ? 'Authenticator App / TOTP' : 'Authenticator App / TOTP'}</h2><p>{ar ? 'استخدم Google Authenticator أو Microsoft Authenticator أو 1Password أو أي تطبيق TOTP متوافق.' : 'Use Google Authenticator, Microsoft Authenticator, 1Password, or any compatible TOTP app.'}</p></div></div>
    <div className="individual-security-summary-line"><span>{ar ? 'حالة الجلسة الحالية' : 'Current session assurance'}</span><strong className={aal?.currentLevel==='aal2'?'good':''}>{aal?.currentLevel==='aal2' ? 'AAL2' : 'AAL1'}</strong></div>
    {verified.length ? <div className="individual-security-factor-list">{verified.map(f=><article key={f.id}><span><Smartphone/></span><div><strong>{f.friendly_name || (ar ? 'تطبيق المصادقة' : 'Authenticator app')}</strong><small>{ar ? `أضيف: ${formatDateTime(f.created_at,'ar')}` : `Added: ${formatDateTime(f.created_at,'en')}`}</small></div><button type="button" onClick={()=>{setRemoveId(f.id);setRemoveCode('');}}><Trash2/>{ar ? 'إزالة' : 'Remove'}</button></article>)}</div> : <div className="individual-security-empty"><ShieldEllipsis/><strong>{ar ? 'التحقق بخطوتين غير مفعّل' : 'Two-factor authentication is off'}</strong><p>{ar ? 'إضافة تطبيق مصادقة ترفع حماية الحساب بعد كلمة المرور.' : 'Adding an authenticator app protects the account after the password step.'}</p></div>}
    {!enrollment && <button type="button" className="individual-security-primary" onClick={startEnrollment} disabled={!!busy}><ShieldEllipsis/>{busy==='enroll'?(ar?'جاري التجهيز…':'Preparing…'):(ar?'إضافة تطبيق مصادقة':'Add authenticator app')}</button>}
    {enrollment && <form className="individual-security-enroll" onSubmit={verifyEnrollment}>
      <div className="individual-security-qr">{enrollment.totp?.qr_code ? <img src={enrollment.totp.qr_code} alt={ar?'رمز QR لتطبيق المصادقة':'Authenticator QR code'}/> : <ShieldEllipsis/>}</div>
      <div><strong>{ar ? 'امسح QR ثم أدخل الرمز' : 'Scan the QR, then enter the code'}</strong><p>{ar ? 'بعد المسح، اكتب الرمز الذي يظهر في تطبيق المصادقة لتأكيد الربط.' : 'After scanning, enter the code shown in your authenticator app to confirm enrollment.'}</p>{enrollment.totp?.secret && <div className="individual-security-secret"><code>{enrollment.totp.secret}</code><button type="button" onClick={()=>navigator.clipboard?.writeText(enrollment.totp.secret)}><Copy/></button></div>}<input dir="ltr" inputMode="numeric" autoComplete="one-time-code" value={verifyCode} onChange={e=>setVerifyCode(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="000000"/><div className="individual-security-form-actions"><button type="button" onClick={cancelEnrollment}>{ar?'إلغاء':'Cancel'}</button><button className="primary" disabled={busy==='verify' || verifyCode.length<6}>{busy==='verify'?<LoaderCircle className="spin"/>:<Check/>}{ar?'تأكيد التفعيل':'Verify & enable'}</button></div></div>
    </form>}
    {removeId && <form className="individual-security-remove-factor" onSubmit={removeFactor}><CircleAlert/><div><strong>{ar ? 'تأكيد إزالة عامل التحقق' : 'Confirm factor removal'}</strong><p>{ar ? 'أدخل الرمز الحالي من تطبيق المصادقة. هذا يثبت أنك تملك العامل قبل حذفه.' : 'Enter the current authenticator code to prove possession before removal.'}</p><input dir="ltr" inputMode="numeric" autoComplete="one-time-code" value={removeCode} onChange={e=>setRemoveCode(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="000000"/><div className="individual-security-form-actions"><button type="button" onClick={()=>setRemoveId('')}>{ar?'تراجع':'Cancel'}</button><button className="danger" disabled={busy===`remove-${removeId}` || removeCode.length<6}>{ar?'إزالة العامل':'Remove factor'}</button></div></div></form>}
    <p className="individual-security-note">{ar ? 'مهم: بعد تفعيل 2FA، شاشة تسجيل الدخول في بلقيس تطلب رمز المصادقة عندما تكون الجلسة عند AAL1 وتحتاج الارتفاع إلى AAL2.' : 'Important: once 2FA is enabled, Balqees sign-in asks for the authenticator code whenever an AAL1 session needs to be upgraded to AAL2.'}</p>
  </section>;
}

function SessionsPanel({ ar, lang, session, onSignOut, onNotice, logEvent }) {
  const [busy, setBusy] = useState('');
  async function others() {
    setBusy('others');
    const { error } = await supabase.auth.signOut({ scope:'others' });
    setBusy('');
    if (error) return onNotice('error', safeError(error, ar));
    await logEvent('other_sessions_signed_out');
    onNotice('success', ar ? 'تم تسجيل الخروج من جميع الأجهزة الأخرى.' : 'Signed out all other devices.');
  }
  async function global() {
    setBusy('global');
    await logEvent('all_sessions_signed_out');
    const { error } = await supabase.auth.signOut({ scope:'global' });
    setBusy('');
    if (error) return onNotice('error', safeError(error, ar));
  }
  return <section className="individual-security-panel">
    <div className="individual-security-panel-heading"><span><Laptop/></span><div><small>{ar ? 'الأجهزة والجلسات' : 'DEVICES & SESSIONS'}</small><h2>{ar ? 'تحكم في جلسات الدخول' : 'Control your sign-in sessions'}</h2><p>{ar ? 'نعرض فقط معلومات نستطيع التحقق منها. لن نخترع موقعًا أو قائمة أجهزة لا يعيدها لنا Backend.' : 'Only verified information is shown. We do not invent locations or device lists that the backend does not provide.'}</p></div></div>
    <article className="individual-security-current-device"><span><Laptop/></span><div><small>{ar ? 'هذا الجهاز' : 'THIS DEVICE'}</small><strong>{browserLabel()}</strong><p>{ar ? `آخر تسجيل دخول للحساب: ${formatDateTime(session?.user?.last_sign_in_at,lang)}` : `Last account sign-in: ${formatDateTime(session?.user?.last_sign_in_at,lang)}`}</p></div><b>{ar ? 'نشط الآن' : 'Active now'}</b></article>
    <div className="individual-security-session-actions">
      <button type="button" onClick={others} disabled={!!busy}><LogOut/>{busy==='others'?(ar?'جاري الإنهاء…':'Signing out…'):(ar?'تسجيل الخروج من الأجهزة الأخرى':'Sign out other devices')}</button>
      <button type="button" onClick={onSignOut} disabled={!!busy}><LogOut/>{ar?'تسجيل الخروج من هذا الجهاز':'Sign out this device'}</button>
      <button className="danger" type="button" onClick={global} disabled={!!busy}><Trash2/>{busy==='global'?(ar?'جاري الإنهاء…':'Signing out…'):(ar?'تسجيل الخروج من جميع الأجهزة':'Sign out everywhere')}</button>
    </div>
    <div className="individual-security-note"><ShieldCheck/>{ar ? 'Supabase يسمح بإنهاء الجلسة الحالية أو الجلسات الأخرى أو جميع الجلسات. عرض قائمة تفصيلية لكل جهاز يحتاج سجل جلسات Backend مستقل، لذلك لا نظهر بيانات غير موثوقة.' : 'Supabase can end the local session, other sessions, or all sessions. A trustworthy per-device list requires a dedicated backend session log, so unverified device data is not shown.'}</div>
  </section>;
}

function PrivacyPanel({ ar, uid, preferences, hasPreferenceRow, setPreferences, setHasPreferenceRow, onNotice, refreshEvents, logEvent }) {
  const [busy, setBusy] = useState('');
  const [requests, setRequests] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState('');

  async function loadRequests() {
    const { data } = await supabase.from('customer_privacy_requests').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(12);
    setRequests(data || []);
  }
  useEffect(()=>{ loadRequests(); },[uid]);

  async function savePatch(patch) {
    setBusy('privacy');
    const payload = { ...patch, updated_at:new Date().toISOString() };
    const request = hasPreferenceRow
      ? supabase.from('customer_preferences').update(payload).eq('user_id',uid).select('*').maybeSingle()
      : supabase.from('customer_preferences').insert({user_id:uid,...CUSTOMER_PREFERENCE_DEFAULTS,...patch}).select('*').maybeSingle();
    const { data, error } = await request;
    setBusy('');
    if (error) return onNotice('error', safeError(error,ar));
    setHasPreferenceRow(true);
    const next=normalizeCustomerPreferences(data||{...preferences,...patch});
    setPreferences(next); cacheCustomerPreferences(uid,next);
    onNotice('success', ar?'تم تحديث تفضيل الخصوصية.':'Privacy preference updated.');
  }

  async function clearPersonalization() {
    setBusy('clear');
    const { error } = await supabase.from('customer_interest_events').delete().eq('user_id',uid);
    setBusy('');
    if (error) return onNotice('error', safeError(error,ar));
    await logEvent('personalization_history_cleared');
    await refreshEvents();
    onNotice('success', ar?'تم مسح سجل التخصيص. الطلبات والمفضلة لم تتغير.':'Personalization history cleared. Orders and favorites were not changed.');
  }

  async function createRequest(type) {
    if (type==='account_deletion' && confirmDelete.trim() !== (ar?'حذف حسابي':'DELETE MY ACCOUNT')) return onNotice('error', ar?'اكتب «حذف حسابي» للتأكيد.':'Type “DELETE MY ACCOUNT” to confirm.');
    if (requests.some(r=>r.request_type===type && ['open','in_review'].includes(r.status))) return onNotice('error', ar?'يوجد طلب مفتوح من هذا النوع بالفعل.':'You already have an open request of this type.');
    setBusy(type);
    const { error } = await supabase.from('customer_privacy_requests').insert({user_id:uid,request_type:type});
    setBusy('');
    if (error) return onNotice('error', safeError(error,ar));
    await logEvent('privacy_request_created',{request_type:type});
    setConfirmDelete(''); await loadRequests(); await refreshEvents();
    onNotice('success', ar?'تم تسجيل طلبك وسيظهر هنا حتى تتم مراجعته.':'Your request was recorded and will remain visible here while it is reviewed.');
  }

  return <section className="individual-security-panel">
    <div className="individual-security-panel-heading"><span><Database/></span><div><small>{ar ? 'الخصوصية والبيانات' : 'PRIVACY & DATA'}</small><h2>{ar ? 'بياناتك تحت سيطرتك' : 'Your data stays under your control'}</h2><p>{ar ? 'نفرق بين تشغيل الحساب الضروري وبين التخصيص والتسويق. إيقاف التخصيص لا يمس الطلبات أو المفضلة أو العناوين.' : 'Essential account operation is separate from personalization and marketing. Turning personalization off does not delete orders, favorites, or addresses.'}</p></div></div>
    <div className="individual-security-privacy-grid">
      <article><span><Fingerprint/></span><div><strong>{ar?'تخصيص تجربة المتجر':'Store personalization'}</strong><p>{ar?'يستخدم البحث والتصفح والمفضلة والسلة والمشتريات لترتيب الاقتراحات فقط.':'Uses search, browsing, favorites, cart and purchases only to rank recommendations.'}</p></div><button type="button" className={`individual-security-toggle ${preferences.personalized_recommendations?'on':''}`} onClick={()=>savePatch({personalized_recommendations:!preferences.personalized_recommendations})} disabled={busy==='privacy'}><span/></button></article>
      <article><span><MapPin/></span><div><strong>{ar?'الوصول إلى الموقع':'Location access'}</strong><p>{ar?'الموقع يُطلب فقط عند اختيار «استخدم موقعي». لا يعمل GPS في الخلفية.':'Location is requested only when you choose “Use my location”. GPS is not used in the background.'}</p></div><b>{ar?'عند الطلب فقط':'Only when requested'}</b></article>
    </div>
    <button type="button" className="individual-security-secondary" onClick={clearPersonalization} disabled={busy==='clear'}><RefreshCw className={busy==='clear'?'spin':''}/>{ar?'مسح سجل التخصيص':'Clear personalization history'}</button>

    <div className="individual-security-data-actions"><h3>{ar?'بياناتي وخصوصيتي':'My data & privacy'}</h3><p>{ar?'الطلبات التالية تُسجل كطلبات موثقة للمراجعة، ولا تُنفّذ كحذف فوري من المتصفح.':'These actions create documented requests for review; the browser never performs an irreversible deletion immediately.'}</p><div>
      <button type="button" onClick={()=>createRequest('data_export')} disabled={!!busy}><Database/>{ar?'طلب نسخة من بياناتي':'Request a copy of my data'}</button>
      <Link to="/account/profile"><UserRound/>{ar?'تصحيح بياناتي':'Correct my data'}</Link>
    </div></div>

    <div className="individual-security-danger-zone"><div><Trash2/><span><strong>{ar?'طلب حذف الحساب':'Request account deletion'}</strong><p>{ar?'لا نحذف الحساب فورًا لأن بعض الطلبات والسجلات قد يلزم الاحتفاظ بها. الطلب يذهب للمراجعة أولًا.':'The account is not deleted instantly because some order records may need to be retained. The request is reviewed first.'}</p></span></div><input value={confirmDelete} onChange={e=>setConfirmDelete(e.target.value)} placeholder={ar?'اكتب: حذف حسابي':'Type: DELETE MY ACCOUNT'}/><button type="button" onClick={()=>createRequest('account_deletion')} disabled={busy==='account_deletion'}>{busy==='account_deletion'?<LoaderCircle className="spin"/>:<Trash2/>}{ar?'إرسال طلب الحذف':'Submit deletion request'}</button></div>

    {requests.length>0 && <div className="individual-security-requests"><h3>{ar?'طلبات الخصوصية':'Privacy requests'}</h3>{requests.map(r=><article key={r.id}><span>{r.request_type==='data_export'?(ar?'نسخة من البيانات':'Data copy'):(ar?'حذف الحساب':'Account deletion')}</span><small>{formatDateTime(r.created_at,ar?'ar':'en')}</small><b className={r.status}>{r.status==='open'?(ar?'قيد الانتظار':'Open'):r.status==='in_review'?(ar?'قيد المراجعة':'In review'):r.status==='completed'?(ar?'مكتمل':'Completed'):(ar?'مغلق':'Closed')}</b></article>)}</div>}
  </section>;
}

export default function IndividualSecurityPrivacy({ lang, session, onSignOut }) {
  const ar = lang === 'ar';
  const location = useLocation();
  const navigate = useNavigate();
  const Arrow = ar ? ChevronLeft : ChevronRight;
  const uid = session?.user?.id;
  const cart = useBalqeesCart(uid || null);
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(normalizeCustomerPreferences());
  const [hasPreferenceRow, setHasPreferenceRow] = useState(false);
  const [factors, setFactors] = useState({totp:[],phone:[]});
  const [aal, setAal] = useState({currentLevel:'aal1',nextLevel:'aal1'});
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);

  const section = useMemo(()=>{
    const part = location.pathname.replace(/^\/account\/settings\/security\/?/,'').split('/')[0];
    return ['password','two-factor','sessions','privacy','passkeys'].includes(part) ? part : 'overview';
  },[location.pathname]);

  const fullName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || (ar?'عميل بلقيس':'Balqees client');
  const firstName = fullName.trim().split(/\s+/)[0];
  const verifiedTotp = (factors?.totp||[]).filter(x=>x.status==='verified');

  function flash(type,text){ setNotice({type,text}); window.setTimeout(()=>setNotice(null),4200); }

  async function loadSecurity(silent=false){
    if(!supabase||!uid)return;
    silent?setRefreshing(true):setLoading(true);
    const [p,pref,factorResult,aalResult,eventResult]=await Promise.all([
      supabase.from('customer_profiles').select('full_name').eq('id',uid).maybeSingle(),
      supabase.from('customer_preferences').select('*').eq('user_id',uid).maybeSingle(),
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.from('customer_security_events').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(12),
    ]);
    setProfile(p.data||null);
    setHasPreferenceRow(!!pref.data);
    setPreferences(normalizeCustomerPreferences(pref.data||{}));
    if(!factorResult.error)setFactors(factorResult.data||{totp:[],phone:[]});
    if(!aalResult.error)setAal(aalResult.data||{currentLevel:'aal1',nextLevel:'aal1'});
    if(!eventResult.error)setEvents(eventResult.data||[]);
    setLoading(false);setRefreshing(false);
  }

  async function refreshEvents(){
    const {data}=await supabase.from('customer_security_events').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(12);
    setEvents(data||[]);
  }

  async function logEvent(eventType,metadata={}){
    if(!supabase||!uid)return;
    await supabase.from('customer_security_events').insert({ user_id:uid, event_type:eventType, details:metadata });
    await refreshEvents();
  }

  useEffect(()=>{document.body.classList.add('individual-account-active');return()=>document.body.classList.remove('individual-account-active');},[]);
  useEffect(()=>{loadSecurity();},[uid]);

  if(loading)return <div className="individual-page"><div className="individual-center-state"><LoaderCircle className="spin"/><strong>{ar?'نجهز مركز الأمان والخصوصية…':'Preparing Security & Privacy…'}</strong></div></div>;

  const titles={
    overview:ar?'الأمان والخصوصية':'Security & Privacy',password:ar?'كلمة المرور':'Password',
    'two-factor':ar?'التحقق بخطوتين':'Two-factor authentication',sessions:ar?'الأجهزة والجلسات':'Devices & sessions',
    privacy:ar?'الخصوصية والبيانات':'Privacy & data',passkeys:'Passkeys',
  };

  return <div className="individual-page individual-settings-page individual-security-page" dir={ar?'rtl':'ltr'}>
    <header className="individual-topbar"><div className="individual-shell individual-topbar-inner">
      <Link to="/" className="individual-brand"><BrandMark/></Link>
      <div className="individual-topbar-center"><span>{titles[section]}</span><small>{ar?'الإعدادات · حساب فردي':'SETTINGS · INDIVIDUAL ACCOUNT'}</small></div>
      <div className="individual-top-actions"><button type="button" className="individual-icon-button" onClick={()=>navigate('/account/notifications')}><Bell size={19}/></button><button type="button" className="individual-icon-button" onClick={()=>navigate('/account/cart')}><ShoppingBag size={19}/>{cart.count>0&&<b>{Math.min(cart.count,99)}</b>}</button><button type="button" className="individual-profile-chip" onClick={()=>navigate('/account/profile')}><span>{fullName.slice(0,1).toUpperCase()}</span><div><small>{ar?'مرحبًا':'Welcome'}</small><strong>{firstName}</strong></div></button></div>
    </div></header>

    <main className="individual-shell individual-security-main">
      {notice&&<div className={`individual-inline-notice ${notice.type}`}>{notice.type==='success'?<CircleCheck/>:<CircleAlert/>}<span>{notice.text}</span></div>}
      <div className="individual-security-breadcrumb"><Link to="/account/settings">{ar?'الإعدادات':'Settings'}</Link><Arrow/><span>{ar?'الأمان والخصوصية':'Security & Privacy'}</span>{section!=='overview'&&<><Arrow/><b>{titles[section]}</b></>}</div>
      {section!=='overview'&&<BackButton ar={ar} onClick={()=>navigate('/account/settings/security')}/>} 

      {section==='overview'&&<>
        <section className="individual-security-hero"><div><span><ShieldCheck/>{ar?'مركز تابع للإعدادات':'SETTINGS SECURITY CENTER'}</span><h1>{ar?'أمانك وخصوصيتك، في مكان واحد':'Security and privacy, in one place'}</h1><p>{ar?'إجراءات حقيقية مرتبطة بالحساب، بدون درجات أمان وهمية أو أجهزة ومواقع مخترعة.':'Real account controls with no fake security scores, invented devices, or guessed locations.'}</p></div><button className="individual-refresh" type="button" onClick={()=>loadSecurity(true)} disabled={refreshing}><RefreshCw className={refreshing?'spin':''}/><span>{ar?'تحديث':'Refresh'}</span></button></section>
        <section className="individual-security-state-grid">
          <article><span><CircleCheck/></span><div><small>{ar?'البريد':'EMAIL'}</small><strong>{session?.user?.email_confirmed_at?(ar?'موثّق':'Verified'):(ar?'بانتظار التحقق':'Pending verification')}</strong><p>{session?.user?.email}</p></div></article>
          <article><span><KeyRound/></span><div><small>{ar?'كلمة المرور':'PASSWORD'}</small><strong>{ar?'إدارة آمنة':'Secure management'}</strong><p>{ar?'تغيير مع كلمة المرور الحالية':'Current-password verification'}</p></div></article>
          <article><span><ShieldEllipsis/></span><div><small>{ar?'2FA':'2FA'}</small><strong>{verifiedTotp.length?(ar?'مفعّل':'Enabled'):(ar?'غير مفعّل':'Not enabled')}</strong><p>{verifiedTotp.length?`${verifiedTotp.length} TOTP`:(ar?'اختياري ومُوصى به':'Optional and recommended')}</p></div></article>
          <article><span><Laptop/></span><div><small>{ar?'الجلسة الحالية':'CURRENT SESSION'}</small><strong>{aal?.currentLevel==='aal2'?'AAL2':'AAL1'}</strong><p>{browserLabel()}</p></div></article>
        </section>

        <section className="individual-security-grid">
          <SecurityTile icon={KeyRound} title={ar?'كلمة المرور':'Password'} description={ar?'تغيير كلمة المرور مع التحقق من الحالية، ثم إنهاء الجلسات الأخرى عند الحاجة.':'Change your password with current-password verification, then revoke other sessions if needed.'} status={ar?'فعّال':'Active'} statusTone="good" to="/account/settings/security/password"><Arrow/></SecurityTile>
          <SecurityTile icon={Fingerprint} title="Passkeys" description={ar?'مهيأة ضمن الخطة لكن التسجيل مؤجل حتى اعتماد الدومين النهائي لأن المفتاح يرتبط بالـRP ID.':'Prepared in the plan, but enrollment stays locked until the production domain/RP ID is final.'} status={ar?'بانتظار الدومين النهائي':'Waiting for final domain'} statusTone="warning" to="/account/settings/security/passkeys"><Arrow/></SecurityTile>
          <SecurityTile icon={ShieldEllipsis} title={ar?'التحقق بخطوتين':'Two-factor authentication'} description={ar?'Authenticator App / TOTP حقيقي عبر Supabase MFA.':'Real Authenticator App / TOTP through Supabase MFA.'} status={verifiedTotp.length?(ar?'مفعّل':'Enabled'):(ar?'اختياري':'Optional')} statusTone={verifiedTotp.length?'good':''} to="/account/settings/security/two-factor"><Arrow/></SecurityTile>
          <SecurityTile icon={Laptop} title={ar?'الأجهزة والجلسات':'Devices & sessions'} description={ar?'إنهاء هذه الجلسة أو الجلسات الأخرى أو جميع الجلسات بدون ادعاء قائمة أجهزة غير متاحة.':'Revoke this, other, or all sessions without pretending an unavailable device list exists.'} status={aal?.currentLevel?.toUpperCase()||'AAL1'} to="/account/settings/security/sessions"><Arrow/></SecurityTile>
          <SecurityTile icon={Database} title={ar?'بياناتي وخصوصيتي':'My data & privacy'} description={ar?'التخصيص، الموقع، نسخة البيانات وطلب حذف الحساب بشكل موثق.':'Personalization, location, data-copy requests, and documented account-deletion requests.'} to="/account/settings/security/privacy"><Arrow/></SecurityTile>
        </section>

        {events.length>0&&<section className="individual-security-activity"><div className="individual-security-section-title"><span><Activity/></span><div><small>{ar?'نشاط الحساب':'ACCOUNT ACTIVITY'}</small><h2>{ar?'آخر إجراءات الأمان المهمة':'Recent security actions'}</h2></div></div><div>{events.slice(0,6).map(e=><article key={e.id}><span><ShieldCheck/></span><div><strong>{e.event_type==='password_changed'?(ar?'تم تغيير كلمة المرور':'Password changed'):e.event_type==='mfa_enabled'?(ar?'تم تفعيل التحقق بخطوتين':'Two-factor authentication enabled'):e.event_type==='mfa_disabled'?(ar?'تم إلغاء عامل تحقق':'Two-factor factor removed'):e.event_type==='other_sessions_signed_out'?(ar?'تم إنهاء الجلسات الأخرى':'Other sessions signed out'):e.event_type==='personalization_history_cleared'?(ar?'تم مسح سجل التخصيص':'Personalization history cleared'):(ar?'إجراء أمني في الحساب':'Account security action')}</strong><small>{formatDateTime(e.created_at,lang)}</small></div></article>)}</div></section>}
      </>}

      {section==='password'&&<PasswordPanel ar={ar} lang={lang} session={session} onNotice={flash} logEvent={logEvent}/>} 
      {section==='two-factor'&&<MfaPanel ar={ar} factors={factors} aal={aal} refreshSecurity={()=>loadSecurity(true)} onNotice={flash} logEvent={logEvent}/>} 
      {section==='sessions'&&<SessionsPanel ar={ar} lang={lang} session={session} onSignOut={onSignOut} onNotice={flash} logEvent={logEvent}/>} 
      {section==='privacy'&&<PrivacyPanel ar={ar} uid={uid} preferences={preferences} hasPreferenceRow={hasPreferenceRow} setPreferences={setPreferences} setHasPreferenceRow={setHasPreferenceRow} onNotice={flash} refreshEvents={refreshEvents} logEvent={logEvent}/>} 
      {section==='passkeys'&&<section className="individual-security-panel individual-passkey-lock"><div className="individual-security-panel-heading"><span><Fingerprint/></span><div><small>PASSKEYS / WEBAUTHN</small><h2>{ar?'الدخول بالبصمة أو Face ID — بعد اعتماد الدومين':'Biometric / Face ID sign-in — after the final domain'}</h2><p>{ar?'مكتبة Supabase في المشروع تدعم Passkeys، لكن الميزة ما تزال Experimental والمفاتيح ترتبط تشفيريًا باسم النطاق RP ID. لذلك نمنع التسجيل الآن حتى لا نصنع مفاتيح تتعطل عند تغيير الدومين.':'This project’s Supabase client version supports Passkeys, but the feature remains experimental and credentials are cryptographically bound to the RP ID. Enrollment stays disabled until the production domain is final.'}</p></div></div><div className="individual-passkey-domain"><Fingerprint/><div><strong>{ar?'لم يتم فتح التسجيل بعد':'Enrollment is not open yet'}</strong><p>{ar?'بعد تثبيت الدومين النهائي نفعل Passkeys من Supabase Auth، نحدد RP ID وOrigins، ثم نفتح الإضافة وإعادة التسمية والحذف من هذه الشاشة نفسها.':'After the production domain is fixed, enable Passkeys in Supabase Auth, set the RP ID/origins, then this screen can expose add, rename and delete actions.'}</p></div></div></section>}
    </main>

    <nav className="individual-mobile-dock"><Link to="/account"><Home/><span>{ar?'الرئيسية':'Home'}</span></Link><Link to="/account/orders"><PackageOpen/><span>{ar?'طلباتي':'Orders'}</span></Link><Link to="/store"><Store/><span>{ar?'المتجر':'Store'}</span></Link><Link to="/account/favorites"><Heart/><span>{ar?'المفضلة':'Favorites'}</span></Link><Link className="active" to="/account/settings"><UserRound/><span>{ar?'حسابي':'Account'}</span></Link></nav>
  </div>;
}
