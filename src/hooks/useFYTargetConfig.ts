import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PlanStatus = 'draft' | 'active' | 'closed';

export interface EnabledParameters {
  product?: boolean;
  retailer?: boolean;
  beat?: boolean;
  distributor?: boolean;
  territory?: boolean;
  monthly?: boolean;
}

export interface FYTargetConfig {
  id: string;
  fy_year: number;
  enable_quantity: boolean;
  enable_revenue: boolean;
  enable_visits: boolean;
  enable_retailer_activation: boolean;
  quantity_unit: string | null;
  enabled_parameters: EnabledParameters | null;
  total_quantity_target: number | null;
  total_revenue_target: number | null;
  total_visits_target: number | null;
  total_retailer_activation_target: number | null;
  setup_completed: boolean;
  target_plan_name: string | null;
  is_locked: boolean;
  plan_status: PlanStatus;
  target_start_month: number;
  target_end_month: number;
}

/** Fetch a specific plan by ID, or the first plan for an FY year */
export const useFYTargetConfig = (fyYear: number, planId?: string) => {
  return useQuery({
    queryKey: ['fy-target-config', fyYear, planId],
    queryFn: async (): Promise<FYTargetConfig | null> => {
      let query = supabase.from('fy_target_config').select('*');

      if (planId) {
        query = query.eq('id', planId);
      } else {
        query = query.eq('fy_year', fyYear);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        // If multiple rows returned (no planId + multiple plans), fetch first one
        if (error.code === 'PGRST116') {
          const { data: firstPlan } = await supabase
            .from('fy_target_config')
            .select('*')
            .eq('fy_year', fyYear)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (!firstPlan) return null;
          return {
            ...firstPlan,
            enabled_parameters: firstPlan.enabled_parameters as EnabledParameters | null,
            plan_status: ((firstPlan as any).plan_status || 'draft') as PlanStatus,
          };
        }
        console.error('Error fetching FY target config:', error);
        return null;
      }

      return data ? {
        ...data,
        enabled_parameters: data.enabled_parameters as EnabledParameters | null,
        plan_status: ((data as any).plan_status || 'draft') as PlanStatus,
      } : null;
    },
    staleTime: 5 * 60 * 1000,
  });
};
