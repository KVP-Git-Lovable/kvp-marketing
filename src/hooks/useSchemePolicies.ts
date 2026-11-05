import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SchemePolicies {
  maxSchemesPerOrder: number;
  allowSchemeStacking: boolean;
  sameTypeStacking: boolean;
  priorityResolution: 'highest_discount' | 'most_specific' | 'priority' | 'first_applied';
  autoApplyBestScheme: boolean;
}

const DEFAULT_POLICIES: SchemePolicies = {
  maxSchemesPerOrder: 5,
  allowSchemeStacking: true,
  sameTypeStacking: false,
  priorityResolution: 'highest_discount',
  autoApplyBestScheme: true
};

/**
 * Hook to fetch and cache scheme policy settings from the database
 * Used by order entry components to enforce policy rules
 */
export function useSchemePolicies() {
  const [policies, setPolicies] = useState<SchemePolicies>(DEFAULT_POLICIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        const { data, error } = await supabase
          .from('scheme_policy_config')
          .select('policy_name, policy_value')
          .eq('is_active', true);

        if (error) {
          console.error('[useSchemePolicies] Error fetching policies:', error);
          setLoading(false);
          return;
        }

        if (data && data.length > 0) {
          const policyMap = data.reduce((acc, p) => {
            acc[p.policy_name] = p.policy_value;
            return acc;
          }, {} as Record<string, any>);

          setPolicies({
            maxSchemesPerOrder: policyMap.max_schemes_per_order?.value ?? 5,
            allowSchemeStacking: policyMap.allow_scheme_stacking?.value ?? true,
            sameTypeStacking: policyMap.allow_scheme_stacking?.same_type_stacking ?? false,
            priorityResolution: policyMap.priority_resolution?.method ?? 'highest_discount',
            autoApplyBestScheme: policyMap.auto_apply_best_scheme?.value ?? true
          });

          console.log('[useSchemePolicies] Loaded policies:', {
            max: policyMap.max_schemes_per_order?.value,
            stacking: policyMap.allow_scheme_stacking?.value,
            autoApply: policyMap.auto_apply_best_scheme?.value
          });
        }
      } catch (error) {
        console.error('[useSchemePolicies] Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPolicies();
  }, []);

  return { policies, loading };
}
