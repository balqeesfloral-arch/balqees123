import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { LoaderCircle, LockKeyhole, ShieldAlert, ShieldCheck } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import AdminLayout from './AdminLayout';

export default function AdminGate({ lang, setLang }) {
  const ar = lang === 'ar';
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [gateChecking, setGateChecking] = useState(false);
  const [gateError, setGateError] = useState('');
  const [accessStatus, setAccessStatus] = useState('active');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState(null);
  const [verifiedAdmin, setVerifiedAdmin] = useState(false);

  useEffect(() => {
    if (!supabase) { setSessionLoading(false); return undefined; }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
      setSessionLoading(false);
    }).catch(() => { if (mounted) { setGateError(ar ? 'تعذر قراءة جلسة الإدارة.' : 'Could not read the admin session.'); setSessionLoading(false); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession || null);
      setSessionLoading(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setGateChecking(false); setGateError(''); setAccessStatus('active'); setMfaRequired(false);
      return undefined;
    }
    let active = true;
    setVerifiedToken(null);
    setGateChecking(true); setGateError('');
    Promise.all([
      supabase.from('admin_user_state').select('status').eq('user_id', session.user.id).maybeSingle(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.getUser(),
    ]).then(([accessResult, aalResult, userResult]) => {
      if (!active) return;
      if (userResult.error || userResult.data?.user?.id !== session.user.id) setGateError(ar ? 'تعذر التحقق من جلسة المدير.' : 'Could not verify the administrator session.');
      setVerifiedAdmin(userResult.data?.user?.app_metadata?.role === 'admin');
      if (accessResult.error) setGateError(ar ? 'تعذر التحقق من حالة حساب المدير.' : 'Could not verify the administrator account state.');
      else setAccessStatus(accessResult.data?.status || 'active');
      if (aalResult.error) setGateError(ar ? 'تعذر التحقق من مستوى حماية جلسة المدير.' : 'Could not verify administrator session security.');
      else setMfaRequired((aalResult.data?.nextLevel === 'aal2' || userResult.data?.user?.factors?.some(factor => factor.status === 'verified')) && aalResult.data?.currentLevel !== 'aal2');
      setGateChecking(false);
      setVerifiedToken(session.access_token);
    }).catch(() => {
      if (!active) return;
      setGateError(ar ? 'تعذر إكمال فحص صلاحية الإدارة.' : 'Could not complete the administrator access check.');
      setGateChecking(false);
      setVerifiedToken(session.access_token);
    });
    return () => { active = false; };
  }, [session?.user?.id, session?.access_token, ar]);

  if (sessionLoading || gateChecking || (session && verifiedToken !== session.access_token)) return <div className="admin-gate-screen"><LoaderCircle className="spin" size={30}/><strong>{ar ? 'جاري التحقق من صلاحية الإدارة والحماية…' : 'Verifying admin access and security…'}</strong></div>;

  if (!isSupabaseConfigured) return <div className="admin-gate-screen"><ShieldAlert size={34}/><h1>{ar ? 'يلزم ربط Supabase' : 'Supabase connection required'}</h1><p>{ar ? 'لوحة الإدارة تعمل على قاعدة البيانات الحقيقية ولا تستخدم بيانات تجريبية.' : 'The admin portal runs on the live database and does not use mock data.'}</p></div>;

  if (!session) return <div className="admin-gate-screen admin-gate-card"><span className="admin-gate-icon"><LockKeyhole size={28}/></span><small>BALQEES ADMIN</small><h1>{ar ? 'بوابة الإدارة محمية' : 'Admin portal protected'}</h1><p>{ar ? 'سجّل الدخول بحساب مدير النظام لفتح لوحة التحكم.' : 'Sign in with a system administrator account to continue.'}</p><Link className="admin-primary-button" to="/account?next=/admin"><ShieldCheck size={17}/>{ar ? 'تسجيل دخول المدير' : 'Admin sign in'}</Link></div>;

  if (gateError) return <div className="admin-gate-screen admin-gate-card"><span className="admin-gate-icon danger"><ShieldAlert size={28}/></span><small>FAIL-CLOSED ACCESS</small><h1>{ar ? 'تعذر التحقق من صلاحية الإدارة' : 'Admin verification failed'}</h1><p>{gateError}</p><Link className="admin-primary-button" to="/account?next=/admin">{ar ? 'العودة لبوابة الدخول' : 'Return to security gate'}</Link></div>;

  if (accessStatus === 'blocked' || accessStatus === 'suspended') return <div className="admin-gate-screen admin-gate-card"><span className="admin-gate-icon danger"><ShieldAlert size={28}/></span><small>ACCOUNT ACCESS</small><h1>{accessStatus === 'blocked' ? (ar ? 'حساب الإدارة موقوف' : 'Administrator account blocked') : (ar ? 'حساب الإدارة معلّق' : 'Administrator account suspended')}</h1><p>{ar ? 'لن تُفتح لوحة الإدارة حتى تعاد حالة الحساب إلى نشط.' : 'The admin portal stays locked until the account is active again.'}</p></div>;

  if (!verifiedAdmin || session.user?.app_metadata?.role !== 'admin') return <div className="admin-gate-screen admin-gate-card"><span className="admin-gate-icon danger"><ShieldAlert size={28}/></span><small>ACCESS CONTROL</small><h1>{ar ? 'هذا الحساب ليس مدير نظام' : 'This account is not an administrator'}</h1><p>{ar ? 'الحساب مسجل بنجاح، لكنه لا يحمل صلاحية admin في Supabase.' : 'The account is signed in, but it does not have the admin role in Supabase.'}</p><Link className="admin-secondary-button" to="/account">{ar ? 'العودة للحساب' : 'Back to account'}</Link></div>;

  if (mfaRequired) return <Navigate to="/account?next=/admin" replace/>;

  return <AdminLayout lang={lang} setLang={setLang} session={session}/>;
}
