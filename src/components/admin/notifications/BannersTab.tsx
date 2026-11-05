import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Megaphone, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BannerHistorySection } from '@/components/admin/BannerHistorySection';
import { BannerBuilder } from './BannerBuilder';
import { themeClasses } from '@/components/notifications/AnnouncementBanners';

/**
 * Banners, both kinds.
 *
 * The ones above are written by a person and pinned until taken down; the
 * leaderboard podiums below are built by the clock and nobody authors them.
 * They sit on one tab because to the person receiving one they are the same
 * thing — a board at the top of the app.
 */

const fmt = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
};

/** Why this banner is or is not on screen right now, in one phrase. */
function liveState(b: any): { label: string; tone: 'live' | 'waiting' | 'over' | 'off' } {
  if (!b.is_active) return { label: 'Switched off', tone: 'off' };
  const now = Date.now();
  if (b.starts_at && new Date(b.starts_at).getTime() > now) {
    return { label: `Starts ${fmt(b.starts_at)}`, tone: 'waiting' };
  }
  if (b.ends_at && new Date(b.ends_at).getTime() <= now) {
    return { label: `Ended ${fmt(b.ends_at)}`, tone: 'over' };
  }
  return { label: b.ends_at ? `Live until ${fmt(b.ends_at)}` : 'Live', tone: 'live' };
}

const TONE: Record<string, string> = {
  live: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  waiting: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  over: 'bg-muted text-muted-foreground',
  off: 'bg-muted text-muted-foreground',
};

export function BannersTab({ actorUserId, newSignal }: { actorUserId: string; newSignal?: number }) {
  const qc = useQueryClient();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  // The overview's "New notification → Banner" lands here and should open the
  // builder rather than leave the person looking for the button themselves.
  React.useEffect(() => {
    if (newSignal) { setEditing(null); setBuilderOpen(true); }
  }, [newSignal]);

  const { data: banners = [], isLoading } = useQuery({
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

  const audienceLabel = (b: any) =>
    b.audience_type === 'all'
      ? 'Everyone'
      : b.audience_type === 'role'
        ? `${b.audience_ids?.length || 0} role${b.audience_ids?.length === 1 ? '' : 's'}`
        : `${b.audience_ids?.length || 0} ${b.audience_ids?.length === 1 ? 'person' : 'people'}`;

  const toggle = useMutation({
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

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notification_banners').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcement-banners'] });
      qc.invalidateQueries({ queryKey: ['live-announcement-banners'] });
      toast.success('Banner deleted');
      setConfirmDelete(null);
    },
    onError: (e: any) => toast.error(e.message || 'Could not delete the banner'),
  });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Megaphone size={17} className="text-muted-foreground" /> Announcement banners
          </h2>
          <p className="text-sm text-muted-foreground">
            A board at the top of the app, up for as long as you want it there.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : banners.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Megaphone className="mx-auto mb-3 h-10 w-10 opacity-25" />
              <p className="text-sm">No banners yet</p>
              <p className="mt-1 text-xs">
                Write one to put a scheme, a deadline or a notice in front of everyone.
              </p>
              <Button
                size="sm"
                className="mt-3 gap-2"
                onClick={() => { setEditing(null); setBuilderOpen(true); }}
              >
                <Plus size={15} /> New banner
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {banners.map(b => {
              const state = liveState(b);
              return (
                <Card key={b.id} className="overflow-hidden">
                  {/* The banner itself, at the size it ships. */}
                  <div className={cn('bg-gradient-to-r p-3.5 text-white', themeClasses(b.theme))}>
                    <p className="text-[14.5px] font-semibold leading-snug">{b.title}</p>
                    {b.body && <p className="mt-0.5 text-[12.5px] leading-snug text-white/85">{b.body}</p>}
                    {b.cta_label && (
                      <span className="mt-2.5 inline-block rounded-md bg-white/95 px-2.5 py-1 text-[12px] font-medium text-slate-900">
                        {b.cta_label}
                      </span>
                    )}
                  </div>

                  <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', TONE[state.tone])}>
                      {state.label}
                    </span>
                    <Badge variant="secondary" className="text-[10.5px] font-normal">
                      {audienceLabel(b)}
                    </Badge>
                    {!b.dismissible && (
                      <Badge variant="outline" className="text-[10.5px] font-normal">Cannot be dismissed</Badge>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <Switch
                        checked={b.is_active}
                        onCheckedChange={v => toggle.mutate({ id: b.id, is_active: v })}
                        aria-label="Switch this banner on or off"
                      />
                      <Button variant="ghost" size="sm" title="Edit this banner"
                              onClick={() => { setEditing(b); setBuilderOpen(true); }}>
                        <Pencil size={13} />
                      </Button>
                      <Button variant="ghost" size="sm" title="Delete this banner"
                              onClick={() => setConfirmDelete(b)}>
                        <Trash2 size={13} className="text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t pt-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Trophy size={17} className="text-muted-foreground" /> Leaderboard podiums
          </h2>
          <p className="text-sm text-muted-foreground">
            Built on their own when a week or a month closes. There is nothing to switch on —
            this is what the capture has produced.
          </p>
        </div>
        <BannerHistorySection />
      </div>

      <BannerBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        editing={editing}
        actorUserId={actorUserId}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={v => { if (!v) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this banner?</AlertDialogTitle>
            <AlertDialogDescription>
              “{confirmDelete?.title}” will be removed for good. To take it down without losing it,
              switch it off instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
