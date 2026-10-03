# Individual Account — Page 3 / Smart Cart — v10.15

Path: `/account/cart`

Implemented:
- Individual cart synced through `customer_cart_items` while guest/company behavior remains isolated.
- Automatic merge of guest cart into the signed-in individual cart.
- Quantity controls with product min/max and tracked-stock limits.
- Smart Cart Health for unavailable items, stock, min/max quantity, price changes and price-on-request products.
- Price-at-add snapshot to show old vs current price; final values still come from server-side cart preview.
- Server-side `preview_customer_cart` integration for subtotal, coupon, VAT and current total.
- Coupon feedback with a private helper that can report the exact amount still needed for a coupon minimum.
- Automatic savings from real active product/rule pricing only.
- Complementary add-ons shown only when product metadata gives a clear complementary signal.
- Empty/loading/error states and responsive mobile Sticky Bottom CTA.
- Store drawer for individual accounts is now a quick preview that hands off to `/account/cart`; it no longer submits an individual order directly.
- Home and Orders cart actions now open `/account/cart`.

Final-plan boundary respected:
- Recipient, address/map, delivery date/window, gift message details and final order confirmation stay in the separate Checkout page planned later.
- The cart does not create an order directly.

Validation:
- TypeScript parser syntax check completed on every modified JS/JSX file with no parse errors.
- Live Supabase schema checked for the new snapshot fields and RPC permissions.
- Supabase Security Advisor was run; this cart change did not add a new public SECURITY DEFINER warning.
