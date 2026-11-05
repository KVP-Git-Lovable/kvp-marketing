import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Award, Medal, Trophy, Crown } from "lucide-react";

/** Icon names are stored per tier in the database, so the set of tiers can be
 *  changed by an admin without a deploy. Anything unrecognised falls back to a
 *  generic award rather than rendering nothing. */
const ICONS: Record<string, any> = { Award, Medal, Trophy, Crown };

export interface RetailerTierStatus {
  retailer_id: string;
  retailer_name: string | null;
  assigned_user: string | null;
  lifetime_points: number;
  points_redeemed: number;
  points_balance: number;
  tier_name: string | null;
  tier_colour: string | null;
  tier_icon: string | null;
  tier_benefits: string | null;
  next_tier: string | null;
  next_tier_at: number | null;
  points_to_next: number | null;
}

/** One authoritative read of a retailer's standing — points, badge and what the
 *  next badge needs. The view does the banding, so no component has to carry a
 *  copy of the thresholds. */
export function useRetailerTier(retailerId?: string) {
  return useQuery({
    queryKey: ["retailer-tier", retailerId],
    enabled: !!retailerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_retailer_loyalty_status")
        .select("*")
        .eq("retailer_id", retailerId!)
        .maybeSingle();
      if (error) throw error;
      return data as RetailerTierStatus | null;
    },
  });
}

/**
 * The retailer's badge. Renders from `v_retailer_loyalty_status`, so the tier
 * shown here can never drift from the tier the rest of the app calculates.
 */
export function RetailerTierBadge({
  retailerId,
  size = "md",
  showPoints = true,
  showProgress = false,
}: {
  retailerId: string;
  size?: "sm" | "md" | "lg";
  showPoints?: boolean;
  /** Adds the "N points to <next tier>" line underneath. */
  showProgress?: boolean;
}) {
  const { data } = useRetailerTier(retailerId);
  if (!data?.tier_name) return null;

  const Icon = ICONS[data.tier_icon ?? ""] ?? Award;
  const colour = data.tier_colour ?? "#8A94A6";

  const pad = {
    sm: "text-[11px] px-2 py-0.5 gap-1",
    md: "text-[12.5px] px-2.5 py-1 gap-1.5",
    lg: "text-sm px-3 py-1.5 gap-2",
  }[size];
  const ico = { sm: "h-3 w-3", md: "h-3.5 w-3.5", lg: "h-4 w-4" }[size];

  // The tier colour is the identity of the badge, so it drives the text, the
  // outline and a soft wash behind it rather than being one coloured dot.
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <span
        className={`inline-flex items-center rounded-full font-semibold ${pad}`}
        style={{ color: colour, backgroundColor: `${colour}1A`, border: `1px solid ${colour}55` }}
        title={data.tier_benefits ?? undefined}
      >
        <Icon className={ico} style={{ color: colour }} />
        {data.tier_name}
        {showPoints && (
          <span className="font-normal opacity-80 tabular-nums">
            · {Number(data.lifetime_points).toLocaleString("en-IN")} pts
          </span>
        )}
      </span>

      {showProgress && data.next_tier && (
        <span className="text-[11px] text-muted-foreground">
          {Number(data.points_to_next).toLocaleString("en-IN")} more to {data.next_tier}
        </span>
      )}
    </div>
  );
}
