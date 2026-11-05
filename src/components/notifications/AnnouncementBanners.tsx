import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseLoose';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The announcement banners an admin pinned into the app.
 *
 * Renders nothing at all when none are live, which is the normal case — it
 * sits in the Layout so a banner can reach every screen without each page
 * having to know banners exist. Row-level security already limits the rows to
 * the ones aimed at this person and inside their live window, so there is no
 * audience logic here.
 */

export const BANNER_THEMES: Array<{ id: string; label: string; classes: string }> = [
  { id: 'indigo', label: 'Indigo', classes: 'from-indigo-600 via-indigo-500 to-violet-600' },
  { id: 'emerald', label: 'Green', classes: 'from-emerald-600 via-emerald-500 to-teal-500' },
  { id: 'amber', label: 'Sunset', classes: 'from-amber-500 via-orange-500 to-rose-500' },
  { id: 'sky', label: 'Sky', classes: 'from-sky-600 via-cyan-500 to-blue-500' },
  { id: 'rose', label: 'Berry', classes: 'from-rose-600 via-pink-500 to-fuchsia-600' },
  { id: 'slate', label: 'Charcoal', classes: 'from-slate-700 via-slate-600 to-slate-800' },
];

export const themeClasses = (id?: string | null) =>
  BANNER_THEMES.find(t => t.id === id)?.classes ?? BANNER_THEMES[0].classes;

export interface BannerRow {
  id: string;
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_link: string | null;
  theme: string;
  dismissible: boolean;
  priority: number;
}

export function AnnouncementBanners() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);

  const { data: banners = [] } = useQuery({
    queryKey: ['live-announcement-banners', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [live, dismissed] = await Promise.all([
        supabase
          .from('notification_banners')
          .select('id, title, body, cta_label, cta_link, theme, dismissible, priority')
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('notification_banner_dismissals')
          .select('banner_id')
          .eq('user_id', user!.id),
      ]);
      if (live.error) throw live.error;
      const hidden = new Set((dismissed.data || []).map((d: any) => d.banner_id));
      return ((live.data || []) as BannerRow[]).filter(b => !hidden.has(b.id));
    },
  });

  const current = banners[Math.min(index, Math.max(0, banners.length - 1))];

  // Several announcements take turns rather than stacking down the page.
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setIndex(i => (i + 1) % banners.length), 7000);
    return () => clearInterval(t);
  }, [banners.length]);

  const dismiss = async (id: string) => {
    if (!user?.id) return;
    // Hide it straight away; the row is only there so it stays hidden later.
    qc.setQueryData(['live-announcement-banners', user.id], (prev: BannerRow[] = []) =>
      prev.filter(b => b.id !== id));
    setIndex(0);
    await supabase.from('notification_banner_dismissals').insert({ banner_id: id, user_id: user.id });
  };

  const gradient = useMemo(() => themeClasses(current?.theme), [current?.theme]);

  if (!current) return null;

  return (
    <div className="px-3 pt-3 sm:px-4">
      <div className={cn('relative overflow-hidden rounded-xl bg-gradient-to-r p-3.5 text-white shadow-sm sm:p-4', gradient)}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-snug sm:text-[15px]">{current.title}</p>
            {current.body && (
              <p className="mt-0.5 text-[12.5px] leading-snug text-white/85">{current.body}</p>
            )}
            {current.cta_label && current.cta_link && (
              <Button
                size="sm"
                variant="secondary"
                className="mt-2.5 h-7 bg-white/95 text-[12px] text-slate-900 hover:bg-white"
                onClick={() => {
                  const link = current.cta_link!;
                  if (/^https?:\/\//i.test(link)) window.open(link, '_blank', 'noopener,noreferrer');
                  else navigate(link);
                }}
              >
                {current.cta_label}
              </Button>
            )}
          </div>

          {current.dismissible && (
            <button
              type="button"
              onClick={() => dismiss(current.id)}
              aria-label="Dismiss this announcement"
              className="shrink-0 rounded-full p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {banners.length > 1 && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous announcement"
              onClick={() => setIndex(i => (i - 1 + banners.length) % banners.length)}
              className="rounded-full p-0.5 text-white/70 hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`Show announcement ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/45',
                )}
              />
            ))}
            <button
              type="button"
              aria-label="Next announcement"
              onClick={() => setIndex(i => (i + 1) % banners.length)}
              className="rounded-full p-0.5 text-white/70 hover:text-white"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
