import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

function passwordScore(value = '') {
  let score = 0;
  if (value.length >= 10) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value) || value.length >= 14) score += 1;
  return score;
}

function recoveryError(error, ar) {
  const message = (error?.message || '').toLowerCase();
  if (message.includes('expired') || message.includes('invalid') || message.includes('token')) {
    return ar
      ? 'رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا من صفحة تسجيل الدخول.'
      : 'This recovery link is invalid or has expired. Request a new link from the sign-in page.';
  }
  if (message.includes('same password') || message.includes('different')) {
    return ar
      ? 'اختر كلمة مرور جديدة مختلفة عن كلمة المرور السابقة.'
      : 'Choose a new password that is different from your previous password.';
  }
  if (message.includes('weak') || message.includes('password')) {
    return ar
      ? 'تعذر اعتماد كلمة المرور. استخدم كلمة أقوى تحتوي على أحرف وأرقام.'
      : 'That password could not be accepted. Use a stronger password with letters and numbers.';
  }
  return ar
    ? 'تعذر إكمال الاستعادة الآن. اطلب رابطًا جديدًا وحاول مرة أخرى.'
    : 'We could not complete account recovery. Request a new link and try again.';
}

export default function PasswordReset({ lang, setLang }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const tokenHash = params.get('token_hash');
  const recoveryType = params.get('type');
  const recoveryFlag = params.get('recovery') === '1';
  const authCode = params.get('code');

  const [status, setStatus] = useState('verifying');
  const [sessionEmail, setSessionEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const strength = useMemo(() => passwordScore(password), [password]);

  const requirements = {
    length: password.length >= 10,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
    match: Boolean(confirmation) && password === confirmation,
  };
  const passwordReady = requirements.length && requirements.letter && requirements.number && requirements.match;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = ar ? 'تعيين كلمة مرور جديدة | بلقيس الورد' : 'Set a new password | Balqees Floral';
    return () => { document.title = previousTitle; };
  }, [ar]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setStatus('error');
      setMessage(ar ? 'خدمة استعادة الحساب غير مهيأة على هذه النسخة.' : 'Account recovery is not configured on this deployment.');
      return undefined;
    }

    let active = true;
    let settleTimer;

    const markReady = session => {
      if (!active || !session?.user) return false;
      setSessionEmail(session.user.email || '');
      setStatus('ready');
      setMessage('');
      return true;
    };

    const markInvalid = error => {
      if (!active) return;
      setStatus('error');
      setMessage(recoveryError(error, ar));
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') {
        markReady(nextSession);
        return;
      }
      if ((recoveryFlag || authCode) && nextSession && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        markReady(nextSession);
      }
    });

    (async () => {
      try {
        if (tokenHash) {
          if (recoveryType !== 'recovery') {
            markInvalid(new Error('Invalid recovery type'));
            return;
          }
          const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
          if (error || !data?.session) {
            markInvalid(error || new Error('Invalid recovery token'));
            return;
          }
          markReady(data.session);
          window.history.replaceState({}, '', '/account/reset-password');
          return;
        }

        const { data: current } = await supabase.auth.getSession();
        if (markReady((recoveryFlag || authCode || window.location.hash) ? current.session : null)) {
          window.history.replaceState({}, '', '/account/reset-password');
          return;
        }

        if (authCode) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);
          if (!error && data?.session) {
            markReady(data.session);
            window.history.replaceState({}, '', '/account/reset-password');
            return;
          }
          const { data: fallback } = await supabase.auth.getSession();
          if (markReady(fallback.session)) {
            window.history.replaceState({}, '', '/account/reset-password');
            return;
          }
          markInvalid(error || new Error('Invalid recovery code'));
          return;
        }

        settleTimer = window.setTimeout(async () => {
          const { data } = await supabase.auth.getSession();
          if (!markReady((recoveryFlag || window.location.hash) ? data.session : null)) {
            markInvalid(new Error('Missing recovery session'));
          }
        }, 1200);
      } catch (error) {
        markInvalid(error);
      }
    })();

    return () => {
      active = false;
      window.clearTimeout(settleTimer);
      subscription.unsubscribe();
    };
  }, [ar, authCode, recoveryFlag, recoveryType, tokenHash]);

  async function savePassword(event) {
    event.preventDefault();
    if (!supabase || !passwordReady || busy) return;
    setBusy(true);
    setMessage('');

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      setMessage(recoveryError(error, ar));
      return;
    }

    await supabase.auth.signOut({ scope: 'global' }).catch(() => {});
    setBusy(false);
    setStatus('success');
    setPassword('');
    setConfirmation('');
  }

  const strengthLabel = strength <= 1
    ? (ar ? 'أساسية' : 'Basic')
    : strength === 2
      ? (ar ? 'جيدة' : 'Good')
      : strength === 3
        ? (ar ? 'قوية' : 'Strong')
        : (ar ? 'ممتازة' : 'Excellent');

  return (
    <main className="balqees-recovery-page" dir={ar ? 'rtl' : 'ltr'}>
      <div className="recovery-ambient recovery-ambient-one" aria-hidden="true"/>
      <div className="recovery-ambient recovery-ambient-two" aria-hidden="true"/>
      <div className="recovery-geometry" aria-hidden="true"/>

      <header className="recovery-topbar">
        <Link to="/" className="recovery-brand-link" aria-label={ar ? 'العودة إلى بلقيس الورد' : 'Back to Balqees Floral'}>
          <BrandMark/>
        </Link>
        <button className="recovery-language" type="button" onClick={() => setLang?.(ar ? 'en' : 'ar')}>
          <Globe2 size={16}/>
          <span>{ar ? 'EN' : 'عربي'}</span>
        </button>
      </header>

      <section className="recovery-stage">
        <aside className="recovery-story">
          <div className="recovery-story-mark"><Leaf/><span>ACCOUNT CARE</span></div>
          <h1>{ar ? <>استعادة آمنة،<br/><em>بهوية بلقيس.</em></> : <>Secure recovery,<br/><em>the Balqees way.</em></>}</h1>
          <p>
            {ar
              ? 'مساحة خاصة ومشفّرة لإعادة تعيين كلمة مرور حسابك. لن نطلب منك كلمة المرور القديمة، ولن نشارك بيانات حسابك في هذه الخطوة.'
              : 'A private, encrypted space to reset your account password. We will never ask for your old password or expose your account data during recovery.'}
          </p>
          <div className="recovery-trust-list">
            <span><ShieldCheck/>{ar ? 'رابط استعادة أحادي الاستخدام' : 'Single-use recovery link'}</span>
            <span><LockKeyhole/>{ar ? 'تحديث مباشر وآمن للحساب' : 'Secure account update'}</span>
            <span><Sparkles/>{ar ? 'تجربة بلقيس الرسمية' : 'Official Balqees experience'}</span>
          </div>
          <div className="recovery-signature">
            <span>BALQEES FLORAL</span>
            <small>{ar ? 'مكة المكرمة · عناية رقمية بمعايير ضيافة' : 'MAKKAH · DIGITAL CARE WITH HOSPITALITY STANDARDS'}</small>
          </div>
        </aside>

        <div className="recovery-card-wrap">
          <div className="recovery-card">
            <div className="recovery-card-crown" aria-hidden="true"><span/><i/><span/></div>

            {status === 'verifying' && (
              <div className="recovery-state recovery-verifying">
                <div className="recovery-orbit"><LoaderCircle/><span/><i/></div>
                <span className="recovery-overline">{ar ? 'بوابة الأمان' : 'SECURITY GATE'}</span>
                <h2>{ar ? 'نتحقق من رابط الاستعادة' : 'Verifying your recovery link'}</h2>
                <p>{ar ? 'لحظات قصيرة للتحقق من صلاحية الرابط وحماية الحساب.' : 'A quick security check is validating this link and protecting your account.'}</p>
                <div className="recovery-progress"><span/></div>
              </div>
            )}

            {status === 'error' && (
              <div className="recovery-state">
                <div className="recovery-state-icon error"><TriangleAlert/></div>
                <span className="recovery-overline">{ar ? 'تعذر التحقق' : 'LINK VERIFICATION'}</span>
                <h2>{ar ? 'هذا الرابط لم يعد صالحًا' : 'This link can no longer be used'}</h2>
                <p>{message}</p>
                <div className="recovery-action-stack">
                  <Link className="recovery-primary-button" to="/account">
                    <KeyRound/>
                    <span>{ar ? 'طلب رابط استعادة جديد' : 'Request a new recovery link'}</span>
                    <Arrow size={17}/>
                  </Link>
                  <Link className="recovery-secondary-link" to="/">{ar ? 'العودة إلى موقع بلقيس' : 'Back to Balqees Floral'}</Link>
                </div>
              </div>
            )}

            {status === 'ready' && (
              <form className="recovery-form" onSubmit={savePassword}>
                <div className="recovery-heading">
                  <div className="recovery-state-icon"><LockKeyhole/></div>
                  <div>
                    <span className="recovery-overline">{ar ? 'رابط الاستعادة صالح' : 'RECOVERY LINK VERIFIED'}</span>
                    <h2>{ar ? 'أنشئ كلمة مرور جديدة' : 'Create a new password'}</h2>
                  </div>
                </div>

                {sessionEmail && (
                  <div className="recovery-account-chip">
                    <ShieldCheck/>
                    <span>{ar ? 'الحساب الذي سيتم تحديثه' : 'Account being updated'}</span>
                    <b dir="ltr">{sessionEmail}</b>
                  </div>
                )}

                <label className="recovery-field">
                  <span>{ar ? 'كلمة المرور الجديدة' : 'New password'}</span>
                  <div>
                    <LockKeyhole size={18}/>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={10}
                      required
                      placeholder="••••••••••"
                    />
                    <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={ar ? 'إظهار أو إخفاء كلمة المرور' : 'Show or hide password'}>
                      {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                    </button>
                  </div>
                </label>

                <div className="recovery-strength">
                  <div>{[1,2,3,4].map(item => <span key={item} className={item <= strength ? 'active' : ''}/>)}</div>
                  <b>{strengthLabel}</b>
                </div>

                <label className="recovery-field">
                  <span>{ar ? 'تأكيد كلمة المرور' : 'Confirm password'}</span>
                  <div>
                    <KeyRound size={18}/>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmation}
                      onChange={event => setConfirmation(event.target.value)}
                      autoComplete="new-password"
                      minLength={10}
                      required
                      placeholder="••••••••••"
                    />
                  </div>
                </label>

                <div className="recovery-requirements">
                  <span className={requirements.length ? 'done' : ''}><i>{requirements.length && <Check/>}</i>{ar ? '10 أحرف على الأقل' : 'At least 10 characters'}</span>
                  <span className={requirements.letter ? 'done' : ''}><i>{requirements.letter && <Check/>}</i>{ar ? 'يتضمن أحرفًا' : 'Includes letters'}</span>
                  <span className={requirements.number ? 'done' : ''}><i>{requirements.number && <Check/>}</i>{ar ? 'يتضمن رقمًا' : 'Includes a number'}</span>
                  <span className={requirements.match ? 'done' : ''}><i>{requirements.match && <Check/>}</i>{ar ? 'كلمتا المرور متطابقتان' : 'Passwords match'}</span>
                </div>

                {message && <div className="recovery-inline-error"><TriangleAlert/>{message}</div>}

                <button className="recovery-primary-button recovery-submit" type="submit" disabled={!passwordReady || busy}>
                  {busy ? <LoaderCircle className="spin"/> : <ShieldCheck/>}
                  <span>{busy ? (ar ? 'جاري حماية الحساب…' : 'Securing your account…') : (ar ? 'اعتماد كلمة المرور الجديدة' : 'Set new password')}</span>
                  {!busy && <Arrow size={17}/>}
                </button>

                <p className="recovery-security-note">
                  <ShieldCheck/>
                  {ar ? 'بعد الحفظ سيتم إنهاء الجلسات الحالية كإجراء أمني.' : 'After saving, current sessions are signed out as a security measure.'}
                </p>
              </form>
            )}

            {status === 'success' && (
              <div className="recovery-state recovery-success">
                <div className="recovery-success-seal"><CheckCircle2/><span><Sparkles/></span></div>
                <span className="recovery-overline">{ar ? 'تم تأمين الحساب' : 'ACCOUNT SECURED'}</span>
                <h2>{ar ? 'تم تحديث كلمة المرور بنجاح' : 'Your password has been updated'}</h2>
                <p>{ar ? 'يمكنك الآن تسجيل الدخول إلى حساب بلقيس باستخدام كلمة المرور الجديدة.' : 'You can now sign in to your Balqees account with your new password.'}</p>
                <button className="recovery-primary-button" type="button" onClick={() => navigate('/account', { replace: true })}>
                  <KeyRound/>
                  <span>{ar ? 'الانتقال إلى تسجيل الدخول' : 'Continue to sign in'}</span>
                  <Arrow size={17}/>
                </button>
                <div className="recovery-success-foot"><ShieldCheck/>{ar ? 'اكتملت العملية عبر بوابة بلقيس الآمنة' : 'Completed through the secure Balqees gateway'}</div>
              </div>
            )}
          </div>

          <div className="recovery-card-footer">
            <span><ShieldCheck/>{ar ? 'اتصال آمن' : 'Secure connection'}</span>
            <span>© {new Date().getFullYear()} BALQEES FLORAL</span>
          </div>
        </div>
      </section>
    </main>
  );
}
