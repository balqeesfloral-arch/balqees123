# Balqees Floral v10.29 — Final Full Audit Validation

Date: 2026-10-01
Live Supabase project: `balqees-floral` (`urlsngdafpfuetzafggy`)

## Scope

This was a full audit of the current React/Vite project and the connected live Supabase backend, covering the individual customer portal, account/auth gates, checkout, order center, documents, notifications, security/privacy, organization/admin side gates, responsive structure, RLS, Storage, Realtime, RPC boundaries, and internal navigation.

## Critical issues found and fixed

1. **Documents backend mismatch** — v10.28 UI expected a draft `individual_order_documents` backend that does not exist live. The UI/admin flow now uses the canonical live `customer_documents` table and private `customer-documents` bucket.
2. **Security event column mismatch** — `event_metadata` was corrected to live column `details`.
3. **Privacy request mismatch** — `data_copy/pending` assumptions were corrected to live `data_export` with `open/in_review/...` statuses.
4. **Invoice notification link** — old `/confirmation` link was corrected to the permanent order center / documents flow.
5. **Realtime alignment** — verified live publication for `orders`, `order_events`, and `customer_documents`.
6. **Checkout account boundary** — UI and server-side RPC now require an explicit `individual` account; company accounts cannot call the individual checkout RPC directly.
7. **Missing-profile fail-open** — account portal now requires an explicit profile/account type instead of treating “not company” as individual.
8. **MFA gate hardening** — account, admin, organization, and checkout gates fail closed when AAL/security checks cannot be completed.
9. **Organization portal membership** — company portal now verifies an active `organization_members` row before opening the workspace.
10. **Anonymous grants** — removed direct anonymous access to private customer/order/support/organization tables; anon retains SELECT only on public catalog/config surfaces required by the visitor site.
11. **Excess table privileges** — removed `TRUNCATE`, `REFERENCES`, and `TRIGGER` privileges from `anon` and `authenticated` on public tables.
12. **SECURITY DEFINER surface** — privileged implementations were moved to the non-exposed `private` schema; public wrappers are now `SECURITY INVOKER`.
13. **RLS/performance** — owner policies were normalized and missing FK indexes for active portal paths were added. Supabase performance advisor no longer reports unindexed-foreign-key or auth-initplan warnings for the corrected paths.
14. **Stale source duplication** — the old duplicate nested source tree was removed from the final working copy; the active source is a single `src/` tree.

## Static source validation

- JS/JSX/MJS source files audited: **88**
- Relative imports missing: **0**
- Static internal navigation paths discovered: **62**
- Unmatched/broken static internal paths: **0**
- Stale live-code references to `individual_order_documents` / `individual-order-documents`: **0**
- Frontend references to `service_role` / `sb_secret_`: **0**
- Plain JS/MJS files checked with `node --check`: **15**, no syntax errors reported.
- Responsive rules are present across the public site, individual portal, admin portal, and organization portal: **11 CSS files**, **109 media-query blocks**, and **20 safe-area references**, including mobile docks, safe-area spacing, mobile modal/bottom-sheet behavior, and horizontal overflow handling where needed.

## Live Supabase validation

- All public application tables inspected have RLS enabled.
- Individual official documents: `public.customer_documents`.
- Individual private Storage bucket: `customer-documents` (private, 15 MB limit).
- Organization private Storage bucket: `client-documents`.
- Realtime confirmed for: `orders`, `order_events`, `customer_documents`.
- 21 RPCs used by the frontend were checked live. Account/checkout/support/profile RPCs are authenticated-only. Public RPC access remains only where functionally required for COD token confirmation/lookup and public popular-product lookup.
- Final Supabase Security Advisor result: **one remaining warning only** — `Leaked Password Protection Disabled`.
- Supabase documents leaked-password protection as a **Pro Plan and above** Auth feature; it must be enabled from the Supabase Authentication settings if the project plan supports it.
- Final Supabase Performance Advisor has only `unused_index` informational findings. Those are not treated as defects in a new/low-traffic project and indexes were not deleted merely to silence the advisor.

## Build validation limitation

A full `vite build` could not be completed inside this execution environment. The project had a partial dependency tree; a direct `npm run build` still returned `vite: not found`, and a clean `npm ci` attempt timed out while fetching dependencies. Therefore this report **does not claim a successful Vite production build**. The final ZIP excludes the partial `node_modules`; run `npm ci && npm run build` in the deployment/CI environment with package access.

## External setting still recommended

If the Supabase project is on Pro or above, enable **Leaked Password Protection** under Authentication password settings. This is the only remaining Security Advisor warning after the database hardening performed in this audit.

## Final status

From the source/backend-integration perspective, the individual customer portal is now aligned end-to-end with the live Supabase schema and the purchase → order center → official document journey. The remaining build step is environment-dependent package installation/production compilation, not an identified application-code or database-schema mismatch.

## Packaging validation

The delivered v10.29 archive excludes partial `node_modules`, build output, and Vite cache directories. The archive itself was integrity-tested after creation with `unzip -t`.
