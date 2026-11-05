import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Image data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing competition image from base64');

    // Call Lovable AI to analyze the image
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: "You are an expert at analyzing product and competitor images. Extract competitor brand names, product details, pricing, and other relevant competition information from images."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this competition/product image and extract:\n1. Competitor Name (brand name)\n2. Product Details (product names, descriptions)\n3. Category (product category)\n4. Price Information (if visible)\n5. Shelf Space observations\n6. Location/positioning information\n\nReturn the information in a structured format."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_competition_info",
              description: "Extract structured competition information from the image",
              parameters: {
                type: "object",
                properties: {
                  competitor_name: {
                    type: "string",
                    description: "The main competitor or brand name visible in the image"
                  },
                  product_details: {
                    type: "string",
                    description: "Details about products visible (names, SKUs, variants)"
                  },
                  category: {
                    type: "string",
                    description: "Product category (e.g., Beverages, Snacks, Personal Care)"
                  },
                  price_info: {
                    type: "string",
                    description: "Pricing information if visible"
                  },
                  shelf_space: {
                    type: "string",
                    description: "Observations about shelf space, positioning, prominence"
                  },
                  location_info: {
                    type: "string",
                    description: "Location or positioning details (aisle, eye-level, etc.)"
                  }
                },
                required: ["competitor_name"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_competition_info" } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    console.log('AI Response:', JSON.stringify(aiData, null, 2));
    
    // Extract the tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || !toolCall.function?.arguments) {
      throw new Error("No structured data returned from AI");
    }

    const competitionData = JSON.parse(toolCall.function.arguments);
    console.log('Extracted competition data:', competitionData);

    // Check for duplicates using the database function
    const { data: duplicateCheck, error: duplicateError } = await supabase
      .rpc('check_duplicate_competitor', { 
        competitor_name_param: competitionData.competitor_name 
      });

    if (duplicateError) {
      console.error('Error checking duplicates:', duplicateError);
    }

    if (duplicateCheck && duplicateCheck.length > 0) {
      const existingCompetitor = duplicateCheck[0];
      console.log('Found duplicate competitor:', existingCompetitor);
      
      return new Response(
        JSON.stringify({
          isDuplicate: true,
          message: `This competitor "${existingCompetitor.competitor_name}" already exists in the system. No need to add it again.`,
          existingData: {
            id: existingCompetitor.competitor_id,
            competitor_name: existingCompetitor.competitor_name,
            competitor_image_url: existingCompetitor.competitor_image_url,
            product_details: existingCompetitor.product_details
          },
          extractedData: competitionData
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // No duplicate found, return the extracted data
    return new Response(
      JSON.stringify({
        isDuplicate: false,
        extractedData: competitionData
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in scan-competition-insight:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
