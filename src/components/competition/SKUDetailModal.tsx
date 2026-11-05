import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, TrendingUp, Package, MapPin } from "lucide-react";

interface SKUDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skuId: string;
  skuName: string;
  competitorName: string;
}

export const SKUDetailModal = ({ open, onOpenChange, skuId, skuName, competitorName }: SKUDetailModalProps) => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalObservations: 0,
    avgStock: 0,
    avgPrice: 0,
    trend: "stable" as "up" | "down" | "stable",
    topRetailers: [] as Array<{ name: string; count: number; avgStock: number }>,
    topRegions: [] as Array<{ region: string; count: number }>,
    demandLevel: "medium" as "high" | "medium" | "low"
  });

  useEffect(() => {
    if (open && skuId) {
      fetchSKUAnalytics();
    }
  }, [open, skuId]);

  const fetchSKUAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch competition data for this SKU
      const { data: compData, error } = await supabase
        .from('competition_data')
        .select('*')
        .eq('sku_id', skuId);

      if (error) throw error;

      if (compData && compData.length > 0) {
        // Get unique retailer IDs
        const retailerIds = [...new Set(compData.map(d => d.retailer_id))];
        
        // Fetch retailer data
        const { data: retailers } = await supabase
          .from('retailers')
          .select('id, name, location_tag')
          .in('id', retailerIds);

        const retailersMap = new Map(retailers?.map(r => [r.id, r]) || []);

        // Calculate analytics
        const totalObs = compData.length;
        const avgStock = compData.reduce((sum, d) => sum + (d.stock_quantity || 0), 0) / totalObs;
        const avgPrice = compData.reduce((sum, d) => sum + (d.selling_price || 0), 0) / totalObs;

        // Top retailers
        const retailerMap = new Map<string, { name: string; count: number; totalStock: number }>();
        compData.forEach(d => {
          const retailer = retailersMap.get(d.retailer_id);
          if (retailer) {
            const existing = retailerMap.get(d.retailer_id) || { name: retailer.name, count: 0, totalStock: 0 };
            existing.count++;
            existing.totalStock += d.stock_quantity || 0;
            retailerMap.set(d.retailer_id, existing);
          }
        });

        const topRetailers = Array.from(retailerMap.values())
          .map(r => ({ name: r.name, count: r.count, avgStock: r.totalStock / r.count }))
          .sort((a, b) => b.avgStock - a.avgStock)
          .slice(0, 5);

        // Top regions
        const regionMap = new Map<string, number>();
        compData.forEach(d => {
          const retailer = retailersMap.get(d.retailer_id);
          if (retailer?.location_tag) {
            regionMap.set(retailer.location_tag, (regionMap.get(retailer.location_tag) || 0) + 1);
          }
        });

        const topRegions = Array.from(regionMap.entries())
          .map(([region, count]) => ({ region, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Determine demand level
        let demandLevel: "high" | "medium" | "low" = "medium";
        if (avgStock > 50 || totalObs > 20) demandLevel = "high";
        else if (avgStock < 20 && totalObs < 10) demandLevel = "low";

        // Determine trend (simplified - based on observations)
        let trend: "up" | "down" | "stable" = "stable";
        if (totalObs > 15) trend = "up";
        else if (totalObs < 5) trend = "down";

        setAnalytics({
          totalObservations: totalObs,
          avgStock,
          avgPrice,
          trend,
          topRetailers,
          topRegions,
          demandLevel
        });
      }
    } catch (error) {
      console.error('Error fetching SKU analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {skuName} - Performance Analysis
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{competitorName}</p>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Observations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalObservations}</div>
                  <p className="text-xs text-muted-foreground">Total data points</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avg Stock</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.avgStock.toFixed(1)}</div>
                  <Badge variant={
                    analytics.demandLevel === 'high' ? 'default' :
                    analytics.demandLevel === 'low' ? 'secondary' : 'outline'
                  }>
                    {analytics.demandLevel} demand
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avg Price</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{analytics.avgPrice.toFixed(0)}</div>
                  <p className="text-xs text-muted-foreground">Market price</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`h-5 w-5 ${
                      analytics.trend === 'up' ? 'text-green-500' :
                      analytics.trend === 'down' ? 'text-red-500 rotate-180' :
                      'text-gray-500'
                    }`} />
                    <span className="text-lg font-bold capitalize">{analytics.trend}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Retailers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart className="h-4 w-4" />
                  Top Retailers by Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.topRetailers.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.topRetailers.map((retailer, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <div className="font-medium">{retailer.name}</div>
                          <div className="text-sm text-muted-foreground">{retailer.count} observations</div>
                        </div>
                        <Badge>{retailer.avgStock.toFixed(1)} avg</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No data available</p>
                )}
              </CardContent>
            </Card>

            {/* Top Regions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Top Regions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.topRegions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {analytics.topRegions.map((region, idx) => (
                      <Badge key={idx} variant="outline">
                        {region.region} ({region.count})
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No region data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};