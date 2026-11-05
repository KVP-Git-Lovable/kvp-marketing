import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Folder, LineChart, Pencil, PieChart, Pin, PinOff, Play, Table2, Trash2 } from "lucide-react";
import { format as formatDate } from "date-fns";
import { getObject } from "@/lib/reportBuilder/objects";
import type { SavedReport } from "@/lib/reportBuilder/types";

interface Props {
  reports: SavedReport[];
  folders: { id: string; name: string }[];
  pinnedIds: Set<string>;
  canEdit: boolean;
  onView: (r: SavedReport) => void;
  onEdit: (r: SavedReport) => void;
  onDelete: (r: SavedReport) => void;
  onTogglePin: (r: SavedReport) => void;
}

const layoutBadge = (type: string) => {
  switch (type) {
    case "bar":
      return { label: "Bar Chart", Icon: BarChart3 };
    case "line":
      return { label: "Line Chart", Icon: LineChart };
    case "pie":
      return { label: "Pie Chart", Icon: PieChart };
    case "donut":
      return { label: "Donut Chart", Icon: PieChart };
    default:
      return { label: "Tabular", Icon: Table2 };
  }
};

export const ReportList = ({
  reports,
  folders,
  pinnedIds,
  canEdit,
  onView,
  onEdit,
  onDelete,
  onTogglePin,
}: Props) => {
  if (reports.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/20 p-10 text-center">
        <p className="text-sm font-medium">No reports here yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {canEdit ? "Use “New Report” to build one." : "An admin can add reports for your team."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => {
        const { label, Icon } = layoutBadge(r.chart_type);
        const obj = getObject(r.primary_object);
        const folder = folders.find((f) => f.id === r.folder_id);
        const pinned = r.id ? pinnedIds.has(r.id) : false;
        return (
          <div
            key={r.id}
            className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold">{r.name}</h3>
                <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
                  <Icon className="h-3 w-3" /> {label}
                </Badge>
                {folder && (
                  <Badge variant="outline" className="gap-1 text-[11px] font-normal">
                    <Folder className="h-3 w-3" /> {folder.name}
                  </Badge>
                )}
                {r.is_preset && (
                  <Badge variant="outline" className="text-[11px] font-normal">
                    Preset
                  </Badge>
                )}
              </div>
              {r.description && <p className="truncate text-sm text-muted-foreground">{r.description}</p>}
              <p className="text-xs text-muted-foreground">
                Data: <span className="font-medium text-foreground">{obj?.label ?? r.primary_object}</span>
                {" • "}
                {r.group_rows.length > 0
                  ? `${r.group_rows.length} groups · ${r.group_columns.length} measures`
                  : `${r.columns.length} columns`}
                {r.filters?.length ? ` • ${r.filters.length} filters` : ""}
                {r.updated_at ? ` • Updated ${formatDate(new Date(r.updated_at), "dd MMM yyyy")}` : ""}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => onView(r)}>
                <Play className="mr-1 h-4 w-4" /> View
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={pinned ? "Unpin report" : "Pin report"}
                onClick={() => onTogglePin(r)}
              >
                {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </Button>
              {canEdit && (
                <>
                  <Button variant="ghost" size="icon" aria-label="Edit report" onClick={() => onEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete report"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
