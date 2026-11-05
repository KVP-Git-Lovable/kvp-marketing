# Restyle the ROCR badge on visit cards with a trend-arrow icon

## What the user asked for
On the My Visits page (`/visits/retailers`), replace the existing ROCR badge under the retailer name with a compact pill in the style of the attached reference: a small upward-trend arrow icon followed by "ROCR 15.38%", in a rounded light pill with subtle professional styling.

Strict scope — must NOT change:
- The ROCR value, its calculation, or the underlying RPC (`get_retailer_rocr_30d`)
- The badge's position on the card (under retailer name) and its show/hide rules
- Retailer name, spacing, existing colors (teal pill family), and all other card elements
- User-wise PTV, retailer-wise PTV, visit/order logic, or any other feature

This is a UI-only change to the ROCR indicator.

## Current state (verified)
- The ROCR badge is rendered by exactly one component: `src/components/RetailerROCRBadge.tsx`.
- It is used in exactly one place: `src/components/VisitCard.tsx` (line ~3024), below the retailer name block.
- Today it renders as `<Badge variant="secondary" className="bg-teal-500/10 text-teal-700 border-teal-500/20 ...">ROCR&nbsp;15.38%</Badge>` — text-only, no icon.
- The hide-when-empty rule (no planned days / loading / error) lives in `RetailerROCRBadge.tsx` and stays as-is.

## Change
Only `src/components/RetailerROCRBadge.tsx` is edited:

1. Import `TrendingUp` from `lucide-react`.
2. Replace the text-only badge content with a compact inline pill:
   - `TrendingUp` icon at small size (~12px, same teal color, matching stroke width) followed by "ROCR 15.38%".
   - Keep the existing teal token classes (`bg-teal-500/10 text-teal-700 border-teal-500/20`) and same text size/padding so position and spacing on the card are unchanged; round the pill fully (`rounded-full`) and tighten the gap between icon and text for the subtle, professional look in the reference.
   - Keep the existing `title` tooltip.
3. No changes to the query, props, hide rules, or `VisitCard.tsx` (the badge component's external footprint is identical).

## Verification
- Typecheck/build passes (build-errors.log clean).
- Optional: confirm in preview that the badge on a visit card shows the trend icon + value in a light teal pill, with no layout shift to surrounding elements.
