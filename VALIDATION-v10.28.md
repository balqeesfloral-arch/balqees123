# Validation — Balqees Floral v10.28.0

## Scope
Final planned individual portal page: **My Documents** at `/account/documents`.

## Source checks
- Package version: `10.28.0` in `package.json` and root `package-lock.json`.
- Account router includes `/account/documents`.
- Documents page is reachable from Profile, Settings, and the Order Center.
- Order Center links to `/account/documents?order=<id>`.
- No new public Storage URL was introduced.
- No new Supabase schema/table is required for this release.

## Functional coverage
- Order summaries generated from the customer’s own `orders` + `order_items`.
- Official documents loaded from `customer_documents` with `is_visible = true`.
- In-site PDF preview uses short-lived signed URLs.
- Secure download adds the download disposition to the signed URL.
- Official print opens the original PDF; summary print uses the browser Print / Save PDF flow.
- Search covers order number/reference, invoice number, and product names.
- All / Official / Summaries filters.
- Month-based grouping.
- Realtime subscription refreshes when an individual official document is published/updated.
- Empty state contains no cross-sell content.

## Static validation performed
- TypeScript parser parsed **107 JS/JSX/MJS files with 0 syntax errors**.
- Relative import scan found **0 missing relative imports**.
- CSS brace balance check passed.
- No partial `node_modules` or stale `dist` directory is included.

## Full Vite build status
A full `npm run build` could not be completed in this execution environment because the project dependencies were not available locally and the package install process could not complete through the execution network. This report does **not** claim a successful Vite production build.

Before production deployment run:
```bash
npm ci
npm run build
```

## Supabase dependency
Historical note: the v10.26 document backend was superseded and aligned to the live `customer_documents` / `customer-documents` implementation during the v10.29 full audit. See `SUPABASE-v10.29-LIVE-ALIGNMENT.md`.
