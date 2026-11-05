import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Package, 
  CheckCircle2,
  AlertTriangle,
  Truck,
  Calendar,
  FileCheck,
  ClipboardCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  variant_id?: string;
  variant_name?: string;
  quantity: number;
  received_quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  batch_number?: string;
  expiry_date?: string;
}

const GoodsReceipt = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const distributorId = localStorage.getItem('distributor_id');

  useEffect(() => {
    if (!distributorId) {
      navigate('/distributor-portal/login');
      return;
    }
    if (orderId) {
      loadOrderDetails();
    }
  }, [orderId, distributorId]);

  const loadOrderDetails = async () => {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('primary_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('primary_order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      setOrder(orderData);
      setItems(itemsData?.map(item => ({
        ...item,
        received_quantity: item.received_quantity ?? item.quantity,
        batch_number: item.batch_number || '',
        expiry_date: item.expiry_date || '',
      })) || []);
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error('Failed to load order details');
      navigate('/distributor-portal/primary-orders');
    } finally {
      setLoading(false);
    }
  };

  const updateReceivedQty = (itemId: string, qty: number) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, received_quantity: Math.max(0, qty) } : item
    ));
  };

  const updateBatchNumber = (itemId: string, batch: string) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, batch_number: batch } : item
    ));
  };

  const updateExpiryDate = (itemId: string, date: string) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, expiry_date: date } : item
    ));
  };

  const handleConfirmGRN = async () => {
    if (!order || !distributorId) return;

    setSaving(true);
    try {
      // 1. Update order items with received quantities
      for (const item of items) {
        await supabase
          .from('primary_order_items')
          .update({ 
            received_quantity: item.received_quantity,
            batch_number: item.batch_number || null,
            expiry_date: item.expiry_date || null,
          })
          .eq('id', item.id);
      }

      // 2. Update inventory for each item
      for (const item of items) {
        if (item.received_quantity <= 0) continue;

        // Check if inventory record exists
        const { data: existingInventory } = await supabase
          .from('distributor_inventory')
          .select('*')
          .eq('distributor_id', distributorId)
          .eq('product_id', item.product_id)
          .eq('variant_id', item.variant_id || null)
          .maybeSingle();

        if (existingInventory) {
          // Update existing inventory
          const newQty = existingInventory.quantity + item.received_quantity;
          const newAvailable = (existingInventory.available_quantity || 0) + item.received_quantity;
          const newValue = newQty * (existingInventory.unit_cost || item.unit_price);

          await supabase
            .from('distributor_inventory')
            .update({
              quantity: newQty,
              available_quantity: newAvailable,
              total_value: newValue,
              last_received_date: new Date().toISOString().split('T')[0],
              batch_number: item.batch_number || existingInventory.batch_number,
              expiry_date: item.expiry_date || existingInventory.expiry_date,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingInventory.id);
        } else {
          // Create new inventory record
          await supabase
            .from('distributor_inventory')
            .insert({
              distributor_id: distributorId,
              product_id: item.product_id,
              variant_id: item.variant_id || null,
              product_name: item.product_name,
              variant_name: item.variant_name || null,
              quantity: item.received_quantity,
              reserved_quantity: 0,
              available_quantity: item.received_quantity,
              reorder_level: 10,
              max_stock_level: 1000,
              unit: item.unit,
              unit_cost: item.unit_price,
              total_value: item.received_quantity * item.unit_price,
              batch_number: item.batch_number || null,
              expiry_date: item.expiry_date || null,
              last_received_date: new Date().toISOString().split('T')[0],
            });
        }

        // Log inward transaction
        await supabase
          .from('distributor_inventory_transactions')
          .insert({
            distributor_id: distributorId,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            transaction_type: 'inward',
            quantity: item.received_quantity,
            reference_type: 'primary_order',
            reference_id: orderId,
            reference_number: order.order_number,
            batch_number: item.batch_number || null,
            unit: item.unit,
            unit_cost: item.unit_price,
            notes: `GRN from primary order ${order.order_number}`,
            created_by: (await supabase.auth.getUser()).data.user?.id,
          });
      }

      // 3. Check if all items fully received
      const allFullyReceived = items.every(item => item.received_quantity >= item.quantity);
      const anyReceived = items.some(item => item.received_quantity > 0);

      // 4. Update order status
      let newStatus = order.status;
      if (allFullyReceived) {
        newStatus = 'delivered';
      } else if (anyReceived) {
        newStatus = 'partially_delivered';
      }

      await supabase
        .from('primary_orders')
        .update({ 
          status: newStatus,
          received_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      toast.success('GRN confirmed! Inventory updated.');
      navigate('/distributor-portal/primary-orders');
    } catch (error) {
      console.error('Error confirming GRN:', error);
      toast.error('Failed to confirm GRN');
    } finally {
      setSaving(false);
    }
  };

  const totalOrdered = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalReceived = items.reduce((sum, i) => sum + i.received_quantity, 0);
  const allMatch = items.every(i => i.received_quantity === i.quantity);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p>Order not found</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <header className="sticky-header-safe z-50 bg-card border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/distributor-portal/primary-orders')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-semibold text-foreground flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-primary" />
                  Goods Receipt
                </h1>
                <p className="text-xs text-muted-foreground">
                  {order.order_number} • {format(new Date(order.order_date), 'dd MMM yyyy')}
                </p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-700">
              <Truck className="w-3 h-3 mr-1" />
              {order.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Card */}
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Items</p>
                <p className="text-xl font-bold">{items.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ordered Qty</p>
                <p className="text-xl font-bold">{totalOrdered}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Received Qty</p>
                <p className={`text-xl font-bold ${allMatch ? 'text-green-600' : 'text-orange-600'}`}>
                  {totalReceived}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Indicator */}
        {!allMatch && (
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-orange-700">
                Received quantities differ from ordered. This will mark the order as partially delivered.
              </span>
            </CardContent>
          </Card>
        )}

        {allMatch && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">
                All items match ordered quantities. Order will be marked as delivered.
              </span>
            </CardContent>
          </Card>
        )}

        {/* Items List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              Verify Received Items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item) => (
              <div 
                key={item.id}
                className="p-4 rounded-lg bg-muted/50 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{item.product_name}</p>
                    {item.variant_name && (
                      <p className="text-sm text-muted-foreground">{item.variant_name}</p>
                    )}
                  </div>
                  <Badge variant="outline">
                    Ordered: {item.quantity} {item.unit}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Received Quantity
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={item.received_quantity}
                      onChange={(e) => updateReceivedQty(item.id, parseInt(e.target.value) || 0)}
                      className={item.received_quantity !== item.quantity ? 'border-orange-300' : ''}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Batch Number
                    </label>
                    <Input
                      placeholder="Enter batch"
                      value={item.batch_number || ''}
                      onChange={(e) => updateBatchNumber(item.id, e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Expiry Date
                    </label>
                    <Input
                      type="date"
                      value={item.expiry_date || ''}
                      onChange={(e) => updateExpiryDate(item.id, e.target.value)}
                    />
                  </div>
                </div>

                {item.received_quantity !== item.quantity && (
                  <p className="text-xs text-orange-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Quantity mismatch: ordered {item.quantity}, receiving {item.received_quantity}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => navigate('/distributor-portal/primary-orders')}
          >
            Cancel
          </Button>
          <Button 
            className="flex-1"
            onClick={handleConfirmGRN}
            disabled={saving || totalReceived === 0}
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <FileCheck className="w-4 h-4 mr-2" />
            )}
            Confirm GRN & Update Inventory
          </Button>
        </div>
      </main>
    </div>
  );
};

export default GoodsReceipt;
