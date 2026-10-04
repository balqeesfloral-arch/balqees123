import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, CalendarDays, ChevronLeft, ChevronRight, FileText, Heart, Home,
  LifeBuoy, LogOut, MapPin, Menu, PackageSearch, Settings2, ShieldCheck,
  ShoppingBag, Store, UserRound, X,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { useBalqeesCart } from '../lib/cart';
import { supabase } from '../lib/supabase';
import './individual-account.css';

const NAV_ITEMS = [
  { key: 'home', to: '/account', icon: Home, ar: 'الرئيسية', en: 'Home', section: 'main', exact: true },
  { key: 'store', to: '/store', icon: Store, ar: 'المتجر', en: 'Store', section: 'main' },
  { key: 'orders', to: '/account/orders', icon: PackageSearch, ar: 'طلباتي', en: 'My orders', section: 'main' },
  { key: 'quote-requests', to: '/request-quote#my-quote-requests', icon: FileText, ar: 'طلبات عروض الأسعار', en: 'Quotation requests', section: 'main' },
  { key: 'cart', to: '/account/cart', icon: ShoppingBag, ar: 'السلة', en: 'Cart', section: 'main', badge: 'cart' },
  { key: 'favorites', to: '/account/favorites', icon: Heart, ar: 'المفضلة', en: 'Favorites', section: 'main' },
  { key: 'addresses', to: '/account/addresses', icon: MapPin, ar: 'العناوين', en: 'Addresses', section: 'organize' },
  { key: 'occasions', to: '/account/occasions', icon: CalendarDays, ar: 'مناسباتي', en: 'Occasions', section: 'organize' },
  { key: 'documents', to: '/account/documents', icon: FileText, ar: 'مستنداتي', en: 'Documents', section: 'organize' },
  { key: 'notifications', to: '/account/notifications', icon: Bell, ar: 'الإشعارات', en: 'Notifications', section: 'organize', badge: 'notifications' },
  { key: 'support', to: '/account/support', icon: LifeBuoy, ar: 'مركز العناية', en: 'Care center', section: 'account' },
  { key: 'profile', to: '/account/profile', icon: UserRound, ar: 'ملفي الشخصي', en: 'Profile', section: 'account' },
  { key: 'settings', to: '/account/settings', icon: Settings2, ar: 'الإعدادات', en: 'Settings', section: 'account' },
];

