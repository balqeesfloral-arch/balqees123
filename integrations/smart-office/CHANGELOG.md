# Letter Studio v10.2.3 — 2026-10-13

Rebuilt the Office letters section for direct composition with live preview, draft/ready/sent/closed status, optional client/project mapping, correspondence references, recipient and department, subject, paragraphs, salutation, closing, signatory details, named enclosures and copy recipients. Four professional Arabic/English hotel correspondence templates provide starting text; custom translations are entered and reviewed explicitly. Internal notes are stored separately and excluded from printing.

Added classical A4 Arabic, English and bilingual letterheads using the existing original Balqees logo, signature and seal and local licensed fonts. Multi-page letters retain complete paragraphs and page/reference footers. Print through the browser to paper or PDF. Marking a letter as sent records its status; it does not send external messages.

Composition adds one `letter_details_json` field to the existing Google letters sheet on first save. The API validates content and record links, rejects stale edits, preserves old attachments, and reconciles an identical request after a lost save confirmation. Letters can be created without uploading to Drive. Existing Drive attachment requirements remain unchanged.

Letter edition: 10.2.3. Quotation edition: 10.2.5. Office application: 26.3.0. Website: 10.50.0. Original statement/PDF v27.4.22 remains byte-identical. Verification is recorded in `docs/LETTER-QA-v10.2.3.json`.

# Quotation Studio v10.2.5 — 2026-10-12

Rebuilt the Office quotations page as a restrained olive-and-gold professional workspace. The editor supports up to 50 independent product/service lines, bilingual specifications and units, fractional quantities, per-line discounts and VAT, VAT-inclusive/exclusive pricing, validity, conditions and notes. Follow-up dates and closing probabilities remain internal.

Added formal A4 Arabic, English and bilingual quotation printing with the existing high-resolution Balqees logo, signature and seal, local licensed fonts, repeating table headings and page numbers. Custom English content requires review rather than an unverified automatic translation. This is a commercial quotation, not a tax invoice or proof of payment.

Structured quotations use one new `quote_details_json` column in the existing Google quotation sheet, added on the first successful detailed save. The server validates input and recalculates money in integer cents. Stable request IDs support recovery after a lost response; the browser reconciles an uncertain save instead of appending another quotation. Version checks reject stale edits. Existing attachments and unrelated records are preserved. Creating/printing a structured quote no longer requires a Drive upload; existing Drive attachment ownership/quota requirements have not changed.

Quotation edition: 10.2.5. Office application: 26.3.0. Website: 10.50.0. The original statement/PDF v27.4.22 and inline application remain byte-identical. Verification details are in `docs/QUOTATION-QA-v10.2.5.json`.

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
