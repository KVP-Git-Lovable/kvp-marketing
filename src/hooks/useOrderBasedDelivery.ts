import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to check if Order-Based Delivery feature is enabled
 * This is independent from Van Sales - both can be enabled/disabled separately
 * 
 * When Order-Based Delivery is ON:
 * - Order Entry shows "Place Order for Next Day" option
 * - Cart shows simplified COD/Pay Now payment options
 * - Orders go to Packing List flow
 * - Delivery agents collect payment at delivery
 */
export function useOrderBasedDelivery() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFeature = async () => {
      try {
        const { data, error } = await supabase
          .from('feature_flags')
          .select('is_enabled')
          .eq('feature_key', 'order_based_delivery')
          .maybeSingle();

        if (!error && data) {
          setIsEnabled(data.is_enabled);
        }
      } catch (error) {
        console.error('Error checking order-based delivery feature:', error);
      } finally {
        setLoading(false);
      }
    };

    checkFeature();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('order_based_delivery_feature')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'feature_flags',
          filter: 'feature_key=eq.order_based_delivery'
        },
        (payload) => {
          setIsEnabled(payload.new.is_enabled);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { isEnabled, loading };
}
