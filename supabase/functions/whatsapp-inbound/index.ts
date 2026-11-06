import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHmac, timingSafeEqual } from "node:crypto";

// Records WhatsApp replies for KVP Marketing (shown in Journey Analytics → Conversations and
// used for Reply Rate). It never replies: the response is always an empty TwiML document.
// Point the sender's "incoming messages" webhook at this function instead of webhook-whatsapp.
const BUILD = 'inbound-2026-11-06';
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const xml = (status = 200) =>
  new Response(EMPTY_TWIML, { status, headers: { 'Content-Type': 'text/xml', 'X-Inbound-Build': BUILD, 'Access-Control-Expose-Headers': 'x-inbound-build' } });

// Twilio signs the full URL plus the POST params sorted by key.
function validSignature(url: string, params: Record<string, string>, signature: string, authToken: string): boolean {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = createHmac('sha1', authToken).update(data).digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

serve(async (req) => {
  if (req.method === 'GET') return new Response('ok', { headers: { 'X-Inbound-Build': BUILD, 'Access-Control-Expose-Headers': 'x-inbound-build' } });
  if (req.method !== 'POST') return xml(405);

  try {
    const form = await req.formData();
    const params: Record<string, string> = {};
    form.forEach((v, k) => { if (typeof v === 'string') params[k] = v; });

    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const signature = req.headers.get('x-twilio-signature') ?? '';
    if (authToken && !validSignature(`${supabaseUrl}/functions/v1/whatsapp-inbound`, params, signature, authToken)) {
      console.warn('whatsapp-inbound: signature mismatch');
      return xml(403);
    }

    const sid = params.MessageSid || params.SmsSid;
    const from = (params.From || '').replace(/^whatsapp:/, '');
    const to = (params.To || '').replace(/^whatsapp:/, '');
    if (!sid || !from) return xml();

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: existing } = await supabase.from('whatsapp_messages').select('id').eq('twilio_sid', sid).maybeSingle();
    if (!existing) {
      const body = params.Body || (Number(params.NumMedia) > 0 ? '[media]' : '');
      const { error } = await supabase.from('whatsapp_messages').insert({
        direction: 'inbound', from_number: from, to_number: to, body, twilio_sid: sid, status: 'received',
        media_url: params.MediaUrl0 || null,
      });
      if (error) console.error('whatsapp-inbound insert failed:', error.message);
    }
    return xml();
  } catch (err) {
    console.error('whatsapp-inbound failed:', err);
    return xml(); // never make Twilio retry or send an error message to the contact
  }
});
