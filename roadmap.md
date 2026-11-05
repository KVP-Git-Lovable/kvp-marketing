# Retailer card insights
- [x] Replace retailer-card churn indicators with Retailer Insight across retailer and visit views, including Beat Detail.
- [x] Remove the first-60-store limit so every retailer visit card is considered.
- [x] Verified card wiring, unchanged eligibility, sentence rendering, and preview compilation; authenticated end-to-end checks unavailable with external unmanaged authentication.

# AI Pitch Suggestions redesign
- [x] Reuse existing scheme engine for highest monetary benefit, qualifying pitch quantities, and order-wide restrictions.
- [x] Synchronize exact product/variant additions with the order and compact cards with Add both.
- [x] Test scheme rules, duplicate synchronization, quantity fallbacks, totals, and mobile image handling: 203 tests passed; controlled 375px/1280px card checks passed; preview compilation clean.
- [ ] Verify a real retailer add → quantity change → cart flow; blocked by external unmanaged authentication, which does not provide a test session.
- [x] Refine product cards with paired compact insights, prominent quantities, and How to Pitch details; 13 tests and controlled phone/desktop checks passed. Authenticated real-store checks unavailable with external unmanaged authentication.
- [x] Implement compact category tabs, overall collapse, visible reasons and status labels, and Add/Added controls.
- [x] Resolve exact product/variant images without placeholders or backend changes.
- [x] Test actions, image/no-image cases, and desktop/mobile presentation with five automated tests and controlled browser checks; real-store authentication remains unavailable for this external unmanaged project.