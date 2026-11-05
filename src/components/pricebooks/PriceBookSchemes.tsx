import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift, Loader2, ExternalLink, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Schemes touching the products this book prices.
 *
 * Schemes are their own module -- product_schemes, with slabs, Buy X Get Y,
 * dates, priority and usage caps -- and they are NOT scoped by price book:
 * they attach to a product or category and reach customers through
 * scheme_applicability. So this is a read of what else will move the price of
 * these products, not a second place to configure one.
 *
 * It is here because a price book read on its own is misleading: a rate set at
 * 100 with a live 10% scheme on the same product is not a price of 100, and
 * nothing on the pricing screen said so.
 */

interface SchemeRow {
  id: string;
  name: string;
  scheme_type: string | null;
  is_active: boolean | null;
  start_date: string | null;
  end_date: string | null;
  condition_quantity: number | null;
  discount_percentage: number | null;
  discount_amount: number | null;
  buy_quantity: number | null;
  free_quantity: number | null;
  priority: number | null;
  product_id: string | null;
  product?: { name: string } | null;
}

/** What the scheme actually gives, in one line. */
function describe(s: SchemeRow): string {
  const parts: string[] = [];
  if (s.buy_quantity && s.free_quantity) {
    parts.push(`Buy ${s.buy_quantity}, get ${s.free_quantity} free`);
  } else if (s.free_quantity) {
    parts.push(`${s.free_quantity} free`);
  }
  if (s.discount_percentage) parts.push(`${s.discount_percentage}% off`);
  if (s.discount_amount) parts.push(`₹${s.discount_amount} off`);
  if (s.condition_quantity) parts.push(`on ${s.condition_quantity}+`);
  return parts.length ? parts.join(' · ') : (s.scheme_type?.replace(/_/g, ' ') ?? 'See scheme');
}

const expired = (s: SchemeRow) =>
  !!s.end_date && new Date(s.end_date) < new Date(new Date().toDateString());

export function PriceBookSchemes({
  priceBookId, productIds,
}: { priceBookId: string; productIds: string[] }) {
  const navigate = useNavigate();

  const { data: schemes = [], isLoading } = useQuery<SchemeRow[]>({
    queryKey: ['price-book-schemes', priceBookId, productIds.length],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_schemes')
        .select(`id, name, scheme_type, is_active, start_date, end_date,
                 condition_quantity, discount_percentage, discount_amount,
                 buy_quantity, free_quantity, priority, product_id,
                 product:products(name)`)
        .in('product_id', productIds)
        .order('priority', { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data as any[]) || []).map((s) => ({
        ...s,
        product: Array.isArray(s.product) ? s.product[0] : s.product,
      })) as SchemeRow[];
    },
  });

  const live = schemes.filter((s) => s.is_active && !expired(s));

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-4 w-4 text-muted-foreground" />
              Schemes on these products
              <Badge variant="outline" className="text-[10px]">{live.length} live</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Schemes attach to products, not to price books, so these apply wherever the product
              is sold. Shown here because a rate in this book is not the final price while one is
              running.
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0"
            onClick={() => navigate('/scheme-management')}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Manage schemes
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : schemes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No scheme touches the products in this book, so these rates are the final prices.
          </p>
        ) : (
          <div className="rounded-lg border divide-y">
            {schemes.map((s) => {
              const isExpired = expired(s);
              const dormant = !s.is_active || isExpired;
              return (
                <div key={s.id} className={cn('px-3 py-2.5 text-sm', dormant && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <span className="min-w-0">
                      <span className="font-medium">{s.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {s.product?.name ?? 'Product'} · {describe(s)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {isExpired ? (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Ended {s.end_date && format(new Date(s.end_date), 'd MMM')}
                        </Badge>
                      ) : !s.is_active ? (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>
                      ) : (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300">
                          Live
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                        {s.start_date ? format(new Date(s.start_date), 'd MMM yyyy') : 'no start'}
                        {s.end_date ? ` – ${format(new Date(s.end_date), 'd MMM yyyy')}` : ' – open'}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {live.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 mt-3">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
            {live.length} live scheme{live.length === 1 ? '' : 's'} will reduce what the customer
            actually pays below the rates in this book.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default PriceBookSchemes;
