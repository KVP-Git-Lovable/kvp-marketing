import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, ChevronDown, Loader2, Play, Plus, Save } from "lucide-react";
import { REPORT_OBJECTS, getObject } from "@/lib/reportBuilder/objects";
import { runReport, DEFAULT_ROW_LIMIT } from "@/lib/reportBuilder/engine";
import type { ChartType, ReportResult, SavedReport } from "@/lib/reportBuilder/types";
import { FilterRow } from "./FilterRow";
import { ReportResultTable } from "./ReportResultTable";
import { ReportChart } from "./ReportChart";

interface PickerOption {
  key: string;
  label: string;
  hint?: string;
}

const PickerDropdown = ({
  label,
  placeholder,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  placeholder: string;
  options: PickerOption[];
  selected: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
}) => {
  const summary =
    selected.length === 0
      ? placeholder
      : options
          .filter((o) => selected.includes(o.key))
          .map((o) => o.label)
          .join(", ");
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="mt-1 h-9 w-full justify-between font-normal">
            <span className={`truncate text-xs ${selected.length ? "" : "text-muted-foreground"}`}>
              {summary}
            </span>
            <span className="ml-1 flex shrink-0 items-center gap-1">
              {selected.length > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{selected.length}</Badge>}
              <ChevronDown className="h-4 w-4 opacity-60" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(92vw,300px)] p-2">
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="text-xs font-medium">{label}</p>
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={onClear} disabled={!selected.length}>
              Clear
            </Button>
          </div>
          <div className="max-h-[42vh] space-y-0.5 overflow-y-auto">
            {options.map((o) => (
              <label
                key={o.key}
                title={o.hint}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-xs hover:bg-muted"
              >
                <Checkbox checked={selected.includes(o.key)} onCheckedChange={() => onToggle(o.key)} />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

interface Folder {
  id: string;
  name: string;
}

interface Props {
  initial: SavedReport;
  folders: Folder[];
  saving: boolean;
  onCancel: () => void;
  onSave: (report: SavedReport) => void;
}

export const ReportBuilder = ({ initial, folders, saving, onCancel, onSave }: Props) => {
  const [draft, setDraft] = useState<SavedReport>(initial);
  const [preview, setPreview] = useState<ReportResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const object = getObject(draft.primary_object) ?? REPORT_OBJECTS[0];

  useEffect(() => {
    setDraft(initial);
    setPreview(null);
  }, [initial]);

  const patch = (p: Partial<SavedReport>) => setDraft((d) => ({ ...d, ...p }));

  const toggle = (list: string[], key: string) =>
    list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

  const switchObject = (key: string) =>
    setDraft((d) => ({
      ...d,
      primary_object: key,
      columns: [],
      group_rows: [],
      group_columns: [],
      filters: [],
    }));

  const runPreview = async () => {
    setPreviewing(true);
    setPreviewError(null);
    try {
      setPreview(await runReport(draft));
    } catch (e: any) {
      setPreviewError(e?.message || "Preview failed.");
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };

  const isSummary = draft.group_rows.length > 0 && draft.group_columns.length > 0;
  const canSave = draft.name.trim().length > 0 && (isSummary || draft.columns.length > 0);

  const measureHints = useMemo(
    () => object.measures.filter((m) => draft.group_columns.includes(m.key)),
    [object.measures, draft.group_columns]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="-ml-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> All reports
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runPreview} disabled={previewing}>
            {previewing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
            Preview
          </Button>
          <Button size="sm" onClick={() => onSave(draft)} disabled={!canSave || saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save report
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">1. Report details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Report name</Label>
              <Input
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Retailerwise order summary"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={draft.description || ""}
                onChange={(e) => patch({ description: e.target.value })}
                rows={2}
                placeholder="What does this report answer?"
              />
            </div>
            <div>
              <Label className="text-xs">Folder</Label>
              <Select
                value={draft.folder_id || "none"}
                onValueChange={(v) => patch({ folder_id: v === "none" ? null : v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unfiled</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Select value={draft.primary_object} onValueChange={switchObject}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_OBJECTS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {object.description} <span className="font-medium">({object.grain})</span>
              </p>
            </div>
            <div>
              <Label className="text-xs">Layout</Label>
              <Select value={draft.chart_type} onValueChange={(v) => patch({ chart_type: v as ChartType })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="table">Tabular</SelectItem>
                  <SelectItem value="bar">Bar chart</SelectItem>
                  <SelectItem value="line">Line chart</SelectItem>
                  <SelectItem value="pie">Pie chart</SelectItem>
                  <SelectItem value="donut">Donut chart</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Max records read</Label>
              <Input
                type="number"
                className="h-9"
                value={draft.display_options?.rowLimit ?? DEFAULT_ROW_LIMIT}
                onChange={(e) =>
                  patch({
                    display_options: {
                      ...(draft.display_options || {}),
                      rowLimit: Number(e.target.value) || DEFAULT_ROW_LIMIT,
                    },
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">2. Group and summarise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <PickerDropdown
                label="Group rows by"
                placeholder="Select fields"
                options={object.fields
                  .filter((f) => f.type !== "number")
                  .map((f) => ({ key: f.key, label: f.label }))}
                selected={draft.group_rows}
                onToggle={(k) => patch({ group_rows: toggle(draft.group_rows, k) })}
                onClear={() => patch({ group_rows: [] })}
              />
              <PickerDropdown
                label="Measures"
                placeholder="Select measures"
                options={object.measures.map((m) => ({ key: m.key, label: m.label, hint: m.hint }))}
                selected={draft.group_columns}
                onToggle={(k) => patch({ group_columns: toggle(draft.group_columns, k) })}
                onClear={() => patch({ group_columns: [] })}
              />
              <PickerDropdown
                label={isSummary ? "Detail columns (unused)" : "Detail columns"}
                placeholder="Select columns"
                options={object.fields.map((f) => ({ key: f.key, label: f.label }))}
                selected={draft.columns}
                onToggle={(k) => patch({ columns: toggle(draft.columns, k) })}
                onClear={() => patch({ columns: [] })}
              />
            </div>

            {measureHints.length > 0 && (
              <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                {measureHints.map((m) => (
                  <li key={m.key}>
                    <span className="font-medium">{m.label}:</span> {m.hint}
                  </li>
                ))}
              </ul>
            )}

            <div>
              <Label className="text-xs">Filters</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="mt-1 h-9 w-full justify-between font-normal">
                    <span className="truncate text-xs">
                      {draft.filters.length === 0
                        ? "No filters — reads the most recent records"
                        : `${draft.filters.length} filter${draft.filters.length > 1 ? "s" : ""} applied`}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[min(92vw,540px)] space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">Filters</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        patch({
                          filters: [
                            ...draft.filters,
                            {
                              id: crypto.randomUUID(),
                              field: object.dateField,
                              operator: "last_n_days",
                              value: "30",
                            },
                          ],
                        })
                      }
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add filter
                    </Button>
                  </div>
                  {draft.filters.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      No filters — the report reads the most recent records up to the limit.
                    </p>
                  ) : (
                    <div className="max-h-[45vh] space-y-2 overflow-y-auto">
                      {draft.filters.map((f) => (
                        <FilterRow
                          key={f.id}
                          filter={f}
                          object={object}
                          onChange={(next) =>
                            patch({ filters: draft.filters.map((x) => (x.id === f.id ? next : x)) })
                          }
                          onRemove={() => patch({ filters: draft.filters.filter((x) => x.id !== f.id) })}
                        />
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            3. Preview
            {preview && <Badge variant="secondary">{preview.rows.length} rows</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {previewError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
              {previewError}
            </div>
          )}
          {!preview && !previewError && (
            <p className="text-xs text-muted-foreground">Run a preview to check the numbers before saving.</p>
          )}
          {preview && (
            <>
              {draft.chart_type !== "table" && <ReportChart result={preview} chartType={draft.chart_type} />}
              <ReportResultTable result={preview} maxHeight="40vh" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
