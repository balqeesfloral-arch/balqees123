# Validation — v10.39 B2B Balqees Smart Care / Page 10

## Implemented
- Rebuilt `/portal/support` as **عناية بلقيس** instead of a plain communication inbox.
- Context-aware assistance for organization orders, quotations, finance documents, contracts and catalog.
- Every data lookup is organization scoped and finance lookup respects portal permission.
- Explicit no-guessing behavior when data is absent.
- Contract answer deliberately refuses to infer legal coverage unless explicitly recorded.
- Human handoff keeps the question, AI/system summary and entity context.
- Existing support conversations remain the human-care backbone.
- Admin support center upgraded to Balqees Care and surfaces transferred context.
- New migration adds Care settings / kill-switch foundation and tool-audit table.
- Responsive premium UI with non-cartoon floral intelligence treatment.

## Architecture guardrails
- No service-role key in the browser.
- No generic `execute_sql` AI tool.
- Current assistant is grounded deterministic orchestration over approved Supabase reads + published FAQ knowledge; it does **not** pretend that an external LLM is connected.
- A future LLM provider can be attached server-side behind named tools without rebuilding the page.
- Binding actions (quote approval, contract cancellation, refunds, monetary edits, destructive operations) are not exposed to the assistant.

## Before production
1. Apply `SUPABASE-v10.39-B2B-SMART-CARE-PAGE-10.sql`.
2. Verify support table RLS in the live project.
3. When adding a real model, implement a server-side Edge Function orchestrator and log safe tool calls to `care_tool_audit`.
4. Add organization-specific KB entries only after defining their visibility model.
