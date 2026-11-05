import { useMemo } from 'react';
import { fullNameProps } from "@/lib/displayName";
import { ChevronDown, ChevronRight, Factory, Store, Layers3, Network, Building2, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type DistributorType } from '@/hooks/useDistributorTypes';
import { buildTree, type TreeRow, type TreeNode } from './buildDistributorTree';

/**
 * The distributor network, as the shape it actually is.
 *
 * This used to be a dialog behind a button while the page itself showed four
 * stat cards above four tabs carrying the same four numbers. The page is called
 * "manage your DMS network structure", so the structure is the page now.
 *
 * Laid out like the admin organisation tree — indentation, connector lines, a
 * chevron where there are children — so the two read the same way.
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
  selectedId: string | null;
  collapsed: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  /** Rows the viewer has hidden locally, drawn faint rather than removed. */
  hiddenIds?: Set<string>;
}

export function DistributorTree({
  rows,
  types,
  selectedId,
  collapsed,
  onSelect,
  onToggle,
  hiddenIds,
}: Props) {
  const { roots, orphans } = useMemo(() => buildTree(rows, types), [rows, types]);

  const renderNode = (node: TreeNode, depth: number) => {
    const isOpen = !collapsed.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedId === node.id;
    const Icon = (node.typeCode && TYPE_ICONS[node.typeCode]) || Building2;
    const typeName = types.find((t) => t.code === node.typeCode)?.name;
    const faded = !!node.archived_at || hiddenIds?.has(node.id);

    return (
      <div key={node.id} className="relative">
        {depth > 0 && (
          <>
            <div
              className="absolute top-0 bottom-0 border-l-2 border-border"
              style={{ left: `${(depth - 1) * 18 + 9}px` }}
            />
            <div
              className="absolute top-[18px] h-0.5 bg-border"
              style={{ left: `${(depth - 1) * 18 + 9}px`, width: '9px' }}
            />
          </>
        )}

        <button
          type="button"
          onClick={() => onSelect(node.id)}
          style={{ marginLeft: `${depth * 18}px` }}
          className={cn(
            'flex w-[calc(100%-var(--indent))] items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors',
            isSelected
              ? 'border-primary/30 bg-primary/10'
              : 'border-transparent hover:bg-muted',
            faded && !isSelected && 'opacity-60',
          )}
        >
          {hasChildren ? (
            <span
              role="presentation"
              onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
              className="-m-0.5 shrink-0 rounded p-0.5 hover:bg-muted-foreground/10"
            >
              {isOpen
                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </span>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}

          <Icon
            className={cn(
              'h-4 w-4 shrink-0',
              node.typeCode === 'OEM' ? 'text-primary' : 'text-muted-foreground',
            )}
          />

          <span
            className={cn('min-w-0 flex-1 truncate text-sm', isSelected ? 'font-semibold' : 'font-medium')}
            {...fullNameProps(node.name)}
          />

          {node.archived_at ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Archived
            </span>
          ) : (
            typeName && (
              <span className="shrink-0 text-[11px] text-muted-foreground">{typeName}</span>
            )
          )}
        </button>

        {isOpen && hasChildren && (
          <div className="relative">{node.children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  if (roots.length === 0 && orphans.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No distributors match this filter.
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {roots.map((r) => renderNode(r, 0))}

      {orphans.length > 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-warning/60 bg-warning/5 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-warning">
            <Unlink className="h-3.5 w-3.5" />
            Not linked to the company
          </p>
          <p className="mb-2 text-[11px] text-muted-foreground">
            No parent, or a parent outside this filter. Nothing that walks the network
            will reach them.
          </p>
          {orphans.map((o) => renderNode(o, 0))}
        </div>
      )}
    </div>
  );
}
