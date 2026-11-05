import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AISchemeSuggestion {
  id: string;
  suggested_name: string;
  suggested_description: string | null;
  suggested_scheme_type: string;
  suggested_discount_percentage: number;
  suggested_discount_amount: number;
  suggested_buy_quantity: number;
  suggested_free_quantity: number;
  suggested_condition_quantity: number;
  suggested_min_order_value: number;
  suggested_tier_data: any;
  suggested_start_date: string | null;
  suggested_end_date: string | null;
  suggested_product_id: string | null;
  suggested_category_id: string | null;
  analysis_type: string;
  target_type: string;
  target_ids: string[];
  target_names: string[];
  reasoning: string;
  data_signals: any;
  confidence_score: number;
  expected_benefit: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  admin_modifications: any;
  created_scheme_id: string | null;
  created_at: string;
  expires_at: string | null;
}

export const useAISchemeSuggestions = () => {
  const queryClient = useQueryClient();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch pending suggestions
  const { data: suggestions = [], isLoading, refetch } = useQuery({
    queryKey: ['ai-scheme-suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_scheme_suggestions')
        .select('*')
        .eq('status', 'pending')
        .order('confidence_score', { ascending: false });

      if (error) throw error;
      return (data || []) as AISchemeSuggestion[];
    }
  });

  // Fetch all suggestions (including approved/rejected)
  const { data: allSuggestions = [] } = useQuery({
    queryKey: ['ai-scheme-suggestions-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_scheme_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as AISchemeSuggestion[];
    }
  });

  // Trigger AI analysis
  const triggerAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-scheme-engine', {
        body: { mode: 'analyze' }
      });

      if (error) throw error;

      toast.success(`Generated ${data.suggestions_generated} scheme suggestions`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['ai-scheme-suggestions-all'] });
    } catch (error: any) {
      console.error('AI analysis failed:', error);
      toast.error('Failed to analyze. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [refetch, queryClient]);

  // Approve suggestion
  const approveMutation = useMutation({
    mutationFn: async ({ 
      suggestion, 
      modifications 
    }: { 
      suggestion: AISchemeSuggestion; 
      modifications?: Partial<AISchemeSuggestion>;
    }) => {
      const finalData = modifications ? { ...suggestion, ...modifications } : suggestion;

      // Create the scheme
      const { data: newScheme, error: schemeError } = await supabase
        .from('product_schemes')
        .insert({
          name: finalData.suggested_name,
          description: finalData.suggested_description || '',
          scheme_type: finalData.suggested_scheme_type,
          discount_percentage: finalData.suggested_discount_percentage || 0,
          discount_amount: finalData.suggested_discount_amount || 0,
          buy_quantity: finalData.suggested_buy_quantity || 0,
          free_quantity: finalData.suggested_free_quantity || 0,
          condition_quantity: finalData.suggested_condition_quantity || 0,
          min_order_value: finalData.suggested_min_order_value || 0,
          tier_data: finalData.suggested_tier_data || [],
          start_date: finalData.suggested_start_date,
          end_date: finalData.suggested_end_date,
          product_id: finalData.suggested_product_id,
          category_id: finalData.suggested_category_id,
          is_active: true,
          source: 'ai_suggested',
          ai_suggestion_id: suggestion.id,
          applicability_type: finalData.target_type === 'global' ? 'global' : 'targeted'
        })
        .select('id')
        .single();

      if (schemeError) throw schemeError;

      // If targeted, create applicability rules
      if (finalData.target_type !== 'global' && finalData.target_ids?.length > 0) {
        const applicabilityRules = finalData.target_ids.map((entityId, idx) => ({
          scheme_id: newScheme.id,
          applicability_level: finalData.target_type,
          entity_id: entityId,
          entity_name: finalData.target_names?.[idx] || '',
          include_children: true
        }));

        await supabase.from('scheme_applicability').insert(applicabilityRules);
      }

      // Update suggestion status
      const { error: updateError } = await supabase
        .from('ai_scheme_suggestions')
        .update({
          status: modifications ? 'modified' : 'approved',
          reviewed_at: new Date().toISOString(),
          created_scheme_id: newScheme.id,
          admin_modifications: modifications || null
        })
        .eq('id', suggestion.id);

      if (updateError) throw updateError;

      return newScheme;
    },
    onSuccess: () => {
      toast.success('Scheme created and activated!');
      queryClient.invalidateQueries({ queryKey: ['ai-scheme-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['ai-scheme-suggestions-all'] });
      queryClient.invalidateQueries({ queryKey: ['schemes'] });
    },
    onError: (error: any) => {
      console.error('Approval failed:', error);
      toast.error('Failed to approve scheme');
    }
  });

  // Reject suggestion
  const rejectMutation = useMutation({
    mutationFn: async ({ suggestionId, reason }: { suggestionId: string; reason: string }) => {
      const { error } = await supabase
        .from('ai_scheme_suggestions')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', suggestionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Suggestion rejected');
      queryClient.invalidateQueries({ queryKey: ['ai-scheme-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['ai-scheme-suggestions-all'] });
    },
    onError: (error: any) => {
      console.error('Rejection failed:', error);
      toast.error('Failed to reject suggestion');
    }
  });

  return {
    suggestions,
    allSuggestions,
    isLoading,
    isAnalyzing,
    triggerAnalysis,
    approveSuggestion: approveMutation.mutate,
    rejectSuggestion: rejectMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    refetch
  };
};
