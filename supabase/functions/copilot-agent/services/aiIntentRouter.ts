// Short-lived AI fallback for intent routing + light slot extraction.
// Only runs when the existing regex classifier finds no match.
// Never throws: any failure/timeout resolves to "none" with all slots null.
import { z } from "npm:zod@3.23.8";
import { MODEL, TOGETHER_URL } from "../config.ts";
import { DATE_PRESETS, type DatePreset } from "./datePresets.ts";

export const KNOWN_INTENTS = [
  "leave",
  "attendance",
  "beats",
  "collections",
  "visits",
  "targets",
  "products",
  "revenue",
  "gamification",
  "leaderboard",
  "schemes",
  "van_stock",
] as const;

export type RoutedIntent = (typeof KNOWN_INTENTS)[number];

export interface AiRouteResult {
  intent: RoutedIntent | null;
  /** Only ever set when intent === "beats" and the user named one specific beat. */
  beatName: string | null;
  /** Only ever set when intent === "schemes" and the user named one specific retailer. */
  retailerName: string | null;
  /** Only ever set when intent is "revenue", "gamification", or "leaderboard" and a relative period was mentioned. */
  datePreset: DatePreset | null;
  scope: "self" | "team" | "all";
  raw: string;
  latencyMs: number;
}

const ROUTER_TIMEOUT_MS = 3000;

const NONE_RESULT: Omit<AiRouteResult, "raw" | "latencyMs"> = {
  intent: null,
  beatName: null,
  retailerName: null,
  datePreset: null,
  scope: "self",
};

// Intents with a meaningful team/all concept — kept as a set so the prompt
// text and parseRoute's scope handling can't silently drift apart.
// leaderboard is deliberately excluded: it's always org-wide by design, no
// team/all distinction. schemes is global reference data with no user
// scoping at all.
const SCOPED_INTENTS = new Set<RoutedIntent>([
  "leave",
  "attendance",
  "beats",
  "collections",
  "visits",
  "targets",
  "products",
  "revenue",
  "gamification",
  "van_stock",
]);

// Intents whose datePreset slot is actually meaningful — kept as a set so
// parseRoute and the prompt text can't silently drift apart.
const DATE_PRESET_INTENTS = new Set<RoutedIntent>(["revenue", "gamification", "leaderboard"]);

const SYSTEM_PROMPT = [
  "You classify a field-sales app user's message and extract a few small slots.",
  "Reply with strict JSON only, exactly this shape — no prose, no markdown, no explanation:",
  '{"intent": "<label>", "beatName": "<string or null>", "retailerName": "<string or null>", "datePreset": "<preset or null>", "scope": "<self|team|all>"}',
  'Allowed "intent" labels: "leave", "attendance", "beats", "collections", "visits", "targets", "products", "revenue", "gamification", "leaderboard", "schemes", "van_stock", "none".',
  'Use "none" when the message does not clearly match any label.',
  '"beatName": only when intent is "beats" AND the user named one specific beat (e.g. "Devi Nagar"). Leave it null when the user just asked about their "last"/"recent" beats in general.',
  '"retailerName": only when intent is "schemes" AND the user named one specific retailer/shop to check schemes for. Leave it null otherwise.',
  `"datePreset": only when intent is "revenue", "gamification", or "leaderboard" and the user mentioned a relative time period — one of ${
    DATE_PRESETS.map((p) => `"${p}"`).join(", ")
  }, else null.`,
  '"scope": for "leave", "attendance", "beats", "collections", "visits", "targets", "products", "revenue", "gamification", "van_stock" — "team" when the user is clearly asking about their team/subordinates/reportees/reporting-to-them/staff; "all" when they are clearly asking about literally everyone/all users/all field sales employees across the whole organization, not just their own team; otherwise "self". NEVER "team" or "all" for "leaderboard" (always org-wide already, no team/all concept) or "schemes" (global reference data, no user scoping).',
  "Examples:",
  'leave — "hw many days leave i have left", "kitni chutti bachi hai" -> {"intent":"leave","beatName":null,"retailerName":null,"datePreset":null,"scope":"self"}',
  'leave (team) — "leave balance of my reportees", "how much leave has my team taken" -> {"intent":"leave","beatName":null,"retailerName":null,"datePreset":null,"scope":"team"}',
  'attendance — "did i mark present today", "my punch in records this week" -> {"intent":"attendance","beatName":null,"retailerName":null,"datePreset":null,"scope":"self"}',
  'attendance (team) — "attendance of everyone reporting to me today" -> {"intent":"attendance","beatName":null,"retailerName":null,"datePreset":null,"scope":"team"}',
  'beats (recent, no name) — "summarise my last three beats", "recent beat routes covered" -> {"intent":"beats","beatName":null,"retailerName":null,"datePreset":null,"scope":"self"}',
  'beats (named) — "tell me more about devi nagar beat", "how is the mangaluru beat doing" -> {"intent":"beats","beatName":"Devi Nagar","retailerName":null,"datePreset":null,"scope":"self"}',
  'collections — "how much money is still to be collected", "pending outstanding from retailers" -> {"intent":"collections","beatName":null,"retailerName":null,"datePreset":null,"scope":"self"}',
  'collections (team) — "pending collections for my team", "outstanding from my reportees\' retailers" -> {"intent":"collections","beatName":null,"retailerName":null,"datePreset":null,"scope":"team"}',
  'visits — "plan my visits for today", "which shops should i prioritise now" -> {"intent":"visits","beatName":null,"retailerName":null,"datePreset":null,"scope":"self"}',
  'targets — "am i close to my monthly goal", "sales target achievement" -> {"intent":"targets","beatName":null,"retailerName":null,"datePreset":null,"scope":"self"}',
  'targets (team) — "what is my team\'s target achievement" -> {"intent":"targets","beatName":null,"retailerName":null,"datePreset":null,"scope":"team"}',
  'products — "which products are least ordered from my side", "top selling items this month", "what is the price of kadak gold" -> {"intent":"products","beatName":null,"retailerName":null,"datePreset":null,"scope":"self"}',
  'revenue (self) — "what is my total sales revenue for yesterday", "how much did i sell today" -> {"intent":"revenue","beatName":null,"retailerName":null,"datePreset":"yesterday","scope":"self"}',
  'revenue (team) — "sales performance of my team for yesterday", "how is my team doing today", "order revenue and quantity reporting to me" -> {"intent":"revenue","beatName":null,"retailerName":null,"datePreset":"yesterday","scope":"team"}',
  'revenue (all) — "total sales revenue of all the users today", "order value for all field sales employees this month" -> {"intent":"revenue","beatName":null,"retailerName":null,"datePreset":"current_month","scope":"all"}',
  'gamification (self) — "how many gamification points do i have", "what is my redeemable balance", "any pending redemptions", "what games are active right now", "is there a game called New Retailer running", "tell me about the Target game" -> {"intent":"gamification","beatName":null,"retailerName":null,"datePreset":null,"scope":"self"}',
  'gamification (team) — "how many gamification points has my team earned", "gamification points for my team, per user" -> {"intent":"gamification","beatName":null,"retailerName":null,"datePreset":null,"scope":"team"}',
  'gamification (all) — "gamification points of all the users", "game points for all field sales employees" -> {"intent":"gamification","beatName":null,"retailerName":null,"datePreset":null,"scope":"all"}',
  'leaderboard — "where do i rank this month", "who is leading the leaderboard", "top performers today" -> {"intent":"leaderboard","beatName":null,"retailerName":null,"datePreset":"current_month","scope":"self"}',
  'schemes (general) — "what schemes are active right now", "any offers this week" -> {"intent":"schemes","beatName":null,"retailerName":null,"datePreset":null,"scope":"self"}',
  'schemes (retailer) — "is there a scheme for Sharma General Store", "any offer applicable to ABC Traders" -> {"intent":"schemes","beatName":null,"retailerName":"Sharma General Store","datePreset":null,"scope":"self"}',
  'van_stock (self) — "what is on my van right now", "how much kadak gold do i have on my van" -> {"intent":"van_stock","beatName":null,"retailerName":null,"datePreset":null,"scope":"self"}',
  'van_stock (team) — "which of my team has not opened van stock today" -> {"intent":"van_stock","beatName":null,"retailerName":null,"datePreset":null,"scope":"team"}',
  'none — "hello", "who won the match", "tell me a joke" -> {"intent":"none","beatName":null,"retailerName":null,"datePreset":null,"scope":"self"}',
].join("\n");

