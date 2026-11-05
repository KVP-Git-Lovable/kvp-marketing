import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TargetPeriod } from "./useUserTargetProgress";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subDays, subWeeks, subMonths, subQuarters, startOfYear, endOfYear } from "date-fns";

interface PeriodStats {
  planned: number;
  productive: number;
  unproductive: number;
  remaining: number;
  newRetailers: number;
  potentialRevenue: number;
  points: number;
}

const getDateRange = (period: TargetPeriod): { start: Date; end: Date } => {
  const now = new Date();
  
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday':
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case 'this_week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'last_week':
      const lastWeek = subWeeks(now, 1);
      return { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last_month':
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case 'this_quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'last_quarter':
      const lastQuarter = subQuarters(now, 1);
      return { start: startOfQuarter(lastQuarter), end: endOfQuarter(lastQuarter) };
    case 'this_year':
      // Financial Year: April 1 to March 31
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
      return { 
        start: new Date(fyStartYear, 3, 1), 
        end: new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999) 
      };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
};

const formatDateForQuery = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const usePeriodStats = (userId: string | undefined, period: TargetPeriod) => {
  return useQuery({
    queryKey: ['period-stats', userId, period],
    queryFn: async (): Promise<PeriodStats> => {
      if (!userId) {
        return { planned: 0, productive: 0, unproductive: 0, remaining: 0, newRetailers: 0, potentialRevenue: 0, points: 0 };
      }

      const { start, end } = getDateRange(period);
      const startDate = formatDateForQuery(start);
      const endDate = formatDateForQuery(end);

      // Fetch all required data in parallel
      const [beatPlansRes, visitsRes, ordersRes, newRetailersRes, pointsRes, allRetailersRes] = await Promise.all([
        // Beat plans for the period
        supabase
          .from('beat_plans')
          .select('beat_id, beat_data')
          .eq('user_id', userId)
          .gte('plan_date', startDate)
          .lte('plan_date', endDate),
        
        // Visits for the period
        supabase
          .from('visits')
          .select('id, retailer_id, status, no_order_reason, planned_date')
          .eq('user_id', userId)
          .gte('planned_date', startDate)
          .lte('planned_date', endDate),
        
        // Orders for the period (to determine productive status)
        supabase
          .from('orders')
          .select('retailer_id')
          .eq('user_id', userId)
          .eq('status', 'confirmed')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString()),
        
        // New retailers added in period
        supabase
          .from('retailers')
          .select('id')
          .eq('user_id', userId)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString()),
        
        // Gamification points earned in period
        supabase
          .from('gamification_points')
          .select('points')
          .eq('user_id', userId)
          .gte('earned_at', start.toISOString())
          .lte('earned_at', end.toISOString()),
        
        // All orders (for avg order value calculation)
        supabase
          .from('orders')
          .select('total_amount')
          .eq('user_id', userId)
          .eq('status', 'confirmed')
      ]);

      const beatPlans = beatPlansRes.data || [];
      const visits = visitsRes.data || [];
      const orders = ordersRes.data || [];
      const newRetailers = newRetailersRes.data || [];
      const pointsData = pointsRes.data || [];
      const allOrders = allRetailersRes.data || [];

      // Extract unique planned retailer IDs from all beat plans in period
      // Track beats with/without retailer data separately for proper fallback
      const plannedRetailerIds = new Set<string>();
      const beatsWithRetailerData = new Set<string>();
      const beatsWithoutRetailerData = new Set<string>();

      for (const bp of beatPlans) {
        const beatData = bp.beat_data as any;
        let hasRetailerData = false;
        
        if (beatData) {
          // Format 1: Direct retailer_ids array
          if (Array.isArray(beatData.retailer_ids) && beatData.retailer_ids.length > 0) {
            beatData.retailer_ids.forEach((id: string) => plannedRetailerIds.add(id));
            hasRetailerData = true;
          }
          
          // Format 2: retailers array of objects (auto-generated plans)
          if (Array.isArray(beatData.retailers) && beatData.retailers.length > 0) {
            beatData.retailers.forEach((r: any) => {
              if (r?.id) plannedRetailerIds.add(r.id);
            });
            hasRetailerData = true;
          }
        }
        
        // Track which beats need fallback query
        if (bp.beat_id) {
          if (hasRetailerData) {
            beatsWithRetailerData.add(bp.beat_id);
          } else {
            beatsWithoutRetailerData.add(bp.beat_id);
          }
        }
      }

      // Query retailers for beats that don't have retailer data in beat_data.
      // Even if the same beat has other plans with explicit retailer IDs, we still fetch here
      // because metadata-only plans (e.g. only retailerCount) can represent a larger set.
      // Using a Set ensures we don't double-count retailer IDs.
      const beatsNeedingFallback = Array.from(beatsWithoutRetailerData);

      if (beatsNeedingFallback.length > 0) {
        const { data: retailersByBeat } = await supabase
          .from('retailers')
          .select('id')
          .eq('user_id', userId)
          .in('beat_id', beatsNeedingFallback);
        
        if (retailersByBeat) {
          retailersByBeat.forEach(r => plannedRetailerIds.add(r.id));
        }
      }

      // Build order map for productive detection
      const ordersMap = new Set<string>();
      orders.forEach((o) => {
        if (o.retailer_id) {
          ordersMap.add(o.retailer_id);
        }
      });

      // Group visits by retailer
      const visitsByRetailer = new Map<string, any[]>();
      visits.forEach((v) => {
        if (!v?.retailer_id) return;
        const list = visitsByRetailer.get(v.retailer_id) || [];
        list.push(v);
        visitsByRetailer.set(v.retailer_id, list);
      });

      // Calculate productive and unproductive
      let productive = 0;
      let unproductive = 0;
      const visitedRetailerIds = new Set<string>();

      visitsByRetailer.forEach((group, retailerId) => {
        visitedRetailerIds.add(retailerId);
        const hasOrder = ordersMap.has(retailerId);
        if (hasOrder || group.some(v => v.status === 'productive')) {
          productive++;
        } else if (group.some(v => v.status === 'unproductive' || !!v.no_order_reason)) {
          unproductive++;
        }
      });

      // Also count retailers with orders but no visit record as productive
      ordersMap.forEach((retailerId) => {
        if (!visitedRetailerIds.has(retailerId)) {
          productive++;
          visitedRetailerIds.add(retailerId);
        }
      });

      const totalPlanned = plannedRetailerIds.size;
      const remaining = Math.max(0, totalPlanned - productive - unproductive);

      // Calculate total points
      const totalPoints = pointsData.reduce((sum, p) => sum + (p.points || 0), 0);

      // Calculate potential revenue (remaining × avg order value)
      const avgOrderValue = allOrders.length > 0
        ? allOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / allOrders.length
        : 0;
      const potentialRevenue = remaining * avgOrderValue;

      return {
        planned: totalPlanned,
        productive,
        unproductive,
        remaining,
        newRetailers: newRetailers.length,
        potentialRevenue,
        points: totalPoints
      };
    },
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false
  });
};
