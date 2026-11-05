import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Gift, Star } from "lucide-react";

export function LoyaltyAnalytics() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["retailer-loyalty-analytics"],
    queryFn: async () => {
      // Get all points
      const { data: allPoints } = await supabase
        .from("retailer_loyalty_points")
        .select("points, action_id, retailer_id, retailer_loyalty_actions(action_name, action_type)");

      // Get redemptions
      const { data: redemptions } = await supabase
        .from("retailer_loyalty_redemptions")
        .select("status, voucher_amount, points_redeemed");

      // Calculate stats
      const totalPoints = allPoints?.reduce((sum, p) => sum + Number(p.points), 0) || 0;
      const uniqueRetailers = new Set(allPoints?.map((p) => p.retailer_id)).size;
      
      const redemptionStats = redemptions?.reduce(
        (acc, r) => {
          if (r.status === "approved") {
            acc.approved += 1;
            acc.totalValue += Number(r.voucher_amount);
            acc.pointsRedeemed += Number(r.points_redeemed);
          } else if (r.status === "pending") {
            acc.pending += 1;
          }
          return acc;
        },
        { approved: 0, pending: 0, totalValue: 0, pointsRedeemed: 0 }
      ) || { approved: 0, pending: 0, totalValue: 0, pointsRedeemed: 0 };

      // Action-wise breakdown
      const actionBreakdown = allPoints?.reduce((acc: any, p: any) => {
        const actionName = p.retailer_loyalty_actions?.action_name || "Unknown";
        if (!acc[actionName]) {
          acc[actionName] = { points: 0, count: 0 };
        }
        acc[actionName].points += Number(p.points);
        acc[actionName].count += 1;
        return acc;
      }, {});

      return {
        totalPoints,
        uniqueRetailers,
        redemptionStats,
        actionBreakdown: Object.entries(actionBreakdown || {})
          .map(([name, data]: [string, any]) => ({ name, ...data }))
          .sort((a, b) => b.points - a.points),
      };
    },
  });

  if (isLoading) return <div>Loading analytics...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Loyalty Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Performance metrics and insights
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.totalPoints.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Retailers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.uniqueRetailers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redemptions</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.redemptionStats.approved}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics?.redemptionStats.pending} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voucher Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{analytics?.redemptionStats.totalValue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Points by Action Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics?.actionBreakdown.map((action: any) => (
              <div key={action.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{action.name}</span>
                  <span className="text-muted-foreground">
                    {action.points} pts ({action.count} times)
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{
                      width: `${(action.points / analytics.totalPoints) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
