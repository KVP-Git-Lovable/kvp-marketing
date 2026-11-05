import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GEOCODING_API_KEY");
    if (!GOOGLE_API_KEY) throw new Error("GOOGLE_GEOCODING_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { state, city, batch_size = 10, mode = "batch" } = body;

    // Mode: "geocode_all" - background processing of ALL records
    if (mode === "geocode_all") {
      // Count total records needing geocoding
      const { count: totalCount, error: countErr } = await supabase
        .from("retailer_external_db")
        .select("id", { count: "exact", head: true })
        .is("latitude", null)
        .not("address", "is", null)
        .neq("address", "");

      if (countErr) throw countErr;

      if (!totalCount || totalCount === 0) {
        return new Response(JSON.stringify({ message: "All records already geocoded", job_id: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create a job record
      const { data: job, error: jobErr } = await supabase
        .from("geocoding_jobs")
        .insert({ status: "processing", total_records: totalCount, processed_records: 0, geocoded_count: 0, failed_count: 0 })
        .select()
        .single();

      if (jobErr) throw jobErr;

      // Start background processing
      EdgeRuntime.waitUntil(processAllRecords(job.id, supabase, GOOGLE_API_KEY));

      return new Response(JSON.stringify({ job_id: job.id, total_records: totalCount, message: "Geocoding started in background" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode: "batch" (default) - existing per-city batch behavior
    if (!state || !city) {
      return new Response(JSON.stringify({ error: "state and city are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: records, error: fetchErr } = await supabase
      .from("retailer_external_db")
      .select("id, address, city, state, pincode")
      .eq("state", state)
      .eq("city", city)
      .is("latitude", null)
      .not("address", "is", null)
      .neq("address", "")
      .limit(Math.min(batch_size, 15));

    if (fetchErr) throw fetchErr;

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ message: "All records geocoded", geocoded: 0, remaining: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Geocoding ${records.length} records for ${city}, ${state}`);
    let geocoded = 0;
    let failed = 0;

    for (const record of records) {
      try {
        const addressParts = [record.address, record.city, record.state, record.pincode, "India"].filter(Boolean);
        const fullAddress = addressParts.join(", ");
        const geoResp = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${GOOGLE_API_KEY}`
        );
        if (!geoResp.ok) { failed++; continue; }
        const geoData = await geoResp.json();
        if (geoData.status === "OK" && geoData.results?.length > 0) {
          const loc = geoData.results[0].geometry.location;
          const { error: updateErr } = await supabase
            .from("retailer_external_db")
            .update({ latitude: loc.lat, longitude: loc.lng })
            .eq("id", record.id);
          if (updateErr) { failed++; } else { geocoded++; }
        } else {
          await supabase.from("retailer_external_db")
            .update({ latitude: 0, longitude: 0 })
            .eq("id", record.id);
          failed++;
        }
      } catch (err) {
        console.error(`Error for ${record.id}:`, err);
        failed++;
      }
    }

    const { count } = await supabase
      .from("retailer_external_db")
      .select("id", { count: "exact", head: true })
      .eq("state", state)
      .eq("city", city)
      .is("latitude", null)
      .not("address", "is", null)
      .neq("address", "");

    return new Response(JSON.stringify({ geocoded, failed, remaining: count || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processAllRecords(jobId: string, supabase: any, googleApiKey: string) {
  const BATCH_SIZE = 50;
  let totalGeocoded = 0;
  let totalFailed = 0;
  let totalProcessed = 0;

  try {
    while (true) {
      // Fetch next batch of un-geocoded records
      const { data: records, error: fetchErr } = await supabase
        .from("retailer_external_db")
        .select("id, address, city, state, pincode")
        .is("latitude", null)
        .not("address", "is", null)
        .neq("address", "")
        .limit(BATCH_SIZE);

      if (fetchErr) throw fetchErr;
      if (!records || records.length === 0) break;

      for (const record of records) {
        try {
          const addressParts = [record.address, record.city, record.state, record.pincode, "India"].filter(Boolean);
          const fullAddress = addressParts.join(", ");

          const geoResp = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${googleApiKey}`
          );

          if (!geoResp.ok) {
            // Mark as failed so we don't retry
            await supabase.from("retailer_external_db").update({ latitude: 0, longitude: 0 }).eq("id", record.id);
            totalFailed++;
          } else {
            const geoData = await geoResp.json();
            if (geoData.status === "OK" && geoData.results?.length > 0) {
              const loc = geoData.results[0].geometry.location;
              await supabase.from("retailer_external_db").update({ latitude: loc.lat, longitude: loc.lng }).eq("id", record.id);
              totalGeocoded++;
            } else {
              await supabase.from("retailer_external_db").update({ latitude: 0, longitude: 0 }).eq("id", record.id);
              totalFailed++;
            }
          }
        } catch (err) {
          console.error(`Error geocoding ${record.id}:`, err);
          await supabase.from("retailer_external_db").update({ latitude: 0, longitude: 0 }).eq("id", record.id);
          totalFailed++;
        }

        totalProcessed++;

        // Update job progress every 10 records
        if (totalProcessed % 10 === 0) {
          await supabase.from("geocoding_jobs").update({
            processed_records: totalProcessed,
            geocoded_count: totalGeocoded,
            failed_count: totalFailed,
            updated_at: new Date().toISOString(),
          }).eq("id", jobId);
        }
      }
    }

    // Final update
    await supabase.from("geocoding_jobs").update({
      status: "completed",
      processed_records: totalProcessed,
      geocoded_count: totalGeocoded,
      failed_count: totalFailed,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    console.log(`Geocoding job ${jobId} completed: ${totalGeocoded} geocoded, ${totalFailed} failed out of ${totalProcessed} total`);
  } catch (error) {
    console.error(`Geocoding job ${jobId} failed:`, error);
    await supabase.from("geocoding_jobs").update({
      status: "failed",
      processed_records: totalProcessed,
      geocoded_count: totalGeocoded,
      failed_count: totalFailed,
      error_message: error.message,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}
