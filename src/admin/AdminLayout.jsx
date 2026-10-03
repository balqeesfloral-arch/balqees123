import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  BadgePercent,
  Bell,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardPlus,
  Command,
  ExternalLink,
  FileText,
  FileCheck2,
  ReceiptText,
  ScrollText,
  FileClock,
  Gift,
  MapPinned,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  MoonStar,
  PackageSearch,
  Search,
  Settings,
  Sparkles,
  UserRoundCog,
  UsersRound,
  X,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useSystemSettings } from '../lib/systemSettings';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminOrders from './pages/AdminOrders';
import AdminServiceRequests from './pages/AdminServiceRequests';
import AdminQuotes from './pages/AdminQuotes';
import AdminContracts from './pages/AdminContracts';
import AdminSites from './pages/AdminSites';
import AdminClientDocuments from './pages/AdminClientDocuments';
import AdminCatalog from './pages/AdminCatalog';
import AdminInstitutionalCatalog from './pages/AdminInstitutionalCatalog';
import AdminDiscounts from './pages/AdminDiscounts';
import AdminOffers from './pages/AdminOffers';
import AdminNotifications from './pages/AdminNotifications';
import AdminSupport from './pages/AdminSupport';
import AdminHelpCenter from './pages/AdminHelpCenter';
import AdminSettings from './pages/AdminSettings';
import AdminProfile from './pages/AdminProfile';
import AdminAudit from './pages/AdminAudit';
import AdminOrganizationTeam from './pages/AdminOrganizationTeam';
import AdminOrganizationSettings from './pages/AdminOrganizationSettings';

const NAV = [
  { path: '/admin', icon: LayoutDashboard, ar: 'نظرة عامة', en: 'Overview', end: true },
  { path: '/admin/users', icon: UsersRound, ar: 'المستخدمون', en: 'Users' },
  { path: '/admin/service-requests', icon: ClipboardPlus, ar: 'طلبات المنشآت', en: 'B2B requests' },
  { path: '/admin/organization-team', icon: UsersRound, ar: 'فرق المنشآت', en: 'Organization teams' },
  { path: '/admin/organization-settings', icon: Settings, ar: 'إعدادات المنشآت', en: 'Organization settings' },
  { path: '/admin/orders', icon: PackageSearch, ar: 'الطلبات', en: 'Orders' },
  { path: '/admin/quotes', icon: FileText, ar: 'عروض الأسعار', en: 'Quotations' },
  { path: '/admin/contracts', icon: ScrollText, ar: 'العقود', en: 'Contracts' },
  { path: '/admin/sites', icon: MapPinned, ar: 'المواقع والفروع', en: 'Sites & branches' },
  { path: '/admin/financial-docs', icon: ReceiptText, ar: 'المالية والمستندات', en: 'Finance & documents' },
  { path: '/admin/catalog', icon: Boxes, ar: 'المنتجات والتسعير', en: 'Catalog & pricing' },
  { path: '/admin/institutional-catalog', icon: Sparkles, ar: 'كتالوج المنشآت', en: 'Institutional catalog' },
  { path: '/admin/discounts', icon: BadgePercent, ar: 'الخصومات', en: 'Discounts' },
  { path: '/admin/offers', icon: Gift, ar: 'العروض', en: 'Offers' },
  { path: '/admin/notifications', icon: Bell, ar: 'الإشعارات', en: 'Notifications' },
  { path: '/admin/support', icon: MessageSquareText, ar: 'التواصل', en: 'Communication' },
  { path: '/admin/help', icon: CircleHelp, ar: 'مركز المساعدة', en: 'Help center' },
  { path: '/admin/audit', icon: FileClock, ar: 'سجل النشاط', en: 'Activity log' },
  { path: '/admin/settings', icon: Settings, ar: 'الإعدادات', en: 'Settings' },
  { path: '/admin/profile', icon: UserRoundCog, ar: 'الملف الشخصي', en: 'Profile' },
];

function label(item, ar) { return ar ? item.ar : item.en; }

