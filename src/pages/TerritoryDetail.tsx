import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { moveToRecycleBin } from '@/utils/recycleBinUtils';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, ShoppingCart, Building, Navigation, TrendingUp, Users, ArrowUp, ArrowDown, AlertTriangle, Target, Calendar, Activity, Award, AlertCircle, ChevronRight, Pencil, Trash2, MapPin, FileText, Clock, User, HeartHandshake, Eye, X, Plus, Store, Route, ArrowLeft, Loader2 } from 'lucide-react';
import { format, subMonths, subQuarters, startOfYear, endOfYear, subYears } from 'date-fns';
import TerritorySupportRequestForm from '@/components/TerritorySupportRequestForm';
import TerritoryPerformanceCalendar from '@/components/TerritoryPerformanceCalendar';
import { RetailerDetailModal } from '@/components/RetailerDetailModal';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';

const SUPPORT_TYPES = [
  { value: 'marketing_campaign', label: 'Marketing Campaign' },
  { value: 'branding_material', label: 'Branding Material' },
  { value: 'additional_manpower', label: 'Additional Manpower' },
  { value: 'training_program', label: 'Training Program' },
  { value: 'promotional_scheme', label: 'Promotional Scheme' },
  { value: 'infrastructure', label: 'Infrastructure Support' },
  { value: 'inventory_support', label: 'Inventory Support' },
  { value: 'technology_tools', label: 'Technology/Tools' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const TerritoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [territory, setTerritory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [beats, setBeats] = useState<any[]>([]);
  const [salesSummary, setSalesSummary] = useState({ totalSales: 0, totalOrders: 0, totalRetailers: 0, totalVisits: 0 });
  const [assignmentHistory, setAssignmentHistory] = useState<any[]>([]);
  const [salesTrendData, setSalesTrendData] = useState<any[]>([]);
  const [salesTrendFilter, setSalesTrendFilter] = useState<string>('6months');
  const [periodSummary, setPeriodSummary] = useState({ totalSales: 0, totalOrders: 0, totalVisits: 0 });
  const [allTerritoryOrders, setAllTerritoryOrders] = useState<any[]>([]);
  const [topSKUs, setTopSKUs] = useState<any[]>([]);
  const [bottomSKUs, setBottomSKUs] = useState<any[]>([]);
  const [topRetailers, setTopRetailers] = useState<any[]>([]);
  const [bottomRetailers, setBottomRetailers] = useState<any[]>([]);
  const [performanceFlag, setPerformanceFlag] = useState<string>('');
  const [parentTerritory, setParentTerritory] = useState<any>(null);
  const [grandparentTerritory, setGrandparentTerritory] = useState<any>(null);
  const [auditInfo, setAuditInfo] = useState<{ owner?: string; createdBy?: string; lastUpdatedBy?: string }>({});
  const [assignedUsers, setAssignedUsers] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [supportRequests, setSupportRequests] = useState<any[]>([]);
  const [topSKUsWithIds, setTopSKUsWithIds] = useState<any[]>([]);
  const [bottomSKUsWithIds, setBottomSKUsWithIds] = useState<any[]>([]);
  const [topRetailersWithIds, setTopRetailersWithIds] = useState<any[]>([]);
  const [bottomRetailersWithIds, setBottomRetailersWithIds] = useState<any[]>([]);
  const [entityFilter, setEntityFilter] = useState<'retailers' | 'distributors'>('retailers');
  const [selectedRetailerForModal, setSelectedRetailerForModal] = useState<any>(null);
  const [retailerDetailModalOpen, setRetailerDetailModalOpen] = useState(false);
  const [retailerCategoryFilter, setRetailerCategoryFilter] = useState<string>('all');
  const [retailerLastVisitFilter, setRetailerLastVisitFilter] = useState<string>('all');
  const [productSalesData, setProductSalesData] = useState<any[]>([]);
  const [retailerOrderStats, setRetailerOrderStats] = useState<Map<string, { last6Months: number; lifetime: number; lastOrderValue: number; lastOrderDate: string | null }>>(new Map());
  const [growthPotential, setGrowthPotential] = useState<string>('');
  const [growthPotentialDetails, setGrowthPotentialDetails] = useState<string>('');
  const [territoryTargets, setTerritoryTargets] = useState<{ revenueTarget: number; quantityTarget: number; actualRevenue: number; actualQuantity: number }>({ revenueTarget: 0, quantityTarget: 0, actualRevenue: 0, actualQuantity: 0 });
  
  // Financial Year state - year stored in DB is the END year of FY (e.g., 2026 for FY 2025-26)
  const getDefaultFY = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return currentMonth >= 3 ? currentYear + 1 : currentYear;
  };
  const [selectedFY, setSelectedFY] = useState<number>(getDefaultFY());
  const [quantityUnit, setQuantityUnit] = useState<string>('units');
  
  const fyOptions = useMemo(() => {
    const currentFY = getDefaultFY();
    const options = [];
    for (let i = 0; i < 5; i++) {
      const fy = currentFY - i;
      options.push({
        value: fy,
        label: `FY ${fy - 1}-${fy.toString().slice(-2)}`
      });
    }
    return options;
  }, []);

  useEffect(() => {
    const loadTerritory = async () => {
      if (!id) return;
      
      const { data, error } = await supabase
        .from('territories')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error loading territory:', error);
        toast.error('Territory not found');
        navigate('/territories-and-distributors');
        return;
      }
      
      setTerritory(data);
    };

    loadTerritory();
  }, [id, navigate]);

  useEffect(() => {
    if (territory) {
      loadTerritoryData();
    }
  }, [territory, selectedFY]);

  const loadTerritoryData = async () => {
    if (!territory) return;
    setLoading(true);
    
    try {
      // Load hierarchy
      if (territory.parent_id) {
        const { data: parentData } = await supabase.from('territories').select('id, name, parent_id').eq('id', territory.parent_id).single();
        setParentTerritory(parentData);
        
        if (parentData?.parent_id) {
          const { data: grandparentData } = await supabase.from('territories').select('id, name').eq('id', parentData.parent_id).single();
          setGrandparentTerritory(grandparentData);
        }
      }

      // Get distributors
      let distributorsData: any[] = [];
      if (territory.assigned_distributor_ids && territory.assigned_distributor_ids.length > 0) {
        const { data } = await supabase
          .from('distributors')
          .select('id, name, contact_person, phone, status, outstanding_amount')
          .in('id', territory.assigned_distributor_ids);
        distributorsData = data || [];
      }
      setDistributors(distributorsData);

      // Load assigned users
      let usersData: any[] = [];
      if (territory.assigned_user_ids && territory.assigned_user_ids.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', territory.assigned_user_ids);
        usersData = data || [];
      }
      setAssignedUsers(usersData);

      // Load competitors
      let competitorsData: any[] = [];
      if (territory.competitor_ids && territory.competitor_ids.length > 0) {
        const { data } = await supabase
          .from('competition_master')
          .select('id, competitor_name')
          .in('id', territory.competitor_ids);
        competitorsData = data || [];
      }
      setCompetitors(competitorsData);

      // Load audit info
      const userIds = [territory.owner_id, territory.created_by, territory.last_updated_by].filter(Boolean);
      let auditUsers: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        if (profiles) {
          profiles.forEach(p => {
            auditUsers[p.id] = p.full_name || 'Unknown';
          });
        }
      }
      setAuditInfo({
        owner: territory.owner_id ? auditUsers[territory.owner_id] : undefined,
        createdBy: territory.created_by ? auditUsers[territory.created_by] : undefined,
        lastUpdatedBy: territory.last_updated_by ? auditUsers[territory.last_updated_by] : undefined,
      });

      // Load support requests
      const { data: supportData } = await supabase
        .from('support_requests')
        .select('*')
        .ilike('subject', `%${territory.name}%`)
        .eq('support_category', 'territory_support')
        .order('created_at', { ascending: false });
      setSupportRequests(supportData || []);
      
      // Load beats
      const { data: beatsData } = await supabase
        .from('beats')
        .select('id, beat_id, beat_name, category, is_active, average_km, average_time_minutes')
        .eq('territory_id', territory.id)
        .order('beat_name');
      setBeats(beatsData || []);

      // Fetch retailers
      const { data: retailersData } = await supabase
        .from('retailers')
        .select('id, name, category, address, phone, last_visit_date, last_order_value, last_order_date, priority, status, beat_id, territory_id, notes')
        .eq('territory_id', territory.id);
      const matchingRetailers = retailersData || [];
      setRetailers(matchingRetailers);

      const retailerIds = matchingRetailers.map(r => r.id);
      
      // Get ALL orders
      const { data: allOrdersData } = await supabase
        .from('orders')
        .select('id, total_amount, retailer_id, created_at, retailers(address, name)')
        .in('retailer_id', retailerIds)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });
      
      setAllTerritoryOrders(allOrdersData || []);

      // Calculate retailer order stats
      const sixMonthsAgo = subMonths(new Date(), 6);
      const orderStatsMap = new Map<string, { last6Months: number; lifetime: number; lastOrderValue: number; lastOrderDate: string | null }>();
      
      matchingRetailers.forEach(retailer => {
        const retailerOrders = allOrdersData?.filter(o => o.retailer_id === retailer.id) || [];
        const lifetime = retailerOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
        const last6Months = retailerOrders
          .filter(o => new Date(o.created_at) >= sixMonthsAgo)
          .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
        
        const lastOrder = retailerOrders.length > 0 ? retailerOrders[0] : null;
        const lastOrderValue = lastOrder ? Number(lastOrder.total_amount || 0) : 0;
        const lastOrderDate = lastOrder ? lastOrder.created_at : null;
        
        orderStatsMap.set(retailer.id, { last6Months, lifetime, lastOrderValue, lastOrderDate });
      });
      setRetailerOrderStats(orderStatsMap);

      setSalesSummary({
        totalSales: 0,
        totalOrders: 0,
        totalRetailers: matchingRetailers.length,
        totalVisits: 0,
      });

      // Load territory targets for the selected Financial Year
      const fyStartDate = new Date(selectedFY - 1, 3, 1);
      const fyEndDate = new Date(selectedFY, 2, 31, 23, 59, 59);
      
      const { data: targetsData } = await supabase
        .from('user_business_plan_territories')
        .select('quantity_target, revenue_target, user_business_plans!inner(year, quantity_unit)')
        .eq('territory_id', territory.id)
        .eq('user_business_plans.year', selectedFY);
      
      const totalRevenueTarget = targetsData?.reduce((sum, t) => sum + Number(t.revenue_target || 0), 0) || 0;
      const totalQuantityTarget = targetsData?.reduce((sum, t) => sum + Number(t.quantity_target || 0), 0) || 0;
      
      const planQuantityUnit = targetsData && targetsData.length > 0 
        ? (targetsData[0].user_business_plans as any)?.quantity_unit || 'units'
        : 'units';
      setQuantityUnit(planQuantityUnit);
      
      // Get actual revenue and quantity for the selected FY
      const fyOrders = allOrdersData?.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= fyStartDate && orderDate <= fyEndDate;
      }) || [];
      
      const actualRevenue = fyOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      
      let actualQuantity = 0;
      if (fyOrders.length > 0) {
        const fyOrderIds = fyOrders.map(o => o.id);
        const { data: orderItemsData } = await supabase
          .from('order_items')
          .select('quantity')
          .in('order_id', fyOrderIds);
        actualQuantity = orderItemsData?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;
      }
      
      setTerritoryTargets({
        revenueTarget: totalRevenueTarget,
        quantityTarget: totalQuantityTarget,
        actualRevenue,
        actualQuantity
      });
    } catch (error) {
      console.error('Error loading territory data:', error);
    }
    
    setLoading(false);
  };

  const getPerformanceBadgeColor = () => {
    if (performanceFlag === 'High Growth') return 'bg-green-500/10 text-green-600 border-green-500/20';
    if (performanceFlag === 'Growth') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    if (performanceFlag === 'Stable') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    if (performanceFlag === 'Declining') return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    if (performanceFlag === 'Steep Decline') return 'bg-red-500/10 text-red-600 border-red-500/20';
    if (performanceFlag === 'New') return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  };

  if (!territory) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-primary text-primary-foreground">
          <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent"></div>
          <div className="relative p-4 sm:p-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/territories-and-distributors')}
                className="text-primary-foreground hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-primary-foreground/70 text-sm mb-1">
                  {grandparentTerritory && (
                    <>
                      <span>{grandparentTerritory.name}</span>
                      <ChevronRight className="h-3 w-3" />
                    </>
                  )}
                  {parentTerritory && (
                    <>
                      <span>{parentTerritory.name}</span>
                      <ChevronRight className="h-3 w-3" />
                    </>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold">{territory.name}</h1>
                <p className="text-primary-foreground/80 text-sm sm:text-base mt-1">
                  {territory.region} • {territory.territory_type || 'Territory'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/territories-and-distributors?edit=${territory.id}`)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="max-w-7xl mx-auto space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Territory Details */}
                <Card className="shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Territory Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="font-medium text-sm">{territory.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Region</p>
                        <p className="font-medium text-sm">{territory.region || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Territory Type</p>
                        <p className="font-medium text-sm">{territory.territory_type || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Parent Territory</p>
                        <p className="font-medium text-sm">{parentTerritory?.name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Population</p>
                        <p className="font-medium text-sm">{territory.population?.toLocaleString() || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground"># of Retailers</p>
                        <p className="font-medium text-sm">{salesSummary.totalRetailers}</p>
                      </div>
                      {assignedUsers.length > 0 && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Assigned Users</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {assignedUsers.map((u) => (
                              <Badge key={u.id} variant="secondary" className="text-xs">
                                {u.full_name || u.username}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">PIN Codes</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {territory.pincode_ranges?.length > 0 ? (
                            territory.pincode_ranges.map((pin: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">{pin}</Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Target vs Actual Section */}
                <Card className="shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        Target vs. Actual
                      </CardTitle>
                      <Select value={selectedFY.toString()} onValueChange={(val) => setSelectedFY(parseInt(val))}>
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue placeholder="Select FY" />
                        </SelectTrigger>
                        <SelectContent>
                          {fyOptions.map(fy => (
                            <SelectItem key={fy.value} value={fy.value.toString()}>
                              {fy.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    {territoryTargets.revenueTarget > 0 || territoryTargets.quantityTarget > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Revenue Target vs Actual */}
                        <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-700">Revenue</span>
                            <Badge variant="outline" className={`text-xs ${
                              territoryTargets.actualRevenue >= territoryTargets.revenueTarget 
                                ? 'bg-green-500/20 text-green-700 border-green-500/30' 
                                : 'bg-orange-500/20 text-orange-700 border-orange-500/30'
                            }`}>
                              {territoryTargets.revenueTarget > 0 
                                ? `${((territoryTargets.actualRevenue / territoryTargets.revenueTarget) * 100).toFixed(0)}%` 
                                : '0%'}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Target</span>
                              <span className="font-medium">₹{territoryTargets.revenueTarget.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Actual</span>
                              <span className="font-bold text-green-600">₹{territoryTargets.actualRevenue.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 mt-2">
                              <div 
                                className={`h-2 rounded-full transition-all ${
                                  territoryTargets.actualRevenue >= territoryTargets.revenueTarget 
                                    ? 'bg-green-500' 
                                    : 'bg-orange-500'
                                }`}
                                style={{ width: `${Math.min((territoryTargets.actualRevenue / (territoryTargets.revenueTarget || 1)) * 100, 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>Gap: {territoryTargets.revenueTarget > territoryTargets.actualRevenue 
                                ? `₹${(territoryTargets.revenueTarget - territoryTargets.actualRevenue).toLocaleString('en-IN')}` 
                                : 'Target Achieved!'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Quantity Target vs Actual */}
                        <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-700">Quantity</span>
                            <Badge variant="outline" className={`text-xs ${
                              territoryTargets.actualQuantity >= territoryTargets.quantityTarget 
                                ? 'bg-green-500/20 text-green-700 border-green-500/30' 
                                : 'bg-orange-500/20 text-orange-700 border-orange-500/30'
                            }`}>
                              {territoryTargets.quantityTarget > 0 
                                ? `${((territoryTargets.actualQuantity / territoryTargets.quantityTarget) * 100).toFixed(0)}%` 
                                : '0%'}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Target</span>
                              <span className="font-medium">{territoryTargets.quantityTarget.toLocaleString('en-IN')} {quantityUnit}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Actual</span>
                              <span className="font-bold text-blue-600">{territoryTargets.actualQuantity.toLocaleString('en-IN')} {quantityUnit}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 mt-2">
                              <div 
                                className={`h-2 rounded-full transition-all ${
                                  territoryTargets.actualQuantity >= territoryTargets.quantityTarget 
                                    ? 'bg-green-500' 
                                    : 'bg-blue-500'
                                }`}
                                style={{ width: `${Math.min((territoryTargets.actualQuantity / (territoryTargets.quantityTarget || 1)) * 100, 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>Gap: {territoryTargets.quantityTarget > territoryTargets.actualQuantity 
                                ? `${(territoryTargets.quantityTarget - territoryTargets.actualQuantity).toLocaleString('en-IN')} ${quantityUnit}` 
                                : 'Target Achieved!'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No targets set for FY {selectedFY - 1}-{selectedFY.toString().slice(-2)}</p>
                    )}
                  </CardContent>
                </Card>

                {/* Beats Section */}
                <Card className="shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <Route className="h-4 w-4 text-primary" />
                      Beats ({beats.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    {beats.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {beats.map((beat) => (
                          <div key={beat.id} className="p-3 border rounded-lg bg-card hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{beat.beat_name}</span>
                              <Badge variant={beat.is_active ? 'default' : 'secondary'} className="text-xs">
                                {beat.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            {beat.category && (
                              <p className="text-xs text-muted-foreground mt-1">{beat.category}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No beats linked to this territory</p>
                    )}
                  </CardContent>
                </Card>

                {/* Retailers Section */}
                <Card className="shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <Store className="h-4 w-4 text-primary" />
                      Retailers ({retailers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    {retailers.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Last Visit</TableHead>
                              <TableHead className="text-right">Last 6 Months</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {retailers.slice(0, 10).map((retailer) => {
                              const stats = retailerOrderStats.get(retailer.id);
                              return (
                                <TableRow 
                                  key={retailer.id}
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => {
                                    setSelectedRetailerForModal(retailer);
                                    setRetailerDetailModalOpen(true);
                                  }}
                                >
                                  <TableCell className="font-medium">{retailer.name}</TableCell>
                                  <TableCell>{retailer.category || '-'}</TableCell>
                                  <TableCell>
                                    {retailer.last_visit_date 
                                      ? format(new Date(retailer.last_visit_date), 'dd MMM yy')
                                      : '-'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    ₹{(stats?.last6Months || 0).toLocaleString('en-IN')}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        {retailers.length > 10 && (
                          <p className="text-xs text-muted-foreground text-center mt-2">
                            Showing 10 of {retailers.length} retailers
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No retailers in this territory</p>
                    )}
                  </CardContent>
                </Card>

                {/* Distributors Section */}
                {distributors.length > 0 && (
                  <Card className="shadow-lg">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                        <Building className="h-4 w-4 text-primary" />
                        Distributors ({distributors.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {distributors.map((dist) => (
                          <div key={dist.id} className="p-3 border rounded-lg bg-card">
                            <span className="font-medium text-sm">{dist.name}</span>
                            {dist.contact_person && (
                              <p className="text-xs text-muted-foreground mt-1">{dist.contact_person}</p>
                            )}
                            <Badge variant={dist.status === 'active' ? 'default' : 'secondary'} className="text-xs mt-2">
                              {dist.status || 'Active'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Audit Info */}
                <Card className="shadow-lg bg-muted/30">
                  <CardContent className="p-3 sm:p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Created
                        </p>
                        <p className="font-medium">{territory.created_at ? format(new Date(territory.created_at), 'dd MMM yyyy') : '-'}</p>
                        {auditInfo.createdBy && <p className="text-xs text-muted-foreground">by {auditInfo.createdBy}</p>}
                      </div>
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Last Updated
                        </p>
                        <p className="font-medium">{territory.updated_at ? format(new Date(territory.updated_at), 'dd MMM yyyy') : '-'}</p>
                        {auditInfo.lastUpdatedBy && <p className="text-xs text-muted-foreground">by {auditInfo.lastUpdatedBy}</p>}
                      </div>
                      {auditInfo.owner && (
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" /> Owner
                          </p>
                          <p className="font-medium">{auditInfo.owner}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Retailer Detail Modal */}
      <RetailerDetailModal
        isOpen={retailerDetailModalOpen}
        onClose={() => {
          setRetailerDetailModalOpen(false);
          setSelectedRetailerForModal(null);
        }}
        retailer={selectedRetailerForModal}
        onSuccess={() => {
          setRetailerDetailModalOpen(false);
          loadTerritoryData();
        }}
      />
    </Layout>
  );
};

export default TerritoryDetail;
