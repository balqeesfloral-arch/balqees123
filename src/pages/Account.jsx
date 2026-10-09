import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { safeQuoteReturn, safeAdminQuoteReturn } from '../lib/quoteRequests';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CircleCheck,
  Eye,
  EyeOff,
  Inbox,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { copy } from '../lib/content';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { cleanEmail } from '../lib/authValidation';
import IndividualAccountHome from '../individual/IndividualAccountHome';
import IndividualOrders, { IndividualOrderDetails } from '../individual/IndividualOrders';
import IndividualCart from '../individual/IndividualCart';
import IndividualFavorites from '../individual/IndividualFavorites';
import IndividualAddresses from '../individual/IndividualAddresses';
import IndividualOccasions from '../individual/IndividualOccasions';
import IndividualSupport from '../individual/IndividualSupport';
import IndividualProfile from '../individual/IndividualProfile';
import IndividualSettings from '../individual/IndividualSettings';
import IndividualSecurityPrivacy from '../individual/IndividualSecurityPrivacy';
import IndividualNotifications from '../individual/IndividualNotifications';
import IndividualDocuments from '../individual/IndividualDocuments';
import IndividualPortalLayout from '../individual/IndividualPortalLayout';

function errorMessage(error, ar) {
  const message = (error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return ar ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Incorrect email or password.';
  if (message.includes('email not confirmed')) return ar ? 'فعّل بريدك الإلكتروني أولًا ثم حاول تسجيل الدخول.' : 'Please verify your email before signing in.';
  if (message.includes('rate limit')) return ar ? 'تم إرسال طلبات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.' : 'Too many requests were sent. Please wait a moment and try again.';
  return ar ? 'تعذر إتمام العملية الآن. حاول مرة أخرى بعد قليل.' : 'We could not complete that request. Please try again shortly.';
}

function maskEmail(value = '') {
  const email = cleanEmail(value);
  const [name = '', domain = ''] = email.split('@');
  if (!domain) return email;
  const visible = name.slice(0, Math.min(3, name.length));
  const stars = Math.max(3, Math.min(7, name.length - visible.length));
  return `${visible}${'•'.repeat(stars)}@${domain}`;
}

function passwordScore(value = '') {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value) || value.length >= 12) score += 1;
  return score;
}

