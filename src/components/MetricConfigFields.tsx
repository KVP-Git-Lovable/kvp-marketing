import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MetricConfigFieldsProps {
  metricType: string;
  config: any;
  onConfigChange: (config: any) => void;
}

export function MetricConfigFields({ metricType, config, onConfigChange }: MetricConfigFieldsProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [focusedProducts, setFocusedProducts] = useState<string[]>(config?.focused_products || []);

  useEffect(() => {
    if (metricType === "focused_product_sales") {
      fetchFocusedProducts();
    }
  }, [metricType]);

  const fetchFocusedProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, is_focused_product")
      .eq("is_focused_product", true)
      .eq("is_active", true);
    
    if (data) {
      setProducts(data);
      // Auto-save focused product IDs to config
      const productIds = data.map(p => p.id);
      handleConfigUpdate("focused_products", productIds);
    }
  };

  const handleConfigUpdate = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    onConfigChange(newConfig);
  };

  switch (metricType) {
    case "first_order_new_retailer":
      return (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <h4 className="font-semibold text-sm">Configuration</h4>
          <div>
            <Label htmlFor="maxActivities">Maximum Awardable Activities</Label>
            <Input
              id="maxActivities"
              type="number"
              min="1"
              value={config?.max_awardable_activities || 2}
              onChange={(e) => handleConfigUpdate("max_awardable_activities", parseInt(e.target.value))}
              placeholder="e.g., 2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum number of times this metric can be awarded per retailer
            </p>
          </div>
        </div>
      );

    case "daily_target":
      return (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <h4 className="font-semibold text-sm">Configuration</h4>
          <div>
            <Label htmlFor="targetType">Target Type</Label>
            <Select 
              value={config?.target_type || "quantity"} 
              onValueChange={(value) => handleConfigUpdate("target_type", value)}
            >
              <SelectTrigger id="targetType">
                <SelectValue placeholder="Select target type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quantity">Quantity (from My Target)</SelectItem>
                <SelectItem value="revenue">Revenue (from My Target)</SelectItem>
                <SelectItem value="visits">Productive Visits (from My Target)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Select which target type from user's assigned business plan to track
            </p>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-800">
              <strong>How it works:</strong> Points are awarded when the user meets their daily target 
              as assigned in Target Management (My Target). The daily target is calculated from their 
              monthly target divided by working days.
            </p>
          </div>
        </div>
      );

    case "focused_product_sales":
      return (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <h4 className="font-semibold text-sm">Configuration</h4>
          <div>
            <Label>Focused Products (Auto-detected)</Label>
            <div className="mt-2 space-y-2">
              {products.length > 0 ? (
                products.map((product) => (
                  <div key={product.id} className="text-sm p-2 border rounded bg-background">
                    {product.name}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No focused products configured. Set products as "Focused" in Product Management.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Points are awarded automatically when orders contain focused products
            </p>
          </div>
        </div>
      );

    case "productive_visit":
      return (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <h4 className="font-semibold text-sm">Configuration</h4>
          <div>
            <Label htmlFor="maxDailyAwards">Maximum Daily Awards</Label>
            <Input
              id="maxDailyAwards"
              type="number"
              min="1"
              value={config?.max_daily_awards || 5}
              onChange={(e) => handleConfigUpdate("max_daily_awards", parseInt(e.target.value))}
              placeholder="e.g., 5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum productive visits that can earn points per day
            </p>
          </div>
        </div>
      );

    case "order_frequency":
      return (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <h4 className="font-semibold text-sm">Configuration</h4>
          <div>
            <Label htmlFor="consecutiveOrders">Consecutive Orders Required</Label>
            <Input
              id="consecutiveOrders"
              type="number"
              min="2"
              value={config?.consecutive_orders_required || 2}
              onChange={(e) => handleConfigUpdate("consecutive_orders_required", parseInt(e.target.value))}
              placeholder="e.g., 2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Points awarded on the 2nd, 3rd, 4th... consecutive order from same retailer. Resets if sequence breaks.
            </p>
          </div>
        </div>
      );

    case "beat_growth":
      return (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <h4 className="font-semibold text-sm">Configuration</h4>
          <div>
            <Label htmlFor="minGrowth">Minimum Growth % Target</Label>
            <Input
              id="minGrowth"
              type="number"
              min="0"
              step="0.1"
              value={config?.min_growth_percentage || 7}
              onChange={(e) => handleConfigUpdate("min_growth_percentage", parseFloat(e.target.value))}
              placeholder="e.g., 7"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Minimum percentage growth vs. prior period to earn points
            </p>
          </div>
        </div>
      );

    case "competition_insight":
    case "retailer_feedback":
    case "branding_request":
      return (
        <div className="p-4 border rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            <strong>Unlimited awards:</strong> Points are awarded automatically upon each successful form submission.
            No additional configuration required.
          </p>
        </div>
      );

    case "total_visits":
      return (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <h4 className="font-semibold text-sm">Configuration</h4>
          <div>
            <Label htmlFor="dailyVisitTarget">Daily Visit Target</Label>
            <Input
              id="dailyVisitTarget"
              type="number"
              min="1"
              value={config?.daily_visit_target || 50}
              onChange={(e) => handleConfigUpdate("daily_visit_target", parseInt(e.target.value))}
              placeholder="e.g., 50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Minimum number of total visits required per day to earn points
            </p>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-xs text-amber-800">
              <strong>Note:</strong> Points are only awarded when the user meets or exceeds the target. 
              Partial completion does not award any points.
            </p>
          </div>
        </div>
      );

    default:
      return null;
  }
}