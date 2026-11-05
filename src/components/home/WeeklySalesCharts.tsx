import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { startOfWeek, endOfWeek, format } from "date-fns";

interface SalesByProduct {
  product_name: string;
  total_sales: number;
}

interface RetailerRevenue {
  retailer_name: string;
  total_revenue: number;
  date: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export const WeeklySalesCharts = ({ userId }: { userId: string }) => {
  const [salesByProduct, setSalesByProduct] = useState<SalesByProduct[]>([]);
  const [topRetailers, setTopRetailers] = useState<RetailerRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeeklyData = async () => {
      try {
        setLoading(true);
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

        // Fetch orders for the week
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            total_amount,
            created_at,
            visit_id
          `)
          .eq('user_id', userId)
          .gte('created_at', format(weekStart, 'yyyy-MM-dd'))
          .lte('created_at', format(weekEnd, 'yyyy-MM-dd'));

        if (ordersError) throw ordersError;

        console.log('Weekly orders fetched:', orders?.length);

        // Fetch visits and retailers separately
        const visitIds = orders?.map(o => o.visit_id).filter(Boolean) || [];
        let visitsMap = new Map();
        
        if (visitIds.length > 0) {
          const { data: visits, error: visitsError } = await supabase
            .from('visits')
            .select(`
              id,
              retailer_id,
              retailers(name)
            `)
            .in('id', visitIds);

          if (visitsError) throw visitsError;
          
          console.log('Visits fetched:', visits?.length);
          
          visits?.forEach(visit => {
            visitsMap.set(visit.id, visit);
          });
        }

        // Fetch order items for product breakdown
        const orderIds = orders?.map(o => o.id) || [];
        if (orderIds.length > 0) {
          const { data: orderItems, error: itemsError } = await supabase
            .from('order_items')
            .select(`
              quantity,
              total,
              product_name
            `)
            .in('order_id', orderIds);

          if (itemsError) throw itemsError;

          console.log('Order items fetched:', orderItems?.length);

          // Aggregate sales by product
          const productSales = new Map<string, number>();
          orderItems?.forEach(item => {
            const productName = item.product_name || 'Unknown';
            const sales = item.total || 0;
            productSales.set(productName, (productSales.get(productName) || 0) + sales);
          });

          const salesData = Array.from(productSales.entries())
            .map(([product_name, total_sales]) => ({ product_name, total_sales }))
            .sort((a, b) => b.total_sales - a.total_sales)
            .slice(0, 6);

          console.log('Sales by product:', salesData);
          setSalesByProduct(salesData);
        }

        // Aggregate revenue by retailer
        const retailerRevenue = new Map<string, { total: number; dates: string[] }>();
        orders?.forEach(order => {
          const visit = visitsMap.get(order.visit_id);
          const retailer = visit?.retailers as any;
          const retailerName = retailer?.name || 'Unknown';
          const date = format(new Date(order.created_at), 'MMM dd');
          
          if (!retailerRevenue.has(retailerName)) {
            retailerRevenue.set(retailerName, { total: 0, dates: [] });
          }
          const data = retailerRevenue.get(retailerName)!;
          data.total += order.total_amount || 0;
          data.dates.push(date);
        });

        const retailersData = Array.from(retailerRevenue.entries())
          .map(([retailer_name, data]) => ({
            retailer_name,
            total_revenue: data.total,
            date: data.dates[0]
          }))
          .sort((a, b) => b.total_revenue - a.total_revenue)
          .slice(0, 6);

        console.log('Top retailers:', retailersData);
        setTopRetailers(retailersData);
      } catch (error) {
        console.error('Error fetching weekly data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchWeeklyData();
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sales by Product (This Week)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top 6 Retailers (This Week)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show message when no data
  const hasProductData = salesByProduct.length > 0;
  const hasRetailerData = topRetailers.length > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Sales by Product - Donut Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sales by Product (This Week)</CardTitle>
        </CardHeader>
        <CardContent>
          {hasProductData ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={salesByProduct}
                  dataKey="total_sales"
                  nameKey="product_name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  label={(entry) => `₹${entry.total_sales.toFixed(2)}`}
                >
                  {salesByProduct.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `₹${value.toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">No sales data for this week</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top 6 Retailers - Line Graph */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top 6 Retailers by Revenue (This Week)</CardTitle>
        </CardHeader>
        <CardContent>
          {hasRetailerData ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={topRetailers}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="retailer_name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 10 }}
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value: number) => `₹${value.toFixed(2)}`}
                  labelStyle={{ fontSize: 12 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="total_revenue" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ fill: '#8884d8', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">No retailer data for this week</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
