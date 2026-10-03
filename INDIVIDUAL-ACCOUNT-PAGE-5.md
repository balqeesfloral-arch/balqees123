# Individual Account — Page 5: Addresses & Recipients

Route: `/account/addresses`

## Experience
- Calm two-tab layout: **My addresses** / **Recipients**.
- No marketing banners or product grids on this page.
- Default address appears first and is visually distinguished without loud badges.
- Recipient list is ordered by pinned/default first, then actual recent order usage.
- Search only appears when the recipient list is large enough to need it.
- “I am the recipient” is always available without forcing the customer to save themselves as a recipient.

## Address flow
- New address begins with one question: Google Maps or manual entry.
- When a Google Maps browser key exists, the page supports search, draggable pin, map clicks and current geolocation.
- Without a Google Maps key, the flow remains usable through current geolocation or a pasted Google Maps coordinate URL; the embedded preview works from coordinates.
- Map-derived fields are carried forward so the customer does not retype data already obtained from the map.
- Progressive details: city/district/street, then only useful building/unit/postal/access notes.
- Customer chooses an optional friendly label such as Home, Work or Family home.
- Duplicate-location detection uses a ~30m coordinate check or matching address details, and offers “use saved address” before creating a duplicate.

## Recipients
- Full name, phone number, optional account label, and usual address.
- Duplicate phone detection surfaces the existing saved recipient instead of silently creating a copy.
- A recipient can be linked to multiple saved addresses through `customer_recipient_addresses`.
- Exactly one linked address can be marked as the usual address for that recipient.
- “Use as last time” is based on real previous orders when a different last-used address exists.

## Data safety
- Address and recipient removal is implemented as safe archival from the current account list.
- Historical orders are unchanged because they retain delivery snapshots.
- Recipient/address relationships are RLS-protected by ownership.
- Browser-facing write RPCs are `SECURITY INVOKER`; privileged cores live in the private schema and validate `auth.uid()` ownership.
- Old public default-address/default-recipient SECURITY DEFINER RPCs were revoked from browser roles after safe replacements were installed.

## Checkout handoff
- “Use for order” writes only non-sensitive delivery selection IDs to the local checkout draft and routes the customer to the cart.
- The future Checkout page can consume `customer_recipient_id`, `customer_address_id`, and recipient mode without asking the same questions again.
