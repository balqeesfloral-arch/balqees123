import { useEffect, useState } from 'react';
import { LockKeyhole, Mail, Building2, UserRound, ArrowUpRight, LogOut, CircleCheck } from 'lucide-react';
import { copy } from '../lib/content';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function Account({lang}) {
 const t=copy[lang], ar=lang==='ar';
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [loading,setLoading]=useState(false);
 const [message,setMessage]=useState('');
 const [session,setSession]=useState(null);

 useEffect(()=>{
   if(!supabase) return;
   supabase.auth.getSession().then(({data})=>setSession(data.session));
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
   return ()=>subscription.unsubscribe();
 },[]);

 async function login(e){
   e.preventDefault();
   if(!supabase){
     setMessage(ar?'أضف بيانات Supabase في ملف .env لتفعيل تسجيل الدخول.':'Add Supabase environment values to enable sign in.');
     return;
   }
   setLoading(true); setMessage('');
   const {error}=await supabase.auth.signInWithPassword({email,password});
   setLoading(false);
   if(error) setMessage(ar?'تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.':'Sign in failed. Check your email and password.');
 }

 async function logout(){ if(supabase) await supabase.auth.signOut(); }

 return <section className="page-section shell account-page">
   <div className="login-shell">
     <div className="login-intro"><span className="eyebrow">BALQEES PORTAL</span><h1>{t.accountTitle}</h1><p>{t.accountIntro}</p><div className="portal-types"><span><Building2/> {ar?'الشركات':'Companies'}</span><span><UserRound/> {ar?'العملاء':'Clients'}</span><span><LockKeyhole/> {ar?'الإدارة':'Administration'}</span></div></div>
     {session ? <div className="login-card session-card">
       <div className="session-icon"><CircleCheck size={34}/></div>
       <h2>{ar?'تم تسجيل الدخول':'You are signed in'}</h2>
       <p>{session.user.email}</p>
       <button className="btn ghost wide" onClick={logout}><LogOut size={17}/>{ar?'تسجيل الخروج':'Sign out'}</button>
     </div> : <form className="login-card" onSubmit={login}>
       <label>{t.email}<span><Mail size={18}/><input value={email} onChange={e=>setEmail(e.target.value)} type="email" required placeholder="name@company.com"/></span></label>
       <label>{t.password}<span><LockKeyhole size={18}/><input value={password} onChange={e=>setPassword(e.target.value)} type="password" required placeholder="••••••••"/></span></label>
       <div className="login-row"><button type="button" className="link-button">{t.forgot}</button></div>
       {message && <div className="auth-message">{message}</div>}
       <button className="btn primary wide" type="submit" disabled={loading}>{loading?(ar?'جاري الدخول…':'Signing in…'):t.login}<ArrowUpRight size={17}/></button>
       <div className="login-divider"><span>{ar?'أو':'or'}</span></div>
       <p className="small-copy">{t.noAccount}</p>
       <a className="btn ghost wide" href="https://wa.me/966583799559" target="_blank" rel="noreferrer">{t.requestAccess}</a>
       {!isSupabaseConfigured && <small className="auth-note">{ar?'تسجيل الدخول مهيأ تقنياً، ويحتاج فقط قيم VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في بيئة النشر.':'Authentication is wired and only needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in deployment.'}</small>}
     </form>}
   </div>
 </section>
}
