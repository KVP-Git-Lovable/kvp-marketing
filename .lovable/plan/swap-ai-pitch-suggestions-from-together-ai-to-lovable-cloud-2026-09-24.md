# Swap ai-pitch-suggestions from Together.ai to Lovable Cloud AI

Single call-site change in `supabase/functions/ai-pitch-suggestions/index.ts`. Nothing else in the project is modified.

## What changes (only inside this one file)

### 1. Import line (lines 24–28)
Drop only `streamChat` from the `_shared/together/togetherClient.ts` import. Keep `type ChatMessage` (still used to type the `messages` array) and keep `TogetherError` (still referenced in the outer catch's message builder at line 612). The shared Together client files are NOT touched — five other functions still use them.

### 2. Key lookup (line 461)
```ts
const apiKey = Deno.env.get("TOGETHER_API_KEY");
```
becomes
```ts
const apiKey = Deno.env.get("LOVABLE_API_KEY");
```
The guard shape `if (apiKey && candidates.length)` is unchanged — when the key is missing or there are no candidates, the AI is skipped entirely and the deterministic fallback runs.

### 3. The LLM call (lines 497–505)
Replace the `streamChat(...)` + stream-drain + `Promise.all([stream.fullText, drain])` with a single non-streaming fetch, following the `generate-competition-ai-summary` pattern already in this repo:

```ts
const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  signal: req.signal,
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages,
    response_format: { type: "json_object" },
  }),
});
```

- `signal: req.signal` so client aborts still cancel the request (an abort throws inside the existing try and lands in the existing `catch (aiErr)`, then the deterministic fallback runs — same recovery shape as today).
- `messages` is passed through untouched — the system prompt and user message stay word-for-word identical.
- Model and response_format match the repo's existing Lovable AI pattern; the model only picks candidate numbers and writes reasons, exactly as before.

### 4. Reply handling + provider-status logging (new, between the fetch and the existing JSON handling)
```ts
if (resp.status === 429) {
  console.error("[ai-pitch-suggestions] Lovable AI rate limited (429); falling back to deterministic picks");
} else if (resp.status === 402) {
  console.error("[ai-pitch-suggestions] Lovable AI credits exhausted (402); falling back to deterministic picks");
} else if (!resp.ok) {
  console.error("[ai-pitch-suggestions] Lovable AI gateway error:", resp.status, await resp.text());
} else {
  const data = await resp.json();
  const text = String(data?.choices?.[0]?.message?.content ?? "");
  // existing match/parse/pick logic runs on `text` below, unchanged
}
```
The 429/402 messages are logged distinctly so a silent fallback is never mistaken for the AI working. Any non-OK status, a JSON parse failure, or an unusable reply falls through to the existing deterministic fallback via the unchanged `if (!suggestions.length)` block.

## What stays exactly as it is

- The `messages` array — both prompts, word for word.
- The existing `try { ... } catch (aiErr) { console.error(...) }` around the call.
- All JSON handling after the call: the `/\{[\s\S]*\}/` extract, `JSON.parse`, candidate-number range check, `seen` dedupe, `MAX_SUGGESTIONS` cap, `reason.slice(0, 200)`, blank-reason fallback to `c.signal`.
- The deterministic fallback `candidates.slice(0, MAX_SUGGESTIONS)`.
- All candidate builders (pushRegulars, pushTopSellers, pushBeatFavourites, pushAffinity, pushReorder), SQL, tags, quantities, units, product ids.
- The deterministic mix guard and the response contract `{ kind: "pitch", retailerId, ... suggestions, summary }` — `PitchSuggestionsCard.tsx` needs no change.
- Every other edge function, the shared Together client, database/RLS, frontend files, and the pitchSuggestionsCache behaviour.

## Verification

1. Check `/tmp/observability/build-errors.log` after the edit (edge functions aren't typechecked by the Vite build, so also review the edited region by re-reading the file).
2. Confirm no `TOGETHER_API_KEY` reference remains in this file (`rg TOGETHER_API_KEY supabase/functions/ai-pitch-suggestions/`), while the five other Together-based functions are untouched.
3. Runtime check of the deployed function needs the published backend; if not testable here, the unchanged fallback guarantees the panel still renders deterministic top picks when the gateway is unavailable.
