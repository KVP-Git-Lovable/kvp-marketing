import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";


interface RetailerROCRBadgeProps {
  retailerId: string;
  /** The salesperson this rolling-30-day window is scoped to. */
  userId?: string;
  className?: string;
}

interface RetailerRocr30d {
  planned_days: number;
  productive_days: number;
  // Postgres `numeric` comes back over PostgREST as a JSON string, not a
  // number (confirmed against a live call) — parse before doing arithmetic.
  rocr_percent: string;
  window_start: string;
  window_end: string;
}

/**
 * Retailer Outlet Conversion Rate (ROCR) — rolling last 30 finished days,
 * one retailer at a time. Entirely additive: new component, new RPC
 * (get_retailer_rocr_30d), no existing table/view/RLS touched, no change
 * to the salesperson-level PTV elsewhere in the app.
 *
 * ROCR % = Productive Days ÷ Planned Days × 100, where a Productive Day is
 * any day with at least one confirmed order for this retailer, and a
 * Planned Day is any day the retailer was on the route, had a visit, or
 * had an order (any one qualifies).
 *
 * Hides itself when there's nothing to show yet (no planned days in the
 * window, still loading, or the call failed) — matches how the other
 * small per-retailer badges on this card already behave, so a
 * newly-created retailer's card doesn't sprout an empty box.
 */
export function RetailerROCRBadge({ retailerId, userId, className }: RetailerROCRBadgeProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["retailer-rocr-30d", retailerId, userId],
    queryFn: async (): Promise<RetailerRocr30d | null> => {
      const { data, error } = await supabase.rpc("get_retailer_rocr_30d" as any, {
        p_retailer_id: retailerId,
        p_user_id: userId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as RetailerRocr30d) ?? null;
    },
    enabled: !!retailerId && !!userId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading || !data || data.planned_days <= 0) {
    return null;
  }

  const pct = Number(data.rocr_percent).toFixed(2);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-teal-500/20 bg-teal-500/10 px-2.5 py-0.5 text-xs font-medium text-teal-700 ${className ?? ""}`}
      title={`${data.productive_days} productive of ${data.planned_days} planned days · last 30 days`}
    >
      <TrendingUp size={12} strokeWidth={2.5} className="shrink-0 text-teal-600" />
      <span>ROCR&nbsp;{pct}%</span>
    </span>
  );
}
