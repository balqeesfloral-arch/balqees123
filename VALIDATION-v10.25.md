# Validation — v10.25 Individual Smart Checkout

- Full JS/JSX parser check: PASS.
- Relative import resolution: PASS (0 missing).
- CSS brace balance: PASS.
- Supabase Security Advisor after final migration: 0 warnings.
- Public checkout RPCs are SECURITY INVOKER; privileged implementations stay in `private`.
- Legacy direct individual-order browser RPC revoked from anon/authenticated.
- Checkout draft RLS is ownership-scoped and validates linked recipient/address/occasion ownership.
- COD recipient confirmation public route exposes only limited order confirmation data and requires token + phone last 4 + acceptance.
- Confirmation expiry enforced server-side.
- Idempotency key unique index already exists on orders; checkout reuses same order on retry.
- COD blocked account cannot submit a new COD order; high-value orders require review.
- `price_on_request` cart items cannot be finalized as COD until pricing review.
- No fake delivery schedule or service coverage exposed.
- ZIP integrity verified after packaging.

Note: a full Vite build is not claimed unless Vite dependencies are available in the runtime. Syntax/import checks are the validation performed in this environment.
