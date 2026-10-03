# Validation — Balqees Floral v10.43 B2B Portal QA & Integration

## Result

**Source QA passed with deployment gates documented.**

This result means the source tree passed the available static/integration checks in this environment. It does **not** claim that production migrations were applied or that a Vite production build completed.

## Fixed in this round

- B2B top-level navigation normalized to the 12-page master plan.
- `/portal/profile` converted to Settings compatibility redirect.
- B2B nav and routes filtered/guarded by effective Page 9 permissions.
- Read-only historical Request detail for Operations viewers.
- Dashboard exact deep links for orders, requests, quotations, contracts, documents and care cases.
- Smart Care direct conversation deep-link support.
- Removed client-portal leakage to consumer `/store`.
- Permission-aware care/create/repeat actions across Orders, Quotes, Contracts, Sites, Catalog and Finance.
- Local-only default logout for client/admin; explicit other-session logout preserved in Security.
- Settings `?tab=` deep-link behavior.
- Site upload MIME/size validation and orphan cleanup.
- UUID-backed site file names.
- Organization-logo MIME/size enforcement, UUID paths, orphan cleanup and previous-logo cleanup.
- Page 6 storage-bucket baseline added in v10.43.
- Organization-logo Storage SVG removed in v10.43.
- v10.42 migration order corrected and promoted to v10.43 apply-order guidance.
- Page 8 live migration provenance recorded explicitly.
- Read-only post-migration preflight added.
- `IndividualFavorites.jsx` undefined `navigate` runtime bug fixed.

## Static checks

| Check | Result |
|---|---:|
| JS/JSX/MJS parsed | 98 |
| Parse errors | 0 |
| Relative imports checked | 356 |
| Missing relative imports | 0 |
| Undefined-name diagnostics | 0 |
| CSS files checked | 24 |
| CSS brace errors | 0 |
| B2B top-level nav items | 12 |
| Pages 9–12 newly-created public tables missing RLS enable | 0 |
| Public `SECURITY DEFINER` functions in v10.40–v10.43 reviewed source blocks | 0 |

## Package consistency

- `package.json`: `10.43.0`
- `package-lock.json`: `10.43.0`
- Latest DB hardening: `SUPABASE-v10.43-B2B-PORTAL-QA-HARDENING.sql`
- Post-migration check: `SUPABASE-v10.43-B2B-PORTAL-PREFLIGHT.sql`

## Live-project observations (read-only)

Canonical project: `balqees-floral` (`urlsngdafpfuetzafggy`).

- Page 8 canonical migration records confirmed.
- Site-files bucket confirmed live/private/20 MiB with intended MIME rules.
- Later Page 9–12 schema is not fully deployed live yet.
- Security Advisor warning: Leaked Password Protection Disabled.
- Performance Advisor: unused-index INFO notices; no index removal performed.

No schema, RLS, bucket, Auth configuration or migration was written to the live project during v10.43 QA.

## Production build

Not verified in this environment.

Exact dependency failure:

```text
npm error code ENOTCACHED
npm error request to https://registry.npmjs.org/vite/-/vite-8.3.0.tgz failed:
cache mode is 'only-if-cached' but no cached response is available.
```

Required deployment check:

```bash
npm ci
npm run build
```

## Supabase migration gate

For the Page 9–12 layer, follow `SUPABASE-v10.43-APPLY-ORDER.md` and ensure the earlier Pages 1–8/Page 8 state exists first. Then run the read-only preflight.

The package intentionally does not claim that the live database was upgraded during source QA.
