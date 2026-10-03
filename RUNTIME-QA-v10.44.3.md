# Balqees Floral v10.44.3 — Runtime QA & Security Alignment

## Scope
This round validates and aligns the B2B portal runtime after Pages 9–12 were connected to the live Supabase project. It focuses on errors observed from the actual localhost browser session, not synthetic UI-only checks.

## Live issues found and fixed

### 1. `balqees-care` CORS / Edge Function
- Root cause: the client called `/functions/v1/balqees-care` while no Edge Function was deployed.
- Deployed `balqees-care` and kept browser preflight compatible with `verify_jwt = false` at the platform layer.
- Authentication remains mandatory for POST inside the function through `auth.getUser()` using the caller Bearer token.
- Deployed function status: ACTIVE, version 2 during this QA round.
- Browser logs confirmed authenticated `POST /functions/v1/balqees-care` responses with HTTP 200.
- AI provider is optional. Without `BALQEES_AI_BASE_URL`, `BALQEES_AI_API_KEY`, and `BALQEES_AI_MODEL`, the client safely falls back to the grounded local resolver.

### 2. Site page orders query returned HTTP 400
- Old UI queried non-existent `orders.reference` and `orders.delivery_date`.
- Client site page now requests `order_number`, `po_number`, and `requested_delivery_date`.
- Admin site page now requests `order_number` and `po_number` instead of `reference`.

### 3. `respond_to_quotation` returned HTTP 403
- Public SECURITY INVOKER wrapper could not execute its private implementation after privilege hardening.
- Required private wrapper EXECUTE privileges were restored only for `authenticated`; PUBLIC and anon remain revoked.
- Same runtime alignment was applied to the other affected private wrappers discovered by audit.

### 4. Quotation decision server guard was incomplete on live DB
The old live implementation did not enforce the Page 9 access model on the server. v10.44.3 now enforces:
- effective permission to approve quotations;
- member Site Scope;
- role/member MFA requirement;
- approval limit;
- current-version and validity rules.

A database trigger also protects quotation status updates independently of the UI/RPC.

QA proof: in a rollback-only transaction, setting the Owner approval limit to 100 and trying to accept a 2300 quotation returned `APPROVAL_LIMIT_EXCEEDED`. No production data was changed.

### 5. Pages 2–8 were not fully inheriting Page 9 Site Scope
The live database still had historical policies where organization membership alone exposed organization-wide rows. Runtime alignment now applies the Page 9 access model to:
- orders, order items, and order events;
- service requests and request attachments;
- quotations, items, and events;
- sites and site child records;
- contracts and site/obligation/financial children;
- financial documents.

The resource resolver uses explicit member site assignments when present; members without an explicit site scope retain organization-wide access according to their effective permission map.

### 6. Historical attachment policy defect
A historical request-attachment policy contained an ineffective self-comparison equivalent to `r.organization_id = r.organization_id`. v10.44.3 ties attachment access to the actual parent service request and the member's permitted site.

## Runtime smoke tests completed
Tested against the live project using the active B2B Owner identity inside rollback-safe transactions:
- organization memberships/access — OK
- Team & Permissions center — OK
- Notifications center/settings — OK
- B2B Settings — OK
- orders — OK
- quotations — OK
- contracts — OK
- sites — OK
- service requests — OK
- quotation action (`revision_requested`) — OK with rollback
- server-side approval-limit denial — OK
- Smart Care Edge Function browser requests — HTTP 200
- grounded care RPC calls — HTTP 200

Live log sweep after the runtime fixes found no 4xx/5xx for the tested Owner session in the checked post-fix window.

## Supabase Advisors after hardening
### Security
No RLS/function security lint remains. One account-level Auth warning remains:
- **Leaked Password Protection Disabled**

This is a Supabase Auth project setting, not a SQL migration. Enable it from Supabase Auth password-security settings when available for the account/plan.

### Performance
The prior missing-FK-index, RLS init-plan, and overlapping permissive-policy warnings were fixed. The remaining results are informational `unused_index` findings. They are intentionally not removed in this round because the new B2B pages have limited production traffic and lack sufficient usage history for safe index removal decisions.

## Source validation
- Package version: `10.44.3`
- `npm run verify:source`: PASS
- 356 relative imports checked
- 129 source files scanned
- CSS structural brace check: PASS
- Client/Admin old `orders.reference` query: removed

## Build status
A full Vite production build is **not claimed** in this environment. `npm ci` cannot reach npm package hosts because container DNS/network resolution is unavailable, so Vite cannot be installed and the build cannot reach compilation. This is an environment limitation, not a confirmed source compile failure.

Run in a connected CI/local environment:

```bash
npm ci
npm run verify:source
npm run build
```

## v10.44.3 SQL files
1. `SUPABASE-v10.44.3-RUNTIME-QA-ALIGNMENT.sql`
   - private wrapper execution alignment;
   - B2B visibility helpers;
   - quotation server guard;
   - core read policies.
2. `SUPABASE-v10.44.3-CROSS-PORTAL-SITE-SCOPE.sql`
   - remaining service-request/site/contract/document Site Scope policies;
   - document visibility helper;
   - contract renewal runtime alignment.

The live production database was already aligned during this QA round. These SQL files preserve the same fixes for reproducible deployments.
