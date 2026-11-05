import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowLeft, 
  Package,
  Calendar,
  Truck,
  Clock,
  ClipboardCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const PrimaryOrdersList = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const distributorId = localStorage.getItem('distributor_id');

  useEffect(() => {
    if (!distributorId) {
      navigate('/distributor-portal/login');
      return;
    }
    loadOrders();
  }, [distributorId, navigate]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('primary_orders')
        .select('id, order_number, order_date, expected_delivery_date, status, total_amount, created_at, primary_order_items(count)')
        .eq('distributor_id', distributorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      submitted: 'bg-blue-100 text-blue-700',
      confirmed: 'bg-indigo-100 text-indigo-700',
      processing: 'bg-yellow-100 text-yellow-700',
      dispatched: 'bg-purple-100 text-purple-700',
      in_transit: 'bg-orange-100 text-orange-700',
      delivered: 'bg-green-100 text-green-700',
      partially_delivered: 'bg-amber-100 text-amber-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const getStatusIcon = (status: string) => {
    if (['draft', 'submitted'].includes(status)) return <Clock className="w-4 h-4" />;
    if (['confirmed', 'processing'].includes(status)) return <Package className="w-4 h-4" />;
    if (['dispatched', 'in_transit'].includes(status)) return <Truck className="w-4 h-4" />;
    return <Package className="w-4 h-4" />;
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Primary Orders</h1>
          <p className="text-muted-foreground">{orders.length} orders total</p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => navigate('/distributor-portal/create-primary-order')} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by order number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
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
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your filters' 
                  : 'Create your first primary order'}
              </p>
              <Button onClick={() => navigate('/distributor-portal/create-primary-order')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Order
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <Card 
                key={order.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/distributor-portal/primary-order/${order.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{order.order_number}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{format(new Date(order.order_date), 'dd MMM yyyy')}</span>
                        </div>
                        {order.expected_delivery_date && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                            <Truck className="w-3.5 h-3.5" />
                            <span>Expected: {format(new Date(order.expected_delivery_date), 'dd MMM yyyy')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge className={getStatusColor(order.status)}>
                        {order.status.replace('_', ' ')}
                      </Badge>
                      <p className="text-lg font-semibold text-foreground">
                        ₹{order.total_amount?.toLocaleString('en-IN') || '0'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.primary_order_items?.[0]?.count || 0} items
                      </p>
                      {['dispatched', 'in_transit'].includes(order.status) && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/distributor-portal/goods-receipt/${order.id}`);
                          }}
                        >
                          <ClipboardCheck className="w-3 h-3 mr-1" />
                          Create GRN
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
};

export default PrimaryOrdersList;
