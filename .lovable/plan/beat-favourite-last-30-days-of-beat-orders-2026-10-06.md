# Beat Favourite: last 30 days of beat orders

Only the Beat Favourite suggestion changes. Retailer Favourites, Top Seller, schemes, the AI wording rules and the screen all stay as they are.

## New behaviour

- **What it looks at:** every confirmed order placed in the last 30 days by other shops on the same beat. It no longer looks at only the beat's last 10 productive visits.
- **Must be popular:** a product only counts if at least 50% of different shops on the beat bought it. 
- **Ranking:** first by how many different shops bought it, then by total sales value.
- **Suggested quantity:** the quantity shops order most often for that product. If no quantity repeats, it uses the middle value. It always uses the product's most-used unit.
- **Unchanged:** products this shop already buys are left out, only active products are shown, the top 2 are shown, and the AI can only describe the facts it is given.
- **Card text:** for example, "4 other stores on Mulky M01 bought this in the last 30 days — typical line 5 KG".

## Technical details

File: `supabase/functions/ai-pitch-suggestions/index.ts`.

- `fetchBeatFavourites`: find peer retailers by `beat_id` as now. Then fetch `orders` for those peers where `status = CONFIRMED` and `created_at >= now - 30d`, paginating instead of using `.limit(50)`. Read the `retailer_id` on each order directly; there is no visits step. Fetch `order_items` for those orders in batches. Aggregation stays per product, with `stores` as a Set.
- Add a `modeLine(unitLines)` helper. It picks the most-used unit, then the most frequent quantity in that unit. When counts tie or every quantity is unique, it falls back to the existing median in `typicalLine`. Only Beat Favourite uses it; the other categories keep `typicalLine`.
- Selection: filter `stores.size >= 2` and exclude `boughtKeys`. Then sort by `stores.size` desc, then `value` desc. Resolve active products before taking the top 2, so a discontinued product never leaves an empty slot.
- Update the signal text and the header comment to say "last 30 days". Add a `BEAT_WINDOW_DAYS = 30` constant.
- Bump `PITCH_CACHE_VERSION` in `src/utils/pitchSuggestionsCache.ts` so cached cards refresh.
- The prompt rules, response format, deterministic fallback and other categories are untouched.