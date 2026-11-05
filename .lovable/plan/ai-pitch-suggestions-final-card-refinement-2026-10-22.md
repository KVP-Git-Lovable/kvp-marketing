# AI Pitch Suggestions — final card refinement

UI-only changes to the AI Pitch Suggestions panel on Order Entry, matched to the uploaded screenshot. Colours, recommendations, quantities, schemes, Like/Dislike, Add/Added, How to Pitch and Take Action are unchanged.

## Changes

1. **Category tabs in one row** — the four tabs (Retailer Favourites, Beat Favourite, Top Seller, Schemes & Offers, same order) sit on a single line that swipes sideways on mobile, with no visible scrollbar and no wrapping. Icons, counts, colours and selected styling stay; names stay readable (no shrinking).
2. **Remove the in-card label beside the image** — the small Top Seller badge is removed. Starter Picks / Territory Fallback / New Launch labels in that spot are also removed from the card front so nothing replaces the badge; they remain in the How to Pitch details. (Confirm if you want those three kept.)
3. **Card layout as in the screenshot**
  - Top row: image (fixed small square) on the left, name and quantity beside it, info icon top-right.
  - When no image loads, the same fixed area stays reserved and shows the product name in small text, so every card has identical dimensions.
  - Quantity as a compact soft pill under the name, like "15 KG" in the screenshot — normal size, with "Qty:" prefix, no large text.
  - Scheme Available tag only when a scheme applies (unchanged).
  - Two equal-width insight boxes side by side, each icon + a two-word label, wrapping to two lines if needed — never "...".
  - Divider, then Dislike + Like bottom-left and green Add + bottom-right.
4. **Two-word insight labels** chosen from the item's real data only:
  - Top Seller: "High Demand" + "Fast Moving" (company-wide bestseller facts).
  - Retailer Favourites: "Repeat Orders" (bought several times) / "Recent Orders" (last-purchase evidence).
  - Beat / territory: "Popular Locally" + "Recent Orders".
  - Schemes: "Scheme Offer" / "New Launch" (only for real new launches).
  - Starter picks: "Store Type" + "Popular Locally".
   If only one fact is supported, a second safe label from the same category's rule is used (e.g. Top Seller always qualifies for both). Product or category names are never used as labels. "Low Stock" is not used because stock is not part of the recommendation data.

## Technical details

- Only `src/components/PitchSuggestionsCard.tsx` (tab row classes, card JSX, `compactInsight` mapping) and `PitchProductImage` usage (fixed-size slot with name fallback), plus test updates in `PitchSuggestionsCard.test.tsx` (badge gone, two labels, no ellipsis truncation class).
- Tabs: `flex overflow-x-auto flex-nowrap` with `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`, `shrink-0 whitespace-nowrap` buttons.
- No database, edge function or logic changes; hardcoded pastel palette kept.

## Validation

- 375 px and desktop: one tab row, swipe works; two cards side by side, equal height with and without images; no "..." in labels.
- Add/Added, Like/Dislike, info popup and Take Action still work; tests pass.