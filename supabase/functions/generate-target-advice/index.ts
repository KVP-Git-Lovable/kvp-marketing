import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const motivationalQuotes = [
  "Success is not final, failure is not fatal: it is the courage to continue that counts. – Winston Churchill",
  "The only way to do great work is to love what you do. – Steve Jobs",
  "Don't watch the clock; do what it does. Keep going. – Sam Levenson",
  "Believe you can and you're halfway there. – Theodore Roosevelt",
  "The future belongs to those who believe in the beauty of their dreams. – Eleanor Roosevelt",
  "It does not matter how slowly you go as long as you do not stop. – Confucius",
  "Success usually comes to those who are too busy to be looking for it. – Henry David Thoreau",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Don't be afraid to give up the good to go for the great. – John D. Rockefeller",
  "I find that the harder I work, the more luck I seem to have. – Thomas Jefferson",
  "Success is walking from failure to failure with no loss of enthusiasm. – Winston Churchill",
  "The only limit to our realization of tomorrow is our doubts of today. – Franklin D. Roosevelt",
  "Your limitation—it's only your imagination.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it.",
  "Success doesn't just find you. You have to go out and get it.",
  "The way to get started is to quit talking and begin doing. – Walt Disney",
  "It's not whether you get knocked down, it's whether you get up. – Vince Lombardi",
  "If you want to achieve excellence, you can get there today. – Brian Tracy"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { period, overall, territories, beats, retailers } = await req.json();

    // Get random motivational quote
    const quote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];

    // Fetch additional context: recent orders, schemes, visit history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch recent orders for pattern analysis
    const { data: recentOrders } = await supabase
      .from('orders')
      .select(`
        id, 
        total_amount, 
        retailer_id,
        created_at,
        retailers!inner(id, name, beat_id)
      `)
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    // Fetch active schemes from product_schemes table
    const { data: activeSchemes } = await supabase
      .from('product_schemes')
      .select('id, name, description, start_date, end_date, scheme_type')
      .eq('is_active', true)
      .gte('end_date', new Date().toISOString())
      .limit(10);

    // Fetch user's beat plan for today/upcoming
    const today = new Date().toISOString().split('T')[0];
    const { data: beatPlans } = await supabase
      .from('beat_plans')
      .select('id, beat_id, beat_name, plan_date')
      .eq('user_id', user.id)
      .gte('plan_date', today)
      .order('plan_date', { ascending: true })
      .limit(7);

    // Build context for AI
    const contextData = {
      period,
      overall: {
        revenueTarget: overall.revenueTarget,
        revenueActual: overall.revenueActual,
        revenueProgress: overall.revenueProgress,
        revenueGap: overall.revenueGap,
        quantityTarget: overall.quantityTarget,
        quantityActual: overall.quantityActual,
        quantityProgress: overall.quantityProgress,
        quantityGap: overall.quantityGap,
        quantityUnit: overall.quantityUnit,
      },
      underperformingTerritories: territories
        .filter((t: any) => t.revenueProgress < 80)
        .slice(0, 5)
        .map((t: any) => ({
          name: t.name,
          progress: t.revenueProgress,
          gap: t.revenueGap,
        })),
      underperformingRetailers: retailers
        .filter((r: any) => r.revenueProgress < 50 && r.revenueTarget > 0)
        .slice(0, 10)
        .map((r: any) => ({
          name: r.name,
          id: r.id,
          progress: r.revenueProgress,
          gap: r.revenueGap,
        })),
      topPerformingRetailers: retailers
        .filter((r: any) => r.revenueProgress >= 100)
        .slice(0, 5)
        .map((r: any) => ({
          name: r.name,
          progress: r.revenueProgress,
        })),
      inactiveBeats: beats
        .filter((b: any) => b.revenueActual === 0)
        .map((b: any) => b.name),
      activeBeats: beats
        .filter((b: any) => b.revenueActual > 0)
        .slice(0, 5)
        .map((b: any) => ({
          name: b.name,
          revenue: b.revenueActual,
        })),
      activeSchemes: activeSchemes?.map(s => ({
        name: s.name,
        type: s.scheme_type,
        endDate: s.end_date,
      })) || [],
      upcomingBeatPlans: beatPlans?.map(bp => ({
        beatName: bp.beat_name,
        date: bp.plan_date,
      })) || [],
      recentOrdersCount: recentOrders?.length || 0,
    };

    const systemPrompt = `You are an expert sales coach for field sales representatives. Your job is to analyze their performance data and provide specific, actionable recommendations to help them achieve their targets.

Always be encouraging but practical. Focus on:
1. Specific retailers to visit and why
2. Which beats need more attention
3. Which schemes to leverage
4. Daily/weekly action priorities
5. Quick wins vs medium-term strategies

Format your response as a JSON object with the following structure:
{
  "summary": "A brief 2-3 sentence overview of the current situation and what needs focus",
  "priorityActions": [
    {
      "title": "Action title",
      "description": "Detailed description of what to do",
      "type": "visit|scheme|focus|strategy",
      "priority": "high|medium|low",
      "retailer": "retailer name if applicable or null",
      "beat": "beat name if applicable or null",
      "expectedImpact": "Expected revenue or quantity impact"
    }
  ],
  "retailerFocus": [
    {
      "name": "Retailer name",
      "reason": "Why focus on this retailer",
      "suggestedAction": "What to do when visiting"
    }
  ],
  "beatStrategy": [
    {
      "beatName": "Beat name",
      "recommendation": "What to do in this beat"
    }
  ],
  "schemeOpportunities": [
    {
      "schemeName": "Scheme name",
      "howToLeverage": "How to use this scheme to boost sales"
    }
  ],
  "weeklyPlan": {
    "day1": "What to focus on first",
    "day2": "Second priority",
    "day3": "Third priority"
  }
}`;

    const userPrompt = `Analyze this sales performance data and provide actionable recommendations:

Period: ${contextData.period}

OVERALL PERFORMANCE:
- Revenue: ₹${contextData.overall.revenueActual.toLocaleString()} of ₹${contextData.overall.revenueTarget.toLocaleString()} target (${contextData.overall.revenueProgress}%)
- Gap to cover: ₹${contextData.overall.revenueGap.toLocaleString()}
- Quantity: ${contextData.overall.quantityActual} of ${contextData.overall.quantityTarget} ${contextData.overall.quantityUnit} (${contextData.overall.quantityProgress}%)

UNDERPERFORMING TERRITORIES (need attention):
${contextData.underperformingTerritories.length > 0 
  ? contextData.underperformingTerritories.map((t: any) => `- ${t.name}: ${t.progress}% achieved, ₹${t.gap.toLocaleString()} gap`).join('\n')
  : '- All territories performing well'}

UNDERPERFORMING RETAILERS (below 50%):
${contextData.underperformingRetailers.length > 0 
  ? contextData.underperformingRetailers.map((r: any) => `- ${r.name}: ${r.progress}% achieved, ₹${r.gap.toLocaleString()} gap`).join('\n')
  : '- No significantly underperforming retailers'}

TOP PERFORMING RETAILERS (exceeding targets):
${contextData.topPerformingRetailers.length > 0 
  ? contextData.topPerformingRetailers.map((r: any) => `- ${r.name}: ${r.progress}% achieved`).join('\n')
  : '- No retailers exceeding targets yet'}

BEATS WITHOUT ORDERS:
${contextData.inactiveBeats.length > 0 
  ? contextData.inactiveBeats.join(', ')
  : 'All beats have orders'}

ACTIVE SCHEMES TO LEVERAGE:
${contextData.activeSchemes.length > 0 
  ? contextData.activeSchemes.map((s: any) => `- ${s.name} (${s.type}) - ends ${s.endDate}`).join('\n')
  : '- No active schemes currently'}

UPCOMING BEAT PLANS:
${contextData.upcomingBeatPlans.length > 0 
  ? contextData.upcomingBeatPlans.map((bp: any) => `- ${bp.beatName} on ${bp.date}`).join('\n')
  : '- No beat plans scheduled'}

Based on this data, provide specific, actionable recommendations to help achieve the target. Focus on practical daily actions.`;

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again in a moment.',
          quote 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'AI credits exhausted. Please contact support.',
          quote 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error('Failed to generate recommendations');
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse JSON from the response
    let recommendations;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Return a structured fallback
      recommendations = {
        summary: content.substring(0, 500),
        priorityActions: [],
        retailerFocus: [],
        beatStrategy: [],
        schemeOpportunities: [],
        weeklyPlan: {}
      };
    }

    return new Response(JSON.stringify({
      quote,
      recommendations,
      generatedAt: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-target-advice:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
