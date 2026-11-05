import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Read-only view of the WhatsApp sender setup. The sender number is
// intentionally NOT editable here — it is this project's existing,
// already-configured Twilio WhatsApp number (same one
// send-order-confirmation-whatsapp etc. already send from), not a
// per-tenant value the Communication Center is allowed to change.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const phoneNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || '+917411681616';
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    const { data: cfg } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (req.method === 'POST') {
      // Only the business display name and webhook URL are editable —
      // the sender number stays pinned to TWILIO_WHATSAPP_NUMBER.
      const body = await req.json();
      const businessName = typeof body.business_name === 'string' ? body.business_name.trim() : undefined;

      if (cfg?.id) {
        const { error: updErr } = await supabase
          .from('whatsapp_config')
          .update({
            ...(businessName !== undefined ? { business_name: businessName } : {}),
            business_phone_number: phoneNumber,
          })
          .eq('id', cfg.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('whatsapp_config')
          .insert({
            business_phone_number: phoneNumber,
            business_name: businessName || null,
            is_active: true,
            created_by: user.id,
          });
        if (insErr) throw insErr;
      }
    }

    const { data: latestCfg } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    let status: 'ONLINE' | 'UNKNOWN' = 'UNKNOWN';
    if (accountSid && authToken) {
      try {
        const resp = await fetch(
          `https://messaging.twilio.com/v1/Services`,
          { headers: { Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`) } },
        );
        if (resp.ok) status = 'ONLINE';
      } catch {
        // leave as UNKNOWN — this is a best-effort reachability check only
      }
    }

    return new Response(JSON.stringify({
      phone_number: phoneNumber,
      status,
      business_name: latestCfg?.business_name || '',
      webhook_url: `${supabaseUrl}/functions/v1/webhook-whatsapp`,
      throughput: 'Standard',
      last_synced_at: latestCfg?.updated_at || null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
