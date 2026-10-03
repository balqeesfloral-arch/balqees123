import { useEffect, useMemo, useRef, useState } from 'react';

function RoseIcon() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className="season-symbol-svg rose-symbol">
      <defs>
        <radialGradient id="roseBloomOuter" cx="50%" cy="44%" r="58%">
          <stop offset="0" stopColor="#fff8fb" />
          <stop offset="0.34" stopColor="#f2cad8" />
          <stop offset="1" stopColor="#ab7187" />
        </radialGradient>
        <radialGradient id="roseBloomInner" cx="48%" cy="42%" r="54%">
          <stop offset="0" stopColor="#fffdfd" />
          <stop offset="0.44" stopColor="#f6dbe4" />
          <stop offset="1" stopColor="#c4889e" />
        </radialGradient>
        <linearGradient id="roseBudGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8d8e2" />
          <stop offset="0.55" stopColor="#d798ac" />
          <stop offset="1" stopColor="#8f5c70" />
        </linearGradient>
        <linearGradient id="roseStem" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#3d5f3d" />
          <stop offset="1" stopColor="#87a272" />
        </linearGradient>
      </defs>
      <g>
        <path d="M49 78c-4-15-4-31 0-48" fill="none" stroke="url(#roseStem)" strokeWidth="4" strokeLinecap="round"/>
        <path d="M45 60c-10-4-16-4-22 1 8 2 15 2 21-1Z" fill="#7f9a6f" opacity=".92"/>
        <path d="M53 52c9-5 17-5 23 1-8 3-16 3-23-1Z" fill="#8ba47a" opacity=".94"/>
        <g className="rose-bud-group">
          <path className="rose-bud" d="M48 17c8 0 14 5 14 13 0 10-7 19-14 24-7-5-14-14-14-24 0-8 6-13 14-13Z" fill="url(#roseBudGrad)"/>
          <path d="M48 23c4 0 7 3 7 7 0 6-4 10-7 13-3-3-7-7-7-13 0-4 3-7 7-7Z" fill="#fff4f8" opacity=".58"/>
          <path d="M40 48c6 3 12 3 17 0-1 4-4 7-9 9-4-2-7-5-8-9Z" fill="#6f925f" opacity=".92"/>
        </g>
        <g className="rose-bloom-group">
          <circle cx="48" cy="29" r="18" fill="url(#roseBloomOuter)"/>
          <path d="M35 30c6-11 24-16 31-1-2 8-8 12-16 14-8-2-13-4-15-13Z" fill="#f9e6ed" opacity=".72"/>
          <path d="M42 20c6-6 15-3 17 4-3 6-9 9-16 9-5-2-7-7-1-13Z" fill="url(#roseBloomInner)" opacity=".92"/>
          <path d="M48 13c7 1 14 6 16 12-5-2-9-2-14 0-5-2-9-2-14 0 2-6 8-11 12-12Z" fill="#fff5f8" opacity=".55"/>
        </g>
      </g>
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className="season-symbol-svg star-symbol">
      <defs>
        <radialGradient id="starGold" cx="50%" cy="45%" r="62%">
          <stop offset="0" stopColor="#fff8de"/>
          <stop offset=".34" stopColor="#f4d58e"/>
          <stop offset="1" stopColor="#a6732d"/>
        </radialGradient>
      </defs>
      <path d="M48 10 57 34 83 34 62 49 69 75 48 60 27 75 34 49 13 34 39 34Z" fill="url(#starGold)"/>
      <path d="M48 20 53 35 68 35 56 44 61 58 48 49 35 58 40 44 28 35 43 35Z" fill="rgba(255,255,255,.55)"/>
    </svg>
  );
}

function CannonIcon() {
  return (
    <svg viewBox="0 0 120 96" aria-hidden="true" className="season-symbol-svg cannon-symbol">
      <defs>
        <linearGradient id="cannonBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b98649"/>
          <stop offset="1" stopColor="#7a5224"/>
        </linearGradient>
        <linearGradient id="cannonMetal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1d8"/>
          <stop offset="1" stopColor="#c79c61"/>
        </linearGradient>
      </defs>
      <g>
        <circle cx="34" cy="72" r="12" fill="url(#cannonBody)"/>
        <circle cx="77" cy="72" r="12" fill="url(#cannonBody)"/>
        <path d="M28 66h52l8-16H40Z" fill="#8a6031"/>
        <path d="M47 23h44c8 0 13 4 13 11 0 7-6 12-13 12H47c-8 0-13-5-13-12 0-7 6-11 13-11Z" fill="url(#cannonMetal)"/>
        <path d="M83 32H48" stroke="rgba(89,55,17,.45)" strokeWidth="5" strokeLinecap="round"/>
        <circle cx="97" cy="34" r="5" fill="#fff0d0" opacity=".85"/>
      </g>
    </svg>
  );
}

