import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, Building, Calendar, ExternalLink, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PrimaryOrder {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  total_amount: number;
  expected_delivery_date: string | null;
  created_at: string;
  distributor_id: string;
  distributor_name?: string;
}

interface PortalOrdersTabProps {
  searchQuery: string;
}

export const PortalOrdersTab = ({ searchQuery }: PortalOrdersTabProps) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PrimaryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
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

      // Load orders
      const { data: orderData, error } = await supabase
        .from('primary_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Map distributor names
      const ordersWithDistributors = (orderData || []).map(order => ({
        ...order,
        distributor_name: distributorData?.find(d => d.id === order.distributor_id)?.name || 'Unknown'
      }));

      setOrders(ordersWithDistributors);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      submitted: 'bg-blue-100 text-blue-700',
      confirmed: 'bg-indigo-100 text-indigo-700',
      processing: 'bg-yellow-100 text-yellow-700',
      dispatched: 'bg-purple-100 text-purple-700',
      in_transit: 'bg-orange-100 text-orange-700',
      delivered: 'bg-green-100 text-green-700',
      partially_delivered: 'bg-amber-100 text-amber-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return <Badge className={config[status] || 'bg-gray-100'}>{status.replace('_', ' ')}</Badge>;
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.distributor_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesDistributor = distributorFilter === 'all' || order.distributor_id === distributorFilter;
    
    return matchesSearch && matchesStatus && matchesDistributor;
  });

  const totalValue = filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

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
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
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

          <div className="ml-auto flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {filteredOrders.length} orders
            </div>
            <div className="flex items-center gap-1 text-sm font-medium text-green-600">
              <IndianRupee className="h-4 w-4" />
              {totalValue.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Table */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Distributor</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Expected Delivery</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{order.distributor_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(order.order_date), 'dd MMM yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(order.status)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{order.total_amount?.toLocaleString('en-IN') || '0'}
                    </TableCell>
                    <TableCell>
                      {order.expected_delivery_date ? (
                        <span className="text-sm">
                          {format(new Date(order.expected_delivery_date), 'dd MMM yyyy')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/primary-orders?order=${order.id}`)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
