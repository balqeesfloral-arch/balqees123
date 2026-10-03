import { useEffect, useMemo, useRef } from 'react';

const starLayout = [
  [7, 14, 1.2, .75], [14, 31, 2.8, .55], [22, 11, .4, .9], [30, 22, 3.7, .7],
  [39, 8, 2.1, .6], [48, 18, 4.2, .82], [58, 9, 1.7, .62], [68, 25, 3.2, .9],
  [78, 13, .9, .58], [88, 28, 4.7, .74], [94, 8, 2.5, .5], [12, 53, 4.1, .54],
  [27, 66, 1.4, .72], [43, 49, 3.4, .5], [63, 59, .7, .68], [82, 51, 2.2, .86],
  [92, 72, 4.4, .6], [55, 77, 1.1, .55]
];

const confettiLayout = [
  [4, 11, 0], [10, 28, 1], [17, 7, 2], [23, 19, 3], [31, 5, 1], [38, 25, 2],
  [47, 12, 0], [55, 31, 3], [63, 8, 2], [72, 22, 1], [80, 5, 0], [88, 27, 3],
  [95, 13, 2], [15, 58, 3], [42, 64, 0], [69, 55, 1], [90, 70, 2]
];

const floralDots = [
  [8, 16, 1.1], [14, 32, 2.1], [18, 8, 3.4], [32, 20, 0.9], [36, 9, 2.8], [52, 22, 1.7],
  [65, 12, 2.6], [74, 6, 1.1], [84, 20, 3.6], [90, 10, 2.1], [12, 64, 2.5], [36, 72, 1.3],
  [58, 58, 3.8], [74, 70, 2.3], [88, 56, 1.8]
];

function RealCrescent({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 220 220" aria-hidden="true">
      <defs>
        <radialGradient id="crescentGold" cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff7d6" />
          <stop offset="0.25" stopColor="#f8e5ae" />
          <stop offset="0.58" stopColor="#dab46d" />
          <stop offset="1" stopColor="#8d6330" />
        </radialGradient>
        <linearGradient id="crescentEdge" x1="0" x2="1">
          <stop offset="0" stopColor="rgba(255,255,255,.85)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id="crescentShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#86602b" floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter="url(#crescentShadow)">
        <path d="M138 21c-18 6-36 20-49 39-32 48-19 111 29 143 16 11 35 17 54 19-32 9-69 4-100-17C14 166-2 93 38 38c24-34 61-50 100-48Z" fill="url(#crescentGold)" />
        <path d="M126 37c-47 16-69 70-49 116 8 18 20 31 34 39-19-3-38-12-53-28-41-42-40-111 2-153 20-20 45-31 72-33-2 0-4 0-6 1Z" fill="rgba(255,255,255,.18)" />
        <path d="M138 21c-18 6-36 20-49 39-32 48-19 111 29 143" fill="none" stroke="url(#crescentEdge)" strokeWidth="6" strokeLinecap="round" opacity=".75" />
      </g>
    </svg>
  );
}

function RealLantern({ className = '', delay = 0 }) {
  return (
    <svg className={className} style={{ '--delay': `${delay}s` }} viewBox="0 0 110 220" aria-hidden="true">
      <defs>
        <linearGradient id="lanternMetal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ecd7ab" />
          <stop offset="0.45" stopColor="#b78945" />
          <stop offset="1" stopColor="#7a5527" />
        </linearGradient>
        <radialGradient id="lanternGlass" cx="50%" cy="42%" r="70%">
          <stop offset="0" stopColor="rgba(255,250,231,.95)" />
          <stop offset="0.35" stopColor="rgba(241,205,126,.65)" />
          <stop offset="1" stopColor="rgba(194,131,58,.18)" />
        </radialGradient>
        <filter id="lanternGlow">
          <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#efc15d" floodOpacity="0.55" />
        </filter>
      </defs>
      <g className="real-lantern-sway">
        <path d="M55 0v32" className="lantern-chain" />
        <path d="M44 32h22" className="lantern-chain" />
        <path d="M33 38h44l-8 16H41z" fill="url(#lanternMetal)" opacity=".92" />
        <path d="M27 57h56l-9 96H36z" fill="rgba(87,54,17,.23)" stroke="url(#lanternMetal)" strokeWidth="3" />
        <path d="M36 67h38l-6 76H42z" fill="url(#lanternGlass)" filter="url(#lanternGlow)" opacity=".95" />
        <path d="M44 80h22M42 101h26M40 121h30" className="lantern-cross" />
        <path d="M42 67l-6 76M68 67l6 76" className="lantern-cross" opacity=".7" />
        <path d="M42 153h26l10 14H32z" fill="url(#lanternMetal)" />
        <path d="M55 168v29" className="lantern-chain" />
        <path d="M44 197h22" className="lantern-chain" />
        <ellipse cx="55" cy="104" rx="12" ry="36" fill="rgba(255,239,189,.28)" opacity=".9" />
      </g>
    </svg>
  );
}

