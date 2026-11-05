import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Building2, Search, Loader2, AlertTriangle, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Assigning this price book to distributors, from the book's own page.
 *
 * The same job can be done from Distributor Master › Pricing. Both write the
 * one `distributor_price_books` table, so neither is a copy of the other and
 * there is nothing to keep in step — a change made on either side is the same
 * row, and shows on the other as soon as it is read.
 *
 * The rule both sides obey: a distributor holds at most one live book of each
 * kind. Primary is what the distributor pays us (`target_type = 'distributor'`);
 * secondary is what its retailers pay (`target_type = 'retailer'`). Assigning
 * one supersedes only the other of the SAME kind, so a secondary assignment
 * never unseats a primary.
 */

interface Props {
  priceBookId: string;
  priceBookName: string;
  /** 'distributor' = primary, 'retailer' = secondary. */
  targetType: string;
  /** A book with no prices assigns fine and changes nothing — worth saying. */
  entriesCount?: number;
}

interface Row {
  id: string;
  name: string;
  /** This book's active assignment to that distributor, if any. */
  assignmentId: string | null;
  /** A DIFFERENT live book of the same kind that this would replace. */
  heldBy: { id: string; name: string } | null;
  archived: boolean;
}

export function PriceBookDistributors({
  priceBookId, priceBookName, targetType, entriesCount,
}: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const kind = targetType === 'retailer' ? 'secondary' : 'primary';
  const kindWord = kind === 'secondary' ? 'Secondary' : 'Primary';

  const queryKey = ['price-book-distributors', priceBookId];

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey,
    queryFn: async () => {
      // Distributor Master hides archived distributors, and `status` is
      // 'active' on every row in both environments, so archived_at is what
      // decides. Production has no such column yet -- same fallback as
      // MassRetailerEditModal, so this component survives the port.
      const withArchived = await supabase
        .from('distributors').select('id, name, archived_at').order('name');
      const hasArchivedCol = !withArchived.error;
      const distRes = hasArchivedCol
        ? withArchived
        : await supabase.from('distributors').select('id, name').order('name');

      const [{ data: dists, error: dErr }, { data: links, error: lErr }] = await Promise.all([
        Promise.resolve(distRes),
        supabase
          .from('distributor_price_books')
          .select('id, distributor_id, price_book_id, price_books!inner(id, name, target_type, is_active)')
          .eq('is_active', true),
      ]);
      if (dErr) throw dErr;
      if (lErr) throw lErr;

      // PostgREST types an embedded relation as an array even when the join
      // yields one row, so flatten it before reading the book off it.
      const bookOf = (l: any) => (Array.isArray(l?.price_books) ? l.price_books[0] : l?.price_books);

      // Only live books of this kind compete for the slot.
      const sameKind = (links || []).filter((l: any) => {
        const b = bookOf(l);
        return b?.is_active && (b?.target_type ?? 'distributor') === (targetType || 'distributor');
      });

      return (dists || []).map((d: any) => {
        const mine = sameKind.find((l: any) => l.distributor_id === d.id && l.price_book_id === priceBookId);
        const other = sameKind.find((l: any) => l.distributor_id === d.id && l.price_book_id !== priceBookId);
        return {
          id: d.id,
          name: d.name,
          assignmentId: mine?.id ?? null,
          heldBy: other ? { id: bookOf(other).id as string, name: bookOf(other).name as string } : null,
          archived: hasArchivedCol ? !!d.archived_at : false,
        };
      });
    },
  });

  const [showArchived, setShowArchived] = useState(false);

  /** An archived distributor still holding this book has to stay on screen,
   *  or it cannot be taken off it. Otherwise archived rows are hidden. */
  const selectable = useMemo(
    () => rows.filter(r => showArchived || !r.archived || r.assignmentId),
    [rows, showArchived],
  );
  const hiddenArchived = rows.length - rows.filter(r => !r.archived || r.assignmentId).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? selectable.filter(r => r.name?.toLowerCase().includes(q)) : selectable;
  }, [selectable, search]);

  const assignedCount = rows.filter(r => r.assignmentId).length;

  /**
   * Ticks made but not yet written, keyed by distributor id.
   *
   * Assigning used to happen on the tick, and an assignment is not a small
   * thing: it supersedes whatever book that distributor was on. Ticking the
   * wrong row changed their prices before the finger left the mouse. Nothing
   * here is written until Save.
   */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);

  /** The tick state to show: the pending one if there is one, else the saved. */
  const isTicked = (row: Row) => pending[row.id] ?? !!row.assignmentId;
  /** A tick that differs from what is stored is a change waiting to be made. */
  const changed = rows.filter((r) => r.id in pending && pending[r.id] !== !!r.assignmentId);
  const pendingCount = changed.length;

  const togglePending = (row: Row, next: boolean) => {
    setPending((prev) => {
      const out = { ...prev };
      // Ticking a row back to how it was stored is not a change.
      if (next === !!row.assignmentId) delete out[row.id];
      else out[row.id] = next;
      return out;
    });
  };

  const discardPending = () => setPending({});

  /** Apply every pending tick, one at a time so a failure names its row. */
  const savePending = async () => {
    if (pendingCount === 0) return;
    setSavingAll(true);
    let done = 0;
    try {
      for (const row of changed) {
        await writeAssignment(row, pending[row.id]);
        done += 1;
      }
      setPending({});
      toast.success(`${done} assignment${done === 1 ? '' : 's'} saved`);
    } catch (e: any) {
      console.error('price book assignment failed:', e);
      // Whatever already went through stays done; the rest keep their ticks
      // so the user can see what is still outstanding and retry.
      setPending((prev) => {
        const out = { ...prev };
        changed.slice(0, done).forEach((r) => delete out[r.id]);
        return out;
      });
      toast.error(done > 0
        ? `Saved ${done}, then failed. Please contact app support.`
        : 'Could not save that. Please contact app support.');
    } finally {
      setSavingAll(false);
      qc.invalidateQueries({ queryKey });
    }
  };

  const writeAssignment = async (row: Row, next: boolean) => {
    setBusy(row.id);
    try {
      if (!next) {
        const { error } = await supabase
          .from('distributor_price_books')
          .update({ is_active: false, deactivated_at: new Date().toISOString() })
          .eq('id', row.assignmentId!);
        if (error) throw error;
      } else {
        // Supersede the other live book of this kind first, so the distributor
        // is never holding two at once -- the state the resolver cannot break
        // a tie in by anything but date.
        if (row.heldBy) {
          const { data: held, error: hErr } = await supabase
            .from('distributor_price_books')
            .select('id')
            .eq('distributor_id', row.id)
            .eq('price_book_id', row.heldBy.id)
            .eq('is_active', true);
          if (hErr) throw hErr;
          if (held?.length) {
            const { error: dErr } = await supabase
              .from('distributor_price_books')
              .update({ is_active: false, deactivated_at: new Date().toISOString() })
              .in('id', held.map((h: any) => h.id));
            if (dErr) throw dErr;
          }
        }
        const { data: user } = await supabase.auth.getUser();
        const { error } = await supabase.from('distributor_price_books').insert({
          distributor_id: row.id,
          price_book_id: priceBookId,
          is_active: true,
          assigned_by: user?.user?.id ?? null,
        });
        if (error) throw error;
      }
      // Distributor Master › Pricing and the price book list both load this
      // table with their own fetch on mount rather than through react-query,
      // so there is no key to invalidate for them -- they pick the change up
      // the next time they are opened. Same row either way.
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Distributors on this book
              <Badge variant="outline" className="text-[10px]">{kindWord}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {kind === 'primary'
                ? 'What these distributors pay us.'
                : 'What the shops under these distributors pay.'}{' '}
              The same list is editable from Distributor Master › Pricing — it is one
              assignment, not two.
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-semibold leading-none tabular-nums">
              {assignedCount}
              <span className="text-muted-foreground font-normal">/{selectable.length}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">assigned</div>
          </div>
        </div>

        {assignedCount > 0 && (entriesCount ?? 0) === 0 && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 mt-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
            This book has no prices in it, so assigning it changes nothing yet.
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search distributors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? 'No distributors yet.' : 'No distributor matches that search.'}
          </p>
        ) : (
          <div className="rounded-lg border divide-y">
            {visible.map(row => (
              <label
                key={row.id}
                className={cn(
                  'flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                  row.id in pending && pending[row.id] !== !!row.assignmentId
                    ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-muted/50',
                  busy === row.id && 'opacity-60 pointer-events-none',
                )}
              >
                <Checkbox
                  className="mt-0.5"
                  checked={isTicked(row)}
                  disabled={busy === row.id || savingAll}
                  onCheckedChange={(v) => togglePending(row, v === true)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm truncate" title={row.name}>
                    {row.name}
                    {row.archived && (
                      <span className="text-muted-foreground font-normal"> (archived)</span>
                    )}
                  </span>
                  {row.id in pending && pending[row.id] !== !!row.assignmentId ? (
                    /* What Save will do to this row, said before it happens. */
                    <span className="block text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      {pending[row.id]
                        ? (row.heldBy
                            ? `Will replace ${row.heldBy.name} — not saved yet`
                            : 'Will be added — not saved yet')
                        : 'Will be removed — not saved yet'}
                    </span>
                  ) : row.assignmentId ? (
                    <span className="block text-[11px] text-emerald-700 dark:text-emerald-400">
                      On this book
                    </span>
                  ) : row.heldBy ? (
                    // Say what ticking the box costs, before it is ticked.
                    <span className="block text-[11px] text-muted-foreground">
                      Currently on {row.heldBy.name} — ticking this replaces it
                    </span>
                  ) : (
                    <span className="block text-[11px] text-muted-foreground">
                      No {kind} book — falls back to the standard one
                    </span>
                  )}
                </span>
                {busy === row.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </label>
            ))}
          </div>
        )}

        {hiddenArchived > 0 && (
          <label className="mt-3 flex cursor-pointer items-center gap-2">
            <Checkbox checked={showArchived}
              onCheckedChange={(v) => setShowArchived(v === true)} />
            <span className="text-[11px] leading-tight">
              Include archived distributors
              <span className="block text-muted-foreground">{hiddenArchived} hidden</span>
            </span>
          </label>
        )}

        {pendingCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/60">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="text-sm font-medium">
              {pendingCount} change{pendingCount === 1 ? '' : 's'} not saved
            </span>
            <Button size="sm" className="h-8 ml-auto gap-1.5"
              disabled={savingAll} onClick={savePending}>
              <Save className="h-3.5 w-3.5" />
              {savingAll ? 'Saving…' : `Save ${pendingCount}`}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5"
              disabled={savingAll} onClick={discardPending}>
              <X className="h-3.5 w-3.5" /> Discard
            </Button>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-3">
          A distributor holds one {kind} book at a time. Assigning “{priceBookName}” replaces
          only its {kind} book; its {kind === 'primary' ? 'secondary' : 'primary'} book is left alone.
        </p>
      </CardContent>
    </Card>
  );
}

export default PriceBookDistributors;
