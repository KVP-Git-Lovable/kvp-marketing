import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, ShoppingCart, Store, Users } from 'lucide-react';

interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  totalRetailers: number;
  activeSalesUsers: number;
}

interface PincodeSales {
  pincode: string;
  sales: number;
  orders: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const TerritoryDashboard = () => {
  const [dateRange, setDateRange] = useState('this_month');
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalOrders: 0,
    totalRetailers: 0,
    activeSalesUsers: 0,
  });
  const [pincodeSales, setPincodeSales] = useState<PincodeSales[]>([]);
  const [loading, setLoading] = useState(true);

  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'this_week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        break;
      case 'this_month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    return { startDate, endDate: now };
  };

  useEffect(() => {
    loadDashboardData();
    
    // REMOVED: Real-time subscription
    // Per offline-first architecture: Territory Dashboard should rely on
    // periodic refresh or manual refresh, not real-time subscriptions.
    // Real-time updates are for manager dashboards accessed via web, not mobile.
  }, [dateRange]);

  const loadDashboardData = async () => {
    setLoading(true);
    const { startDate, endDate } = getDateRange();

    try {
      // Get all territories with assigned users
      const { data: territories } = await supabase
        .from('territories')
        .select('id, assigned_user_id, pincode_ranges');

      // Get all orders in date range
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total_amount, retailer_id, retailers(address)')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Get all retailers
      const { data: retailers } = await supabase
        .from('retailers')
        .select('id, address');

      // Calculate stats
      const totalSales = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
      const totalOrders = orders?.length || 0;
      const totalRetailers = retailers?.length || 0;
      const activeSalesUsers = new Set(territories?.map(t => t.assigned_user_id).filter(Boolean)).size;

      setStats({
        totalSales,
        totalOrders,
        totalRetailers,
        activeSalesUsers,
      });

      // Calculate sales by pincode
      const pincodeMap = new Map<string, { sales: number; orders: number }>();
      
      territories?.forEach(territory => {
        territory.pincode_ranges?.forEach(pincode => {
          const matchingOrders = orders?.filter(order => 
            (order.retailers as any)?.address?.includes(pincode)
          ) || [];
          
          const existing = pincodeMap.get(pincode) || { sales: 0, orders: 0 };
          pincodeMap.set(pincode, {
            sales: existing.sales + matchingOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
            orders: existing.orders + matchingOrders.length,
          });
        });
      });

      const pincodeData = Array.from(pincodeMap.entries())
        .map(([pincode, data]) => ({
          pincode,
          sales: data.sales,
          orders: data.orders,
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10);

      setPincodeSales(pincodeData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex justify-end">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.totalSales.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Retailers</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRetailers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Sales Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSalesUsers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Sales by PIN Code */}
        <Card>
          <CardHeader>
            <CardTitle>Sales by PIN Code</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pincodeSales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="pincode" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sales" fill="#8884d8" name="Sales (₹)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart - Orders by PIN Code */}
        <Card>
          <CardHeader>
            <CardTitle>Orders Distribution by PIN Code</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pincodeSales}
                  dataKey="orders"
                  nameKey="pincode"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {pincodeSales.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TerritoryDashboard;
