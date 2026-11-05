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

interface Progress {
  kind: string;
  current: number;
  goal: number;
  unit: string;
  pct: number;
  window: string;
  remaining: string;
  nextTier: string | null;
}

/**
 * Advice computed from the numbers alone. This is the answer when the model is
 * unavailable, and it is also the floor the model has to beat — it is never
 * wrong, because it only restates arithmetic the rep can check.
 */
function fallbackPlan(
  p: Progress, activityName: string, pointsPerEvent: number,
  rivalName: string | null, overtake: string | null,
): string {
  const left = Math.max(0, p.goal - p.current);
  const horizon = p.window === "today" ? "before the day ends"
    : p.window === "month" ? "before the month closes"
    : "in the rest of this period";

  if (p.kind === "cap" && left === 0) {
    return `You have taken everything ${activityName} pays ${p.window === "today" ? "today" : "this month"}. Come back ${p.window === "today" ? "tomorrow" : "next month"} — the cap resets.`;
  }
  if (p.kind === "leader") {
    // Aim at the rep one rung up, not the top of the board.
    if (overtake) return `${overtake} That is ${left * pointsPerEvent} points ${horizon}.`;
    return left === 0
      ? `You are top of this one. Staying there costs about ${pointsPerEvent} points a time — keep logging them and nobody catches up.`
      : `You are ${left} behind${rivalName ? ` ${rivalName}` : " the rep above you"}. Each one is worth ${pointsPerEvent} points, so ${left} more ${horizon} moves you up a place.`;
  }
  if (p.kind === "target") {
    return `You are at ${p.pct}% of your ${p.goal.toLocaleString()} ${p.unit} target. ${p.remaining} ${horizon}${p.nextTier ? ` — that unlocks ${p.nextTier}.` : "."}`;
  }
  if (p.kind === "daily") {
    return `${p.current} of ${p.goal} ${p.unit} logged today. ${p.remaining}${p.nextTier ? ` — ${p.nextTier}.` : "."} This one resets at midnight, so it is worth finishing today rather than carrying over.`;
  }
  return `${p.remaining}. Every one is worth ${pointsPerEvent} points.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      activityName, gameName, actionType, pointsPerEvent, tiered,
      progress, myPointsThisPeriod, periodLabel, myRank, fieldSize, bestName, bestPoints,
      rivalName, overtake, myRupees,
    } = body ?? {};

    if (!activityName || !progress) {
      return json({ error: "activityName and progress are required" }, 400);
    }

    const p = progress as Progress;
    const floor = fallbackPlan(p, activityName, Number(pointsPerEvent || 0), rivalName ?? null, overtake ?? null);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.log("LOVABLE_API_KEY absent — returning the computed plan");
      return json({ advice: floor, source: "computed" });
    }

    const facts = [
      `Activity: ${activityName} (part of the game "${gameName}", type ${actionType})`,
      tiered ? `It pays by tier.` : `It pays ${pointsPerEvent} points each time.`,
      p.kind === "leader"
        ? `No ceiling. This rep has ${p.current} ${p.unit} ${periodLabel}; the best rep has ${p.goal}.`
        : `Progress: ${p.current} of ${p.goal} ${p.unit} (${p.pct}%), measured over ${p.window}.`,
      `What is left: ${p.remaining}.`,
      p.nextTier ? `Next tier: ${p.nextTier}.` : null,
      `They have earned ${myPointsThisPeriod} points from it ${periodLabel}.`,
      `Worth ${myRupees ?? 0} rupees to them so far ${periodLabel}.`,
      myRank ? `They rank #${myRank} of ${fieldSize} reps scoring on it.` : `They are not on the board for it yet.`,
      // The rep one rung up is the one worth naming. Pointing a rep in ninth
      // at the leader reads as hopeless, which is the opposite of coaching.
      rivalName ? `The rep directly above them is ${rivalName}.` : null,
      overtake ? `The move that changes their position: ${overtake}` : null,
      bestName && bestName !== rivalName ? `(For context only, the overall leader is ${bestName} with ${bestPoints} points — do not tell them to catch the leader.)` : null,
    ].filter(Boolean).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You coach FMCG field sales reps in India on a rewards scheme. Given one activity and this rep's " +
              "numbers, tell them how to finish it. Rules: 60 words or fewer, 2-3 short sentences, plain English, " +
              "second person. Lead with the single concrete action and the arithmetic (how many more, by when). " +
              "Aim them at the rep directly above them, never at the overall leader, and name that rep. " +
              "Only use the figures given — never invent a number, a deadline, a retailer or a product. No " +
              "greeting, no sign-off, no bullet points, no emoji, no praise padding.",
          },
          { role: "user", content: facts },
        ],
      }),
    });

    if (!res.ok) {
      console.error("AI gateway", res.status, await res.text());
      return json({ advice: floor, source: "computed" });
    }

    const out = await res.json();
    const advice = out?.choices?.[0]?.message?.content?.trim();
    return json(advice ? { advice, source: "ai" } : { advice: floor, source: "computed" });
  } catch (e) {
    console.error("gamification-activity-coach", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
