import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Store, MapPin, Phone, User } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import type { BeatChartRetailer } from '@/utils/beatChartData';

interface NewRetailersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Label of the clicked bar, e.g. "10 Sep" or "Aug 25". */
  periodLabel: string;
  retailers: BeatChartRetailer[];
  /** Fallback owner name (beat owner) when a retailer has no resolvable user. */
  fallbackOwnerName?: string | null;
  onRetailerClick?: (retailer: BeatChartRetailer) => void;
}

export const NewRetailersDrawer = ({
  open,
  onOpenChange,
  periodLabel,
  retailers,
  fallbackOwnerName,
  onRetailerClick,
}: NewRetailersDrawerProps) => {
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});

  const userIds = useMemo(
    () => Array.from(new Set(retailers.map((r) => r.user_id).filter(Boolean) as string[])),
    [retailers],
  );

  useEffect(() => {
    if (!open || userIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      if (cancelled || !data) return;
      const map: Record<string, string> = {};
      data.forEach((p: any) => {
        if (p?.id && p?.full_name) map[p.id] = p.full_name;
      });
      setOwnerNames(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userIds]);

  const sorted = useMemo(
    () =>
      [...retailers].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      ),
    [retailers],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg bg-background flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Store size={18} className="text-primary" />
            New Retailers · {periodLabel}
          </SheetTitle>
          <SheetDescription>
            {sorted.length} retailer{sorted.length === 1 ? '' : 's'} added in this period
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {sorted.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                No retailers were added in this period
              </div>
            ) : (
              sorted.map((r) => {
                const owner = (r.user_id && ownerNames[r.user_id]) || fallbackOwnerName || '—';
                return (
                  <div
                    key={r.id}
                    onClick={() => onRetailerClick?.(r)}
                    className="rounded-lg border bg-card p-3 space-y-2 cursor-pointer hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{r.id}</p>
                      </div>
                      {r.category && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {r.category}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">{r.address || '—'}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Phone size={12} className="shrink-0" />
                        {r.phone || '—'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User size={12} className="shrink-0" />
                        <span className="truncate">{owner}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Added{' '}
                        {r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy, hh:mm a') : '—'}
                      </span>
                      {r.priority && (
                        <Badge variant="outline" className="text-[10px]">
                          {r.priority}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
