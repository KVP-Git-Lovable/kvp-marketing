import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ReportContext {
  dateRange: { from: string; to: string };
  allUsersSummary: {
    retailers: number;
    beats: number;
    products: number;
    totalKg: number;
  } | null;
  orderSummaryData: Array<{
    full_name: string;
    total_order_value: number;
  }>;
  skuData: Array<{
    product_name: string;
    quantity_sold: number;
    revenue: number;
    unit: string;
  }>;
  productivityData: Array<{
    full_name: string;
    productivity_percentage: number;
    productive_visits: number;
    total_visits: number;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { question, reportContext } = await req.json() as { question: string; reportContext: ReportContext };
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Lovable AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!question) {
      console.error("No question provided");
      return new Response(
        JSON.stringify({ error: "Question is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing question: "${question}"`);

    // Build context from report data
    const contextParts: string[] = [];
    
    contextParts.push(`Report Date Range: ${reportContext.dateRange?.from || 'N/A'} to ${reportContext.dateRange?.to || 'N/A'}`);
    
    if (reportContext.allUsersSummary) {
      contextParts.push(`\nOverall Summary:
- Total Retailers: ${reportContext.allUsersSummary.retailers}
- Total Beats: ${reportContext.allUsersSummary.beats}
- Total Products: ${reportContext.allUsersSummary.products}
- Total Quantity: ${reportContext.allUsersSummary.totalKg.toFixed(2)} KG`);
    }

    if (reportContext.orderSummaryData?.length > 0) {
      const totalOrderValue = reportContext.orderSummaryData.reduce((sum, u) => sum + u.total_order_value, 0);
      const topUser = reportContext.orderSummaryData[0];
      contextParts.push(`\nOrder Summary:
- Total Users: ${reportContext.orderSummaryData.length}
- Total Order Value: ₹${totalOrderValue.toLocaleString('en-IN')}
- Top Performer by Orders: ${topUser?.full_name} (₹${topUser?.total_order_value.toLocaleString('en-IN')})
- All Users by Order Value: ${reportContext.orderSummaryData.map(u => `${u.full_name}: ₹${u.total_order_value.toLocaleString('en-IN')}`).join(', ')}`);
    }

    if (reportContext.skuData?.length > 0) {
      const totalRevenue = reportContext.skuData.reduce((sum, s) => sum + s.revenue, 0);
      const totalKg = reportContext.skuData.reduce((sum, s) => {
        const unit = (s.unit || '').toLowerCase();
        if (unit === 'grams' || unit === 'g' || unit === 'gram') {
          return sum + s.quantity_sold / 1000;
        }
        return sum + s.quantity_sold;
      }, 0);
      const topProduct = reportContext.skuData.reduce((max, s) => s.revenue > max.revenue ? s : max, reportContext.skuData[0]);
      
      contextParts.push(`\nSKU Revenue Summary:
- Total SKUs: ${reportContext.skuData.length}
- Total Revenue: ₹${totalRevenue.toLocaleString('en-IN')}
- Total Quantity: ${totalKg.toFixed(2)} KG
- Top Selling Product: ${topProduct?.product_name} (₹${topProduct?.revenue.toLocaleString('en-IN')})
- All Products: ${reportContext.skuData.slice(0, 10).map(s => `${s.product_name}: ₹${s.revenue.toLocaleString('en-IN')}, ${s.quantity_sold} ${s.unit}`).join('; ')}${reportContext.skuData.length > 10 ? '...' : ''}`);
    }

    if (reportContext.productivityData?.length > 0) {
      const totalProductive = reportContext.productivityData.reduce((sum, p) => sum + p.productive_visits, 0);
      const totalVisits = reportContext.productivityData.reduce((sum, p) => sum + p.total_visits, 0);
      const avgProductivity = totalVisits > 0 ? (totalProductive / totalVisits) * 100 : 0;
      const topProductiveUser = reportContext.productivityData.reduce((max, p) => 
        p.productivity_percentage > max.productivity_percentage ? p : max, reportContext.productivityData[0]
      );
      
      contextParts.push(`\nProductivity Summary:
- Total Productive Visits: ${totalProductive} / ${totalVisits}
- Overall Productivity: ${avgProductivity.toFixed(1)}%
- Top Productive User: ${topProductiveUser?.full_name} (${topProductiveUser?.productivity_percentage.toFixed(1)}%)
- All Users Productivity: ${reportContext.productivityData.map(p => `${p.full_name}: ${p.productivity_percentage.toFixed(1)}% (${p.productive_visits}/${p.total_visits})`).join(', ')}`);
    }

    const reportData = contextParts.join('\n');
    
    console.log("Report data being sent to AI:", reportData);

    const systemPrompt = `You are a sales report assistant. You MUST answer questions ONLY using the exact data provided below. Do NOT invent, assume, or hallucinate any names, products, or numbers.

REPORT DATA:
${reportData}

STRICT RULES:
1. ONLY use names, products, and numbers that appear EXACTLY in the report data above
2. If the data is empty or missing, say "I don't have that data in the current report"
3. NEVER make up fictional names like "Anjali Sharma" or products like "Blue Denim Jacket"
4. Be concise - under 100 words
5. For currency, ALWAYS write "Rupees" followed by the number (e.g., "Rupees 50,000"). NEVER use the ₹ symbol.
6. Format responses for text-to-speech: no special characters, spell out numbers naturally, speak lists conversationally
7. If asked about something not in the data, say "That information is not available in the current report"`;

    console.log("Calling Lovable AI Gateway...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Lovable AI Gateway error: ${response.status} - ${errorText}`);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `AI Gateway error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    console.log(`Generated answer: "${answer.substring(0, 100)}..."`);

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in report-voice-assistant:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
