# Balqees Floral v10.45.0 — Mobile / Commerce / Settings pass

## What changed
- Added a final responsive hardening layer (`src/responsive-polish.css`) to stop viewport splitting on phone widths and force complex grids to collapse safely.
- Raised the readable type baseline across the B2B portal and individual-account surfaces; removed the 5–8px visual scale from practical UI content.
- Kept the expressive hero treatment where it belongs (home/store/dashboard) and converted secondary operational/account heroes into compact functional page intros.
- Made appearance controls materially affect the portal: density, typography scale, interface style, decorations, glass strength, background motion, card style, sidebar mode, homepage mode, accessibility and image-loading behavior.
- Appearance changes now preview immediately in Settings while the existing autosave persists them.
- Image-loading preference now changes actual `<img>` loading/fetch behavior and applies to images added after navigation/render.
- Preserved existing real procurement, finance, notification, MFA and organization-setting RPC/database flows.

## Mobile targets
- 360–430px phone widths: no page-level horizontal split; data tables/matrices retain local horizontal scroll when necessary.
- 460–680px large phones: action groups collapse, settings panels become single-column, drawers/modals remain inside viewport.
- 680–900px tablets: portal sidebar becomes drawer/dock and page grids collapse without fixed-width overflow.

## Deliberate hero policy
- Keep: public Home, public/individual Store, B2B Dashboard.
- Compact: Orders, Request Wizard, Team, Smart Care, contract/site detail, individual Orders/Settings/Security/Documents.

## Validation commands
- `npm run verify:source`
- `npm run build`
