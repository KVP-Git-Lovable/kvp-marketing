/**
 * One description of a table column, used by every part of the kit.
 *
 * The point of declaring columns once is that sorting, filtering, the Excel
 * sheet and the PDF all read the same definition. Before this, a table's
 * export was written by hand against the same data a second time, so a column
 * renamed in the UI kept its old heading in the spreadsheet, and a formatted
 * value on screen exported as a raw id.
 */
export type ColumnType = 'text' | 'number' | 'date' | 'enum' | 'boolean';

export interface TableColumn<T> {
  /** Stable key; also the filter's identity. */
  key: string;
  /** Heading shown on screen and written to the sheet. */
  header: string;
  /** Governs how the column sorts and which filter control it gets. */
  type?: ColumnType;
  /** The comparable value: a number, a Date, a string, a boolean, or null. */
  value: (row: T) => unknown;
  /** What a human should read. Defaults to String(value). */
  format?: (row: T) => string;
  sortable?: boolean;   // default true
  filterable?: boolean; // default true
  /** Kept out of the on-screen table but still exported. */
  exportOnly?: boolean;
  /** Right-align in the PDF; numbers and dates default to right. */
  align?: 'left' | 'right' | 'center';
}

export type SortDir = 'asc' | 'desc';
export interface SortState { key: string; dir: SortDir }

/** A column's active filter. Which fields apply depends on the column type. */
export interface ColumnFilter {
  /** enum/text: the chosen values. Empty or absent means no restriction. */
  values?: string[];
  /** text: a substring match. */
  contains?: string;
  /** number */
  min?: number | null;
  max?: number | null;
  /** date, as yyyy-mm-dd */
  from?: string | null;
  to?: string | null;
  /** boolean */
  is?: boolean | null;
}

export type FilterMap = Record<string, ColumnFilter>;

/** The text a column shows for a row, falling back to its raw value. */
export function cellText<T>(col: TableColumn<T>, row: T): string {
  if (col.format) return col.format(row);
  const v = col.value(row);
  if (v == null) return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

/** Whether a filter would actually exclude anything. */
export function filterIsActive(f?: ColumnFilter): boolean {
  if (!f) return false;
  return (
    (f.values != null && f.values.length > 0) ||
    !!f.contains ||
    f.min != null || f.max != null ||
    !!f.from || !!f.to ||
    f.is != null
  );
}
