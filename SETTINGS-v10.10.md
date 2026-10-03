# Balqees Floral — Real Settings Center v10.10

## Design goal
The settings page is no longer a visual-only form. Each configurable option is connected to a real consumer in the React application and, where the setting affects access or money, to Supabase/RLS or server-side checkout logic.

## Settings keys
- `site_ui` — public website presentation and visitor experience.
- `admin_ui` — private administrator interface preferences.
- `store` — public store state and checkout policy.
- `support` — public help/support behavior.
- `notifications` — public channel availability for the client portal.
- `security` — private administrator session policy.

## Important enforcement
- Disabling the store is checked during server-side cart preview and order creation.
- `minimumOrder`, `vatRate`, `pricesIncludeVat`, and `allowCoupons` are read by the secure checkout calculation.
- `guestBrowse` is enforced by product/category/price-rule RLS, not only by the UI.
- `signedInTickets` is checked by support conversation/message insert RLS.
- `notifications.inApp` is checked by notification read RLS and by the client portal UI.
- Admin inactivity timeout is enforced in `AdminLayout` and signs out the admin after the configured idle period.

## Intentionally not represented as working switches
Email notification delivery and WhatsApp Business API delivery are not connected yet. The settings center displays them as integrations that require connection instead of exposing non-functional toggles.
