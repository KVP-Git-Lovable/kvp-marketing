import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Star, Gift, ChevronDown, ChevronUp, Target, Sparkles, TrendingUp, Calendar } from "lucide-react";
import { LoyaltyCrossSellCard } from "./LoyaltyCrossSellCard";
import { LoyaltyScoreClickable } from "./LoyaltyScoreClickable";
interface VisitLoyaltyPanelProps {
  retailerId: string;
  compact?: boolean;
}

export function VisitLoyaltyPanel({ retailerId, compact = false }: VisitLoyaltyPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch active loyalty program
  const { data: programData } = useQuery({
    queryKey: ["retailer-active-loyalty-program"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_programs")
        .select("*")
        .eq("is_active", true)
        .gte("end_date", new Date().toISOString().split("T")[0])
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0] || null;
    },
  });

  // Fetch retailer's points
  const { data: pointsData } = useQuery({
    queryKey: ["retailer-visit-loyalty-points", retailerId, programData?.id],
    queryFn: async () => {
      if (!programData?.id) return { total: 0 };
      
      const { data, error } = await supabase
        .from("retailer_loyalty_points")
        .select("points")
        .eq("retailer_id", retailerId)
        .eq("program_id", programData.id);
      
      if (error) throw error;
      const total = data?.reduce((sum, row) => sum + (row.points || 0), 0) || 0;
      return { total };
    },
    enabled: !!programData?.id,
  });

  // Fetch rewards for progress
  const { data: rewards } = useQuery({
    queryKey: ["retailer-visit-rewards", programData?.id],
    queryFn: async () => {
      if (!programData?.id) return [];
      
      const { data, error } = await supabase
        .from("retailer_loyalty_rewards")
        .select("*")
        .eq("program_id", programData.id)
        .eq("is_active", true)
        .order("points_required", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!programData?.id,
  });

  // Fetch enabled actions
  const { data: actions } = useQuery({
    queryKey: ["retailer-visit-actions", programData?.id],
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
  const nextReward = rewards?.find(r => r.points_required > totalPoints);
  const progressToNext = nextReward 
    ? Math.min((totalPoints / nextReward.points_required) * 100, 100)
    : 100;
  const pointsToNext = nextReward ? nextReward.points_required - totalPoints : 0;

  // Compact view for visit card - clickable to show breakdown modal
  if (compact) {
    return (
      <LoyaltyScoreClickable 
        retailerId={retailerId}
        totalPoints={totalPoints}
        programData={programData}
        rewards={rewards || []}
        actions={(actions || []).map(a => ({
          id: a.id,
          action_name: a.action_name,
          action_type: a.action_type,
          points: a.points,
          is_enabled: a.is_enabled,
          target_config: (a.target_config as Record<string, any>) || {}
        }))}
      />
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50">
        <CollapsibleTrigger asChild>
          <CardContent className="py-3 cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-200 rounded-lg">
                  <Star className="h-5 w-5 text-yellow-700 fill-yellow-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{totalPoints.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">points</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{programData.program_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {nextReward && pointsToNext <= 200 && (
                  <Badge className="bg-green-100 text-green-800 text-xs animate-pulse">
                    Almost there!
                  </Badge>
                )}
                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </div>
            
            {/* Progress bar */}
            {nextReward && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    {nextReward.reward_name}
                  </span>
                  <span>{pointsToNext.toLocaleString()} pts to go</span>
                </div>
                <Progress value={progressToNext} className="h-2" />
              </div>
            )}
          </CardContent>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4">
            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="bg-white/60 rounded-lg p-2 text-center">
                <Gift className="h-4 w-4 mx-auto text-primary mb-1" />
                <p className="text-xs text-muted-foreground">Available Rewards</p>
                <p className="font-bold">{rewards?.filter(r => r.points_required <= totalPoints).length || 0}</p>
              </div>
              <div className="bg-white/60 rounded-lg p-2 text-center">
                <TrendingUp className="h-4 w-4 mx-auto text-green-600 mb-1" />
                <p className="text-xs text-muted-foreground">Conversion</p>
                <p className="font-bold">{programData.points_to_rupee_conversion}:₹1</p>
              </div>
            </div>

            {/* Cross-sell suggestions */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Earn More Points
              </h4>
              <LoyaltyCrossSellCard 
                retailerId={retailerId}
                actions={(actions || []).map(a => ({ ...a, target_config: a.target_config as Record<string, any> || {} }))}
                currentPoints={totalPoints}
                nextReward={nextReward || null}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
