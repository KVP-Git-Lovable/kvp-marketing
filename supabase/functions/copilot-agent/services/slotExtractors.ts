// Cheap, deterministic regex extractors for scope ("my team" vs "me") and
// relative date phrases. These run unconditionally right after intent
// resolution, regardless of whether classifyDataIntent (regex) or
// routeIntentWithAi (LLM) resolved the intent — they're near-free string
// scans. A regex match here always wins over the AI router's equivalent
// slot; the AI router's value is only used as a fallback when these return
// nothing (see index.ts's merge logic).
import type { DatePreset } from "./datePresets.ts";
import { DATE_PRESETS } from "./datePresets.ts";

// Checked in this order — "all" wins over "team" if both somehow appear.
// TEAM_SCOPE_RE's bare `team'?s?` alternative already covers "my team"/"the
// team"/"our team"/"team's"/bare "team" (the word "team" is a substring of
// all of them within the \b...\b boundary), so those don't need to be
// spelled out separately.
const ALL_SCOPE_RE =
  /\ball(?:\s+the)?\s+(users?|employees?|field\s+sales(?:\s+\w+)?|reps?|salespeople|staff|people)\b|\beveryone\b|\bentire\s+(organi[sz]ation|company)\b|\bwhole\s+(organi[sz]ation|company)\b|\borg[-\s]?wide\b/;
const TEAM_SCOPE_RE =
  /\b(reportees?|reporting to me|subordinates?|direct reports?|my (people|staff)|team'?s?)\b/;

export function extractScope(message: string): "all" | "team" | "self" {
  const normalized = message.toLowerCase();
  if (ALL_SCOPE_RE.test(normalized)) return "all";
  if (TEAM_SCOPE_RE.test(normalized)) return "team";
  return "self";
}

export function extractDatePreset(message: string): DatePreset | null {
  const normalized = message.toLowerCase();
  if (/\byesterday\b/.test(normalized)) return "yesterday";
  if (/\btoday\b/.test(normalized)) return "today";
  if (/\b(last|previous|past)\s+week\b/.test(normalized)) return "last_week";
  if (/\b(this|current)\s+week\b/.test(normalized)) return "current_week";
  if (/\b(last|previous|past)\s+month\b/.test(normalized)) return "last_month";
  if (/\b(this|current)\s+month\b/.test(normalized)) return "current_month";
  return null;
}

// Re-exported so callers only need to import one module for the common case.
export { DATE_PRESETS };
export type { DatePreset };
