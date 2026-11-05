import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FaceMatchRequest {
  baselinePhotoUrl: string;
  attendancePhotoUrl: string;
}

interface FaceMatchResponse {
  status: 'match' | 'partial' | 'nomatch' | 'error';
  confidence: number;
  verified: boolean;
  message?: string;
}

async function fetchImageAsBase64FromSupabase(
  url: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<string | null> {
  try {
    console.log(`Fetching image (smart) from: ${url}`);

    // Try to parse Supabase storage URL: .../storage/v1/object/public/<bucket>/<path>
    const storageMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);

    let arrayBuffer: ArrayBuffer | null = null;

    if (storageMatch) {
      const bucket = storageMatch[1];
      const path = decodeURIComponent(storageMatch[2]);
      console.log(`Detected Supabase storage URL. Bucket: ${bucket}, Path: ${path}`);

      const { data, error } = await supabaseClient
        .storage
        .from(bucket)
        .download(path);

      if (error || !data) {
        console.error('Supabase storage download error:', error);
        return null;
      }

      arrayBuffer = await data.arrayBuffer();
    } else {
      // Fallback to direct HTTP fetch for non-Supabase URLs
      console.log('Non-Supabase URL detected, using direct fetch');
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch image from ${url}: ${response.status}`);
        return null;
      }
      arrayBuffer = await response.arrayBuffer();
    }

    const bytes = new Uint8Array(arrayBuffer!);

    // Convert to base64 in chunks to avoid stack overflow
    const chunkSize = 0x8000; // 32KB chunks
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }

    const base64 = btoa(binary);
    console.log(`Successfully converted image to base64 (${base64.length} chars)`);
    return base64;
  } catch (error) {
    console.error(`Error fetching image: ${error}`);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { baselinePhotoUrl, attendancePhotoUrl }: FaceMatchRequest = await req.json()

    if (!baselinePhotoUrl || !attendancePhotoUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing photo URLs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Face verification attempt by user ${user.id}`)
    console.log(`Baseline URL: ${baselinePhotoUrl}`)
    console.log(`Attendance URL: ${attendancePhotoUrl}`)

    // If URLs are identical, return 100% match immediately
    if (baselinePhotoUrl === attendancePhotoUrl) {
      console.log('Same photo URL detected - returning 100% match');
      return new Response(
        JSON.stringify({
          status: 'match',
          confidence: 100,
          verified: true,
          message: 'Same photo used for both baseline and attendance'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch both images as base64 using Supabase storage when possible
    const [baselineBase64, attendanceBase64] = await Promise.all([
      fetchImageAsBase64FromSupabase(baselinePhotoUrl, supabaseClient),
      fetchImageAsBase64FromSupabase(attendancePhotoUrl, supabaseClient)
    ]);

    if (!baselineBase64 || !attendanceBase64) {
      console.error('Failed to fetch one or both images');
      return new Response(
        JSON.stringify({ 
          status: 'error',
          confidence: 0,
          verified: false,
          message: 'Failed to load images for comparison'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use Lovable AI (Gemini) for face comparison
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          status: 'error',
          confidence: 0,
          verified: false,
          message: 'Face verification service not configured'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call Lovable AI with both images for face comparison
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a face verification expert. Your task is to compare two face images and determine if they are the same person.

IMPORTANT: You must be accurate and strict in your comparison. Consider:
- Facial structure (face shape, bone structure)
- Eye shape, size, and spacing
- Nose shape and size
- Mouth shape and lips
- Ear shape (if visible)
- Overall facial proportions

Do NOT consider:
- Lighting differences
- Image quality differences
- Different angles (unless extreme)
- Different expressions
- Different hairstyles or facial hair
- Accessories like glasses

You must respond with a JSON object in this exact format:
{
  "is_same_person": true/false,
  "confidence_percentage": number between 0-100,
  "reasoning": "brief explanation of your decision"
}

Be strict - if you're not confident, give a lower percentage. Only give above 80% if you're very sure it's the same person.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Compare these two face images and determine if they are the same person. First image is the baseline/profile photo. Second image is the attendance photo taken now. Respond with JSON only.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${baselineBase64}`
                }
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${attendanceBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1 // Low temperature for more consistent results
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      
      // Return error response but don't block - let the caller decide
      return new Response(
        JSON.stringify({ 
          status: 'error',
          confidence: 0,
          verified: false,
          message: 'Face verification service unavailable'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const aiData = await aiResponse.json();
    console.log('AI Response:', JSON.stringify(aiData));

    // Parse the AI response
    let confidence = 0;
    let isSamePerson = false;
    let reasoning = '';

    try {
      const content = aiData.choices?.[0]?.message?.content || '';
      console.log('AI Content:', content);
      
      // Try to parse JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        isSamePerson = parsed.is_same_person === true;
        confidence = typeof parsed.confidence_percentage === 'number' 
          ? parsed.confidence_percentage 
          : parseFloat(parsed.confidence_percentage) || 0;
        reasoning = parsed.reasoning || '';
      } else {
        console.error('Could not parse JSON from AI response');
        // Fallback: try to extract confidence from text
        const percentMatch = content.match(/(\d+)%/);
        if (percentMatch) {
          confidence = parseInt(percentMatch[1]);
          isSamePerson = confidence >= 50;
        }
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
    }

    // Determine status based on confidence
    let status: 'match' | 'partial' | 'nomatch' | 'error';
    if (confidence >= 70) {
      status = 'match';
    } else if (confidence >= 50) {
      status = 'partial';
    } else {
      status = 'nomatch';
    }

    const result: FaceMatchResponse = {
      status,
      confidence: Math.round(confidence * 100) / 100,
      verified: isSamePerson && confidence >= 50,
      message: reasoning
    }

    console.log('Face match result:', JSON.stringify(result));

    // Log the verification attempt
    try {
      await supabaseClient.from('sensitive_data_access_log').insert({
        user_id: user.id,
        table_name: 'attendance',
        action: `face_verification_${result.verified ? 'success' : 'failed'}_${Math.round(confidence)}%`,
      });
    } catch (logError) {
      console.error('Failed to log verification attempt:', logError);
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Face verification error:', err)
    return new Response(
      JSON.stringify({ 
        status: 'error',
        confidence: 0,
        verified: false,
        message: 'Server error during face verification'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})