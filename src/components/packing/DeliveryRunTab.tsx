import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  Truck, 
  MapPin, 
  User, 
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Navigation,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CurrentLocationMap } from '@/components/CurrentLocationMap';

interface DeliveryRun {
  id: string;
  packing_list_id: string;
  packing_list_number: string;
  delivery_date: string;
  status: string;
  agent_id: string | null;
  agent_name: string | null;
  agent_phone: string | null;
  agent_avatar: string | null;
  van_id: string | null;
  van_registration: string | null;
  van_make_model: string | null;
  total_orders: number;
  completed_orders: number;
  partial_orders: number;
  failed_orders: number;
  pending_orders: number;
  total_value: number;
  last_location_time: string | null;
}

export default function DeliveryRunTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [deliveryRuns, setDeliveryRuns] = useState<DeliveryRun[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDeliveryRuns = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Get dispatched/packed packing lists with assignments
      const { data: assignments, error: assignmentError } = await supabase
        .from('packing_list_assignments')
        .select(`
          id,
          packing_list_id,
          agent_id,
          van_id,
          status,
          packing_lists(
            id,
            packing_list_number,
            delivery_date,
            total_orders,
            total_value,
            status
          )
        `)
        .in('status', ['assigned', 'in_transit']);

      if (assignmentError) throw assignmentError;

      // Filter to today's and future deliveries
      const relevantAssignments = (assignments || []).filter((a: any) => {
        const packingList = a.packing_lists;
        return packingList && 
          packingList.delivery_date >= today &&
          ['dispatched', 'packed'].includes(packingList.status);
      });

      // Fetch agent and van details
      const runs: DeliveryRun[] = [];

      for (const assignment of relevantAssignments) {
        const packingList = (assignment as any).packing_lists;
        if (!packingList) continue;

        // Get agent details
        let agentName = null;
        let agentPhone = null;
        let agentAvatar = null;
        if (assignment.agent_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone_number, profile_picture_url')
            .eq('id', assignment.agent_id)
            .single();
          if (profile) {
            agentName = profile.full_name;
            agentPhone = profile.phone_number;
            agentAvatar = profile.profile_picture_url;
          }
        }

        // Get van details
        let vanRegistration = null;
        let vanMakeModel = null;
        if (assignment.van_id) {
          const { data: van } = await supabase
            .from('vans')
            .select('registration_number, make_model')
            .eq('id', assignment.van_id)
            .single();
          if (van) {
            vanRegistration = van.registration_number;
            vanMakeModel = van.make_model;
          }
        }

        // Get order delivery status counts
        const { data: orders } = await supabase
          .from('orders')
          .select('delivery_status')
          .eq('packing_list_id', packingList.id);

        const orderStatuses = orders || [];
        const completedOrders = orderStatuses.filter(o => o.delivery_status === 'delivered').length;
        const partialOrders = orderStatuses.filter(o => o.delivery_status === 'partial').length;
        const failedOrders = orderStatuses.filter(o => o.delivery_status === 'failed').length;
        const pendingOrders = orderStatuses.filter(o => o.delivery_status === 'dispatched').length;

        // Get last location time
        let lastLocationTime = null;
        if (assignment.agent_id) {
          const { data: tracking } = await supabase
            .from('gps_tracking')
            .select('timestamp')
            .eq('user_id', assignment.agent_id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();
          if (tracking) {
            lastLocationTime = tracking.timestamp;
          }
        }

        runs.push({
          id: assignment.id,
          packing_list_id: packingList.id,
          packing_list_number: packingList.packing_list_number,
          delivery_date: packingList.delivery_date,
          status: packingList.status,
          agent_id: assignment.agent_id,
          agent_name: agentName,
          agent_phone: agentPhone,
          agent_avatar: agentAvatar,
          van_id: assignment.van_id,
          van_registration: vanRegistration,
          van_make_model: vanMakeModel,
          total_orders: packingList.total_orders,
          completed_orders: completedOrders,
          partial_orders: partialOrders,
          failed_orders: failedOrders,
          pending_orders: pendingOrders,
          total_value: packingList.total_value,
          last_location_time: lastLocationTime
        });
      }

      setDeliveryRuns(runs.sort((a, b) => 
        new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime()
      ));

    } catch (error) {
      console.error('Error loading delivery runs:', error);
      toast({
        title: "Error",
        description: "Failed to load delivery runs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDeliveryRuns();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDeliveryRuns, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDeliveryRuns();
  };

  const getProgressPercentage = (run: DeliveryRun) => {
    const completed = run.completed_orders + run.partial_orders + run.failed_orders;
    return run.total_orders > 0 ? (completed / run.total_orders) * 100 : 0;
  };

  const getTimeDifference = (timestamp: string | null) => {
    if (!timestamp) return 'No location data';
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const isLocationFresh = (timestamp: string | null) => {
    if (!timestamp) return false;
    const diff = Date.now() - new Date(timestamp).getTime();
    return diff < 5 * 60 * 1000; // 5 minutes
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Active Delivery Runs</h2>
          <p className="text-sm text-muted-foreground">
            Real-time tracking of dispatched deliveries
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{deliveryRuns.length}</p>
            <p className="text-xs text-muted-foreground">Active Runs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {deliveryRuns.reduce((sum, r) => sum + r.completed_orders, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {deliveryRuns.reduce((sum, r) => sum + r.pending_orders, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {deliveryRuns.reduce((sum, r) => sum + r.failed_orders, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Map Section */}
      {selectedAgentId && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Navigation className="h-4 w-4" />
                Live Tracking
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedAgentId(null)}
              >
                Close Map
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <CurrentLocationMap 
              height="300px" 
              userId={selectedAgentId} 
              isViewingOther={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Delivery Run Cards */}
      {deliveryRuns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No active delivery runs</p>
            <p className="text-sm text-muted-foreground mt-1">
              Dispatched packing lists will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {deliveryRuns.map((run) => {
            const progress = getProgressPercentage(run);
            const isToday = run.delivery_date === format(new Date(), 'yyyy-MM-dd');

            return (
              <Card key={run.id} className={isToday ? 'border-primary/50' : ''}>
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{run.packing_list_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(run.delivery_date), 'dd MMM yyyy')}
                          {isToday && <Badge className="ml-2 bg-primary">Today</Badge>}
                        </p>
                      </div>
                    </div>
                    <Badge variant={run.status === 'dispatched' ? 'default' : 'outline'}>
                      {run.status.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Agent & Van Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Agent Card */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                        {run.agent_avatar ? (
                          <img src={run.agent_avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{run.agent_name || 'No Agent Assigned'}</p>
                        {run.agent_phone && (
                          <a 
                            href={`tel:${run.agent_phone}`}
                            className="text-xs text-muted-foreground flex items-center gap-1"
                          >
                            <Phone className="h-3 w-3" />
                            {run.agent_phone}
                          </a>
                        )}
                      </div>
                      {run.agent_id && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedAgentId(run.agent_id)}
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Van Card */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Truck className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {run.van_registration || 'No Van Assigned'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {run.van_make_model || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Delivery Progress</span>
                      <span className="text-sm font-medium">
                        {run.completed_orders + run.partial_orders + run.failed_orders} / {run.total_orders}
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {/* Status Breakdown */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="text-center p-2 bg-muted/30 rounded">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-bold">{run.pending_orders}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                    <div className="text-center p-2 bg-green-50 rounded">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      </div>
                      <p className="text-lg font-bold text-green-600">{run.completed_orders}</p>
                      <p className="text-xs text-muted-foreground">Delivered</p>
                    </div>
                    <div className="text-center p-2 bg-amber-50 rounded">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <AlertCircle className="h-3 w-3 text-amber-600" />
                      </div>
                      <p className="text-lg font-bold text-amber-600">{run.partial_orders}</p>
                      <p className="text-xs text-muted-foreground">Partial</p>
                    </div>
                    <div className="text-center p-2 bg-red-50 rounded">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <XCircle className="h-3 w-3 text-red-600" />
                      </div>
                      <p className="text-lg font-bold text-red-600">{run.failed_orders}</p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className={isLocationFresh(run.last_location_time) ? 'text-green-600' : ''}>
                        {getTimeDifference(run.last_location_time)}
                      </span>
                      {isLocationFresh(run.last_location_time) && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                      )}
                    </div>
                    <p className="font-semibold">₹{run.total_value.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
