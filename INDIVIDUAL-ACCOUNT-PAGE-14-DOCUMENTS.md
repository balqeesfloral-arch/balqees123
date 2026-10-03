# Individual Account — Final Documents Page (v10.28.0)

## Route
`/account/documents`

## Purpose
The final planned functional page in the individual customer portal. It acts as the customer document vault, not an accounting ledger.

## Implemented experience
- Every individual order gets an in-account **Order Summary** virtual document.
- Official invoices/documents appear only when Balqees publishes a real PDF from the external accounting system.
- Search covers order reference, invoice/document number, and product names.
- Filters: all, official documents, order summaries.
- Results are grouped chronologically by month.
- Official PDFs preview inside the site using a short-lived signed URL from the private storage bucket.
- Download and print actions operate on the original uploaded PDF; the site does not regenerate an official invoice.
- Order summaries have a dedicated clean preview and browser Print / Save PDF flow, clearly marked **not a tax invoice**.
- Every document links back to its related order.
- The order center links back to the complete Documents vault.
- Realtime refresh listens for newly published official documents.
- Empty state stays operational and contains no marketing products/offers.

## Navigation
The Documents vault is linked from:
- My Profile / Account
- Settings > Orders
- Order Center > Documents

The five-item mobile dock stays unchanged to avoid crowding; Documents belongs under the Account area.

## Security
This release reuses the v10.26 `customer_documents` backend:
- owner-scoped RLS
- private `customer-documents` Storage bucket
- published-only customer visibility
- short-lived signed URLs for file access

No new database table or public Storage URL was added in v10.28.
