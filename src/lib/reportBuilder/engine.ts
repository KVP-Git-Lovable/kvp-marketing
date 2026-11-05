import { supabase } from "@/integrations/supabase/client";
import { getObject } from "./objects";
import type {
  FieldType,
  ReportFilter,
  ReportMeasure,
  ReportResult,
  ReportRow,
  SavedReport,
} from "./types";

export const DEFAULT_ROW_LIMIT = 4000;
export const MAX_ROW_LIMIT = 10000;
const CHUNK = 200;

/* ------------------------------------------------------------------ helpers */

const monthOf = (value: unknown): string | null => {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const num = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const chunked = <T,>(items: T[], size = CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** Bulk id → row lookup that respects RLS (uses the signed-in user's client). */
async function lookup(table: string, ids: string[], columns: string): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return map;
  for (const group of chunked(unique)) {
    const { data, error } = await supabase
      .from(table as any)
      .select(columns)
      .in("id", group);
    if (error) continue;
    (data || []).forEach((row: any) => map.set(String(row.id), row));
  }
  return map;
}

/* -------------------------------------------------------------- date helpers */

const fyStart = (d: Date) => {
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return new Date(year, 3, 1);
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/* ------------------------------------------------------- filter evaluation */

const asArray = (value?: string): string[] =>
  (value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

function matchesFilter(row: ReportRow, filter: ReportFilter, type: FieldType): boolean {
  const raw = row[filter.field];
  const op = filter.operator;

  if (op === "is_empty") return raw === null || raw === undefined || raw === "";
  if (op === "is_not_empty") return !(raw === null || raw === undefined || raw === "");
  if (raw === null || raw === undefined) return false;

  if (type === "number") {
    const n = num(raw);
    const v = Number(filter.value);
    switch (op) {
      case "equals":
        return n === v;
      case "not_equals":
        return n !== v;
      case "gt":
        return n > v;
      case "gte":
        return n >= v;
      case "lt":
        return n < v;
      case "lte":
        return n <= v;
      case "between":
        return n >= v && n <= Number(filter.value2);
      default:
        return true;
    }
  }

  if (type === "date") {
    const t = new Date(String(raw)).getTime();
    if (Number.isNaN(t)) return false;
    const now = new Date();
    switch (op) {
      case "last_n_days": {
        const days = Number(filter.value || 30);
        return t >= now.getTime() - days * 86400000;
      }
      case "this_month":
        return new Date(String(raw)).getMonth() === now.getMonth() &&
          new Date(String(raw)).getFullYear() === now.getFullYear();
      case "this_fy":
        return t >= fyStart(now).getTime();
      case "gte":
        return t >= new Date(String(filter.value)).getTime();
      case "lte":
        return t <= new Date(`${filter.value}T23:59:59`).getTime();
      case "between":
        return (
          t >= new Date(String(filter.value)).getTime() &&
          t <= new Date(`${filter.value2}T23:59:59`).getTime()
        );
      case "equals":
        return isoDate(new Date(String(raw))) === filter.value;
      case "not_equals":
        return isoDate(new Date(String(raw))) !== filter.value;
      default:
        return true;
    }
  }

  if (type === "boolean") {
    const b = raw === true || raw === "true";
    const want = filter.value === "true";
    return op === "not_equals" ? b !== want : b === want;
  }

  const s = String(raw).toLowerCase();
  const v = (filter.value || "").toLowerCase();
  switch (op) {
    case "equals":
      return s === v;
    case "not_equals":
      return s !== v;
    case "contains":
      return s.includes(v);
    case "in":
      return asArray(filter.value).map((x) => x.toLowerCase()).includes(s);
    case "not_in":
      return !asArray(filter.value).map((x) => x.toLowerCase()).includes(s);
    default:
      return true;
  }
}

/* --------------------------------------------------------------- fetch layer */

interface FetchOptions {
  rowLimit: number;
  /** Extra restriction applied server-side (Analytics user scope). */
  userIds?: string[];
}

/**
 * Server-side narrowing for date filters on the dataset's own date column.
 * Everything else is evaluated client-side after enrichment.
 */
function applyDateNarrowing(query: any, dateColumn: string, filters: ReportFilter[], objectKey: string) {
  const dateField = getObject(objectKey)?.dateField;
  filters.forEach((f) => {
    if (f.field !== dateField) return;
    const now = new Date();
    if (f.operator === "last_n_days") {
      const days = Number(f.value || 30);
      query = query.gte(dateColumn, isoDate(new Date(now.getTime() - days * 86400000)));
    } else if (f.operator === "this_fy") {
      query = query.gte(dateColumn, isoDate(fyStart(now)));
    } else if (f.operator === "this_month") {
      query = query.gte(dateColumn, isoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
    } else if (f.operator === "gte" && f.value) {
      query = query.gte(dateColumn, f.value);
    } else if (f.operator === "lte" && f.value) {
      query = query.lte(dateColumn, `${f.value}T23:59:59`);
    } else if (f.operator === "between" && f.value && f.value2) {
      query = query.gte(dateColumn, f.value).lte(dateColumn, `${f.value2}T23:59:59`);
    }
  });
  return query;
}

const ORDER_COLUMNS =
  "id,order_date,created_at,invoice_number,status,payment_status,delivery_status,order_source,sales_channel,retailer_id,retailer_name,beat_id,beat_name_snapshot,user_id,placed_by_user_id,distributor_name,currency_code,is_credit_order,total_amount,subtotal,discount_amount,credit_pending_amount";

async function fetchOrderRows(filters: ReportFilter[], opts: FetchOptions) {
  let query = supabase.from("orders").select(ORDER_COLUMNS).order("order_date", { ascending: false });
  query = applyDateNarrowing(query, "order_date", filters, "orders");
  if (opts.userIds?.length) query = query.in("user_id", opts.userIds);
  const { data, error } = await query.limit(opts.rowLimit + 1);
  if (error) throw new Error(error.message);
  return data || [];
}

async function enrichOrders(orders: any[]): Promise<ReportRow[]> {
  const retailers = await lookup(
    "retailers",
    orders.map((o) => o.retailer_id),
    "id,name,category,city,district,state,beat_id,beat_name"
  );
  const beatIds = orders
    .map((o) => o.beat_id || retailers.get(String(o.retailer_id))?.beat_id)
    .filter(Boolean);
  const beats = await lookup("beats", beatIds, "id,beat_name,category");
  const profiles = await lookup(
    "profiles",
    orders.map((o) => o.user_id || o.placed_by_user_id),
    "id,full_name"
  );

  return orders.map((o) => {
    const r = retailers.get(String(o.retailer_id));
    const beatId = o.beat_id || r?.beat_id || null;
    const b = beatId ? beats.get(String(beatId)) : null;
    const beatName = b?.beat_name || o.beat_name_snapshot || r?.beat_name || null;
    const userId = o.user_id || o.placed_by_user_id;
    return {
      id: o.id,
      order_id: o.id,
      retailer_id: o.retailer_id ?? null,
      user_id: userId ?? null,
      beat_key: beatId || beatName || null,
      order_date: o.order_date || o.created_at || null,
      month: monthOf(o.order_date || o.created_at),
      invoice_number: o.invoice_number ?? null,
      status: o.status ?? null,
      payment_status: o.payment_status ?? null,
      delivery_status: o.delivery_status ?? null,
      order_source: o.order_source ?? null,
      sales_channel: o.sales_channel ?? null,
      retailer_name: r?.name || o.retailer_name || null,
      retailer_category: r?.category ?? null,
      retailer_city: r?.city ?? null,
      retailer_district: r?.district ?? null,
      beat_name: beatName,
      beat_category: b?.category ?? null,
      user_name: profiles.get(String(userId))?.full_name ?? null,
      distributor_name: o.distributor_name ?? null,
      currency_code: o.currency_code ?? null,
      is_credit_order: !!o.is_credit_order,
      total_amount: num(o.total_amount),
      order_total: num(o.total_amount),
      subtotal: num(o.subtotal),
      discount_amount: num(o.discount_amount),
      credit_pending_amount: num(o.credit_pending_amount),
    } as ReportRow;
  });
}

async function fetchOrderLineRows(filters: ReportFilter[], opts: FetchOptions): Promise<ReportRow[]> {
  const orders = await fetchOrderRows(filters, { ...opts, rowLimit: opts.rowLimit });
  const orderRows = await enrichOrders(orders);
  const byId = new Map(orderRows.map((r) => [String(r.order_id), r]));

  const lines: any[] = [];
  for (const group of chunked(orderRows.map((r) => String(r.order_id)))) {
    const { data, error } = await supabase
      .from("order_items")
      .select(
        "id,order_id,product_id,product_name,category,unit,uom_code,quantity,rate,total,discount_amount"
      )
      .in("order_id", group);
    if (error) throw new Error(error.message);
    lines.push(...(data || []));
    if (lines.length > opts.rowLimit + 1) break;
  }

  const products = await lookup(
    "products",
    lines.map((l) => l.product_id),
    "id,name,sku,brand"
  );

  return lines.map((l) => {
    const parent = byId.get(String(l.order_id)) || ({} as ReportRow);
    const p = l.product_id ? products.get(String(l.product_id)) : null;
    const productName = p?.name || l.product_name || null;
    return {
      ...parent,
      id: l.id,
      line_id: l.id,
      product_key: l.product_id || productName,
      product_name: productName,
      product_category: l.category ?? null,
      product_brand: p?.brand ?? null,
      sku: p?.sku ?? null,
      unit: l.uom_code || l.unit || null,
      quantity: num(l.quantity),
      rate: num(l.rate),
      line_total: num(l.total),
      line_discount: num(l.discount_amount),
    } as ReportRow;
  });
}

async function fetchRetailerRows(filters: ReportFilter[], opts: FetchOptions): Promise<ReportRow[]> {
  let query = supabase
    .from("retailers")
    .select(
      "id,name,category,retail_type,status,beat_id,beat_name,owner_id,user_id,city,district,state,pincode,verified,created_at,last_order_date,last_order_value,pending_amount,avg_monthly_orders_3m,total_visits_3m,productive_visits_3m"
    )
    .order("created_at", { ascending: false });
  query = applyDateNarrowing(query, "created_at", filters, "retailers");
  if (opts.userIds?.length) query = query.in("user_id", opts.userIds);
  const { data, error } = await query.limit(opts.rowLimit + 1);
  if (error) throw new Error(error.message);
  const rows = data || [];

  const beats = await lookup("beats", rows.map((r: any) => r.beat_id), "id,beat_name");
  const profiles = await lookup(
    "profiles",
    rows.map((r: any) => r.owner_id || r.user_id),
    "id,full_name"
  );

  return rows.map((r: any) => ({
    id: r.id,
    retailer_name: r.name ?? null,
    retailer_category: r.category ?? null,
    retail_type: r.retail_type ?? null,
    status: r.status ?? null,
    beat_name: beats.get(String(r.beat_id))?.beat_name || r.beat_name || null,
    user_name: profiles.get(String(r.owner_id || r.user_id))?.full_name ?? null,
    city: r.city ?? null,
    district: r.district ?? null,
    state: r.state ?? null,
    pincode: r.pincode ?? null,
    verified: !!r.verified,
    created_at: r.created_at ?? null,
    month: monthOf(r.created_at),
    last_order_date: r.last_order_date ?? null,
    last_order_value: num(r.last_order_value),
    pending_amount: num(r.pending_amount),
    avg_monthly_orders_3m: num(r.avg_monthly_orders_3m),
    total_visits_3m: num(r.total_visits_3m),
    productive_visits_3m: num(r.productive_visits_3m),
  }));
}

async function fetchBeatRows(filters: ReportFilter[], opts: FetchOptions): Promise<ReportRow[]> {
  let query = supabase
    .from("beats")
    .select(
      "id,beat_name,category,is_active,owner_id,owner_name,user_id,created_at,travel_allowance,average_km,average_time_minutes"
    )
    .order("created_at", { ascending: false });
  query = applyDateNarrowing(query, "created_at", filters, "beats");
  if (opts.userIds?.length) query = query.in("owner_id", opts.userIds);
  const { data, error } = await query.limit(opts.rowLimit + 1);
  if (error) throw new Error(error.message);
  const rows = data || [];
  const profiles = await lookup(
    "profiles",
    rows.map((b: any) => b.owner_id || b.user_id),
    "id,full_name"
  );
  return rows.map((b: any) => ({
    id: b.id,
    beat_name: b.beat_name ?? null,
    beat_category: b.category ?? null,
    is_active: !!b.is_active,
    user_name: profiles.get(String(b.owner_id || b.user_id))?.full_name || b.owner_name || null,
    created_at: b.created_at ?? null,
    month: monthOf(b.created_at),
    travel_allowance: num(b.travel_allowance),
    average_km: num(b.average_km),
    average_time_minutes: num(b.average_time_minutes),
  }));
}

async function fetchVisitRows(filters: ReportFilter[], opts: FetchOptions): Promise<ReportRow[]> {
  let query = supabase
    .from("visits")
    .select(
      "id,user_id,retailer_id,planned_date,status,visit_type,check_in_time,check_out_time"
    )
    .order("planned_date", { ascending: false });
  query = applyDateNarrowing(query, "planned_date", filters, "visits");
  if (opts.userIds?.length) query = query.in("user_id", opts.userIds);
  const { data, error } = await query.limit(opts.rowLimit + 1);
  if (error) throw new Error(error.message);
  const rows = data || [];

  const retailers = await lookup(
    "retailers",
    rows.map((v: any) => v.retailer_id),
    "id,name,category,beat_id,beat_name"
  );
  const beats = await lookup(
    "beats",
    rows.map((v: any) => retailers.get(String(v.retailer_id))?.beat_id).filter(Boolean),
    "id,beat_name"
  );
  const profiles = await lookup("profiles", rows.map((v: any) => v.user_id), "id,full_name");

  return rows.map((v: any) => {
    const r = retailers.get(String(v.retailer_id));
    return {
      id: v.id,
      user_id: v.user_id ?? null,
      retailer_id: v.retailer_id ?? null,
      planned_date: v.planned_date ?? null,
      month: monthOf(v.planned_date),
      status: v.status ?? null,
      visit_type: v.visit_type ?? null,
      retailer_name: r?.name ?? null,
      retailer_category: r?.category ?? null,
      beat_name: beats.get(String(r?.beat_id))?.beat_name || r?.beat_name || null,
      user_name: profiles.get(String(v.user_id))?.full_name ?? null,
      check_in_time: v.check_in_time ?? null,
      check_out_time: v.check_out_time ?? null,
    };
  });
}

async function fetchRows(objectKey: string, filters: ReportFilter[], opts: FetchOptions) {
  switch (objectKey) {
    case "orders":
      return enrichOrders(await fetchOrderRows(filters, opts));
    case "order_lines":
      return fetchOrderLineRows(filters, opts);
    case "retailers":
      return fetchRetailerRows(filters, opts);
    case "beats":
      return fetchBeatRows(filters, opts);
    case "visits":
      return fetchVisitRows(filters, opts);
    default:
      throw new Error(`Unknown dataset: ${objectKey}`);
  }
}

/* --------------------------------------------------------------- aggregation */

function measureConditionOk(row: ReportRow, m: ReportMeasure): boolean {
  if (!m.condition) return true;
  const { field, op, value } = m.condition;
  const raw = row[field];
  const list = Array.isArray(value) ? value : [value];
  const s = raw === true ? "true" : raw === false ? "false" : String(raw ?? "");
  switch (op) {
    case "eq":
      return s === String(list[0]);
    case "neq":
      return s !== String(list[0]);
    case "in":
      return list.map(String).includes(s);
    case "not_in":
      return !list.map(String).includes(s);
    default:
      return true;
  }
}

function computeMeasure(rows: ReportRow[], m: ReportMeasure, all: ReportMeasure[]): number | string | null {
  const scoped = rows.filter((r) => measureConditionOk(r, m));

  switch (m.agg) {
    case "count":
      return scoped.length;
    case "countDistinct": {
      const set = new Set<string>();
      scoped.forEach((r) => {
        const v = r[m.field || "id"];
        if (v !== null && v !== undefined && v !== "") set.add(String(v));
      });
      return set.size;
    }
    case "sum":
      return scoped.reduce((s, r) => s + num(r[m.field || ""]), 0);
    case "sumDistinct": {
      const seen = new Set<string>();
      let total = 0;
      scoped.forEach((r) => {
        const key = String(r[m.distinctBy || "id"] ?? "");
        if (!key || seen.has(key)) return;
        seen.add(key);
        total += num(r[m.field || ""]);
      });
      return total;
    }
    case "avg": {
      const vals = scoped
        .map((r) => r[m.field || ""])
        .filter((v) => v !== null && v !== undefined && v !== "")
        .map(num);
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    case "min":
    case "max": {
      const vals = scoped
        .map((r) => r[m.field || ""])
        .filter((v) => v !== null && v !== undefined && v !== "");
      if (!vals.length) return null;
      const sorted = vals
        .map((v) => (m.format === "date" ? new Date(String(v)).getTime() : num(v)))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      if (!sorted.length) return null;
      const picked = m.agg === "min" ? sorted[0] : sorted[sorted.length - 1];
      return m.format === "date" ? new Date(picked).toISOString() : picked;
    }
    case "ratio": {
      const numM = all.find((x) => x.key === m.numerator);
      const denM = all.find((x) => x.key === m.denominator);
      if (!numM || !denM) return null;
      const n = num(computeMeasure(rows, numM, all));
      const d = num(computeMeasure(rows, denM, all));
      return d === 0 ? null : n / d;
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------- runner */

export async function runReport(
  report: SavedReport,
  options?: { userIds?: string[] }
): Promise<ReportResult> {
  const obj = getObject(report.primary_object);
  if (!obj) throw new Error("This report points at a dataset that no longer exists.");

  const rowLimit = Math.min(
    Math.max(report.display_options?.rowLimit || DEFAULT_ROW_LIMIT, 100),
    MAX_ROW_LIMIT
  );

  const raw = await fetchRows(report.primary_object, report.filters || [], {
    rowLimit,
    userIds: options?.userIds,
  });

  const truncated = raw.length > rowLimit;
  const base = truncated ? raw.slice(0, rowLimit) : raw;

  const typeOf = (fieldKey: string): FieldType =>
    obj.fields.find((f) => f.key === fieldKey)?.type ?? "text";

  const filtered = base.filter((row) =>
    (report.filters || []).every((f) => matchesFilter(row, f, typeOf(f.field)))
  );

  const groupRows = (report.group_rows || []).filter((k) => obj.fields.some((f) => f.key === k));
  const measures = (report.group_columns || [])
    .map((k) => obj.measures.find((m) => m.key === k))
    .filter(Boolean) as ReportMeasure[];

  // ------- Summary (grouped) mode
  if (groupRows.length > 0 && measures.length > 0) {
    const buckets = new Map<string, { keys: (string | null)[]; rows: ReportRow[] }>();
    filtered.forEach((row) => {
      const keys = groupRows.map((g) => {
        const v = row[g];
        return v === null || v === undefined || v === "" ? "—" : String(v);
      });
      const id = keys.join("\u0001");
      if (!buckets.has(id)) buckets.set(id, { keys, rows: [] });
      buckets.get(id)!.rows.push(row);
    });

    const rows: ReportRow[] = Array.from(buckets.values()).map(({ keys, rows: group }) => {
      const out: ReportRow = {};
      groupRows.forEach((g, i) => (out[g] = keys[i]));
      measures.forEach((m) => (out[m.key] = computeMeasure(group, m, obj.measures) as any));
      return out;
    });

    const totals: ReportRow = {};
    groupRows.forEach((g, i) => (totals[g] = i === 0 ? "Total" : ""));
    measures.forEach((m) => (totals[m.key] = computeMeasure(filtered, m, obj.measures) as any));

    const columns = [
      ...groupRows.map((g) => {
        const f = obj.fields.find((x) => x.key === g)!;
        return { key: g, label: f.label, type: f.type };
      }),
      ...measures.map((m) => ({
        key: m.key,
        label: m.label,
        type: "number" as FieldType,
        format: m.format,
      })),
    ];

    const sortBy = report.display_options?.sortBy || measures[0]?.key;
    const dir = report.display_options?.sortDir || "desc";
    rows.sort((a, b) => {
      const av = a[sortBy!];
      const bv = b[sortBy!];
      const an = typeof av === "number" ? av : Number(av);
      const bn = typeof bv === "number" ? bv : Number(bv);
      if (Number.isFinite(an) && Number.isFinite(bn)) return dir === "asc" ? an - bn : bn - an;
      return dir === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });

    return {
      columns,
      rows,
      totals,
      baseRowCount: filtered.length,
      truncated,
      grainLabel: obj.grain,
    };
  }

  // ------- Detail mode
  const detailCols = (report.columns || []).filter((k) => obj.fields.some((f) => f.key === k));
  const usedCols = detailCols.length
    ? detailCols
    : obj.fields.slice(0, 8).map((f) => f.key);

  const columns = usedCols.map((k) => {
    const f = obj.fields.find((x) => x.key === k)!;
    return { key: k, label: f.label, type: f.type };
  });

  const rows = filtered.map((row) => {
    const out: ReportRow = {};
    usedCols.forEach((k) => (out[k] = row[k] ?? null));
    return out;
  });

  const numericCols = columns.filter((c) => c.type === "number");
  const totals: ReportRow | null = numericCols.length
    ? (() => {
        const t: ReportRow = {};
        columns.forEach((c, i) => {
          t[c.key] =
            c.type === "number"
              ? rows.reduce((s, r) => s + num(r[c.key]), 0)
              : i === 0
              ? "Total"
              : "";
        });
        return t;
      })()
    : null;

  return {
    columns,
    rows,
    totals,
    baseRowCount: filtered.length,
    truncated,
    grainLabel: obj.grain,
  };
}

export const emptyReport = (objectKey = "orders"): SavedReport => ({
  name: "",
  description: "",
  folder_id: null,
  primary_object: objectKey,
  related_object: null,
  columns: [],
  group_rows: [],
  group_columns: [],
  filters: [],
  chart_type: "table",
  display_options: { rowLimit: DEFAULT_ROW_LIMIT, showTotals: true },
});
