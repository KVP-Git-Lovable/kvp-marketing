import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePaymentProofMandatory = () => {
  const [isPaymentProofMandatory, setIsPaymentProofMandatory] = useState(true); // Default to true for safety
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
    
    // Subscribe to changes in feature flags
    const channel = supabase
      .channel('payment-proof-mandatory-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feature_flags',
        filter: 'feature_key=eq.payment_proof_mandatory'
      }, (payload) => {
        if (payload.new && 'is_enabled' in payload.new) {
          setIsPaymentProofMandatory(payload.new.is_enabled as boolean);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('is_enabled')
      .eq('feature_key', 'payment_proof_mandatory')
      .maybeSingle();
    
    if (error) {
      console.error('Error loading payment proof mandatory settings:', error);
    } else if (data) {
      setIsPaymentProofMandatory(data.is_enabled);
    }
    setLoading(false);
  };

  return { isPaymentProofMandatory, loading };
};
