import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Filter, 
  Package,
  Calendar,
  Truck,
  Clock,
  Building2,
  Eye,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PrimaryOrder {
  id: string;
  order_number: string;
  distributor_id: string;
  order_date: string;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_terms: string | null;
  payment_status: string | null;
  shipping_address: string | null;
  notes: string | null;
  dispatch_reference: string | null;
  transporter_name: string | null;
  vehicle_number: string | null;
  created_at: string;
  distributor?: {
    name: string;
    contact_person: string;
    phone: string;
  };
}

interface OrderItem {
  id: string;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
}

const PrimaryOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PrimaryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<PrimaryOrder | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [syncingInventory, setSyncingInventory] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('primary_orders')
        .select(`
          *,
          distributor:distributors(name, contact_person, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadOrderItems = async (orderId: string) => {
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from('primary_order_items')
        .select('*')
        .eq('order_id', orderId);

      if (error) throw error;
      setOrderItems(data || []);
    } catch (error: any) {
      console.error('Error loading order items:', error);
      toast.error('Failed to load order items');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleViewOrder = (order: PrimaryOrder) => {
    setSelectedOrder(order);
    loadOrderItems(order.id);
  };

  const updateDistributorInventory = async (orderId: string, distributorId: string) => {
    try {
      // Fetch order items
      const { data: orderItems, error: itemsError } = await supabase
        .from('primary_order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;
      if (!orderItems || orderItems.length === 0) return;

      // Fetch order details for reference
      const { data: orderData, error: orderError } = await supabase
        .from('primary_orders')
        .select('order_number')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      const orderNumber = orderData?.order_number || orderId;

      // NOTE: distributor_inventory.available_quantity and distributor_inventory.total_value
      // are GENERATED ALWAYS columns in DB. Do not write to them directly.

      for (const item of orderItems) {
        const receivedQty = item.received_quantity && item.received_quantity > 0 
          ? item.received_quantity 
          : item.quantity;
        if (receivedQty <= 0) continue;

        // Build query with proper null handling for variant_id
        let inventoryQuery = supabase
          .from('distributor_inventory')
          .select('*')
          .eq('distributor_id', distributorId)
          .eq('product_id', item.product_id);

        // Use .is() for null, .eq() for actual values
        if (item.variant_id) {
          inventoryQuery = inventoryQuery.eq('variant_id', item.variant_id);
        } else {
          inventoryQuery = inventoryQuery.is('variant_id', null);
        }

        const { data: existingInventory, error: existingError } = await inventoryQuery.maybeSingle();

        if (existingError) throw existingError;

        if (existingInventory) {
          const { error: updateError } = await supabase
            .from('distributor_inventory')
            .update({
              quantity: (existingInventory.quantity || 0) + receivedQty,
              unit_cost: existingInventory.unit_cost || item.unit_price,
              last_received_date: new Date().toISOString().split('T')[0],
              batch_number: item.batch_number || existingInventory.batch_number,
              expiry_date: item.expiry_date || existingInventory.expiry_date,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingInventory.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('distributor_inventory')
            .insert({
              distributor_id: distributorId,
              product_id: item.product_id,
              variant_id: item.variant_id || null,
              product_name: item.product_name,
              variant_name: item.variant_name || null,
              sku: item.sku,
              quantity: receivedQty,
              reserved_quantity: 0,
              reorder_level: 10,
              max_stock_level: 1000,
              unit: item.unit,
              unit_cost: item.unit_price,
              batch_number: item.batch_number || null,
              expiry_date: item.expiry_date || null,
              last_received_date: new Date().toISOString().split('T')[0],
            });

          if (insertError) throw insertError;
        }

        const { error: txnError } = await supabase
          .from('distributor_inventory_transactions')
          .insert({
            distributor_id: distributorId,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            transaction_type: 'inward',
            quantity: receivedQty,
            reference_type: 'primary_order',
            reference_id: orderId,
            reference_number: orderNumber,
            batch_number: item.batch_number || null,
            unit: item.unit,
            unit_cost: item.unit_price,
            notes: `Auto GRN from primary order ${orderNumber} (Admin Delivery)`,
          });

        if (txnError) throw txnError;
      }

      console.log('Distributor inventory updated successfully');
    } catch (error) {
      console.error('Error updating distributor inventory:', error);
      throw error;
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const updateData: any = { status: newStatus, updated_at: new Date().toISOString() };
      
      if (newStatus === 'dispatched') {
        updateData.dispatched_at = new Date().toISOString();
      } else if (newStatus === 'delivered') {
        updateData.actual_delivery_date = new Date().toISOString().split('T')[0];
      }

      // Get the order's distributor_id for inventory update
      const order = orders.find(o => o.id === orderId) || selectedOrder;
      const distributorId = order?.distributor_id;

      const { error } = await supabase
        .from('primary_orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      // If marking as delivered, update distributor inventory
      if (newStatus === 'delivered' && distributorId) {
        try {
          await updateDistributorInventory(orderId, distributorId);
          toast.success('Order delivered and inventory updated successfully');
        } catch (invError) {
          console.error('Inventory update failed:', invError);
          toast.warning('Order marked delivered but inventory update failed. Please update inventory manually.');
        }
      } else {
        toast.success(`Order status updated to ${newStatus.replace('_', ' ')}`);
      }

      loadOrders();
      
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const checkInventorySynced = async (orderId: string, distributorId: string) => {
    // Check if transaction logs exist
    const { count: txCount, error: txError } = await supabase
      .from('distributor_inventory_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('reference_type', 'primary_order')
      .eq('reference_id', orderId)
      .eq('transaction_type', 'inward');

    if (txError) throw txError;

    // Also verify that actual inventory records exist for this distributor
    const { count: invCount, error: invError } = await supabase
      .from('distributor_inventory')
      .select('id', { count: 'exact', head: true })
      .eq('distributor_id', distributorId);

    if (invError) throw invError;

    // Only consider synced if BOTH transactions AND inventory records exist
    return (txCount || 0) > 0 && (invCount || 0) > 0;
  };

  const syncInventoryForOrder = async (order: PrimaryOrder) => {
    if (!order?.id || !order?.distributor_id) return;

    setSyncingInventory(true);
    try {
      const alreadySynced = await checkInventorySynced(order.id, order.distributor_id);
      if (alreadySynced) {
        toast.message('Inventory already synced for this order');
        return;
      }

      await updateDistributorInventory(order.id, order.distributor_id);
      toast.success('Inventory synced successfully');
    } catch (e) {
      console.error('Error syncing inventory:', e);
      toast.error('Failed to sync inventory');
    } finally {
      setSyncingInventory(false);
    }
  };
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      confirmed: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      processing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      dispatched: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      in_transit: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      partially_delivered: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const getStatusIcon = (status: string) => {
    if (['draft', 'submitted'].includes(status)) return <Clock className="w-4 h-4" />;
    if (['confirmed', 'processing'].includes(status)) return <Package className="w-4 h-4" />;
    if (['dispatched', 'in_transit'].includes(status)) return <Truck className="w-4 h-4" />;
    if (status === 'delivered') return <CheckCircle className="w-4 h-4" />;
    if (status === 'cancelled') return <XCircle className="w-4 h-4" />;
    return <Package className="w-4 h-4" />;
  };

  const getNextStatuses = (currentStatus: string): string[] => {
    const statusFlow: Record<string, string[]> = {
      draft: ['submitted', 'cancelled'],
      submitted: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['dispatched', 'cancelled'],
      dispatched: ['in_transit', 'delivered', 'partially_delivered'],
      in_transit: ['delivered', 'partially_delivered'],
      partially_delivered: ['delivered'],
    };
    return statusFlow[currentStatus] || [];
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.distributor?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 pb-24 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Primary Orders</h1>
            <p className="text-sm text-muted-foreground">{orders.length} total orders from distributors</p>
          </div>
          <Button variant="outline" size="icon" onClick={loadOrders}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by order number or distributor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-2">No orders found</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your filters' 
                  : 'No primary orders have been placed yet'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <Card 
                key={order.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-foreground">{order.order_number}</h3>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Building2 className="w-3.5 h-3.5" />
                          <span className="truncate">{order.distributor?.name || 'Unknown Distributor'}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{format(new Date(order.order_date), 'dd MMM yyyy')}</span>
                          </div>
                          {order.expected_delivery_date && (
                            <div className="flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5" />
                              <span>ETA: {format(new Date(order.expected_delivery_date), 'dd MMM')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-semibold text-foreground">
                        ₹{order.total_amount?.toLocaleString('en-IN') || '0'}
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => handleViewOrder(order)}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Order: {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Distributor</p>
                  <p className="font-medium">{selectedOrder.distributor?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Order Date</p>
                  <p className="font-medium">{format(new Date(selectedOrder.order_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expected Delivery</p>
                  <p className="font-medium">
                    {selectedOrder.expected_delivery_date 
                      ? format(new Date(selectedOrder.expected_delivery_date), 'dd MMM yyyy')
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={getStatusColor(selectedOrder.status)}>
                    {selectedOrder.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              {/* Status Actions */}
              {getNextStatuses(selectedOrder.status).length > 0 ? (
                <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg items-center">
                  <span className="text-sm text-muted-foreground mr-2">Update Status:</span>
                  {getNextStatuses(selectedOrder.status).map(status => (
                    <Button
                      key={status}
                      size="sm"
                      variant={status === 'cancelled' ? 'destructive' : 'secondary'}
                      disabled={updatingStatus}
                      onClick={() => updateOrderStatus(selectedOrder.id, status)}
                    >
                      {status.replace('_', ' ')}
                    </Button>
                  ))}

                  {['delivered', 'partially_delivered'].includes(selectedOrder.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      disabled={syncingInventory}
                      onClick={() => syncInventoryForOrder(selectedOrder)}
                      title="Sync inventory if this order was delivered earlier but stock was not updated"
                    >
                      {syncingInventory ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Sync Inventory
                    </Button>
                  )}
                </div>
              ) : (
                ['delivered', 'partially_delivered'].includes(selectedOrder.status) ? (
                  <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg items-center">
                    <span className="text-sm text-muted-foreground">Inventory not updated? You can resync.</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      disabled={syncingInventory}
                      onClick={() => syncInventoryForOrder(selectedOrder)}
                    >
                      {syncingInventory ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Sync Inventory
                    </Button>
                  </div>
                ) : null
              )}

              {/* Order Items */}
              <div>
                <h4 className="font-medium mb-3">Order Items</h4>
                {loadingItems ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.product_name}</p>
                                {item.variant_name && (
                                  <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity} {item.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              ₹{item.unit_price?.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ₹{item.line_total?.toLocaleString('en-IN')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Order Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{selectedOrder.subtotal?.toLocaleString('en-IN') || '0'}</span>
                  </div>
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-₹{selectedOrder.discount_amount?.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {selectedOrder.tax_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span>₹{selectedOrder.tax_amount?.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-base pt-2 border-t">
                    <span>Total</span>
                    <span>₹{selectedOrder.total_amount?.toLocaleString('en-IN') || '0'}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Dispatch Info */}
              {selectedOrder.dispatch_reference && (
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Dispatch Ref</p>
                    <p className="font-medium">{selectedOrder.dispatch_reference}</p>
                  </div>
                  {selectedOrder.transporter_name && (
                    <div>
                      <p className="text-xs text-muted-foreground">Transporter</p>
                      <p className="font-medium">{selectedOrder.transporter_name}</p>
                    </div>
                  )}
                  {selectedOrder.vehicle_number && (
                    <div>
                      <p className="text-xs text-muted-foreground">Vehicle</p>
                      <p className="font-medium">{selectedOrder.vehicle_number}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default PrimaryOrders;
