import { Package, Lock, Truck, AlertOctagon, CalendarX, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryData {
  available: number;
  reserved: number;
  damaged: number;
  expired: number;
  /** Stock out on vans. Owned, but not sellable from the warehouse. */
  onVan?: number;
  /** Batches with no expiry date recorded. */
  undatedBatches?: number;
  /**
   * The unit every quantity on these cards is expressed in.
   *
   * Left undefined when the products on screen do not share one, because a
   * total that adds kilos to pieces has a number but not a meaning, and
   * labelling it with either would be the wrong kind of confident. A bare
   * number above a table in kg was how 1 gram came to read as "1" next to
   * "0.001 kg".
   */
  unit?: string;
}

interface InventorySummaryCardsProps {
  data: SummaryData;
  loading?: boolean;
}

const InventorySummaryCards = ({ data, loading }: InventorySummaryCardsProps) => {
  const cards = [
    {
      key: 'available',
      label: 'Available',
      value: data.available,
      hint: 'Ready to sell',
      icon: Package,
      tint: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
      chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
    },
    {
      key: 'reserved',
      label: 'Reserved',
      value: data.reserved,
      hint: 'Committed to orders',
      icon: Lock,
      tint: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
      chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
    },
    {
      key: 'onVan',
      label: 'On Vans',
      value: data.onVan ?? 0,
      hint: 'Out on the road',
      icon: Truck,
      tint: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
      chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
    },
    {
      key: 'damaged',
      label: 'Damaged',
      value: data.damaged,
      hint: 'Written off',
      icon: AlertOctagon,
      tint: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
      chip: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300',
    },
    {
      key: 'expired',
      label: 'Expired',
      value: data.expired,
      hint: 'Past expiry',
      icon: CalendarX,
      tint: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-800',
      chip: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
  ];

  if (data.undatedBatches && data.undatedBatches > 0) {
    cards.push({
      key: 'undated',
      label: data.undatedBatches === 1 ? 'Batch without expiry' : 'Batches without expiry',
      value: data.undatedBatches,
      hint: 'Used last under FEFO',
      icon: CalendarClock,
      tint: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
      chip: 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300',
    });
  }

  // A zero is not news. Draining the colour out of it lets the numbers that
  // matter carry the screen instead of competing with five bright noughts.
  const neutral = 'bg-muted/40 text-muted-foreground border-border';
  const neutralChip = 'bg-muted text-muted-foreground';

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const isZero = !loading && (card.value || 0) === 0;
        return (
          <div
            key={card.key}
            className={cn(
              'rounded-xl border px-3.5 py-3 transition-colors',
              isZero ? neutral : card.tint,
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn('grid h-7 w-7 place-items-center rounded-lg', isZero ? neutralChip : card.chip)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-medium opacity-90">{card.label}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1 text-2xl font-bold leading-none tabular-nums">
              <span>
                {loading
                  ? '—'
                  : (card.value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
              </span>
              {/* A batch count is a count of things, not a quantity of stock,
                  so it never takes the unit. */}
              {!loading && data.unit && card.key !== 'undated' && (
                <span className="text-sm font-medium opacity-70">{data.unit}</span>
              )}
            </div>
            <div className="mt-1 text-[11px] opacity-70">{card.hint}</div>
          </div>
        );
      })}
    </div>
  );
};

export default InventorySummaryCards;
