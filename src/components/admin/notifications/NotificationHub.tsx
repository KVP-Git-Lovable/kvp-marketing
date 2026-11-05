import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Bell, Clock, Megaphone, Trophy, Search, Plus, Pencil, Zap, Mail, MessageCircle,
  Smartphone, AlertTriangle, ArrowDown, ArrowUp, X, LayoutGrid,
} from 'lucide-react';
import { NotificationDetailSheet } from './NotificationDetailSheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Every notification this app can send, in one list.
 *
 * Four things produce notifications and each used to have its own screen:
 * event rules, scheduled reports, one-off broadcasts and period banners. They
 * only differ in *what fires them* — who receives it and how it reaches them
 * are the same question in all four cases — so they belong in one inventory
 * with a Kind column, and the four tiles above it are filters, not sections.
 */

export type HubKind = 'rule' | 'report' | 'broadcast' | 'banner';

export interface HubActions {
  onNewNotification: () => void;
  onEditRule: (rule: any) => void;
  onEditReport: (id: string) => void;
  onOpenBanners: () => void;
}

export interface HubRow {
  key: string;
  kind: HubKind;
  name: string;
  /** What fires it — the only question that differs between the four kinds. */
  trigger: string;
  /** Who gets it. */
  audience: string;
  /** How it reaches them. */
  channels: string[];
  /** Last time it ran, or when it next will. */
  when: string;
  /** A problem worth seeing from the list, e.g. a banner that stopped building. */
  warning?: string;
  active: boolean | null;
  /** The instant behind `when`, so the column sorts by time rather than by its own wording. */
  ts: number;
  raw?: any;
}

