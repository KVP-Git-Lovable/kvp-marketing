import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { decryptToken } from "../_shared/meta-crypto.ts";
import { createHash, timingSafeEqual } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-token',
  // Visible on every response (even a 401) so a deploy can be verified without a login.
  'X-Journeys-Build': 'event-audience-2026-11-06',
};

const sha256 = (v: string) => createHash('sha256').update(v, 'utf8').digest();

// Who may run the sweep: a signed-in user (the "Run Now" button, publish's real-time
// kick) or the scheduler, which presents the token stored in public.journey_cron_token
// (readable only with the service role). Gateway JWT verification is off for this
// function so the scheduler can call it without any key; anything else gets a 401.
// deno-lint-ignore no-explicit-any
async function isAuthorizedSweep(req: Request, supabase: any): Promise<boolean> {
  const cronToken = req.headers.get('x-cron-token');
  if (cronToken) {
    const { data } = await supabase.from('journey_cron_token').select('token').limit(1).maybeSingle();
    if (data?.token && timingSafeEqual(sha256(cronToken), sha256(String(data.token)))) return true;
    return false;
  }
  const bearer = /^Bearer\s+(\S+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!bearer) return false;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && timingSafeEqual(sha256(bearer), sha256(serviceKey))) return true;
  const { data, error } = await supabase.auth.getUser(bearer);
  return !error && !!data?.user;
}

