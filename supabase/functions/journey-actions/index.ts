import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const JOURNEY_OBJECTIVES = new Set(['lead_generation', 'engagement', 'awareness', 'conversion', 're_engagement', 'event_promotion']);

// Optional "campaign" fields on a journey. Blank/undefined means "leave as is" on
// update and NULL on create. Objective is accepted on create only (immutable after).
function parseCampaignFields(body: Record<string, unknown>, allowObjective: boolean): { fields: Record<string, unknown>; error?: string } {
  const fields: Record<string, unknown> = {};
  const blank = (v: unknown) => v === null || v === '';
  if (allowObjective && body.objective !== undefined) {
    if (blank(body.objective)) fields.objective = null;
    else if (typeof body.objective === 'string' && JOURNEY_OBJECTIVES.has(body.objective)) fields.objective = body.objective;
    else return { fields, error: 'Invalid objective' };
  }
  for (const key of ['start_date', 'end_date'] as const) {
    if (body[key] === undefined) continue;
    if (blank(body[key])) { fields[key] = null; continue; }
    const d = new Date(String(body[key]));
    if (Number.isNaN(d.getTime())) return { fields, error: `Invalid ${key}` };
    fields[key] = d.toISOString();
  }
  if (body.budget_cap !== undefined) {
    if (blank(body.budget_cap)) fields.budget_cap = null;
    else {
      const n = Number(body.budget_cap);
      if (!Number.isFinite(n) || n < 0) return { fields, error: 'budget_cap must be a number >= 0' };
      fields.budget_cap = n;
    }
  }
  if (body.description !== undefined) {
    fields.description = blank(body.description) ? null : String(body.description).slice(0, 2000);
  }
  if (fields.start_date && fields.end_date && new Date(String(fields.end_date)) <= new Date(String(fields.start_date))) {
    return { fields, error: 'end_date must be after start_date' };
  }
  return { fields };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

// Journey CRUD + control, targeting this project's own `retailers` table as
// the audience (not a standalone contact list). A journey's `filters` select
// a retailer segment (category / territory_id / beat_id); publishing a
// journey enrolls the current matching retailers as a one-time snapshot.
// process-journeys then advances each enrollment's step sequence on a cron.

interface AudienceFilter {
  category?: string;
  territory_id?: string;
  beat_id?: string;
}

async function matchingRetailerIds(supabase: any, filters: AudienceFilter): Promise<string[]> {
  let query = supabase.from('retailers').select('id').not('phone', 'is', null);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.territory_id) query = query.eq('territory_id', filters.territory_id);
  if (filters.beat_id) query = query.eq('beat_id', filters.beat_id);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r: { id: string }) => r.id);
}

// Marketing-contact audience path (Institutional/Distributor/Event databases).
// Fully parallel to the retailer path above — kept separate rather than
// merged, since journeys targeting marketing_contacts enroll into their
// own marketing_journey_enrollments table, never journey_enrollments.
const MARKETING_SEGMENT_TYPES = new Set(['marketing_institutional', 'marketing_distributor', 'marketing_event']);
function marketingDatabaseType(segmentType: string): 'institutional' | 'distributor' | 'event' {
  if (segmentType === 'marketing_institutional') return 'institutional';
  if (segmentType === 'marketing_event') return 'event';
  return 'distributor';
}
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
// A journey's `filters` stores { list_view_id } for a marketing segment;
// the list view's own filters are always resolved live (never snapshotted).
async function resolveMarketingListView(supabase: any, listViewId: string): Promise<{ databaseType: string; filters: MarketingFilterRow[] }> {
  const { data, error } = await supabase.from('marketing_contact_list_views').select('database_type, filters').eq('id', listViewId).single();
  if (error) throw error;
  return { databaseType: data.database_type, filters: Array.isArray(data.filters) ? data.filters : [] };
}
async function matchingMarketingContactIds(supabase: any, databaseType: string, filters: MarketingFilterRow[]): Promise<string[]> {
  let query = supabase.from('marketing_contacts').select('id').eq('database_type', databaseType).not('phone', 'is', null);
  query = applyMarketingFilters(query, filters);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r: { id: string }) => r.id);
}