function PalmSceneSvg({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 340 320" aria-hidden="true">
      <defs>
        <linearGradient id="trunkGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9b7442" />
          <stop offset="0.5" stopColor="#6c4a27" />
          <stop offset="1" stopColor="#4f3418" />
        </linearGradient>
        <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#73b868" />
          <stop offset="0.45" stopColor="#2e8d4c" />
          <stop offset="1" stopColor="#13592c" />
        </linearGradient>
        <filter id="palmShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#0b5d2d" floodOpacity="0.18" />
        </filter>
      </defs>
      <g filter="url(#palmShadow)">
        <g className="palm-back palm-one">
          <path d="M95 286c8-78 9-143 2-207" fill="none" stroke="url(#trunkGrad)" strokeWidth="18" strokeLinecap="round" />
          <path d="M95 110c-36-21-62-25-85-17 24 7 44 20 60 40" fill="none" stroke="url(#leafGrad)" strokeWidth="12" strokeLinecap="round" />
          <path d="M99 98c-27-32-44-48-69-55 14 20 28 38 42 58" fill="none" stroke="url(#leafGrad)" strokeWidth="11" strokeLinecap="round" />
          <path d="M103 98c25-35 45-51 74-58-16 18-31 37-45 58" fill="none" stroke="url(#leafGrad)" strokeWidth="11" strokeLinecap="round" />
          <path d="M103 112c37-23 64-27 90-19-24 8-45 22-64 41" fill="none" stroke="url(#leafGrad)" strokeWidth="12" strokeLinecap="round" />
          <path d="M99 88c0-30-4-52-15-76 16 16 28 40 31 67" fill="none" stroke="url(#leafGrad)" strokeWidth="11" strokeLinecap="round" />
        </g>
        <g className="palm-front palm-two">
          <path d="M237 300c-9-71-10-123-2-176" fill="none" stroke="url(#trunkGrad)" strokeWidth="21" strokeLinecap="round" />
          <path d="M235 137c-47-25-77-28-102-18 29 10 51 24 73 49" fill="none" stroke="url(#leafGrad)" strokeWidth="14" strokeLinecap="round" />
          <path d="M243 126c35-42 61-60 94-67-21 20-39 42-58 65" fill="none" stroke="url(#leafGrad)" strokeWidth="13" strokeLinecap="round" />
          <path d="M235 117c-30-44-51-63-86-73 21 23 37 47 52 71" fill="none" stroke="url(#leafGrad)" strokeWidth="13" strokeLinecap="round" />
          <path d="M239 110c-1-38 2-67 14-101 16 22 23 51 20 88" fill="none" stroke="url(#leafGrad)" strokeWidth="13" strokeLinecap="round" />
          <path d="M244 137c43-22 74-27 100-20-27 10-53 26-74 47" fill="none" stroke="url(#leafGrad)" strokeWidth="14" strokeLinecap="round" />
          <g className="date-cluster">
            <circle cx="224" cy="142" r="5" fill="#c3831d" />
            <circle cx="233" cy="151" r="5" fill="#d48b22" />
            <circle cx="244" cy="145" r="5" fill="#c9801b" />
            <circle cx="238" cy="158" r="5" fill="#b76e10" />
          </g>
        </g>
      </g>
    </svg>
  );
}

