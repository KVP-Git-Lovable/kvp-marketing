import { describe, it, expect } from 'vitest';
import { applyTableQuery } from './useTableQuery';
import type { TableColumn } from './types';

interface Book {
  name: string; type: string; products: number;
  from: string | null; active: boolean;
}

const rows: Book[] = [
  { name: 'Alpha',  type: 'Primary',   products: 45,  from: '2026-03-01', active: true },
  { name: 'beta',   type: 'Secondary', products: 106, from: null,         active: false },
  { name: 'Gamma',  type: 'Primary',   products: 0,   from: '2026-07-28', active: true },
  { name: 'Delta',  type: 'Secondary', products: 9,   from: '2025-12-31', active: true },
];

const columns: TableColumn<Book>[] = [
  { key: 'name', header: 'Price book', type: 'text', value: (b) => b.name },
  { key: 'type', header: 'Type', type: 'enum', value: (b) => b.type },
  { key: 'products', header: 'Products', type: 'number', value: (b) => b.products },
  { key: 'from', header: 'Effective', type: 'date', value: (b) => b.from },
  { key: 'active', header: 'Status', type: 'boolean', value: (b) => b.active },
];

const names = (r: Book[]) => r.map((b) => b.name);

describe('applyTableQuery', () => {
  it('returns everything when nothing is asked of it', () => {
    expect(applyTableQuery(rows, columns, {})).toHaveLength(4);
  });

  it('searches every column, ignoring case', () => {
    expect(names(applyTableQuery(rows, columns, { search: 'BETA' }))).toEqual(['beta']);
    expect(names(applyTableQuery(rows, columns, { search: 'secondary' })))
      .toEqual(['beta', 'Delta']);
  });

  it('sorts text case-insensitively, so lowercase names do not sink', () => {
    expect(names(applyTableQuery(rows, columns, { sort: { key: 'name', dir: 'asc' } })))
      .toEqual(['Alpha', 'beta', 'Delta', 'Gamma']);
  });

  it('sorts numbers numerically, not as strings', () => {
    expect(names(applyTableQuery(rows, columns, { sort: { key: 'products', dir: 'desc' } })))
      .toEqual(['beta', 'Alpha', 'Delta', 'Gamma']);
  });

  it('keeps blanks last whichever way a column is sorted', () => {
    const asc = applyTableQuery(rows, columns, { sort: { key: 'from', dir: 'asc' } });
    const desc = applyTableQuery(rows, columns, { sort: { key: 'from', dir: 'desc' } });
    expect(asc[asc.length - 1].name).toBe('beta');
    expect(desc[desc.length - 1].name).toBe('beta');
  });

  it('filters an enum column to the ticked values', () => {
    expect(names(applyTableQuery(rows, columns, {
      filters: { type: { values: ['Primary'] } },
    }))).toEqual(['Alpha', 'Gamma']);
  });

  it('treats a number range as inclusive at both ends', () => {
    expect(names(applyTableQuery(rows, columns, {
      filters: { products: { min: 0, max: 45 } },
    }))).toEqual(['Alpha', 'Gamma', 'Delta']);
  });

  it('includes a row dated exactly on the "to" boundary', () => {
    expect(names(applyTableQuery(rows, columns, {
      filters: { from: { from: '2026-03-01', to: '2026-07-28' } },
    }))).toEqual(['Alpha', 'Gamma']);
  });

  it('drops rows with no date when a date range is set', () => {
    const out = applyTableQuery(rows, columns, { filters: { from: { from: '2000-01-01' } } });
    expect(names(out)).not.toContain('beta');
  });

  it('filters a boolean column', () => {
    expect(names(applyTableQuery(rows, columns, { filters: { active: { is: false } } })))
      .toEqual(['beta']);
  });

  it('combines search, filter and sort', () => {
    expect(names(applyTableQuery(rows, columns, {
      search: 'a',
      filters: { active: { is: true } },
      sort: { key: 'products', dir: 'asc' },
    }))).toEqual(['Gamma', 'Delta', 'Alpha']);
  });

  it('ignores a filter that restricts nothing', () => {
    expect(applyTableQuery(rows, columns, { filters: { type: { values: [] } } }))
      .toHaveLength(4);
  });

  it('does not reorder the array it was given', () => {
    const before = names(rows);
    applyTableQuery(rows, columns, { sort: { key: 'name', dir: 'desc' } });
    expect(names(rows)).toEqual(before);
  });
});
