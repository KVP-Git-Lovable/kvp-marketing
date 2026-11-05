import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('GOOGLE_MAPS_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all territories without place_id
    const { data: territories, error: fetchError } = await supabase
      .from('territories')
      .select('id, name')
      .is('place_id', null);

    if (fetchError) {
      console.error('Error fetching territories:', fetchError);
      throw fetchError;
    }

    if (!territories || territories.length === 0) {
      console.log('No territories need geocoding');
      return new Response(
        JSON.stringify({ message: 'All territories already have place_ids', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${territories.length} territories to geocode`);
    
    const results: { id: string; name: string; place_id: string | null; status: string }[] = [];

    for (const territory of territories) {
      try {
        // Add Karnataka, India for better geocoding accuracy
        const searchQuery = `${territory.name}, Karnataka, India`;
        
        // Use Google Places Text Search (New) API
        const response = await fetch(
          `https://places.googleapis.com/v1/places:searchText`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
              'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress'
            },
            body: JSON.stringify({
              textQuery: searchQuery,
              maxResultCount: 1
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API error for ${territory.name}:`, errorText);
          results.push({ id: territory.id, name: territory.name, place_id: null, status: 'API error' });
          continue;
        }

        const data = await response.json();
        
        if (data.places && data.places.length > 0) {
          const placeId = data.places[0].id;
          
          // Update the territory with the place_id
          const { error: updateError } = await supabase
            .from('territories')
            .update({ place_id: placeId })
            .eq('id', territory.id);

          if (updateError) {
            console.error(`Error updating territory ${territory.name}:`, updateError);
            results.push({ id: territory.id, name: territory.name, place_id: null, status: 'Update failed' });
          } else {
            console.log(`Updated ${territory.name} with place_id: ${placeId}`);
            results.push({ id: territory.id, name: territory.name, place_id: placeId, status: 'success' });
          }
        } else {
          console.log(`No results found for ${territory.name}`);
          results.push({ id: territory.id, name: territory.name, place_id: null, status: 'No results' });
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        console.error(`Error geocoding ${territory.name}:`, err);
        results.push({ id: territory.id, name: territory.name, place_id: null, status: 'Error' });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    console.log(`Geocoding complete. Updated ${successCount} of ${territories.length} territories`);

    return new Response(
      JSON.stringify({ 
        message: `Geocoding complete`,
        total: territories.length,
        updated: successCount,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in geocode-territories:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
