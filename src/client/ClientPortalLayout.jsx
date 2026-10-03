import { useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Building2, ChevronLeft, ChevronRight, FileText, Home, Languages, LogOut,
  MapPinned, Menu, MessageSquareText, PackageSearch, ReceiptText, Settings, ShoppingBag, ClipboardPlus,
  Sparkles, UserRoundCog, UsersRound, X, ScrollText
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { useClientPortal } from './ClientPortalContext';
import { applyPortalAppearance, normalizePortalDisplay } from './portalAppearance';
import ClientDashboard from './pages/ClientDashboard';
import ClientOrders from './pages/ClientOrders';
import ClientCart from './pages/ClientCart';
import ClientRequestWizard from './pages/ClientRequestWizard';
import ClientQuotes from './pages/ClientQuotes';
import ClientContracts from './pages/ClientContracts';
import ClientFinancialDocs from './pages/ClientFinancialDocs';
import ClientSites from './pages/ClientSites';
import ClientCatalog from './pages/ClientCatalog';
import ClientSupport from './pages/ClientSupport';
import ClientNotifications from './pages/ClientNotifications';
import ClientSettings from './pages/ClientSettings';
import ClientTeamPermissions from './pages/ClientTeamPermissions';

const NAV = [
  ['/portal', Home, 'الرئيسية', 'Overview', true, null],
  ['/portal/orders', PackageSearch, 'الطلبات', 'Orders', false, 'viewOrders'],
  ['/portal/request', ClipboardPlus, 'طلب جديد', 'New request', false, 'placeOrders'],
  ['/portal/quotes', FileText, 'عروض الأسعار', 'Quotations', false, 'viewQuotes'],
  ['/portal/contracts', ScrollText, 'العقود', 'Contracts', false, 'viewContracts'],
  ['/portal/sites', MapPinned, 'المواقع والفروع', 'Sites & branches', false, 'viewSites'],
  ['/portal/catalog', ShoppingBag, 'الكتالوج المؤسسي', 'Institutional catalog', false, 'viewCatalog'],
  ['/portal/financial', ReceiptText, 'المستندات والمالية', 'Documents & finance', false, 'viewFinance'],
  ['/portal/team', UsersRound, 'الفريق والصلاحيات', 'Team & permissions', false, 'viewTeam'],
  ['/portal/support', MessageSquareText, 'مركز العناية الذكي', 'Smart care', false, 'createSupportCases'],
  ['/portal/notifications', Bell, 'التنبيهات والقرارات', 'Notifications & actions', false, null],
  ['/portal/settings', Settings, 'الإعدادات', 'Settings', false, null],
];

export default function ClientPortalLayout() {
  const { lang, setLang, session, organization, profile, membership, memberships, portalSettings, preferences, permissions, setActiveOrganization, loading } = useClientPortal();
  const ar = lang === 'ar';
  const location = useLocation();
  const navigate = useNavigate();
  const cart = useBalqeesCart();
  const [mobileOpen,setMobileOpen] = useState(false);
  const [counts,setCounts] = useState({ notifications:0, quotes:0, support:0 });
  const displayPrefs=useMemo(()=>normalizePortalDisplay(portalSettings?.effective_display||portalSettings?.user_preferences||preferences||{}),[portalSettings,preferences]);
  function canOpen(key){
    if(!key)return true;
    if(key==='viewTeam')return Boolean(permissions.viewTeam||permissions.manageTeam);
    return Boolean(permissions[key]);
  }
  const visibleNav=useMemo(()=>NAV.filter(item=>canOpen(item[5])),[permissions]);
  const guard=(key,element)=>canOpen(key)?element:<PortalAccessDenied ar={ar}/>;
  const guardAny=(keys,element)=>keys.some(canOpen)?element:<PortalAccessDenied ar={ar}/>;

  useEffect(()=>applyPortalAppearance(document.querySelector('.client-app'),displayPrefs),[displayPrefs]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!organization?.id || !supabase) return;
    let live=true;
    async function refreshCounts(){
      const [badge,q,s] = await Promise.all([
        supabase.rpc('get_my_b2b_notification_badge_v1',{p_organization_id:organization.id}),
        canOpen('viewQuotes') ? supabase.from('quotations').select('id',{count:'exact',head:true}).eq('organization_id',organization.id).eq('is_current',true).in('status',['sent','viewed']) : Promise.resolve({count:0}),
        canOpen('createSupportCases') ? supabase.from('support_conversations').select('id',{count:'exact',head:true}).eq('organization_id',organization.id).in('status',['open','pending']) : Promise.resolve({count:0}),
      ]);
      let notificationCount=Number(badge.data||0);
      if(badge.error){const fallback=await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('organization_id',organization.id);notificationCount=fallback.count||0;}
      if(live) setCounts({notifications:notificationCount,quotes:q.count||0,support:s.count||0});
    }
    refreshCounts();
    const channel=supabase.channel(`portal-badges-${organization.id}-${session?.user?.id||'user'}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`organization_id=eq.${organization.id}`},refreshCounts)
      .on('postgres_changes',{event:'*',schema:'public',table:'notification_reads',filter:`user_id=eq.${session?.user?.id}`},refreshCounts)
      .subscribe();
    return ()=>{live=false;supabase.removeChannel(channel);};
  },[organization?.id,session?.user?.id,location.pathname,permissions.viewQuotes,permissions.createSupportCases]);

  const current = useMemo(()=> NAV.find(x=>x[4] ? location.pathname===x[0] : location.pathname.startsWith(x[0])) || NAV[0],[location.pathname]);
  const display = organization?.display_name || profile?.establishment_display_name || (ar?'منشأتك':'Your organization');

  async function logout(){ await supabase.auth.signOut({scope:'local'}); navigate('/account',{replace:true}); }
  function badge(path){ if(path==='/portal/request') return cart.count; if(path==='/portal/quotes') return counts.quotes; if(path==='/portal/support') return counts.support; if(path==='/portal/notifications') return counts.notifications; return 0; }

  if (loading) return <div className="client-gate"><Sparkles className="spin"/><strong>{ar?'جاري تجهيز مساحة العمل…':'Preparing workspace…'}</strong></div>;

  return <div className={`client-app portal-sidebar-${displayPrefs.sidebar_mode||'auto'}`} dir={ar?'rtl':'ltr'}>
    <aside className={`client-sidebar ${mobileOpen?'open':''}`}>
      <div className="client-side-head"><NavLink to="/portal" className="client-brand"><BrandMark/><span><b>BALQEES</b><small>CLIENT WORKSPACE</small></span></NavLink><button onClick={()=>setMobileOpen(false)} className="client-mobile-close"><X/></button></div>
      <div className="client-org-card"><span><Building2/></span><div><small>{ar?'مساحة المنشأة':'ORGANIZATION SPACE'}</small>{memberships?.length>1?<select className="client-org-switch" value={organization?.id||''} onChange={e=>setActiveOrganization(e.target.value)}>{memberships.map(m=><option key={m.organization_id} value={m.organization_id}>{m.display_name||m.organization_id}</option>)}</select>:<strong>{display}</strong>}<em>{membership?.member_role==='owner'?(ar?'مالك الحساب':'Account owner'):(membership?.member_role||'member')}</em></div></div>
      <nav className="client-nav">{visibleNav.map(([path,Icon,a,e,end])=>{const b=badge(path);return <NavLink key={path} to={path} end={end} className={({isActive})=>isActive?'active':''}><span><Icon/></span><b>{ar?a:e}</b>{b>0&&<em>{b>99?'99+':b}</em>}</NavLink>})}</nav>
      <div className="client-side-foot"><button onClick={()=>setLang(ar?'en':'ar')}><Languages/><span>{ar?'English':'العربية'}</span></button><button onClick={logout} className="danger"><LogOut/><span>{ar?'تسجيل الخروج':'Sign out'}</span></button></div>
    </aside>
    {mobileOpen&&<button className="client-sidebar-scrim" onClick={()=>setMobileOpen(false)}/>} 
    <div className="client-workspace">
      <header className="client-topbar"><div className="client-topbar-title"><button onClick={()=>setMobileOpen(true)} className="client-menu"><Menu/></button><div><small>{ar?'بوابة عملاء بلقيس':'BALQEES CLIENT PORTAL'}</small><h1>{ar?current[2]:current[3]}</h1></div></div><div className="client-top-actions"><button onClick={()=>navigate('/portal/notifications')} className="client-top-icon"><Bell/>{counts.notifications>0&&<i/>}</button>{permissions.placeOrders&&<button onClick={()=>navigate('/portal/request')} className="client-cart-chip"><ClipboardPlus/><span>{ar?'مسودة الطلب':'Request draft'}</span>{cart.count>0&&<b>{cart.count}</b>}</button>}<button onClick={()=>navigate('/portal/settings?tab=organization')} className="client-user-chip"><span>{(profile?.full_name||display).slice(0,1)}</span><div><strong>{profile?.full_name||display}</strong><small>{profile?.email||''}</small></div></button></div></header>
      <main className="client-content"><Routes>
        <Route index element={<ClientDashboard/>}/>
        <Route path="orders" element={guard('viewOrders',<ClientOrders/>)}/><Route path="orders/:id" element={guard('viewOrders',<ClientOrders/>)}/>
        <Route path="request" element={guard('placeOrders',<ClientRequestWizard/>)}/><Route path="request/:id" element={guardAny(['placeOrders','viewOrders'],<ClientRequestWizard/>)}/>
        <Route path="cart" element={guard('placeOrders',<ClientCart/>)}/>
        <Route path="quotes" element={guard('viewQuotes',<ClientQuotes/>)}/><Route path="quotes/:id" element={guard('viewQuotes',<ClientQuotes/>)}/>
        <Route path="contracts" element={guard('viewContracts',<ClientContracts/>)}/><Route path="contracts/:id" element={guard('viewContracts',<ClientContracts/>)}/>
        <Route path="financial" element={guard('viewFinance',<ClientFinancialDocs/>)}/><Route path="financial/:sourceKind/:sourceId" element={guard('viewFinance',<ClientFinancialDocs/>)}/>
        <Route path="sites" element={guard('viewSites',<ClientSites/>)}/><Route path="sites/:siteId" element={guard('viewSites',<ClientSites/>)}/>
        <Route path="catalog" element={guard('viewCatalog',<ClientCatalog/>)}/>
        <Route path="team" element={guard('viewTeam',<ClientTeamPermissions/>)}/>
        <Route path="support" element={guard('createSupportCases',<ClientSupport/>)}/>
        <Route path="notifications" element={<ClientNotifications/>}/>
        <Route path="profile" element={<Navigate to="/portal/settings?tab=organization" replace/>}/>
        <Route path="settings" element={<ClientSettings/>}/>
        <Route path="*" element={<ClientDashboard/>}/>
      </Routes></main>
      <footer className="client-footer"><span>© {new Date().getFullYear()} BALQEES FLORAL</span><span>{ar?'بوابة المنشآت · مكة المكرمة':'Organization portal · Makkah'}</span></footer>
    </div>
    <nav className="client-mobile-dock">{visibleNav.slice(0,5).map(([path,Icon,a,e,end])=><NavLink key={path} to={path} end={end}><Icon/><span>{ar?a:e}</span>{badge(path)>0&&<b>{badge(path)}</b>}</NavLink>)}</nav>
  </div>;
}


function PortalAccessDenied({ar}){return <div className="client-empty-large portal-access-denied"><UserRoundCog/><h3>{ar?'هذه الصفحة خارج صلاحياتك':'This page is outside your permissions'}</h3><p>{ar?'صلاحياتك الحالية لا تسمح بفتح هذا القسم. تواصل مع مالك المنشأة أو مديرها إذا كنت تحتاج الوصول.':'Your current role does not allow access to this section. Contact the organization owner or manager if you need access.'}</p><NavLink className="client-primary" to="/portal">{ar?'العودة للرئيسية':'Back to overview'}</NavLink></div>}