function BaseBotanicalIllustration() {
  return (
    <svg className="base-botanical-illustration" viewBox="0 0 360 360" aria-hidden="true">
      <defs>
        <linearGradient id="stemGrad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#496448" />
          <stop offset="1" stopColor="#89a173" />
        </linearGradient>
        <linearGradient id="leafMain" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8f1df" />
          <stop offset="1" stopColor="#93ab86" />
        </linearGradient>
        <radialGradient id="rosePink" cx="50%" cy="42%" r="58%">
          <stop offset="0" stopColor="#fff0f4" />
          <stop offset="0.35" stopColor="#efc2cf" />
          <stop offset="1" stopColor="#b78394" />
        </radialGradient>
      </defs>
      <g className="base-botanical-float">
        <path d="M176 332c-6-102-10-166-28-243" fill="none" stroke="url(#stemGrad)" strokeWidth="7" strokeLinecap="round" />
        <path d="M176 322c5-92 15-166 48-242" fill="none" stroke="url(#stemGrad)" strokeWidth="6" strokeLinecap="round" opacity=".8" />
        <path d="M147 154c-50-19-86-14-119 16 40 5 76 0 112-15Z" fill="url(#leafMain)" opacity=".78" />
        <path d="M213 129c53-19 93-12 124 17-44 5-81 0-118-17Z" fill="url(#leafMain)" opacity=".82" />
        <path d="M173 112c-8-39 2-67 31-92 14 34 5 65-31 92Z" fill="url(#leafMain)" opacity=".92" />
        <path d="M201 220c34-10 62-5 86 18-31 4-58 1-83-15Z" fill="url(#leafMain)" opacity=".7" />
        <path d="M142 242c-28-7-49-2-68 15 24 4 45 2 65-11Z" fill="url(#leafMain)" opacity=".65" />
        <g className="hero-rose rose-a">
          <circle cx="128" cy="127" r="27" fill="url(#rosePink)" />
          <path d="M108 128c8-16 33-24 42 0-7 18-33 23-42 0Zm7-1c4 10 18 15 28 2-2-12-18-16-28-2Z" fill="#fff4f7" opacity=".6" />
        </g>
        <g className="hero-rose rose-b">
          <circle cx="229" cy="194" r="18" fill="url(#rosePink)" opacity=".85" />
          <path d="M216 194c4-10 22-14 28 0-5 11-22 14-28 0Z" fill="#fff4f7" opacity=".6" />
        </g>
      </g>
    </svg>
  );
}

