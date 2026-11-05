import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Gift, Target, Sparkles, TrendingUp, History, ChevronRight, Award, ShoppingCart, CreditCard } from "lucide-react";
import { LoyaltyCrossSellCard } from "./LoyaltyCrossSellCard";
import { format } from "date-fns";

interface LoyaltyScoreClickableProps {
  retailerId: string;
  totalPoints: number;
  programData: {
    id: string;
    program_name: string;
    points_to_rupee_conversion: number;
  };
  rewards: Array<{
    id: string;
    reward_name: string;
    points_required: number;
    is_active: boolean;
  }>;
  actions: Array<{
    id: string;
    action_name: string;
    action_type: string;
    points: number;
    is_enabled: boolean;
    target_config: Record<string, any> | null;
  }>;
}

export function LoyaltyScoreClickable({ 
  retailerId, 
  totalPoints, 
  programData, 
  rewards, 
  actions 
}: LoyaltyScoreClickableProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch points history for this retailer
  const { data: pointsHistory } = useQuery({
    queryKey: ["retailer-loyalty-history", retailerId, programData.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_points")
        .select(`
          id,
          points,
          earned_at,
          action_id,
          retailer_loyalty_actions(action_name, action_type)
        `)
        .eq("retailer_id", retailerId)
        .eq("program_id", programData.id)
        .order("earned_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!programData.id,
  });

  const nextReward = rewards?.find(r => r.points_required > totalPoints);
  const progressToNext = nextReward 
    ? Math.min((totalPoints / nextReward.points_required) * 100, 100)
    : 100;
  const pointsToNext = nextReward ? nextReward.points_required - totalPoints : 0;
  const claimableRewards = rewards?.filter(r => r.points_required <= totalPoints) || [];

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'order_value_tiers':
      case 'first_order':
        return <ShoppingCart className="h-3.5 w-3.5" />;
      case 'timely_payment':
        return <CreditCard className="h-3.5 w-3.5" />;
      default:
        return <Award className="h-3.5 w-3.5" />;
    }
  };

  return (
    <>
      {/* Clickable Points Display */}
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-sm hover:bg-yellow-100/50 rounded-md px-2 py-1 transition-colors cursor-pointer group"
      >
        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        <span className="font-medium">{totalPoints.toLocaleString()} pts</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
      </button>

      {/* Breakdown Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md p-0 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-yellow-100 via-yellow-50 to-orange-50 p-4 border-b">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-yellow-200 rounded-lg">
                  <Star className="h-5 w-5 text-yellow-700 fill-yellow-500" />
                </div>
                <div>
                  <span className="text-2xl font-bold">{totalPoints.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground ml-1">points</span>
                </div>
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{programData.program_name}</p>
            </DialogHeader>

            {/* Progress to next reward */}
            {nextReward && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1 font-medium">
                    <Target className="h-3.5 w-3.5 text-primary" />
                    Next: {nextReward.reward_name}
                  </span>
                  <span className="text-muted-foreground">{pointsToNext.toLocaleString()} pts to go</span>
                </div>
                <Progress value={progressToNext} className="h-2.5" />
              </div>
            )}
          </div>

          <ScrollArea className="max-h-[60vh]">
            <div className="p-4 space-y-5">
              {/* Claimable Rewards */}
              {claimableRewards.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Gift className="h-4 w-4 text-green-600" />
                    Claimable Rewards
                  </h3>
                  <div className="space-y-2">
                    {claimableRewards.map(reward => (
                      <div 
                        key={reward.id}
                        className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{reward.reward_name}</p>
                          <p className="text-xs text-muted-foreground">{reward.points_required} pts required</p>
                        </div>
                        <Badge className="bg-green-600 text-white">Eligible</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cross-sell Suggestions */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  How to Earn More Points
                </h3>
              <LoyaltyCrossSellCard 
                retailerId={retailerId}
                actions={actions.map(a => ({ 
                  id: a.id,
                  action_type: a.action_type,
                  action_name: a.action_name,
                  points: a.points,
                  target_config: a.target_config as Record<string, any> || {} 
                }))}
                currentPoints={totalPoints}
                nextReward={nextReward || null}
              />
              </div>

              {/* Points History */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-600" />
                  Recent Points Earned
                </h3>
                {pointsHistory && pointsHistory.length > 0 ? (
                  <div className="space-y-2">
                    {pointsHistory.map((entry: any) => (
                      <div 
                        key={entry.id}
                        className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-primary/10 rounded">
                            {getActionIcon(entry.retailer_loyalty_actions?.action_type)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {entry.retailer_loyalty_actions?.action_name || 'Points Earned'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(entry.earned_at), 'dd MMM yyyy')}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="font-bold">
                          +{entry.points}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No points earned yet. Complete orders to start earning!
                  </p>
                )}
              </div>

              {/* Conversion Rate */}
              <div className="flex items-center justify-center gap-2 p-3 bg-muted/50 rounded-lg">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm">
                  <strong>{programData.points_to_rupee_conversion} points</strong> = ₹1 value
                </span>
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t bg-muted/20">
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}