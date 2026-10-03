# Validation — Balqees Floral v10.27.0

## Scope
This release keeps **Security & Privacy under Individual Account Settings** and does not introduce `/account/security` as an independent primary route.

## Architecture checks
- Package version: `10.27.0` in both `package.json` and root `package-lock.json`.
- Main center route: `/account/settings/security`.
- Child routes: password, two-factor, sessions, passkeys, privacy.
- No source route/link to `/account/security`.
- The former profile security controls were removed; Profile links back to Settings.
- Settings links to the center and privacy child route.

## Security checks
- Password change uses the current-password-aware Supabase Auth update flow.
- TOTP enrollment/verification/removal uses Supabase MFA APIs.
- Sign-in evaluates Authenticator Assurance Level before opening the portal.
- MFA is **fail-closed**: assurance/factor lookup failure blocks portal access rather than silently bypassing the second factor.
- AAL2 that cannot be satisfied by the supported TOTP UI is not silently bypassed.
- Session actions use local / others / global Supabase sign-out scopes.
- Passkey enrollment remains intentionally disabled until the final production RP ID/domain is fixed.
- Privacy requests and the UX security activity log are owner-scoped with RLS in the included migration.
- No service-role secret was added to frontend source.

## UI / source sanity
- The four modified React modules were checked for merge-marker/truncation artifacts.
- CSS braces are balanced across `src/**/*.css`.
- `package.json` and `package-lock.json` parse successfully.
- No stale `dist` or partial `node_modules` directory is included in the release.

## Full Vite build status
A full `npm run build` could not be run in this execution environment because project dependencies are not installed and offline installation cannot retrieve the uncached Vite `8.3.0` tarball (`ENOTCACHED`). This is an environment/dependency-availability limitation, not a reported Vite compilation result.

Before production deployment, run locally or in CI:

```bash
npm ci
npm run build
```

## Supabase migration
Historical note: the v10.27 local draft has been superseded. During the v10.29 full audit, privacy/security tables and policies were verified against and hardened on the live Supabase project. See `SUPABASE-v10.29-LIVE-ALIGNMENT.md`.

Core Auth password/MFA/session controls use Supabase Auth directly; the migration adds the privacy-request and UX activity-log tables/policies.
