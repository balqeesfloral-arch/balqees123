# v26.3.0 — 2026-10-09

Added a shared website/Office operations inbox for store orders, RFQs, organization service requests, published B2B quotations and contracts. Lists are paginated; detail views read current protected website data. Import approved operational snapshots into the matching Google client, project, quotation or contract without creating tax invoices or marking balances paid.

Office users can review/price RFQs, send VAT-inclusive B2B scope quotations and update request/order status directly. Customer notifications and existing quote/order audit events remain active. Edits use optimistic concurrency and durable command IDs.

New customer creation uses verified website profiles and explicit immutable account mapping. Imports use durable append markers and ledger reconciliation after ambiguous network failures. An approved payment proof can settle only one matching order, for the exact account and total, after the actual Google transfer is checked again.

Office invoice, quotation, contract and receipt attachments can be delivered directly to the mapped customer's protected financial center. Server credentials remain server-only. New private import/command/payment tables are not readable or writable by customers.

Application version: 26.3.0. Website version: 10.50.0. Original inline app/PDF and graphics remain unchanged; PDF version stays v27.4.22. Required database migrations and rollback-only verification are in the repository's supabase/migrations and scripts folders.

# v26.2.4 — 2026-10-09

Added authenticated global search across all twelve sections in one Google Sheets read per search, including older records. Arabic text and numeral normalization, bounded results with totals, and fresh-version record opening.

Added numeric/text column sorting, status filtering, synchronized section search, visible-result CSV export, and formula-safe CSV quoting for existing report exports.

Added a workspace card for search, the existing customer account bridge, and the website's protected quotation queue. Improved mobile drawer and modal focus, Escape handling, field labels, and a UI density preference.

Application/package/backend version: 26.2.4.
Base: Smart Office 8.6.2 from commit 666a8b83d4653f8a0738511611004ce08d16c114.
Statement/PDF version: v27.4.22.
Original inline app/PDF SHA-256: 9a55b769fe4b56ab34bb7e7c548c3a5286d93afd92afb95194632885017bb655.

The original accounting/authentication code, brand graphics, and compiled customer bridge are retained. No new database schema or external messaging API is required.

Validation: 7 Node tests passed; browser workflow checks passed at 1440, 768, 390 and 320 pixels with local fixtures. No live customer records or outbound messages were used for release testing.