const ResponseSchema = z.object({
  intent: z.string().nullable().optional(),
  beatName: z.string().nullable().optional(),
  retailerName: z.string().nullable().optional(),
  datePreset: z.string().nullable().optional(),
  scope: z.string().nullable().optional(),
});

export async function routeIntentWithAi(
  apiKey: string,
  message: string,
): Promise<AiRouteResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROUTER_TIMEOUT_MS);
  let raw = "";
  try {
    const response = await fetch(TOGETHER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        temperature: 0,
        max_tokens: 100,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
      }),
    });
    if (!response.ok) {
      raw = `http_${response.status}`;
      return { ...NONE_RESULT, raw, latencyMs: Date.now() - startedAt };
    }
    const payload = await response.json();
    raw = String(payload?.choices?.[0]?.message?.content ?? "").trim();
    return { ...parseRoute(raw), raw, latencyMs: Date.now() - startedAt };
  } catch (error) {
    raw = error instanceof Error ? `error:${error.name}` : "error";
    return { ...NONE_RESULT, raw, latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

function parseRoute(raw: string): Omit<AiRouteResult, "raw" | "latencyMs"> {
  if (!raw) return NONE_RESULT;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return NONE_RESULT;
  try {
    const parsed = ResponseSchema.parse(JSON.parse(match[0]));

    const intentValue = (parsed.intent ?? "").trim().toLowerCase();
    const intent = (KNOWN_INTENTS as readonly string[]).includes(intentValue)
      ? (intentValue as RoutedIntent)
      : null;

    const beatName = intent === "beats" && parsed.beatName?.trim()
      ? parsed.beatName.trim().slice(0, 100)
      : null;

    const retailerName = intent === "schemes" && parsed.retailerName?.trim()
      ? parsed.retailerName.trim().slice(0, 100)
      : null;

    const datePresetValue = (parsed.datePreset ?? "").trim().toLowerCase();
    const datePreset = intent && DATE_PRESET_INTENTS.has(intent) && (DATE_PRESETS as readonly string[]).includes(datePresetValue)
      ? (datePresetValue as DatePreset)
      : null;

    const scopeValue = parsed.scope?.trim().toLowerCase();
    const scope: "self" | "team" | "all" = intent && SCOPED_INTENTS.has(intent) && (scopeValue === "team" || scopeValue === "all")
      ? scopeValue
      : "self";

    return { intent, beatName, retailerName, datePreset, scope };
  } catch {
    return NONE_RESULT;
  }
}
