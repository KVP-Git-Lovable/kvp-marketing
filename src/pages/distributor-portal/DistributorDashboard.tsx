import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  ShoppingCart, 
  Truck, 
  ClipboardList, 
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  LogOut,
  Plus,
  Building2,
  ShieldCheck,
  X,
  FileText,
  Headphones,
  Lightbulb,
  Building,
  Users,
  Target,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DistributorUser {
  id: string;
  full_name: string;
  role: string;
  distributor_id: string;
  distributors?: { name: string };
}

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  inTransitOrders: number;
  lowStockItems: number;
  totalInventoryValue: number;
  recentOrders: any[];
}

const DistributorDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<DistributorUser | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    inTransitOrders: 0,
    lowStockItems: 0,
    totalInventoryValue: 0,
    recentOrders: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for pending admin impersonation
    const pendingImpersonation = localStorage.getItem('pending_impersonation');
    if (pendingImpersonation) {
      try {
        const impersonationData = JSON.parse(pendingImpersonation);
        // Check if impersonation data is recent (within 30 seconds)
        if (Date.now() - impersonationData.timestamp < 30000) {
          // Set up impersonation context
          localStorage.setItem('distributor_user', JSON.stringify(impersonationData.distributorUser));
          localStorage.setItem('distributor_id', impersonationData.distributorId);
          sessionStorage.setItem('admin_impersonation', JSON.stringify({
            adminUserId: impersonationData.adminUserId,
            returnUrl: impersonationData.returnUrl,
            impersonatedUser: impersonationData.impersonatedUser,
          }));
          localStorage.removeItem('pending_impersonation');
          
          setUser(impersonationData.distributorUser);
          loadDashboardData(impersonationData.distributorId);
          toast.success(`Viewing portal as ${impersonationData.impersonatedUser}`, {
            description: 'Admin viewing mode active',
          });
          return;
        }
      } catch (e) {
        console.error('Failed to parse impersonation data:', e);
      }
      localStorage.removeItem('pending_impersonation');
    }

    const storedUser = localStorage.getItem('distributor_user');
    if (!storedUser) {
      navigate('/distributor-portal/login');
      return;
    }
    setUser(JSON.parse(storedUser));
    loadDashboardData(JSON.parse(storedUser).distributor_id);
  }, [navigate]);

  const loadDashboardData = async (distributorId: string) => {
    try {
      // Fetch order stats
      const { data: orders } = await supabase
        .from('primary_orders')
        .select('*')
        .eq('distributor_id', distributorId);

      const pendingOrders = orders?.filter(o => ['draft', 'submitted', 'confirmed', 'processing'].includes(o.status)) || [];
      const inTransitOrders = orders?.filter(o => ['dispatched', 'in_transit'].includes(o.status)) || [];

      // Fetch inventory stats
      const { data: inventory } = await supabase
        .from('distributor_inventory')
        .select('*')
        .eq('distributor_id', distributorId);

      const lowStockItems = inventory?.filter(i => i.quantity <= i.reorder_level) || [];
      const totalValue = inventory?.reduce((sum, i) => sum + (i.quantity * (i.unit_cost || 0)), 0) || 0;

      // Recent orders
      const { data: recentOrders } = await supabase
        .from('primary_orders')
        .select('*')
        .eq('distributor_id', distributorId)
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        totalOrders: orders?.length || 0,
        pendingOrders: pendingOrders.length,
        inTransitOrders: inTransitOrders.length,
        lowStockItems: lowStockItems.length,
        totalInventoryValue: totalValue,
        recentOrders: recentOrders || [],
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    // Check if this is an impersonation session
    const impersonationData = sessionStorage.getItem('admin_impersonation');
    const storedUser = localStorage.getItem('distributor_user');
    const isImpersonated = storedUser ? JSON.parse(storedUser).is_impersonated : false;

    if (isImpersonated && impersonationData) {
      // Clear impersonation data
      localStorage.removeItem('distributor_user');
      localStorage.removeItem('distributor_id');
      sessionStorage.removeItem('admin_impersonation');
      
      const { returnUrl } = JSON.parse(impersonationData);
      toast.success('Exited impersonation mode');
      window.close(); // Close the impersonation tab
      return;
    }

    await supabase.auth.signOut();
    localStorage.removeItem('distributor_user');
    localStorage.removeItem('distributor_id');
    navigate('/distributor-portal/login');
    toast.success('Logged out successfully');
  };

  // Check if viewing as admin
  const isImpersonated = user && (user as any).is_impersonated;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      submitted: 'bg-blue-100 text-blue-700',
      confirmed: 'bg-indigo-100 text-indigo-700',
      processing: 'bg-yellow-100 text-yellow-700',
      dispatched: 'bg-purple-100 text-purple-700',
      in_transit: 'bg-orange-100 text-orange-700',
      delivered: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Admin Impersonation Banner */}
      {isImpersonated && (
        <div className="sticky-header-safe z-[60] bg-amber-500 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-sm font-medium">
                Admin Viewing Mode: You are viewing as {user?.full_name}
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
      <header className={`sticky ${isImpersonated ? 'top-[calc(var(--sat)+40px)]' : 'sticky-header-safe'} z-50 bg-card border-b shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">
                {user?.distributors?.name || 'Distributor Portal'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {user?.full_name} • {user?.role}
                {isImpersonated && <span className="ml-1 text-amber-600">(Admin View)</span>}
              </p>
            </div>
          </div>
          {!isImpersonated && (
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate('/distributor-portal/create-primary-order')}>
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
          <Button variant="outline" onClick={() => navigate('/distributor-portal/primary-orders')}>
            <ClipboardList className="w-4 h-4 mr-2" />
            Primary Orders
          </Button>
          <Button variant="outline" onClick={() => navigate('/distributor-portal/secondary-sales')}>
            <ShoppingCart className="w-4 h-4 mr-2" />
            Secondary Sales
          </Button>
          <Button variant="outline" onClick={() => navigate('/distributor-portal/inventory')}>
            <Package className="w-4 h-4 mr-2" />
            Inventory
          </Button>
          <Button variant="outline" onClick={() => navigate('/distributor-portal/returns')}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Returns
          </Button>
          <Button variant="outline" onClick={() => navigate('/distributor-portal/claims')}>
            <FileText className="w-4 h-4 mr-2" />
            Claims
          </Button>
          <Button variant="outline" onClick={() => navigate('/distributor-portal/support')}>
            <Headphones className="w-4 h-4 mr-2" />
            Support
          </Button>
          <Button variant="outline" onClick={() => navigate('/distributor-portal/ideas')}>
            <Lightbulb className="w-4 h-4 mr-2" />
            Ideas
          </Button>
          <Button variant="outline" onClick={() => navigate('/distributor-portal/profile')}>
            <Building className="w-4 h-4 mr-2" />
            Profile
          </Button>
          <Button variant="outline" onClick={() => navigate('/distributor-portal/contacts')}>
            <Users className="w-4 h-4 mr-2" />
            Team
          </Button>
          <Button variant="outline" onClick={() => navigate('/distributor-portal/fy-plan')}>
            <Target className="w-4 h-4 mr-2" />
            FY Plan
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalOrders}</p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pendingOrders}</p>
                </div>
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Transit</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.inTransitOrders}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Truck className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-bold text-red-600">{stats.lowStockItems}</p>
                </div>
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Inventory Value Card */}
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Inventory Value</p>
                <p className="text-3xl font-bold text-foreground">
                  ₹{stats.totalInventoryValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Orders</CardTitle>
                <CardDescription>Your latest primary orders</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/distributor-portal/primary-orders')}
              >
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No orders yet</p>
                <Button 
                  variant="link" 
                  onClick={() => navigate('/distributor-portal/create-primary-order')}
                  className="mt-2"
                >
                  Create your first order
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentOrders.map((order) => (
                  <div 
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigate(`/distributor-portal/primary-order/${order.id}`)}
                  >
                    <div>
                      <p className="font-medium text-foreground">{order.order_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.order_date), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(order.status)}>
                        {order.status.replace('_', ' ')}
                      </Badge>
                      <p className="text-sm font-medium mt-1">
                        ₹{order.total_amount?.toLocaleString('en-IN') || '0'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default DistributorDashboard;
