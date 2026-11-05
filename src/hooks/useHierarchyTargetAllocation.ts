import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserHierarchyAllocation {
  id: string;
  hierarchy_target_id: string;
  user_id: string;
  quantity_target: number;
  revenue_target: number;
  allocation_percentage: number;
  effective_from: string;
  effective_to: string | null;
  is_synced_to_my_target: boolean;
  synced_at: string | null;
  hierarchy_target: {
    fy_year: number;
    quantity_unit: string;
    status: string;
    root_user_id: string;
  };
}

/**
 * Hook to fetch a user's hierarchy-based target allocation for a specific FY
 * Used in My Target to show targets set via hierarchy cascade
 */
export const useHierarchyTargetAllocation = (userId?: string, fyYear?: number) => {
  const { user } = useAuth();
  const effectiveUserId = userId || user?.id;

  const { data: allocation, isLoading, error } = useQuery({
    queryKey: ['user-hierarchy-allocation', effectiveUserId, fyYear],
    queryFn: async () => {
      if (!effectiveUserId || !fyYear) return null;

      const { data, error } = await supabase
        .from('hierarchy_target_allocations')
        .select(`
          *,
          hierarchy_target:hierarchy_targets!hierarchy_target_allocations_hierarchy_target_id_fkey(
            fy_year,
            quantity_unit,
            status,
            root_user_id
          )
        `)
        .eq('user_id', effectiveUserId)
        .is('effective_to', null)
        .single();

      if (error) {
        // PGRST116 means no rows found, which is ok
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      // Filter by FY year
      if (data?.hierarchy_target?.fy_year !== fyYear) {
        return null;
      }

      return data as UserHierarchyAllocation;
    },
    enabled: !!effectiveUserId && !!fyYear,
  });

  return {
    allocation,
    isLoading,
    error,
    hasHierarchyTarget: !!allocation && allocation.hierarchy_target?.status === 'published',
    source: allocation ? 'hierarchy' : 'manual',
  };
};

/**
 * Hook to check if a user's FY target comes from hierarchy
 */
export const useTargetSource = (userId?: string, fyYear?: number) => {
  const { allocation, isLoading, hasHierarchyTarget } = useHierarchyTargetAllocation(userId, fyYear);

  return {
    isLoading,
    source: hasHierarchyTarget ? 'hierarchy' : 'manual',
    hierarchyAllocation: allocation,
    canEditManually: !hasHierarchyTarget, // Can only edit if not from hierarchy
  };
};
