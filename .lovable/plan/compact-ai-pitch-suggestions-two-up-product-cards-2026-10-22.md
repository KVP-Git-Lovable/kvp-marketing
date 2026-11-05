# Compact AI Pitch Suggestions — two-up product cards

UI-only redesign of the AI Pitch Suggestions panel on Order Entry, following the uploaded reference. Recommendation logic, quantities, Take Action, Add/Added toggle, images and the existing pastel palette stay unchanged.

## What changes

1. **Header** — title, sparkle icon, Take Action and the collapse chevron stay on one row. Category tabs become compact tiles (icon, two-line label, count) with the existing category tint on the selected tab.
2. **Selected category row** — category icon + name, "N items", and a chevron to close it.
3. **Two cards side by side** on all widths (equal columns, small gap, no horizontal scroll). Each card, top to bottom:
   - Product image (about 64 px, only when a real image loads — no placeholder), category label chip (e.g. Top Seller, Starter Picks, Territory Fallback, New Launch under the existing rules), info icon top-right.
   - Product name (wraps to 2 lines max) and suggested quantity + unit.
   - **Scheme Available** green tag (or "2 Schemes Available") only when an active scheme applies to this exact product/variant for this retailer; tapping opens the existing scheme details popup. Hidden otherwise.
   - **Two short insight rows** with small icons, built only from data already returned: row 1 = the verified evidence line (adoption, order count, last purchase), row 2 = the short AI reason. If one is missing, show only what exists — never filler text.
   - Bottom row: Dislike, Like, and green **Add (+)** button (turns to Added; tapping again removes, as today).
4. **Info popup** keeps the full explanation and closes on outside tap (existing behaviour).

## Points to note

- **Like/Dislike saved centrally:** each tap is saved to the database with the salesperson, retailer, category, exact product/variant, suggested quantity and Like/Dislike. Tapping the same button again clears it; tapping the other switches it. The choice shows again when the same store is reopened, on any device. Offline taps go into the existing offline queue and sync later. Feedback is recorded only — it does not change which products are recommended (that can be a later step). Managers can read their team's feedback; reps see only their own.
- **Scheme badge:** the pitch result does not carry per-product scheme info, so the card will check the same active, retailer-eligible schemes the order form already uses, matched by exact product/variant. If that check fails or is offline, the badge is simply hidden.
- Insight text is not invented; the reference's "High demand / Growing popularity" wording is only used where the real data says so.

## Technical scope

- `src/components/PitchSuggestionsCard.tsx` (layout), a small local hook for applicable schemes reusing existing scheme eligibility helpers, a `usePitchFeedback` hook, and `PitchSuggestionsCard.test.tsx` updates.
- New table `ai_pitch_feedback` (user_id, retailer_id, category, product_id, variant_id nullable, suggested_qty, unit, feedback 'like'|'dislike', created/updated_at), unique per user + retailer + product + variant so a re-tap upserts/deletes (duplicate 23505 treated as success). GRANTs to authenticated/service_role, RLS: users manage own rows; select also via existing subordinate hierarchy function. Existing `ai_feature_feedback` has no product column, so it is not reused.
- No changes to edge functions, recommendation logic, AI prompts or Order Entry matching. Hardcoded pastel palette kept per project rule.

## Validation

- Mobile (375 px) and desktop: two cards per row, no overflow, long names wrap.
- Scheme badge shown only for an eligible item; hidden for others.
- Exactly ≤2 insight rows; missing evidence hides a row.
- Info popup outside-tap close; Like/Dislike toggles; Add → Added → Add and Take Action unchanged; all four tabs work.
