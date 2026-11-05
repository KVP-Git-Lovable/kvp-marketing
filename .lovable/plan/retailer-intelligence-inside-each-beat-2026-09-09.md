# Retailer Intelligence inside each Beat

Replace the plain retailer list on the Beat page (My Beat → beat name → "Retailers in this Beat") with the retailer board from the uploaded reference: beat health summary + state filter chips + compact priority-sorted table + inline retailer detail panel. Structure follows the reference exactly; styling uses the existing Beat page design system (existing Card, Badge, Table, chips, spacing, fonts, colour tokens).

## What the user will see

1. **Beat health strip (top card)**
   - Beat name, owner, retailer count, "as at" date on the left; total beat value on the right (90-day headline, current-FY value as the secondary line).
   - A thin horizontal distribution bar showing the mix of retailer states.
   - Filter chips with counts: All, Growing, Steady, New, Slipping, At Risk, Never Started, Dormant, Prospect. Clicking filters the list instantly, no navigation.
   - Summary figures: total / active / at-risk / new / dormant retailers, total value, average order value, last visit and last order.

2. **Retailer table (compact)**
   - Columns: Retailer (name + "Category X · behaves Y" subline + small flags like "grade gap", "effort sink"), State chip, Value (with "₹X at risk" subline), Momentum, Overdue (multiple + days since), Premium mix bar.
   - Default sort: value at stake, then value — so high-value overdue/declining retailers come first.
   - Header title/subtitle change with the active filter; empty state per filter ("No retailers in this state").
   - Existing search box and export button are kept.

3. **Retailer detail panel (inline, same page)**
   - Opens below the table when a row is clicked (row stays highlighted), no separate page.
   - Header: name, "Category A · behaves like B · N visits, M orders", state chip.
   - A one-line verdict written from that retailer's own numbers (momentum %, rhythm days, overdue multiple, value at stake, last logged no-order reason). No hard-coded generic text.
   - Metric tiles: Value, Momentum, Rhythm, Overdue, Avg order, Conversion (orders/visits), Premium mix, Grade (category → behavioural grade). Unavailable metrics show "—".
   - The existing full retailer modal stays reachable from a link in this panel.

4. **Responsive**
   - Desktop: full table. Tablet: Momentum and Premium columns hidden. Mobile: card-style rows keeping Retailer → State → Value → Overdue/priority; detail panel full width; no horizontal overflow.

## Data and calculations (all from existing data)

- Retailers: existing `retailers` rows for the beat (already fetched).
- Orders: confirmed `orders` for those retailer ids — last 90 days for momentum/rhythm/overdue, plus current FY for the FY value already shown.
- Visits: `visits` rows for those retailers (visit count, conversion, and `no_order_reason` as the "last objection").
- Order items joined to products to compute **premium mix = share of a retailer's value from products priced above the beat's average unit rate** (chosen over a premium flag, which does not exist in the schema).
- Derived per retailer: median order gap (rhythm), days since last order, overdue multiple, momentum (recent vs own average), AOV, value at risk = value × overdue-weighted factor.
- State rules, in order: no orders → Prospect; 1 order and >60 days → Never Started; 1 order → New; >75 days silent → Dormant; overdue ≥2× → At Risk; overdue ≥1.5× or momentum ≤ −25% → Slipping; momentum ≥ +15% → Growing; else Steady.
- Behavioural grade from actual value/consistency versus assigned category; "grade gap" flag when it under-performs by two grades.
- Everything recomputed from live query results, so it updates when orders/visits change. No sample or invented data; missing metric renders "—".

## Technical notes

- New `src/components/beat/BeatRetailerIntelligence.tsx` — presentation: summary strip, chips, table, detail panel.
- New `src/hooks/useBeatRetailerIntelligence.ts` — batched Supabase reads (orders, order items/products, visits) for the beat's retailer ids and all derivations, memoised.
- `src/pages/BeatDetail.tsx` — the "Retailers in this Beat" card body is replaced by the new component; search, export, and `RetailerDetailModal` wiring are preserved. No other Beat pages or beat logic touched.
- Uses existing shadcn Table/Card/Badge/Button and semantic colour tokens; no new visual language, no new route.
