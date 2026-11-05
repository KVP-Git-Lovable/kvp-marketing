# AI Retailer Insight — show for all retailers, new eligibility rules

## Goal

Every retailer (new or existing) gets an AI Retailer Insight line whenever a valid average order value exists, instead of only retailers that are stale or heavily owing. One sentence per store, built from real Overview/Payments figures.

## Current behaviour (verified)

- `src/hooks/useRetailerInsights.ts` only builds a line when `daysSinceLastVisit > 30` **or** `outstandingPct > 50` — otherwise the retailer gets no insight at all.
- `outstandingPct` is outstanding ÷ total billed, not vs. average order value.
- New retailers with no orders have avg = 0 and produce nothing.
- The `retailer-visit-insight` edge function already writes one sentence from the values it is given and always mentions the average order value; no change needed there.

## Changes

### `src/hooks/useRetailerInsights.ts` (only file changed)

1. **Include every retailer with valid data**: build an insight input whenever `avgOrderValuePerVisit > 0` (valid data available). Skip only when the average is 0/missing — no invented figures.
2. **Last visit date**: include only when `daysSinceLastVisit > 30` (unchanged rule, still safe when the date is null).
3. **Outstanding amount**: include only when `outstanding > 50% of avgOrderValuePerVisit` (new rule, replaces the billed-based `outstandingPct` check). Guard against avg = 0.
4. **Fallback sentences** (`fallbackLine`) cover all four combinations:
  - both: "…averages ₹1,80,930 per visit but was last visited on 02/09/2026 and still owes ₹60,000, so visit soon to collect the dues and take a fresh order."
  - last visit only / outstanding only: existing single-condition variants.
  - **neither (new)**: "…Show nothing
5. New and existing retailers go through the identical path; missing values are simply omitted from the input, so the AI sentence and the fallback both handle them safely.
6. Cache key already includes avg/lastVisit/outstanding, so stale cached lines can't leak across rule changes.

### Not changed

- `retailer-visit-insight` edge function, `fetchRetailerOverviewMetrics`, order calculations, and all UI components (`RetailerInsightLine`, beat cards, visit cards) stay as-is — they already render whatever line the hook returns.

## Result

- Both conditions → "Avg order ₹1,80,930; last visit 02/09/2026; ₹60,000 outstanding." (as one natural AI sentence containing exactly those values)
- Only last-visit → "Avg order ₹1,80,930; last visit 02/09/2026."
- Only outstanding → "Avg order ₹1,80,930; ₹60,000 outstanding."
- Neither → Show nothing.

## Testing

- Unit-test `fallbackLine` for all four combinations.
- Browser check on `/visits/retailers`: a regular retailer now shows an avg-only line; a stale/owing retailer shows the full line; a brand-new retailer with no orders shows no line (no misleading figures).