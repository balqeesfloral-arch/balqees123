# Balqees Floral — Immersive Seasonal Experience

This build upgrades seasonal themes from simple color swaps into global animated scenes rendered from `Layout.jsx` across every public page.

## Temporary theme tester
The top-bar tester includes:
- Auto
- Default
- Ramadan
- Eid Al-Fitr
- Eid Al-Adha
- Hajj Season
- Saudi National Day

The tester is intentionally temporary and is marked in `src/components/Layout.jsx` for removal before the final public launch.

## Seasonal scenes
- **Default:** drifting botanical petals, moving light orbs, botanical line art.
- **Ramadan:** luminous crescent, independently twinkling stars, three lanterns with separate swing/light timing, Ramadan greeting card, Islamic geometry.
- **Eid Al-Fitr:** warm ivory/rose-gold scene, crescent, festive geometric confetti, independent string lights, Eid greeting.
- **Eid Al-Adha:** geometric background, crescent/stars, animated elegant SVG ram that nods/waves and shows an Eid greeting.
- **Hajj:** black/gold geometric atmosphere, abstract Kaaba scene with orbital movement, Hajj hospitality copy.
- **National Day:** Saudi green illumination, Diriyah-inspired geometry, line-art palm, national phrases including “عزّنا بطبعنا” and “دام عزّك يا وطن”.

## Interaction and accessibility
- Subtle pointer parallax is applied to key decorative elements.
- `prefers-reduced-motion` disables seasonal animation for users who request reduced motion.
- Seasonal layers never capture clicks (`pointer-events: none`).
- No additional runtime library was introduced for these scenes; all visuals are CSS + SVG + React.

## Automatic season logic
`src/lib/season.js` detects Saudi time and Umm al-Qura dates. Eid Al-Adha has its own automatic state separate from Hajj.
