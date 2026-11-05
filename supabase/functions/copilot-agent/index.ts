// QuickApp Copilot — Phase 1 edge function.
// Auth-required. Streams Together.ai responses as SSE text tokens.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { buildSystemPrompt } from "./prompts/systemPrompt.ts";
import {
  streamChat,
  TogetherError,
  type ChatMessage,
  type StreamResult,
} from "./services/togetherClient.ts";
import { routeIntentWithAi, type AiRouteResult } from "./services/aiIntentRouter.ts";
import { backfillNames, resolveScope } from "./services/scopeResolver.ts";
import { istNow, resolveDatePreset, type DatePreset } from "./services/datePresets.ts";
import { extractDatePreset, extractScope } from "./services/slotExtractors.ts";

import { HISTORY_LIMIT, MAX_INPUT_CHARS, MODEL } from "./config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "X-Copilot-Message-Id",
};

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().trim().min(1).max(MAX_INPUT_CHARS),
});

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type SupabaseClient = ReturnType<typeof createClient>;

function staticStream(text: string): StreamResult {
  return {
    tokens: new ReadableStream<string>({
      start(controller) {
        controller.enqueue(text);
        controller.close();
      },
    }),
    fullText: Promise.resolve(text),
  };
}

function formatNumber(value: unknown, maximumFractionDigits = 2): string {
  const number = Number(value ?? 0);
  return (Number.isFinite(number) ? number : 0).toLocaleString("en-IN", {
    maximumFractionDigits,
  });
}

function formatDays(value: unknown): string {
  const number = Number(value ?? 0);
  const days = Number.isFinite(number) ? number : 0;
  return `${formatNumber(days)} ${days === 1 ? "day" : "days"}`;
}

function escapeCell(value: unknown): string {
  return String(value ?? "—").replaceAll("|", "\\|");
}

/** Word-overlap fuzzy name matcher, shared by productsAnswer, schemesAnswer,
 * and vanStockAnswer: a catalog/inventory row matches when at least two of
 * its name words appear in the message (or its whole single-word name
 * does), so "KADAK GOLD" finds "KADAK GOLD BLEND" without dragging in every
 * row containing "gold". */
function nameMatches(message: string, name: string): number {
  const msgLower = ` ${message.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const words = String(name).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  if (!words.length) return 0;
  const hits = words.filter((w) => msgLower.includes(` ${w} `)).length;
  if (words.length === 1) return hits === 1 && words[0].length >= 4 ? 1 : 0;
  return hits >= 2 ? hits : 0;
}

type DataIntent =
  | "leave"
  | "attendance"
  | "beats"
  | "collections"
  | "visits"
  | "targets"
  | "products"
  | "revenue"
  | "gamification"
  | "leaderboard"
  | "schemes"
  | "van_stock";

function classifyDataIntent(message: string): DataIntent | null {
  const normalized = message.toLowerCase();
  if (/\bleave\b.*\bbalance\b|\bbalance\b.*\bleave\b/.test(normalized)) return "leave";
  if (/\battendance\b/.test(normalized)) return "attendance";
  // Proximity-bound (at most 2 words between "last"/"recent" and "beat(s)")
  // so "last three beats"/"recent beat routes" still fast-path here, but
  // "what are my last visits to Devi Nagar beat" does NOT — "last" is too
  // far from "beat" to plausibly modify it, so that falls through to the AI
  // router, which can correctly extract "Devi Nagar" as a named-beat lookup
  // instead of being forced into the generic "recent 3 beats" answer.
  if (
    /\b(last|recent)\b(\s+\w+){0,2}\s+beats?\b|\bbeats?\b(\s+\w+){0,2}\s+\b(last|recent)\b/.test(normalized)
  ) {
    return "beats";
  }
  if (/\bpending\b.*\bcollections?\b|\bcollections?\b.*\bpending\b|\boutstanding\b/.test(normalized)) return "collections";
  if (/\b(plan|schedule|prioriti[sz]e)\b.*\bvisits?\b|\btoday'?s? visits?\b/.test(normalized)) return "visits";
  if (/\btargets?\b/.test(normalized)) return "targets";
  if (
    /\b(products?|items?|skus?)\b/.test(normalized) &&
    /\b(order|orders|ordered|ordering|sell|sold|selling|sales|moving|top|least|slow|best|worst)\b/.test(normalized)
  ) {
    return "products";
  }
  // In this app, price/rate/MRP questions are always about products.
  if (/\b(price|prices|priced|pricing|rate|rates|cost|mrp)\b/.test(normalized)) return "products";
  // Checked last so it never shadows the product-mix phrasing above (which
  // also contains sales-adjacent words like "sold"/"selling"/"sales").
  if (/\b(sales|revenue|turnover)\b/.test(normalized)) return "revenue";
  if (/\bpoints?\b|\bredeem(ed|ption)?\b|\bgamification\b|\bgames?\b/.test(normalized)) return "gamification";
  if (/\bleaderboard\b|\brank(ing)?\b|\btop performers?\b/.test(normalized)) return "leaderboard";
  if (/\bschemes?\b|\boffers?\b|\bpromo(tion)?s?\b|\bdiscounts?\b/.test(normalized)) return "schemes";
  if (/\bvan\b(\s+\w+){0,2}\s+stock\b|\bstock\b(\s+\w+){0,2}\s+\bvan\b/.test(normalized)) return "van_stock";
  return null;
}

async function leaveBalanceAnswer(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  scope: "self" | "team" | "all",
): Promise<string> {
  const resolved = await resolveScope(supabase, userId, scope);

  const { data: leaveTypes, error: typeError } = await supabase
    .from("leave_types")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (typeError) throw typeError;
  if (!leaveTypes?.length) return `No active leave types are configured for ${year}.`;

  let balanceQuery = supabase
    .from("leave_balance")
    .select("user_id, leave_type_id, opening_balance, used_balance, remaining_balance")
    .eq("year", year);
  if (resolved.userIds) balanceQuery = balanceQuery.in("user_id", resolved.userIds);
  const { data: balances, error: balanceError } = await balanceQuery;
  if (balanceError) throw balanceError;

  if (resolved.effectiveScope === "self") {
    const rows = leaveTypes.map((leaveType: any) => {
      const balance = balances?.find((item: any) => item.leave_type_id === leaveType.id);
      return `| ${escapeCell(leaveType.name)} | ${formatDays(balance?.remaining_balance)} | ${formatDays(balance?.used_balance)} |`;
    });
    return [
      `## Your leave balance (${year})`,
      "",
      "| Leave type | Available | Booked |",
      "|---|---:|---:|",
      ...rows,
    ].join("\n");
  }

  await backfillNames(supabase, resolved.nameById, (balances ?? []).map((b: any) => b.user_id));
  const typeNameById = new Map(leaveTypes.map((t: any) => [t.id, t.name]));
  const rows = (balances ?? [])
    .map((b: any) => ({
      memberName: resolved.nameById.get(b.user_id) ?? b.user_id,
      typeName: typeNameById.get(b.leave_type_id) ?? "Leave",
      remaining_balance: b.remaining_balance,
      used_balance: b.used_balance,
    }))
    .sort((a: any, b: any) => a.memberName.localeCompare(b.memberName) || a.typeName.localeCompare(b.typeName));

  const parts: string[] = [];
  if (resolved.note) parts.push(resolved.note.trimEnd(), "");
  parts.push(
    `## ${resolved.effectiveScope === "all" ? "Org-wide" : "Team"} leave balance (${year})`,
    "",
  );
  if (!rows.length) {
    parts.push(`No leave balance records were found for ${resolved.effectiveScope === "all" ? "anyone" : "your team"} for ${year}.`);
  } else {
    parts.push(
      "| Member | Leave type | Available | Booked |",
      "|---|---|---:|---:|",
      ...rows.map((r: any) =>
        `| ${escapeCell(r.memberName)} | ${escapeCell(r.typeName)} | ${formatDays(r.remaining_balance)} | ${formatDays(r.used_balance)} |`
      ),
    );
  }
  return parts.join("\n");
}

async function attendanceAnswer(
  supabase: SupabaseClient,
  userId: string,
  today: string,
  scope: "self" | "team" | "all",
): Promise<string> {
  const resolved = await resolveScope(supabase, userId, scope);
  const monthStart = `${today.slice(0, 7)}-01`;

  let query = supabase
    .from("attendance")
    .select("user_id, date, status, check_in_time, check_out_time, total_hours")
    .gte("date", monthStart)
    .lte("date", today)
    .order("date", { ascending: false });
  if (resolved.userIds) query = query.in("user_id", resolved.userIds);
  const { data, error } = await query;
  if (error) throw error;

  if (resolved.effectiveScope === "self") {
    if (!data?.length) return `No attendance records were found for ${today.slice(0, 7)}.`;
    const present = data.filter((row: any) => row.check_in_time || /present|late|half/i.test(row.status ?? "")).length;
    const late = data.filter((row: any) => /late/i.test(row.status ?? "")).length;
    const missed = data.filter((row: any) => /absent|missed/i.test(row.status ?? "")).length;
    const totalHours = data.reduce((sum: number, row: any) => sum + Number(row.total_hours ?? 0), 0);
    return [
      `## Attendance for ${today.slice(0, 7)}`,
      "",
      `- **Present/check-in days:** ${present}`,
      `- **Late days:** ${late}`,
      `- **Absent/missed days:** ${missed}`,
      `- **Recorded hours:** ${formatNumber(totalHours, 1)}`,
    ].join("\n");
  }

  await backfillNames(supabase, resolved.nameById, (data ?? []).map((r: any) => r.user_id));
  const byUser = new Map<string, { present: number; late: number; missed: number; hours: number }>();
  (data ?? []).forEach((row: any) => {
    const agg = byUser.get(row.user_id) ?? { present: 0, late: 0, missed: 0, hours: 0 };
    if (row.check_in_time || /present|late|half/i.test(row.status ?? "")) agg.present += 1;
    if (/late/i.test(row.status ?? "")) agg.late += 1;
    if (/absent|missed/i.test(row.status ?? "")) agg.missed += 1;
    agg.hours += Number(row.total_hours ?? 0);
    byUser.set(row.user_id, agg);
  });

  const parts: string[] = [];
  if (resolved.note) parts.push(resolved.note.trimEnd(), "");
  parts.push(`## ${resolved.effectiveScope === "all" ? "Org-wide" : "Team"} attendance for ${today.slice(0, 7)}`, "");
  if (!byUser.size) {
    parts.push(`No attendance records were found for ${resolved.effectiveScope === "all" ? "anyone" : "your team"} this month.`);
  } else {
    parts.push(
      "| Member | Present | Late | Absent | Hours |",
      "|---|---:|---:|---:|---:|",
      ...[...byUser.entries()].map(([uid, agg]) =>
        `| ${escapeCell(resolved.nameById.get(uid) ?? uid)} | ${agg.present} | ${agg.late} | ${agg.missed} | ${formatNumber(agg.hours, 1)} |`
      ),
    );
  }
  return parts.join("\n");
}

