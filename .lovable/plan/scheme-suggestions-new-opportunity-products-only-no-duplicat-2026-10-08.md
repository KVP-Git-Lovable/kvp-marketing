# Scheme Suggestions: new-opportunity products only, no duplicates

Scope: only the Schemes & Offers logic inside the `ai-pitch-suggestions` edge function. The AI Pitch UI, the other three categories, scheme calculation/eligibility rules, and Order Entry stay untouched.

## What changes for the salesperson

- Schemes & Offers now recommends a product the retailer does **not** regularly buy — preferring products never purchased, then rarely purchased ones.
- It never repeats a product already shown under Retailer Favourite, Beat Favourite, or Top Seller in the same card.
- All existing scheme rules still apply: active + in date range, applicability specificity (retailer > beat > territory/distributor > salesperson > global), product/variant targeting, first-order and other conditions, and the suggested item must be an active, orderable product or exact variant.
- If every eligible scheme product is already suggested elsewhere or regularly bought, Schemes & Offers shows 0 items rather than a duplicate.

## Technical details

**`supabase/functions/ai-pitch-suggestions/index.ts`:**

1. `fetchBestScheme` gains two parameters: `boughtKeys` (the retailer's purchase-history item keys, already built for Beat Favourite exclusions) and `excludedKeys` (item keys of the final Retailer Favourite / Beat Favourite / Top Seller candidates).
2. Inside the existing ranked-scheme loop, each scheme's resolved product is checked:
   - skip if its item key (`product_id` + `variant_id`) is in `excludedKeys` — no cross-category duplicates;
   - skip if its item key is in `boughtKeys` (regularly purchased);
   - first passing scheme wins, keeping the current specificity ordering.
3. Fallback pass: if no never-purchased scheme product qualifies, repeat the loop allowing rarely purchased products (bought but below a small frequency threshold, e.g. 1 order in the window), so the category can still surface a scheme when the retailer buys almost everything with offers. If that also yields nothing, return null (0 items).
4. Ordering change: the three other candidate lists are assembled first, their item keys collected into `excludedKeys`, and only then is the scheme candidate resolved. The four data fetches stay parallel; only scheme candidate selection moves after candidate assembly.
5. Suggested quantity, unit, signal text (`describeScheme`), caps, and the AI narration layer are unchanged.
6. Bump `PITCH_CACHE_VERSION` v12 → v13 in `src/utils/pitchSuggestionsCache.ts` so stale cached cards are discarded.

**Untouched:** `get_company_top_sellers` RPC, Retailer/Beat/Top Seller logic, scheme eligibility and specificity rules, UI components, Order Entry autofill, other edge functions.
