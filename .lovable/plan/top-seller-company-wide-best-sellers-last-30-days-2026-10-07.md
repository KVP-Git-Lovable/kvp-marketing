# Top Seller: company-wide best sellers (last 30 days)

Only the **Top Seller** category of AI Pitch Suggestions changes. Retailer Favourites, Beat Favourite, Schemes & Offers, the AI wording rules, and the screen all stay as they are.

## New behaviour

- **What it looks at:** every confirmed order across the **entire company** in the last 30 days — no filtering by retailer, beat, salesperson, or region.
- **Ranking:** by total sales value (₹), with total quantity sold as the tiebreaker. Only **active** products are ranked.
- **How many:** the top 2 products.
- **No exclusion:** products the target retailer already buys are **still shown** (the `boughtKeys` exclusion is removed for this category only).
- **Suggested quantity:** the Mode of quantities ordered (most frequent line quantity in the product's most-used unit), with the existing Median (`typicalLine`) as fallback — the same `modeLine` helper Beat Favourite already uses.
- **AI role unchanged:** `gpt-5-nano` only writes the explanation text from the facts it is given. It cannot invent or change any product, sales, or quantity data.
- **Signal text example:** "One of the company's top 2 sellers in the last 30 days — ₹X sold across Y orders — typical line 10 PIECE".

## Why a database RPC is needed

A field sales rep's login can only read their own orders (row-level security). Company-wide sales must be computed server-side, so the aggregation moves into a database function that runs with elevated privileges but returns only safe, aggregated numbers — never other reps' orders, retailers, or invoices.

## Technical details

### 1. New database function (migration)

`get_company_top_sellers(p_days int)` — `SECURITY DEFINER`, `SET search_path = public`, `STABLE`:

- Joins `order_items` → `orders` where `orders.status = 'CONFIRMED'` and `orders.created_at >= now() - p_days`.
- Joins `products` and keeps only active products (`is_active = true` or null).
- Groups per product: `product_id`, `product_name`, `total_value` (sum of `order_items.total`), `total_qty` (sum of quantity), `order_count`, and a `unit_lines` JSONB map of unit → array of line quantities (for the Mode calculation).
- Ordered by `total_value` desc, `total_qty` desc; `LIMIT 2`.
- `GRANT EXECUTE` to `authenticated` only. Returns aggregates only — no order, retailer, or rep-level data leaks.
- Company scoping: aggregates across all confirmed orders (the company runs a single tenant today); if a `company_id` filter is later needed it can be added without changing the contract.

### 2. Edge function: `supabase/functions/ai-pitch-suggestions/index.ts`

- Add `TOP_SELLER_WINDOW_DAYS = 30` constant.
- Replace the `fetchRepTopSellers(supabase, userId)` call with `supabase.rpc("get_company_top_sellers", { p_days: TOP_SELLER_WINDOW_DAYS })`. Delete `fetchRepTopSellers` (no other caller).
- Top Seller candidate assembly:
  - Remove the `!boughtKeys.has(...)` filter for this category.
  - Products arrive pre-ranked and pre-limited to 2 from the RPC; keep `resolveActive` as a safety net.
  - Quantity via existing `modeLine(p.unit_lines)` (Mode, Median fallback) instead of `typicalLine`.
  - New signal text as above.
- Update the header comment (line 24) to describe the company-wide definition.

### 3. Cache bump

- `src/utils/pitchSuggestionsCache.ts`: bump `PITCH_CACHE_VERSION` from `v7` to `v8` so stale per-rep Top Seller cards are discarded.

### Untouched

- Retailer Favourites, Beat Favourite (including its 30-day peer logic), Schemes & Offers.
- The prompt, response contract `{ kind: "pitch", ... }`, pick-validation loop, deterministic fallback.
- All other edge functions and the shared Together.ai client.
