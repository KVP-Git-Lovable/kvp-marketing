import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PlanStatus = 'draft' | 'active' | 'closed';

export interface FYTargetPlan {
  id: string;
  fy_year: number;
  target_plan_name: string | null;
  plan_status: PlanStatus;
  enable_quantity: boolean;
  enable_revenue: boolean;
  enable_visits: boolean;
  enable_retailer_activation: boolean;
  quantity_unit: string | null;
  total_quantity_target: number | null;
  total_revenue_target: number | null;
  total_visits_target: number | null;
  total_retailer_activation_target: number | null;
  setup_completed: boolean;
  is_locked: boolean;
  created_at: string;
}

export const useFYTargetPlans = (fyYear: number) => {
  return useQuery({
    queryKey: ['fy-target-plans', fyYear],
    queryFn: async (): Promise<FYTargetPlan[]> => {
      const { data, error } = await supabase
        .from('fy_target_config')
        .select('*')
        .eq('fy_year', fyYear)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching FY target plans:', error);
        return [];
      }

      return (data || []).map(d => ({
        ...d,
        plan_status: (d as any).plan_status || 'draft',
      })) as FYTargetPlan[];
    },
    staleTime: 5 * 60 * 1000,
  });
};
