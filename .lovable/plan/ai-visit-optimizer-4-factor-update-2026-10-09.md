# AI Visit Optimizer — 4-factor update

Scope: only `runVisitOptimiser` in `supabase/functions/ai-workflow-run/index.ts` (plus a small pure helper module and a Deno test). No changes to the coordinator route planner, UI, auth, caching, workflow logging, or any order/payment/visit records.

## The 4 factors (nothing else)

1. **Geographic proximity** — Haversine, nearest-neighbour, then a 2-opt pass.
2. **Ordering time** — the middle (median) hour of the store's confirmed orders in the last 30 days.
3. **Visit recency** — days since last visit.
4. **Conversion and sales value** — strike rate (confirmed orders ÷ visits, last 30 days) plus total confirmed order value in the last 30 days.

Removed from scoring: pending dues and A/B priority. Pending stays in the stop data only for display, because the card shows it. It plays no part in ranking.

## New logic

```text
score = recency (max 40) + strike rate (max 35) + 30d order value (max 25)
```

1. **Who is in the route stays the same.** Today's planned visits, assigned beat retailers and custom-added retailers all stay in. Only the order changes.
2. **Handle bad coordinates.** Null, NaN, (0,0) and out-of-range values all count as "no GPS". Stores with GPS form the route. Stores without GPS are grouped by beat name. Each group goes right after the GPS store from the same beat that comes last in the route. If no GPS store shares the beat, the group goes at the end, sorted by score. This replaces the current `pool.shift()` fallback, which jumbles the route.
3. **Pick the start.** Look at the top 5 GPS stores by score and start at the one with the earliest ordering time. If none has an ordering time, start at the highest score.
4. **Nearest-neighbour with a small time preference.** Effective distance = km × (1 + 0.15 × how much later the candidate orders than the current store, capped). Score breaks ties. Real distance still decides when stores are far apart, so the route won't jump far just to follow order times.
5. **2-opt pass** on the GPS stops using real Haversine distance. It keeps the start fixed, stops after a set number of passes, and adds no new libraries.
6. **Total distance** is recalculated from the final order. If the optional AI reordering is accepted, it gets the same recalculation as today.
7. The facts heading and the AI prompt text are updated to name the 4 factors and stop mentioning dues or priority.

## Validation

Deno tests for the pure helpers (`visitOptimiser_test.ts`) cover:
- all stores with valid GPS: the 2-opt distance is never longer than plain nearest-neighbour or the old method
- missing or invalid coordinates: every store is still included, there are no duplicates, and the order is the same on every run
- nearby clusters stay next to each other
- an early-ordering store starts the route
- overdue stores and high-conversion stores rank higher
- a no-GPS store is placed next to stores from its own beat

After that, I'll deploy and test one live run through the edge function: compare the old and new distance and check the stop count. Then I'll report the files changed and the results.

## Technical details

- New `supabase/functions/ai-workflow-run/visitOptimiser.ts`: `validCoord`, `scoreStop`, `sequenceStops` (NN + time bias + no-GPS beat grouping), `twoOpt`, `routeKm`.
- `index.ts`: delete the `pending`/`priority` terms at lines 620–626 and replace lines 647–682 with helper calls. The output shape (`stops`, `totalKm`, `routeNote`, `sequence`, `typicalOrderTime`, etc.) stays the same, so the UI is unaffected.
