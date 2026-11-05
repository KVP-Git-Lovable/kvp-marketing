import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/db";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

/**
 * What changed in this price book, and who changed it.
 *
 * Reads price_book_entry_audit, which a trigger writes on every insert,
 * update and delete of a row in this book. The trigger records only the
 * fields that actually moved, so a save that changed nothing leaves no entry
 * and the list stays worth reading.
 */

interface AuditRow {
  id: number;
  entry_id: string | null;
  product_id: string | null;
  action: 'created' | 'updated' | 'removed';
  changed_fields: string[];
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  changed_by: string | null;
  changed_at: string;
}

/** Field names as a pricing person would say them. */
const FIELD_LABEL: Record<string, string> = {
  list_price: 'List price',
  discount_percent: 'Discount %',
  final_price: 'Final price',
  mrp: 'MRP',
  ptr: 'PTR',
  pts: 'PTS',
  distributor_price: 'Distributor price',
  min_quantity: 'Min qty',
  uom_id: 'Pack',
  uom: 'Unit',
  is_active: 'Active',
};

const show = (v: any) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
};

export function PriceBookHistory({ priceBookId }: { priceBookId: string }) {
  const { data: rows = [], isLoading, error } = useQuery<AuditRow[]>({
    queryKey: ['price-book-history', priceBookId],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('price_book_entry_audit')
        .select('id, entry_id, product_id, action, changed_fields, old_values, new_values, changed_by, changed_at')
        .eq('price_book_id', priceBookId)
        .order('changed_at', { ascending: false })
        .limit(200);
      if (e) throw e;
      return (data as AuditRow[]) || [];
    },
  });

  // Names for the people and products the history mentions, fetched for the
  // ids on screen only. Not filtered to active: a price changed by someone who
  // has since left still needs their name against it.
  const peopleIds = Array.from(new Set(rows.map((r) => r.changed_by).filter(Boolean))) as string[];
  const productIds = Array.from(new Set(rows.map((r) => r.product_id).filter(Boolean))) as string[];

  const { data: names } = useQuery({
    queryKey: ['price-book-history-names', peopleIds.join(','), productIds.join(',')],
    enabled: peopleIds.length > 0 || productIds.length > 0,
    queryFn: async () => {
      const [pp, pr] = await Promise.all([
        peopleIds.length
          ? supabase.from('profiles').select('id, full_name, username').in('id', peopleIds)
          : Promise.resolve({ data: [] as any[] }),
        productIds.length
          ? supabase.from('products').select('id, name').in('id', productIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      return {
        people: new Map(((pp.data as any[]) || []).map((p) => [p.id, p.full_name || p.username || 'Unknown'])),
        products: new Map(((pr.data as any[]) || []).map((p) => [p.id, p.name])),
      };
    },
  });

  if (error) {
    return (
      <Card className="mt-4">
        <CardContent className="py-3 text-sm text-muted-foreground">
          History could not be loaded. Your profile may not have permission to view it.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Price history
          {rows.length > 0 && (
            <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Every price change in this book, newest first. A save that changed nothing is not
          recorded.
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No changes recorded yet. Tracking started when the audit trail was added, so edits
            made before that are not listed.
          </p>
        ) : (
          <div className="rounded-lg border divide-y">
            {rows.map((r) => (
              <div key={r.id} className="px-3 py-2.5 text-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <span className="min-w-0">
                    <Badge variant="outline" className={cn(
                      'text-[10px] mr-2',
                      r.action === 'removed' && 'text-destructive border-destructive/40',
                      r.action === 'created' && 'text-emerald-700 border-emerald-300 dark:text-emerald-400',
                    )}>
                      {r.action}
                    </Badge>
                    <span className="font-medium">
                      {(r.product_id && names?.products.get(r.product_id)) || 'A product'}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                    {format(new Date(r.changed_at), 'd MMM yyyy, HH:mm')}
                    {r.changed_by && ` · ${names?.people.get(r.changed_by) ?? 'Unknown'}`}
                  </span>
                </div>

                {r.action === 'updated' && (
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                    {r.changed_fields.map((f) => (
                      <span key={f} className="tabular-nums">
                        {FIELD_LABEL[f] ?? f}:{' '}
                        <span className="line-through">{show(r.old_values?.[f])}</span>
                        {' → '}
                        <span className="text-foreground font-medium">{show(r.new_values?.[f])}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PriceBookHistory;
