import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProductDetailsLegacy from './ProductDetailsLegacy';
import IndividualProductDetails from '../individual/IndividualProductDetails';
import IndividualPortalLayout from '../individual/IndividualPortalLayout';

export default function ProductDetails({ lang }) {
  const [session, setSession] = useState(null);
  const [accountType, setAccountType] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!supabase) { setChecking(false); return undefined; }
    let live = true;
    let timer;
    let request = 0;
    async function resolve(nextSession) {
      const id = ++request;
      if (!live) return;
      setSession(nextSession || null);
      setProfileError('');
      if (!nextSession?.user?.id) {
        setAccountType(null);
        setChecking(false);
        return;
      }
      if (nextSession.user?.app_metadata?.role === 'admin') { setAccountType('admin'); setChecking(false); return; }
      const { data, error } = await supabase.from('customer_profiles').select('account_type').eq('id', nextSession.user.id).maybeSingle();
      if (!live || id !== request) return;
      if (error || !data) {
        setAccountType(null);
        setProfileError(lang === 'ar' ? 'تعذر التحقق من نوع حسابك لعرض المنتج بهذه الجلسة.' : 'Could not verify your account type for this product session.');
      } else setAccountType(data.account_type);
      setChecking(false);
    }
    supabase.auth.getSession().then(({ data }) => resolve(data?.session || null)).catch(() => { if (live) { setProfileError(lang === 'ar' ? 'تعذر الاتصال بالحساب. حاول مجددًا.' : 'Could not connect to your account. Please retry.'); setChecking(false); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setChecking(true);
      clearTimeout(timer);
      timer = setTimeout(() => resolve(next || null), 0);
    });
    return () => { live = false; ++request; clearTimeout(timer); subscription.unsubscribe(); };
  }, []);

  if (checking) return <div className="store-page"><div className="store-loading shell"><LoaderCircle className="spin" size={28}/><span>{lang === 'ar' ? 'جاري تجهيز المنتج…' : 'Loading product…'}</span></div></div>;
  if (profileError) return <div className="store-page"><div className="store-loading shell" role="alert"><strong>{profileError}</strong><button className="btn primary" onClick={() => window.location.reload()}>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</button></div></div>;
  if (session && accountType === 'individual') return <IndividualPortalLayout lang={lang} session={session} onSignOut={() => supabase?.auth.signOut({ scope: 'local' })}><IndividualProductDetails lang={lang} session={session}/></IndividualPortalLayout>;
  return <ProductDetailsLegacy lang={lang}/>;
}
