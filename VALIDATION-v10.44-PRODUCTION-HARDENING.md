# Validation — Balqees Floral v10.44 Production Hardening

## Live Supabase corrections completed

- Retired the three legacy v10.38 public SECURITY DEFINER team RPCs.
- Locked future `public` function execution defaults so RPC access must be granted explicitly.
- Verified the B2B owner context against Memberships, Access, Team, Notifications and Settings RPCs.
- Verified contract/site/catalog/document-center access paths after the private helper permission recovery.
- Verified Smart Care tools against real order, quotation, contract, site and catalog records.
- Corrected Smart Care order reference mapping from non-existent `orders.reference` to `orders.po_number`.
- Added missing FK covering indexes introduced by Pages 9–12.
- Rewrote v10.44 RLS policies to cache `auth.uid()` using `(select auth.uid())`.
- Removed overlapping permissive SELECT policies from care settings, integrations and site-scope access.

## Advisor status after hardening

### Security

Only one project-level Auth warning remains: **Leaked Password Protection Disabled**. This must be enabled in Supabase Auth settings (Pro plan or above); it is not a SQL migration setting.

### Performance

All actionable v10.44 findings for unindexed foreign keys, Auth RLS InitPlan and multiple permissive policies were cleared. The remaining advisor category is **unused indexes**, which is intentionally not auto-removed because this project/page set is new and usage statistics are not mature enough to justify destructive index cleanup.

## Frontend source corrections

- Package version advanced to `10.44.0`.
- Explicit `/favicon.svg` declaration added to `index.html`.
- Passive notification-page device heartbeat no longer re-enables a device the user disabled and no longer overwrites the Push subscription state.
- Historical v10.40 Smart Care SQL corrected to use `orders.po_number`.
- Added `npm run verify:source` as a dependency-free source integrity gate.

