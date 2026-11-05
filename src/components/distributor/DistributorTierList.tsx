import { useMemo } from 'react';
import { Factory, Store, Layers3, Network, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveTypeCode, type DistributorType } from '@/hooks/useDistributorTypes';
import type { TreeRow } from './buildDistributorTree';

/**
 * Every distributor of each tier, flat.
 *
 * The tree answers "what does this network look like"; this answers "show me
 * all the Super Stockists", which the tree cannot, because it groups by who
 * reports to whom rather than by what each one is. The old tabs did this and
 * the tree replaced them, so it comes back as the other half of the same pane
 * rather than as four cards above it.
 *
 * A row whose type cannot be worked out is given its own group at the end
 * instead of being filed under the first tier, which is how an untyped
 * distributor used to disappear into "Direct" and stay there unnoticed.
 */

const TYPE_ICONS: Record<string, typeof Store> = {
  OEM: Factory,
  DD: Store,
  SS: Layers3,
  USS: Network,
};

interface Props {
  rows: TreeRow[];
  types: DistributorType[];
  /** The tiers, in hierarchy order. */
  tiers: DistributorType[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  hiddenIds?: Set<string>;
}

export function DistributorTierList({
  rows, types, tiers, selectedId, onSelect, hiddenIds,
}: Props) {
  const groups = useMemo(() => {
    const byCode = new Map<string, TreeRow[]>();
    const untyped: TreeRow[] = [];

    for (const row of rows) {
      const code = resolveTypeCode(row, types);
      if (code && tiers.some((t) => t.code === code)) {
        const list = byCode.get(code);
        if (list) list.push(row);
        else byCode.set(code, [row]);
      } else {
        untyped.push(row);
      }
    }

    const byName = (a: TreeRow, b: TreeRow) => a.name.localeCompare(b.name);
    for (const list of byCode.values()) list.sort(byName);
    untyped.sort(byName);

    return { byCode, untyped };
  }, [rows, types, tiers]);

  const row = (r: TreeRow, Icon: typeof Store) => {
    const isSelected = selectedId === r.id;
    const faded = !!r.archived_at || hiddenIds?.has(r.id);

    return (
      <button
        key={r.id}
        type="button"
        onClick={() => onSelect(r.id)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors',
          isSelected ? 'border-primary/30 bg-primary/10' : 'border-transparent hover:bg-muted',
          faded && !isSelected && 'opacity-60',
        )}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={cn('min-w-0 flex-1 truncate text-sm', isSelected ? 'font-semibold' : 'font-medium')}>
          {r.name}
        </span>
        {r.archived_at && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Archived
          </span>
        )}
      </button>
    );
  };

  const section = (key: string, label: string, members: TreeRow[], Icon: typeof Store) => (
    <div key={key}>
      <div className="mb-1 flex items-center gap-2 px-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {members.length}
        </span>
      </div>
      {members.length === 0 ? (
        <p className="px-2.5 pb-1 text-xs text-muted-foreground">None.</p>
      ) : (
        <div className="space-y-0.5">{members.map((m) => row(m, Icon))}</div>
      )}
    </div>
  );

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No distributors match this filter.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {tiers.map((t) =>
        section(t.code, t.name, groups.byCode.get(t.code) ?? [], TYPE_ICONS[t.code] ?? Building2),
      )}
      {groups.untyped.length > 0 &&
        section('untyped', 'No tier set', groups.untyped, Building2)}
    </div>
  );
}
