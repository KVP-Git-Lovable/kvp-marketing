import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompetencyScore {
  competency_template_id: string;
  score: number;
  raw_metrics: Record<string, any>;
  trend: string;
  previous_month_score: number | null;
}

/**
 * BEHAVIOR-BASED COMPETENCY SCORING MODEL
 * 
 * This model measures ABILITY and CONSISTENCY, not target achievement.
 * Key principles:
 * 1. Compare current behavior to historical averages (rolling 3-month baseline)
 * 2. Measure consistency and reliability of actions
 * 3. Identify skill demonstration through patterns
 * 4. Use percentile ranking within peer group for calibration
 * 5. Don't penalize early-month data - use rate-based metrics
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, monthYear, roleType = 'field_executive' } = await req.json();
    
    if (!userId || !monthYear) {
      throw new Error("userId and monthYear are required");
    }

    console.log(`Calculating behavior-based competency scores for user ${userId}, month ${monthYear}, role ${roleType}`);

    // Parse dates
    const targetDate = new Date(monthYear);
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);
    
    // Calculate 3-month historical baseline
    const baselineStart = new Date(targetDate.getFullYear(), targetDate.getMonth() - 3, 1);
    const baselineEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0, 23, 59, 59);
    
    // Previous month for trend comparison
    const previousMonthStart = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
    const previousMonthStr = previousMonthStart.toISOString().split('T')[0];

    // Fetch competency templates
    const { data: templates, error: templatesError } = await supabase
      .from('competency_templates')
      .select('*')
      .eq('role_type', roleType)
      .eq('is_active', true)
      .order('sort_order');

    if (templatesError) throw templatesError;
    if (!templates || templates.length === 0) {
      throw new Error(`No competency templates found for role: ${roleType}`);
    }

    // Fetch previous month scores for trend
    const { data: previousScores } = await supabase
      .from('user_competency_monthly_scores')
      .select('competency_template_id, score')
      .eq('user_id', userId)
      .eq('month_year', previousMonthStr);

    const previousScoreMap = new Map(
      (previousScores || []).map(s => [s.competency_template_id, s.score])
    );

    // Fetch current month data
    const [
      currentVisitsResult, 
      currentOrdersResult, 
      currentBeatPlansResult, 
      currentAttendanceResult
    ] = await Promise.all([
      supabase
        .from('visits')
        .select('id, retailer_id, check_in_time, check_out_time, check_in_photo_url, status, planned_date')
        .eq('user_id', userId)
        .gte('planned_date', monthStart.toISOString().split('T')[0])
        .lte('planned_date', monthEnd.toISOString().split('T')[0]),
      
      supabase
        .from('orders')
        .select('id, visit_id, total_amount, status, retailer_id, is_credit_order, credit_pending_amount, credit_paid_amount, order_date')
        .eq('user_id', userId)
        .gte('order_date', monthStart.toISOString().split('T')[0])
        .lte('order_date', monthEnd.toISOString().split('T')[0]),
      
      supabase
        .from('beat_plans')
        .select('id, beat_id, beat_name, plan_date')
        .eq('user_id', userId)
        .gte('plan_date', monthStart.toISOString().split('T')[0])
        .lte('plan_date', monthEnd.toISOString().split('T')[0]),
      
      supabase
        .from('attendance')
        .select('id, date, check_in_time, check_out_time, check_in_photo_url, status, total_hours')
        .eq('user_id', userId)
        .gte('date', monthStart.toISOString().split('T')[0])
        .lte('date', monthEnd.toISOString().split('T')[0])
    ]);

    // Fetch baseline (3-month historical) data for comparison
    const [
      baselineVisitsResult, 
      baselineOrdersResult, 
      baselineAttendanceResult
    ] = await Promise.all([
      supabase
        .from('visits')
        .select('id, status, check_in_time, check_out_time, check_in_photo_url, planned_date')
        .eq('user_id', userId)
        .gte('planned_date', baselineStart.toISOString().split('T')[0])
        .lte('planned_date', baselineEnd.toISOString().split('T')[0]),
      
      supabase
        .from('orders')
        .select('id, total_amount, status, order_date')
        .eq('user_id', userId)
        .gte('order_date', baselineStart.toISOString().split('T')[0])
        .lte('order_date', baselineEnd.toISOString().split('T')[0]),
      
      supabase
        .from('attendance')
        .select('id, date, check_in_time, total_hours')
        .eq('user_id', userId)
        .gte('date', baselineStart.toISOString().split('T')[0])
        .lte('date', baselineEnd.toISOString().split('T')[0])
    ]);

    // Fetch all retailers for the user
    const { data: retailers } = await supabase
      .from('retailers')
      .select('id, beat_id, created_at, status')
      .eq('user_id', userId);

    const currentVisits = currentVisitsResult.data || [];
    const currentOrders = currentOrdersResult.data || [];
    const currentBeatPlans = currentBeatPlansResult.data || [];
    const currentAttendance = currentAttendanceResult.data || [];
    const baselineVisits = baselineVisitsResult.data || [];
    const baselineOrders = baselineOrdersResult.data || [];
    const baselineAttendance = baselineAttendanceResult.data || [];
    const allRetailers = retailers || [];

    // Calculate days elapsed and working days
    const today = new Date();
    const daysElapsed = Math.min(
      Math.ceil((today.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)),
      new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate()
    );
    const workingDaysElapsed = Math.max(1, Math.round(daysElapsed * 0.76)); // ~76% are working days
    const baselineDays = Math.ceil((baselineEnd.getTime() - baselineStart.getTime()) / (1000 * 60 * 60 * 24));
    const baselineWorkingDays = Math.max(1, Math.round(baselineDays * 0.76));

    const retailerBeatMap = new Map(allRetailers.map(r => [r.id, r.beat_id]));

    console.log(`Data: ${currentVisits.length} visits, ${currentOrders.length} orders, ${currentAttendance.length} attendance | Baseline: ${baselineVisits.length} visits, ${baselineOrders.length} orders`);

    // For manager competencies
    let subordinates: string[] = [];
    let subordinateData: any = {};
    
    if (roleType === 'field_manager') {
      const { data: subData } = await supabase.rpc('get_subordinate_users', { user_id_param: userId });
      subordinates = (subData || []).map((s: any) => s.subordinate_user_id);
      
      if (subordinates.length > 0) {
        const [subVisits, subOrders, subScorecards, subCoachingNotes] = await Promise.all([
          supabase.from('visits').select('id, user_id, status, check_in_time, planned_date')
            .in('user_id', subordinates)
            .gte('planned_date', monthStart.toISOString().split('T')[0])
            .lte('planned_date', monthEnd.toISOString().split('T')[0]),
          supabase.from('orders').select('id, user_id, total_amount, status, order_date')
            .in('user_id', subordinates)
            .gte('order_date', monthStart.toISOString().split('T')[0])
            .lte('order_date', monthEnd.toISOString().split('T')[0]),
          supabase.from('user_monthly_scorecards').select('user_id, overall_score, performance_band, month_year')
            .in('user_id', subordinates)
            .eq('month_year', monthStart.toISOString().split('T')[0]),
          supabase.from('competency_coaching_notes').select('id, user_id, manager_id, created_at, is_acknowledged')
            .eq('manager_id', userId)
            .gte('created_at', monthStart.toISOString())
            .lte('created_at', monthEnd.toISOString())
        ]);
        
        subordinateData = {
          visits: subVisits.data || [],
          orders: subOrders.data || [],
          scorecards: subScorecards.data || [],
          coachingNotes: subCoachingNotes.data || []
        };
      }
    }

    // Calculate scores
    const scores: CompetencyScore[] = [];

    for (const template of templates) {
      let score = 0;
      let rawMetrics: Record<string, any> = {};

      switch (template.competency_code) {
        // ============== TERRITORY COVERAGE ==============
        // Measures: Consistency of beat coverage, not just achievement
        case 'FSE_TERRITORY_COVERAGE': {
          const plannedBeats = new Set(currentBeatPlans.map(bp => bp.beat_id));
          const visitedBeats = new Set<string>();
          currentVisits.filter(v => v.check_in_time && v.retailer_id).forEach(v => {
            const beatId = retailerBeatMap.get(v.retailer_id);
            if (beatId) visitedBeats.add(beatId);
          });
          
          // Current coverage rate
          const currentCoverage = plannedBeats.size > 0 
            ? (visitedBeats.size / plannedBeats.size) * 100 
            : 0;
          
          // Baseline: Historical average daily beats
          const baselineVisitedDays = new Set(baselineVisits.map(v => v.planned_date?.split('T')[0])).size;
          const avgBeatsPerDayBaseline = baselineVisitedDays > 0 
            ? baselineVisits.filter(v => v.check_in_time).length / baselineVisitedDays 
            : 0;
          
          // Current daily rate
          const currentDailyRate = workingDaysElapsed > 0 
            ? currentVisits.filter(v => v.check_in_time).length / workingDaysElapsed 
            : 0;
          
          // Improvement from baseline (50%) + absolute coverage (50%)
          const improvementFactor = avgBeatsPerDayBaseline > 0 
            ? Math.min(1.5, currentDailyRate / avgBeatsPerDayBaseline) 
            : 1;
          const improvementScore = improvementFactor * 50;
          const absoluteScore = Math.min(50, currentCoverage * 0.5);
          
          score = Math.min(100, improvementScore + absoluteScore);
          rawMetrics = {
            beats_planned: plannedBeats.size,
            beats_visited: visitedBeats.size,
            coverage_rate: currentCoverage.toFixed(1),
            daily_visit_rate: currentDailyRate.toFixed(1),
            baseline_daily_rate: avgBeatsPerDayBaseline.toFixed(1),
            improvement_factor: improvementFactor.toFixed(2)
          };
          break;
        }

        // ============== PRODUCTIVITY ==============
        // Measures: Consistency of productive vs unproductive visits
        case 'FSE_PRODUCTIVITY': {
          const completedVisits = currentVisits.filter(v => v.status === 'productive' || v.status === 'unproductive');
          const productiveVisits = currentVisits.filter(v => v.status === 'productive');
          
          // Current productivity rate
          const currentProductivity = completedVisits.length > 0 
            ? (productiveVisits.length / completedVisits.length) * 100 
            : 0;
          
          // Baseline productivity
          const baselineCompleted = baselineVisits.filter(v => v.status === 'productive' || v.status === 'unproductive');
          const baselineProductive = baselineVisits.filter(v => v.status === 'productive');
          const baselineProductivity = baselineCompleted.length > 0 
            ? (baselineProductive.length / baselineCompleted.length) * 100 
            : 0;
          
          // Consistency check: std deviation of daily productivity
          const dailyProductivity = new Map<string, { total: number; productive: number }>();
          currentVisits.forEach(v => {
            const day = v.planned_date?.split('T')[0] || '';
            if (!dailyProductivity.has(day)) dailyProductivity.set(day, { total: 0, productive: 0 });
            const stats = dailyProductivity.get(day)!;
            if (v.status === 'productive' || v.status === 'unproductive') {
              stats.total++;
              if (v.status === 'productive') stats.productive++;
            }
          });
          
          const dailyRates = [...dailyProductivity.values()]
            .filter(d => d.total > 0)
            .map(d => (d.productive / d.total) * 100);
          
          const avgDaily = dailyRates.length > 0 ? dailyRates.reduce((a, b) => a + b, 0) / dailyRates.length : 0;
          const variance = dailyRates.length > 1 
            ? dailyRates.reduce((sum, r) => sum + Math.pow(r - avgDaily, 2), 0) / dailyRates.length 
            : 0;
          const consistencyScore = Math.max(0, 100 - Math.sqrt(variance)); // Lower variance = higher consistency
          
          // Score: 40% current rate, 30% improvement from baseline, 30% consistency
          const currentScore = currentProductivity * 0.4;
          const improvementScore = baselineProductivity > 0 
            ? Math.min(30, ((currentProductivity / baselineProductivity) - 1) * 30 + 15)
            : currentProductivity > 0 ? 15 : 0;
          const consistencyComponent = consistencyScore * 0.3;
          
          score = Math.min(100, currentScore + improvementScore + consistencyComponent);
          rawMetrics = {
            total_visits: completedVisits.length,
            productive_visits: productiveVisits.length,
            productivity_rate: currentProductivity.toFixed(1),
            baseline_productivity: baselineProductivity.toFixed(1),
            consistency_score: consistencyScore.toFixed(1),
            days_active: dailyProductivity.size
          };
          break;
        }

        // ============== REVENUE (SALES ABILITY) ==============
        // Measures: Order generation ability relative to activity, not target
        case 'FSE_REVENUE': {
          const confirmedOrders = currentOrders.filter(o => o.status === 'confirmed' || o.status === 'delivered');
          const currentRevenue = confirmedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
          
          // Baseline monthly average revenue
          const baselineConfirmed = baselineOrders.filter(o => o.status === 'confirmed' || o.status === 'delivered');
          const baselineRevenue = baselineConfirmed.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
          const baselineMonthlyAvg = baselineRevenue / 3; // 3 months
          
          // Revenue per visit (ability to convert)
          const visitsWithOrders = currentVisits.filter(v => v.check_in_time).length;
          const revenuePerVisit = visitsWithOrders > 0 ? currentRevenue / visitsWithOrders : 0;
          const baselineVisitsWithCheckin = baselineVisits.filter(v => v.check_in_time).length;
          const baselineRevenuePerVisit = baselineVisitsWithCheckin > 0 ? baselineRevenue / baselineVisitsWithCheckin : 0;
          
          // Order frequency (orders per working day)
          const orderFrequency = workingDaysElapsed > 0 ? confirmedOrders.length / workingDaysElapsed : 0;
          const baselineOrderFreq = baselineWorkingDays > 0 ? baselineConfirmed.length / baselineWorkingDays : 0;
          
          // Score components:
          // 40% - Improvement over baseline monthly average
          const improvementRatio = baselineMonthlyAvg > 0 ? currentRevenue / baselineMonthlyAvg : 1;
          const improvementScore = Math.min(40, improvementRatio * 20);
          
          // 30% - Revenue per visit improvement
          const rpvRatio = baselineRevenuePerVisit > 0 ? revenuePerVisit / baselineRevenuePerVisit : 1;
          const rpvScore = Math.min(30, rpvRatio * 15);
          
          // 30% - Order frequency
          const freqRatio = baselineOrderFreq > 0 ? orderFrequency / baselineOrderFreq : 1;
          const freqScore = Math.min(30, freqRatio * 15);
          
          score = Math.min(100, improvementScore + rpvScore + freqScore);
          rawMetrics = {
            current_revenue: currentRevenue,
            baseline_monthly_avg: baselineMonthlyAvg.toFixed(0),
            orders_count: confirmedOrders.length,
            revenue_per_visit: revenuePerVisit.toFixed(0),
            baseline_rpv: baselineRevenuePerVisit.toFixed(0),
            order_frequency: orderFrequency.toFixed(2),
            improvement_ratio: improvementRatio.toFixed(2)
          };
          break;
        }

        // ============== DISCIPLINE ==============
        // Measures: Consistency of following processes
        case 'FSE_DISCIPLINE': {
          // On-time check-in rate
          const onTimeCheckins = currentAttendance.filter(a => {
            if (!a.check_in_time) return false;
            const checkInHour = new Date(a.check_in_time).getHours();
            return checkInHour <= 9;
          }).length;
          const onTimeRate = currentAttendance.length > 0 
            ? (onTimeCheckins / currentAttendance.length) * 100 
            : 0;
          
          // Baseline on-time rate
          const baselineOnTime = baselineAttendance.filter(a => {
            if (!a.check_in_time) return false;
            const checkInHour = new Date(a.check_in_time).getHours();
            return checkInHour <= 9;
          }).length;
          const baselineOnTimeRate = baselineAttendance.length > 0 
            ? (baselineOnTime / baselineAttendance.length) * 100 
            : 0;
          
          // Photo compliance
          const visitsWithPhotos = currentVisits.filter(v => v.check_in_photo_url).length;
          const totalVisitsCheckedIn = currentVisits.filter(v => v.check_in_time).length;
          const photoRate = totalVisitsCheckedIn > 0 ? (visitsWithPhotos / totalVisitsCheckedIn) * 100 : 0;
          
          // Checkout compliance
          const visitsWithCheckout = currentVisits.filter(v => v.check_out_time).length;
          const checkoutRate = totalVisitsCheckedIn > 0 ? (visitsWithCheckout / totalVisitsCheckedIn) * 100 : 0;
          
          // Visit duration quality (15-45 min ideal)
          const visitsWithDuration = currentVisits.filter(v => v.check_in_time && v.check_out_time);
          let avgDuration = 0;
          if (visitsWithDuration.length > 0) {
            const totalDuration = visitsWithDuration.reduce((sum, v) => {
              const duration = new Date(v.check_out_time!).getTime() - new Date(v.check_in_time!).getTime();
              return sum + (duration / (1000 * 60));
            }, 0);
            avgDuration = totalDuration / visitsWithDuration.length;
          }
          const durationScore = avgDuration >= 15 && avgDuration <= 45 ? 100 : 
                               avgDuration > 0 ? Math.max(0, 100 - Math.abs(avgDuration - 30) * 2) : 0;
          
          // Improvement from baseline (on-time)
          const onTimeImprovement = baselineOnTimeRate > 0 
            ? Math.min(1.2, onTimeRate / baselineOnTimeRate) 
            : 1;
          
          // Score: behavior consistency across all discipline metrics
          score = (onTimeRate * 0.25 * onTimeImprovement) + 
                  (photoRate * 0.25) + 
                  (checkoutRate * 0.25) + 
                  (durationScore * 0.25);
          
          rawMetrics = {
            attendance_days: currentAttendance.length,
            on_time_rate: onTimeRate.toFixed(1),
            baseline_on_time: baselineOnTimeRate.toFixed(1),
            photo_rate: photoRate.toFixed(1),
            checkout_rate: checkoutRate.toFixed(1),
            avg_duration_min: avgDuration.toFixed(1),
            duration_score: durationScore.toFixed(1)
          };
          break;
        }

        // ============== RETAILER DEVELOPMENT ==============
        // Measures: Ability to develop new relationships, not just count
        case 'FSE_RETAILER_DEV': {
          const newRetailers = allRetailers.filter(r => {
            const createdAt = new Date(r.created_at);
            return createdAt >= monthStart && createdAt <= monthEnd;
          }).length;
          
          // Baseline: average new retailers per month
          const baselineNewRetailers = allRetailers.filter(r => {
            const createdAt = new Date(r.created_at);
            return createdAt >= baselineStart && createdAt <= baselineEnd;
          }).length;
          const baselineMonthlyAvg = baselineNewRetailers / 3;
          
          // Retailer activation rate (new retailers with orders)
          const newRetailerIds = new Set(
            allRetailers
              .filter(r => new Date(r.created_at) >= monthStart && new Date(r.created_at) <= monthEnd)
              .map(r => r.id)
          );
          const activatedRetailers = currentOrders.filter(o => newRetailerIds.has(o.retailer_id)).length;
          const activationRate = newRetailers > 0 ? (activatedRetailers / newRetailers) * 100 : 0;
          
          // Development rate (per working day)
          const devRate = workingDaysElapsed > 0 ? newRetailers / workingDaysElapsed : 0;
          const baselineDevRate = baselineWorkingDays > 0 ? baselineNewRetailers / baselineWorkingDays : 0;
          
          // Score: 40% improvement over baseline, 30% activation, 30% absolute rate
          const improvementRatio = baselineMonthlyAvg > 0 ? newRetailers / baselineMonthlyAvg : 1;
          const improvementScore = Math.min(40, improvementRatio * 20);
          const activationScore = activationRate * 0.3;
          const absoluteScore = Math.min(30, newRetailers * 6); // 5+ new = full score
          
          score = Math.min(100, improvementScore + activationScore + absoluteScore);
          rawMetrics = {
            new_retailers: newRetailers,
            baseline_monthly_avg: baselineMonthlyAvg.toFixed(1),
            activated_retailers: activatedRetailers,
            activation_rate: activationRate.toFixed(1),
            dev_rate_per_day: devRate.toFixed(2),
            improvement_ratio: improvementRatio.toFixed(2)
          };
          break;
        }

        // ============== PRODUCT MIX ==============
        // Measures: SKU diversity and ability to sell focus products
        case 'FSE_PRODUCT_MIX': {
          const confirmedOrderIds = currentOrders
            .filter(o => o.status === 'confirmed' || o.status === 'delivered')
            .map(o => o.id);
          
          if (confirmedOrderIds.length > 0) {
            const { data: orderItems } = await supabase
              .from('order_items')
              .select('product_id, quantity, rate, total, product:products(is_focused_product, name)')
              .in('order_id', confirmedOrderIds);
            
            const items = orderItems || [];
            const totalRevenue = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
            const focusRevenue = items
              .filter(item => (item.product as any)?.is_focused_product)
              .reduce((sum, item) => sum + (Number(item.total) || 0), 0);
            const uniqueSkus = new Set(items.map(item => item.product_id)).size;
            
            // Get baseline SKU diversity
            const baselineOrderIds = baselineOrders
              .filter(o => o.status === 'confirmed' || o.status === 'delivered')
              .map(o => o.id);
            
            let baselineSkus = 0;
            if (baselineOrderIds.length > 0) {
              const { data: baselineItems } = await supabase
                .from('order_items')
                .select('product_id')
                .in('order_id', baselineOrderIds);
              baselineSkus = new Set((baselineItems || []).map(i => i.product_id)).size / 3; // Monthly avg
            }
            
            const focusRatio = totalRevenue > 0 ? (focusRevenue / totalRevenue) * 100 : 0;
            const skuDiversity = uniqueSkus;
            const skuImprovement = baselineSkus > 0 ? uniqueSkus / baselineSkus : 1;
            
            // Score: 40% focus product ratio, 30% SKU diversity, 30% improvement
            const focusScore = Math.min(40, focusRatio * 0.8); // 50%+ focus = full score
            const diversityScore = Math.min(30, (uniqueSkus / 15) * 30); // 15+ SKUs = full score
            const improvementScore = Math.min(30, skuImprovement * 15);
            
            score = Math.min(100, focusScore + diversityScore + improvementScore);
            rawMetrics = {
              focus_revenue: focusRevenue,
              total_revenue: totalRevenue,
              focus_ratio: focusRatio.toFixed(1),
              unique_skus: uniqueSkus,
              baseline_skus_monthly: baselineSkus.toFixed(1),
              sku_improvement: skuImprovement.toFixed(2)
            };
          } else {
            score = 0;
            rawMetrics = { note: 'No confirmed orders this month' };
          }
          break;
        }

        // ============== COLLECTION ==============
        // Measures: Payment discipline and collection ability
        case 'FSE_COLLECTION': {
          const creditOrders = currentOrders.filter(o => o.is_credit_order === true);
          const totalCreditAmount = creditOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
          const collectedAmount = creditOrders.reduce((sum, o) => sum + (Number(o.credit_paid_amount) || 0), 0);
          
          const collectionRate = totalCreditAmount > 0 
            ? (collectedAmount / totalCreditAmount) * 100 
            : 100;
          
          // Cash order preference (shows good financial discipline)
          const cashOrders = currentOrders.filter(o => !o.is_credit_order && (o.status === 'confirmed' || o.status === 'delivered'));
          const cashOrderRate = currentOrders.length > 0 ? (cashOrders.length / currentOrders.length) * 100 : 0;
          
          // Get baseline collection rate
          const baselineCreditOrders = baselineOrders.filter(o => o.status === 'confirmed');
          const baselineCashRate = baselineOrders.length > 0 
            ? (baselineOrders.filter(o => !o.is_credit_order).length / baselineOrders.length) * 100 
            : 0;
          
          // Improvement in cash preference
          const cashImprovement = baselineCashRate > 0 ? cashOrderRate / baselineCashRate : 1;
          
          // Score: 40% collection rate, 30% cash preference, 30% improvement
          const collectionScore = collectionRate * 0.4;
          const cashScore = cashOrderRate * 0.3;
          const improvementScore = Math.min(30, cashImprovement * 15);
          
          score = creditOrders.length > 0 || cashOrders.length > 0
            ? Math.min(100, collectionScore + cashScore + improvementScore)
            : 50; // No orders = neutral score
          
          rawMetrics = {
            total_orders: currentOrders.length,
            credit_orders: creditOrders.length,
            cash_orders: cashOrders.length,
            collection_rate: collectionRate.toFixed(1),
            cash_order_rate: cashOrderRate.toFixed(1),
            baseline_cash_rate: baselineCashRate.toFixed(1),
            cash_improvement: cashImprovement.toFixed(2)
          };
          break;
        }

        // ============== MANAGER COMPETENCIES ==============
        case 'FSM_TEAM_ACHIEVEMENT': {
          if (subordinates.length === 0) {
            score = 50; // Neutral for no team
            rawMetrics = { note: 'No team members found' };
            break;
          }
          
          const teamOrders = subordinateData.orders || [];
          const teamRevenue = teamOrders
            .filter((o: any) => o.status === 'confirmed' || o.status === 'delivered')
            .reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
          
          // Average per team member
          const avgRevenuePerMember = teamRevenue / subordinates.length;
          
          // Get team scorecards for performance distribution
          const scorecards = subordinateData.scorecards || [];
          const avgTeamScore = scorecards.length > 0
            ? scorecards.reduce((sum: number, s: any) => sum + (s.overall_score || 0), 0) / scorecards.length
            : 50;
          
          const highPerformers = scorecards.filter((s: any) => 
            s.performance_band === 'exceptional' || s.performance_band === 'strong'
          ).length;
          const highPerformerRate = subordinates.length > 0 ? (highPerformers / subordinates.length) * 100 : 0;
          
          // Score: Team average score (behavior-based)
          score = Math.min(100, avgTeamScore);
          rawMetrics = {
            team_size: subordinates.length,
            team_revenue: teamRevenue,
            avg_revenue_per_member: avgRevenuePerMember.toFixed(0),
            avg_team_score: avgTeamScore.toFixed(1),
            high_performers: highPerformers,
            high_performer_rate: highPerformerRate.toFixed(1)
          };
          break;
        }

        case 'FSM_TEAM_PRODUCTIVITY': {
          if (subordinates.length === 0) {
            score = 50;
            rawMetrics = { note: 'No team members found' };
            break;
          }
          
          const teamVisits = subordinateData.visits || [];
          const completedVisits = teamVisits.filter((v: any) => v.status === 'productive' || v.status === 'unproductive');
          const productiveVisits = teamVisits.filter((v: any) => v.status === 'productive');
          
          const avgTeamProductivity = completedVisits.length > 0 
            ? (productiveVisits.length / completedVisits.length) * 100 
            : 0;
          
          score = Math.min(100, avgTeamProductivity);
          rawMetrics = {
            team_size: subordinates.length,
            team_total_visits: completedVisits.length,
            team_productive_visits: productiveVisits.length,
            avg_team_productivity: avgTeamProductivity.toFixed(1)
          };
          break;
        }

        case 'FSM_COACHING': {
          if (subordinates.length === 0) {
            score = 50;
            rawMetrics = { note: 'No team members found' };
            break;
          }
          
          const coachingNotes = subordinateData.coachingNotes || [];
          const uniqueMembersCoached = new Set(coachingNotes.map((n: any) => n.user_id)).size;
          const acknowledgedNotes = coachingNotes.filter((n: any) => n.is_acknowledged).length;
          
          const coachingCoverage = (uniqueMembersCoached / subordinates.length) * 100;
          const acknowledgementRate = coachingNotes.length > 0 ? (acknowledgedNotes / coachingNotes.length) * 100 : 0;
          
          score = (coachingCoverage * 0.5) + (acknowledgementRate * 0.5);
          rawMetrics = {
            team_size: subordinates.length,
            coaching_sessions: coachingNotes.length,
            members_coached: uniqueMembersCoached,
            notes_acknowledged: acknowledgedNotes,
            coaching_coverage: coachingCoverage.toFixed(1),
            acknowledgement_rate: acknowledgementRate.toFixed(1)
          };
          break;
        }

        case 'FSM_PLANNING': {
          if (subordinates.length === 0) {
            score = 50;
            rawMetrics = { note: 'No team members found' };
            break;
          }
          
          const { data: teamBeatPlans } = await supabase
            .from('beat_plans')
            .select('id, user_id, beat_id, plan_date')
            .in('user_id', subordinates)
            .gte('plan_date', monthStart.toISOString().split('T')[0])
            .lte('plan_date', monthEnd.toISOString().split('T')[0]);
          
          const teamVisits = subordinateData.visits || [];
          const plansCreated = (teamBeatPlans || []).length;
          const executedVisits = teamVisits.filter((v: any) => v.check_in_time).length;
          
          const expectedPlans = subordinates.length * workingDaysElapsed;
          const planningRate = expectedPlans > 0 ? (plansCreated / expectedPlans) * 100 : 0;
          const executionRate = plansCreated > 0 ? Math.min(100, (executedVisits / (plansCreated * 5)) * 100) : 0;
          
          score = Math.min(100, (planningRate * 0.5 + executionRate * 0.5));
          rawMetrics = {
            team_size: subordinates.length,
            plans_created: plansCreated,
            expected_plans: expectedPlans,
            visits_executed: executedVisits,
            planning_rate: planningRate.toFixed(1),
            execution_rate: executionRate.toFixed(1)
          };
          break;
        }

        case 'FSM_TALENT': {
          if (subordinates.length === 0) {
            score = 50;
            rawMetrics = { note: 'No team members found' };
            break;
          }
          
          const currentScorecards = subordinateData.scorecards || [];
          
          const { data: prevScorecards } = await supabase
            .from('user_monthly_scorecards')
            .select('user_id, overall_score, performance_band')
            .in('user_id', subordinates)
            .eq('month_year', previousMonthStr);
          
          const prevScoreMap = new Map((prevScorecards || []).map((s: any) => [s.user_id, s.overall_score]));
          
          let membersGrowing = 0;
          let totalGrowth = 0;
          
          currentScorecards.forEach((s: any) => {
            const prevScore = prevScoreMap.get(s.user_id);
            if (prevScore !== undefined) {
              const growth = s.overall_score - prevScore;
              totalGrowth += growth;
              if (growth > 5) membersGrowing++;
            }
          });
          
          const avgGrowthRate = currentScorecards.length > 0 ? totalGrowth / currentScorecards.length : 0;
          const highPerformers = currentScorecards.filter((s: any) => 
            s.performance_band === 'exceptional' || s.performance_band === 'strong'
          ).length;
          
          score = Math.min(100, Math.max(0, 50 + avgGrowthRate));
          rawMetrics = {
            team_size: subordinates.length,
            scorecards_count: currentScorecards.length,
            members_growing: membersGrowing,
            high_performers: highPerformers,
            avg_growth_rate: avgGrowthRate.toFixed(1)
          };
          break;
        }

        case 'FSM_COVERAGE': {
          if (subordinates.length === 0) {
            score = 50;
            rawMetrics = { note: 'No team members found' };
            break;
          }
          
          const { data: teamRetailers } = await supabase
            .from('retailers')
            .select('id, beat_id, user_id, status')
            .in('user_id', subordinates)
            .eq('status', 'active');
          
          const teamVisits = subordinateData.visits || [];
          const visitedRetailers = new Set(teamVisits.filter((v: any) => v.check_in_time).map((v: any) => v.retailer_id));
          
          const totalRetailers = (teamRetailers || []).length;
          const retailersCovered = visitedRetailers.size;
          const coverageRate = totalRetailers > 0 ? (retailersCovered / totalRetailers) * 100 : 0;
          
          score = Math.min(100, coverageRate);
          rawMetrics = {
            team_size: subordinates.length,
            total_retailers: totalRetailers,
            retailers_visited: retailersCovered,
            coverage_rate: coverageRate.toFixed(1)
          };
          break;
        }

        default:
          score = 50; // Neutral default
          rawMetrics = { error: 'Unknown competency code', code: template.competency_code };
      }

      // Calculate trend
      const previousScore = previousScoreMap.get(template.id) || null;
      let trend = 'new';
      if (previousScore !== null) {
        if (score > previousScore + 5) trend = 'improving';
        else if (score < previousScore - 5) trend = 'declining';
        else trend = 'stable';
      }

      scores.push({
        competency_template_id: template.id,
        score: Math.round(score * 100) / 100,
        raw_metrics: rawMetrics,
        trend,
        previous_month_score: previousScore
      });
    }

    // Calculate overall score (weighted average)
    let totalWeight = 0;
    let weightedSum = 0;
    for (const template of templates) {
      const scoreData = scores.find(s => s.competency_template_id === template.id);
      if (scoreData) {
        weightedSum += scoreData.score * template.weightage;
        totalWeight += template.weightage;
      }
    }
    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Determine performance band
    let performanceBand = 'needs_improvement';
    if (overallScore >= 85) performanceBand = 'exceptional';
    else if (overallScore >= 70) performanceBand = 'strong';
    else if (overallScore >= 55) performanceBand = 'developing';

    console.log(`Calculated overall score: ${overallScore.toFixed(1)}, band: ${performanceBand}`);

    // Upsert individual competency scores
    for (const scoreData of scores) {
      const { error: upsertError } = await supabase
        .from('user_competency_monthly_scores')
        .upsert({
          user_id: userId,
          competency_template_id: scoreData.competency_template_id,
          month_year: monthStart.toISOString().split('T')[0],
          score: scoreData.score,
          raw_metrics: scoreData.raw_metrics,
          trend: scoreData.trend,
          previous_month_score: scoreData.previous_month_score,
          calculated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,competency_template_id,month_year'
        });
      
      if (upsertError) console.error('Error upserting score:', upsertError);
    }

    // Upsert monthly scorecard
    const { error: scorecardError } = await supabase
      .from('user_monthly_scorecards')
      .upsert({
        user_id: userId,
        month_year: monthStart.toISOString().split('T')[0],
        role_type: roleType,
        overall_score: Math.round(overallScore * 100) / 100,
        weighted_score: Math.round(overallScore * 100) / 100,
        performance_band: performanceBand,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,month_year'
      });

    if (scorecardError) console.error('Error upserting scorecard:', scorecardError);

    console.log(`Successfully calculated behavior-based competency scores for user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        monthYear: monthStart.toISOString().split('T')[0],
        overallScore: Math.round(overallScore * 100) / 100,
        performanceBand,
        scores: scores.map(s => ({
          ...s,
          competency_name: templates.find(t => t.id === s.competency_template_id)?.competency_name
        }))
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error calculating competency scores:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
