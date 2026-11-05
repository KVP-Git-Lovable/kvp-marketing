import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Star, TrendingUp, Users, Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function RetailerPointsDashboard() {
  const [search, setSearch] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["retailer-loyalty-stats"],
    queryFn: async () => {
      const { data: points, error } = await supabase
        .from("retailer_loyalty_points")
        .select("points");
      
      const { data: retailers } = await supabase
        .from("retailer_loyalty_points")
        .select("retailer_id", { count: "exact" });

      const totalPoints = points?.reduce((sum, p) => sum + Number(p.points), 0) || 0;
      const uniqueRetailers = new Set(retailers?.map((r) => r.retailer_id)).size;

      return {
        totalPoints,
        uniqueRetailers,
        avgPointsPerRetailer: uniqueRetailers > 0 ? totalPoints / uniqueRetailers : 0,
      };
    },
  });

  const { data: retailerPoints, isLoading } = useQuery({
    queryKey: ["retailer-points-list", search],
    queryFn: async () => {
      let query = supabase
        .from("retailer_loyalty_points")
        .select(`
          retailer_id,
          retailers!inner(name, phone, territory_id)
        `);

      const { data, error } = await query;
      if (error) throw error;

      // Group by retailer and sum points
      const grouped = data?.reduce((acc: any, curr: any) => {
        const retailerId = curr.retailer_id;
        if (!acc[retailerId]) {
          acc[retailerId] = {
            retailer: curr.retailers,
            totalPoints: 0,
            retailer_id: retailerId,
          };
        }
        return acc;
      }, {});

      // Get total points for each retailer
      const { data: pointsSums } = await supabase
        .from("retailer_loyalty_points")
        .select("retailer_id, points");

      const pointsByRetailer = pointsSums?.reduce((acc: any, curr: any) => {
        if (!acc[curr.retailer_id]) acc[curr.retailer_id] = 0;
        acc[curr.retailer_id] += Number(curr.points);
        return acc;
      }, {});

      const result = Object.values(grouped || {}).map((item: any) => ({
        ...item,
        totalPoints: pointsByRetailer?.[item.retailer_id] || 0,
      }));

      // Filter by search
      return result.filter((r: any) =>
        r.retailer?.name?.toLowerCase().includes(search.toLowerCase())
      ).sort((a: any, b: any) => b.totalPoints - a.totalPoints);
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points Awarded</CardTitle>
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPoints.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Retailers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.uniqueRetailers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Points/Retailer</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avgPointsPerRetailer.toFixed(0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Retailer Points</CardTitle>
            <Input
              placeholder="Search retailers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : (
            <div className="space-y-2">
              {retailerPoints?.map((item: any, index: number) => (
                <div
                  key={item.retailer_id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <div>
                      <p className="font-medium">{item.retailer?.name}</p>
                      <p className="text-sm text-muted-foreground">{item.retailer?.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <span className="font-semibold">{item.totalPoints}</span>
                  </div>
                </div>
              ))}
              {retailerPoints?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No points awarded yet</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
