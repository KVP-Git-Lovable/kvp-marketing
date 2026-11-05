# Restore the previous AI Pitch Suggestions color palette

## Current state (verified)

- `src/components/PitchSuggestionsCard.tsx` currently uses muted semantic tokens: category colors `destructive` / `beat-assigned` / `warning` / `success`, a neutral card header, and a default primary Take Action button.
- The previous design (version history, commit before the Option 4 redesign) used a distinct pastel palette:
  - Category tiles: rose (Retailer Favourites), sky (Beat Favourite), orange-amber (Top Seller), emerald (Schemes & Offers) as `bg-gradient-to-br from-<tint>-100 to-<tint>-50` with dark-mode `dark:from-<tint>-950/40 dark:to-<tint>-950/20` and icon colors `text-<tint>-600 dark:text-<tint>-400`.
  - Header card: red-500 border, amber/yellow/orange gradient background, a thin top strip `bg-gradient-to-r from-red-500 via-amber-400 to-orange-500`, and the Sparkles icon in an amber-tinted rounded box.
  - "New Retailer" chip: emerald-tinted pill with border.
  - Take Action: solid black button (`bg-black text-white`).
  - Add buttons: solid emerald-500.

## Changes (styling only, same file)

Keep the current Option 4 layout and all behavior unchanged — compact category tabs, one expandable category at a time, overall collapse chevron, images, Starter Picks / Territory Fallback / New Launch labels, per-item Add/Added, category add-all, and Take Action.

Restore the previous palette onto that layout:

1. Header: red border, amber/yellow/orange gradient card background, thin red→amber→orange top strip, Sparkles in an amber-tinted rounded icon box, emerald "New Retailer" chip.
2. Category tabs: selected/active state uses the matching rose / sky / orange-amber / emerald pastel gradient (with dark-mode variants) and icon color; unselected tabs stay neutral outline.
3. Expanded category section: same matching pastel gradient tint as before.
4. Take Action: solid black button as previously.
5. Per-item Add buttons: solid emerald-500 (hover emerald-600); "Added" state stays a disabled neutral outline with the check icon.
6. Tag badges keep their neutral muted pill but inherit the category icon color, as now.

All hardcoded Tailwind palette classes here are intentional, per your request to keep the previous look; no other card adopts them.

## Scope guardrails

- Only `src/components/PitchSuggestionsCard.tsx` styling changes (plus its test file only if a test asserts a removed class).
- No changes to recommendation logic, data fetching, caching, autofill, quantities, labels, or any other component.

## Validation

- Run the existing vitest suite for the card.
- Check the build log for errors.
- Playwright screenshots of the panel (tabs, expanded category, item rows, Take Action) in light and dark themes to confirm the restored palette renders correctly at desktop and narrow widths.
