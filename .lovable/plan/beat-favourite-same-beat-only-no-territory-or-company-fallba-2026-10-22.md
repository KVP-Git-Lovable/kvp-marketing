# Beat Favourite: same beat only (no territory or company fallback)

## What happens today (inspection)

- Beat Favourite first looks at confirmed orders from other stores on the retailer's exact beat (by beat ID) over the last 90 days.
- If fewer than 3 other stores on that beat ordered, it falls back:
  1. **Territory**: only if the retailer has a territory set.
  2. **Company-wide**: every other retailer in the company.
- Laxmi Medical Stores has no territory on its own record. When Bejai 02 has too little data, it skips straight to company-wide. That is how TAJ MAHAL SPECIAL TEA 100 showed up: it was bought on other beats (City Market, Domlur and others), and none of those orders were on Bejai 02.

Responsible code: `supabase/functions/ai-pitch-suggestions/index.ts`, Beat Favourite block (around lines 844–878). It calls `fetchPeerFavourites` with a `territory_id` scope, and with `null` for the company scope. The labels "territory" and "company" are also set there.

## Change

- Beat Favourite will use only orders from other stores on the retailer's exact beat ID. It will never use territory, company-wide sales or other beats.
- If the beat has fewer than 3 ordering stores, or no product reaches 50%, it shows fewer suggestions or none.
- If the retailer has no beat, it shows no Beat Favourite.
- Everything else stays the same: the 90-day window, the productive-visit requirement, at least 3 ordering stores, the 50% adoption rule, the ranking (stores, then quantity, then most recent), quantity (most common, or middle value if none repeats), excluding what this store already bought, active non-focus products only, and a maximum of 2.
- Retailer Favourites, Top Seller, Schemes & Offers and the design are unchanged.

## Technical details

- Delete the `else { territory ... company ... }` branch. `peerSource` is `beatProductsMap` only when `retailerBeatId` is non-empty and `orderingStores >= PEER_MIN_ORDERING_STORES`, otherwise `null`. Change the `beatEligible` guard to `beatEligible && retailerBeatId`.
- Remove the `territory` and `company` values from `peerTag`/`tierWord` in this block. The evidence line always reads "N of M beat retailers buy it".
- Drop the AI prompt lines about territory and company wording for beat signals (lines ~1009–1010), since those signals can no longer happen. Leave `fetchPeerFavourites` in place, with the beat scope as its only caller. Update the header comments (lines 25–26, 64–70).
- No changes to the UI tag type, so existing badges simply never appear for Beat Favourite.
- Bump `PITCH_CACHE_VERSION` (v22 → v23) so cached company-fallback cards are discarded.
- Tests: add a Deno test for a small pure helper, `selectBeatFavourites(beatAgg, boughtKeys, ...)`, pulled out of the block. It covers: products only from the given beat aggregate, fewer than 3 ordering stores gives none, the 50% threshold is unchanged, already-bought products are excluded, the cap is 2, and a missing beat gives none.
- Deploy the function, then check with SQL that Bejai 02 peer orders decide Laxmi's Beat Favourite, and that TAJ MAHAL does not qualify there.
