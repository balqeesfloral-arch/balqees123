# Balqees Floral v10.31 — B2B Operations Center / Page 2

## Scope
Radical rebuild of the organization portal Orders page into a real operations center, while preserving the existing Supabase data model and the v10.30 B2B home page.

## Implemented
- Premium Operations Center hero and live operational pulse.
- Real counters for active, actionable, live-execution, scheduled and completed orders.
- "Needs your action" is based on a linked quotation waiting for action **and** the current member having `can_accept_quotes`/owner permission.
- Members without approval rights may still view the linked quotation, but are not told that the decision is theirs.
- Financial values are shown only when the member may view finance or approve quotations.
- Real "Live / Next operation" surface using order status and latest `order_events` data.
- Two operational views: board and compact list.
- Board stages: intake/review, decision, execution, completed.
- Search by order reference, order number, customer label, PO, site/address, product name and SKU.
- Filters for order status, site, period (30/90 days/current year) and PO-only orders.
- Real operation-care state based on actionable quotation, open care case, elapsed requested date, cancellation or stable state.
- Detailed operation drawer with products, site, requested date, PO, conditional financial values, linked quote, linked care case, customer note and full order-events timeline.
- Real deep-link behavior for `/portal/orders/:id`; opening a card updates the URL and a direct URL opens the order drawer.
- Drawer supports backdrop close, close button and Escape; page scrolling is locked while open.
- Realtime refresh listens to organization `orders`, `quotations`, `support_conversations`, plus relevant new `order_events`.
- Repeat-order action for completed orders reloads only current active linked products into the existing cart, then forces review before submission.
- RTL/LTR, desktop/tablet/mobile responsive styling and reduced-motion support.

## Live Supabase verification
Verified against project `urlsngdafpfuetzafggy` before implementation:
- `orders` includes `organization_id`, `service_site_id`, `po_number`, `requested_delivery_date`, `customer_label`, `last_status_at`, `service_address` and financial/order status fields.
- `order_items` includes current product linkage and `product_snapshot`.
- `order_events` exists with bilingual titles/bodies, metadata and timestamps.
- `quotations` links to `order_id` and includes decision status/value/validity.
- `support_conversations` links to `order_id` and organization.
- `organization_sites` contains organization sites and operational contact/address data.

No database migration was required for this page.

## Static validation
- `ClientOrders.jsx`, `ClientPortalLayout.jsx`, `ClientDashboard.jsx` TypeScript parser check: PASS.
- Project JS/MJS `node --check`: 17 checked, 0 failures.
- Relative imports: 292 checked, 0 missing.
- CSS brace balance: PASS.
- Package + lockfile version: `10.31.0`.
- Deep-link route `/portal/orders/:id`: present and consumed by the page.
- No `node_modules` or build output is intended in the delivery ZIP.

## Production build caveat
A production build is **not claimed as passed** in this environment.
An `npm ci --no-audit --no-fund` attempt exceeded the container transport timeout before a complete dependency installation was available, so `vite` could not be used for a trustworthy production build here.

Before production/deployment run:

```bash
npm ci
npm run build
```

## Intentionally deferred
These belong to the approved later pages and were not faked inside Page 2:
- Full new-request wizard (Page 3).
- Version-aware quotation Decision Room (Page 4).
- AI customer-care actions beyond existing care linkage (Page 10).
- Native push delivery and Action Center (Page 11).
