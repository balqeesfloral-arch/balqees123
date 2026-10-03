# Individual Account — Page 12: Smart Checkout (v10.25)

Route: `/checkout`

## Final flow
`الاستلام → التفاصيل → المراجعة`

## Implemented
- Individual-account-only checkout.
- Recipient: self or saved recipient.
- Saved address selection with recipient-linked addresses prioritized.
- Cross-device non-sensitive checkout draft in `customer_checkout_drafts` plus local fallback.
- Cart price/stock/coupon validation through server pricing engine.
- Checkout Health Check before order creation and re-check inside server create RPC.
- Cash on delivery only; no card/payment UI.
- Verified-email requirement controlled by live store settings.
- COD payer selection and recipient-payment awareness acknowledgement.
- Gift message and sender-name visibility.
- Optional customer note.
- Coupon carried from Smart Cart and revalidated server-side.
- Price-on-request products are blocked from final COD checkout until pricing review.
- No fake service-area or delivery-slot availability; delivery timing is explicitly confirmed later until a real scheduler is built.
- COD risk uses payment/order behavior only: first order, configured high-value threshold, prior payment refusal, recipient confirmation.
- High-value orders go to review; accounts blocked by prior COD refusal cannot create a new COD order until reviewed.
- Other-recipient + sender-pays COD is blocked and routed to Balqees Care for payment arrangement.
- Idempotency protects duplicate orders and recovers the same order after connection loss.
- Legacy `create_individual_order` is server-role only so browser clients cannot bypass checkout safeguards.
- Recipient COD confirmation route: `/cod/confirm/:token`, secured with token + payer phone last 4 digits + terms acceptance + expiry.
- Compact success state is included; the full post-order experience remains Page 13.

## Backend
`SUPABASE-v10.25-INDIVIDUAL-CHECKOUT.sql`

Main APIs:
- `customer_checkout_health(...)`
- `customer_checkout_create_order(...)`
- `get_cod_confirmation(token)`
- `confirm_cod_responsibility(token,last4,accept)`

## Deliberately not faked
- No Visa / Mada / Apple Pay / STC Pay.
- No delivery slots or service area claims without a real scheduling/coverage engine.
- No final COD order for `price_on_request` items before pricing.
- No hidden card data storage.
