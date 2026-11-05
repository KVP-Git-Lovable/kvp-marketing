import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Calendar, ShoppingCart, Target, DollarSign, Wallet } from "lucide-react";

interface RetailerPerformanceAnalyticsProps {
  lastOrderDate?: string | null;
  lastOrderValue?: number | null;
  avgMonthlyOrders?: number | null;
  avgOrderPerVisit?: number | null;
  totalVisits?: number | null;
  productiveVisits?: number | null;
  totalLifetimeOrderValue?: number | null;
  revenueGrowth12m?: number | null;
  totalOrderValueFy?: number | null;
}

export const RetailerPerformanceAnalytics = ({
  lastOrderDate,
  lastOrderValue,
  avgMonthlyOrders,
  avgOrderPerVisit,
  totalVisits,
  productiveVisits,
  totalLifetimeOrderValue,
  revenueGrowth12m,
  totalOrderValueFy
}: RetailerPerformanceAnalyticsProps) => {
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "₹0";
    return `₹${value.toLocaleString()}`;
  };

  const formatNumber = (value: number | null | undefined, decimals: number = 1) => {
    if (value === null || value === undefined) return "0";
    return value.toFixed(decimals);
  };

  const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "0%";
    const color = value >= 0 ? "text-green-600" : "text-red-600";
    const sign = value >= 0 ? "+" : "";
    return <span className={color}>{sign}{value.toFixed(1)}%</span>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Performance Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Last Order Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Last Order Date
            </div>
            <div className="text-lg font-semibold">{formatDate(lastOrderDate)}</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShoppingCart className="h-4 w-4" />
              Last Order Value
            </div>
            <div className="text-lg font-semibold">{formatCurrency(lastOrderValue)}</div>
          </div>

          {/* 3 Month Analytics */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Avg Monthly Orders
            </div>
            <div className="text-lg font-semibold">{formatNumber(avgMonthlyOrders)}</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              Avg Order Per Visit
            </div>
            <div className="text-lg font-semibold">{formatNumber(avgOrderPerVisit, 2)}</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Total Visits
            </div>
            <div className="text-lg font-semibold">{totalVisits ?? 0}</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShoppingCart className="h-4 w-4" />
              Productive Visits
            </div>
            <div className="text-lg font-semibold">
              {productiveVisits ?? 0}
              {totalVisits && totalVisits > 0 && (
                <span className="text-sm text-muted-foreground ml-2">
                  ({((productiveVisits ?? 0) / totalVisits * 100).toFixed(0)}%)
                </span>
              )}
            </div>
          </div>

          {/* Lifetime & FY Metrics */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Total Lifetime Order Value
            </div>
            <div className="text-lg font-semibold">{formatCurrency(totalLifetimeOrderValue)}</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Total Order Value FY
            </div>
            <div className="text-lg font-semibold">{formatCurrency(totalOrderValueFy)}</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Revenue Growth (Last 12 Months)
            </div>
            <div className="text-lg font-semibold">{formatPercentage(revenueGrowth12m)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
