import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  Clock,
  Package,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  RefreshCw,
  Calendar,
  Gauge,
  BarChart3,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays, format, subDays } from 'date-fns';

interface InventoryItem {
  id: string;
  product_name: string;
  variant_name?: string;
  sku?: string;
  quantity: number;
  available_quantity: number;
  reorder_level: number;
  max_stock_level: number;
  unit: string;
  unit_cost: number;
  total_value: number;
  batch_number?: string;
  expiry_date?: string;
  last_received_date?: string;
}

interface SecondaryOrder {
  product_name: string;
  quantity: number;
  created_at: string;
}

// KPI calculations
const calcDaysOfInventory = (currentQty: number, avgDailySales: number) => {
  if (avgDailySales <= 0) return currentQty > 0 ? 999 : 0;
  return Math.round(currentQty / avgDailySales);
};

const StockHealthDashboard = () => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [salesData, setSalesData] = useState<SecondaryOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const distributorId = localStorage.getItem('distributor_id');

  useEffect(() => {
    if (!distributorId) {
      navigate('/distributor-portal/login');
      return;
    }
    loadData();
  }, [distributorId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      const [invRes, salesRes] = await Promise.all([
        supabase
          .from('distributor_inventory')
          .select('*')
          .eq('distributor_id', distributorId)
          .order('product_name'),
        supabase
          .from('distributor_secondary_orders')
          .select('product_name, quantity, created_at')
          .eq('distributor_id', distributorId)
          .gte('created_at', thirtyDaysAgo),
      ]);

      setInventory(invRes.data || []);
      setSalesData(salesRes.data || []);
    } catch (error) {
      console.error('Error loading stock health:', error);
      toast.error('Failed to load stock health data');
    } finally {
      setLoading(false);
    }
  };

  // Compute avg daily sales per product (last 30 days)
  const avgDailySalesMap: Record<string, number> = {};
  salesData.forEach((s) => {
    avgDailySalesMap[s.product_name] = (avgDailySalesMap[s.product_name] || 0) + (s.quantity || 0);
  });
  Object.keys(avgDailySalesMap).forEach((k) => {
    avgDailySalesMap[k] = avgDailySalesMap[k] / 30;
  });

  // KPIs
  const totalSKUs = inventory.length;
  const outOfStock = inventory.filter((i) => i.quantity === 0).length;
  const lowStock = inventory.filter((i) => i.quantity > 0 && i.quantity <= i.reorder_level).length;
  const fillRate = totalSKUs > 0 ? Math.round(((totalSKUs - outOfStock) / totalSKUs) * 100) : 0;
  const totalValue = inventory.reduce((s, i) => s + (i.total_value || 0), 0);

  // Days of inventory (weighted avg)
  const totalQty = inventory.reduce((s, i) => s + i.quantity, 0);
  const totalDailySales = Object.values(avgDailySalesMap).reduce((s, v) => s + v, 0);
  const overallDOI = calcDaysOfInventory(totalQty, totalDailySales);

  // Expiry items
  const now = new Date();
  const expiringItems = inventory
    .filter((i) => i.expiry_date)
    .map((i) => ({
      ...i,
      daysToExpiry: differenceInDays(new Date(i.expiry_date!), now),
    }))
    .filter((i) => i.daysToExpiry <= 90)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry);

  const expiredCount = expiringItems.filter((i) => i.daysToExpiry < 0).length;
  const expiringIn30 = expiringItems.filter((i) => i.daysToExpiry >= 0 && i.daysToExpiry <= 30).length;
  const expiringIn90 = expiringItems.filter((i) => i.daysToExpiry > 30 && i.daysToExpiry <= 90).length;

  // Reorder suggestions
  const reorderItems = inventory
    .filter((i) => i.quantity <= i.reorder_level)
    .map((i) => {
      const avgDaily = avgDailySalesMap[i.product_name] || 0;
      const doi = calcDaysOfInventory(i.quantity, avgDaily);
      const suggestedQty = Math.max(
        (i.max_stock_level || i.reorder_level * 3) - i.quantity,
        i.reorder_level * 2 - i.quantity
      );
      return { ...i, avgDaily, doi, suggestedQty: Math.max(0, Math.ceil(suggestedQty)) };
    })
    .sort((a, b) => a.doi - b.doi);

  // Slow moving: has stock but no/very low sales
  const slowMoving = inventory
    .filter((i) => i.quantity > 0)
    .map((i) => ({
      ...i,
      avgDaily: avgDailySalesMap[i.product_name] || 0,
      doi: calcDaysOfInventory(i.quantity, avgDailySalesMap[i.product_name] || 0),
    }))
    .filter((i) => i.doi > 60)
    .sort((a, b) => b.doi - a.doi)
    .slice(0, 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock Health</h1>
          <p className="text-muted-foreground">Real-time inventory intelligence & alerts</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          icon={<Gauge className="w-5 h-5 text-primary" />}
          label="Fill Rate"
          value={`${fillRate}%`}
          sublabel={`${totalSKUs - outOfStock}/${totalSKUs} SKUs available`}
          bgClass="bg-primary/10"
          good={fillRate >= 90}
        />
        <KPICard
          icon={<Clock className="w-5 h-5 text-blue-600" />}
          label="Days of Inventory"
          value={overallDOI >= 999 ? '∞' : `${overallDOI}d`}
          sublabel={overallDOI < 14 ? 'Critically low' : overallDOI > 60 ? 'Excess stock' : 'Healthy range'}
          bgClass="bg-blue-500/10"
          good={overallDOI >= 14 && overallDOI <= 60}
        />
        <KPICard
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
          label="Stock Alerts"
          value={`${lowStock + outOfStock}`}
          sublabel={`${outOfStock} out, ${lowStock} low`}
          bgClass="bg-amber-500/10"
          good={lowStock + outOfStock === 0}
        />
        <KPICard
          icon={<Calendar className="w-5 h-5 text-red-600" />}
          label="Expiry Alerts"
          value={`${expiredCount + expiringIn30}`}
          sublabel={`${expiredCount} expired, ${expiringIn30} in 30d`}
          bgClass="bg-red-500/10"
          good={expiredCount + expiringIn30 === 0}
        />
      </div>

      {/* Tabs for details */}
      <Tabs defaultValue="reorder" className="space-y-4">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="reorder" className="text-xs sm:text-sm">
            <ShoppingCart className="w-4 h-4 mr-1.5 hidden sm:inline" />
            Reorder ({reorderItems.length})
          </TabsTrigger>
          <TabsTrigger value="expiry" className="text-xs sm:text-sm">
            <Calendar className="w-4 h-4 mr-1.5 hidden sm:inline" />
            Expiry ({expiringItems.length})
          </TabsTrigger>
          <TabsTrigger value="slow" className="text-xs sm:text-sm">
            <TrendingDown className="w-4 h-4 mr-1.5 hidden sm:inline" />
            Slow Moving ({slowMoving.length})
          </TabsTrigger>
        </TabsList>

        {/* Reorder Suggestions */}
        <TabsContent value="reorder" className="space-y-3">
          {reorderItems.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="w-12 h-12 text-green-500" />} message="All products are well-stocked!" />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {reorderItems.length} products need restocking (sorted by urgency)
                </p>
                <Button
                  size="sm"
                  onClick={() => navigate('/distributor-portal/create-primary-order')}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Create Order
                </Button>
              </div>
              {reorderItems.map((item) => (
                <Card key={item.id} className="border-l-4 border-l-amber-500">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground truncate">{item.product_name}</h3>
                          {item.quantity === 0 ? (
                            <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">Low Stock</Badge>
                          )}
                        </div>
                        {item.variant_name && (
                          <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                          <span>Current: <b className="text-foreground">{item.quantity} {item.unit || 'units'}</b></span>
                          <span>Reorder Level: <b>{item.reorder_level}</b></span>
                          <span>Avg Daily Sales: <b>{item.avgDaily.toFixed(1)}</b></span>
                          {item.doi < 999 && <span>Days Left: <b className={item.doi <= 7 ? 'text-destructive' : ''}>{item.doi}d</b></span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-center px-3 py-1.5 rounded-lg bg-primary/10">
                          <p className="text-xs text-muted-foreground">Suggested Qty</p>
                          <p className="text-lg font-bold text-primary">{item.suggestedQty}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* Expiry Alerts */}
        <TabsContent value="expiry" className="space-y-3">
          {expiringItems.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="w-12 h-12 text-green-500" />} message="No expiry concerns!" />
          ) : (
            <>
              {/* Expiry summary chips */}
              <div className="flex flex-wrap gap-2">
                {expiredCount > 0 && (
                  <Badge variant="destructive">{expiredCount} Expired</Badge>
                )}
                {expiringIn30 > 0 && (
                  <Badge className="bg-orange-100 text-orange-700">{expiringIn30} Expiring in 30 days</Badge>
                )}
                {expiringIn90 > 0 && (
                  <Badge className="bg-yellow-100 text-yellow-700">{expiringIn90} Expiring in 31-90 days</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                💡 <b>FEFO Recommendation:</b> Prioritize selling items expiring soonest (First Expiry, First Out).
              </p>
              {expiringItems.map((item) => {
                const isExpired = item.daysToExpiry < 0;
                const isUrgent = item.daysToExpiry >= 0 && item.daysToExpiry <= 30;
                return (
                  <Card
                    key={item.id}
                    className={`border-l-4 ${isExpired ? 'border-l-destructive' : isUrgent ? 'border-l-orange-500' : 'border-l-yellow-500'}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground truncate">{item.product_name}</h3>
                            <Badge
                              variant={isExpired ? 'destructive' : 'secondary'}
                              className={isExpired ? '' : isUrgent ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}
                            >
                              {isExpired ? 'EXPIRED' : `${item.daysToExpiry}d left`}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                            {item.batch_number && <span>Batch: {item.batch_number}</span>}
                            <span>Expiry: {format(new Date(item.expiry_date!), 'dd MMM yyyy')}</span>
                            <span>Qty: <b>{item.quantity} {item.unit || 'units'}</b></span>
                            <span>Value: <b>₹{(item.total_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</b></span>
                          </div>
                        </div>
                        <div className="text-right">
                          {isExpired ? (
                            <XCircle className="w-6 h-6 text-destructive" />
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>Sell first ↑</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </TabsContent>

        {/* Slow Moving */}
        <TabsContent value="slow" className="space-y-3">
          {slowMoving.length === 0 ? (
            <EmptyState icon={<TrendingUp className="w-12 h-12 text-green-500" />} message="No slow-moving stock detected!" />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Products with &gt;60 days of inventory at current sales velocity
              </p>
              {slowMoving.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">{item.product_name}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                          <span>Stock: <b>{item.quantity} {item.unit || 'units'}</b></span>
                          <span>Avg Daily Sales: <b>{item.avgDaily.toFixed(1)}</b></span>
                          <span>Value: <b>₹{(item.total_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</b></span>
                        </div>
                      </div>
                      <div className="text-center px-3 py-1.5 rounded-lg bg-muted">
                        <p className="text-xs text-muted-foreground">Days of Stock</p>
                        <p className="text-lg font-bold text-foreground">{item.doi >= 999 ? '∞' : `${item.doi}d`}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Stock Value Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Stock Value Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="text-lg font-bold text-foreground">
                ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
              <p className="text-xs text-muted-foreground">Healthy Stock Value</p>
              <p className="text-lg font-bold text-green-600">
                ₹{inventory
                  .filter((i) => i.quantity > i.reorder_level && i.quantity < (i.max_stock_level || i.reorder_level * 4))
                  .reduce((s, i) => s + (i.total_value || 0), 0)
                  .toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
              <p className="text-xs text-muted-foreground">Low Stock Value</p>
              <p className="text-lg font-bold text-amber-600">
                ₹{inventory
                  .filter((i) => i.quantity > 0 && i.quantity <= i.reorder_level)
                  .reduce((s, i) => s + (i.total_value || 0), 0)
                  .toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
              <p className="text-xs text-muted-foreground">Expiring Stock Value</p>
              <p className="text-lg font-bold text-red-600">
                ₹{expiringItems
                  .reduce((s, i) => s + (i.total_value || 0), 0)
                  .toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Sub-components
const KPICard = ({
  icon,
  label,
  value,
  sublabel,
  bgClass,
  good,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  bgClass: string;
  good: boolean;
}) => (
  <Card>
    <CardContent className="p-3">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${bgClass}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
          <p className="text-lg font-bold leading-tight">{value}</p>
          <p className={`text-[10px] leading-tight ${good ? 'text-green-600' : 'text-amber-600'}`}>{sublabel}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const EmptyState = ({ icon, message }: { icon: React.ReactNode; message: string }) => (
  <Card>
    <CardContent className="py-12 text-center">
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="text-muted-foreground">{message}</p>
    </CardContent>
  </Card>
);

export default StockHealthDashboard;
