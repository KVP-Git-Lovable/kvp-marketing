import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoiceNumber, pdfUrl } = await req.json();

    if (!invoiceNumber) {
      throw new Error('invoiceNumber is required');
    }

    const accountSid = 'AC2bed17b2742df7031ebc7de2d726b62f';
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    if (!authToken) {
      throw new Error('TWILIO_AUTH_TOKEN not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const invoiceUrl = pdfUrl || `${supabaseUrl}/storage/v1/object/public/invoices/public/${invoiceNumber}.pdf`;

    const recipients = ['whatsapp:+919741435887', 'whatsapp:+919845671333'];
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const base64Auth = btoa(`${accountSid}:${authToken}`);

    const contentVariables = JSON.stringify({
      "1": invoiceNumber,
      "2": invoiceUrl,
      "invoice_number": invoiceNumber,
      "invoiceNumber": invoiceNumber,
      "invoice_url": invoiceUrl,
      "invoiceUrl": invoiceUrl,
      "Infinity": invoiceNumber,
      "-Infinity": invoiceNumber,
    });

    console.log(`Sending WhatsApp for invoice ${invoiceNumber}, URL: ${invoiceUrl}`);
    console.log(`Using ContentVariables: ${contentVariables}`);

    const results = await Promise.all(
      recipients.map(async (to) => {
        const formBody = new URLSearchParams({
          To: to,
          From: 'whatsapp:+917411681616',
          ContentSid: 'HX2b27e4c3a2353117297ef3d48c04e292',
          ContentVariables: contentVariables,
        });

        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${base64Auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formBody,
        });

        const result = await response.json();
        if (!response.ok) {
          console.error(`Twilio error for ${to}:`, result);
        } else {
          console.log(`✅ WhatsApp sent to ${to}:`, result.sid);
        }
        return { to, success: response.ok, result };
      })
    );

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ WhatsApp send failed:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
