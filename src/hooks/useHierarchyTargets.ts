import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface HierarchyTarget {
  id: string;
  root_user_id: string;
  fy_year: number;
  total_quantity_target: number;
  quantity_unit: string;
  total_revenue_target: number;
  allocation_method: 'equal' | 'percentage' | 'manual';
  status: 'draft' | 'published' | 'locked';
  created_at: string;
  updated_at: string;
  created_by: string | null;
  root_user?: {
    full_name: string;
    profile_picture_url: string | null;
  };
}

export interface HierarchyTargetAllocation {
  id: string;
  hierarchy_target_id: string;
  user_id: string;
  manager_id: string | null;
  level: number;
  allocation_percentage: number;
  quantity_target: number;
  revenue_target: number;
  effective_from: string;
  effective_to: string | null;
  allocation_method: string;
  is_synced_to_my_target: boolean;
  synced_at: string | null;
  notes: string | null;
  user?: {
    full_name: string;
    profile_picture_url: string | null;
  };
}

export interface HierarchyTargetHistory {
  id: string;
  hierarchy_target_id: string | null;
  user_id: string | null;
  change_type: string;
  previous_target: any;
  new_target: any;
  affected_users: string[] | null;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
}

interface CreateHierarchyTargetInput {
  root_user_id: string;
  fy_year: number;
  total_quantity_target: number;
  quantity_unit?: string;
  total_revenue_target: number;
  allocation_method?: 'equal' | 'percentage' | 'manual';
}

interface UpdateAllocationInput {
  id: string;
  allocation_percentage?: number;
  quantity_target?: number;
  revenue_target?: number;
  notes?: string;
}

