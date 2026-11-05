import { supabase } from "@/integrations/supabase/client";

/** Retailer Overview figures, computed with the exact formulas used by the
 * Retailer Overview (Highlight + Payments tabs). Read-only. */
export interface RetailerOverviewMetrics {
  retailerId: string;
  avgOrderValuePerVisit: number;
  lastVisitDate: string | null;
  daysSinceLastVisit: number | null;
  outstanding: number;
  billed: number;
  outstandingPct: number;
}

export async function fetchRetailerOverviewMetrics(retailerId: string): Promise<RetailerOverviewMetrics> {
  const [visitsRes, ordersRes, ledgerRes] = await Promise.all([
    supabase.from("visits").select("id, planned_date, status").eq("retailer_id", retailerId)
      .order("planned_date", { ascending: false }),
    supabase.from("orders").select("id, visit_id, total_amount").eq("retailer_id", retailerId)
      .in("status", ["confirmed", "delivered"]),
    supabase.rpc("get_retailer_payment_ledger" as any, { p_retailer_id: retailerId }),
  ]);
  const visits = (visitsRes.data ?? []) as any[];
  const orders = (ordersRes.data ?? []) as any[];
  const ledger = ((ledgerRes.data as any[]) ?? []);

  const total = orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
  const productiveWithOrders = visits.filter(
    (v) => v.status === "productive" && orders.some((o) => o.visit_id === v.id),
  ).length;
  const avgOrderValuePerVisit = productiveWithOrders > 0 ? total / productiveWithOrders : 0;

  const completed = visits.filter((v) => v.status === "productive" || v.status === "unproductive");
  const lastVisitDate: string | null = completed[0]?.planned_date ?? null;
  let daysSinceLastVisit: number | null = null;
  if (lastVisitDate) {
    const [y, m, d] = lastVisitDate.slice(0, 10).split("-").map(Number);
    const last = new Date(y, m - 1, d).getTime();
    const now = new Date(); now.setHours(0, 0, 0, 0);
    daysSinceLastVisit = Math.round((now.getTime() - last) / 86400000);
  }

  const billed = ledger.reduce((s, r) => s + Number(r.debit || 0), 0);
  const closing = ledger.length ? Number(ledger[ledger.length - 1].running_balance) || 0 : 0;
  const outstanding = closing > 0 ? closing : 0;
  const outstandingPct = billed > 0 ? (outstanding / billed) * 100 : 0;

  return { retailerId, avgOrderValuePerVisit, lastVisitDate, daysSinceLastVisit, outstanding, billed, outstandingPct };
}

export const formatDDMMYYYY = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
