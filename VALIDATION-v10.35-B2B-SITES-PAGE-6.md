# Validation v10.35 — B2B Sites & Branches / Site Command Center

## Delivered
- `/portal/sites` organization network view with real per-site care state, readiness, active-operation count and next obligation.
- `/portal/sites/:siteId` deep-linked Site Command Center.
- Current operations, smart-service requests, contract coverage and upcoming contract obligations per site.
- Structured service areas, multi-contact site team, access playbook, verification date, photos/files and site timeline.
- Site archive/reactivate workflow instead of destructive deletion.
- Private `organization-site-files` Storage bucket with metadata-aware visibility rules.
- Admin `/admin/sites` management surface for profile, areas, access, contacts, files, archive/reactivate and timeline.
- Realtime on `organization_sites` and `organization_site_events`.
- Site details are tied to the current organization through RLS and server-side organization/site validation triggers.

## Live Supabase migrations
- `b2b_site_command_center_v10_35`
- `b2b_site_advisor_cleanup_v10_35`
- `b2b_site_files_storage_visibility_v10_35`

## Security / privacy notes
- Hidden site contacts and hidden site file metadata are not readable by normal organization members.
- The Storage SELECT policy now also checks `organization_site_files.is_visible`; knowing a private object path is not sufficient to read a hidden file.
- Site child records validate that `organization_id` matches the parent site.
- Site file uploads are restricted to authenticated members with `manage_sites` permission (or Balqees admins through the permission helper).

## Static validation
- TypeScript parser: 91 JS/JSX/MJS source files, 0 syntax errors.
- Relative imports: 302 checked, 0 missing.
- Plain JS/MJS: `node --check` passed.
- CSS: 16 files, brace balance passed.
- Client site detail route: exactly 1.
- Admin sites route/import: exactly 1 each.

## Supabase Advisors after final hardening
- Security Advisor: only pre-existing `Leaked Password Protection Disabled` warning.
- Performance Advisor: only `unused_index` INFO; no missing-FK-index or multiple-permissive-policy warning introduced by v10.35.

## Production build caveat
A production build is **not** claimed as passed. `npm ci --no-audit --no-fund` timed out in this execution environment before Vite became available. Static/source validation passed; before deployment run:

```bash
npm ci
npm run build
```
