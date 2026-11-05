import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, DollarSign, Users, MapPin, Package } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format, subDays, startOfMonth } from "date-fns";

type OrderRecord = { id: string; total_amount: number; created_at: string };
type VisitRecord = { id: string; created_at: string };
type RetailerRecord = { created_at: string };
type OrderItemRecord = { quantity: number; product_id: string };
type ProductRecord = { id: string; name: string };

interface PerformanceMetrics {
  totalSales: number;
  totalOrders: number;
  totalVisits: number;
  productiveVisits: number;
  newRetailers: number;
  avgOrderValue: number;
  monthlyGrowth: number;
  topProducts: Array<{ name: string; quantity: number }>;
}

interface ChartData {
  date: string;
  sales: number;
  orders: number;
}

export function PerformanceDashboard({ userId }: { userId: string }) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalSales: 0,
    totalOrders: 0,
    totalVisits: 0,
    productiveVisits: 0,
    newRetailers: 0,
    avgOrderValue: 0,
    monthlyGrowth: 0,
    topProducts: [],
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformanceData();
  }, [userId]);

  const fetchPerformanceData = async () => {
    setLoading(true);
    const now = new Date();
    const monthStart = startOfMonth(now);

    try {
      // Fetch orders
      
      const ordersQuery = supabase
        .from("orders")
        .select("id, total_amount, created_at")
        .eq("created_by", userId)
        .gte("created_at", monthStart.toISOString()) as unknown as any;
      const ordersResult = await ordersQuery;
      const orders = (ordersResult.data as OrderRecord[]) || [];

      // Fetch order items and products separately
      const orderIds = orders.map(o => o.id).filter(Boolean);
      let topProducts: Array<{ name: string; quantity: number }> = [];
      
      if (orderIds.length > 0) {
        const orderItemsQuery = supabase
          .from("order_items")
          .select("quantity, product_id")
          .in("order_id", orderIds) as unknown as any;
        const orderItemsResult = await orderItemsQuery;
        const orderItems = (orderItemsResult.data as OrderItemRecord[]) || [];
        
        // Fetch product names
        const productIds = [...new Set(orderItems.map(item => item.product_id))];
        const productsQuery = supabase
          .from("products")
          .select("id, name")
          .in("id", productIds) as unknown as any;
        const productsResult = await productsQuery;
        const products = (productsResult.data as ProductRecord[]) || [];
        const productMap = new Map(products.map(p => [p.id, p.name]));
        
        // Calculate top products
        const quantityMap = new Map<string, number>();
        orderItems.forEach((item) => {
          const productName = productMap.get(item.product_id) || "Unknown";
          quantityMap.set(productName, (quantityMap.get(productName) || 0) + item.quantity);
        });
        
        topProducts = Array.from(quantityMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, quantity]) => ({ name, quantity }));
      }

      // Fetch visits
      
      const visitsQuery = supabase
        .from("visits")
        .select("id, created_at")
        .eq("created_by", userId)
        .gte("created_at", monthStart.toISOString()) as unknown as any;
      const visitsResult = await visitsQuery;
      const visits = (visitsResult.data as VisitRecord[]) || [];

      // Count productive visits
      let productiveVisits = 0;
      if (visits.length > 0) {
        const visitIds = visits.map(v => v.id);
        const visitOrdersQuery = supabase
          .from("orders")
          .select("visit_id")
          .in("visit_id", visitIds) as unknown as any;
        const visitOrdersResult = await visitOrdersQuery;
        const visitOrders = (visitOrdersResult.data as Array<{ visit_id: string | null }>) || [];
        const uniqueVisitIds = new Set(visitOrders.map(o => o.visit_id).filter(Boolean));
        productiveVisits = uniqueVisitIds.size;
      }

      // Fetch retailers
      
      const retailersQuery = supabase
        .from("retailers")
        .select("created_at")
        .eq("created_by", userId)
        .gte("created_at", monthStart.toISOString()) as unknown as any;
      const retailersResult = await retailersQuery;
      const retailers = (retailersResult.data as RetailerRecord[]) || [];

      // Previous month data
      const prevMonthStart = startOfMonth(subDays(monthStart, 1));
      const prevOrdersQuery = supabase
        .from("orders")
        .select("total_amount")
        .eq("created_by", userId)
        .gte("created_at", prevMonthStart.toISOString())
        .lt("created_at", monthStart.toISOString()) as unknown as any;
      const prevOrdersResult = await prevOrdersQuery;
      const prevOrders = (prevOrdersResult.data as Array<{ total_amount: number }>) || [];

      // Calculate metrics
      const totalSales = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const totalOrders = orders.length;
      const totalVisits = visits.length;
      const newRetailers = retailers.length;
      const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

      const prevSales = prevOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const monthlyGrowth = prevSales > 0 ? ((totalSales - prevSales) / prevSales) * 100 : 0;

      // Generate chart data for last 7 days
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(now, 6 - i);
        const dayOrders = orders.filter(
          (o) => format(new Date(o.created_at), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
        );
        return {
          date: format(date, "MMM dd"),
          sales: dayOrders.reduce((sum, o) => sum + o.total_amount, 0),
          orders: dayOrders.length,
        };
      });

      setMetrics({
        totalSales,
        totalOrders,
        totalVisits,
        productiveVisits,
        newRetailers,
        avgOrderValue,
        monthlyGrowth,
        topProducts,
      });
      setChartData(last7Days);
    } catch (error) {
      console.error("Error fetching performance data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{metrics.totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {metrics.monthlyGrowth >= 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">+{metrics.monthlyGrowth.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-600" />
                  <span className="text-red-600">{metrics.monthlyGrowth.toFixed(1)}%</span>
                </>
              )}
              <span>from last month</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg: ₹{metrics.avgOrderValue.toFixed(0)} per order
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Visits</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalVisits}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.productiveVisits} productive 
              {metrics.totalVisits > 0 && ` (${((metrics.productiveVisits / metrics.totalVisits) * 100).toFixed(0)}%)`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New Retailers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.newRetailers}</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sales Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                sales: {
                  label: "Sales",
                  color: "hsl(var(--primary))",
                },
              }}
              className="h-[250px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="sales" stroke="var(--color-sales)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Products</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.topProducts.length > 0 ? (
              <ChartContainer
                config={{
                  quantity: {
                    label: "Quantity",
                    color: "hsl(var(--chart-1))",
                  },
                }}
                className="h-[250px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.topProducts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="quantity" fill="var(--color-quantity)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No product data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
