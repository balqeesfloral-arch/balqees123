# Legacy local drafts

These two files were preserved for historical reference only and **must not be applied** to the live Balqees Supabase project.

The live backend already uses `customer_documents`, `customer-documents`, `customer_privacy_requests`, and `customer_security_events` from the applied migration history. The old local drafts expected a parallel `individual_order_documents` backend and different privacy/security column names.

Use `SUPABASE-v10.29-FINAL-AUDIT-HARDENING.sql` for the final alignment/hardening changes.
