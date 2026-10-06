Balqees Smart Office Cloud 8.6.1 — Hotfix
PDF design remains v27.4.22

Fix:
- Resolved: ReferenceError: stmtTexts is not defined
- Root cause: bilingual/PDF helper functions were scoped inside pdfDateTimeEN.
- stmtTexts, stmtLang, stmtDir, stmtAlign and statement helpers are now global and available to Reports.
- No database, Google Sheets, Drive, login, receivables or payment logic was changed.
- Logo, watermark, signature, stamp and bilingual v27.4.22 PDF remain unchanged.

Upload this ZIP to the same balqees-smart-office Vercel project and wait for Ready.

8.6.2: Customer account integration. See ACCOUNTING-INTEGRATION-v10.49.md in the repository root before deployment.
