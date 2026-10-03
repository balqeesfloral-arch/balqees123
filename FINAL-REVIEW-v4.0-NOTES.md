# Balqees Floral — v4.0 Master Review

This build is the integrated review master for all six visual modes:

- Default / Balqees botanical base
- Ramadan
- Eid Al-Fitr
- Eid Al-Adha
- Hajj
- Saudi National Day

## Final-review changes

- Unified the seasonal floating-message position so the icon stays at the screen edge and the message opens beside it rather than sitting over the main hero copy.
- Replaced the Ramadan floating trigger with an eight-point metallic Islamic-inspired star medallion.
- Rewrote the Default and Ramadan floating copy as customer-facing messages instead of design descriptions.
- Preserved the closed-to-open rose interaction in Default mode.
- Preserved Eid cannon recoil / flash / smoke, Adha ram call, Hajj aircraft trail, and National Day dallah pour interactions.
- Raised the liquid-glass dock, floating actions, seasonal trigger and QA tester into a consistent z-index system.
- Added safe-area handling for mobile devices and tightened phone/tablet collision rules.
- Added keyboard focus styling and ARIA linkage for the seasonal message trigger/panel.
- Added image decoding/fetch hints and simplified the service WhatsApp-link generation.
- Kept the seasonal tester intentionally enabled for QA. Remove it only after visual approval.

## QA note

The ZIP structure and static source references were checked in this environment. A full Vite build could not be completed because npm package installation timed out in the execution environment.