export default function AdminLayout({ lang, setLang, session }) {
  const ar = lang === 'ar';
  const location = useLocation();
  const navigate = useNavigate();
  const { settings: systemSettings } = useSystemSettings();
  const settings = systemSettings.admin_ui;
  const securitySettings = systemSettings.security;
  const [collapsed, setCollapsed] = useState(settings.sidebar === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [badges, setBadges] = useState({ support: 0, notifications: 0, requests: 0 });

  const displayName = session.user?.user_metadata?.full_name || 'Balqees Admin';
  const email = session.user?.email || '';

  const refreshBadges = useCallback(async () => {
    if (!supabase) return;
    const [support, notifications, requests] = await Promise.all([
      supabase.from('support_conversations').select('id', { count: 'exact', head: true }).in('status', ['open','pending']),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).in('status', ['draft','scheduled']),
      supabase.from('organization_service_requests').select('id', { count: 'exact', head: true }).eq('status','submitted'),
    ]);
    setBadges({ support: support.count || 0, notifications: notifications.count || 0, requests: requests.count || 0 });
  }, []);

  useEffect(() => {
    refreshBadges();
  }, [refreshBadges]);

  useEffect(() => {
    setCollapsed(settings.sidebar === 'collapsed');
    document.documentElement.style.setProperty('--admin-font-scale', String(settings.fontScale || 1));
  }, [settings.sidebar, settings.fontScale]);

  useEffect(() => {
    if (securitySettings.adminAutoLock === false) return undefined;
    const minutes = Math.max(5, Number(securitySettings.adminIdleMinutes) || 60);
    let timer;
    const lock = async () => {
      await supabase.auth.signOut({scope:'local'});
      navigate('/account?reason=idle', { replace: true });
    };
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, minutes * 60 * 1000);
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(name => window.addEventListener(name, reset, { passive: true }));
    reset();
    return () => {
      window.clearTimeout(timer);
      events.forEach(name => window.removeEventListener(name, reset));
    };
  }, [securitySettings.adminAutoLock, securitySettings.adminIdleMinutes, navigate]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current = NAV.find(item => item.end ? location.pathname === item.path : location.pathname.startsWith(item.path)) || NAV[0];
  const paletteItems = useMemo(() => NAV.filter(item => label(item, ar).toLowerCase().includes(paletteQuery.toLowerCase())), [ar, paletteQuery]);

  async function logout() {
    await supabase.auth.signOut({scope:'local'});
    navigate('/account', { replace: true });
  }

  function go(path) {
    setPaletteOpen(false);
    setPaletteQuery('');
    navigate(path);
  }

  const adminClass = `admin-app admin-accent-${settings.accent || 'olive'} admin-density-${settings.density || 'comfortable'} admin-content-${settings.contentWidth || 'wide'} ${settings.topbar === 'static' ? 'admin-topbar-static' : ''} ${settings.glass === false ? 'admin-no-glass' : ''} ${settings.motion === false ? 'admin-no-motion' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`;

  return <div className={adminClass} dir={ar ? 'rtl' : 'ltr'}>
    <aside className={`admin-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="admin-sidebar-head">
        <NavLink to="/admin" className="admin-brand"><BrandMark/><span><b>BALQEES</b><small>CONTROL CENTER</small></span></NavLink>
        <button className="admin-icon-button admin-mobile-close" onClick={() => setMobileOpen(false)} aria-label="close"><X size={18}/></button>
      </div>
      <div className="admin-sidebar-badge"><Sparkles size={14}/><span>{ar ? 'إدارة بلقيس الذكية' : 'Balqees Intelligent Admin'}</span></div>
      <nav className="admin-nav">
        {NAV.map(item => {
          const Icon = item.icon;
          const badge = item.path === '/admin/support' ? badges.support : item.path === '/admin/notifications' ? badges.notifications : item.path === '/admin/service-requests' ? badges.requests : 0;
          return <NavLink key={item.path} to={item.path} end={item.end} className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`} title={label(item, ar)}>
            <span className="admin-nav-icon"><Icon size={19}/></span><span className="admin-nav-label">{label(item, ar)}</span>{badge > 0 && <em>{badge > 99 ? '99+' : badge}</em>}
          </NavLink>;
        })}
      </nav>
      <div className="admin-sidebar-foot">
        <a className="admin-nav-link" href="/store" target="_blank" rel="noreferrer"><span className="admin-nav-icon"><ExternalLink size={18}/></span><span className="admin-nav-label">{ar ? 'معاينة المتجر' : 'Preview store'}</span></a><a className="admin-nav-link" href="/" target="_blank" rel="noreferrer"><span className="admin-nav-icon"><ExternalLink size={18}/></span><span className="admin-nav-label">{ar ? 'عرض الموقع' : 'View website'}</span></a>
        <button className="admin-nav-link danger" onClick={logout}><span className="admin-nav-icon"><LogOut size={18}/></span><span className="admin-nav-label">{ar ? 'تسجيل الخروج' : 'Sign out'}</span></button>
        <button className="admin-collapse-button" onClick={() => setCollapsed(v => !v)}>{collapsed ? (ar ? <ChevronLeft/> : <ChevronRight/>) : (ar ? <ChevronRight/> : <ChevronLeft/>)}<span>{ar ? 'تصغير القائمة' : 'Collapse sidebar'}</span></button>
      </div>
    </aside>
    {mobileOpen && <button className="admin-sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="close navigation"/>}

    <div className="admin-workspace">
      <header className="admin-topbar">
        <div className="admin-topbar-title">
          <button className="admin-icon-button admin-mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20}/></button>
          <div><small>{ar ? 'مركز التحكم' : 'CONTROL CENTER'}</small><h1>{label(current, ar)}</h1></div>
        </div>
        <div className="admin-topbar-actions">
          <button className="admin-command-trigger" onClick={() => setPaletteOpen(true)}><Search size={16}/><span>{ar ? 'بحث سريع…' : 'Quick search…'}</span><kbd><Command size={12}/>K</kbd></button>
          <button className="admin-icon-button" onClick={() => setLang(ar ? 'en' : 'ar')} title={ar ? 'English' : 'العربية'}>{ar ? 'EN' : 'ع'}</button>
          <button className="admin-icon-button" onClick={() => navigate('/admin/notifications')} title={ar ? 'الإشعارات' : 'Notifications'}><Bell size={18}/>{badges.notifications > 0 && <i/>}</button>
          <button className="admin-profile-chip" onClick={() => navigate('/admin/profile')}><span>{displayName.slice(0,1).toUpperCase()}</span><div><strong>{displayName}</strong><small>{email}</small></div></button>
        </div>
      </header>

      <main className="admin-content">
        <Routes>
          <Route index element={<AdminDashboard lang={lang} onRefreshBadges={refreshBadges}/>}/>
          <Route path="users" element={<AdminUsers lang={lang}/>}/>
          <Route path="service-requests" element={<AdminServiceRequests lang={lang}/>}/>
          <Route path="organization-team" element={<AdminOrganizationTeam lang={lang}/>}/>
          <Route path="organization-settings" element={<AdminOrganizationSettings lang={lang}/>}/>
          <Route path="orders" element={<AdminOrders lang={lang}/>}/>
          <Route path="quotes" element={<AdminQuotes lang={lang}/>}/>
          <Route path="contracts" element={<AdminContracts lang={lang}/>}/>
          <Route path="sites" element={<AdminSites lang={lang}/>}/>
          <Route path="financial-docs" element={<AdminClientDocuments lang={lang}/>}/>
          <Route path="catalog" element={<AdminCatalog lang={lang}/>}/>
          <Route path="institutional-catalog" element={<AdminInstitutionalCatalog lang={lang}/>}/>
          <Route path="discounts" element={<AdminDiscounts lang={lang}/>}/>
          <Route path="offers" element={<AdminOffers lang={lang}/>}/>
          <Route path="notifications" element={<AdminNotifications lang={lang} onRefreshBadges={refreshBadges}/>}/>
          <Route path="support" element={<AdminSupport lang={lang} session={session} onRefreshBadges={refreshBadges}/>}/>
          <Route path="help" element={<AdminHelpCenter lang={lang}/>}/>
          <Route path="audit" element={<AdminAudit lang={lang}/>}/>
          <Route path="settings" element={<AdminSettings lang={lang}/>}/>
          <Route path="profile" element={<AdminProfile lang={lang} session={session}/>}/>
          <Route path="*" element={<AdminDashboard lang={lang} onRefreshBadges={refreshBadges}/>}/>
        </Routes>
      </main>
      <footer className="admin-footer"><span>© {new Date().getFullYear()} BALQEES FLORAL · CONTROL CENTER</span><span><MoonStar size={13}/>{ar ? 'مكة المكرمة' : 'MAKKAH'}</span></footer>
    </div>

    {paletteOpen && <div className="admin-command-overlay" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) setPaletteOpen(false); }}>
      <div className="admin-command-panel">
        <div className="admin-command-search"><Search size={18}/><input autoFocus value={paletteQuery} onChange={e => setPaletteQuery(e.target.value)} placeholder={ar ? 'ابحث عن صفحة أو وظيفة…' : 'Search pages and actions…'}/><button onClick={() => setPaletteOpen(false)}><X size={17}/></button></div>
        <div className="admin-command-section"><small>{ar ? 'انتقال سريع' : 'QUICK NAVIGATION'}</small>{paletteItems.map(item => { const Icon = item.icon; return <button key={item.path} onClick={() => go(item.path)}><span><Icon size={18}/>{label(item, ar)}</span><ChevronLeft size={16}/></button>; })}</div>
        <div className="admin-command-shortcuts">
          <button onClick={() => go('/admin/catalog')}><Boxes size={17}/>{ar ? 'إضافة منتج' : 'Add product'}</button>
          <button onClick={() => go('/admin/service-requests')}><ClipboardPlus size={17}/>{ar ? 'طلبات المنشآت' : 'B2B requests'}</button>
          <button onClick={() => go('/admin/quotes')}><FileText size={17}/>{ar ? 'عرض سعر جديد' : 'New quotation'}</button>
          <button onClick={() => go('/admin/financial-docs')}><ReceiptText size={17}/>{ar ? 'إضافة مستند رسمي' : 'Add official document'}</button>
          <button onClick={() => go('/admin/notifications')}><Bell size={17}/>{ar ? 'إشعار جديد' : 'New notification'}</button>
          <button onClick={() => go('/admin/support')}><MessageSquareText size={17}/>{ar ? 'صندوق التواصل' : 'Support inbox'}</button>
          <button onClick={() => go('/admin/audit')}><FileClock size={17}/>{ar ? 'سجل النشاط' : 'Activity log'}</button>
          <button onClick={() => go('/admin/settings')}><Settings size={17}/>{ar ? 'إعدادات النظام' : 'System settings'}</button>
        </div>
      </div>
    </div>}
  </div>;
}
