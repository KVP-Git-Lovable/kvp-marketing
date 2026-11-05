import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing wall image:", imageUrl);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this wall image and estimate suitable billboard/signage dimensions. 
                
Look for:
- Wall dimensions (width and height in feet/meters)
- Available space for billboard placement
- Any reference objects for scale (doors, windows, people)
- Obstacles or constraints

Provide your response as JSON with these fields:
{
  "width": "estimated width with unit (e.g., '10 ft' or '3 m')",
  "height": "estimated height with unit (e.g., '6 ft' or '2 m')",
  "sizeDescription": "brief description of recommended billboard size (e.g., '10ft x 6ft horizontal billboard')",
  "confidence": "high/medium/low",
  "notes": "any relevant observations about the wall space"
}

If the image doesn't show a clear wall or suitable space, set confidence to "low" and explain in notes.`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    // Extract JSON from markdown code blocks if present
    let jsonText = content;
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else if (content.includes('{') && content.includes('}')) {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}') + 1;
      jsonText = content.substring(start, end);
    }

    let result;
    try {
      result = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("Failed to parse JSON:", jsonText);
      throw new Error("Failed to parse AI response as JSON");
    }

    // Ensure required fields exist
    const measurements = {
      width: result.width || "unknown",
      height: result.height || "unknown",
      sizeDescription: result.sizeDescription || "Unable to determine size",
      confidence: result.confidence || "low",
      notes: result.notes || "Could not analyze wall dimensions"
    };

    console.log("Extracted measurements:", measurements);

    return new Response(
      JSON.stringify(measurements),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in scan-wall-measurements:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        width: "unknown",
        height: "unknown",
        sizeDescription: "Error analyzing image",
        confidence: "low",
        notes: "Failed to process image"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