export default function Account({ lang, setLang }) {
  const t = copy[lang], ar = lang === 'ar';
  const navigate = useNavigate();
  const location = useLocation();
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [session, setSession] = useState(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [mfaChecking, setMfaChecking] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactors, setMfaFactors] = useState([]);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMessage, setMfaMessage] = useState('');
  const [mfaCheckError, setMfaCheckError] = useState('');
  const [accountProfile, setAccountProfile] = useState(null);
  const [accountAccessStatus, setAccountAccessStatus] = useState('active');
  const [accountContextLoading, setAccountContextLoading] = useState(false);
  const [accountContextError, setAccountContextError] = useState('');

  const strength = useMemo(() => passwordScore(password), [password]);

  const authBaseUrl = useMemo(() => {
    const configured = (import.meta.env.VITE_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
    return configured || window.location.origin;
  }, []);
  const recoveryRedirectUrl = useMemo(() => `${authBaseUrl}/account/reset-password?recovery=1`, [authBaseUrl]);

  useLayoutEffect(() => {
    if (!location.state?.fromIndividualPortal) return undefined;
    document.body.classList.add('individual-account-active');
    return () => {
      if (!window.location.pathname.startsWith('/account')) document.body.classList.remove('individual-account-active');
    };
  }, [location.state?.fromIndividualPortal]);

  const resetFormNotice = nextMode => {
    setMessage(null);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setNeedsVerification(false);
    setResetSent(false);
    setResetCooldown(0);
    setMode(nextMode);
  };

  async function assessMfa(nextSession) {
    setMfaCheckError('');
    if (!supabase || !nextSession?.user) { setMfaRequired(false); setMfaFactors([]); return false; }
    const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      setMfaRequired(false); setMfaFactors([]);
      setMfaCheckError(ar ? 'تعذر التحقق من مستوى حماية الجلسة. لن نفتح الحساب قبل اكتمال فحص الأمان.' : 'We could not verify the session security level. Access stays locked until the security check succeeds.');
      return null;
    }
    const required = aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2';
    if (!required) { setMfaRequired(false); setMfaFactors([]); return false; }
    const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) {
      setMfaRequired(false); setMfaFactors([]);
      setMfaCheckError(ar ? 'تعذر تحميل عامل التحقق لهذا الحساب. أعد المحاولة أو سجل الخروج.' : 'We could not load this account’s second factor. Retry the security check or sign out.');
      return null;
    }
    const verifiedTotp = (factorData?.totp || []).filter(f => f.status === 'verified').map(f => ({ ...f, _balqeesFactorType: 'totp' }));
    const verifiedPhone = (factorData?.phone || []).filter(f => f.status === 'verified').map(f => ({ ...f, _balqeesFactorType: 'phone' }));
    const verified = [...verifiedTotp, ...verifiedPhone];
    if (!verified.length) {
      setMfaRequired(false); setMfaFactors([]);
      setMfaCheckError(ar ? 'الجلسة تطلب تحققًا إضافيًا لكن لم نجد عاملًا موثقًا يمكن استخدامه. سجل الخروج ثم أعد المحاولة.' : 'This session requires another factor, but no verified factor is available. Sign out and try again.');
      return null;
    }
    if (!verifiedTotp.length) {
      setMfaRequired(false); setMfaFactors(verified);
      setMfaCheckError(ar ? 'هذا الحساب يستخدم عامل تحقق لا تدعمه واجهة بلقيس الحالية. لم يتم تجاوز الحماية؛ سجل الخروج وتواصل مع الإدارة.' : 'This account uses a factor that the current Balqees interface does not support. Protection was not bypassed; sign out and contact support.');
      return null;
    }
    setMfaFactors(verifiedTotp);
    setMfaRequired(true);
    return true;
  }

  useEffect(() => {
    if (!resetCooldown) return undefined;
    const timer = window.setInterval(() => {
      setResetCooldown(value => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetCooldown]);

  useEffect(() => {
    if (!supabase) { setMfaChecking(false); return undefined; }
    let mounted = true;
    let authTimer;
    const recoveryRequested = new URLSearchParams(window.location.search).get('recovery') === '1';

    const enterRecovery = nextSession => {
      if (!mounted) return;
      setSession(nextSession);
      setMode('recovery');
      setMfaRequired(false);
      setMfaChecking(false);
      setResetSent(false);
      setMessage({ type: 'success', text: ar ? 'تم التحقق من رابط الاستعادة. اختر كلمة مرور جديدة لحسابك.' : 'Recovery link verified. Choose a new password for your account.' });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);

      if (event === 'PASSWORD_RECOVERY' || (recoveryRequested && nextSession && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN'))) {
        enterRecovery(nextSession);
        return;
      }

      setMfaChecking(true);
      window.clearTimeout(authTimer);
      authTimer = window.setTimeout(() => {
        Promise.resolve(assessMfa(nextSession)).finally(() => { if (mounted) setMfaChecking(false); });
      }, 0);
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (recoveryRequested && data.session) {
        enterRecovery(data.session);
        return;
      }
      setSession(data.session);
      await assessMfa(data.session);
      if (mounted) setMfaChecking(false);
    })();

    return () => { mounted = false; window.clearTimeout(authTimer); subscription.unsubscribe(); };
  }, [ar]);

  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setAccountProfile(null);
      setAccountAccessStatus('active');
      setAccountContextError('');
      setAccountContextLoading(false);
      return undefined;
    }
    let active = true;
    setAccountContextLoading(true);
    setAccountContextError('');
    Promise.all([
      supabase.from('customer_profiles').select('id,account_type,role,full_name,email,establishment_display_name').eq('id', session.user.id).maybeSingle(),
      supabase.from('admin_user_state').select('status').eq('user_id', session.user.id).maybeSingle(),
    ]).then(([profileResult, accessResult]) => {
      if (!active) return;
      if ((profileResult.error || !profileResult.data) && session.user?.app_metadata?.role !== 'admin') {
        setAccountProfile(null);
        setAccountContextError(ar ? 'تعذر التحقق من نوع الحساب. لن نفتح البوابة قبل اكتمال التحقق.' : 'We could not verify the account type. Portal access stays locked until verification succeeds.');
      } else {
        setAccountProfile(profileResult.data || null);
      }
      if (accessResult.error) {
        setAccountContextError(ar ? 'تعذر التحقق من حالة الحساب. أعد المحاولة.' : 'We could not verify the account access state. Please retry.');
      } else {
        setAccountAccessStatus(accessResult.data?.status || 'active');
      }
      setAccountContextLoading(false);
    }).catch(() => {
      if (!active) return;
      setAccountContextError(ar ? 'تعذر التحقق من حالة الحساب. أعد المحاولة.' : 'We could not verify the account context. Please retry.');
      setAccountContextLoading(false);
    });
    return () => { active = false; };
  }, [session?.user?.id, ar]);

  useEffect(() => {
    if (!supabase || !session?.user?.id || !setLang) return;
    let active = true;
    supabase.from('customer_preferences').select('preferred_language').eq('user_id', session.user.id).maybeSingle().then(({ data }) => {
      if (!active) return;
      if (data?.preferred_language === 'ar' || data?.preferred_language === 'en') setLang(data.preferred_language);
    });
    return () => { active = false; };
  }, [session?.user?.id, setLang]);

  async function login(e) {
    e.preventDefault();
    setNeedsVerification(false);
    if (!supabase) {
      setMessage({ type: 'error', text: ar ? 'يلزم ربط إعدادات Supabase لتفعيل الدخول على النسخة المنشورة.' : 'Connect the Supabase settings to enable sign-in on the deployed site.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail(email), password });
    if (!error && data?.session) {
      setMfaChecking(true);
      const needsMfa = await assessMfa(data.session);
      setMfaChecking(false);
      if (needsMfa === null) { setLoading(false); return; }
      if (needsMfa) { setLoading(false); setMfaCode(''); setMfaMessage(''); return; }
    }
    if (!error && data?.user?.app_metadata?.role === 'admin') {
      setLoading(false);
      const next=new URLSearchParams(location.search).get('next');
      if(!safeQuoteReturn(next)) navigate(safeAdminQuoteReturn(next)||'/admin', { replace: true });
      return;
    }
    if (!error && data?.user?.id) {
      const [accessResult, profileResult] = await Promise.all([
        supabase.from('admin_user_state').select('status').eq('user_id', data.user.id).maybeSingle(),
        supabase.from('customer_profiles').select('account_type').eq('id', data.user.id).maybeSingle(),
      ]);
      const accessState = accessResult.data;
      if (accessState?.status === 'blocked' || accessState?.status === 'suspended') {
        await supabase.auth.signOut({ scope: 'global' });
        setLoading(false);
        setMessage({
          type: 'error',
          text: accessState.status === 'blocked'
            ? (ar ? 'تم إيقاف الوصول لهذا الحساب. تواصل مع إدارة بلقيس إذا كنت تعتقد أن ذلك تم بالخطأ.' : 'Access to this account has been blocked. Contact Balqees administration if you believe this is a mistake.')
            : (ar ? 'تم تعليق هذا الحساب مؤقتًا. تواصل مع إدارة بلقيس للمساعدة.' : 'This account is temporarily suspended. Contact Balqees administration for help.'),
        });
        return;
      }
      if (profileResult.data?.account_type === 'company') {
        setLoading(false);
        if(!safeQuoteReturn(new URLSearchParams(location.search).get('next'))) navigate('/portal', { replace: true });
        return;
      }
    }
    setLoading(false);
    if (error) {
      if ((error.message || '').toLowerCase().includes('email not confirmed')) setNeedsVerification(true);
      setMessage({ type: 'error', text: errorMessage(error, ar) });
    }
  }

  async function resendVerification() {
    if (!supabase || !email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: cleanEmail(email), options: { emailRedirectTo: `${authBaseUrl}/account` } });
    setLoading(false);
    setMessage(error ? { type: 'error', text: errorMessage(error, ar) } : { type: 'success', text: ar ? 'أعدنا إرسال رسالة التفعيل. تحقق من بريدك.' : 'Verification email sent again. Check your inbox.' });
  }

  async function requestPasswordReset() {
    if (!supabase) {
      setMessage({ type: 'error', text: ar ? 'يلزم ربط إعدادات Supabase لتفعيل الاستعادة.' : 'Connect Supabase to enable recovery.' });
      return false;
    }
    if (!email.trim()) {
      setMessage({ type: 'error', text: ar ? 'اكتب بريدك الإلكتروني أولًا.' : 'Enter your email first.' });
      return false;
    }

    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail(email), {
      redirectTo: recoveryRedirectUrl,
    });
    setLoading(false);

    if (error) {
      setMessage({ type: 'error', text: errorMessage(error, ar) });
      return false;
    }

    setResetSent(true);
    setResetCooldown(30);
    return true;
  }

  async function sendReset(e) {
    e.preventDefault();
    await requestPasswordReset();
  }

  async function resendReset() {
    if (loading || resetCooldown > 0) return;
    await requestPasswordReset();
  }

  async function updatePassword(e) {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 8) return setMessage({ type: 'error', text: ar ? 'كلمة المرور يجب ألا تقل عن 8 أحرف.' : 'Password must be at least 8 characters.' });
    if (password !== confirmPassword) return setMessage({ type: 'error', text: ar ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.' });
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setMessage({ type: 'error', text: errorMessage(error, ar) });
    else {
      await supabase.auth.signOut({ scope: 'local' });
      setSession(null);
      setMessage({ type: 'success', text: ar ? 'تم تحديث كلمة المرور بنجاح. سجل الدخول الآن بكلمة المرور الجديدة.' : 'Password updated successfully. Sign in now with your new password.' });
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      navigate('/account', { replace: true });
    }
  }

  async function verifyMfa(e) {
    e.preventDefault();
    const factor = mfaFactors.find(f => f._balqeesFactorType === 'totp' || f.factor_type === 'totp' || f.type === 'totp');
    if (!factor || !/^\d{6,8}$/.test(mfaCode.trim())) {
      setMfaMessage(ar ? 'اكتب رمز المصادقة الصحيح.' : 'Enter a valid authenticator code.');
      return;
    }
    setMfaBusy(true); setMfaMessage('');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: mfaCode.trim() });
    setMfaBusy(false);
    if (error) { setMfaMessage(ar ? 'الرمز غير صحيح أو انتهت صلاحيته. حاول برمز جديد.' : 'The code is invalid or expired. Try a fresh code.'); return; }
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setMfaRequired(false); setMfaFactors([]); setMfaCode('');
  }

  const metadata = session?.user?.user_metadata || {};
  const appMetadata = session?.user?.app_metadata || {};
  const isAdmin = appMetadata.role === 'admin';
  const accountType = accountProfile?.account_type || metadata.account_type || null;
  const displayName = accountProfile?.full_name || metadata.full_name || session?.user?.email?.split('@')[0] || '';
  const organization = accountProfile?.establishment_display_name || metadata.establishment_display_name || metadata.organization?.legal_name || '';

  useEffect(() => {
    if (!session || mfaChecking || mfaRequired || mfaCheckError || accountContextLoading || accountContextError) return;
    if (accountAccessStatus !== 'active') return;
    const next = new URLSearchParams(location.search).get('next');
    const quoteReturn=safeQuoteReturn(next);
    if(quoteReturn) return navigate(quoteReturn,{replace:true});
    const adminQuoteReturn=safeAdminQuoteReturn(next);
    if ((next === '/admin'||adminQuoteReturn) && session.user?.app_metadata?.role === 'admin') return navigate(adminQuoteReturn||'/admin', { replace: true });
    if (next === '/portal' && accountType === 'company') return navigate('/portal', { replace: true });
    if (next === '/checkout' && accountType === 'individual') return navigate('/checkout', { replace: true });
    if (next === '/store' || (next && /^\/store\/[A-Za-z0-9._~%-]+$/.test(next))) return navigate(next, { replace: true });
  }, [session, mfaChecking, mfaRequired, mfaCheckError, accountContextLoading, accountContextError, accountAccessStatus, accountType, location.search, navigate]);

  async function logout() {
    if (!supabase) return;
    setLoading(true);
    await supabase.auth.signOut({ scope: 'local' });
    setLoading(false);
    setMode('login');
    setMessage(null);
  }

  if (!session && mode !== 'recovery' && mfaChecking && isSupabaseConfigured) return <div className="individual-page individual-auth-resolving"><div className="individual-center-state"><RefreshCw className="spin"/><strong>{ar ? 'جاري فتح حسابك…' : 'Opening your account…'}</strong></div></div>;
  if (session && mode !== 'recovery' && mfaChecking) return <div className="individual-page"><div className="individual-center-state"><RefreshCw className="spin"/><strong>{ar ? 'نتحقق من مستوى حماية الجلسة…' : 'Checking session security…'}</strong></div></div>;
  if (session && mode !== 'recovery' && !mfaRequired && !mfaCheckError && accountContextLoading) return <div className="individual-page"><div className="individual-center-state"><RefreshCw className="spin"/><strong>{ar ? 'نتحقق من نوع الحساب وصلاحية الوصول…' : 'Verifying account type and access…'}</strong></div></div>;

  if (session && mode !== 'recovery' && mfaCheckError) return <section className="page-section shell account-page"><div className="login-shell auth-shell-v2"><div className="login-intro auth-intro-v2"><span className="eyebrow">BALQEES SECURITY GATE</span><h1>{ar ? 'الحماية لم تكتمل بعد.' : 'Security check incomplete.'}</h1><p>{ar ? 'لا نسمح بتجاوز خطوة الحماية عند تعذر التحقق منها.' : 'We do not bypass account protection when the security check cannot be completed.'}</p></div><div className="login-card auth-card-v2 login-only-card"><div className="auth-form compact-auth-form"><div className="recovery-mark"><ShieldCheck size={25}/></div><div className="auth-card-heading recovery-heading"><span>{ar ? 'بوابة أمان مغلقة' : 'SECURITY GATE LOCKED'}</span><h2>{ar ? 'تعذر إكمال فحص الأمان' : 'Security check could not finish'}</h2><p>{mfaCheckError}</p></div><button className="btn primary wide auth-submit" type="button" onClick={async()=>{setMfaChecking(true); await assessMfa(session); setMfaChecking(false);}}>{ar ? 'إعادة فحص الأمان' : 'Retry security check'}<RefreshCw size={17}/></button><button className="auth-back" type="button" onClick={logout}><LogOut size={16}/>{ar ? 'تسجيل الخروج' : 'Sign out'}</button></div></div></div></section>;

  if (session && mode !== 'recovery' && !mfaRequired && accountContextError) return <section className="page-section shell account-page"><div className="login-shell auth-shell-v2"><div className="login-card auth-card-v2 login-only-card"><div className="auth-form compact-auth-form"><div className="recovery-mark"><ShieldCheck size={25}/></div><div className="auth-card-heading recovery-heading"><span>{ar ? 'تحقق الحساب' : 'ACCOUNT VERIFICATION'}</span><h2>{ar ? 'تعذر التحقق من الحساب' : 'Account verification failed'}</h2><p>{accountContextError}</p></div><button className="btn primary wide auth-submit" type="button" onClick={() => window.location.reload()}><RefreshCw size={17}/>{ar ? 'إعادة المحاولة' : 'Retry'}</button><button className="auth-back" type="button" onClick={logout}><LogOut size={16}/>{ar ? 'تسجيل الخروج' : 'Sign out'}</button></div></div></div></section>;

  if (session && mode !== 'recovery' && !mfaRequired && ['blocked','suspended'].includes(accountAccessStatus)) return <section className="page-section shell account-page"><div className="login-shell auth-shell-v2"><div className="login-card auth-card-v2 login-only-card"><div className="auth-form compact-auth-form"><div className="recovery-mark"><ShieldCheck size={25}/></div><div className="auth-card-heading recovery-heading"><span>{ar ? 'حالة الحساب' : 'ACCOUNT ACCESS'}</span><h2>{accountAccessStatus === 'blocked' ? (ar ? 'تم إيقاف الوصول للحساب' : 'Account access is blocked') : (ar ? 'الحساب معلّق مؤقتًا' : 'Account is temporarily suspended')}</h2><p>{ar ? 'تواصل مع إدارة بلقيس إذا كنت تعتقد أن هذه الحالة غير صحيحة.' : 'Contact Balqees administration if you believe this status is incorrect.'}</p></div><button className="auth-back" type="button" onClick={logout}><LogOut size={16}/>{ar ? 'تسجيل الخروج' : 'Sign out'}</button></div></div></div></section>;

  if (session && mode !== 'recovery' && mfaRequired) return <section className="page-section shell account-page"><div className="login-shell auth-shell-v2"><div className="login-intro auth-intro-v2"><span className="eyebrow">BALQEES TWO-FACTOR AUTHENTICATION</span><h1>{ar ? 'خطوة أمان إضافية.' : 'One more security step.'}</h1><p>{ar ? 'حسابك محمي بتطبيق مصادقة. أدخل الرمز الحالي لإكمال تسجيل الدخول.' : 'Your account is protected by an authenticator app. Enter the current code to finish signing in.'}</p><div className="portal-types auth-feature-list"><span><ShieldCheck/> {ar ? 'عامل ثانٍ حقيقي' : 'Real second factor'}</span><span><LockKeyhole/> AAL2</span></div></div><div className="login-card auth-card-v2 login-only-card"><form className="auth-form compact-auth-form" onSubmit={verifyMfa}><div className="recovery-mark"><ShieldCheck size={25}/></div><div className="auth-card-heading recovery-heading"><span>{ar ? 'التحقق بخطوتين' : 'TWO-FACTOR AUTHENTICATION'}</span><h2>{ar ? 'رمز تطبيق المصادقة' : 'Authenticator code'}</h2><p>{ar ? 'افتح تطبيق المصادقة المرتبط ببلقيس واكتب الرمز الظاهر الآن.' : 'Open the authenticator app linked to Balqees and enter the code shown now.'}</p></div><label>{ar ? 'رمز التحقق' : 'Verification code'}<span><KeyRound size={18}/><input dir="ltr" inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={e=>setMfaCode(e.target.value.replace(/\D/g,'').slice(0,8))} required placeholder="000000"/></span></label>{mfaMessage&&<div className="auth-message error"><ShieldCheck size={17}/><span>{mfaMessage}</span></div>}<button className="btn primary wide auth-submit" type="submit" disabled={mfaBusy||mfaCode.length<6}>{mfaBusy?(ar?'جاري التحقق…':'Verifying…'):(ar?'تأكيد والدخول':'Verify & continue')}<Check size={17}/></button><button className="auth-back" type="button" onClick={logout}><LogOut size={16}/>{ar ? 'تسجيل الخروج' : 'Sign out'}</button></form></div></div></section>;

  if (session && mode !== 'recovery' && !isAdmin && accountType === 'individual') {
    const orderDetailMatch = location.pathname.match(/^\/account\/orders\/([^/]+)\/?$/);
    let individualPage = <IndividualAccountHome lang={lang} session={session} onSignOut={logout}/>;
    if (orderDetailMatch) individualPage = <IndividualOrderDetails lang={lang} session={session} onSignOut={logout} orderId={decodeURIComponent(orderDetailMatch[1])}/>;
    else if (/^\/account\/orders\/?$/.test(location.pathname)) individualPage = <IndividualOrders lang={lang} session={session} onSignOut={logout}/>;
    else if (/^\/account\/cart\/?$/.test(location.pathname)) individualPage = <IndividualCart lang={lang} session={session}/>;
    else if (/^\/account\/favorites\/?$/.test(location.pathname)) individualPage = <IndividualFavorites lang={lang} session={session}/>;
    else if (/^\/account\/addresses\/?$/.test(location.pathname)) individualPage = <IndividualAddresses lang={lang} session={session}/>;
    else if (/^\/account\/occasions\/?$/.test(location.pathname)) individualPage = <IndividualOccasions lang={lang} session={session}/>;
    else if (/^\/account\/support\/?$/.test(location.pathname)) individualPage = <IndividualSupport lang={lang} session={session}/>;
    else if (/^\/account\/profile\/?$/.test(location.pathname)) individualPage = <IndividualProfile lang={lang} setLang={setLang} session={session} onSignOut={logout}/>;
    else if (/^\/account\/settings\/security(?:\/[^/]+)?\/?$/.test(location.pathname)) individualPage = <IndividualSecurityPrivacy lang={lang} session={session} onSignOut={logout}/>;
    else if (/^\/account\/settings\/?$/.test(location.pathname)) individualPage = <IndividualSettings lang={lang} setLang={setLang} session={session} onSignOut={logout}/>;
    else if (/^\/account\/notifications\/?$/.test(location.pathname)) individualPage = <IndividualNotifications lang={lang} session={session}/>;
    else if (/^\/account\/documents\/?$/.test(location.pathname)) individualPage = <IndividualDocuments lang={lang} session={session}/>;
    return <IndividualPortalLayout lang={lang} session={session} onSignOut={logout}>{individualPage}</IndividualPortalLayout>;
  }

  return <section className="page-section shell account-page">
    <div className="login-shell auth-shell-v2">
      <div className="login-intro auth-intro-v2">
        <span className="eyebrow">BALQEES CLIENT PORTAL</span>
        <h1>{ar ? 'تسجيل دخول بلقيس' : 'Balqees Sign in'}</h1>
        <p>{ar ? 'حسابك، طلباتك وخدماتك.' : 'Your account, orders and services.'}</p>
        <div className="auth-intro-signature"><Sparkles size={16}/><span>{ar ? 'بلقيس الورد · مكة المكرمة' : 'BALQEES FLORAL · MAKKAH'}</span></div>
      </div>

      {session && mode !== 'recovery' ? <div className="login-card session-card auth-session-card">
        <div className="session-icon"><CircleCheck size={38}/></div>
        <div className="auth-session-title-row">
          <span className="auth-overline">{isAdmin ? (ar ? 'إدارة النظام' : 'SYSTEM ADMINISTRATION') : (ar ? 'الحساب متصل' : 'ACCOUNT CONNECTED')}</span>
          {isAdmin && <span className="admin-account-badge"><ShieldCheck size={13}/>{ar ? 'مدير النظام' : 'System admin'}</span>}
        </div>
        <h2>{ar ? `أهلًا، ${displayName}` : `Welcome, ${displayName}`}</h2><p className="auth-session-email">{session.user.email}</p>
        <div className="auth-account-facts"><div><span>{ar ? 'نوع الحساب' : 'Account type'}</span><strong>{isAdmin ? (ar ? 'إدارة النظام' : 'Administration') : accountType === 'company' ? (ar ? 'منشأة' : 'Organization') : (ar ? 'فردي' : 'Individual')}</strong></div><div><span>{ar ? 'اسم المستخدم' : 'Username'}</span><strong>{metadata.username || '—'}</strong></div>{organization && <div><span>{ar ? 'المنشأة' : 'Organization'}</span><strong>{organization}</strong></div>}<div><span>{ar ? 'البريد' : 'Email'}</span><strong className="verified-line"><BadgeCheck size={15}/>{session.user.email_confirmed_at ? (ar ? 'مؤكد' : 'Verified') : (ar ? 'بانتظار التأكيد' : 'Pending')}</strong></div></div>
        <p className="auth-session-note">{isAdmin ? (ar ? 'حساب إدارة النظام.' : 'System administration account.') : (ar ? 'حسابك جاهز.' : 'Your account is ready.')}</p>
        {isAdmin && <button className="btn primary wide" type="button" onClick={() => navigate('/admin')}><ShieldCheck size={17}/>{ar ? 'فتح لوحة الإدارة' : 'Open admin portal'}</button>}
        {!isAdmin && accountType === 'company' && <button className="btn primary wide" type="button" onClick={() => navigate('/portal')}><Building2 size={17}/>{ar ? 'فتح بوابة المنشأة' : 'Open organization portal'}</button>}
        <button className="btn ghost wide" onClick={logout} disabled={loading}><LogOut size={17}/>{ar ? 'تسجيل الخروج' : 'Sign out'}</button>
      </div> : <div className="login-card auth-card-v2 login-only-card">
        {mode === 'login' && <form className="auth-form" onSubmit={login}>
          <div className="auth-card-heading"><span>{ar ? 'مرحبًا بعودتك' : 'WELCOME BACK'}</span><h2>{ar ? 'تسجيل الدخول' : 'Sign in'}</h2><p>{ar ? 'استخدم البريد وكلمة المرور المرتبطين بحسابك.' : 'Use the email and password linked to your account.'}</p></div>
          <label>{t.email}<span><Mail size={18}/><input value={email} onChange={e => setEmail(e.target.value)} type="email" required autoComplete="email" inputMode="email" placeholder="name@company.com"/></span></label>
          <label>{t.password}<span><LockKeyhole size={18}/><input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="••••••••"/><button className="password-toggle" type="button" onClick={() => setShowPassword(v => !v)} aria-label={ar ? 'إظهار أو إخفاء كلمة المرور' : 'Show or hide password'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
          <div className="login-row"><button type="button" className="link-button" onClick={() => resetFormNotice('forgot')}>{t.forgot}</button></div>
          {message && <div className={`auth-message ${message.type}`}>{message.type === 'success' ? <CircleCheck size={17}/> : <ShieldCheck size={17}/>}<span>{message.text}</span></div>}
          {needsVerification && <button className="auth-resend" type="button" onClick={resendVerification} disabled={loading}><Mail size={15}/>{ar ? 'إعادة إرسال رسالة التفعيل' : 'Resend verification email'}</button>}
          <button className="btn primary wide auth-submit" type="submit" disabled={loading}>{loading ? (ar ? 'جاري الدخول…' : 'Signing in…') : (ar ? 'دخول آمن' : 'Secure sign in')}<Arrow size={17}/></button>
          <div className="login-create-panel"><div><strong>{ar ? 'أول مرة مع بلقيس؟' : 'New to Balqees?'}</strong><span>{ar ? 'أنشئ حساب منشأة أو حسابًا فرديًا بخطوات منظمة.' : 'Create an organization or individual account in guided steps.'}</span></div><Link to="/signup" className="btn ghost">{ar ? 'إنشاء حساب' : 'Create account'}<Arrow size={16}/></Link></div>
        </form>}

        {mode === 'forgot' && !resetSent && <form className="auth-form compact-auth-form" onSubmit={sendReset}>
          <button className="auth-back" type="button" onClick={() => resetFormNotice('login')}><ArrowLeft size={16}/>{ar ? 'العودة لتسجيل الدخول' : 'Back to sign in'}</button>
          <div className="recovery-mark"><KeyRound size={25}/></div>
          <div className="auth-card-heading recovery-heading"><span>{ar ? 'استعادة آمنة للحساب' : 'SECURE ACCOUNT RECOVERY'}</span><h2>{ar ? 'نسيت كلمة المرور؟' : 'Forgot your password?'}</h2><p>{ar ? 'أدخل البريد المرتبط بحسابك. سنرسل لك رابطًا آمنًا، ومن خلاله تختار كلمة مرور جديدة مباشرة.' : 'Enter the email linked to your account. We will send a secure link so you can choose a new password directly.'}</p></div>
          <div className="recovery-steps"><span><i>1</i>{ar ? 'اكتب بريد الحساب' : 'Enter account email'}</span><span><i>2</i>{ar ? 'افتح رسالة بلقيس' : 'Open the Balqees email'}</span><span><i>3</i>{ar ? 'اختر كلمة مرور جديدة' : 'Choose a new password'}</span></div>
          <label>{t.email}<span><Mail size={18}/><input value={email} onChange={e => setEmail(e.target.value)} type="email" required autoComplete="email" inputMode="email" placeholder="name@company.com"/></span></label>
          {message && <div className={`auth-message ${message.type}`}><ShieldCheck size={17}/><span>{message.text}</span></div>}
          <button className="btn primary wide auth-submit" type="submit" disabled={loading}>{loading ? (ar ? 'جاري إرسال الرابط…' : 'Sending recovery link…') : (ar ? 'أرسل رابط الاستعادة' : 'Send recovery link')}<Mail size={17}/></button>
          <p className="recovery-privacy"><ShieldCheck size={14}/>{ar ? 'لأمان الحساب لن نوضح ما إذا كان البريد مسجلًا لدينا أم لا.' : 'For account security, we do not reveal whether an email is registered.'}</p>
        </form>}

        {mode === 'forgot' && resetSent && <div className="auth-form compact-auth-form recovery-sent-card">
          <button className="auth-back" type="button" onClick={() => resetFormNotice('login')}><ArrowLeft size={16}/>{ar ? 'العودة لتسجيل الدخول' : 'Back to sign in'}</button>
          <div className="recovery-success-orb"><Inbox size={30}/><span><Check size={14}/></span></div>
          <div className="auth-card-heading recovery-heading"><span>{ar ? 'تم إرسال الطلب' : 'RECOVERY REQUEST SENT'}</span><h2>{ar ? 'راجع بريدك الإلكتروني' : 'Check your inbox'}</h2><p>{ar ? <>إذا كان الحساب موجودًا، أرسلنا رابط الاستعادة إلى <b className="recovery-email">{maskEmail(email)}</b>. افتح الرسالة واضغط الرابط ثم اختر كلمة مرور جديدة.</> : <>If the account exists, a recovery link was sent to <b className="recovery-email">{maskEmail(email)}</b>. Open the message, follow the link, then choose a new password.</>}</p></div>
          <div className="recovery-help-box"><Mail size={18}/><div><strong>{ar ? 'لم تجد الرسالة؟' : 'Can’t find the email?'}</strong><span>{ar ? 'انتظر لحظات، ثم افحص البريد غير الهام أو Spam. تأكد أيضًا أن البريد المكتوب هو نفس بريد الحساب.' : 'Wait a moment, then check Junk or Spam. Also confirm you entered the same email used for the account.'}</span></div></div>
          <div className="recovery-actions">
            <a className="btn primary" href="mailto:"><Mail size={16}/>{ar ? 'فتح تطبيق البريد' : 'Open mail app'}</a>
            <button className="btn ghost" type="button" onClick={resendReset} disabled={loading || resetCooldown > 0}><RefreshCw size={16}/>{resetCooldown > 0 ? (ar ? `إعادة الإرسال بعد ${resetCooldown}ث` : `Resend in ${resetCooldown}s`) : (ar ? 'إعادة إرسال الرابط' : 'Resend link')}</button>
          </div>
          <button className="recovery-use-other" type="button" onClick={() => { setResetSent(false); setMessage(null); setResetCooldown(0); }}>{ar ? 'استخدام بريد إلكتروني مختلف' : 'Use a different email'}</button>
        </div>}

        {mode === 'recovery' && <form className="auth-form compact-auth-form" onSubmit={updatePassword}>
          <div className="recovery-mark"><LockKeyhole size={25}/></div>
          <div className="auth-card-heading recovery-heading"><span>{ar ? 'رابط الاستعادة صالح' : 'RECOVERY LINK VERIFIED'}</span><h2>{ar ? 'أنشئ كلمة مرور جديدة' : 'Create a new password'}</h2><p>{ar ? 'اختر كلمة مرور مختلفة عن السابقة ويسهل عليك تذكرها دون أن تكون سهلة التخمين.' : 'Choose a password that is different from the old one and difficult to guess.'}</p></div>
          <label>{ar ? 'كلمة المرور الجديدة' : 'New password'}<span><LockKeyhole size={18}/><input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password" placeholder="••••••••"/><button className="password-toggle" type="button" onClick={() => setShowPassword(v => !v)} aria-label={ar ? 'إظهار أو إخفاء كلمة المرور' : 'Show or hide password'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
          <div className="recovery-strength"><div>{[1,2,3,4].map(n => <span key={n} className={n <= strength ? 'filled' : ''}/>)}</div><small>{strength <= 1 ? (ar ? 'ضعيفة' : 'Weak') : strength === 2 ? (ar ? 'متوسطة' : 'Fair') : strength === 3 ? (ar ? 'قوية' : 'Strong') : (ar ? 'قوية جدًا' : 'Very strong')}</small></div>
          <label>{ar ? 'تأكيد كلمة المرور' : 'Confirm password'}<span><KeyRound size={18}/><input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password" placeholder="••••••••"/></span></label>
          {confirmPassword && password !== confirmPassword && <div className="password-match-hint error">{ar ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.'}</div>}
          {confirmPassword && password === confirmPassword && <div className="password-match-hint success"><Check size={13}/>{ar ? 'كلمتا المرور متطابقتان.' : 'Passwords match.'}</div>}
          {message && <div className={`auth-message ${message.type}`}><CircleCheck size={17}/><span>{message.text}</span></div>}
          <button className="btn primary wide auth-submit" type="submit" disabled={loading || password !== confirmPassword}>{loading ? (ar ? 'جاري الحفظ…' : 'Saving…') : (ar ? 'حفظ كلمة المرور الجديدة' : 'Save new password')}<Check size={17}/></button>
        </form>}
        {!isSupabaseConfigured && <div className="auth-config-note"><ShieldCheck size={16}/><span>{ar ? 'لتعمل الحسابات على الاستضافة أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في Vercel.' : 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel to activate live accounts.'}</span></div>}
      </div>}
    </div>
  </section>;
}
