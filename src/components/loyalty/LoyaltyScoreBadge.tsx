import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star, ChevronRight, TrendingUp } from "lucide-react";
import { RetailerLoyaltyHub } from "./RetailerLoyaltyHub";

interface LoyaltyScoreBadgeProps {
  retailerId: string;
}

export function LoyaltyScoreBadge({ retailerId }: LoyaltyScoreBadgeProps) {
  const [isHubOpen, setIsHubOpen] = useState(false);

  // Fetch retailer's total points
  const { data: pointsData } = useQuery({
    queryKey: ["retailer-loyalty-score-badge", retailerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_points")
        .select("points, earned_at")
        .eq("retailer_id", retailerId);
      
      if (error) throw error;
      
      const total = data?.reduce((sum, row) => sum + (row.points || 0), 0) || 0;
      const today = new Date().toISOString().split("T")[0];
      const todayPoints = data?.filter(p => p.earned_at?.startsWith(today))
        .reduce((sum, row) => sum + (row.points || 0), 0) || 0;
      
      return { total, todayPoints };
    },
  });

  const totalPoints = pointsData?.total || 0;
  const todayPoints = pointsData?.todayPoints || 0;

  return (
    <>
      <button 
        onClick={() => setIsHubOpen(true)}
        className="flex items-center gap-1.5 text-sm hover:bg-amber-100/60 rounded-lg px-2.5 py-1.5 transition-all cursor-pointer group border border-transparent hover:border-amber-200"
      >
        <div className="relative">
          <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
          {todayPoints > 0 && (
            <div className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </div>
        <span className="font-semibold text-amber-700">{totalPoints.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">pts</span>
        {todayPoints > 0 && (
          <span className="text-xs text-green-600 font-medium flex items-center gap-0.5 ml-1">
            <TrendingUp className="h-3 w-3" />
            +{todayPoints}
          </span>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-amber-600 transition-colors ml-0.5" />
      </button>

      <RetailerLoyaltyHub 
        retailerId={retailerId}
        isOpen={isHubOpen}
        onClose={() => setIsHubOpen(false)}
      />
    </>
  );
}
