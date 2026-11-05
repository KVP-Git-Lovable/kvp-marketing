# Redesign the AI Pitch Suggestions panel

## Goal
Restyle only the AI Pitch Suggestions section on Order Entry to match the attached compact reference while retaining QuickApp’s existing visual language and all current recommendation behavior.

## UI changes
- Replace the current always-visible category carousel with a compact header row containing:
  - AI Pitch Suggestions title and total recommendation count
  - primary **Take Action** button beside the title area
  - an **Expand/Collapse** control
- Keep the panel collapsed when Order Entry first opens so it occupies minimal vertical space.
- When expanded, show four compact category buttons in one responsive row: **Retailer Fav**, **Beat Fav**, **Top Seller**, and **Schemes**.
- Display each category’s current item count and preserve its familiar icon treatment.
- Allow only one category to be open at once. Opening another category automatically closes the previous one; selecting the open category closes it.
- Show the selected category’s products in a compact horizontal, mobile-scrollable suggestion strip, with exact product or variant name and existing recommended quantity/unit.
- Make each suggestion clearly tappable and use existing QuickApp cards, semantic colours, typography, spacing, buttons, focus states, and subtle transitions.
- Keep loading, empty-category, new-retailer, keyboard, and mobile states compact and accessible.

## Existing actions to preserve
- **Take Action** continues through the existing shared autofill callback and adds all recommended items with their current exact quantities and units.
- Tapping one displayed product sends only that exact recommendation through the same callback, preserving its parent/variant identity, quantity, unit, matching, cart update, and confirmation message.
- Categories with no items remain visible with a zero count but cannot open or add products.

## Scope guardrails
- Change only the AI Pitch presentation component and its local open/collapsed interaction state.
- Do not change the AI endpoint, recommendation selection, scheme rules, ranking, quantities, product data, caching, queries, Order Entry matching, or cart/order logic.
- Do not embed the reference screenshot; use it only as a layout guide.

## Validation
- Verify collapsed-by-default and expanded states on desktop and mobile widths.
- Verify single-open-category behavior, category switching, and zero-item states.
- Verify a single product tap and **Take Action** both reach the existing autofill pathway with unchanged IDs, variants, quantities, and units.
- Check the latest preview build output and inspect the rendered panel for overflow or overlap.
