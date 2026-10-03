import { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUpRight, X } from 'lucide-react';
import { useSeason, whatsappHref } from '../lib/season-design';
import SeasonObject, { seasonInteractions } from './SeasonObject';

export default function SeasonMessageWidget({ lang }) {
  const { season } = useSeason();
  const { pathname } = useLocation();
  const [phase, setPhase] = useState('idle');
  const ref = useRef(null);
  const trigger = useRef(null);
  const cardId = useId();
  const i = lang === 'ar' ? 0 : 1;
  const interaction = seasonInteractions[season.key];
  const active = phase !== 'idle';
  const open = phase === 'open';
  const close = (restoreFocus = false) => {
    setPhase('idle');
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  };

  useEffect(() => setPhase('idle'), [season.key, pathname]);
  useEffect(() => {
    if (phase !== 'playing') return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setPhase('open'), reducedMotion ? 0 : interaction.delay);
    return () => window.clearTimeout(timer);
  }, [phase, interaction.delay]);
  useEffect(() => {
    if (!active) return;
    const dismiss = e => { if (!ref.current?.contains(e.target)) close(); };
    const escape = e => { if (e.key === 'Escape') close(true); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [active]);

  const greeting = <aside className={`season-greeting greeting-floating object-${season.key} ${active ? 'is-active' : ''} ${open ? 'is-open' : ''}`} ref={ref} data-phase={phase}>
    {open && <section id={cardId} className="greeting-card" aria-label={season.greeting[i]}>
      <div className="greeting-cover"><img src={season.image.replace('.webp', '-mobile.webp')} alt="" /></div>
      <button className="greeting-close" onClick={() => close(true)} aria-label={i === 0 ? 'إغلاق الرسالة' : 'Close greeting'}><X size={20}/></button>
      <div className="greeting-content">
        <span className="eyebrow">BALQEES FLORAL</span><h2>{season.greeting[i]}</h2><p>{season.message[i]}</p>
        <a href={whatsappHref()} target="_blank" rel="noreferrer">{i === 0 ? 'يسعدنا تواصلك' : 'We would love to hear from you'}<ArrowUpRight size={17}/></a>
      </div>
    </section>}
    <button ref={trigger} className="greeting-trigger" onClick={() => active ? close() : setPhase('playing')}
      aria-label={active ? (i === 0 ? 'إغلاق الرسالة' : 'Close greeting') : interaction.label[i]}
      aria-expanded={open} aria-controls={open ? cardId : undefined}>
      <SeasonObject seasonKey={season.key}/>
      <span className="greeting-hint" aria-hidden="true">{active ? (i === 0 ? 'إغلاق الرسالة' : 'Close greeting') : interaction.hint[i]}</span>
    </button>
    <span className="sr-only" role="status" aria-live="polite">{open ? `${season.greeting[i]}. ${season.message[i]}` : ''}</span>
  </aside>;
  return greeting;
}
