# Balqees Floral v10.16 — Individual Favorites

Route: `/account/favorites`

Implemented as a quiet decision workspace instead of a simple heart list.

## Implemented
- Synced favorites stored in `customer_favorites` under existing ownership RLS.
- Store and product-detail heart controls for individual accounts.
- Product/saved-price snapshot at favorite time so unavailable products remain recognizable.
- Current-price vs saved-price transparency, including price drops and increases.
- Current sale display only when live pricing actually reports an offer.
- Collections using the existing `collection_name`, with in-place organization and new-list naming.
- Optional personal note: “why I saved it”.
- Search, category filter and calm sorting: recent, old, price, my views, offers.
- “Recently saved” shortcut for larger favorite libraries.
- Quick View; mobile opens as a bottom sheet.
- Add to cart without leaving favorites; favorite stays saved.
- Add all available items from the selected collection to cart.
- Unavailable products stay saved and link to same-category alternatives.
- Lightweight 2–3 item same-category comparison.
- Up to three taste-related suggestions based on saved categories/tags/budget; no endless carousel.
- Empty state with store CTA and up to three categories.
- Mobile two-column favorite grid.
- Favorites, product views and first cart-adds feed `customer_interest_events` as preference signals.

## Validation
- TypeScript parser syntax pass completed for changed JS/JSX files.
- Supabase columns and authenticated CRUD privileges verified.
- Security Advisor reviewed after the schema change; no new favorites-specific security-definer surface was introduced.
- Full Vite build could not be completed in the work container because `npm ci` timed out and left no Vite executable. No dependency versions were changed for the feature.
