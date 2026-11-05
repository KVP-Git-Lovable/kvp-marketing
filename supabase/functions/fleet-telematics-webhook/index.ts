// Inbound telematics webhook.
//
// Trackers all report the same handful of facts — which unit, how far, where,
// when — under different field names. Rather than a function per vendor, the
// mapping lives in fleet_api_config.field_map and this stays one function.
//
// POST /functions/v1/fleet-telematics-webhook?provider=<name>
//   header: X-Fleet-Secret: <the provider's webhook_secret>
//   body:   the provider's own payload, single object or array
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-fleet-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function db() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Read a value by a dotted path, so a mapping can reach into nested payloads
 *  ("position.latitude") without needing code for each shape. */
function pick(obj: any, path?: string): any {
  if (!path) return undefined;
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Trackers send time as ISO, epoch seconds or epoch millis. Guessing wrong
 *  puts a reading in 1970 or the far future, so each is handled explicitly. */
function toTimestamp(v: any): string {
  if (v == null) return new Date().toISOString();
  if (typeof v === "number") {
    const ms = v > 1e12 ? v : v * 1000;
    return new Date(ms).toISOString();
  }
  const s = String(v).trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return new Date(n > 1e12 ? n : n * 1000).toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const provider = new URL(req.url).searchParams.get("provider");
  if (!provider) return json({ error: "provider query parameter is required" }, 400);

  const secret = req.headers.get("x-fleet-secret") ?? "";
  const supabase = db();

  // The secret is compared in the database so this function never holds it.
  const { data: ok, error: secretErr } = await supabase.rpc("fleet_check_secret", {
    p_provider: provider,
    p_secret: secret,
  });
  if (secretErr) {
    console.error("secret check failed", secretErr);
    return json({ error: "could not verify the request" }, 500);
  }
  if (!ok) {
    // Logged so a misconfigured provider is visible, but the response stays
    // vague — a caller who guessed wrong learns nothing about why.
    await supabase.from("fleet_api_log").insert({
      provider, status: "rejected", message: "bad or missing X-Fleet-Secret",
    });
    return json({ error: "unauthorised" }, 401);
  }

  const { data: cfg, error: cfgErr } = await supabase
    .from("fleet_api_config").select("*").eq("provider", provider).maybeSingle();
  if (cfgErr || !cfg) return json({ error: "provider not configured" }, 400);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "body must be JSON" }, 400);
  }

  const map = (cfg.field_map ?? {}) as Record<string, string>;
  // Accept a single reading or a batch; providers differ and both are cheap.
  const records: any[] = Array.isArray(body)
    ? body
    : Array.isArray(pick(body, cfg.records_path ?? undefined))
      ? pick(body, cfg.records_path!)
      : [body];

  const results = { accepted: 0, ignored: 0, failed: 0 as number, details: [] as any[] };

  for (const rec of records) {
    const deviceId = pick(rec, map.device_id) ?? pick(rec, "device_id") ?? pick(rec, "imei");
    const value = Number(pick(rec, map.odometer) ?? pick(rec, "odometer"));

    if (!deviceId || !isFinite(value)) {
      results.failed++;
      results.details.push({ deviceId: deviceId ?? null, reason: "missing device id or odometer" });
      await supabase.from("fleet_api_log").insert({
        provider, device_id: deviceId ? String(deviceId) : null, status: "error",
        message: "payload did not carry a device id and odometer under the mapped names",
        payload: rec,
      });
      continue;
    }

    const { data, error } = await supabase.rpc("fleet_ingest_reading", {
      p_provider: provider,
      p_device_id: String(deviceId),
      p_value: value,
      p_recorded_at: toTimestamp(pick(rec, map.recorded_at)),
      p_lat: Number(pick(rec, map.lat)) || null,
      p_lng: Number(pick(rec, map.lng)) || null,
      p_raw: rec,
    });

    if (error) {
      results.failed++;
      results.details.push({ deviceId, reason: error.message });
    } else if ((data as any)?.ok) {
      results.accepted++;
    } else {
      results.ignored++;
      results.details.push({ deviceId, reason: (data as any)?.reason });
    }
  }

  // 200 even when some rows were ignored: a tracker that retries the whole
  // batch because one unknown device failed would never drain its queue.
  return json({ provider, ...results });
});
