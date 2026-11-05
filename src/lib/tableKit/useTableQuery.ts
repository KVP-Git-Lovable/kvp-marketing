import { useMemo, useState, useCallback } from 'react';
import {
  type ColumnFilter, type FilterMap, type SortState, type TableColumn,
  cellText, filterIsActive,
} from './types';

/** A date from whatever the column handed back, or null if it is not one. */
function asDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? null : d;
}

function asNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Sorting, per-column filtering and a free-text search over rows already in
 * memory.
 *
 * Everything here works on the array it is given; nothing is re-fetched. That
 * suits these screens, which load their list once and then let the user pick
 * through it. A list long enough to need server-side paging should not use
 * this.
 */
/**
 * The whole of search, filter and sort as one pure function.
 *
 * Kept out of the hook so it can be exercised directly in tests: the rules
 * about which rows survive a filter and where blanks sort are the part worth
 * pinning down, and they do not need a React tree to check.
 */
export function applyTableQuery<T>(
  rows: T[],
  columns: TableColumn<T>[],
  q: { search?: string; filters?: FilterMap; sort?: SortState | null },
): T[] {
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const needle = (q.search ?? '').trim().toLowerCase();
  let out = rows;

  if (needle) {
    out = out.filter((r) =>
      columns.some((c) => cellText(c, r).toLowerCase().includes(needle)));
  }

  for (const [key, f] of Object.entries(q.filters ?? {})) {
    const col = byKey.get(key);
    if (!col || !filterIsActive(f)) continue;
    out = out.filter((r) => {
      const raw = col.value(r);
      const text = cellText(col, r);

      if (f.values && f.values.length > 0 && !f.values.includes(text.trim())) return false;
      if (f.contains && !text.toLowerCase().includes(f.contains.toLowerCase())) return false;

      if (f.min != null || f.max != null) {
        const n = asNumber(raw);
        if (n == null) return false;
        if (f.min != null && n < f.min) return false;
        if (f.max != null && n > f.max) return false;
      }

      if (f.from || f.to) {
        const d = asDate(raw);
        if (!d) return false;
        // Compared as plain dates: a row dated today must pass "to = today".
        const day = d.toISOString().slice(0, 10);
        if (f.from && day < f.from) return false;
        if (f.to && day > f.to) return false;
      }

      if (f.is != null && Boolean(raw) !== f.is) return false;
      return true;
    });
  }

  const sort = q.sort;
  if (sort) {
    const col = byKey.get(sort.key);
    if (col) {
      const dir = sort.dir === 'asc' ? 1 : -1;
      // Sorted on a copy: the caller's array is its own state elsewhere.
      out = [...out].sort((a, b) => {
        const av = col.value(a), bv = col.value(b);
        // Blanks sink to the bottom whichever way the column is sorted, so
        // "sort by date" does not open on a page of rows that have no date.
        const aEmpty = av == null || av === '';
        const bEmpty = bv == null || bv === '';
        if (aEmpty && bEmpty) return 0;
        if (aEmpty) return 1;
        if (bEmpty) return -1;

        switch (col.type) {
          case 'number':
            return ((asNumber(av) ?? 0) - (asNumber(bv) ?? 0)) * dir;
          case 'date': {
            const ad = asDate(av)?.getTime() ?? 0;
            const bd = asDate(bv)?.getTime() ?? 0;
            return (ad - bd) * dir;
          }
          case 'boolean':
            return ((av ? 1 : 0) - (bv ? 1 : 0)) * dir;
          default:
            return String(av).localeCompare(String(bv), undefined,
              { numeric: true, sensitivity: 'base' }) * dir;
        }
      });
    }
  }

  return out;
}

export function useTableQuery<T>(
  rows: T[],
  columns: TableColumn<T>[],
  opts: { initialSort?: SortState } = {},
) {
  const [sort, setSort] = useState<SortState | null>(opts.initialSort ?? null);
  const [filters, setFilters] = useState<FilterMap>({});
  const [search, setSearch] = useState('');

  const byKey = useMemo(
    () => new Map(columns.map((c) => [c.key, c])), [columns]);

  /** Click once for ascending, again for descending, a third time for none. */
  const toggleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }, []);

  const setFilter = useCallback((key: string, patch: ColumnFilter | null) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (patch == null || !filterIsActive(patch)) delete next[key];
      else next[key] = patch;
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => { setFilters({}); setSearch(''); }, []);

  /** The distinct values of a column, for the multi-select filters. */
  const optionsFor = useCallback((key: string): string[] => {
    const col = byKey.get(key);
    if (!col) return [];
    const seen = new Set<string>();
    rows.forEach((r) => {
      const t = cellText(col, r).trim();
      if (t) seen.add(t);
    });
    return Array.from(seen).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [rows, byKey]);

  const view = useMemo(
    () => applyTableQuery(rows, columns, { search, filters, sort }),
    [rows, columns, filters, search, sort]);

  const activeFilterCount =
    Object.values(filters).filter(filterIsActive).length + (search.trim() ? 1 : 0);

  return {
    view, sort, toggleSort, setSort,
    filters, setFilter, clearFilters, optionsFor,
    search, setSearch, activeFilterCount,
    total: rows.length, shown: view.length,
  };
}
