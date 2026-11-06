import { useEffect, useState } from "react";
import { databaseToSegmentType } from "@/lib/marketingSegments";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, X, Workflow } from "lucide-react";
import { toast } from "sonner";

export type DatabaseType = "institutional" | "distributor" | "event";

export interface FilterRow {
  field: "name" | "phone" | "email" | "website" | "state" | "country" | "lead_source";
  operator: "equals" | "not_equals" | "contains" | "is_any_of" | "is_empty" | "is_not_empty";
  value?: string | string[];
}

interface ListView {
  id: string;
  database_type: DatabaseType;
  name: string;
  filters: FilterRow[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Only used to pre-select Category when creating a new List View (e.g.
  // when exactly one Category filter chip is active on the unified Leads
  // list). Editing always uses the List View's own, locked database_type.
  initialDatabaseType?: DatabaseType;
  listView: ListView | null; // null = creating a new one
  // Pre-fills the filters when creating a new List View (e.g. from a
  // "Create List View from Selected States" action). Ignored when
  // editing an existing listView.
  initialFilters?: FilterRow[];
}

const CATEGORY_LABELS: Record<DatabaseType, string> = {
  institutional: "Institutional", distributor: "Distributor", event: "Event",
};

const FIELD_LABELS: Record<FilterRow["field"], string> = {
  name: "Name", phone: "Phone", email: "Email", website: "Website", state: "State", country: "Country",
  lead_source: "Source",
};
const OPERATOR_LABELS: Record<FilterRow["operator"], string> = {
  equals: "is", not_equals: "is not", contains: "contains", is_any_of: "is any of", is_empty: "is empty", is_not_empty: "is not empty",
};

async function invokeEdge(fn: string, payload: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(payload),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Request failed");
  return json;
}

export function MarketingListViewBuilder({ open, onOpenChange, initialDatabaseType, listView, initialFilters }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DatabaseType | "">("");
  const [filters, setFilters] = useState<FilterRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(listView?.name || "");
    setCategory(listView?.database_type || initialDatabaseType || "");
    setFilters(listView ? (listView.filters || []) : (initialFilters || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listView]);

  const previewQuery = useQuery({
    queryKey: ["marketing-list-view-preview", category, JSON.stringify(filters)],
    queryFn: () => invokeEdge("marketing-list-view-resolve", { database_type: category, filters, mode: "preview", limit: 5 }),
    enabled: open && !!category,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (listView) {
        return invokeEdge("marketing-list-views", { action: "update", id: listView.id, name, filters });
      }
      return invokeEdge("marketing-list-views", { action: "create", database_type: category, name, filters });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-list-views"] });
      toast.success(listView ? "List View updated" : "List View created");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFilter = () => setFilters((prev) => [...prev, { field: "state", operator: "equals", value: "" }]);
  const updateFilter = (idx: number, patch: Partial<FilterRow>) =>
    setFilters((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  const removeFilter = (idx: number) => setFilters((prev) => prev.filter((_, i) => i !== idx));

  const useInJourneyBuilder = () => {
    if (!listView) return;
    const segmentType = databaseToSegmentType(listView.database_type);
    navigate(`/communication?tab=journey-builder&new_segment_type=${segmentType}&new_list_view_id=${listView.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{listView ? "Edit List View" : "New List View"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Large Institutions — South India" />
          </div>

          <div>
            <Label>Category{listView && " (locked after creation)"}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as DatabaseType)} disabled={!!listView}>
              <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABELS) as DatabaseType[]).map((dt) => (
                  <SelectItem key={dt} value={dt}>{CATEGORY_LABELS[dt]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Filters</Label>
              <Button type="button" variant="outline" size="sm" onClick={addFilter}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add filter
              </Button>
            </div>
            {filters.length === 0 && (
              <p className="text-xs text-muted-foreground">No filters — this List View matches every contact in the database.</p>
            )}
            {filters.map((f, idx) => (
              <div key={idx} className="flex items-center gap-2 flex-wrap">
                <Select value={f.field} onValueChange={(v) => updateFilter(idx, { field: v as FilterRow["field"] })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FIELD_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={f.operator} onValueChange={(v) => updateFilter(idx, { operator: v as FilterRow["operator"] })}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(OPERATOR_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {f.operator === "is_any_of" ? (
                  <Input
                    className="flex-1 min-w-[160px]"
                    value={Array.isArray(f.value) ? f.value.join(", ") : (f.value || "")}
                    onChange={(e) => updateFilter(idx, { value: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    placeholder="Comma-separated values, e.g. Karnataka, Tamil Nadu"
                  />
                ) : f.operator !== "is_empty" && f.operator !== "is_not_empty" && (
                  <Input
                    className="flex-1 min-w-[120px]"
                    value={typeof f.value === "string" ? f.value : ""}
                    onChange={(e) => updateFilter(idx, { value: e.target.value })}
                    placeholder="Value"
                  />
                )}
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFilter(idx)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{previewQuery.data?.count ?? "—"}</span>
              <span className="text-xs text-muted-foreground">matching contacts</span>
            </div>
          </div>

          {(previewQuery.data?.rows?.length || 0) > 0 && (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewQuery.data.rows.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono text-xs">{r.phone}</TableCell>
                      <TableCell className="text-xs">{r.email || "—"}</TableCell>
                      <TableCell>{r.state || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground px-3 py-2">
                Showing first {previewQuery.data.rows.length} of {previewQuery.data.count} matching rows
              </p>
            </div>
          )}

          {listView && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs">This List View can be selected as a Journey's audience source.</p>
              <Button type="button" className="w-full" onClick={useInJourneyBuilder}>
                <Workflow className="h-4 w-4 mr-2" /> Use in Journey Builder
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || !category || saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : listView ? "Save Changes" : "Create List View"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
