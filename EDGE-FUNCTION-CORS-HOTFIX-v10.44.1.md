# Balqees Care CORS Hotfix — v10.44.1

## Root cause
The frontend invoked `balqees-care`, but the Supabase project had no deployed Edge Functions. Browser preflight therefore hit a missing function and failed before the POST request.

## Production fix
- Deployed Edge Function `balqees-care`.
- `OPTIONS` returns HTTP 200 with CORS headers.
- Function deployment uses `verify_jwt = false` so the browser preflight can reach the handler.
- POST authentication remains enforced inside the function by validating the caller Bearer token with `supabase.auth.getUser()`.
- The current production deployment intentionally returns a grounded fallback response after authentication. `ClientSupport`, notification summary, and admin assist already fall back to their deterministic/RPC-backed paths when no AI answer is returned.

## Source protection
`supabase/config.toml` now contains:

```toml
[functions.balqees-care]
verify_jwt = false
```

Do not change this to `true` unless the deployment gateway is verified to let unauthenticated OPTIONS preflight through. The handler itself must continue validating POST user tokens.