const KINDS: Array<{
  id: HubKind; label: string; plural: string; icon: typeof Bell;
  fires: string; iconBg: string;
}> = [
  { id: 'rule', label: 'Alert', plural: 'Alerts', icon: Bell, fires: 'Fires when something happens',
    iconBg: 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300' },
  { id: 'report', label: 'Report', plural: 'Reports', icon: Clock, fires: 'Goes out on a day and a time',
    iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300' },
  { id: 'broadcast', label: 'Announcement', plural: 'Announcements', icon: Megaphone, fires: 'Sent by hand, once',
    iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300' },
  { id: 'banner', label: 'Banner', plural: 'Banners', icon: Trophy, fires: 'Up until you take it down, or built when a period closes',
    iconBg: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300' },
];

const KIND_TONE: Record<HubKind, string> = {
  rule: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  report: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  broadcast: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  banner: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
};

const CHANNEL_META: Record<string, { label: string; icon: typeof Bell }> = {
  in_app: { label: 'In app', icon: Bell },
  push: { label: 'Push', icon: Smartphone },
  email: { label: 'Email', icon: Mail },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
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

const TABLE_LABELS: Record<string, string> = {
  orders: 'an order',
  order_items: 'an order line',
  leave_applications: 'a leave request',
  regularization_requests: 'a regularization',
  approval_requests: 'an approval request',
  visits: 'a visit',
  activity_events: 'an activity',
  pm_tasks: 'a task',
  retailers: 'a retailer',
  attendance: 'attendance',
  branding_requests: 'a branding request',
};

const EVENT_VERBS: Record<string, string> = {
  RECORD_CREATED: 'is created',
  RECORD_UPDATED: 'is updated',
  RECORD_DELETED: 'is deleted',
  AUTO_DAY_CLOSED: 'is auto-closed at day end',
  AUTO_DAY_WARNING: 'is about to be auto-closed',
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const stamp = (iso?: string | null) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

const daysSince = (iso?: string | null) => {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 86_400_000;
};

type SortKey = 'name' | 'kind' | 'trigger' | 'audience' | 'channels' | 'when' | 'active';

/** The header cells. Each one sorts, which is the other half of "clickable":
 *  a column reorders the list, a cell opens the thing it describes. */
const COLUMNS: Array<{ key: SortKey; label: string; width?: string; hint: string }> = [
  { key: 'name', label: 'Name', hint: 'Sort by name' },
  { key: 'kind', label: 'Kind', width: 'w-[82px]', hint: 'Sort by kind' },
  { key: 'trigger', label: 'What fires it', hint: 'Sort by trigger' },
  { key: 'audience', label: 'Who gets it', hint: 'Sort by audience' },
  { key: 'channels', label: 'How', width: 'w-[92px]', hint: 'Sort by channel' },
  { key: 'when', label: 'Last run', width: 'hidden w-[124px] lg:table-cell', hint: 'Sort by when it last ran' },
  { key: 'active', label: 'On', width: 'w-[58px]', hint: 'Sort by whether it is on' },
];

export function NotificationHub({ onNewNotification, onEditRule, onEditReport, onOpenBanners }: HubActions) {
  const qc = useQueryClient();
  const [kindFilter, setKindFilter] = useState<HubKind | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('kind');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  /** Clicking a row opens its detail here rather than navigating away — the
   *  point of an overview is that one click does not cost you the list. */
  const [detail, setDetail] = useState<HubRow | null>(null);

  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ['notification-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_rules')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: subs = [], isLoading: loadingSubs } = useQuery({
    queryKey: ['report-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_subscriptions')
        .select('*, report_definitions(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: broadcasts = [], isLoading: loadingBroadcasts } = useQuery({
    queryKey: ['hub-broadcasts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('broadcast_notification_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);
      if (error) throw error;
      return data as any[];
    },
  });

  /** Banners come from two places: the ones an admin wrote, and the podiums a
   *  cron builds. Both are a board at the top of the app, so both are listed. */
  const { data: pinned = [], isLoading: loadingPinned } = useQuery({
    queryKey: ['announcement-banners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_banners')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  /** Banners are not rows in a config table — the mechanism is a cron capture
   *  per period type, so the inventory entry is derived from what it last built. */
  const { data: banners = [], isLoading: loadingBanners } = useQuery({
    queryKey: ['hub-banner-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaderboard_snapshots')
        .select('period_type, period_label, period_end, captured_at')
        .order('captured_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const seen = new Map<string, { period_type: string; period_label: string; captured_at: string; periods: Set<string> }>();
      (data || []).forEach((row: any) => {
        const existing = seen.get(row.period_type);
        if (!existing) {
          seen.set(row.period_type, {
            period_type: row.period_type,
            period_label: row.period_label,
            captured_at: row.captured_at,
            periods: new Set([row.period_label]),
          });
        } else {
          existing.periods.add(row.period_label);
        }
      });
      return Array.from(seen.values());
    },
  });

  /** Only to name the people a rule or report points at by name, not by id. */
  const namedIds = useMemo(() => {
    const set = new Set<string>();
    rules.forEach((r: any) => { if (r.receiver_user_id) set.add(r.receiver_user_id); });
    subs.forEach((s: any) => (s.recipient_user_ids || []).forEach((id: string) => id && set.add(id)));
    return Array.from(set).sort();
  }, [rules, subs]);

  const { data: profiles = [] } = useQuery({
    queryKey: ['hub-profiles', namedIds.join(',')],
    enabled: namedIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, username').in('id', namedIds);
      if (error) throw error;
      return data || [];
    },
  });

  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    (profiles as any[]).forEach(p => map.set(p.id, p.full_name || p.username || 'User'));
    return (id?: string | null) => (id ? map.get(id) || 'One person' : '');
  }, [profiles]);

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('notification_rules')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-rules'] });
      toast.success('Alert updated');
    },
    onError: (e: any) => toast.error(e.message || 'Could not update the alert'),
  });

  const toggleReport = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('report_subscriptions')
        .update({ status: active ? 'active' : 'paused', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-subscriptions'] });
      toast.success('Report updated');
    },
    onError: (e: any) => toast.error(e.message || 'Could not update the report'),
  });

  const toggleBanner = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('notification_banners').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcement-banners'] });
      qc.invalidateQueries({ queryKey: ['live-announcement-banners'] });
      toast.success('Banner updated');
    },
    onError: (e: any) => toast.error(e.message || 'Could not update the banner'),
  });

  const rows = useMemo<HubRow[]>(() => {
    const out: HubRow[] = [];

    rules.forEach((r: any) => {
      const subject = TABLE_LABELS[r.source_table] || String(r.source_table || '').replace(/_/g, ' ');
      const verb = EVENT_VERBS[r.event_code] || r.event_code;
      const audience = r.receiver_type === 'role'
        ? `Role: ${r.receiver_role}`
        : r.receiver_type === 'specific_user'
          ? nameOf(r.receiver_user_id) || 'Specific people'
          : RECEIVER_LABELS[r.receiver_type] || r.receiver_type;
      out.push({
        key: `rule:${r.id}`,
        kind: 'rule',
        name: r.name,
        trigger: `When ${subject} ${verb}`,
        audience,
        channels: r.notification_channel === 'push' ? ['in_app', 'push'] : [r.notification_channel],
        when: '',
        active: r.is_active,
        ts: stamp(r.created_at),
        raw: r,
      });
    });

    subs.forEach((s: any) => {
      const time = String(s.fire_time || '').slice(0, 5);
      const cadence =
        s.cadence === 'today' ? 'Once, today'
          : s.cadence === 'daily' ? `Every day · ${time}`
            : s.cadence === 'weekday' ? `Weekdays · ${time}`
              : s.cadence === 'weekly' ? `Every ${s.fire_day || 'Mon'} · ${time}`
                : s.cadence === 'monthly' ? `Day ${s.fire_day || '1'} of the month · ${time}`
                  : `${s.cadence} · ${time}`;
      const people = (s.recipient_user_ids || []).length;
      const extras = (s.email_recipients || []).length + (s.whatsapp_recipients || []).length;
      const audience = s.recipient_mode === 'all_managers'
        ? 'Every manager'
        : people === 0 ? (extras ? `${extras} address${extras === 1 ? '' : 'es'}` : 'Nobody yet')
          : people === 1 ? nameOf(s.recipient_user_ids[0])
            : `${people} people${extras ? ` + ${extras} address${extras === 1 ? '' : 'es'}` : ''}`;
      out.push({
        key: `report:${s.id}`,
        kind: 'report',
        name: s.name || s.report_definitions?.name || 'Report',
        trigger: cadence,
        audience,
        channels: s.channels?.length
          ? (s.push_to_phone && s.channels.includes('in_app') ? [...s.channels, 'push'] : s.channels)
          : ['in_app'],
        when: s.last_fired_at ? `Last ${fmtDate(s.last_fired_at)}` : 'Not sent yet',
        warning: s.status === 'active' && (s.recipient_user_ids || []).length === 0 && extras === 0
          ? 'This report is on but has no recipients, so it renders every time and reaches nobody.'
          : undefined,
        active: s.status === 'active',
        ts: stamp(s.last_fired_at || s.created_at),
        raw: s,
      });
    });

    broadcasts.forEach((b: any) => {
      const portals = (b.target_portals || []).map((p: string) => p.replace(/_/g, ' ')).join(', ');
      out.push({
        key: `broadcast:${b.id}`,
        kind: 'broadcast',
        name: b.title,
        trigger: 'Sent by hand, once',
        audience: `${b.sent_count ?? 0} recipient${b.sent_count === 1 ? '' : 's'}${portals ? ` · ${portals}` : ''}`,
        channels: ['in_app', 'push'],
        when: `Sent ${fmtDate(b.created_at)}`,
        active: null,
        ts: stamp(b.created_at),
        raw: b,
      });
    });

    pinned.forEach((b: any) => {
      const now = Date.now();
      const startsLater = b.starts_at && new Date(b.starts_at).getTime() > now;
      const ended = b.ends_at && new Date(b.ends_at).getTime() <= now;
      const audience = b.audience_type === 'all'
        ? 'Everyone in the app'
        : b.audience_type === 'role'
          ? `${(b.audience_ids || []).length} role${(b.audience_ids || []).length === 1 ? '' : 's'}`
          : `${(b.audience_ids || []).length} ${(b.audience_ids || []).length === 1 ? 'person' : 'people'}`;
      out.push({
        key: `banner:${b.id}`,
        kind: 'banner',
        name: b.title,
        trigger: 'Pinned by hand',
        audience,
        channels: ['in_app'],
        when: !b.is_active ? 'Switched off'
          : startsLater ? `Starts ${fmtDate(b.starts_at)}`
            : ended ? `Ended ${fmtDate(b.ends_at)}`
              : b.ends_at ? `Up until ${fmtDate(b.ends_at)}` : 'Up now',
        warning: b.is_active && ended
          ? `This banner is still on but its window closed on ${fmtDate(b.ends_at)}, so nobody sees it.`
          : undefined,
        active: !!b.is_active && !startsLater && !ended,
        ts: stamp(b.starts_at || b.created_at),
        raw: { ...b, __pinned: true },
      });
    });

    banners.forEach((b: any) => {
      const stale = daysSince(b.captured_at) > (b.period_type === 'weekly' ? 14 : 45);
      out.push({
        key: `banner:${b.period_type}`,
        kind: 'banner',
        name: `${b.period_type === 'weekly' ? 'Weekly' : 'Monthly'} leaderboard podium`,
        trigger: b.period_type === 'weekly' ? 'When the week closes' : 'When the month closes',
        audience: 'Everyone in the app',
        channels: ['in_app'],
        when: `Built ${fmtDate(b.captured_at)}`,
        warning: stale
          ? `The last podium was built ${fmtDate(b.captured_at)} — the capture has produced nothing since.`
          : undefined,
        active: !stale,
        ts: stamp(b.captured_at),
        raw: b,
      });
    });

    return out;
  }, [rules, subs, broadcasts, banners, pinned, nameOf]);

  const counts = useMemo(() => {
    const map: Record<string, { total: number; active: number }> = {};
    KINDS.forEach(k => { map[k.id] = { total: 0, active: 0 }; });
    rows.forEach(r => {
      map[r.kind].total += 1;
      if (r.active) map[r.kind].active += 1;
    });
    return map;
  }, [rows]);

  const warnings = rows.filter(r => r.warning);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows
      .filter(r => (kindFilter === 'all' ? true : r.kind === kindFilter))
      .filter(r => (channelFilter ? r.channels.includes(channelFilter) : true))
      .filter(r => (onlyActive ? r.active === true : true))
      .filter(r => !q || `${r.name} ${r.trigger} ${r.audience}`.toLowerCase().includes(q));

    const dir = sortDir === 'asc' ? 1 : -1;
    const text = (r: HubRow): string =>
      sortKey === 'name' ? r.name
        : sortKey === 'kind' ? KINDS.findIndex(k => k.id === r.kind).toString()
          : sortKey === 'trigger' ? r.trigger
            : sortKey === 'audience' ? r.audience
              : sortKey === 'channels' ? Array.from(new Set(r.channels)).sort().join(',')
                : '';

    return [...filtered].sort((x, y) => {
      if (sortKey === 'when') return (x.ts - y.ts) * dir;
      // A row that is on sorts before one that is off; a broadcast has no switch.
      if (sortKey === 'active') {
        const rank = (r: HubRow) => (r.active === true ? 0 : r.active === false ? 1 : 2);
        return (rank(x) - rank(y)) * dir || x.name.localeCompare(y.name);
      }
      return text(x).localeCompare(text(y), undefined, { numeric: true }) * dir
        || x.name.localeCompare(y.name);
    });
  }, [rows, kindFilter, channelFilter, search, onlyActive, sortKey, sortDir]);

  const sortBy = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const loading = loadingRules || loadingSubs || loadingBroadcasts || loadingBanners || loadingPinned;

  const edit = (row: HubRow) => {
    if (row.kind === 'rule') onEditRule(row.raw);
    else if (row.kind === 'report') onEditReport(row.raw.id);
    else if (row.kind === 'banner') onOpenBanners();
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5">
        {/* The tiles are filters, not sections — one inventory, four ways in. */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <KindTile
            label="Everything"
            fires="All four kinds"
            icon={LayoutGrid}
            iconBg="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            total={rows.length}
            active={rows.filter(r => r.active).length}
            selected={kindFilter === 'all'}
            onClick={() => setKindFilter('all')}
            className="col-span-2 md:col-span-1"
          />
          {KINDS.map(k => (
            <KindTile
              key={k.id}
              label={k.plural}
              fires={k.fires}
              icon={k.icon}
              iconBg={k.iconBg}
              total={counts[k.id].total}
              active={counts[k.id].active}
              selected={kindFilter === k.id}
              onClick={() => setKindFilter(kindFilter === k.id ? 'all' : k.id)}
            />
          ))}
        </div>

        {warnings.length > 0 && (
          <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30">
            <CardContent className="space-y-1 p-3">
              {warnings.map(w => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => setDetail(w)}
                  className="flex w-full items-start gap-2 rounded px-1 py-0.5 text-left text-[12.5px] hover:bg-amber-100/60 dark:hover:bg-amber-900/30"
                >
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                  <span><span className="font-medium">{w.name}</span> — {w.warning}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 rounded-xl pl-8"
              placeholder="Search by name, trigger or audience"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[13px]">
            <Switch checked={onlyActive} onCheckedChange={setOnlyActive} />
            Only the ones that are on
          </label>
        </div>

        {(kindFilter !== 'all' || channelFilter) && (
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="text-muted-foreground">Filtered to</span>
            {kindFilter !== 'all' && (
              <FilterChip
                label={KINDS.find(k => k.id === kindFilter)!.plural}
                onClear={() => setKindFilter('all')}
              />
            )}
            {channelFilter && (
              <FilterChip
                label={CHANNEL_META[channelFilter]?.label || channelFilter}
                onClear={() => setChannelFilter(null)}
              />
            )}
          </div>
        )}

        {/* A phone cannot show eight columns, and a sideways-scrolling table is
            not an overview — below md the same rows render as cards. */}
        <div className="space-y-2 md:hidden">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : visible.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <Bell className="mx-auto mb-3 h-9 w-9 opacity-25" />
                <p className="text-sm">Nothing matches this filter.</p>
              </CardContent>
            </Card>
          ) : (
            visible.map(row => (
              <MobileRow
                key={row.key}
                row={row}
                onOpen={() => setDetail(row)}
                onFilterKind={() => setKindFilter(row.kind)}
                checked={row.kind === 'banner' && row.raw?.__pinned ? !!row.raw.is_active : !!row.active}
                onToggle={
                  row.kind === 'rule'
                    ? v => toggleRule.mutate({ id: row.raw.id, is_active: v })
                    : row.kind === 'report'
                      ? v => toggleReport.mutate({ id: row.raw.id, active: v })
                      : row.kind === 'banner' && row.raw?.__pinned
                        ? v => toggleBanner.mutate({ id: row.raw.id, is_active: v })
                        : undefined
                }
              />
            ))
          )}
        </div>

        <Card className="hidden overflow-hidden rounded-2xl border shadow-sm md:block">
          <CardHeader className="border-b bg-muted/30 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid size={16} className="text-muted-foreground" />
              {kindFilter === 'all' ? 'Everything that notifies' : KINDS.find(k => k.id === kindFilter)!.plural}
              <span className="text-xs font-normal text-muted-foreground">({visible.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table className="[&_td]:px-2.5 [&_th]:px-2.5">
              <TableHeader>
                <TableRow>
                  {COLUMNS.map(col => (
                    <TableHead key={col.key} className={col.width}>
                      <button
                        type="button"
                        onClick={() => sortBy(col.key)}
                        title={col.hint}
                        className="-mx-1 flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
                      >
                        {col.label}
                        {sortKey === col.key
                          ? (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
                          : null}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead className="w-[44px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center">
                      <div className="mx-auto h-7 w-7 animate-spin rounded-full border-b-2 border-primary" />
                    </TableCell>
                  </TableRow>
                ) : visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      <Bell className="mx-auto mb-3 h-10 w-10 opacity-25" />
                      <p>Nothing here yet</p>
                      <p className="mt-1 text-xs">
                        {search || onlyActive || channelFilter || kindFilter !== 'all'
                          ? 'No notification matches this filter.'
                          : 'Add your first notification to start sending.'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map(row => (
                    <TableRow
                      key={row.key}
                      onClick={() => setDetail(row)}
                      title="Open its details"
                      className={cn(
                        'cursor-pointer transition-colors',
                        row.warning && 'bg-amber-50/50 dark:bg-amber-950/20',
                      )}
                    >
                      <TableCell className="max-w-[220px] py-2.5 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate" title={row.name}>{row.name}</span>
                          {row.warning && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[260px]">{row.warning}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {/* The kind is also the fastest filter there is, so it acts as one. */}
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setKindFilter(row.kind); }}
                          title={`Show only ${KINDS.find(k => k.id === row.kind)?.plural.toLowerCase()}`}
                          className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', KIND_TONE[row.kind])}
                        >
                          {KINDS.find(k => k.id === row.kind)?.label}
                        </button>
                      </TableCell>
                      <TableCell className="max-w-[200px] text-[13px] text-muted-foreground">
                        <span className="block truncate" title={row.trigger}>{row.trigger}</span>
                      </TableCell>
                      <TableCell className="max-w-[160px] text-[13px]">
                        <span className="block truncate" title={row.audience}>{row.audience}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {Array.from(new Set(row.channels)).map(c => {
                            const meta = CHANNEL_META[c] || { label: c, icon: Bell };
                            const Icon = meta.icon;
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={e => { e.stopPropagation(); setChannelFilter(c); }}
                                title={`${meta.label} — click to show only this channel`}
                                aria-label={meta.label}
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                              >
                                <Icon size={12} />
                              </button>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-[12.5px] text-muted-foreground lg:table-cell">
                        {row.when || <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        {row.kind === 'rule' ? (
                          <Switch
                            checked={!!row.active}
                            onCheckedChange={v => toggleRule.mutate({ id: row.raw.id, is_active: v })}
                          />
                        ) : row.kind === 'report' ? (
                          <Switch
                            checked={!!row.active}
                            onCheckedChange={v => toggleReport.mutate({ id: row.raw.id, active: v })}
                          />
                        ) : row.kind === 'banner' && row.raw?.__pinned ? (
                          <Switch
                            checked={!!row.raw.is_active}
                            onCheckedChange={v => toggleBanner.mutate({ id: row.raw.id, is_active: v })}
                          />
                        ) : row.kind === 'banner' ? (
                          <Badge variant={row.active ? 'secondary' : 'outline'} className="text-[10.5px] font-normal">
                            {row.active ? 'Building' : 'Stopped'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sent</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        {row.kind === 'broadcast' ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground">
                                <Zap size={13} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>An announcement is a single send — there is nothing to edit.</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => edit(row)} title="Open its configuration">
                            <Pencil size={13} />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <NotificationDetailSheet
          row={detail}
          onOpenChange={v => { if (!v) setDetail(null); }}
          onEdit={row => { setDetail(null); edit(row); }}
          nameOf={nameOf}
        />

        <p className="text-[12px] text-muted-foreground">
          Click a row for the whole picture, a column heading to sort by it, or a kind or channel to
          filter to it. Alerts and reports are configuration you can switch off here; banners and
          announcements are a record of what went out, and that log shows only your own sends.
        </p>
      </div>
    </TooltipProvider>
  );
}

/** One row of the overview at phone width: the same six answers, stacked. */
function MobileRow({
  row, onOpen, onFilterKind, onToggle, checked,
}: {
  row: HubRow;
  onOpen: () => void;
  onFilterKind: () => void;
  onToggle?: (v: boolean) => void;
  checked: boolean;
}) {
  const kind = KINDS.find(k => k.id === row.kind);
  return (
    <Card
      onClick={onOpen}
      className={cn(
        'cursor-pointer rounded-2xl shadow-sm transition-shadow hover:shadow-md',
        row.warning && 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20',
      )}
    >
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[14px] font-medium leading-tight">
              <span className="truncate">{row.name}</span>
              {row.warning && <AlertTriangle size={13} className="shrink-0 text-amber-600" />}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{row.trigger}</p>
          </div>
          <div onClick={e => e.stopPropagation()} className="shrink-0">
            {onToggle ? (
              <Switch checked={checked} onCheckedChange={onToggle} />
            ) : row.kind === 'banner' ? (
              <Badge variant={row.active ? 'secondary' : 'outline'} className="text-[10.5px] font-normal">
                {row.active ? 'Building' : 'Stopped'}
              </Badge>
            ) : (
              <span className="text-[11px] text-muted-foreground">Sent</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onFilterKind(); }}
            className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', KIND_TONE[row.kind])}
          >
            {kind?.label}
          </button>
          {Array.from(new Set(row.channels)).map(c => {
            const meta = CHANNEL_META[c] || { label: c, icon: Bell };
            const Icon = meta.icon;
            return (
              <Badge key={c} variant="secondary" className="gap-1 px-1.5 text-[10.5px] font-normal">
                <Icon size={10} /> {meta.label}
              </Badge>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-muted-foreground">
          <span>To: <span className="text-foreground">{row.audience}</span></span>
          {row.when && <span>{row.when}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5">
      {label}
      <button type="button" onClick={onClear} aria-label={`Clear the ${label} filter`}
              className="text-muted-foreground hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/** Same shape as the stat cards on the Reports tab, so the two read as one app. */
/**
 * One filter, the size a filter should be.
 *
 * These were built as stat cards to match the Reports tab, but a stat card
 * earns its height by carrying a real trend — and the sparkline here was the
 * same hand-drawn zigzag on every tile, decoration posing as data. Without it
 * a filter is an icon, a count and a name, which is a third of the height and
 * leaves the page to the list.
 */
function KindTile({
  label, fires, icon: Icon, iconBg, total, active, selected, onClick, className,
}: {
  label: string;
  fires: string;
  icon: typeof Bell;
  iconBg: string;
  total: number;
  active: number;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={fires}
      className={cn(
        'flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left transition-all',
        selected ? 'border-primary bg-primary/5 ring-1 ring-primary/25' : 'hover:bg-muted/40',
        className,
      )}
    >
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon size={15} />
      </span>
      <span className="min-w-0">
        <span className="block text-[17px] font-bold leading-tight tabular-nums">
          {active}
          <span className="text-[13px] font-normal text-muted-foreground"> / {total}</span>
        </span>
        <span className="block truncate text-[11.5px] leading-tight text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}
