import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Star, Gift, ArrowUp, ArrowDown, Target, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RetailerLoyaltyModalProps {
  retailerId: string;
  retailerName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function RetailerLoyaltyModal({
  retailerId,
  retailerName,
  isOpen,
  onClose,
}: RetailerLoyaltyModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  // Get total points
  const { data: totalPoints = 0 } = useQuery({
    queryKey: ["retailer-loyalty-points", retailerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_points")
        .select("points")
        .eq("retailer_id", retailerId);
      if (error) throw error;
      return data?.reduce((sum, p) => sum + p.points, 0) || 0;
    },
    enabled: isOpen && !!retailerId,
  });

  // Get point transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ["retailer-loyalty-transactions", retailerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_points")
        .select("id, points, reference_type, description, earned_at")
        .eq("retailer_id", retailerId)
        .order("earned_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!retailerId,
  });

  // Get current subscription
  const { data: currentSubscription } = useQuery({
    queryKey: ["retailer-gift-subscription", retailerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_gift_subscriptions")
        .select(`
          *,
          gift:retailer_loyalty_gifts(*)
        `)
        .eq("retailer_id", retailerId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!retailerId,
  });

  // Get available gifts
  const { data: availableGifts = [] } = useQuery({
    queryKey: ["available-loyalty-gifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_gifts")
        .select("*")
        .eq("is_active", true)
        .order("points_required", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
  });

  // Subscribe to gift mutation
  const subscribeMutation = useMutation({
    mutationFn: async (giftId: string) => {
      // Cancel current subscription if exists
      if (currentSubscription) {
        await supabase
          .from("retailer_gift_subscriptions")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", currentSubscription.id);
      }

      // Create new subscription
      const { error } = await supabase
        .from("retailer_gift_subscriptions")
        .insert({
          retailer_id: retailerId,
          gift_id: giftId,
          points_at_subscription: totalPoints,
          status: "active",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-gift-subscription", retailerId] });
      toast.success("Successfully subscribed to gift goal!");
    },
    onError: () => {
      toast.error("Failed to subscribe to gift");
    },
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!currentSubscription) return;
      const { error } = await supabase
        .from("retailer_gift_subscriptions")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", currentSubscription.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-gift-subscription", retailerId] });
      toast.success("Subscription cancelled");
    },
  });

  // Redeem gift mutation
  const redeemMutation = useMutation({
    mutationFn: async () => {
      if (!currentSubscription) return;
      const { error } = await supabase
        .from("retailer_gift_redemptions")
        .insert({
          retailer_id: retailerId,
          gift_id: currentSubscription.gift_id,
          subscription_id: currentSubscription.id,
          points_redeemed: (currentSubscription.gift as any)?.points_required || 0,
          status: "pending",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-gift-subscription", retailerId] });
      toast.success("Redemption request submitted!");
    },
  });

  const currentGift = currentSubscription?.gift as any;
  const progressPoints = totalPoints - (currentSubscription?.points_at_subscription || 0);
  const targetPoints = currentGift?.points_required || 0;
  const progressPercent = targetPoints > 0 ? Math.min(100, (progressPoints / targetPoints) * 100) : 0;
  const canRedeem = totalPoints >= targetPoints && targetPoints > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            Loyalty Points
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Points Balance */}
          <div className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{retailerName || "Retailer"}</p>
                <p className="text-3xl font-bold text-yellow-700">{totalPoints.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Points</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <Star className="h-8 w-8 text-yellow-600 fill-yellow-500" />
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Goal</TabsTrigger>
              <TabsTrigger value="gifts">Gifts</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {/* Current Goal Tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              {currentSubscription && currentGift ? (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Target className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold">{currentGift.gift_name}</h4>
                        <p className="text-sm text-muted-foreground">{currentGift.description}</p>
                        <div className="mt-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span>{progressPoints.toLocaleString()} pts earned</span>
                            <span>{targetPoints.toLocaleString()} pts needed</span>
                          </div>
                          <Progress value={progressPercent} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {progressPercent.toFixed(0)}% complete
                          </p>
                        </div>
                        <div className="flex gap-2 mt-4">
                          {canRedeem ? (
                            <Button 
                              size="sm" 
                              onClick={() => redeemMutation.mutate()}
                              disabled={redeemMutation.isPending}
                            >
                              {redeemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                              Redeem Now
                            </Button>
                          ) : null}
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => cancelMutation.mutate()}
                            disabled={cancelMutation.isPending}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Change Goal
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-6">
                  <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No active goal</p>
                  <p className="text-sm text-muted-foreground">Select a gift from the Gifts tab to set your goal</p>
                </div>
              )}
            </TabsContent>

            {/* Available Gifts Tab */}
            <TabsContent value="gifts" className="space-y-3 mt-4">
              {availableGifts.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No gifts available</p>
              ) : (
                availableGifts.map((gift) => {
                  const isCurrentGoal = currentSubscription?.gift_id === gift.id;
                  const canAfford = totalPoints >= gift.points_required;
                  
                  return (
                    <Card key={gift.id} className={isCurrentGoal ? "border-primary" : ""}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-pink-100 rounded-lg">
                            <Gift className="h-5 w-5 text-pink-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{gift.gift_name}</p>
                              {isCurrentGoal && (
                                <Badge variant="secondary" className="text-xs">Current</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{gift.description}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              <span className="text-sm font-semibold">{gift.points_required?.toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground">pts</span>
                              {canAfford && !isCurrentGoal && (
                                <Badge variant="outline" className="ml-2 text-xs text-green-600 border-green-300">
                                  Eligible
                                </Badge>
                              )}
                            </div>
                          </div>
                          {!isCurrentGoal && (
                            <Button
                              size="sm"
                              variant={canAfford ? "default" : "outline"}
                              onClick={() => subscribeMutation.mutate(gift.id)}
                              disabled={subscribeMutation.isPending}
                            >
                              {subscribeMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : canAfford ? (
                                "Redeem"
                              ) : (
                                "Set Goal"
                              )}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-2 mt-4">
              {transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No transactions yet</p>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                    <div className={`p-1.5 rounded-full ${tx.points >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                      {tx.points >= 0 ? (
                        <ArrowUp className="h-3 w-3 text-green-600" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.reference_type || "Points"}</p>
                      {tx.description && (
                        <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${tx.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.points >= 0 ? '+' : ''}{tx.points}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.earned_at), "dd MMM")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
