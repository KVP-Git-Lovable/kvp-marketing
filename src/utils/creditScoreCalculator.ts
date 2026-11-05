import { supabase } from "@/integrations/supabase/client";

interface CreditScoreResult {
  score: number;
  credit_limit: number;
  growth_rate_score: number;
  repayment_dso_score: number;
  order_frequency_score: number;
  avg_growth_rate: number;
  avg_dso: number;
  avg_order_frequency: number;
  is_new_retailer: boolean;
}

interface CreditConfig {
  lookback_period_months: number;
  weight_growth_rate: number;
  weight_repayment_dso: number;
  weight_order_frequency: number;
  credit_multiplier: number;
  payment_term_days: number;
  new_retailer_starting_score: number;
  target_growth_rate_percent: number | null;
  target_order_frequency: number | null;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export async function calculateCreditScore(retailerId: string): Promise<CreditScoreResult | null> {
  try {
    // 1. Get retailer's territory first
    const { data: retailerData, error: retailerError } = await supabase
      .from('retailers')
      .select('territory_id')
      .eq('id', retailerId)
      .single();

    if (retailerError) {
      console.error('Error fetching retailer:', retailerError);
      return null;
    }

    // 2. Get all active credit configs
    const { data: configs, error: configError } = await supabase
      .from('credit_management_config')
      .select('*')
      .eq('is_enabled', true)
      .eq('is_active', true)
      .eq('scoring_mode', 'ai_driven');

    if (configError || !configs || configs.length === 0) {
      console.log('No active AI-driven credit config found');
      return null;
    }

    // 3. Find matching config - either matching territory or empty territory_ids (global config)
    let config = configs.find(c => {
      const territories = c.territory_ids as string[] || [];
      // If no territories specified, it applies globally
      if (territories.length === 0) return true;
      // If retailer has no territory, use global config only
      if (!retailerData?.territory_id) return territories.length === 0;
      // Check if retailer's territory is in config's territories
      return territories.includes(retailerData.territory_id);
    });

    // Fallback to first config if no match (treat as global)
    if (!config) {
      config = configs[0];
      console.log('No matching territory config, using default config');
    }

    if (!config) {
      console.log('No credit config found');
      return null;
    }

    const cfg: CreditConfig = {
      lookback_period_months: config.lookback_period_months || 3,
      weight_growth_rate: config.weight_growth_rate || 4,
      weight_repayment_dso: config.weight_repayment_dso || 4,
      weight_order_frequency: config.weight_order_frequency || 2,
      credit_multiplier: config.credit_multiplier || 1.5,
      payment_term_days: config.payment_term_days || 30,
      new_retailer_starting_score: config.new_retailer_starting_score || 5,
      target_growth_rate_percent: config.target_growth_rate_percent || 10,
      target_order_frequency: config.target_order_frequency || 2
    };

    // 2. Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - cfg.lookback_period_months);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // 3. Get orders for this retailer
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total_amount, created_at, order_date, is_credit_order, credit_paid_amount')
      .eq('retailer_id', retailerId)
      .in('status', ['confirmed', 'delivered'])
      .gte('created_at', cutoffStr)
      .order('created_at', { ascending: true });

    if (ordersError) throw ordersError;

    // 4. Get visits for this retailer
    const { data: visits, error: visitsError } = await supabase
      .from('visits')
      .select('id, planned_date, status')
      .eq('retailer_id', retailerId)
      .gte('planned_date', cutoffStr);

    if (visitsError) throw visitsError;

    // Check if new retailer (no / too few orders in lookback period)
    if (!orders || orders.length < 2) {
      const startingScore = clampNumber(cfg.new_retailer_starting_score, 0, 10);

      const result: CreditScoreResult = {
        score: startingScore,
        credit_limit: 10000, // Default starting limit
        growth_rate_score: 0,
        repayment_dso_score: 0,
        order_frequency_score: 0,
        avg_growth_rate: 0,
        avg_dso: 0,
        avg_order_frequency: 0,
        is_new_retailer: true
      };
      await saveScore(retailerId, result);
      return result;
    }

    // 5. Calculate Growth Rate Score
    const monthlyRevenue: Record<string, number> = {};
    orders.forEach(order => {
      const month = (order.order_date || order.created_at).substring(0, 7);
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + Number(order.total_amount || 0);
    });

    const months = Object.keys(monthlyRevenue).sort();
    let growthRates: number[] = [];
    for (let i = 1; i < months.length; i++) {
      const prev = monthlyRevenue[months[i - 1]];
      const curr = monthlyRevenue[months[i]];
      if (prev > 0) {
        growthRates.push(((curr - prev) / prev) * 100);
      }
    }
    
    const avgGrowthRate = growthRates.length > 0 
      ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length 
      : 0;
    
    // Normalize growth rate score (0-4 based on target 10%)
    const targetGrowth = cfg.target_growth_rate_percent || 10;
    const growthRateScore = Math.min(4, Math.max(0, (avgGrowthRate / targetGrowth) * 4));

    // 6. Calculate DSO Score (Days Sales Outstanding)
    // For simplicity, use credit orders and their payment patterns
    const creditOrders = orders.filter(o => o.is_credit_order);
    let totalDso = 0;
    let dsoCount = 0;

    // Simplified DSO: If paid, assume fast payment; if unpaid credit, assume delayed
    creditOrders.forEach(order => {
      const paidAmount = Number(order.credit_paid_amount || 0);
      const totalAmount = Number(order.total_amount || 0);
      const paidRatio = totalAmount > 0 ? paidAmount / totalAmount : 1;
      
      // If fully paid, assume 15 days DSO; if unpaid, assume 45 days
      const estimatedDso = paidRatio >= 0.9 ? 15 : (paidRatio >= 0.5 ? 30 : 45);
      totalDso += estimatedDso;
      dsoCount++;
    });

    // For cash orders, assume 0 DSO
    const cashOrders = orders.filter(o => !o.is_credit_order);
    const avgDso = dsoCount > 0 
      ? (totalDso + cashOrders.length * 0) / (dsoCount + cashOrders.length)
      : 0;

    // Normalize DSO score (0-4, lower DSO = higher score)
    const targetDso = cfg.payment_term_days || 30;
    const dsoScore = Math.min(4, Math.max(0, 4 - (avgDso / targetDso) * 2));

    // 7. Calculate Order Frequency Score
    const productiveVisits = visits?.filter(v => v.status === 'productive').length || 0;
    const totalOrders = orders.length;
    const avgOrderFrequency = productiveVisits > 0 ? totalOrders / productiveVisits : totalOrders;
    
    // Normalize order frequency score (0-2)
    const targetFreq = cfg.target_order_frequency || 2;
    const orderFrequencyScore = Math.min(2, Math.max(0, (avgOrderFrequency / targetFreq) * 2));

    // 8. Calculate Final Score (ensure 0-10)
    const weightedScore = (
      (growthRateScore * cfg.weight_growth_rate) +
      (dsoScore * cfg.weight_repayment_dso) +
      (orderFrequencyScore * cfg.weight_order_frequency)
    );

    // Max possible weightedScore when component scores are at their maximums (4, 4, 2)
    const maxPossible = (4 * cfg.weight_growth_rate) + (4 * cfg.weight_repayment_dso) + (2 * cfg.weight_order_frequency);
    const finalScore = clampNumber(maxPossible > 0 ? (weightedScore / maxPossible) * 10 : 0, 0, 10);

    // 9. Calculate Credit Limit
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const denomMonths = Math.max(1, cfg.lookback_period_months);
    const avgMonthlyRevenue = totalRevenue / denomMonths;
    const creditLimit = Math.round(avgMonthlyRevenue * cfg.credit_multiplier * (finalScore / 10));

    const result: CreditScoreResult = {
      score: Math.round(finalScore * 10) / 10, // Round to 1 decimal
      credit_limit: Math.max(5000, creditLimit), // Minimum 5000
      growth_rate_score: Math.round(growthRateScore * 100) / 100,
      repayment_dso_score: Math.round(dsoScore * 100) / 100,
      order_frequency_score: Math.round(orderFrequencyScore * 100) / 100,
      avg_growth_rate: Math.round(avgGrowthRate * 100) / 100,
      avg_dso: Math.round(avgDso * 10) / 10,
      avg_order_frequency: Math.round(avgOrderFrequency * 100) / 100,
      is_new_retailer: false
    };

    await saveScore(retailerId, result);
    return result;

  } catch (error) {
    console.error('Error calculating credit score:', error);
    return null;
  }
}

async function saveScore(retailerId: string, result: CreditScoreResult): Promise<void> {
  try {
    const { error } = await supabase
      .from('retailer_credit_scores')
      .upsert({
        retailer_id: retailerId,
        score: result.score,
        credit_limit: result.credit_limit,
        growth_rate_score: result.growth_rate_score,
        repayment_dso_score: result.repayment_dso_score,
        order_frequency_score: result.order_frequency_score,
        avg_growth_rate: result.avg_growth_rate,
        avg_dso: result.avg_dso,
        avg_order_frequency: result.avg_order_frequency,
        calculated_at: new Date().toISOString()
      }, {
        onConflict: 'retailer_id'
      });

    if (error) throw error;
    console.log('Credit score saved for retailer:', retailerId);
  } catch (error) {
    console.error('Error saving credit score:', error);
  }
}
