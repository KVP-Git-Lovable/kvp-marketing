import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { filterActiveSubordinateRows } from '@/lib/activeUserFilter';

export interface Subordinate {
  subordinate_user_id: string;
  level: number;
  full_name: string;
}

interface UseSubordinatesReturn {
  subordinates: Subordinate[];
  subordinateIds: string[];
  directReportIds: string[];
  isManager: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export const useSubordinates = (): UseSubordinatesReturn => {
  const { user } = useAuth();

  const {
    data: subordinates = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['subordinates', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase.rpc('get_all_subordinates', {
        manager_user_id: user.id,
      });

      if (error) {
        console.error('Error fetching subordinates:', error);
        throw error;
      }

      // Hide inactive users from downstream "assign new work" pickers. This RPC is
      // also used inside RLS/report scoping elsewhere, so we filter here at the
      // consumption layer rather than in the RPC itself.
      return filterActiveSubordinateRows((data || []) as Subordinate[]);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  // Filter out self (level 0) to get actual subordinates
  const actualSubordinates = useMemo(
    () => subordinates.filter((s) => s.level > 0),
    [subordinates]
  );
  
  // Get all subordinate IDs (excluding self)
  const subordinateIds = useMemo(
    () => actualSubordinates.map((s) => s.subordinate_user_id),
    [actualSubordinates]
  );
  
  // Get direct report IDs only (level 1) - used for approvals
  const directReportIds = useMemo(
    () => subordinates.filter((s) => s.level === 1).map((s) => s.subordinate_user_id),
    [subordinates]
  );
  
  // User is a manager if they have at least one subordinate
  const isManager = actualSubordinates.length > 0;

  return {
    subordinates: actualSubordinates,
    subordinateIds,
    directReportIds,
    isManager,
    isLoading,
    error: error as Error | null,
    refetch,
  };
};

// Hook to get all user IDs a user can view (self + subordinates)
export const useViewableUserIds = (): {
  viewableUserIds: string[];
  isManager: boolean;
  isLoading: boolean;
} => {
  const { user } = useAuth();
  const { subordinateIds, isManager, isLoading } = useSubordinates();

  const viewableUserIds = user?.id
    ? [user.id, ...subordinateIds]
    : [];

  return {
    viewableUserIds,
    isManager,
    isLoading,
  };
};
