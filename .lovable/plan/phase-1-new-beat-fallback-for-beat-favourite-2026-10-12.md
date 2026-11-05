# Phase 1: New beat fallback for Beat Favourite

Only the way Beat Favourite picks its data source changes. The ranking, quantity, product eligibility, purchase exclusions, top-2 limit and the other three categories stay as they are.

## Rule

1. **Beat first (unchanged rule):** count the other stores on the same beat with at least one confirmed order in the last 30 days. A product qualifies only if at least 50% of those stores bought it.
2. **When the beat has too little data:** if fewer than **3** other stores on the beat ordered in the last 30 days, the beat result is not used. Only this store count decides the fallback. A beat with 3 or more ordering stores where no product reaches 50% shows no Beat Favourite. It does not fall back.
3. **Territory fallback:** use the retailer's territory (`territory_id`). Count the other stores in that territory, outside this shop, with a confirmed order in the last 30 days. The territory needs at least 3 such stores, and a product qualifies only if at least 50% of them bought it. Ranking and quantity work the same way as for the beat.
4. **No guessing:** if the retailer has no territory, the territory has fewer than 3 ordering stores, or no product reaches 50%, the Beat Favourite section stays empty.

## Label

The section title stays "Beat Favourite". For territory suggestions, the reason line names the territory, for example:
"4 of 7 ordering stores in Mangaluru Territory bought this in the last 30 days — typical line 8 KG".
Beat-based lines keep their current wording.

## Technical details

File: `supabase/functions/ai-pitch-suggestions/index.ts`

- Generalise `fetchBeatFavourites` into `fetchPeerFavourites(supabase, retailerId, column: "beat_id" | "territory_id", value)`. It gets the same peer→confirmed orders→order_items aggregation (30-day window, chunking, pagination). Keep `fetchBeatFavourites` as a thin wrapper.
- Add a constant `PEER_MIN_ORDERING_STORES = 3`. Keep `BEAT_MIN_SHARE = 0.5` for both levels.
- Selection: compute the beat result. If `orderingStores < 3` and `retailer.territory_id` is set, fetch the territory aggregate. Use it only if its `orderingStores >= 3`. Record the source (`beat` | `territory`) and the territory name, looked up with `territories.select("name").eq("id", territory_id)`.
- Run the same filter/sort/resolveActive/slice pipeline on whichever source is chosen. Build the signal text from that source and level.
- The territory fetch runs only when the fallback triggers, so beats with enough data pay no extra cost.
- The AI narration prompt already rewrites the signal. Add a single rule: when the signal names a territory, the pitch must say territory and never "this beat".
- Bump `PITCH_CACHE_VERSION` in `src/utils/pitchSuggestionsCache.ts` (v16 → v17).
- Verify by deploying, then calling the function for one store on a beat with plenty of orders (beat source) and one on a thin beat (territory source or empty). Check the build.

No database, UI layout, or response-shape changes.
