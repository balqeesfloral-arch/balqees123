# Supabase v10.44.3 apply order

For an environment already on v10.44.2/v10.44 production hardening:

1. `SUPABASE-v10.44.3-RUNTIME-QA-ALIGNMENT.sql`
2. `SUPABASE-v10.44.3-CROSS-PORTAL-SITE-SCOPE.sql`
3. Deploy `supabase/functions/balqees-care/index.ts` with the setting in `supabase/config.toml` (`verify_jwt = false`). The function itself validates the caller JWT for POST requests; OPTIONS must remain able to pass preflight.
4. Run `npm run verify:source`.
5. In a connected environment run `npm ci && npm run build`.

Optional AI provider secrets for full LLM wording/classification:
- `BALQEES_AI_BASE_URL`
- `BALQEES_AI_API_KEY`
- `BALQEES_AI_MODEL`

If these secrets are absent, Balqees Care intentionally falls back to the permission-scoped grounded resolver.
