import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, getDay } from 'date-fns';

interface WeekOffConfig {
  day_of_week: number;
  is_off: boolean;
  alternate_pattern: string | null;
}

export interface WorkingDaysResult {
  totalDaysInMonth: number;
  weekOffs: number;
  holidays: number;
  approvedLeaves: number;
  effectiveWorkingDays: number;
  holidayDates: string[];
  leaveDates: string[];
  weekOffDates: string[];
}

export interface MonthlyWorkingDays {
  [monthKey: string]: WorkingDaysResult;
}

// Helper: Check if a specific date is a week-off based on config
function isDateWeekOff(date: Date, weekOffConfig: WeekOffConfig[]): boolean {
  const dayOfWeek = getDay(date);
  const config = weekOffConfig.find(c => c.day_of_week === dayOfWeek);
  
  if (!config || !config.is_off) return false;
  
  const dayOfMonth = date.getDate();
  const weekOfMonth = Math.ceil(dayOfMonth / 7);
  
  switch (config.alternate_pattern) {
    case 'all':
      return true;
    case '1st_3rd':
      return weekOfMonth === 1 || weekOfMonth === 3;
    case '2nd_4th':
      return weekOfMonth === 2 || weekOfMonth === 4;
    default:
      return false;
  }
}

// Calculate working days for a specific month and user
export function useWorkingDaysCalculator(
  userId: string | undefined,
  year: number,
  month: number // 0-indexed (0 = January)
) {
  return useQuery({
    queryKey: ['working-days', userId, year, month],
    queryFn: async (): Promise<WorkingDaysResult> => {
      const startDate = startOfMonth(new Date(year, month));
      const endDate = endOfMonth(new Date(year, month));
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Fetch week-off configuration
      const { data: weekOffData } = await supabase
        .from('week_off_config')
        .select('day_of_week, is_off, alternate_pattern');
      
      const weekOffConfig: WeekOffConfig[] = weekOffData || [];

      // Get all days in the month
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });
      const totalDaysInMonth = allDays.length;

      // Count week-offs based on configuration
      const weekOffDates: string[] = [];
      allDays.forEach(day => {
        if (isDateWeekOff(day, weekOffConfig)) {
          weekOffDates.push(format(day, 'yyyy-MM-dd'));
        }
      });

      // Fetch holidays for this month
      const { data: holidays } = await supabase
        .from('holidays')
        .select('date')
        .gte('date', startStr)
        .lte('date', endStr);

      const holidayDates = holidays?.map(h => h.date) || [];
      
      // Filter out holidays that fall on week-offs to avoid double counting
      const nonWeekOffHolidays = holidayDates.filter(date => !weekOffDates.includes(date));

      // Fetch approved leaves for this user in this month
      let leaveDates: string[] = [];
      if (userId) {
        const { data: leaves } = await supabase
          .from('leave_applications')
          .select('start_date, end_date')
          .eq('user_id', userId)
          .eq('status', 'approved')
          .or(`start_date.lte.${endStr},end_date.gte.${startStr}`);

        if (leaves) {
          leaves.forEach(leave => {
            const leaveStart = new Date(Math.max(new Date(leave.start_date).getTime(), startDate.getTime()));
            const leaveEnd = new Date(Math.min(new Date(leave.end_date).getTime(), endDate.getTime()));
            const leaveDays = eachDayOfInterval({ start: leaveStart, end: leaveEnd });
            leaveDays.forEach(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              // Don't count leaves on week-offs or holidays
              if (!weekOffDates.includes(dayStr) && !holidayDates.includes(dayStr)) {
                leaveDates.push(dayStr);
              }
            });
          });
        }
      }

      // Remove duplicates
      leaveDates = [...new Set(leaveDates)];

      const effectiveWorkingDays = totalDaysInMonth - weekOffDates.length - nonWeekOffHolidays.length - leaveDates.length;

      return {
        totalDaysInMonth,
        weekOffs: weekOffDates.length,
        holidays: nonWeekOffHolidays.length,
        approvedLeaves: leaveDates.length,
        effectiveWorkingDays: Math.max(0, effectiveWorkingDays),
        holidayDates: nonWeekOffHolidays,
        leaveDates,
        weekOffDates,
      };
    },
    enabled: !!year,
  });
}