export const useHierarchyTargets = (fyYear?: number) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all hierarchy targets for the given FY year
  const { data: hierarchyTargets = [], isLoading, error, refetch } = useQuery({
    queryKey: ['hierarchy-targets', fyYear],
    queryFn: async () => {
      let query = supabase
        .from('hierarchy_targets')
        .select(`
          *,
          root_user:profiles!hierarchy_targets_root_user_id_fkey(full_name, profile_picture_url)
        `)
        .order('created_at', { ascending: false });

      if (fyYear) {
        query = query.eq('fy_year', fyYear);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as HierarchyTarget[];
    },
    enabled: !!user,
  });

  // Create new hierarchy target
  const createMutation = useMutation({
    mutationFn: async (input: CreateHierarchyTargetInput) => {
      const { data, error } = await supabase
        .from('hierarchy_targets')
        .insert({
          ...input,
          created_by: user?.id,
          allocation_method: input.allocation_method || 'equal',
          quantity_unit: input.quantity_unit || 'Kg',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy-targets'] });
      toast.success('Hierarchy target created successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to create hierarchy target: ' + error.message);
    },
  });

  // Update hierarchy target
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<HierarchyTarget> & { id: string }) => {
      const { data, error } = await supabase
        .from('hierarchy_targets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy-targets'] });
      toast.success('Hierarchy target updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update hierarchy target: ' + error.message);
    },
  });

  // Publish hierarchy target (cascade to My Target)
  const publishMutation = useMutation({
    mutationFn: async (targetId: string) => {
      // Update status to published
      const { error: updateError } = await supabase
        .from('hierarchy_targets')
        .update({ status: 'published' })
        .eq('id', targetId);

      if (updateError) throw updateError;

      // Sync allocations to user_business_plans
      const { data: allocations, error: allocError } = await supabase
        .from('hierarchy_target_allocations')
        .select('*')
        .eq('hierarchy_target_id', targetId)
        .is('effective_to', null);

      if (allocError) throw allocError;

      // Get the hierarchy target for year and unit info
      const { data: target, error: targetError } = await supabase
        .from('hierarchy_targets')
        .select('*')
        .eq('id', targetId)
        .single();

      if (targetError) throw targetError;

      // Create/update user_business_plans for each allocation
      for (const alloc of allocations || []) {
        // Check if plan exists
        const { data: existingPlan } = await supabase
          .from('user_business_plans')
          .select('id')
          .eq('user_id', alloc.user_id)
          .eq('year', target.fy_year)
          .single();

        if (existingPlan) {
          // Update existing plan
          await supabase
            .from('user_business_plans')
            .update({
              quantity_target: alloc.quantity_target,
              revenue_target: alloc.revenue_target,
              quantity_unit: target.quantity_unit,
              source: 'hierarchy',
              hierarchy_allocation_id: alloc.id,
            })
            .eq('id', existingPlan.id);
        } else {
          // Create new plan
          await supabase
            .from('user_business_plans')
            .insert({
              user_id: alloc.user_id,
              year: target.fy_year,
              quantity_target: alloc.quantity_target,
              revenue_target: alloc.revenue_target,
              quantity_unit: target.quantity_unit,
              source: 'hierarchy',
              hierarchy_allocation_id: alloc.id,
            });
        }

        // Mark allocation as synced
        await supabase
          .from('hierarchy_target_allocations')
          .update({
            is_synced_to_my_target: true,
            synced_at: new Date().toISOString(),
          })
          .eq('id', alloc.id);
      }

      // Log the publish action
      await supabase.from('hierarchy_target_history').insert({
        hierarchy_target_id: targetId,
        change_type: 'published',
        new_target: target,
        affected_users: allocations?.map(a => a.user_id) || [],
        reason: 'Targets published and synced to My Target',
        changed_by: user?.id,
      });

      return target;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy-targets'] });
      queryClient.invalidateQueries({ queryKey: ['hierarchy-allocations'] });
      toast.success('Targets published and synced to all team members');
    },
    onError: (error: any) => {
      toast.error('Failed to publish targets: ' + error.message);
    },
  });

  // Delete hierarchy target
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('hierarchy_targets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy-targets'] });
      toast.success('Hierarchy target deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete hierarchy target: ' + error.message);
    },
  });

  return {
    hierarchyTargets,
    isLoading,
    error,
    refetch,
    createHierarchyTarget: createMutation.mutateAsync,
    updateHierarchyTarget: updateMutation.mutateAsync,
    publishHierarchyTarget: publishMutation.mutateAsync,
    deleteHierarchyTarget: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isPublishing: publishMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

export const useHierarchyTargetAllocations = (hierarchyTargetId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch allocations for a specific hierarchy target
  const { data: allocations = [], isLoading, refetch } = useQuery({
    queryKey: ['hierarchy-allocations', hierarchyTargetId],
    queryFn: async () => {
      if (!hierarchyTargetId) return [];

      const { data, error } = await supabase
        .from('hierarchy_target_allocations')
        .select(`
          *,
          user:profiles!hierarchy_target_allocations_user_id_fkey(full_name, profile_picture_url)
        `)
        .eq('hierarchy_target_id', hierarchyTargetId)
        .is('effective_to', null)
        .order('level', { ascending: true });

      if (error) throw error;
      return data as HierarchyTargetAllocation[];
    },
    enabled: !!hierarchyTargetId && !!user,
  });

  // Bulk create/update allocations
  const upsertAllocationsMutation = useMutation({
    mutationFn: async (allocations: Omit<HierarchyTargetAllocation, 'id' | 'created_at' | 'updated_at' | 'user'>[]) => {
      // Delete existing allocations for this target
      if (allocations.length > 0) {
        await supabase
          .from('hierarchy_target_allocations')
          .delete()
          .eq('hierarchy_target_id', allocations[0].hierarchy_target_id)
          .is('effective_to', null);
      }

      // Insert new allocations
      const { data, error } = await supabase
        .from('hierarchy_target_allocations')
        .insert(allocations)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy-allocations'] });
      toast.success('Allocations saved successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to save allocations: ' + error.message);
    },
  });

  // Update single allocation
  const updateAllocationMutation = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateAllocationInput) => {
      const { data, error } = await supabase
        .from('hierarchy_target_allocations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy-allocations'] });
    },
    onError: (error: any) => {
      toast.error('Failed to update allocation: ' + error.message);
    },
  });

  return {
    allocations,
    isLoading,
    refetch,
    upsertAllocations: upsertAllocationsMutation.mutateAsync,
    updateAllocation: updateAllocationMutation.mutateAsync,
    isSaving: upsertAllocationsMutation.isPending,
    isUpdating: updateAllocationMutation.isPending,
  };
};

export const useHierarchyTargetHistory = (hierarchyTargetId?: string) => {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['hierarchy-history', hierarchyTargetId],
    queryFn: async () => {
      if (!hierarchyTargetId) return [];

      const { data, error } = await supabase
        .from('hierarchy_target_history')
        .select('*')
        .eq('hierarchy_target_id', hierarchyTargetId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as HierarchyTargetHistory[];
    },
    enabled: !!hierarchyTargetId,
  });

  return { history, isLoading };
};
