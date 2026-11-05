import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const Item = z.object({
  retailerId: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  avg: z.string().min(1).max(40),
  lastVisit: z.string().max(20).optional(),
  days: z.number().int().optional(),
  outstanding: z.string().max(40).optional(),
  pct: z.number().optional(),
});
const Body = z.object({ items: z.array(Item).min(1).max(60) });
type ItemT = z.infer<typeof Item>;

const BANNED = /\b(present|qualif\w*|criteria)\b/i;

function valid(line: string, it: ItemT) {
  if (!line || line.includes("_") || BANNED.test(line) || /\n|•|^\s*-/.test(line)) return false;
  const sentences = line.trim().split(/[.!?](\s|$)/).filter((s) => s && s.trim().length > 1);
  if (sentences.length > 1) return false;
  for (const v of [it.avg, it.lastVisit, it.outstanding]) if (v && !line.includes(v)) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ lines: {} });
    const items = parsed.data.items;

    const facts = items.map((it) => ({
      id: it.retailerId,
      store: it.name,
      "average order value per visit": it.avg,
      ...(it.lastVisit ? { "last visit date": it.lastVisit, "days since last visit": it.days } : {}),
      ...(it.outstanding ? { "pending payment": it.outstanding } : {}),
    }));

    const system = `You write one short insight for a field salesperson about each store.
Rules:
- Exactly ONE natural, actionable sentence per store, under 35 words.
- Use ONLY the values given for that store, copied character-for-character (amounts and dates exactly as written). Never add other numbers, percentages or facts.
- Always mention the average order value per visit. Mention the last visit date only if given. Mention the pending payment only if given.
- Write like a helpful colleague, e.g. "Laxmi Medical Stores usually orders ₹1,600 per visit, but you last went on 02/08/2026 and ₹2,400 is still pending, so visit today to collect and take a fresh order."
- Never copy field names or use underscores.
- No bullets, labels, line breaks or multiple sentences.
- Never use the words "present", "qualifies", "qualify" or "criteria".
Return JSON: {"items":[{"id":"...","line":"..."}]}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: req.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5-nano",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Stores (json):\n${JSON.stringify(facts)}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "insights",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["items"],
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "line"],
                    properties: { id: { type: "string" }, line: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      }),
    });
    if (!resp.ok) {
      console.error("[retailer-visit-insight] gateway", resp.status, await resp.text());
      return json({ lines: {} });
    }
    const data = await resp.json();
    const text = String(data?.choices?.[0]?.message?.content ?? "");
    const out: Record<string, string> = {};
    try {
      const arr = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}").items ?? [];
      const byId = new Map(items.map((i) => [i.retailerId, i]));
      for (const r of arr) {
        const it = byId.get(String(r.id));
        const line = String(r.line ?? "").trim();
        if (it && valid(line, it)) out[it.retailerId] = line;
      }
    } catch (e) {
      console.error("[retailer-visit-insight] parse", e);
    }
    return json({ lines: out });
  } catch (e) {
    console.error("[retailer-visit-insight]", e);
    return json({ lines: {} });
  }
});
