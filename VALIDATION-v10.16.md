# Balqees Floral v10.16 — Validation

## Individual page 4: Favorites

- Route: `/account/favorites`
- Store heart button connected to `customer_favorites` for individual accounts.
- Product details heart button connected to the same source of truth.
- Collections and notes persist in Supabase.
- Favorites retain a lightweight product and price snapshot for unavailable products and price-change transparency.
- Adding a favorite to cart does not remove it from favorites.
- Collection bulk add skips unavailable products and reports the skipped count.
- Quick View respects min/max/tracked stock quantity limits.
- Compare mode is capped at three products and restricted to the same category.
- Personalized suggestions are capped at three and disabled when `customer_preferences.personalized_recommendations = false`.
- Empty/loading/error/no-results states implemented.
- Mobile layout uses a two-column product grid and a bottom-sheet Quick View.

## Static verification

- TypeScript JSX parser: all project JS/JSX files parsed without syntax errors.
- CSS brace balance checked successfully.
- `node_modules` excluded from the deliverable.
- Full Vite build was not claimed because dependency installation timed out in the execution environment.

## Supabase verification

Confirmed on the live project:
- `customer_favorites.unit_price_snapshot`
- `customer_favorites.price_snapshot_at`
- `customer_favorites.product_snapshot`
- `customer_favorites.updated_at`
- `customer_favorites_user_collection_created_idx`

The v10.16 schema change does not add a public `SECURITY DEFINER` RPC.
