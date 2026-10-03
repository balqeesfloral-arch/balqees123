# Balqees Care — AI Provider Runtime v10.44.2

## Runtime architecture
`balqees-care` is a browser-callable Supabase Edge Function with CORS preflight support.

- `verify_jwt = false` is required only so unauthenticated browser `OPTIONS` can reach the handler.
- Every `POST` still requires `Authorization: Bearer <user access token>` and validates it with `supabase.auth.getUser()`.
- The function never uses a service-role credential for customer-care access.
- The LLM cannot select arbitrary SQL/RPC names. Only the hard-coded Care tool allow-list can execute.
- Every Care RPC re-checks organization membership, permissions, and site scope.
- External AI receives a minimized projection of the authorized tool result, not the full database row.
- Sensitive/binding requests fall back to human handoff or the deterministic grounded resolver.

## Required production secrets for the external AI language layer
Set all three as Supabase Edge Function secrets:

- `BALQEES_AI_BASE_URL` — OpenAI-compatible `/chat/completions` endpoint.
- `BALQEES_AI_API_KEY` — provider API key.
- `BALQEES_AI_MODEL` — provider model identifier.

Never put these values in Vite `.env`, browser JavaScript, source control, or database rows visible to clients.

## Behavior when secrets are absent
The Edge Function returns `AI_PROVIDER_NOT_CONFIGURED` with HTTP 200. `ClientSupport.jsx` intentionally falls back to the deterministic grounded resolver, so Care remains usable and permission-safe.

## Deployment setting
`supabase/config.toml` contains:

```toml
[functions.balqees-care]
verify_jwt = false
```

This setting must remain paired with in-function JWT validation.

## Production state on 2026-10-03
- Edge Function `balqees-care`: deployed and ACTIVE.
- CORS `OPTIONS`: handled by the function.
- Care AI feature flag: enabled in `care_settings`.
- Agent-assist AI usage audit RPC: installed.
- External provider credential: not provisioned by this package; a real provider key must be added as a Supabase secret.
