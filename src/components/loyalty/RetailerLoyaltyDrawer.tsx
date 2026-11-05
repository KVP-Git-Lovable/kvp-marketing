import { useQuery } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/db';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, Medal, Trophy, Crown, Store, IndianRupee, Star, Gift } from "lucide-react";

const ICONS: Record<string, any> = { Award, Medal, Trophy, Crown };
const rs = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * The end of the drill-down: everything known about one retailer's standing —
 * what they bought, what that earned, which rule paid it, and what it cost.
 */
export function RetailerLoyaltyDrawer({
  retailerId, open, onClose,
}: {
  retailerId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: row } = useQuery({
    queryKey: ["loyalty-drawer", retailerId],
    enabled: !!retailerId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_loyalty_retailer_overview").select("*")
        .eq("retailer_id", retailerId!).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Every award, and the rule that paid it — this is the "why do they have
  // these points" answer the overview could never give.
  const { data: ledger = [] } = useQuery({
    queryKey: ["loyalty-drawer-ledger", retailerId],
    enabled: !!retailerId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_points")
        .select("id, points, earned_at, description, reference_type, metadata, retailer_loyalty_actions(action_name, action_type)")
        .eq("retailer_id", retailerId!)
        .order("earned_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["loyalty-drawer-orders", retailerId],
    enabled: !!retailerId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, order_date, total_amount, status")
        .eq("retailer_id", retailerId!)
        .eq("status", "confirmed")
        .order("order_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // How the points split across the earning rules.
  const byRule = ledger.reduce<Record<string, { points: number; count: number }>>((acc, r) => {
    const k = r.retailer_loyalty_actions?.action_name ?? r.description ?? "Other";
    acc[k] = { points: (acc[k]?.points ?? 0) + Number(r.points), count: (acc[k]?.count ?? 0) + 1 };
    return acc;
  }, {});
  const rules = Object.entries(byRule).sort((a, b) => b[1].points - a[1].points);

  const Icon = ICONS[row?.tier_icon ?? ""] ?? Award;
  const colour = row?.tier_colour ?? "#8A94A6";
  const toNext = Number(row?.points_to_next ?? 0);
  const earned = Number(row?.points_earned ?? 0);
  const pct = row?.next_tier && toNext > 0
    ? Math.max(4, Math.round(100 * earned / (earned + toNext)))
    : 100;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="space-y-2 text-left">
          <SheetTitle className="flex flex-wrap items-center gap-2 pr-6">
            <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
            {row?.retailer_name ?? "Retailer"}
            {row?.tier_name && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                style={{ color: colour, backgroundColor: `${colour}1A`, border: `1px solid ${colour}55` }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: colour }} />
                {row.tier_name}
              </span>
            )}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {[row?.beat_name, row?.city, row?.assigned_user && `handled by ${row.assigned_user}`]
              .filter(Boolean).join(" · ")}
          </p>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {/* headline numbers */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Revenue", value: rs(Number(row?.revenue ?? 0)), icon: IndianRupee,
                sub: `${row?.orders ?? 0} order${row?.orders === 1 ? "" : "s"}` },
              { label: "Points earned", value: Number(earned).toLocaleString("en-IN"), icon: Star,
                sub: `worth ${rs(Number(row?.points_value_rs ?? 0))}` },
              { label: "Balance", value: Number(row?.points_balance ?? 0).toLocaleString("en-IN"), icon: Star,
                sub: `${Number(row?.points_redeemed ?? 0).toLocaleString("en-IN")} redeemed` },
              { label: "Cost of loyalty", value: row?.loyalty_cost_pct != null ? `${row.loyalty_cost_pct}%` : "—",
                icon: Gift, sub: "of this retailer's revenue" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <s.icon className="h-3 w-3" /> {s.label}
                </div>
                <div className="mt-1 font-heading text-xl font-bold tabular-nums">{s.value}</div>
                <div className="text-[11px] text-muted-foreground">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* progress to the next badge */}
          {row?.next_tier && (
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between text-[12px]">
                <span className="font-medium">Progress to {row.next_tier}</span>
                <span className="tabular-nums text-muted-foreground">
                  {toNext.toLocaleString("en-IN")} points to go
                </span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          )}

          {/* where the points came from */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">What earned these points</h3>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing earned yet.</p>
            ) : (
              <div className="space-y-1.5">
                {rules.map(([name, v]) => (
                  <div key={name} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-[13px]">
                    <span className="min-w-0 truncate">{name}</span>
                    <span className="ml-3 shrink-0 tabular-nums">
                      <Badge variant="secondary" className="mr-2">{v.count}×</Badge>
                      <span className="font-semibold">{v.points.toLocaleString("en-IN")}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* the raw ledger */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">
              Points ledger <span className="font-normal text-muted-foreground">({ledger.length})</span>
            </h3>
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {ledger.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 border-b py-1.5 text-[12.5px] last:border-0">
                  <div className="min-w-0">
                    <div className="truncate">{l.retailer_loyalty_actions?.action_name ?? l.description ?? "Points"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(l.earned_at).toLocaleDateString("en-IN")}
                    </div>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-emerald-600">
                    +{Number(l.points).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* the orders behind the revenue */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">
              Orders <span className="font-normal text-muted-foreground">({orders.length})</span>
            </h3>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 border-b py-1.5 text-[12.5px] last:border-0">
                  <div className="min-w-0">
                    <div className="truncate">{o.order_number ?? o.id.slice(0, 8)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(o.order_date).toLocaleDateString("en-IN")}
                    </div>
                  </div>
                  <span className="shrink-0 tabular-nums">{rs(Number(o.total_amount))}</span>
                </div>
              ))}
              {orders.length === 0 && (
                <p className="text-sm text-muted-foreground">No confirmed orders.</p>
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
