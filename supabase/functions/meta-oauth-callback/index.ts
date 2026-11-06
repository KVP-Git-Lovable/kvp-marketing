import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { encryptToken } from "../_shared/meta-crypto.ts";
import { allowedAppOrigin, resultRedirect } from "../_shared/oauth-redirect.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function closingPage(message: string, ok: boolean) {
  const body = ok
    ? `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;">
  <div style="width:64px;height:64px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;margin-bottom:16px;">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
  </div>
  <h1 style="font-size:1.25rem;font-weight:700;color:#16a34a;margin:0 0 8px;">Success</h1>
  <p style="margin:0;color:#374151;">${message}</p>
  <p style="margin:8px 0 0;color:#9ca3af;font-size:0.875rem;">Note: You may close this window.</p>
</div>`
    : `<p>${message}</p>`;
  return `<!doctype html><html><body style="font-family:sans-serif;padding:2rem;">
${body}
<script>
  if (window.opener) {
    window.opener.postMessage({ source: 'meta-oauth', ok: ${ok} }, '*');
  }
  setTimeout(() => window.close(), 1500);
</script>
</body></html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error_description') || url.searchParams.get('error');

  const htmlHeaders = { ...corsHeaders, 'Content-Type': 'text/html' };

  // Where the popup should land: the app origin recorded in `state` by meta-oauth-start.
  // With a valid origin the result is shown by the app's /oauth/result page; otherwise
  // fall back to the plain closing page below.
  let appOrigin: string | null = null;
  try { appOrigin = allowedAppOrigin(JSON.parse(atob(state || '')).origin); } catch { /* no/invalid state */ }
  const finish = (message: string, ok: boolean) =>
    appOrigin
      ? resultRedirect(appOrigin, 'meta-oauth', ok, message)
      : new Response(closingPage(message, ok), { headers: htmlHeaders });

  if (errorParam) {
    return finish(`Meta connection failed: ${errorParam}`, false);
  }
  if (!code || !state) {
    return finish('Missing code or state from Meta.', false);
  }

  try {
    const { uid } = JSON.parse(atob(state));
    if (!uid) throw new Error('Invalid state');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const appId = Deno.env.get('META_APP_ID');
    const appSecret = Deno.env.get('META_APP_SECRET');
    const encKey = Deno.env.get('META_TOKEN_ENC_KEY');
    if (!appId || !appSecret || !encKey) {
      return finish('Meta secrets are not fully configured on the server.', false);
    }

    const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenResp = await fetch(tokenUrl.toString());
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      console.error('Meta token exchange failed:', tokenData);
      return finish('Could not exchange code for a Meta access token.', false);
    }

    // Exchange for a long-lived token.
    const longLivedUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', appId);
    longLivedUrl.searchParams.set('client_secret', appSecret);
    longLivedUrl.searchParams.set('fb_exchange_token', tokenData.access_token);
    const longLivedResp = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedResp.json();
    const finalToken = longLivedResp.ok && longLivedData.access_token ? longLivedData.access_token : tokenData.access_token;
    const expiresInSec = longLivedData.expires_in || tokenData.expires_in || null;

    const meResp = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(finalToken)}`);
    const meData = await meResp.json();

    const encryptedToken = await encryptToken(finalToken, encKey);

    // Reconnecting the same Meta user should refresh their existing row, not
    // create a second one — a duplicate row here is what makes the rest of
    // meta-api resolve the wrong (empty) connection as "current". Order by
    // created_at and take the first instead of .maybeSingle(), which errors
    // (silently discarded below, since only .data is read) when more than
    // one row already matches — exactly the state a prior duplicate leaves
    // behind, which would otherwise make this fall through to another insert.
    const metaUserId = meData?.id || null;
    const { data: existingRows } = metaUserId
      ? await supabase.from('meta_connections').select('id').eq('meta_user_id', metaUserId).order('created_at', { ascending: false })
      : { data: [] as { id: string }[] };
    const existing = existingRows?.[0] ?? null;

    if (existing) {
      await supabase.from('meta_connections').update({
        access_token_enc: encryptedToken,
        token_expires_at: expiresInSec ? new Date(Date.now() + expiresInSec * 1000).toISOString() : null,
        status: 'connected',
        connected_by: uid,
      }).eq('id', existing.id);
      // Self-heal: collapse any other stray rows for this user so they stop
      // being counted as separately "connected" by anything that lists them.
      const staleIds = (existingRows || []).slice(1).map((r) => r.id);
      if (staleIds.length) {
        await supabase.from('meta_connections').update({ status: 'disconnected' }).in('id', staleIds);
      }
    } else {
      await supabase.from('meta_connections').insert({
        meta_user_id: metaUserId,
        access_token_enc: encryptedToken,
        token_expires_at: expiresInSec ? new Date(Date.now() + expiresInSec * 1000).toISOString() : null,
        status: 'connected',
        connected_by: uid,
      });
    }

    return finish('Meta account connected.', true);
  } catch (error) {
    console.error('Error:', error);
    return finish('Unexpected error connecting Meta account.', false);
  }
});
