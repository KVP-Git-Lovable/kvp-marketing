import { useEffect, useState } from "react";
import { fullNameProps } from "@/lib/displayName";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, Store, Package, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TILE_TONES } from "@/components/distributor/tileTones";

/**
 * One row of the Secondary breakdowns, opened up.
 *
 * A rank and a total answer "who sold most". They do not answer the question
 * that follows it -- which shops, which products, and whether the person is
 * still selling this month -- so the rows now lead here.
 *
 * Which lists are worth showing depends on where you came from: a salesman
 * is explained by his shops and his products, a shop by what it buys and who
 * calls on it, a product by who buys it and who sells it. A list of the thing
 * you just clicked would only repeat it, so each view leaves its own out.
 */

export type Dim = "rep" | "retailer" | "product";

interface Row { id?: string | null; name: string; orders: number; value: number; kg: number; last_order?: string | null }
interface OrderRow { id: string; d: string; retailer_name: string | null; invoice_number: string | null; status: string; value: number }
interface Drill {
  dim: Dim;
  totals: {
    orders: number; value: number; kg: number; retailers: number; reps: number;
    first_order: string | null; last_order: string | null;
  };
  trend: { m: string; orders: number; value: number; kg: number }[];
  retailers: Row[];
  reps: Row[];
  products: Row[];
  recent_orders: OrderRow[];
}

interface Props {
  distributorId: string;
  dim: Dim | null;
  entityKey: string | null;
  entityName: string;
  from: string;
  to: string;
  onOpenChange: (open: boolean) => void;
}

const DIM_LABEL: Record<Dim, string> = {
  rep: "Salesman",
  retailer: "Retailer",
  product: "Product",
};

const DIM_TONE: Record<Dim, string> = { rep: "sky", retailer: "amber", product: "violet" };

const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(undefined, { month: "short" });
};

