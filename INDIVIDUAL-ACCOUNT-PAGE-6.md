# Balqees Floral v10.18 — Individual Occasions

Path: `/account/occasions`

Implemented as a calm personal gift planner, not a calendar dashboard.

- Approved occasion types only: Ramadan, Eid al-Fitr, Eid al-Adha, Hajj, wedding, Malka, engagement, return from travel, usual gifts, new baby, graduation (secondary/bachelor/master/doctorate), and parties.
- Seasonal occasions are detected automatically from the Saudi Umm al-Qura calendar; customers do not need to save Ramadan/Eid/Hajj dates manually.
- Saved occasions use a 3-step wizard: type → recipient → details.
- Usual gifts support visit / thank-you / hospitality / other without requiring a date.
- Optional recipient roles for wedding / Malka / engagement.
- Budget bands and optional +10% overrun.
- Gift preferences: bouquet / gift / bouquet + gift / surprise me.
- In-account reminder choices: 14 / 7 / 3 days. No fake email or WhatsApp reminder switches.
- Reminder RPC deduplicates notifications and runs when the customer opens their account.
- Readiness states: not started / preparing / ready. Linked order status automatically keeps readiness in sync.
- Party-only optional fields: type, approximate guests, venue.
- The gift assistant uses only real published products and prices. It never invents products, prices, or matches.
- The assistant is restricted to bouquets and gifts; service/vase/planter-style results are not used as occasion recommendations.
- Personalized ranking is used only when `personalized_recommendations` is enabled.
- Entering the store from an occasion carries an occasion + budget context and reorders relevant products first without hiding the rest of the catalog.
- Adding an assistant selection to cart also saves the occasion context for the future Checkout page.
