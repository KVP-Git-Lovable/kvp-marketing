import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Public (unauthenticated) redirect endpoint for WhatsApp journey links:
// /functions/v1/track-link-click/{short_code} logs the click and 302s to
// the tracked link's real target_url. No JWT required — recipients click
// this straight from WhatsApp.
serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const shortCode = parts[parts.length - 1];

  if (!shortCode || shortCode === 'track-link-click') {
    return new Response('Not found', { status: 404 });
  }

  const { data: link } = await supabase.from('whatsapp_tracked_links').select('*').eq('short_code', shortCode).maybeSingle();
  if (!link) {
    return new Response('Link not found', { status: 404 });
  }

  await supabase.from('whatsapp_link_clicks').insert({
    tracked_link_id: link.id,
    retailer_id: link.retailer_id,
    user_agent: req.headers.get('user-agent'),
    ip_address: req.headers.get('x-forwarded-for'),
  });

  if (link.journey_message_log_id) {
    await supabase.from('journey_message_events').insert({ journey_message_log_id: link.journey_message_log_id, event_type: 'clicked' });
  }
  if (link.retailer_id) {
    const { data: existing } = await supabase.from('person_engagement_scores').select('score').eq('retailer_id', link.retailer_id).maybeSingle();
    await supabase.from('person_engagement_scores').upsert({
      retailer_id: link.retailer_id,
      score: (Number(existing?.score) || 0) + 10,
      last_event_at: new Date().toISOString(),
    }, { onConflict: 'retailer_id' });
  }

  return new Response(null, { status: 302, headers: { Location: link.target_url } });
});
