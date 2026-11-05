import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TargetParameterDefinition {
  id: string;
  name: string;
  parameter_key: string;
  icon: string;
  data_source_table: string | null;
  data_source_id_column: string | null;
  data_source_name_column: string | null;
  data_source_filter: Record<string, unknown> | null;
  is_system: boolean;
  display_order: number;
  created_at: string;
}

/** Fetch all parameter definitions */
export const useParameterDefinitions = () => {
  return useQuery({
    queryKey: ['target-parameter-definitions'],
    queryFn: async (): Promise<TargetParameterDefinition[]> => {
      const { data, error } = await (supabase as any)
        .from('target_parameter_definitions')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) {
        console.error('Error fetching parameter definitions:', error);
        return [];
      }
      return (data ?? []) as TargetParameterDefinition[];
    },
    staleTime: 10 * 60 * 1000,
  });
};

/** Create a custom parameter definition */
export const useCreateParameterDefinition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (param: {
      name: string;
      parameter_key: string;
      icon: string;
      data_source_table: string;
      data_source_id_column: string;
      data_source_name_column: string;
      data_source_filter?: Record<string, unknown> | null;
    }) => {
      // Get max display_order
      const { data: existing } = await (supabase as any)
        .from('target_parameter_definitions')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = (existing?.display_order ?? 0) + 1;

      const { data, error } = await (supabase as any)
        .from('target_parameter_definitions')
        .insert({
          name: param.name,
          parameter_key: param.parameter_key,
          icon: param.icon,
          data_source_table: param.data_source_table,
          data_source_id_column: param.data_source_id_column,
          data_source_name_column: param.data_source_name_column,
          data_source_filter: param.data_source_filter ?? null,
          is_system: false,
          display_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TargetParameterDefinition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target-parameter-definitions'] });
    },
  });
};

/** Delete a custom parameter definition */
export const useDeleteParameterDefinition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paramId: string) => {
      const { error } = await (supabase as any)
        .from('target_parameter_definitions')
        .delete()
        .eq('id', paramId)
        .eq('is_system', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target-parameter-definitions'] });
    },
  });
};
