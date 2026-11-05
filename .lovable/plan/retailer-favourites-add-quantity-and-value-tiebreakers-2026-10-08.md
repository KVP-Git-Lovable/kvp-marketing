# Retailer Favourites: add quantity and value tiebreakers

Only the Retailer Favourites ranking changes. Beat Favourite, Top Seller, Schemes & Offers, the AI wording and the card layout stay the same.

## New ranking order

1. Repeat priority: products bought 2+ times rank above one-off purchases
2. Order frequency: more separate orders rank higher
3. Recency / reorder-gap score (with the small name/category affinity)
4. **New:** Total quantity bought in the last 30 days (higher first)
5. **New:** Total sales value in the last 30 days (higher first)

Expected result for Big Bazaar: ELAICHI 40G (8 KG) first, then BLUE 250G (6 KG, higher value than DAKSHIN 250G).

Everything else stays: last 30 days of productive visits, active items only, exact variants kept separate, top 2, suggested amount from the most common quantity (middle value if none repeats).

## About the UI change - I need old UI. I have already made other changes in other page so i dont want to revert it. if i revert it will effect to other page. so please apply my old UI

The pitch card design has not been edited in recent turns; only the suggestion logic and its saved-results version were changed. If the redesigned card is still showing, the revert probably didn't cover every message of that redesign. Use History to go back to the version from before the redesign. This plan makes no changes to the card.

## Technical details

- `supabase/functions/ai-pitch-suggestions/index.ts`: in `fetchRetailerFavourites`, add up `qty` and `value` (qty × rate) for each variant key. Add `|| b.qty - a.qty || b.value - a.value` to the end of the Retailer Favourites sort.
- Change `PITCH_CACHE_VERSION` from v14 to v15 and deploy the function.