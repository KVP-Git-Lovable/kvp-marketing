import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import type { ReportFilter, ReportObject, FilterOperator } from "@/lib/reportBuilder/types";

const OPS: Record<string, { value: FilterOperator; label: string }[]> = {
  text: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
    { value: "contains", label: "contains" },
    { value: "in", label: "is any of" },
    { value: "not_in", label: "is none of" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
  number: [
    { value: "equals", label: "=" },
    { value: "not_equals", label: "≠" },
    { value: "gt", label: ">" },
    { value: "gte", label: "≥" },
    { value: "lt", label: "<" },
    { value: "lte", label: "≤" },
    { value: "between", label: "between" },
  ],
  date: [
    { value: "last_n_days", label: "in last N days" },
    { value: "this_month", label: "this month" },
    { value: "this_fy", label: "this financial year" },
    { value: "between", label: "between" },
    { value: "gte", label: "on or after" },
    { value: "lte", label: "on or before" },
  ],
  boolean: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
  ],
};

interface Props {
  filter: ReportFilter;
  object: ReportObject;
  onChange: (next: ReportFilter) => void;
  onRemove: () => void;
}

export const FilterRow = ({ filter, object, onChange, onRemove }: Props) => {
  const field = object.fields.find((f) => f.key === filter.field);
  const type = field?.type ?? "text";
  const ops = OPS[type] ?? OPS.text;
  const needsValue = !["is_empty", "is_not_empty", "this_month", "this_fy"].includes(filter.operator);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
      <Select
        value={filter.field}
        onValueChange={(v) => {
          const nextType = object.fields.find((f) => f.key === v)?.type ?? "text";
          const allowed = (OPS[nextType] ?? OPS.text)[0].value;
          onChange({ ...filter, field: v, operator: allowed, value: "", value2: "" });
        }}
      >
        <SelectTrigger className="h-8 w-[170px] text-xs">
          <SelectValue placeholder="Field" />
        </SelectTrigger>
        <SelectContent>
          {object.fields.map((f) => (
            <SelectItem key={f.key} value={f.key} className="text-xs">
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filter.operator}
        onValueChange={(v) => onChange({ ...filter, operator: v as FilterOperator })}
      >
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue placeholder="Condition" />
        </SelectTrigger>
        <SelectContent>
          {ops.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {needsValue && type === "boolean" && (
        <Select value={filter.value || "true"} onValueChange={(v) => onChange({ ...filter, value: v })}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true" className="text-xs">Yes</SelectItem>
            <SelectItem value="false" className="text-xs">No</SelectItem>
          </SelectContent>
        </Select>
      )}

      {needsValue && type !== "boolean" && (
        <Input
          className="h-8 w-[160px] text-xs"
          type={type === "date" && filter.operator !== "last_n_days" ? "date" : type === "number" ? "number" : "text"}
          placeholder={filter.operator === "in" || filter.operator === "not_in" ? "comma separated" : "value"}
          value={filter.value || ""}
          onChange={(e) => onChange({ ...filter, value: e.target.value })}
        />
      )}

      {filter.operator === "between" && (
        <Input
          className="h-8 w-[160px] text-xs"
          type={type === "date" ? "date" : "number"}
          value={filter.value2 || ""}
          onChange={(e) => onChange({ ...filter, value2: e.target.value })}
        />
      )}

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove} aria-label="Remove filter">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