export function SecondaryDrilldownSheet({
  distributorId, dim, entityKey, entityName, from, to, onOpenChange,
}: Props) {
  const { format: fmtMoney } = useCurrency();
  const [data, setData] = useState<Drill | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dim || !entityKey) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setData(null);
      const { data: res, error } = await supabase.rpc("distributor_secondary_drilldown", {
        p_distributor_id: distributorId,
        p_dim: dim,
        p_key: entityKey,
        p_from: from,
        p_to: to,
      });
      if (cancelled) return;
      if (error) {
        toast.error("Could not open that: " + error.message);
      } else {
        setData(res as unknown as Drill);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [distributorId, dim, entityKey, from, to]);

  const tone = dim ? TILE_TONES[DIM_TONE[dim]] : TILE_TONES.sky;
  const t = data?.totals;
  const maxTrend = Math.max(1, ...(data?.trend ?? []).map((x) => Number(x.value)));

  /** The two lists worth showing, given where the click came from. */
  const lists: { key: string; label: string; icon: typeof Users; rows: Row[] }[] = !data
    ? []
    : dim === "rep"
      ? [
          { key: "retailers", label: "Shops served", icon: Store, rows: data.retailers },
          { key: "products", label: "Products sold", icon: Package, rows: data.products },
        ]
      : dim === "retailer"
        ? [
            { key: "products", label: "What they buy", icon: Package, rows: data.products },
            { key: "reps", label: "Who calls on them", icon: Users, rows: data.reps },
          ]
        : [
            { key: "retailers", label: "Shops buying it", icon: Store, rows: data.retailers },
            { key: "reps", label: "Who sells it", icon: Users, rows: data.reps },
          ];

  const listTotal = (rows: Row[]) =>
    Math.max(1, rows.reduce((n, r) => n + Number(r.value), 0));

  return (
    <Sheet open={!!dim && !!entityKey} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px]", tone.figure)}>
              {dim ? DIM_LABEL[dim] : ""}
            </Badge>
            {t?.first_order && (
              <span className="text-[11px] text-muted-foreground">
                {t.first_order} → {t.last_order}
              </span>
            )}
          </div>
          <SheetTitle className="text-xl">{entityName}</SheetTitle>
          <SheetDescription>
            Secondary sales for this distributor between {from} and {to}, cancelled orders excluded.
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {data && t && (
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                { l: "Value", v: fmtMoney(Number(t.value)) },
                { l: "Orders", v: Number(t.orders).toLocaleString() },
                { l: "Volume", v: `${Number(t.kg).toFixed(1)} KG` },
                {
                  l: dim === "rep" ? "Shops" : dim === "retailer" ? "Salesmen" : "Shops",
                  v: String(dim === "retailer" ? t.reps : t.retailers),
                },
              ].map((s) => (
                <div key={s.l} className={cn("rounded-lg border px-3 py-2", tone.surface)}>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.l}</div>
                  <div className={cn("text-base font-semibold tabular-nums", tone.figure)}>{s.v}</div>
                </div>
              ))}
            </div>

            {data.trend.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                  Month by month
                </p>
                <div
                  className="grid items-end gap-1.5 border-b"
                  style={{ gridTemplateColumns: `repeat(${data.trend.length}, minmax(0,1fr))` }}
                >
                  {data.trend.map((x) => (
                    <div key={x.m} className="text-center">
                      <div className="text-[9px] tabular-nums text-muted-foreground">
                        {Math.round(Number(x.value) / 1000)}k
                      </div>
                      <div
                        className={cn("mx-auto w-full max-w-[40px] rounded-t", tone.chip)}
                        style={{ height: `${Math.max(6, (Number(x.value) / maxTrend) * 70)}px` }}
                        title={`${x.m}: ${fmtMoney(Number(x.value))} · ${x.orders} orders`}
                      />
                      <div className="mt-1 text-[9px] uppercase text-muted-foreground">
                        {monthLabel(x.m)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Tabs defaultValue={lists[0]?.key}>
              <TabsList>
                {lists.map((l) => (
                  <TabsTrigger key={l.key} value={l.key} className="gap-1.5 text-xs">
                    <l.icon className="h-3.5 w-3.5" /> {l.label} ({l.rows.length})
                  </TabsTrigger>
                ))}
                <TabsTrigger value="orders" className="gap-1.5 text-xs">
                  <Receipt className="h-3.5 w-3.5" /> Orders
                </TabsTrigger>
              </TabsList>

              {lists.map((l) => {
                const total = listTotal(l.rows);
                return (
                  <TabsContent key={l.key} value={l.key} className="m-0 mt-2 divide-y">
                    {l.rows.length === 0 && (
                      <p className="py-6 text-center text-sm text-muted-foreground">Nothing here.</p>
                    )}
                    {l.rows.map((r, i) => (
                      <div key={(r.id ?? r.name) + i} className="relative py-2 px-2">
                        <div
                          className={cn("absolute inset-y-0 left-0 rounded", tone.bar)}
                          style={{ width: `${Math.max(1, (Number(r.value) / total) * 100)}%` }}
                        />
                        <div className="relative flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium" {...fullNameProps(r.name)} />
                            <p className="text-xs text-muted-foreground">
                              {r.orders} order{Number(r.orders) === 1 ? "" : "s"}
                              {Number(r.kg) > 0 && ` · ${Number(r.kg).toFixed(1)} KG`}
                              {r.last_order && ` · last ${r.last_order}`}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold tabular-nums">
                            {fmtMoney(Number(r.value))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                );
              })}

              <TabsContent value="orders" className="m-0 mt-2 divide-y">
                {data.recent_orders.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No orders.</p>
                )}
                {data.recent_orders.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 py-2 px-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" {...fullNameProps(o.retailer_name || "(unnamed)")} />
                      <p className="text-xs text-muted-foreground">
                        {o.d}
                        {o.invoice_number && ` · ${o.invoice_number}`}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{o.status}</Badge>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {fmtMoney(Number(o.value))}
                    </p>
                  </div>
                ))}
                {data.recent_orders.length === 25 && (
                  <p className="pt-2 text-[11px] text-muted-foreground">
                    Showing the 25 most recent. The totals above cover every order in the period.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
