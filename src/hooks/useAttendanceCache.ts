import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { offlineStorage, STORES } from '@/lib/offlineStorage';
import { useConnectivity } from './useConnectivity';
import { useAuth } from './useAuth';
import { getLocalTodayDate } from '@/utils/dateUtils';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths } from 'date-fns';

// Types for attendance data
interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total_hours: number | null;
  check_in_location: any;
  check_out_location: any;
  check_in_address: string | null;
  check_out_address: string | null;
  check_in_photo_url: string | null;
  check_out_photo_url: string | null;
  face_verification_status: string | null;
  face_match_confidence: number | null;
  notes: string | null;
}

interface Visit {
  id: string;
  check_in_time: string | null;
  check_in_location: any;
  retailer_id: string;
}

interface RegularizationRequest {
  id: string;
  user_id: string;
  attendance_date: string;
  status: string;
}

// Helper to get date range based on filter
const getDateRange = (dateFilter: string, referenceDate?: Date) => {
  const now = referenceDate || new Date();
  let startDate, endDate;

  switch (dateFilter) {
    case 'current-week':
      startDate = startOfWeek(now, { weekStartsOn: 1 });
      endDate = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case 'last-month':
      const lastMonth = subMonths(now, 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
      break;
    case 'current-month':
    case 'custom-month':
    default:
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
      break;
  }

  return {
    start: format(startDate, 'yyyy-MM-dd'),
    end: format(endDate, 'yyyy-MM-dd')
  };
};

// Synchronous cache loader for instant UI display
const getCachedAttendanceSync = (userId: string | undefined, start: string, end: string): AttendanceRecord[] => {
  if (!userId) return [];
  try {
    const cached = localStorage.getItem(`attendance_${userId}_${start}_${end}`);
    if (cached) {
      console.log('[AttendanceCache] ✅ Instant load from localStorage');
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('[AttendanceCache] Sync cache read error:', e);
  }
  return [];
};

const getCachedVisitsSync = (userId: string | undefined): Visit[] => {
  if (!userId) return [];
  try {
    const cached = localStorage.getItem(`visits_today_${userId}`);
    if (cached) {
      const { data, date } = JSON.parse(cached);
      if (date === getLocalTodayDate()) {
        console.log('[AttendanceCache] ✅ Instant load visits from localStorage');
        return data;
      }
    }
  } catch (e) {
    console.error('[AttendanceCache] Sync visits cache read error:', e);
  }
  return [];
};

/**
 * Hook for caching and managing attendance data with offline-first pattern
 * - Loads from localStorage SYNCHRONOUSLY for instant UI
 * - Syncs with IndexedDB and network in background
 * - Prevents unnecessary network calls with stale-while-revalidate
 */
export function useAttendanceCache(dateFilter: string = 'current-month', referenceDate?: Date) {
  const connectivityStatus = useConnectivity();
  const isOnline = connectivityStatus === 'online';
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { start, end } = getDateRange(dateFilter, referenceDate);

  // INSTANT: Get cached data synchronously for immediate UI display
  const cachedRecordsSync = useMemo(() => 
    getCachedAttendanceSync(user?.id, start, end), 
    [user?.id, start, end]
  );
  
  const cachedVisitsSync = useMemo(() => 
    getCachedVisitsSync(user?.id),
    [user?.id]
  );

  // Load attendance records with placeholderData for instant display
  const {
    data: attendanceRecords = cachedRecordsSync,
    isLoading: isLoadingRecords,
    refetch: refetchRecords
  } = useQuery({
    queryKey: ['attendance-records', user?.id, dateFilter, start, end],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch from network if online
      if (!isOnline) {
        // Try IndexedDB for offline
        try {
          const cached = await offlineStorage.getAll<AttendanceRecord>(STORES.ATTENDANCE);
          return cached.filter(r => 
            r.user_id === user.id && 
            r.date >= start && 
            r.date <= end
          );
        } catch (e) {
          return cachedRecordsSync;
        }
      }

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false });

      if (error) throw error;

      // Cache results for instant loading next time
      if (data && data.length > 0) {
        try {
          localStorage.setItem(`attendance_${user.id}_${start}_${end}`, JSON.stringify(data));
          await offlineStorage.mergeData(STORES.ATTENDANCE, data);
          console.log('[AttendanceCache] ✅ Cached attendance records:', data.length);
        } catch (e) {
          console.error('[AttendanceCache] Cache write error:', e);
        }
      }

      return data || [];
    },
    placeholderData: cachedRecordsSync.length > 0 ? cachedRecordsSync : undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,
    enabled: !!user?.id,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Load today's visits with placeholderData for instant display
  const {
    data: todaysVisits = cachedVisitsSync,
    isLoading: isLoadingVisits,
    refetch: refetchVisits
  } = useQuery({
    queryKey: ['todays-visits', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const today = getLocalTodayDate();

      // Fetch from network if online
      if (!isOnline) return cachedVisitsSync;

      const { data, error } = await supabase
        .from('visits')
        .select('id, check_in_time, check_in_location, retailer_id')
        .eq('user_id', user.id)
        .eq('planned_date', today)
        .not('check_in_time', 'is', null)
        .order('check_in_time', { ascending: true });

      if (error) throw error;

      // Cache for instant loading
      if (data) {
        try {
          localStorage.setItem(`visits_today_${user.id}`, JSON.stringify({
            data,
            date: today
          }));
        } catch (e) {
          console.error('[AttendanceCache] Visits cache error:', e);
        }
      }

      return data || [];
    },
    placeholderData: cachedVisitsSync.length > 0 ? cachedVisitsSync : undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!user?.id,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Load regularization requests
  const {
    data: regularizationRequests = [],
    isLoading: isLoadingRegularization,
    refetch: refetchRegularization
  } = useQuery({
    queryKey: ['regularization-requests', user?.id, dateFilter],
    queryFn: async () => {
      if (!user?.id || !isOnline) return [];

      const { data, error } = await supabase
        .from('regularization_requests')
        .select('*')
        .eq('user_id', user.id)
        .gte('attendance_date', start)
        .lte('attendance_date', end);

      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes for regularization
    enabled: !!user?.id && isOnline,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Convert regularization to map for quick lookup
  const regularizationMap = new Map<string, RegularizationRequest>();
  regularizationRequests.forEach(req => {
    regularizationMap.set(req.attendance_date, req);
  });

  // Computed: Today's attendance record
  const todaysAttendance = attendanceRecords.find(
    r => r.date === getLocalTodayDate()
  ) || null;

  // Computed: Active market hours from visits
  const activeMarketHours = (() => {
    if (todaysVisits.length === 0) return null;
    const firstCheckIn = new Date(todaysVisits[0].check_in_time!);
    const lastCheckIn = new Date(todaysVisits[todaysVisits.length - 1].check_in_time!);
    return (lastCheckIn.getTime() - firstCheckIn.getTime()) / (1000 * 60 * 60);
  })();

  // Force refresh from network (bypasses cache)
  const forceRefresh = useCallback(async () => {
    if (!isOnline) return;
    
    // Invalidate queries to force refetch
    await queryClient.invalidateQueries({ queryKey: ['attendance-records', user?.id] });
    await queryClient.invalidateQueries({ queryKey: ['todays-visits', user?.id] });
    await queryClient.invalidateQueries({ queryKey: ['regularization-requests', user?.id] });
  }, [isOnline, queryClient, user?.id]);

  // Refetch only today's data (lighter refresh)
  const refreshTodayOnly = useCallback(async () => {
    if (!isOnline || !user?.id) return;

    const today = getLocalTodayDate();

    // Fetch only today's attendance
    const { data: todayAttendance } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    if (todayAttendance) {
      // Update cache with today's record
      await offlineStorage.save(STORES.ATTENDANCE, todayAttendance);
      // Invalidate to pick up the new data
      queryClient.invalidateQueries({ queryKey: ['attendance-records', user.id] });
    }

    // Refetch visits
    await refetchVisits();
  }, [isOnline, user?.id, queryClient, refetchVisits]);

  return {
    // Data
    attendanceRecords,
    todaysAttendance,
    todaysVisits,
    regularizationRequests: regularizationMap,
    activeMarketHours,

    // Loading states
    isLoading: isLoadingRecords || isLoadingVisits,
    isLoadingRegularization,

    // Actions
    refetchRecords,
    refetchVisits,
    refetchRegularization,
    forceRefresh,
    refreshTodayOnly,
  };
}
