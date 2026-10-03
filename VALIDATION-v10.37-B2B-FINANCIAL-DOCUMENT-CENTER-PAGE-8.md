# Balqees Floral v10.37 — B2B Financial & Document Center

## Scope
Page 8 of the B2B organization portal: **Financial & Document Center**.

## Implemented client experience
- Unified center for official accounting copies, quotations, contracts and published contract amendments.
- Route: `/portal/financial`.
- Deep-link route: `/portal/financial/:sourceKind/:sourceId`.
- New / unread state is independent from Reviewed state.
- Pin/unpin per user.
- Monthly grouping.
- Search by document number, PO, cost center and internal reference.
- Filters by site, year and status.
- CSV metadata export.
- Context chain to linked order, quotation, contract and site.
- Preserved revision history for replaced client documents.
- Human Care handoff preserves document context.
- Non-finance users may still see permitted contracts/quotations/general documents, while finance documents and financial values are protected server-side.

## Implemented admin workflow
- Page remains at `/admin/financial-docs`, renamed in navigation to Finance & Documents.
- Draft or publish on creation.
- Link official copy to organization, site, order, quotation and contract.
- PO, cost center and internal reference fields.
- Finance-only vs all-member visibility where appropriate.
- Financial document types are forced to finance visibility.
- Replacement creates a new revision and preserves the previous file/record.
- Published documents are archived/cancelled instead of hard-deleted.
- Only draft records can be destructively deleted from the UI.
- Existing WhatsApp/email delivery tracking remains available for published client documents.

## Live Supabase changes
Applied migrations:
1. `b2b_financial_document_center_v10_37`
2. `b2b_document_publish_transition_guard_v10_37`

Key live additions:
- `client_documents`: order/quotation links, PO, cost center, internal reference, lifecycle status, revision, replacement link, file metadata.
- `organization_document_user_state`.
- `client_document_events`.
- `public.get_organization_document_center(uuid)`.
- `public.mark_organization_document_opened(...)`.
- `public.acknowledge_organization_document(...)`.
- `public.pin_organization_document(...)`.
- Realtime enabled for `client_documents` and `organization_document_user_state`.

## Security hardening
- `client-documents` Storage SELECT policy now checks actual document visibility/finance permission, not only organization membership.
- Official quotation/contract/amendment files remain accessible only under their own published/organization rules.
- `all_members` documents cannot contain totals/VAT/subtotal or a payment state other than `not_applicable`.
- Invoice/receipt/credit-note/debit-note/statement types are forced to `finance` visibility.
- Cross-organization order/quotation/contract/site links are rejected by PostgreSQL.
- Replacement source must belong to the same organization and a valid published/replaced record.
- A draft replacement does **not** replace the old document until the new revision is actually published.

## Supabase Advisors
Final Security Advisor result for this development round:
- No new v10.37 security lint.
- Existing account-level warning remains: **Leaked Password Protection Disabled**.

Final Performance Advisor:
- No new missing-FK-index or RLS-init-plan problem was introduced.
- `unused_index` INFO is expected for newly-created / low-traffic structures.

## Static validation
- 93 JS/JSX/MJS source files parsed successfully with TypeScript parser.
- 341 relative imports checked; 0 missing.
- 16 JS/MJS files pass `node --check`.
- 20 CSS files checked; brace balance clean.
- Client detail route count: 1.
- Admin financial-docs route count: 1.
- `package.json`: `10.37.0`.
- `package-lock.json`: `10.37.0`.

## Production build caveat
A full dependency install did not finish inside the execution environment timeout. Therefore **production build is not claimed as passed**.

Before deployment run:

```bash
npm ci
npm run build
```

Do not ship any partial `node_modules` or `dist`; both are excluded from the packaged source.
