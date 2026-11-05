import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BANNER_THEMES, themeClasses } from '@/components/notifications/AnnouncementBanners';

/**
 * Writes one announcement banner, with the real thing on screen while you type.
 *
 * A banner is the only kind of notification whose wording and colour are the
 * product, so the preview is not a nicety — it is the only way to tell whether
 * the message fits before several hundred people see it.
 */

type Audience = 'all' | 'role' | 'user';

export interface BannerDraft {
  id?: string;
  title: string;
  body: string;
  cta_label: string;
  cta_link: string;
  theme: string;
  audience_type: Audience;
  audience_ids: string[];
  starts_at: string;
  ends_at: string;
  dismissible: boolean;
  priority: number;
  is_active: boolean;
}

const EMPTY: BannerDraft = {
  title: '', body: '', cta_label: '', cta_link: '', theme: 'indigo',
  audience_type: 'all', audience_ids: [],
  starts_at: '', ends_at: '', dismissible: true, priority: 0, is_active: true,
};

/** <input type="datetime-local"> wants local wall-clock with no zone. */
const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function BannerBuilder({
  open, onOpenChange, editing, actorUserId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: any | null;
  actorUserId: string;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState<BannerDraft>(EMPTY);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setD(editing
      ? {
          id: editing.id,
          title: editing.title ?? '',
          body: editing.body ?? '',
          cta_label: editing.cta_label ?? '',
          cta_link: editing.cta_link ?? '',
          theme: editing.theme ?? 'indigo',
          audience_type: (editing.audience_type ?? 'all') as Audience,
          audience_ids: editing.audience_ids ?? [],
          starts_at: toLocalInput(editing.starts_at),
          ends_at: toLocalInput(editing.ends_at),
          dismissible: editing.dismissible ?? true,
          priority: editing.priority ?? 0,
          is_active: editing.is_active ?? true,
        }
      : EMPTY);
  }, [open, editing]);

  const set = <K extends keyof BannerDraft>(k: K, v: BannerDraft[K]) => setD(p => ({ ...p, [k]: v }));

  const { data: roles = [] } = useQuery({
    queryKey: ['banner-roles'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from('security_profiles').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: people = [] } = useQuery({
    queryKey: ['banner-people'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, user_status, is_active')
        .order('full_name');
      if (error) throw error;
      return (data || []).filter((p: any) => p.user_status === 'active' && p.is_active !== false);
    },
  });

  const targets = (d.audience_type === 'role' ? roles : people) as any[];
  const filteredTargets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter(t => `${t.name || t.full_name || t.username || ''}`.toLowerCase().includes(q));
  }, [targets, search]);

  const problem =
    !d.title.trim() ? 'Give the banner a title.'
      : d.audience_type !== 'all' && d.audience_ids.length === 0 ? 'Pick who should see it.'
        : d.cta_label.trim() && !d.cta_link.trim() ? 'The button needs somewhere to go.'
          : d.starts_at && d.ends_at && new Date(d.ends_at) <= new Date(d.starts_at)
            ? 'It cannot stop before it starts.'
            : null;

  const save = async () => {
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    try {
      const payload = {
        title: d.title.trim(),
        body: d.body.trim() || null,
        cta_label: d.cta_label.trim() || null,
        cta_link: d.cta_link.trim() || null,
        theme: d.theme,
        audience_type: d.audience_type,
        audience_ids: d.audience_type === 'all' ? [] : d.audience_ids,
        starts_at: d.starts_at ? new Date(d.starts_at).toISOString() : new Date().toISOString(),
        ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null,
        dismissible: d.dismissible,
        priority: Number(d.priority) || 0,
        is_active: d.is_active,
      };
      const { error } = d.id
        ? await supabase.from('notification_banners').update(payload).eq('id', d.id)
        : await supabase.from('notification_banners').insert({ ...payload, created_by: actorUserId });
      if (error) throw error;
      toast.success(d.id ? 'Banner updated' : 'Banner created');
      qc.invalidateQueries({ queryKey: ['announcement-banners'] });
      qc.invalidateQueries({ queryKey: ['live-announcement-banners'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Could not save the banner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{d.id ? 'Edit banner' : 'New banner'}</DialogTitle>
          <DialogDescription>
            A board pinned to the top of the app for as long as you want it there.
          </DialogDescription>
        </DialogHeader>

        {/* The preview is the actual banner component's markup, so what is here
            is what people get — not an approximation drawn twice. */}
        <div className={cn('rounded-xl bg-gradient-to-r p-3.5 text-white shadow-sm', themeClasses(d.theme))}>
          <p className="text-[15px] font-semibold leading-snug">
            {d.title.trim() || 'Your headline goes here'}
          </p>
          {(d.body.trim() || !d.title.trim()) && (
            <p className="mt-0.5 text-[12.5px] leading-snug text-white/85">
              {d.body.trim() || 'And a line of detail underneath it.'}
            </p>
          )}
          {d.cta_label.trim() && (
            <span className="mt-2.5 inline-block rounded-md bg-white/95 px-2.5 py-1 text-[12px] font-medium text-slate-900">
              {d.cta_label.trim()}
            </span>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bn-title">Headline</Label>
              <Input id="bn-title" value={d.title} maxLength={80}
                     onChange={e => set('title', e.target.value)}
                     placeholder="Festive scheme is live" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bn-body">Detail</Label>
              <Textarea id="bn-body" rows={2} value={d.body} maxLength={180}
                        onChange={e => set('body', e.target.value)}
                        placeholder="10% extra margin on every case until 30 November." />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="bn-cta">Button</Label>
                <Input id="bn-cta" value={d.cta_label} maxLength={24}
                       onChange={e => set('cta_label', e.target.value)} placeholder="See schemes" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bn-link">Goes to</Label>
                <Input id="bn-link" value={d.cta_link}
                       onChange={e => set('cta_link', e.target.value)} placeholder="/schemes" />
              </div>
            </div>
            <p className="-mt-1 text-[11px] text-muted-foreground">
              A path like <code>/schemes</code> opens inside the app; a full https link opens a new tab.
              Leave both empty for a banner with no button.
            </p>

            <div className="space-y-1.5">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-1.5">
                {BANNER_THEMES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => set('theme', t.id)}
                    aria-pressed={d.theme === t.id}
                    title={t.label}
                    className={cn(
                      'h-7 w-11 rounded-md bg-gradient-to-r ring-offset-background transition-all',
                      t.classes,
                      d.theme === t.id && 'ring-2 ring-primary ring-offset-2',
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Who sees it</Label>
              <Select value={d.audience_type}
                      onValueChange={v => { set('audience_type', v as Audience); set('audience_ids', []); setSearch(''); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone in the app</SelectItem>
                  <SelectItem value="role">A role</SelectItem>
                  <SelectItem value="user">Specific people</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {d.audience_type !== 'all' && (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-8 pl-8 text-[12px]" value={search}
                         onChange={e => setSearch(e.target.value)}
                         placeholder={d.audience_type === 'role' ? 'Search roles' : 'Search people'} />
                </div>
                <ScrollArea className="h-36 rounded-md border">
                  <div className="p-1.5">
                    {filteredTargets.map((t: any) => (
                      <label key={t.id}
                             className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12.5px] hover:bg-muted/60">
                        <Checkbox
                          checked={d.audience_ids.includes(t.id)}
                          onCheckedChange={() => set('audience_ids',
                            d.audience_ids.includes(t.id)
                              ? d.audience_ids.filter(x => x !== t.id)
                              : [...d.audience_ids, t.id])}
                        />
                        {t.name || t.full_name || t.username || 'Unnamed'}
                      </label>
                    ))}
                    {filteredTargets.length === 0 && (
                      <p className="px-1.5 py-2 text-[12px] text-muted-foreground">Nothing matches that.</p>
                    )}
                  </div>
                </ScrollArea>
                <p className="text-[11px] text-muted-foreground">{d.audience_ids.length} selected</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="bn-from" className="text-[12px]">Shows from</Label>
                <Input id="bn-from" type="datetime-local" className="h-9 text-[12px]"
                       value={d.starts_at} onChange={e => set('starts_at', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bn-to" className="text-[12px]">Until</Label>
                <Input id="bn-to" type="datetime-local" className="h-9 text-[12px]"
                       value={d.ends_at} onChange={e => set('ends_at', e.target.value)} />
              </div>
            </div>
            <p className="-mt-1 text-[11px] text-muted-foreground">
              Leave "from" empty to start now, and "until" empty to run until you switch it off.
            </p>

            <div className="space-y-2 rounded-lg border p-3">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="text-[13px]">People can dismiss it</span>
                <Switch checked={d.dismissible} onCheckedChange={v => set('dismissible', v)} />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="text-[13px]">Live</span>
                <Switch checked={d.is_active} onCheckedChange={v => set('is_active', v)} />
              </label>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="bn-pri" className="text-[13px] font-normal">Order</Label>
                <Input id="bn-pri" type="number" className="h-8 w-20 text-[12px]"
                       value={d.priority} onChange={e => set('priority', Number(e.target.value))} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                When several are live they take turns; the higher number goes first.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <p className="flex-1 text-[11.5px] text-muted-foreground">
            <Trophy size={11} className="mr-1 inline" />
            Leaderboard podiums are built on their own and are not configured here.
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : d.id ? 'Save banner' : 'Create banner'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
