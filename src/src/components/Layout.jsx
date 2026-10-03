import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Store, Images, Info, UserRound, Languages, BadgeCheck, Sparkles } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa6';
import BrandMark from './BrandMark';
import Ornament from './Ornament';
import SeasonExperience from './SeasonExperience';
import SeasonMessageWidget from './SeasonMessageWidget';
import { getSaudiSeason } from '../lib/season';
import { business, copy } from '../lib/content';

const nav = [
  ['/', Home, 'home'],
  ['/services', Store, 'services'],
  ['/projects', Images, 'projects'],
  ['/about', Info, 'about'],
  ['/account', UserRound, 'account']
];

const seasonCatalog = {
  default: { key: 'default', ar: 'الأساسي', en: 'Default' },
  ramadan: { key: 'ramadan', ar: 'رمضان', en: 'Ramadan' },
  eid: { key: 'eid', ar: 'عيد الفطر', en: 'Eid Al-Fitr' },
  adha: { key: 'adha', ar: 'عيد الأضحى', en: 'Eid Al-Adha' },
  hajj: { key: 'hajj', ar: 'موسم الحج', en: 'Hajj Season' },
  national: { key: 'national', ar: 'اليوم الوطني', en: 'National Day' }
};

export default function Layout({ lang, setLang, children }) {
  const location = useLocation();
  const t = copy[lang];
  const detectedSeason = getSaudiSeason();
  const isAr = lang === 'ar';
  const [seasonTestOpen, setSeasonTestOpen] = useState(false);
  const [seasonOverride, setSeasonOverride] = useState('auto');
  const season = seasonOverride === 'auto' ? detectedSeason : seasonCatalog[seasonOverride];

  const handleDockPointerMove = (event) => {
    if (typeof window === 'undefined' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const dockRect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--dock-cursor-x', `${event.clientX - dockRect.left}px`);
    const links = Array.from(event.currentTarget.querySelectorAll('.bottom-link'));
    links.forEach((link) => {
      const rect = link.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const distance = Math.abs(event.clientX - center);
      const influence = Math.max(0, 1 - distance / 135);
      link.style.setProperty('--dock-influence', influence.toFixed(3));
      link.style.setProperty('--dock-scale', (1 + influence * 0.105).toFixed(3));
      link.style.setProperty('--dock-lift', (-2 - influence * 7).toFixed(2));
    });
  };

  const resetDockMotion = (event) => {
    event.currentTarget.querySelectorAll('.bottom-link').forEach((link) => {
      link.style.setProperty('--dock-influence', '0');
      link.style.setProperty('--dock-scale', '1');
      link.style.setProperty('--dock-lift', '0');
    });
  };

  return (
    <div className={`app season-${season.key}`} dir={isAr ? 'rtl' : 'ltr'} data-season={season.key}>
      <div className="site-noise" />
      <SeasonExperience season={season} lang={lang} />
      <SeasonMessageWidget season={season} lang={lang} />
      <Ornament className="ambient-ornament ambient-one" />
      <Ornament className="ambient-ornament ambient-two" />

      <header className="topbar shell">
        <NavLink to="/" className="brand-link"><BrandMark /></NavLink>
        <div className="top-actions">
          {season.key !== 'default' && <div className="season-chip"><span className="season-dot" />{isAr ? season.ar : season.en}</div>}

          {/* TEMPORARY SEASON DESIGN TESTER — remove this block before final launch. */}
          <div className="season-test-wrap">
            <button className="season-test-trigger" onClick={() => setSeasonTestOpen((v) => !v)} aria-expanded={seasonTestOpen}>
              <Sparkles size={16}/><span>{isAr ? 'اختبار التصاميم' : 'Theme test'}</span>
            </button>
            {seasonTestOpen && (
              <div className="season-test-panel">
                <div className="season-test-head"><b>{isAr ? 'اختبار المواسم' : 'Season preview'}</b><small>{isAr ? 'مؤقت — يُحذف قبل النشر النهائي' : 'Temporary — remove before launch'}</small></div>
                <div className="season-test-options">
                  <button className={seasonOverride === 'auto' ? 'active' : ''} onClick={() => setSeasonOverride('auto')}>{isAr ? 'تلقائي' : 'Auto'}</button>
                  {Object.values(seasonCatalog).map((item) => (
                    <button key={item.key} className={seasonOverride === item.key ? 'active' : ''} onClick={() => setSeasonOverride(item.key)}>{isAr ? item.ar : item.en}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className="icon-button" onClick={() => setLang(isAr ? 'en' : 'ar')} aria-label="Switch language">
            <Languages size={18}/><span>{isAr ? 'EN' : 'AR'}</span>
          </button>
        </div>
      </header>

      <main key={location.pathname} className="page-enter">{children}</main>

      <div className="floating-stack">
        <NavLink
          to="/certification"
          className="floating-action certification-fab icon-only"
          aria-label={t.certified}
        >
          <BadgeCheck size={21} strokeWidth={1.8}/>
        </NavLink>
        <a
          className="floating-action whatsapp-fab icon-only"
          href={`https://wa.me/966${business.whatsapp.slice(1)}`}
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp"
        >
          <FaWhatsapp size={23}/>
        </a>
      </div>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <div className="bottom-nav-glass" onPointerMove={handleDockPointerMove} onPointerLeave={resetDockMotion}>
          {nav.map(([href, Icon, key]) => (
            <NavLink
              key={href}
              to={href}
              end={href === '/'}
              className={({isActive}) => `bottom-link ${isActive ? 'active' : ''}`}
              style={{ '--dock-influence': 0, '--dock-scale': 1, '--dock-lift': 0 }}
            >
              <span className="bottom-press-surface" aria-hidden="true" />
              <span className="bottom-icon"><Icon size={21} strokeWidth={1.9}/></span>
              <small>{t[key]}</small>
              <span className="bottom-active-dot" aria-hidden="true" />
            </NavLink>
          ))}
        </div>
      </nav>

      <footer className="footer shell">
        <div className="footer-brand"><BrandMark/><p>{t.footerTag}</p></div>
        <div className="footer-meta"><span>{business.locationAr}</span><span>{business.phones.join(' · ')}</span><span>{business.email}</span></div>
        <div className="footer-copy">© {new Date().getFullYear()} {business.nameEn}</div>
      </footer>
    </div>
  );
}