// Cron-driven sweep (also safe to invoke manually, e.g. a "Run Now" button):
// advances every active journey_enrollments row whose next_fire_at is due —
// sends that step's WhatsApp template to the retailer (direct Twilio REST,
// reusing this project's existing sender), logs to journey_message_log, and
// either schedules the next step or marks the enrollment completed.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!(await isAuthorizedSweep(req, supabase))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || '+917411681616';

    // Marketing-contact audience path (Institutional/Distributor databases) —
    // fully parallel to the retailer path, mirroring journey-actions'
    // publish-time resolution so scheduled re-fires behave identically to a
    // manual publish. Kept separate rather than merged into the retailer
    // query builder, since marketing contacts enroll into their own
    // marketing_journey_enrollments table.
    const MARKETING_SEGMENT_TYPES = new Set(['marketing_institutional', 'marketing_distributor', 'marketing_event']);
    interface MarketingFilterRow {
      field: 'name' | 'phone' | 'email' | 'website' | 'state' | 'country';
      operator: 'equals' | 'not_equals' | 'contains' | 'is_any_of' | 'is_empty' | 'is_not_empty';
      value?: string | string[];
    }
    const MARKETING_ALLOWED_FIELDS = new Set(['name', 'phone', 'email', 'website', 'state', 'country']);
    function applyMarketingFilters(query: any, filters: MarketingFilterRow[]) {
      for (const f of filters) {
        if (!MARKETING_ALLOWED_FIELDS.has(f.field)) continue;
        switch (f.operator) {
          case 'equals': query = query.eq(f.field, f.value); break;
          case 'not_equals': query = query.neq(f.field, f.value); break;
          case 'contains': query = query.ilike(f.field, `%${f.value}%`); break;
          case 'is_any_of': query = query.in(f.field, Array.isArray(f.value) ? f.value : [f.value]); break;
          case 'is_empty': query = query.or(`${f.field}.is.null,${f.field}.eq.`); break;
          case 'is_not_empty': query = query.not(f.field, 'is', null).neq(f.field, ''); break;
        }
      }
      return query;
    }
    async function matchingMarketingContactIds(listViewId: string): Promise<string[]> {
      const { data: listView } = await supabase.from('marketing_contact_list_views').select('database_type, filters').eq('id', listViewId).single();
      if (!listView) return [];
      let query = supabase.from('marketing_contacts').select('id').eq('database_type', listView.database_type).not('phone', 'is', null);
      query = applyMarketingFilters(query, Array.isArray(listView.filters) ? listView.filters : []);
      const { data } = await query;
      return (data || []).map((r: { id: string }) => r.id);
    }

    // --- Campaign window sweeps (journeys.start_date / end_date). Run first so a
    // journey that starts now is picked up by this tick's due-step processing and a
    // journey past its end date sends nothing more. Message processing below only
    // ever touches journeys with status = 'active'.
    let campaignsStarted = 0;
    let campaignsCompleted = 0;
    {
      const nowIso = new Date().toISOString();
      const { data: toStart } = await supabase
        .from('journeys').select('id')
        .eq('status', 'scheduled').not('start_date', 'is', null).lte('start_date', nowIso)
        .is('deleted_at', null).limit(50);
      for (const j of toStart || []) {
        const { error } = await supabase.from('journeys').update({ status: 'active' }).eq('id', j.id).eq('status', 'scheduled');
        if (!error) campaignsStarted++;
      }
      const { data: toComplete } = await supabase
        .from('journeys').select('id')
        .eq('status', 'active').not('end_date', 'is', null).lte('end_date', nowIso)
        .is('deleted_at', null).limit(50);
      for (const j of toComplete || []) {
        const { error } = await supabase.from('journeys').update({ status: 'completed' }).eq('id', j.id).eq('status', 'active');
        if (!error) campaignsCompleted++;
      }
    }

    // --- Scheduled re-fire sweep: approved journeys with a due journey_schedules
    // row get auto-(re-)published, then next_run_at advances per recurrence_rule.
    let schedulesFired = 0;
    const { data: dueSchedules } = await supabase
      .from('journey_schedules')
      .select('*, journeys!inner(id, filters, canvas_data, status, approval_status, deleted_at, segment_type, end_date)')
      .not('next_run_at', 'is', null)
      .is('journeys.deleted_at', null)
      .lte('next_run_at', new Date().toISOString())
      .limit(50);

    for (const sched of dueSchedules || []) {
      const journey = sched.journeys;
      if (!journey || journey.status === 'archived' || journey.approval_status !== 'approved') continue;
      // A campaign that hasn't started yet, has completed, or is past its end date is never re-fired.
      if (journey.status === 'scheduled' || journey.status === 'completed') continue;
      if (journey.end_date && new Date(journey.end_date).getTime() <= Date.now()) continue;

      const isMarketingJourney = MARKETING_SEGMENT_TYPES.has(journey.segment_type);
      const enrollmentsTable = isMarketingJourney ? 'marketing_journey_enrollments' : 'journey_enrollments';
      const excludedTable = isMarketingJourney ? 'marketing_journey_excluded_contacts' : 'journey_excluded_contacts';
      const audienceKey = isMarketingJourney ? 'contact_id' : 'retailer_id';

      const excludedRes = await supabase.from(excludedTable).select(audienceKey).eq('journey_id', journey.id);
      const excludedIds = new Set((excludedRes.data || []).map((e: any) => e[audienceKey]));

      await supabase.from(enrollmentsTable).delete().eq('journey_id', journey.id).neq('status', 'completed');

      let toEnroll: string[];
      if (isMarketingJourney) {
        const listViewId = journey.filters?.list_view_id;
        const candidates = listViewId ? await matchingMarketingContactIds(listViewId) : [];
        toEnroll = candidates.filter((id: string) => !excludedIds.has(id));
      } else {
        let query = supabase.from('retailers').select('id').not('phone', 'is', null);
        const filters = journey.filters || {};
        if (filters.category) query = query.eq('category', filters.category);
        if (filters.territory_id) query = query.eq('territory_id', filters.territory_id);
        if (filters.beat_id) query = query.eq('beat_id', filters.beat_id);
        const { data: candidates } = await query;
        toEnroll = (candidates || []).map((r: any) => r.id).filter((id: string) => !excludedIds.has(id));
      }

      const canvasData = journey.canvas_data || {};
      const schedNodes: Array<{ id: string; type: string; data?: any }> = canvasData.nodes;
      let startNodeId: string | null = null;
      let startFireAt = new Date().toISOString();
      if (Array.isArray(schedNodes) && schedNodes.length > 0) {
        const entry = schedNodes.find((n) => n.type === 'entry');
        const edge = entry ? (canvasData.edges || []).find((e: any) => e.source === entry.id) : null;
        startNodeId = edge?.target ?? null;
        const startNode = startNodeId ? schedNodes.find((n) => n.id === startNodeId) : null;
        if (startNode?.type === 'delay') {
          const duration = Number(startNode.data?.duration) || 0;
          const unitMs = startNode.data?.unit === 'days' ? 86400000 : 3600000;
          startFireAt = new Date(Date.now() + duration * unitMs).toISOString();
        }
      } else if (canvasData.steps?.length > 0) {
        startNodeId = canvasData.steps[0].id;
      }

      if (toEnroll.length > 0 && startNodeId) {
        await supabase.from(enrollmentsTable).insert(
          toEnroll.map((id: string) => ({ journey_id: journey.id, [audienceKey]: id, current_node_id: startNodeId, status: 'active', next_fire_at: startFireAt }))
        );
      }
      await supabase.from('journeys').update({ status: 'active' }).eq('id', journey.id);
      schedulesFired++;

      let nextRunAt: string | null = null;
      if (sched.schedule_type === 'daily') {
        nextRunAt = new Date(new Date(sched.next_run_at).getTime() + 86400000).toISOString();
      } else if (sched.schedule_type === 'weekly') {
        nextRunAt = new Date(new Date(sched.next_run_at).getTime() + 7 * 86400000).toISOString();
      } else if (sched.schedule_type === 'monthly') {
        const d = new Date(sched.next_run_at);
        d.setMonth(d.getMonth() + 1);
        nextRunAt = d.toISOString();
      }
      await supabase.from('journey_schedules').update({ next_run_at: nextRunAt }).eq('id', sched.id);
    }

    const { data: due, error: dueErr } = await supabase
      .from('journey_enrollments')
      .select('*, journeys!inner(id, canvas_data, status, deleted_at)')
      .eq('status', 'active')
      .eq('journeys.status', 'active')
      .is('journeys.deleted_at', null)
      .lte('next_fire_at', new Date().toISOString())
      .limit(200);

    if (dueErr) throw dueErr;

    const { data: dueMarketing, error: dueMarketingErr } = await supabase
      .from('marketing_journey_enrollments')
      .select('*, journeys!inner(id, canvas_data, status, deleted_at)')
      .eq('status', 'active')
      .eq('journeys.status', 'active')
      .is('journeys.deleted_at', null)
      .lte('next_fire_at', new Date().toISOString())
      .limit(200);

    if (dueMarketingErr) throw dueMarketingErr;

    let processed = 0;
    let failed = 0;

    const findNextNodeId = (nodeId: string, edges: Array<{ source: string; target: string; sourceHandle?: string | null }>, handle?: string): string | null => {
      const edge = handle
        ? edges.find((e) => e.source === nodeId && e.sourceHandle === handle)
        : edges.find((e) => e.source === nodeId);
      return edge?.target ?? null;
    };
    const nextFireAtForNode = (nodeId: string | null, nodes: Array<{ id: string; type: string; data?: any }>): string => {
      const node = nodeId ? nodes.find((n) => n.id === nodeId) : null;
      if (node?.type === 'delay') {
        const duration = Number(node.data?.duration) || 0;
        const unitMs = node.data?.unit === 'days' ? 86400000 : 3600000;
        return new Date(Date.now() + duration * unitMs).toISOString();
      }
      return new Date().toISOString();
    };
    // Mirrors src/lib/journeyResponseTargets.ts findUpstreamTemplate — edge
    // functions can't import frontend TS, so the BFS-over-incoming-edges
    // resolution is duplicated here as the server-side source of truth.
    const resolveResponseTarget = (
      nodeId: string, nodeData: any,
      nodes: Array<{ id: string; type: string; data?: any }>,
      edges: Array<{ source: string; target: string }>,
    ): string | null => {
      const saved = nodeData?.target_node_id;
      if (saved && nodes.some((n) => n.id === saved)) return saved;
      const visited = new Set<string>([nodeId]);
      const queue = [nodeId];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const edge of edges.filter((e) => e.target === cur)) {
          if (visited.has(edge.source)) continue;
          visited.add(edge.source);
          const node = nodes.find((n) => n.id === edge.source);
          if (node?.type === 'message') return node.id;
          queue.push(edge.source);
        }
      }
      return null;
    };
    // Twilio error codes that mean the number is permanently undeliverable
    // (bad number / not on WhatsApp / opted out) vs transient rate-limiting.
    const PERMANENT_ERROR_CODES = new Set([21211, 21214, 21408, 21610, 21614, 63015, 63016, 63024, 63032]);
    const RATE_LIMIT_CODES = new Set([20429, 429]);

    const sendWhatsAppTemplate = async (
      templateId: string | undefined, retailerId: string, variables?: Record<string, string>
    ) => {
      let sendStatus: 'sent' | 'failed' = 'failed';
      let providerMessageId: string | null = null;
      let errorMessage: string | null = null;
      let permanent = false;
      let rateLimited = false;
      try {
        const { data: retailer } = await supabase.from('retailers').select('id, phone').eq('id', retailerId).single();
        const { data: template } = templateId
          ? await supabase.from('whatsapp_templates').select('twilio_content_sid').eq('id', templateId).single()
          : { data: null };
        if (!retailer?.phone) {
          errorMessage = 'Retailer has no phone number';
        } else if (!template?.twilio_content_sid) {
          errorMessage = 'Template not approved/submitted';
        } else if (!accountSid || !authToken) {
          errorMessage = 'Twilio credentials not configured';
        } else {
          const toNumber = retailer.phone.startsWith('+') ? retailer.phone : `+91${retailer.phone.replace(/\D/g, '')}`;
          const params: Record<string, string> = {
            To: `whatsapp:${toNumber}`,
            From: `whatsapp:${fromNumber}`,
            ContentSid: template.twilio_content_sid,
            StatusCallback: `${supabaseUrl}/functions/v1/whatsapp-journey-status`,
          };
          if (variables && Object.keys(variables).length > 0) params.ContentVariables = JSON.stringify(variables);
          const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(params),
          });
          const result = await resp.json();
          if (resp.ok) {
            sendStatus = 'sent';
            providerMessageId = result.sid || null;
          } else {
            errorMessage = result?.message || `Twilio error ${resp.status}`;
            const code = Number(result?.code);
            permanent = PERMANENT_ERROR_CODES.has(code);
            rateLimited = RATE_LIMIT_CODES.has(code) || resp.status === 429;
          }
        }
      } catch (e) {
        errorMessage = e instanceof Error ? e.message : String(e);
      }
      return { sendStatus, providerMessageId, errorMessage, permanent, rateLimited };
    };

    const generateShortCode = () => Math.random().toString(36).slice(2, 10);

    const bumpEngagementScore = async (retailerId: string, delta: number) => {
      const { data: existing } = await supabase.from('person_engagement_scores').select('score').eq('retailer_id', retailerId).maybeSingle();
      await supabase.from('person_engagement_scores').upsert({
        retailer_id: retailerId,
        score: (Number(existing?.score) || 0) + delta,
        last_event_at: new Date().toISOString(),
      }, { onConflict: 'retailer_id' });
    };

    // Meta Ad node support: pushes one contact's hashed phone/email into the Custom
    // Audience that journey-actions' publish handler already created and linked to
    // the chosen Ad Set (journey_meta_ad_links). A local, minimal copy of meta-api's
    // sha256Hex/row-validation logic — this always uploads exactly one row, so
    // meta-api's batching helper (built for a bulk CSV upload) isn't reused here.
    const metaSha256Hex = async (value: string): Promise<string> => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    };
    const metaTokenCache = new Map<string, string | null>();
    const getMetaAccessToken = async (connectionId: string): Promise<string | null> => {
      if (metaTokenCache.has(connectionId)) return metaTokenCache.get(connectionId)!;
      const encKey = Deno.env.get('META_TOKEN_ENC_KEY');
      const { data: connection } = await supabase.from('meta_connections').select('access_token_enc').eq('id', connectionId).maybeSingle();
      const token = connection?.access_token_enc && encKey ? await decryptToken(connection.access_token_enc, encKey) : null;
      metaTokenCache.set(connectionId, token);
      return token;
    };
    const pushContactToMetaAudience = async (
      journeyId: string, nodeId: string, phone: string | null | undefined, email: string | null | undefined,
    ): Promise<{ sendStatus: 'sent' | 'failed'; errorMessage: string | null }> => {
      try {
        const { data: link } = await supabase.from('journey_meta_ad_links')
          .select('id, pushed_count, meta_custom_audience_row_id').eq('journey_id', journeyId).eq('node_id', nodeId).maybeSingle();
        if (!link) {
          return { sendStatus: 'failed', errorMessage: 'No Meta Custom Audience linked to this node yet — republish the journey after picking an Ad Set.' };
        }
        const { data: audience } = await supabase.from('meta_custom_audiences')
          .select('external_id, connection_id, status').eq('id', link.meta_custom_audience_row_id).maybeSingle();
        if (!audience?.external_id || audience.status !== 'ready') {
          return { sendStatus: 'failed', errorMessage: 'Meta Custom Audience is not ready' };
        }
        const cleanEmail = String(email ?? '').trim().toLowerCase();
        const validEmail = cleanEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ? cleanEmail : '';
        const cleanPhone = String(phone ?? '').replace(/\D/g, '');
        const validPhone = cleanPhone && /^\d{8,15}$/.test(cleanPhone) ? cleanPhone : '';
        if (!validEmail && !validPhone) {
          return { sendStatus: 'failed', errorMessage: 'Contact has no usable phone or email to push to Meta' };
        }
        const token = audience.connection_id ? await getMetaAccessToken(audience.connection_id) : null;
        if (!token) return { sendStatus: 'failed', errorMessage: 'Meta connection token unavailable' };

        const row: [string, string] = [validEmail ? await metaSha256Hex(validEmail) : '', validPhone ? await metaSha256Hex(validPhone) : ''];
        const resp = await fetch(`https://graph.facebook.com/v19.0/${audience.external_id}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            access_token: token,
            session: JSON.stringify({ session_id: Date.now() * 1000 + Math.floor(Math.random() * 1000), batch_seq: 1, last_batch_flag: true, estimated_num_total: 1 }),
            payload: JSON.stringify({ schema: ['EMAIL', 'PHONE'], data: [row] }),
          }),
        });
        const result = await resp.json();
        if (!resp.ok || result?.error) {
          return { sendStatus: 'failed', errorMessage: result?.error?.message || `Meta API error ${resp.status}` };
        }
        await supabase.from('journey_meta_ad_links').update({ pushed_count: (Number(link.pushed_count) || 0) + 1, updated_at: new Date().toISOString() }).eq('id', link.id);
        return { sendStatus: 'sent', errorMessage: null };
      } catch (e) {
        return { sendStatus: 'failed', errorMessage: e instanceof Error ? e.message : String(e) };
      }
    };

    // Marketing-contact twins of sendWhatsAppTemplate / bumpEngagementScore —
    // identical Twilio-send logic, resolving a marketing_contacts phone
    // instead of a retailers phone, kept as separate functions rather than
    // reusing the retailer ones so the existing retailer path is never
    // touched by this change.
    const sendWhatsAppTemplateToContact = async (
      templateId: string | undefined, contactId: string, variables?: Record<string, string>
    ) => {
      let sendStatus: 'sent' | 'failed' = 'failed';
      let providerMessageId: string | null = null;
      let errorMessage: string | null = null;
      let permanent = false;
      let rateLimited = false;
      try {
        const { data: contact } = await supabase.from('marketing_contacts').select('id, phone').eq('id', contactId).single();
        const { data: template } = templateId
          ? await supabase.from('whatsapp_templates').select('twilio_content_sid').eq('id', templateId).single()
          : { data: null };
        if (!contact?.phone) {
          errorMessage = 'Contact has no phone number';
        } else if (!template?.twilio_content_sid) {
          errorMessage = 'Template not approved/submitted';
        } else if (!accountSid || !authToken) {
          errorMessage = 'Twilio credentials not configured';
        } else {
          const toNumber = contact.phone.startsWith('+') ? contact.phone : `+91${contact.phone.replace(/\D/g, '')}`;
          const params: Record<string, string> = {
            To: `whatsapp:${toNumber}`,
            From: `whatsapp:${fromNumber}`,
            ContentSid: template.twilio_content_sid,
            StatusCallback: `${supabaseUrl}/functions/v1/whatsapp-journey-status`,
          };
          if (variables && Object.keys(variables).length > 0) params.ContentVariables = JSON.stringify(variables);
          const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(params),
          });
          const result = await resp.json();
          if (resp.ok) {
            sendStatus = 'sent';
            providerMessageId = result.sid || null;
          } else {
            errorMessage = result?.message || `Twilio error ${resp.status}`;
            const code = Number(result?.code);
            permanent = PERMANENT_ERROR_CODES.has(code);
            rateLimited = RATE_LIMIT_CODES.has(code) || resp.status === 429;
          }
        }
      } catch (e) {
        errorMessage = e instanceof Error ? e.message : String(e);
      }
      return { sendStatus, providerMessageId, errorMessage, permanent, rateLimited };
    };

    const bumpContactEngagementScore = async (contactId: string, delta: number) => {
      const { data: existing } = await supabase.from('marketing_contact_engagement_scores').select('score').eq('contact_id', contactId).maybeSingle();
      await supabase.from('marketing_contact_engagement_scores').upsert({
        contact_id: contactId,
        score: (Number(existing?.score) || 0) + delta,
        last_event_at: new Date().toISOString(),
      }, { onConflict: 'contact_id' });
    };

    for (const enrollment of due || []) {
      const canvasData = enrollment.journeys?.canvas_data || {};
      const nodes: Array<{ id: string; type: string; data?: any }> = canvasData.nodes;
      const isGraph = Array.isArray(nodes) && nodes.length > 0;

      if (isGraph) {
        const edges: Array<{ source: string; target: string; sourceHandle?: string | null }> = canvasData.edges || [];
        const current = nodes.find((n) => n.id === enrollment.current_node_id);

        if (!current) {
          await supabase.from('journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
          continue;
        }

        if (current.type === 'message') {
          // Idempotent re-entry guard: if this node already sent successfully
          // for this enrollment (e.g. an overlapping manual + cron sweep), skip
          // re-sending and just advance.
          const { data: alreadySent } = await supabase
            .from('journey_message_log').select('id').eq('enrollment_id', enrollment.id).eq('node_id', current.id).eq('status', 'sent').maybeSingle();

          if (alreadySent) {
            const nextId = findNextNodeId(current.id, edges);
            if (nextId) {
              await supabase.from('journey_enrollments').update({
                current_node_id: nextId, next_fire_at: nextFireAtForNode(nextId, nodes), retry_count: 0,
              }).eq('id', enrollment.id);
            } else {
              await supabase.from('journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
            }
            continue;
          }

          let variables: Record<string, string> | undefined;
          let trackedLinkId: string | null = null;
          if (current.data?.cta_url) {
            const { data: templateRow } = current.data?.template_id
              ? await supabase.from('whatsapp_templates').select('twilio_required_variables').eq('id', current.data.template_id).single()
              : { data: null };
            if ((templateRow?.twilio_required_variables || []).length === 1) {
              const shortCode = generateShortCode();
              const { data: linkRow } = await supabase.from('whatsapp_tracked_links').insert({
                journey_id: enrollment.journey_id, retailer_id: enrollment.retailer_id,
                target_url: current.data.cta_url, short_code: shortCode,
              }).select().single();
              trackedLinkId = linkRow?.id ?? null;
              variables = { '1': `${supabaseUrl}/functions/v1/track-link-click/${shortCode}` };
            }
          }

          const { sendStatus, providerMessageId, errorMessage, permanent, rateLimited } =
            await sendWhatsAppTemplate(current.data?.template_id, enrollment.retailer_id, variables);

          const { data: logRow } = await supabase.from('journey_message_log').insert({
            journey_id: enrollment.journey_id,
            enrollment_id: enrollment.id,
            retailer_id: enrollment.retailer_id,
            node_id: current.id,
            channel: 'whatsapp',
            status: sendStatus,
            provider_message_id: providerMessageId,
            error_message: errorMessage,
          }).select().single();

          if (trackedLinkId && logRow) {
            await supabase.from('whatsapp_tracked_links').update({ journey_message_log_id: logRow.id }).eq('id', trackedLinkId);
          }
          await supabase.from('journey_message_events').insert({ journey_message_log_id: logRow?.id ?? null, event_type: sendStatus });
          await bumpEngagementScore(enrollment.retailer_id, sendStatus === 'sent' ? 1 : -2);

          if (sendStatus === 'sent') {
            processed++;
          } else {
            failed++;
            if (permanent) {
              await supabase.from('journey_excluded_contacts').upsert(
                { journey_id: enrollment.journey_id, retailer_id: enrollment.retailer_id, reason: `Permanent delivery failure: ${errorMessage}` },
                { onConflict: 'journey_id,retailer_id' }
              );
              await supabase.from('journey_enrollments').update({ status: 'excluded' }).eq('id', enrollment.id);
              continue;
            }
            if (rateLimited && (enrollment.retry_count || 0) < 5) {
              await supabase.from('journey_enrollments').update({
                retry_count: (enrollment.retry_count || 0) + 1,
                next_fire_at: new Date(Date.now() + 5 * 60000).toISOString(),
              }).eq('id', enrollment.id);
              continue;
            }
          }

          const nextId = findNextNodeId(current.id, edges);
          if (nextId) {
            await supabase.from('journey_enrollments').update({
              current_node_id: nextId, next_fire_at: nextFireAtForNode(nextId, nodes), retry_count: 0,
            }).eq('id', enrollment.id);
          } else {
            await supabase.from('journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
          }
        } else if (current.type === 'meta_ad') {
          // Idempotent re-entry guard, same shape as the message node's above.
          const { data: alreadyPushed } = await supabase
            .from('journey_message_log').select('id').eq('enrollment_id', enrollment.id).eq('node_id', current.id).eq('status', 'sent').maybeSingle();

          if (!alreadyPushed) {
            const { data: retailer } = await supabase.from('retailers').select('phone, email').eq('id', enrollment.retailer_id).maybeSingle();
            const { sendStatus, errorMessage } = await pushContactToMetaAudience(enrollment.journey_id, current.id, retailer?.phone, retailer?.email);
            await supabase.from('journey_message_log').insert({
              journey_id: enrollment.journey_id, enrollment_id: enrollment.id, retailer_id: enrollment.retailer_id,
              node_id: current.id, channel: 'meta_ad', status: sendStatus, error_message: errorMessage,
            });
            if (sendStatus === 'sent') processed++; else failed++;
          }

          // Never stall the journey over a Meta-side misconfiguration — advance
          // either way, same permissiveness a missing WhatsApp template has today.
          const nextId = findNextNodeId(current.id, edges);
          if (nextId) {
            await supabase.from('journey_enrollments').update({
              current_node_id: nextId, next_fire_at: nextFireAtForNode(nextId, nodes), retry_count: 0,
            }).eq('id', enrollment.id);
          } else {
            await supabase.from('journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
          }
        } else if (current.type === 'delay') {
          const nextId = findNextNodeId(current.id, edges);
          if (nextId) {
            await supabase.from('journey_enrollments').update({
              current_node_id: nextId,
              next_fire_at: nextFireAtForNode(nextId, nodes),
            }).eq('id', enrollment.id);
          } else {
            await supabase.from('journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
          }
        } else if (current.type === 'decision') {
          const { data: lastLog } = await supabase
            .from('journey_message_log').select('status').eq('enrollment_id', enrollment.id)
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
          const handle = lastLog?.status === 'sent' ? 'yes' : 'no';
          const nextId = findNextNodeId(current.id, edges, handle);
          if (nextId) {
            await supabase.from('journey_enrollments').update({
              current_node_id: nextId,
              next_fire_at: nextFireAtForNode(nextId, nodes),
            }).eq('id', enrollment.id);
          } else {
            await supabase.from('journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
          }
        } else if (current.type === 'message_response') {
          const targetNodeId = resolveResponseTarget(current.id, current.data, nodes, edges);
          const condition: string = current.data?.condition || 'read';
          const earlyExit = !!current.data?.early_exit && ['read', 'delivered', 'replied'].includes(condition);
          const waitValue = Number(current.data?.wait_value || 0);
          const waitUnit: string = current.data?.wait_unit || 'hours';
          const waitMs = waitUnit === 'minutes' ? waitValue * 60_000 : waitUnit === 'days' ? waitValue * 86_400_000 : waitValue * 3_600_000;

          const { data: targetLog } = targetNodeId
            ? await supabase.from('journey_message_log').select('status, created_at')
                .eq('enrollment_id', enrollment.id).eq('node_id', targetNodeId)
                .order('created_at', { ascending: false }).limit(1).maybeSingle()
            : { data: null };

          const arrivedMs = targetLog?.created_at ? new Date(targetLog.created_at).getTime() : Date.now();
          const dueAtMs = arrivedMs + waitMs;
          const due = Date.now() >= dueAtMs;

          let matched = false;
          if (condition === 'replied' || condition === 'not_replied') {
            const { data: retailer } = await supabase.from('retailers').select('phone').eq('id', enrollment.retailer_id).maybeSingle();
            const suffix = (retailer?.phone || '').replace(/\D/g, '').slice(-10);
            let replied = false;
            if (suffix) {
              const since = targetLog?.created_at || new Date(arrivedMs).toISOString();
              const { data: replies } = await supabase.from('whatsapp_messages')
                .select('id, from_number').eq('direction', 'inbound').gt('created_at', since).limit(200);
              replied = (replies || []).some((r: any) => (r.from_number || '').replace(/\D/g, '').slice(-10) === suffix);
            }
            matched = condition === 'replied' ? replied : !replied;
          } else {
            const status = targetLog?.status;
            switch (condition) {
              case 'delivered': matched = status === 'delivered' || status === 'read'; break;
              case 'not_delivered': matched = !(status === 'delivered' || status === 'read'); break;
              case 'read': matched = status === 'read'; break;
              case 'not_read': matched = status !== 'read'; break;
              case 'failed': case 'undelivered': matched = status === 'failed'; break;
              default: matched = false;
            }
          }

          if (!due && !(earlyExit && matched)) {
            if (!earlyExit && waitMs > 0) {
              await supabase.from('journey_enrollments').update({ next_fire_at: new Date(dueAtMs).toISOString() }).eq('id', enrollment.id);
            }
            continue;
          }

          const handle = matched ? 'yes' : 'no';
          const nextId = findNextNodeId(current.id, edges, handle);
          if (nextId) {
            await supabase.from('journey_enrollments').update({
              current_node_id: nextId,
              next_fire_at: nextFireAtForNode(nextId, nodes),
            }).eq('id', enrollment.id);
          } else {
            await supabase.from('journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
          }
        } else {
          // entry / exit / unrecognized reached as "current" — dead end safety net.
          await supabase.from('journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
        }
        continue;
      }

      // Legacy linear `steps[]` journeys — unchanged path.
      const steps: Array<{ id: string; type: string; template_id?: string; delay_hours?: number }> = canvasData.steps || [];
      const stepIdx = steps.findIndex((s) => s.id === enrollment.current_node_id);
      const step = stepIdx >= 0 ? steps[stepIdx] : null;

      if (!step) {
        await supabase.from('journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
        continue;
      }

      const { sendStatus, providerMessageId, errorMessage } = await sendWhatsAppTemplate(step.template_id, enrollment.retailer_id);

      await supabase.from('journey_message_log').insert({
        journey_id: enrollment.journey_id,
        enrollment_id: enrollment.id,
        retailer_id: enrollment.retailer_id,
        node_id: step.id,
        channel: 'whatsapp',
        status: sendStatus,
        provider_message_id: providerMessageId,
        error_message: errorMessage,
      });

      if (sendStatus === 'sent') processed++; else failed++;

      const nextStep = steps[stepIdx + 1];
      if (nextStep) {
        const delayMs = (nextStep.delay_hours || 0) * 60 * 60 * 1000;
        await supabase.from('journey_enrollments').update({
          current_node_id: nextStep.id,
          next_fire_at: new Date(Date.now() + delayMs).toISOString(),
        }).eq('id', enrollment.id);
      } else {
        await supabase.from('journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
      }
    }

    // Marketing-contact sweep — parallel to the retailer loop above, over
    // marketing_journey_enrollments/marketing_contacts instead of
    // journey_enrollments/retailers. Graph-canvas journeys only (a
    // marketing-segment journey is always created via the canvas builder,
    // never the legacy linear steps[] format).
    for (const enrollment of dueMarketing || []) {
      const canvasData = enrollment.journeys?.canvas_data || {};
      const nodes: Array<{ id: string; type: string; data?: any }> = canvasData.nodes;
      if (!Array.isArray(nodes) || nodes.length === 0) continue;

      const edges: Array<{ source: string; target: string; sourceHandle?: string | null }> = canvasData.edges || [];
      const current = nodes.find((n) => n.id === enrollment.current_node_id);

      if (!current) {
        await supabase.from('marketing_journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
        continue;
      }

      if (current.type === 'message') {
        const { data: alreadySent } = await supabase
          .from('journey_message_log').select('id').eq('enrollment_id', enrollment.id).eq('node_id', current.id).eq('status', 'sent').maybeSingle();

        if (alreadySent) {
          const nextId = findNextNodeId(current.id, edges);
          if (nextId) {
            await supabase.from('marketing_journey_enrollments').update({
              current_node_id: nextId, next_fire_at: nextFireAtForNode(nextId, nodes), retry_count: 0,
            }).eq('id', enrollment.id);
          } else {
            await supabase.from('marketing_journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
          }
          continue;
        }

        let variables: Record<string, string> | undefined;
        let trackedLinkId: string | null = null;
        if (current.data?.cta_url) {
          const { data: templateRow } = current.data?.template_id
            ? await supabase.from('whatsapp_templates').select('twilio_required_variables').eq('id', current.data.template_id).single()
            : { data: null };
          if ((templateRow?.twilio_required_variables || []).length === 1) {
            const shortCode = generateShortCode();
            const { data: linkRow } = await supabase.from('whatsapp_tracked_links').insert({
              journey_id: enrollment.journey_id, contact_id: enrollment.contact_id,
              target_url: current.data.cta_url, short_code: shortCode,
            }).select().single();
            trackedLinkId = linkRow?.id ?? null;
            variables = { '1': `${supabaseUrl}/functions/v1/track-link-click/${shortCode}` };
          }
        }

        const { sendStatus, providerMessageId, errorMessage, permanent, rateLimited } =
          await sendWhatsAppTemplateToContact(current.data?.template_id, enrollment.contact_id, variables);

        const { data: logRow } = await supabase.from('journey_message_log').insert({
          journey_id: enrollment.journey_id,
          enrollment_id: enrollment.id,
          contact_id: enrollment.contact_id,
          node_id: current.id,
          channel: 'whatsapp',
          status: sendStatus,
          provider_message_id: providerMessageId,
          error_message: errorMessage,
        }).select().single();

        if (trackedLinkId && logRow) {
          await supabase.from('whatsapp_tracked_links').update({ journey_message_log_id: logRow.id }).eq('id', trackedLinkId);
        }
        await supabase.from('journey_message_events').insert({ journey_message_log_id: logRow?.id ?? null, event_type: sendStatus });
        await bumpContactEngagementScore(enrollment.contact_id, sendStatus === 'sent' ? 1 : -2);

        if (sendStatus === 'sent') {
          processed++;
        } else {
          failed++;
          if (permanent) {
            await supabase.from('marketing_journey_excluded_contacts').upsert(
              { journey_id: enrollment.journey_id, contact_id: enrollment.contact_id, reason: `Permanent delivery failure: ${errorMessage}` },
              { onConflict: 'journey_id,contact_id' }
            );
            await supabase.from('marketing_journey_enrollments').update({ status: 'excluded' }).eq('id', enrollment.id);
            continue;
          }
          if (rateLimited && (enrollment.retry_count || 0) < 5) {
            await supabase.from('marketing_journey_enrollments').update({
              retry_count: (enrollment.retry_count || 0) + 1,
              next_fire_at: new Date(Date.now() + 5 * 60000).toISOString(),
            }).eq('id', enrollment.id);
            continue;
          }
        }

        const nextId = findNextNodeId(current.id, edges);
        if (nextId) {
          await supabase.from('marketing_journey_enrollments').update({
            current_node_id: nextId, next_fire_at: nextFireAtForNode(nextId, nodes), retry_count: 0,
          }).eq('id', enrollment.id);
        } else {
          await supabase.from('marketing_journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
        }
      } else if (current.type === 'meta_ad') {
        // Idempotent re-entry guard, same shape as the message node's above.
        const { data: alreadyPushed } = await supabase
          .from('journey_message_log').select('id').eq('enrollment_id', enrollment.id).eq('node_id', current.id).eq('status', 'sent').maybeSingle();

        if (!alreadyPushed) {
          const { data: contact } = await supabase.from('marketing_contacts').select('phone, email').eq('id', enrollment.contact_id).maybeSingle();
          const { sendStatus, errorMessage } = await pushContactToMetaAudience(enrollment.journey_id, current.id, contact?.phone, contact?.email);
          await supabase.from('journey_message_log').insert({
            journey_id: enrollment.journey_id, enrollment_id: enrollment.id, contact_id: enrollment.contact_id,
            node_id: current.id, channel: 'meta_ad', status: sendStatus, error_message: errorMessage,
          });
          if (sendStatus === 'sent') processed++; else failed++;
        }

        // Never stall the journey over a Meta-side misconfiguration — advance
        // either way, same permissiveness a missing WhatsApp template has today.
        const nextId = findNextNodeId(current.id, edges);
        if (nextId) {
          await supabase.from('marketing_journey_enrollments').update({
            current_node_id: nextId, next_fire_at: nextFireAtForNode(nextId, nodes), retry_count: 0,
          }).eq('id', enrollment.id);
        } else {
          await supabase.from('marketing_journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
        }
      } else if (current.type === 'delay') {
        const nextId = findNextNodeId(current.id, edges);
        if (nextId) {
          await supabase.from('marketing_journey_enrollments').update({
            current_node_id: nextId,
            next_fire_at: nextFireAtForNode(nextId, nodes),
          }).eq('id', enrollment.id);
        } else {
          await supabase.from('marketing_journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
        }
      } else if (current.type === 'decision') {
        const { data: lastLog } = await supabase
          .from('journey_message_log').select('status').eq('enrollment_id', enrollment.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        const handle = lastLog?.status === 'sent' ? 'yes' : 'no';
        const nextId = findNextNodeId(current.id, edges, handle);
        if (nextId) {
          await supabase.from('marketing_journey_enrollments').update({
            current_node_id: nextId,
            next_fire_at: nextFireAtForNode(nextId, nodes),
          }).eq('id', enrollment.id);
        } else {
          await supabase.from('marketing_journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
        }
      } else if (current.type === 'message_response') {
        const targetNodeId = resolveResponseTarget(current.id, current.data, nodes, edges);
        const condition: string = current.data?.condition || 'read';
        const earlyExit = !!current.data?.early_exit && ['read', 'delivered', 'replied'].includes(condition);
        const waitValue = Number(current.data?.wait_value || 0);
        const waitUnit: string = current.data?.wait_unit || 'hours';
        const waitMs = waitUnit === 'minutes' ? waitValue * 60_000 : waitUnit === 'days' ? waitValue * 86_400_000 : waitValue * 3_600_000;

        const { data: targetLog } = targetNodeId
          ? await supabase.from('journey_message_log').select('status, created_at')
              .eq('enrollment_id', enrollment.id).eq('node_id', targetNodeId)
              .order('created_at', { ascending: false }).limit(1).maybeSingle()
          : { data: null };

        const arrivedMs = targetLog?.created_at ? new Date(targetLog.created_at).getTime() : Date.now();
        const dueAtMs = arrivedMs + waitMs;
        const dueNow = Date.now() >= dueAtMs;

        let matched = false;
        if (condition === 'replied' || condition === 'not_replied') {
          const { data: contact } = await supabase.from('marketing_contacts').select('phone').eq('id', enrollment.contact_id).maybeSingle();
          const suffix = (contact?.phone || '').replace(/\D/g, '').slice(-10);
          let replied = false;
          if (suffix) {
            const since = targetLog?.created_at || new Date(arrivedMs).toISOString();
            const { data: replies } = await supabase.from('whatsapp_messages')
              .select('id, from_number').eq('direction', 'inbound').gt('created_at', since).limit(200);
            replied = (replies || []).some((r: any) => (r.from_number || '').replace(/\D/g, '').slice(-10) === suffix);
          }
          matched = condition === 'replied' ? replied : !replied;
        } else {
          const status = targetLog?.status;
          switch (condition) {
            case 'delivered': matched = status === 'delivered' || status === 'read'; break;
            case 'not_delivered': matched = !(status === 'delivered' || status === 'read'); break;
            case 'read': matched = status === 'read'; break;
            case 'not_read': matched = status !== 'read'; break;
            case 'failed': case 'undelivered': matched = status === 'failed'; break;
            default: matched = false;
          }
        }

        if (!dueNow && !(earlyExit && matched)) {
          if (!earlyExit && waitMs > 0) {
            await supabase.from('marketing_journey_enrollments').update({ next_fire_at: new Date(dueAtMs).toISOString() }).eq('id', enrollment.id);
          }
          continue;
        }

        const handle = matched ? 'yes' : 'no';
        const nextId = findNextNodeId(current.id, edges, handle);
        if (nextId) {
          await supabase.from('marketing_journey_enrollments').update({
            current_node_id: nextId,
            next_fire_at: nextFireAtForNode(nextId, nodes),
          }).eq('id', enrollment.id);
        } else {
          await supabase.from('marketing_journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
        }
      } else {
        await supabase.from('marketing_journey_enrollments').update({ status: 'completed' }).eq('id', enrollment.id);
      }
    }

    return new Response(JSON.stringify({ swept: (due || []).length + (dueMarketing || []).length, sent: processed, failed, schedules_fired: schedulesFired, campaigns_started: campaignsStarted, campaigns_completed: campaignsCompleted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
