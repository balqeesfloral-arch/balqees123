import { useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Services from './pages/Services';
import Projects from './pages/Projects';
import About from './pages/About';
import Account from './pages/Account';
import Certification from './pages/Certification';

function ScrollTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}

export default function App(){
  const [lang,setLang]=useState(()=>localStorage.getItem('balqees-lang') || 'ar');
  useEffect(()=>{ localStorage.setItem('balqees-lang',lang); document.documentElement.lang=lang; document.documentElement.dir=lang==='ar'?'rtl':'ltr'; },[lang]);
  return <Layout lang={lang} setLang={setLang}><ScrollTop/><Routes>
    <Route path="/" element={<Home lang={lang}/>}/>
    <Route path="/services" element={<Services lang={lang}/>}/>
    <Route path="/projects" element={<Projects lang={lang}/>}/>
    <Route path="/about" element={<About lang={lang}/>}/>
    <Route path="/account" element={<Account lang={lang}/>}/>
    <Route path="/certification" element={<Certification lang={lang}/>}/>
    <Route path="*" element={<Home lang={lang}/>}/>
  </Routes></Layout>;
}
