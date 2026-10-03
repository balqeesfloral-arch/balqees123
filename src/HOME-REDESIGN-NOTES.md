# Balqees Floral — Premium Home Redesign

## What changed
- Rebuilt the home page around selected real Balqees project photography.
- Added a cinematic three-image hero slider with manual controls.
- Added eight business solution cards: hospitality, floral styling, indoor plants, landscaping, maintenance, vases/planters/watering, Hajj & Umrah hospitality, and seasonal events.
- Added hospitality-focused B2B section, real-project mosaic, maintenance process, and premium WhatsApp CTA.
- Added scroll-reveal interactions and responsive mobile/tablet layouts without adding another animation library.
- Selected and lightly optimized only the stronger uploaded images; lower-quality screenshots/product-shelf shots were intentionally excluded from the home page.

## Temporary seasonal theme tester
A temporary **اختبار التصاميم / Theme test** button was added to the top bar.
It previews:
- Default
- Ramadan
- Eid
- Hajj season
- Saudi National Day
- Auto (uses the Saudi calendar logic already in the project)

Before final production launch, remove the block marked:
`TEMPORARY SEASON DESIGN TESTER`
in `src/components/Layout.jsx`, then remove the related tester CSS block in `src/styles.css`.

## Main edited files
- `src/pages/Home.jsx`
- `src/components/Layout.jsx`
- `src/styles.css`
- `public/assets/home/*`
