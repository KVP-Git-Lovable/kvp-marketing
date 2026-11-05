import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, Building, AlertTriangle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface InventoryItem {
  id: string;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  quantity: number;
  available_quantity: number;
  reorder_level: number;
  total_value: number;
  distributor_id: string;
  distributor_name?: string;
}

interface PortalInventoryTabProps {
  searchQuery: string;
}

export const PortalInventoryTab = ({ searchQuery }: PortalInventoryTabProps) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockFilter, setStockFilter] = useState('all');
  const [distributorFilter, setDistributorFilter] = useState('all');
  const [distributors, setDistributors] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load distributors for filter
      const { data: distributorData } = await supabase
        .from('distributors')
        .select('id, name')
        .order('name');
      
      setDistributors(distributorData || []);

      // Load inventory
      const { data: inventoryData, error } = await supabase
        .from('distributor_inventory')
        .select('*')
        .order('product_name');

      if (error) throw error;

      // Map distributor names
      const inventoryWithDistributors = (inventoryData || []).map(item => ({
        ...item,
        distributor_name: distributorData?.find(d => d.id === item.distributor_id)?.name || 'Unknown'
      }));

      setInventory(inventoryWithDistributors);
    } catch (error) {
      console.error('Error loading inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-700', severity: 'critical' };
    if (item.quantity <= item.reorder_level) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-700', severity: 'warning' };
    return { label: 'In Stock', color: 'bg-green-100 text-green-700', severity: 'good' };
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      item.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.distributor_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDistributor = distributorFilter === 'all' || item.distributor_id === distributorFilter;
    
    if (stockFilter === 'all') return matchesSearch && matchesDistributor;
    
    const status = getStockStatus(item);
    if (stockFilter === 'low' && status.severity !== 'warning') return false;
    if (stockFilter === 'out' && status.severity !== 'critical') return false;
    if (stockFilter === 'good' && status.severity !== 'good') return false;
    
    return matchesSearch && matchesDistributor;
  });

  const totalValue = filteredInventory.reduce((sum, i) => sum + (i.total_value || 0), 0);
  const lowStockCount = filteredInventory.filter(i => i.quantity <= i.reorder_level && i.quantity > 0).length;
  const outOfStockCount = filteredInventory.filter(i => i.quantity === 0).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">Total SKUs</p>
            <p className="text-xl font-bold">{filteredInventory.length}</p>
          </div>
          <div className="p-3 bg-yellow-50 rounded-lg">
            <p className="text-xs text-yellow-600">Low Stock</p>
            <p className="text-xl font-bold text-yellow-600">{lowStockCount}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="text-xs text-red-600">Out of Stock</p>
            <p className="text-xl font-bold text-red-600">{outOfStockCount}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-xs text-green-600">Total Value</p>
            <p className="text-xl font-bold text-green-600">₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Stock Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="good">In Stock</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>

          <Select value={distributorFilter} onValueChange={setDistributorFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Distributor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Distributors</SelectItem>
              {distributors.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {filteredInventory.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No inventory items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Distributor</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.map((item) => {
                  const status = getStockStatus(item);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          {item.variant_name && (
                            <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{item.distributor_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.sku || '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.available_quantity}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{item.total_value?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
