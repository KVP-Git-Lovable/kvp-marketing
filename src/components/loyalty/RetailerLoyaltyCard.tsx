import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from '@/lib/supabaseLoose';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Gift, TrendingUp, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { RetailerTierBadge } from "./RetailerTierBadge";

interface RetailerLoyaltyCardProps {
  retailerId: string;
  fseUserId: string;
}

export function RetailerLoyaltyCard({ retailerId, fseUserId }: RetailerLoyaltyCardProps) {
  const [isRedemptionOpen, setIsRedemptionOpen] = useState(false);
  const queryClient = useQueryClient();

  // Get total points for this retailer
  const { data: pointsData, isLoading } = useQuery({
    queryKey: ["retailer-loyalty-points", retailerId],
    queryFn: async () => {
      // Only the five most recent, for the activity list below.
      const { data: points } = await supabase
        .from("retailer_loyalty_points")
        .select("points, earned_at, retailer_loyalty_actions(action_name)")
        .eq("retailer_id", retailerId)
        .order("earned_at", { ascending: false })
        .limit(5);

      const { data: redeemed } = await supabase
        .from("retailer_loyalty_redemptions")
        .select("points_redeemed")
        .eq("retailer_id", retailerId)
        .eq("status", "approved");

      // Totals come from the view, NOT from `points` above — that query is
      // capped at 5 rows, so summing it reported the last five awards as if
      // they were the retailer's entire history.
      const { data: standing } = await supabase
        .from("v_retailer_loyalty_status")
        .select("lifetime_points")
        .eq("retailer_id", retailerId)
        .maybeSingle();

      const totalEarned = Number(standing?.lifetime_points ?? 0);
      const totalRedeemed = redeemed?.reduce((sum, r) => sum + Number(r.points_redeemed), 0) || 0;

      // Get active program for conversion rate
      const { data: program } = await supabase
        .from("retailer_loyalty_programs")
        .select("points_to_rupee_conversion")
        .eq("is_active", true)
        .single();

      return {
        totalEarned,
        totalRedeemed,
        available: totalEarned - totalRedeemed,
        recentActivities: points || [],
        conversionRate: program?.points_to_rupee_conversion || 10,
      };
    },
  });

  const claimMutation = useMutation({
    mutationFn: async (points: number) => {
      const { data: program } = await supabase
        .from("retailer_loyalty_programs")
        .select("id, points_to_rupee_conversion")
        .eq("is_active", true)
        .single();

      if (!program) throw new Error("No active program");

      const voucherAmount = points / program.points_to_rupee_conversion;

      const { error } = await supabase.from("retailer_loyalty_redemptions").insert({
        retailer_id: retailerId,
        program_id: program.id,
        points_redeemed: points,
        voucher_amount: voucherAmount,
        requested_by_user_id: fseUserId,
        status: "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-points", retailerId] });
      toast.success("Voucher claim submitted for approval");
      setIsRedemptionOpen(false);
    },
    onError: () => toast.error("Failed to submit claim"),
  });

  if (isLoading) return <div>Loading loyalty points...</div>;

  const available = pointsData?.available || 0;
  const voucherValue = available / (pointsData?.conversionRate || 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Loyalty Points
          </span>
          {/* Badge sits in the header so the retailer's standing reads before
              the numbers do. Progress is shown here and nowhere else, to keep
              one place answering "what gets me to the next tier?". */}
          <RetailerTierBadge retailerId={retailerId} size="md" showProgress />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Points Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Points</p>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              <span className="text-2xl font-bold">{available}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Voucher Value</p>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">₹{voucherValue.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="text-xs text-muted-foreground text-center p-2 bg-muted rounded">
          {pointsData?.conversionRate} points = ₹1
        </div>

        {/* Recent Activities */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Recent Activities</p>
          {pointsData?.recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet</p>
          ) : (
            <div className="space-y-1">
              {pointsData?.recentActivities.map((activity: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-xs p-2 bg-muted rounded"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      +{activity.points}
                    </Badge>
                    <span>{activity.retailer_loyalty_actions?.action_name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(activity.earned_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Dialog open={isRedemptionOpen} onOpenChange={setIsRedemptionOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1" disabled={available < 100}>
                <Gift className="h-4 w-4 mr-2" />
                Claim Voucher
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Claim Loyalty Voucher</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Available Points:</span>
                    <span className="font-bold">{available}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Voucher Value:</span>
                    <span className="font-bold">₹{voucherValue.toFixed(0)}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  This request will be sent to admin for approval. Once approved, you'll
                  receive a voucher code.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => claimMutation.mutate(available)}
                    className="flex-1"
                    disabled={claimMutation.isPending}
                  >
                    Submit Claim
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsRedemptionOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {available < 100 && (
          <p className="text-xs text-center text-muted-foreground">
            Minimum 100 points required to claim voucher
          </p>
        )}
      </CardContent>
    </Card>
  );
}
