import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { allowedAppOrigin } from "../_shared/oauth-redirect.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_OAUTH_SCOPES = 'ads_management,ads_read,pages_show_list,pages_read_engagement,pages_manage_posts,business_management';

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
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appId = Deno.env.get('META_APP_ID');
    if (!appId) {
      return new Response(JSON.stringify({
        error: 'META_APP_ID is not configured. Add META_APP_ID, META_APP_SECRET and META_TOKEN_ENC_KEY as project secrets to enable Meta Connection.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // State carries the requesting user id so the callback can attribute
    // connected_by without a session (Meta's redirect has no Supabase JWT).
    // `origin` lets the callback send the popup back to this app's /oauth/result page.
    const origin = allowedAppOrigin(req.headers.get('origin'));
    const state = btoa(JSON.stringify({ uid: user.id, t: Date.now(), ...(origin ? { origin } : {}) }));
    const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;
    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', META_OAUTH_SCOPES);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    return new Response(JSON.stringify({ url: authUrl.toString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
