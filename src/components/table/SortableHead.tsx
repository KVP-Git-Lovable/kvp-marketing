import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortState } from '@/lib/tableKit';

/**
 * A column heading that sorts when clicked.
 *
 * Rendered as a button rather than a bare heading so it is reachable by
 * keyboard and announces its state; the arrow alone would leave a
 * screen-reader user with no way to know the column is sortable.
 */
export function SortableHead({
  label, sortKey, sort, onToggle, align = 'left', className,
}: {
  label: string;
  sortKey: string;
  sort: SortState | null;
  onToggle: (key: string) => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const active = sort?.key === sortKey;
  const dir = active ? sort!.dir : null;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      aria-label={`Sort by ${label}${dir ? `, currently ${dir === 'asc' ? 'ascending' : 'descending'}` : ''}`}
      className={cn(
        'group inline-flex w-full items-center gap-1 rounded px-1 -mx-1 py-0.5',
        'transition-colors hover:text-foreground',
        active ? 'text-foreground' : 'text-muted-foreground',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center',
        className,
      )}
    >
      <span className="truncate">{label}</span>
      {dir === 'asc' ? <ArrowUp className="h-3 w-3 shrink-0" />
        : dir === 'desc' ? <ArrowDown className="h-3 w-3 shrink-0" />
        : <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50" />}
    </button>
  );
}

export default SortableHead;
