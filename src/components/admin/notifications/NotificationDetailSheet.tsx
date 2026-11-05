import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Bell, Clock, Megaphone, Trophy } from 'lucide-react';
import type { HubKind, HubRow } from './NotificationHub';

/**
 * Everything known about one notification, without leaving the overview.
 *
 * The overview answers three questions per row in a few words each; this is
 * the same three questions in full, which is why the sections are named after
 * them rather than after the tables the values came from.
 */

const KIND_ICON: Record<HubKind, typeof Bell> = {
  rule: Bell,
  report: Clock,
  broadcast: Megaphone,
  banner: Trophy,
};

const KIND_NAME: Record<HubKind, string> = {
  rule: 'Alert',
  report: 'Report',
  broadcast: 'Announcement',
  banner: 'Banner',
};

const RECEIVER_LABELS: Record<string, string> = {
  employee: 'The person themselves',
  self: 'The person themselves',
  manager: 'Their manager',
  hierarchy: 'Whole hierarchy up',
  admin: 'All admins',
  role: 'A role',
  specific_user: 'Specific people',
};

const fmt = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[132px_1fr] gap-3 py-1.5">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="text-[13px] break-words">{children ?? '—'}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-3 first:border-t-0 first:pt-0">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <dl>{children}</dl>
    </div>
  );
}

