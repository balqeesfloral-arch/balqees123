import { lazy, Suspense, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Services from './pages/Services';
import Store from './pages/Store';
import ProductDetails from './pages/ProductDetails';
import Projects from './pages/Projects';
import About from './pages/About';
import Account from './pages/Account';
import PasswordReset from './pages/PasswordReset';
import Signup from './pages/Signup';
import Certification from './pages/Certification';
import IndividualCheckout from './individual/IndividualCheckout';
import CodConfirmation from './individual/CodConfirmation';
import OrganizationInviteAccept from './client/OrganizationInviteAccept';
import { useSystemSettings } from './lib/systemSettings';
import { useCustomerPreferenceBridge } from './lib/customerPreferences';

const AdminGate = lazy(() => import('./admin/AdminGate'));
const ClientPortalGate = lazy(() => import('./client/ClientPortalGate'));
const RequestQuote = lazy(() => import('./pages/RequestQuote'));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); }, [pathname]);
  return null;
}

export default function App(){
  const { settings, loading: settingsLoading } = useSystemSettings();
  const [lang,setLang]=useState(()=>localStorage.getItem('balqees-lang') || 'ar');
  const location = useLocation();
  const { preferences: customerPreferences } = useCustomerPreferenceBridge(setLang);

  useEffect(() => {
    if (!settingsLoading && !localStorage.getItem('balqees-lang')) {
      const preferred = settings.site_ui?.defaultLanguage;
      if (preferred === 'ar' || preferred === 'en') setLang(preferred);
    }
  }, [settingsLoading, settings.site_ui?.defaultLanguage]);

  useEffect(()=>{ localStorage.setItem('balqees-lang',lang); document.documentElement.lang=lang; document.documentElement.dir=lang==='ar'?'rtl':'ltr'; },[lang]);

  if (location.pathname.startsWith('/admin')) {
    return <><ScrollTop/><Suspense fallback={<div className="admin-gate-screen">{lang === 'ar' ? 'جاري فتح مساحة العمل…' : 'Opening workspace…'}</div>}><Routes><Route path="/admin/*" element={<AdminGate lang={lang} setLang={setLang}/>}/></Routes></Suspense></>;
  }

  if (location.pathname.startsWith('/portal')) {
    return <><ScrollTop/><Suspense fallback={<div className="admin-gate-screen">{lang === 'ar' ? 'جاري فتح مساحة العمل…' : 'Opening workspace…'}</div>}><Routes><Route path="/portal/*" element={<ClientPortalGate lang={lang} setLang={setLang}/>}/></Routes></Suspense></>;
  }

  if (location.pathname === '/account/reset-password') {
    return <><ScrollTop/><PasswordReset lang={lang} setLang={setLang}/></>;
  }

  return <Layout lang={lang} setLang={setLang} customerPreferences={customerPreferences}><ScrollTop/><Routes>
    <Route path="/" element={<Home lang={lang}/>}/>
    <Route path="/services" element={<Services lang={lang}/>}/>
    <Route path="/request-quote" element={<Suspense fallback={<div className="shell">{lang==='ar'?'تحميل الطلب…':'Loading request…'}</div>}><RequestQuote lang={lang} key={location.search}/></Suspense>}/>
    <Route path="/store" element={<Store lang={lang}/>}/>
    <Route path="/store/:slug" element={<ProductDetails lang={lang}/>}/>
    <Route path="/projects" element={<Projects lang={lang}/>}/>
    <Route path="/about" element={<About lang={lang}/>}/>
    <Route path="/account/*" element={<Account lang={lang} setLang={setLang}/>}/>
    <Route path="/checkout" element={<IndividualCheckout lang={lang}/>}/>
    <Route path="/cod/confirm/:token" element={<CodConfirmation lang={lang}/>}/>
    <Route path="/signup" element={<Signup lang={lang}/>}/>
    <Route path="/organization-invite/:token" element={<OrganizationInviteAccept lang={lang}/>}/>
    <Route path="/certification" element={<Certification lang={lang}/>}/>
    <Route path="*" element={<Home lang={lang}/>}/>
  </Routes></Layout>;
}
