# Balqees Floral v10.17 — Validation

## Individual page 5: Addresses & recipients

- Route: `/account/addresses`.
- Main account home now links to the address book even when the customer has no saved address yet.
- Addresses and recipients are separate visually but modeled together for checkout reuse.
- One recipient can be linked to multiple addresses with one usual/default address.
- “I am the recipient” remains virtual and does not force a redundant recipient record.
- Address duplicate detection and recipient phone duplicate detection implemented.
- Safe archival preserves historical order snapshots.
- Google Maps picker supports full interactive mode when `VITE_GOOGLE_MAPS_API_KEY` is configured, and a coordinate/link fallback when it is not.
- Mobile map picker expands to a large bottom-sheet workflow rather than a cramped inline map.

## Static verification

- TypeScript JSX parser: all project JS/JSX files parsed without syntax errors.
- Relative imports verified to exist.
- CSS brace balance checked successfully.
- `node_modules` excluded from the deliverable.
- Full Vite build is not claimed unless dependencies are available in the execution environment.

## Supabase verification

Confirmed on the live project:
- `customer_recipients.is_active`.
- `customer_recipient_addresses` with RLS policies for authenticated owners.
- unique per-recipient default-address index.
- safe public invoker wrappers for default address, default recipient, recipient usual address, address archive and recipient archive.
- obsolete browser access to `set_my_default_address` and `set_my_default_recipient` revoked.

Security Advisor warnings related to these two legacy functions dropped from 6 to 4 findings in each SECURITY DEFINER browser-exposure category. Remaining findings pre-date this page and belong to COD/order-delivery functions; leaked-password protection also remains an account-level Auth setting warning.
