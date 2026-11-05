import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Thresholds (config-driven) ──
const THRESHOLDS = {
  revenue_drop_pct: 15,
  conversion_drop_pct: 10,
  high_value_inactive_count: 2,
  coverage_min_pct: 70,
  concentration_risk_pct: 40,
  sku_penetration_min_pct: 50,
};

const WEIGHTS = {
  revenue: 0.25,
  coverage: 0.20,
  conversion: 0.20,
  retailer_activity: 0.15,
  productivity: 0.10,
  sku_penetration: 0.10,
};

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function revenueScore(growthPct: number): number {
  if (growthPct >= 10) return 100;
  if (growthPct >= 0) return 70 + (growthPct / 10) * 30;
  if (growthPct >= -15) return 40 + ((growthPct + 15) / 15) * 30;
  if (growthPct >= -30) return ((growthPct + 30) / 15) * 40;
  return 0;
}

function retailerActivityScore(total: number, inactive: number): number {
  if (total === 0) return 50;
  const activeRatio = (total - inactive) / total;
  return clamp(activeRatio * 100);
}

function productivityScore(avgOrderValue: number): number {
  // Benchmark: ₹5000 avg order value = 100
  if (avgOrderValue >= 5000) return 100;
  return clamp((avgOrderValue / 5000) * 100);
}

function getStatus(score: number) {
  if (score >= 85) return "excellent";
  if (score >= 70) return "stable";
  if (score >= 50) return "needs_attention";
  return "critical";
}

