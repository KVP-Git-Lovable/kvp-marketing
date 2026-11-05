import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Star, Gift, Target, Sparkles, TrendingUp, History, 
  ChevronRight, Award, ShoppingCart, CreditCard, Clock,
  CheckCircle, AlertCircle, Calendar, Package, Zap, X,
  ArrowUp, Trophy, Flame, Timer
} from "lucide-react";
import { format, differenceInDays, addMonths } from "date-fns";
import { toast } from "sonner";
import { GiftCard } from "./GiftCard";
import { EarnPointsCard } from "./EarnPointsCard";

interface RetailerLoyaltyHubProps {
  retailerId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function RetailerLoyaltyHub({ retailerId, isOpen, onClose }: RetailerLoyaltyHubProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();

  // Fetch retailer's total points
  const { data: pointsData } = useQuery({
    queryKey: ["retailer-total-points", retailerId],
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
      
      // Calculate previous score (points before today)
      const previousScore = total - todayPoints;
      
      return { total, todayPoints, previousScore };
    },
    enabled: isOpen,
  });

  // Fetch points history
  const { data: pointsHistory } = useQuery({
    queryKey: ["retailer-points-history", retailerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_points")
        .select(`
          id, points, earned_at, reference_type, reference_id,
          retailer_loyalty_parameters(parameter_name, parameter_type)
        `)
        .eq("retailer_id", retailerId)
        .order("earned_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  // Fetch all available gifts
  const { data: gifts } = useQuery({
    queryKey: ["available-gifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_gifts")
        .select("*")
        .eq("is_active", true)
        .order("points_required", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  // Fetch retailer's current subscription
  const { data: currentSubscription } = useQuery({
    queryKey: ["retailer-gift-subscription", retailerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_gift_subscriptions")
        .select(`
          *,
          retailer_loyalty_gifts(*)
        `)
        .eq("retailer_id", retailerId)
        .eq("status", "active")
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  // Fetch loyalty parameters for earning tips
  const { data: parameters } = useQuery({
    queryKey: ["loyalty-parameters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_parameters")
        .select("*")
        .eq("is_enabled", true)
        .order("points", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  // Subscribe to a gift
  const subscribeMutation = useMutation({
    mutationFn: async (giftId: string) => {
      const gift = gifts?.find(g => g.id === giftId);
      if (!gift) throw new Error("Gift not found");
      
      // Cancel existing subscription if any
      if (currentSubscription) {
        await supabase
          .from("retailer_gift_subscriptions")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", currentSubscription.id);
      }
      
      const targetDate = gift.target_duration_months 
        ? addMonths(new Date(), gift.target_duration_months)
        : addMonths(new Date(), 3);
      
      const { error } = await supabase
        .from("retailer_gift_subscriptions")
        .insert({
          retailer_id: retailerId,
          gift_id: giftId,
          target_date: targetDate.toISOString().split("T")[0],
          status: "active",
          points_at_subscription: pointsData?.total || 0,
          progress_points: pointsData?.total || 0,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-gift-subscription", retailerId] });
      toast.success("Gift goal set successfully!");
    },
    onError: () => {
      toast.error("Failed to set gift goal");
    },
  });

  // Request redemption
  const redeemMutation = useMutation({
    mutationFn: async () => {
      if (!currentSubscription) throw new Error("No active subscription");
      
      const { error } = await supabase
        .from("retailer_gift_redemptions")
        .insert({
          retailer_id: retailerId,
          gift_id: currentSubscription.gift_id,
          subscription_id: currentSubscription.id,
          points_redeemed: currentSubscription.retailer_loyalty_gifts?.points_required || 0,
          status: "pending",
        });
      
      if (error) throw error;
      
      // Update subscription status
      await supabase
        .from("retailer_gift_subscriptions")
        .update({ status: "redeemed", achieved_at: new Date().toISOString() })
        .eq("id", currentSubscription.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-gift-subscription", retailerId] });
      toast.success("Redemption request submitted!");
    },
    onError: () => {
      toast.error("Failed to submit redemption request");
    },
  });

  const totalPoints = pointsData?.total || 0;
  const todayPoints = pointsData?.todayPoints || 0;
  const previousScore = pointsData?.previousScore || 0;

  // Calculate subscription progress
  const subscriptionGift = currentSubscription?.retailer_loyalty_gifts;
  const pointsNeededForGift = subscriptionGift?.points_required || 0;
  const progressPercent = pointsNeededForGift > 0 
    ? Math.min((totalPoints / pointsNeededForGift) * 100, 100) 
    : 0;
  const pointsToGift = Math.max(pointsNeededForGift - totalPoints, 0);
  const canRedeem = totalPoints >= pointsNeededForGift && currentSubscription;
  const daysToTarget = currentSubscription?.target_date 
    ? differenceInDays(new Date(currentSubscription.target_date), new Date())
    : null;

  // Eligible gifts (can redeem immediately)
  const eligibleGifts = gifts?.filter(g => g.points_required <= totalPoints) || [];

  const getParameterIcon = (type: string) => {
    switch (type) {
      case "order_value": return <ShoppingCart className="h-4 w-4" />;
      case "payment_timeliness": return <CreditCard className="h-4 w-4" />;
      case "order_frequency": return <Calendar className="h-4 w-4" />;
      case "consecutive_orders": return <Flame className="h-4 w-4" />;
      case "new_product": return <Sparkles className="h-4 w-4" />;
      case "bulk_order": return <Package className="h-4 w-4" />;
      case "growth": return <TrendingUp className="h-4 w-4" />;
      default: return <Award className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 overflow-hidden max-h-[90vh]">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-400 p-5 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-3 right-3 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Trophy className="h-8 w-8" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/80">Loyalty Score</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{totalPoints.toLocaleString()}</span>
                <span className="text-sm text-white/80">points</span>
              </div>
            </div>
          </div>
          
          {/* Today's Earnings & Previous Score */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/15 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-white/80">
                <ArrowUp className="h-3 w-3" />
                Today's Earnings
              </div>
              <p className="text-lg font-bold mt-1">+{todayPoints}</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-white/80">
                <History className="h-3 w-3" />
                Previous Score
              </div>
              <p className="text-lg font-bold mt-1">{previousScore.toLocaleString()}</p>
            </div>
          </div>

          {/* Current Gift Goal Progress */}
          {currentSubscription && subscriptionGift && (
            <div className="mt-4 bg-white/15 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  <span className="text-sm font-medium">Goal: {subscriptionGift.gift_name}</span>
                </div>
                {daysToTarget !== null && daysToTarget > 0 && (
                  <Badge className="bg-white/20 text-white border-0 text-xs">
                    <Timer className="h-3 w-3 mr-1" />
                    {daysToTarget}d left
                  </Badge>
                )}
              </div>
              <div className="mt-2">
                <Progress value={progressPercent} className="h-2 bg-white/20" />
                <div className="flex justify-between mt-1 text-xs text-white/80">
                  <span>{totalPoints.toLocaleString()} pts</span>
                  <span>{pointsNeededForGift.toLocaleString()} pts</span>
                </div>
              </div>
              {canRedeem && (
                <Button 
                  size="sm" 
                  className="w-full mt-3 bg-white text-amber-600 hover:bg-white/90"
                  onClick={() => redeemMutation.mutate()}
                  disabled={redeemMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Redeem Now!
                </Button>
              )}
              {!canRedeem && (
                <p className="text-xs text-center mt-2 text-white/80">
                  {pointsToGift.toLocaleString()} more points to redeem
                </p>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-4 rounded-none border-b bg-background h-11">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="earn" className="text-xs">Earn</TabsTrigger>
            <TabsTrigger value="gifts" className="text-xs">Gifts</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[40vh]">
            {/* Overview Tab */}
            <TabsContent value="overview" className="p-4 space-y-4 mt-0">
              {/* Quick Actions */}
              {eligibleGifts.length > 0 && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <h3 className="font-semibold text-green-800">Ready to Redeem!</h3>
                    </div>
                    <p className="text-sm text-green-700 mb-3">
                      You have {eligibleGifts.length} gift{eligibleGifts.length > 1 ? 's' : ''} available to claim
                    </p>
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => setActiveTab("gifts")}
                    >
                      View Gifts <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Current Goal Reminder */}
              {!currentSubscription && gifts && gifts.length > 0 && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-5 w-5 text-amber-600" />
                      <h3 className="font-semibold text-amber-800">Set Your Gift Goal!</h3>
                    </div>
                    <p className="text-sm text-amber-700 mb-3">
                      Choose a gift to work towards and stay motivated
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="border-amber-400 text-amber-700 hover:bg-amber-100"
                      onClick={() => setActiveTab("gifts")}
                    >
                      Browse Gifts <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Top Ways to Earn */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Quick Ways to Earn Points
                </h3>
                <div className="space-y-2">
                  {parameters?.slice(0, 3).map((param) => (
                    <EarnPointsCard key={param.id} parameter={param} />
                  ))}
                  {parameters && parameters.length > 3 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-muted-foreground"
                      onClick={() => setActiveTab("earn")}
                    >
                      See all {parameters.length} ways to earn <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-600" />
                  Recent Activity
                </h3>
                {pointsHistory && pointsHistory.length > 0 ? (
                  <div className="space-y-2">
                    {pointsHistory.slice(0, 3).map((entry: any) => (
                      <div 
                        key={entry.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-primary/10 rounded">
                            {getParameterIcon(entry.retailer_loyalty_parameters?.parameter_type || entry.reference_type)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {entry.retailer_loyalty_parameters?.parameter_name || entry.reference_type || 'Points Earned'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(entry.earned_at), 'dd MMM, h:mm a')}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-green-100 text-green-700 border-0">
                          +{entry.points}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Card className="bg-muted/30">
                    <CardContent className="p-4 text-center">
                      <Star className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No points earned yet. Place orders to start earning!
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Earn Points Tab */}
            <TabsContent value="earn" className="p-4 space-y-3 mt-0">
              <p className="text-sm text-muted-foreground mb-4">
                Complete these actions to boost your loyalty score
              </p>
              {parameters?.map((param) => (
                <EarnPointsCard key={param.id} parameter={param} expanded />
              ))}
              {(!parameters || parameters.length === 0) && (
                <Card className="bg-muted/30">
                  <CardContent className="p-4 text-center">
                    <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No earning parameters configured yet
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Gifts Tab */}
            <TabsContent value="gifts" className="p-4 space-y-4 mt-0">
              {/* Current Goal */}
              {currentSubscription && subscriptionGift && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Your Current Goal
                  </h3>
                  <GiftCard 
                    gift={subscriptionGift}
                    currentPoints={totalPoints}
                    isSubscribed={true}
                    targetDate={currentSubscription.target_date}
                    onRedeem={() => redeemMutation.mutate()}
                    canRedeem={!!canRedeem}
                  />
                </div>
              )}

              {/* All Gifts */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" />
                  {currentSubscription ? "Other Gifts" : "Available Gifts"}
                </h3>
                <div className="space-y-3">
                  {gifts?.filter(g => g.id !== currentSubscription?.gift_id).map((gift) => (
                    <GiftCard 
                      key={gift.id}
                      gift={gift}
                      currentPoints={totalPoints}
                      onSubscribe={() => subscribeMutation.mutate(gift.id)}
                      isSubscribing={subscribeMutation.isPending}
                    />
                  ))}
                </div>
                {(!gifts || gifts.length === 0) && (
                  <Card className="bg-muted/30">
                    <CardContent className="p-4 text-center">
                      <Gift className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No gifts available at the moment
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="p-4 mt-0">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-blue-600" />
                Points History
              </h3>
              {pointsHistory && pointsHistory.length > 0 ? (
                <div className="space-y-2">
                  {pointsHistory.map((entry: any) => (
                    <div 
                      key={entry.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary/10 rounded">
                          {getParameterIcon(entry.retailer_loyalty_parameters?.parameter_type || entry.reference_type)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {entry.retailer_loyalty_parameters?.parameter_name || entry.reference_type || 'Points Earned'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(entry.earned_at), 'dd MMM yyyy, h:mm a')}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-700 border-0">
                        +{entry.points}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <Card className="bg-muted/30">
                  <CardContent className="p-4 text-center">
                    <History className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No points history yet
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
