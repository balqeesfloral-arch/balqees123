# Balqees Floral v10.33 — B2B Quotation Decision Room

## Client portal
- `/portal/quotes` and deep link `/portal/quotes/:id`.
- Decision Room layout: quotation series list + full decision panel.
- Real V1/V2/V3 version history.
- Stable `line_key` per quotation item for accurate diffs across versions.
- Added / changed / removed line summary and total-value delta.
- Linked service site and Smart Request context.
- Role-aware financial visibility: finance or quote approver only.
- Authorized approvers can accept, request revision, or decline.
- Revision/decline require a reason.
- Expired or non-current versions cannot be approved server-side.
- Opening a current sent quote records `viewed` through a guarded RPC.
- Official PDF remains the authoritative document when `document_path` exists.
- Admin can upload/replace the official PDF per quotation version from the quote editor; files stay in private `client-documents` storage.
- Per-line “Ask about this item” opens Care with quotation/version/line context prefilled.
- The resulting Care case stores `quotation_id`, version, `line_key`, optional line description, site/request context in `context_snapshot`.
- Realtime refresh for quotation/status timeline changes.
- Timeline is backed by `quotation_events`.
- View-only users do not receive “needs your decision” treatment.

## Admin portal
- Create V1 as a draft, edit line items, link site and Smart Request, then send.
- A revision request can be cloned atomically to V2/V3 using `create_quotation_revision`.
- Cloned revisions preserve stable line keys for exact comparisons.
- Only the current draft is editable/deletable from the UI.
- Sending a quote uses the database status workflow; duplicate manual notification insertion was removed.
- Official PDF upload/replacement is integrated into the same version editor; replacing a file removes the superseded storage object only after the new path is saved.

## Live Supabase migrations
- `b2b_quotation_decision_room_v10_33`
- `b2b_quotation_action_guard_v10_33`
- `b2b_quotation_draft_visibility_guard_v10_33`
- `b2b_quotation_view_guard_v10_33`
- `b2b_quotation_fk_indexes_v10_33`

## Security
- Draft quotations are hidden from organization users at RLS level, including draft items and events.
- Quote decisions continue through guarded RPCs, not direct client updates.
- Approval is rejected for expired or older versions by the database.
- Revision/decline reason validation is server-side.
- Version context validates organization, linked request, linked site, and previous version.
- No service-role secret was introduced in frontend code.
- Contextual quotation support cases still pass organization RLS and are stored as human-care conversations, not free-form cross-organization references.

## Realtime / events
- `quotations` is in `supabase_realtime`.
- `quotation_events` is in `supabase_realtime`.
- Notification deep links point to the exact quote route.

## Supabase Advisors after final migration
Security Advisor:
- no new RLS/schema issue from v10.33
- existing warning remains: `Leaked Password Protection Disabled`

Performance Advisor:
- no unindexed foreign-key finding remains from v10.33
- only `unused_index` INFO remains, expected while the new versioning/event indexes have little traffic

## Static validation
- JS/JSX/MJS source files parsed through global TypeScript (`allowJs`, JSX preserve, `noResolve`): 0 parser errors.
- Plain JS/MJS `node --check`: 16 files checked, 0 failures.
- Relative imports: 300 checked, 0 missing after the final PDF/Care integration pass.
- CSS brace balance: 0 errors.
- `package.json` / lockfile version: 10.33.0.

## Production build caveat
A production build is not claimed unless `npm ci` and `npm run build` complete in the execution environment.
Run before deployment:

```bash
npm ci
npm run build
```

### Build attempt in this environment
`npm ci --no-audit --no-fund --prefer-offline` hit the container transport timeout before dependency installation completed. The partial `node_modules` directory was removed before packaging. Therefore no production-build pass is claimed for this package.
