import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PeriodType } from '@/components/admin/target-config/PeriodTypeSelector';
import type { PeriodTarget } from '@/components/admin/target-config/PeriodBreakdownGrid';

interface UseTargetPeriodsParams {
  fyConfigId: string | undefined;
}

export function useTargetPeriods({ fyConfigId }: UseTargetPeriodsParams) {
  const queryClient = useQueryClient();

  // Fetch period targets for a config
  const { data: periods = [], isLoading } = useQuery({
    queryKey: ['fy-period-targets', fyConfigId],
    queryFn: async (): Promise<PeriodTarget[]> => {
      if (!fyConfigId) return [];

      const { data, error } = await supabase
        .from('fy_period_targets')
        .select('*')
        .eq('fy_config_id', fyConfigId)
        .order('period_number');

      if (error) throw error;

      return (data || []).map((row: any) => ({
        periodType: row.period_type as 'biannual' | 'quarterly' | 'monthly',
        periodNumber: row.period_number,
        periodName: row.period_name,
        quantityTarget: row.quantity_target || 0,
        revenueTarget: row.revenue_target || 0,
        visitsTarget: row.visits_target || 0,
      }));
    },
    enabled: !!fyConfigId,
  });

  // Save periods mutation
  const savePeriodsMutation = useMutation({
    mutationFn: async ({ 
      configId, 
      periodType, 
      periods 
    }: { 
      configId: string; 
      periodType: PeriodType; 
      periods: PeriodTarget[] 
    }) => {
      if (periodType === 'annual') {
        // Delete any existing period targets
        const { error: deleteError } = await supabase
          .from('fy_period_targets')
          .delete()
          .eq('fy_config_id', configId);
        
        if (deleteError) throw deleteError;
        return;
      }

      // Upsert periods
      const periodsToSave = periods.map(p => ({
        fy_config_id: configId,
        period_type: p.periodType,
        period_number: p.periodNumber,
        period_name: p.periodName,
        quantity_target: p.quantityTarget,
        revenue_target: p.revenueTarget,
        visits_target: p.visitsTarget,
      }));

      // First delete existing periods for this config
      const { error: deleteError } = await supabase
        .from('fy_period_targets')
        .delete()
        .eq('fy_config_id', configId);

      if (deleteError) throw deleteError;

      // Then insert new periods
      if (periodsToSave.length > 0) {
        const { error: insertError } = await supabase
          .from('fy_period_targets')
          .insert(periodsToSave);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fy-period-targets', fyConfigId] });
    },
    onError: (error: Error) => {
      toast.error('Failed to save period targets: ' + error.message);
    },
  });

  // Calculate rollup totals
  const calculateRollups = (periods: PeriodTarget[], periodType: PeriodType) => {
    if (periodType === 'annual') {
      return { quantity: 0, revenue: 0, visits: 0 };
    }

    const quantity = periods.reduce((sum, p) => sum + (p.quantityTarget || 0), 0);
    const revenue = periods.reduce((sum, p) => sum + (p.revenueTarget || 0), 0);
    const visits = periods.reduce((sum, p) => sum + (p.visitsTarget || 0), 0);

    return { quantity, revenue, visits };
  };

  // Apply equal distribution from FY totals
  const applyEqualDistribution = (
    periodType: PeriodType,
    totalQuantity: number,
    totalRevenue: number,
    totalVisits: number
  ): PeriodTarget[] => {
    const dividers: Record<PeriodType, number> = {
      annual: 1,
      biannual: 2,
      quarterly: 4,
      monthly: 12,
    };

    const divider = dividers[periodType];
    
    if (periodType === 'biannual') {
      return [
        { periodType: 'biannual', periodNumber: 1, periodName: 'H1 (Apr-Sep)', quantityTarget: totalQuantity / divider, revenueTarget: totalRevenue / divider, visitsTarget: Math.round(totalVisits / divider) },
        { periodType: 'biannual', periodNumber: 2, periodName: 'H2 (Oct-Mar)', quantityTarget: totalQuantity / divider, revenueTarget: totalRevenue / divider, visitsTarget: Math.round(totalVisits / divider) },
      ];
    }
    
    if (periodType === 'quarterly') {
      return [
        { periodType: 'quarterly', periodNumber: 1, periodName: 'Q1 (Apr-Jun)', quantityTarget: totalQuantity / divider, revenueTarget: totalRevenue / divider, visitsTarget: Math.round(totalVisits / divider) },
        { periodType: 'quarterly', periodNumber: 2, periodName: 'Q2 (Jul-Sep)', quantityTarget: totalQuantity / divider, revenueTarget: totalRevenue / divider, visitsTarget: Math.round(totalVisits / divider) },
        { periodType: 'quarterly', periodNumber: 3, periodName: 'Q3 (Oct-Dec)', quantityTarget: totalQuantity / divider, revenueTarget: totalRevenue / divider, visitsTarget: Math.round(totalVisits / divider) },
        { periodType: 'quarterly', periodNumber: 4, periodName: 'Q4 (Jan-Mar)', quantityTarget: totalQuantity / divider, revenueTarget: totalRevenue / divider, visitsTarget: Math.round(totalVisits / divider) },
      ];
    }
    
    // Monthly
    const monthNames = [
      'April', 'May', 'June', 'July', 'August', 'September',
      'October', 'November', 'December', 'January', 'February', 'March'
    ];
    
    return monthNames.map((name, idx) => ({
      periodType: 'monthly' as const,
      periodNumber: idx + 1,
      periodName: name,
      quantityTarget: totalQuantity / divider,
      revenueTarget: totalRevenue / divider,
      visitsTarget: Math.round(totalVisits / divider),
    }));
  };

  return {
    periods,
    isLoading,
    savePeriods: savePeriodsMutation.mutateAsync,
    isSaving: savePeriodsMutation.isPending,
    calculateRollups,
    applyEqualDistribution,
  };
}
