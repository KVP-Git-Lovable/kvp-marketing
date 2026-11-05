import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, IndianRupee, BoxIcon, RotateCcw, XCircle, CreditCard } from 'lucide-react';
import { format, startOfDay, subDays, startOfWeek, startOfMonth } from 'date-fns';

interface SummaryStats {
  totalKg: number;
  totalValue: number;
  stockCount: number;
  returnCount: number;
  noOrderCount: number;
  totalCredit: number;
}

interface UserBreakdown {
  userId: string;
  userName: string;
  value: number;
  count?: number;
}

interface CreditBreakdown {
  retailerId: string;
  retailerName: string;
  pendingAmount: number;
  ordersCount: number;
  orders: Array<{ id: string; date: string; amount: number }>;
}

type MetricType = 'kg' | 'value' | 'stock' | 'return' | 'noOrder' | 'credit';

interface OperationsSummaryBoxesProps {
  dateFilter: 'today' | 'week' | 'month';
  onDateFilterChange: (filter: 'today' | 'week' | 'month') => void;
}

export const OperationsSummaryBoxes: React.FC<OperationsSummaryBoxesProps> = ({
  dateFilter,
  onDateFilterChange
}) => {
  const [stats, setStats] = useState<SummaryStats>({
    totalKg: 0,
    totalValue: 0,
    stockCount: 0,
    returnCount: 0,
    noOrderCount: 0,
    totalCredit: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<MetricType | null>(null);
  const [userBreakdown, setUserBreakdown] = useState<UserBreakdown[]>([]);
  const [creditBreakdown, setCreditBreakdown] = useState<CreditBreakdown[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const getDateRange = useCallback(() => {
    const now = new Date();
    const today = startOfDay(now);
    
    switch (dateFilter) {
      case 'week':
        // Last 7 days to match Operations Monitor
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { from: weekAgo, to: now };
      case 'month':
        // Last 30 days to match Operations Monitor
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return { from: monthAgo, to: now };
      default:
        return { from: today, to: now };
    }
  }, [dateFilter]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange();

    try {
      // Fetch orders for KG and Value
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          user_id,
          total_amount,
          created_at,
          order_items(quantity, unit)
        `)
        .eq('status', 'confirmed')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString());

      if (ordersError) throw ordersError;

      // Calculate total KG (assuming unit is KG or convert if needed)
      let totalKg = 0;
      orders?.forEach(order => {
        order.order_items?.forEach((item: any) => {
          if (item.unit?.toLowerCase().includes('kg') || item.unit?.toLowerCase() === 'kg') {
            totalKg += item.quantity || 0;
          } else if (item.unit?.toLowerCase().includes('g') && !item.unit?.toLowerCase().includes('kg')) {
            totalKg += (item.quantity || 0) / 1000;
          } else {
            // Default treat as KG
            totalKg += item.quantity || 0;
          }
        });
      });

      const totalValue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

      // Fetch stock data
      const { data: stockData, error: stockError } = await supabase
        .from('stock')
        .select('id')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString());

      if (stockError) console.warn('Stock error:', stockError);

      // Fetch return stock data from visits table (orders with returns)
      const { data: returnData, error: returnError } = await supabase
        .from('visits')
        .select('id')
        .eq('status', 'productive')
        .gte('planned_date', format(from, 'yyyy-MM-dd'))
        .lte('planned_date', format(to, 'yyyy-MM-dd'));

      // Count returns - for now using stock table with negative quantities or specific return entries
      const returnCount = 0; // Will be updated when return_stock table is available
      if (returnError) console.warn('Return error:', returnError);

      // Fetch no order visits
      const { data: noOrderData, error: noOrderError } = await supabase
        .from('visits')
        .select('id')
        .eq('status', 'unproductive')
        .not('no_order_reason', 'is', null)
        .gte('planned_date', format(from, 'yyyy-MM-dd'))
        .lte('planned_date', format(to, 'yyyy-MM-dd'));

      if (noOrderError) console.warn('No order error:', noOrderError);

      // Fetch total credit (unpaid credit orders)
      const { data: creditOrders, error: creditError } = await supabase
        .from('orders')
        .select('id, credit_pending_amount')
        .eq('is_credit_order', true)
        .gt('credit_pending_amount', 0);

      if (creditError) console.warn('Credit error:', creditError);

      const totalCreditAmount = creditOrders?.reduce((sum, o) => sum + (o.credit_pending_amount || 0), 0) || 0;

      setStats({
        totalKg: Math.round(totalKg * 100) / 100,
        totalValue,
        stockCount: stockData?.length || 0,
        returnCount: returnCount || 0,
        noOrderCount: noOrderData?.length || 0,
        totalCredit: totalCreditAmount
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  const fetchUserBreakdown = async (metric: MetricType) => {
    setBreakdownLoading(true);
    const { from, to } = getDateRange();

    try {
      let breakdown: UserBreakdown[] = [];

      if (metric === 'kg' || metric === 'value') {
        const { data: orders, error } = await supabase
          .from('orders')
          .select(`
            id,
            user_id,
            total_amount,
            order_items(quantity, unit)
          `)
          .eq('status', 'confirmed')
          .gte('created_at', from.toISOString())
          .lte('created_at', to.toISOString());

        if (error) throw error;

        // Group by user
        const userMap = new Map<string, { kg: number; value: number; count: number }>();
        orders?.forEach(order => {
          const existing = userMap.get(order.user_id) || { kg: 0, value: 0, count: 0 };
          existing.value += order.total_amount || 0;
          existing.count += 1;
          
          order.order_items?.forEach((item: any) => {
            if (item.unit?.toLowerCase().includes('kg') || item.unit?.toLowerCase() === 'kg') {
              existing.kg += item.quantity || 0;
            } else if (item.unit?.toLowerCase().includes('g') && !item.unit?.toLowerCase().includes('kg')) {
              existing.kg += (item.quantity || 0) / 1000;
            } else {
              existing.kg += item.quantity || 0;
            }
          });
          
          userMap.set(order.user_id, existing);
        });

        const userIds = Array.from(userMap.keys());
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', userIds);

        breakdown = Array.from(userMap.entries()).map(([userId, data]) => {
          const profile = profiles?.find(p => p.id === userId);
          return {
            userId,
            userName: profile?.full_name || profile?.username || 'Unknown',
            value: metric === 'kg' ? Math.round(data.kg * 100) / 100 : data.value,
            count: data.count
          };
        });
      } else if (metric === 'stock') {
        const { data, error } = await supabase
          .from('stock')
          .select('user_id')
          .gte('created_at', from.toISOString())
          .lte('created_at', to.toISOString());

        if (error) throw error;

        const userCounts = new Map<string, number>();
        data?.forEach(item => {
          userCounts.set(item.user_id, (userCounts.get(item.user_id) || 0) + 1);
        });

        const userIds = Array.from(userCounts.keys());
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', userIds);

        breakdown = Array.from(userCounts.entries()).map(([userId, count]) => {
          const profile = profiles?.find(p => p.id === userId);
          return {
            userId,
            userName: profile?.full_name || profile?.username || 'Unknown',
            value: count
          };
        });
      } else if (metric === 'return') {
        // Return data placeholder - will be implemented when return_stock table is available
        breakdown = [];
      } else if (metric === 'noOrder') {
        const { data, error } = await supabase
          .from('visits')
          .select('user_id')
          .eq('status', 'unproductive')
          .not('no_order_reason', 'is', null)
          .gte('planned_date', format(from, 'yyyy-MM-dd'))
          .lte('planned_date', format(to, 'yyyy-MM-dd'));

        if (error) throw error;

        const userCounts = new Map<string, number>();
        data?.forEach(item => {
          userCounts.set(item.user_id, (userCounts.get(item.user_id) || 0) + 1);
        });

        const userIds = Array.from(userCounts.keys());
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', userIds);

        breakdown = Array.from(userCounts.entries()).map(([userId, count]) => {
          const profile = profiles?.find(p => p.id === userId);
          return {
            userId,
            userName: profile?.full_name || profile?.username || 'Unknown',
            value: count
          };
        });
      } else if (metric === 'credit') {
        // Fetch credit orders grouped by retailer
        const { data: creditOrders, error } = await supabase
          .from('orders')
          .select('id, retailer_id, retailer_name, credit_pending_amount, created_at')
          .eq('is_credit_order', true)
          .gt('credit_pending_amount', 0);

        if (error) throw error;

        // Group by retailer
        const retailerMap = new Map<string, CreditBreakdown>();
        creditOrders?.forEach(order => {
          const existing = retailerMap.get(order.retailer_id) || {
            retailerId: order.retailer_id,
            retailerName: order.retailer_name || 'Unknown',
            pendingAmount: 0,
            ordersCount: 0,
            orders: []
          };
          existing.pendingAmount += order.credit_pending_amount || 0;
          existing.ordersCount += 1;
          existing.orders.push({
            id: order.id,
            date: order.created_at,
            amount: order.credit_pending_amount || 0
          });
          retailerMap.set(order.retailer_id, existing);
        });

        const creditData = Array.from(retailerMap.values()).sort((a, b) => b.pendingAmount - a.pendingAmount);
        setCreditBreakdown(creditData);
        setUserBreakdown([]); // Clear user breakdown for credit
      }

      // Sort by value descending
      breakdown.sort((a, b) => b.value - a.value);
      setUserBreakdown(breakdown);
    } catch (error) {
      console.error('Error fetching breakdown:', error);
    } finally {
      setBreakdownLoading(false);
    }
  };

  const handleMetricClick = (metric: MetricType) => {
    setSelectedMetric(metric);
    fetchUserBreakdown(metric);
  };

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Real-time subscription for auto-updates
  useEffect(() => {
    const ordersChannel = supabase
      .channel('operations-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchStats();
        // If credit dialog is open, refresh breakdown
        if (selectedMetric === 'credit') {
          fetchUserBreakdown('credit');
        }
      })
      .subscribe();

    const stockChannel = supabase
      .channel('operations-stock')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, () => {
        fetchStats();
      })
      .subscribe();

    const visitsChannel = supabase
      .channel('operations-visits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(stockChannel);
      supabase.removeChannel(visitsChannel);
    };
  }, [fetchStats, selectedMetric]);

  const getMetricLabel = (metric: MetricType) => {
    switch (metric) {
      case 'kg': return 'Order In KG';
      case 'value': return 'Order Value';
      case 'stock': return 'Stock Entries';
      case 'return': return 'Returns';
      case 'noOrder': return 'No Order Visits';
      case 'credit': return 'Total Credit';
    }
  };

  const getMetricUnit = (metric: MetricType) => {
    switch (metric) {
      case 'kg': return 'KG';
      case 'value': return '₹';
      case 'stock': return 'entries';
      case 'return': return 'returns';
      case 'noOrder': return 'visits';
      case 'credit': return '₹';
    }
  };

  const metricBoxes = [
    {
      id: 'kg' as MetricType,
      label: 'Order In KG',
      value: stats.totalKg,
      format: (v: number) => `${v.toLocaleString()} KG`,
      icon: Package,
      bgColor: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      borderColor: 'border-blue-500/20'
    },
    {
      id: 'value' as MetricType,
      label: 'Order Value',
      value: stats.totalValue,
      format: (v: number) => `₹${v.toLocaleString()}`,
      icon: IndianRupee,
      bgColor: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
      borderColor: 'border-emerald-500/20'
    },
    {
      id: 'stock' as MetricType,
      label: 'Stock',
      value: stats.stockCount,
      format: (v: number) => v.toLocaleString(),
      icon: BoxIcon,
      bgColor: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
      borderColor: 'border-purple-500/20'
    },
    {
      id: 'return' as MetricType,
      label: 'Return',
      value: stats.returnCount,
      format: (v: number) => v.toLocaleString(),
      icon: RotateCcw,
      bgColor: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
      borderColor: 'border-amber-500/20'
    },
    {
      id: 'noOrder' as MetricType,
      label: 'No Order',
      value: stats.noOrderCount,
      format: (v: number) => v.toLocaleString(),
      icon: XCircle,
      bgColor: 'bg-red-500/10',
      iconColor: 'text-red-500',
      borderColor: 'border-red-500/20'
    },
    {
      id: 'credit' as MetricType,
      label: 'Total Credit',
      value: stats.totalCredit,
      format: (v: number) => `₹${v.toLocaleString()}`,
      icon: CreditCard,
      bgColor: 'bg-orange-500/10',
      iconColor: 'text-orange-500',
      borderColor: 'border-orange-500/20'
    }
  ];

  return (
    <>
      {/* Date Filter */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Operations Summary</h3>
        <Select value={dateFilter} onValueChange={(v) => onDateFilterChange(v as 'today' | 'week' | 'month')}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Metric Boxes */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {metricBoxes.map((box) => (
          <Card
            key={box.id}
            className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] border-2 ${box.borderColor}`}
            onClick={() => handleMetricClick(box.id)}
          >
            <CardContent className="p-4">
              <div className={`w-10 h-10 rounded-lg ${box.bgColor} flex items-center justify-center mb-3`}>
                <box.icon className={`w-5 h-5 ${box.iconColor}`} />
              </div>
              {loading ? (
                <>
                  <Skeleton className="h-6 w-20 mb-1" />
                  <Skeleton className="h-4 w-16" />
                </>
              ) : (
                <>
                  <div className="text-xl font-bold text-foreground">
                    {box.format(box.value)}
                  </div>
                  <div className="text-xs text-muted-foreground">{box.label}</div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Breakdown Dialog */}
      <Dialog open={selectedMetric !== null} onOpenChange={(open) => !open && setSelectedMetric(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                {selectedMetric && getMetricLabel(selectedMetric)} - 
                {selectedMetric === 'credit' ? ' Retailer Breakdown' : ' User Breakdown'}
              </span>
              {selectedMetric !== 'credit' && (
                <Badge variant="outline">{dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'This Week' : 'This Month'}</Badge>
              )}
              {selectedMetric === 'credit' && (
                <Badge variant="outline" className="bg-orange-100 text-orange-700">All Pending Credits</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {breakdownLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : selectedMetric === 'credit' ? (
            // Credit breakdown by retailer
            creditBreakdown.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pending credit orders
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Total Pending: <span className="font-semibold text-orange-600">₹{stats.totalCredit.toLocaleString()}</span> across {creditBreakdown.length} retailers
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Retailer</TableHead>
                      <TableHead className="text-right">Pending Amount</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditBreakdown.map((retailer) => (
                      <TableRow key={retailer.retailerId}>
                        <TableCell className="font-medium">{retailer.retailerName}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                            ₹{retailer.pendingAmount.toLocaleString()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{retailer.ordersCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground">
                  * Credits are automatically removed when payments are marked as paid
                </p>
              </div>
            )
          ) : userBreakdown.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No data found for this period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">
                    {selectedMetric === 'kg' ? 'Total KG' : 
                     selectedMetric === 'value' ? 'Total Value' : 'Count'}
                  </TableHead>
                  {(selectedMetric === 'kg' || selectedMetric === 'value') && (
                    <TableHead className="text-right">Orders</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {userBreakdown.map((user, index) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <Badge 
                        variant={index === 0 ? 'default' : index === 1 ? 'secondary' : 'outline'}
                        className={index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-400' : ''}
                      >
                        #{index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{user.userName}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {selectedMetric === 'value' ? `₹${user.value.toLocaleString()}` : 
                       selectedMetric === 'kg' ? `${user.value.toLocaleString()} KG` :
                       user.value.toLocaleString()}
                    </TableCell>
                    {(selectedMetric === 'kg' || selectedMetric === 'value') && (
                      <TableCell className="text-right">{user.count}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
