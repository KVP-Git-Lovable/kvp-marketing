import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ArrowLeft, 
  Package, 
  Calendar,
  Printer,
  Download,
  CheckCircle2,
  Store,
  MapPin,
  Building2,
  LogOut,
  ShieldCheck,
  X,
  ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface DistributorUser {
  id: string;
  full_name: string;
  role: string;
  distributor_id: string;
  distributors?: { name: string };
  is_impersonated?: boolean;
}

interface PackingItem {
  product_id: string;
  product_name: string;
  unit: string;
  total_quantity: number;
  order_count: number;
  retailers: { name: string; quantity: number }[];
}

interface OrderWithRetailer {
  id: string;
  retailer_name: string;
  retailer_id: string;
  total_amount: number;
  created_at: string;
  beat_name?: string;
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit: string;
  }[];
}

const PackingList = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<DistributorUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('yesterday');
  const [packingItems, setPackingItems] = useState<PackingItem[]>([]);
  const [orders, setOrders] = useState<OrderWithRetailer[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'products' | 'orders'>('products');

  useEffect(() => {
    const storedUser = localStorage.getItem('distributor_user');
    if (!storedUser) {
      navigate('/distributor-portal/login');
      return;
    }
    const userData = JSON.parse(storedUser);
    setUser(userData);
    loadPackingData(userData.distributor_id, selectedDate);
  }, [navigate]);

  useEffect(() => {
    if (user?.distributor_id) {
      loadPackingData(user.distributor_id, selectedDate);
    }
  }, [selectedDate, user?.distributor_id]);

  const getDateRange = (dateOption: string) => {
    const today = new Date();
    switch (dateOption) {
      case 'today':
        return { start: startOfDay(today), end: endOfDay(today) };
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case 'last3days':
        return { start: startOfDay(subDays(today, 3)), end: endOfDay(today) };
      case 'last7days':
        return { start: startOfDay(subDays(today, 7)), end: endOfDay(today) };
      default:
        return { start: startOfDay(subDays(today, 1)), end: endOfDay(today) };
    }
  };

  const loadPackingData = async (distributorId: string, dateOption: string) => {
    try {
      setLoading(true);
      const { start, end } = getDateRange(dateOption);

      // Get retailers mapped to this distributor
      const { data: retailers } = await supabase
        .from('retailers')
        .select('id, name, beat_name')
        .eq('distributor_id', distributorId);

      if (!retailers || retailers.length === 0) {
        setPackingItems([]);
        setOrders([]);
        setLoading(false);
        return;
      }

      const retailerIds = retailers.map(r => r.id);
      const retailerMap = new Map(retailers.map(r => [r.id, r]));

      // Get pending orders from these retailers for the date range
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('id, retailer_id, retailer_name, total_amount, created_at, status')
        .in('retailer_id', retailerIds)
        .eq('status', 'confirmed')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!ordersData || ordersData.length === 0) {
        setPackingItems([]);
        setOrders([]);
        setLoading(false);
        return;
      }

      // Fetch order items for all orders
      const orderIds = ordersData.map(o => o.id);
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('order_id, product_id, product_name, quantity, unit')
        .in('order_id', orderIds);

      // Aggregate items by product
      const productMap = new Map<string, PackingItem>();
      
      itemsData?.forEach(item => {
        const order = ordersData.find(o => o.id === item.order_id);
        if (!order) return;

        const retailer = retailerMap.get(order.retailer_id);
        const key = `${item.product_id}-${item.unit}`;

        if (productMap.has(key)) {
          const existing = productMap.get(key)!;
          existing.total_quantity += item.quantity;
          existing.order_count += 1;
          existing.retailers.push({ 
            name: order.retailer_name, 
            quantity: item.quantity 
          });
        } else {
          productMap.set(key, {
            product_id: item.product_id,
            product_name: item.product_name,
            unit: item.unit,
            total_quantity: item.quantity,
            order_count: 1,
            retailers: [{ name: order.retailer_name, quantity: item.quantity }],
          });
        }
      });

      // Build orders with items
      const ordersWithItems: OrderWithRetailer[] = ordersData.map(order => ({
        id: order.id,
        retailer_name: order.retailer_name,
        retailer_id: order.retailer_id,
        total_amount: order.total_amount,
        created_at: order.created_at,
        beat_name: retailerMap.get(order.retailer_id)?.beat_name,
        items: itemsData?.filter(i => i.order_id === order.id) || [],
      }));

      setPackingItems(Array.from(productMap.values()).sort((a, b) => 
        a.product_name.localeCompare(b.product_name)
      ));
      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Error loading packing data:', error);
      toast.error('Failed to load packing list');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (productId: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(productId)) {
      newChecked.delete(productId);
    } else {
      newChecked.add(productId);
    }
    setCheckedItems(newChecked);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = async () => {
    const isImpersonated = user?.is_impersonated;
    if (isImpersonated) {
      localStorage.removeItem('distributor_user');
      localStorage.removeItem('distributor_id');
      sessionStorage.removeItem('admin_impersonation');
      window.close();
      return;
    }
    await supabase.auth.signOut();
    localStorage.removeItem('distributor_user');
    localStorage.removeItem('distributor_id');
    navigate('/distributor-portal/login');
  };

  const isImpersonated = user?.is_impersonated;

  const getDateLabel = () => {
    switch (selectedDate) {
      case 'today': return "Today's Orders";
      case 'yesterday': return "Yesterday's Orders";
      case 'last3days': return 'Last 3 Days';
      case 'last7days': return 'Last 7 Days';
      default: return 'Orders';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="print:bg-white">
      {/* Admin Impersonation Banner */}
      {isImpersonated && (
        <div className="sticky-header-safe z-[60] bg-amber-500 text-white px-4 py-2 print:hidden">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-sm font-medium">
                Admin Viewing Mode: {user?.full_name}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="h-7 text-white hover:bg-amber-600"
            >
              <X className="w-4 h-4 mr-1" />
              Exit View
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`sticky ${isImpersonated ? 'top-[calc(var(--sat)+40px)]' : 'sticky-header-safe'} z-50 bg-card border-b shadow-sm print:hidden`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/distributor-portal/secondary-sales')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-foreground">Packing List</h1>
              <p className="text-xs text-muted-foreground">
                Aggregate products for delivery
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            {!isImpersonated && (
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Print Header */}
      <div className="hidden print:block p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{user?.distributors?.name || 'Distributor'}</h1>
            <h2 className="text-lg">Packing List - {getDateLabel()}</h2>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Generated: {format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
            <p>{packingItems.length} products • {orders.length} orders</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 print:hidden">
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="w-full sm:w-48">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="last3days">Last 3 Days</SelectItem>
              <SelectItem value="last7days">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              variant={viewMode === 'products' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('products')}
            >
              <Package className="w-4 h-4 mr-2" />
              By Products
            </Button>
            <Button
              variant={viewMode === 'orders' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('orders')}
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              By Orders
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 print:hidden">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Products</p>
                <p className="text-lg font-bold">{packingItems.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Orders</p>
                <p className="text-lg font-bold">{orders.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Packed</p>
                <p className="text-lg font-bold">{checkedItems.size}/{packingItems.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {packingItems.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No pending orders for {getDateLabel().toLowerCase()}</p>
          </Card>
        ) : viewMode === 'products' ? (
          /* Products View */
          <Card>
            <CardHeader className="py-3 px-4 bg-muted/50 print:bg-gray-100">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="w-4 h-4" />
                Products to Pack ({packingItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 print:hidden"></TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Quantity</TableHead>
                    <TableHead className="text-center">Unit</TableHead>
                    <TableHead className="text-center">Orders</TableHead>
                    <TableHead className="hidden md:table-cell">Retailers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packingItems.map((item) => (
                    <TableRow 
                      key={`${item.product_id}-${item.unit}`}
                      className={checkedItems.has(item.product_id) ? 'bg-green-50' : ''}
                    >
                      <TableCell className="print:hidden">
                        <Checkbox
                          checked={checkedItems.has(item.product_id)}
                          onCheckedChange={() => toggleItem(item.product_id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className={checkedItems.has(item.product_id) ? 'line-through text-muted-foreground' : ''}>
                          {item.product_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-base font-bold">
                          {item.total_quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {item.unit}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.order_count}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {item.retailers.slice(0, 3).map((r, i) => (
                          <span key={i}>
                            {r.name} ({r.quantity}){i < Math.min(2, item.retailers.length - 1) ? ', ' : ''}
                          </span>
                        ))}
                        {item.retailers.length > 3 && ` +${item.retailers.length - 3} more`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          /* Orders View */
          <div className="space-y-4">
            {orders.map(order => (
              <Card key={order.id}>
                <CardHeader className="py-3 px-4 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-primary" />
                      <CardTitle className="text-sm font-medium">{order.retailer_name}</CardTitle>
                      {order.beat_name && (
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="w-3 h-3 mr-1" />
                          {order.beat_name}
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm font-medium text-primary">
                      ₹{order.total_amount?.toLocaleString('en-IN')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.product_name}</span>
                        <span className="text-muted-foreground">
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Print Styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:bg-gray-100 { background: #f3f4f6 !important; }
        }
      `}</style>
    </div>
  );
};

export default PackingList;
