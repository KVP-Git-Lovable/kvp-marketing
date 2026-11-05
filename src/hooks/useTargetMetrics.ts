import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TargetMetricDefinition {
  id: string;
  name: string;
  unit: string;
  icon: string;
  color: string;
  is_system: boolean;
  display_order: number;
}

export interface PlanEnabledMetric {
  id: string;
  fy_config_id: string;
  metric_id: string;
  total_target: number;
  unit_override: string | null;
}

/** Fetch all metric definitions */
export const useMetricDefinitions = () => {
  return useQuery({
    queryKey: ['target-metric-definitions'],
    queryFn: async (): Promise<TargetMetricDefinition[]> => {
      const { data, error } = await supabase
        .from('target_metric_definitions')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) {
        console.error('Error fetching metric definitions:', error);
        return [];
      }
      return (data ?? []) as TargetMetricDefinition[];
    },
    staleTime: 10 * 60 * 1000,
  });
};

/** Fetch enabled metrics for a specific plan */
export const usePlanEnabledMetrics = (fyConfigId?: string) => {
  return useQuery({
    queryKey: ['plan-enabled-metrics', fyConfigId],
    queryFn: async (): Promise<PlanEnabledMetric[]> => {
      if (!fyConfigId) return [];
      const { data, error } = await supabase
        .from('plan_enabled_metrics')
        .select('*')
        .eq('fy_config_id', fyConfigId);
      if (error) {
        console.error('Error fetching plan enabled metrics:', error);
        return [];
      }
      return (data ?? []) as PlanEnabledMetric[];
    },
    enabled: !!fyConfigId,
    staleTime: 5 * 60 * 1000,
  });
};

/** Save enabled metrics for a plan (upsert) */
export const useSavePlanMetrics = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fyConfigId,
      metrics,
    }: {
      fyConfigId: string;
      metrics: { metric_id: string; total_target: number; unit_override?: string | null }[];
    }) => {
      // Delete existing metrics for this plan
      await supabase
        .from('plan_enabled_metrics')
        .delete()
        .eq('fy_config_id', fyConfigId);

      // Insert new ones
      if (metrics.length > 0) {
        const rows = metrics.map(m => ({
          fy_config_id: fyConfigId,
          metric_id: m.metric_id,
          total_target: m.total_target,
          unit_override: m.unit_override ?? null,
        }));
        const { error } = await supabase
          .from('plan_enabled_metrics')
          .insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-enabled-metrics'] });
    },
  });
};

/** Create a custom metric definition */
export const useCreateMetricDefinition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (metric: { name: string; unit: string; icon: string; color: string }) => {
      // Get max display_order
      const { data: existing } = await supabase
        .from('target_metric_definitions')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = (existing?.display_order ?? 0) + 1;

      const { data, error } = await supabase
        .from('target_metric_definitions')
        .insert({
          name: metric.name,
          unit: metric.unit,
          icon: metric.icon,
          color: metric.color,
          is_system: false,
          display_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TargetMetricDefinition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target-metric-definitions'] });
    },
  });
};

/** Delete a custom metric definition */
export const useDeleteMetricDefinition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (metricId: string) => {
      const { error } = await supabase
        .from('target_metric_definitions')
        .delete()
        .eq('id', metricId)
        .eq('is_system', false); // Safety: only delete custom metrics
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target-metric-definitions'] });
    },
  });
};
