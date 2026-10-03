# Validation — v10.10.0

- System settings stored in Supabase: verified.
- Public/private setting visibility: configured through `system_settings` RLS.
- Store VAT/minimum/coupon enforcement: moved into secure Supabase cart preview/order functions.
- Guest catalog access, notification visibility and support-ticket creation: enforced by RLS.
- React/JSX source parse: verified with TypeScript parser.
- Relative source imports: verified.
- Full `npm ci` / Vite build: dependency installation exceeded the execution environment timeout, so a complete Vite build was not claimed.
