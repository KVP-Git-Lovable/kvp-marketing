// Shared types for the Analytics → Report Builder (Report Configurator).
// Kept intentionally separate from the Copilot `saved_reports` table types.

export type FieldType = "text" | "number" | "date" | "boolean";

export interface ReportField {
  key: string;
  label: string;
  type: FieldType;
  /** Explains how the value is derived (shown in the builder). */
  hint?: string;
}

export type MeasureAgg =
  | "count"
  | "countDistinct"
  | "sum"
  | "sumDistinct"
  | "avg"
  | "min"
  | "max"
  | "ratio";

export interface MeasureCondition {
  field: string;
  op: "eq" | "neq" | "in" | "not_in";
  value: string | string[];
}

export interface ReportMeasure {
  key: string;
  label: string;
  agg: MeasureAgg;
  /** Row field the aggregate reads (not used by `count`). */
  field?: string;
  /** For `sumDistinct`: de-duplicate by this field before summing (join-safe). */
  distinctBy?: string;
  /** For `ratio`: numerator / denominator measure keys. */
  numerator?: string;
  denominator?: string;
  /** Only rows matching this condition contribute. */
  condition?: MeasureCondition;
  format?: "number" | "currency" | "date" | "integer";
  /** Plain-English definition of the aggregation grain. */
  hint: string;
}

export interface ReportObject {
  key: string;
  label: string;
  description: string;
  /** One row of the fetched dataset equals this. */
  grain: string;
  /** Default date field used by date filters / presets. */
  dateField: string;
  fields: ReportField[];
  measures: ReportMeasure[];
}

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "in"
  | "not_in"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "is_empty"
  | "is_not_empty"
  | "last_n_days"
  | "this_month"
  | "this_fy";

export interface ReportFilter {
  id: string;
  field: string;
  operator: FilterOperator;
  value?: string;
  value2?: string;
}

export type ChartType = "table" | "bar" | "line" | "pie" | "donut";

export interface ReportDisplayOptions {
  /** Max base rows pulled from the database (safety cap). */
  rowLimit?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  showTotals?: boolean;
}

export interface SavedReport {
  id?: string;
  name: string;
  description?: string | null;
  folder_id?: string | null;
  primary_object: string;
  related_object?: string | null;
  /** Dimension field keys shown in detail mode. */
  columns: string[];
  /** Dimension field keys to group by (rows). */
  group_rows: string[];
  /** Measure keys to aggregate. */
  group_columns: string[];
  filters: ReportFilter[];
  chart_type: ChartType;
  display_options?: ReportDisplayOptions | null;
  is_preset?: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReportRow {
  [key: string]: string | number | boolean | null;
}

export interface ReportResult {
  /** Column keys in display order. */
  columns: { key: string; label: string; type: FieldType; format?: string }[];
  rows: ReportRow[];
  totals: ReportRow | null;
  baseRowCount: number;
  truncated: boolean;
  grainLabel: string;
}
