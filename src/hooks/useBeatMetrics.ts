import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BeatMetrics {
  /** Date of the last completed visit; falls back to the last planned beat date. */
  lastVisited: string | null;
  /** True when lastVisited is only a planned date (no completed visit yet). */
  lastVisitIsPlanned: boolean;
  /** Confirmed order value booked during the last completed visit. */
  lastVisitOrderValue: number;
  /** Confirmed order value from this beat's retailers, current calendar month. */
  monthlySales: number;
  /** Monthly sales growth vs the previous calendar month, in percent. */
  revenueGrowth: number;
  /** Confirmed revenue ÷ order count over the last 90 days. */
  avgOrderValue: number;
  /** Whether this beat has a recurring plan this month (used by BeatDetail). */
  isRecurring: boolean;
  recurringDetails: string | null;
}

const EMPTY_METRICS: BeatMetrics = {
  lastVisited: null,
  lastVisitIsPlanned: false,
  lastVisitOrderValue: 0,
  monthlySales: 0,
  revenueGrowth: 0,
  avgOrderValue: 0,
  isRecurring: false,
  recurringDetails: null,
};

export function useBeatMetrics(beatId: string, userId: string) {
  const [metrics, setMetrics] = useState<BeatMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (beatId && userId) {
      loadMetrics();
    }
  }, [beatId, userId]);

  const loadMetrics = async () => {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      // 90 days always reaches back past the start of last month, so one
      // fetch covers monthly sales, last-month growth, and the 90-day AOV.
      const ordersSince = ninetyDaysAgo < lastMonthStart ? ninetyDaysAgo : lastMonthStart;

      const { data: retailers } = await supabase
        .from('retailers')
        .select('id')
        .eq('beat_id', beatId)
        .eq('user_id', userId);

      const retailerIds = retailers?.map(r => r.id) || [];

      if (retailerIds.length === 0) {
        setMetrics(EMPTY_METRICS);
        setLoading(false);
        return;
      }

      const [visitRes, planRes, ordersRes, recurringRes] = await Promise.all([
        supabase
          .from('visits')
          .select('planned_date, id')
          .in('retailer_id', retailerIds)
          .eq('user_id', userId)
          .eq('status', 'completed')
          .lte('planned_date', today)
          .order('planned_date', { ascending: false })
          .limit(1),
        supabase
          .from('beat_plans')
          .select('plan_date')
          .eq('beat_id', beatId)
          .eq('user_id', userId)
          .lte('plan_date', today)
          .order('plan_date', { ascending: false })
          .limit(1),
        supabase
          .from('orders')
          .select('total_amount, order_date')
          .in('retailer_id', retailerIds)
          .gte('order_date', ordersSince)
          .eq('status', 'confirmed'),
        supabase
          .from('beat_plans')
          .select('beat_data')
          .eq('beat_id', beatId)
          .eq('user_id', userId)
          .gte('plan_date', currentMonthStart)
          .limit(1),
      ]);

      const lastVisit = visitRes.data?.[0] || null;
      const lastPlannedDate = planRes.data?.[0]?.plan_date || null;
      const orders = ordersRes.data || [];

      let lastVisitOrderValue = 0;
      if (lastVisit?.id) {
        const { data: lastVisitOrders } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('visit_id', lastVisit.id)
          .eq('status', 'confirmed');
        lastVisitOrderValue = lastVisitOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      } else if (lastPlannedDate) {
        // No completed visit — show the confirmed order value booked on the
        // last planned date instead, so the card always has date + value.
        if (lastPlannedDate >= ordersSince) {
          lastVisitOrderValue = orders
            .filter(o => o.order_date === lastPlannedDate)
            .reduce((sum, o) => sum + (o.total_amount || 0), 0);
        } else {
          const { data: plannedDayOrders } = await supabase
            .from('orders')
            .select('total_amount')
            .in('retailer_id', retailerIds)
            .eq('order_date', lastPlannedDate)
            .eq('status', 'confirmed');
          lastVisitOrderValue = plannedDayOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
        }
      }

      const monthlySales = orders
        .filter(o => o.order_date >= currentMonthStart)
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);

      const lastMonthRevenue = orders
        .filter(o => o.order_date >= lastMonthStart && o.order_date <= lastMonthEnd)
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);

      const growth = lastMonthRevenue > 0 ? ((monthlySales - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

      const orders90d = orders.filter(o => o.order_date >= ninetyDaysAgo);
      const revenue90d = orders90d.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const avgOrderValue = orders90d.length > 0 ? revenue90d / orders90d.length : 0;

      let isRecurring = false;
      let recurringDetails: string | null = null;
      const beatData = recurringRes.data?.[0]?.beat_data as any;
      if (beatData?.isRecurring) {
        isRecurring = true;
        recurringDetails = `${beatData.repeatType} - ${beatData.repeatUntilMode === 'permanent' ? 'Ongoing' : 'Until ' + new Date(beatData.repeatEndDate).toLocaleDateString()}`;
      }

      setMetrics({
        lastVisited: lastVisit?.planned_date || lastPlannedDate,
        lastVisitIsPlanned: !lastVisit && !!lastPlannedDate,
        lastVisitOrderValue,
        monthlySales,
        revenueGrowth: growth,
        avgOrderValue,
        isRecurring,
        recurringDetails,
      });
    } catch (error) {
      console.error('Error loading beat metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  return { metrics, loading, refresh: loadMetrics };
}
