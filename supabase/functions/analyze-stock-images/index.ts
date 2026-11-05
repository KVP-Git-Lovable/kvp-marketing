import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { images, productSkuImages } = await req.json();
    console.log('Analyzing stock images', { imageCount: images.length, skuImageCount: productSkuImages.length });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Prepare the analysis prompt with improved instructions
    const analysisPrompt = `You are an expert retail shelf analyzer. Your task is to identify and count products on store shelves.

REFERENCE PRODUCT IMAGES PROVIDED:
${productSkuImages.map((p: any, i: number) => `${i + 1}. Product: ${p.name} (SKU: ${p.sku}) - Look for this product's packaging, colors, logos, and text`).join('\n')}

ANALYSIS TASK:
First, you will see ${productSkuImages.length} reference product images (one for each product above).
Then, you will see the shelf photo(s) to analyze.

YOUR JOB:
1. Carefully examine each reference product image - memorize the packaging design, colors, brand logos, text, and shape
2. Look at the shelf photo(s) and find ANY products that match the reference images
3. Match products by:
   - Packaging colors and design
   - Brand logos and text visible on the package
   - Package shape and size
   - Product name or brand visible on the label
4. Count how many units of each matched product you can see
5. Be FLEXIBLE - products may be at different angles, lighting, or partially visible
6. Include products even if you see them from the side, back, or at an angle
7. If you see even a small part of a matching product, include it in the count

CONFIDENCE GUIDELINES:
- High confidence (0.8-1.0): Clear, full view of product matching reference
- Medium confidence (0.5-0.7): Partial view or different angle but clear match
- Low confidence (0.3-0.5): Small visible portion but identifiable by colors/logos
- Include products with confidence as low as 0.3 if you see any matching visual elements

OUTPUT FORMAT (CRITICAL):
Return ONLY a JSON array with this EXACT structure, NO other text:
[
  {
    "productId": "paste-the-uuid-from-above",
    "productName": "paste-the-product-name-from-above",
    "sku": "paste-the-SKU-from-above",
    "count": number_of_units_visible,
    "confidence": decimal_between_0_and_1
  }
]

IMPORTANT RULES:
- Be generous with matching - if packaging colors/logos look similar, include it
- Count ALL visible units, even partially visible ones
- If you see multiple rows/columns of the same product, count them all
- Return empty array [] ONLY if you truly cannot find ANY matching products
- Return ONLY the JSON array, absolutely NO explanatory text before or after`;

    // Prepare messages with images
    const messages: any[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: analysisPrompt }
        ]
      }
    ];

    // Add reference SKU images
    for (const skuImage of productSkuImages) {
      if (skuImage.imageUrl) {
        messages[0].content.push({
          type: 'image_url',
          image_url: { url: skuImage.imageUrl }
        });
      }
    }

    // Add shelf images to analyze
    for (const image of images) {
      messages[0].content.push({
        type: 'image_url',
        image_url: { url: image }
      });
    }

    // Log the images being sent for debugging
    console.log('Reference SKU images:', productSkuImages.map(p => ({ name: p.name, url: p.imageUrl })));
    console.log('Shelf images to analyze:', images);
    
    console.log('Calling Lovable AI for vision analysis with gemini-2.5-pro');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages,
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    console.log('Lovable AI response received');
    
    const content = aiData.choices?.[0]?.message?.content || '[]';
    console.log('AI analysis result:', content);

    // Parse the JSON response
    let detectedProducts = [];
    try {
      // Extract JSON from response (handle cases where AI adds extra text)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        detectedProducts = JSON.parse(jsonMatch[0]);
      } else {
        console.warn('No JSON array found in AI response');
        detectedProducts = [];
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      detectedProducts = [];
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        detectedProducts,
        message: `Analyzed ${images.length} image(s), detected ${detectedProducts.length} product(s)`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in analyze-stock-images:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        detectedProducts: []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});