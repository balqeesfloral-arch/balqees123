# Validation v10.36 — B2B Institutional Catalog / Page 7

## Delivered
- `/portal/catalog` rebuilt as **Balqees Institutional Catalog**: Showroom + Procurement Catalog + Inspiration Center rather than a B2C checkout page.
- Site-aware catalog context: selecting a hotel/site changes eligible active contract pricing returned by the secure catalog RPC.
- Search and filters for space, style and real availability.
- Editable Spaces and Styles taxonomy.
- Curated Collections with product membership, featured state, publication/scheduling window and organization targeting.
- Seasonal/marketing Campaigns with products, collections, audience and scheduling.
- Inspiration boards that can be converted into a request draft.
- Product detail modal with suitable spaces/styles, dimensions, care, light, availability and role-safe pricing.
- Product comparison for up to three items.
- "Previously ordered" and organization-exclusive badges come from real organization data.
- Add product / collection / inspiration to the **organization request draft**, not direct B2C checkout.
- Cross-device organization draft persistence through `organization_cart_items`; the Smart Request Wizard restores and clears that organization draft correctly.

## Admin Institutional Catalog Studio
- New `/admin/institutional-catalog` section.
- Institutional product enablement/profile on top of the existing generic `products` table.
- Pricing modes: visible, from, quotation, contract-only.
- Availability modes: requestable, quantity-dependent, pre-order, seasonal, unavailable.
- Indoor/outdoor, dimensions, colors, care, light, institutional notes.
- Space/style assignment per product.
- Collection editor with products and selected-organization visibility.
- Per-organization visibility, exclusive-product flag, price override and availability override.
- Contract-specific product price editor.
- Campaign editor and Inspiration editor.
- Media Library uploads to existing `catalog-media` Storage, with metadata in `catalog_media_assets`.
- Cover/banner fields can select an asset directly from Media Library.
- Spaces can select cover media from the library; Collections and Inspiration support managed gallery image sets.
- Client product details render the existing product gallery; Collection and Inspiration galleries are visible in the institutional portal.
- Media deletion is blocked in the UI when the asset is referenced by a Space, Collection, Campaign or Inspiration item.

## Live Supabase migrations
- `b2b_institutional_catalog_v10_36`
- `b2b_catalog_taxonomy_seed_v10_36`
- `b2b_institutional_catalog_admin_read_v10_36`
- `b2b_catalog_rpc_column_guard_v10_36`

## Live Supabase verification
- 18 B2B catalog tables verified present.
- 8 default editable Spaces verified.
- 7 default editable Styles verified.
- `public.get_organization_catalog_products(...)` verified present.
- Realtime verified for `catalog_collections` and `catalog_campaigns`.

## Security / pricing notes
- Existing consumer store tables are not replaced; the institutional layer sits above `products` so Page 7 does not break the individual storefront.
- Organization members do not read raw organization/contract pricing tables directly.
- A narrow SECURITY DEFINER implementation in the private schema checks `auth.uid()`, active organization membership and selected-site ownership before calculating the safe catalog projection.
- The public RPC returns no raw `base_price` column.
- Numeric `display_price` is returned only for members with `view_finance` or `accept_quotes`.
- Contract price has precedence only for an active/expiring contract that covers the selected site.
- Organization-specific visibility is enforced server-side in the RPC / RLS model, not only hidden in React.
- Draft/private content administration is restricted to Balqees admins through RLS.
- No service-role secret is used by the client.

## Static validation
- TypeScript parser: 93 JS/JSX/MJS source files, 0 syntax errors.
- Relative imports: 309 checked, 0 missing.
- Plain JS/MJS: `node --check` passed.
- CSS brace balance passed.
- Client catalog route: exactly 1.
- Admin institutional-catalog route: exactly 1.
- `package.json` and `package-lock.json`: version 10.36.0.

## Supabase Advisors after final v10.36 hardening
- Security Advisor: only the pre-existing `Leaked Password Protection Disabled` warning.
- Performance Advisor: only `unused_index` INFO; no missing-FK-index or multiple-permissive-policy issue introduced by v10.36.

## Production build caveat
A production build is **not claimed as passed**. `npm ci --no-audit --no-fund` hit the execution-environment transport timeout before Vite became available. Partial `node_modules` was removed from the delivery package. Before deployment run:

```bash
npm ci
npm run build
```
