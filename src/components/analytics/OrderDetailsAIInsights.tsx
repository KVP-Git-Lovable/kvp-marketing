import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Sparkles, Target, Users, MapPin, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';

interface OrderDetailsAIInsightsProps {
  userName: string;
  dateRange: { from: Date; to: Date };
}

interface InsightItem {
  type: 'opportunity' | 'warning' | 'success' | 'info';
  icon: React.ElementType;
  title: string;
  description: string;
}

export const OrderDetailsAIInsights = ({ userName, dateRange }: OrderDetailsAIInsightsProps) => {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightItem[]>([]);

  useEffect(() => {
    const generateInsights = async () => {
      setLoading(true);
      const insightsList: InsightItem[] = [];

      try {
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        const toDate = format(dateRange.to, 'yyyy-MM-dd');

        // Get user profile
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('full_name', userName)
          .single();

        if (!userProfile) {
          setInsights([]);
          setLoading(false);
          return;
        }

        const userId = userProfile.id;

        // Parallel fetch all required data
        const [
          retailersResult,
          ordersResult,
          beatsResult,
          beatPlansResult
        ] = await Promise.all([
          // All retailers assigned to this user
          supabase
            .from('retailers')
            .select('id, name, beat_id, beats(beat_name)')
            .eq('user_id', userId),

          // Orders in date range with retailer name
          supabase
            .from('orders')
            .select('retailer_id, total_amount, order_date, retailers(name)')
            .eq('user_id', userId)
            .eq('status', 'confirmed')
            .gte('order_date', fromDate)
            .lte('order_date', toDate),

          // Beats assigned to this user
          (supabase as any)
            .from('beats')
            .select('id, beat_name, owner_id')
            .eq('owner_id', userId)
            .eq('is_active', true),

          // Beat plans in date range to see coverage
          supabase
            .from('beat_plans')
            .select('beat_id, beat_name')
            .eq('user_id', userId)
            .gte('plan_date', fromDate)
            .lte('plan_date', toDate)
        ]);

        const retailers = retailersResult.data || [];
        const orders = (ordersResult.data || []).map(o => ({
          ...o,
          retailer_name: (o.retailers as any)?.name || 'Unknown'
        }));
        const beats = beatsResult.data || [];
        const beatPlans = beatPlansResult.data || [];

        // Analysis 1: Retailers not ordered in period
        const orderedRetailerIds = new Set(orders.map(o => o.retailer_id));
        const retailersNoOrder = retailers.filter(r => !orderedRetailerIds.has(r.id));
        
        if (retailersNoOrder.length > 0) {
          const sample = retailersNoOrder.slice(0, 3).map(r => r.name).join(', ');
          insightsList.push({
            type: 'opportunity',
            icon: Target,
            title: `${retailersNoOrder.length} Retailers Without Orders`,
            description: `Target these retailers: ${sample}${retailersNoOrder.length > 3 ? ` +${retailersNoOrder.length - 3} more` : ''}`
          });
        }

        // Analysis 2: Beats not covered in beat plans
        const plannedBeatIds = new Set(beatPlans.map(bp => bp.beat_id));
        const uncoveredBeats = beats.filter(b => !plannedBeatIds.has(b.id));
        
        if (uncoveredBeats.length > 0) {
          insightsList.push({
            type: 'warning',
            icon: MapPin,
            title: `${uncoveredBeats.length} Beats Not Visited`,
            description: `Unplanned beats: ${uncoveredBeats.map(b => b.beat_name).slice(0, 3).join(', ')}${uncoveredBeats.length > 3 ? '...' : ''}`
          });
        }

        // Analysis 3: Top retailer by value
        const retailerOrders: Record<string, { total: number; name: string }> = {};
        orders.forEach(o => {
          if (!retailerOrders[o.retailer_id]) {
            retailerOrders[o.retailer_id] = { 
              total: 0, 
              name: o.retailer_name
            };
          }
          retailerOrders[o.retailer_id].total += Number(o.total_amount || 0);
        });

        const sortedRetailers = Object.values(retailerOrders).sort((a, b) => b.total - a.total);
        
        if (sortedRetailers.length > 0) {
          const top = sortedRetailers[0];
          insightsList.push({
            type: 'success',
            icon: TrendingUp,
            title: 'Top Performing Retailer',
            description: `${top.name} with ₹${top.total.toLocaleString()} in orders - maintain relationship`
          });
        }

        // Analysis 4: Low value retailers that need attention
        const lowValueRetailers = sortedRetailers.filter(r => r.total < 5000);
        if (lowValueRetailers.length > 0 && sortedRetailers.length > 3) {
          insightsList.push({
            type: 'info',
            icon: Users,
            title: 'Upselling Opportunity',
            description: `${lowValueRetailers.length} retailers ordered <₹5K - focus on increasing basket size`
          });
        }

        // Analysis 5: Check for declining retailers (ordered before but not recently)
        const lastWeekDate = format(subDays(dateRange.to, 7), 'yyyy-MM-dd');
        const recentOrderRetailers = new Set(
          orders.filter(o => o.order_date >= lastWeekDate).map(o => o.retailer_id)
        );
        const olderOrderRetailers = orders
          .filter(o => o.order_date < lastWeekDate && !recentOrderRetailers.has(o.retailer_id))
          .map(o => o.retailer_id);
        
        const uniqueDeclined = [...new Set(olderOrderRetailers)];
        if (uniqueDeclined.length > 0) {
          // Build a map of retailer_id -> name from orders
          const orderRetailerNames: Record<string, string> = {};
          orders.forEach(o => {
            if (!orderRetailerNames[o.retailer_id]) {
              orderRetailerNames[o.retailer_id] = o.retailer_name;
            }
          });
          
          const declinedNames = uniqueDeclined
            .slice(0, 3)
            .map(id => orderRetailerNames[id] || 'Unknown');
          
          insightsList.push({
            type: 'warning',
            icon: AlertTriangle,
            title: 'Re-engage These Retailers',
            description: `${declinedNames.join(', ')} ordered earlier but not in last week`
          });
        }

        setInsights(insightsList.slice(0, 4)); // Max 4 insights
      } catch (error) {
        console.error('Error generating insights:', error);
        setInsights([]);
      } finally {
        setLoading(false);
      }
    };

    if (userName) {
      generateInsights();
    }
  }, [userName, dateRange.from, dateRange.to]);

  const getTypeStyles = (type: InsightItem['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400';
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400';
      case 'opportunity':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400';
      case 'info':
        return 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400';
      default:
        return 'bg-muted border-border';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground mb-4">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm">Analyzing data...</span>
      </div>
    );
  }

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-sm">AI Insights</h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((insight, index) => {
          const Icon = insight.icon;
          return (
            <Card
              key={index}
              className={`p-3 border ${getTypeStyles(insight.type)}`}
            >
              <div className="flex items-start gap-2">
                <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">{insight.title}</p>
                  <p className="text-xs opacity-80 mt-0.5">{insight.description}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
