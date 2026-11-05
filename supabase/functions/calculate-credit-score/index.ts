import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { retailer_id } = await req.json();

    if (!retailer_id) {
      throw new Error("retailer_id is required");
    }

    // Get retailer data first
    const { data: retailer, error: retailerError } = await supabase
      .from("retailers")
      .select("*")
      .eq("id", retailer_id)
      .single();

    if (retailerError) throw retailerError;

    // Get all active configurations
    const { data: configs, error: configsError } = await supabase
      .from("credit_management_config")
      .select("*")
      .eq("is_active", true)
      .eq("is_enabled", true)
      .eq("scoring_mode", "ai_driven");

    if (configsError) throw configsError;

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active AI-driven scoring configurations found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Find the configuration that matches the retailer's territory
    let config = null;
    if (retailer.territory_id) {
      config = configs.find(c => c.territory_ids && c.territory_ids.includes(retailer.territory_id));
    }

    // If no territory-specific config found, check for a default config (empty territory_ids)
    if (!config) {
      config = configs.find(c => !c.territory_ids || c.territory_ids.length === 0);
    }

    // If still no config found, use the first active config as fallback
    if (!config) {
      config = configs[0];
    }

    // Calculate cutoff date based on lookback period
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - config.lookback_period_months);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Get orders for the retailer in the lookback period
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("total_amount, created_at, payment_received_date")
      .eq("retailer_id", retailer_id)
      .gte("created_at", cutoffDateStr)
      .order("created_at", { ascending: true });

    if (ordersError) throw ordersError;

    // Get visits with orders in the lookback period
    const { data: visits, error: visitsError } = await supabase
      .from("visits")
      .select("id, visit_date")
      .eq("retailer_id", retailer_id)
      .gte("visit_date", cutoffDateStr);

    if (visitsError) throw visitsError;

    const totalVisits = visits?.length || 0;
    const totalOrders = orders?.length || 0;

    // Check if retailer has sufficient data
    const retailerCreatedDate = new Date(retailer.created_at);
    const monthsSinceCreation = (Date.now() - retailerCreatedDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsSinceCreation < config.lookback_period_months || totalOrders < 2) {
      // New retailer - assign default score
      const newRetailerScore = {
        retailer_id,
        score: config.new_retailer_starting_score,
        credit_limit: 0,
        score_type: 'ai_driven',
        growth_rate_score: null,
        repayment_dso_score: null,
        order_frequency_score: null,
        avg_growth_rate: null,
        avg_dso: null,
        avg_order_frequency: null,
        last_month_revenue: 0,
        calculated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from("retailer_credit_scores")
        .upsert(newRetailerScore, { onConflict: 'retailer_id' })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data, isNewRetailer: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate metrics
    // 1. Average Growth Rate
    const monthlyRevenues: { [key: string]: number } = {};
    orders.forEach(order => {
      const month = order.created_at.substring(0, 7); // YYYY-MM
      monthlyRevenues[month] = (monthlyRevenues[month] || 0) + (order.total_amount || 0);
    });

    const monthKeys = Object.keys(monthlyRevenues).sort();
    let totalGrowthRate = 0;
    let growthRateCount = 0;

    for (let i = 1; i < monthKeys.length; i++) {
      const prevRevenue = monthlyRevenues[monthKeys[i - 1]];
      const currentRevenue = monthlyRevenues[monthKeys[i]];
      if (prevRevenue > 0) {
        const growthRate = ((currentRevenue - prevRevenue) / prevRevenue) * 100;
        totalGrowthRate += growthRate;
        growthRateCount++;
      }
    }

    const avgGrowthRate = growthRateCount > 0 ? totalGrowthRate / growthRateCount : 0;

    // Normalize growth rate to score (0-10% = 0 points, 10-30% = proportional, >30% = max)
    let growthRateScore = 0;
    if (avgGrowthRate <= 0) {
      growthRateScore = 0;
    } else if (avgGrowthRate >= 30) {
      growthRateScore = config.weight_growth_rate;
    } else {
      growthRateScore = (avgGrowthRate / 30) * config.weight_growth_rate;
    }

    // 2. Repayment DSO (Days Sales Outstanding)
    let totalDSO = 0;
    let dsoCount = 0;

    orders.forEach(order => {
      if (order.payment_received_date) {
        const orderDate = new Date(order.created_at);
        const paymentDate = new Date(order.payment_received_date);
        const dso = Math.floor((paymentDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
        if (dso >= 0) {
          totalDSO += dso;
          dsoCount++;
        }
      }
    });

    const avgDSO = dsoCount > 0 ? totalDSO / dsoCount : config.payment_term_days;

    // Normalize DSO to score (<=payment_term = max points, >2*payment_term = 0 points)
    let dsoScore = 0;
    if (avgDSO <= config.payment_term_days) {
      dsoScore = config.weight_repayment_dso;
    } else if (avgDSO >= 2 * config.payment_term_days) {
      dsoScore = 0;
    } else {
      const ratio = (2 * config.payment_term_days - avgDSO) / config.payment_term_days;
      dsoScore = ratio * config.weight_repayment_dso;
    }

    // 3. Order Frequency (orders per visit)
    const avgOrderFrequency = totalVisits > 0 ? totalOrders / totalVisits : 0;

    // Normalize order frequency to score (0.5 = half points, 1.0+ = max points)
    let orderFrequencyScore = 0;
    if (avgOrderFrequency >= 1.0) {
      orderFrequencyScore = config.weight_order_frequency;
    } else if (avgOrderFrequency > 0) {
      orderFrequencyScore = avgOrderFrequency * config.weight_order_frequency;
    }

    // Calculate final score
    const finalScore = Math.min(10, Math.max(0, growthRateScore + dsoScore + orderFrequencyScore));

    // Get last month's revenue
    const lastMonth = monthKeys[monthKeys.length - 1];
    const lastMonthRevenue = monthlyRevenues[lastMonth] || 0;

    // Calculate credit limit
    const creditLimit = lastMonthRevenue * config.credit_multiplier;

    // Save score
    const creditScoreData = {
      retailer_id,
      score: Math.round(finalScore * 10) / 10,
      credit_limit: Math.round(creditLimit * 100) / 100,
      score_type: 'ai_driven',
      growth_rate_score: Math.round(growthRateScore * 10) / 10,
      repayment_dso_score: Math.round(dsoScore * 10) / 10,
      order_frequency_score: Math.round(orderFrequencyScore * 10) / 10,
      avg_growth_rate: Math.round(avgGrowthRate * 100) / 100,
      avg_dso: Math.round(avgDSO * 100) / 100,
      avg_order_frequency: Math.round(avgOrderFrequency * 100) / 100,
      last_month_revenue: Math.round(lastMonthRevenue * 100) / 100,
      calculated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("retailer_credit_scores")
      .upsert(creditScoreData, { onConflict: 'retailer_id' })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error calculating credit score:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});