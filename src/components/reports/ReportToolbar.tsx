import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart3,
  CircleDashed,
  Filter,
  LineChart,
  Pencil,
  PieChart,
  Pin,
  PinOff,
  Plus,
  Table2,
} from "lucide-react";
import { FilterRow } from "./FilterRow";
import type { ChartType, ReportFilter, ReportObject } from "@/lib/reportBuilder/types";

const LAYOUTS: { value: ChartType; label: string; Icon: typeof Table2 }[] = [
  { value: "table", label: "Table", Icon: Table2 },
  { value: "bar", label: "Bar chart", Icon: BarChart3 },
  { value: "pie", label: "Pie chart", Icon: PieChart },
  { value: "donut", label: "Donut chart", Icon: CircleDashed },
  { value: "line", label: "Line chart", Icon: LineChart },
];

interface Props {
  chartType: ChartType;
  onChartTypeChange: (t: ChartType) => void;
  object?: ReportObject;
  filters: ReportFilter[];
  onFiltersChange: (f: ReportFilter[]) => void;
  onApplyFilters: () => void;
  canEdit?: boolean;
  onEdit?: () => void;
  pinned?: boolean;
  onTogglePin?: () => void;
}

export const ReportToolbar = ({
  chartType,
  onChartTypeChange,
  object,
  filters,
  onFiltersChange,
  onApplyFilters,
  canEdit,
  onEdit,
  pinned,
  onTogglePin,
}: Props) => (
  <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-1.5">
    <div className="flex items-center gap-1">
      {LAYOUTS.map(({ value, label, Icon }) => (
        <Button
          key={value}
          type="button"
          size="icon"
          variant={chartType === value ? "default" : "ghost"}
          className="h-8 w-8"
          title={label}
          aria-label={label}
          onClick={() => onChartTypeChange(value)}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
    </div>

    <div className="ml-auto flex flex-wrap items-center gap-2">
      {object && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="mr-1 h-4 w-4" /> Filters
              {filters.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {filters.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(92vw,520px)] space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Filters</p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  onFiltersChange([
                    ...filters,
                    {
                      id: crypto.randomUUID(),
                      field: object.dateField,
                      operator: "last_n_days",
                      value: "30",
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-3 w-3" /> Add filter
              </Button>
            </div>
            {filters.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No filters — the report reads the most recent records up to its limit.
              </p>
            ) : (
              <div className="max-h-[45vh] space-y-2 overflow-y-auto">
                {filters.map((f) => (
                  <FilterRow
                    key={f.id}
                    filter={f}
                    object={object}
                    onChange={(next) => onFiltersChange(filters.map((x) => (x.id === f.id ? next : x)))}
                    onRemove={() => onFiltersChange(filters.filter((x) => x.id !== f.id))}
                  />
                ))}
              </div>
            )}
            <Button size="sm" className="w-full" onClick={onApplyFilters}>
              Apply filters
            </Button>
          </PopoverContent>
        </Popover>
      )}

      {canEdit && onEdit && (
        <Button variant="outline" size="sm" className="h-8" onClick={onEdit}>
          <Pencil className="mr-1 h-4 w-4" /> Edit
        </Button>
      )}

      {onTogglePin && (
        <Button variant="outline" size="sm" className="h-8" onClick={onTogglePin}>
          {pinned ? <PinOff className="mr-1 h-4 w-4" /> : <Pin className="mr-1 h-4 w-4" />}
          {pinned ? "Unpin" : "Pin"}
        </Button>
      )}
    </div>
  </div>
);
