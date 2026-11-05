import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BeatHealthInsight {
  health_score: number;
  status: 'excellent' | 'stable' | 'needs_attention' | 'critical';
  summary: string;
  recommended_actions: string[];
  severity_level: string;
  risk_signals: string[];
  data_points: {
    revenue: {
      mtd: number;
      last_month: number;
      three_month_avg: number;
      growth_pct: number;
      yoy_pct: number;
    };
    retailer_activity: {
      total: number;
      active: number;
      inactive_30d: number;
      new_this_month: number;
      lost_60d: number;
    };
    coverage: {
      planned: number;
      completed: number;
      missed: number;
      coverage_pct: number;
      avg_per_retailer: number;
    };
    conversion: {
      total_visits: number;
      orders: number;
      rate_pct: number;
      avg_billing: number;
    };
    productivity: {
      working_days: number;
      orders_per_day: number;
      revenue_per_day: number;
      avg_order_value: number;
    };
    sku_penetration: {
      catalog: number;
      sold: number;
      pct: number;
      top_5: { name: string; revenue: number; quantity: number }[];
      slow_moving: { name: string; quantity: number }[];
      concentration_risk: number;
    };
  };
  timestamp: string;
}

export function useBeatHealthInsight() {
  const [insight, setInsight] = useState<BeatHealthInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsight = async (beatId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke('beat-health-insights', {
        body: { beatId },
      });

      if (fnError) throw fnError;
      setInsight(data as BeatHealthInsight);
    } catch (err: any) {
      console.error('Failed to fetch beat health insight:', err);
      setError(err.message || 'Failed to generate insights');
      toast.error('Failed to generate health insights');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setInsight(null);
    setError(null);
  };

  return { insight, loading, error, fetchInsight, reset };
}
