import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, Check, Circle, Store, ReceiptText, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

/**
 * Why did I get these points?
 *
 * The history could say what was earned and never why. For an order-milestone
 * award that gap is acute: the ladder pays 2.5 a rung, the award reads +5, and
 * it is recorded against a single rung — because all-or-nothing pays the whole
 * ladder on the last milestone. A correct award looked like a bug.
 *
 * Everything here comes from one read-only call, which also decides how much
 * detail the caller may see.
 */

interface Props {
  awardId: string | null;
  onOpenChange: (open: boolean) => void;
}

interface Rung {
  ordinal: number;
  operator: string;
  threshold: number;
  points: number;
  met: boolean;
  awarded: boolean;
  is_award_rung: boolean;
  basis?: string | null;
  event_value: number | null;
}

interface PurchaseEvent {
  ordinal: number;
  event_key: string;
  grouped_by: "visit" | "day";
  first_at: string;
  value: number;
  quantity?: number | null;
  weight_kg?: number | null;
  unweighed_lines?: number | null;
  unweighed_items?: string[];
  units?: { unit: string; quantity: number }[];
  is_award_event: boolean;
  orders: { id: string; order_date: string; amount: number; status: string }[];
}

interface Explanation {
  kind: "milestone" | "simple";
  full_detail: boolean;
  basis?: string | null;
  error?: string;
  award: {
    id: string; earned_at: string; points: number; is_correction: boolean;
    activity: string; game: string;
    retailer_id: string | null; retailer_name: string | null;
    reference_id: string | null; reference_type: string | null;
    expires_at: string | null; status: string | null;
  };
  rule?: { milestone_ordinal: number; threshold: number; operator: string; tier_mode: string; basis?: string | null };
  ladder?: Rung[];
  events?: PurchaseEvent[];
  ladder_total?: number;
  rules_changed?: boolean;
  metadata?: Record<string, unknown>;
}