export function NotificationDetailSheet({
  row, onOpenChange, onEdit, nameOf,
}: {
  row: HubRow | null;
  onOpenChange: (v: boolean) => void;
  onEdit: (row: HubRow) => void;
  nameOf: (id?: string | null) => string;
}) {
  const raw = row?.raw ?? {};

  /** A schedule's dataset and layout live on the definition, not the subscription. */
  const { data: definition } = useQuery({
    queryKey: ['hub-detail-definition', raw?.report_definition_id],
    enabled: !!row && row.kind === 'report' && !!raw?.report_definition_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_definitions')
        .select('name, dataset_key, layout')
        .eq('id', raw.report_definition_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  /** A banner has no config row, so its detail is the board it last produced. */
  const { data: podium = [] } = useQuery({
    queryKey: ['hub-detail-podium', raw?.period_type, raw?.period_label],
    enabled: !!row && row.kind === 'banner' && !!raw?.period_label,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaderboard_snapshots')
        .select('rank, full_name, total_points')
        .eq('period_type', raw.period_type)
        .eq('period_label', raw.period_label)
        .order('rank', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  if (!row) return null;
  const Icon = KIND_ICON[row.kind];

  return (
    <Sheet open={!!row} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-start gap-2 pr-6 text-left">
            <Icon size={16} className="mt-1 shrink-0 text-muted-foreground" />
            <span>{row.name}</span>
          </SheetTitle>
          <SheetDescription className="text-left">
            {KIND_NAME[row.kind]}
            {row.active === true ? ' · on' : row.active === false ? ' · off' : ''}
          </SheetDescription>
        </SheetHeader>

        {row.warning && (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[12.5px] dark:border-amber-900 dark:bg-amber-950/30">
            {row.warning}
          </p>
        )}

        <div className="mt-4 space-y-3">
          <Section title="What fires it">
            <Row label="Trigger">{row.trigger}</Row>
            {row.kind === 'rule' && (
              <>
                <Row label="Module"><code className="text-[12px]">{raw.source_table}</code></Row>
                <Row label="Event code"><code className="text-[12px]">{raw.event_code}</code></Row>
                <Row label="Timezone">{raw.timezone || 'Asia/Kolkata'}</Row>
              </>
            )}
            {row.kind === 'report' && (
              <>
                <Row label="Cadence">{raw.cadence}</Row>
                <Row label="Day">{raw.fire_day || '—'}</Row>
                <Row label="Time">{String(raw.fire_time || '').slice(0, 5)} {raw.timezone}</Row>
                <Row label="Period">
                  {raw.period_basis === 'previous' ? 'The last completed period' : 'The period in progress'}
                </Row>
              </>
            )}
            {row.kind === 'banner' && (
              <>
                <Row label="Period type">{raw.period_type}</Row>
                <Row label="Latest period">{raw.period_label}</Row>
                <Row label="Periods built">{raw.periods?.size ?? '—'}</Row>
              </>
            )}
            {row.kind === 'broadcast' && <Row label="Sent at">{fmt(raw.created_at)}</Row>}
          </Section>

          <Section title="Who gets it">
            <Row label="Audience">{row.audience}</Row>
            {row.kind === 'rule' && (
              <>
                <Row label="Receiver type">{RECEIVER_LABELS[raw.receiver_type] || raw.receiver_type}</Row>
                {raw.receiver_role && <Row label="Role">{raw.receiver_role}</Row>}
                {raw.receiver_user_id && <Row label="Person">{nameOf(raw.receiver_user_id)}</Row>}
              </>
            )}
            {row.kind === 'report' && (
              <>
                <Row label="Mode">
                  {raw.recipient_mode === 'all_managers' ? 'Every manager' : 'Named people'}
                </Row>
                <Row label="People">
                  {(raw.recipient_user_ids || []).length
                    ? (raw.recipient_user_ids as string[]).map(id => nameOf(id)).join(', ')
                    : 'Nobody named'}
                </Row>
                {(raw.email_recipients || []).length > 0 && (
                  <Row label="Email addresses">{(raw.email_recipients as string[]).join(', ')}</Row>
                )}
                {(raw.whatsapp_recipients || []).length > 0 && (
                  <Row label="WhatsApp">{(raw.whatsapp_recipients as string[]).join(', ')}</Row>
                )}
                <Row label="Scoping">
                  {raw.respect_hierarchy
                    ? 'Each recipient sees only their own hierarchy'
                    : 'Everyone sees the same rows'}
                </Row>
              </>
            )}
            {row.kind === 'broadcast' && (
              <>
                <Row label="Reached">{raw.sent_count ?? 0} recipients</Row>
                <Row label="Portals">
                  {(raw.target_portals || []).map((p: string) => p.replace(/_/g, ' ')).join(', ') || '—'}
                </Row>
                <Row label="Sent by">{nameOf(raw.sent_by) || '—'}</Row>
              </>
            )}
          </Section>

          <Section title="How it arrives">
            <Row label="Channels">
              <div className="flex flex-wrap gap-1">
                {Array.from(new Set(row.channels)).map(c => (
                  <Badge key={c} variant="secondary" className="text-[10.5px] font-normal">
                    {c.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </Row>
            {row.kind === 'report' && (
              <>
                <Row label="Attachment">{raw.attachment_format}</Row>
                <Row label="Phone push">{raw.push_to_phone ? 'Yes' : 'No'}</Row>
              </>
            )}
          </Section>

          {(row.kind === 'rule' || row.kind === 'broadcast') && (
            <Section title="What it says">
              <Row label="Title">
                <code className="text-[12px]">{raw.title_template ?? raw.title}</code>
              </Row>
              <Row label="Message">
                <code className="text-[12px]">{raw.message_template ?? raw.message}</code>
              </Row>
            </Section>
          )}

          {row.kind === 'report' && (
            <Section title="The report itself">
              <Row label="Definition">{definition?.name || raw.report_definitions?.name || '—'}</Row>
              <Row label="Dataset"><code className="text-[12px]">{definition?.dataset_key || '—'}</code></Row>
              <Row label="Shape">{definition?.layout || '—'}</Row>
              <Row label="Blocks">
                {Array.isArray(raw.pdf_template?.blocks) && raw.pdf_template.blocks.length
                  ? raw.pdf_template.blocks
                      .filter((b: any) => b && !b.hidden)
                      .map((b: any) => String(b.type).replace(/_/g, ' '))
                      .join(' → ')
                  : 'KPIs → table → AI summary (the default)'}
              </Row>
            </Section>
          )}

          {(row.kind === 'rule' || row.kind === 'report') && (
            <Section title="AI summary">
              <Row label="Enabled">{raw.ai_enabled ? 'Yes' : 'No'}</Row>
              {raw.ai_enabled && <Row label="Asked for">{raw.ai_prompt || 'The built-in wording'}</Row>}
              {raw.ai_enabled && raw.ai_dataset_key && (
                <Row label="Reads"><code className="text-[12px]">{raw.ai_dataset_key}</code></Row>
              )}
            </Section>
          )}

          {row.kind === 'banner' && (
            <Section title="The board it built">
              {(podium as any[]).length === 0 ? (
                <Row label="Places">Nothing captured for this period.</Row>
              ) : (
                (podium as any[]).map(p => (
                  <Row key={`${p.rank}-${p.full_name}`} label={`#${p.rank}`}>
                    {p.full_name || 'Unnamed'} · {Number(p.total_points || 0).toLocaleString('en-IN')} pts
                  </Row>
                ))
              )}
            </Section>
          )}

          <Section title="History">
            <Row label="Last / next">{row.when}</Row>
            {row.kind === 'report' && <Row label="Last delivered">{fmt(raw.last_fired_at)}</Row>}
            {(row.kind === 'rule' || row.kind === 'report') && (
              <Row label="Created">{fmt(raw.created_at)}</Row>
            )}
          </Section>
        </div>

        {(row.kind === 'rule' || row.kind === 'report' || row.kind === 'banner') && (
          <div className="mt-5 flex justify-end border-t pt-4">
            <Button size="sm" className="gap-2" onClick={() => onEdit(row)}>
              <Pencil size={13} /> Open its configuration
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
