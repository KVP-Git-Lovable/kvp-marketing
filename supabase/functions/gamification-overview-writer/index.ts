import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Overview {
  about?: string;
  steps?: string[];
  counts?: string[];
  excludes?: string[];
  notes?: string[];
}

const LISTS = ["steps", "counts", "excludes", "notes"] as const;

/** Models like to wrap JSON in fences or add a sentence before it. */
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in the reply");
  return JSON.parse(body.slice(start, end + 1));
}

/** Never trust the shape; the column has a CHECK constraint behind this. */
function clean(raw: unknown): Overview {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Overview = {};
  const about = typeof o.about === "string" ? o.about.trim() : "";
  if (about) out.about = about.slice(0, 1200);
  for (const key of LISTS) {
    const list = Array.isArray(o[key])
      ? (o[key] as unknown[])
          .map((x) => String(x ?? "").trim().replace(/^\s*(?:[-–—•*]|\d{1,2}[.)])\s+/, "").trim())
          .filter(Boolean)
          .slice(0, 8)
          .map((x) => x.slice(0, 220))
      : [];
    if (list.length) out[key] = list;
  }
  return out;
}

/** Everything true about this game, in the words the model should reuse. */
function describe(b: any): string {
  const lines: string[] = [
    `Game container: ${b.gameName || "(unnamed)"}`,
    `Activity name: ${b.activityName || "(unnamed)"}`,
    `Trigger type: ${b.triggerType || "(unset)"} — this is what the engine watches for.`,
  ];

  if (b.tiered && Array.isArray(b.tiers) && b.tiers.length) {
    // Do the arithmetic here rather than hoping the model does it: a rep needs
    // "9 visits", not "30% of 30".
    const base = Number(b.baseDailyTarget) || 0;
    lines.push(
      `Pays by tier. Tiers: ${b.tiers
        .map((t: any) => base
          ? `${t.threshold_pct}% = ${Math.ceil((t.threshold_pct / 100) * base)} of ${base} → ${t.points} points`
          : `${t.threshold_pct}% → ${t.points} points`)
        .join(", ")}.`
    );
    if (base) lines.push(`Quote the absolute counts, not the percentages, since the daily goal is a fixed ${base}.`);
    if (b.targetPeriod) lines.push(`Tier percentages are measured against the rep's ${b.targetPeriod} quantity target.`);
  } else {
    lines.push(`Pays ${b.points ?? 0} points each time it triggers.`);
  }

  if (b.capScope && b.capScope !== "none" && b.capValue) {
    lines.push(
      `Capped at ${b.capValue} awards per ${b.capScope === "user_day" ? "day" : b.capScope === "user_month" ? "month" : b.capScope} per rep.`
    );
  }
  if (Array.isArray(b.conditions) && b.conditions.length) {
    lines.push(
      `Only counts when: ${b.conditions
        .map((c: any) => `${c.field} ${c.operator ?? c.op} ${c.value}`)
        .join("; ")}.`
    );
  }
  if (b.rupeesPerPoint) lines.push(`1 point is worth ${b.rupeesPerPoint} rupees on this game.`);
  return lines.join("\n");
}

const SHAPE =
  `Reply with JSON only, no prose and no code fences, in exactly this shape:\n` +
  `{"about":"...","steps":["..."],"counts":["..."],"excludes":["..."],"notes":["..."]}`;

const HOUSE =
  "You write instructions for FMCG field sales reps in India, many reading on a phone in a second language. " +
  "Rules: short plain sentences, one idea each, no jargon, no marketing tone, no emoji, no markdown. " +
  "Aim for 12 words per bullet. Write in second person. " +
  "Use ONLY the numbers and rules given to you — never invent a points value, a threshold, a cap, a deadline, " +
  "a product or a retailer. If something is not stated, leave it out.\n" +
  "Every bullet must tell the rep something they could otherwise get wrong. Never restate the game's name or " +
  "the activity's name as if it were a fact. Never pad: two useful bullets beat five, and a bullet that repeats " +
  "another one or that any rep already knows must be dropped.";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const mode = body?.mode === "improve" ? "improve" : "draft";
    const current: Overview = clean(body?.current);

    if (mode === "improve" && !current.about && !LISTS.some((k) => current[k]?.length)) {
      return json({ error: "Nothing written yet to improve." }, 400);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "The AI writer is not configured on this project." }, 503);

    const task =
      mode === "draft"
        ? `Write the rep-facing Overview for this game from its configuration.\n\n${describe(body)}\n\n` +
          `Sections, each as few bullets as the rules justify:\n` +
          `- "about": 2 sentences on what this game rewards and why it is worth doing.\n` +
          `- "steps": up to 5 DISTINCT actions in the order they happen. Each must move the rep forward; ` +
          `"keep doing it" is not a step.\n` +
          `- "counts": the conditions that make an action qualify, quoting the real thresholds.\n` +
          `- "excludes": ONLY exclusions the configuration states or directly implies, such as failing a stated ` +
          `condition. If it states none, omit this section entirely — do not guess at fraud rules.\n` +
          `- "notes": ONLY facts present above, such as a cap or what one point is worth. You do NOT know when ` +
          `points are credited, who is eligible, or how anything is verified, so never say.\n` +
          `Omit a section entirely rather than filling it with restatements.\n\n${SHAPE}`
        : `Rewrite the admin's own text below so it is clearer and correct. Fix spelling and grammar, simplify the ` +
          `wording, and make each bullet one short idea. Keep the SAME meaning and the SAME number of bullets in ` +
          `each section — do not add new rules, do not remove any, do not reorder them. Leave a section out if it ` +
          `was empty.\n\nGame configuration, for context only:\n${describe(body)}\n\n` +
          `The admin wrote:\n${JSON.stringify(current, null, 2)}\n\n${SHAPE}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: HOUSE },
          { role: "user", content: task },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("AI gateway", res.status, detail);
      return json({ error: res.status === 429 ? "The AI writer is busy. Try again in a moment." : "The AI writer could not be reached." }, 502);
    }

    const out = await res.json();
    const text = out?.choices?.[0]?.message?.content ?? "";
    let overview: Overview;
    try {
      overview = clean(extractJson(text));
    } catch (e) {
      console.error("unparseable reply", text.slice(0, 500));
      return json({ error: "The AI writer returned something unreadable. Try again." }, 502);
    }

    if (!overview.about && !LISTS.some((k) => overview[k]?.length)) {
      return json({ error: "The AI writer came back empty. Try again." }, 502);
    }

    if (mode === "improve") {
      // A rewrite may not invent a section, nor add or drop a bullet — these
      // are scheme rules a rep will act on. Pin the count to what the admin
      // wrote and fall back to their own words for anything the model skipped.
      if (!current.about) delete overview.about;
      for (const key of LISTS) {
        const original = current[key] ?? [];
        if (!original.length) { delete overview[key]; continue; }
        const rewritten = overview[key] ?? [];
        overview[key] = original.map((own, i) => rewritten[i] ?? own);
      }
    }

    return json({ overview, mode });
  } catch (e) {
    console.error("gamification-overview-writer", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
