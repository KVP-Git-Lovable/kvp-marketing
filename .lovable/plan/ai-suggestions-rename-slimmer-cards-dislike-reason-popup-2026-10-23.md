# AI Suggestions — rename, slimmer cards, Dislike reason popup

## What changes
1. **Names:** section title "AI Pitch Suggestions" becomes **"AI Suggestions"** (including screen-reader labels). "Take Action" becomes **"Add All"**, and the lightning icon is removed. The button keeps its black style and does exactly what it does today.
2. **Slimmer cards:** remove the two insight chips ("Past Purchase", "Recent Orders" and so on) from each product card. The info icon popup still shows everything: why the product is recommended, the evidence, How to Pitch and scheme details. Image, name, quantity, scheme indicator, Like/Dislike and Add stay as they are, two cards side by side.
3. **Dislike reason popup:** tapping Dislike opens a small, compact popup over the card containing:
   - quick reason chips: Not relevant, Already stocked, Low demand here, Price too high, Wrong quantity, Other
   - an optional short text box (up to 200 characters)
   - **Cancel**: closes the popup and saves nothing, so Dislike stays as it was
   - **Save**: records the Dislike with its reason through the existing feedback saving, including offline queueing. Save works only after a chip is picked or text is typed.
   - Tapping Dislike again on a product that is already disliked clears it straight away, as today, with no popup. Like works exactly as before.

## Technical details
- `PitchSuggestionsCard.tsx`: change the labels, remove the `Zap` icon and the insight `<ul>`. Add a Dialog with the reason chips, a Textarea and Cancel/Save, and send Dislike through it. The hardcoded pastel palette stays as it is.
- Migration: add a nullable `reason text` column to `ai_pitch_feedback`, with at most 200 characters checked in the existing validation trigger. Grants and row access rules stay unchanged.
- `usePitchFeedback.ts`: `toggle` accepts an optional `reason`, which is stored in the upsert and in the pending queue. Clearing a Dislike deletes the row, as it does now.
- Tests: Cancel does not save. Save sends a Dislike with its reason. Disliking an already-disliked product clears it with no popup. The existing tests stay green.
- No changes to the edge functions, recommendation logic, quantities or scheme logic.
