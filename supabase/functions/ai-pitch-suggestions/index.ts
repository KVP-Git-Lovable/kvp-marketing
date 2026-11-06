// QuickApp AI — per-retailer pitch suggestions for the Order Entry page.
//
// Every candidate product, quantity and unit is computed DETERMINISTICALLY
// from SQL data under the caller's RLS-scoped client, grouped into four
// fixed categories. Lovable AI Gateway (gpt-5-nano) is used ONLY to write a
// short personalised reason for each already-chosen candidate plus an
// overall coaching summary — it never selects, adds, or removes a
// candidate, and it can never invent a product, quantity or id. If the
// provider is unavailable, each item's reason falls back to its computed
// signal text; the categories and their contents never disappear.
// Read-only: no tables are modified.
//
// Categories (fixed caps):
// - Retailer Favourites (max 2): this retailer's own confirmed orders in the
//   last RETAILER_FAV_WINDOW_DAYS days — every confirmed order counts,
//   whether or not it is linked to a visit. Ranked by order frequency, then
//   total quantity, then most recent purchase, then total sales value; qty =
//   mode line (median fallback). A retailer with zero confirmed orders ever
//   shows no Retailer Favourites (no starter-pick fallback).
// - Beat Favourite (max 2): gated on the target retailer having at least
//   one productive visit in the last BEAT_WINDOW_DAYS (90) days — no visit
//   in that window means no Beat Favourite at all, with no fallback. When
//   eligible: ALL confirmed orders from peer retailers on the same beat in
//   the last 90 days (any rep, order_date primary / created_at fallback),
//   falling back to the territory, then the whole company, when the beat
//   (or territory) has fewer than PEER_MIN_ORDERING_STORES ordering peers.
//   A product qualifies only when >= 50% of the ordering peers at the
//   chosen tier bought it. Ranked by distinct-store penetration, then total
//   quantity, then most recent purchase; qty = mode line (median fallback);
//   excludes this retailer's own confirmed orders in the last 90 days
//   (visit_id never required).
// - Top Seller (max 2): the top 2 active, non-focus product variants
//   company-wide in the last 30 days (all confirmed orders, any rep, any
//   beat — computed by the SECURITY DEFINER RPC
//   get_company_top_sellers_with_share, which excludes focus products itself
//   before capping to 2, and also returns the distinct-retailer count per
//   product plus the total active-retailer count, used for the % social
//   proof shown in the UI). Ranked by distinct-order frequency, then total
//   quantity, then total sales value; qty = mode line (median fallback);
//   NOT excluded when this retailer already buys it.
// - Schemes & Offers (max 1, new): the single highest-specificity active
//   scheme for this retailer (retailer > beat > territory/distributor >
//   salesperson > global) that resolves to a concrete active product NOT
//   already suggested by the other three categories and preferably never
//   (or only rarely) purchased by this retailer — ported from the same
//   applicability-matching logic already used by
//   TableOrderForm.tsx and copilot-agent's schemesAnswer().
import { createClient } from "npm:@supabase/supabase-js@2";
import { TogetherError, type ChatMessage } from "../_shared/together/togetherClient.ts";
import { selectBeatPeerSource } from "./beatSource.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const CONFIRMED = "confirmed";
const DAY_MS = 86_400_000;
const PRODUCTIVE_VISITS_WINDOW = 10;
// Dual purpose: (1) the peer-order window for Beat Favourite, and (2) the
// target retailer's own productive-visit eligibility window (section 6 of
// the Beat Favourite spec) — both are the same 90 calendar days.
const BEAT_WINDOW_DAYS = 90;
// A product qualifies as a Beat Favourite only when at least this share of
// the ordering peers at the chosen tier (beat, then territory, then company
// — peers with a confirmed order in the window) bought it. Pure 50% — no
// absolute minimum-buyer floor.
const BEAT_MIN_SHARE = 0.5;
// Beat (or territory, or company) fallback needs at least this many
// ordering peers to be a reliable source; below it, the next tier is tried.
const PEER_MIN_ORDERING_STORES = 3;
const TOP_SELLER_WINDOW_DAYS = 30;
const RETAILER_FAV_WINDOW_DAYS = 90;
// Matches the ai-workflow-run agents' definition of a newly added retailer.
const NEW_RETAILER_DAYS = 14;
// A beat itself created within this many days gets a "New Beat" UI badge —
// informational only, does not gate any Beat Favourite logic.
const NEW_BEAT_DAYS = 30;
// A SKU needs at least this many distinct order dates before a reorder gap
// or "reorder due" is inferred.
const MIN_PATTERN_DATES = 3;
// Priority grades ("A", "Category B") are not store types — no starter picks.
const GRADE_ONLY_CATEGORY = /^(category\s*)?[abc]$/i;

const CATEGORY_CAP = {
  retailer_favourite: 2,
  beat_favourite: 2,
  top_seller: 2,
  scheme: 2,
} as const;

