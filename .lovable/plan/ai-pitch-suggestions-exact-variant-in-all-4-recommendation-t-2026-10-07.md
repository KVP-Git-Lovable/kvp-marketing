# AI Pitch Suggestions: exact variant in all 4 recommendation types

Retailer Favourite, Beat Favourite, Top Seller and Scheme will each treat every variant as its own item. Variants are never folded into the parent product. Time windows, thresholds, top-2 limits, the AI explanation rules and the card layout stay the same.

## What the salesperson will see

- The card shows the exact item the logic selected. A parent product shows the parent product name. A variant shows its exact variant name from the variant master, for example "ADARAK 250G" or "SAMPLE ADRAK (FS)", never the parent "ADRAK 40G". A variant is never renamed to its parent, and the two are never merged.
- Sales value, order counts, store counts, ranking and the suggested quantity are worked out per variant. Two variants of the same parent are never added together.
- "Already bought" exclusions are per variant. Buying one variant does not hide a different variant of the same parent.
- A variant is only suggested if variant is active. Parent is suggested if parent is active
- Tapping a suggestion, or using Take Action, adds that exact variant to the order. This works in both the table view and the grid view.

## Technical details

Each item is identified by `product_id` plus `variant_id`, using "base" when there is no variant. Product-name text is no longer used as a key.

**Database migration:** recreate `get_company_top_sellers(p_days)` so it groups by `(product_id, variant_id)`.

- It returns an added `variant_id` column, and `product_name` comes from `COALESCE(variant_name, product name)`.
- Unchanged: `lower(status) = 'confirmed'`, active products only, ordering by value then quantity, `LIMIT 2`, SECURITY DEFINER, and access for signed-in users only. Inactive variants are now also excluded.
- The function is dropped and recreated because its return type changes.

**Edge function `ai-pitch-suggestions/index.ts`:**

- `fetchRetailerHistory`, `fetchRetailerFavourites` and `fetchBeatFavourites` select `order_items.variant_id` and aggregate by the variant key.
- `boughtKeys` uses variant keys.
- Load active `product_variants` (`id, product_id, variant_name, price, is_active`). `resolveActive(productId, variantId)` returns the variant's own name and keeps the parent's unit. It returns nothing if the variant or its parent is inactive, and it never falls back to the parent.
- Scheme: `product_schemes.variant_id` is used when it is set, so a variant-specific scheme shows and fills that variant. Schemes without a variant behave as they do now.
- `Candidate` and the response items gain an optional `variantId`. Only a field is added, so the response contract stays compatible.
- `modeLine` and the median fallback run on each variant's own lines. Affinity uses the parent's category.

**Client:**

- `PitchSuggestionsCard.tsx` passes `variantId` and `variantName` into auto-fill.
- `OrderEntry.tsx` auto-fill keeps the given `variantId`, with the existing name and ID matching as a fallback. Grid mode fills the `baseId_variant_variantId` key and selects that variant.
- `TableOrderForm` already handles `variantId`.
- Bump `PITCH_CACHE_VERSION` from v9 to v10.

**Untouched:** prompt wording, reason parsing and validation, the deterministic fallback, other edge functions, and the shared Together.ai client.