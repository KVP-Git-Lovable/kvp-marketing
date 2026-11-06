import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHash, timingSafeEqual } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-token',
  'Access-Control-Expose-Headers': 'x-retry-build',
  'X-Retry-Build': 'failed-resend-2026-11-06',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const sha256 = (v: string) => createHash('sha256').update(v, 'utf8').digest();
const MAX_PER_CALL = 200;
const DELAY_MS = 300; // gentle pacing so a big batch does not trip Twilio rate limits
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Signed-in user (UI buttons) or the scheduler's x-cron-token (public.journey_cron_token).
// deno-lint-ignore no-explicit-any
async function authorize(req: Request, supabase: any): Promise<{ ok: boolean; userId?: string; cron?: boolean }> {
  const cronToken = req.headers.get('x-cron-token');
  if (cronToken) {
    const { data } = await supabase.from('journey_cron_token').select('token').limit(1).maybeSingle();
    return { ok: !!data?.token && timingSafeEqual(sha256(cronToken), sha256(String(data.token))), cron: true };
  }
  const bearer = /^Bearer\s+(\S+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!bearer) return { ok: false };
  const { data, error } = await supabase.auth.getUser(bearer);
  return error || !data?.user ? { ok: false } : { ok: true, userId: data.user.id };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method === 'GET') return json({ ok: true });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const auth = await authorize(req, supabase);
    if (!auth.ok) return json({ error: 'Unauthorized' }, 401);

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    // Re-sends one failed log row. Never changes the original row; writes a new log row so
    // analytics keep both attempts and the failed list can treat the contact as resolved.
    const resendOne = async (logId: string): Promise<{ log_id: string; result: 'sent' | 'failed' | 'skipped'; message?: string }> => {
      const { data: log } = await supabase.from('journey_message_log')
        .select('id, journey_id, enrollment_id, contact_id, retailer_id, node_id, channel, status, created_at').eq('id', logId).maybeSingle();
      if (!log) return { log_id: logId, result: 'skipped', message: 'Message not found' };
      if (!['failed', 'rate_limited'].includes(log.status) || (log.channel && log.channel !== 'whatsapp')) {
        return { log_id: logId, result: 'skipped', message: 'Not a failed WhatsApp message' };
      }
      // Already resolved by a later attempt for the same person and node?
      const personCol = log.contact_id ? 'contact_id' : 'retailer_id';
      const personId = log.contact_id || log.retailer_id;
      if (!personId || !log.node_id) return { log_id: logId, result: 'skipped', message: 'Missing recipient or step' };
      const { data: later } = await supabase.from('journey_message_log').select('id')
        .eq('journey_id', log.journey_id).eq('node_id', log.node_id).eq(personCol, personId)
        .in('status', ['sent', 'delivered', 'read']).gt('created_at', log.created_at).limit(1);
      if (later && later.length > 0) return { log_id: logId, result: 'skipped', message: 'Already sent by a later attempt' };

      const { data: journey } = await supabase.from('journeys').select('canvas_data').eq('id', log.journey_id).maybeSingle();
      const node = ((journey?.canvas_data as { nodes?: Array<{ id: string; data?: { template_id?: string; cta_url?: string } }> })?.nodes || [])
        .find((n) => n.id === log.node_id);
      const templateId = node?.data?.template_id;

      if (log.contact_id) {
        const { data: ex } = await supabase.from('marketing_journey_excluded_contacts').select('contact_id')
          .eq('journey_id', log.journey_id).eq('contact_id', log.contact_id).maybeSingle();
        if (ex) return { log_id: logId, result: 'skipped', message: 'Contact is excluded from this journey' };
      }

      let phone: string | null = null;
      if (log.contact_id) {
        phone = (await supabase.from('marketing_contacts').select('phone').eq('id', log.contact_id).maybeSingle()).data?.phone ?? null;
      } else {
        phone = (await supabase.from('retailers').select('phone').eq('id', log.retailer_id).maybeSingle()).data?.phone ?? null;
      }
      const { data: template } = templateId
        ? await supabase.from('whatsapp_templates').select('twilio_content_sid, twilio_required_variables').eq('id', templateId).maybeSingle()
        : { data: null };

      let sendStatus: 'sent' | 'failed' = 'failed';
      let providerMessageId: string | null = null;
      let errorMessage: string | null = null;
      let errorCode: string | null = null;
      let trackedLinkId: string | null = null;

      if (!phone) errorMessage = 'Contact has no phone number';
      else if (!template?.twilio_content_sid) errorMessage = 'Template not approved/submitted';
      else if (!accountSid || !authToken || !fromNumber) errorMessage = 'Twilio credentials not configured';
      else {
        const to = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
        const params: Record<string, string> = {
          To: `whatsapp:${to}`, From: `whatsapp:${fromNumber}`, ContentSid: template.twilio_content_sid,
          StatusCallback: `${supabaseUrl}/functions/v1/whatsapp-journey-status`,
        };
        if (node?.data?.cta_url && (template.twilio_required_variables || []).length === 1) {
          const shortCode = Math.random().toString(36).slice(2, 10);
          const { data: link } = await supabase.from('whatsapp_tracked_links').insert({
            journey_id: log.journey_id, [personCol]: personId, target_url: node.data.cta_url, short_code: shortCode,
          }).select().single();
          trackedLinkId = link?.id ?? null;
          params.ContentVariables = JSON.stringify({ '1': `${supabaseUrl}/functions/v1/track-link-click/${shortCode}` });
        }
        const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: { Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(params),
        });
        const result = await resp.json();
        if (resp.ok) { sendStatus = 'sent'; providerMessageId = result.sid || null; }
        else { errorMessage = result?.message || `Twilio error ${resp.status}`; errorCode = result?.code ? String(result.code) : null; }
      }

      const { data: newLog } = await supabase.from('journey_message_log').insert({
        journey_id: log.journey_id, enrollment_id: log.enrollment_id, [personCol]: personId, node_id: log.node_id,
        channel: 'whatsapp', status: sendStatus, provider_message_id: providerMessageId, error_code: errorCode, error_message: errorMessage,
      }).select().single();
      if (trackedLinkId && newLog) await supabase.from('whatsapp_tracked_links').update({ journey_message_log_id: newLog.id }).eq('id', trackedLinkId);
      await supabase.from('journey_message_events').insert({ journey_message_log_id: newLog?.id ?? null, event_type: sendStatus });
      return { log_id: logId, result: sendStatus, message: errorMessage ?? undefined };
    };

    const runBatch = async (ids: string[]) => {
      const results = [];
      for (const id of ids.slice(0, MAX_PER_CALL)) {
        results.push(await resendOne(id));
        await sleep(DELAY_MS);
      }
      return results;
    };

    if (action === 'resend') {
      if (auth.cron) return json({ error: 'Not allowed' }, 403);
      const ids: string[] = Array.isArray(body.log_ids) ? body.log_ids.map(String) : [];
      if (ids.length === 0) return json({ error: 'log_ids required' }, 400);
      const results = await runBatch(ids);
      return json({ results, sent: results.filter((r) => r.result === 'sent').length, failed: results.filter((r) => r.result === 'failed').length, skipped: results.filter((r) => r.result === 'skipped').length, truncated: ids.length > MAX_PER_CALL });
    }

    if (action === 'schedule') {
      if (auth.cron) return json({ error: 'Not allowed' }, 403);
      const ids: string[] = Array.isArray(body.log_ids) ? body.log_ids.map(String) : [];
      const when = new Date(String(body.scheduled_for || ''));
      if (ids.length === 0 || isNaN(when.getTime())) return json({ error: 'log_ids and a valid scheduled_for are required' }, 400);
      if (when.getTime() < Date.now() - 60_000) return json({ error: 'Scheduled time is in the past' }, 400);
      const { data: logs } = await supabase.from('journey_message_log').select('id, journey_id').in('id', ids);
      const rows = (logs || []).map((l: { id: string; journey_id: string }) => ({
        log_id: l.id, journey_id: l.journey_id, scheduled_for: when.toISOString(), status: 'pending', created_by: auth.userId ?? null,
      }));
      const { error } = await supabase.from('journey_retry_schedule').insert(rows);
      if (error) return json({ error: error.message }, 500);
      return json({ scheduled: rows.length, scheduled_for: when.toISOString() });
    }

    if (action === 'cancel_schedule') {
      if (auth.cron) return json({ error: 'Not allowed' }, 403);
      const ids: string[] = Array.isArray(body.schedule_ids) ? body.schedule_ids.map(String) : [];
      await supabase.from('journey_retry_schedule').update({ status: 'cancelled' }).in('id', ids).eq('status', 'pending');
      return json({ cancelled: ids.length });
    }

    if (action === 'process_due') {
      const { data: due } = await supabase.from('journey_retry_schedule').select('id, log_id')
        .eq('status', 'pending').lte('scheduled_for', new Date().toISOString()).order('scheduled_for').limit(MAX_PER_CALL);
      let sent = 0, failed = 0, skipped = 0;
      for (const row of due || []) {
        // Claim first so overlapping runs never double-send.
        const { data: claimed } = await supabase.from('journey_retry_schedule').update({ status: 'running' }).eq('id', row.id).eq('status', 'pending').select('id');
        if (!claimed || claimed.length === 0) continue;
        const r = await resendOne(row.log_id);
        await supabase.from('journey_retry_schedule').update({ status: r.result === 'skipped' ? 'skipped' : r.result === 'sent' ? 'done' : 'failed', result_message: r.message ?? null, processed_at: new Date().toISOString() }).eq('id', row.id);
        if (r.result === 'sent') sent++; else if (r.result === 'failed') failed++; else skipped++;
        await sleep(DELAY_MS);
      }
      return json({ processed: (due || []).length, sent, failed, skipped });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error('journey-retry failed:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
