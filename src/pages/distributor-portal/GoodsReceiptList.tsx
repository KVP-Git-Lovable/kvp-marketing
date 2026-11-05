import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Package, 
  Truck,
  Calendar,
  ClipboardCheck,
  Search,
  PackageCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface PendingOrder {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  total_amount: number;
  total_items: number;
  dispatched_at?: string;
}

const GoodsReceiptList = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const distributorId = localStorage.getItem('distributor_id');

  useEffect(() => {
    if (!distributorId) {
      navigate('/distributor-portal/login');
      return;
    }
    loadPendingOrders();
  }, [distributorId]);

  const loadPendingOrders = async () => {
    try {
      // Get orders that are dispatched or in_transit (ready for GRN)
      const { data, error } = await supabase
        .from('primary_orders')
        .select('id, order_number, order_date, status, total_amount, dispatched_at')
        .eq('distributor_id', distributorId)
        .in('status', ['dispatched', 'in_transit'])
        .order('dispatched_at', { ascending: false });

      if (error) throw error;

      // Get item counts for each order
      const ordersWithCounts = await Promise.all(
        (data || []).map(async (order) => {
          const { count } = await supabase
            .from('primary_order_items')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', order.id);

          return {
            ...order,
            total_items: count || 0
          };
        })
      );

      setOrders(ordersWithCounts);
    } catch (error) {
      console.error('Error loading pending orders:', error);
      toast.error('Failed to load pending orders');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'dispatched': return 'bg-blue-100 text-blue-700';
      case 'in_transit': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            Goods Receipt
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Receive dispatched orders and update inventory
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by order number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Pending GRN</p>
              <p className="text-2xl font-bold text-primary">{orders.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Items</p>
              <p className="text-2xl font-bold">{orders.reduce((sum, o) => sum + o.total_items, 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <PackageCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium text-foreground mb-1">No Pending GRN</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery 
                ? 'No orders match your search' 
                : 'All dispatched orders have been received'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <Card 
              key={order.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/distributor-portal/goods-receipt/${order.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground">{order.order_number}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Calendar className="w-3 h-3" />
                      <span>Ordered: {format(new Date(order.order_date), 'dd MMM yyyy')}</span>
                    </div>
                    {order.dispatched_at && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Truck className="w-3 h-3" />
                        <span>Dispatched: {format(new Date(order.dispatched_at), 'dd MMM yyyy')}</span>
                      </div>
                    )}
                  </div>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      {order.total_items} items
                    </span>
                    <span className="font-medium">
                      ₹{order.total_amount.toLocaleString()}
                    </span>
                  </div>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                    <ClipboardCheck className="w-4 h-4 mr-1" />
                    Create GRN
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default GoodsReceiptList;
