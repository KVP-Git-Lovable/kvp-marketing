import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONTENT_API_BASE = 'https://content.twilio.com';

// Collapse stray double slashes in the path portion of a URL.
// Twilio's Content API rejects send-time media URLs that contain `//`
// (error 21620: "Media urls ... are invalid"), even though Supabase
// Storage tolerates them. We strip them defensively everywhere we
// accept a media or CTA URL.
function sanitizeUrl(input: string | null | undefined): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    const u = new URL(trimmed);
    u.pathname = u.pathname.replace(/\/{2,}/g, '/');
    return u.toString();
  } catch {
    return trimmed;
  }
}

// Inspect a Twilio Content `types` map and derive normalized template metadata
// (template type, media URL, whether the media URL is variable-driven, and the
// full set of required {{N}} or {{name}} variables across body + media).
function deriveTwilioMetadata(types: Record<string, any> | null | undefined) {
  const t = types && typeof types === 'object' ? types : {};
  const knownTypes = Object.keys(t);
  const templateType = knownTypes.find((k) => k === 'twilio/media')
    || knownTypes.find((k) => k === 'twilio/text')
    || knownTypes[0]
    || null;

  let mediaUrl: string | null = null;
  let mediaIsVariable = false;
  const media = t['twilio/media'];
  if (media && typeof media === 'object') {
    const candidate = Array.isArray(media.media) ? media.media[0] : media.media;
    if (typeof candidate === 'string' && candidate.length > 0) {
      mediaUrl = candidate;
      mediaIsVariable = /\{\{[^}]+\}\}/.test(candidate);
    }
  }

  const required = new Set<string>();
  const collect = (s: unknown) => {
    if (typeof s !== 'string') return;
    const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) required.add(m[1]);
  };
  for (const v of Object.values(t)) {
    if (!v || typeof v !== 'object') continue;
    const obj = v as Record<string, unknown>;
    collect(obj.body);
    collect((obj as any).media);
    if (Array.isArray((obj as any).media)) (obj as any).media.forEach(collect);
    collect((obj as any).header);
    collect((obj as any).footer);
    if (Array.isArray((obj as any).actions)) {
      for (const a of (obj as any).actions) {
        if (a && typeof a === 'object') {
          collect(a.title); collect(a.url); collect(a.phone);
        }
      }
    }
  }

  return {
    templateType,
    mediaUrl,
    mediaIsVariable,
    requiredVariables: Array.from(required),
  };
}

