import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATABASE_TYPES = new Set(["institutional", "distributor", "event"]);

// Chunked bulk-insert for the unified Leads Management upload (10k-30k rows
// per upload). Modeled on import-retailer-ext-db's chunking shape, but —
// unlike that function — requires an authenticated admin caller, since this
// writes bulk outreach-targetable contact data.
//
// Category (database_type) is read per row from the uploaded file itself
// (a "Category" column), not supplied once for the whole batch — the Leads
// Management page is a single unified list now, not three separate tabs.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("is_system_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Only an admin can upload marketing contacts" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const rows = body.records;
    if (!Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: "records array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Header matching is case/spacing-insensitive and alias-aware (e.g. both
    // "Phone" and "Mobile" map to the phone field), so a real-world export's
    // column order and exact naming never matter. Any column in the upload
    // that isn't one of these recognized fields is silently ignored.
    const FIELD_ALIASES: Record<string, string[]> = {
      name: ["name"],
      phone: ["phone", "mobile"],
      email: ["email"],
      website: ["website"],
      state: ["state"],
      country: ["country"],
      address: ["address"],
      city: ["city"],
      pincode: ["pin", "pincode", "postalcode", "postal code", "zip", "zipcode"],
      first_name: ["firstname", "first name"],
      last_name: ["lastname", "last name"],
      business_details: ["businessdetails", "business details"],
      database_type: ["category", "databasetype", "database type", "type", "leadcategory", "lead category"],
    };
    const normalizeHeader = (h: string) => h.trim().toLowerCase();
    function getField(row: Record<string, unknown>, field: string): string {
      const aliases = FIELD_ALIASES[field];
      for (const key of Object.keys(row)) {
        if (aliases.includes(normalizeHeader(key))) {
          return String(row[key] ?? "").trim();
        }
      }
      return "";
    }
    // '9877823445' -> '+919877823445'; '91-9867368776' -> '+919867368776'.
    function normalizePhone(raw: string): string | null {
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 10) return null;
      return `+91${digits.slice(-10)}`;
    }

    const errors: string[] = [];
    const records = rows
      .map((row: Record<string, unknown>, idx: number) => {
        const name = getField(row, "name");
        const phone = normalizePhone(getField(row, "phone"));
        const databaseType = getField(row, "database_type").toLowerCase();
        if (!name || !phone) {
          errors.push(`Row ${idx + 1}: missing Name or a valid Phone/Mobile number`);
          return null;
        }
        if (!DATABASE_TYPES.has(databaseType)) {
          errors.push(`Row ${idx + 1}: Category must be Institutional, Distributor, or Event`);
          return null;
        }
        return {
          database_type: databaseType,
          name,
          phone,
          email: getField(row, "email") || null,
          website: getField(row, "website") || null,
          state: getField(row, "state") || null,
          country: getField(row, "country") || null,
          address: getField(row, "address") || null,
          city: getField(row, "city") || null,
          pincode: getField(row, "pincode") || null,
          first_name: getField(row, "first_name") || null,
          last_name: getField(row, "last_name") || null,
          business_details: getField(row, "business_details") || null,
          uploaded_by: user.id,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const chunkSize = 500;
    let inserted = 0;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { error } = await supabase.from("marketing_contacts").insert(chunk);
      if (error) {
        return new Response(JSON.stringify({ error: error.message, inserted, skipped: errors.length, errors }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      inserted += chunk.length;
    }

    return new Response(JSON.stringify({ success: true, inserted, skipped: errors.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
