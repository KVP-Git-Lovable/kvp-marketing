import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RetailerTierBadge } from "./RetailerTierBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Star, Gift, ChevronDown, ChevronUp, History, Target, 
  TrendingUp, ShoppingCart, Package, Sparkles 
} from "lucide-react";
import { format } from "date-fns";
import { LoyaltyCrossSellCard } from "./LoyaltyCrossSellCard";

interface RetailerLoyaltySectionProps {
  retailerId: string;
  retailerName: string;
  territoryId?: string | null;
}

interface PointsHistory {
  id: string;
  points: number;
  action_name: string;
  created_at: string;
}

interface Reward {
  id: string;
  reward_name: string;
  reward_type: string;
  points_required: number;
  description: string | null;
}

export function RetailerLoyaltySection({ retailerId, retailerName, territoryId }: RetailerLoyaltySectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCrossSell, setShowCrossSell] = useState(false);

  // Fetch retailer's loyalty program
  const { data: programData } = useQuery({
    queryKey: ["retailer-loyalty-program", territoryId],
    queryFn: async () => {
      // First try to find program for this territory, then fallback to all-territories program
      let query = supabase
        .from("retailer_loyalty_programs")
        .select("*")
        .eq("is_active", true)
        .gte("end_date", new Date().toISOString().split("T")[0])
        .order("created_at", { ascending: false })
        .limit(1);

      const { data, error } = await query;
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!retailerId,
  });

  // Fetch retailer's total points
  const { data: pointsData } = useQuery({
    queryKey: ["retailer-loyalty-points-total", retailerId, programData?.id],
    queryFn: async () => {
      if (!programData?.id) return { total: 0, history: [] };
      
      const { data, error } = await supabase
        .from("retailer_loyalty_points")
        .select(`
          id,
          points,
          awarded_at,
          retailer_loyalty_actions!inner(action_name)
        `)
        .eq("retailer_id", retailerId)
        .eq("program_id", programData.id)
        .order("awarded_at", { ascending: false });
      
      if (error) throw error;
      
      const total = (data as any[])?.reduce((sum, row) => sum + (row.points || 0), 0) || 0;
      const history = (data as any[])?.map((row) => ({
        id: row.id,
        points: row.points,
        action_name: row.retailer_loyalty_actions?.action_name || "Unknown",
        created_at: row.awarded_at,
      })) || [];
      
      return { total, history };
    },
    enabled: !!programData?.id,
  });

  // Fetch available rewards
  const { data: rewards } = useQuery({
    queryKey: ["retailer-loyalty-rewards-available", programData?.id],
    queryFn: async () => {
      if (!programData?.id) return [];
      
      const { data, error } = await supabase
        .from("retailer_loyalty_rewards")
        .select("*")
        .eq("program_id", programData.id)
        .eq("is_active", true)
        .order("points_required", { ascending: true });
      
      if (error) throw error;
      return data as Reward[];
    },
    enabled: !!programData?.id,
  });

  // Fetch enabled actions for this program
  const { data: actions } = useQuery({
    queryKey: ["retailer-loyalty-actions-enabled", programData?.id],
    queryFn: async () => {
      if (!programData?.id) return [];
      
      const { data, error } = await supabase
        .from("retailer_loyalty_actions")
        .select("*")
        .eq("program_id", programData.id)
        .eq("is_enabled", true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!programData?.id,
  });

  if (!programData) {
    return null;
  }

  const totalPoints = pointsData?.total || 0;
  const history = pointsData?.history || [];
  
  // Find next reward milestone
  const nextReward = rewards?.find(r => r.points_required > totalPoints);
  const progressToNext = nextReward 
    ? Math.min((totalPoints / nextReward.points_required) * 100, 100)
    : 100;
  const pointsToNext = nextReward ? nextReward.points_required - totalPoints : 0;

  // Claimable rewards
  const claimableRewards = rewards?.filter(r => r.points_required <= totalPoints) || [];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                Loyalty Points
              </CardTitle>
              <div className="flex items-center gap-3">
                {/* Tier first, then the raw total — the badge is the summary,
                    the number is the detail. */}
                <RetailerTierBadge retailerId={retailerId} size="sm" showPoints={false} />
                <Badge variant="secondary" className="text-lg font-bold">
                  {totalPoints.toLocaleString()} pts
                </Badge>
                {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-left">
              {programData.program_name}
            </p>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Next Reward Progress */}
            {nextReward && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-1">
                    <Target className="h-4 w-4" />
                    Next: {nextReward.reward_name}
                  </span>
                  <span className="text-muted-foreground">
                    {pointsToNext.toLocaleString()} pts away
                  </span>
                </div>
                <Progress value={progressToNext} className="h-3" />
              </div>
            )}

            {/* Claimable Rewards */}
            {claimableRewards.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Gift className="h-4 w-4 text-green-600" />
                  Claimable Rewards
                </h4>
                <div className="flex flex-wrap gap-2">
                  {claimableRewards.map((reward) => (
                    <Badge key={reward.id} variant="default" className="bg-green-100 text-green-800">
                      {reward.reward_name} ({reward.points_required.toLocaleString()} pts)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Available Rewards */}
            {rewards && rewards.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  All Rewards
                </h4>
                <div className="grid gap-2">
                  {rewards.slice(0, 4).map((reward) => {
                    const canClaim = reward.points_required <= totalPoints;
                    return (
                      <div 
                        key={reward.id} 
                        className={`flex justify-between items-center p-2 rounded-lg border ${canClaim ? 'bg-green-50 border-green-200' : 'bg-muted/30'}`}
                      >
                        <span className="text-sm font-medium">{reward.reward_name}</span>
                        <Badge variant={canClaim ? "default" : "secondary"}>
                          {reward.points_required.toLocaleString()} pts
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cross-Sell Suggestions */}
            <div className="space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => setShowCrossSell(!showCrossSell)}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {showCrossSell ? "Hide" : "Show"} Cross-Sell Suggestions
              </Button>
              
            {showCrossSell && (
                <LoyaltyCrossSellCard 
                  retailerId={retailerId}
                  actions={(actions || []).map(a => ({ ...a, target_config: a.target_config as Record<string, any> || {} }))}
                  currentPoints={totalPoints}
                  nextReward={nextReward || null}
                />
              )}
            </div>

            {/* Points History */}
            {history.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Recent Activity
                </h4>
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {history.slice(0, 10).map((entry: PointsHistory) => (
                      <div key={entry.id} className="flex justify-between items-center text-sm p-2 rounded bg-muted/30">
                        <div>
                          <span className="font-medium">{entry.action_name}</span>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(entry.created_at), "dd MMM yyyy")}
                          </p>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          +{entry.points}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Conversion Rate */}
            <div className="text-xs text-center text-muted-foreground border-t pt-3">
              Conversion: {programData.points_to_rupee_conversion} points = ₹1
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
