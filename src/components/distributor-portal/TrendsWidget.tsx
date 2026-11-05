import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  BarChart3,
  Calendar
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface TrendData {
  label: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
}

interface TrendsWidgetProps {
  distributorId: string;
}

export const TrendsWidget = ({ distributorId }: TrendsWidgetProps) => {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (distributorId) {
      loadTrends();
    }
  }, [distributorId]);

  const loadTrends = async () => {
    try {
      const currentMonth = new Date();
      const lastMonth = subMonths(currentMonth, 1);

      const currentStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const currentEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const lastStart = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
      const lastEnd = format(endOfMonth(lastMonth), 'yyyy-MM-dd');

      // Get current month primary orders
      const { data: currentPrimary } = await supabase
        .from('primary_orders')
        .select('total_amount')
        .eq('distributor_id', distributorId)
        .gte('order_date', currentStart)
        .lte('order_date', currentEnd);

      // Get last month primary orders
      const { data: lastPrimary } = await supabase
        .from('primary_orders')
        .select('total_amount')
        .eq('distributor_id', distributorId)
        .gte('order_date', lastStart)
        .lte('order_date', lastEnd);

      const currentPrimaryTotal = currentPrimary?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      const lastPrimaryTotal = lastPrimary?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

      // Get retailer mappings for secondary sales
      const { data: mappings } = await supabase
        .from('distributor_retailer_mappings')
        .select('retailer_id')
        .eq('distributor_id', distributorId);

      const retailerIds = mappings?.map(m => m.retailer_id) || [];

      let currentSecondaryTotal = 0;
      let lastSecondaryTotal = 0;
      let currentSecondaryCount = 0;
      let lastSecondaryCount = 0;

      if (retailerIds.length > 0) {
        const { data: currentSecondary } = await supabase
          .from('orders')
          .select('total_amount')
          .in('retailer_id', retailerIds)
          .gte('order_date', currentStart)
          .lte('order_date', currentEnd);

        const { data: lastSecondary } = await supabase
          .from('orders')
          .select('total_amount')
          .in('retailer_id', retailerIds)
          .gte('order_date', lastStart)
          .lte('order_date', lastEnd);

        currentSecondaryTotal = currentSecondary?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
        lastSecondaryTotal = lastSecondary?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
        currentSecondaryCount = currentSecondary?.length || 0;
        lastSecondaryCount = lastSecondary?.length || 0;
      }

      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      setTrends([
        {
          label: 'Primary Orders',
          currentValue: currentPrimaryTotal,
          previousValue: lastPrimaryTotal,
          changePercent: calculateChange(currentPrimaryTotal, lastPrimaryTotal),
        },
        {
          label: 'Secondary Sales',
          currentValue: currentSecondaryTotal,
          previousValue: lastSecondaryTotal,
          changePercent: calculateChange(currentSecondaryTotal, lastSecondaryTotal),
        },
        {
          label: 'Order Count',
          currentValue: currentSecondaryCount,
          previousValue: lastSecondaryCount,
          changePercent: calculateChange(currentSecondaryCount, lastSecondaryCount),
        },
      ]);
    } catch (error) {
      console.error('Error loading trends:', error);
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

  const getTrendIcon = (percent: number) => {
    if (percent > 0) return <TrendingUp className="w-4 h-4" />;
    if (percent < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = (percent: number) => {
    if (percent > 0) return 'text-emerald-600 bg-emerald-500/10';
    if (percent < 0) return 'text-rose-600 bg-rose-500/10';
    return 'text-gray-600 bg-gray-500/10';
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <BarChart3 className="w-5 h-5 text-cyan-600" />
            </div>
            <CardTitle className="text-lg">Monthly Trends</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            <Calendar className="w-3 h-3 mr-1" />
            vs Last Month
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {trends.map((trend, index) => (
          <div 
            key={index}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
          >
            <div>
              <p className="text-sm font-medium">{trend.label}</p>
              <p className="text-lg font-bold">
                {trend.label === 'Order Count' 
                  ? trend.currentValue 
                  : formatCurrency(trend.currentValue)}
              </p>
            </div>
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium",
              getTrendColor(trend.changePercent)
            )}>
              {getTrendIcon(trend.changePercent)}
              <span>{Math.abs(trend.changePercent).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
