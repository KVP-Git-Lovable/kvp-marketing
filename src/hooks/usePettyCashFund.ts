import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PettyCashFund {
  id: string;
  user_id: string;
  allocated_amount: number;
  balance: number;
  valid_from: string;
  valid_to: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PettyCashLimit {
  id: string;
  fund_id: string;
  max_per_transaction: number | null;
  max_per_day: number | null;
  require_bill_above: number | null;
}

export interface PettyCashTransaction {
  id: string;
  fund_id: string;
  user_id: string;
  amount: number;
  category: string;
  description: string | null;
  bill_url: string | null;
  transaction_date: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export const usePettyCashFund = (userId?: string) => {
  const { user } = useAuth();
  const uid = userId || user?.id;

  const { data: fund, isLoading: fundLoading } = useQuery({
    queryKey: ['petty-cash-fund', uid],
    queryFn: async () => {
      if (!uid) return null;
      const { data, error } = await (supabase as any)
        .from('petty_cash_funds')
        .select('*')
        .eq('user_id', uid)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return data as PettyCashFund | null;
    },
    enabled: !!uid,
  });

  const { data: limits } = useQuery({
    queryKey: ['petty-cash-limits', fund?.id],
    queryFn: async () => {
      if (!fund?.id) return null;
      const { data, error } = await (supabase as any)
        .from('petty_cash_limits')
        .select('*')
        .eq('fund_id', fund.id)
        .maybeSingle();
      if (error) throw error;
      return data as PettyCashLimit | null;
    },
    enabled: !!fund?.id,
  });

  return {
    fund,
    limits,
    hasPettyCash: !!fund,
    isLoading: fundLoading,
  };
};

export const usePettyCashTransactions = (fundId?: string) => {
  return useQuery({
    queryKey: ['petty-cash-transactions', fundId],
    queryFn: async () => {
      if (!fundId) return [];
      const { data, error } = await (supabase as any)
        .from('petty_cash_transactions')
        .select('*')
        .eq('fund_id', fundId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PettyCashTransaction[];
    },
    enabled: !!fundId,
  });
};
