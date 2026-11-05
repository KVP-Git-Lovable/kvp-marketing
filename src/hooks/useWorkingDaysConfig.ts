import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useConnectivity } from './useConnectivity';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths } from 'date-fns';

// Types
interface WeekOffConfig {
  id: string;
  day_of_week: number;
  is_off: boolean;
  alternate_pattern: string | null; // 'all' | '1st_3rd' | '2nd_4th' | null
}

interface Holiday {
  id: string;
  date: string;
  holiday_name: string;
}

interface WorkingDaysConfig {
  id: string;
  year: number;
  month: number;
  total_days: number;
  working_days: number;
  week_offs: number;
  holidays: number;
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
    end: format(endDate, 'yyyy-MM-dd'),
    startDate,
    endDate
  };
};

// Check if a specific date is a week-off based on alternate_pattern
const isWeekOffDate = (date: Date, weekOffConfigs: WeekOffConfig[]): boolean => {
  const dayOfWeek = date.getDay();
  const dayConfig = weekOffConfigs.filter(c => c.day_of_week === dayOfWeek && c.is_off);

  for (const config of dayConfig) {
    const pattern = config.alternate_pattern || 'all';

    if (pattern === 'all') {
      return true;
    }

    // Calculate which occurrence of this weekday in the month (1st, 2nd, 3rd, 4th)
    const dayOfMonth = date.getDate();
    const weekNumber = Math.ceil(dayOfMonth / 7);

    if (pattern === '1st_3rd' && (weekNumber === 1 || weekNumber === 3)) {
      return true;
    }
    if (pattern === '2nd_4th' && (weekNumber === 2 || weekNumber === 4)) {
      return true;
    }
  }

  return false;
};

// Synchronous cache loaders for instant UI display
const getCachedWeekOffSync = (): WeekOffConfig[] => {
  try {
    const cached = localStorage.getItem('week_off_config');
    if (cached) {
      console.log('[WorkingDays] ✅ Instant load week-off config');
      return JSON.parse(cached);
    }
  } catch (e) {}
  // Default: Sunday off
  return [{ id: 'default', day_of_week: 0, is_off: true, alternate_pattern: 'all' }];
};

