# Balqees Floral v10.27 — Settings > Security & Privacy

## Structural correction
Security & Privacy is not an independent primary account page. It belongs to **Settings**.

Main route:
- `/account/settings/security`

Subroutes:
- `/account/settings/security/password`
- `/account/settings/security/two-factor`
- `/account/settings/security/sessions`
- `/account/settings/security/passkeys`
- `/account/settings/security/privacy`

## Implemented
- Settings card opens the Security & Privacy Center.
- Profile no longer owns password/session controls; it links back to Settings.
- Password change uses `supabase.auth.updateUser({ password, currentPassword })`.
- Authenticator App / TOTP enrollment uses Supabase MFA.
- Login checks Authenticator Assurance Level and requires the second factor when the account needs AAL2.
- MFA checks are fail-closed: a failed assurance/factor lookup never falls back to normal account access.
- Session controls use real Supabase sign-out scopes.
- Passkeys are intentionally locked until the production RP ID/domain is final.
- Privacy screen controls personalization, explains location behavior, records data-copy requests, and records account-deletion requests for review.
- Security activity does not invent device location or a backend device list that does not exist.

## Database migration
Historical note: the v10.27 draft migration has been superseded by the live-schema alignment and hardening applied in v10.29. Use `SUPABASE-v10.29-LIVE-ALIGNMENT.md` as the current reference.

It adds:
- `public.customer_privacy_requests`
- `public.customer_security_events`
- RLS policies restricting customer rows to the authenticated owner.

## Product rule
Essential order/security/care messages remain separate from marketing preferences. Account deletion is never an instant browser-side destructive action.
