# AI Pitch: Add both button, quantity line, and ADUKU 20G offer fix

## 1. Add both button (look only)
Replace the text-only "Add both +" with the same green Add button used on each product card (same colour, rounding, height, font, + icon). Chevron stays separate on the right. Same action as today.

## 2. Quantity on one line
Keep `Qty: 10 KG` together (number and unit never split), using the existing font size and colour. Fix is layout only (prevent the break between number and unit, let the name area shrink instead).

## 3. Find why ADUKU 20G shows 20 KG (investigate first, then fix)
Diagnosis is not yet confirmed. Steps:
- Read the real ADUKU 20G product, its variants, and the "Buy 10 KG, get 700 g ADUKU 100G free" offer from the database (units, condition quantity, free product, free unit, active dates, retailer eligibility).
- Run the suggested-quantity calculation on that exact data and see which check rejects the offer. Likely suspects, to be confirmed or ruled out:
  - the offer unit (KG) is compared to the card's unit and skipped when they differ (no conversion today);
  - the free item's value is in grams of a different product (ADUKU 100G), so its money value can't be worked out, the offer scores zero and the card falls back to the normal 20 KG quantity;
  - the offer is matched to the parent product, not the exact variant.
- Fix the confirmed cause using existing unit conversion and scheme rules. No hardcoded 10 KG.

## 4–5. Automatic offer when Add is pressed (investigate first, then fix)
- Trace: card Add -> order line update -> automatic offer selection -> offer stored on the order -> cart totals. Note the exact step where the offer is dropped.
- Fix so the chosen offer and its free quantity / discount are saved on the order, quantity meets the condition, units convert correctly, and the "one offer per order" rule is respected.

## 6. Consistency
All applicable offers stay listed in the scheme popup; the highest real money benefit is selected and its required quantity is shown. No eligible offer -> existing quantity logic unchanged.

## 7. Verification
- Add tests for ADUKU-style case: KG condition with free item in grams of another product; quantity shown = offer quantity; Add saves offer and free quantity; one-offer limit.
- Check on Laxmi Medical Stores Mangaluru: card shows offer quantity, Add puts it in the order with the free item, and totals are correct. If I can't sign in to the preview, I'll say that part is unchecked.
- Report the confirmed root cause.

## Out of scope
Colours, card layout, images, insights, Like/Dislike, Take Action, recommendation logic, other screens.

## Technical notes
- `pitchSchemeSuggestion` in `src/utils/pitchSchemeSelection.ts` skips offers whose `condition_unit` differs from `item.unit` and returns the fallback quantity if `monetarySchemeBenefit` is null/0. Both paths get checked against real data.
- Add-path trace covers `PitchSuggestionsCard.tsx`, `OrderEntry.tsx`, `useAutomaticOrderSchemes.ts`, `schemeEngine.ts`, `useSchemeFreeRates.ts`.
- No database, permissions or backend function changes.