function getSeverity(score: number) {
  if (score >= 85) return "success";
  if (score >= 70) return "info";
  if (score >= 50) return "warning";
  return "critical";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { beatId } = await req.json();
    if (!beatId) {
      return new Response(JSON.stringify({ error: "beatId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Date ranges ──
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split("T")[0];
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];

    // ── Step 1: Data Fetching ──

    // 1a. Retailers in beat
    const { data: retailers } = await supabase
      .from("retailers")
      .select("id, name, category, created_at, last_order_date, last_visit_date, potential")
      .eq("beat_id", beatId);

    const retailerIds = retailers?.map((r: any) => r.id) || [];
    const totalRetailers = retailerIds.length;

    if (totalRetailers === 0) {
      const emptyResult = {
        health_score: 0,
        status: "critical",
        summary: "No retailers assigned to this beat. Add retailers to start tracking performance.",
        recommended_actions: ["Add retailers to this beat to begin tracking"],
        severity_level: "critical",
        risk_signals: ["no_retailers"],
        data_points: {
          revenue: { mtd: 0, last_month: 0, three_month_avg: 0, growth_pct: 0, yoy_pct: 0 },
          retailer_activity: { total: 0, active: 0, inactive_30d: 0, new_this_month: 0, lost_60d: 0 },
          coverage: { planned: 0, completed: 0, missed: 0, coverage_pct: 0, avg_per_retailer: 0 },
          conversion: { total_visits: 0, orders: 0, rate_pct: 0, avg_billing: 0 },
          productivity: { working_days: 0, orders_per_day: 0, revenue_per_day: 0, avg_order_value: 0 },
          sku_penetration: { catalog: 0, sold: 0, pct: 0, top_5: [], slow_moving: [], concentration_risk: 0 },
        },
        timestamp: now.toISOString(),
      };
      return new Response(JSON.stringify(emptyResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1b. Orders (last 90 days) - batch fetch to avoid limit
    const { data: orders90d } = await supabase
      .from("orders")
      .select("id, retailer_id, total_amount, order_date, visit_id, status")
      .in("retailer_id", retailerIds)
      .gte("order_date", ninetyDaysAgo)
      .eq("status", "confirmed");

    // 1c. Order items for SKU analysis
    const orderIds = orders90d?.map((o: any) => o.id) || [];
    let orderItems: any[] = [];
    if (orderIds.length > 0) {
      // Batch in chunks of 100
      for (let i = 0; i < orderIds.length; i += 100) {
        const chunk = orderIds.slice(i, i + 100);
        const { data } = await supabase
          .from("order_items")
          .select("product_id, product_name, quantity, total")
          .in("order_id", chunk);
        if (data) orderItems = orderItems.concat(data);
      }
    }

    // 1d. Visits (last 90 days)
    const { data: visits90d } = await supabase
      .from("visits")
      .select("id, retailer_id, planned_date, status, visit_id")
      .in("retailer_id", retailerIds)
      .eq("user_id", userId)
      .gte("planned_date", ninetyDaysAgo);

    // 1e. Attendance (current month)
    const { data: attendance } = await supabase
      .from("attendance")
      .select("id, status")
      .eq("user_id", userId)
      .gte("date", monthStart)
      .lte("date", today)
      .in("status", ["present", "regularized"]);

    // 1f. Products catalog
    const { data: products, count: productCount } = await supabase
      .from("products")
      .select("id", { count: "exact" })
      .eq("is_active", true);

    // ── Step 2: KPI Computation ──

    // Revenue
    const mtdOrders = orders90d?.filter((o: any) => o.order_date >= monthStart) || [];
    const mtdRevenue = mtdOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);

    const lastMonthOrders = orders90d?.filter(
      (o: any) => o.order_date >= lastMonthStart && o.order_date <= lastMonthEnd
    ) || [];
    const lastMonthRevenue = lastMonthOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);

    const threeMonthOrders = orders90d?.filter((o: any) => o.order_date >= threeMonthsAgo) || [];
    const threeMonthRevenue = threeMonthOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
    const threeMonthAvg = threeMonthRevenue / 3;

    const growthPct = lastMonthRevenue > 0
      ? ((mtdRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    // YoY - simplified (compare MTD vs same period last year would need more data, use growth for now)
    const yoyPct = growthPct; // Simplified

    // Retailer Activity
    const activeRetailerIds = new Set(mtdOrders.map((o: any) => o.retailer_id));
    const activeCount = activeRetailerIds.size;

    const inactive30d = retailers?.filter(
      (r: any) => !r.last_order_date || r.last_order_date < thirtyDaysAgo
    ).length || 0;

    const newThisMonth = retailers?.filter(
      (r: any) => r.created_at && r.created_at >= monthStart
    ).length || 0;

    const lost60d = retailers?.filter(
      (r: any) => !r.last_order_date || r.last_order_date < sixtyDaysAgo
    ).length || 0;

    // High-value inactive (A/B category with no recent order)
    const highValueInactive = retailers?.filter(
      (r: any) =>
        (r.category === "A" || r.category === "B") &&
        (!r.last_order_date || r.last_order_date < thirtyDaysAgo)
    ).length || 0;

    // Visit Coverage (current month)
    const currentMonthVisits = visits90d?.filter(
      (v: any) => v.planned_date >= monthStart && v.planned_date <= today
    ) || [];
    const plannedVisits = currentMonthVisits.length;
    const completedVisits = currentMonthVisits.filter(
      (v: any) => v.status === "completed" || v.status === "productive"
    ).length;
    const missedVisits = currentMonthVisits.filter(
      (v: any) =>
        v.planned_date < today &&
        v.status !== "completed" &&
        v.status !== "productive" &&
        v.status !== "unproductive"
    ).length;
    const coveragePct = plannedVisits > 0 ? (completedVisits / plannedVisits) * 100 : 0;
    const avgVisitsPerRetailer = totalRetailers > 0 ? plannedVisits / totalRetailers : 0;

    // Conversion
    const allCompletedVisits = visits90d?.filter(
      (v: any) => v.status === "completed" || v.status === "productive" || v.status === "unproductive"
    ) || [];
    const totalVisitsForConversion = allCompletedVisits.length;
    const visitsWithOrders = allCompletedVisits.filter(
      (v: any) => orders90d?.some((o: any) => o.visit_id === v.id)
    ).length;
    const conversionPct = totalVisitsForConversion > 0
      ? (visitsWithOrders / totalVisitsForConversion) * 100
      : 0;
    const totalOrderRevenue = orders90d?.reduce((s: number, o: any) => s + (o.total_amount || 0), 0) || 0;
    const avgBillingPerVisit = visitsWithOrders > 0 ? totalOrderRevenue / visitsWithOrders : 0;

    // Productivity
    const workingDays = attendance?.length || 0;
    const totalOrdersCount = orders90d?.length || 0;
    const ordersPerDay = workingDays > 0 ? totalOrdersCount / workingDays : 0;
    const revenuePerDay = workingDays > 0 ? totalOrderRevenue / workingDays : 0;
    const avgOrderValue = totalOrdersCount > 0 ? totalOrderRevenue / totalOrdersCount : 0;

    // SKU Penetration
    const catalogTotal = productCount || 0;
    const skusSoldSet = new Set(orderItems.map((oi: any) => oi.product_id));
    const skusSold = skusSoldSet.size;
    const skuPenetrationPct = catalogTotal > 0 ? (skusSold / catalogTotal) * 100 : 0;

    // Top 5 SKUs by revenue
    const skuRevMap: Record<string, { name: string; revenue: number; qty: number }> = {};
    orderItems.forEach((oi: any) => {
      const key = oi.product_id || oi.product_name;
      if (!skuRevMap[key]) skuRevMap[key] = { name: oi.product_name, revenue: 0, qty: 0 };
      skuRevMap[key].revenue += oi.total || 0;
      skuRevMap[key].qty += oi.quantity || 0;
    });
    const skuList = Object.values(skuRevMap).sort((a, b) => b.revenue - a.revenue);
    const top5Skus = skuList.slice(0, 5).map((s) => ({
      name: s.name,
      revenue: Math.round(s.revenue),
      quantity: s.qty,
    }));

    // Slow-moving SKUs (sold < 5 qty in 90 days)
    const slowMoving = skuList
      .filter((s) => s.qty > 0 && s.qty < 5)
      .slice(0, 5)
      .map((s) => ({ name: s.name, quantity: s.qty }));

    // Concentration risk: top 3 retailer revenue / total
    const retailerRevMap: Record<string, number> = {};
    orders90d?.forEach((o: any) => {
      retailerRevMap[o.retailer_id] = (retailerRevMap[o.retailer_id] || 0) + (o.total_amount || 0);
    });
    const retailerRevList = Object.values(retailerRevMap).sort((a, b) => b - a);
    const top3Revenue = retailerRevList.slice(0, 3).reduce((s, v) => s + v, 0);
    const concentrationRisk = totalOrderRevenue > 0 ? (top3Revenue / totalOrderRevenue) * 100 : 0;

    // ── Step 3: Rule Engine ──
    const riskSignals: string[] = [];

    if (growthPct < -THRESHOLDS.revenue_drop_pct) riskSignals.push("revenue_drop");
    if (conversionPct < 100 - THRESHOLDS.conversion_drop_pct * 3) riskSignals.push("low_conversion");
    if (highValueInactive >= THRESHOLDS.high_value_inactive_count) riskSignals.push("high_value_inactive");
    if (coveragePct < THRESHOLDS.coverage_min_pct && plannedVisits > 0) riskSignals.push("low_coverage");
    if (concentrationRisk > THRESHOLDS.concentration_risk_pct) riskSignals.push("concentration_risk");
    if (skuPenetrationPct < THRESHOLDS.sku_penetration_min_pct && catalogTotal > 0) riskSignals.push("low_sku_penetration");

    // ── Step 4: Health Score ──
    const revScore = revenueScore(growthPct);
    const covScore = clamp(coveragePct);
    const convScore = clamp((conversionPct / 80) * 100);
    const retScore = retailerActivityScore(totalRetailers, inactive30d);
    const prodScore = productivityScore(avgOrderValue);
    const skuScore = clamp(skuPenetrationPct);

    const healthScore = Math.round(
      revScore * WEIGHTS.revenue +
      covScore * WEIGHTS.coverage +
      convScore * WEIGHTS.conversion +
      retScore * WEIGHTS.retailer_activity +
      prodScore * WEIGHTS.productivity +
      skuScore * WEIGHTS.sku_penetration
    );

    const status = getStatus(healthScore);
    const severityLevel = getSeverity(healthScore);

    // ── Step 5: AI Summary ──
    const dataContext = {
      healthScore,
      status,
      riskSignals,
      revenue: { mtd: mtdRevenue, lastMonth: lastMonthRevenue, growthPct: Math.round(growthPct) },
      retailers: { total: totalRetailers, active: activeCount, inactive30d: inactive30d, highValueInactive },
      coverage: { planned: plannedVisits, completed: completedVisits, pct: Math.round(coveragePct) },
      conversion: { visits: totalVisitsForConversion, orders: visitsWithOrders, pct: Math.round(conversionPct) },
      skuPenetration: { catalog: catalogTotal, sold: skusSold, pct: Math.round(skuPenetrationPct) },
    };

    let summary = "";
    let recommendedActions: string[] = [];

    try {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (openaiKey) {
        const prompt = `You are a sales performance analyst. Given these pre-computed KPIs for a sales beat, generate:
1. A concise 1-2 sentence summary of beat health
2. 3-5 specific, actionable recommendations

Data:
${JSON.stringify(dataContext, null, 2)}

Risk signals triggered: ${riskSignals.join(", ") || "none"}

Respond in JSON format:
{"summary": "...", "actions": ["action1", "action2", ...]}

Be specific with numbers. Use ₹ for currency. Keep actions practical for a field sales rep.`;

        const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 500,
            response_format: { type: "json_object" },
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const parsed = JSON.parse(aiData.choices[0].message.content);
          summary = parsed.summary || "";
          recommendedActions = parsed.actions || [];
        }
      }
    } catch (e) {
      console.error("AI summary generation failed, using fallback:", e);
    }

    // Fallback summary
    if (!summary) {
      const parts: string[] = [];
      if (riskSignals.includes("revenue_drop")) parts.push(`Revenue dropped ${Math.abs(Math.round(growthPct))}% vs last month.`);
      if (riskSignals.includes("high_value_inactive")) parts.push(`${highValueInactive} high-value retailers are inactive.`);
      if (riskSignals.includes("low_coverage")) parts.push(`Visit coverage is at ${Math.round(coveragePct)}%.`);
      if (riskSignals.includes("low_conversion")) parts.push(`Conversion rate is ${Math.round(conversionPct)}%.`);
      summary = parts.length > 0
        ? `Beat needs attention. ${parts.join(" ")}`
        : `Beat is performing ${status === "excellent" ? "excellently" : status === "stable" ? "steadily" : "below expectations"} with a health score of ${healthScore}/100.`;
    }

    if (recommendedActions.length === 0) {
      if (riskSignals.includes("high_value_inactive"))
        recommendedActions.push(`Visit ${highValueInactive} inactive A/B-category retailers this week`);
      if (riskSignals.includes("low_coverage"))
        recommendedActions.push(`Improve visit coverage from ${Math.round(coveragePct)}% to at least 70%`);
      if (riskSignals.includes("low_conversion"))
        recommendedActions.push(`Focus on converting visits to orders (currently ${Math.round(conversionPct)}%)`);
      if (riskSignals.includes("low_sku_penetration"))
        recommendedActions.push(`Increase SKU penetration from ${Math.round(skuPenetrationPct)}% - pitch underperforming products`);
      if (riskSignals.includes("revenue_drop"))
        recommendedActions.push(`Address revenue decline by targeting top-potential retailers`);
      if (recommendedActions.length === 0)
        recommendedActions.push("Maintain current performance and explore growth opportunities");
    }

    // ── Step 6: Response ──
    const result = {
      health_score: healthScore,
      status,
      summary,
      recommended_actions: recommendedActions,
      severity_level: severityLevel,
      risk_signals: riskSignals,
      data_points: {
        revenue: {
          mtd: Math.round(mtdRevenue),
          last_month: Math.round(lastMonthRevenue),
          three_month_avg: Math.round(threeMonthAvg),
          growth_pct: Math.round(growthPct * 10) / 10,
          yoy_pct: Math.round(yoyPct * 10) / 10,
        },
        retailer_activity: {
          total: totalRetailers,
          active: activeCount,
          inactive_30d: inactive30d,
          new_this_month: newThisMonth,
          lost_60d: lost60d,
        },
        coverage: {
          planned: plannedVisits,
          completed: completedVisits,
          missed: missedVisits,
          coverage_pct: Math.round(coveragePct * 10) / 10,
          avg_per_retailer: Math.round(avgVisitsPerRetailer * 10) / 10,
        },
        conversion: {
          total_visits: totalVisitsForConversion,
          orders: visitsWithOrders,
          rate_pct: Math.round(conversionPct * 10) / 10,
          avg_billing: Math.round(avgBillingPerVisit),
        },
        productivity: {
          working_days: workingDays,
          orders_per_day: Math.round(ordersPerDay * 10) / 10,
          revenue_per_day: Math.round(revenuePerDay),
          avg_order_value: Math.round(avgOrderValue),
        },
        sku_penetration: {
          catalog: catalogTotal,
          sold: skusSold,
          pct: Math.round(skuPenetrationPct * 10) / 10,
          top_5: top5Skus,
          slow_moving: slowMoving,
          concentration_risk: Math.round(concentrationRisk * 10) / 10,
        },
      },
      timestamp: now.toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("beat-health-insights error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message || "Internal server error" : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