function isActive(pathname, item) {
  if (item.key === 'home') return pathname === '/account' || pathname === '/account/';
  if (item.key === 'store') return pathname === '/store' || pathname.startsWith('/store/');
  if (item.key === 'settings') return pathname === '/account/settings' || pathname.startsWith('/account/settings/');
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function pageMeta(pathname, ar) {
  const items = [
    [/^\/store\/[^/]+\/?$/, ar ? 'تفاصيل المنتج' : 'Product details'],
    [/^\/store\/?$/, ar ? 'المتجر' : 'Store'],
    [/^\/account\/orders\//, ar ? 'تفاصيل الطلب' : 'Order details'],
    [/^\/account\/orders\/?$/, ar ? 'طلباتي' : 'My orders'],
    [/^\/account\/cart\/?$/, ar ? 'السلة' : 'Cart'],
    [/^\/account\/favorites\/?$/, ar ? 'المفضلة' : 'Favorites'],
    [/^\/account\/addresses\/?$/, ar ? 'العناوين والمستلمون' : 'Addresses & recipients'],
    [/^\/account\/occasions\/?$/, ar ? 'مناسباتي' : 'My occasions'],
    [/^\/account\/support\/?$/, ar ? 'مركز العناية' : 'Care center'],
    [/^\/account\/profile\/?$/, ar ? 'ملفي الشخصي' : 'My profile'],
    [/^\/account\/settings\/security/, ar ? 'الأمان والخصوصية' : 'Security & privacy'],
    [/^\/account\/settings\/?$/, ar ? 'الإعدادات' : 'Settings'],
    [/^\/account\/notifications\/?$/, ar ? 'الإشعارات' : 'Notifications'],
    [/^\/account\/documents\/?$/, ar ? 'مستنداتي' : 'Documents'],
  ];
  return items.find(([pattern]) => pattern.test(pathname))?.[1] || (ar ? 'حسابي' : 'My account');
}

export default function IndividualPortalLayout({ lang, session, onSignOut, children }) {
  const ar = lang === 'ar';
  const location = useLocation();
  const navigate = useNavigate();
  const cart = useBalqeesCart(session?.user?.id || null);
  const [profile, setProfile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const Arrow = ar ? ChevronLeft : ChevronRight;

  useEffect(() => {
    document.body.classList.add('individual-account-active');
    return () => document.body.classList.remove('individual-account-active');
  }, [location.pathname]);

  useEffect(() => {
    if (!supabase || !session?.user?.id) return undefined;
    let active = true;
    const uid = session.user.id;
    Promise.all([
      supabase.from('customer_profiles').select('full_name,username,email').eq('id', uid).maybeSingle(),
      supabase.from('notifications').select('id,audience,user_id,expires_at').eq('status', 'published').order('published_at', { ascending: false }).limit(80),
      supabase.from('notification_reads').select('notification_id').eq('user_id', uid),
    ]).then(([profileResult, notificationResult, readResult]) => {
      if (!active) return;
      setProfile(profileResult.data || null);
      const readIds = new Set((readResult.data || []).map(row => row.notification_id));
      const now = Date.now();
      const unread = (notificationResult.data || []).filter(item => {
        const audienceOk = item.audience === 'all' || item.audience === 'individual' || (item.audience === 'user' && item.user_id === uid);
        const notExpired = !item.expires_at || new Date(item.expires_at).getTime() >= now;
        return audienceOk && notExpired && !readIds.has(item.id);
      }).length;
      setUnreadCount(unread);
    }).catch(() => {});
    return () => { active = false; };
  }, [session?.user?.id, location.pathname]);

  const fullName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || (ar ? 'عميل بلقيس' : 'Balqees client');
  const firstName = fullName.trim().split(/\s+/)[0];
  const initial = fullName.trim().slice(0, 1).toUpperCase() || 'ب';
  const title = pageMeta(location.pathname, ar);
  const mobileSecondaryActive = NAV_ITEMS.slice(4).some(item => isActive(location.pathname, item));
  const sections = useMemo(() => ({
    main: NAV_ITEMS.filter(item => item.section === 'main'),
    organize: NAV_ITEMS.filter(item => item.section === 'organize'),
    account: NAV_ITEMS.filter(item => item.section === 'account'),
  }), []);

  function navSection(items) {
    return items.map(item => {
      const Icon = item.icon;
      const active = isActive(location.pathname, item);
      const badge = item.badge === 'cart' ? cart.count : item.badge === 'notifications' ? unreadCount : 0;
      return <Link key={item.key} to={item.to} state={item.key === 'store' ? { fromIndividualPortal: true } : undefined} className={`individual-portal-nav-link ${active ? 'active' : ''}`}>
        <span className="individual-portal-nav-icon"><Icon size={18}/>{badge > 0 && <b>{Math.min(badge, 99)}</b>}</span>
        <strong>{ar ? item.ar : item.en}</strong>
        <Arrow size={14}/>
      </Link>;
    });
  }

  return <div className="individual-portal-layout" dir={ar ? 'rtl' : 'ltr'}>
    <header className="individual-portal-topbar">
      <div className="individual-portal-topbar-inner">
        <Link to="/account" className="individual-portal-brand" aria-label={ar ? 'الرئيسية داخل حساب بلقيس' : 'Balqees account home'}><BrandMark/></Link>
        <div className="individual-portal-page-title"><span>{title}</span><small>{ar ? 'حساب فردي' : 'INDIVIDUAL ACCOUNT'}</small></div>
        <div className="individual-portal-actions">
          <button type="button" className="individual-portal-action" onClick={() => navigate('/account/notifications')} aria-label={ar ? 'الإشعارات' : 'Notifications'}><Bell size={19}/>{unreadCount > 0 && <b>{Math.min(unreadCount, 99)}</b>}</button>
          <button type="button" className="individual-portal-action" onClick={() => navigate('/account/cart')} aria-label={ar ? 'السلة' : 'Cart'}><ShoppingBag size={19}/>{cart.count > 0 && <b>{Math.min(cart.count, 99)}</b>}</button>
          <button type="button" className="individual-portal-profile-button" onClick={() => navigate('/account/profile')}><span>{initial}</span><div><small>{ar ? 'حسابي' : 'Account'}</small><strong>{firstName}</strong></div></button>
        </div>
      </div>
    </header>

    <div className="individual-portal-frame">
      <div className="individual-portal-content">{children}</div>
      <aside className="individual-portal-sidebar" aria-label={ar ? 'قائمة الحساب' : 'Account navigation'}>
        <div className="individual-portal-user-card">
          <div className="individual-portal-avatar">{initial}</div>
          <div><small>{ar ? 'مساحتك في بلقيس' : 'YOUR BALQEES SPACE'}</small><strong>{fullName}</strong><span>{session?.user?.email}</span></div>
          <i><ShieldCheck size={13}/>{ar ? 'فردي' : 'Individual'}</i>
        </div>

        <nav className="individual-portal-nav">
          <section><small>{ar ? 'التسوق والطلبات' : 'SHOP & ORDERS'}</small>{navSection(sections.main)}</section>
          <section><small>{ar ? 'تنظيم حسابك' : 'ORGANIZE'}</small>{navSection(sections.organize)}</section>
          <section><small>{ar ? 'الحساب والعناية' : 'ACCOUNT & CARE'}</small>{navSection(sections.account)}</section>
        </nav>

        <div className="individual-portal-sidebar-footer">
          <Link to="/account/settings/security"><ShieldCheck size={16}/><span>{ar ? 'الأمان والخصوصية' : 'Security & privacy'}</span></Link>
          <button type="button" onClick={onSignOut}><LogOut size={16}/><span>{ar ? 'تسجيل الخروج' : 'Sign out'}</span></button>
        </div>
      </aside>
    </div>

    <nav className="individual-portal-mobile-dock" aria-label={ar ? 'تنقل الحساب الفردي' : 'Individual account navigation'}>
      <Link className={isActive(location.pathname, NAV_ITEMS[0]) ? 'active' : ''} to="/account" state={{ fromIndividualPortal: true }} aria-label={ar ? 'الرئيسية' : 'Home'} title={ar ? 'الرئيسية' : 'Home'}><Home/></Link>
      <Link className={location.pathname === '/store' || location.pathname.startsWith('/store/') ? 'active' : ''} to="/store" state={{ fromIndividualPortal: true }} aria-label={ar ? 'المتجر' : 'Store'} title={ar ? 'المتجر' : 'Store'}><Store/></Link>
      <Link className={isActive(location.pathname, NAV_ITEMS[2]) ? 'active' : ''} to="/account/orders" aria-label={ar ? 'طلباتي' : 'Orders'} title={ar ? 'طلباتي' : 'Orders'}><PackageSearch/></Link>
      <Link className={isActive(location.pathname, NAV_ITEMS[3]) ? 'active' : ''} to="/account/cart" aria-label={ar ? 'السلة' : 'Cart'} title={ar ? 'السلة' : 'Cart'}><ShoppingBag/>{cart.count > 0 && <b>{Math.min(cart.count, 99)}</b>}</Link>
      <button type="button" className={mobileSecondaryActive ? 'active' : ''} onClick={() => setMobileMenuOpen(true)} aria-label={ar ? 'باقي صفحات الحساب' : 'More account pages'} title={ar ? 'المزيد' : 'More'}><Menu/></button>
    </nav>

    {mobileMenuOpen && <div className="individual-portal-mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)}>
      <section className="individual-portal-mobile-menu" onClick={event => event.stopPropagation()} aria-label={ar ? 'كل صفحات الحساب' : 'All account pages'}>
        <header><div><small>{ar ? 'حساب بلقيس' : 'BALQEES ACCOUNT'}</small><strong>{ar ? 'كل الأقسام' : 'All sections'}</strong></div><button type="button" onClick={() => setMobileMenuOpen(false)} aria-label={ar ? 'إغلاق' : 'Close'}><X/></button></header>
        <div className="individual-portal-mobile-menu-grid">
          {NAV_ITEMS.slice(4).map(item => {
            const Icon = item.icon;
            const active = isActive(location.pathname, item);
            const badge = item.badge === 'notifications' ? unreadCount : 0;
            return <Link key={item.key} to={item.to} className={active ? 'active' : ''} onClick={() => setMobileMenuOpen(false)}><span><Icon/>{badge > 0 && <b>{Math.min(badge, 99)}</b>}</span><strong>{ar ? item.ar : item.en}</strong></Link>;
          })}
          <Link to="/account/settings/security" className={location.pathname.startsWith('/account/settings/security') ? 'active' : ''} onClick={() => setMobileMenuOpen(false)}><span><ShieldCheck/></span><strong>{ar ? 'الأمان والخصوصية' : 'Security & privacy'}</strong></Link>
        </div>
      </section>
    </div>}
  </div>;
}
