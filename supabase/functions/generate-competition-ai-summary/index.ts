import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { competitorId, competitorName, competitorData } = await req.json();

    console.log('Generating AI summary for competitor:', competitorName);

    // Fetch all competition data for this competitor
    const { data: stockData } = await supabase
      .from('competition_data')
      .select('*')
      .eq('competitor_id', competitorId)
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: insightData } = await supabase
      .from('competition_insights')
      .select('*')
      .eq('competitor_name', competitorName)
      .order('created_at', { ascending: false })
      .limit(20);

    // Generate SWOT Analysis
    const swotPrompt = `Based on the following competitor information, generate a comprehensive SWOT analysis:

Competitor: ${competitorName}
Business Background: ${competitorData.business_background || 'N/A'}
Focus: ${competitorData.focus || 'N/A'}
Strategy: ${competitorData.strategy || 'N/A'}
Sales Team Size: ${competitorData.sales_team_size || 'N/A'}
Supply Chain: ${competitorData.supply_chain_info || 'N/A'}

Recent Competition Data (${stockData?.length || 0} entries):
${stockData?.slice(0, 10).map(d => `- SKU: ${d.sku_id}, Stock: ${d.stock_quantity}, Price: ${d.selling_price}`).join('\n') || 'No data'}

Recent Insights (${insightData?.length || 0} entries):
${insightData?.slice(0, 5).map(i => `- ${i.insight_type}: ${i.description}`).join('\n') || 'No insights'}

Provide a SWOT analysis in JSON format:
{
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "opportunities": ["opportunity1", "opportunity2", "opportunity3"],
  "threats": ["threat1", "threat2", "threat3"]
}`;

    const swotResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a business analyst specializing in competitive analysis. Always respond with valid JSON only.' },
          { role: 'user', content: swotPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!swotResponse.ok) {
      const errorText = await swotResponse.text();
      console.error('SWOT AI error:', swotResponse.status, errorText);
      throw new Error(`AI gateway error: ${swotResponse.status}`);
    }

    const swotData = await swotResponse.json();
    let swot;
    try {
      const swotContent = swotData.choices[0].message.content;
      swot = JSON.parse(swotContent);
    } catch (e) {
      console.error('Failed to parse SWOT JSON:', e);
      swot = {
        strengths: ["Unable to generate analysis"],
        weaknesses: ["Unable to generate analysis"],
        opportunities: ["Unable to generate analysis"],
        threats: ["Unable to generate analysis"]
      };
    }

    // Fetch News using web search
    const newsSearchQuery = `${competitorName} ${competitorData.focus || 'business'} news latest 2024 2025`;
    console.log('Searching news for:', newsSearchQuery);

    const newsPrompt = `Search for the latest news about "${competitorName}" company. Focus on:
- Recent business developments
- Product launches
- Market expansion
- Financial news
- Strategic partnerships

Find 5 most relevant and recent news articles. For each article, extract:
- Title
- Brief summary (2-3 sentences)
- Source name
- Publication date (if available)
- URL

Return as JSON array:
[
  {
    "title": "Article title",
    "summary": "Brief summary",
    "source": "Source name",
    "date": "YYYY-MM-DD or relative date",
    "url": "Article URL"
  }
]`;

    const newsResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a news researcher. Search the web for recent news and return valid JSON only.' },
          { role: 'user', content: newsPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    let news = [];
    if (newsResponse.ok) {
      try {
        const newsData = await newsResponse.json();
        const newsContent = newsData.choices[0].message.content;
        const parsed = JSON.parse(newsContent);
        news = Array.isArray(parsed) ? parsed : (parsed.articles || parsed.news || []);
      } catch (e) {
        console.error('Failed to parse news JSON:', e);
      }
    }

    return new Response(
      JSON.stringify({
        swot,
        news: news.slice(0, 5),
        generatedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-competition-ai-summary:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
