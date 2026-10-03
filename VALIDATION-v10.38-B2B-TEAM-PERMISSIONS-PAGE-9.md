# Balqees Floral v10.38 — B2B Page 9 validation

Implemented the master-plan Page 9 **Team & Permissions / Identity & Access Center**.

## Portal
- Route: `/portal/team`
- Added to organization navigation.
- Member cards: name, role, state, site scope, last sign-in, MFA signal.
- Team pulse: active members, pending invitations, MFA, sensitive-role attention.
- Search + status filtering.
- Responsibility map.
- Reference permission matrix: View/Create/Edit/Approve.
- Secure member drawer with role management and suspend/reactivate actions.
- Last-owner protection is enforced by the database function, not only UI.
- Invitation wizard: email, name, role, site scope, optional expiry, optional approval limit.
- Site-scoped access model.
- Temporary access model.
- Audit model for membership changes.
- MFA visibility and sensitive-role care warning.
- Responsive desktop/mobile implementation.

## Database migration
Run `SUPABASE-v10.38-B2B-TEAM-PERMISSIONS-PAGE-9.sql` against the live Supabase project after reviewing the current production schema.

The migration adds:
- membership policy fields
- `organization_member_site_access`
- `organization_member_invites`
- `organization_member_audit`
- safe RPCs for team-center reads, invitations and member state/role changes
- RLS on new tables

## Deliberately deferred per master plan
- Multi-step approval hierarchy by amount bands is future-ready but not activated.
- Owner transfer is intentionally a separate protected flow and is not simulated by role dropdown.
- Sending the actual invitation email requires the production email/Edge Function delivery layer; Page 9 creates the secure invitation record only.
- Custom role builder is not faked before its permission-policy model is finalized.

## Security notes
- UI hiding is not considered authorization.
- Management RPCs verify active organization membership and team-management authority.
- Site scope validates that every selected site belongs to the organization.
- The last active owner cannot be suspended, removed or demoted through the generic member-management RPC.

## Admin counterpart
- Added `/admin/organization-team` for Balqees administrative visibility across organization memberships.
- The admin surface is intentionally visibility-first; protected ownership transfer is not exposed as a casual admin button.
