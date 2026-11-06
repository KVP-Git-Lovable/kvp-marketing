import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { decryptToken, encryptToken } from "../_shared/meta-crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH = 'https://graph.facebook.com/v19.0';

const BILLING_FIELDS = 'name,currency,account_status,disable_reason,is_prepay_account,funding_source,funding_source_details,expired_funding_source_details,amount_spent,balance,spend_cap,business';

async function graph(path: string, token: string, opts: { method?: string; params?: Record<string, string>; body?: Record<string, unknown> } = {}) {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(opts.params || {})) url.searchParams.set(k, v);
  const method = opts.method || 'GET';
  const init: RequestInit = { method };
  if (opts.body) {
    init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.body)) {
      if (v === undefined || v === null || v === '') continue;
      params.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    init.body = params;
  }
  const resp = await fetch(url.toString(), init);
  const data = await resp.json();
  if (!resp.ok) {
    const e0 = data?.error || {};
    const err = new Error(e0.error_user_msg || [e0.error_user_title, e0.message].filter(Boolean).join(': ') || `Graph API error ${resp.status}`) as Error & { metaSubcode?: unknown };
    err.metaSubcode = data?.error?.error_subcode ?? null;
    throw err;
  }
  return data;
}

function formatMinor(amount: string | number | undefined | null, currency: string): string {
  const n = Number(amount || 0) / 100;
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

const ACCOUNT_STATUS_LABELS: Record<number, string> = {
  1: 'Active', 2: 'Disabled', 3: 'Unsettled', 7: 'Pending risk review',
  8: 'Pending settlement', 9: 'In grace period', 100: 'Pending closure', 101: 'Closed',
};

function readBillingAccount(raw: any) {
  return {
    id: raw.id,
    name: raw.name,
    currency: raw.currency,
    account_status: raw.account_status,
    account_status_label: ACCOUNT_STATUS_LABELS[raw.account_status] || 'Unknown',
    disable_reason: raw.disable_reason ?? null,
    is_prepay_account: !!raw.is_prepay_account,
    amount_spent: formatMinor(raw.amount_spent, raw.currency),
    balance: formatMinor(raw.balance, raw.currency),
    spend_cap: raw.spend_cap ? formatMinor(raw.spend_cap, raw.currency) : null,
    funding_source: raw.funding_source_details || null,
    business_name: raw.business?.name || null,
    checked_at: new Date().toISOString(),
  };
}

function metaBillingUrls(adAccountId: string) {
  const bare = adAccountId.replace(/^act_/, '');
  return {
    recharge_url: `https://business.facebook.com/billing_hub/payment_settings?asset_id=${bare}`,
    fallback_url: `https://www.facebook.com/ads/manager/account_settings/account_billing/?act=${bare}`,
  };
}

const PLACEMENT_MAP: Record<string, { platform: 'facebook' | 'instagram'; facebookPosition?: string; instagramPosition?: string }> = {
  FACEBOOK_FEED: { platform: 'facebook', facebookPosition: 'feed' },
  INSTAGRAM_FEED: { platform: 'instagram', instagramPosition: 'stream' },
  FACEBOOK_STORIES: { platform: 'facebook', facebookPosition: 'story' },
  INSTAGRAM_STORIES: { platform: 'instagram', instagramPosition: 'story' },
  REELS: { platform: 'facebook', facebookPosition: 'facebook_reels' },
  FACEBOOK_MARKETPLACE: { platform: 'facebook', facebookPosition: 'marketplace' },
  FACEBOOK_VIDEO_FEEDS: { platform: 'facebook', facebookPosition: 'video_feeds' },
  INSTAGRAM_EXPLORE: { platform: 'instagram', instagramPosition: 'explore' },
};

function placementsToMeta(selected: string[]): { publisher_platforms: string[]; facebook_positions?: string[]; instagram_positions?: string[] } {
  const platforms = new Set<string>();
  const fbPositions = new Set<string>();
  const igPositions = new Set<string>();
  for (const key of selected) {
    const m = PLACEMENT_MAP[key];
    if (!m) continue;
    platforms.add(m.platform);
    if (m.facebookPosition) fbPositions.add(m.facebookPosition);
    if (m.instagramPosition) igPositions.add(m.instagramPosition);
    if (key === 'REELS') { platforms.add('instagram'); igPositions.add('reels'); }
  }
  const out: { publisher_platforms: string[]; facebook_positions?: string[]; instagram_positions?: string[] } = {
    publisher_platforms: platforms.size ? Array.from(platforms) : ['facebook', 'instagram'],
  };
  if (fbPositions.size) out.facebook_positions = Array.from(fbPositions);
  if (igPositions.size) out.instagram_positions = Array.from(igPositions);
  return out;
}

type GeoSelection = {
  countries?: string[];
  regions?: { key: string; name?: string }[];
  cities?: { key: string; name?: string; radius?: number; distance_unit?: string }[];
};

function geoToMeta(geo: GeoSelection | undefined | null, fallbackLocations?: string[]): Record<string, unknown> {
  if (geo && ((geo.countries?.length) || (geo.regions?.length) || (geo.cities?.length))) {
    const out: Record<string, unknown> = {};
    const countries = (geo.countries || []).map((c) => c.toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c));
    const regions = (geo.regions || []).filter((r) => r?.key).map((r) => ({ key: String(r.key) }));
    const cities = (geo.cities || []).filter((c) => c?.key).map((c) => ({
      key: String(c.key),
      radius: Number(c.radius) > 0 ? Number(c.radius) : 25,
      distance_unit: c.distance_unit === 'mile' ? 'mile' : 'kilometer',
    }));
    if (countries.length) out.countries = countries;
    if (regions.length) out.regions = regions;
    if (cities.length) out.cities = cities;
    if (Object.keys(out).length) return out;
  }
  const countries = fallbackLocations?.length ? fallbackLocations : ['IN'];
  return { countries };
}

function buildAdSetTargeting(opts: {
  age_min?: number; age_max?: number; genders?: number[]; locations?: string[]; geo?: GeoSelection;
}): Record<string, unknown> {
  const targeting: Record<string, unknown> = {
    age_min: opts.age_min || 18,
    age_max: opts.age_max || 65,
  };
  if (opts.genders?.length) targeting.genders = opts.genders;
  targeting.geo_locations = geoToMeta(opts.geo, opts.locations);
  return targeting;
}

const AUDIENCE_UPLOAD_BATCH = 5000;
const AUDIENCE_MIN_ROWS = 100;
const AUDIENCE_MAX_ROWS = 10000;

/** Meta error_subcode: "Custom Audience Terms Not Accepted" for the ad account. */
const META_SUBCODE_CA_TERMS = 1870090;

function isCustomAudienceTermsError(e: unknown): boolean {
  const err = e as Error & { metaSubcode?: unknown };
  if (Number(err?.metaSubcode) === META_SUBCODE_CA_TERMS) return true;
  return /custom audience terms/i.test(String(err?.message ?? ''));
}

