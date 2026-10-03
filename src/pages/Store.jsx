import { useEffect, useLayoutEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import StoreLegacy from './StoreLegacy';
import IndividualSmartStore from '../individual/IndividualSmartStore';
import IndividualPortalLayout from '../individual/IndividualPortalLayout';

export default function Store({ lang }) {
  const location = useLocation();
  const [session,setSession]=useState(null);
  const [accountType,setAccountType]=useState(null);
  const [profileError,setProfileError]=useState('');
  const [checking,setChecking]=useState(true);

  useLayoutEffect(()=>{
    if(!location.state?.fromIndividualPortal) return undefined;
    document.body.classList.add('individual-account-active');
    return()=>{
      if(!window.location.pathname.startsWith('/store')) document.body.classList.remove('individual-account-active');
    };
  },[location.state?.fromIndividualPortal]);
  useEffect(()=>{
    if(!supabase){setChecking(false);return undefined;}
    let live=true;
    async function resolve(nextSession){
      if(!live)return;
      setSession(nextSession||null); setProfileError('');
      if(!nextSession?.user?.id){setAccountType(null);setChecking(false);return;}
      if(nextSession.user?.app_metadata?.role==='admin'){setAccountType('admin');setChecking(false);return;}
      const {data,error}=await supabase.from('customer_profiles').select('account_type').eq('id',nextSession.user.id).maybeSingle();
      if(!live)return;
      if(error||!data){setAccountType(null);setProfileError(lang==='ar'?'تعذر التحقق من نوع حسابك. أعد فتح الحساب ثم حاول مرة أخرى.':'Could not verify your account type. Open your account and try again.');}
      else setAccountType(data.account_type);
      setChecking(false);
    }
    supabase.auth.getSession().then(({data})=>resolve(data?.session||null));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setChecking(true);resolve(next||null);});
    return()=>{live=false;subscription.unsubscribe();};
  },[]);

  if(checking) return <div className="store-page"><div className="store-loading shell"><LoaderCircle className="spin" size={28}/><span>{lang==='ar'?'جاري تجهيز المتجر…':'Loading store…'}</span></div></div>;
  if(session && profileError) return <div className="store-page"><div className="store-loading shell"><strong>{profileError}</strong></div></div>;
  if(session && accountType==='individual') return <IndividualPortalLayout lang={lang} session={session} onSignOut={() => supabase?.auth.signOut({ scope: 'local' })}><IndividualSmartStore lang={lang} session={session}/></IndividualPortalLayout>;
  return <StoreLegacy lang={lang}/>;
}
