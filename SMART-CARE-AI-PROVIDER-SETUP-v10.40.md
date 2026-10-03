# Balqees Smart Care — optional AI language provider

Page 10 works without an external LLM through deterministic, permission-checked Supabase tools and human handoff. The optional `balqees-care` Edge Function adds natural-language intent classification and answer phrasing while keeping authorization and business data access in named Supabase RPCs.

## Edge Function secrets
Configure these as **Supabase Edge Function secrets**, not Vite/browser environment variables:

- `BALQEES_AI_BASE_URL` — OpenAI-compatible chat-completions endpoint.
- `BALQEES_AI_API_KEY` — provider secret.
- `BALQEES_AI_MODEL` — provider model identifier.

The function also uses the platform-provided `SUPABASE_URL` plus `SUPABASE_ANON_KEY`/publishable key and forwards the signed-in user's Authorization header. It deliberately does **not** use a service-role key.

## Safety model
- The LLM can only choose among an internal intent enum.
- Server code maps intents to a fixed allow-list of RPCs.
- There is no generic SQL or arbitrary RPC execution.
- The RPCs enforce organization membership, site scope, and permissions.
- Binding actions (quote approval, refunds, contract cancellation, monetary changes, deletion) are not tools.
- Ambiguous contract/legal questions are handed to a human.
- Admin `ai_enabled=false` is a real Kill Switch for the AI layer; human care and safe deterministic fallbacks remain available.
- Tool/action audit records metadata/results only; no chain-of-thought is stored.
