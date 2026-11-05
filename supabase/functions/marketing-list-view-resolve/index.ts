import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Resolves a marketing_contact_list_views filter set (or inline filters)
// against marketing_contacts. List Views are never snapshotted — matching
// rows are always recomputed live here, both for the frontend's preview
// and as the server-side source of truth at journey publish/execution
// time (never trust a client-computed audience list).
//
// When resolving a saved List View (list_view_id set), the result is the
// union of filter-matched contacts and any contacts explicitly added via
// marketing_contact_list_view_members (the "Add to List View" bulk action) —
// filter evaluation itself is unchanged, membership is purely additive.

interface FilterRow {
  field: "name" | "phone" | "email" | "website" | "state" | "country" | "lead_source";
  operator: "equals" | "not_equals" | "contains" | "is_any_of" | "is_empty" | "is_not_empty";
  value?: string | string[];
}

const ALLOWED_FIELDS = new Set(["name", "phone", "email", "website", "state", "country", "lead_source"]);
const PREVIEW_COLUMNS = "id, name, phone, email, website, state, country, address, city, pincode, first_name, last_name, business_details, lead_source, status";

function applyFilters(query: any, filters: FilterRow[]) {
  for (const f of filters) {
    if (!ALLOWED_FIELDS.has(f.field)) continue;
    switch (f.operator) {
      case "equals":
        query = query.eq(f.field, f.value);
        break;
      case "not_equals":
        query = query.neq(f.field, f.value);
        break;
      case "contains":
        query = query.ilike(f.field, `%${f.value}%`);
        break;
      case "is_any_of":
        query = query.in(f.field, Array.isArray(f.value) ? f.value : [f.value]);
        break;
      case "is_empty":
        query = query.or(`${f.field}.is.null,${f.field}.eq.`);
        break;
      case "is_not_empty":
        query = query.not(f.field, "is", null).neq(f.field, "");
        break;
    }
  }
  return query;
}

async function getMemberIds(supabase: any, listViewId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("marketing_contact_list_view_members").select("contact_id").eq("list_view_id", listViewId);
  if (error) throw error;
  return new Set((data || []).map((r: { contact_id: string }) => r.contact_id));
}

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

    const body = await req.json();
    let databaseType: string | undefined = body.database_type;
    let filters: FilterRow[] = Array.isArray(body.filters) ? body.filters : [];
    const mode: "count" | "preview" | "ids" = body.mode || "count";
    const limit = Math.min(Number(body.limit) || 25, 500);
    const offset = Number(body.offset) || 0;
    const listViewId: string | undefined = body.list_view_id;

    if (listViewId) {
      const { data: listView, error: lvErr } = await supabase
        .from("marketing_contact_list_views").select("database_type, filters").eq("id", listViewId).single();
      if (lvErr || !listView) {
        return new Response(JSON.stringify({ error: "List view not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      databaseType = listView.database_type;
      filters = Array.isArray(listView.filters) ? listView.filters : [];
    }

    if (databaseType !== "institutional" && databaseType !== "distributor" && databaseType !== "event") {
      return new Response(JSON.stringify({ error: "database_type must be 'institutional', 'distributor', or 'event'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "ids") {
      let query = supabase.from("marketing_contacts").select("id").eq("database_type", databaseType).not("phone", "is", null);
      query = applyFilters(query, filters);
      const { data, error } = await query;
      if (error) throw error;
      const idSet = new Set((data || []).map((r: { id: string }) => r.id));
      if (listViewId) {
        for (const id of await getMemberIds(supabase, listViewId)) idSet.add(id);
      }
      return new Response(JSON.stringify({ ids: Array.from(idSet) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "preview") {
      if (listViewId) {
        let idQuery = supabase.from("marketing_contacts").select("id").eq("database_type", databaseType);
        idQuery = applyFilters(idQuery, filters);
        const { data: idData, error: idErr } = await idQuery;
        if (idErr) throw idErr;
        const idSet = new Set((idData || []).map((r: { id: string }) => r.id));
        for (const id of await getMemberIds(supabase, listViewId)) idSet.add(id);

        const allIds = Array.from(idSet);
        const total = allIds.length;
        const pageIds = allIds.slice(offset, offset + limit);
        if (pageIds.length === 0) {
          return new Response(JSON.stringify({ rows: [], count: total }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: rows, error: rowsErr } = await supabase
          .from("marketing_contacts").select(PREVIEW_COLUMNS).in("id", pageIds);
        if (rowsErr) throw rowsErr;
        const sorted = (rows || []).slice().sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
        return new Response(JSON.stringify({ rows: sorted, count: total }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let query = supabase
        .from("marketing_contacts")
        .select(PREVIEW_COLUMNS, { count: "exact" })
        .eq("database_type", databaseType).range(offset, offset + limit - 1);
      query = applyFilters(query, filters);
      const { data, error, count } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ rows: data || [], count: count || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // mode === "count"
    if (listViewId) {
      let idQuery = supabase.from("marketing_contacts").select("id").eq("database_type", databaseType);
      idQuery = applyFilters(idQuery, filters);
      const { data: idData, error: idErr } = await idQuery;
      if (idErr) throw idErr;
      const idSet = new Set((idData || []).map((r: { id: string }) => r.id));
      for (const id of await getMemberIds(supabase, listViewId)) idSet.add(id);
      return new Response(JSON.stringify({ count: idSet.size }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase.from("marketing_contacts").select("id", { count: "exact", head: true }).eq("database_type", databaseType);
    query = applyFilters(query, filters);
    const { count, error } = await query;
    if (error) throw error;
    return new Response(JSON.stringify({ count: count || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
