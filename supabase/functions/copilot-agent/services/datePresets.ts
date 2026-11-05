// Relative date-range presets for the copilot's "revenue" intent, ported
// from src/pages/Analytics.tsx's handleKpiPeriodChange so "yesterday"/"last
// week" mean the same thing here as they do in the Analytics dashboard.
//
// Deliberately mirrors that function's Sunday-start week semantics (bare
// startOfWeek/endOfWeek, no weekStartsOn) even though other date pickers
// elsewhere in that same file use Monday-start weeks — see PR description.
//
// Calendar math here is IST (Asia/Kolkata, a fixed UTC+5:30 offset — India
// has no DST, so a plain millisecond shift is correct and avoids any
// dependency on the runtime's ICU/timezone database). This is scoped
// entirely to how THIS edge function interprets "today" when answering chat
// questions — it does not touch Supabase, RLS, or how any other part of the
// app stores/writes dates (e.g. orders.order_date keeps whatever timezone
// convention the order-placement flow already uses).
import {
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "npm:date-fns@3.6.0";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** "Now", shifted so its UTC calendar fields read as IST calendar fields —
 * pass this (or let it default) anywhere this file needs "today" in the
 * sense a person in India means it, not the server's raw UTC clock. */
export function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

export const DATE_PRESETS = [
  "today",
  "yesterday",
  "current_week",
  "last_week",
  "current_month",
  "last_month",
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number];

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function resolveDatePreset(
  preset: DatePreset,
  now: Date = istNow(),
): { from: string; to: string } {
  switch (preset) {
    case "today":
      return { from: toDateOnly(now), to: toDateOnly(now) };
    case "yesterday": {
      const d = subDays(now, 1);
      return { from: toDateOnly(d), to: toDateOnly(d) };
    }
    case "current_week":
      return { from: toDateOnly(startOfWeek(now)), to: toDateOnly(endOfWeek(now)) };
    case "last_week": {
      const w = subWeeks(now, 1);
      return { from: toDateOnly(startOfWeek(w)), to: toDateOnly(endOfWeek(w)) };
    }
    case "current_month":
      return { from: toDateOnly(startOfMonth(now)), to: toDateOnly(endOfMonth(now)) };
    case "last_month": {
      const m = subMonths(now, 1);
      return { from: toDateOnly(startOfMonth(m)), to: toDateOnly(endOfMonth(m)) };
    }
  }
}