const getCachedHolidaysSync = (start: string, end: string): Holiday[] => {
  try {
    const cacheKey = `holidays_${start}_${end}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      console.log('[WorkingDays] ✅ Instant load holidays');
      return JSON.parse(cached);
    }
  } catch (e) {}
  return [];
};

/**
 * Hook for caching week-off configuration and holidays
 * Uses localStorage for INSTANT synchronous loading
 * Reads from working_days_config (admin-saved) as source of truth with fallback to calculation
 */
export function useWorkingDaysConfig(dateFilter: string = 'current-month', referenceDate?: Date) {
  const connectivityStatus = useConnectivity();
  const isOnline = connectivityStatus === 'online';

  const { start, end, startDate, endDate } = getDateRange(dateFilter, referenceDate);

  // Determine month/year for working_days_config lookup
  const targetMonth = startDate.getMonth() + 1;
  const targetYear = startDate.getFullYear();

  // INSTANT: Synchronous cache load
  const cachedWeekOffSync = useMemo(() => getCachedWeekOffSync(), []);
  const cachedHolidaysSync = useMemo(() => getCachedHolidaysSync(start, end), [start, end]);

  // Load week-off configuration with instant placeholder
  const {
    data: weekOffConfig = cachedWeekOffSync,
    isLoading: isLoadingWeekOff
  } = useQuery({
    queryKey: ['week-off-config'],
    queryFn: async () => {
      const DEFAULT_WEEK_OFF: WeekOffConfig[] = [{ id: 'default', day_of_week: 0, is_off: true, alternate_pattern: 'all' }];

      if (!isOnline) return cachedWeekOffSync.length > 0 ? cachedWeekOffSync : DEFAULT_WEEK_OFF;

      const { data, error } = await supabase
        .from('week_off_config')
        .select('id, day_of_week, is_off, alternate_pattern');

      if (error) throw error;

      if (data && data.length > 0) {
        localStorage.setItem('week_off_config', JSON.stringify(data));
        localStorage.setItem('week_off_config_cached_at', Date.now().toString());
        return data;
      }

      // Table is empty — always use hardcoded default (Sunday off)
      return DEFAULT_WEEK_OFF;
    },
    placeholderData: cachedWeekOffSync,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Load holidays with correct column name (holiday_name)
  const {
    data: holidays = cachedHolidaysSync,
    isLoading: isLoadingHolidays
  } = useQuery({
    queryKey: ['holidays', start, end],
    queryFn: async () => {
      const cacheKey = `holidays_${start}_${end}`;

      if (!isOnline) return cachedHolidaysSync;

      const { data, error } = await supabase
        .from('holidays')
        .select('id, date, holiday_name')
        .gte('date', start)
        .lte('date', end);

      if (error) throw error;

      if (data) {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(`${cacheKey}_cached_at`, Date.now().toString());
      }

      return data || cachedHolidaysSync;
    },
    placeholderData: cachedHolidaysSync.length > 0 ? cachedHolidaysSync : undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Load admin-saved working_days_config as source of truth
  const { data: savedConfig } = useQuery({
    queryKey: ['working-days-config', targetYear, targetMonth],
    queryFn: async () => {
      if (!isOnline) return null;

      const { data, error } = await supabase
        .from('working_days_config')
        .select('*')
        .eq('year', targetYear)
        .eq('month', targetMonth)
        .maybeSingle();

      if (error) {
        console.error('[WorkingDays] Error fetching saved config:', error);
        return null;
      }

      return data as WorkingDaysConfig | null;
    },
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Computed: Set of week-off days (simple check for backward compat)
  const weekOffDays = useMemo(() => {
    const days = new Set<number>();
    weekOffConfig.filter(c => c.is_off && (!c.alternate_pattern || c.alternate_pattern === 'all'))
      .forEach(c => days.add(c.day_of_week));
    // Default to Sunday if no config at all
    if (weekOffConfig.length === 0 || (weekOffConfig.length === 1 && weekOffConfig[0].id === 'default')) {
      days.add(0);
    }
    return days;
  }, [weekOffConfig]);

  // Computed: Set of holiday dates
  const holidayDates = useMemo(() => {
    return new Set(holidays.map(h => h.date));
  }, [holidays]);

  // Calculate working days stats for the period
  // Uses savedConfig (admin source of truth) when available, falls back to calculation
  const workingDaysStats = useMemo(() => {
    const now = new Date();
    const currentDate = now.getDate();

    let totalWorkingDays = 0;
    let elapsedWorkingDays = 0;
    const elapsedWorkingDates: string[] = [];

    if (dateFilter === 'current-week') {
      // Week view — always calculate (no saved config for weeks)
      const dayOfWeek = now.getDay();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });

      // Calculate total working days in the week
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateStr = format(date, 'yyyy-MM-dd');
        if (!isWeekOffDate(date, weekOffConfig) && !holidayDates.has(dateStr)) {
          totalWorkingDays++;
        }
      }

      // Calculate elapsed working days
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        if (date > now) break;
        const dateStr = format(date, 'yyyy-MM-dd');
        if (!isWeekOffDate(date, weekOffConfig) && !holidayDates.has(dateStr)) {
          elapsedWorkingDays++;
          elapsedWorkingDates.push(dateStr);
        }
      }
    } else {
      // Month view — use saved config for totalWorkingDays if available
      if (savedConfig) {
        totalWorkingDays = savedConfig.working_days;
        console.log(`[WorkingDays] ✅ Using admin-saved config: ${totalWorkingDays} working days for ${targetYear}-${targetMonth}`);
      } else {
        // Fallback: calculate total working days for the entire month
        const daysInMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(endDate.getFullYear(), endDate.getMonth(), day);
          const dateStr = format(date, 'yyyy-MM-dd');
          if (!isWeekOffDate(date, weekOffConfig) && !holidayDates.has(dateStr)) {
            totalWorkingDays++;
          }
        }
      }

      // Always calculate elapsed working days (up to today or end of period)
      const todayDate = dateFilter === 'current-month'
        ? Math.min(currentDate, new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate())
        : new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();

      for (let day = 1; day <= todayDate; day++) {
        const date = new Date(startDate.getFullYear(), startDate.getMonth(), day);
        const dateStr = format(date, 'yyyy-MM-dd');
        if (!isWeekOffDate(date, weekOffConfig) && !holidayDates.has(dateStr)) {
          elapsedWorkingDays++;
          elapsedWorkingDates.push(dateStr);
        }
      }
    }

    return {
      totalWorkingDays,
      elapsedWorkingDays,
      elapsedWorkingDates,
    };
  }, [dateFilter, weekOffConfig, holidayDates, startDate, endDate, savedConfig, targetYear, targetMonth]);

  return {
    // Raw data
    weekOffConfig,
    holidays,
    weekOffDays,
    holidayDates,

    // Computed stats
    totalWorkingDays: workingDaysStats.totalWorkingDays,
    elapsedWorkingDays: workingDaysStats.elapsedWorkingDays,
    elapsedWorkingDates: workingDaysStats.elapsedWorkingDates,

    // Loading state
    isLoading: isLoadingWeekOff || isLoadingHolidays,
  };
}