// staging-quickapp's own existing WhatsApp secrets (used by
// send-order-confirmation-whatsapp etc.) — reused here, no new credential.
function getTwilioAuth() {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!accountSid || !authToken) return null;
  return {
    accountSid,
    authHeader: 'Basic ' + btoa(`${accountSid}:${authToken}`),
  };
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

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const templateId = url.searchParams.get('id');
      const status = url.searchParams.get('status');
      const category = url.searchParams.get('category');

      if (templateId) {
        const { data, error } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let query = supabase.from('whatsapp_templates').select('*').order('updated_at', { ascending: false });
      if (status) query = query.eq('status', status);
      if (category) query = query.eq('category', category);

      const { data, error } = await query;
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'DELETE') {
      const body = await req.json();
      const { template_id } = body;

      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', template_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const action = body.action || 'create';

      if (action === 'import-from-twilio') {
        const twilio = getTwilioAuth();
        if (!twilio) {
          return new Response(JSON.stringify({ error: 'Twilio credentials not configured' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const resp = await fetch(`${CONTENT_API_BASE}/v1/Content`, {
          headers: { 'Authorization': twilio.authHeader },
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error('Twilio Content API list error:', errText);
          return new Response(JSON.stringify({ error: resp.status === 401 ? 'Twilio sign-in failed: the saved Twilio Account SID or Auth Token is wrong. Update them in the project secrets.' : `Twilio API error: ${resp.status}` }), {
            status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const twilioData = await resp.json();
        const contents = twilioData.contents || [];

        let imported = 0;
        let skipped = 0;

        for (const content of contents) {
          const { data: existing } = await supabase
            .from('whatsapp_templates')
            .select('id')
            .eq('twilio_content_sid', content.sid)
            .maybeSingle();

          if (existing) {
            skipped++;
            continue;
          }

          let templateBody = '';
          if (content.types?.['twilio/text']?.body) {
            templateBody = content.types['twilio/text'].body;
          } else if (content.types?.['twilio/media']?.body) {
            templateBody = content.types['twilio/media'].body;
          } else if (content.types?.['twilio/quick-reply']?.body) {
            templateBody = content.types['twilio/quick-reply'].body;
          } else {
            templateBody = JSON.stringify(content.types || {});
          }

          let status = 'pending';
          let rejectionReason = null;
          let userInitiatedApproved = false;

          try {
            const approvalResp = await fetch(
              `${CONTENT_API_BASE}/v1/Content/${content.sid}/ApprovalRequests`,
              { headers: { 'Authorization': twilio.authHeader } }
            );
            if (approvalResp.ok) {
              const approvalData = await approvalResp.json();
              const waStatus = approvalData?.whatsapp?.status;
              if (waStatus === 'approved') {
                status = 'approved';
                userInitiatedApproved = true;
              } else if (waStatus === 'rejected') {
                status = 'rejected';
                rejectionReason = approvalData?.whatsapp?.rejection_reason || 'Unknown';
                userInitiatedApproved = false;
              } else if (waStatus) {
                status = waStatus;
              }
            }
          } catch (e) {
            console.error('Error fetching approval for', content.sid, e);
          }

          const categoryMap: Record<string, string> = {
            'twilio/text': 'UTILITY',
            'twilio/media': 'MARKETING',
            'twilio/quick-reply': 'UTILITY',
          };
          const firstType = Object.keys(content.types || {})[0] || '';
          const category = categoryMap[firstType] || 'UTILITY';
          const meta = deriveTwilioMetadata(content.types);

          await supabase.from('whatsapp_templates').insert({
            name: content.friendly_name || content.sid,
            category,
            language: content.language || 'en',
            body: templateBody,
            twilio_content_sid: content.sid,
            status,
            rejection_reason: rejectionReason,
            user_initiated_approved: userInitiatedApproved,
            created_by: user.id,
            twilio_content_types: content.types || null,
            twilio_template_type: meta.templateType,
            twilio_media_url: meta.mediaUrl,
            twilio_media_is_variable: meta.mediaIsVariable,
            twilio_required_variables: meta.requiredVariables,
            twilio_synced_at: new Date().toISOString(),
          });

          imported++;
        }

        return new Response(JSON.stringify({ imported, skipped, total: contents.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'bulk-sync') {
        const twilio = getTwilioAuth();
        if (!twilio) {
          return new Response(JSON.stringify({ error: 'Twilio credentials not configured' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: templates } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .in('status', ['submitted', 'pending', 'approved'])
          .not('twilio_content_sid', 'is', null);

        const results = [];
        for (const tmpl of templates || []) {
          try {
            const [approvalResp, contentResp] = await Promise.all([
              fetch(
                `${CONTENT_API_BASE}/v1/Content/${tmpl.twilio_content_sid}/ApprovalRequests`,
                { headers: { 'Authorization': twilio.authHeader } },
              ),
              fetch(
                `${CONTENT_API_BASE}/v1/Content/${tmpl.twilio_content_sid}`,
                { headers: { 'Authorization': twilio.authHeader } },
              ),
            ]);
            const data = await approvalResp.json();
            const whatsappStatus = data?.whatsapp?.status;
            const userInitiatedApproved = whatsappStatus === 'approved';

            const updates: Record<string, unknown> = {
              user_initiated_approved: userInitiatedApproved,
            };
            if (whatsappStatus) {
              updates.status = whatsappStatus;
              updates.rejection_reason = whatsappStatus === 'rejected'
                ? (data?.whatsapp?.rejection_reason || 'Unknown')
                : null;
            }

            if (contentResp.ok) {
              const contentJson = await contentResp.json();
              const meta = deriveTwilioMetadata(contentJson?.types);
              updates.twilio_content_types = contentJson?.types ?? null;
              updates.twilio_template_type = meta.templateType;
              updates.twilio_media_url = meta.mediaUrl;
              updates.twilio_media_is_variable = meta.mediaIsVariable;
              updates.twilio_required_variables = meta.requiredVariables;
              updates.twilio_synced_at = new Date().toISOString();
            }

            await supabase
              .from('whatsapp_templates')
              .update(updates)
              .eq('id', tmpl.id);

            results.push({ id: tmpl.id, status: whatsappStatus || tmpl.status, user_initiated_approved: userInitiatedApproved });
          } catch (e) {
            results.push({ id: tmpl.id, error: String(e) });
          }
        }

        return new Response(JSON.stringify({ synced: results.length, results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'refresh-status') {
        const { template_id } = body;

        if (!template_id) {
          return new Response(JSON.stringify({ error: 'template_id is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const twilio = getTwilioAuth();
        if (!twilio) {
          return new Response(JSON.stringify({ error: 'Twilio credentials not configured' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: template } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .eq('id', template_id)
          .single();

        if (!template || !template.twilio_content_sid) {
          return new Response(JSON.stringify({ error: 'Template not found or not submitted to Twilio' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const [twilioResponse, contentResp] = await Promise.all([
          fetch(
            `${CONTENT_API_BASE}/v1/Content/${template.twilio_content_sid}/ApprovalRequests`,
            { headers: { 'Authorization': twilio.authHeader } },
          ),
          fetch(
            `${CONTENT_API_BASE}/v1/Content/${template.twilio_content_sid}`,
            { headers: { 'Authorization': twilio.authHeader } },
          ),
        ]);

        const approvalData = await twilioResponse.json();
        let newStatus = template.status;
        let rejectionReason = template.rejection_reason;
        let userInitiatedApproved = false;

        if (twilioResponse.ok) {
          const whatsappStatus = approvalData?.whatsapp?.status;
          if (whatsappStatus === 'approved') {
            newStatus = 'approved';
            userInitiatedApproved = true;
          } else if (whatsappStatus === 'rejected') {
            newStatus = 'rejected';
            rejectionReason = approvalData?.whatsapp?.rejection_reason || 'Unknown reason';
            userInitiatedApproved = false;
          } else if (whatsappStatus) {
            newStatus = whatsappStatus;
          }
        }

        const updates: Record<string, unknown> = {
          status: newStatus,
          rejection_reason: rejectionReason,
          user_initiated_approved: userInitiatedApproved,
        };

        if (contentResp.ok) {
          const contentJson = await contentResp.json();
          const meta = deriveTwilioMetadata(contentJson?.types);
          updates.twilio_content_types = contentJson?.types ?? null;
          updates.twilio_template_type = meta.templateType;
          updates.twilio_media_url = meta.mediaUrl;
          updates.twilio_media_is_variable = meta.mediaIsVariable;
          updates.twilio_required_variables = meta.requiredVariables;
          updates.twilio_synced_at = new Date().toISOString();
        }

        const { data: updated, error: updateError } = await supabase
          .from('whatsapp_templates')
          .update(updates)
          .eq('id', template_id)
          .select()
          .single();

        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify(updated), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'verify-media-url') {
        const { url: urlToCheck, template_id } = body;
        let target = typeof urlToCheck === 'string' ? urlToCheck.trim() : '';
        if (!target && template_id) {
          const { data: t } = await supabase.from('whatsapp_templates').select('twilio_media_url').eq('id', template_id).maybeSingle();
          target = t?.twilio_media_url || '';
        }
        if (!target) {
          return new Response(JSON.stringify({ error: 'No media URL to check' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        try {
          let resp = await fetch(target, { method: 'HEAD' });
          if (!resp.ok || resp.status === 405) {
            resp = await fetch(target, { method: 'GET', headers: { Range: 'bytes=0-0' } });
          }
          return new Response(JSON.stringify({
            url: target, ok: resp.ok || resp.status === 206,
            status: resp.status,
            content_type: resp.headers.get('content-type'),
            content_length: resp.headers.get('content-length'),
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ url: target, ok: false, error: e instanceof Error ? e.message : String(e) }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      if (action === 'repair-media-url' || action === 'refresh-media-cache') {
        const { template_id } = body;
        if (!template_id) {
          return new Response(JSON.stringify({ error: 'template_id is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const twilio = getTwilioAuth();
        if (!twilio) {
          return new Response(JSON.stringify({ error: 'Twilio credentials not configured' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data: tmpl } = await supabase.from('whatsapp_templates').select('*').eq('id', template_id).single();
        if (!tmpl) {
          return new Response(JSON.stringify({ error: 'Template not found' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const rawTypes = (tmpl.twilio_content_types || {}) as Record<string, any>;
        const cleanedTypes: Record<string, any> = JSON.parse(JSON.stringify(rawTypes));
        if (action === 'repair-media-url') {
          for (const v of Object.values(cleanedTypes)) {
            if (!v || typeof v !== 'object') continue;
            const obj = v as Record<string, unknown>;
            if (typeof obj.media === 'string') obj.media = sanitizeUrl(obj.media);
            if (Array.isArray(obj.media)) obj.media = obj.media.map((m: unknown) => typeof m === 'string' ? sanitizeUrl(m) : m);
          }
        } else {
          // refresh-media-cache: bust Twilio/Meta's cached bytes by appending a cache-busting query param
          for (const v of Object.values(cleanedTypes)) {
            if (!v || typeof v !== 'object') continue;
            const obj = v as Record<string, unknown>;
            const bust = (u: string) => { try { const x = new URL(u); x.searchParams.set('_cb', String(Date.now())); return x.toString(); } catch { return u; } };
            if (typeof obj.media === 'string') obj.media = bust(obj.media);
            if (Array.isArray(obj.media)) obj.media = obj.media.map((m: unknown) => typeof m === 'string' ? bust(m) : m);
          }
        }

        const createResp = await fetch(`${CONTENT_API_BASE}/v1/Content`, {
          method: 'POST',
          headers: { 'Authorization': twilio.authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ friendly_name: `${tmpl.name}_${Date.now()}`, language: tmpl.language || 'en', types: cleanedTypes }),
        });
        const createData = await createResp.json();
        if (!createResp.ok || !createData.sid) {
          return new Response(JSON.stringify({ error: createData?.message || 'Failed to create replacement Content' }), {
            status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          await fetch(`${CONTENT_API_BASE}/v1/Content/${createData.sid}/ApprovalRequests/whatsapp`, {
            method: 'POST',
            headers: { 'Authorization': twilio.authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: tmpl.name, category: (tmpl.category || 'UTILITY').toLowerCase() }),
          });
        } catch (e) {
          console.error('Resubmission for approval failed:', e);
        }

        const meta = deriveTwilioMetadata(cleanedTypes);
        const { data: updated, error: updErr } = await supabase.from('whatsapp_templates').update({
          twilio_content_sid: createData.sid,
          twilio_content_types: cleanedTypes,
          twilio_template_type: meta.templateType,
          twilio_media_url: meta.mediaUrl,
          twilio_media_is_variable: meta.mediaIsVariable,
          twilio_required_variables: meta.requiredVariables,
          twilio_synced_at: new Date().toISOString(),
          status: 'submitted',
        }).eq('id', template_id).select().single();
        if (updErr) {
          return new Response(JSON.stringify({ error: updErr.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(updated), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'send-test') {
        const { template_id, to, variables } = body;
        if (!template_id || !to) {
          return new Response(JSON.stringify({ error: 'template_id and to are required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data: tmpl } = await supabase.from('whatsapp_templates').select('twilio_content_sid, status, name, body').eq('id', template_id).single();
        if (!tmpl?.twilio_content_sid) {
          return new Response(JSON.stringify({ error: 'Template has not been submitted to Twilio yet' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (tmpl.status !== 'approved') {
          return new Response(JSON.stringify({ error: 'Template is not approved yet — test sends can only use an approved template' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const twilio = getTwilioAuth();
        if (!twilio) {
          return new Response(JSON.stringify({ error: 'Twilio credentials not configured' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const fromNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || '+917411681616';
        const toNumber = String(to).startsWith('+') ? String(to) : `+91${String(to).replace(/\D/g, '')}`;
        const params = new URLSearchParams({
          To: `whatsapp:${toNumber}`,
          From: `whatsapp:${fromNumber}`,
          ContentSid: tmpl.twilio_content_sid,
        });
        if (variables && typeof variables === 'object' && Object.keys(variables).length > 0) {
          params.set('ContentVariables', JSON.stringify(variables));
        }
        const sendResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`, {
          method: 'POST',
          headers: { 'Authorization': twilio.authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params,
        });
        const sendData = await sendResp.json();
        const logStatus = sendResp.ok ? 'sent' : 'failed';

        // Log the test send the same way journeys/production sends do, so it
        // shows up in Conversations/cost tracking instead of being invisible.
        const { data: matchedRetailer } = await supabase.from('retailers').select('id').eq('phone', toNumber).maybeSingle();
        await supabase.from('whatsapp_message_log').insert({
          retailer_id: matchedRetailer?.id || null,
          to_number: toNumber,
          template_id,
          body: `[Test] ${tmpl.name}`,
          status: logStatus,
          twilio_sid: sendData?.sid || null,
          error_code: sendResp.ok ? null : String(sendData?.code || sendResp.status),
          error_message: sendResp.ok ? null : (sendData?.message || 'Twilio send failed'),
          sent_by: user.id,
        });
        await supabase.from('whatsapp_messages').insert({
          retailer_id: matchedRetailer?.id || null,
          direction: 'outbound',
          from_number: fromNumber,
          to_number: toNumber,
          body: `[Test] ${tmpl.name}`,
          status: logStatus,
          twilio_sid: sendData?.sid || null,
        });

        if (!sendResp.ok) {
          const code = Number(sendData?.code);
          const friendly = (code === 21212 || code === 63007 || code === 21606)
            ? `The sending number ${fromNumber} is not set up as a WhatsApp sender on your Twilio account. Register it in Twilio (Messaging → Senders → WhatsApp senders) or update the TWILIO_WHATSAPP_NUMBER secret to an approved WhatsApp sender.`
            : (sendData?.message || `Twilio error ${sendResp.status}`);
          return new Response(JSON.stringify({ error: friendly, code: sendData?.code }), {
            status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true, sid: sendData.sid }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // --- Create template (default action) ---
      // Supports three Twilio Content types:
      //   - twilio/text             (default, body only)
      //   - twilio/media            (header media URL + body)
      //   - twilio/call-to-action   (body + up to 2 URL/PHONE buttons)
      const {
        name,
        category,
        language,
        body: templateBody,
        content_type: contentTypeRaw,
        media_url: mediaUrl,
        cta_actions: ctaActionsRaw,
        variable_samples: variableSamplesRaw,
      } = body;

      const contentType: 'text' | 'media' | 'call_to_action' =
        contentTypeRaw === 'media' || contentTypeRaw === 'call_to_action' ? contentTypeRaw : 'text';

      const MARKER_RE = /\n?<!--vars:\{[^}]*\}-->/;
      const twilioCleanBody = typeof templateBody === 'string'
        ? templateBody.replace(MARKER_RE, '').trimEnd()
        : templateBody;

      if (!name || !category || !templateBody) {
        return new Response(JSON.stringify({ error: 'name, category, and body are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        return new Response(JSON.stringify({ error: 'Name must be lowercase with underscores only' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!['UTILITY', 'MARKETING', 'AUTHENTICATION'].includes(category)) {
        return new Response(JSON.stringify({ error: 'Invalid category' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (contentType === 'media') {
        if (typeof mediaUrl !== 'string' || mediaUrl.trim().length === 0) {
          return new Response(JSON.stringify({ error: 'media_url is required for media templates' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      type CtaAction = { type: 'URL' | 'PHONE_NUMBER'; title: string; url?: string; phone?: string };
      let ctaActions: CtaAction[] = [];
      if (contentType === 'call_to_action') {
        if (!Array.isArray(ctaActionsRaw) || ctaActionsRaw.length === 0 || ctaActionsRaw.length > 2) {
          return new Response(JSON.stringify({ error: 'call_to_action requires 1-2 actions' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        for (const a of ctaActionsRaw) {
          if (!a || typeof a !== 'object') continue;
          const type = a.type === 'PHONE_NUMBER' ? 'PHONE_NUMBER' : 'URL';
          const title = typeof a.title === 'string' ? a.title.trim() : '';
          if (!title) {
            return new Response(JSON.stringify({ error: 'Each CTA button needs a title' }), {
              status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (type === 'URL') {
            const url = typeof a.url === 'string' ? a.url.trim() : '';
            if (!url) {
              return new Response(JSON.stringify({ error: `CTA "${title}" needs a URL` }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            ctaActions.push({ type, title, url });
          } else {
            const phone = typeof a.phone === 'string' ? a.phone.trim() : '';
            if (!phone) {
              return new Response(JSON.stringify({ error: `CTA "${title}" needs a phone number` }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            ctaActions.push({ type, title, phone });
          }
        }
      }

      const twilioTypes: Record<string, any> = {};
      if (contentType === 'media') {
        twilioTypes['twilio/media'] = {
          body: twilioCleanBody,
          media: [sanitizeUrl(mediaUrl)],
        };
      } else if (contentType === 'call_to_action') {
        twilioTypes['twilio/call-to-action'] = {
          body: twilioCleanBody,
          actions: ctaActions.map((a) =>
            a.type === 'URL'
              ? { type: 'URL', title: a.title, url: sanitizeUrl(a.url) }
              : { type: 'PHONE_NUMBER', title: a.title, phone: a.phone },
          ),
        };
      } else {
        twilioTypes['twilio/text'] = { body: twilioCleanBody };
      }

      const meta = deriveTwilioMetadata(twilioTypes);

      const variableSamples: Record<string, string> = {};
      if (variableSamplesRaw && typeof variableSamplesRaw === 'object') {
        for (const key of meta.requiredVariables) {
          const v = (variableSamplesRaw as Record<string, unknown>)[key];
          if (typeof v === 'string' && v.trim().length > 0) {
            variableSamples[key] = v.trim();
          }
        }
      }
      const missingSamples = meta.requiredVariables.filter((k) => !variableSamples[k]);
      if (missingSamples.length > 0) {
        return new Response(
          JSON.stringify({
            error: `Sample value required for variable(s): ${missingSamples.map((k) => `{{${k}}}`).join(', ')}`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: template, error: insertError } = await supabase
        .from('whatsapp_templates')
        .insert({
          name,
          category,
          language: language || 'en',
          body: templateBody,
          status: 'draft',
          created_by: user.id,
          twilio_content_types: twilioTypes,
          twilio_template_type: meta.templateType,
          twilio_media_url: meta.mediaUrl,
          twilio_media_is_variable: meta.mediaIsVariable,
          twilio_required_variables: meta.requiredVariables,
          twilio_synced_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const twilio = getTwilioAuth();
      if (twilio) {
        try {
          const twilioResponse = await fetch(`${CONTENT_API_BASE}/v1/Content`, {
            method: 'POST',
            headers: {
              'Authorization': twilio.authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              friendly_name: name,
              language: language || 'en',
              variables: variableSamples,
              types: twilioTypes,
            }),
          });

          const twilioData = await twilioResponse.json();

          if (twilioResponse.ok && twilioData.sid) {
            try {
              await fetch(`${CONTENT_API_BASE}/v1/Content/${twilioData.sid}/ApprovalRequests/whatsapp`, {
                method: 'POST',
                headers: {
                  'Authorization': twilio.authHeader,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name,
                  category: category.toLowerCase(),
                }),
              });
            } catch (approvalErr) {
              console.error('WhatsApp approval submission error:', approvalErr);
            }

            await supabase
              .from('whatsapp_templates')
              .update({
                twilio_content_sid: twilioData.sid,
                status: 'submitted',
              })
              .eq('id', template.id);

            template.twilio_content_sid = twilioData.sid;
            template.status = 'submitted';
          } else {
            console.error('Twilio Content API error:', JSON.stringify(twilioData));
          }
        } catch (twilioError) {
          console.error('Twilio submission error:', twilioError);
        }
      }

      return new Response(JSON.stringify(template), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
