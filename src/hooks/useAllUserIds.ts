import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { filterActiveUserIds } from '@/lib/activeUserFilter';

export const useAllUserIds = () => {
  const { hasAdminAccess } = useAdminAccess();

  const query = useQuery({
    queryKey: ['all-user-ids-for-targets'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_limited_profiles_for_admin');
      if (error) throw error;
      const ids = (data || []).map((p: { id: string }) => p.id);
      // Hide inactive users so downstream "assign new work" consumers (e.g.
      // TargetVsActual) don't offer departed reps as pickable.
      return filterActiveUserIds(ids);
    },
    enabled: hasAdminAccess,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    allUserIds: query.data || [],
    isLoading: query.isLoading,
    hasAdminAccess,
  };
};
