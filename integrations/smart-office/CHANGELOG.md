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
