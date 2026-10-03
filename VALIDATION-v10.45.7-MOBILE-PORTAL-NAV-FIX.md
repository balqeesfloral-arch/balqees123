# Balqees Floral v10.45.7 — Mobile Portal Navigation Fix

Scope was intentionally limited to the individual customer portal navigation and mobile cart overlap.

## Changes
- Kept the existing desktop/tablet portal layout and all page content untouched.
- Mobile dock reduced to five icon-only actions: account home, store, orders, cart, more.
- Added a mobile "More" sheet containing all remaining individual account sections.
- Portal brand now returns to `/account`, never the public landing page.
- Added an authenticated-session resolving cover so `/account` does not flash the public/login shell while Supabase restores the session.
- Reduced and constrained the mobile cart continuation bar and placed it safely above the portal dock.
- Lifted the support assistant above the cart continuation bar only while that bar is present.

## Source verification
`npm run verify:source` passed: 363 relative imports checked; 131 source files scanned; version 10.45.7.

## Files intentionally changed
- `src/individual/IndividualPortalLayout.jsx`
- `src/individual/individual-account.css`
- `src/pages/Account.jsx`
- package version metadata and source verifier expected version

No page copy, Supabase schema/data, product data, pricing logic, checkout logic, desktop sidebar content, or other page internals were modified.
