import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subMonths, startOfMonth } from "date-fns";

export interface CompetencyTemplate {
  id: string;
  role_type: string;
  competency_name: string;
  competency_code: string;
  description: string | null;
  category: string;
  weightage: number;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  max_score: number | null;
  calculation_formula: Record<string, any>;
}

export interface CompetencyScore {
  id: string;
  user_id: string;
  competency_template_id: string;
  month_year: string;
  score: number;
  raw_metrics: Record<string, any>;
  previous_month_score: number | null;
  trend: 'improving' | 'declining' | 'stable' | 'new';
  competency_templates?: CompetencyTemplate;
}

export interface MonthlyScorecard {
  id: string;
  user_id: string;
  month_year: string;
  role_type: string;
  overall_score: number;
  weighted_score: number | null;
  performance_band: 'exceptional' | 'strong' | 'developing' | 'needs_improvement';
  rank_in_team: number | null;
  total_team_members: number | null;
  ai_summary: string | null;
  ai_strengths: Array<{
    competency: string;
    insight: string;
    keepDoing: string;
  }>;
  ai_improvement_areas: Array<{
    competency: string;
    currentScore: number;
    targetScore: number;
    specificActions: string[];
    timeline: string;
  }>;
  ai_action_plan: {
    weeklyFocus?: {
      week1: string;
      week2: string;
      week3: string;
      week4: string;
    };
    motivationalNote?: string;
  } | null;
  is_published: boolean;
  published_at: string | null;
}

export function useCompetencyTemplates(roleType: 'field_executive' | 'field_manager' = 'field_executive') {
  return useQuery({
    queryKey: ['competency-templates', roleType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competency_templates')
        .select('*')
        .eq('role_type', roleType)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data as CompetencyTemplate[];
    },
  });
}

export function useCompetencyScores(monthYear?: string, userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;
  const targetMonth = monthYear || format(startOfMonth(new Date()), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['competency-scores', targetUserId, targetMonth],
    queryFn: async () => {
      if (!targetUserId) return [];

      const { data, error } = await supabase
        .from('user_competency_monthly_scores')
        .select(`
          *,
          competency_templates (
            id,
            competency_name,
            competency_code,
            description,
            category,
            weightage,
            icon,
            sort_order
          )
        `)
        .eq('user_id', targetUserId)
        .eq('month_year', targetMonth)
        .order('competency_templates(sort_order)');

      if (error) throw error;
      return (data || []) as unknown as CompetencyScore[];
    },
    enabled: !!targetUserId,
  });
}

export function useMonthlyScorecard(monthYear?: string, userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;
  const targetMonth = monthYear || format(startOfMonth(new Date()), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['monthly-scorecard', targetUserId, targetMonth],
    queryFn: async () => {
      if (!targetUserId) return null;

      const { data, error } = await supabase
        .from('user_monthly_scorecards')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('month_year', targetMonth)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as MonthlyScorecard | null;
    },
    enabled: !!targetUserId,
  });
}

export function useCompetencyHistory(userId?: string, months: number = 6) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ['competency-history', targetUserId, months],
    queryFn: async () => {
      if (!targetUserId) return [];

      const startDate = format(startOfMonth(subMonths(new Date(), months)), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('user_monthly_scorecards')
        .select('*')
        .eq('user_id', targetUserId)
        .gte('month_year', startDate)
        .order('month_year', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as MonthlyScorecard[];
    },
    enabled: !!targetUserId,
  });
}

export function useCalculateCompetencyScores() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, monthYear, roleType = 'field_executive' }: {
      userId: string;
      monthYear: string;
      roleType?: 'field_executive' | 'field_manager';
    }) => {
      const { data, error } = await supabase.functions.invoke('calculate-competency-scores', {
        body: { userId, monthYear, roleType },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['competency-scores', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['monthly-scorecard', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['competency-history', variables.userId] });
    },
  });
}

export function useGenerateCompetencyInsights() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, monthYear }: { userId: string; monthYear: string }) => {
      const { data, error } = await supabase.functions.invoke('generate-competency-insights', {
        body: { userId, monthYear },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['monthly-scorecard', variables.userId] });
    },
  });
}
