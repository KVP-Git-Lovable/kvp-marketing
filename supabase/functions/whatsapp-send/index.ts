import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sends either a freeform message or an approved template (ContentSid) to a
// retailer's WhatsApp number, via the same direct-Twilio REST pattern as
// send-order-confirmation-whatsapp — reusing this project's existing
// TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_NUMBER secrets.
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

    const { retailer_id, body: messageBody, template_id, template_variables } = await req.json();
    if (!retailer_id) {
      return new Response(JSON.stringify({ error: 'retailer_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!messageBody && !template_id) {
      return new Response(JSON.stringify({ error: 'body or template_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: retailer, error: rErr } = await supabase
      .from('retailers')
      .select('id, name, phone')
      .eq('id', retailer_id)
      .single();
    if (rErr || !retailer) {
      return new Response(JSON.stringify({ error: 'Retailer not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!retailer.phone) {
      return new Response(JSON.stringify({ error: 'Retailer has no phone number on file' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    if (!accountSid || !authToken) {
      return new Response(JSON.stringify({ error: 'Twilio credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || '+917411681616';
    const toNumber = retailer.phone.startsWith('+') ? retailer.phone : `+91${retailer.phone.replace(/\D/g, '')}`;
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const base64Auth = btoa(`${accountSid}:${authToken}`);

    let template: { id: string; twilio_content_sid: string | null; body: string } | null = null;
    if (template_id) {
      const { data: tmpl, error: tErr } = await supabase
        .from('whatsapp_templates')
        .select('id, twilio_content_sid, body')
        .eq('id', template_id)
        .single();
      if (tErr || !tmpl) {
        return new Response(JSON.stringify({ error: 'Template not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!tmpl.twilio_content_sid) {
        return new Response(JSON.stringify({ error: 'Template has not been submitted to Twilio yet' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      template = tmpl;
    }

    const params: Record<string, string> = {
      To: `whatsapp:${toNumber}`,
      From: `whatsapp:${fromNumber}`,
    };
    if (template) {
      params.ContentSid = template.twilio_content_sid!;
      if (template_variables && typeof template_variables === 'object') {
        params.ContentVariables = JSON.stringify(template_variables);
      }
    } else {
      params.Body = messageBody;
    }

    const twilioResp = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${base64Auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    });
    const twilioResult = await twilioResp.json();

    const logStatus = twilioResp.ok ? 'sent' : 'failed';
    await supabase.from('whatsapp_message_log').insert({
      retailer_id: retailer.id,
      to_number: toNumber,
      template_id: template?.id || null,
      body: template ? template.body : messageBody,
      status: logStatus,
      twilio_sid: twilioResult?.sid || null,
      error_code: twilioResp.ok ? null : String(twilioResult?.code || twilioResp.status),
      error_message: twilioResp.ok ? null : (twilioResult?.message || 'Twilio send failed'),
      sent_by: user.id,
    });
    await supabase.from('whatsapp_messages').insert({
      retailer_id: retailer.id,
      direction: 'outbound',
      from_number: fromNumber,
      to_number: toNumber,
      body: template ? template.body : messageBody,
      status: logStatus,
      twilio_sid: twilioResult?.sid || null,
    });

    if (!twilioResp.ok) {
      return new Response(JSON.stringify({ error: twilioResult?.message || 'Twilio send failed', twilio: twilioResult }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, sid: twilioResult.sid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
