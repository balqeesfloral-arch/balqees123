# Balqees Floral — Branded Password Recovery v10.49

## Production route
- Recovery page: `/account/reset-password`
- Canonical production URL: `https://balqeesfloral.vercel.app/account/reset-password`
- The page supports:
  - Supabase default recovery redirects (PKCE/code/session).
  - Direct branded token-hash links from the custom email template.
  - Arabic/English UI, RTL/LTR, responsive mobile layout.
  - Password strength and confirmation requirements.
  - Global sign-out after a successful reset.

## Hosted Supabase email template
In Supabase Dashboard → Authentication → Email Templates → Reset password:

**Subject**
`استعادة كلمة مرور حساب بلقيس | Balqees Floral`

Paste the contents of:
`supabase/templates/recovery.html`

The button points directly to Balqees:
`https://balqeesfloral.vercel.app/account/reset-password?token_hash={{ .TokenHash }}&type=recovery`

This keeps the visible recovery experience on the Balqees domain. Supabase remains the secure verification engine behind the page.

## Password changed notification
If Password Changed security notifications are enabled, use:
`supabase/templates/password_changed_notification.html`

## URL configuration
Recommended hosted Auth settings:
- Site URL: `https://balqeesfloral.vercel.app`
- Redirect URL: `https://balqeesfloral.vercel.app/**`

The direct token-hash email template does not depend on displaying the Supabase verification URL to the customer.
