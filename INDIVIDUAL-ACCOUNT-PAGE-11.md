# Balqees Floral — Individual Account Page 11

## v10.24 — Smart Product Details

Route: `/store/:slug`

This release upgrades the logged-in individual product page while preserving the existing public/company product page.

Implemented:
- individual account chrome and mobile dock
- journey continuity back to the same store search/filter context
- real image gallery with thumbnails, swipe navigation and zoom lightbox
- real pricing engine output; no invented prices
- price-on-request route to a real Balqees Care pricing conversation
- availability and preparation-time distinction
- Smart Budget comparison using store/occasion budget context
- occasion suitability only when supported by product/category/tags
- Taste Engine explanation only when personalization is enabled and supported by signals
- quantity enforcement with MOQ, configured maximum and tracked stock
- gift flag persisted into the account cart
- favorites, share and comparison persistence between product details and Smart Store
- quiet-mode behavior for passive recommendation modules
- contextual Balqees Care: occasion explanation, similar products, cheaper alternatives and budget alternatives
- human product question creates a contextual support conversation and message
- progressive accordions for published details, preparation and purchase information
- real recommendations only; empty matches stay empty instead of fabricating results
- mobile sticky price/add-to-cart CTA above the account dock

Not fabricated:
- no ratings/review counts
- no viewer counts
- no fake scarcity/countdowns
- no product variants/colors/sizes because no live variant schema currently exists
- no care instructions or package contents unless product data supports them
- no back-in-stock control because no dedicated operational workflow is wired yet

The page is designed so real variant/add-on tables can later slot into the options area without redesigning the experience.
