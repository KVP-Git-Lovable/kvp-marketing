import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, MapPin } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { JourneyMap, DayGroup } from '@/components/JourneyMap';
import { CurrentLocationMap } from '@/components/CurrentLocationMap';
import { toast } from 'sonner';
import { UserSelector } from '@/components/UserSelector';
import { useSubordinates } from '@/hooks/useSubordinates';
import { GPSStatsCard } from '@/components/gps/GPSStatsCard';
import { EnhancedRetailerLocation, RetailerStatus } from '@/components/gps/RetailerListModal';
import { useSearchParams } from 'react-router-dom';

interface GPSData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
}

interface VisitStats {
  planned: number;
  productive: number;
  unproductive: number;
  pending: number;
}

type DateRangeMode = 'today' | 'week' | 'month' | 'custom';
type CurrentLocDateRange = 'today' | 'week' | 'month' | 'custom';

export default function GPSTrack() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  // Read URL parameters for date and userId
  const dateParam = searchParams.get('date');
  const userParam = searchParams.get('userId');
  
  const [date, setDate] = useState<Date>(() => {
    if (dateParam) {
      return new Date(dateParam + 'T00:00:00');
    }
    return new Date();
  });
  const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>('today');
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  
  // Compute date range based on mode
  const { startDate, endDate } = useMemo(() => {
    switch (dateRangeMode) {
      case 'week':
        return {
          startDate: startOfWeek(date, { weekStartsOn: 1 }),
          endDate: endOfWeek(date, { weekStartsOn: 1 }),
        };
      case 'month':
        return {
          startDate: startOfMonth(date),
          endDate: endOfMonth(date),
        };
      case 'custom':
        return { startDate: customStartDate, endDate: customEndDate };
      case 'today':
      default:
        return { startDate: date, endDate: date };
    }
  }, [date, dateRangeMode, customStartDate, customEndDate]);

  const startDateStr = useMemo(() => format(startDate, 'yyyy-MM-dd'), [startDate]);
  const endDateStr = useMemo(() => format(endDate, 'yyyy-MM-dd'), [endDate]);
  const isRange = dateRangeMode === 'week' || dateRangeMode === 'month' || dateRangeMode === 'custom';
  const [gpsData, setGpsData] = useState<GPSData[]>([]);
  const [retailers, setRetailers] = useState<EnhancedRetailerLocation[]>([]);
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [beatName, setBeatName] = useState<string | null>(null);
  const [visitStats, setVisitStats] = useState<VisitStats>({ planned: 0, productive: 0, unproductive: 0, pending: 0 });
  const [totalKmTraveled, setTotalKmTraveled] = useState(0);
  
  // Filter state for map - when a status is selected, only show those retailers
  const [filterStatus, setFilterStatus] = useState<RetailerStatus | null>(null);
  
  // Hierarchical user filter using useSubordinates hook
  const { isManager, subordinates, isLoading: subordinatesLoading } = useSubordinates();
  
  // State for user selection - initialize from URL param or 'self'
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    return userParam || 'self';
  });
  const [currentLocationUserId, setCurrentLocationUserId] = useState<string>('self');
  
  // Current Location tab - date range and journey history
  const [clDateRange, setClDateRange] = useState<CurrentLocDateRange>('today');
  const [clCustomStart, setClCustomStart] = useState<Date>(new Date());
  const [clCustomEnd, setClCustomEnd] = useState<Date>(new Date());
  const [clGpsData, setClGpsData] = useState<GPSData[]>([]);
  const [clLoading, setClLoading] = useState(false);
  const [clAttendanceData, setClAttendanceData] = useState<{ check_in_time: string | null; check_out_time: string | null } | null>(null);

  // Compute current location tab date range
  const { clStartDate, clEndDate } = useMemo(() => {
    const today = new Date();
    switch (clDateRange) {
      case 'week':
        return { clStartDate: startOfWeek(today, { weekStartsOn: 1 }), clEndDate: endOfWeek(today, { weekStartsOn: 1 }) };
      case 'month':
        return { clStartDate: startOfMonth(today), clEndDate: endOfMonth(today) };
      case 'custom':
        return { clStartDate: clCustomStart, clEndDate: clCustomEnd };
      default:
        return { clStartDate: today, clEndDate: today };
    }
  }, [clDateRange, clCustomStart, clCustomEnd]);

  const clStartStr = useMemo(() => format(clStartDate, 'yyyy-MM-dd'), [clStartDate]);
  const clEndStr = useMemo(() => format(clEndDate, 'yyyy-MM-dd'), [clEndDate]);
  
  // Determine if user can select team members (is a manager with subordinates)
  const canSelectTeamMembers = isManager;

  // Get the actual user ID for data fetching
  const getActualUserId = (selectorValue: string): string => {
    if (selectorValue === 'self' || !selectorValue) {
      return user?.id || '';
    }
    return selectorValue;
  };

  const selectedMember = getActualUserId(selectedUserId);
  const currentLocationUser = getActualUserId(currentLocationUserId);

  // Initialize selection when user loads
  useEffect(() => {
    if (user?.id && !subordinatesLoading) {
      setSelectedUserId('self');
      setCurrentLocationUserId('self');
    }
  }, [user?.id, subordinatesLoading]);

  // Real-time subscription for visit updates
  useEffect(() => {
    if (!selectedMember) return;

    const channel = supabase
      .channel('visit-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visits',
          filter: `user_id=eq.${selectedMember}`
        },
        (payload) => {
          console.log('Visit update received:', payload);
          loadRetailerLocations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedMember, date]);

  const loadGPSData = async () => {
    if (!selectedMember) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('gps_tracking')
      .select('*')
      .eq('user_id', selectedMember)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error loading GPS data:', error);
      toast.error('Failed to load tracking data');
      setLoading(false);
      return;
    }

    if (data) {
      setGpsData(
        data.map((d) => ({
          latitude: parseFloat(d.latitude as unknown as string),
          longitude: parseFloat(d.longitude as unknown as string),
          accuracy: d.accuracy ? parseFloat(d.accuracy as unknown as string) : 0,
          timestamp: new Date(d.timestamp),
        }))
      );
    }

    setLoading(false);
  };

  // Day color palette for multi-day mode
  const dayColorPalette = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b'];

  const loadRetailerLocations = async () => {
    if (!selectedMember) return;

    console.log('Loading ALL retailer locations for range:', startDateStr, '-', endDateStr, 'user:', selectedMember);

    // Fetch beat plans WITH plan_date
    const { data: beatPlans, error: beatPlansError } = await supabase
      .from('beat_plans')
      .select('beat_id, plan_date')
      .eq('user_id', selectedMember)
      .gte('plan_date', startDateStr)
      .lte('plan_date', endDateStr);

    if (beatPlansError) {
      console.error('Error loading beat plans:', beatPlansError);
      return;
    }

    const beatIds = beatPlans?.map(bp => bp.beat_id) || [];

    if (beatIds.length === 0) {
      console.log('No beat plans found for this date');
      setRetailers([]);
      setDayGroups([]);
      return;
    }

    // Build beat_id -> plan_date map (a beat can appear on multiple days, take earliest)
    const beatToPlanDate = new Map<string, string>();
    beatPlans?.forEach(bp => {
      // For each beat, map to its plan_date; if same beat on multiple days, group retailers by day
      if (!beatToPlanDate.has(bp.beat_id + '_' + bp.plan_date)) {
        beatToPlanDate.set(bp.beat_id + '_' + bp.plan_date, bp.plan_date);
      }
    });

    // Get unique beat_id -> plan_date pairs
    const beatDatePairs = beatPlans?.map(bp => ({ beatId: bp.beat_id, planDate: bp.plan_date })) || [];

    // Get all retailers assigned to these beats
    const { data: allRetailers, error: retailersError } = await supabase
      .from('retailers')
      .select('id, name, address, latitude, longitude, beat_id')
      .in('beat_id', beatIds);

    if (retailersError) {
      console.error('Error loading retailers:', retailersError);
      return;
    }

    if (!allRetailers || allRetailers.length === 0) {
      console.log('No retailers found for beats');
      setRetailers([]);
      setDayGroups([]);
      return;
    }

    // Get visits for this date range
    const { data: visitsData, error: visitsError } = await supabase
      .from('visits')
      .select('id, check_in_time, check_out_time, status, retailer_id, no_order_reason, check_in_location, check_in_address, planned_date')
      .eq('user_id', selectedMember)
      .gte('planned_date', startDateStr)
      .lte('planned_date', endDateStr)
      .not('retailer_id', 'is', null);

    if (visitsError) {
      console.error('Error loading visits:', visitsError);
    }

    // Get orders for this date range
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('retailer_id')
      .eq('user_id', selectedMember)
      .gte('order_date', startDateStr)
      .lte('order_date', endDateStr)
      .eq('status', 'confirmed');

    if (ordersError) {
      console.error('Error loading orders:', ordersError);
    }

    // Fetch attendance for date range (for start locations)
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('date, check_in_location')
      .eq('user_id', selectedMember)
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    const attendanceByDate = new Map<string, { latitude: number; longitude: number }>();
    attendanceData?.forEach(att => {
      const loc = att.check_in_location as any;
      if (loc?.latitude && loc?.longitude) {
        attendanceByDate.set(att.date, { latitude: loc.latitude, longitude: loc.longitude });
      }
    });

    const visits = visitsData || [];
    const orders = ordersData || [];

    const visitsByRetailer = new Map<string, any[]>();
    visits.forEach(v => {
      if (v.retailer_id) {
        const list = visitsByRetailer.get(v.retailer_id) || [];
        list.push(v);
        visitsByRetailer.set(v.retailer_id, list);
      }
    });

    const retailersWithOrders = new Set(orders.map(o => o.retailer_id));
    const hasAnyVisits = visits.length > 0;

    const parseLatLngFromAddress = (addr?: string | null) => {
      if (!addr) return null;
      const match = addr.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
      if (!match) return null;
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (isNaN(lat) || isNaN(lng)) return null;
      return { latitude: lat, longitude: lng };
    };

    // Build enhanced retailer for a given retailer record
    const buildEnhancedRetailer = (retailer: any, planDate?: string): EnhancedRetailerLocation | null => {
      const retailerVisits = visitsByRetailer.get(retailer.id) || [];
      const hasOrder = retailersWithOrders.has(retailer.id);
      const hasVisit = retailerVisits.length > 0;
      const firstVisit = retailerVisits[0];

      let status: RetailerStatus;
      if (hasOrder || retailerVisits.some((v: any) => v.status === 'productive')) {
        status = 'productive';
      } else if (retailerVisits.some((v: any) => v.status === 'unproductive' || !!v.no_order_reason)) {
        status = 'unproductive';
      } else if (hasVisit) {
        status = 'pending';
      } else if (hasAnyVisits) {
        status = 'pending';
      } else {
        status = 'planned';
      }

      let lat: number | null = null;
      let lng: number | null = null;

      if (retailer.latitude && retailer.longitude) {
        lat = parseFloat(retailer.latitude as unknown as string);
        lng = parseFloat(retailer.longitude as unknown as string);
      } else if (firstVisit?.check_in_location?.latitude && firstVisit?.check_in_location?.longitude) {
        lat = firstVisit.check_in_location.latitude;
        lng = firstVisit.check_in_location.longitude;
      } else if (firstVisit?.check_in_address) {
        const parsed = parseLatLngFromAddress(firstVisit.check_in_address);
        if (parsed) { lat = parsed.latitude; lng = parsed.longitude; }
      }

      if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;

      return {
        id: retailer.id,
        name: retailer.name || 'Retailer',
        address: retailer.address || '',
        latitude: lat,
        longitude: lng,
        visitId: firstVisit?.id,
        checkInTime: firstVisit?.check_in_time || null,
        status,
        hasOrder,
        planDate,
      };
    };

    // Build flat list (for single-day and stats)
    const enhancedRetailers: EnhancedRetailerLocation[] = allRetailers
      .map((r) => buildEnhancedRetailer(r))
      .filter((r): r is EnhancedRetailerLocation => r !== null);

    setRetailers(enhancedRetailers);

    // Build day groups for multi-day mode
    if (isRange) {
      // Group retailers by plan_date using beat -> date mapping
      const retailersByDate = new Map<string, EnhancedRetailerLocation[]>();

      beatDatePairs.forEach(({ beatId, planDate }) => {
        const beatsRetailers = allRetailers.filter(r => r.beat_id === beatId);
        beatsRetailers.forEach(r => {
          const enhanced = buildEnhancedRetailer(r, planDate);
          if (enhanced) {
            const list = retailersByDate.get(planDate) || [];
            // Avoid duplicates (same retailer in same date)
            if (!list.some(existing => existing.id === enhanced.id)) {
              list.push(enhanced);
              retailersByDate.set(planDate, list);
            }
          }
        });
      });

      // Sort dates and build DayGroup[]
      const sortedDates = [...retailersByDate.keys()].sort();
      const groups: DayGroup[] = sortedDates.map((dateStr, idx) => {
        const d = new Date(dateStr + 'T00:00:00');
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
        return {
          date: dateStr,
          dayLabel,
          color: dayColorPalette[idx % dayColorPalette.length],
          retailers: retailersByDate.get(dateStr) || [],
          startLocation: attendanceByDate.get(dateStr),
        };
      });

      setDayGroups(groups);
    } else {
      setDayGroups([]);
    }

    console.log('Enhanced retailer locations:', enhancedRetailers);
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate total km traveled from GPS data
  useEffect(() => {
    if (gpsData.length > 1) {
      let total = 0;
      for (let i = 1; i < gpsData.length; i++) {
        total += calculateDistance(
          gpsData[i - 1].latitude,
          gpsData[i - 1].longitude,
          gpsData[i].latitude,
          gpsData[i].longitude
        );
      }
      setTotalKmTraveled(total);
    } else {
      setTotalKmTraveled(0);
    }
  }, [gpsData]);

  const loadBeatInfo = async () => {
    if (!selectedMember) return;

    if (isRange) {
      setBeatName('Multiple beats');
      return;
    }
    
    const { data, error } = await supabase
      .from('beat_plans')
      .select('beat_name')
      .eq('user_id', selectedMember)
      .eq('plan_date', startDateStr)
      .maybeSingle();

    if (error) {
      console.error('Error loading beat info:', error);
      return;
    }

    setBeatName(data?.beat_name || null);
  };

  const loadVisitStats = useCallback(async () => {
    if (!selectedMember) return;

    // Fetch visits AND beat plan retailers to match My Visits page logic
    // "Planned" = total retailers in beat plan (not just visit records)
    // "Pending" = planned retailers not yet visited
    const [visitsResult, beatPlansResult] = await Promise.all([
      supabase
        .from('visits')
        .select('id, status, no_order_reason')
        .eq('user_id', selectedMember)
        .gte('planned_date', startDateStr)
        .lte('planned_date', endDateStr),
      supabase
        .from('beat_plans')
        .select('beat_id')
        .eq('user_id', selectedMember)
        .gte('plan_date', startDateStr)
        .lte('plan_date', endDateStr)
    ]);

    if (visitsResult.error) {
      console.error('Error loading visit stats:', visitsResult.error);
      return;
    }

    const visits = visitsResult.data || [];
    const beatPlans = beatPlansResult.data || [];
    
    // Get total planned retailers from beat plans
    let totalPlanned = visits.length; // fallback to visits count
    if (beatPlans.length > 0) {
      const beatIds = [...new Set(beatPlans.map(bp => bp.beat_id))];
      const { data: retailers, error: retErr } = await supabase
        .from('retailers')
        .select('id', { count: 'exact', head: false })
        .in('beat_id', beatIds)
        .eq('user_id', selectedMember);
      
      if (!retErr && retailers) {
        totalPlanned = retailers.length;
      }
    }

    const productive = visits.filter(v => v.status === 'productive').length;
    const unproductive = visits.filter(v => v.status === 'unproductive' || !!v.no_order_reason).length;
    const pending = totalPlanned - productive - unproductive;
    
    setVisitStats({ 
      planned: totalPlanned, 
      productive, 
      unproductive, 
      pending: Math.max(0, pending)
    });
  }, [selectedMember, startDateStr, endDateStr]);

  // Data loading effect - called after all functions are defined
  useEffect(() => {
    if (selectedMember) {
      loadGPSData();
      loadRetailerLocations();
      loadBeatInfo();
      loadVisitStats();
    }
  }, [selectedMember, startDateStr, endDateStr, loadVisitStats]);

  // Load GPS journey history for Current Location tab (filtered by attendance boundaries)
  useEffect(() => {
    if (!currentLocationUser) return;
    
    const loadClGpsData = async () => {
      setClLoading(true);
      setClAttendanceData(null);

      // Fetch attendance record for the date range (use first date for single-day)
      const { data: attendanceInfo } = await supabase
        .from('attendance')
        .select('check_in_time, check_out_time')
        .eq('user_id', currentLocationUser)
        .gte('date', clStartStr)
        .lte('date', clEndStr)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle();

      setClAttendanceData(attendanceInfo || null);

      // Build GPS query
      let query = supabase
        .from('gps_tracking')
        .select('latitude, longitude, accuracy, timestamp')
        .eq('user_id', currentLocationUser)
        .gte('date', clStartStr)
        .lte('date', clEndStr)
        .order('timestamp', { ascending: true });

      // Filter by attendance check-in/check-out boundaries
      if (attendanceInfo?.check_in_time) {
        query = query.gte('timestamp', attendanceInfo.check_in_time);
      }
      if (attendanceInfo?.check_out_time) {
        query = query.lte('timestamp', attendanceInfo.check_out_time);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading CL GPS data:', error);
        setClLoading(false);
        return;
      }

      if (data) {
        setClGpsData(data.map(d => ({
          latitude: parseFloat(d.latitude as unknown as string),
          longitude: parseFloat(d.longitude as unknown as string),
          accuracy: d.accuracy ? parseFloat(d.accuracy as unknown as string) : 0,
          timestamp: new Date(d.timestamp),
        })));
      }
      setClLoading(false);
    };

    loadClGpsData();
  }, [currentLocationUser, clStartStr, clEndStr]);

  const isViewingOtherUser = currentLocationUser !== user?.id;

  // Handle status card clicks - toggle filter for map
  const handleStatusClick = (status: RetailerStatus) => {
    // If same status clicked, clear filter (show all)
    if (filterStatus === status) {
      setFilterStatus(null);
    } else {
      setFilterStatus(status);
    }
  };

  // Get filtered retailers based on selected status
  const filteredRetailers = filterStatus 
    ? retailers.filter(r => {
        if (filterStatus === 'pending') {
          // Pending includes both 'pending' and 'planned' status
          return r.status === 'pending' || r.status === 'planned';
        }
        return r.status === filterStatus;
      })
    : retailers;

  return (
    <Layout>
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">GPS Track</h1>
            <p className="text-muted-foreground">Monitor field movement with GPS tracking</p>
          </div>
        </div>

        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="current">Current Location</TabsTrigger>
            <TabsTrigger value="day">Day Tracking</TabsTrigger>
          </TabsList>

          {/* Current Location Tab */}
          <TabsContent value="current" className="space-y-6 mt-6">
            {/* Filters Card */}
            <Card className="p-6">
              <div className="space-y-4">
                {/* Date Range Filter */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Select Date Range</label>
                  <Select
                    value={clDateRange}
                    onValueChange={(value: CurrentLocDateRange) => setClDateRange(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="custom">Custom Date Range</SelectItem>
                    </SelectContent>
                  </Select>

                  {clDateRange === 'custom' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">From</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal text-sm">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(clCustomStart, 'MMM d, yyyy')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-50" align="start">
                            <Calendar
                              mode="single"
                              selected={clCustomStart}
                              onSelect={(d) => {
                                if (d) {
                                  setClCustomStart(d);
                                  if (d > clCustomEnd) setClCustomEnd(d);
                                }
                              }}
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">To</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal text-sm">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(clCustomEnd, 'MMM d, yyyy')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-50" align="start">
                            <Calendar
                              mode="single"
                              selected={clCustomEnd}
                              onSelect={(d) => {
                                if (d && d >= clCustomStart) setClCustomEnd(d);
                              }}
                              disabled={(d) => d < clCustomStart}
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground">
                    {clDateRange !== 'today'
                      ? `Showing: ${format(clStartDate, 'MMM d')} – ${format(clEndDate, 'MMM d, yyyy')}`
                      : `Showing: ${format(clStartDate, 'PPP')}`}
                  </p>
                </div>

                {/* User Selector - For Managers with subordinates */}
                {canSelectTeamMembers && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Team Member</label>
                    <UserSelector
                      selectedUserId={currentLocationUserId}
                      onUserChange={setCurrentLocationUserId}
                      showAllOption={false}
                      className="w-full max-w-full h-10"
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Attendance Info Card */}
            {clAttendanceData && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Attendance Boundaries</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Day Start: </span>
                    <span className="font-medium">
                      {clAttendanceData.check_in_time
                        ? format(new Date(clAttendanceData.check_in_time), 'hh:mm a')
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Day End: </span>
                    <span className="font-medium">
                      {clAttendanceData.check_out_time
                        ? format(new Date(clAttendanceData.check_out_time), 'hh:mm a')
                        : 'Active'}
                    </span>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-6 relative z-0">
              <CurrentLocationMap 
                height="600px" 
                userId={currentLocationUser} 
                isViewingOther={isViewingOtherUser}
                journeyPositions={clGpsData}
                journeyLoading={clLoading}
                attendanceCompleted={!!clAttendanceData?.check_out_time}
              />
            </Card>
          </TabsContent>

          {/* Day Tracking Tab */}
          <TabsContent value="day" className="space-y-6 mt-6">
            {/* Filters */}
            <Card className="p-6">
              <div className="space-y-4">
                {/* Date Range Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Select Date Range</label>
                  <Select
                    value={dateRangeMode}
                    onValueChange={(value: DateRangeMode) => {
                      setDateRangeMode(value);
                      if (value !== 'custom') {
                        setDate(new Date());
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="custom">Custom Date Range</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Custom date range pickers */}
                  {dateRangeMode === 'custom' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">From</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal text-sm">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(customStartDate, 'MMM d, yyyy')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-50" align="start">
                            <Calendar
                              mode="single"
                              selected={customStartDate}
                              onSelect={(d) => {
                                if (d) {
                                  setCustomStartDate(d);
                                  if (d > customEndDate) setCustomEndDate(d);
                                }
                              }}
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">To</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal text-sm">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(customEndDate, 'MMM d, yyyy')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-50" align="start">
                            <Calendar
                              mode="single"
                              selected={customEndDate}
                              onSelect={(d) => {
                                if (d && d >= customStartDate) setCustomEndDate(d);
                              }}
                              disabled={(d) => d < customStartDate}
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground">
                    {isRange
                      ? `Showing: ${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d, yyyy')}`
                      : `Showing: ${format(date, 'PPP')}`}
                  </p>
                </div>

                {/* Team Member Selector - For Managers with subordinates */}
                {canSelectTeamMembers && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Team Member</label>
                    <UserSelector
                      selectedUserId={selectedUserId}
                      onUserChange={setSelectedUserId}
                      showAllOption={false}
                      className="w-full max-w-full h-10"
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Stats Card with click handlers */}
            <GPSStatsCard
              beatName={beatName}
              plannedVisits={visitStats.planned}
              productiveVisits={visitStats.productive}
              unproductiveVisits={visitStats.unproductive}
              pendingVisits={visitStats.pending}
              totalKmTraveled={totalKmTraveled}
              activeFilter={filterStatus}
              onPlannedClick={() => handleStatusClick('planned')}
              onProductiveClick={() => handleStatusClick('productive')}
              onUnproductiveClick={() => handleStatusClick('unproductive')}
              onPendingClick={() => handleStatusClick('pending')}
            />

            {/* Map Display */}
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    loadGPSData();
                    loadRetailerLocations();
                    loadBeatInfo();
                  }}
                >
                  Refresh
                </Button>
              </div>

              {loading ? (
                <Card className="flex items-center justify-center h-96">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </Card>
              ) : (
              <Card className="overflow-hidden relative z-0">
                  <JourneyMap 
                    positions={gpsData} 
                    retailers={filteredRetailers}
                    dayGroups={isRange ? dayGroups : undefined}
                    height="500px"
                    totalGpsDistance={totalKmTraveled}
                  />
                </Card>
              )}

              {/* GPS Tracking Info */}
              {gpsData.length > 0 && (
                <Card className="p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-sm text-muted-foreground">Period</div>
                      <div className="text-base font-semibold">
                        {isRange
                          ? `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d')}`
                          : format(date, 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">GPS Points</div>
                      <div className="text-xl font-bold">{gpsData.length}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Start Time</div>
                      <div className="text-xl font-semibold">
                        {format(gpsData[0].timestamp, 'hh:mm a')}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Last Update</div>
                      <div className="text-xl font-semibold">
                        {format(gpsData[gpsData.length - 1].timestamp, 'hh:mm a')}
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Filter indicator */}
      {filterStatus && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setFilterStatus(null)}
            className="shadow-lg"
          >
            Showing {filterStatus === 'pending' ? 'Pending' : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} only • Tap to show all
          </Button>
        </div>
      )}
    </Layout>
  );
}
