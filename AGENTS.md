# Architecture rules
- Communication UI guards unsupported saved-list categories and reads structured Meta terms errors without changing database constraints or accepting third-party terms automatically.
- Retailer card insights share `useRetailerInsights` and the existing `retailer-visit-insight` function instead of querying the Churn Detector, so card surfaces use identical Overview/Payments eligibility and narration.
- AI Pitch product imagery is resolved separately in the client by exact product/variant ID; optional image failures never alter recommendations or order autofill.
- AI Pitch compact labels and How to Pitch guidance derive in the client from existing recommendation and scheme data; no extra AI call is needed and full verified evidence remains accessible.
- `PitchSuggestionsCard` intentionally uses hardcoded Tailwind pastel classes (rose/sky/orange-amber/emerald, black Take Action, emerald Add) instead of semantic tokens — this palette is user-mandated for this card only; don't copy it elsewhere or "fix" it.
- Pitch, Order Entry and Cart use shared retailer eligibility and monetary-benefit selection over the existing scheme engine; unknown free-goods values or buyer choices stay manual rather than receiving invented benefits.
- Pitch actions use exact product/variant identity and idempotent desired quantities, while voice autofill remains additive; card order state comes from the authoritative order snapshot.
- Files whose tables are missing from the generated database types import the loosely-typed client from `@/lib/supabaseLoose`; why: this remix's database is still partial, and regenerating the types would otherwise break the build.
