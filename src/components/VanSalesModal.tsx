import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Truck, Package, ShoppingCart, TrendingDown, Plus, Eye } from 'lucide-react';

interface Van {
  id: string;
  registration_number: string;
  make_model: string;
}

interface Product {
  id: string;
  name: string;
  unit: string;
}

interface StockItem {
  product_id: string;
  product_name: string;
  unit: string;
  start_qty: number;
  ordered_qty: number;
  left_qty: number;
}

interface VanSalesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retailerId: string;
  visitId: string;
  beatId?: string;
}

export function VanSalesModal({ open, onOpenChange, retailerId, visitId, beatId }: VanSalesModalProps) {
  const [vans, setVans] = useState<Van[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedVan, setSelectedVan] = useState<string>('');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [todayStock, setTodayStock] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<'start' | 'ordered' | 'left' | null>(null);

  useEffect(() => {
    if (open) {
      loadVans();
      loadProducts();
    }
  }, [open]);

  useEffect(() => {
    if (selectedVan) {
      loadTodayStock();
    }
  }, [selectedVan]);

  const loadVans = async () => {
    const { data, error } = await supabase
      .from('vans')
      .select('id, registration_number, make_model')
      .eq('is_active', true);
    
    if (error) {
      console.error('Error loading vans:', error);
    } else {
      setVans(data || []);
    }
  };

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, unit')
      .eq('is_active', true);
    
    if (error) {
      console.error('Error loading products:', error);
    } else {
      setProducts(data || []);
    }
  };

  const loadTodayStock = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) return;

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('van_stock')
      .select('*, van_stock_items(*)')
      .eq('van_id', selectedVan)
      .eq('stock_date', today)
      .eq('user_id', session.session.user.id)
      .maybeSingle();
    
    if (error) {
      console.error('Error loading stock:', error);
    } else {
      setTodayStock(data);
      if (data?.van_stock_items) {
        setStockItems(data.van_stock_items);
      }
    }
  };

  const handleAddProduct = () => {
    setStockItems([...stockItems, {
      product_id: '',
      product_name: '',
      unit: '',
      start_qty: 0,
      ordered_qty: 0,
      left_qty: 0,
    }]);
  };

  const handleRemoveProduct = (index: number) => {
    setStockItems(stockItems.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, field: keyof StockItem, value: any) => {
    const updated = [...stockItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        updated[index].product_name = product.name;
        updated[index].unit = product.unit;
      }
    }

    if (field === 'start_qty' || field === 'ordered_qty') {
      updated[index].left_qty = updated[index].start_qty - updated[index].ordered_qty;
    }
    
    setStockItems(updated);
  };

  const handleSaveStock = async () => {
    if (!selectedVan) {
      toast.error('Please select a van');
      return;
    }

    if (stockItems.length === 0 || stockItems.some(item => !item.product_id)) {
      toast.error('Please add at least one product with valid details');
      return;
    }

    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) return;

    const today = new Date().toISOString().split('T')[0];

    try {
      // Upsert van_stock
      const { data: vanStock, error: stockError } = await supabase
        .from('van_stock')
        .upsert({
          van_id: selectedVan,
          user_id: session.session.user.id,
          beat_id: beatId,
          stock_date: today,
          status: 'open',
        }, {
          onConflict: 'van_id,stock_date,user_id',
        })
        .select()
        .single();

      if (stockError) throw stockError;

      // Delete existing items and insert new ones
      await supabase
        .from('van_stock_items')
        .delete()
        .eq('van_stock_id', vanStock.id);

      const items = stockItems.map(item => ({
        van_stock_id: vanStock.id,
        product_id: item.product_id,
        product_name: item.product_name,
        start_qty: item.start_qty,
        ordered_qty: item.ordered_qty,
        left_qty: item.left_qty,
        unit: item.unit,
      }));

      const { error: itemsError } = await supabase
        .from('van_stock_items')
        .insert(items);

      if (itemsError) throw itemsError;

      toast.success('Van stock saved successfully');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving stock:', error);
      toast.error('Failed to save van stock');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    return stockItems.reduce((acc, item) => ({
      totalStart: acc.totalStart + item.start_qty,
      totalOrdered: acc.totalOrdered + item.ordered_qty,
      totalLeft: acc.totalLeft + item.left_qty,
    }), { totalStart: 0, totalOrdered: 0, totalLeft: 0 });
  };

  const totals = calculateTotals();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Van Sales Management
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Select Van</Label>
              <Select value={selectedVan} onValueChange={setSelectedVan}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a van" />
                </SelectTrigger>
                <SelectContent>
                  {vans.map(van => (
                    <SelectItem key={van.id} value={van.id}>
                      {van.registration_number} - {van.make_model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedVan && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Card 
                    className="p-4 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => setShowDetailModal('start')}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Package className="h-4 w-4 text-primary" />
                      <Eye className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Van Stock (Start)</p>
                    <p className="text-2xl font-bold">{totals.totalStart}</p>
                  </Card>

                  <Card 
                    className="p-4 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => setShowDetailModal('ordered')}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <ShoppingCart className="h-4 w-4 text-success" />
                      <Eye className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Ordered Qty</p>
                    <p className="text-2xl font-bold">{totals.totalOrdered}</p>
                  </Card>

                  <Card 
                    className="p-4 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => setShowDetailModal('left')}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <TrendingDown className="h-4 w-4 text-orange-500" />
                      <Eye className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Left in Van</p>
                    <p className="text-2xl font-bold">{totals.totalLeft}</p>
                  </Card>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Stock Items</Label>
                    <Button size="sm" onClick={handleAddProduct}>
                      <Plus className="h-4 w-4 mr-1" /> Add Product
                    </Button>
                  </div>

                  {stockItems.map((item, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-2">
                          <Label className="text-xs">Product</Label>
                          <Select
                            value={item.product_id}
                            onValueChange={(value) => handleProductChange(index, 'product_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(product => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} ({product.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Unit</Label>
                          <Input
                            type="text"
                            value={item.unit || 'Select product'}
                            readOnly
                            className="bg-muted"
                          />
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">Quantity</Label>
                            <Input
                              type="number"
                              value={item.start_qty}
                              onChange={(e) => handleProductChange(index, 'start_qty', parseInt(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleRemoveProduct(index)}
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleSaveStock} disabled={loading} className="flex-1">
                    {loading ? 'Saving...' : 'Save Van Stock'}
                  </Button>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={!!showDetailModal} onOpenChange={() => setShowDetailModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {showDetailModal === 'start' && 'Start of Day Stock'}
              {showDetailModal === 'ordered' && 'Retailer Orders'}
              {showDetailModal === 'left' && 'Left in Van'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {stockItems.map((item, index) => (
              <div key={index} className="flex justify-between p-3 bg-accent rounded">
                <span className="font-medium">{item.product_name}</span>
                <span>
                  {showDetailModal === 'start' && `${item.start_qty} ${item.unit}`}
                  {showDetailModal === 'ordered' && `${item.ordered_qty} ${item.unit}`}
                  {showDetailModal === 'left' && `${item.left_qty} ${item.unit}`}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
