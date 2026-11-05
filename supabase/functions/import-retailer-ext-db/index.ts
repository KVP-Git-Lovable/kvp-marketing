import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();

    // Mode 1: Direct records
    if (body.records && Array.isArray(body.records)) {
      const chunkSize = 500;
      let inserted = 0;
      for (let i = 0; i < body.records.length; i += chunkSize) {
        const chunk = body.records.slice(i, i + chunkSize);
        const { error } = await supabase.from("retailer_external_db").insert(chunk);
        if (error) {
          return new Response(JSON.stringify({ error: error.message, inserted }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        inserted += chunk.length;
      }
      return new Response(JSON.stringify({ success: true, inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode 2: File URL
    if (body.file_url) {
      console.log("Downloading:", body.file_url);
      const resp = await fetch(body.file_url);
      const contentType = resp.headers.get("content-type") || "";
      console.log("Content-Type:", contentType, "Status:", resp.status);
      
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);

      const arrayBuffer = await resp.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      console.log("File size:", data.length, "bytes");

      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      console.log("Parsed rows:", rows.length);

      const records = rows.map((row: any) => ({
        company_name: String(row["COMPANY NAME"] || "").trim(),
        address: String(row["ADD"] || "").trim() || null,
        city: String(row["CITY"] || "").trim(),
        pincode: String(row["PIN"] || "").trim() || null,
        state: String(row["STATE"] || "").trim(),
        mobile: String(row["MOBILE No."] || "").trim() || null,
        email: String(row["EMAIL"] || "").trim() || null,
        website: String(row["WEB"] || "").trim() || null,
        category: String(row["DETAILS"] || "").trim() || null,
      })).filter((r: any) => r.company_name && r.city && r.state);

      const chunkSize = 500;
      let inserted = 0;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        const { error } = await supabase.from("retailer_external_db").insert(chunk);
        if (error) {
          return new Response(JSON.stringify({ error: error.message, inserted }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        inserted += chunk.length;
      }
      return new Response(JSON.stringify({ success: true, inserted, parsed: rows.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Provide records array or file_url" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
