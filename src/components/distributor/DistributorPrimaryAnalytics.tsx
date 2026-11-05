import { useEffect, useMemo, useState } from "react";
import { fullNameProps } from "@/lib/displayName";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, TrendingUp, TrendingDown, Minus, PackageSearch, AlertTriangle,
  CalendarRange, Truck, CreditCard, Boxes, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TILE_TONES } from "@/components/distributor/tileTones";
import { exportRowsToExcel } from "@/utils/exportRowsToExcel";

/**
 * Is this distributor about to order, and should they be?
 *
 * Primary alone cannot answer that -- it only says what they last bought.
 * The answer is in the gap between what we shipped them and what their shops
 * have since sold: stock on hand divided by the rate it is actually leaving
 * gives days of cover, and a short cover with live secondary is a purchase
 * order waiting to happen.
 *
 * distributor_inventory carries the stock but not the movement -- every row
 * has a null last_issued_date and mostly a zero total_value -- so the burn
 * rate comes from the distributor's own secondary sell-through.
 */

interface Repl {
  product: string; unit: string; stock: number; reorder_level: number | null;
  daily_run: number; sold_90d: number; days_cover: number | null;
  status: "critical" | "soon" | "healthy" | "no_signal";
  suggest_qty: number | null;
}
interface Summary {
  range: { from: string; to: string };
  primary: {
    orders: number; value: number; unpaid_value: number;
    last_order: string | null; days_since_last: number | null; avg_value: number;
  };
  secondary: { orders: number; value: number };
  credit: { limit: number; outstanding: number; available: number };
  flow: { m: string; primary_value: number; secondary_value: number }[];
  inventory: {
    skus: number; below_reorder: number; critical: number;
    soon: number; healthy: number; no_signal: number;
  };
  replenishment: Repl[];
}

interface Props { distributorId: string; distributorName?: string }

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function fyOf(d: Date) { return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; }
const fyLabel = (s: number) => `FY ${s}-${String(s + 1).slice(2)}`;
const THIS_FY = fyOf(new Date());

const PERIODS: { key: string; label: string; months?: number; fy?: number }[] = [
  { key: "3", label: "Last 3 months", months: 2 },
  { key: "6", label: "Last 6 months", months: 5 },
  { key: "12", label: "Last 12 months", months: 11 },
  { key: "fy0", label: `${fyLabel(THIS_FY)} (current)`, fy: THIS_FY },
  { key: "fy1", label: fyLabel(THIS_FY - 1), fy: THIS_FY - 1 },
];

const STATUS: Record<Repl["status"], { label: string; tone: string; cls: string }> = {
  critical: { label: "Order now", tone: "rose", cls: "text-rose-700 dark:text-rose-300" },
  soon: { label: "Order soon", tone: "amber", cls: "text-amber-700 dark:text-amber-300" },
  healthy: { label: "Covered", tone: "emerald", cls: "text-emerald-700 dark:text-emerald-300" },
  no_signal: { label: "No sales yet", tone: "sky", cls: "text-muted-foreground" },
};

const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(undefined, { month: "short" });
};

const qty = (n: number) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: Number(n) < 10 ? 2 : 0 });