function DallahIcon() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className="season-symbol-svg dallah-symbol">
      <defs>
        <linearGradient id="dallahGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#efe1b4"/>
          <stop offset=".45" stopColor="#c8a563"/>
          <stop offset="1" stopColor="#825d2b"/>
        </linearGradient>
      </defs>
      <g className="dallah-pot">
        <path d="M46 20c10-8 23-8 34 0-8 4-10 11-10 17H56c0-6-2-13-10-17Z" fill="url(#dallahGold)"/>
        <path d="M42 40h36c2 14 5 22 14 30 0 17-14 31-32 31S28 87 28 70c9-8 12-16 14-30Z" fill="url(#dallahGold)"/>
        <path d="M77 49c12-2 24 2 29 12-10 1-18-1-25-6" fill="none" stroke="url(#dallahGold)" strokeWidth="8" strokeLinecap="round"/>
        <path d="M47 44c-5-8-7-16-5-24 7 5 12 13 14 24" fill="none" stroke="url(#dallahGold)" strokeWidth="6" strokeLinecap="round"/>
        <path d="M64 43c7-11 17-18 28-18-5 8-14 15-24 19" fill="none" stroke="url(#dallahGold)" strokeWidth="6" strokeLinecap="round"/>
      </g>
      <path className="dallah-pour" d="M87 56c10 2 16 8 16 18" fill="none" stroke="rgba(245,244,235,.9)" strokeWidth="5" strokeLinecap="round"/>
      <path className="dallah-cup" d="M95 72c7 0 11 4 11 9s-4 9-11 9c-6 0-9-4-9-9s3-9 9-9Z" fill="rgba(255,248,230,.92)" opacity="0"/>
    </svg>
  );
}

function PlaneIcon() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className="season-symbol-svg plane-symbol">
      <defs>
        <linearGradient id="planeBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff"/>
          <stop offset="1" stopColor="#dad7d2"/>
        </linearGradient>
      </defs>
      <path d="M20 68 63 52l14-23c3-6 8-8 13-6 2 1 2 4 0 7L79 51l24-9c5-2 10-1 13 3l-36 20-2 21-10 4-4-17-28 11c-6 2-11 1-16-4Z" fill="url(#planeBody)" stroke="rgba(84,84,84,.3)" strokeWidth="2"/>
      <path d="M32 78c14 0 27 6 40 18" fill="none" stroke="rgba(255,255,255,.76)" strokeWidth="4" strokeLinecap="round" strokeDasharray="4 9"/>
    </svg>
  );
}

function RamIcon() {
  return (
    <svg viewBox="0 0 120 110" aria-hidden="true" className="season-symbol-svg sheep-symbol">
      <defs>
        <radialGradient id="sheepWool" cx="50%" cy="44%" r="62%">
          <stop offset="0" stopColor="#fffef8"/>
          <stop offset=".42" stopColor="#eadfc6"/>
          <stop offset="1" stopColor="#c2ad83"/>
        </radialGradient>
        <linearGradient id="sheepHorn" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c19a62"/>
          <stop offset="1" stopColor="#6f502e"/>
        </linearGradient>
      </defs>
      <g className="sheep-head-group">
        <ellipse cx="66" cy="64" rx="28" ry="19" fill="url(#sheepWool)"/>
        <ellipse cx="43" cy="52" rx="16" ry="16" fill="#e3d1b0"/>
        <path d="M26 49c-10-5-14-16-7-27 3 10 7 16 15 19" fill="none" stroke="url(#sheepHorn)" strokeWidth="6" strokeLinecap="round"/>
        <path d="M55 49c10-5 14-16 7-27-3 10-7 16-15 19" fill="none" stroke="url(#sheepHorn)" strokeWidth="6" strokeLinecap="round"/>
        <circle cx="38" cy="50" r="2.5" fill="#35291f"/>
        <circle cx="48" cy="50" r="2.5" fill="#35291f"/>
        <path d="M39 59c3 3 6 3 9 0" fill="none" stroke="#6d5337" strokeWidth="2.5" strokeLinecap="round"/>
      </g>
      <path d="M57 82v10M71 82v10M81 73c7 2 12 7 15 14" fill="none" stroke="#99774a" strokeWidth="5" strokeLinecap="round"/>
    </svg>
  );
}

