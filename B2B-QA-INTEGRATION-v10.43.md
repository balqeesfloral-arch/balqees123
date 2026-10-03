# Balqees Floral v10.43 — B2B Portal QA & Integration Round

## Scope

Final integration pass across the **12-page B2B organization/hotel portal** after Pages 9–12 were completed. This round does not introduce a new portal page. It aligns navigation, permissions, cross-page deep links, session behavior, storage, migration provenance, and failure states so the portal behaves as one product instead of twelve isolated screens.

## Master-plan navigation restored to 12 pages

The B2B navigation now follows the master plan exactly:

1. Overview
2. Orders / Operations
3. New Request
4. Quotations
5. Contracts
6. Sites & Branches
7. Institutional Catalog
8. Documents & Finance
9. Team & Permissions
10. Smart Care
11. Notifications & Actions
12. Settings

`/portal/profile` is no longer a thirteenth primary page. It remains as a compatibility redirect to `/portal/settings?tab=organization`, preserving old links while keeping organization/security settings inside Settings as required by the plan.

## Permission-aware portal shell

The portal navigation and route guards now consume the effective Page 9 permission model. A user no longer receives buttons to workflows they cannot use. Team access also recognizes `manageTeam` when a management role is allowed to administer the team.

Historical submitted service requests can be opened read-only by users with Operations view permission even when they cannot create new requests. Create/repeat/care actions stay hidden unless the corresponding permission is present.

## Cross-page integration fixes

- Dashboard attention cards now open the exact order, quotation, contract, care case, or financial document.
- Smart Care accepts direct `conversation`, order, quote, contract, site, and document contexts.
- B2B links no longer escape into the consumer `/store`; product selection routes to `/portal/catalog`.
- Orders, quotations, contracts, sites, catalog, and finance hide write/care actions that the member cannot execute.
- Finance context actions only link to entities the member is allowed to view.
- Read-only roles retain useful historical visibility instead of receiving dead-end creation screens.

## Session safety

Normal portal/admin sign-out now uses Supabase `scope: 'local'`, so a routine sign-out does not unexpectedly terminate every device session. The explicit Security action in Settings retains `scope: 'others'` for the intentional “sign out other sessions” workflow.

## Storage and upload hardening

### Site files

Page 6 documents a private `organization-site-files` bucket, but the historical Page 6 SQL did not actually create it. v10.43 adds an idempotent storage baseline:

- private bucket
- 20 MiB server-side limit (matching the historical/live Page 6 contract)
- JPEG / PNG / WebP / PDF only
- existing v10.40 Site Scope-aware Storage policies remain authoritative

The client upload flow is stricter at 15 MiB and cleans up the uploaded Storage object if metadata insertion fails. New site object paths use UUIDs rather than timestamp-only uniqueness.

### Organization logo

- Client accepts PNG / JPEG / WebP only, max 5 MiB.
- `organization-assets` Storage is tightened to the same MIME set; SVG is removed.
- New object paths use UUIDs.
- Failed profile-save removes the newly uploaded orphan.
- Successful replacement removes the previous logo object after the profile update succeeds.

## Settings integration fixes

Deep links such as `/portal/settings?tab=organization` and notification/security targets now open the correct Settings section. Display preferences remain global to the portal shell; organization-level and security-level settings retain their permission/confirmation rules.

## Incidental same-package runtime fix

The QA compiler pass found a real runtime bug in `IndividualFavorites.jsx`: `navigate` was called without being defined. It was fixed by restoring `useNavigate()` in the owning component. This is outside the B2B page scope but was fixed because it ships in the same source package.

## Supabase migration QA

### Pages 9–12 RLS static audit

Every new public table created by v10.38 through v10.42 has an explicit `ENABLE ROW LEVEL SECURITY` statement in its migration:

- v10.38: 3 / 3
- v10.39: 2 / 2
- v10.40: 5 / 5
- v10.41: 6 / 6
- v10.42: 5 / 5

Reviewed public RPC wrappers in the v10.40–v10.42 hardening layer do not declare `SECURITY DEFINER`; privileged implementations live in the private layer. v10.43 adds no privileged public function.

### Page 8 provenance gap made explicit

The live Page 8 migration existed in the canonical Supabase migration history but its standalone SQL file was missing from the historical source package. The canonical live records are:

- `20261001214502 · b2b_financial_document_center_v10_37`
- `20261001214535 · b2b_document_publish_transition_guard_v10_37`

See `SUPABASE-v10.37-LIVE-MIGRATION-SOURCE.md`. We explicitly document this provenance rather than silently inventing a different migration. A fresh database must replay the Page 8 state before v10.38+.

### v10.43 additions

- `SUPABASE-v10.43-B2B-PORTAL-QA-HARDENING.sql`
- `SUPABASE-v10.43-B2B-PORTAL-PREFLIGHT.sql`
- `SUPABASE-v10.43-APPLY-ORDER.md`

The preflight is read-only and raises if the expected B2B tables/RPCs/private buckets are missing after migration.

## Live Supabase review

The canonical `balqees-floral` project was inspected **read-only** during this QA round. No v10.43 schema/config change was applied to production.

Observed:

- The live Page 8 schema and both v10.37 migration records are present.
- `organization-site-files` exists live as a private 20 MiB bucket with JPEG/PNG/WebP/PDF MIME rules.
- The later Page 9–12 tables are not yet all present on the live project, confirming the packaged v10.38–v10.42 migrations still need to be deployed in dependency order before the new UI relies on them in production.
- Supabase Security Advisor currently reports the account/project warning **Leaked Password Protection Disabled**. This was not silently changed during source QA.
- Performance Advisor reports many `unused_index` INFO notices. No index was removed from source based on low/early usage statistics.

## Build / static verification

Validated after the v10.43 fixes:

- 98 JS/JSX/MJS files parsed successfully.
- 0 parse errors.
- 356 relative imports checked.
- 0 missing relative imports.
- 0 undefined/mistyped identifier diagnostics in the runtime-name diagnostic set.
- 24 CSS files checked for brace integrity; 0 errors.
- `package.json` version: `10.43.0`.
- `package-lock.json` root version: `10.43.0`.
- B2B primary navigation count: 12.
- no stale `/portal/profile` navigation link.
- no consumer `/store` route inside the client B2B portal.
- normal client/admin sign-out uses explicit local scope.

### Production-build limitation

A production build cannot be honestly claimed in this execution environment because the dependency cache does not contain `vite-8.3.0.tgz`:

`npm ci --offline` → `ENOTCACHED ... vite-8.3.0.tgz`

Run on a normal networked development/CI environment before deployment:

```bash
npm ci
npm run build
```

Do not package partial `node_modules` from this QA environment.

## Deployment gate

Before production rollout:

1. Confirm the earlier B2B/Page 8 prerequisite state.
2. Apply v10.38 → v10.39 → v10.40 → v10.41 → v10.42 → v10.43 in order for environments that have not received them.
3. Run `SUPABASE-v10.43-B2B-PORTAL-PREFLIGHT.sql`.
4. Enable/decide Supabase leaked-password protection in Auth settings as an explicit production-security decision.
5. Run `npm ci && npm run build` in CI/local networked environment.
6. Test real Owner / Procurement / Finance / Site Manager / Viewer accounts across at least desktop and mobile widths.
