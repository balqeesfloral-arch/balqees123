import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Store, ShoppingBag, Images, Info, UserRound, Globe2, MapPin } from 'lucide-react';
import BrandMark from './BrandMark';
import SeasonMessageWidget from './SeasonMessageWidget';
import SupportWidget from './SupportWidget';
import { getSaudiSeason } from '../lib/season';
import { SeasonContext, seasonDesigns } from '../lib/season-design';
import { business, copy } from '../lib/content';
import { useSystemSettings } from '../lib/systemSettings';

const nav = [['/', Home, 'home'], ['/services', Store, 'services'], ['/store', ShoppingBag, 'store'], ['/projects', Images, 'projects'], ['/about', Info, 'about'], ['/account', UserRound, 'account']];

export default function Layout({ lang, setLang, children, customerPreferences }) {
  const location = useLocation();
  const ar = lang === 'ar', t = copy[lang];
  const { settings } = useSystemSettings();
  const siteUi = settings.site_ui;
  const [detected, setDetected] = useState(() => getSaudiSeason().key);
  const seasonKey = siteUi.seasonalExperience === false ? 'default' : detected;
  const quietMode = customerPreferences?.quiet_mode === true;
  const reduceMotion = quietMode || customerPreferences?.reduce_motion === true;
  const season = seasonDesigns[seasonKey] || seasonDesigns.default;

  useEffect(() => {
    const syncSeason = () => setDetected(getSaudiSeason().key);
    syncSeason();
    const id = setInterval(syncSeason, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const colors = { default: '#142b24', ramadan: '#10282d', eid: '#38282d', adha: '#302f20', hajj: '#202524', national: '#093f30' };
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors[season.key]);
  }, [season.key]);

  const dockMove = event => {
    if (siteUi.motion === false || reduceMotion || !window.matchMedia('(hover:hover) and (pointer:fine)').matches || window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    event.currentTarget.querySelectorAll('.bottom-link').forEach(link => {
      const r = link.getBoundingClientRect();
      const amount = Math.max(0, 1 - Math.abs(event.clientX - r.left - r.width / 2) / 100);
      link.style.setProperty('--dock-scale', 1 + amount * .12);
      link.style.setProperty('--dock-lift', `${-amount * 7}px`);
    });
  };

  const dockReset = event => event.currentTarget.querySelectorAll('.bottom-link').forEach(link => {
    link.style.setProperty('--dock-scale', 1);
    link.style.setProperty('--dock-lift', '0px');
  });

  const siteClass = [
    'app',
    `season-${season.key}`,
    location.pathname === '/' ? 'home-route' : 'inner-route',
    `site-accent-${siteUi.accent || 'seasonal'}`,
    `site-radius-${siteUi.radius || 'soft'}`,
    `site-width-${siteUi.contentWidth || 'standard'}`,
    siteUi.glass === false ? 'site-no-glass' : '',
    (siteUi.motion === false || reduceMotion) ? 'site-no-motion' : '',
    quietMode ? 'customer-quiet-mode' : '',
  ].filter(Boolean).join(' ');

  return <SeasonContext.Provider value={{ season }}>
    <div className={siteClass} dir={ar ? 'rtl' : 'ltr'} data-season={season.key}>
      <a href="#main-content" className="skip-link">{ar ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>
      <header className="site-header">
        <div className="header-inner shell">
          <NavLink to="/" className="brand-link" aria-label={ar ? 'بلقيس الورد — الرئيسية' : 'Balqees Floral — Home'}><BrandMark/></NavLink>
          <div className="header-signature"><span>FLORAL & BOTANICAL ATELIER</span><small>{ar ? 'مكة المكرمة · فنّ الضيافة الطبيعية' : 'MAKKAH · THE ART OF NATURAL HOSPITALITY'}</small></div>
          <div className="header-actions">
            <button className="language-button" onClick={() => setLang(ar ? 'en' : 'ar')} aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}><Globe2 size={16}/><span>{ar ? 'EN' : 'عربي'}</span></button>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="page-content">{children}</main>
      {siteUi.showSeasonMessage !== false && !quietMode && <SeasonMessageWidget lang={lang}/>} 
      <SupportWidget lang={lang}/>
      <nav className={`bottom-nav ${siteUi.showBottomLabels === false ? 'labels-hidden' : ''}`} aria-label={ar ? 'التنقل الرئيسي' : 'Main navigation'}>
        <div className="bottom-nav-glass" onPointerMove={dockMove} onPointerLeave={dockReset}>{nav.map(([href, Icon, key]) => <NavLink key={href} to={href} end={href === '/'} className={({ isActive }) => `bottom-link ${isActive ? 'active' : ''}`}><Icon size={21} strokeWidth={1.6}/><small>{t[key]}</small></NavLink>)}</div>
      </nav>
      <footer className="site-footer">
        <div className="footer-main shell"><div className="footer-brand"><BrandMark/><p>{t.footerTag}</p></div><div className="footer-links"><NavLink to="/services">{t.services}</NavLink><NavLink to="/store">{t.store}</NavLink><NavLink to="/projects">{t.projects}</NavLink><NavLink to="/about">{t.about}</NavLink><NavLink to="/certification">{t.certified}</NavLink></div><div className="footer-contact"><span><MapPin size={15}/>{ar ? business.locationAr : business.locationEn}</span><a href={`mailto:${business.email}`}>{business.email}</a><a href={`tel:${business.phones[0]}`} dir="ltr">{business.phones.join(' · ')}</a></div></div>
        <div className="footer-bottom shell"><span>© {new Date().getFullYear()} BALQEES FLORAL</span><span>{ar ? 'من مكة، بكل عناية.' : 'FROM MAKKAH, WITH CARE.'}</span></div>
      </footer>
      <span className="sr-only" role="status" aria-live="polite">{ar ? `التصميم الحالي: ${season.ar}` : `Current theme: ${season.en}`}</span>
    </div>
  </SeasonContext.Provider>;
}
