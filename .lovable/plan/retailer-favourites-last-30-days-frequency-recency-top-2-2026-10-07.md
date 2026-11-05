# Retailer Favourites: last 30 days, frequency + recency, top 2

Only the **Retailer Favourites** category changes. Beat Favourite, Top Seller, Schemes & Offers, the AI wording rules and the screen stay as they are.

## New behaviour

- **What it looks at:** this shop's confirmed orders from **productive visits in the last 30 days** only (no longer "last 10 productive visits").
- **Retailer context used:** shop profile (name, store category), lifecycle (new shop = added in the last 14 days, existing rule), and a light **name/category affinity** bonus — when a product's category or name words match the shop's category or name (e.g. a "Tea Stall" and a tea product). Affinity only breaks close ties; it never adds a product the shop has not bought.
- **Ranking score (per product):**
  - Frequency — how many separate orders contained it (**main factor**).
  - Recency — bought more recently ranks higher.
  - Reorder gap — if the time since the last order is longer than the shop's usual gap between orders of that product, it gets a "reorder due" boost.
  - Bought only once in the window — ranked below every repeat product.
  - Affinity — small tiebreaker as above.
- **Only active products**, and the **top 2** are shown (was up to 3). Discontinued products are skipped before picking the top 2, so no slot is left empty.
- **Suggested quantity:** most frequent quantity (Mode) in the product's most-used unit; middle value (Median) when nothing repeats.
- **New shops / no orders in 30 days:** Retailer Favourites shows 0 items (honest empty state).
- **AI:** still only writes the explanation from the facts given; cannot change products, quantities or numbers.
- **Card text example:** "Bought in 3 orders in the last 30 days, last ordered 12 days ago — usual gap 7 days, reorder due — usually 10 PIECE".

## Not affected

Beat Favourite still excludes everything this shop has bought, using the same wider purchase history as today, so shrinking the Retailer Favourites window does not suddenly re-suggest older purchases there.

## Technical details

File: `supabase/functions/ai-pitch-suggestions/index.ts`.

- Add `RETAILER_FAV_WINDOW_DAYS = 30`; set `CATEGORY_CAP.retailer_favourite = 2`.
- New `fetchRetailerFavourites(supabase, retailerId, now)`: productive visits with `planned_date >= now-30d` → confirmed orders on those visits (paginated) → `order_items` in batches. Aggregate per product: distinct order dates list, `orders` count, `lastDate`, `unitLines`, and `product_id` for category lookup.
- Keep existing `fetchRetailerHistory` only to build `boughtKeys` for Beat Favourite (unchanged behaviour).
- Scoring: `orders` desc as primary key with single-purchase products forced below repeats; `score = recencyScore + reorderBoost + affinityBonus` as secondary. Usual gap = median of gaps between consecutive order dates; `reorderDue = daysSince >= max(usualGap, 1)`. Affinity: tokenise retailer name + `retailers.category` and compare against product name and its `product_categories.name` (loaded with the active-products master), small fixed bonus.
- Resolve active product before slicing to 2; quantity via existing `modeLine`.
- New signal text as above; update header comment.
- Bump `PITCH_CACHE_VERSION` in `src/utils/pitchSuggestionsCache.ts` (v8 → v9).
- Prompt, response contract, pick-validation, deterministic fallback, other categories: untouched.