type CategoryKey = keyof typeof CATEGORY_CAP;

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  retailer_favourite: "Retailer Favourites",
  beat_favourite: "Beat Favourite",
  top_seller: "Top Seller",
  scheme: "Schemes & Offers",
};

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function num(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Optional UI badge: starter pick, territory/company fallback, or new launch. */
type ItemTag = "starter" | "territory" | "company" | "new_launch";

interface CategoryItem {
  productId: string;
  variantId: string | null;
  name: string;
  qty: number;
  unit: string;
  category: CategoryKey;
  reason: string;
  tag?: ItemTag;
  /** Short deterministic evidence from database aggregates; absent when unverified. */
  evidence?: string;
  /** Full computed signal shown behind the info icon. */
  details?: string;
  /** % of peer/company retailers who bought this, 0-100. Only set for beat_favourite and top_seller, where a real denominator exists; never fabricated. */
  sharePct?: number;
  /** Raw numerator/denominator behind sharePct (e.g. 9 of 10), for the "N of M" phrasing alongside the %. */
  shareCount?: number;
  shareTotal?: number;
}

/** A deterministic candidate the AI may only narrate, never select. */
interface Candidate {
  productId: string;
  variantId: string | null;
  name: string;
  qty: number;
  unit: string;
  category: CategoryKey;
  signal: string;
  tag?: ItemTag;
  evidence?: string;
  sharePct?: number;
  shareCount?: number;
  shareTotal?: number;
}

const shortDate = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(t.getTime()) ? "" : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

interface MasterProduct { id: string; variantId: string | null; name: string; unit: string; rate: number }

/** Exact-item identity: parent product and variant are never merged. */
function itemKey(productId: unknown, variantId: unknown, name: string): string {
  if (productId) return `${String(productId)}:${variantId ? String(variantId) : "base"}`;
  return `name:${name.toLowerCase()}`;
}

/**
 * Realistic order line from history: the MEDIAN line quantity in the
 * product's most frequently used unit. Averaging across mixed units
 * produces absurd suggested quantities; the per-unit median mirrors what is
 * actually ordered.
 */
function typicalLine(unitLines: Record<string, number[]>): { qty: number; unit: string } {
  let unit = "";
  let best: number[] = [];
  for (const [u, arr] of Object.entries(unitLines)) {
    if (arr.length > best.length) {
      best = arr;
      unit = u;
    }
  }
  if (!best.length) return { qty: 1, unit };
  const sorted = [...best].sort((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)];
  return { qty: Math.max(1, Math.round(median)), unit };
}

/** This retailer's own last 10 productive visits → confirmed orders → line items. */
async function fetchRetailerHistory(supabase: SupabaseClient, retailerId: string, now: Date) {
  interface RetAgg { id: string | null; variantId: string | null; name: string; lines: number; lastDate: string; unitLines: Record<string, number[]> }
  const products = new Map<string, RetAgg>();

  const { data: visits } = await supabase
    .from("visits")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("status", "productive")
    .order("planned_date", { ascending: false })
    .limit(PRODUCTIVE_VISITS_WINDOW);
  const visitIds = (visits ?? []).map((v: any) => String(v.id));
  if (!visitIds.length) return { products, visitCount: 0 };

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_date")
    .eq("retailer_id", retailerId)
    .eq("status", CONFIRMED)
    .in("visit_id", visitIds)
    .limit(50);
  const orderDate = new Map<string, string>();
  (orders ?? []).forEach((o: any) => orderDate.set(String(o.id), String(o.order_date ?? "")));
  const orderIds = [...orderDate.keys()];
  if (!orderIds.length) return { products, visitCount: visitIds.length };

  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, product_id, variant_id, product_name, quantity, unit")
    .in("order_id", orderIds)
    .limit(2000);
  (items ?? []).forEach((it: any) => {
    const name = String(it.product_name ?? "").trim();
    if (!name) return;
    const key = itemKey(it.product_id, it.variant_id, name);
    const date = orderDate.get(String(it.order_id)) ?? "";
    const agg = products.get(key) ?? { id: null, variantId: it.variant_id ? String(it.variant_id) : null, name, lines: 0, lastDate: "", unitLines: {} };
    if (!agg.id && it.product_id) agg.id = String(it.product_id);
    agg.lines += 1;
    if (date > agg.lastDate) agg.lastDate = date;
    const u = String(it.unit ?? "").trim();
    (agg.unitLines[u] ??= []).push(num(it.quantity));
    products.set(key, agg);
  });
  return { products, visitCount: visitIds.length };
}

/**
 * Retailer Favourites source: this retailer's own confirmed orders in the
 * last RETAILER_FAV_WINDOW_DAYS days. Every confirmed order counts — whether
 * or not it has a linked visit; visit_id is never required or filtered on.
 * Aggregated per product with the distinct order dates (for frequency,
 * recency and reorder gap) and the line quantities per unit (for Mode/Median
 * quantity).
 */
async function fetchRetailerFavourites(supabase: SupabaseClient, retailerId: string, now: Date) {
  interface FavAgg { id: string | null; variantId: string | null; name: string; orderIds: Set<string>; dates: Set<string>; lastDate: string; qty: number; value: number; unitLines: Record<string, number[]> }
  const products = new Map<string, FavAgg>();
  const since = new Date(now.getTime() - RETAILER_FAV_WINDOW_DAYS * DAY_MS).toISOString();

  const orderDate = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_date, created_at")
      .eq("retailer_id", retailerId)
      .eq("status", CONFIRMED)
      .gte("created_at", since)
      .range(from, from + 999);
    (data ?? []).forEach((o: any) =>
      orderDate.set(String(o.id), String(o.order_date ?? o.created_at ?? "").slice(0, 10)),
    );
    if (!data || data.length < 1000) break;
  }
  const orderIds = [...orderDate.keys()];
  if (!orderIds.length) return products;
  for (let i = 0; i < orderIds.length; i += 200) {
    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, product_id, variant_id, product_name, quantity, unit, total, rate")
      .in("order_id", orderIds.slice(i, i + 200))
      .limit(5000);
    (items ?? []).forEach((it: any) => {
      const name = String(it.product_name ?? "").trim();
      if (!name) return;
      const key = itemKey(it.product_id, it.variant_id, name);
      const oid = String(it.order_id);
      const date = orderDate.get(oid) ?? "";
      const agg = products.get(key) ?? { id: null, variantId: it.variant_id ? String(it.variant_id) : null, name, orderIds: new Set(), dates: new Set(), lastDate: "", qty: 0, value: 0, unitLines: {} };
      if (!agg.id && it.product_id) agg.id = String(it.product_id);
      agg.orderIds.add(oid);
      if (date) agg.dates.add(date);
      if (date > agg.lastDate) agg.lastDate = date;
      agg.qty += num(it.quantity);
      agg.value += num(it.total) || num(it.quantity) * num(it.rate);
      const u = String(it.unit ?? "").trim();
      (agg.unitLines[u] ??= []).push(num(it.quantity));
      products.set(key, agg);
    });
  }
  return products;
}

const AFFINITY_STOP = new Set(["store", "stores", "shop", "the", "and", "general", "mart", "kirana", "traders", "enterprises"]);
function tokens(s: string): string[] {
  return String(s ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !AFFINITY_STOP.has(t));
}

