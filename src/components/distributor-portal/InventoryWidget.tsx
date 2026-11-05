import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  ArrowRight,
  Box
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface InventoryItem {
  id: string;
  product_name: string;
  quantity: number;
  reorder_level: number;
  unit_cost: number;
  unit: string;
}

interface InventoryStats {
  totalValue: number;
  totalProducts: number;
  lowStockCount: number;
  topProducts: InventoryItem[];
}

interface InventoryWidgetProps {
  distributorId: string;
}

export const InventoryWidget = ({ distributorId }: InventoryWidgetProps) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<InventoryStats>({
    totalValue: 0,
    totalProducts: 0,
    lowStockCount: 0,
    topProducts: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (distributorId) {
      loadInventory();
    }
  }, [distributorId]);

  const loadInventory = async () => {
    try {
      const { data: inventory } = await supabase
        .from('distributor_inventory')
        .select('*')
        .eq('distributor_id', distributorId)
        .order('quantity', { ascending: false });

      if (inventory) {
        const totalValue = inventory.reduce((sum, i) => sum + (i.quantity * (i.unit_cost || 0)), 0);
        const lowStock = inventory.filter(i => i.quantity <= i.reorder_level);
        const topProducts = inventory.slice(0, 5);

        setStats({
          totalValue,
          totalProducts: inventory.length,
          lowStockCount: lowStock.length,
          topProducts,
        });
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
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

  const getStockLevel = (quantity: number, reorderLevel: number) => {
    if (quantity <= 0) return { percent: 0, color: 'bg-destructive' };
    if (quantity <= reorderLevel) return { percent: 25, color: 'bg-destructive' };
    if (quantity <= reorderLevel * 2) return { percent: 50, color: 'bg-amber-500' };
    return { percent: 100, color: 'bg-emerald-500' };
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-48 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10">
              <Package className="w-5 h-5 text-indigo-600" />
            </div>
            <CardTitle className="text-lg">Inventory Status</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/distributor-portal/inventory')}
            className="text-indigo-600"
          >
            View All
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30">
            <p className="text-xl font-bold text-foreground">{formatCurrency(stats.totalValue)}</p>
            <p className="text-xs text-muted-foreground">Stock Value</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xl font-bold text-foreground">{stats.totalProducts}</p>
            <p className="text-xs text-muted-foreground">Products</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-destructive/10">
            <div className="flex items-center justify-center gap-1">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <p className="text-xl font-bold text-destructive">{stats.lowStockCount}</p>
            </div>
            <p className="text-xs text-muted-foreground">Low Stock</p>
          </div>
        </div>

        {/* Top Products */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Top Products by Stock</p>
          {stats.topProducts.length === 0 ? (
            <div className="text-center py-4">
              <Box className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No inventory items</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.topProducts.map((item) => {
                const stockLevel = getStockLevel(item.quantity, item.reorder_level);
                return (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={stockLevel.percent} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {item.quantity} {item.unit || 'units'}
                        </span>
                      </div>
                    </div>
                    {item.quantity <= item.reorder_level && (
                      <Badge variant="destructive" className="text-xs">Low</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
