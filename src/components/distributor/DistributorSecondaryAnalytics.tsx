import { useEffect, useMemo, useState } from "react";
import { fullNameProps } from "@/lib/displayName";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Store, Package, Search, Loader2, TrendingUp, TrendingDown,
  Minus, IndianRupee, ShoppingCart, Weight, CalendarRange,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TILE_TONES } from "@/components/distributor/tileTones";
import { SecondaryDrilldownSheet, type Dim } from "@/components/distributor/SecondaryDrilldownSheet";

/**
 * What this distributor actually sold, as an OEM wants to read it.
 *
 * The order list below answers "what happened on the 7th". It cannot answer
 * "who is selling", "which shops stopped buying" or "is this month better than
 * last", because it only ever held the most recent 500 orders and did its sums
 * in the browser -- on this distributor that was 500 of 570, so the headline
 * value was short by three and a third lakh and quietly mixed cancelled orders
 * in.
 *
 * `distributor_secondary_summary` aggregates in Postgres instead: no row cap,
 * cancelled excluded, and KG folded from the eleven spellings of unit that the
 * order lines carry.
 */

interface Totals {
  orders: number; value: number; kg: number; retailers: number; reps: number;
  pending_orders: number; pending_value: number; credit_value: number;
  avg_order_value: number;
}
interface RepRow { id: string | null; name: string; orders: number; value: number; kg: number; retailers: number }
interface RetailerRow { id: string; name: string; orders: number; value: number; kg: number; last_order: string | null }
interface ProductRow { name: string; orders: number; value: number; kg: number; qty_other: number }
interface TrendRow { m: string; orders: number; value: number; kg: number; retailers: number }
interface Summary {
  range: { from: string; to: string };
  previous_range: { from: string; to: string };
  totals: Totals;
  previous: { orders: number; value: number; retailers: number };
  trend: TrendRow[];
  by_rep: RepRow[];
  by_retailer: RetailerRow[];
  by_product: ProductRow[];
}

interface Props {
  distributorId: string;
}

// Built from the local parts on purpose. toISOString() converts local
// midnight to UTC, so east of Greenwich every boundary slid back a day and
// "last 6 months" asked for 30 April instead of 1 May.
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The financial year a date falls in, April to March. 2026-10 is FY 2026-27. */
function fyOf(d: Date) {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return start;
}
const fyLabel = (start: number) => `FY ${start}-${String(start + 1).slice(2)}`;
const fyRange = (start: number) => ({
  from: iso(new Date(start, 3, 1)),
  to: iso(new Date(start + 1, 2, 31)),
});

const THIS_FY = fyOf(new Date());

/** Rolling windows, the two most recent financial years, then a free range. */
const PERIODS: { key: string; label: string; months?: number; fy?: number }[] = [
  { key: "1", label: "This month", months: 0 },
  { key: "3", label: "Last 3 months", months: 2 },
  { key: "6", label: "Last 6 months", months: 5 },
  { key: "12", label: "Last 12 months", months: 11 },
  { key: "fy0", label: `${fyLabel(THIS_FY)} (current)`, fy: THIS_FY },
  { key: "fy1", label: fyLabel(THIS_FY - 1), fy: THIS_FY - 1 },
  { key: "custom", label: "Custom range\u2026" },
];

/** "1 shop", "9 shops" -- the lists read as counts, so the s has to be earned. */
const plural = (n: number, word: string) => `${n} ${word}${Number(n) === 1 ? "" : "s"}`;

function rangeFor(months: number) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - months, 1);
  return { from: iso(from), to: iso(now) };
}

/** "+18%" / "-6%" / "level", against the same length of time before it. */
function Delta({ now, before }: { now: number; before: number }) {
  if (!before) {
    return <span className="text-muted-foreground">no earlier period</span>;
  }
  const pct = ((now - before) / before) * 100;
  const flat = Math.abs(pct) < 0.5;
  const Icon = flat ? Minus : pct > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        flat ? "text-muted-foreground" : pct > 0 ? "text-emerald-600" : "text-rose-600",
      )}
    >
      <Icon className="h-3 w-3" />
      {flat ? "level" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
    </span>
  );
}