function RamadanHeritageIllustration() {
  return (
    <svg className="ramadan-heritage-illustration" viewBox="0 0 430 330" aria-hidden="true">
      <defs>
        <linearGradient id="ramWall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0e2c6" />
          <stop offset="0.55" stopColor="#d2b483" />
          <stop offset="1" stopColor="#8b6a42" />
        </linearGradient>
        <linearGradient id="ramShadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(21,48,40,.08)" />
          <stop offset="1" stopColor="rgba(10,20,16,.22)" />
        </linearGradient>
        <radialGradient id="ramLight" cx="50%" cy="42%" r="60%">
          <stop offset="0" stopColor="#fff7dd" />
          <stop offset="0.45" stopColor="#edcf8f" />
          <stop offset="1" stopColor="rgba(237,207,143,0)" />
        </radialGradient>
        <linearGradient id="ramWood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a5230" />
          <stop offset="0.55" stopColor="#4e341d" />
          <stop offset="1" stopColor="#2f1c11" />
        </linearGradient>
        <filter id="ramPanelShadow" x="-20%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#3f2a16" floodOpacity="0.22" />
        </filter>
      </defs>
      <g filter="url(#ramPanelShadow)">
        <path d="M48 302c0-121 37-212 166-212s166 91 166 212" fill="url(#ramWall)" opacity=".16" />
        <path d="M74 302V165c0-72 58-130 130-130s130 58 130 130v137" fill="rgba(255,252,246,.18)" stroke="rgba(215,187,130,.55)" strokeWidth="4" />
        <path d="M111 302V177c0-51 41-92 92-92s92 41 92 92v125" fill="url(#ramShadow)" opacity=".28" />
        <path d="M132 302V188c0-38 31-69 69-69s69 31 69 69v114" fill="rgba(18,55,46,.78)" stroke="rgba(230,203,145,.48)" strokeWidth="2.5" />
        <path d="M151 138h101" stroke="rgba(244,222,176,.42)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M164 149h76" stroke="rgba(244,222,176,.28)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="202" cy="202" r="56" fill="url(#ramLight)" opacity=".82" />
        <g opacity=".92">
          <rect x="160" y="159" width="84" height="92" rx="2" fill="rgba(255,241,208,.07)" />
          <path d="M160 182h84M160 205h84M160 228h84" stroke="rgba(240,214,159,.32)" strokeWidth="2" />
          <path d="M181 159v92M202 159v92M223 159v92" stroke="rgba(240,214,159,.22)" strokeWidth="2" />
          <path d="M160 159 244 251M244 159 160 251" stroke="rgba(240,214,159,.12)" strokeWidth="1.5" />
        </g>
        <g>
          <path d="M120 302h168" stroke="url(#ramWood)" strokeWidth="12" strokeLinecap="round" />
          <path d="M140 278h128l-12 24H152Z" fill="url(#ramWood)" opacity=".96" />
          <ellipse cx="203" cy="267" rx="26" ry="8" fill="rgba(255,220,157,.32)" />
          <ellipse cx="203" cy="267" rx="16" ry="5.5" fill="rgba(92,55,20,.55)" />
          <circle cx="195" cy="267" r="2.6" fill="#deb15a" />
          <circle cx="203" cy="264.5" r="2.6" fill="#f1c96e" />
          <circle cx="211" cy="267" r="2.6" fill="#deb15a" />
        </g>
      </g>
    </svg>
  );
}

function HajjIllustration() {
  return (
    <svg className="hajj-illustration" viewBox="0 0 420 380" aria-hidden="true">
      <defs>
        <linearGradient id="kaabaGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c7a769" />
          <stop offset="1" stopColor="#7a5c2d" />
        </linearGradient>
        <linearGradient id="kaabaBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#242423" />
          <stop offset="1" stopColor="#060606" />
        </linearGradient>
      </defs>
      <g className="kaaba-scene-float">
        <ellipse cx="205" cy="300" rx="140" ry="34" fill="rgba(0,0,0,.08)" />
        <path d="M140 287c28-16 57-23 95-23 40 0 77 8 111 24" fill="none" stroke="rgba(194,166,104,.36)" strokeWidth="2.5" strokeDasharray="2 10" />
        <path d="M127 257c30-17 66-27 111-27 46 0 84 9 117 25" fill="none" stroke="rgba(194,166,104,.25)" strokeWidth="2" strokeDasharray="3 12" />
        <g className="kaaba-group">
          <path d="M162 153h102v108H162z" fill="url(#kaabaBody)" />
          <path d="M162 153h102v22H162z" fill="url(#kaabaGold)" />
          <path d="M264 153l26 20v108l-26-20z" fill="#171717" />
          <path d="M264 153l26 20H188l-26-20z" fill="#2d2d2d" opacity=".9" />
          <path d="M190 182h22v34h-22z" fill="#0a0a0a" stroke="url(#kaabaGold)" strokeWidth="2" />
          <path d="M162 175h102" stroke="rgba(255,236,190,.7)" strokeWidth="1.3" />
        </g>
        <g className="minaret-left">
          <path d="M90 110h16v120H90z" fill="#d9d5cc" />
          <path d="M86 110h24l-12-32z" fill="#ece8df" />
          <path d="M83 130h30v8H83z" fill="#c3bcae" />
          <path d="M98 72l8 9H90z" fill="#bea26f" />
        </g>
        <g className="minaret-right">
          <path d="M316 110h16v120h-16z" fill="#d9d5cc" />
          <path d="M312 110h24l-12-32z" fill="#ece8df" />
          <path d="M309 130h30v8h-30z" fill="#c3bcae" />
          <path d="M324 72l8 9h-16z" fill="#bea26f" />
        </g>
      </g>
    </svg>
  );
}

function RamIllustration({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 300 240" aria-hidden="true">
      <defs>
        <radialGradient id="ramWool" cx="42%" cy="32%" r="80%">
          <stop offset="0" stopColor="#fff7ed" />
          <stop offset="0.5" stopColor="#efe4d1" />
          <stop offset="1" stopColor="#d5c0a2" />
        </radialGradient>
        <linearGradient id="ramFace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d8c19b" />
          <stop offset="1" stopColor="#a68858" />
        </linearGradient>
        <linearGradient id="ramHorn" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c49d68" />
          <stop offset="1" stopColor="#7a5a33" />
        </linearGradient>
      </defs>
      <g className="ram-real-float">
        <ellipse cx="158" cy="182" rx="92" ry="48" fill="url(#ramWool)" />
        <ellipse cx="115" cy="172" rx="40" ry="36" fill="url(#ramWool)" />
        <g className="ram-real-head">
          <path d="M76 146c-25-10-37-36-21-61 7 26 19 38 41 45" fill="none" stroke="url(#ramHorn)" strokeWidth="12" strokeLinecap="round" />
          <path d="M141 145c25-10 37-36 21-61-7 26-19 38-41 45" fill="none" stroke="url(#ramHorn)" strokeWidth="12" strokeLinecap="round" />
          <ellipse cx="109" cy="132" rx="33" ry="39" fill="url(#ramFace)" />
          <path d="M80 117c-14-5-27-1-34 10 16 5 27 4 37-2" fill="#c9a97a" />
          <path d="M137 117c15-5 28 0 34 10-16 5-27 4-37-2" fill="#c9a97a" />
          <circle cx="97" cy="129" r="4" fill="#362b20" />
          <circle cx="121" cy="129" r="4" fill="#362b20" />
          <path d="M104 145c4 4 9 4 13 0" fill="none" stroke="#5f4b34" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g className="ram-real-legs">
          <path d="M127 206v22M170 206v22M198 187c17 8 28 20 33 37" fill="none" stroke="#92744a" strokeWidth="8" strokeLinecap="round" />
          <path d="M231 224l15-7M231 224l11 4" fill="none" stroke="#6a522f" strokeWidth="5" strokeLinecap="round" />
        </g>
        <path d="M86 183c9-8 18-11 31-14M132 147c18 5 35 14 48 30" fill="none" stroke="rgba(128,95,53,.35)" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function BaseScene() {
  return (
    <>
      <div className="base-orb base-orb-a" />
      <div className="base-orb base-orb-b" />
      <div className="base-floral-motes">
        {floralDots.map(([x, y, d], i) => (
          <span key={i} style={{ '--x': `${x}%`, '--y': `${y}%`, '--delay': `${d}s` }} />
        ))}
      </div>
      <BaseBotanicalIllustration />
      <div className="base-soft-grid" />
    </>
  );
}

function RamadanScene({ lang }) {
  return (
    <>
      <div className="ramadan-radiance" />
      <div className="ramadan-arch-pattern" />
      <div className="ramadan-floor-glow" />
      <RamadanHeritageIllustration />
      <RealCrescent className="real-crescent ramadan-crescent" />
      <RealLantern className="real-lantern lantern-a" delay={0} />
      <RealLantern className="real-lantern lantern-b" delay={1.1} />
      <RealLantern className="real-lantern lantern-c" delay={2.2} />
      <div className="ramadan-stars premium-stars">
        {starLayout.map(([x, y, d, s], i) => (
          <span key={i} style={{ '--x': `${x}%`, '--y': `${y}%`, '--delay': `${d}s`, '--scale': s }} />
        ))}
      </div>
    </>
  );
}

function EidScene({ lang }) {
  const ar = lang === 'ar';
  return (
    <>
      <div className="eid-radiance" />
      <RealCrescent className="real-crescent eid-crescent" />
      <div className="eid-light-string premium-string">
        {Array.from({ length: 10 }).map((_, i) => <i key={i} style={{ '--i': i }} />)}
      </div>
      <div className="eid-confetti premium-confetti">
        {confettiLayout.map(([x, y, r], i) => (
          <span key={i} className={`c${r}`} style={{ '--x': `${x}%`, '--y': `${y}%`, '--delay': `${(i % 6) * .55}s` }} />
        ))}
      </div>
    </>
  );
}

function HajjScene({ lang }) {
  const ar = lang === 'ar';
  return (
    <>
      <div className="hajj-geometry refined-geometry" />
      <HajjIllustration />
      <div className="hajj-rays" />
    </>
  );
}

function NationalScene({ lang }) {
  const ar = lang === 'ar';
  return (
    <>
      <div className="national-diriyah-pattern refined-diriyah" />
      <PalmSceneSvg className="national-palms" />
      <div className="national-sparks premium-stars">
        {starLayout.slice(0, 12).map(([x, y, d, s], i) => (
          <span key={i} style={{ '--x': `${x}%`, '--y': `${y}%`, '--delay': `${d}s`, '--scale': s }} />
        ))}
      </div>
      <div className="national-waveband" />
    </>
  );
}

function AdhaScene({ lang }) {
  const ar = lang === 'ar';
  return (
    <>
      <div className="adha-geometry refined-geometry" />
      <RealCrescent className="real-crescent adha-crescent" />
      <div className="adha-stars premium-stars">
        {starLayout.slice(0, 13).map(([x, y, d, s], i) => (
          <span key={i} style={{ '--x': `${x}%`, '--y': `${y}%`, '--delay': `${d}s`, '--scale': s }} />
        ))}
      </div>
      <div className="adha-ram-wrap real-ram-wrap" aria-hidden="true">
        <RamIllustration className="adha-ram real-ram" />
      </div>
    </>
  );
}

export default function SeasonExperience({ season, lang }) {
  const rootRef = useRef(null);
  const key = season?.key || 'default';
  const Scene = useMemo(() => {
    if (key === 'ramadan') return RamadanScene;
    if (key === 'eid') return EidScene;
    if (key === 'hajj') return HajjScene;
    if (key === 'national') return NationalScene;
    if (key === 'adha') return AdhaScene;
    return BaseScene;
  }, [key]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    let raf = 0;
    const onMove = (event) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - .5) * 2;
        const y = (event.clientY / window.innerHeight - .5) * 2;
        node.style.setProperty('--pointer-x', x.toFixed(3));
        node.style.setProperty('--pointer-y', y.toFixed(3));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, [key]);

  return (
    <div ref={rootRef} className={`season-experience season-scene-${key}`} aria-hidden="true">
      <div className="season-vignette" />
      <Scene lang={lang} />
    </div>
  );
}
