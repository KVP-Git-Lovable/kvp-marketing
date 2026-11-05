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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, monthYear } = await req.json();
    
    if (!userId || !monthYear) {
      throw new Error("userId and monthYear are required");
    }

    console.log(`Generating AI insights for user ${userId}, month ${monthYear}`);

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, designation')
      .eq('id', userId)
      .single();

    // Fetch competency scores with template details
    const { data: scores, error: scoresError } = await supabase
      .from('user_competency_monthly_scores')
      .select(`
        *,
        competency_templates (
          competency_name,
          competency_code,
          description,
          category,
          weightage
        )
      `)
      .eq('user_id', userId)
      .eq('month_year', monthYear);

    if (scoresError) throw scoresError;

    // Fetch scorecard
    const { data: scorecard } = await supabase
      .from('user_monthly_scorecards')
      .select('*')
      .eq('user_id', userId)
      .eq('month_year', monthYear)
      .single();

    if (!scores || scores.length === 0) {
      throw new Error("No competency scores found for this period");
    }

    // Sort scores by score value
    const sortedScores = [...scores].sort((a, b) => b.score - a.score);
    const strengths = sortedScores.slice(0, 2);
    const weaknesses = sortedScores.slice(-2).reverse();

    // Prepare context for AI
    const competencyContext = scores.map(s => ({
      name: s.competency_templates?.competency_name,
      code: s.competency_templates?.competency_code,
      score: s.score,
      trend: s.trend,
      previousScore: s.previous_month_score,
      metrics: s.raw_metrics,
      category: s.competency_templates?.category
    }));

    const aiPrompt = `You are a sales performance coach analyzing a field sales executive's monthly competency scorecard.

User: ${profile?.full_name || 'Sales Executive'}
Designation: ${profile?.designation || 'Field Sales Executive'}
Month: ${monthYear}
Overall Score: ${scorecard?.overall_score || 'N/A'}
Performance Band: ${scorecard?.performance_band || 'N/A'}

Competency Scores:
${competencyContext.map(c => `- ${c.name}: ${c.score.toFixed(1)}% (${c.trend}, previous: ${c.previousScore?.toFixed(1) || 'N/A'}%)
  Metrics: ${JSON.stringify(c.metrics)}`).join('\n')}

Based on this data, provide a JSON response with:
1. A brief 2-3 sentence summary of overall performance
2. Top 2 strengths with specific praise and what to keep doing
3. Top 2 improvement areas with specific, actionable steps
4. A weekly focus plan for the next month (4 weeks)
5. A motivational closing note

Respond ONLY with valid JSON in this exact format:
{
  "summary": "Brief overall assessment...",
  "strengths": [
    {
      "competency": "Competency Name",
      "insight": "What they did well...",
      "keepDoing": "Specific action to continue..."
    }
  ],
  "improvementAreas": [
    {
      "competency": "Competency Name",
      "currentScore": 65,
      "targetScore": 80,
      "specificActions": ["Action 1", "Action 2", "Action 3"],
      "timeline": "2 weeks"
    }
  ],
  "weeklyFocus": {
    "week1": "Focus area for week 1...",
    "week2": "Focus area for week 2...",
    "week3": "Focus area for week 3...",
    "week4": "Focus area for week 4..."
  },
  "motivationalNote": "Encouraging closing message..."
}`;

    let aiInsights;

    if (lovableApiKey) {
      // Use Lovable AI Gateway
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a sales performance coach. Respond only with valid JSON." },
            { role: "user", content: aiPrompt }
          ],
        }),
      });

      if (!aiResponse.ok) {
        console.error("AI API error:", await aiResponse.text());
        throw new Error("Failed to generate AI insights");
      }

      const aiResult = await aiResponse.json();
      const content = aiResult.choices?.[0]?.message?.content;
      
      try {
        // Extract JSON from the response (handle markdown code blocks)
        let jsonStr = content;
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
        aiInsights = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("Failed to parse AI response:", content);
        throw new Error("Failed to parse AI insights");
      }
    } else {
      // Fallback: Generate basic insights without AI
      console.log("No LOVABLE_API_KEY found, using fallback insights");
      aiInsights = {
        summary: `Based on your ${scorecard?.performance_band || 'developing'} performance this month with an overall score of ${scorecard?.overall_score?.toFixed(1) || 0}%, you show strong potential in ${strengths[0]?.competency_templates?.competency_name || 'key areas'}.`,
        strengths: strengths.map(s => ({
          competency: s.competency_templates?.competency_name,
          insight: `You scored ${s.score.toFixed(1)}% in this area, which is ${s.trend === 'improving' ? 'an improvement' : 'consistent'} from last month.`,
          keepDoing: `Continue focusing on the activities that led to this ${s.score >= 75 ? 'excellent' : 'good'} performance.`
        })),
        improvementAreas: weaknesses.map(w => ({
          competency: w.competency_templates?.competency_name,
          currentScore: w.score,
          targetScore: Math.min(100, w.score + 15),
          specificActions: [
            `Review your ${w.competency_templates?.competency_name?.toLowerCase()} metrics daily`,
            `Set specific goals for this competency`,
            `Ask your manager for targeted coaching`
          ],
          timeline: "4 weeks"
        })),
        weeklyFocus: {
          week1: `Focus on understanding your ${weaknesses[0]?.competency_templates?.competency_name || 'weakest'} area metrics`,
          week2: `Implement 2-3 specific actions to improve ${weaknesses[0]?.competency_templates?.competency_name || 'performance'}`,
          week3: `Review progress and adjust approach as needed`,
          week4: `Consolidate gains and prepare for next month's targets`
        },
        motivationalNote: "Every month is a new opportunity to grow. Focus on consistent small improvements and you'll see significant results over time!"
      };
    }

    // Update the scorecard with AI insights
    const { error: updateError } = await supabase
      .from('user_monthly_scorecards')
      .update({
        ai_summary: aiInsights.summary,
        ai_strengths: aiInsights.strengths,
        ai_improvement_areas: aiInsights.improvementAreas,
        ai_action_plan: {
          weeklyFocus: aiInsights.weeklyFocus,
          motivationalNote: aiInsights.motivationalNote
        },
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('month_year', monthYear);

    if (updateError) {
      console.error("Error updating scorecard with insights:", updateError);
    }

    console.log(`Successfully generated AI insights for user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        insights: aiInsights
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating competency insights:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
