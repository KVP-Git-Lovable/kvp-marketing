import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Plus, FileDown, Search, Check, ChevronsUpDown, X, BarChart3, Pencil, Trash2, TrendingUp, TrendingDown, Minus, Sparkles, AlertTriangle, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import TerritoryDetailsModal from './TerritoryDetailsModal';


import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { moveToRecycleBin } from '@/utils/recycleBinUtils';

interface Territory {
  id: string;
  name: string;
  region: string;
  territory_type?: string;
  pincode_ranges: string[];
  assigned_user_id?: string;
  parent_id?: string;
  child_territories_count?: number;
  population?: number;
  target_market_size?: number;
  retailer_count?: number;
  competitor_ids?: string[];
  description?: string;
  created_at: string;
  updated_at: string;
  place_id?: string | null;
}

const TerritoriesManagement = () => {
  const navigate = useNavigate();
  const [territories, setTerritories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<any>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editingTerritoryId, setEditingTerritoryId] = useState<string | null>(null);
  
  const [territoryName, setTerritoryName] = useState('');
  const [region, setRegion] = useState('');
  const [territoryType, setTerritoryType] = useState('');
  const [pincodes, setPincodes] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [assignedDistributorIds, setAssignedDistributorIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [population, setPopulation] = useState('');
  const [targetMarketSize, setTargetMarketSize] = useState('');
  const [retailerCount, setRetailerCount] = useState('');
  const [competitorIds, setCompetitorIds] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [ownerId, setOwnerId] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [filterDistributor, setFilterDistributor] = useState('all');
  const [filterLastVisited, setFilterLastVisited] = useState('all');
  const [filterRevenueIndicator, setFilterRevenueIndicator] = useState('all');
  const [filterGrowthPotential, setFilterGrowthPotential] = useState('all');
  const [users, setUsers] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [userComboOpen, setUserComboOpen] = useState(false);
  const [distributorComboOpen, setDistributorComboOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [territoryToDelete, setTerritoryToDelete] = useState<any>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    loadTerritories();
    loadUsers();
    loadDistributors();
    loadCompetitors();

    // Set up real-time subscription for orders to update territory stats
    const channel = supabase
      .channel('territories-orders-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order change detected, refreshing territories:', payload);
          loadTerritories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, username').eq('is_active', true);
    setUsers(data || []);
  };

  const loadDistributors = async () => {
    const { data } = await supabase.from('distributors').select('id, name, contact_person');
    setDistributors(data || []);
  };

  const loadCompetitors = async () => {
    const { data } = await supabase.from('competition_master').select('id, competitor_name');
    setCompetitors(data || []);
  };

  const loadTerritories = async () => {
    const { data, error } = await supabase
      .from('territories')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading territories:', error);
      toast.error('Failed to load territories');
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setTerritories([]);
      setLoading(false);
      return;
    }

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    
    // For 6-month calculation (same as detail view)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const territoriesWithStats = await Promise.all(
      data.map(async (territory) => {
        // Get owner name
        let owner_name = 'Unassigned';
        if (territory.owner_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', territory.owner_id)
            .maybeSingle();
          owner_name = profile?.full_name || 'Unassigned';
        }

        // Get retailers that match any of the territory's PIN codes
        let retailersCount = 0;
        let territoryRetailerIds: string[] = [];
        if (territory.pincode_ranges && territory.pincode_ranges.length > 0) {
          const { data: retailers } = await supabase
            .from('retailers')
            .select('id, address');
          
          if (retailers) {
            const matchingRetailers = retailers.filter(r => {
              const address = r.address || '';
              return territory.pincode_ranges.some((pin: string) => 
                address.includes(pin)
              );
            });
            retailersCount = matchingRetailers.length;
            territoryRetailerIds = matchingRetailers.map(r => r.id);
          }
        }

        let total_sales = 0;
        let last_visit_date: string | null = null;
        let visits_this_month = 0;
        let monthlyTotals: number[] = [];
        
        if (territoryRetailerIds.length > 0) {
          // Get all orders from last 6 months for proper growth calculation
          const { data: allOrdersData } = await supabase
            .from('orders')
            .select('total_amount, created_at')
            .in('retailer_id', territoryRetailerIds)
            .gte('created_at', sixMonthsAgo.toISOString())
            .order('created_at', { ascending: false });

          // Calculate monthly totals for last 6 months (same logic as detail view)
          for (let i = 5; i >= 0; i--) {
            const monthStart = new Date();
            monthStart.setMonth(monthStart.getMonth() - i);
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            const monthEnd = new Date(monthStart);
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            
            const monthTotal = allOrdersData?.filter(o => {
              const orderDate = new Date(o.created_at);
              return orderDate >= monthStart && orderDate < monthEnd;
            }).reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
            
            monthlyTotals.push(monthTotal);
          }
          
          // Current month sales is the last element
          total_sales = monthlyTotals[monthlyTotals.length - 1] || 0;

          // Get last visit date
          const { data: lastVisit } = await supabase
            .from('visits')
            .select('planned_date')
            .in('retailer_id', territoryRetailerIds)
            .order('planned_date', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          last_visit_date = lastVisit?.planned_date || null;

          // Get visits this month
          const { count: visitsCount } = await supabase
            .from('visits')
            .select('id', { count: 'exact', head: true })
            .in('retailer_id', territoryRetailerIds)
            .gte('planned_date', currentMonthStart.toISOString().split('T')[0]);

          visits_this_month = visitsCount || 0;
        }

        // Calculate Revenue Growth Indicator using same logic as detail view
        let performance_status = 'New';
        let growthRate = 0;
        let needs_attention = false;
        let attention_reason = '';
        
        if (retailersCount === 0 && monthlyTotals.every(m => m === 0)) {
          // New: 0 retailers AND 0 revenue across all months
          performance_status = 'New';
        } else if (retailersCount > 0 && monthlyTotals.every(m => m === 0)) {
          // No Business: has retailers but no revenue at all
          performance_status = 'No Business';
        } else if (monthlyTotals.length >= 2) {
          const currentMonth = monthlyTotals[monthlyTotals.length - 1];
          const previousMonth = monthlyTotals[monthlyTotals.length - 2];
          
          growthRate = previousMonth > 0 
            ? ((currentMonth - previousMonth) / previousMonth) * 100 
            : (currentMonth > 0 ? 100 : 0);
          
          if (growthRate > 25) performance_status = 'High Growth';
          else if (growthRate > 10) performance_status = 'Growth';
          else if (growthRate >= 0) performance_status = 'Stable';
          else if (growthRate > -25) performance_status = 'Declining';
          else performance_status = 'Steep Decline';
        }
        
        // Determine if territory needs attention
        const daysSinceLastVisit = last_visit_date 
          ? Math.floor((new Date().getTime() - new Date(last_visit_date).getTime()) / (1000 * 60 * 60 * 24))
          : null;
        
        if (daysSinceLastVisit !== null && daysSinceLastVisit > 14 && total_sales > 10000) {
          needs_attention = true;
          attention_reason = 'Good performer not visited in ' + daysSinceLastVisit + ' days';
        } else if (performance_status === 'Declining' || performance_status === 'Steep Decline') {
          needs_attention = true;
          attention_reason = 'Revenue declining - needs intervention';
        } else if (retailersCount > 0 && visits_this_month === 0) {
          needs_attention = true;
          attention_reason = 'No visits this month';
        }

        // Calculate Growth Potential
        const potentialRetailers = territory.retailer_count || 0;
        const coveragePercent = potentialRetailers > 0 ? (retailersCount / potentialRetailers) * 100 : 0;
        const marketPenetration = territory.target_market_size > 0 ? (total_sales / territory.target_market_size) * 100 : 0;
        
        let growth_potential = 'Average growth territory';
        let growth_potential_details = '';
        
        if (retailersCount === 0 && potentialRetailers === 0) {
          growth_potential = 'Low growth territory';
          growth_potential_details = 'No retailer data available. Territory needs basic setup and market research.';
        } else if (growthRate > 15 && coveragePercent < 50) {
          growth_potential = 'High growth territory';
          growth_potential_details = `Strong growth rate of ${growthRate.toFixed(1)}% with only ${coveragePercent.toFixed(0)}% retailer coverage. Significant room for expansion with ${potentialRetailers - retailersCount} untapped retailers.`;
        } else if (growthRate > 10 || (coveragePercent < 30 && potentialRetailers > 10)) {
          growth_potential = 'High growth territory';
          growth_potential_details = `Territory shows ${growthRate.toFixed(1)}% growth. ${coveragePercent.toFixed(0)}% of ${potentialRetailers} potential retailers covered. Population: ${territory.population?.toLocaleString() || 'N/A'}.`;
        } else if (growthRate >= 0 && coveragePercent < 70) {
          growth_potential = 'Average growth territory';
          growth_potential_details = `Stable performance with ${coveragePercent.toFixed(0)}% coverage. Moderate expansion potential with ${potentialRetailers - retailersCount} retailers to target.`;
        } else if (growthRate < 0 && growthRate > -15) {
          growth_potential = 'Low growth territory';
          growth_potential_details = `Declining by ${Math.abs(growthRate).toFixed(1)}%. Focus on retention and service improvement before expansion.`;
        } else if (growthRate <= -15) {
          growth_potential = 'De-growth territory';
          growth_potential_details = `Steep decline of ${Math.abs(growthRate).toFixed(1)}%. Requires immediate intervention. Analyze competitor activity and retailer feedback.`;
        } else if (coveragePercent >= 70) {
          growth_potential = 'Low growth territory';
          growth_potential_details = `High coverage of ${coveragePercent.toFixed(0)}%. Focus on increasing wallet share from existing retailers rather than new acquisition.`;
        }

        return {
          ...territory,
          owner_name,
          total_retailers: retailersCount,
          total_sales,
          last_visit_date,
          visits_this_month,
          performance_status,
          growth_rate: growthRate,
          needs_attention,
          attention_reason,
          growth_potential,
          growth_potential_details,
        };
      })
    );

    setTerritories(territoriesWithStats);
    setLoading(false);
  };

  const handleAddTerritory = async (e: React.FormEvent) => {
    e.preventDefault();
    const pincodeArray = pincodes.split(',').map(p => p.trim()).filter(p => p.length > 0);

    // Only require pincodes if territory type is filled
    if (territoryType && pincodeArray.length === 0) {
      toast.error('Please enter at least one PIN code when territory type is specified');
      return;
    }

    if (editingTerritoryId) {
      // Update existing territory
      const { error } = await supabase.from('territories').update({
        name: territoryName,
        region,
        territory_type: territoryType || null,
        pincode_ranges: pincodeArray,
        assigned_user_ids: assignedUserIds,
        assigned_distributor_ids: assignedDistributorIds,
        parent_id: parentId && parentId !== 'none' ? parentId : null,
        population: population ? parseInt(population) : null,
        target_market_size: targetMarketSize ? parseFloat(targetMarketSize) : null,
        retailer_count: retailerCount ? parseInt(retailerCount) : null,
        competitor_ids: competitorIds.length > 0 ? competitorIds : null,
        description: description || null,
        owner_id: ownerId || null,
      }).eq('id', editingTerritoryId);

      if (error) {
        console.error('Error updating territory:', error);
        toast.error('Failed to update territory');
        return;
      }

      toast.success('Territory updated successfully!');
    } else {
      // Insert new territory
      const { error } = await supabase.from('territories').insert({
        name: territoryName,
        region,
        territory_type: territoryType || null,
        pincode_ranges: pincodeArray,
        assigned_user_ids: assignedUserIds,
        assigned_distributor_ids: assignedDistributorIds,
        parent_id: parentId && parentId !== 'none' ? parentId : null,
        population: population ? parseInt(population) : null,
        target_market_size: targetMarketSize ? parseFloat(targetMarketSize) : null,
        retailer_count: retailerCount ? parseInt(retailerCount) : null,
        competitor_ids: competitorIds.length > 0 ? competitorIds : null,
        description: description || null,
        owner_id: ownerId || null,
      });

      if (error) {
        console.error('Error adding territory:', error);
        toast.error('Failed to add territory');
        return;
      }

      toast.success('Territory added successfully!');
    }

    setTerritoryName('');
    setRegion('');
    setTerritoryType('');
    setPincodes('');
    setAssignedUserIds([]);
    setAssignedDistributorIds([]);
    setDescription('');
    setParentId('');
    setPopulation('');
    setTargetMarketSize('');
    setRetailerCount('');
    setCompetitorIds([]);
    setOwnerId('');
    setEditingTerritoryId(null);
    setShowForm(false);
    loadTerritories();
  };

  const handleEditTerritory = (territory: any) => {
    setEditingTerritoryId(territory.id);
    setTerritoryName(territory.name);
    setRegion(territory.region);
    setTerritoryType(territory.territory_type || '');
    setPincodes(territory.pincode_ranges?.join(', ') || '');
    setAssignedUserIds(territory.assigned_user_ids || []);
    setAssignedDistributorIds(territory.assigned_distributor_ids || []);
    setDescription(territory.description || '');
    setParentId(territory.parent_id || '');
    setPopulation(territory.population?.toString() || '');
    setTargetMarketSize(territory.target_market_size?.toString() || '');
    setRetailerCount(territory.retailer_count?.toString() || '');
    setCompetitorIds(territory.competitor_ids || []);
    setOwnerId(territory.owner_id || '');
    setShowForm(true);
    setDetailsModalOpen(false);
  };

  const filteredTerritories = territories.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUser = filterUser === 'all' || t.assigned_user_id === filterUser || t.assigned_user_ids?.includes(filterUser);
    const matchesDistributor = filterDistributor === 'all' || t.assigned_distributor_ids?.includes(filterDistributor);
    
    // Last visited filter
    let matchesLastVisited = true;
    if (filterLastVisited !== 'all' && t.last_visit_date) {
      const lastVisit = new Date(t.last_visit_date);
      const now = new Date();
      const daysSince = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const startOfTwoMonthsBack = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const endOfTwoMonthsBack = new Date(now.getFullYear(), now.getMonth() - 1, 0);
      
      if (filterLastVisited === 'current_week') {
        matchesLastVisited = lastVisit >= startOfWeek;
      } else if (filterLastVisited === 'current_month') {
        matchesLastVisited = lastVisit >= startOfMonth;
      } else if (filterLastVisited === 'last_month') {
        matchesLastVisited = lastVisit >= startOfLastMonth && lastVisit <= endOfLastMonth;
      } else if (filterLastVisited === 'two_months_back') {
        matchesLastVisited = lastVisit >= startOfTwoMonthsBack && lastVisit <= endOfTwoMonthsBack;
      } else if (filterLastVisited === 'more_than_three_months') {
        matchesLastVisited = daysSince > 90;
      }
    } else if (filterLastVisited === 'more_than_three_months' && !t.last_visit_date) {
      matchesLastVisited = true; // Never visited counts as more than 3 months
    } else if (filterLastVisited !== 'all' && !t.last_visit_date) {
      matchesLastVisited = false;
    }
    
    // Growth potential filter
    const matchesGrowthPotential = filterGrowthPotential === 'all' || t.growth_potential === filterGrowthPotential;
    
    // Revenue indicator filter
    const matchesRevenueIndicator = filterRevenueIndicator === 'all' || t.performance_status === filterRevenueIndicator;
    
    return matchesSearch && matchesUser && matchesDistributor && matchesLastVisited && matchesGrowthPotential && matchesRevenueIndicator;
  });

  const handleDeleteTerritory = async () => {
    if (!territoryToDelete) return;
    
    try {
      // Check if retailers are assigned to this territory
      const { count, error: countError } = await supabase
        .from('retailers')
        .select('id', { count: 'exact', head: true })
        .eq('territory_id', territoryToDelete.id);

      if (countError) throw countError;

      if (count && count > 0) {
        toast.error(
          `Cannot delete "${territoryToDelete.name}" — ${count} retailer${count > 1 ? 's are' : ' is'} still assigned to this territory. Please reassign them first.`,
          { duration: 5000 }
        );
        setTerritoryToDelete(null);
        setDeleteConfirmOpen(false);
        return;
      }

      await moveToRecycleBin({
        tableName: 'territories',
        recordId: territoryToDelete.id,
        recordData: territoryToDelete,
        moduleName: 'Territories',
        recordName: territoryToDelete.name
      });

      const { error } = await supabase
        .from('territories')
        .delete()
        .eq('id', territoryToDelete.id);

      if (error) throw error;

      toast.success("Territory moved to recycle bin");
      setTerritoryToDelete(null);
      setDeleteConfirmOpen(false);
      loadTerritories();
    } catch (error: any) {
      toast.error("Failed to delete: " + error.message);
    }
  };

  const openTerritoryDetails = (territory: any) => {
    navigate(`/territory/${territory.id}`);
  };

  const handleGeocodeAll = async () => {
    setIsGeocoding(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode-territories', {
        body: {}
      });
      
      if (error) throw error;
      
      toast.success(`Geocoding complete! Updated ${data?.updated || 0} territories`);
      loadTerritories(); // Refresh to get new place_ids
    } catch (err: any) {
      console.error('Geocoding error:', err);
      toast.error('Failed to geocode territories: ' + (err.message || 'Unknown error'));
    } finally {
      setIsGeocoding(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Territories Management</h2>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus size={16} /> Add Territory
          </Button>
        </div>
      </div>

      <div className="space-y-6">

        {showForm && (
          <Card>
            <CardHeader><CardTitle>{editingTerritoryId ? 'Edit Territory' : 'Add New Territory'}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleAddTerritory} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Territory Name *</Label>
                    <Input value={territoryName} onChange={(e) => setTerritoryName(e.target.value)} required />
                  </div>
                  <div>
                    <Label>Region *</Label>
                    <Select value={region} onValueChange={setRegion} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="State">State</SelectItem>
                        <SelectItem value="District">District</SelectItem>
                        <SelectItem value="Taluk">Taluk</SelectItem>
                        <SelectItem value="Gram Panchayat">Gram Panchayat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Territory Type</Label>
                    <Select value={territoryType} onValueChange={setTerritoryType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="City">City</SelectItem>
                        <SelectItem value="Town">Town</SelectItem>
                        <SelectItem value="Village">Village</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Parent Territory</Label>
                    <Select value={parentId || "none"} onValueChange={setParentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select parent (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {territories.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Population</Label>
                    <Input 
                      type="number" 
                      value={population} 
                      onChange={(e) => setPopulation(e.target.value)} 
                      placeholder="Total population"
                    />
                  </div>
                  <div>
                    <Label>Target Market Size (₹)</Label>
                    <Input 
                      type="number" 
                      value={targetMarketSize} 
                      onChange={(e) => setTargetMarketSize(e.target.value)} 
                      placeholder="Market size in rupees"
                    />
                  </div>
                  <div>
                    <Label>Potential Retailers</Label>
                    <Input 
                      type="number" 
                      value={retailerCount} 
                      onChange={(e) => setRetailerCount(e.target.value)} 
                      placeholder="Addressable market"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Addressable market - total retailers you can target</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Key Competitors (Multiple)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between">
                        {competitorIds.length > 0 ? `${competitorIds.length} competitor(s) selected` : "Select competitors..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search competitors..." />
                        <CommandList>
                          <CommandEmpty>No competitor found.</CommandEmpty>
                          <CommandGroup>
                            {competitors.map((competitor) => (
                              <CommandItem
                                key={competitor.id}
                                onSelect={() => {
                                  setCompetitorIds(prev => 
                                    prev.includes(competitor.id) 
                                      ? prev.filter(id => id !== competitor.id)
                                      : [...prev, competitor.id]
                                  );
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", competitorIds.includes(competitor.id) ? "opacity-100" : "opacity-0")} />
                                {competitor.competitor_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {competitorIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {competitorIds.map(compId => {
                        const competitor = competitors.find(c => c.id === compId);
                        return (
                          <Badge key={compId} variant="secondary" className="gap-1">
                            {competitor?.competitor_name}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => setCompetitorIds(prev => prev.filter(id => id !== compId))} />
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Territory Owner</Label>
                  <Select value={ownerId || "none"} onValueChange={(val) => setOwnerId(val === "none" ? "" : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No owner</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Assign Users (Multiple)</Label>
                  <Popover open={userComboOpen} onOpenChange={setUserComboOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between">
                        {assignedUserIds.length > 0 ? `${assignedUserIds.length} user(s) selected` : "Select users..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search users..." />
                        <CommandList>
                          <CommandEmpty>No user found.</CommandEmpty>
                          <CommandGroup>
                            {users.map((user) => (
                              <CommandItem
                                key={user.id}
                                onSelect={() => {
                                  setAssignedUserIds(prev => 
                                    prev.includes(user.id) 
                                      ? prev.filter(id => id !== user.id)
                                      : [...prev, user.id]
                                  );
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", assignedUserIds.includes(user.id) ? "opacity-100" : "opacity-0")} />
                                {user.full_name || user.username}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {assignedUserIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {assignedUserIds.map(userId => {
                        const user = users.find(u => u.id === userId);
                        return (
                          <Badge key={userId} variant="secondary" className="gap-1">
                            {user?.full_name || user?.username}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => setAssignedUserIds(prev => prev.filter(id => id !== userId))} />
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Assign Distributors (Multiple)</Label>
                  <Popover open={distributorComboOpen} onOpenChange={setDistributorComboOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between">
                        {assignedDistributorIds.length > 0 ? `${assignedDistributorIds.length} distributor(s) selected` : "Select distributors..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search distributors..." />
                        <CommandList>
                          <CommandEmpty>No distributor found.</CommandEmpty>
                          <CommandGroup>
                            {distributors.map((distributor) => (
                              <CommandItem
                                key={distributor.id}
                                onSelect={() => {
                                  setAssignedDistributorIds(prev => 
                                    prev.includes(distributor.id) 
                                      ? prev.filter(id => id !== distributor.id)
                                      : [...prev, distributor.id]
                                  );
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", assignedDistributorIds.includes(distributor.id) ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col">
                                  <span>{distributor.name}</span>
                                  {distributor.contact_person && (
                                    <span className="text-xs text-muted-foreground">{distributor.contact_person}</span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {assignedDistributorIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {assignedDistributorIds.map(distId => {
                        const distributor = distributors.find(d => d.id === distId);
                        return (
                          <Badge key={distId} variant="secondary" className="gap-1">
                            {distributor?.name}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => setAssignedDistributorIds(prev => prev.filter(id => id !== distId))} />
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label>PIN Codes {territoryType ? '*' : ''} (comma-separated)</Label>
                  <Input 
                    value={pincodes} 
                    onChange={(e) => setPincodes(e.target.value)} 
                    placeholder="e.g., 110001, 110002, 410210" 
                    required={!!territoryType}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {territoryType ? 'Required when territory type is specified. ' : ''}Retailers with addresses containing these PIN codes will be mapped to this territory
                  </p>
                </div>
                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <Input 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Optional territory description" 
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">{editingTerritoryId ? 'Update' : 'Save'}</Button>
                  <Button type="button" variant="outline" onClick={() => {
                    setShowForm(false);
                    setEditingTerritoryId(null);
                    setTerritoryName('');
                    setRegion('');
                    setTerritoryType('');
                    setPincodes('');
                    setAssignedUserIds([]);
                    setAssignedDistributorIds([]);
                    setDescription('');
                    setParentId('');
                    setPopulation('');
                    setTargetMarketSize('');
                    setRetailerCount('');
                    setCompetitorIds([]);
                    setOwnerId('');
                  }}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
              <div><Label>Search</Label><Input placeholder="Search territory..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
              <div><Label>Filter by User</Label>
                <Select value={filterUser} onValueChange={setFilterUser}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Users</SelectItem>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Filter by Distributor</Label>
                <Select value={filterDistributor} onValueChange={setFilterDistributor}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Distributors</SelectItem>{distributors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Last Visited</Label>
                <Select value={filterLastVisited} onValueChange={setFilterLastVisited}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="current_week">Current Week</SelectItem>
                    <SelectItem value="current_month">Current Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="two_months_back">Two Months Back</SelectItem>
                    <SelectItem value="more_than_three_months">More than 3 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Growth Potential</Label>
                <Select value={filterGrowthPotential} onValueChange={setFilterGrowthPotential}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="High growth territory">High Growth</SelectItem>
                    <SelectItem value="Average growth territory">Average Growth</SelectItem>
                    <SelectItem value="Low growth territory">Low Growth</SelectItem>
                    <SelectItem value="De-growth territory">De-growth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Revenue Indicator</Label>
                <Select value={filterRevenueIndicator} onValueChange={setFilterRevenueIndicator}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="High Growth">High Growth</SelectItem>
                    <SelectItem value="Growth">Growth</SelectItem>
                    <SelectItem value="Stable">Stable</SelectItem>
                    <SelectItem value="Declining">Declining</SelectItem>
                    <SelectItem value="Steep Decline">Steep Decline</SelectItem>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="No Business">No Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {filteredTerritories.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  {territories.length === 0 ? 'No territories created yet. Click "Add Territory" to get started.' : 'No territories match your filters.'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Territory</TableHead>
                        <TableHead>Hierarchy</TableHead>
                        <TableHead>Metrics</TableHead>
                        <TableHead>Visits</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTerritories.map((t) => {
                        const parentTerritory = territories.find(pt => pt.id === t.parent_id);
                        const grandParentTerritory = parentTerritory ? territories.find(gt => gt.id === parentTerritory.parent_id) : null;
                        
                        return (
                          <TableRow key={t.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <div 
                                  className="font-medium text-primary cursor-pointer hover:underline"
                                  onClick={() => openTerritoryDetails(t)}
                                >
                                  {t.name}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  <Badge variant="outline" className="text-xs">{t.region}</Badge>
                                  {t.territory_type && <Badge variant="secondary" className="text-xs">{t.territory_type}</Badge>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1 text-sm">
                                {grandParentTerritory && (
                                  <div className="text-muted-foreground flex items-center gap-1">
                                    <span className="text-xs">↳</span> {grandParentTerritory.name}
                                  </div>
                                )}
                                {parentTerritory && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs">{grandParentTerritory ? '  ↳' : '↳'}</span>
                                    <Badge variant="outline" className="text-xs">{parentTerritory.name}</Badge>
                                  </div>
                                )}
                                {!parentTerritory && !grandParentTerritory && (
                                  <span className="text-muted-foreground text-xs">Root Level</span>
                                )}
                                {(t.child_territories_count || 0) > 0 && (
                                  <Badge variant="secondary" className="text-xs">{t.child_territories_count} Sub-territories</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Retailers:</span>
                                  <span className="font-medium">{t.total_retailers}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Owner:</span>
                                  <span className="font-medium">{t.owner_name || 'Unassigned'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Last Visit:</span>
                                  <span className="font-medium">{t.last_visit_date ? format(new Date(t.last_visit_date), 'dd MMM yyyy') : '-'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">This Month:</span>
                                  <Badge variant="secondary" className="text-xs">{t.visits_this_month} visits</Badge>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  title="View Analytics"
                                  onClick={() => openTerritoryDetails(t)}
                                >
                                  <BarChart3 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  title="Edit"
                                  onClick={() => handleEditTerritory(t)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  title="Delete"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setTerritoryToDelete(t);
                                    setDeleteConfirmOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {filteredTerritories.map((t) => {
                    const parentTerritory = territories.find(pt => pt.id === t.parent_id);
                    const grandParentTerritory = parentTerritory ? territories.find(gt => gt.id === parentTerritory.parent_id) : null;
                    
                    return (
                      <Card key={t.id} className="overflow-hidden">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 flex-1">
                              <CardTitle 
                                className="text-lg text-primary cursor-pointer hover:underline"
                                onClick={() => openTerritoryDetails(t)}
                              >
                                {t.name}
                              </CardTitle>
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-xs">{t.region}</Badge>
                                {t.territory_type && <Badge variant="secondary" className="text-xs">{t.territory_type}</Badge>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => openTerritoryDetails(t)}
                              >
                                <BarChart3 className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleEditTerritory(t)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => {
                                  setTerritoryToDelete(t);
                                  setDeleteConfirmOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Hierarchy */}
                          {(parentTerritory || grandParentTerritory) && (
                            <div className="space-y-1 p-2 bg-muted/50 rounded-lg">
                              <div className="text-xs font-medium text-muted-foreground">Hierarchy</div>
                              {grandParentTerritory && (
                                <div className="text-sm flex items-center gap-1 text-muted-foreground">
                                  <span>↳</span> {grandParentTerritory.name}
                                </div>
                              )}
                              {parentTerritory && (
                                <div className="text-sm flex items-center gap-1">
                                  <span>{grandParentTerritory ? '  ↳' : '↳'}</span>
                                  <Badge variant="outline" className="text-xs">{parentTerritory.name}</Badge>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Metrics */}
                          <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">Retailers</div>
                              <div className="text-lg font-bold">{t.total_retailers}</div>
                            </div>
                          </div>


                          {/* Visits Info */}
                          <div className="space-y-2 p-2 bg-muted/50 rounded-lg">
                            <div className="text-xs font-medium text-muted-foreground">Visits</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Owner: </span>
                                <span className="font-medium">{t.owner_name || 'Unassigned'}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">This Month: </span>
                                <Badge variant="secondary" className="text-xs">{t.visits_this_month}</Badge>
                              </div>
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Last Visit: </span>
                                <span className="font-medium">{t.last_visit_date ? format(new Date(t.last_visit_date), 'dd MMM yyyy') : '-'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Sub-territories */}
                          {(t.child_territories_count || 0) > 0 && (
                            <Badge variant="secondary" className="text-xs">{t.child_territories_count} Sub-territories</Badge>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

      </div>
      <TerritoryDetailsModal
        open={detailsModalOpen} 
        onOpenChange={setDetailsModalOpen} 
        territory={selectedTerritory}
        onEdit={handleEditTerritory}
        onDelete={(territory) => {
          setTerritoryToDelete(territory);
          setDeleteConfirmOpen(true);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Territory?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{territoryToDelete?.name}"? This will move the territory to the recycle bin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTerritoryToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTerritory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TerritoriesManagement;
