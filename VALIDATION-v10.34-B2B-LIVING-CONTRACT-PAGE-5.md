# Validation — Balqees Floral v10.34 / B2B Living Contract — Page 5

## Scope
This release replaces the old organization contracts list with a Living Contract center and adds the matching admin workbench.

## Client functionality verified in source
- `/portal/contracts` contract center.
- `/portal/contracts/:id` deep link.
- Contract health / days remaining / annual progress ring.
- Structured site coverage and service coverage.
- Coverage checker uses structured `contract_services`; it does **not** invent legal interpretations.
- Human-review fallback opens Care with contract context.
- Obligations split by Balqees vs organization.
- Activity/events timeline.
- Linked orders, service requests, quotations and client documents.
- Published amendments and official contract document.
- Visible contract contacts.
- Renewal review RPC.
- Realtime refresh for contracts/obligations/events.
- Finance is queried only when `permissions.viewFinance` is true.

## Admin functionality verified in source
- Contract create/edit workbench.
- Official document upload to private `client-documents` bucket.
- Structured site coverage management.
- Structured service coverage management.
- Obligations with site / visibility / status.
- Amendments with optional document.
- Balqees/organization contacts.
- Financial data stored in `contract_financials` rather than public contract fields.
- Link/unlink orders, quotations, service requests and client documents.
- Renewal state management.

## Live Supabase alignment
Verified live project `urlsngdafpfuetzafggy` contains these v10.34 migrations:
- `20261001202200 b2b_living_contracts_v10_34`
- `20261001202236 b2b_contract_financial_privacy_v10_34`
- `20261001202702 b2b_living_contract_workflow_v10_34`

Verified:
- `quotations.contract_id` exists.
- `contract_contacts` exists.
- Realtime publication includes contracts, sites, services, obligations, amendments, events and contacts.
- `contract_financials_read` remains server-side protected by `view_finance` (or Balqees admin).
- Child records validate organization/contract consistency.
- Draft/unpublished contracts remain hidden from organization clients.
- Internal obligations can be hidden with `visible_to_client=false`.

## Supabase advisors
Security advisor after v10.34:
- No new Living Contract finding.
- Existing warning remains: **Leaked Password Protection Disabled**.

Performance advisor after v10.34:
- No missing-FK-index or RLS-init-plan error surfaced.
- Only `unused_index` INFO entries (expected on a low-volume/new schema).

## Static source validation
- Source JS/JSX/MJS parsed with TypeScript parser: **90 files / 0 parse errors**.
- Relative imports checked: **300 / 0 missing**.
- Plain JS/MJS `node --check`: **15 files / 0 errors**.
- CSS brace balance: no imbalance detected.
- Package version: `10.34.0`.

## Production build caveat
A production build is **not claimed as passed** in this environment.
`npm ci --no-audit --no-fund` exceeded the execution timeout and `node_modules/.bin/vite` was not available afterward.
Before deployment run:

```bash
npm ci
npm run build
```

## Security note
The official contract PDF and amendment files remain in the private `client-documents` storage path and are opened through signed/authenticated access; finance remains permission gated on the backend.
