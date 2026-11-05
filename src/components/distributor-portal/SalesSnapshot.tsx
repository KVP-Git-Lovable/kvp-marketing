import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  Package, 
  ArrowRight,
  IndianRupee,
  BarChart3
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface SalesData {
  primaryTotal: number;
  primaryCount: number;
  secondaryTotal: number;
  secondaryCount: number;
  primaryPending: number;
  primaryDelivered: number;
}

interface SalesSnapshotProps {
  distributorId: string;
}

export const SalesSnapshot = ({ distributorId }: SalesSnapshotProps) => {
  const navigate = useNavigate();
  const [data, setData] = useState<SalesData>({
    primaryTotal: 0,
    primaryCount: 0,
    secondaryTotal: 0,
    secondaryCount: 0,
    primaryPending: 0,
    primaryDelivered: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (distributorId) {
      loadSalesData();
    }
  }, [distributorId]);

  const loadSalesData = async () => {
    try {
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      // Primary orders this month
      const { data: primaryOrders } = await supabase
        .from('primary_orders')
        .select('total_amount, status')
        .eq('distributor_id', distributorId)
        .gte('order_date', monthStart)
        .lte('order_date', monthEnd);

      const primaryTotal = primaryOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      const primaryPending = primaryOrders?.filter(o => 
        ['draft', 'submitted', 'confirmed', 'processing', 'dispatched', 'in_transit'].includes(o.status)
      ).length || 0;
      const primaryDelivered = primaryOrders?.filter(o => o.status === 'delivered').length || 0;

      // Secondary sales this month - get retailers for this distributor
      const { data: mappings } = await supabase
        .from('distributor_retailer_mappings')
        .select('retailer_id')
        .eq('distributor_id', distributorId);

      const retailerIds = mappings?.map(m => m.retailer_id) || [];
      
      let secondaryTotal = 0;
      let secondaryCount = 0;

      if (retailerIds.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select('total_amount')
          .in('retailer_id', retailerIds)
          .gte('order_date', monthStart)
          .lte('order_date', monthEnd);

        secondaryTotal = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
        secondaryCount = orders?.length || 0;
      }

      setData({
        primaryTotal,
        primaryCount: primaryOrders?.length || 0,
        secondaryTotal,
        secondaryCount,
        primaryPending,
        primaryDelivered,
      });
    } catch (error) {
      console.error('Error loading sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    } else if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)}K`;
    }
    return `₹${value.toLocaleString('en-IN')}`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-24 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Primary Sales */}
      <Card className="overflow-hidden border-l-4 border-l-blue-500">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <CardTitle className="text-base">Primary Orders</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">This Month</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(data.primaryTotal)}
              </p>
              <p className="text-sm text-muted-foreground">
                {data.primaryCount} orders placed
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">{data.primaryPending} pending</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">{data.primaryDelivered} delivered</span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-between text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => navigate('/distributor-portal/primary-orders')}
            >
              View All Orders
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Secondary Sales */}
      <Card className="overflow-hidden border-l-4 border-l-emerald-500">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
              </div>
              <CardTitle className="text-base">Secondary Sales</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">This Month</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(data.secondaryTotal)}
              </p>
              <p className="text-sm text-muted-foreground">
                {data.secondaryCount} orders delivered
              </p>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Avg. order: {formatCurrency(data.secondaryCount > 0 ? data.secondaryTotal / data.secondaryCount : 0)}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-between text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={() => navigate('/distributor-portal/secondary-sales')}
            >
              View Sales Details
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
