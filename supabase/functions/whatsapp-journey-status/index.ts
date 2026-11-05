// Twilio status-callback webhook for journey-sent WhatsApp messages.
// Passed per-message as `StatusCallback` on the Twilio send (see
// process-journeys' sendWhatsAppTemplate), so no Twilio console/number
// level webhook configuration is needed — that slot stays owned by
// whatsapp-retailer-verify-inbound.
//
// Must be public (verify_jwt = false) because Twilio cannot send a JWT.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

// journey_message_log.status only allows: queued, sent, delivered, read,
// failed, rate_limited — Twilio's "undelivered" collapses into "failed"
// here (the Message Response "Undelivered" condition reads the same
// "failed" value; there's no separate storage state to distinguish them).
const STATUS_MAP: Record<string, string> = {
  queued: "queued",
  sending: "sent",
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
  undelivered: "failed",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const form = await req.formData();
    const messageSid = (form.get("MessageSid") as string | null) || (form.get("SmsSid") as string | null);
    const rawStatus = ((form.get("MessageStatus") as string | null) || (form.get("SmsStatus") as string | null) || "").toLowerCase();
    const errorCode = form.get("ErrorCode") as string | null;
    const errorMessage = form.get("ErrorMessage") as string | null;

    if (!messageSid || !rawStatus) return new Response("ok", { headers: corsHeaders });

    const status = STATUS_MAP[rawStatus];
    if (!status) return new Response("ok", { headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: logRow } = await supabase
      .from("journey_message_log")
      .select("id")
      .eq("provider_message_id", messageSid)
      .maybeSingle();

    if (!logRow) return new Response("ok", { headers: corsHeaders });

    await supabase.from("journey_message_log").update({
      status,
      error_code: errorCode || null,
      error_message: errorMessage || null,
    }).eq("id", logRow.id);

    if (["sent", "delivered", "read", "failed"].includes(status)) {
      await supabase.from("journey_message_events").upsert({
        journey_message_log_id: logRow.id,
        event_type: status,
        raw_payload: Object.fromEntries(form.entries()),
      }, { onConflict: "journey_message_log_id,event_type", ignoreDuplicates: true });
    }

    return new Response("ok", { headers: corsHeaders });
  } catch (err) {
    console.error("whatsapp-journey-status failed:", err);
    return new Response("ok", { headers: corsHeaders });
  }
});
