# Balqees Floral — Individual Account Page 2

Implemented `/account/orders` and `/account/orders/:id`.

## Included
- Human-friendly order filters and search.
- Priority sorting for orders needing customer attention.
- Active order journey cards with current status, next step and last update.
- Compact historical orders with safe reorder-to-cart behavior.
- Full order detail page with status journey, line-item snapshots, recipient/address snapshot, requested delivery, gift details, COD status, price summary and `order_events` history.
- Contextual support entry points without pretending direct edit/cancel capabilities exist.
- Mobile-first layout and account bottom dock.
- Existing RLS-backed reads only; no database migration was added for this page.
