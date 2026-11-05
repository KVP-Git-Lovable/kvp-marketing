# Plan: Labels for Starter Picks, Territory Fallback and New Launch in AI Pitch Suggestions

## Goal

Show three small labels inside the existing four-card AI Pitch Suggestions panel, without changing the layout, styling, item counts, Take Action behavior, or any other recommendation logic:

- **Starter Picks** — inside Retailer Favourites, on items suggested for a brand-new store with zero orders and Retailer is new.
- **Territory Fallback** — inside Beat Favourite, on items that came from territory-level sales because the beat had too little data  and the Beat is New.
- **New Launch** — inside Schemes & Offers, on active focus products (focus product = new launch).

Top Seller stays sales-only: no New Launch label, and focus products never appear there (or in Retailer/Beat Favourite) unless they independently qualify on real sales.

## Current state (verified)

- `src/components/PitchSuggestionsCard.tsx` renders each suggestion as a small pill with name × quantity; the reason text is only a hover tooltip. No labels exist.
- `supabase/functions/ai-pitch-suggestions/index.ts` already computes starter picks (new stores, zero orders) and territory fallback, but only as reason text — there is no structured flag the UI can use.
- The focus-product / New Launch logic is **not present** in the function at all (no focus references), so Schemes & Offers cannot yet label or prioritize focus products.

## Changes

### 1. Backend — `supabase/functions/ai-pitch-suggestions/index.ts`

- Add an optional `tag` field to each suggested item: `"starter"`, `"territory"`, or `"new_launch"`.
  - Starter picks (existing zero-order logic) → `tag: "starter"`.
  - Beat Favourite items that came from the territory fallback → `tag: "territory"` (beat-sourced items get no tag).
- Implement the missing focus-product behavior in Schemes & Offers:
  - Load active products/variants flagged as focus products.
  - A focus product appears under Schemes & Offers **whether or not it has a scheme**; when it has an eligible scheme, the scheme text and required quantity are used as today; when it has none, it shows with a plain "New launch" reason and quantity 1 base unit.
  - Eligible focus products are prioritized first in the scheme ranking; existing scheme eligibility, quantity, duplicate-prevention (excluded keys from the other three categories) and the 2-item cap are preserved.
  - Focus products are excluded from Retailer Favourite, Beat Favourite and Top Seller candidate lists (they may only appear there if they qualify on real sales — per the user's rule, they should not; exclusion applies).
  - `tag: "new_launch"` on focus-product scheme items.
- No use of `created_at` as a launch date; no labeling of non-focus products.
- Bump `PITCH_CACHE_VERSION` so phones drop stale cached suggestions.

### 2. UI — `src/components/PitchSuggestionsCard.tsx`

- Extend `PitchCategoryItem` with optional `tag`.
- Render a small badge inside the item pill when `tag` is present:
  - `starter` → "Starter Pick"
  - `territory` → "Territory"
  - `new_launch` → "New Launch"
- Badge uses the same pill style family (small rounded chip, muted colors) — no layout, card, color-theme or count changes. Take Action and per-category add buttons unchanged.

### 3. Cache — `src/utils/pitchSuggestionsCache.ts`

- Bump version constant only.

## Out of scope

- No changes to scheme calculation, eligibility rules, quantities, Order Entry, Top Seller ranking, or the four-card layout.
- No database schema changes.

## Test cases

1. New store (≤14 days, zero orders, real store type with ≥3 ordering stores): Retailer Favourites items show "Starter Pick" badge.
2. Store on a thin beat (<3 ordering stores) with territory data: Beat Favourite items show "Territory" badge; beat-sourced items show none.
3. Store eligible for KADAK PYALI 400G (only active focus product): it appears under Schemes & Offers with "New Launch" badge, and not in the other three cards.
4. Focus product with no eligible scheme still shows under Schemes & Offers with "New Launch".
5. Top Seller never shows a badge; item counts per category unchanged (max 2).
6. Take Action still auto-fills all items including tagged ones.