// Calculate working days for an entire FY (April to March)
export function useFYWorkingDays(userId: string | undefined, fyYear: number) {
  return useQuery({
    queryKey: ['fy-working-days', userId, fyYear],
    queryFn: async (): Promise<MonthlyWorkingDays> => {
      const results: MonthlyWorkingDays = {};
      
      // FY months: April (prev year) to March (fy year)
      // FY 2025 = April 2024 to March 2025
      const fyMonths = [
        { month: 3, year: fyYear - 1 },  // April
        { month: 4, year: fyYear - 1 },  // May
        { month: 5, year: fyYear - 1 },  // June
        { month: 6, year: fyYear - 1 },  // July
        { month: 7, year: fyYear - 1 },  // August
        { month: 8, year: fyYear - 1 },  // September
        { month: 9, year: fyYear - 1 },  // October
        { month: 10, year: fyYear - 1 }, // November
        { month: 11, year: fyYear - 1 }, // December
        { month: 0, year: fyYear },      // January
        { month: 1, year: fyYear },      // February
        { month: 2, year: fyYear },      // March
      ];

      const startDate = `${fyYear - 1}-04-01`;
      const endDate = `${fyYear}-03-31`;

      // Fetch week-off configuration
      const { data: weekOffData } = await supabase
        .from('week_off_config')
        .select('day_of_week, is_off, alternate_pattern');
      
      const weekOffConfig: WeekOffConfig[] = weekOffData || [];

      // Fetch all holidays for the FY
      const { data: holidays } = await supabase
        .from('holidays')
        .select('date')
        .gte('date', startDate)
        .lte('date', endDate);

      const holidayDates = holidays?.map(h => h.date) || [];

      // Calculate all week-off dates for the FY
      const fyStart = new Date(fyYear - 1, 3, 1); // April 1
      const fyEnd = new Date(fyYear, 2, 31); // March 31
      const allFYDays = eachDayOfInterval({ start: fyStart, end: fyEnd });
      const allWeekOffDates: string[] = [];
      allFYDays.forEach(day => {
        if (isDateWeekOff(day, weekOffConfig)) {
          allWeekOffDates.push(format(day, 'yyyy-MM-dd'));
        }
      });

      // Fetch all approved leaves for this user in this FY
      let allLeaveDates: string[] = [];
      if (userId) {
        const { data: leaves } = await supabase
          .from('leave_applications')
          .select('start_date, end_date')
          .eq('user_id', userId)
          .eq('status', 'approved')
          .or(`start_date.lte.${endDate},end_date.gte.${startDate}`);

        if (leaves) {
          leaves.forEach(leave => {
            const leaveStart = new Date(leave.start_date);
            const leaveEnd = new Date(leave.end_date);
            const leaveDays = eachDayOfInterval({ start: leaveStart, end: leaveEnd });
            leaveDays.forEach(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              // Don't count leaves on week-offs or holidays
              if (!allWeekOffDates.includes(dayStr) && !holidayDates.includes(dayStr)) {
                allLeaveDates.push(dayStr);
              }
            });
          });
        }
      }
      allLeaveDates = [...new Set(allLeaveDates)];

      // Calculate for each month
      fyMonths.forEach(({ month, year }, index) => {
        const monthStart = startOfMonth(new Date(year, month));
        const monthEnd = endOfMonth(new Date(year, month));
        const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const totalDaysInMonth = allDays.length;

        // Count week-offs for this month
        const monthWeekOffDates = allWeekOffDates.filter(date => {
          const d = new Date(date);
          return d.getMonth() === month && d.getFullYear() === year;
        });

        // Count holidays (excluding those on week-offs)
        const monthHolidays = holidayDates.filter(date => {
          const d = new Date(date);
          return d.getMonth() === month && d.getFullYear() === year && !monthWeekOffDates.includes(date);
        });

        const monthLeaves = allLeaveDates.filter(date => {
          const d = new Date(date);
          return d.getMonth() === month && d.getFullYear() === year;
        });

        const effectiveWorkingDays = totalDaysInMonth - monthWeekOffDates.length - monthHolidays.length - monthLeaves.length;

        const monthKey = `${index + 1}`; // FY month number (1-12)
        results[monthKey] = {
          totalDaysInMonth,
          weekOffs: monthWeekOffDates.length,
          holidays: monthHolidays.length,
          approvedLeaves: monthLeaves.length,
          effectiveWorkingDays: Math.max(0, effectiveWorkingDays),
          holidayDates: monthHolidays,
          leaveDates: monthLeaves,
          weekOffDates: monthWeekOffDates,
        };
      });

      return results;
    },
    enabled: !!fyYear,
  });
}
