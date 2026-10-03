# Balqees Floral v10.32 — B2B Smart Request / Page 3

## Scope
Page 3 of the rebuilt organization/hotel portal: **Smart Request Wizard** plus the matching **Balqees Admin request inbox**.

## Client portal implementation
- Routes: `/portal/request` and `/portal/request/:id`.
- Portal navigation uses **طلب جديد / New request** instead of a generic B2C cart entry.
- Six operational stages:
  1. Need / service type
  2. Site + internal service area
  3. Brief + images/PDF + catalog references
  4. Timing + optional budget
  5. Site access + procurement coordination
  6. Final review + desired outcome + priority review
- Service-specific questions:
  - supply / vases: material preference + approximate quantity/scope
  - space styling: approximate area + preferred style
  - maintenance: care focus
  - recurring: frequency + approximate duration + fixed-quantity preference
- Real readiness score from entered request data.
- Autosave draft with duplicate-draft race protection.
- Existing owned draft hydrates its saved catalog snapshot when reopened, including on another device/session where the local cart is empty.
- Drafts created by another organization member are read-only.
- Submitted/internal-workflow requests are read-only to customers.
- A member whose order permission is later revoked can still read an existing request but cannot edit it.
- Guided brief helper is explicitly a structured-writing helper and does **not** pretend to be AI.
- Start from an actual previous order, while forcing the user to review site/quantity/timing before submission.
- Private JPG/PNG/WebP/PDF attachments, maximum 15 MB per file and UI cap of 8 attachments.
- Catalog selections are saved as a request snapshot/reference, not treated as a final invoice.
- Priority review is explicitly not an execution-time promise.
- Realtime request status updates while the request is open.
- Status notifications deep-link back into `/portal/request/:id`.
- Responsive desktop/tablet/mobile styles and reduced-motion support.

## Admin implementation
New Admin route: `/admin/service-requests` — **طلبات المنشآت**.

The Admin request center includes:
- submitted / under-review / needs-information / priority metrics
- search by request code, organization, site, requester, PO or brief
- status and service filters
- organization + site context
- readiness state
- service-specific answers
- access / receiving instructions
- procurement metadata
- private attachment previews using short-lived signed URLs
- catalog snapshot references
- status workflow editor
- Realtime refresh
- admin audit logging on workflow changes
- admin sidebar badge for newly submitted organization requests

## Live Supabase backend applied
Project: `balqees-floral` (`urlsngdafpfuetzafggy`)

Applied migrations for this page:
- `b2b_smart_service_requests_v10_32`
- `b2b_request_site_guard_v10_32`
- `b2b_request_service_details_v10_32`
- `b2b_request_attachment_uploader_index_v10_32`
- `b2b_smart_request_admin_workflow_v10_32`
- `b2b_request_submission_guard_v10_32`

Backend objects/features:
- `public.organization_service_requests`
- `public.organization_request_attachments`
- `organizations.procurement_settings`
- private bucket `organization-request-files`
- Realtime publication for `organization_service_requests`
- request status notification trigger
- immutable organization/creator trigger
- same-organization active-site validation trigger
- server-side submission guard
- RLS and least-privilege table grants
- Storage RLS scoped to organization + draft request

SQL reproduction/alignment file:
- `SUPABASE-v10.32-B2B-SMART-REQUESTS.sql`

## Server-side submission guard
The browser is not trusted to choose internal workflow states.
For a non-admin organization member:
- an existing request must still be `draft`
- the only allowed transition is `draft -> submitted` (or remaining `draft` during autosave)
- internal states such as `under_review`, `needs_info`, `converted`, and `cancelled` cannot be set by the customer via direct API calls
- submission validates service type, site, service area, custom-area text when applicable, minimum brief length, exact requested date when applicable, and organization-required PO
- `submitted_at` is set by the database on a valid submission

## Security / Storage verification
Live verification confirmed:
- request and attachment RLS policies are present
- private bucket is non-public
- bucket limit is 15 MB
- MIME allowlist: JPEG, PNG, WebP, PDF
- request table is in `supabase_realtime`
- live request triggers include:
  - `organization_request_status_notification`
  - `organization_service_requests_guard_update`
  - `organization_service_requests_touch_updated_at`
  - `organization_service_requests_validate_site`
- no service-role key was added to the frontend

## Supabase Advisors after the changes
Security Advisor:
- no new table/RLS issue from this feature
- existing project warning remains: **Leaked Password Protection Disabled**
- remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Performance Advisor:
- no missing-FK-index or auth-RLS-initplan issue from this feature
- only `unused_index` INFO remains; the new tables have little/no production traffic yet, so unused-index telemetry is expected at this stage

## Static validation
Final source pass after the last client/admin/security edits:
- JS/JSX/MJS source files parsed by global TypeScript in `allowJs + JSX preserve + noResolve`: **90 files, 0 syntax errors**
- plain JS/MJS `node --check`: **17 files, 0 errors**
- relative imports checked: **322, missing 0**
- CSS files: **12, brace-balance errors 0**
- `package.json` version: **10.32.0**
- `package-lock.json` version: **10.32.0**

## Production build caveat
A production build is **not claimed as passed** in this execution environment.

`npm ci --no-audit --no-fund --prefer-offline` hit the container transport timeout before dependencies completed, and `node_modules/.bin/vite` was therefore unavailable. The partial install directory is excluded from the deliverable.

Before deployment run on a normal Node environment:

```bash
npm ci
npm run build
```

## Next planned page
Page 4 — **Quotations / Decision Room**.
