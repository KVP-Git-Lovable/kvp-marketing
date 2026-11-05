import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Image data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log('Calling AI vision model to extract board information');

    // Call Lovable AI with vision model
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
            role: "system",
            content: "You are an OCR assistant that extracts shop/business information from signboards and shop images. Extract the business name, address, and mobile number if visible. Return ONLY a JSON object with keys: name, address, phone. If any field is not found, use empty string. Do not include any other text."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the shop/business name, complete address, and mobile number from this signboard/shop image. Return ONLY JSON format: {\"name\": \"\", \"address\": \"\", \"phone\": \"\"}"
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI service error. Please try again." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log('AI response received successfully');

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content;

    if (!aiMessage) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('AI Response:', aiMessage);

    // Parse the JSON from AI response
    let extractedData;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = aiMessage.match(/```json\s*([\s\S]*?)\s*```/) || 
                       aiMessage.match(/```\s*([\s\S]*?)\s*```/);
      
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[1]);
      } else {
        extractedData = JSON.parse(aiMessage);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Try to find JSON object in the text
      const jsonObjectMatch = aiMessage.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        try {
          extractedData = JSON.parse(jsonObjectMatch[0]);
        } catch {
          return new Response(
            JSON.stringify({ error: "Could not extract information from the image" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: "Could not extract information from the image" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Ensure all fields exist
    const result = {
      name: extractedData.name || "",
      address: extractedData.address || "",
      phone: extractedData.phone || ""
    };

    console.log('Extracted data:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scan board error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});