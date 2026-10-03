# Balqees Floral v10.14 — Individual Account Alignment

This release is limited to the first two individual-account stages:

1. `/account` — Personal client home.
2. `/account/orders` and `/account/orders/:id` — Orders center and order details.

## Home alignment
- Real customer addresses, favorites, saved occasions, active offers and preferences.
- Real campaign/season hero with service-first priority when an action is required.
- Correct cart entry into the existing StoreCartDrawer via `/store?cart=1`.
- Mobile dock: Home / Orders / Store / Favorites / Account.
- Four fixed quick actions: new order, repeat order, favorites, Balqees Care.
- Active-order status flow aligned to the database, including quoted, ready, out-for-delivery, delivered and delivery-payment failure.
- Active offers, personalized/new product module, saved occasion, Balqees services, recent favorites, default address and actionable notifications.
- Reorder checks current availability and current price before adding items.

## Orders alignment
- Human search and filters, action-needed first, active orders next, history grouped by time.
- Mini order timeline mapped to real statuses, item quantity/address facts and last update.
- Detailed timeline uses `order_events` timestamps/descriptions.
- Safe customer edits before fulfillment via `customer_update_order_safe`: address, recipient, gift message, order note, and details confirmation.
- Product-change/cancellation/urgent changes remain human-reviewed through Balqees Care.
- Contextual support persists `order_id`, category and context snapshot and reuses/reopens the matching conversation.
- Reorder validates live product availability and reports price changes/unavailable items.
- Completed-order actions: repeat, favorites, similar alternatives.
- Smart recovery shows cached list state and only a minimal cached order-status value when live refresh fails.

## Supabase migrations applied
- `individual_order_safe_customer_edits`
- `individual_support_safe_reopen`

The matching SQL is included in `SUPABASE-v10.14-INDIVIDUAL-ORDER-SAFE-EDITS.sql`.
