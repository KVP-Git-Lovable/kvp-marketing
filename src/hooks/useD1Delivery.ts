import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to check if D-1 Delivery feature is enabled
 */
export function useD1Delivery() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFeature = async () => {
      try {
        const { data, error } = await supabase
          .from('feature_flags')
          .select('is_enabled')
          .eq('feature_key', 'd1_delivery')
          .maybeSingle();

        if (!error && data) {
          setIsEnabled(data.is_enabled);
        }
      } catch (error) {
        console.error('Error checking D-1 delivery feature:', error);
      } finally {
        setLoading(false);
      }
    };

    checkFeature();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('d1_delivery_feature')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'feature_flags',
          filter: 'feature_key=eq.d1_delivery'
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

/**
 * Hook to check if Packing List Module is enabled
 */
export function usePackingListModule() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFeature = async () => {
      try {
        const { data, error } = await supabase
          .from('feature_flags')
          .select('is_enabled')
          .eq('feature_key', 'packing_list_module')
          .maybeSingle();

        if (!error && data) {
          setIsEnabled(data.is_enabled);
        }
      } catch (error) {
        console.error('Error checking packing list module feature:', error);
      } finally {
        setLoading(false);
      }
    };

    checkFeature();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('packing_list_module_feature')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'feature_flags',
          filter: 'feature_key=eq.packing_list_module'
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

/**
 * Hook to check if Delivery Agent App is enabled
 */
export function useDeliveryAgentApp() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFeature = async () => {
      try {
        const { data, error } = await supabase
          .from('feature_flags')
          .select('is_enabled')
          .eq('feature_key', 'delivery_agent_app')
          .maybeSingle();

        if (!error && data) {
          setIsEnabled(data.is_enabled);
        }
      } catch (error) {
        console.error('Error checking delivery agent app feature:', error);
      } finally {
        setLoading(false);
      }
    };

    checkFeature();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('delivery_agent_app_feature')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'feature_flags',
          filter: 'feature_key=eq.delivery_agent_app'
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
