import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";

export type PeriodType = 'day' | 'month' | 'quarter' | 'year';

export const useTeamTargets = (periodType: PeriodType, date: Date = new Date()) => {
  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ['team-targets', periodType, date],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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

      // Get subordinate user IDs
      const { data: subordinates } = await supabase.rpc('get_subordinate_users', {
        user_id_param: user.id
      });

      const subordinateIds = subordinates?.map((s: any) => s.subordinate_user_id) || [];

      // Get performance scores for team members
      const { data: scores, error } = await supabase
        .from('user_performance_scores')
        .select('*')
        .in('user_id', subordinateIds)
        .eq('period_type', periodType)
        .gte('period_start', periodStart.toISOString().split('T')[0])
        .lte('period_end', periodEnd.toISOString().split('T')[0]);

      if (error) throw error;
      
      // Get user profiles separately
      if (scores && scores.length > 0) {
        const userIds = scores.map(s => s.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, profile_picture_url')
          .in('id', userIds);
        
        return scores.map(score => ({
          ...score,
          user: profiles?.find(p => p.id === score.user_id)
        }));
      }
      
      return scores;
    },
  });

  return {
    teamMembers,
    isLoading,
  };
};
