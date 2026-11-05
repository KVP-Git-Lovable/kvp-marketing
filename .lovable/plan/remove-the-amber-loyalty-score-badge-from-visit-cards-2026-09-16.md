# Remove the amber Loyalty Score badge from visit cards

## What changes

On `/visits/retailers` (My Visits), each visit card shows two small badges under the retailer name: a credit score display and an amber "star + points" Loyalty Score badge (e.g. "★ 0 pts"). Remove the Loyalty Score badge and credit score.

## Scope — explicitly unchanged

- No other feature, page, or component is affected.
- Retailer data is untouched: no database, table, RLS policy, or query changes. The loyalty points system keeps working everywhere else (Retailer Loyalty pages, loyalty hub opened from other screens, points earning, rewards).
- Visit functionality is untouched: check-in, check-out, orders, no-order reasons, status badges, tracking indicator, AI insights, detail modals — all behave exactly as now.
- No layout changes beyond the badge disappearing; 

## Implementation (2 small edits, one file)

`src/components/VisitCard.tsx` — the only place the badge is rendered on this page:

1. Delete `<LoyaltyScoreBadge retailerId={visit.retailerId} />` from the badge row (line ~3024) and `<CreditScoreDisplay ... />`.
2. Delete the now-unused `import { LoyaltyScoreBadge } from "./loyalty/LoyaltyScoreBadge";` (line 52).

## Verification

- Typecheck and build pass.
- Playwright check of `/visits/retailers` confirms the amber star badge is gone under retailer names and the credit score badge.