function customAudienceTermsUrl(adAccountId: string): string {
  return `https://business.facebook.com/ads/manage/customaudiences/tos/?act=${adAccountId}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

type AudienceHashedRow = [string, string];

async function prepareAudienceRows(rows: Array<{ email?: unknown; phone?: unknown }>): Promise<{ data: AudienceHashedRow[]; invalid: number; duplicates: number }> {
  const seen = new Set<string>();
  const data: AudienceHashedRow[] = [];
  let invalid = 0, duplicates = 0;
  for (const r of rows) {
    const email = String(r?.email ?? '').trim().toLowerCase();
    const phone = String(r?.phone ?? '').trim();
    const validEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
    const validPhone = phone && /^\d{8,15}$/.test(phone) ? phone : '';
    if (!validEmail && !validPhone) { invalid++; continue; }
    const key = `${validEmail}|${validPhone}`;
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    data.push([validEmail ? await sha256Hex(validEmail) : '', validPhone ? await sha256Hex(validPhone) : '']);
  }
  return { data, invalid, duplicates };
}

async function uploadAudienceRows(audienceId: string, token: string, data: AudienceHashedRow[]): Promise<number> {
  const sessionId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const batches = Math.max(1, Math.ceil(data.length / AUDIENCE_UPLOAD_BATCH));
  let received = 0;
  for (let i = 0; i < batches; i++) {
    const chunk = data.slice(i * AUDIENCE_UPLOAD_BATCH, (i + 1) * AUDIENCE_UPLOAD_BATCH);
    const res = await graph(`/${audienceId}/users`, token, {
      method: 'POST',
      body: {
        session: { session_id: sessionId, batch_seq: i + 1, last_batch_flag: i === batches - 1, estimated_num_total: data.length },
        payload: { schema: ['EMAIL', 'PHONE'], data: chunk },
      },
    });
    received += Number(res?.num_received ?? chunk.length);
  }
  return received;
}

/**
 * Points an Ad Set's live Meta targeting at a Custom Audience, merging into whatever
 * targeting already exists on Meta (never replacing it wholesale — same precaution
 * ad_sets_update takes) and recording the link locally.
 */
async function linkCustomAudienceToAdSet(
  supabase: ReturnType<typeof createClient>,
  accessToken: string,
  adSetRowId: string,
  customAudienceRowId: string,
): Promise<void> {
  const { data: adSet } = await supabase.from('meta_ad_sets').select('id, meta_ad_set_id').eq('id', adSetRowId).single();
  if (!adSet) throw new Error('Ad set not found');
  const { data: audience } = await supabase.from('meta_custom_audiences').select('external_id, status').eq('id', customAudienceRowId).maybeSingle();
  if (!audience || audience.status !== 'ready' || !audience.external_id) throw new Error('Custom audience is not ready yet');

  let liveTargeting: Record<string, unknown> = {};
  try {
    const live = await graph(`/${adSet.meta_ad_set_id}`, accessToken, { params: { fields: 'targeting' } });
    if (live?.targeting && typeof live.targeting === 'object') liveTargeting = live.targeting;
  } catch (e) {
    console.error('linkCustomAudienceToAdSet: could not read live targeting, proceeding with existing fields only:', e);
  }
  const targeting = { ...liveTargeting, custom_audiences: [{ id: audience.external_id }], targeting_automation: { advantage_audience: 0 } };
  await graph(`/${adSet.meta_ad_set_id}`, accessToken, { method: 'POST', body: { targeting: JSON.stringify(targeting) } });

  await supabase.from('meta_ad_sets').update({ custom_audience_row_id: customAudienceRowId, last_synced_at: new Date().toISOString() }).eq('id', adSetRowId);
}

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

    const body = req.method === 'POST' ? await req.json() : {};
    const action = body.action || new URL(req.url).searchParams.get('action') || 'status';

    const { data: connection } = await supabase
      .from('meta_connections')
      .select('*')
      .eq('status', 'connected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (action === 'status') {
      return json({
        connected: !!connection,
        connection_id: connection?.id || null,
        meta_user_id: connection?.meta_user_id || null,
        external_user_name: connection?.external_user_name || null,
        business_id: connection?.business_id || null,
        business_name: connection?.business_name || null,
        default_page_id: connection?.default_page_id || null,
        default_instagram_id: connection?.default_instagram_id || null,
        default_ad_account_id: connection?.default_ad_account_id || null,
        default_ad_instagram_id: connection?.default_ad_instagram_id || null,
        default_ad_instagram_username: connection?.default_ad_instagram_username || null,
        connected_at: connection?.created_at || null,
        token_expires_at: connection?.token_expires_at || null,
      });
    }

    if (action === 'disconnect') {
      if (connection) {
        await supabase.from('meta_connections').update({ status: 'disconnected' }).eq('id', connection.id);
      }
      return json({ success: true });
    }

    if (!connection) {
      return json({ error: 'No connected Meta account. Connect one in the Meta Connection tab.' }, 400);
    }

    const encKey = Deno.env.get('META_TOKEN_ENC_KEY');
    if (!encKey) return json({ error: 'META_TOKEN_ENC_KEY not configured' }, 500);
    const accessToken = await decryptToken(connection.access_token_enc, encKey);

    // ---------------------------------------------------------------------
    // Connection management
    // ---------------------------------------------------------------------

    if (action === 'save_config') {
      const { default_page_id, default_instagram_id, default_ad_account_id, default_ad_instagram_id, default_ad_instagram_username } = body;
      const { error } = await supabase.from('meta_connections').update({
        default_page_id: default_page_id ?? null,
        default_instagram_id: default_instagram_id ?? null,
        default_ad_account_id: default_ad_account_id ?? null,
        default_ad_instagram_id: default_ad_instagram_id ?? null,
        default_ad_instagram_username: default_ad_instagram_username ?? null,
      }).eq('id', connection.id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === 'sync-pages' || action === 'sync_pages') {
      const resp = await graph('/me/accounts', accessToken, { params: { fields: 'id,name,category,picture{url},access_token,instagram_business_account' } });
      let synced = 0;
      for (const page of resp.data || []) {
        await supabase.from('meta_pages').upsert({
          connection_id: connection.id,
          page_id: page.id,
          page_name: page.name,
          category: page.category || null,
          picture_url: page.picture?.data?.url || null,
          page_token_enc: await encryptToken(page.access_token, encKey),
          instagram_business_id: page.instagram_business_account?.id || null,
        }, { onConflict: 'connection_id,page_id' });
        synced++;
      }
      return json({ synced });
    }

    if (action === 'sync_instagram_accounts') {
      const { data: pages } = await supabase.from('meta_pages').select('*').eq('connection_id', connection.id);
      let updated = 0;
      const warnings: Record<string, string> = {};
      for (const page of pages || []) {
        try {
          const pageTokenEnc = page.page_token_enc ? await decryptToken(page.page_token_enc, encKey) : accessToken;
          const igResp = await graph(`/${page.page_id}`, pageTokenEnc, { params: { fields: 'instagram_business_account{id,username}' } });
          const ig = igResp.instagram_business_account;
          await supabase.from('meta_pages').update({
            instagram_business_id: ig?.id || null,
            instagram_username: ig?.username || null,
          }).eq('id', page.id);
          if (ig?.id) updated++;
        } catch (e) {
          warnings[page.page_name || page.page_id] = e instanceof Error ? e.message : String(e);
        }
      }
      return json({ updated, warnings });
    }

    if (action === 'sync-ad-accounts' || action === 'sync_ad_accounts') {
      const resp = await graph('/me/adaccounts', accessToken, { params: { fields: 'account_id,name,currency,timezone_name,account_status' } });
      let synced = 0;
      for (const acc of resp.data || []) {
        await supabase.from('meta_ad_accounts').upsert({
          connection_id: connection.id,
          ad_account_id: acc.account_id,
          account_name: acc.name,
          currency: acc.currency,
          timezone_name: acc.timezone_name || null,
          account_status: acc.account_status ?? null,
        }, { onConflict: 'connection_id,ad_account_id' });
        synced++;
      }
      return json({ synced });
    }

    // Read-only diagnostic: what Meta itself says about each Page's Instagram link, which
    // permissions this login was actually granted, and which Instagram accounts the user's
    // business portfolios own. Nothing is written and no token is returned.
    if (action === 'instagram_check') {
      const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
      const { data: pageRows } = await supabase.from('meta_pages').select('*').eq('connection_id', connection.id).order('page_name');
      const pages: Array<Record<string, unknown>> = [];
      for (const page of pageRows || []) {
        let token = accessToken;
        try { if (page.page_token_enc) token = await decryptToken(page.page_token_enc, encKey); } catch { /* fall back to the user token */ }
        const entry: Record<string, unknown> = { page_name: page.page_name, page_id: page.page_id, stored_instagram_id: page.instagram_business_id || null };
        for (const field of ['instagram_business_account', 'connected_instagram_account']) {
          try {
            const r = await graph(`/${page.page_id}`, token, { params: { fields: `${field}{id,username}` } });
            entry[field] = r[field] || null;
          } catch (e) {
            entry[`${field}_error`] = errMsg(e);
          }
        }
        pages.push(entry);
      }

      let permissions: Array<{ permission: string; status: string }> = [];
      let permissionsError: string | null = null;
      try {
        const r = await graph('/me/permissions', accessToken);
        permissions = (r.data || []).map((p: { permission: string; status: string }) => ({ permission: p.permission, status: p.status }));
      } catch (e) { permissionsError = errMsg(e); }

      const businesses: Array<Record<string, unknown>> = [];
      let businessesError: string | null = null;
      try {
        const b = await graph('/me/businesses', accessToken, { params: { fields: 'id,name', limit: '25' } });
        for (const biz of b.data || []) {
          const entry: Record<string, unknown> = { id: biz.id, name: biz.name };
          try {
            const ig = await graph(`/${biz.id}/owned_instagram_accounts`, accessToken, { params: { fields: 'id,username', limit: '50' } });
            entry.owned_instagram_accounts = (ig.data || []).map((a: { id: string; username?: string }) => ({ id: a.id, username: a.username || null }));
          } catch (e) { entry.owned_instagram_accounts_error = errMsg(e); }
          businesses.push(entry);
        }
      } catch (e) { businessesError = errMsg(e); }

      return json({ pages, permissions, permissions_error: permissionsError, businesses, businesses_error: businessesError });
    }

    if (action === 'list_ad_instagram_accounts') {
      const adAccountId = body.ad_account_id || connection.default_ad_account_id;
      if (!adAccountId) return json({ accounts: [] });
      try {
        const resp = await graph(`/act_${adAccountId}/instagram_accounts`, accessToken, { params: { fields: 'id,username' } });
        return json({ accounts: resp.data || [] });
      } catch {
        return json({ accounts: [] });
      }
    }

    if (action === 'search_geo') {
      const q = String(body.q || '').trim();
      if (q.length < 2) return json({ results: [] });
      const allowed = ['country', 'region', 'city'];
      const types = Array.isArray(body.types) ? body.types.filter((t: string) => allowed.includes(t)) : allowed;
      try {
        const res = await graph('/search', accessToken, {
          params: { type: 'adgeolocation', q, location_types: JSON.stringify(types.length ? types : allowed), limit: '15' },
        });
        const results = (res.data || []).map((r: any) => ({
          key: String(r.key), name: String(r.name), type: String(r.type),
          country_code: r.country_code ? String(r.country_code) : undefined,
          country_name: r.country_name ? String(r.country_name) : undefined,
          region: r.region ? String(r.region) : undefined,
        }));
        return json({ results });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Location search failed' }, 500);
      }
    }

    if (action === 'create_customer_list_audience') {
      const { name, description, ad_account_id, origin, origin_ref, invalid_count, duplicate_count, rows } = body;
      if (!name) return json({ error: 'Audience name is required' }, 400);
      const rawRows = Array.isArray(rows) ? rows : [];
      if (!rawRows.length) return json({ error: 'The customer list is empty' }, 400);
      const adAccountId = ad_account_id || connection.default_ad_account_id;
      if (!adAccountId) return json({ error: 'Select a default ad account first' }, 400);

      const prepared = await prepareAudienceRows(rawRows);
      if (prepared.data.length < AUDIENCE_MIN_ROWS) {
        return json({ error: `Meta needs at least ${AUDIENCE_MIN_ROWS} valid people in a customer list; ${prepared.data.length} usable rows were found.` }, 400);
      }
      if (prepared.data.length > AUDIENCE_MAX_ROWS) {
        return json({ error: `This list has ${prepared.data.length} valid people; the limit per list is ${AUDIENCE_MAX_ROWS}.` }, 400);
      }

      let created;
      try {
        created = await graph(`/act_${adAccountId}/customaudiences`, accessToken, {
          method: 'POST',
          body: {
            name,
            description: description || `Customer list uploaded from the app (${origin || 'file'})`,
            subtype: 'CUSTOM',
            customer_file_source: 'USER_PROVIDED_ONLY',
          },
        });
      } catch (e) {
        if (isCustomAudienceTermsError(e)) {
          return json({
            error: 'Meta requires the Custom Audience Terms to be accepted for this ad account first.',
            tos_url: customAudienceTermsUrl(adAccountId),
          }, 400);
        }
        throw e;
      }
      const audienceId = String(created.id);

      try {
        await uploadAudienceRows(audienceId, accessToken, prepared.data);
      } catch (e) {
        try { await graph(`/${audienceId}`, accessToken, { method: 'DELETE' }); } catch { /* ignore */ }
        throw e;
      }

      const { data: saved, error } = await supabase.from('meta_custom_audiences').insert({
        connection_id: connection.id,
        ad_account_id: adAccountId,
        external_id: audienceId,
        name, description: description || null,
        source: 'customer_list', origin: origin || 'file', origin_ref: origin_ref || null,
        row_count: prepared.data.length,
        invalid_count: Number(invalid_count) || prepared.invalid,
        duplicate_count: Number(duplicate_count) || prepared.duplicates,
        status: 'ready',
        created_by: user.id,
      }).select().single();
      if (error) return json({ error: `Audience is live on Meta (id ${audienceId}) but saving it here failed: ${error.message}` }, 500);
      return json({ success: true, audience: saved }, 201);
    }

    if (action === 'refresh_custom_audience') {
      const { audience_id } = body;
      const { data: audience } = await supabase.from('meta_custom_audiences').select('*').eq('id', audience_id).maybeSingle();
      if (!audience) return json({ error: 'Audience not found' }, 404);
      if (!audience.external_id) return json({ error: 'This audience was never created on Meta' }, 400);
      try {
        const raw = await graph(`/${audience.external_id}`, accessToken, {
          params: { fields: 'approximate_count_lower_bound,approximate_count_upper_bound,delivery_status,operation_status' },
        });
        const meta_status = {
          approximate_count_lower_bound: raw.approximate_count_lower_bound ?? null,
          approximate_count_upper_bound: raw.approximate_count_upper_bound ?? null,
          delivery_status: raw.delivery_status ?? null,
          operation_status: raw.operation_status ?? null,
          checked_at: new Date().toISOString(),
        };
        await supabase.from('meta_custom_audiences').update({ meta_status }).eq('id', audience.id);
        return json({ success: true, meta_status });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Refresh failed' }, 500);
      }
    }

    if (action === 'delete_custom_audience') {
      const { audience_id } = body;
      const { data: audience } = await supabase.from('meta_custom_audiences').select('*').eq('id', audience_id).maybeSingle();
      if (!audience) return json({ error: 'Audience not found' }, 404);
      if (audience.external_id) {
        try {
          await graph(`/${audience.external_id}`, accessToken, { method: 'DELETE' });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!/does not exist|not found|Unsupported get request/i.test(msg)) {
            return json({ error: msg }, 500);
          }
        }
      }
      await supabase.from('meta_custom_audiences').delete().eq('id', audience.id);
      return json({ success: true });
    }

    // Creates (idempotently) the Custom Audience a Journey Builder "Meta Ad" node feeds —
    // unlike create_customer_list_audience, this starts empty and grows one contact at a
    // time as the journey runs, so it deliberately skips the AUDIENCE_MIN_ROWS guard above.
    if (action === 'create_journey_audience') {
      const { journey_id, node_id, name, ad_set_row_id } = body;
      if (!journey_id || !node_id || !ad_set_row_id) {
        return json({ error: 'journey_id, node_id and ad_set_row_id are required' }, 400);
      }

      const { data: existingLink } = await supabase.from('journey_meta_ad_links')
        .select('*').eq('journey_id', journey_id).eq('node_id', node_id).maybeSingle();
      if (existingLink) return json({ success: true, link: existingLink, already_existed: true });

      const { data: adSet } = await supabase.from('meta_ad_sets').select('id, campaign_id').eq('id', ad_set_row_id).single();
      if (!adSet) return json({ error: 'Ad set not found' }, 404);
      const { data: campaign } = await supabase.from('meta_campaigns').select('ad_account_id').eq('id', adSet.campaign_id).single();
      if (!campaign) return json({ error: 'Campaign not found for this ad set' }, 404);
      const { data: acc } = await supabase.from('meta_ad_accounts').select('ad_account_id').eq('id', campaign.ad_account_id).single();
      if (!acc) return json({ error: 'Ad account not found' }, 404);

      const audienceName = name || `Journey audience — ${journey_id}`;
      let created: { id: string };
      try {
        created = await graph(`/act_${acc.ad_account_id}/customaudiences`, accessToken, {
          method: 'POST',
          body: {
            name: audienceName,
            description: `Grows live as contacts reach the Meta Ad step in journey ${journey_id}`,
            subtype: 'CUSTOM',
            customer_file_source: 'USER_PROVIDED_ONLY',
          },
        });
      } catch (e) {
        if (isCustomAudienceTermsError(e)) {
          return json({
            error: 'Meta requires the Custom Audience Terms to be accepted for this ad account first.',
            tos_url: customAudienceTermsUrl(acc.ad_account_id),
          }, 400);
        }
        throw e;
      }
      const audienceId = String(created.id);

      const { data: audienceRow, error: audErr } = await supabase.from('meta_custom_audiences').insert({
        connection_id: connection.id,
        ad_account_id: acc.ad_account_id,
        external_id: audienceId,
        name: audienceName,
        source: 'journey', origin: 'journey_node', origin_ref: `${journey_id}:${node_id}`,
        row_count: 0, invalid_count: 0, duplicate_count: 0,
        status: 'ready',
        created_by: user.id,
      }).select().single();
      if (audErr) return json({ error: `Audience is live on Meta (id ${audienceId}) but saving it here failed: ${audErr.message}` }, 500);

      try {
        await linkCustomAudienceToAdSet(supabase, accessToken, ad_set_row_id, audienceRow.id);
      } catch (e) {
        return json({ error: `Audience created but could not be linked to the ad set: ${e instanceof Error ? e.message : String(e)}` }, 500);
      }

      const { data: link, error: linkErr } = await supabase.from('journey_meta_ad_links').insert({
        journey_id, node_id, meta_ad_set_row_id: ad_set_row_id, meta_custom_audience_row_id: audienceRow.id,
      }).select().single();
      if (linkErr) return json({ error: `Audience created and linked, but recording it failed: ${linkErr.message}` }, 500);

      return json({ success: true, link }, 201);
    }

    // ---------------------------------------------------------------------
    // Billing
    // ---------------------------------------------------------------------

    if (action === 'billing_status') {
      const adAccountId = body.ad_account_id || connection.default_ad_account_id;
      if (!adAccountId) return json({ error: 'No ad account selected' }, 400);
      const raw = await graph(`/act_${adAccountId}`, accessToken, { params: { fields: BILLING_FIELDS } });
      const account = readBillingAccount({ ...raw, id: adAccountId });
      await supabase.from('meta_ad_accounts')
        .update({ account_status: raw.account_status ?? null })
        .eq('connection_id', connection.id).eq('ad_account_id', adAccountId);
      return json({ account, ...metaBillingUrls(adAccountId) });
    }

    // ---------------------------------------------------------------------
    // Campaigns
    // ---------------------------------------------------------------------

    if (action === 'campaigns_list') {
      const { data: adAccounts } = await supabase.from('meta_ad_accounts').select('id, ad_account_id').eq('connection_id', connection.id);
      const accIds = (adAccounts || []).map((a: any) => a.id);
      const { data, error } = await supabase.from('meta_campaigns').select('*').in('ad_account_id', accIds).order('updated_at', { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    if (action === 'campaigns_import') {
      const { data: adAccounts } = await supabase.from('meta_ad_accounts').select('id, ad_account_id').eq('connection_id', connection.id);
      let campaignsSynced = 0, adSetsSynced = 0, adsSynced = 0;
      const now = new Date().toISOString();

      for (const acc of adAccounts || []) {
        const resp = await graph(`/act_${acc.ad_account_id}/campaigns`, accessToken, {
          params: { fields: 'id,name,objective,status,effective_status,buying_type,daily_budget,lifetime_budget,bid_strategy,spend_cap,special_ad_categories,start_time,stop_time' },
        });
        for (const c of resp.data || []) {
          await supabase.from('meta_campaigns').upsert({
            ad_account_id: acc.id,
            meta_campaign_id: c.id,
            name: c.name,
            objective: c.objective || null,
            status: (c.status || 'PAUSED').toLowerCase(),
            meta_effective_status: c.effective_status || null,
            buying_type: c.buying_type || null,
            daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
            budget_type: c.daily_budget ? 'daily' : c.lifetime_budget ? 'lifetime' : null,
            bid_strategy: c.bid_strategy || null,
            spend_cap: c.spend_cap ? Number(c.spend_cap) / 100 : null,
            special_ad_categories: c.special_ad_categories || null,
            start_date: c.start_time || null,
            end_date: c.stop_time || null,
            last_synced_at: now,
          }, { onConflict: 'ad_account_id,meta_campaign_id' });
          campaignsSynced++;

          const { data: campaignRow } = await supabase.from('meta_campaigns').select('id').eq('ad_account_id', acc.id).eq('meta_campaign_id', c.id).single();
          if (!campaignRow) continue;

          const adSetsResp = await graph(`/${c.id}/adsets`, accessToken, {
            params: { fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_strategy,bid_amount,start_time,end_time,targeting' },
          });
          for (const ms of adSetsResp.data || []) {
            const metaGeo = ms.targeting?.geo_locations || {};
            const countries = metaGeo.countries || null;
            const adSetFields: Record<string, unknown> = {
              campaign_id: campaignRow.id,
              meta_ad_set_id: ms.id,
              name: ms.name,
              status: (ms.status || 'PAUSED').toLowerCase(),
              meta_effective_status: ms.effective_status || null,
              optimization_goal: ms.optimization_goal || null,
              billing_event: ms.billing_event || null,
              bid_strategy: ms.bid_strategy || null,
              bid_amount: ms.bid_amount ? Number(ms.bid_amount) / 100 : null,
              budget_type: ms.daily_budget ? 'daily' : ms.lifetime_budget ? 'lifetime' : null,
              daily_budget: ms.daily_budget ? Number(ms.daily_budget) / 100 : ms.lifetime_budget ? Number(ms.lifetime_budget) / 100 : null,
              targeting: {
                age_min: ms.targeting?.age_min, age_max: ms.targeting?.age_max, genders: ms.targeting?.genders, locations: countries,
                geo: {
                  countries: metaGeo.countries || [],
                  regions: (metaGeo.regions || []).map((r: any) => ({ key: r.key, name: r.name })),
                  cities: (metaGeo.cities || []).map((c: any) => ({ key: c.key, name: c.name, radius: c.radius, distance_unit: c.distance_unit })),
                },
              },
              start_at: ms.start_time || null,
              end_at: ms.end_time || null,
              last_synced_at: now,
            };
            const { data: existingSet } = await supabase.from('meta_ad_sets').select('id').eq('meta_ad_set_id', ms.id).maybeSingle();
            let adSetRowId: string | null = existingSet?.id ?? null;
            if (adSetRowId) {
              await supabase.from('meta_ad_sets').update(adSetFields).eq('id', adSetRowId);
            } else {
              const { data: inserted } = await supabase.from('meta_ad_sets').insert(adSetFields).select('id').single();
              adSetRowId = inserted?.id ?? null;
            }
            if (!adSetRowId) continue;
            adSetsSynced++;

            const adsResp = await graph(`/${ms.id}/ads`, accessToken, {
              params: { fields: 'id,name,status,effective_status,creative{id,name,title,body,object_story_spec,image_url,thumbnail_url,link_url,call_to_action_type}' },
            });
            for (const ma of adsResp.data || []) {
              const creative = ma.creative || {};
              const linkData = creative.object_story_spec?.link_data || {};
              const adFields: Record<string, unknown> = {
                ad_set_id: adSetRowId,
                meta_ad_id: ma.id,
                name: ma.name,
                status: (ma.status || 'PAUSED').toLowerCase(),
                primary_text: creative.body || linkData.message || null,
                headline: creative.title || linkData.name || null,
                description: linkData.description || null,
                call_to_action: creative.call_to_action_type || linkData.call_to_action?.type || null,
                destination_url: linkData.link || creative.link_url || null,
                creative: { media_url: creative.image_url || creative.thumbnail_url || null },
                creative_type: (creative.image_url || creative.thumbnail_url) ? 'image_link' : 'link',
                last_synced_at: now,
              };
              const { data: existingAd } = await supabase.from('meta_ads').select('id').eq('meta_ad_id', ma.id).maybeSingle();
              if (existingAd?.id) {
                await supabase.from('meta_ads').update(adFields).eq('id', existingAd.id);
              } else {
                await supabase.from('meta_ads').insert(adFields);
              }
              adsSynced++;
            }
          }
        }
      }
      return json({ campaigns: campaignsSynced, ad_sets: adSetsSynced, ads: adsSynced, synced: campaignsSynced });
    }

    if (action === 'campaigns_create') {
      const { ad_account_row_id, name, objective, buying_type, budget_type, budget_amount, bid_strategy, spend_cap, special_ad_categories, start_date, end_date } = body;
      const { data: acc } = await supabase.from('meta_ad_accounts').select('ad_account_id').eq('id', ad_account_row_id).single();
      if (!acc) return json({ error: 'Ad account not found' }, 404);

      const graphBody: Record<string, unknown> = {
        name, objective, buying_type: buying_type || 'AUCTION',
        status: 'PAUSED',
        special_ad_categories: JSON.stringify(special_ad_categories || []),
      };
      if (budget_type === 'daily' && budget_amount) graphBody.daily_budget = Math.round(Number(budget_amount) * 100);
      if (budget_type === 'lifetime' && budget_amount) graphBody.lifetime_budget = Math.round(Number(budget_amount) * 100);
      if (bid_strategy) graphBody.bid_strategy = bid_strategy;
      if (spend_cap) graphBody.spend_cap = Math.round(Number(spend_cap) * 100);
      if (start_date) graphBody.start_time = new Date(start_date).toISOString();
      if (end_date) graphBody.stop_time = new Date(end_date).toISOString();

      const created = await graph(`/act_${acc.ad_account_id}/campaigns`, accessToken, { method: 'POST', body: graphBody });
      const { data: row, error } = await supabase.from('meta_campaigns').insert({
        ad_account_id: ad_account_row_id,
        meta_campaign_id: created.id,
        name, objective, buying_type: buying_type || 'AUCTION',
        status: 'paused',
        budget_type, daily_budget: budget_amount || null, bid_strategy: bid_strategy || null,
        spend_cap: spend_cap || null, special_ad_categories: special_ad_categories || null,
        start_date: start_date || null, end_date: end_date || null,
        created_by: user.id, published_at: null, last_synced_at: new Date().toISOString(),
      }).select().single();
      if (error) return json({ error: error.message }, 500);
      return json(row, 201);
    }

    if (action === 'campaigns_update') {
      const { campaign_id, name, budget_amount, spend_cap, bid_strategy, start_date, end_date } = body;
      const { data: campaign } = await supabase.from('meta_campaigns').select('*').eq('id', campaign_id).single();
      if (!campaign) return json({ error: 'Campaign not found' }, 404);
      const graphBody: Record<string, unknown> = {};
      if (name) graphBody.name = name;
      if (budget_amount && campaign.budget_type === 'daily') graphBody.daily_budget = Math.round(Number(budget_amount) * 100);
      if (budget_amount && campaign.budget_type === 'lifetime') graphBody.lifetime_budget = Math.round(Number(budget_amount) * 100);
      if (spend_cap) graphBody.spend_cap = Math.round(Number(spend_cap) * 100);
      if (bid_strategy) graphBody.bid_strategy = bid_strategy;
      if (start_date) graphBody.start_time = new Date(start_date).toISOString();
      if (end_date) graphBody.stop_time = new Date(end_date).toISOString();
      if (Object.keys(graphBody).length > 0) {
        await graph(`/${campaign.meta_campaign_id}`, accessToken, { method: 'POST', body: graphBody });
      }
      const { data: updated, error } = await supabase.from('meta_campaigns').update({
        name: name ?? campaign.name,
        daily_budget: budget_amount ?? campaign.daily_budget,
        spend_cap: spend_cap ?? campaign.spend_cap,
        bid_strategy: bid_strategy ?? campaign.bid_strategy,
        start_date: start_date ?? campaign.start_date,
        end_date: end_date ?? campaign.end_date,
      }).eq('id', campaign_id).select().single();
      if (error) return json({ error: error.message }, 500);
      return json(updated);
    }

    if (action === 'campaigns_update_status' || action === 'campaigns_publish' || action === 'campaigns_pause' || action === 'campaigns_resume' || action === 'campaigns_archive') {
      const { campaign_id } = body;
      const { data: campaign } = await supabase.from('meta_campaigns').select('*').eq('id', campaign_id).single();
      if (!campaign) return json({ error: 'Campaign not found' }, 404);
      const statusMap: Record<string, string> = {
        campaigns_publish: 'ACTIVE', campaigns_pause: 'PAUSED', campaigns_resume: 'ACTIVE', campaigns_archive: 'ARCHIVED',
      };
      const metaStatus = statusMap[action] || body.status;
      await graph(`/${campaign.meta_campaign_id}`, accessToken, { method: 'POST', body: { status: metaStatus } });
      const { data: updated, error } = await supabase.from('meta_campaigns')
        .update({ status: metaStatus.toLowerCase(), published_at: metaStatus === 'ACTIVE' ? new Date().toISOString() : campaign.published_at })
        .eq('id', campaign_id).select().single();
      if (error) return json({ error: error.message }, 500);
      return json(updated);
    }

    if (action === 'campaigns_delete') {
      const { campaign_id, force_local } = body;
      const { data: campaign } = await supabase.from('meta_campaigns').select('*').eq('id', campaign_id).single();
      if (!campaign) return json({ error: 'Campaign not found' }, 404);
      let metaDeleted = false;
      try {
        await graph(`/${campaign.meta_campaign_id}`, accessToken, { method: 'POST', body: { status: 'DELETED' } });
        metaDeleted = true;
      } catch (e) {
        console.error('campaigns_delete: Meta refused delete:', e);
        if (!force_local) return json({ success: false, meta_delete_failed: true, error: e instanceof Error ? e.message : String(e) });
      }
      await supabase.from('meta_campaigns').delete().eq('id', campaign_id);
      return json({ success: true, meta_deleted: metaDeleted });
    }

    // ---------------------------------------------------------------------
    // Ad Sets
    // ---------------------------------------------------------------------

    if (action === 'ad_sets_list') {
      const { campaign_id } = body;
      let query = supabase.from('meta_ad_sets').select('*, meta_campaigns!inner(id, name, ad_account_id), meta_custom_audiences(name, row_count)').order('updated_at', { ascending: false });
      if (campaign_id) query = query.eq('campaign_id', campaign_id);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    if (action === 'ad_sets_create') {
      const {
        campaign_row_id, name, optimization_goal, billing_event, bid_strategy, bid_amount,
        budget_type, budget_amount, start_at, end_at, age_min, age_max, genders, locations, geo, placements,
        custom_audience_row_id,
      } = body;
      const { data: campaign } = await supabase.from('meta_campaigns').select('meta_campaign_id, ad_account_id, budget_type, daily_budget').eq('id', campaign_row_id).single();
      if (!campaign) return json({ error: 'Campaign not found' }, 404);
      const { data: acc } = await supabase.from('meta_ad_accounts').select('ad_account_id').eq('id', campaign.ad_account_id).single();
      if (!acc) return json({ error: 'Ad account not found' }, 404);

      // Meta allows a budget at exactly one level — campaign (CBO) or ad set (ABO), never
      // both. If this campaign already has a campaign-level budget, never forward an
      // ad-set-level one (Meta rejects that combination with error 1885621); otherwise an
      // ad-set budget is required, same as before.
      const campaignHasBudget = !!campaign.budget_type && campaign.daily_budget != null;
      if (!campaignHasBudget && (!budget_type || !budget_amount)) {
        return json({ error: 'This campaign has no campaign-level budget (ABO). A budget is required at the ad set level.' }, 400);
      }

      const targeting = buildAdSetTargeting({ age_min, age_max, genders, locations, geo });
      let audienceExternalId: string | null = null;
      if (custom_audience_row_id) {
        const { data: audience } = await supabase.from('meta_custom_audiences').select('external_id, status').eq('id', custom_audience_row_id).maybeSingle();
        if (!audience || audience.status !== 'ready' || !audience.external_id) {
          return json({ error: 'The selected customer list is not ready yet' }, 400);
        }
        audienceExternalId = audience.external_id;
        targeting.custom_audiences = [{ id: audienceExternalId }];
        targeting.targeting_automation = { advantage_audience: 0 };
      }
      // Some ad accounts (this one included) don't accept an unset bid_strategy and won't
      // apply a usable default on Meta's side — they need an explicit cap strategy plus a
      // positive bid_amount. Default to the cap strategy our own UI offers and require the
      // amount whenever a cap strategy is in play, instead of letting Meta's cryptic
      // "(#100) bid_strategy must be one of..." error reach the user.
      const resolvedBidStrategy = bid_strategy || 'LOWEST_COST_WITH_BID_CAP';
      if ((resolvedBidStrategy === 'COST_CAP' || resolvedBidStrategy === 'LOWEST_COST_WITH_BID_CAP') && !(Number(bid_amount) > 0)) {
        return json({ error: 'Bid Amount is required for this bid strategy.' }, 400);
      }
      const graphBody: Record<string, unknown> = {
        name, campaign_id: campaign.meta_campaign_id,
        optimization_goal, billing_event: billing_event || 'IMPRESSIONS',
        bid_strategy: resolvedBidStrategy,
        bid_amount: bid_amount ? Math.round(Number(bid_amount) * 100) : undefined,
        targeting: JSON.stringify(targeting),
        status: 'PAUSED',
        start_time: start_at ? new Date(start_at).toISOString() : undefined,
        end_time: end_at ? new Date(end_at).toISOString() : undefined,
      };
      if (!campaignHasBudget) {
        if (budget_type === 'daily') graphBody.daily_budget = Math.round(Number(budget_amount) * 100);
        if (budget_type === 'lifetime') graphBody.lifetime_budget = Math.round(Number(budget_amount) * 100);
      }
      if (placements && placements.type === 'manual' && Array.isArray(placements.selected)) {
        Object.assign(graphBody, placementsToMeta(placements.selected));
      }

      const created = await graph(`/act_${acc.ad_account_id}/adsets`, accessToken, { method: 'POST', body: graphBody });
      const { data: row, error } = await supabase.from('meta_ad_sets').insert({
        campaign_id: campaign_row_id,
        meta_ad_set_id: created.id,
        name, status: 'paused',
        optimization_goal, billing_event: billing_event || 'IMPRESSIONS',
        bid_strategy: resolvedBidStrategy, bid_amount: bid_amount || null,
        budget_type: campaignHasBudget ? null : budget_type,
        daily_budget: campaignHasBudget ? null : (budget_amount || null),
        targeting: { age_min, age_max, genders, locations, geo }, placements: placements || null,
        custom_audience_row_id: audienceExternalId ? custom_audience_row_id : null,
        start_at: start_at || null, end_at: end_at || null,
        last_synced_at: new Date().toISOString(),
      }).select().single();
      if (error) return json({ error: error.message }, 500);
      return json(row, 201);
    }

    if (action === 'ad_sets_update') {
      const {
        ad_set_id, name, bid_strategy, bid_amount, budget_type, budget_amount,
        start_at, end_at, age_min, age_max, genders, locations, geo, placements, custom_audience_row_id,
      } = body;
      const { data: adSet } = await supabase.from('meta_ad_sets').select('*, meta_campaigns!inner(budget_type, daily_budget)').eq('id', ad_set_id).single();
      if (!adSet) return json({ error: 'Ad set not found' }, 404);
      const campaignHasBudget = !!adSet.meta_campaigns?.budget_type && adSet.meta_campaigns?.daily_budget != null;

      // Merge the app-owned fields into Meta's LIVE targeting instead of
      // replacing it wholesale — Meta's update API treats `targeting` as a
      // full replace, so sending only what this app knows about would
      // silently wipe out any interests/exclusions/locales set directly in
      // Ads Manager.
      let liveTargeting: Record<string, unknown> = {};
      try {
        const live = await graph(`/${adSet.meta_ad_set_id}`, accessToken, { params: { fields: 'targeting' } });
        if (live?.targeting && typeof live.targeting === 'object') liveTargeting = live.targeting;
      } catch (e) {
        console.error('ad_sets_update: could not read live targeting, proceeding with app-owned fields only:', e);
      }
      const targeting = { ...liveTargeting, ...buildAdSetTargeting({ age_min, age_max, genders, locations, geo }) };
      if (!genders?.length) delete targeting.genders;
      let audienceExternalId: string | null = null;
      if (custom_audience_row_id) {
        const { data: audience } = await supabase.from('meta_custom_audiences').select('external_id, status').eq('id', custom_audience_row_id).maybeSingle();
        if (!audience || audience.status !== 'ready' || !audience.external_id) {
          return json({ error: 'The selected customer list is not ready yet' }, 400);
        }
        audienceExternalId = audience.external_id;
        targeting.custom_audiences = [{ id: audienceExternalId }];
        targeting.targeting_automation = { advantage_audience: 0 };
      }
      const resolvedBidStrategy = bid_strategy || adSet.bid_strategy || 'LOWEST_COST_WITH_BID_CAP';
      const resolvedBidAmount = bid_amount ?? adSet.bid_amount;
      if ((resolvedBidStrategy === 'COST_CAP' || resolvedBidStrategy === 'LOWEST_COST_WITH_BID_CAP') && !(Number(resolvedBidAmount) > 0)) {
        return json({ error: 'Bid Amount is required for this bid strategy.' }, 400);
      }
      const graphBody: Record<string, unknown> = { name, bid_strategy: resolvedBidStrategy, targeting: JSON.stringify(targeting) };
      if (bid_amount) graphBody.bid_amount = Math.round(Number(bid_amount) * 100);
      if (!campaignHasBudget) {
        if (budget_type === 'daily' && budget_amount) graphBody.daily_budget = Math.round(Number(budget_amount) * 100);
        if (budget_type === 'lifetime' && budget_amount) graphBody.lifetime_budget = Math.round(Number(budget_amount) * 100);
      }
      if (end_at) graphBody.end_time = new Date(end_at).toISOString();
      if (placements && placements.type === 'manual' && Array.isArray(placements.selected)) {
        Object.assign(graphBody, placementsToMeta(placements.selected));
      }
      const startTimeIso = start_at ? new Date(start_at).toISOString() : undefined;
      try {
        if (startTimeIso) await graph(`/${adSet.meta_ad_set_id}`, accessToken, { method: 'POST', body: { ...graphBody, start_time: startTimeIso } });
        else await graph(`/${adSet.meta_ad_set_id}`, accessToken, { method: 'POST', body: graphBody });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (startTimeIso && /start time|1487057/i.test(msg)) {
          await graph(`/${adSet.meta_ad_set_id}`, accessToken, { method: 'POST', body: graphBody });
        } else {
          throw e;
        }
      }

      const { data: updated, error } = await supabase.from('meta_ad_sets').update({
        name: name ?? adSet.name,
        bid_strategy: resolvedBidStrategy,
        bid_amount: bid_amount ?? adSet.bid_amount,
        budget_type: campaignHasBudget ? null : (budget_type ?? adSet.budget_type),
        daily_budget: campaignHasBudget ? null : (budget_amount ?? adSet.daily_budget),
        targeting: { age_min, age_max, genders, locations, geo },
        placements: placements ?? adSet.placements,
        custom_audience_row_id: audienceExternalId ? custom_audience_row_id : null,
        start_at: start_at ?? adSet.start_at,
        end_at: end_at ?? adSet.end_at,
        last_synced_at: new Date().toISOString(),
      }).eq('id', ad_set_id).select().single();
      if (error) return json({ error: error.message }, 500);
      return json(updated);
    }

    if (action === 'ad_sets_publish' || action === 'ad_sets_pause' || action === 'ad_sets_resume') {
      const { ad_set_id } = body;
      const { data: adSet } = await supabase.from('meta_ad_sets').select('*').eq('id', ad_set_id).single();
      if (!adSet) return json({ error: 'Ad set not found' }, 404);
      const statusMap: Record<string, string> = { ad_sets_publish: 'ACTIVE', ad_sets_pause: 'PAUSED', ad_sets_resume: 'ACTIVE' };
      const metaStatus = statusMap[action];
      await graph(`/${adSet.meta_ad_set_id}`, accessToken, { method: 'POST', body: { status: metaStatus } });
      const { data: updated, error } = await supabase.from('meta_ad_sets')
        .update({ status: metaStatus.toLowerCase(), published_at: metaStatus === 'ACTIVE' ? new Date().toISOString() : adSet.published_at })
        .eq('id', ad_set_id).select().single();
      if (error) return json({ error: error.message }, 500);
      return json(updated);
    }

    if (action === 'ad_sets_delete') {
      const { ad_set_id, force_local } = body;
      const { data: adSet } = await supabase.from('meta_ad_sets').select('*').eq('id', ad_set_id).single();
      if (!adSet) return json({ error: 'Ad set not found' }, 404);
      let metaDeleted = false;
      try {
        await graph(`/${adSet.meta_ad_set_id}`, accessToken, { method: 'POST', body: { status: 'DELETED' } });
        metaDeleted = true;
      } catch (e) {
        console.error('ad_sets_delete: Meta refused delete:', e);
        if (!force_local) return json({ success: false, meta_delete_failed: true, error: e instanceof Error ? e.message : String(e) });
      }
      await supabase.from('meta_ad_sets').delete().eq('id', ad_set_id);
      return json({ success: true, meta_deleted: metaDeleted });
    }

    // ---------------------------------------------------------------------
    // Ads
    // ---------------------------------------------------------------------

    if (action === 'ads_list') {
      const { ad_set_id } = body;
      let query = supabase.from('meta_ads').select('*, meta_ad_sets!inner(id, name)').order('updated_at', { ascending: false });
      if (ad_set_id) query = query.eq('ad_set_id', ad_set_id);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    if (action === 'ads_create') {
      const { ad_set_row_id, name, page_row_id, primary_text, headline, description, call_to_action, destination_url, media_url, instagram_actor_id } = body;
      const { data: adSet } = await supabase.from('meta_ad_sets').select('meta_ad_set_id, campaign_id').eq('id', ad_set_row_id).single();
      if (!adSet) return json({ error: 'Ad set not found' }, 404);
      const { data: campaign } = await supabase.from('meta_campaigns').select('ad_account_id').eq('id', adSet.campaign_id).single();
      const { data: acc } = await supabase.from('meta_ad_accounts').select('ad_account_id').eq('id', campaign?.ad_account_id).single();
      if (!acc) return json({ error: 'Ad account not found' }, 404);
      const { data: page } = await supabase.from('meta_pages').select('page_id').eq('id', page_row_id).maybeSingle();

      const linkData: Record<string, unknown> = {
        message: primary_text, link: destination_url || 'https://facebook.com',
        name: headline, description: description || undefined,
        call_to_action: call_to_action ? { type: call_to_action } : undefined,
      };
      if (media_url) linkData.picture = media_url;

      const storySpec: Record<string, unknown> = { page_id: page?.page_id, link_data: linkData };
      if (instagram_actor_id) storySpec.instagram_actor_id = instagram_actor_id;

      const creative = await graph(`/act_${acc.ad_account_id}/adcreatives`, accessToken, {
        method: 'POST',
        body: {
          name: `${name} creative`,
          object_story_spec: JSON.stringify(storySpec),
        },
      });
      const createdAd = await graph(`/act_${acc.ad_account_id}/ads`, accessToken, {
        method: 'POST',
        body: { name, adset_id: adSet.meta_ad_set_id, creative: JSON.stringify({ creative_id: creative.id }), status: 'PAUSED' },
      });

      const { data: row, error } = await supabase.from('meta_ads').insert({
        ad_set_id: ad_set_row_id, meta_ad_id: createdAd.id, name, status: 'paused',
        primary_text, headline: headline || null, description: description || null,
        call_to_action: call_to_action || null, destination_url: destination_url || null,
        creative: { media_url, page_row_id, instagram_actor_id: instagram_actor_id || null }, creative_type: media_url ? 'image_link' : 'link',
        last_synced_at: new Date().toISOString(),
      }).select().single();
      if (error) return json({ error: error.message }, 500);
      return json(row, 201);
    }

    if (action === 'ads_update') {
      const { ad_id, name, page_row_id, primary_text, headline, description, call_to_action, destination_url, media_url, instagram_actor_id } = body;
      const { data: ad } = await supabase.from('meta_ads').select('*, meta_ad_sets!inner(meta_ad_set_id, campaign_id)').eq('id', ad_id).single();
      if (!ad) return json({ error: 'Ad not found' }, 404);
      const adSet = (ad as any).meta_ad_sets;
      const { data: campaign } = await supabase.from('meta_campaigns').select('ad_account_id').eq('id', adSet.campaign_id).single();
      const { data: acc } = await supabase.from('meta_ad_accounts').select('ad_account_id').eq('id', campaign?.ad_account_id).single();
      if (!acc) return json({ error: 'Ad account not found' }, 404);
      const resolvedPageRowId = page_row_id || (ad.creative as any)?.page_row_id;
      const { data: page } = await supabase.from('meta_pages').select('page_id').eq('id', resolvedPageRowId).maybeSingle();

      const linkData: Record<string, unknown> = {
        message: primary_text, link: destination_url || 'https://facebook.com',
        name: headline, description: description || undefined,
        call_to_action: call_to_action ? { type: call_to_action } : undefined,
      };
      if (media_url) linkData.picture = media_url;
      const storySpec: Record<string, unknown> = { page_id: page?.page_id, link_data: linkData };
      const resolvedInstagramId = instagram_actor_id ?? (ad.creative as any)?.instagram_actor_id;
      if (resolvedInstagramId) storySpec.instagram_actor_id = resolvedInstagramId;

      const creative = await graph(`/act_${acc.ad_account_id}/adcreatives`, accessToken, {
        method: 'POST',
        body: { name: `${name || ad.name} creative`, object_story_spec: JSON.stringify(storySpec) },
      });
      await graph(`/${ad.meta_ad_id}`, accessToken, {
        method: 'POST',
        body: { name: name || ad.name, creative: JSON.stringify({ creative_id: creative.id }) },
      });

      const { data: updated, error } = await supabase.from('meta_ads').update({
        name: name ?? ad.name,
        primary_text: primary_text ?? ad.primary_text,
        headline: headline ?? ad.headline,
        description: description ?? ad.description,
        call_to_action: call_to_action ?? ad.call_to_action,
        destination_url: destination_url ?? ad.destination_url,
        creative: { media_url: media_url ?? (ad.creative as any)?.media_url, page_row_id: resolvedPageRowId, instagram_actor_id: resolvedInstagramId || null },
        creative_type: (media_url ?? (ad.creative as any)?.media_url) ? 'image_link' : 'link',
        last_synced_at: new Date().toISOString(),
      }).eq('id', ad_id).select().single();
      if (error) return json({ error: error.message }, 500);
      return json(updated);
    }

    if (action === 'ads_publish' || action === 'ads_pause' || action === 'ads_resume') {
      const { ad_id } = body;
      const { data: ad } = await supabase.from('meta_ads').select('*').eq('id', ad_id).single();
      if (!ad) return json({ error: 'Ad not found' }, 404);
      const statusMap: Record<string, string> = { ads_publish: 'ACTIVE', ads_pause: 'PAUSED', ads_resume: 'ACTIVE' };
      const metaStatus = statusMap[action];
      await graph(`/${ad.meta_ad_id}`, accessToken, { method: 'POST', body: { status: metaStatus } });
      const { data: updated, error } = await supabase.from('meta_ads').update({ status: metaStatus.toLowerCase() }).eq('id', ad_id).select().single();
      if (error) return json({ error: error.message }, 500);
      return json(updated);
    }

    if (action === 'ads_delete') {
      const { ad_id, force_local } = body;
      const { data: ad } = await supabase.from('meta_ads').select('*').eq('id', ad_id).single();
      if (!ad) return json({ error: 'Ad not found' }, 404);
      let metaDeleted = false;
      try {
        await graph(`/${ad.meta_ad_id}`, accessToken, { method: 'POST', body: { status: 'DELETED' } });
        metaDeleted = true;
      } catch (e) {
        console.error('ads_delete: Meta refused delete:', e);
        if (!force_local) return json({ success: false, meta_delete_failed: true, error: e instanceof Error ? e.message : String(e) });
      }
      await supabase.from('meta_ads').delete().eq('id', ad_id);
      return json({ success: true, meta_deleted: metaDeleted });
    }

    // ---------------------------------------------------------------------
    // Organic posts
    // ---------------------------------------------------------------------

    if (action === 'create-organic-post' || action === 'create_organic_post') {
      const { page_id, message, media_url, scheduled_for, post_type, destination, instagram_id } = body;
      const resolvedPostType = post_type || 'text';
      const resolvedDestination = destination || 'facebook';
      if (!['text', 'image', 'video'].includes(resolvedPostType)) return json({ error: 'Invalid post_type' }, 400);
      if (!['facebook', 'instagram', 'both'].includes(resolvedDestination)) return json({ error: 'Invalid destination' }, 400);
      if (!page_id || !message) return json({ error: 'page_id and message are required' }, 400);
      if (resolvedPostType !== 'text' && !media_url) return json({ error: 'media_url is required for image/video posts' }, 400);
      if ((resolvedDestination === 'instagram' || resolvedDestination === 'both') && !instagram_id) {
        return json({ error: 'instagram_id is required for this destination' }, 400);
      }
      if ((resolvedDestination === 'instagram' || resolvedDestination === 'both') && resolvedPostType === 'text') {
        return json({ error: 'Instagram posts require an image or video' }, 400);
      }
      const { data: post, error } = await supabase.from('meta_organic_posts').insert({
        page_id, message, media_url: media_url || null,
        status: scheduled_for ? 'scheduled' : 'draft',
        scheduled_for: scheduled_for || null,
        post_type: resolvedPostType, destination: resolvedDestination,
        instagram_id: instagram_id || null,
        created_by: user.id,
      }).select().single();
      if (error) return json({ error: error.message }, 500);
      return json(post, 201);
    }

    if (action === 'publish-organic-post' || action === 'publish_organic_post') {
      const { post_id } = body;
      const { data: post, error: pErr } = await supabase
        .from('meta_organic_posts').select('*, meta_pages!inner(page_id, page_token_enc)').eq('id', post_id).single();
      if (pErr || !post) return json({ error: 'Post not found' }, 404);
      const pageToken = await decryptToken((post as any).meta_pages.page_token_enc, encKey);
      const pageId = (post as any).meta_pages.page_id;
      const postType = post.post_type || 'text';
      const destination = post.destination || 'facebook';

      const now = Date.now();
      const scheduledMs = post.scheduled_for ? new Date(post.scheduled_for).getTime() : null;
      const isScheduled = !!scheduledMs && scheduledMs > now + 60_000;
      if (isScheduled) {
        if (destination !== 'facebook') {
          return json({ error: 'Instagram does not support scheduled publishing — choose Facebook only, or publish immediately.' }, 400);
        }
        const minMs = now + 10 * 60_000, maxMs = now + 75 * 24 * 60 * 60_000;
        if (scheduledMs! < minMs || scheduledMs! > maxMs) {
          return json({ error: 'Scheduled time must be between 10 minutes and 75 days from now' }, 400);
        }
      }

      const scheduleFields: Record<string, string> = isScheduled
        ? { published: 'false', scheduled_publish_time: String(Math.floor(scheduledMs! / 1000)) }
        : {};

      let facebookPostId: string | null = null;
      let instagramPostId: string | null = null;
      let errorMessage: string | null = null;

      try {
        if (destination === 'facebook' || destination === 'both') {
          if (postType === 'image') {
            const r = await fetch(`${GRAPH}/${pageId}/photos`, {
              method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ url: post.media_url, caption: post.message, access_token: pageToken, ...scheduleFields }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d?.error?.message || 'Facebook photo publish failed');
            facebookPostId = d.post_id || d.id;
          } else if (postType === 'video') {
            const r = await fetch(`${GRAPH}/${pageId}/videos`, {
              method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ file_url: post.media_url, description: post.message, access_token: pageToken, ...scheduleFields }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d?.error?.message || 'Facebook video publish failed');
            facebookPostId = d.id;
          } else {
            const params: Record<string, string> = { message: post.message, access_token: pageToken, ...scheduleFields };
            if (post.media_url) params.link = post.media_url;
            const r = await fetch(`${GRAPH}/${pageId}/feed`, {
              method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d?.error?.message || 'Facebook post publish failed');
            facebookPostId = d.id;
          }
        }

        if (destination === 'instagram' || destination === 'both') {
          const igId = post.instagram_id;
          if (!igId) throw new Error('No Instagram account selected for this post');
          const containerParams: Record<string, string> = postType === 'video'
            ? { media_type: 'REELS', video_url: post.media_url, caption: post.message, access_token: pageToken }
            : { image_url: post.media_url, caption: post.message, access_token: pageToken };
          const cr = await fetch(`${GRAPH}/${igId}/media`, {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(containerParams),
          });
          const container = await cr.json();
          if (!cr.ok) throw new Error(container?.error?.message || 'Instagram media container failed');
          const pr = await fetch(`${GRAPH}/${igId}/media_publish`, {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ creation_id: container.id, access_token: pageToken }),
          });
          const published = await pr.json();
          if (!pr.ok) throw new Error(published?.error?.message || 'Instagram publish failed');
          instagramPostId = published.id;
        }
      } catch (e) {
        errorMessage = e instanceof Error ? e.message : String(e);
      }

      if (errorMessage) {
        await supabase.from('meta_organic_posts').update({
          status: 'failed', error_message: errorMessage,
          meta_post_id: facebookPostId, instagram_post_id: instagramPostId,
        }).eq('id', post_id);
        return json({ error: errorMessage }, 502);
      }

      await supabase.from('meta_organic_posts').update({
        status: isScheduled ? 'scheduled' : 'published',
        meta_post_id: facebookPostId, instagram_post_id: instagramPostId,
        published_at: isScheduled ? null : new Date().toISOString(),
        error_message: null,
      }).eq('id', post_id);
      return json({ success: true, meta_post_id: facebookPostId, instagram_post_id: instagramPostId, scheduled: isScheduled });
    }

    // ---------------------------------------------------------------------
    // Diagnostics (trimmed check suite — no live object creation)
    // ---------------------------------------------------------------------

    if (action === 'diagnostics_run') {
      const results: Array<Record<string, unknown>> = [];
      const runCheck = async (category: string, endpoint: string, fn: () => Promise<{ records?: number; sample?: unknown }>) => {
        const start = Date.now();
        let status = 'pass', http_status = 200, error: string | null = null, records = 0, sample: unknown = null;
        try {
          const r = await fn();
          records = r.records ?? 0;
          sample = r.sample ?? null;
        } catch (e) {
          status = 'fail'; http_status = 500; error = e instanceof Error ? e.message : String(e);
        }
        const duration_ms = Date.now() - start;
        results.push({ category, endpoint, status, http_status, duration_ms, records, error });
        await supabase.from('meta_api_diagnostics').insert({
          check_name: `${category}: ${endpoint}`, status, detail: error, category, endpoint,
          method: 'GET', http_status, duration_ms, records, sample, run_by: user.id,
        });
      };

      await runCheck('Connection', '/me', async () => {
        const r = await graph('/me', accessToken, { params: { fields: 'id,name' } });
        return { records: 1, sample: r };
      });
      await runCheck('Pages', '/me/accounts', async () => {
        const r = await graph('/me/accounts', accessToken, { params: { fields: 'id,name' } });
        return { records: (r.data || []).length, sample: r.data?.[0] || null };
      });
      if (connection.default_ad_account_id) {
        await runCheck('Ad Account', `/act_${connection.default_ad_account_id}`, async () => {
          const r = await graph(`/act_${connection.default_ad_account_id}`, accessToken, { params: { fields: 'id,name,account_status' } });
          return { records: 1, sample: r };
        });
        await runCheck('Campaigns', `/act_${connection.default_ad_account_id}/campaigns`, async () => {
          const r = await graph(`/act_${connection.default_ad_account_id}/campaigns`, accessToken, { params: { fields: 'id,name,status' } });
          return { records: (r.data || []).length, sample: r.data?.[0] || null };
        });
      }

      return json({ results });
    }

    if (action === 'diagnostics_history') {
      const { data, error } = await supabase.from('meta_api_diagnostics').select('*').order('run_at', { ascending: false }).limit(50);
      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 200);
  } catch (error) {
    console.error('Error:', error);
    const metaSubcode = (error as { metaSubcode?: unknown })?.metaSubcode;
    const isMeta = metaSubcode !== undefined;
    const raw = error instanceof Error ? error.message : 'Unknown error';
    const message = isMeta && /permission/i.test(raw)
      ? 'Meta denied permission for this action. Make sure your Facebook account has an admin or advertiser role on this ad account/business and that all requested permissions were granted, then reconnect Meta.'
      : raw;
    return new Response(JSON.stringify({ error: message, meta_error: isMeta, meta_subcode: metaSubcode ?? null }), {
      status: isMeta ? 400 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