function medianOf(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * The top 2 active, non-focus product variants across the ENTIRE company in
 * the last TOP_SELLER_WINDOW_DAYS days — all confirmed orders, any rep, any
 * beat. Computed by the SECURITY DEFINER RPC get_company_top_sellers_with_share,
 * which returns only aggregated product-variant totals plus two plain counts
 * (distinct ordering retailers, total active retailers company-wide) — no
 * order/retailer/rep identity rows — so a rep's RLS-scoped login can safely
 * call it. The RPC excludes focus products itself (inside the CTE, before
 * its own LIMIT 2) so a focus product never silently consumes one of the two
 * slots. Ranked by distinct order count, then total quantity, then total
 * sales value; already pre-limited to the top 2.
 */
async function fetchCompanyTopSellers(supabase: SupabaseClient) {
  interface ProdAgg { id: string | null; variantId: string | null; name: string; value: number; qty: number; orders: number; retailerCount: number; unitLines: Record<string, number[]> }
  const products = new Map<string, ProdAgg>();
  let totalActiveRetailers = 0;

  const { data, error } = await supabase.rpc("get_company_top_sellers_with_share", { p_days: TOP_SELLER_WINDOW_DAYS });
  if (error) {
    console.warn("[pitch] get_company_top_sellers_with_share failed:", error.message);
    return { products, totalActiveRetailers };
  }
  (data ?? []).forEach((row: any) => {
    const name = String(row.product_name ?? "").trim();
    if (!name) return;
    const unitLines: Record<string, number[]> = {};
    const raw = row.unit_lines ?? {};
    for (const [u, arr] of Object.entries(raw)) {
      unitLines[u] = (Array.isArray(arr) ? arr : []).map(num);
    }
    totalActiveRetailers = num(row.total_active_retailers);
    products.set(itemKey(row.product_id, row.variant_id, name), {
      id: row.product_id ? String(row.product_id) : null,
      variantId: row.variant_id ? String(row.variant_id) : null,
      name,
      value: num(row.total_value),
      qty: num(row.total_qty),
      orders: num(row.order_count),
      retailerCount: num(row.retailer_count),
      unitLines,
    });
  });
  return { products, totalActiveRetailers };
}

/**
 * Most frequent line quantity in the product's most-used unit. Falls back to
 * the median (typicalLine) when no single quantity repeats more than others.
 */
function modeLine(unitLines: Record<string, number[]>): { qty: number; unit: string } {
  let unit = "";
  let best: number[] = [];
  for (const [u, arr] of Object.entries(unitLines)) {
    if (arr.length > best.length) { best = arr; unit = u; }
  }
  if (!best.length) return { qty: 1, unit };
  const counts = new Map<number, number>();
  best.forEach((q) => counts.set(q, (counts.get(q) ?? 0) + 1));
  let top = 0, topQty = 0, tie = false;
  for (const [q, c] of counts) {
    if (c > top) { top = c; topQty = q; tie = false; } else if (c === top) tie = true;
  }
  if (top < 2 || tie) return typicalLine({ [unit]: best });
  return { qty: Math.max(1, Math.round(topQty)), unit };
}

/**
 * Every confirmed order from peer retailers on the same beat (matched by
 * retailers.beat_id) in the last BEAT_WINDOW_DAYS days, any rep (RLS
 * applies). Aggregated per product with distinct ordering stores.
 */
function fetchBeatFavourites(supabase: SupabaseClient, retailerId: string, retailerBeatId: string) {
  return fetchPeerFavourites(supabase, retailerId, { column: "beat_id", value: retailerBeatId });
}

/**
 * Whether the target retailer has at least one productive visit within the
 * last BEAT_WINDOW_DAYS calendar days (visits.status = 'productive', by
 * visits.planned_date). This is a retailer-wide eligibility gate for Beat
 * Favourite only: it does not require any order — this retailer's or a
 * peer's — to be linked to a visit.
 */
async function retailerHasProductiveVisit(supabase: SupabaseClient, retailerId: string, now: Date): Promise<boolean> {
  const sinceStr = isoDate(new Date(now.getTime() - BEAT_WINDOW_DAYS * DAY_MS));
  const { data } = await supabase
    .from("visits")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("status", "productive")
    .gte("planned_date", sinceStr)
    .limit(1);
  return !!(data && data.length);
}

/**
 * Same aggregation for peers sharing a beat_id or territory_id, or — when
 * scope is null — every other retailer in the company. order_date is the
 * primary date (created_at is only a fallback for a null order_date); the
 * SQL filter below is a safe created_at-based superset, with the exact
 * 90-day cutoff and recency ranking applied against the effective date in
 * JS so a row is never wrongly included or excluded by a day's drift
 * between order_date and created_at.
 */
async function fetchPeerFavourites(
  supabase: SupabaseClient,
  retailerId: string,
  scope: { column: "beat_id" | "territory_id"; value: string } | null,
) {
  interface BeatAgg { id: string | null; variantId: string | null; name: string; value: number; qty: number; stores: Set<string>; lastAt: number; unitLines: Record<string, number[]> }
  const products = new Map<string, BeatAgg>();
  const result = { products, orderingStores: 0 };
  if (scope && !scope.value) return result;

  let peerQuery = supabase.from("retailers").select("id").neq("id", retailerId);
  if (scope) peerQuery = peerQuery.eq(scope.column, scope.value);
  const { data: peers } = await peerQuery.limit(5000);
  const peerIds = (peers ?? []).map((r: any) => String(r.id));
  if (!peerIds.length) return result;

  const sinceStr = isoDate(new Date(Date.now() - BEAT_WINDOW_DAYS * DAY_MS));
  const sqlSince = new Date(Date.now() - (BEAT_WINDOW_DAYS + 2) * DAY_MS).toISOString();
  const orderRetailer = new Map<string, string>();
  const orderEffAt = new Map<string, number>();
  for (let i = 0; i < peerIds.length; i += 200) {
    const chunk = peerIds.slice(i, i + 200);
    for (let from = 0; ; from += 1000) {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, retailer_id, order_date, created_at")
        .in("retailer_id", chunk)
        .eq("status", CONFIRMED)
        .gte("created_at", sqlSince)
        .order("created_at", { ascending: false })
        .range(from, from + 999);
      (orders ?? []).forEach((o: any) => {
        const eff = String(o.order_date ?? o.created_at ?? "").slice(0, 10);
        if (!eff || eff < sinceStr) return;
        orderRetailer.set(String(o.id), String(o.retailer_id ?? ""));
        orderEffAt.set(String(o.id), Date.parse(`${eff}T00:00:00Z`) || 0);
      });
      if (!orders || orders.length < 1000) break;
    }
  }
  const orderIds = [...orderRetailer.keys()];
  if (!orderIds.length) return result;
  result.orderingStores = new Set([...orderRetailer.values()].filter(Boolean)).size;

  for (let i = 0; i < orderIds.length; i += 200) {
    const chunk = orderIds.slice(i, i + 200);
    for (let from = 0; ; from += 1000) {
      const { data: items } = await supabase
        .from("order_items")
        .select("order_id, product_id, variant_id, product_name, quantity, total, unit")
        .in("order_id", chunk)
        .range(from, from + 999);
      (items ?? []).forEach((it: any) => {
        const name = String(it.product_name ?? "").trim();
        if (!name) return;
        const key = itemKey(it.product_id, it.variant_id, name);
        const agg = products.get(key) ?? { id: null, variantId: it.variant_id ? String(it.variant_id) : null, name, value: 0, qty: 0, stores: new Set<string>(), lastAt: 0, unitLines: {} };
        if (!agg.id && it.product_id) agg.id = String(it.product_id);
        agg.value += num(it.total);
        agg.qty += num(it.quantity);
        const at = orderEffAt.get(String(it.order_id)) ?? 0;
        if (at > agg.lastAt) agg.lastAt = at;
        const rid = orderRetailer.get(String(it.order_id));
        if (rid) agg.stores.add(rid);
        const u = String(it.unit ?? "").trim();
        (agg.unitLines[u] ??= []).push(num(it.quantity));
        products.set(key, agg);
      });
      if (!items || items.length < 1000) break;
    }
  }
  return result;
}

/**
 * The single highest-specificity active scheme for this retailer, resolved
 * to a concrete active product. Matching logic (retailer > beat >
 * territory/distributor > salesperson > global) is a direct port of
 * copilot-agent/index.ts's schemesAnswer() and TableOrderForm.tsx's
 * specificityRank — not reinvented. beat_id is resolved to the beats.id
 * uuid first (scheme_applicability.entity_id is a uuid; retailers.beat_id
 * is the text business key), the same distinction copilot-agent already
 * accounts for.
 */
async function fetchBestScheme(
  supabase: SupabaseClient,
  retailer: { id: string; beat_id: string | null; territory_id: string | null; distributor_id: string | null },
  today: string,
  resolve: (id: string | null, variantId: string | null, name: string) => MasterProduct | undefined,
  boughtKeys: Set<string>,
  boughtLines: Map<string, number>,
  excludedKeys: Set<string>,
  focusProducts: MasterProduct[] = [],
  limit = 2,
): Promise<Array<{ scheme: any | null; product: MasterProduct }>> {
  const { data: schemes } = await supabase
    .from("product_schemes")
    .select(
      "id, name, scheme_type, is_active, start_date, end_date, discount_percentage, discount_amount, " +
        "buy_quantity, buy_quantity_unit, condition_quantity, free_quantity, free_quantity_unit, min_order_value, product_id, variant_id, target_product_ids, applicability_type",
    )
    .limit(500);
  const active = (schemes ?? []).filter((s: any) => {
    if (s.is_active === false) return false;
    if (s.start_date && s.start_date > today) return false;
    if (s.end_date && s.end_date < today) return false;
    return true;
  });
  // No live schemes: focus (new-launch) products still surface on their own.
  if (!active.length) {
    const solo: Array<{ scheme: any | null; product: MasterProduct }> = [];
    for (const product of focusProducts) {
      if (solo.length >= limit) break;
      const key = itemKey(product.id, product.variantId, product.name);
      if (excludedKeys.has(key)) continue;
      if (boughtKeys.has(key) && (boughtLines.get(key) ?? 0) > 1) continue;
      solo.push({ scheme: null, product });
    }
    return solo;
  }

  let beatUuid: string | null = null;
  if (retailer.beat_id) {
    const { data: beatRow } = await supabase.from("beats").select("id").eq("beat_id", retailer.beat_id).maybeSingle();
    beatUuid = (beatRow as any)?.id ?? null;
  }

  const { data: applicRows } = await supabase
    .from("scheme_applicability")
    .select("scheme_id, applicability_level, entity_id")
    .in("scheme_id", active.map((s: any) => s.id));

  const RANK: Record<string, number> = { retailer: 4, beat: 3, territory: 2, distributor: 1, salesperson: 1 };
  const specificity = (schemeId: string): number => {
    let best = 0;
    for (const row of applicRows ?? []) {
      if (row.scheme_id !== schemeId) continue;
      const matches =
        (row.applicability_level === "retailer" && row.entity_id === retailer.id) ||
        (row.applicability_level === "beat" && !!beatUuid && row.entity_id === beatUuid) ||
        (row.applicability_level === "territory" && row.entity_id === retailer.territory_id) ||
        (row.applicability_level === "distributor" && row.entity_id === retailer.distributor_id) ||
        row.applicability_level === "salesperson";
      if (matches) best = Math.max(best, RANK[row.applicability_level] ?? 0);
    }
    return best;
  };

  const ranked = active
    .map((s: any) => ({ scheme: s, rank: s.applicability_type === "global" ? 0 : specificity(s.id) }))
    .filter((r: any) => r.scheme.applicability_type === "global" || r.rank > 0)
    .sort((a: any, b: any) => b.rank - a.rank || num(b.scheme.discount_percentage) - num(a.scheme.discount_percentage));

  // Only a scheme that names a concrete, still-active product can become a
  // pitch-able item — an order-wide/global scheme with no product, or one
  // whose product has since been discontinued, is skipped in favour of the
  // next-ranked scheme rather than fabricating a product.
  // Schemes & Offers surfaces NEW opportunities: never duplicate a product
  // already suggested by the other three categories, and prefer products
  // the retailer has never bought. Pass 1 = never purchased; pass 2 =
  // rarely purchased (a single order line in history) so the category can
  // still surface a scheme when the retailer already buys everything else
  // with an offer.
  const picked: Array<{ scheme: any | null; product: MasterProduct }> = [];
  const pickedKeys = new Set<string>();

  // Focus (new-launch) pre-pass: focus products lead Schemes & Offers, with
  // their best eligible scheme when one exists and without one when it
  // doesn't. Same duplicate/bought rules as scheme items.
  for (const allowRare of [false, true]) {
    for (const product of focusProducts) {
      if (picked.length >= limit) return picked;
      const key = itemKey(product.id, product.variantId, product.name);
      if (excludedKeys.has(key) || pickedKeys.has(key)) continue;
      if (boughtKeys.has(key) && !(allowRare && (boughtLines.get(key) ?? 0) <= 1)) continue;
      const match = ranked.find(({ scheme }: any) => {
        const cid = scheme.product_id ?? (scheme.target_product_ids ?? [])[0];
        if (!cid) return false;
        const sp = resolve(String(cid), scheme.variant_id && scheme.product_id ? String(scheme.variant_id) : null, "");
        return !!sp && itemKey(sp.id, sp.variantId, sp.name) === key;
      });
      pickedKeys.add(key);
      picked.push({ scheme: match?.scheme ?? null, product });
    }
  }

  for (const allowRare of [false, true]) {
    for (const { scheme } of ranked) {
      if (picked.length >= limit) return picked;
      const candidateId = scheme.product_id ?? (scheme.target_product_ids ?? [])[0];
      const product = candidateId
        ? resolve(String(candidateId), scheme.variant_id && scheme.product_id ? String(scheme.variant_id) : null, "")
        : undefined;
      if (!product) continue;
      const key = itemKey(product.id, product.variantId, product.name);
      if (excludedKeys.has(key)) continue;
      if (pickedKeys.has(key)) continue;
      if (boughtKeys.has(key) && !(allowRare && (boughtLines.get(key) ?? 0) <= 1)) continue;
      pickedKeys.add(key);
      picked.push({ scheme, product });
    }
  }
  return picked;
}

/** Quantity the scheme requires to qualify (falls back to 1 base unit). */
function schemeRequiredQty(s: any, product: MasterProduct): { qty: number; unit: string } {
  const q = num(s.condition_quantity) || num(s.buy_quantity);
  const unit = (s.buy_quantity_unit as string) || product.unit;
  return { qty: q > 0 ? q : 1, unit };
}

function describeScheme(s: any): string {
  const terms: string[] = [];
  if (s.discount_percentage) terms.push(`${s.discount_percentage}% off`);
  if (s.discount_amount) terms.push(`₹${s.discount_amount} off`);
  if (s.buy_quantity && s.free_quantity) terms.push(`buy ${s.buy_quantity}${s.buy_quantity_unit ? ` ${s.buy_quantity_unit}` : ""} get ${s.free_quantity}${s.free_quantity_unit ? ` ${s.free_quantity_unit}` : ""} free`);
  if (s.min_order_value) terms.push(`min order ₹${s.min_order_value}`);
  return `${s.name}${terms.length ? ` — ${terms.join(", ")}` : ""}${s.end_date ? `, valid until ${s.end_date}` : ""}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "method_not_allowed", "Use POST");

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonError(401, "unauthorized", "Missing bearer token");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    const userId = (claims as any)?.claims?.sub as string | undefined;
    if (claimsError || !userId) return jsonError(401, "unauthorized", "Invalid session");

    const body = await req.json().catch(() => ({}));
    const retailerId = String((body as any)?.retailerId ?? "");
    if (!retailerId) return jsonError(400, "missing_retailer", "retailerId is required");

    const { data: retailer } = await supabase
      .from("retailers")
      .select("id, name, category, beat_id, beat_name, territory_id, distributor_id, created_at")
      .eq("id", retailerId)
      .maybeSingle();
    if (!retailer) return jsonError(404, "retailer_not_found", "Retailer not found");
    const retailerName = String((retailer as any).name ?? "Retailer");
    const retailerCategory = String((retailer as any).category ?? "");
    const retailerBeatId = String((retailer as any).beat_id ?? "").trim();
    const retailerBeatName = String((retailer as any).beat_name ?? "").trim();
    const retailerCreatedAt = String((retailer as any).created_at ?? "");

    const now = new Date();
    const today = isoDate(now);
    const daysSinceCreated = retailerCreatedAt
      ? Math.max(0, Math.round((now.getTime() - new Date(retailerCreatedAt).getTime()) / DAY_MS))
      : null;
    const isNewRetailer = daysSinceCreated != null && daysSinceCreated <= NEW_RETAILER_DAYS;

    // New-beat flag: the retailer's beat was itself created recently.
    // Informational UI badge only — never gates Beat Favourite eligibility.
    const { data: beatRow } = retailerBeatId
      ? await supabase.from("beats").select("created_at").eq("beat_id", retailerBeatId).maybeSingle()
      : { data: null };
    const beatCreatedAt = String((beatRow as any)?.created_at ?? "");
    const daysSinceBeatCreated = beatCreatedAt
      ? Math.max(0, Math.round((now.getTime() - new Date(beatCreatedAt).getTime()) / DAY_MS))
      : null;
    const isNewBeat = daysSinceBeatCreated != null && daysSinceBeatCreated <= NEW_BEAT_DAYS;

    // ---- Products master for active-only resolution ----
    const [{ data: master }, { data: cats }] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, rate, base_unit, category_id, is_focused, is_focused_product")
        .or("is_active.eq.true,is_active.is.null")
        .limit(1000),
      supabase.from("product_categories").select("id, name").limit(1000),
    ]);
    const variantRows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from("product_variants")
        .select("id, product_id, variant_name, price, is_active, is_focused_product")
        .or("is_active.eq.true,is_active.is.null")
        .range(from, from + 999);
      variantRows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const catName = new Map<string, string>();
    (cats ?? []).forEach((c: any) => catName.set(String(c.id), String(c.name ?? "")));
    const categoryNameById = new Map<string, string>();
    const masterByName = new Map<string, MasterProduct>();
    const masterById = new Map<string, MasterProduct>();
    const focusProductIds = new Set<string>();
    (master ?? []).forEach((p: any) => {
      const name = String(p.name ?? "").trim();
      if (!name) return;
      const entry: MasterProduct = { id: String(p.id), variantId: null, name, unit: String(p.base_unit ?? ""), rate: num(p.rate) };
      masterByName.set(name.toLowerCase(), entry);
      masterById.set(entry.id, entry);
      if (p.category_id) categoryNameById.set(entry.id, catName.get(String(p.category_id)) ?? "");
      // Focus product = verified new launch. Either flag marks it.
      // Only the Product Management "Mark as Focused Product" flag counts as a launch focus item.
      if (p.is_focused_product === true) focusProductIds.add(entry.id);
    });
    // Parent units/categories are needed even when the parent itself is inactive.
    const parentUnit = new Map<string, string>();
    const { data: parentRows } = variantRows.length
      ? await supabase.from("products").select("id, base_unit, category_id")
          .in("id", [...new Set(variantRows.map((v: any) => String(v.product_id)))].slice(0, 1000))
      : { data: [] as any[] };
    (parentRows ?? []).forEach((p: any) => {
      parentUnit.set(String(p.id), String(p.base_unit ?? ""));
      if (p.category_id && !categoryNameById.has(String(p.id))) categoryNameById.set(String(p.id), catName.get(String(p.category_id)) ?? "");
    });
    const variantById = new Map<string, MasterProduct>();
    const focusVariantIds = new Set<string>();
    variantRows.forEach((v: any) => {
      const name = String(v.variant_name ?? "").trim();
      if (!name || !v.product_id) return;
      const pid = String(v.product_id);
      variantById.set(String(v.id), {
        id: pid, variantId: String(v.id), name,
        unit: masterById.get(pid)?.unit ?? parentUnit.get(pid) ?? "",
        rate: num(v.price ?? masterById.get(pid)?.rate),
      });
      // A variant is a focus item when flagged itself or its parent is.
      if (v.is_focused_product === true || focusProductIds.has(pid)) focusVariantIds.add(String(v.id));
    });
    // Exact-item focus keys (parent and variant never merged) plus the list
    // of active focus items for the Schemes & Offers pre-pass.
    const focusKeys = new Set<string>();
    const focusProducts: MasterProduct[] = [];
    for (const pid of focusProductIds) {
      const m = masterById.get(pid);
      if (m) { focusKeys.add(itemKey(m.id, null, m.name)); focusProducts.push(m); }
    }
    for (const vid of focusVariantIds) {
      const m = variantById.get(vid);
      if (m) { focusKeys.add(itemKey(m.id, m.variantId, m.name)); focusProducts.push(m); }
    }
    const isFocusItem = (m: MasterProduct) => focusKeys.has(itemKey(m.id, m.variantId, m.name));
    // Exact item only: a variant resolves to that active variant (its own
    // name), a parent to that active parent. Never falls back across the two.
    const resolveActive = (id: string | null, variantId: string | null, name: string): MasterProduct | undefined => {
      if (variantId) {
        const v = variantById.get(variantId);
        return v && (!id || v.id === id) ? v : undefined;
      }
      if (id) return masterById.get(id);
      return masterByName.get(name.toLowerCase());
    };

    // ---- The four category data sources, independent of each other ----
    // Scheme candidate selection happens AFTER the other three categories
    // are assembled (it must exclude their products), so it is not fetched
    // here.
    const [retailerHistory, repHistory, beatProductsMap, retailerFavs, beatEligible] = await Promise.all([
      fetchRetailerHistory(supabase, retailerId, now),
      fetchCompanyTopSellers(supabase),
      fetchBeatFavourites(supabase, retailerId, retailerBeatId),
      fetchRetailerFavourites(supabase, retailerId, now),
      retailerHasProductiveVisit(supabase, retailerId, now),
    ]);
    const retProducts = retailerHistory.products;
    // Beat Favourite exclusion keeps using the wider history, unchanged.
    const boughtKeys = new Set(retProducts.keys());
    // Line counts per bought item, for the scheme "rarely purchased" fallback.
    const boughtLines = new Map<string, number>();
    for (const [key, agg] of retProducts) boughtLines.set(key, (agg as any).lines ?? 0);

    // ---- Candidate assembly, one list per category, caps enforced here ----
    const candidates: Record<CategoryKey, Candidate[]> = {
      retailer_favourite: [],
      beat_favourite: [],
      top_seller: [],
      scheme: [],
    };

    // Retailer Favourites: this retailer's own confirmed orders in the last
    // RETAILER_FAV_WINDOW_DAYS days. Ranked purely by: order frequency, then
    // total quantity, then most recent purchase, then total sales value —
    // the composite timing score, reorder-due boost and category-affinity
    // bonus no longer influence ranking. Never adds unbought products.
    [...retailerFavs.values()]
      .map((p) => {
        const m = resolveActive(p.id, p.variantId, p.name);
        const orders = p.orderIds.size;
        const dates = [...p.dates].sort();
        const daysSince = p.lastDate
          ? Math.max(0, Math.round((now.getTime() - new Date(`${p.lastDate}T00:00:00Z`).getTime()) / DAY_MS))
          : null;
        const gaps: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          gaps.push(Math.round((new Date(`${dates[i]}T00:00:00Z`).getTime() - new Date(`${dates[i - 1]}T00:00:00Z`).getTime()) / DAY_MS));
        }
        // Reorder pattern only with ≥ MIN_PATTERN_DATES distinct order dates.
        // Shown in the explanation only — it no longer affects ranking.
        const usualGap = dates.length >= MIN_PATTERN_DATES && gaps.length ? Math.round(medianOf(gaps)) : null;
        const reorderDue = usualGap != null && daysSince != null && daysSince >= Math.max(usualGap, 1);
        return { p, m, orders, daysSince, usualGap, reorderDue };
      })
      .filter((x) => !!x.m && !isFocusItem(x.m!)) // discontinued or a focus/new-launch item — never suggest it here
      .sort(
        (a, b) =>
          b.orders - a.orders || // 1. purchase frequency
          b.p.qty - a.p.qty || // 2. total quantity
          (a.daysSince ?? Infinity) - (b.daysSince ?? Infinity) || // 3. recency (most recent first)
          b.p.value - a.p.value, // 4. total sales value
      )
      .slice(0, CATEGORY_CAP.retailer_favourite)
      .forEach(({ p, m, orders, daysSince, usualGap, reorderDue }) => {
        const t = modeLine(p.unitLines);
        candidates.retailer_favourite.push({
          productId: m!.id,
          variantId: m!.variantId,
          name: m!.name,
          qty: t.qty,
          unit: t.unit || m!.unit || "",
          category: "retailer_favourite",
          evidence: orders > 0 ? `Bought ${orders} time${orders === 1 ? "" : "s"}${p.lastDate && shortDate(p.lastDate) ? ` · Last: ${shortDate(p.lastDate)}` : ""}` : undefined,
          signal:
            `Bought in ${orders} order${orders === 1 ? "" : "s"} in the last ${RETAILER_FAV_WINDOW_DAYS} days` +
            (daysSince != null ? `, last ordered ${daysSince} days ago` : "") +
            (usualGap != null ? ` — usual gap ${usualGap} days${reorderDue ? ", reorder due" : ""}` : "") +
            ` — usually ${t.qty}${t.unit ? ` ${t.unit}` : ""}`,
        });
      });

    // Zero confirmed orders ever → Retailer Favourites stays empty. No
    // starter-pick fallback, regardless of how new the retailer is.

    // Beat Favourite is gated entirely on beatEligible (the target
    // retailer's own productive-visit check, computed above): no visit in
    // the window means no Beat Favourite at all, and no territory/company
    // fallback — that eligibility check is never bypassed by a fallback tier.
    if (beatEligible) {
      // This retailer's own 90-day confirmed-order set (fetchRetailerFavourites
      // already computes exactly this, visit_id-agnostic) — reused here rather
      // than duplicated; unrelated to `boughtKeys`, which stays on the older
      // visit-linked history for Schemes & Offers only.
      const beatBoughtKeys = new Set(retailerFavs.keys());

      // Source: the retailer's exact beat only. No territory/company/other
      // beat fallback — too little beat data means fewer or no suggestions.
      const peerSource = selectBeatPeerSource(retailerBeatId, beatProductsMap, PEER_MIN_ORDERING_STORES);
      const peerPlace = retailerBeatName || "this beat";
      const peerPrep = "on";
      const peerTag: ItemTag | undefined = undefined;
      const peerStores = peerSource?.orderingStores ?? 0;
      const beatMinStores = Math.ceil(peerStores * BEAT_MIN_SHARE);
      const tierWord = "beat";
      [...(peerSource?.products.values() ?? [])]
        .filter((p) => p.id && !beatBoughtKeys.has(itemKey(p.id, p.variantId, p.name)) && p.stores.size >= beatMinStores)
        .sort((a, b) => b.stores.size - a.stores.size || b.qty - a.qty || b.lastAt - a.lastAt)
        .map((p) => ({ p, m: resolveActive(p.id, p.variantId, p.name) }))
        .filter((x) => !!x.m && !isFocusItem(x.m!))
        .slice(0, CATEGORY_CAP.beat_favourite)
        .forEach(({ p, m }) => {
          const t = modeLine(p.unitLines);
          const sharePct = peerStores > 0 ? Math.round((p.stores.size / peerStores) * 100) : undefined;
          candidates.beat_favourite.push({
            productId: m!.id,
            variantId: m!.variantId,
            name: m!.name,
            qty: t.qty,
            unit: t.unit || m!.unit || "",
            category: "beat_favourite",
            tag: peerTag,
            evidence: p.stores.size > 0 && peerStores > 0 ? `${p.stores.size} of ${peerStores} ${tierWord} retailers buy it` : undefined,
            // Deliberately omits the exact store-count pair (shareCount/shareTotal/sharePct
            // below already carry it, rendered as its own line client-side) so this text —
            // the AI's only grounding, and the no-AI fallback — never restates that fact.
            signal: `Popular with other retailers ${peerPrep} ${peerPlace} in the last ${BEAT_WINDOW_DAYS} days — typical line ${t.qty}${t.unit ? ` ${t.unit}` : ""}`,
            sharePct,
            shareCount: peerStores > 0 ? p.stores.size : undefined,
            shareTotal: peerStores > 0 ? peerStores : undefined,
          });
        });
    }

    // Company-wide top sellers: pre-ranked (order frequency desc, qty desc,
    // value desc) and pre-limited to the top 2 by the RPC, which already
    // excludes focus products before that limit. isFocusItem is kept here
    // too as a defensive second layer, not a relocation of the exclusion.
    // Deliberately NOT excluded when this retailer already buys the product.
    [...repHistory.products.values()]
      .filter((p) => p.id)
      .slice(0, CATEGORY_CAP.top_seller)
      .forEach((p) => {
        const m = resolveActive(p.id, p.variantId, p.name);
        if (!m || isFocusItem(m)) return; // focus/new-launch items only appear under Schemes & Offers
        const t = modeLine(p.unitLines);
        // Clamp the numerator to the denominator so the displayed "N of M" pair
        // can never contradict itself (a retailer could buy while active, then
        // later flip to inactive, which would otherwise push N above M).
        const shareTotal = repHistory.totalActiveRetailers > 0 ? repHistory.totalActiveRetailers : undefined;
        const shareCount = shareTotal != null ? Math.min(p.retailerCount, shareTotal) : undefined;
        const sharePct = shareTotal != null ? Math.round((shareCount! / shareTotal) * 100) : undefined;
        candidates.top_seller.push({
          productId: m.id,
          variantId: m.variantId,
          name: m.name,
          qty: t.qty,
          unit: t.unit || m.unit || "",
          category: "top_seller",
          evidence: p.orders > 0 ? `${p.orders} company orders · Last ${TOP_SELLER_WINDOW_DAYS} days` : undefined,
          signal: `One of the company's top ${CATEGORY_CAP.top_seller} most-ordered products in the last ${TOP_SELLER_WINDOW_DAYS} days — ordered ${p.orders} time${p.orders === 1 ? "" : "s"} across the company — usually ${t.qty}${t.unit ? ` ${t.unit}` : ""} per order`,
          sharePct,
          shareCount,
          shareTotal,
        });
      });

    // Schemes & Offers: resolved last so it can exclude everything the
    // other three categories already suggest, and prefer products this
    // retailer never/rarely buys (new scheme opportunities).
    const excludedKeys = new Set<string>([
      ...candidates.retailer_favourite,
      ...candidates.beat_favourite,
      ...candidates.top_seller,
    ].map((c) => itemKey(c.productId, c.variantId, c.name)));
    const schemePicks = await fetchBestScheme(
      supabase,
      {
        id: retailerId,
        beat_id: retailerBeatId || null,
        territory_id: (retailer as any).territory_id ?? null,
        distributor_id: (retailer as any).distributor_id ?? null,
      },
      today,
      resolveActive,
      boughtKeys,
      boughtLines,
      excludedKeys,
      focusProducts,
    );
    for (const bestScheme of schemePicks) {
      const isNewLaunch = isFocusItem(bestScheme.product);
      // A focus product without an eligible scheme still shows as a New
      // Launch — never invent a scheme or quantity for it.
      const t = bestScheme.scheme
        ? schemeRequiredQty(bestScheme.scheme, bestScheme.product)
        : { qty: 1, unit: bestScheme.product.unit };
      candidates.scheme.push({
        productId: bestScheme.product.id,
        variantId: bestScheme.product.variantId,
        name: bestScheme.product.name,
        qty: t.qty,
        unit: t.unit,
        category: "scheme",
        tag: isNewLaunch ? "new_launch" : undefined,
        evidence: bestScheme.scheme
          ? (isNewLaunch ? "Focus product · Eligible scheme" : describeScheme(bestScheme.scheme).split(" — ")[0])
          : (isNewLaunch ? "Focus product" : undefined),
        signal: bestScheme.scheme
          ? `${describeScheme(bestScheme.scheme)} — order ${t.qty}${t.unit ? ` ${t.unit}` : ""} to qualify${isNewLaunch ? " — NEW LAUNCH focus product" : ""}`
          : "NEW LAUNCH focus product — introduce it to this store; no scheme attached, never invent launch dates or offers",
      });
    }

    const allCandidates: Candidate[] = [
      ...candidates.retailer_favourite,
      ...candidates.beat_favourite,
      ...candidates.top_seller,
      ...candidates.scheme,
    ];

    // ---- Lovable AI writes a reason per already-chosen candidate + summary ----
    // No selection happens here — every candidate above is already final and
    // will appear in the response regardless of AI availability.
    const reasonByIndex = new Map<number, string>();
    let summary = "";
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (apiKey && allCandidates.length) {
      try {
        const profile = [
          `Store: ${retailerName}`,
          retailerCategory ? `Category: ${retailerCategory}` : "",
          retailerBeatName ? `Beat: ${retailerBeatName}` : "",
          isNewRetailer
            ? `NEWLY ADDED retailer (${daysSinceCreated}d old) — frame the pitch as a warm introduction to the range.`
            : `Productive visits analysed: ${retailerHistory.visitCount} (retailer). Top Seller is company-wide (last ${TOP_SELLER_WINDOW_DAYS} days).`,
        ].filter(Boolean).join("\n");
        const candidateList = allCandidates
          .map((c, i) => `${i + 1}. [${CATEGORY_LABEL[c.category]}] ${c.name} — qty ${c.qty}${c.unit ? ` ${c.unit}` : ""} — ${c.signal}`)
          .join("\n");
        const messages: ChatMessage[] = [
          {
            role: "system",
            content:
              "You are QuickApp's Pitch Assistant for field sales reps. The numbered CANDIDATES below have ALREADY been chosen by " +
              "deterministic business rules across four fixed categories — you must NOT add, remove, or reorder any of them. Your only " +
              "job: write one personalised reason for EVERY numbered candidate (all of them, none skipped) as a single detailed paragraph, " +
              "45-60 words, grounded ONLY in that candidate's stated signal and the store profile — never invent products, quantities or " +
              "numbers. Weave the signal's own concrete numbers (order counts, reorder gaps, typical quantity, company rank, etc.) into " +
              "natural prose that explains why it matters for the pitch, rather than lightly paraphrasing the signal almost verbatim. " +
              "Vary sentence structure and opening across different candidates in this same response — never reuse the same templated " +
              "phrasing from one candidate to the next. " +
              "If a signal names a territory, say territory and never call it 'this beat'. " +
              "If a signal says 'across the company', say company-wide and never call it 'this beat' or a territory. " +
              "If a signal starts with 'New store', pitch it as popular with similar stores — never as this store's own purchase history. " +
              "If a signal mentions 'NEW LAUNCH', pitch it as a newly launched focus product worth introducing — never invent launch dates, sales figures or offers for it. " +
              "If a signal mentions scheme/discount terms, describe them qualitatively only — never state a specific ₹ savings figure yourself; " +
              "the exact amount is computed separately from live cart data you don't have, and will be shown next to your text. " +
              "Also write \"summary\": compact markdown pitch coaching for the rep covering the mix across categories (one short headline, " +
              "up to four bullets, then a single line starting with 'Suggested pitch:'), under 120 words, ₹ for currency, friendly and " +
              "practical" + (isNewRetailer ? ", opening with a warm note that this is a newly added retailer" : "") +
              ". Return STRICT JSON only: {\"reasons\":[{\"n\":<candidate number>,\"reason\":\"...\"}],\"summary\":\"...\"} — no markdown fences, no extra keys, one entry per candidate number.",
          },
          {
            role: "user",
            content: `STORE PROFILE\n---\n${profile}\n---\nCANDIDATES\n---\n${candidateList}\n---\nWrite a reason for each candidate above.`,
          },
        ];
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          signal: AbortSignal.any([req.signal, AbortSignal.timeout(12000)]),
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-5-nano",
            messages,
            response_format: { type: "json_object" },
          }),
        });
        let text = "";
        if (resp.status === 429) {
          console.error("[ai-pitch-suggestions] Lovable AI rate limited (429); falling back to computed signal text");
        } else if (resp.status === 402) {
          console.error("[ai-pitch-suggestions] Lovable AI credits exhausted (402); falling back to computed signal text");
        } else if (!resp.ok) {
          console.error("[ai-pitch-suggestions] Lovable AI gateway error:", resp.status, await resp.text());
        } else {
          const data = await resp.json();
          text = String(data?.choices?.[0]?.message?.content ?? "");
        }
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          (Array.isArray(parsed?.reasons) ? parsed.reasons : []).forEach((r: any) => {
            const n = Math.round(num(r?.n));
            if (n < 1 || n > allCandidates.length) return;
            const reason = String(r?.reason ?? "").trim();
            if (reason) reasonByIndex.set(n, reason.slice(0, 450));
          });
          summary = String(parsed?.summary ?? "").trim();
        }
      } catch (aiErr) {
        console.error("[ai-pitch-suggestions] narration failed:", aiErr);
      }
    }

    const toItem = (c: Candidate, index: number): CategoryItem => ({
      productId: c.productId,
      variantId: c.variantId,
      name: c.name,
      qty: c.qty,
      unit: c.unit,
      category: c.category,
      reason: reasonByIndex.get(index + 1) ?? c.signal,
      tag: c.tag,
      evidence: c.evidence?.trim() || undefined,
      details: c.signal,
      sharePct: c.sharePct,
      shareCount: c.shareCount,
      shareTotal: c.shareTotal,
    });
    let offset = 0;
    const categories = (Object.keys(CATEGORY_CAP) as CategoryKey[]).map((key) => {
      const items = candidates[key].map((c, i) => toItem(c, offset + i));
      offset += candidates[key].length;
      return { key, label: CATEGORY_LABEL[key], items };
    });

    return new Response(
      JSON.stringify({
        kind: "pitch",
        retailerId,
        retailerName,
        date: today,
        isNewRetailer,
        isNewBeat,
        categories,
        summary,
        analysed: { retailerProductiveVisits: retailerHistory.visitCount, topSellerWindowDays: TOP_SELLER_WINDOW_DAYS },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message =
      err instanceof TogetherError
        ? `AI provider request failed (${err.code})`
        : err instanceof Error
          ? err.message
          : "Unknown error";
    console.error("[ai-pitch-suggestions] failed:", err);
    return jsonError(500, "pitch_failed", message);
  }
});
