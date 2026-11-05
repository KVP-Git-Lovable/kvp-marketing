import { useState, useEffect, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { 
  Plus, 
  Users, 
  MapPin, 
  Package,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  Building2,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from '@/components/ui/checkbox';
import { usePackingList, OrderForPacking } from '@/hooks/usePackingList';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Distributor {
  id: string;
  name: string;
}

type GroupByOption = 'beat' | 'retailer' | 'product' | 'agent';

export default function CreatePackingListTab() {
  const { toast } = useToast();
  const { 
    loading, 
    fetchOrdersForPacking, 
    createPackingList 
  } = usePackingList();

  const [ordersForPacking, setOrdersForPacking] = useState<OrderForPacking[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [deliveryDate, setDeliveryDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState<string>('none');
  const [groupBy, setGroupBy] = useState<GroupByOption>('beat');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);

  // Load distributors
  useEffect(() => {
    const loadDistributors = async () => {
      const { data } = await supabase.from('distributors').select('id, name');
      if (data) setDistributors(data);
    };
    loadDistributors();
  }, []);

  // Load orders for packing
  useEffect(() => {
    const loadOrders = async () => {
      setLoadingOrders(true);
      const orders = await fetchOrdersForPacking({
        distributorId: selectedDistributor !== 'none' ? selectedDistributor : undefined,
        deliveryDate: deliveryDate
      });
      setOrdersForPacking(orders);
      // Auto-expand all groups
      const groups = getGroupedOrders(orders, groupBy);
      setExpandedGroups(new Set(groups.map(g => g.key)));
      setLoadingOrders(false);
    };
    loadOrders();
  }, [deliveryDate, selectedDistributor, fetchOrdersForPacking]);

  // Filter orders by search
  const filteredOrders = useMemo(() => {
    if (!searchQuery) return ordersForPacking;
    const q = searchQuery.toLowerCase();
    return ordersForPacking.filter(o => 
      o.retailer_name?.toLowerCase().includes(q) ||
      o.beat_name?.toLowerCase().includes(q) ||
      o.items?.some(i => i.product_name.toLowerCase().includes(q))
    );
  }, [ordersForPacking, searchQuery]);

  // Group orders based on selection
  const getGroupedOrders = (orders: OrderForPacking[], groupByOption: GroupByOption) => {
    const groups: { key: string; label: string; orders: OrderForPacking[] }[] = [];
    const groupMap = new Map<string, OrderForPacking[]>();

    orders.forEach(order => {
      let key = '';
      let label = '';
      
      switch (groupByOption) {
        case 'beat':
          key = order.beat_id || 'no-beat';
          label = order.beat_name || 'No Beat';
          break;
        case 'retailer':
          key = order.retailer_id;
          label = order.retailer_name || 'Unknown Retailer';
          break;
        case 'product':
          // Group by first product (for simplicity)
          key = order.items?.[0]?.product_id || 'no-product';
          label = order.items?.[0]?.product_name || 'No Product';
          break;
        case 'agent':
          key = 'unassigned'; // Default - no agent assigned yet
          label = 'Unassigned';
          break;
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(order);
    });

    groupMap.forEach((orders, key) => {
      let label = '';
      switch (groupByOption) {
        case 'beat':
          label = orders[0]?.beat_name || 'No Beat';
          break;
        case 'retailer':
          label = orders[0]?.retailer_name || 'Unknown Retailer';
          break;
        case 'product':
          label = orders[0]?.items?.[0]?.product_name || 'No Product';
          break;
        case 'agent':
          label = 'Unassigned';
          break;
      }
      groups.push({ key, label, orders });
    });

    return groups.sort((a, b) => a.label.localeCompare(b.label));
  };

  const groupedOrders = useMemo(() => 
    getGroupedOrders(filteredOrders, groupBy), 
    [filteredOrders, groupBy]
  );

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleAllOrders = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id));
    }
  };

  const toggleGroupOrders = (orders: OrderForPacking[]) => {
    const orderIds = orders.map(o => o.id);
    const allSelected = orderIds.every(id => selectedOrderIds.includes(id));
    
    if (allSelected) {
      setSelectedOrderIds(prev => prev.filter(id => !orderIds.includes(id)));
    } else {
      setSelectedOrderIds(prev => [...new Set([...prev, ...orderIds])]);
    }
  };

  const handleCreatePackingList = async () => {
    if (selectedOrderIds.length === 0) return;

    setCreating(true);
    const selectedOrders = ordersForPacking.filter(o => selectedOrderIds.includes(o.id));
    const distributorId = selectedDistributor !== 'none' ? selectedDistributor : null;
    
    const result = await createPackingList(deliveryDate, distributorId, selectedOrderIds, selectedOrders);
    
    if (result) {
      setSelectedOrderIds([]);
      // Reload orders
      const orders = await fetchOrdersForPacking({
        distributorId: selectedDistributor !== 'none' ? selectedDistributor : undefined,
        deliveryDate: deliveryDate
      });
      setOrdersForPacking(orders);
      toast({
        title: "Success",
        description: `Packing list ${result.packing_list_number} created`
      });
    }
    setCreating(false);
  };

  // Calculate totals
  const selectedOrders = ordersForPacking.filter(o => selectedOrderIds.includes(o.id));
  const totalValue = selectedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalItems = selectedOrders.reduce((sum, o) => 
    sum + (o.items?.reduce((iSum, item) => iSum + item.quantity, 0) || 0), 0
  );

  // SKU-wise aggregation for display
  const skuAggregation = useMemo(() => {
    const skuMap = new Map<string, { product_name: string; quantity: number; unit?: string }>();
    
    selectedOrders.forEach(order => {
      order.items?.forEach(item => {
        const existing = skuMap.get(item.product_id);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          skuMap.set(item.product_id, {
            product_name: item.product_name,
            quantity: item.quantity,
            unit: item.unit
          });
        }
      });
    });

    return Array.from(skuMap.values());
  }, [selectedOrders]);

  return (
    <div className="p-4 space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Delivery Date</label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Distributor</label>
              <Select value={selectedDistributor} onValueChange={setSelectedDistributor}>
                <SelectTrigger>
                  <SelectValue placeholder="All / Direct Sales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All / Direct Sales</SelectItem>
                  {distributors.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Group By</label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByOption)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beat">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Beat
                    </div>
                  </SelectItem>
                  <SelectItem value="retailer">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Retailer
                    </div>
                  </SelectItem>
                  <SelectItem value="product">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Product (SKU)
                    </div>
                  </SelectItem>
                  <SelectItem value="agent">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Agent
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selection Summary */}
      {selectedOrderIds.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Selected Orders</p>
                  <p className="text-xl font-bold">{selectedOrderIds.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Items (KG)</p>
                  <p className="text-xl font-bold">{(totalItems / 1000).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-xl font-bold">₹{totalValue.toLocaleString()}</p>
                </div>
              </div>
              <Button 
                onClick={handleCreatePackingList}
                disabled={creating}
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                {creating ? 'Creating...' : 'Create Packing List'}
              </Button>
            </div>

            {/* SKU Summary */}
            {skuAggregation.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Product Summary (KG)</p>
                <div className="flex flex-wrap gap-2">
                  {skuAggregation.slice(0, 5).map((sku, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {sku.product_name}: {(sku.quantity / 1000).toFixed(2)} KG
                    </Badge>
                  ))}
                  {skuAggregation.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{skuAggregation.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Select All Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
            onCheckedChange={toggleAllOrders}
          />
          <span className="text-sm font-medium">
            Select All ({filteredOrders.length} orders)
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {groupedOrders.length} groups
        </p>
      </div>

      {/* Orders Grouped */}
      {loadingOrders ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No orders available for packing</p>
            <p className="text-sm text-muted-foreground mt-1">
              D-1 orders for delivery on {format(new Date(deliveryDate), 'dd MMM yyyy')} will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupedOrders.map((group) => {
            const groupOrderIds = group.orders.map(o => o.id);
            const allGroupSelected = groupOrderIds.every(id => selectedOrderIds.includes(id));
            const someGroupSelected = groupOrderIds.some(id => selectedOrderIds.includes(id));
            const groupTotal = group.orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
            const groupItems = group.orders.reduce((sum, o) => 
              sum + (o.items?.reduce((iSum, item) => iSum + item.quantity, 0) || 0), 0
            );

            return (
              <Collapsible
                key={group.key}
                open={expandedGroups.has(group.key)}
                onOpenChange={() => toggleGroup(group.key)}
              >
                <Card>
                  <CardHeader className="p-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={allGroupSelected}
                        ref={(el) => {
                          if (el && someGroupSelected && !allGroupSelected) {
                            el.dataset.state = 'indeterminate';
                          }
                        }}
                        onCheckedChange={() => toggleGroupOrders(group.orders)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <CollapsibleTrigger className="flex-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {groupBy === 'beat' && <MapPin className="h-4 w-4 text-muted-foreground" />}
                          {groupBy === 'retailer' && <Building2 className="h-4 w-4 text-muted-foreground" />}
                          {groupBy === 'product' && <Package className="h-4 w-4 text-muted-foreground" />}
                          {groupBy === 'agent' && <Users className="h-4 w-4 text-muted-foreground" />}
                          <CardTitle className="text-base">{group.label}</CardTitle>
                          <Badge variant="outline">{group.orders.length} orders</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right text-sm">
                            <p className="text-muted-foreground">{(groupItems / 1000).toFixed(2)} KG</p>
                            <p className="font-medium">₹{groupTotal.toLocaleString()}</p>
                          </div>
                          {expandedGroups.has(group.key) ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                    </div>
                  </CardHeader>

                  <CollapsibleContent>
                    <CardContent className="p-0 border-t">
                      <div className="divide-y">
                        {group.orders.map(order => (
                          <div 
                            key={order.id}
                            className="p-3 flex items-center gap-3 hover:bg-muted/30 cursor-pointer"
                            onClick={() => toggleOrderSelection(order.id)}
                          >
                            <Checkbox
                              checked={selectedOrderIds.includes(order.id)}
                              onCheckedChange={() => toggleOrderSelection(order.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">{order.retailer_name}</p>
                                <p className="font-semibold text-sm">₹{order.total_amount?.toLocaleString()}</p>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span>{order.beat_name || 'No Beat'}</span>
                                <span>•</span>
                                <span>{order.items?.length || 0} products</span>
                                {order.is_credit_order && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="outline" className="text-xs">Credit</Badge>
                                  </>
                                )}
                              </div>
                              {/* Product list */}
                              <div className="mt-2 flex flex-wrap gap-1">
                                {order.items?.slice(0, 3).map((item, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs font-normal">
                                    {item.product_name}: {(item.quantity / 1000).toFixed(2)} KG
                                  </Badge>
                                ))}
                                {(order.items?.length || 0) > 3 && (
                                  <Badge variant="secondary" className="text-xs font-normal">
                                    +{(order.items?.length || 0) - 3} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