/**
 * Beats intent: with no name given, falls back to the caller's (or their
 * team's) 3 most recently created beats — same as the original behavior,
 * just re-scoped from `created_by` to `owner_id` (the actual "whose beat is
 * this" column; `created_by` could be an admin/importer, not the owning
 * rep — see PR description). With a name given, looks the beat up by
 * case-insensitive partial match instead of ignoring it.
 */
async function beatsAnswer(
  supabase: SupabaseClient,
  userId: string,
  beatName: string | null,
  scope: "self" | "team" | "all",
): Promise<string> {
  const resolved = await resolveScope(supabase, userId, scope);
  const whose = resolved.effectiveScope === "all" ? "anyone" : resolved.effectiveScope === "team" ? "you or your team" : "you";

  if (beatName) {
    let query = supabase
      .from("beats")
      .select("beat_id, beat_name, owner_name, owner_id, created_at, is_active")
      .ilike("beat_name", `%${beatName}%`)
      .limit(10);
    if (resolved.userIds) query = query.in("owner_id", resolved.userIds);
    const { data: beats, error: beatsError } = await query;
    if (beatsError) throw beatsError;

    if (!beats?.length) {
      return `I couldn't find a beat named "${beatName}" among ${whose} beats. Double-check the spelling, or ask for your recent beats instead.`;
    }
    if (beats.length > 1) {
      const lines = beats.map((b: any) =>
        `- **${b.beat_name ?? b.beat_id}** — owned by ${b.owner_name ?? "unknown"} (id: ${b.beat_id})`
      );
      return [
        `Found ${beats.length} beats matching "${beatName}" — which one did you mean?`,
        "",
        ...lines,
      ].join("\n");
    }
    const matched: any = beats[0];
    return renderBeatDetails(
      supabase,
      beats,
      resolved.userIds ?? beats.map((b: any) => b.owner_id),
      `${resolved.note}Here's what I found for the "${matched.beat_name ?? beatName}" beat:`,
    );
  }

  let query = supabase
    .from("beats")
    .select("beat_id, beat_name, owner_name, owner_id, created_at, is_active")
    .order("created_at", { ascending: false })
    .limit(resolved.effectiveScope === "self" ? 3 : 20);
  if (resolved.userIds) query = query.in("owner_id", resolved.userIds);
  const { data: beats, error: beatsError } = await query;
  if (beatsError) throw beatsError;
  if (!beats?.length) {
    return `I couldn't find any beats owned by ${whose} yet.`;
  }
  return renderBeatDetails(
    supabase,
    beats,
    resolved.userIds ?? beats.map((b: any) => b.owner_id),
    resolved.effectiveScope === "all"
      ? `${resolved.note}Org-wide, most recently created beats:`
      : resolved.effectiveScope === "team"
      ? `${resolved.note}Your team's most recently created beats:`
      : "Your last three beats information is as follows:",
  );
}

