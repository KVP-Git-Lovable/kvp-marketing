# Replace the Churn banner on visit cards with an AI Retailer Insight

The yellow banner on each store's visit card (My Visits) stops using Churn Risk and instead shows one AI-written sentence built only from that store's Retailer Overview and Payments numbers.

## What the salesperson sees

One sentence, in the same banner spot, only when at least one alert applies:

| Last visit > 30 days ago | Outstanding > 50% | Banner shows |
|---|---|---|
| Yes | Yes | Avg Order Value/Visit + Last Visit Date + Outstanding amount |
| Yes | No | Avg Order Value/Visit + Last Visit Date |
| No | Yes | Avg Order Value/Visit + Outstanding amount |
| No | No | No banner |

Example: "Big Bazaar averages ₹2,023 per visit but hasn't been visited since 02/09/2026 and still owes ₹4,800 — drop by this week to collect and take a fresh order."

Never bullets, labels or multiple sentences; never the words "present", "qualifies" or "criteria".

## Exact numbers (same as Retailer Overview)

- **Avg Order Value/Visit** — total of the store's confirmed + delivered orders divided by the number of productive visits that have an order (identical to the Highlight tab).
- **Last Visit Date** — the latest productive/unproductive visit's planned date, shown as dd/MM/yyyy; days since = today minus that date.
- **Outstanding** — closing balance from the store's payment ledger (same source as the Payments tab). Percentage = outstanding ÷ total billed in that ledger. Only counted when outstanding is positive and billed > 0.
- Money formatted with the app's current currency, matching what the overview shows.

## How it works

1. A new shared helper computes the three overview values per store, reusing the exact formulas above (the Retailer Overview screen itself is left untouched).
2. The helper decides which alerts apply. If none, nothing is shown and no AI call is made.
3. Otherwise a new backend function sends only the chosen values (store name + the exact formatted figures) to Lovable AI and gets back one sentence. The prompt forbids adding any other numbers or the banned words; the reply is checked (one sentence, contains the exact figures, no banned words) and falls back to a fixed template sentence if the check fails or AI is unavailable.
4. Sentences are cached per store per day so the list doesn't re-call AI on every scroll/refresh; cache refreshes when the figures change.

## What is removed / unchanged

- Removed from visit cards: the churn banner and its use of the Churn Detector result on My Visits.
- Unchanged: New Retailer, Visit Optimiser and Sales Coach banners keep their existing priority (the Retailer Insight takes the churn slot); the Churn Risk card on My Retailers, the Churn Detector agent itself, orders, payments, Retailer Overview and the payment ledger.

## Technical details

- `src/pages/MyVisits.tsx`: drop `useChurnRisk`/`churnInsightLine`; add `useRetailerInsights(retailerIds)` and set `aiInsight = { kind: "retailer", line }` in the churn slot.
- `src/components/VisitCard.tsx` + `VirtualizedVisitList.tsx`: add `"retailer"` kind (reuse current banner styling, tooltip "AI Retailer Insight — from Retailer Overview & Payments").
- New `src/lib/retailerOverviewMetrics.ts`: batched queries for visits, orders (`confirmed`,`delivered`) and `get_retailer_payment_ledger` per store; returns `{ avgOrderValuePerVisit, lastVisitDate, daysSince, outstanding, billed, pct }`.
- New edge function `retailer-visit-insight`: validates input with Zod, uses `LOVABLE_API_KEY`, model `openai/gpt-5-nano` (project preference) via the Lovable AI gateway; batch of stores per request; handles 402/429 by returning template fallback.
- New `useRetailerInsights` hook with sessionStorage cache keyed by retailer + date + figure hash.
