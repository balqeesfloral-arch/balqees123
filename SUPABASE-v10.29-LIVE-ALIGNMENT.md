# Balqees Floral v10.29 — Live Supabase Alignment

Project verified live: `balqees-floral` (`urlsngdafpfuetzafggy`).

The final audit was performed against the live database, not only local SQL files. The following v10.29 migrations were applied successfully during the audit:

- `final_individual_portal_audit_v10_29`
- `individual_portal_performance_v10_29`
- `individual_portal_advisor_cleanup_v10_29`
- `individual_checkout_account_boundary_v10_29`
- `least_privilege_grants_v10_29`
- `move_definer_impls_private_v10_29`

## Reproducible SQL files included in this bundle

The live changes above are already applied to `balqees-floral`. The bundle also contains SQL snapshots for audit/recovery purposes:

- `SUPABASE-v10.29-FINAL-AUDIT-HARDENING.sql`
- `SUPABASE-v10.29-INDIVIDUAL-PERFORMANCE.sql`
- `SUPABASE-v10.29-ADVISOR-CLEANUP.sql`
- `SUPABASE-v10.29-CHECKOUT-ACCOUNT-BOUNDARY.sql`
- `SUPABASE-v10.29-LEAST-PRIVILEGE.sql`
- `SUPABASE-v10.29-PRIVATE-RPC-IMPLEMENTATIONS.sql`

Do not blindly rerun them on production; they document the state already applied during this audit and should be reviewed/migrated through the normal deployment process for another environment.

## Canonical individual-document backend

- Table: `public.customer_documents`
- Private bucket: `customer-documents`
- Delivery log: `public.customer_document_delivery_events`
- Realtime: `orders`, `order_events`, `customer_documents`

Do **not** create the old draft table `individual_order_documents`; it is preserved only under `legacy-migrations/` for historical reference.

## Security alignment

- Customer/private tables have RLS enabled and anonymous table grants were removed.
- Anonymous users retain `SELECT` only on the public catalog/config surfaces needed by the visitor website.
- Checkout RPCs now require an authenticated **individual** profile server-side.
- Sensitive `SECURITY DEFINER` implementations were moved to the non-exposed `private` schema; public RPC wrappers are `SECURITY INVOKER`.
- Official customer documents are read from private Storage through RLS and short-lived signed URLs.

## External dashboard setting still recommended

Supabase Security Advisor reports only **Leaked Password Protection Disabled**. Supabase documents this feature as available on the **Pro Plan and above**, and it is enabled from Authentication settings in the Supabase Dashboard.
