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
    const { userId, competencyId, monthYear, competencyCode, rawMetrics, score } = await req.json();
    
    if (!userId || !competencyId || !competencyCode) {
      throw new Error("Missing required parameters");
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Prepare the context for AI
    const prompt = `You are a performance analyst. Explain how the score of ${score.toFixed(1)}% was calculated for the competency "${competencyCode}".

Raw metrics data:
${JSON.stringify(rawMetrics, null, 2)}

Provide a clear, easy-to-understand breakdown:
1. What data points were used
2. How each metric contributed to the score
3. What the score means in practical terms

Be specific with numbers from the data. Keep it concise but informative.
Format as plain text, not markdown.`;

    let breakdown: string;

    if (lovableApiKey) {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a helpful performance analyst. Explain scores clearly and concisely." },
            { role: "user", content: prompt }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI API error:", errorText);
        throw new Error("Failed to generate breakdown");
      }

      const aiResult = await aiResponse.json();
      breakdown = aiResult.choices?.[0]?.message?.content || "Unable to generate breakdown";
    } else {
      // Fallback without AI
      breakdown = generateFallbackBreakdown(competencyCode, rawMetrics, score);
    }

    return new Response(
      JSON.stringify({ success: true, breakdown }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating score breakdown:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateFallbackBreakdown(code: string, metrics: Record<string, any>, score: number): string {
  const lines = [`Score: ${score.toFixed(1)}%\n`, `Competency: ${code}\n\n`, `Metrics used:\n`];
  
  for (const [key, value] of Object.entries(metrics)) {
    if (key !== 'note' && key !== 'error') {
      lines.push(`• ${key.replace(/_/g, ' ')}: ${value}\n`);
    }
  }
  
  lines.push(`\nThis score reflects your performance based on the above metrics.`);
  
  if (score >= 80) {
    lines.push(` You're performing excellently in this area!`);
  } else if (score >= 60) {
    lines.push(` There's room for improvement to reach excellence.`);
  } else {
    lines.push(` Focus on improving this competency for better overall performance.`);
  }
  
  return lines.join('');
}