// Graph canvas helpers (nodes/edges format). `steps[]` journeys (legacy,
// linear) keep their own code path untouched below for zero regression.
function findNextNodeId(nodeId: string, edges: Array<{ source: string; target: string; sourceHandle?: string | null }>, handle?: string): string | null {
  const edge = handle
    ? edges.find((e) => e.source === nodeId && e.sourceHandle === handle)
    : edges.find((e) => e.source === nodeId);
  return edge?.target ?? null;
}

function entryAudienceFilter(nodes: Array<{ type: string; data?: any }>): AudienceFilter {
  const entry = nodes.find((n) => n.type === 'entry');
  const category = entry?.data?.category;
  return category && category !== 'any' ? { category } : {};
}

function nextFireAtForNode(nodeId: string | null, nodes: Array<{ id: string; type: string; data?: any }>): string {
  const node = nodeId ? nodes.find((n) => n.id === nodeId) : null;
  if (node?.type === 'delay') {
    const duration = Number(node.data?.duration) || 0;
    const unitMs = node.data?.unit === 'days' ? 86400000 : 3600000;
    return new Date(Date.now() + duration * unitMs).toISOString();
  }
  return new Date().toISOString();
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

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const journeyId = url.searchParams.get('id');

      if (journeyId) {
        const { data: journey, error } = await supabase.from('journeys').select('*').eq('id', journeyId).is('deleted_at', null).single();
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const isMarketing = MARKETING_SEGMENT_TYPES.has(journey.segment_type);
        const enrollmentsTable = isMarketing ? 'marketing_journey_enrollments' : 'journey_enrollments';
        const { count: enrolledCount } = await supabase
          .from(enrollmentsTable).select('id', { count: 'exact', head: true }).eq('journey_id', journeyId);
        const { count: completedCount } = await supabase
          .from(enrollmentsTable).select('id', { count: 'exact', head: true }).eq('journey_id', journeyId).eq('status', 'completed');
        const { data: schedule } = await supabase.from('journey_schedules').select('*').eq('journey_id', journeyId).maybeSingle();
        const { data: excludedRows } = isMarketing
          ? await supabase.from('marketing_journey_excluded_contacts').select('id, contact_id, reason, excluded_at, marketing_contacts(name, phone)').eq('journey_id', journeyId)
          : await supabase.from('journey_excluded_contacts').select('id, retailer_id, reason, excluded_at, retailers(name, phone)').eq('journey_id', journeyId);
        const { data: costSettings } = await supabase.from('journey_cost_settings').select('*').eq('journey_id', journeyId).maybeSingle();
        const { count: sentCount } = await supabase
          .from('journey_message_log').select('id', { count: 'exact', head: true }).eq('journey_id', journeyId).eq('status', 'sent').eq('channel', 'whatsapp');
        return new Response(JSON.stringify({
          ...journey, enrolled_count: enrolledCount || 0, completed_count: completedCount || 0,
          schedule: schedule || null, excluded_contacts: excludedRows || [],
          cost_settings: costSettings || null, sent_message_count: sentCount || 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: journeys, error } = await supabase
        .from('journeys').select('*, journey_schedules(schedule_type)').is('deleted_at', null).order('updated_at', { ascending: false });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const withCounts = await Promise.all((journeys || []).map(async (j: any) => {
        const enrollmentsTable = MARKETING_SEGMENT_TYPES.has(j.segment_type) ? 'marketing_journey_enrollments' : 'journey_enrollments';
        const { count } = await supabase.from(enrollmentsTable).select('id', { count: 'exact', head: true }).eq('journey_id', j.id);
        const { journey_schedules, ...rest } = j;
        const schedule_type = Array.isArray(journey_schedules) ? journey_schedules[0]?.schedule_type ?? null : journey_schedules?.schedule_type ?? null;
        return { ...rest, enrolled_count: count || 0, schedule_type };
      }));
      return new Response(JSON.stringify(withCounts), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'DELETE') {
      // Soft delete: moves the journey to a 30-day trash instead of
      // erasing it immediately. Nothing else (enrollments, message log,
      // schedule, exclusions, cost settings) is touched, so restore is
      // lossless. An active journey is force-paused so it stops sending
      // while trashed; process-journeys also independently excludes any
      // deleted_at-set journey from its sweeps regardless of status.
      const { journey_id } = await req.json();
      const { data: current } = await supabase.from('journeys').select('status').eq('id', journey_id).is('deleted_at', null).maybeSingle();
      if (!current) {
        return new Response(JSON.stringify({ error: 'Journey not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error } = await supabase.from('journeys').update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        status: current.status === 'active' ? 'paused' : current.status,
      }).eq('id', journey_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const action = body.action || 'create';

      if (action === 'create') {
        const { name, filters, steps, nodes, edges, segment_type, list_view_id } = body;
        const hasGraph = Array.isArray(nodes) && nodes.length > 0;
        const hasSteps = Array.isArray(steps) && steps.length > 0;
        if (!name || (!hasGraph && !hasSteps)) {
          return new Response(JSON.stringify({ error: 'name and at least one step/node are required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const canvas_data = hasGraph ? { nodes, edges: edges || [] } : { steps };
        const isMarketing = MARKETING_SEGMENT_TYPES.has(segment_type);
        const campaign = parseCampaignFields(body, true);
        if (campaign.error) {
          return new Response(JSON.stringify({ error: campaign.error }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data, error } = await supabase.from('journeys').insert({
          ...campaign.fields,
          name,
          segment_type: isMarketing ? segment_type : 'retailers',
          filters: isMarketing ? { list_view_id } : (hasGraph ? entryAudienceFilter(nodes) : (filters || {})),
          canvas_data,
          status: 'draft',
          created_by: user.id,
        }).select().single();
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(data), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'update') {
        const { journey_id, name, filters, steps, nodes, edges, segment_type, list_view_id } = body;
        if (!journey_id) {
          return new Response(JSON.stringify({ error: 'journey_id is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        let effectiveSegmentType = segment_type;
        if (effectiveSegmentType === undefined) {
          const { data: existingJourney } = await supabase.from('journeys').select('segment_type').eq('id', journey_id).maybeSingle();
          effectiveSegmentType = existingJourney?.segment_type;
        }
        const isMarketing = MARKETING_SEGMENT_TYPES.has(effectiveSegmentType);
        const campaign = parseCampaignFields(body, false);
        if (campaign.error) {
          return new Response(JSON.stringify({ error: campaign.error }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const updates: Record<string, unknown> = { ...campaign.fields };
        if (name !== undefined) updates.name = name;
        if (segment_type !== undefined) updates.segment_type = isMarketing ? segment_type : 'retailers';
        if (isMarketing) {
          if (list_view_id !== undefined) updates.filters = { list_view_id };
          if (nodes !== undefined) updates.canvas_data = { nodes, edges: edges || [] };
          else if (steps !== undefined) updates.canvas_data = { steps };
        } else if (nodes !== undefined) {
          updates.canvas_data = { nodes, edges: edges || [] };
          updates.filters = filters !== undefined ? filters : entryAudienceFilter(nodes);
        } else {
          if (filters !== undefined) updates.filters = filters;
          if (steps !== undefined) updates.canvas_data = { steps };
        }
        const { data, error } = await supabase.from('journeys').update(updates).eq('id', journey_id).is('deleted_at', null).select().single();
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'preview-audience') {
        const { filters, segment_type, list_view_id } = body;
        if (MARKETING_SEGMENT_TYPES.has(segment_type)) {
          if (!list_view_id) {
            return new Response(JSON.stringify({ count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          const { databaseType, filters: lvFilters } = await resolveMarketingListView(supabase, list_view_id);
          const ids = await matchingMarketingContactIds(supabase, databaseType, lvFilters);
          return new Response(JSON.stringify({ count: ids.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const ids = await matchingRetailerIds(supabase, filters || {});
        return new Response(JSON.stringify({ count: ids.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'publish') {
        const { journey_id, reentry } = body;
        if (!journey_id) {
          return new Response(JSON.stringify({ error: 'journey_id is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data: journey, error: jErr } = await supabase.from('journeys').select('*').eq('id', journey_id).single();
        if (jErr || !journey || journey.deleted_at) {
          return new Response(JSON.stringify({ error: 'Journey not found' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const isMarketingJourney = MARKETING_SEGMENT_TYPES.has(journey.segment_type);
        const enrollmentsTable = isMarketingJourney ? 'marketing_journey_enrollments' : 'journey_enrollments';
        const excludedTable = isMarketingJourney ? 'marketing_journey_excluded_contacts' : 'journey_excluded_contacts';
        const audienceKey = isMarketingJourney ? 'contact_id' : 'retailer_id';

        // Campaign window. A campaign whose end date has passed can't be published
        // (it would be completed on the very next sweep); a future start date parks
        // the journey as 'scheduled' and the process-journeys sweep promotes it.
        const publishNowMs = Date.now();
        if (journey.end_date && new Date(journey.end_date).getTime() <= publishNowMs) {
          return new Response(JSON.stringify({ error: 'This campaign\'s end date has passed. Edit the dates before publishing.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const campaignStartMs = journey.start_date ? new Date(journey.start_date).getTime() : null;
        const isFutureStart = campaignStartMs !== null && campaignStartMs > publishNowMs;

        if (reentry) {
          // Scheduled re-fire / manual re-run: clear in-flight enrollments so
          // everyone who still matches the audience goes through the journey again.
          await supabase.from(enrollmentsTable).delete().eq('journey_id', journey_id).neq('status', 'completed');
        }
        const nodes = journey.canvas_data?.nodes;
        const edges = journey.canvas_data?.edges || [];
        const steps = journey.canvas_data?.steps || [];
        const isGraph = Array.isArray(nodes) && nodes.length > 0;
        if (!isGraph && steps.length === 0) {
          return new Response(JSON.stringify({ error: 'Journey has no steps' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Meta Ad nodes replace whatever Custom Audience their chosen Ad Set currently has
        // the first time they're linked (see create_journey_audience) — a one-way, Meta-side
        // side effect. Require the node's confirmation checkbox before that first link, so
        // nothing below (enrollment or the linking itself) runs without it. Already-linked
        // nodes are exempt — relinking never happens again, so re-confirming on every
        // pause/resume would be pure friction.
        if (isGraph) {
          const metaAdNodesToCheck = nodes.filter((n: any) => n.type === 'meta_ad' && n.data?.ad_set_row_id);
          if (metaAdNodesToCheck.length > 0) {
            const { data: existingLinks } = await supabase.from('journey_meta_ad_links')
              .select('node_id').eq('journey_id', journey_id);
            const linkedNodeIds = new Set((existingLinks || []).map((l: any) => l.node_id));
            const unconfirmed = metaAdNodesToCheck.filter((n: any) => !linkedNodeIds.has(n.id) && n.data?.audience_replace_confirmed !== true);
            if (unconfirmed.length > 0) {
              const names = unconfirmed.map((n: any) => n.data?.ad_set_name || 'Meta Ad').join(', ');
              return new Response(JSON.stringify({ error: `Confirm the audience-replacement checkbox on the Meta Ad node(s) before activating: ${names}.` }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        }

        let startNodeId: string | null = null;
        let startFireAt = new Date().toISOString();
        if (isGraph) {
          const entry = nodes.find((n: any) => n.type === 'entry');
          startNodeId = entry ? findNextNodeId(entry.id, edges) : null;
          startFireAt = nextFireAtForNode(startNodeId, nodes);
        } else {
          startNodeId = steps[0].id;
        }
        if (isFutureStart && campaignStartMs !== null) {
          // Delays count from the campaign start, not from the moment of publishing.
          startFireAt = new Date(new Date(startFireAt).getTime() + (campaignStartMs - publishNowMs)).toISOString();
        }

        const { data: excluded } = await supabase.from(excludedTable).select(audienceKey).eq('journey_id', journey_id);
        const excludedIds = new Set((excluded || []).map((e: any) => e[audienceKey]));
        const { data: alreadyEnrolled } = await supabase.from(enrollmentsTable).select(audienceKey).eq('journey_id', journey_id);
        const enrolledIds = new Set((alreadyEnrolled || []).map((e: any) => e[audienceKey]));

        let candidateIds: string[];
        if (isMarketingJourney) {
          const listViewId = journey.filters?.list_view_id;
          if (!listViewId) {
            return new Response(JSON.stringify({ error: 'This journey has no List View selected as its audience' }), {
              status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          const { databaseType, filters: lvFilters } = await resolveMarketingListView(supabase, listViewId);
          candidateIds = await matchingMarketingContactIds(supabase, databaseType, lvFilters);
        } else {
          candidateIds = await matchingRetailerIds(supabase, journey.filters || {});
        }
        const toEnroll = candidateIds.filter((id) => !excludedIds.has(id) && !enrolledIds.has(id));

        if (toEnroll.length > 0 && startNodeId) {
          const rows = toEnroll.map((id) => ({
            journey_id,
            [audienceKey]: id,
            current_node_id: startNodeId,
            status: 'active',
            next_fire_at: startFireAt,
          }));
          const { error: insErr } = await supabase.from(enrollmentsTable).insert(rows);
          if (insErr) {
            return new Response(JSON.stringify({ error: insErr.message }), {
              status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } else if (toEnroll.length > 0 && !startNodeId) {
          // Entry node has no outgoing connection — dead end, nothing to enroll into.
          const rows = toEnroll.map((id) => ({
            journey_id, [audienceKey]: id, current_node_id: 'entry', status: 'completed', next_fire_at: new Date().toISOString(),
          }));
          await supabase.from(enrollmentsTable).insert(rows);
        }

        // Meta Ad nodes: create (idempotently) the Custom Audience each one feeds and
        // link it to the chosen Ad Set, before anyone can reach the node. Best-effort —
        // a Meta-side failure here must never block the journey from publishing; a node
        // without a working link just logs+skips the push at sweep time (process-journeys).
        if (isGraph) {
          const metaAdNodes = nodes.filter((n: any) => n.type === 'meta_ad' && n.data?.ad_set_row_id);
          for (const node of metaAdNodes) {
            try {
              const resp = await fetch(`${supabaseUrl}/functions/v1/meta-api`, {
                method: 'POST',
                headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'create_journey_audience',
                  journey_id, node_id: node.id,
                  name: `${journey.name} — ${node.data?.ad_set_name || 'Meta Ad'}`,
                  ad_set_row_id: node.data.ad_set_row_id,
                }),
              });
              if (!resp.ok) {
                const errBody = await resp.json().catch(() => ({}));
                console.error(`publish: create_journey_audience failed for node ${node.id}:`, errBody?.error || resp.status);
              }
            } catch (e) {
              console.error(`publish: create_journey_audience request failed for node ${node.id}:`, e);
            }
          }
        }

        await supabase.from('journeys').update({ status: isFutureStart ? 'scheduled' : 'active' }).eq('id', journey_id);

        // Real-time kick: nudge process-journeys immediately instead of waiting
        // for the next 5-minute cron tick, so "send immediately" steps go out now.
        // (Not for a scheduled campaign: nothing is due until its start date.)
        if (!isFutureStart && toEnroll.length > 0) {
          const kick = fetch(`${supabaseUrl}/functions/v1/process-journeys`, {
            method: 'POST',
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          }).catch(() => {});
          // @ts-ignore — available in the Supabase Edge Runtime
          if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(kick);
        }

        return new Response(JSON.stringify({
          success: true, newly_enrolled: toEnroll.length,
          scheduled: isFutureStart, start_date: isFutureStart ? journey.start_date : null,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // A scheduled campaign can go back to draft any time before it starts.
      if (action === 'revert-to-draft') {
        const { journey_id } = body;
        if (!journey_id) {
          return new Response(JSON.stringify({ error: 'journey_id is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data: j } = await supabase.from('journeys').select('status, segment_type, deleted_at').eq('id', journey_id).maybeSingle();
        if (!j || j.deleted_at) {
          return new Response(JSON.stringify({ error: 'Journey not found' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (j.status !== 'scheduled') {
          return new Response(JSON.stringify({ error: 'Only a scheduled campaign can be moved back to draft' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const table = MARKETING_SEGMENT_TYPES.has(j.segment_type) ? 'marketing_journey_enrollments' : 'journey_enrollments';
        // Drop the audience snapshot taken at scheduling time; publishing again re-resolves it.
        await supabase.from(table).delete().eq('journey_id', journey_id).neq('status', 'completed');
        const { error } = await supabase.from('journeys').update({ status: 'draft' }).eq('id', journey_id).eq('status', 'scheduled');
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'pause' || action === 'archive') {
        const { journey_id } = body;
        const status = action === 'pause' ? 'paused' : 'archived';
        const { error } = await supabase.from('journeys').update({ status }).eq('id', journey_id).is('deleted_at', null);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'schedule') {
        const { journey_id, schedule_type, start_at, recurrence_rule, timezone } = body;
        if (!journey_id || !start_at) {
          return new Response(JSON.stringify({ error: 'journey_id and start_at are required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data: activeJourney } = await supabase.from('journeys').select('id').eq('id', journey_id).is('deleted_at', null).maybeSingle();
        if (!activeJourney) {
          return new Response(JSON.stringify({ error: 'Journey not found' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        await supabase.from('journey_schedules').delete().eq('journey_id', journey_id);
        const { data, error } = await supabase.from('journey_schedules').insert({
          journey_id,
          schedule_type: schedule_type || 'one_time',
          start_at,
          recurrence_rule: recurrence_rule || null,
          timezone: timezone || 'Asia/Kolkata',
          next_run_at: start_at,
        }).select().single();
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'unschedule') {
        const { journey_id } = body;
        const { error } = await supabase.from('journey_schedules').delete().eq('journey_id', journey_id);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'submit-approval' || action === 'approve' || action === 'reject') {
        const { journey_id, notes } = body;
        if (!journey_id) {
          return new Response(JSON.stringify({ error: 'journey_id is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const updates: Record<string, unknown> = action === 'submit-approval'
          ? { approval_status: 'pending' }
          : action === 'approve'
          ? { approval_status: 'approved', approved_by: user.id, approved_at: new Date().toISOString(), approval_notes: notes || null }
          : { approval_status: 'rejected', approval_notes: notes || null };
        const { error } = await supabase.from('journeys').update(updates).eq('id', journey_id).is('deleted_at', null);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'exclude') {
        const { journey_id, retailer_id, contact_id, reason } = body;
        if (!journey_id || (!retailer_id && !contact_id)) {
          return new Response(JSON.stringify({ error: 'journey_id and retailer_id or contact_id are required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (contact_id) {
          const { error } = await supabase.from('marketing_journey_excluded_contacts')
            .upsert({ journey_id, contact_id, reason: reason || null }, { onConflict: 'journey_id,contact_id' });
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          await supabase.from('marketing_journey_enrollments').update({ status: 'excluded' })
            .eq('journey_id', journey_id).eq('contact_id', contact_id).neq('status', 'completed');
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error } = await supabase.from('journey_excluded_contacts')
          .upsert({ journey_id, retailer_id, reason: reason || null }, { onConflict: 'journey_id,retailer_id' });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        await supabase.from('journey_enrollments').update({ status: 'excluded' })
          .eq('journey_id', journey_id).eq('retailer_id', retailer_id).neq('status', 'completed');
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'save-cost-settings') {
        const { journey_id, whatsapp_cost_per_message } = body;
        if (!journey_id) {
          return new Response(JSON.stringify({ error: 'journey_id is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        await supabase.from('journey_cost_settings').delete().eq('journey_id', journey_id);
        const { data, error } = await supabase.from('journey_cost_settings').insert({
          journey_id, whatsapp_cost_per_message: whatsapp_cost_per_message || 0,
        }).select().single();
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'unexclude') {
        const { journey_id, retailer_id, contact_id } = body;
        if (contact_id) {
          const { error } = await supabase.from('marketing_journey_excluded_contacts').delete()
            .eq('journey_id', journey_id).eq('contact_id', contact_id);
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error } = await supabase.from('journey_excluded_contacts').delete()
          .eq('journey_id', journey_id).eq('retailer_id', retailer_id);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'list-deleted') {
        const { data, error } = await supabase
          .from('journeys').select('id, name, status, deleted_at')
          .not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'restore') {
        const { journey_id } = body;
        if (!journey_id) {
          return new Response(JSON.stringify({ error: 'journey_id is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data, error } = await supabase.from('journeys')
          .update({ deleted_at: null, deleted_by: null })
          .eq('id', journey_id).not('deleted_at', 'is', null).select().maybeSingle();
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (!data) {
          return new Response(JSON.stringify({ error: 'Journey not found in trash' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'permanent-delete') {
        const { journey_id } = body;
        if (!journey_id) {
          return new Response(JSON.stringify({ error: 'journey_id is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data: isAdmin } = await supabase.rpc('is_system_admin', { _user_id: user.id });
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Only an admin can permanently delete a journey' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data: trashed } = await supabase.from('journeys').select('id').eq('id', journey_id).not('deleted_at', 'is', null).maybeSingle();
        if (!trashed) {
          return new Response(JSON.stringify({ error: 'Journey not found in trash' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { error } = await supabase.from('journeys').delete().eq('id', journey_id);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
