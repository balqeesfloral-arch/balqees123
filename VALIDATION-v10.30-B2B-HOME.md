# Balqees Floral v10.30 — B2B Home / Organization Pulse

## Scope
This release implements **page 1 of the B2B organization/hotel portal rebuild**: the organization home page at `/portal`.

No unrelated individual-account, admin, public-home, store, auth, or Supabase schema changes were introduced in this release.

## What changed

### Organization home rebuilt
`src/client/pages/ClientDashboard.jsx` was rebuilt around the approved B2B plan instead of the old KPI dashboard.

Implemented sections:
- Partnership Garden / Organization Pulse hero.
- Real organization attention center (quotes, contracts, orders, care conversations).
- Live active-operation journey.
- Compact Balqees Care surface ready to become the AI customer-care entry point later.
- Organization readiness based on actual account/site data.
- Smart contextual insight using existing real records.
- Partnership milestones driven by actual accepted quotations/completed orders/sites.
- Workspace health summary.
- Recent activity.
- Balqees inspiration/call-to-catalog section.

### Real-data rule
No fake operational counts were added. Dashboard counts are loaded from existing Supabase entities:
- `orders`
- `quotations`
- `contracts`
- `organization_sites`
- `support_conversations`
- `client_documents` (only when the member has finance permission)

### Permission behavior
Financial values and financial-document content continue to respect `permissions.viewFinance` from the existing client portal context.

### Responsive design
New v10.30 CSS includes dedicated behavior for desktop, laptop/tablet, mobile, and small phones, plus `prefers-reduced-motion` handling.

### Assets
Only existing Balqees assets are reused:
- `/assets/home/hero-lobby.webp`
- `/assets/home/premium-arrangement.webp`

No new external image dependency was introduced.

## Static validation completed
- JSX/JS syntax parse across `src`: passed using TypeScript parser with `--noResolve`.
- Plain JS/MJS `node --check`: passed.
- Changed dashboard relative imports: no missing imports.
- CSS braces: balanced (`3036` opening / `3036` closing).
- Required hero assets: present.
- Package version: `10.30.0`.

## Build limitation
A production Vite build was attempted after `npm ci`, but dependency installation did not complete within the execution environment and left only a partial `node_modules` tree. Therefore **this document does not claim that `npm run build` passed**.

Before production deployment run in CI or a machine with package access:

```bash
npm ci
npm run build
```

The partial `node_modules` directory is intentionally excluded from the release ZIP.

## Database changes
None in v10.30.

The page uses the existing live schema and existing RLS/permission model. Backend restructuring for the broader B2B plan should be handled page-by-page and only where required.

## Next planned page
Page 2: **Orders / Operations Center** — radical rebuild of `/portal/orders` according to `BALQEES-B2B-PORTAL-MASTER-PLAN-v1.0.md`.