async function renderBeatDetails(
  supabase: SupabaseClient,
  beats: Array<{ beat_id: string; beat_name: string | null; created_at: string }>,
  scopeUserIds: string[],
  heading: string,
): Promise<string> {
  // Related activity is fetched separately because visits.retailer_id has no FK
  // relationship that PostgREST can use for an embedded retailers join.
  const beatIds = beats.map((beat: any) => beat.beat_id).filter(Boolean);
  const visitsByBeat = new Map<string, { count: number; checkedIn: number; lastDate: string | null }>();
  const ordersByBeat = new Map<string, { count: number; value: number; lastDate: string | null }>();

  // Enrichment is deliberately best-effort: a related-table policy or data issue
  // must never hide the beats that were successfully retrieved above.
  const { data: retailers, error: retailersError } = await supabase
    .from("retailers")
    .select("id, beat_id")
    .in("beat_id", beatIds);

  if (retailersError) {
    console.error("[copilot-agent] beat retailer enrichment failed:", retailersError);
  } else {
    const beatByRetailer = new Map(
      (retailers ?? []).map((retailer: any) => [retailer.id, retailer.beat_id]),
    );
    const retailerIds = [...beatByRetailer.keys()];
    if (retailerIds.length) {
      const { data: visits, error: visitsError } = await supabase
        .from("visits")
        .select("retailer_id, planned_date, check_in_time, created_at")
        .in("user_id", scopeUserIds)
        .in("retailer_id", retailerIds);
      if (visitsError) {
        console.error("[copilot-agent] beat visit enrichment failed:", visitsError);
      } else {
        (visits ?? []).forEach((visit: any) => {
          const beatId = beatByRetailer.get(visit.retailer_id);
          if (!beatId) return;
          const date = visit.planned_date ?? (String(visit.created_at ?? "").slice(0, 10) || null);
          const aggregate = visitsByBeat.get(beatId) ?? { count: 0, checkedIn: 0, lastDate: null };
          aggregate.count += 1;
          if (visit.check_in_time) aggregate.checkedIn += 1;
          if (date && (!aggregate.lastDate || date > aggregate.lastDate)) aggregate.lastDate = date;
          visitsByBeat.set(beatId, aggregate);
        });
      }
    }
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("beat_id, total_amount, order_date, created_at")
    .in("user_id", scopeUserIds)
    .in("beat_id", beatIds);
  if (ordersError) {
    console.error("[copilot-agent] beat order enrichment failed:", ordersError);
  } else {
    (orders ?? []).forEach((order: any) => {
      if (!order.beat_id) return;
      const date = order.order_date ?? (String(order.created_at ?? "").slice(0, 10) || null);
      const aggregate = ordersByBeat.get(order.beat_id) ?? { count: 0, value: 0, lastDate: null };
      aggregate.count += 1;
      aggregate.value += Number(order.total_amount ?? 0);
      if (date && (!aggregate.lastDate || date > aggregate.lastDate)) aggregate.lastDate = date;
      ordersByBeat.set(order.beat_id, aggregate);
    });
  }

  const lines = beats.map((beat: any, index: number) => {
    const visits = visitsByBeat.get(beat.beat_id);
    const orders = ordersByBeat.get(beat.beat_id);
    const activity = [
      visits?.count
        ? `${visits.count} linked visit${visits.count === 1 ? "" : "s"} (${visits.checkedIn} checked in)`
        : "no linked visits",
      orders?.count
        ? `${orders.count} order${orders.count === 1 ? "" : "s"} worth ₹${formatNumber(orders.value)}`
        : "no orders",
    ];
    return `- **${index + 1}. ${beat.beat_name ?? beat.beat_id}** — created ${String(beat.created_at).slice(0, 10)} · ${activity.join(" · ")}`;
  });

  return [heading, "", ...lines].join("\n");
}

/**
 * Revenue intent: sum of confirmed orders' total_amount for a resolved date
 * range, scoped to the caller alone, their full recursive team, or (for a
 * confirmed System Administrator) everyone (see resolveScope). This is the
 * first grounded revenue/sales query in this file — previously no such SQL
 * path existed at all, so "total sales revenue for yesterday"-style
 * questions were answered by the raw LLM with no data behind them.
 */
async function revenueAnswer(
  supabase: SupabaseClient,
  userId: string,
  datePreset: DatePreset | null,
  scope: "self" | "team" | "all",
): Promise<string> {
  const resolvedPreset = datePreset ?? "today";
  const { from, to } = resolveDatePreset(resolvedPreset);
  const label = resolvedPreset.replace(/_/g, " ");
  const rangeLabel = from === to ? from : `${from} to ${to}`;

  const resolved = await resolveScope(supabase, userId, scope);

  // Paginate defensively — an org-wide or month-long team query could exceed
  // a single page. order_items is embedded via its FK to orders.id so the
  // join happens server-side in Postgres — no second round-trip with a
  // client-built order-id list, which for a large scope/date-range could
  // otherwise exceed the gateway's URL-length limit (see PR description).
  const PAGE_SIZE = 1000;
  const rows: Array<
    { user_id: string; total_amount: number; order_items: Array<{ quantity: number; unit: string | null }> | null }
  > = [];
  let offset = 0;
  while (true) {
    let query = supabase
      .from("orders")
      .select("user_id, total_amount, order_items(quantity, unit)")
      .eq("status", "confirmed")
      .gte("order_date", from)
      .lte("order_date", to)
      .range(offset, offset + PAGE_SIZE - 1);
    if (resolved.userIds) query = query.in("user_id", resolved.userIds);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...(data as any));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const whose = resolved.effectiveScope === "all" ? "anyone" : resolved.effectiveScope === "team" ? "your team" : "you";
  if (!rows.length) {
    return `${resolved.note}No confirmed orders were found for ${whose} between ${rangeLabel} (${label}).`;
  }

  const total = rows.reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0);
  const orderCount = rows.length;
  // Quantities are reported per unit rather than blended into one number —
  // grams are converted to kg (the same convention RevenueBySKUSection.tsx
  // already uses), but a kg total and a piece-count total are not the same
  // quantity and must never be summed together into one misleading figure.
  const quantityByUnit = new Map<string, number>();
  rows.forEach((r) => {
    (r.order_items ?? []).forEach((item) => {
      const rawUnit = String(item.unit ?? "").trim().toLowerCase();
      let qty = Number(item.quantity ?? 0);
      let label = "units";
      if (rawUnit === "grams" || rawUnit === "gram" || rawUnit === "g") {
        qty = qty / 1000;
        label = "kg";
      } else if (rawUnit === "kg" || rawUnit === "kgs" || rawUnit === "kilogram" || rawUnit === "kilograms") {
        label = "kg";
      } else if (rawUnit) {
        label = rawUnit;
      }
      quantityByUnit.set(label, (quantityByUnit.get(label) ?? 0) + qty);
    });
  });
  const quantityLine = [...quantityByUnit.entries()]
    .map(([unit, qty]) => `${formatNumber(qty, unit === "kg" ? 2 : 0)} ${unit}`)
    .join(" + ") || "0 units";
  const avgOrderValue = orderCount ? total / orderCount : 0;

  const headingScope = resolved.effectiveScope === "all" ? "Org-wide" : resolved.effectiveScope === "team" ? "Team" : "Your";
  const parts = [
    resolved.note.trimEnd(),
    `## ${headingScope} sales revenue — ${label} (${rangeLabel})`,
    "",
    `**Total confirmed revenue:** ₹${formatNumber(total)}`,
    `**Confirmed orders:** ${orderCount}`,
    `**Quantity sold:** ${quantityLine}`,
    `**Average order value:** ₹${formatNumber(avgOrderValue)}`,
  ].filter((line) => line !== "");

  if (resolved.effectiveScope !== "self") {
    const byUser = new Map<string, { count: number; value: number }>();
    rows.forEach((r) => {
      const agg = byUser.get(r.user_id) ?? { count: 0, value: 0 };
      agg.count += 1;
      agg.value += Number(r.total_amount ?? 0);
      byUser.set(r.user_id, agg);
    });
    await backfillNames(supabase, resolved.nameById, byUser.keys());
    const memberRows = [...byUser.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .map(([uid, agg]) =>
        `| ${escapeCell(resolved.nameById.get(uid) ?? uid)} | ${agg.count} | ₹${formatNumber(agg.value)} |`
      );
    if (memberRows.length) {
      parts.push("", "**By member:**", "", "| Member | Orders | Revenue |", "|---|---:|---:|", ...memberRows);
    }
  }

  return parts.join("\n");
}

async function pendingCollectionsAnswer(
  supabase: SupabaseClient,
  userId: string,
  scope: "self" | "team" | "all",
): Promise<string> {
  const resolved = await resolveScope(supabase, userId, scope);

  // Explicit scope filter: an org-wide analytics RLS policy makes ALL
  // retailers readable, so without this filter "your pending collections"
  // would list the whole company's outstanding amounts even for scope=self.
  let query = supabase
    .from("retailers")
    .select("user_id, name, pending_amount, phone, beat_name")
    .gt("pending_amount", 0)
    .order("pending_amount", { ascending: false })
    .limit(resolved.effectiveScope === "self" ? 20 : 50);
  if (resolved.userIds) query = query.in("user_id", resolved.userIds);
  const { data, error } = await query;
  if (error) throw error;

  if (resolved.effectiveScope === "self") {
    if (!data?.length) {
      return "Good news — you have no pending collections right now. All retailer balances are cleared.";
    }
    const total = data.reduce((sum: number, retailer: any) => sum + Number(retailer.pending_amount ?? 0), 0);
    const lines = data.map((r: any, i: number) => {
      const beat = r.beat_name ? ` _(${r.beat_name})_` : "";
      return `${i + 1}. **${r.name ?? "Retailer"}**${beat} — ₹${formatNumber(r.pending_amount)}`;
    });
    return [
      "Sure — here are your pending collections:",
      "",
      `**Total outstanding:** ₹${formatNumber(total)} across ${data.length} retailer${data.length === 1 ? "" : "s"}.`,
      "",
      ...lines,
      "",
      "Let me know if you'd like to prioritise any of these for today's route.",
    ].join("\n");
  }

  const parts: string[] = [];
  if (resolved.note) parts.push(resolved.note.trimEnd(), "");
  const headingScope = resolved.effectiveScope === "all" ? "Org-wide" : "Team";
  parts.push(`## ${headingScope} pending collections`, "");
  if (!data?.length) {
    parts.push(`No pending collections were found for ${resolved.effectiveScope === "all" ? "any retailer" : "your team"} right now.`);
    return parts.join("\n");
  }

  await backfillNames(supabase, resolved.nameById, data.map((r: any) => r.user_id));
  const total = data.reduce((sum: number, retailer: any) => sum + Number(retailer.pending_amount ?? 0), 0);
  parts.push(`**Total outstanding:** ₹${formatNumber(total)} across ${data.length} retailer${data.length === 1 ? "" : "s"}.`, "");

  const byUser = new Map<string, number>();
  data.forEach((r: any) => byUser.set(r.user_id, (byUser.get(r.user_id) ?? 0) + Number(r.pending_amount ?? 0)));
  const memberRows = [...byUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([uid, amt]) => `| ${escapeCell(resolved.nameById.get(uid) ?? uid)} | ₹${formatNumber(amt)} |`);
  parts.push("**By member:**", "", "| Member | Outstanding |", "|---|---:|", ...memberRows, "");

  const topRetailers = data.slice(0, 20).map((r: any, i: number) => {
    const beat = r.beat_name ? ` _(${r.beat_name})_` : "";
    return `${i + 1}. **${r.name ?? "Retailer"}**${beat} — ₹${formatNumber(r.pending_amount)} (${escapeCell(resolved.nameById.get(r.user_id) ?? r.user_id)})`;
  });
  parts.push("**Top retailers by outstanding:**", "", ...topRetailers);
  return parts.join("\n");
}

async function todaysVisitsAnswer(
  supabase: SupabaseClient,
  userId: string,
  today: string,
  scope: "self" | "team" | "all",
): Promise<string> {
  const resolved = await resolveScope(supabase, userId, scope);
  let query = supabase
    .from("visits")
    .select("user_id, retailer_id, status, check_in_time, no_order_reason")
    .eq("planned_date", today)
    .order("created_at", { ascending: true })
    .limit(resolved.effectiveScope === "self" ? 50 : 300);
  if (resolved.userIds) query = query.in("user_id", resolved.userIds);
  const { data: visits, error } = await query;
  if (error) throw error;
  if (!visits?.length) {
    return `${resolved.note}No visits are planned for ${today}${resolved.effectiveScope === "self" ? "" : ` for ${resolved.effectiveScope === "all" ? "anyone" : "your team"}`}.`;
  }

  const retailerIds = [...new Set(visits.map((visit: any) => visit.retailer_id).filter(Boolean))];
  const { data: retailers, error: retailerError } = await supabase
    .from("retailers")
    .select("id, name, priority, pending_amount, beat_name, last_visit_date")
    .in("id", retailerIds);
  if (retailerError) throw retailerError;
  const retailerMap = new Map((retailers ?? []).map((retailer: any) => [retailer.id, retailer]));
  const ordered = [...visits].sort((a: any, b: any) => {
    const aRetailer: any = retailerMap.get(a.retailer_id);
    const bRetailer: any = retailerMap.get(b.retailer_id);
    return Number(bRetailer?.pending_amount ?? 0) - Number(aRetailer?.pending_amount ?? 0);
  });

  if (resolved.effectiveScope === "self") {
    return [
      `## Today's visit plan (${today})`,
      "",
      "Prioritized by outstanding amount within your planned visits.",
      "",
      "| # | Retailer | Beat | Outstanding | Status |",
      "|---:|---|---|---:|---|",
      ...ordered.map((visit: any, index: number) => {
        const retailer: any = retailerMap.get(visit.retailer_id);
        return `| ${index + 1} | ${escapeCell(retailer?.name ?? "Retailer")} | ${escapeCell(retailer?.beat_name)} | ₹${formatNumber(retailer?.pending_amount)} | ${escapeCell(visit.status)} |`;
      }),
    ].join("\n");
  }

  await backfillNames(supabase, resolved.nameById, ordered.map((v: any) => v.user_id));
  const headingScope = resolved.effectiveScope === "all" ? "Org-wide" : "Team";
  const parts: string[] = [];
  if (resolved.note) parts.push(resolved.note.trimEnd(), "");
  parts.push(
    `## ${headingScope} visit plan (${today})`,
    "",
    "Prioritized by outstanding amount.",
    "",
    "| # | Rep | Retailer | Beat | Outstanding | Status |",
    "|---:|---|---|---|---:|---|",
    ...ordered.map((visit: any, index: number) => {
      const retailer: any = retailerMap.get(visit.retailer_id);
      return `| ${index + 1} | ${escapeCell(resolved.nameById.get(visit.user_id) ?? visit.user_id)} | ${escapeCell(retailer?.name ?? "Retailer")} | ${escapeCell(retailer?.beat_name)} | ₹${formatNumber(retailer?.pending_amount)} | ${escapeCell(visit.status)} |`;
    }),
  );
  return parts.join("\n");
}

async function targetsAnswer(
  supabase: SupabaseClient,
  userId: string,
  today: string,
  scope: "self" | "team" | "all",
): Promise<string> {
  const resolved = await resolveScope(supabase, userId, scope);

  let targetsQuery = supabase
    .from("user_period_targets")
    .select("user_id, kpi_id, target_value, actual_value, achievement_percent, period_start, period_end, status")
    .lte("period_start", today)
    .gte("period_end", today)
    .order("period_end", { ascending: true });
  if (resolved.userIds) targetsQuery = targetsQuery.in("user_id", resolved.userIds);
  const { data: targets, error } = await targetsQuery;
  if (error) throw error;

  if (resolved.effectiveScope === "self") {
    if (!targets?.length) {
      // This org allocates targets through hierarchy_target_allocations rather
      // than user_period_targets for some users — check there before declaring
      // "no targets" (own rows only via RLS).
      const { data: allocations } = await supabase
        .from("hierarchy_target_allocations")
        .select("quantity_target, revenue_target, effective_from, effective_to, level")
        .eq("user_id", userId)
        .lte("effective_from", today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order("effective_from", { ascending: false })
        .limit(10);
      if (allocations?.length) {
        return [
          `## Your allocated targets (${today})`,
          "",
          "| Effective | Revenue target | Quantity target |",
          "|---|---:|---:|",
          ...allocations.map((a: any) =>
            `| ${String(a.effective_from ?? "").slice(0, 10)} → ${a.effective_to ? String(a.effective_to).slice(0, 10) : "open"} | ₹${formatNumber(a.revenue_target)} | ${formatNumber(a.quantity_target)} |`
          ),
        ].join("\n");
      }
      return `No active targets were found for ${today}.`;
    }

    const kpiIds = [...new Set(targets.map((target: any) => target.kpi_id).filter(Boolean))];
    const { data: kpis, error: kpiError } = await supabase
      .from("target_kpi_definitions")
      .select("id, kpi_name, unit")
      .in("id", kpiIds);
    if (kpiError) throw kpiError;
    const kpiMap = new Map((kpis ?? []).map((kpi: any) => [kpi.id, kpi]));
    return [
      `## Active targets (${today})`,
      "",
      "| KPI | Actual | Target | Achievement |",
      "|---|---:|---:|---:|",
      ...targets.map((target: any) => {
        const kpi: any = kpiMap.get(target.kpi_id);
        const unit = kpi?.unit ? ` ${escapeCell(kpi.unit)}` : "";
        return `| ${escapeCell(kpi?.kpi_name ?? "Target")} | ${formatNumber(target.actual_value)}${unit} | ${formatNumber(target.target_value)}${unit} | ${formatNumber(target.achievement_percent)}% |`;
      }),
    ].join("\n");
  }

  const headingScope = resolved.effectiveScope === "all" ? "Org-wide" : "Team";
  if (!targets?.length) {
    let allocQuery = supabase
      .from("hierarchy_target_allocations")
      .select("quantity_target, revenue_target, effective_from, effective_to, level")
      .lte("effective_from", today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order("effective_from", { ascending: false })
      .limit(500);
    if (resolved.userIds) allocQuery = allocQuery.in("user_id", resolved.userIds);
    const { data: allocations } = await allocQuery;
    const parts: string[] = [];
    if (resolved.note) parts.push(resolved.note.trimEnd(), "");
    if (allocations?.length) {
      const revenueSum = allocations.reduce((s: number, a: any) => s + Number(a.revenue_target ?? 0), 0);
      const qtySum = allocations.reduce((s: number, a: any) => s + Number(a.quantity_target ?? 0), 0);
      parts.push(
        `## ${headingScope} allocated targets (${today})`,
        "",
        `**Total revenue target:** ₹${formatNumber(revenueSum)}`,
        `**Total quantity target:** ${formatNumber(qtySum)}`,
        `_(summed across ${allocations.length} allocation record${allocations.length === 1 ? "" : "s"} currently in effect)_`,
      );
      return parts.join("\n");
    }
    parts.push(`No active targets were found for ${resolved.effectiveScope === "all" ? "anyone" : "your team"} on ${today}.`);
    return parts.join("\n");
  }

  const kpiIds = [...new Set(targets.map((target: any) => target.kpi_id).filter(Boolean))];
  const { data: kpis, error: kpiError } = await supabase
    .from("target_kpi_definitions")
    .select("id, kpi_name, unit")
    .in("id", kpiIds);
  if (kpiError) throw kpiError;
  const kpiMap = new Map((kpis ?? []).map((kpi: any) => [kpi.id, kpi]));

  const byKpi = new Map<string, { actual: number; target: number }>();
  targets.forEach((t: any) => {
    const agg = byKpi.get(t.kpi_id) ?? { actual: 0, target: 0 };
    agg.actual += Number(t.actual_value ?? 0);
    agg.target += Number(t.target_value ?? 0);
    byKpi.set(t.kpi_id, agg);
  });

  const parts: string[] = [];
  if (resolved.note) parts.push(resolved.note.trimEnd(), "");
  parts.push(
    `## ${headingScope} active targets (${today})`,
    "",
    "| KPI | Total Actual | Total Target | Achievement |",
    "|---|---:|---:|---:|",
    ...[...byKpi.entries()].map(([kpiId, agg]) => {
      const kpi: any = kpiMap.get(kpiId);
      const unit = kpi?.unit ? ` ${escapeCell(kpi.unit)}` : "";
      const pct = agg.target ? (agg.actual / agg.target) * 100 : 0;
      return `| ${escapeCell(kpi?.kpi_name ?? "Target")} | ${formatNumber(agg.actual)}${unit} | ${formatNumber(agg.target)}${unit} | ${formatNumber(pct)}% |`;
    }),
  );
  return parts.join("\n");
}

/** Product order mix from the signed-in user's own confirmed orders (last
 * 90 days) plus the product master, so "top/least ordered products" answers
 * name REAL products with real counts instead of the model improvising. */
async function productsAnswer(
  supabase: SupabaseClient,
  userId: string,
  today: string,
  message: string,
  scope: "self" | "team" | "all",
): Promise<string> {
  const resolved = await resolveScope(supabase, userId, scope);
  const CONFIRMED = new Set(["confirmed", "delivered", "invoiced", "completed", "dispatched", "packed"]);
  const since90 = new Date(new Date(`${today}T00:00:00Z`).getTime() - 90 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  let ordersQuery = supabase
    .from("orders")
    .select("id, status, order_date")
    .gte("order_date", since90)
    .lte("order_date", today)
    .order("order_date", { ascending: false })
    .limit(2000);
  if (resolved.userIds) ordersQuery = ordersQuery.in("user_id", resolved.userIds);

  const [{ data: orders, error: ordersError }, { data: master, error: masterError }, { data: variants }] =
    await Promise.all([
      ordersQuery,
      supabase.from("products").select("id, name, rate, unit, base_unit, gst_percentage, is_active").limit(1000),
      supabase
        .from("product_variants")
        .select("product_id, variant_name, price, base_unit, is_active")
        .limit(2000),
    ]);
  if (ordersError) throw ordersError;
  if (masterError) throw masterError;

  // Price/detail lookup for products the user NAMED in their message —
  // "what is the price of kadak gold" must answer from the master/variant
  // price, not from the model's imagination. Uses the shared nameMatches()
  // word-overlap matcher (also used by schemesAnswer/vanStockAnswer).
  const productById = new Map((master ?? []).map((p: any) => [String(p.id), p]));
  const matchedLines: string[] = [];
  (master ?? []).forEach((p: any) => {
    if (nameMatches(message, String(p.name ?? "")) > 0) {
      const unit = p.base_unit || p.unit;
      matchedLines.push(
        `- **${p.name}** — price ₹${formatNumber(p.rate)}${unit ? ` per ${unit}` : ""}` +
          `${p.gst_percentage != null ? `, GST ${formatNumber(p.gst_percentage)}%` : ""}` +
          `${p.is_active === false ? " (inactive)" : ""}`,
      );
    }
  });
  (variants ?? []).forEach((v: any) => {
    if (nameMatches(message, String(v.variant_name ?? "")) > 0) {
      const parent: any = productById.get(String(v.product_id));
      matchedLines.push(
        `- **${v.variant_name}**${parent?.name ? ` (variant of ${parent.name})` : ""} — price ₹${formatNumber(v.price)}` +
          `${v.base_unit ? ` per ${v.base_unit}` : ""}${v.is_active === false ? " (inactive)" : ""}`,
      );
    }
  });

  const confirmedIds = (orders ?? [])
    .filter((o: any) => CONFIRMED.has(String(o.status ?? "").toLowerCase()))
    .map((o: any) => String(o.id))
    .slice(0, 1000);

  interface Agg { name: string; orderIds: Set<string>; lines: number; value: number }
  const byProduct = new Map<string, Agg>();
  if (confirmedIds.length) {
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("order_id, product_name, total")
      .in("order_id", confirmedIds)
      .limit(8000);
    if (itemsError) throw itemsError;
    (items ?? []).forEach((it: any) => {
      const name = String(it.product_name ?? "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      const agg = byProduct.get(key) ?? { name, orderIds: new Set<string>(), lines: 0, value: 0 };
      agg.orderIds.add(String(it.order_id));
      agg.lines += 1;
      agg.value += Number(it.total ?? 0) || 0;
      byProduct.set(key, agg);
    });
  }

  const ordered = [...byProduct.values()];
  const top = [...ordered].sort((a, b) => b.value - a.value).slice(0, 5);
  const least = [...ordered].sort((a, b) => a.orderIds.size - b.orderIds.size || a.value - b.value).slice(0, 5);
  const orderedNames = new Set(ordered.map((p) => p.name.toLowerCase()));
  const neverOrdered = (master ?? [])
    .map((p: any) => String(p.name ?? "").trim())
    .filter((n: string) => n && !orderedNames.has(n.toLowerCase()))
    .slice(0, 10);

  const whose = resolved.effectiveScope === "all" ? "anyone" : resolved.effectiveScope === "team" ? "your team" : "you";
  if (!ordered.length && !neverOrdered.length && !matchedLines.length) {
    return `${resolved.note}${whose === "you" ? "You have" : `${whose.charAt(0).toUpperCase()}${whose.slice(1)} have`} no confirmed orders in the last 90 days and no products are visible in the product master, so there is no product mix to report.`;
  }

  const row = (p: Agg, i: number) =>
    `${i + 1}. **${p.name}** — ${p.orderIds.size} order${p.orderIds.size === 1 ? "" : "s"}, ₹${formatNumber(p.value)}`;
  const parts: string[] = [];
  if (resolved.note) parts.push(resolved.note.trimEnd(), "");
  if (matchedLines.length) {
    parts.push(
      "## Products named in the question (from the product master — authoritative prices)",
      ...matchedLines,
      "",
    );
  } else if (/\b(price|prices|priced|pricing|rate|rates|cost|mrp)\b/i.test(message)) {
    parts.push(
      "No product or variant in the product master matches the name the user asked about — say so plainly and suggest checking the exact product name; do not guess a price.",
      "",
    );
  }
  const scopeLabel = resolved.effectiveScope === "all" ? "Org-wide" : resolved.effectiveScope === "team" ? "Team" : "Your";
  parts.push(
    `## ${scopeLabel} product order mix (confirmed orders, last 90 days)`,
    "",
    `Products ordered: ${ordered.length}. Confirmed orders analysed: ${confirmedIds.length}.`,
  );
  if (top.length) parts.push("", "**Top ordered (by value):**", ...top.map(row));
  if (least.length) parts.push("", "**Least ordered (fewest orders first):**", ...least.map(row));
  if (neverOrdered.length) {
    parts.push(
      "",
      `**In the product master but with NO orders from ${whose} in this window:** ${neverOrdered.join(", ")}${(master ?? []).length > 1000 ? " (master truncated at 1000)" : ""}`,
    );
  }
  return parts.join("\n");
}

/**
 * Gamification intent: personal points ledger (self) or a group points
 * total + per-member breakdown (team/all) — mirrors the scope pattern every
 * other scoped intent uses via resolveScope(). With no datePreset, reports
 * an all-time total (the natural default for "how many points do I/we
 * have"), unlike revenueAnswer's "today" default.
 *
 * The redemption balance and points-to-rupee conversion rate (self-scope
 * only) are exact ports of src/pages/Leaderboard.tsx's fetchMyPoints
 * (:233-287) — in particular the conversion rate comes from the
 * most-recently-created ACTIVE game's points_to_rupee_conversion, not the
 * newer gamification_settings.point_conversion singleton, because that's
 * what the live UI actually uses; using the other source would make this
 * answer disagree with the app.
 */
async function gamificationAnswer(
  supabase: SupabaseClient,
  userId: string,
  datePreset: DatePreset | null,
  scope: "self" | "team" | "all",
): Promise<string> {
  let rangeLabel = "all-time";
  let from: string | null = null;
  let to: string | null = null;
  if (datePreset) {
    ({ from, to } = resolveDatePreset(datePreset));
    rangeLabel = `${datePreset.replace(/_/g, " ")} (${from === to ? from : `${from} to ${to}`})`;
  }

  if (scope !== "self") {
    return gamificationGroupAnswer(supabase, userId, scope, from, to, rangeLabel);
  }

  const today = istNow().toISOString().slice(0, 10);
  const { data: allPoints, error: pointsError } = await supabase
    .from("gamification_points")
    .select("points, earned_at, action_id, game_id")
    .eq("user_id", userId);
  if (pointsError) throw pointsError;

  const totalEverEarned = (allPoints ?? []).reduce((s: number, r: any) => s + Number(r.points ?? 0), 0);
  const periodRows = from
    ? (allPoints ?? []).filter((r: any) => {
      const d = String(r.earned_at ?? "").slice(0, 10);
      return d >= from! && d <= to!;
    })
    : (allPoints ?? []);
  const periodPoints = periodRows.reduce((s: number, r: any) => s + Number(r.points ?? 0), 0);

  // Deliberately no early return when allPoints is empty — "what games are
  // active" is a valid gamification question for a user with zero personal
  // points, and the active-games section below must still be reachable.
  const { data: redemptions, error: redemptionsError } = await supabase
    .from("gamification_redemptions")
    .select("points_redeemed, status, requested_at")
    .eq("user_id", userId)
    .order("requested_at", { ascending: false })
    .limit(20);
  if (redemptionsError) throw redemptionsError;
  const redeemedOrPending = (redemptions ?? [])
    .filter((r: any) => r.status === "approved" || r.status === "pending")
    .reduce((s: number, r: any) => s + Number(r.points_redeemed ?? 0), 0);
  const availableBalance = Math.max(0, totalEverEarned - redeemedOrPending);

  const { data: games, error: gamesError } = await supabase
    .from("gamification_games")
    .select("id, name, points_to_rupee_conversion, created_at, start_date, end_date")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (gamesError) throw gamesError;
  const currentActiveGames = (games ?? []).filter((g: any) =>
    (!g.start_date || g.start_date <= today) && (!g.end_date || g.end_date >= today)
  );
  const mostRecentActiveGame: any = currentActiveGames[0];
  const conversionRate = Number(mostRecentActiveGame?.points_to_rupee_conversion ?? 0);
  const rupeeEstimate = conversionRate ? availableBalance * conversionRate : null;

  // The "My Games" tab (src/pages/Leaderboard.tsx fetchGames(), :311-341)
  // does NOT display gamification_games.name on its cards — it shows each
  // game's first enabled gamification_actions.action_name instead
  // (rendered at Leaderboard.tsx:845). Replicating that join here so the
  // copilot names games the same way the app UI does; falls back to the
  // game's own name if it has no enabled action row.
  const activeGameIds = currentActiveGames.map((g: any) => g.id);
  const activityNameByGameId = new Map<string, string>();
  if (activeGameIds.length) {
    const { data: gameActions } = await supabase
      .from("gamification_actions")
      .select("game_id, action_name")
      .in("game_id", activeGameIds)
      .eq("is_enabled", true);
    (gameActions ?? []).forEach((a: any) => {
      if (!activityNameByGameId.has(a.game_id)) activityNameByGameId.set(a.game_id, a.action_name);
    });
  }

  const actionIds = [...new Set(periodRows.map((r: any) => r.action_id).filter(Boolean))];
  let actionNameById = new Map<string, string>();
  if (actionIds.length) {
    const { data: actions } = await supabase
      .from("gamification_actions")
      .select("id, action_name")
      .in("id", actionIds as string[]);
    actionNameById = new Map((actions ?? []).map((a: any) => [a.id, a.action_name]));
  }
  const byAction = new Map<string, number>();
  periodRows.forEach((r: any) => {
    const name = actionNameById.get(r.action_id) ?? "Other";
    byAction.set(name, (byAction.get(name) ?? 0) + Number(r.points ?? 0));
  });

  const gamePointsMap = new Map<string, number>();
  periodRows.forEach((r: any) => {
    if (!r.game_id) return;
    gamePointsMap.set(r.game_id, (gamePointsMap.get(r.game_id) ?? 0) + Number(r.points ?? 0));
  });

  const parts = [
    `## Your gamification points — ${rangeLabel}`,
    "",
    `**Points earned (${rangeLabel}):** ${formatNumber(periodPoints, 0)}`,
    `**Total ever earned:** ${formatNumber(totalEverEarned, 0)}`,
    `**Available to redeem:** ${formatNumber(availableBalance, 0)} points${
      rupeeEstimate != null ? ` (≈ ₹${formatNumber(rupeeEstimate)})` : ""
    }`,
  ];

  if (byAction.size) {
    parts.push(
      "",
      "**Breakdown by activity:**",
      "",
      "| Activity | Points |",
      "|---|---:|",
      ...[...byAction.entries()].sort((a, b) => b[1] - a[1]).map(([name, pts]) =>
        `| ${escapeCell(name)} | ${formatNumber(pts, 0)} |`
      ),
    );
  }

  if (currentActiveGames.length) {
    parts.push(
      "",
      "**Active games:**",
      "",
      "| Game | Your points |",
      "|---|---:|",
      ...currentActiveGames.map((g: any) =>
        `| ${escapeCell(activityNameByGameId.get(g.id) ?? g.name)} | ${formatNumber(gamePointsMap.get(g.id) ?? 0, 0)} |`
      ),
    );
  }

  const pending = (redemptions ?? []).filter((r: any) => r.status === "pending");
  if (pending.length) {
    parts.push(
      "",
      "**Pending redemption requests:**",
      ...pending.map((r: any) =>
        `- ${formatNumber(r.points_redeemed, 0)} points requested on ${String(r.requested_at).slice(0, 10)}`
      ),
    );
  }

  return parts.join("\n");
}

/**
 * Team/all branch of the gamification intent: total points across the full
 * recursive hierarchy or (confirmed admin) everyone (resolveScope — same
 * helper every other scoped intent uses) plus a per-member breakdown.
 * Team scope always lists every member including those with 0 points —
 * never silently omitted, matching the honesty pattern already used in
 * revenueAnswer's team table. All scope only lists members who actually
 * have rows (zero-padding every user in the system isn't practical or
 * useful at that size). Redemption balance / rupee estimate / pending
 * redemptions are deliberately NOT shown here — those are inherently
 * personal per-user balances, not something to sum across a group.
 */
async function gamificationGroupAnswer(
  supabase: SupabaseClient,
  userId: string,
  scope: "team" | "all",
  from: string | null,
  to: string | null,
  rangeLabel: string,
): Promise<string> {
  const today = istNow().toISOString().slice(0, 10);
  const resolved = await resolveScope(supabase, userId, scope);

  let pointsQuery = supabase
    .from("gamification_points")
    .select("user_id, points, earned_at, game_id");
  if (resolved.userIds) pointsQuery = pointsQuery.in("user_id", resolved.userIds);
  const { data: allPoints, error: pointsError } = await pointsQuery;
  if (pointsError) throw pointsError;

  const periodRows = from
    ? (allPoints ?? []).filter((r: any) => {
      const d = String(r.earned_at ?? "").slice(0, 10);
      return d >= from! && d <= to!;
    })
    : (allPoints ?? []);

  const pointsByUser = new Map<string, number>();
  if (resolved.userIds) resolved.userIds.forEach((uid) => pointsByUser.set(uid, 0));
  periodRows.forEach((r: any) => {
    pointsByUser.set(r.user_id, (pointsByUser.get(r.user_id) ?? 0) + Number(r.points ?? 0));
  });
  await backfillNames(supabase, resolved.nameById, pointsByUser.keys());
  const totalGroupPoints = [...pointsByUser.values()].reduce((s, v) => s + v, 0);

  const { data: games, error: gamesError } = await supabase
    .from("gamification_games")
    .select("id, name, start_date, end_date")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (gamesError) throw gamesError;
  const currentActiveGames = (games ?? []).filter((g: any) =>
    (!g.start_date || g.start_date <= today) && (!g.end_date || g.end_date >= today)
  );

  // Same UI-matching game-name join as the self-scope branch (see its
  // comment above) — game display names must match the "My Games" tab here
  // too, not just for individual questions.
  const activeGameIds = currentActiveGames.map((g: any) => g.id);
  const activityNameByGameId = new Map<string, string>();
  if (activeGameIds.length) {
    const { data: gameActions } = await supabase
      .from("gamification_actions")
      .select("game_id, action_name")
      .in("game_id", activeGameIds)
      .eq("is_enabled", true);
    (gameActions ?? []).forEach((a: any) => {
      if (!activityNameByGameId.has(a.game_id)) activityNameByGameId.set(a.game_id, a.action_name);
    });
  }
  const teamPointsByGame = new Map<string, number>();
  periodRows.forEach((r: any) => {
    if (!r.game_id) return;
    teamPointsByGame.set(r.game_id, (teamPointsByGame.get(r.game_id) ?? 0) + Number(r.points ?? 0));
  });

  const headingScope = resolved.effectiveScope === "all" ? "Org-wide" : "Team";
  const parts: string[] = [];
  if (resolved.note) parts.push(resolved.note.trimEnd(), "");
  parts.push(
    `## ${headingScope} gamification points — ${rangeLabel}`,
    "",
    `**Total points earned:** ${formatNumber(totalGroupPoints, 0)}`,
    "",
    "**By member:**",
    "",
    "| Member | Points |",
    "|---|---:|",
    ...[...pointsByUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([uid, pts]) => `| ${escapeCell(resolved.nameById.get(uid) ?? uid)} | ${formatNumber(pts, 0)} |`),
  );

  if (currentActiveGames.length) {
    parts.push(
      "",
      `**Active games (${resolved.effectiveScope === "all" ? "org-wide" : "team"} totals):**`,
      "",
      "| Game | Points |",
      "|---|---:|",
      ...currentActiveGames.map((g: any) =>
        `| ${escapeCell(activityNameByGameId.get(g.id) ?? g.name)} | ${formatNumber(teamPointsByGame.get(g.id) ?? 0, 0)} |`
      ),
    );
  }

  return parts.join("\n");
}

/**
 * Leaderboard intent: org-wide only, matching src/pages/Leaderboard.tsx
 * exactly (:100-171) — there is no team-scoped leaderboard anywhere in the
 * live app, so this deliberately doesn't invent one. Defaults to
 * current_month when no period is named (a leaderboard is inherently
 * period-relative; "today" is too sparse to be meaningful for most orgs).
 */
async function leaderboardAnswer(
  supabase: SupabaseClient,
  userId: string,
  datePreset: DatePreset | null,
): Promise<string> {
  const resolvedPreset = datePreset ?? "current_month";
  const { from, to } = resolveDatePreset(resolvedPreset);
  const label = resolvedPreset.replace(/_/g, " ");
  const rangeLabel = from === to ? from : `${from} to ${to}`;

  const { data, error } = await supabase
    .from("gamification_points")
    .select("user_id, points")
    .gte("earned_at", from)
    .lte("earned_at", `${to}T23:59:59`);
  if (error) throw error;

  const totals = new Map<string, number>();
  (data ?? []).forEach((r: any) => {
    totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + Number(r.points ?? 0));
  });

  if (!totals.size) {
    return `No gamification points were earned by anyone between ${rangeLabel} (${label}), so there's no leaderboard to show for this period.`;
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, is_active, user_status")
    .in("id", [...totals.keys()]);
  if (profilesError) throw profilesError;
  const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const ranked = [...totals.entries()]
    .filter(([uid]) => {
      const p: any = profileById.get(uid);
      return p && p.is_active !== false && p.user_status !== "inactive";
    })
    .map(([uid, points]) => ({ uid, points, name: profileById.get(uid)?.full_name ?? "Unknown" }))
    .sort((a, b) => b.points - a.points);

  const myIndex = ranked.findIndex((r) => r.uid === userId);
  const myPoints = totals.get(userId) ?? 0;

  const parts = [
    `## Leaderboard — ${label} (${rangeLabel})`,
    "",
    "**Top 10:**",
    "",
    "| Rank | Name | Points |",
    "|---:|---|---:|",
    ...ranked.slice(0, 10).map((r, i) => `| ${i + 1} | ${escapeCell(r.name)} | ${formatNumber(r.points, 0)} |`),
  ];

  parts.push(
    "",
    myIndex >= 0
      ? `**Your position:** rank ${myIndex + 1} of ${ranked.length}, with ${formatNumber(myPoints, 0)} points.`
      : `**Your position:** you haven't earned any points in this period (0 points).`,
  );

  return parts.join("\n");
}

/**
 * Schemes intent: product_schemes is global reference data (RLS-open), so
 * unlike every other intent this one needs no userId/team scoping — the
 * only filtering is business logic (is it active, does it target the named
 * product/retailer). Excludes ai_scheme_suggestions entirely — those are
 * unapproved AI drafts, not live schemes, and surfacing them would violate
 * the "never invent business data" rule just as much as making one up.
 */
async function schemesAnswer(
  supabase: SupabaseClient,
  message: string,
  retailerName: string | null,
): Promise<string> {
  const today = istNow().toISOString().slice(0, 10);
  const isSchemeActiveNow = (s: any): boolean => {
    if (s.is_active === false) return false;
    if (s.start_date && s.start_date > today) return false;
    if (s.end_date && s.end_date < today) return false;
    return true;
  };

  const { data: schemes, error: schemesError } = await supabase
    .from("product_schemes")
    .select(
      "id, name, scheme_type, is_active, start_date, end_date, discount_percentage, discount_amount, " +
        "buy_quantity, free_quantity, free_product_id, min_order_value, product_id, category_id, " +
        "target_product_ids, bundle_product_ids, bundle_discount_amount, bundle_discount_percentage, applicability_type",
    )
    .limit(500);
  if (schemesError) throw schemesError;

  const active = (schemes ?? []).filter(isSchemeActiveNow);
  if (!active.length) {
    return "There are no active schemes right now.";
  }

  const [{ data: master }, { data: variants }, { data: categories }] = await Promise.all([
    supabase.from("products").select("id, name, category_id").limit(1000),
    supabase.from("product_variants").select("id, product_id, variant_name").limit(2000),
    supabase.from("product_categories").select("id, name").limit(200),
  ]);
  const productNameById = new Map((master ?? []).map((p: any) => [p.id, p.name]));
  const categoryNameById = new Map((categories ?? []).map((c: any) => [c.id, c.name]));
  const categoryByProduct = new Map((master ?? []).map((p: any) => [p.id, p.category_id]));

  const describeScheme = (s: any): string => {
    const terms: string[] = [];
    if (s.discount_percentage) terms.push(`${formatNumber(s.discount_percentage)}% off`);
    if (s.discount_amount) terms.push(`₹${formatNumber(s.discount_amount)} off`);
    if (s.buy_quantity && s.free_quantity) {
      terms.push(
        `buy ${s.buy_quantity} get ${s.free_quantity} free${
          s.free_product_id ? ` (${productNameById.get(s.free_product_id) ?? "free item"})` : ""
        }`,
      );
    }
    if (s.bundle_discount_percentage) terms.push(`bundle: ${formatNumber(s.bundle_discount_percentage)}% off`);
    if (s.bundle_discount_amount) terms.push(`bundle: ₹${formatNumber(s.bundle_discount_amount)} off`);
    if (s.min_order_value) terms.push(`min order ₹${formatNumber(s.min_order_value)}`);
    const target = s.product_id
      ? productNameById.get(s.product_id) ?? "a specific product"
      : s.category_id
      ? `category: ${categoryNameById.get(s.category_id) ?? "a category"}`
      : s.target_product_ids?.length
      ? `${s.target_product_ids.length} selected products`
      : s.bundle_product_ids?.length
      ? "a product bundle"
      : "all products (order-wide)";
    return `- **${s.name}** (${s.scheme_type}) — applies to ${target}${terms.length ? `: ${terms.join(", ")}` : ""}${
      s.end_date ? `, valid until ${s.end_date}` : ""
    }`;
  };

  const matchedProductIds = new Set<string>();
  (master ?? []).forEach((p: any) => {
    if (nameMatches(message, String(p.name ?? "")) > 0) matchedProductIds.add(p.id);
  });
  (variants ?? []).forEach((v: any) => {
    if (nameMatches(message, String(v.variant_name ?? "")) > 0 && v.product_id) matchedProductIds.add(v.product_id);
  });
  const matchedCategoryIds = new Set(
    [...matchedProductIds].map((id) => categoryByProduct.get(id)).filter(Boolean) as string[],
  );

  if (matchedProductIds.size) {
    const schemesForProduct = active.filter((s: any) =>
      (s.product_id && matchedProductIds.has(s.product_id)) ||
      (s.target_product_ids ?? []).some((id: string) => matchedProductIds.has(id)) ||
      (s.bundle_product_ids ?? []).some((id: string) => matchedProductIds.has(id)) ||
      (s.category_id && matchedCategoryIds.has(s.category_id))
    );
    const productLabel = [...matchedProductIds].map((id) => productNameById.get(id)).filter(Boolean).join(", ");
    if (!schemesForProduct.length) {
      return `I couldn't find any active scheme on ${productLabel || "that product"} right now.`;
    }
    return [`Active scheme(s) on ${productLabel}:`, "", ...schemesForProduct.map(describeScheme)].join("\n");
  }

  if (retailerName) {
    const { data: retailers, error: retailersError } = await supabase
      .from("retailers")
      .select("id, name, beat_id, territory_id, distributor_id")
      .ilike("name", `%${retailerName}%`)
      .limit(10);
    if (retailersError) throw retailersError;
    if (!retailers?.length) {
      return `I couldn't find a retailer named "${retailerName}" to check schemes for.`;
    }
    if (retailers.length > 1) {
      return [
        `Found ${retailers.length} retailers matching "${retailerName}" — which one did you mean?`,
        "",
        ...retailers.map((r: any) => `- **${r.name}** (id: ${r.id})`),
      ].join("\n");
    }
    const retailer: any = retailers[0];
    // retailers.beat_id is the text business key (beats.beat_id), not
    // beats.id (uuid) — scheme_applicability.entity_id needs the uuid, so
    // this resolves through beats.beat_id first, same distinction the beats
    // intent's own queries already account for.
    let beatUuid: string | null = null;
    if (retailer.beat_id) {
      const { data: beatRow } = await supabase.from("beats").select("id").eq("beat_id", retailer.beat_id)
        .maybeSingle();
      beatUuid = (beatRow as any)?.id ?? null;
    }
    const { data: applicRows, error: applicError } = await supabase
      .from("scheme_applicability")
      .select("scheme_id, applicability_level, entity_id")
      .in("scheme_id", active.map((s: any) => s.id));
    if (applicError) throw applicError;
    const matchedSchemeIds = new Set<string>();
    (applicRows ?? []).forEach((row: any) => {
      // Specificity ranking and the unconditional "salesperson" match are
      // ported as-is from src/components/TableOrderForm.tsx:291-308 —
      // existing product behavior, not something to silently "fix" here.
      const matches =
        (row.applicability_level === "retailer" && row.entity_id === retailer.id) ||
        (row.applicability_level === "beat" && beatUuid && row.entity_id === beatUuid) ||
        (row.applicability_level === "territory" && row.entity_id === retailer.territory_id) ||
        (row.applicability_level === "distributor" && row.entity_id === retailer.distributor_id) ||
        row.applicability_level === "salesperson";
      if (matches) matchedSchemeIds.add(row.scheme_id);
    });
    const schemesForRetailer = active.filter((s: any) =>
      s.applicability_type === "global" || matchedSchemeIds.has(s.id)
    );
    if (!schemesForRetailer.length) {
      return `No active schemes apply to **${retailer.name}** right now.`;
    }
    return [`Active scheme(s) for **${retailer.name}**:`, "", ...schemesForRetailer.map(describeScheme)].join("\n");
  }

  const sorted = [...active].sort((a: any, b: any) =>
    Number(b.discount_percentage ?? b.bundle_discount_percentage ?? 0) -
    Number(a.discount_percentage ?? a.bundle_discount_percentage ?? 0)
  );
  return [`${sorted.length} active scheme(s) right now:`, "", ...sorted.map(describeScheme)].join("\n");
}

/**
 * Van Stock intent: uses Subsystem A only (van_stock/van_stock_items,
 * realtime-synced from confirmed orders by src/utils/vanStockSync.ts) —
 * Subsystem B (van_live_inventory, GRN-based) has 0 live rows and is not
 * kept in sync by sales at all. left_qty is trusted directly rather than
 * re-derived, since vanStockSync.ts already keeps it correct. RLS does NOT
 * scope van_stock_items to the owning user (see PR description), so scoping
 * is done here in application code, same as every other intent.
 */
async function vanStockAnswer(
  supabase: SupabaseClient,
  userId: string,
  scope: "self" | "team" | "all",
  message: string,
): Promise<string> {
  const today = istNow().toISOString().slice(0, 10);
  const resolved = await resolveScope(supabase, userId, scope);

  let query = supabase
    .from("van_stock")
    .select("user_id, van_id, stock_date, van_stock_items(product_name, unit, start_qty, ordered_qty, returned_qty, left_qty)")
    .eq("stock_date", today);
  if (resolved.userIds) query = query.in("user_id", resolved.userIds);
  const { data: stocks, error } = await query;
  if (error) throw error;

  if (!stocks?.length) {
    return resolved.effectiveScope === "self"
      ? "You haven't opened your van stock today yet."
      : `${resolved.note}None of ${resolved.effectiveScope === "all" ? "anyone" : "your team"} has opened van stock today yet.`;
  }

  if (resolved.effectiveScope === "self") {
    const items = ((stocks[0] as any).van_stock_items ?? []) as any[];
    const matched = items.filter((it) => nameMatches(message, String(it.product_name ?? "")) > 0);
    const toShow = matched.length ? matched : items;
    const lines = toShow.map((it: any) =>
      `- **${it.product_name}** — ${it.left_qty} ${it.unit ?? "units"} left (started ${it.start_qty}, sold ${it.ordered_qty}, returned ${it.returned_qty})`
    );
    return [`## Your van stock — ${today}`, "", ...lines].join("\n");
  }

  await backfillNames(supabase, resolved.nameById, (stocks as any[]).map((s: any) => s.user_id));
  const parts: string[] = [];
  if (resolved.note) parts.push(resolved.note.trimEnd(), "");
  parts.push(`## ${resolved.effectiveScope === "all" ? "Org-wide" : "Team"} van stock — ${today}`, "");
  (stocks as any[]).forEach((s: any) => {
    const name = resolved.nameById.get(s.user_id) ?? s.user_id;
    const items = (s.van_stock_items ?? []) as any[];
    const totalLeft = items.reduce((sum, it) => sum + Number(it.left_qty ?? 0), 0);
    parts.push(
      `- **${name}**: ${items.length} product${items.length === 1 ? "" : "s"}, ${
        formatNumber(totalLeft, 0)
      } units left in total`,
    );
  });

  // "Missing" (hasn't opened van stock) is only computable against a known
  // roster — meaningful for team scope, but not for "all" without fetching
  // every user id in the system, which defeats the point.
  if (resolved.effectiveScope === "team" && resolved.userIds) {
    const stockedUserIds = new Set((stocks as any[]).map((s: any) => s.user_id));
    const missing = resolved.userIds.filter((uid) => !stockedUserIds.has(uid));
    if (missing.length) {
      parts.push("", "**Haven't opened van stock today:**", ...missing.map((uid) => `- ${resolved.nameById.get(uid) ?? uid}`));
    }
  }
  return parts.join("\n");
}

interface DataAnswerSlots {
  beatName: string | null;
  retailerName: string | null;
  datePreset: DatePreset | null;
  scope: "self" | "team" | "all";
}

async function dataAnswer(
  intent: DataIntent,
  supabase: SupabaseClient,
  userId: string,
  today: string,
  message: string,
  slots: DataAnswerSlots,
): Promise<string> {
  switch (intent) {
    case "leave": return leaveBalanceAnswer(supabase, userId, Number(today.slice(0, 4)), slots.scope);
    case "attendance": return attendanceAnswer(supabase, userId, today, slots.scope);
    case "beats": return beatsAnswer(supabase, userId, slots.beatName, slots.scope);
    case "collections": return pendingCollectionsAnswer(supabase, userId, slots.scope);
    case "visits": return todaysVisitsAnswer(supabase, userId, today, slots.scope);
    case "targets": return targetsAnswer(supabase, userId, today, slots.scope);
    case "products": return productsAnswer(supabase, userId, today, message, slots.scope);
    case "revenue": return revenueAnswer(supabase, userId, slots.datePreset, slots.scope);
    case "gamification": return gamificationAnswer(supabase, userId, slots.datePreset, slots.scope);
    case "leaderboard": return leaderboardAnswer(supabase, userId, slots.datePreset);
    case "schemes": return schemesAnswer(supabase, message, slots.retailerName);
    case "van_stock": return vanStockAnswer(supabase, userId, slots.scope, message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "method_not_allowed", "POST only");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError(401, "unauthorized", "Missing bearer token");
    }
    const apiKey = Deno.env.get("TOGETHER_API_KEY");
    if (!apiKey) return jsonError(500, "server_misconfigured", "TOGETHER_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) return jsonError(401, "unauthorized", "Invalid session");
    const userId = claims.claims.sub as string;

    // Validate body
    let payload: z.infer<typeof BodySchema>;
    try {
      payload = BodySchema.parse(await req.json());
    } catch (e) {
      const msg = e instanceof z.ZodError ? e.issues.map(i => i.message).join(", ") : "Invalid request";
      return jsonError(400, "invalid_request", msg);
    }
    const { conversationId, message } = payload;

    // Verify conversation ownership + fetch user profile fields for the prompt.
    const [{ data: conv, error: convErr }, { data: profile }] = await Promise.all([
      supabase
        .from("copilot_conversations")
        .select("id, user_id, title")
        .eq("id", conversationId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, name, role")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    if (convErr || !conv || conv.user_id !== userId) {
      return jsonError(404, "conversation_not_found", "Conversation not accessible");
    }

    // Load history.
    const { data: history } = await supabase
      .from("copilot_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(HISTORY_LIMIT);

    // Persist exactly one user message before processing.
    const { error: userMessageError } = await supabase.from("copilot_messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "user",
      content: message,
    });
    if (userMessageError) {
      console.error("[copilot-agent] user message persistence failed:", userMessageError);
      return jsonError(500, "persistence_failed", "Could not save your message");
    }

    // IST, not the server's raw UTC clock — see istNow()'s doc comment in
    // datePresets.ts. This changes only how this function interprets "today"
    // for chat answers; it doesn't touch how any date gets written elsewhere.
    const today = istNow().toISOString().slice(0, 10);
    const system = buildSystemPrompt({
      userName: (profile as any)?.full_name || (profile as any)?.name || null,
      userRole: (profile as any)?.role || null,
      today,
    });

    const messages: ChatMessage[] = [
      { role: "system", content: system },
      ...((history ?? []).map((m: any) => ({
        role: m.role as ChatMessage["role"],
        content: String(m.content ?? ""),
      }))),
      { role: "user", content: message },
    ];

    const reqId = crypto.randomUUID().slice(0, 8);
    const diagLog = (msg: string, extra?: unknown) =>
      console.log(`[copilot-diag][${reqId}][edge] ${msg}`, extra ?? "");

    let stream: Awaited<ReturnType<typeof streamChat>>;
    try {
      let intent = classifyDataIntent(message);
      let routed: AiRouteResult | null = null;
      if (!intent) {
        routed = await routeIntentWithAi(apiKey, message);
        diagLog(
          `ai-router msgChars=${message.length} regex=no-match raw=${JSON.stringify(routed.raw)} ` +
            `resolved=${routed.intent ?? "none"} beatName=${routed.beatName ?? "-"} ` +
            `retailerName=${routed.retailerName ?? "-"} datePreset=${routed.datePreset ?? "-"} ` +
            `scope=${routed.scope} latencyMs=${routed.latencyMs}`,
        );
        intent = routed.intent;
      }

      // Cheap regex slot extraction always wins; the AI router's slots (only
      // populated when it ran) are the fallback. Harmless to compute even
      // when the resolved intent doesn't use a given slot. "all" outranks
      // "team" if either source says "all".
      const extractedScope = extractScope(message);
      const scope: "self" | "team" | "all" =
        extractedScope === "all" || routed?.scope === "all"
          ? "all"
          : extractedScope === "team" || routed?.scope === "team"
          ? "team"
          : "self";
      const datePreset: DatePreset | null = extractDatePreset(message) ?? routed?.datePreset ?? null;
      const beatName: string | null = routed?.beatName ?? null;
      const retailerName: string | null = routed?.retailerName ?? null;

      let llmMessages = messages;

      if (intent) {
        try {
          const dataBlock = await dataAnswer(intent, supabase, userId, today, message, {
            beatName,
            retailerName,
            datePreset,
            scope,
          });
          diagLog(`intent=${intent} dataBlockChars=${dataBlock.length}`);
          const grounding: ChatMessage = {
            role: "system",
            content:
              `The following is authoritative live data from the signed-in user's workspace, retrieved just now via RLS-scoped SQL for intent "${intent}". ` +
              `Use ONLY these facts to answer the user's question — do not invent numbers, names, dates, or totals. ` +
              `Answer diplomatically and conversationally in the same language the user used. You may reformat, summarise, or add brief insight, but every figure must come from this block.\n\n` +
              `---\n${dataBlock}\n---`,
          };
          llmMessages = [
            messages[0],
            grounding,
            ...messages.slice(1),
          ];
        } catch (dataError) {
          console.error(`[copilot-agent] ${intent} query failed:`, dataError);
          const note: ChatMessage = {
            role: "system",
            content:
              `Live workspace data for intent "${intent}" could not be retrieved this turn. ` +
              `Apologise briefly, tell the user the live data is temporarily unavailable, and offer to retry — do not fabricate figures.`,
          };
          llmMessages = [messages[0], note, ...messages.slice(1)];
        }
      } else {
        diagLog("intent=none");
      }
      diagLog(`opening stream promptMessages=${llmMessages.length}`);
      stream = await streamChat({
        apiKey,
        messages: llmMessages,
        signal: req.signal,
        reqId,
      });
    } catch (err) {

      if (err instanceof TogetherError) {
        console.error("[copilot-agent] together error:", err.status, err.message);
        const httpStatus = err.status === 429 ? 429 : err.status >= 500 ? 502 : 500;
        return jsonError(httpStatus, err.code, "AI provider request failed");
      }
      throw err;
    }

    // The assistant row is created as soon as the first token arrives and is
    // then updated in place. If the isolate is torn down mid-stream, whatever
    // the user already saw survives instead of the turn vanishing entirely.
    let assistantRowId: string | null = null;
    let persistedLength = 0;

    const persistAssistant = async (text: string, final: boolean) => {
      const content = final ? text.trim() : text;
      if (!content && !final) return;

      if (!assistantRowId) {
        const { data, error } = await supabase
          .from("copilot_messages")
          .insert({
            conversation_id: conversationId,
            user_id: userId,
            role: "assistant",
            content,
            model: MODEL,
          })
          .select("id")
          .maybeSingle();
        if (error || !data) {
          console.error("[copilot-agent] assistant message persistence failed:", error);
          return;
        }
        assistantRowId = (data as any).id as string;
        persistedLength = content.length;
      } else if (content.length !== persistedLength || final) {
        const { error } = await supabase
          .from("copilot_messages")
          .update({ content })
          .eq("id", assistantRowId);
        if (error) {
          console.error("[copilot-agent] assistant message update failed:", error);
          return;
        }
        persistedLength = content.length;
      }

      if (!final) return;
      const nowIso = new Date().toISOString();
      const updates: Record<string, unknown> = { last_message_at: nowIso, updated_at: nowIso };
      // Auto-title first exchange
      if (!conv.title || conv.title === "New chat") {
        updates.title = message.slice(0, 60);
      }
      await supabase.from("copilot_conversations").update(updates).eq("id", conversationId);
    };

    // Wrap token stream as SSE text events.
    const encoder = new TextEncoder();
    const HEARTBEAT_MS = 10_000;

    const sse = new ReadableStream({
      async start(controller) {
        const reader = stream.tokens.getReader();
        let closed = false;
        let accumulated = "";
        let forwarded = 0;
        let lastPersistAt = 0;
        let terminalSent = false;

        const send = (payload: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(payload));
          } catch {
            closed = true;
          }
        };

        // Comment frames keep intermediaries from treating an idle-but-alive
        // connection as dead, and let the client tell "thinking" from "gone".
        const heartbeat = setInterval(() => send(`: keep-alive\n\n`), HEARTBEAT_MS);

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (forwarded === 0) diagLog("first delta forwarded");
            accumulated += value;
            forwarded += 1;
            send(`data: ${JSON.stringify({ delta: value })}\n\n`);

            const now = Date.now();
            if (now - lastPersistAt > 750 || accumulated.length - persistedLength > 200) {
              lastPersistAt = now;
              await persistAssistant(accumulated, false);
            }
          }

          const completedText = await stream.fullText;
          diagLog("stream drained", {
            forwarded,
            chars: completedText.length,
            upstream: stream.diag,
          });
          await persistAssistant(completedText, true);
          terminalSent = true;
          send(`data: [DONE]\n\n`);
        } catch (err) {
          const code = err instanceof TogetherError ? err.code : "stream_failed";
          console.error(`[copilot-agent][${reqId}] stream error (${code}):`, err);
          // Keep the partial answer rather than discarding the turn.
          if (accumulated.trim()) {
            try { await persistAssistant(accumulated, true); } catch { /* best effort */ }
          }
          terminalSent = true;
          send(`data: ${JSON.stringify({ error: code, partial: accumulated.length > 0 })}\n\n`);
        } finally {
          clearInterval(heartbeat);
          // No path may close silently: the client treats a missing terminal
          // frame as an interrupted stream.
          if (!terminalSent) send(`data: ${JSON.stringify({ error: "stream_failed" })}\n\n`);
          diagLog("closing sse", { forwarded, upstream: stream.diag });
          closed = true;
          try { controller.close(); } catch { /* already closed */ }
        }
      },
      cancel() {
        diagLog("client cancelled sse");
      },
    });

    return new Response(sse, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error("[copilot-agent] fatal:", err);
    return jsonError(500, "internal_error", err instanceof Error ? err.message : "Unknown error");
  }
});

