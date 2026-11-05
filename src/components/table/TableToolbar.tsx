import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, Filter, Download, X, FileSpreadsheet, FileText, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type ColumnFilter, type FilterMap, type TableColumn, filterIsActive,
  exportTableToExcel, exportTableToPdf,
} from '@/lib/tableKit';

/**
 * Search, per-column filters and the two exports, for any table built on the
 * table kit.
 *
 * The exports deliberately take the rows the table is showing rather than the
 * full set: having narrowed a list to what they care about, nobody expects the
 * download to hand back everything again.
 */
export function TableToolbar<T>({
  columns, rows, search, onSearch, filters, onFilter, onClearFilters,
  activeFilterCount, total, shown, exportName, exportTitle, children, className,
  showSearch = true,
}: {
  columns: TableColumn<T>[];
  /** The filtered, sorted rows — what gets exported. */
  rows: T[];
  search: string;
  onSearch: (v: string) => void;
  filters: FilterMap;
  onFilter: (key: string, patch: ColumnFilter | null) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
  total: number;
  shown: number;
  exportName: string;
  exportTitle?: string;
  /** Extra controls, placed before the filter and export buttons. */
  children?: React.ReactNode;
  className?: string;
  /** Off where the page already has its own search box. */
  showSearch?: boolean;
}) {
  const filterable = columns.filter((c) => c.filterable !== false);

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
      {showSearch && (
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {children}

      <div className="flex items-center gap-2 shrink-0">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-10 gap-2">
              <Filter className="h-4 w-4" />
              Filter
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 tabular-nums">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium">Filter by column</span>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                disabled={activeFilterCount === 0} onClick={onClearFilters}>
                Clear all
              </Button>
            </div>
            <ScrollArea className="max-h-[22rem]">
              <div className="divide-y">
                {filterable.map((col) => (
                  <ColumnFilterRow
                    key={col.key}
                    column={col}
                    rows={rows}
                    filter={filters[col.key]}
                    onChange={(patch) => onFilter(col.key, patch)}
                  />
                ))}
              </div>
            </ScrollArea>
            <div className="border-t px-3 py-2 text-xs text-muted-foreground tabular-nums">
              Showing {shown} of {total}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 gap-2">
              <Download className="h-4 w-4" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => exportTableToExcel(columns, rows, exportName, exportTitle)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => exportTableToPdf(columns, rows, exportName,
                { title: exportTitle ?? exportName,
                  subtitle: activeFilterCount > 0 ? 'Filtered view' : undefined })}>
              <FileText className="h-4 w-4 mr-2" />
              PDF (.pdf)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {activeFilterCount > 0 && (
          <Button variant="ghost" className="h-10 gap-1.5" onClick={onClearFilters}>
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}

/** The control a column gets depends on what kind of value it holds. */
function ColumnFilterRow<T>({
  column, rows, filter, onChange,
}: {
  column: TableColumn<T>;
  rows: T[];
  filter?: ColumnFilter;
  onChange: (patch: ColumnFilter | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = filterIsActive(filter);
  const type = column.type ?? 'text';

  return (
    <div className="px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className={cn('text-sm', active ? 'font-medium' : 'text-muted-foreground')}>
          {column.header}
        </span>
        {active && <Check className="h-3.5 w-3.5 text-primary" />}
        <span className="ml-auto text-[11px] text-muted-foreground">{type}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {(type === 'number') && (
            <div className="flex items-center gap-2">
              <Input type="number" placeholder="Min" className="h-8"
                value={filter?.min ?? ''}
                onChange={(e) => onChange({ ...filter,
                  min: e.target.value === '' ? null : Number(e.target.value) })} />
              <Input type="number" placeholder="Max" className="h-8"
                value={filter?.max ?? ''}
                onChange={(e) => onChange({ ...filter,
                  max: e.target.value === '' ? null : Number(e.target.value) })} />
            </div>
          )}

          {type === 'date' && (
            <div className="flex items-center gap-2">
              <Input type="date" className="h-8 min-w-0" value={filter?.from ?? ''}
                onChange={(e) => onChange({ ...filter, from: e.target.value || null })} />
              <Input type="date" className="h-8 min-w-0" value={filter?.to ?? ''}
                onChange={(e) => onChange({ ...filter, to: e.target.value || null })} />
            </div>
          )}

          {type === 'boolean' && (
            <div className="flex items-center gap-2">
              {[['Any', null], ['Yes', true], ['No', false]].map(([label, v]) => (
                <Button key={String(label)} size="sm" className="h-7 px-2 text-xs"
                  variant={(filter?.is ?? null) === v ? 'default' : 'outline'}
                  onClick={() => onChange(v === null ? null : { ...filter, is: v as boolean })}>
                  {label as string}
                </Button>
              ))}
            </div>
          )}

          {(type === 'text' || type === 'enum') && (
            <ValuePicker column={column} rows={rows} filter={filter} onChange={onChange} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The distinct values in this column, ticked on or off.
 *
 * Computed from the rows passed in -- which are the rows currently in view --
 * so the options a user is offered are ones that will actually match.
 */
function ValuePicker<T>({
  column, rows, filter, onChange,
}: {
  column: TableColumn<T>;
  rows: T[];
  filter?: ColumnFilter;
  onChange: (patch: ColumnFilter | null) => void;
}) {
  const [q, setQ] = useState('');
  const chosen = new Set(filter?.values ?? []);

  const options = Array.from(new Set(
    rows.map((r) => (column.format ? column.format(r) : String(column.value(r) ?? '')).trim())
        .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  // A column of mostly-unique text (a name, a code) is unusable as a tick
  // list, so it gets a contains box instead.
  if (options.length > 30) {
    return (
      <Input className="h-8" placeholder={`Contains…`} value={filter?.contains ?? ''}
        onChange={(e) => onChange({ ...filter, contains: e.target.value || undefined })} />
    );
  }

  const shown = q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options;

  return (
    <div className="space-y-1.5">
      {options.length > 8 && (
        <Input className="h-7 text-xs" placeholder="Find a value…"
          value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      <div className="max-h-40 overflow-y-auto rounded border divide-y">
        {shown.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No values</p>
        )}
        {shown.map((o) => (
          <label key={o} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/50">
            <Checkbox
              checked={chosen.has(o)}
              onCheckedChange={(v) => {
                const next = new Set(chosen);
                if (v === true) next.add(o); else next.delete(o);
                onChange(next.size ? { ...filter, values: Array.from(next) }
                                   : { ...filter, values: [] });
              }}
            />
            <span className="text-xs truncate">{o}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default TableToolbar;