const inr = (n: number) =>
  `${n < 0 ? "-" : ""}₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const pts = (n: number) => `${n > 0 ? "+" : ""}${Number(n).toLocaleString("en-IN")}`;
const qty = (n: number) =>
  `${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 3 })} units`;
const kg = (n: number) =>
  `${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 3 })} kg`;
const isQty = (b?: string | null) => b === "order_quantity";
const isWeight = (b?: string | null) => b === "order_weight";
/** The threshold and the event total must be printed in the same unit as the
 *  rung is judged in, or the panel contradicts the award. */
const amount = (n: number, basis?: string | null) =>
  isWeight(basis) ? kg(n) : isQty(basis) ? qty(n) : inr(n);

/** Why the headline number is what it is. Stated first, because under
 *  all-or-nothing it is the one thing that cannot be worked out from the row. */
function whyLine(x: Explanation): string | null {
  const mode = x.rule?.tier_mode;
  if (!mode) return null;
  if (mode === "all_or_nothing") {
    return "Every milestone was met. This activity pays all or nothing — nothing is paid until the " +
           "whole ladder is complete, so the milestones were awarded together here.";
  }
  if (mode === "sequential") {
    return "Milestones pay in order, and each one needs the milestone before it. This award is for " +
           `milestone ${x.rule?.milestone_ordinal}.`;
  }
  return `Each milestone pays on its own. This award is for milestone ${x.rule?.milestone_ordinal}.`;
}

export function AwardExplanationSheet({ awardId, onOpenChange }: Props) {
  const [data, setData] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!awardId) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: res, error } = await supabase.rpc("gam_award_explanation" as any, {
        p_award_id: awardId,
      });
      if (cancelled) return;
      setData(error ? ({ error: error.message } as unknown as Explanation) : (res as unknown as Explanation));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [awardId]);

  const a = data?.award;

  return (
    <Dialog open={!!awardId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[86vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[15px] text-left">How these points were earned</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && (!data || data.error) && (
          <p className="py-8 text-center text-[13px] text-muted-foreground">
            This award could not be loaded.
          </p>
        )}

        {!loading && data && !data.error && a && (
          <div className="space-y-4">
            {/* headline */}
            <div className="flex items-start gap-3">
              <span
                className="text-[30px] font-extrabold leading-none tracking-tight tabular-nums"
                style={{ color: a.is_correction ? "#b8501d" : "#178a5a" }}
              >
                {pts(a.points)}
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold leading-tight">{a.activity}</div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">
                  {[a.retailer_name, format(new Date(a.earned_at), "d MMM yyyy, HH:mm"), a.game]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            </div>

            {data.rules_changed && (
              <div className="flex gap-2 rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2.5
                              text-[12px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  The rules for this activity have changed since these points were earned. The milestones
                  below are shown as they were at the time.
                </span>
              </div>
            )}

            {data.kind === "milestone" && whyLine(data) && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground mb-1.5">
                  Why {pts(a.points)} points
                </p>
                <p className="rounded-[10px] bg-muted/60 px-3 py-2.5 text-[12.5px] leading-relaxed">
                  {whyLine(data)}
                </p>
              </div>
            )}

            {/* the ladder, including rungs not yet earned */}
            {!!data.ladder?.length && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground mb-1.5">
                  The ladder
                </p>
                <div className="rounded-[10px] border divide-y">
                  {data.ladder.map((r) => (
                    <div key={r.ordinal} className="flex items-start gap-2.5 px-3 py-2.5">
                      <span
                        className={`mt-0.5 h-5 w-5 shrink-0 rounded-full grid place-items-center text-[10px] font-bold ${
                          r.met ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.met ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-medium">
                          {ordinalWord(r.ordinal)} purchase {r.operator} {amount(r.threshold, r.basis)}
                        </div>
                        <div className="text-[11.5px] text-muted-foreground mt-0.5">
                          {r.met
                            ? r.event_value != null
                              ? `Purchase ${r.ordinal} — ${amount(r.event_value, r.basis)}`
                              : "Met"
                            : "Not yet"}
                        </div>
                      </div>
                      <span className="text-[12.5px] font-semibold tabular-nums shrink-0">{r.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* what the retailer actually bought */}
            {!!data.events?.length && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground mb-1.5">
                  Purchases counted
                </p>
                <div className="space-y-2">
                  {data.events.map((e) => (
                    <div
                      key={e.event_key}
                      className={`rounded-[10px] border px-3 py-2.5 ${
                        e.is_award_event ? "border-primary/50 bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12.5px] font-semibold">
                          Purchase {e.ordinal} · {format(new Date(e.first_at), "d MMM")}
                          <span className="font-normal text-muted-foreground">
                            {" "}· {e.grouped_by === "day" ? "same day" : "one visit"}
                          </span>
                        </span>
                        <span className="text-[13px] font-bold tabular-nums">
                          {isWeight(data.basis) && e.weight_kg != null
                            ? kg(e.weight_kg)
                            : isQty(data.basis) && e.quantity != null
                              ? qty(e.quantity)
                              : inr(e.value)}
                        </span>
                      </div>
                      {/* A weight ladder can miss because of the product master
                          rather than the order, so say which products did it. */}
                      {isWeight(data.basis) && !!e.unweighed_lines && (
                        <div className="mt-1.5 rounded-[8px] bg-amber-50 px-2 py-1.5 text-[11px]
                                        leading-snug text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                          {e.unweighed_lines} item{e.unweighed_lines === 1 ? "" : "s"} could not be
                          weighed and added nothing to this total
                          {!!e.unweighed_items?.length && <>: {e.unweighed_items.join(", ")}</>}.
                          Set a net weight on {e.unweighed_lines === 1 ? "it" : "them"} to count.
                        </div>
                      )}
                      {isWeight(data.basis) && (
                        <div className="mt-1 text-[11.5px] text-muted-foreground">{inr(e.value)}</div>
                      )}
                      {isQty(data.basis) && !!e.units?.length && (
                        <div className="mt-1 text-[11.5px] text-muted-foreground">
                          {e.units.map((u) => `${u.quantity} ${u.unit}`).join(" + ")}
                          {e.units.length > 1 && (
                            <span className="ml-1 italic">— added as entered, not converted</span>
                          )}
                          <span className="ml-1">· {inr(e.value)}</span>
                        </div>
                      )}
                      {/* Listed individually: when a visit holds two orders, this is the
                          only place a rep can see that both were counted and summed. */}
                      {e.orders.length > 1 && (
                        <div className="mt-1.5 pt-1.5 border-t border-dashed space-y-0.5">
                          {e.orders.map((o) => (
                            <div key={o.id} className="flex justify-between text-[11.5px] text-muted-foreground">
                              <span>Order · {format(new Date(o.order_date), "d MMM")} · {o.status}</span>
                              <span className="tabular-nums">{inr(o.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {e.orders.length === 1 && (
                        <div className="mt-1.5 pt-1.5 border-t border-dashed flex justify-between
                                        text-[11.5px] text-muted-foreground">
                          <span>1 order · {e.orders[0].status}</span>
                          <span className="tabular-nums">{inr(e.orders[0].amount)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* a non-milestone award explains itself with its own facts */}
            {data.kind === "simple" && (
              <dl className="text-[12.5px] border-t">
                {([
                  ["Activity", a.activity],
                  ["Game", a.game],
                  ["Retailer", a.retailer_name],
                  ["Source", a.reference_type?.replace(/_/g, " ")],
                  ["Earned", format(new Date(a.earned_at), "d MMM yyyy, HH:mm")],
                  ["Expires", a.expires_at ? format(new Date(a.expires_at), "d MMM yyyy") : null],
                ] as [string, string | null | undefined][])
                  .filter(([, v]) => !!v)
                  .map(([k, v]) => (
                    <div key={k} className="flex items-baseline gap-3 border-b py-2">
                      <dt className="w-[86px] shrink-0 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        {k}
                      </dt>
                      <dd className="font-medium break-words">{v}</dd>
                    </div>
                  ))}
              </dl>
            )}

            {!data.full_detail && (
              <p className="text-[11.5px] text-muted-foreground">
                Customer details are hidden for awards that are not yours.
              </p>
            )}

            {/* links out */}
            {(a.retailer_id || a.reference_id) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {a.retailer_id && (
                  <a
                    href={`/retailer/${a.retailer_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5
                               text-[11.5px] font-semibold text-muted-foreground hover:bg-muted"
                  >
                    <Store className="h-3.5 w-3.5" />
                    {a.retailer_name ?? "Retailer"}
                  </a>
                )}
                {a.reference_id && (
                  <a
                    href={`/order-entry?editOrderId=${encodeURIComponent(a.reference_id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5
                               text-[11.5px] font-semibold text-muted-foreground hover:bg-muted"
                  >
                    <ReceiptText className="h-3.5 w-3.5" />
                    The order
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th"];
const ordinalWord = (n: number) => ORDINALS[n] ?? `#${n}`;