const seasonMessages = {
  default: {
    label: { ar: 'لمسة بلقيس', en: 'Balqees note' },
    kicker: { ar: 'التوقيع النباتي', en: 'Signature floral note' },
    title: { ar: 'تفاصيل نباتية راقية', en: 'Elegant botanical details' },
    body: { ar: 'المشهد الأساسي لبلقيس مبني على صور حقيقية من أعمالنا، ونباتات ناعمة الحركة، ولمسة فاخرة تليق بالفنادق والشركات.', en: 'The default Balqees scene is grounded in real project imagery, subtle botanical movement and hospitality-grade elegance.' }
  },
  ramadan: {
    label: { ar: 'رسالة رمضان', en: 'Ramadan note' },
    kicker: { ar: 'نفحات الشهر الكريم', en: 'Blessed month atmosphere' },
    title: { ar: 'رمضان كريم', en: 'Ramadan Kareem' },
    body: { ar: 'هلال معدني فاخر، فوانيس مضيئة، ونجمة تفاعلية تكشف رسالة رمضانية راقية بمجرد الضغط عليها.', en: 'A premium metallic crescent, glowing lanterns and a star reveal a refined Ramadan note.' }
  },
  eid: {
    label: { ar: 'رسالة العيد', en: 'Eid note' },
    kicker: { ar: 'بهجة احتفالية', en: 'Festive joy' },
    title: { ar: 'عيدكم فرح وبهجة', en: 'A joyful Eid greeting' },
    body: { ar: 'مدفع العيد يطلق بطاقة التهنئة بجواره لتظهر رسالة احتفالية فاخرة تنسجم مع الزخارف والضياء.', en: 'The Eid cannon launches a luxury celebratory note beside it in a festive elegant way.' }
  },
  hajj: {
    label: { ar: 'رسالة الموسم', en: 'Season note' },
    kicker: { ar: 'ضيوف الرحمن', en: 'Guests of Allah' },
    title: { ar: 'خدمة ضيوف الرحمن', en: 'Serving the pilgrims' },
    body: { ar: 'طائرة أنيقة تكشف رسالة الضيافة الموسمية لتؤكد جاهزية بلقيس للمواسم المباركة في مكة المكرمة.', en: 'A graceful aircraft reveals a seasonal hospitality note celebrating Hajj in Makkah.' }
  },
  national: {
    label: { ar: 'رسالة وطنية', en: 'National note' },
    kicker: { ar: 'اليوم الوطني السعودي', en: 'Saudi National Day' },
    title: { ar: 'عزّنا بطبعنا', en: 'Our pride is in our character' },
    body: { ar: 'دلة سعودية فاخرة تميل كأنها تصب القهوة، ومعها تنكشف رسالة وطنية راقية مفعمة بالفخر والاعتزاز.', en: 'A refined dallah tilts as if pouring coffee, unveiling an elevated national message.' }
  },
  adha: {
    label: { ar: 'رسالة الأضحى', en: 'Adha note' },
    kicker: { ar: 'أيام مباركة', en: 'Blessed days' },
    title: { ar: 'عيد أضحى مبارك', en: 'Blessed Eid Al-Adha' },
    body: { ar: 'خروف فاخر المظهر يحيّي الزائر، وعند الضغط عليه تظهر رسالة العيد بأسلوب راقٍ وواضح.', en: 'A premium ram greets the visitor and reveals an elegant Eid Al-Adha message when tapped.' }
  }
};

function SeasonSymbol({ seasonKey }) {
  if (seasonKey === 'ramadan') return <StarIcon />;
  if (seasonKey === 'eid') return <CannonIcon />;
  if (seasonKey === 'hajj') return <PlaneIcon />;
  if (seasonKey === 'national') return <DallahIcon />;
  if (seasonKey === 'adha') return <RamIcon />;
  return <RoseIcon />;
}

export default function SeasonMessageWidget({ season, lang }) {
  const seasonKey = season?.key || 'default';
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => { setOpen(false); }, [seasonKey, lang]);

  useEffect(() => {
    const handlePointer = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const content = useMemo(() => seasonMessages[seasonKey] || seasonMessages.default, [seasonKey]);
  const isAr = lang === 'ar';

  return (
    <div ref={rootRef} className={`season-widget season-widget-${seasonKey} ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="season-widget-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={isAr ? content.label.ar : content.label.en}
      >
        <span className="season-widget-trigger-shell">
          <span className="season-widget-trigger-ring" aria-hidden="true" />
          <SeasonSymbol seasonKey={seasonKey} />
        </span>
      </button>

      <div className={`season-widget-panel ${open ? 'is-visible' : ''}`}>
        <small>{isAr ? content.kicker.ar : content.kicker.en}</small>
        <strong>{isAr ? content.title.ar : content.title.en}</strong>
        <p>{isAr ? content.body.ar : content.body.en}</p>
      </div>
    </div>
  );
}
