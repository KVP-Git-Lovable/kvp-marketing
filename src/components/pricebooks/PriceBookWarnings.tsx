import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PriceBookWarningInput {
  id: string;
  currency: string | null;
  target_type: string | null;
  is_standard: boolean | null;
  effective_to: string | null;
  is_active?: boolean | null;
}

/**
 * How loudly a warning should read.
 *
 * "warn" is a book that is not doing what was probably intended; "danger" is
 * a book whose effect nobody can predict from the screen.
 */
export type PriceBookWarningTone = 'warn' | 'danger';

export interface PriceBookWarning {
  text: string;
  tone: PriceBookWarningTone;
}

/** Non-blocking configuration warnings for a price book. */
export function usePriceBookWarnings(book?: PriceBookWarningInput | null) {
  return useQuery<PriceBookWarning[]>({
    queryKey: [
      'price-book-warnings',
      book?.id,
      book?.currency,
      book?.target_type,
      book?.is_standard,
      book?.effective_to,
    ],
    enabled: !!book?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const b = book as PriceBookWarningInput;
      const warnings: PriceBookWarning[] = [];

      // a) only book for this currency + target_type, but not marked standard
      if (!b.is_standard) {
        const { count } = await supabase
          .from('price_books')
          .select('id', { count: 'exact', head: true })
          .eq('currency', b.currency ?? '')
          .eq('target_type', b.target_type ?? '')
          .eq('is_active', true);
        if ((count ?? 0) <= 1) {
          warnings.push({
            tone: 'warn',
            text: "Not marked standard: this book will rank below any standard book. Tick 'Is standard' if it is the default for this currency.",
          });
        }
      }

      // b) expired
      if (b.effective_to) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(b.effective_to) < today) {
          warnings.push({ tone: 'warn', text: 'Expired: this book is not being applied to any order.' });
        }
      }

      // c) entries with no price
      const { count: zeroCount } = await supabase
        .from('price_book_entries')
        .select('id', { count: 'exact', head: true })
        .eq('price_book_id', b.id)
        .eq('final_price', 0);
      if ((zeroCount ?? 0) > 0) {
        warnings.push({
          tone: 'warn',
          text: `${zeroCount} product${zeroCount === 1 ? ' has' : 's have'} no price set and will fall through to the next price book or the product default.`,
        });
      }

      return warnings;
    },
  });
}

export function PriceBookWarnings({
  book,
  extra,
  className,
}: {
  book?: PriceBookWarningInput | null;
  /** Warnings the caller already knows from the list it loaded, shown in the
   *  same place as the queried ones so a card has one warning area, not two. */
  extra?: PriceBookWarning[];
  className?: string;
}) {
  const { data: queried } = usePriceBookWarnings(book);

  // Loudest first: what makes the book unpredictable before what makes it idle.
  const all = [...(extra ?? []), ...(queried ?? [])]
    .sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'danger' ? -1 : 1));
  if (!all.length) return null;

  const danger = all[0].tone === 'danger';

  return (
    <div className={className}>
      <div className={cn(
        'rounded-md border p-2.5 space-y-1.5',
        danger
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40',
      )}>
        {all.map((w) => (
          <div
            key={w.text}
            className={cn(
              'flex items-start gap-2 text-xs',
              w.tone === 'danger'
                ? 'text-destructive font-medium'
                : 'text-amber-800 dark:text-amber-200',
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{w.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PriceBookWarnings;
