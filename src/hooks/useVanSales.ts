import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useVanSales = () => {
  const { data, isLoading: loading } = useQuery({
    queryKey: ['feature-flag', 'van_sales'],
    queryFn: async () => {
      // Check feature_flags table for van_sales feature
      const { data, error } = await supabase
        .from('feature_flags')
        .select('is_enabled')
        .eq('feature_key', 'van_sales')
        .maybeSingle();
      
      if (error) {
        console.error('Error loading van sales settings:', error);
        // Fallback to van_sales_settings table for backward compatibility
        const { data: legacyData } = await supabase
          .from('van_sales_settings')
          .select('is_enabled')
          .maybeSingle();
        
        return legacyData?.is_enabled ?? false;
      }
      return data?.is_enabled ?? false;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { isVanSalesEnabled: data ?? false, loading };
};