export function DistributorPrimaryAnalytics({ distributorId, distributorName }: Props) {
  const { format: fmtMoney } = useCurrency();
  const [period, setPeriod] = useState("12");
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlyNeeded, setOnlyNeeded] = useState(false);

  const window_ = useMemo(() => {
    const chosen = PERIODS.find((p) => p.key === period);
    if (chosen?.fy !== undefined) {
      return { from: iso(new Date(chosen.fy, 3, 1)), to: iso(new Date(chosen.fy + 1, 2, 31)) };
    }
    const now = new Date();
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth() - (chosen?.months ?? 11), 1)),
      to: iso(now),
    };
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: res, error } = await supabase.rpc("distributor_primary_summary", {
        p_distributor_id: distributorId,
        p_from: window_.from,
        p_to: window_.to,
      });
      if (cancelled) return;
      if (error) { toast.error("Could not load primary analytics: " + error.message); setData(null); }
      else setData(res as unknown as Summary);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [distributorId, window_.from, window_.to]);

  if (loading) {
    return (
      <Card><CardContent className="p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }
  if (!data) return null;

  const p = data.primary;
  const inv = data.inventory;
  const rows = onlyNeeded
    ? data.replenishment.filter((r) => r.status === "critical" || r.status === "soon")
    : data.replenishment;

  const maxFlow = Math.max(
    1,
    ...data.flow.map((f) => Math.max(Number(f.primary_value), Number(f.secondary_value))),
  );

  // The headline judgement. Short cover on several lines while the shops are
  // still selling is the signal that an order is due.
  const dueNow = inv.critical;
  const verdict =
    dueNow > 0
      ? {
          tone: "rose" as const,
          title: `${dueNow} line${dueNow === 1 ? "" : "s"} will run out within a fortnight`,
          body:
            p.days_since_last === null
              ? "Their shops are still selling but no primary order has ever been recorded here. Worth a call."
              : `Their shops are still selling and the last primary order was ${p.days_since_last} days ago. Expect a purchase order, or prompt one.`,
        }
      : inv.soon > 0
        ? {
            tone: "amber" as const,
            title: `${inv.soon} line${inv.soon === 1 ? "" : "s"} run out within the month`,
            body: "Nothing urgent, but worth putting on the next call.",
          }
        : {
            tone: "emerald" as const,
            title: "Stock is covered on every line we can measure",
            body: "No reorder signal from sell-through right now.",
          };
  const vTone = TILE_TONES[verdict.tone];

  const tiles = [
    { label: "Primary bought", icon: Truck, tone: "sky", value: fmtMoney(Number(p.value)),
      foot: `${p.orders} order${p.orders === 1 ? "" : "s"}` },
    { label: "Secondary sold", icon: TrendingUp, tone: "emerald",
      value: fmtMoney(Number(data.secondary.value)),
      foot: `${data.secondary.orders} orders through their shops` },
    { label: "Unpaid on primary", icon: CreditCard, tone: "rose",
      value: fmtMoney(Number(p.unpaid_value)),
      foot: Number(data.credit.limit) > 0
        ? `${fmtMoney(Number(data.credit.available))} credit left`
        : "no credit limit set" },
    { label: "Lines needing stock", icon: Boxes, tone: "amber",
      value: `${inv.critical + inv.soon} of ${inv.skus}`,
      foot: `${inv.critical} urgent · ${inv.soon} soon` },
  ];

  const exportReplenishment = () => {
    exportRowsToExcel(
      rows.map((r) => ({
        Product: r.product,
        Unit: r.unit,
        "Stock on hand": Number(r.stock),
        "Sold in 90 days": Number(r.sold_90d),
        "Per day": Number(r.daily_run),
        "Days of cover": r.days_cover === null ? "" : Number(r.days_cover),
        Status: STATUS[r.status].label,
        "Suggested order": r.suggest_qty ?? "",
      })),
      `${distributorName || "distributor"}-replenishment`,
      "Replenishment",
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Primary performance</h3>
          <p className="text-xs text-muted-foreground">
            {data.range.from} to {data.range.to} · cancelled orders excluded
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <CalendarRange className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((x) => (
              <SelectItem key={x.key} value={x.key} className="text-xs">{x.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* The call ------------------------------------------------------ */}
      <div className={cn("rounded-xl border p-4 flex items-start gap-3", vTone.surface)}>
        <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", vTone.chip)}>
          {verdict.tone === "emerald" ? <PackageSearch className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold", vTone.figure)}>{verdict.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{verdict.body}</p>
          {p.last_order && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Last primary order {p.last_order} · average {fmtMoney(Number(p.avg_value))}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((k) => {
          const tone = TILE_TONES[k.tone];
          return (
            <div key={k.label} className={cn("rounded-xl border p-4", tone.surface)}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {k.label}
                </span>
                <span className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", tone.chip)}>
                  <k.icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className={cn("mt-2 text-xl font-semibold tabular-nums leading-none", tone.figure)}>
                {k.value}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">{k.foot}</div>
            </div>
          );
        })}
      </div>

      {/* In against out ------------------------------------------------ */}
      {data.flow.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bought from us against sold on</CardTitle>
            <p className="text-xs text-muted-foreground">
              Primary in blue, secondary in green. Secondary running while primary has stopped
              is stock draining down.
            </p>
          </CardHeader>
          <CardContent>
            <div
              className="grid items-end gap-2 border-b-2 border-border pt-2"
              style={{ gridTemplateColumns: `repeat(${data.flow.length}, minmax(0,1fr))` }}
            >
              {data.flow.map((f) => (
                <div key={f.m} className="text-center">
                  <div className="flex items-end justify-center gap-0.5 h-[110px]">
                    <div
                      className="w-1/2 max-w-[22px] rounded-t bg-gradient-to-t from-sky-600 to-sky-400"
                      style={{ height: `${Math.max(2, (Number(f.primary_value) / maxFlow) * 110)}px` }}
                      title={`Primary ${fmtMoney(Number(f.primary_value))}`}
                    />
                    <div
                      className="w-1/2 max-w-[22px] rounded-t bg-gradient-to-t from-emerald-600 to-emerald-400"
                      style={{ height: `${Math.max(2, (Number(f.secondary_value) / maxFlow) * 110)}px` }}
                      title={`Secondary ${fmtMoney(Number(f.secondary_value))}`}
                    />
                  </div>
                  <div className="mt-1.5 text-[10px] font-medium uppercase text-muted-foreground">
                    {monthLabel(f.m)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* What to order ------------------------------------------------- */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm">What they will need</CardTitle>
              <p className="text-xs text-muted-foreground">
                Stock on hand against the last 90 days of their own sell-through.
                Suggested quantity brings each line to 45 days of cover.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={onlyNeeded ? "default" : "outline"} size="sm" className="h-8 text-xs"
                onClick={() => setOnlyNeeded((v) => !v)}
              >
                {onlyNeeded ? "Showing what's needed" : "Only what's needed"}
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportReplenishment}>
                <Download className="h-3.5 w-3.5" /> Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {onlyNeeded ? "Nothing needs ordering." : "No stock recorded for this distributor."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="text-left font-medium py-2">Product</th>
                    <th className="text-right font-medium py-2">Stock</th>
                    <th className="text-right font-medium py-2">Per day</th>
                    <th className="text-right font-medium py-2">Cover</th>
                    <th className="text-right font-medium py-2">Suggest</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = STATUS[r.status];
                    return (
                      <tr key={r.product} className="border-b last:border-0">
                        <td className="py-2 pr-2">
                          <p className="font-medium truncate max-w-[220px]" {...fullNameProps(r.product)} />
                          <Badge variant="outline" className={cn("mt-0.5 text-[10px]", st.cls)}>
                            {st.label}
                          </Badge>
                        </td>
                        <td className="py-2 text-right tabular-nums whitespace-nowrap">
                          {qty(r.stock)} <span className="text-[10px] text-muted-foreground">{r.unit}</span>
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                          {Number(r.daily_run) > 0 ? qty(r.daily_run) : "—"}
                        </td>
                        <td className={cn("py-2 text-right tabular-nums font-medium whitespace-nowrap", st.cls)}>
                          {r.days_cover === null ? "—" : `${qty(r.days_cover)}d`}
                        </td>
                        <td className="py-2 text-right tabular-nums font-semibold whitespace-nowrap">
                          {r.suggest_qty ? qty(r.suggest_qty) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {inv.no_signal > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {inv.no_signal} line{inv.no_signal === 1 ? " has" : "s have"} stock but no sales in the
              last 90 days, so no cover can be worked out for {inv.no_signal === 1 ? "it" : "them"}.
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Reorder levels in the stock master are a flat 10 on every line regardless of unit, so
            cover is used here instead of the level.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
