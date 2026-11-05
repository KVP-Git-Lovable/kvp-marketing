# Beat Favourite: pure 50% of ordering stores

Only the Beat Favourite qualifying rule changes. Ranking, quantity, product eligibility, exclusions, top-2 cap, and all other categories stay exactly as they are.

## New rule

- A product is a Beat Favourite candidate only when **at least 50% of the beat's ordering stores bought it in the last 30 days**.
- **Denominator:** peer retailers on the same beat (excluding this shop) with at least one confirmed order in the last 30 days — the same `orderingStores` count already used. Retailers mapped to the beat but with no recent orders do not count toward the denominator.
- **Pure 50%, no floor:** the old "at least 2 distinct retailers" minimum is removed. On a beat with 2 ordering stores, a product bought by 1 store now qualifies (ceil of 0.5); with 1 ordering store, a product bought by that single store qualifies. A beat with 0 ordering stores still yields 0 candidates.
- Examples: 8 ordering stores → needs 4 buyers; 5 → 3 buyers; 2 → 1 buyer.

## Unchanged

- Ranking: distinct stores desc, then total quantity desc, then most recent order.
- Target-purchase exclusion, active product/variant resolution, top 2 cap.
- Quantity: mode of the most-used unit, median fallback.
- Signal text format ("N of M other ordering stores on [beat] bought this…") — the numbers it prints already reflect the real counts.
- Retailer Favourites, Top Seller, Schemes & Offers, AI prompt rules, deterministic fallback, UI.

## Technical details

File: `supabase/functions/ai-pitch-suggestions/index.ts`

- Line ~693: replace `const beatMinStores = Math.max(BEAT_MIN_STORES, Math.ceil(beatProductsMap.orderingStores * BEAT_MIN_SHARE));` with `const beatMinStores = Math.ceil(beatProductsMap.orderingStores * BEAT_MIN_SHARE);`
- Remove the now-unused `BEAT_MIN_STORES = 2` constant (line 52). `BEAT_MIN_SHARE = 0.5` stays and is the single source of truth for the threshold.
- Update the fetch/selection comments to state the 50%-of-ordering-stores rule.

Client:

- Bump `PITCH_CACHE_VERSION` in `src/utils/pitchSuggestionsCache.ts` (v15 → v16) so devices discard cached Beat Favourite cards computed under the old rule.

No database, UI, prompt, or response-contract changes. Verify with a Deno test run of the existing `ai-pitch-suggestions` tests if present, and a build check.
