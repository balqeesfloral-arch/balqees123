# Individual Account — Page 8 / Profile — v10.20

Route: `/account/profile`

Implemented as the identity and trust center for the individual account, not as a marketing page or a duplicate Settings page.

## Implemented
- Identity card with individual-account status and quiet readiness messaging.
- Inline editing for full name, username and contact phone.
- Auth-native email change flow; the profile email mirrors Auth only after the Auth email changes.
- Explicit email verification state; phone is not shown as OTP-verified unless Auth actually confirms the same phone.
- Optional personal information: nationality country, birth date, gender, residence city.
- Nationality/birth/gender are documented in the UI as non-pricing data.
- Preferred language persists to `customer_preferences` and applies immediately in the account.
- Default address summary with a direct link to `/account/addresses`.
- Real password update through Supabase Auth.
- Real sign-out from other devices via `scope: 'others'`.
- Normal sign-out is now local-device only; blocked/suspended accounts still receive global sign-out.
- Privacy summary with current personalization state and a route to Balqees Care for data assistance.
- No offers, products, purchase recommendations or visible inferred-interest profile.

## Security changes
- Removed broad client UPDATE/INSERT privileges on `customer_profiles`.
- Authenticated users can directly update only safe profile columns needed by the existing company profile flow.
- Added `customer_update_individual_profile` as a narrow public SECURITY INVOKER RPC with a private validated core.
- Added Auth -> customer profile email synchronization trigger.
- Updated new-account trigger to save Auth email in `customer_profiles`.

## Intentionally left for later dedicated pages
- Full Settings center.
- Dedicated Security / sessions page.
- Dedicated Privacy / data-request page.
- Automated WhatsApp or email preference toggles until those channels are actually connected.
