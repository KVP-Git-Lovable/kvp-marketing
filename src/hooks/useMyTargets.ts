import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";

export type PeriodType = 'day' | 'month' | 'quarter' | 'year';

export const useMyTargets = (periodType: PeriodType, date: Date = new Date(), userId?: string) => {
  const { data: targets, isLoading: targetsLoading } = useQuery({
    queryKey: ['my-targets', periodType, date, userId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Use provided userId or fall back to current user
      const targetUserId = userId || user.id;

      let periodStart: Date;
      let periodEnd: Date;

      switch (periodType) {
        case 'day':
          periodStart = new Date(date);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(date);
          periodEnd.setHours(23, 59, 59, 999);
          break;
        case 'month':
          periodStart = startOfMonth(date);
          periodEnd = endOfMonth(date);
          break;
        case 'quarter':
          periodStart = startOfQuarter(date);
          periodEnd = endOfQuarter(date);
          break;
        case 'year':
          periodStart = startOfYear(date);
          periodEnd = endOfYear(date);
          break;
      }

      const { data, error } = await supabase
        .from('user_period_targets')
        .select(`
          *,
          kpi:target_kpi_definitions(*)
        `)
        .eq('user_id', targetUserId)
        .eq('period_type', periodType)
        .gte('period_start', periodStart.toISOString().split('T')[0])
        .lte('period_end', periodEnd.toISOString().split('T')[0])
        .order('kpi(display_order)');

      if (error) throw error;
      return data;
    },
  });

  const { data: performanceScore, isLoading: scoreLoading } = useQuery({
    queryKey: ['my-performance-score', periodType, date, userId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Use provided userId or fall back to current user
      const targetUserId = userId || user.id;

      let periodStart: Date;
      let periodEnd: Date;

      switch (periodType) {
        case 'month':
          periodStart = startOfMonth(date);
          periodEnd = endOfMonth(date);
          break;
        case 'quarter':
          periodStart = startOfQuarter(date);
          periodEnd = endOfQuarter(date);
          break;
        case 'year':
          periodStart = startOfYear(date);
          periodEnd = endOfYear(date);
          break;
      }

      const { data, error } = await supabase
        .from('user_performance_scores')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('period_type', periodType)
        .gte('period_start', periodStart.toISOString().split('T')[0])
        .lte('period_end', periodEnd.toISOString().split('T')[0])
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  return {
    targets,
    performanceScore,
    isLoading: targetsLoading || scoreLoading,
  };
};
