import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Building2, LoaderCircle, LockKeyhole, ShieldAlert } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { ClientPortalProvider } from './ClientPortalContext';
import ClientPortalLayout from './ClientPortalLayout';

export default function ClientPortalGate({ lang, setLang }) {
  const ar = lang === 'ar';
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [gateChecking, setGateChecking] = useState(false);
  const [gateError, setGateError] = useState('');
  const [accessStatus, setAccessStatus] = useState('active');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [hasActiveMembership, setHasActiveMembership] = useState(false);

  useEffect(() => {
    if (!supabase) { setSessionLoading(false); return undefined; }
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      setSession(data.session || null);
      setSessionLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!live) return;
      setSession(next || null);
      setSessionLoading(false);
    });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setProfile(null); setGateError(''); setAccessStatus('active'); setMfaRequired(false); setHasActiveMembership(false); setGateChecking(false);
      return undefined;
    }
    let live = true;
    setGateChecking(true); setGateError('');
    Promise.all([
      supabase.from('customer_profiles').select('account_type,role,full_name,establishment_display_name').eq('id', session.user.id).maybeSingle(),
      supabase.from('admin_user_state').select('status').eq('user_id', session.user.id).maybeSingle(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.from('organization_members').select('organization_id').eq('user_id', session.user.id).eq('status','active').limit(1).maybeSingle(),
    ]).then(([profileResult, accessResult, aalResult, membershipResult]) => {
      if (!live) return;
      if (profileResult.error || !profileResult.data) {
        setProfile(null);
        setGateError(ar ? 'تعذر التحقق من نوع الحساب. لن نفتح بوابة المنشأة قبل اكتمال التحقق.' : 'We could not verify the account type. The organization portal stays locked.');
      } else setProfile(profileResult.data);
      if (accessResult.error) setGateError(ar ? 'تعذر التحقق من حالة الحساب.' : 'Could not verify the account access state.');
      else setAccessStatus(accessResult.data?.status || 'active');
      if (aalResult.error) setGateError(ar ? 'تعذر التحقق من مستوى حماية الجلسة.' : 'Could not verify session security.');
      else setMfaRequired(aalResult.data?.nextLevel === 'aal2' && aalResult.data?.currentLevel !== 'aal2');
      if (membershipResult.error) {
        setHasActiveMembership(false);
        if (profileResult.data?.account_type === 'company' && session.user?.app_metadata?.role !== 'admin') setGateError(ar ? 'تعذر التحقق من عضوية المنشأة.' : 'Could not verify the organization membership.');
      } else setHasActiveMembership(Boolean(membershipResult.data?.organization_id));
      setGateChecking(false);
    }).catch(() => {
      if (!live) return;
      setGateError(ar ? 'تعذر إكمال فحص بوابة المنشأة.' : 'Could not complete the organization portal check.');
      setGateChecking(false);
    });
    return () => { live = false; };
  }, [session?.user?.id, ar]);

  if (sessionLoading || gateChecking) return <div className="client-gate"><LoaderCircle className="spin"/><strong>{ar?'جاري فتح البوابة…':'Opening portal…'}</strong></div>;
  if (!isSupabaseConfigured) return <div className="client-gate card"><ShieldAlert/><h1>{ar?'يلزم ربط Supabase':'Supabase connection required'}</h1></div>;
  if (!session) return <div className="client-gate card"><LockKeyhole/><h1>{ar?'بوابة العملاء محمية':'Client portal protected'}</h1><p>{ar?'سجّل الدخول بحساب المنشأة للمتابعة.':'Sign in with your organization account to continue.'}</p><Link className="client-primary" to="/account?next=/portal">{ar?'تسجيل الدخول':'Sign in'}</Link></div>;
  if (gateError) return <div className="client-gate card"><ShieldAlert/><h1>{ar?'تعذر التحقق من الحساب':'Account verification failed'}</h1><p>{gateError}</p><Link className="client-primary" to="/account?next=/portal">{ar?'العودة لبوابة الدخول':'Return to security gate'}</Link></div>;
  if (accessStatus === 'blocked' || accessStatus === 'suspended') return <div className="client-gate card"><ShieldAlert/><h1>{accessStatus === 'blocked' ? (ar?'تم إيقاف الحساب':'Account blocked') : (ar?'الحساب معلّق':'Account suspended')}</h1><p>{ar?'تواصل مع إدارة بلقيس للمساعدة.':'Contact Balqees administration for assistance.'}</p></div>;
  if (session.user?.app_metadata?.role === 'admin') return <Navigate to="/admin" replace/>;
  if (mfaRequired) return <Navigate to="/account?next=/portal" replace/>;
  if (profile?.account_type !== 'company') return <div className="client-gate card"><Building2/><h1>{ar?'هذه البوابة لحسابات المنشآت':'This portal is for organization accounts'}</h1><p>{ar?'حسابك الحالي فردي. يمكنك متابعة حسابك من الصفحة العادية.':'Your current account is individual. Continue from the standard account page.'}</p><Link className="client-primary" to="/account">{ar?'فتح حسابي':'Open my account'}</Link></div>;
  if (!hasActiveMembership) return <div className="client-gate card"><Building2/><h1>{ar?'إعداد المنشأة غير مكتمل':'Organization setup is incomplete'}</h1><p>{ar?'الحساب مصنف كمنشأة، لكن لا توجد عضوية منشأة فعّالة مرتبطة به. لن نفتح مساحة العمل قبل إصلاح الربط.':'This account is marked as an organization account, but it has no active organization membership. The workspace stays locked until the link is fixed.'}</p><Link className="client-primary" to="/account">{ar?'العودة للحساب':'Back to account'}</Link></div>;

  return <ClientPortalProvider session={session} lang={lang} setLang={setLang}><ClientPortalLayout/></ClientPortalProvider>;
}
