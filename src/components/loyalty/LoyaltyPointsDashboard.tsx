import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Star, Search, User, TrendingUp, Gift, ArrowUp, ArrowDown, Calendar } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface RetailerPoints {
  retailer_id: string;
  total_points: number;
  retailer?: {
    retailer_name: string;
    phone: string | null;
    beat_id: string | null;
  };
}

interface PointTransaction {
  id: string;
  retailer_id: string;
  points: number;
  reference_type: string | null;
  description: string | null;
  earned_at: string;
  parameter?: {
    parameter_name: string;
    parameter_type: string;
  } | null;
}

export function LoyaltyPointsDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string>("all");
  const [selectedRetailer, setSelectedRetailer] = useState<RetailerPoints | null>(null);

  const { data: plans } = useQuery({
    queryKey: ["retailer-loyalty-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_plans")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: pointsSummary, isLoading } = useQuery({
    queryKey: ["retailer-points-summary"],
    queryFn: async () => {
      // Get aggregated points per retailer
      const { data: points, error: pointsError } = await supabase
        .from("retailer_loyalty_points")
        .select("retailer_id, points");
      
      if (pointsError) throw pointsError;

      // Aggregate points by retailer
      const aggregated = (points || []).reduce((acc: Record<string, number>, curr: any) => {
        acc[curr.retailer_id] = (acc[curr.retailer_id] || 0) + (curr.points || 0);
        return acc;
      }, {});

      // Get retailer details
      const retailerIds = Object.keys(aggregated);
      if (retailerIds.length === 0) return [];

      const { data: retailers, error: retailersError } = await supabase
        .from("retailers")
        .select("id, name, phone, beat_id")
        .in("id", retailerIds);

      if (retailersError) throw retailersError;

      return retailerIds.map(id => {
        const retailer = (retailers || []).find((r: any) => r.id === id);
        return {
          retailer_id: id,
          total_points: aggregated[id],
          retailer: retailer ? {
            retailer_name: retailer.name,
            phone: retailer.phone,
            beat_id: retailer.beat_id,
          } : undefined,
        };
      }).sort((a, b) => b.total_points - a.total_points) as RetailerPoints[];
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ["retailer-point-transactions", selectedRetailer?.retailer_id],
    queryFn: async () => {
      if (!selectedRetailer?.retailer_id) return [];
      
      const { data, error } = await supabase
        .from("retailer_loyalty_points")
        .select(`
          id,
          retailer_id,
          points,
          reference_type,
          description,
          earned_at,
          parameter:retailer_loyalty_parameters(parameter_name, parameter_type)
        `)
        .eq("retailer_id", selectedRetailer.retailer_id)
        .order("earned_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as unknown as PointTransaction[];
    },
    enabled: !!selectedRetailer?.retailer_id,
  });

  const { data: stats } = useQuery({
    queryKey: ["loyalty-stats"],
    queryFn: async () => {
      const { data: points } = await supabase
        .from("retailer_loyalty_points")
        .select("points");
      
      const { count: subscriptionCount } = await supabase
        .from("retailer_gift_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      const { count: redemptionCount } = await supabase
        .from("retailer_gift_redemptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "fulfilled");

      const totalPoints = points?.reduce((sum, p) => sum + p.points, 0) || 0;
      const uniqueRetailers = new Set(pointsSummary?.map(p => p.retailer_id)).size;

      return {
        totalPoints,
        uniqueRetailers,
        activeSubscriptions: subscriptionCount || 0,
        fulfilledRedemptions: redemptionCount || 0,
      };
    },
    enabled: !!pointsSummary,
  });

  const filteredSummary = pointsSummary?.filter((item) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.retailer?.retailer_name?.toLowerCase().includes(search) ||
      item.retailer?.phone?.toLowerCase().includes(search)
    );
  });

  const maxPoints = Math.max(...(filteredSummary?.map(p => p.total_points) || [1]));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Points Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            View retailer loyalty points and transaction history
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search retailer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Points</p>
                <p className="text-2xl font-bold">{stats?.totalPoints?.toLocaleString() || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Retailers Earning</p>
                <p className="text-2xl font-bold">{stats?.uniqueRetailers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Goals</p>
                <p className="text-2xl font-bold">{stats?.activeSubscriptions || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Gift className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gifts Redeemed</p>
                <p className="text-2xl font-bold">{stats?.fulfilledRedemptions || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Retailers List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">Loading points data...</div>
      ) : filteredSummary?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No points data found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Retailer Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredSummary?.slice(0, 20).map((item, index) => (
                <div
                  key={item.retailer_id}
                  className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => setSelectedRetailer(item)}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.retailer?.retailer_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.retailer?.phone || "No phone"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-bold">{item.total_points.toLocaleString()}</span>
                    </div>
                    <Progress 
                      value={(item.total_points / maxPoints) * 100} 
                      className="h-1.5 w-20 mt-1" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History Dialog */}
      <Dialog open={!!selectedRetailer} onOpenChange={() => setSelectedRetailer(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Points History</DialogTitle>
          </DialogHeader>
          {selectedRetailer && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{selectedRetailer.retailer?.retailer_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedRetailer.retailer?.phone}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <span className="text-2xl font-bold">{selectedRetailer.total_points.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Total Points</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Recent Transactions</h4>
                {transactions?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
                ) : (
                  <div className="space-y-2">
                    {transactions?.map((tx) => (
                      <div key={tx.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className={`p-1.5 rounded-full ${tx.points >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                          {tx.points >= 0 ? (
                            <ArrowUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {tx.parameter?.parameter_name || tx.reference_type || "Points"}
                          </p>
                          {tx.description && (
                            <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${tx.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.points >= 0 ? '+' : ''}{tx.points}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.earned_at), "dd MMM")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