const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString(undefined, { month: "short" });
};

/** Every month between the two dates, carrying zero where nothing sold. */
function fillMonths(rows: TrendRow[], from: string, to: string): TrendRow[] {
  const have = new Map(rows.map((r) => [r.m, r]));
  const out: TrendRow[] = [];
  const end = new Date(to);
  const cur = new Date(from);
  cur.setDate(1);
  while (cur <= end) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    out.push(have.get(key) ?? { m: key, orders: 0, value: 0, kg: 0, retailers: 0 });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

export function DistributorSecondaryAnalytics({ distributorId }: Props) {
  const { format: fmtMoney } = useCurrency();
  const [period, setPeriod] = useState<string>("6");
  const [customFrom, setCustomFrom] = useState(() => iso(new Date(new Date().getFullYear(), 0, 1)));
  const [customTo, setCustomTo] = useState(() => iso(new Date()));
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAllRetailers, setShowAllRetailers] = useState(false);
  const [drill, setDrill] = useState<{ dim: Dim; key: string; name: string } | null>(null);

  // A financial year and a custom range are fixed dates; the rolling choices
  // are counted back from the start of this month.
  const window_ = useMemo(() => {
    const chosen = PERIODS.find((p) => p.key === period);
    if (period === "custom") return { from: customFrom, to: customTo };
    if (chosen?.fy !== undefined) return fyRange(chosen.fy);
    const now = new Date();
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth() - (chosen?.months ?? 5), 1)),
      to: iso(now),
    };
  }, [period, customFrom, customTo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { from, to } = window_;
      const { data: res, error } = await supabase.rpc("distributor_secondary_summary", {
        p_distributor_id: distributorId,
        p_from: from,
        p_to: to,
      });
      if (cancelled) return;
      if (error) {
        toast.error("Could not load secondary analytics: " + error.message);
        setData(null);
      } else {
        setData(res as unknown as Summary);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [distributorId, window_.from, window_.to]);

  const q = search.trim().toLowerCase();
  const reps = useMemo(
    () => (data?.by_rep ?? []).filter((r) => !q || r.name.toLowerCase().includes(q)),
    [data, q],
  );
  const retailers = useMemo(
    () => (data?.by_retailer ?? []).filter((r) => !q || r.name.toLowerCase().includes(q)),
    [data, q],
  );
  const products = useMemo(
    () => (data?.by_product ?? []).filter((p) => !q || p.name.toLowerCase().includes(q)),
    [data, q],
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const t = data.totals;
  const totalValue = Number(t.value) || 1;

  // Only months that sold anything come back, so two active months in a
  // six-month window would otherwise be drawn as two half-width columns and
  // the five silent months would vanish. Filling the axis keeps the gaps
  // visible, which is the part worth seeing.
  const series = fillMonths(data.trend, data.range.from, data.range.to);
  const maxTrend = Math.max(1, ...series.map((x) => Number(x.value)));
  const bestMonth = series.reduce(
    (best, x) => (Number(x.value) > Number(best.value) ? x : best),
    series[0] ?? { m: "", value: 0, orders: 0, kg: 0, retailers: 0 },
  );

  const tiles = [
    {
      label: "Secondary value", icon: IndianRupee, tone: "emerald",
      value: fmtMoney(Number(t.value)),
      foot: <Delta now={Number(t.value)} before={Number(data.previous.value)} />,
    },
    {
      label: "Orders", icon: ShoppingCart, tone: "sky",
      value: Number(t.orders).toLocaleString(),
      foot: <Delta now={Number(t.orders)} before={Number(data.previous.orders)} />,
    },
    {
      label: "Volume", icon: Weight, tone: "violet",
      value: `${Number(t.kg).toLocaleString(undefined, { maximumFractionDigits: 0 })} KG`,
      foot: <span className="text-muted-foreground">weight-priced lines only</span>,
    },
    {
      label: "Buying shops", icon: Store, tone: "amber",
      value: Number(t.retailers).toLocaleString(),
      foot: <Delta now={Number(t.retailers)} before={Number(data.previous.retailers)} />,
    },
  ];

  /** One ranked row, with the share bar behind it. */
  const bar = (value: number) => ({ width: `${Math.max(1, (value / totalValue) * 100)}%` });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Secondary performance</h3>
          <p className="text-xs text-muted-foreground">
            {data.range.from} to {data.range.to} · cancelled orders excluded
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <CalendarRange className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.key} value={p.key} className="text-xs">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {period === "custom" && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date" value={customFrom} max={customTo}
                onChange={(e) => e.target.value && setCustomFrom(e.target.value)}
                className="h-8 w-[145px] text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date" value={customTo} min={customFrom}
                onChange={(e) => e.target.value && setCustomTo(e.target.value)}
                className="h-8 w-[145px] text-xs"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((k) => {
          const tone = TILE_TONES[k.tone];
          return (
            <div
              key={k.label}
              className={cn("rounded-xl border p-4 transition-shadow hover:shadow-sm", tone.surface)}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {k.label}
                </span>
                <span className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", tone.chip)}>
                  <k.icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className={cn("mt-2 text-2xl font-semibold tabular-nums leading-none", tone.figure)}>
                {k.value}
              </div>
              <div className="mt-1.5 text-xs">{k.foot}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { l: "Average order", v: fmtMoney(Number(t.avg_order_value)), tone: "teal" },
          { l: "On credit", v: fmtMoney(Number(t.credit_value)), tone: "rose" },
          {
            l: "Pending",
            v: `${t.pending_orders} · ${fmtMoney(Number(t.pending_value))}`,
            tone: "amber",
          },
        ].map((s) => {
          const tone = TILE_TONES[s.tone];
          return (
            <div key={s.l} className={cn("rounded-lg border px-3 py-2", tone.surface)}>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.l}</div>
              <div className={cn("text-sm font-semibold tabular-nums", tone.figure)}>{s.v}</div>
            </div>
          );
        })}
      </div>

      {/* Trend -------------------------------------------------------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Secondary trend</CardTitle>
          <p className="text-xs text-muted-foreground">Value billed per month to this distributor's shops</p>
        </CardHeader>
        <CardContent>
          {series.every((x) => Number(x.value) === 0) ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nothing sold in this period.
            </p>
          ) : (
            <div
              className="grid items-end gap-2 border-b-2 border-border pt-2"
              style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}
            >
              {series.map((x) => {
                const v = Number(x.value);
                const best = x.m === bestMonth.m && v > 0;
                return (
                  <div key={x.m} className="text-center">
                    <div
                      className={cn(
                        "text-[10px] tabular-nums mb-1",
                        best ? "font-semibold text-emerald-700 dark:text-emerald-300" : "text-muted-foreground",
                      )}
                    >
                      {v > 0 ? `${Math.round(v / 1000)}k` : "—"}
                    </div>
                    <div
                      className={cn(
                        "mx-auto w-full max-w-[64px] rounded-t transition-colors",
                        v === 0
                          ? "bg-muted"
                          : best
                            ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
                            : "bg-gradient-to-t from-sky-600 to-sky-400",
                      )}
                      style={{ height: `${v === 0 ? 3 : Math.max(8, (v / maxTrend) * 140)}px` }}
                      title={
                        v > 0
                          ? `${x.m}: ${fmtMoney(v)} · ${x.orders} orders · ${x.retailers} shops`
                          : `${x.m}: nothing sold`
                      }
                    />
                    <div
                      className={cn(
                        "mt-1.5 text-[10px] font-medium uppercase",
                        best ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground",
                      )}
                    >
                      {monthLabel(x.m)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdowns --------------------------------------------------- */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm">Who, where and what</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-8"
                placeholder="Search person, shop or product"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs defaultValue="rep">
            <TabsList className="mb-3">
              <TabsTrigger value="rep" className="gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5 text-sky-600" /> By sales rep ({data.by_rep.length})
              </TabsTrigger>
              <TabsTrigger value="retailer" className="gap-1.5 text-xs">
                <Store className="h-3.5 w-3.5 text-amber-600" /> By retailer ({data.by_retailer.length})
              </TabsTrigger>
              <TabsTrigger value="product" className="gap-1.5 text-xs">
                <Package className="h-3.5 w-3.5 text-violet-600" /> By product ({data.by_product.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rep" className="m-0 divide-y">
              {reps.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nothing matches that.</p>}
              {reps.map((r, i) => (
                <button
                  key={r.id ?? r.name}
                  type="button"
                  onClick={() => setDrill({ dim: "rep", key: r.id ?? "unassigned", name: r.name })}
                  className="relative w-full text-left py-2.5 px-2 rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className={cn("absolute inset-y-0 left-0 rounded", TILE_TONES.sky.bar)} style={bar(Number(r.value))} />
                  <div className="relative flex items-center gap-3">
                    <span className={cn("h-6 w-6 shrink-0 rounded-md text-[11px] font-semibold flex items-center justify-center tabular-nums", TILE_TONES.sky.chip)}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" {...fullNameProps(r.name)} />
                      <p className="text-xs text-muted-foreground">
                        {plural(r.orders, "order")} · {plural(r.retailers, "shop")}
                        {Number(r.kg) > 0 && ` · ${Number(r.kg).toFixed(0)} KG`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">{fmtMoney(Number(r.value))}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {((Number(r.value) / totalValue) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </TabsContent>

            <TabsContent value="retailer" className="m-0 divide-y">
              {retailers.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nothing matches that.</p>}
              {(showAllRetailers || q ? retailers : retailers.slice(0, 20)).map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setDrill({ dim: "retailer", key: r.id, name: r.name })}
                  className="relative w-full text-left py-2.5 px-2 rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className={cn("absolute inset-y-0 left-0 rounded", TILE_TONES.amber.bar)} style={bar(Number(r.value))} />
                  <div className="relative flex items-center gap-3">
                    <span className={cn("h-6 w-6 shrink-0 rounded-md text-[11px] font-semibold flex items-center justify-center tabular-nums", TILE_TONES.amber.chip)}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {plural(r.orders, "order")}{r.last_order && ` · last ${r.last_order}`}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">{fmtMoney(Number(r.value))}</p>
                  </div>
                </button>
              ))}
              {!q && retailers.length > 20 && (
                <div className="pt-3 text-center">
                  <Button variant="outline" size="sm" onClick={() => setShowAllRetailers((v) => !v)}>
                    {showAllRetailers ? "Show top 20" : `Show all ${retailers.length}`}
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="product" className="m-0 divide-y">
              {products.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nothing matches that.</p>}
              {products.map((p, i) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setDrill({ dim: "product", key: p.name, name: p.name })}
                  className="relative w-full text-left py-2.5 px-2 rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className={cn("absolute inset-y-0 left-0 rounded", TILE_TONES.violet.bar)} style={bar(Number(p.value))} />
                  <div className="relative flex items-center gap-3">
                    <span className={cn("h-6 w-6 shrink-0 rounded-md text-[11px] font-semibold flex items-center justify-center tabular-nums", TILE_TONES.violet.chip)}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" {...fullNameProps(p.name)} />
                      <p className="text-xs text-muted-foreground">
                        {plural(p.orders, "order")}
                        {Number(p.kg) > 0 && ` · ${Number(p.kg).toFixed(1)} KG`}
                        {Number(p.qty_other) > 0 && ` · ${Number(p.qty_other).toFixed(0)} pcs`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">{fmtMoney(Number(p.value))}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {((Number(p.value) / totalValue) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <SecondaryDrilldownSheet
        distributorId={distributorId}
        dim={drill?.dim ?? null}
        entityKey={drill?.key ?? null}
        entityName={drill?.name ?? ""}
        from={window_.from}
        to={window_.to}
        onOpenChange={(o) => !o && setDrill(null)}
      />

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px]">{t.reps} reps</Badge>
        <span>
          Figures cover every order in the period, not a recent slice. The list below still shows the
          most recent orders for drilling into a single day.
        </span>
      </div>
    </div>
  );
}
