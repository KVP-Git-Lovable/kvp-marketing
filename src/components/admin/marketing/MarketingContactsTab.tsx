import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, Search, Plus, Pencil, Download, Filter, ListFilter, List, LayoutGrid, ChevronRight, Workflow } from "lucide-react";
import { toast } from "sonner";
import { MarketingListViewBuilder, type DatabaseType, type FilterRow } from "./MarketingListViewBuilder";
import { LeadDetailPanel } from "./LeadDetailPanel";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "in_discussion", label: "In Discussion" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not Interested" },
  { value: "wrong_data", label: "Wrong Data" },
] as const;

const STATUS_META: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-muted text-muted-foreground" },
  in_discussion: { label: "In Discussion", className: "bg-blue-100 text-blue-700" },
  interested: { label: "Interested", className: "bg-green-100 text-green-700" },
  not_interested: { label: "Not Interested", className: "bg-red-100 text-red-700" },
  wrong_data: { label: "Wrong Data", className: "bg-amber-100 text-amber-700" },
  converted: { label: "Converted", className: "bg-emerald-100 text-emerald-700" },
};
const STATUS_FILTER_VALUES = Object.keys(STATUS_META);

const SOURCE_OPTIONS = [
  { value: "direct", label: "Direct" },
  { value: "external", label: "External" },
  { value: "purchased", label: "Purchased" },
] as const;
const SOURCE_META: Record<string, { label: string; className: string }> = {
  direct: { label: "Direct", className: "bg-sky-100 text-sky-700" },
  external: { label: "External", className: "bg-violet-100 text-violet-700" },
  purchased: { label: "Purchased", className: "bg-pink-100 text-pink-700" },
};
const SOURCE_FILTER_VALUES = Object.keys(SOURCE_META);

const CATEGORY_META: Record<DatabaseType, { label: string; className: string }> = {
  institutional: { label: "Institutional", className: "bg-indigo-100 text-indigo-700" },
  distributor: { label: "Distributor", className: "bg-teal-100 text-teal-700" },
  event: { label: "Event", className: "bg-amber-100 text-amber-700" },
};
const CATEGORY_FILTER_VALUES = Object.keys(CATEGORY_META) as DatabaseType[];

const BOARD_COLUMNS = [
  { status: "new", label: "New" },
  { status: "in_discussion", label: "In Discussion" },
  { status: "interested", label: "Interested" },
  { status: "converted", label: "Converted" },
] as const;

type FilterField = "state" | "country" | "status" | "source";
const FILTER_FIELD_LABELS: Record<FilterField, string> = { state: "State", country: "Country", status: "Status", source: "Source" };

interface ImportResult {
  processed: number;
  inserted: number;
  skipped: number;
  errors?: string[];
}

const CHUNK_SIZE = 1000;

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

export function MarketingContactsTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [processedRecords, setProcessedRecords] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [activeFilterField, setActiveFilterField] = useState<FilterField>("state");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingListView, setEditingListView] = useState<any | null>(null);
  const [prefillFilters, setPrefillFilters] = useState<FilterRow[] | undefined>(undefined);
  const [activeListViewId, setActiveListViewId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const emptyNewLead = {
    database_type: "" as DatabaseType | "",
    name: "", first_name: "", last_name: "", phone: "", email: "", website: "",
    lead_source: "" as string, status: "new" as string,
    state: "", country: "", address: "", city: "", pincode: "", business_details: "",
  };
  const [newLead, setNewLead] = useState(emptyNewLead);

  const statsQuery = useQuery({
    queryKey: ["marketing-contacts-stats"],
    queryFn: async () => {
      const { count: total } = await supabase.from("marketing_contacts").select("id", { count: "exact", head: true });
      const { count: withPhone } = await supabase.from("marketing_contacts").select("id", { count: "exact", head: true }).not("phone", "is", null);
      const { count: withEmail } = await supabase.from("marketing_contacts").select("id", { count: "exact", head: true }).not("email", "is", null);
      const { data: latest } = await supabase.from("marketing_contacts").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return { total: total || 0, withPhone: withPhone || 0, withEmail: withEmail || 0, lastUpload: latest?.created_at || null };
    },
  });

  const statesQuery = useQuery({
    queryKey: ["marketing-contacts-states"],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_contacts").select("state").not("state", "is", null);
      if (error) throw error;
      return Array.from(new Set((data || []).map((r) => r.state).filter(Boolean) as string[])).sort();
    },
  });

  const countriesQuery = useQuery({
    queryKey: ["marketing-contacts-countries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_contacts").select("country").not("country", "is", null);
      if (error) throw error;
      return Array.from(new Set((data || []).map((r) => r.country).filter(Boolean) as string[])).sort();
    },
  });

  const listViewsQuery = useQuery({
    queryKey: ["marketing-list-views"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_contact_list_views").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const activeListView = (listViewsQuery.data || []).find((lv: any) => lv.id === activeListViewId) || null;

  const browserQuery = useQuery({
    queryKey: ["marketing-contacts-browser", search, selectedCategories.join(","), selectedStates.join(","), selectedCountries.join(","), selectedStatuses.join(","), selectedSources.join(","), activeListViewId],
    queryFn: async () => {
      if (activeListViewId) {
        const result = await invokeEdge("marketing-list-view-resolve", { list_view_id: activeListViewId, mode: "preview", limit: 25 });
        return { rows: result.rows as any[], total: result.count as number };
      }
      let query = supabase
        .from("marketing_contacts")
        .select("id, name, phone, email, website, state, country, status, lead_source, database_type", { count: "exact" });
      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
      if (selectedCategories.length > 0) query = query.in("database_type", selectedCategories);
      if (selectedStates.length > 0) query = query.in("state", selectedStates);
      if (selectedCountries.length > 0) query = query.in("country", selectedCountries);
      if (selectedStatuses.length > 0) query = query.in("status", selectedStatuses);
      if (selectedSources.length > 0) query = query.in("lead_source", selectedSources);
      const { data, error, count } = await query.order("name").limit(25);
      if (error) throw error;
      return { rows: data || [], total: count || 0 };
    },
  });

  const boardQuery = useQuery({
    queryKey: ["marketing-contacts-board", selectedCategories.join(","), selectedSources.join(","), activeListViewId],
    enabled: viewMode === "board",
    queryFn: async () => {
      if (activeListViewId) {
        const result = await invokeEdge("marketing-list-view-resolve", { list_view_id: activeListViewId, mode: "preview", limit: 500 });
        return result.rows as any[];
      }
      let query = supabase.from("marketing_contacts").select("id, name, phone, status, lead_source, database_type").limit(500);
      if (selectedCategories.length > 0) query = query.in("database_type", selectedCategories);
      if (selectedSources.length > 0) query = query.in("lead_source", selectedSources);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const boardGroups = useMemo(() => {
    const rows = boardQuery.data || [];
    const groups: Record<string, any[]> = { new: [], in_discussion: [], interested: [], converted: [] };
    let disqualifiedCount = 0;
    for (const r of rows) {
      if (r.status === "not_interested" || r.status === "wrong_data") { disqualifiedCount++; continue; }
      (groups[r.status] ||= []).push(r);
    }
    return { groups, disqualifiedCount };
  }, [boardQuery.data]);

  useEffect(() => {
    setSelectedRowIds(new Set());
  }, [search, selectedCategories, selectedStates, selectedCountries, selectedStatuses, selectedSources, activeListViewId]);

  const invalidateLeads = () => {
    queryClient.invalidateQueries({ queryKey: ["marketing-contacts-browser"] });
    queryClient.invalidateQueries({ queryKey: ["marketing-contacts-board"] });
    queryClient.invalidateQueries({ queryKey: ["marketing-contacts-stats"] });
  };

  const createLeadMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const nullIfEmpty = (v: string) => (v.trim() ? v.trim() : null);
      const { data: inserted, error } = await supabase.from("marketing_contacts").insert({
        database_type: newLead.database_type,
        name: newLead.name.trim(),
        first_name: nullIfEmpty(newLead.first_name),
        last_name: nullIfEmpty(newLead.last_name),
        phone: nullIfEmpty(newLead.phone),
        email: nullIfEmpty(newLead.email),
        website: nullIfEmpty(newLead.website),
        lead_source: newLead.lead_source || null,
        status: newLead.status || "new",
        state: nullIfEmpty(newLead.state),
        country: nullIfEmpty(newLead.country),
        address: nullIfEmpty(newLead.address),
        city: nullIfEmpty(newLead.city),
        pincode: nullIfEmpty(newLead.pincode),
        business_details: nullIfEmpty(newLead.business_details),
        uploaded_by: user?.id,
      }).select().single();
      if (error) throw error;
      await supabase.from("marketing_leads_activity_log").insert({
        contact_id: inserted.id, type: "imported", body: "Lead created manually",
      });
      return inserted;
    },
    onSuccess: () => {
      invalidateLeads();
      setCreateOpen(false);
      setNewLead(emptyNewLead);
      toast.success("Lead created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleStatusChange = async (contactId: string, newStatus: string, oldStatus?: string) => {
    const { error } = await supabase.from("marketing_contacts").update({ status: newStatus }).eq("id", contactId);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (oldStatus && oldStatus !== newStatus) {
      const oldLabel = STATUS_META[oldStatus]?.label || oldStatus;
      const newLabel = STATUS_META[newStatus]?.label || newStatus;
      await supabase.from("marketing_leads_activity_log").insert({
        contact_id: contactId, type: "status_change", body: `Status changed ${oldLabel} → ${newLabel}`,
        meta: { from: oldStatus, to: newStatus },
      });
    }
    invalidateLeads();
    queryClient.invalidateQueries({ queryKey: ["marketing-lead-activity", contactId] });
  };

  const handleSourceChange = async (contactId: string, newSource: string) => {
    const { error } = await supabase.from("marketing_contacts").update({ lead_source: newSource || null }).eq("id", contactId);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidateLeads();
  };

  const toggleCategory = (category: string) =>
    setSelectedCategories((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));
  const toggleState = (state: string) =>
    setSelectedStates((prev) => (prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]));
  const toggleCountry = (country: string) =>
    setSelectedCountries((prev) => (prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]));
  const toggleStatus = (status: string) =>
    setSelectedStatuses((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  const toggleSource = (source: string) =>
    setSelectedSources((prev) => (prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]));

  const totalFilterCount = selectedCategories.length + selectedStates.length + selectedCountries.length + selectedStatuses.length + selectedSources.length;
  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedStates([]);
    setSelectedCountries([]);
    setSelectedStatuses([]);
    setSelectedSources([]);
  };

  // List Views support state/country/source as audience-segment fields (status
  // is a page-local lead tracker, not something Journey Builder resolves on).
  // A List View still belongs to exactly one Category — pre-fill it only when
  // exactly one Category chip is active; otherwise the builder asks for it.
  const createListViewFromFilters = () => {
    setEditingListView(null);
    const prefill: FilterRow[] = [];
    if (selectedStates.length > 0) prefill.push({ field: "state", operator: "is_any_of", value: selectedStates });
    if (selectedCountries.length > 0) prefill.push({ field: "country", operator: "is_any_of", value: selectedCountries });
    if (selectedSources.length > 0) prefill.push({ field: "lead_source", operator: "is_any_of", value: selectedSources });
    setPrefillFilters(prefill);
    setBuilderOpen(true);
  };

  const rows: any[] = browserQuery.data?.rows || [];
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selectedRowIds.has(r.id));
  const toggleSelectAll = () => {
    setSelectedRowIds((prev) => {
      if (allVisibleSelected) return new Set();
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.id));
      return next;
    });
  };
  const toggleRowSelected = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exportRows = async (exportList: any[], suffix: string) => {
    if (exportList.length === 0) {
      toast.info("No leads to export");
      return;
    }
    const XLSX = await import("xlsx");
    const data = exportList.map((r) => ({
      Name: r.name, Category: r.database_type ? (CATEGORY_META[r.database_type as DatabaseType]?.label || r.database_type) : "",
      Phone: r.phone || "", Email: r.email || "", Website: r.website || "",
      State: r.state || "", Country: r.country || "",
      Status: STATUS_META[r.status]?.label || r.status,
      Source: r.lead_source ? (SOURCE_META[r.lead_source]?.label || r.lead_source) : "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, `leads-${suffix}.xlsx`);
  };

  const bulkChangeStatus = async (newStatus: string) => {
    const selected = rows.filter((r) => selectedRowIds.has(r.id));
    if (selected.length === 0) return;
    const ids = selected.map((r) => r.id);
    const { error } = await supabase.from("marketing_contacts").update({ status: newStatus }).in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    const logs = selected
      .filter((r) => r.status !== newStatus)
      .map((r) => ({
        contact_id: r.id, type: "status_change",
        body: `Status changed ${STATUS_META[r.status]?.label || r.status} → ${STATUS_META[newStatus]?.label || newStatus}`,
        meta: { from: r.status, to: newStatus },
      }));
    if (logs.length) await supabase.from("marketing_leads_activity_log").insert(logs);
    toast.success(`Updated status for ${ids.length} lead${ids.length === 1 ? "" : "s"}`);
    setSelectedRowIds(new Set());
    invalidateLeads();
  };

  const bulkAddToListView = async (listViewId: string, listViewName: string) => {
    const ids = Array.from(selectedRowIds);
    if (ids.length === 0) return;
    const members = ids.map((id) => ({ list_view_id: listViewId, contact_id: id }));
    const { error } = await supabase
      .from("marketing_contact_list_view_members")
      .upsert(members, { onConflict: "list_view_id,contact_id", ignoreDuplicates: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    const logs = ids.map((id) => ({ contact_id: id, type: "list_view_added", body: `Added to List View "${listViewName}"` }));
    await supabase.from("marketing_leads_activity_log").insert(logs);
    toast.success(`Added ${ids.length} lead${ids.length === 1 ? "" : "s"} to "${listViewName}"`);
    setSelectedRowIds(new Set());
  };

  const handleConvertActiveListView = () => {
    if (!activeListView || activeListView.database_type === "event") return;
    const segmentType = activeListView.database_type === "institutional" ? "marketing_institutional" : "marketing_distributor";
    navigate(`/communication?tab=journey-builder&new_segment_type=${segmentType}&new_list_view_id=${activeListViewId}`);
  };

  const handleCardDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
  };
  const handleColumnDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const card = (boardQuery.data || []).find((r: any) => r.id === id);
    if (card && card.status !== newStatus) handleStatusChange(id, newStatus, card.status);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportResult(null);
    setProgress(0);
    setProcessedRecords(0);
    setStatusMessage("Reading file...");
    setIsImporting(true);

    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

      setTotalRecords(jsonData.length);
      setStatusMessage(`Found ${jsonData.length.toLocaleString()} records. Starting import...`);

      let totalInserted = 0;
      let totalSkipped = 0;
      const allErrors: string[] = [];

      for (let i = 0; i < jsonData.length; i += CHUNK_SIZE) {
        const chunk = jsonData.slice(i, i + CHUNK_SIZE);
        setStatusMessage(`Uploading batch ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(jsonData.length / CHUNK_SIZE)}...`);

        const { data: result, error } = await supabase.functions.invoke("import-marketing-contacts", {
          body: { records: chunk },
        });

        if (error) {
          allErrors.push(`Batch ${Math.floor(i / CHUNK_SIZE) + 1}: ${error.message}`);
        } else if (result) {
          totalInserted += result.inserted || 0;
          totalSkipped += result.skipped || 0;
          if (result.errors) allErrors.push(...result.errors);
        }

        const processed = Math.min(i + CHUNK_SIZE, jsonData.length);
        setProcessedRecords(processed);
        setProgress((processed / jsonData.length) * 100);
      }

      setImportResult({ processed: jsonData.length, inserted: totalInserted, skipped: totalSkipped, errors: allErrors.length ? allErrors : undefined });
      setStatusMessage("Import completed!");
      toast.success(`Imported ${totalInserted.toLocaleString()} of ${jsonData.length.toLocaleString()} records.`);
      invalidateLeads();
      queryClient.invalidateQueries({ queryKey: ["marketing-contacts-states"] });
      queryClient.invalidateQueries({ queryKey: ["marketing-contacts-countries"] });
    } catch (error) {
      setStatusMessage("Import failed");
      toast.error(error instanceof Error ? error.message : "Failed to process file");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownloadSample = async () => {
    const XLSX = await import("xlsx");
    const headers = [
      "Name", "Category", "Phone", "Address", "City", "PIN", "State", "Country",
      "Email", "Website", "First Name", "Last Name", "Business Details",
    ];
    const exampleRow = {
      Name: "Acme Traders", Category: "Distributor", Phone: "+919876543210", Address: "123 MG Road", City: "Bengaluru", PIN: "560001",
      State: "Karnataka", Country: "India", Email: "contact@acmetraders.com", Website: "www.acmetraders.com",
      "First Name": "Raj", "Last Name": "Mehta", "Business Details": "Wholesale FMCG distributor",
    };
    const worksheet = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sample");
    XLSX.writeFile(workbook, "leads-contacts-sample.xlsx");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => { setActiveListViewId(null); setSelectedCategories([]); }}
              className={`shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                !activeListViewId && selectedCategories.length === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-transparent hover:border-border"
              }`}
            >
              All Leads · {statsQuery.data?.total ?? 0}
            </button>
            {CATEGORY_FILTER_VALUES.map((cat) => {
              const active = !activeListViewId && selectedCategories.length === 1 && selectedCategories[0] === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setActiveListViewId(null); setSelectedCategories(active ? [] : [cat]); }}
                  className={`shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${CATEGORY_META[cat].className} ${
                    active ? "ring-2 ring-offset-1 ring-primary border-transparent" : "border-transparent opacity-80 hover:opacity-100"
                  }`}
                >
                  {CATEGORY_META[cat].label}
                </button>
              );
            })}
            <div className="h-5 w-px bg-border shrink-0" />
            {(listViewsQuery.data || []).map((lv: any) => (
              <button
                key={lv.id}
                type="button"
                onClick={() => setActiveListViewId(lv.id)}
                className={`shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                  activeListViewId === lv.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-transparent hover:border-border"
                }`}
              >
                {lv.name}
                <span className={`ml-1.5 inline-block align-middle rounded-full px-1.5 py-0.5 text-[10px] ${CATEGORY_META[lv.database_type as DatabaseType]?.className}`}>
                  {CATEGORY_META[lv.database_type as DatabaseType]?.label}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setEditingListView(null); setPrefillFilters(undefined); setBuilderOpen(true); }}
              className="shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground"
            >
              + New List View
            </button>
          </div>

          <div className="flex flex-row items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>{activeListView ? activeListView.name : "All Leads"}</CardTitle>
              <CardDescription>
                {(browserQuery.data?.total ?? statsQuery.data?.total ?? 0).toLocaleString()} record{(browserQuery.data?.total ?? 0) === 1 ? "" : "s"}
                {activeListView ? " in this List View" : ""}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!activeListViewId && (
                <>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input className="pl-8 w-56" placeholder="Search name..." value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Lead
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Filter className="h-3.5 w-3.5 mr-1.5" />
                        Filter{totalFilterCount > 0 ? ` (${totalFilterCount})` : ""}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64" onCloseAutoFocus={(e) => e.preventDefault()}>
                      <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                      <div className="flex gap-1 px-2 pb-1.5 flex-wrap">
                        {(Object.keys(FILTER_FIELD_LABELS) as FilterField[]).map((field) => {
                          const count = field === "state" ? selectedStates.length : field === "country" ? selectedCountries.length : field === "status" ? selectedStatuses.length : selectedSources.length;
                          return (
                            <button
                              key={field}
                              type="button"
                              onClick={() => setActiveFilterField(field)}
                              className={`flex-1 text-xs rounded-md px-2 py-1.5 border transition-colors ${
                                activeFilterField === field
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-transparent hover:bg-accent text-muted-foreground"
                              }`}
                            >
                              {FILTER_FIELD_LABELS[field]}{count > 0 ? ` (${count})` : ""}
                            </button>
                          );
                        })}
                      </div>
                      <DropdownMenuSeparator />
                      <div className="max-h-64 overflow-y-auto">
                        {(() => {
                          const config = activeFilterField === "state"
                            ? { values: statesQuery.data || [], loading: statesQuery.isLoading, selected: selectedStates, toggle: toggleState, clear: () => setSelectedStates([]), label: (v: string) => v, empty: "No states in this database yet." }
                            : activeFilterField === "country"
                            ? { values: countriesQuery.data || [], loading: countriesQuery.isLoading, selected: selectedCountries, toggle: toggleCountry, clear: () => setSelectedCountries([]), label: (v: string) => v, empty: "No countries in this database yet." }
                            : activeFilterField === "source"
                            ? { values: SOURCE_FILTER_VALUES, loading: false, selected: selectedSources, toggle: toggleSource, clear: () => setSelectedSources([]), label: (v: string) => SOURCE_META[v]?.label || v, empty: "No sources yet." }
                            : { values: STATUS_FILTER_VALUES, loading: false, selected: selectedStatuses, toggle: toggleStatus, clear: () => setSelectedStatuses([]), label: (v: string) => STATUS_META[v]?.label || v, empty: "No statuses yet." };
                          if (config.values.length === 0) {
                            return <p className="px-2 py-1.5 text-xs text-muted-foreground">{config.loading ? "Loading..." : config.empty}</p>;
                          }
                          return (
                            <>
                              <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent" onClick={config.clear}>
                                <Checkbox checked={config.selected.length === 0} />
                                All
                              </label>
                              <DropdownMenuSeparator />
                              {config.values.map((v) => (
                                <label key={v} className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent" onClick={() => config.toggle(v)}>
                                  <Checkbox checked={config.selected.includes(v)} />
                                  {config.label(v)}
                                </label>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                      {totalFilterCount > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <Button variant="ghost" size="sm" className="w-full justify-start h-7 text-xs" onClick={clearAllFilters}>
                            Clear all filters
                          </Button>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {(selectedStates.length > 0 || selectedCountries.length > 0 || selectedSources.length > 0) && (
                    <Button variant="outline" size="sm" onClick={createListViewFromFilters}>
                      <ListFilter className="h-3.5 w-3.5 mr-1.5" /> Create List View from Filters
                    </Button>
                  )}
                </>
              )}
              {activeListViewId && activeListView?.database_type !== "event" && (
                <Button size="sm" onClick={handleConvertActiveListView}>
                  <Workflow className="h-3.5 w-3.5 mr-1.5" /> Convert → Send to Journey Builder
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => exportRows(rows, "export")}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export
              </Button>
              <div className="flex items-center rounded-md border p-0.5">
                <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setViewMode("list")}>
                  <List className="h-3.5 w-3.5" />
                </Button>
                <Button variant={viewMode === "board" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setViewMode("board")}>
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-lg border overflow-hidden">
            <div className="bg-card p-3">
              <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Total</p>
              <p className="text-xl font-bold">{(statsQuery.data?.total ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-card p-3">
              <p className="text-[11px] uppercase text-muted-foreground tracking-wide">With Phone</p>
              <p className="text-xl font-bold">{(statsQuery.data?.withPhone ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-card p-3">
              <p className="text-[11px] uppercase text-muted-foreground tracking-wide">With Email</p>
              <p className="text-xl font-bold">{(statsQuery.data?.withEmail ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-card p-3">
              <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Last Upload</p>
              <p className="text-sm font-medium mt-1">
                {statsQuery.data?.lastUpload ? new Date(statsQuery.data.lastUpload).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>

          {viewMode === "list" ? (
            <>
              {selectedRowIds.size > 0 && (
                <div className="flex items-center justify-between rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 px-3 py-2">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">{selectedRowIds.size} lead{selectedRowIds.size === 1 ? "" : "s"} selected</p>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs">Change Status</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {STATUS_OPTIONS.map((opt) => (
                          <DropdownMenuItem key={opt.value} onClick={() => bulkChangeStatus(opt.value)}>{opt.label}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={(listViewsQuery.data || []).length === 0}>Add to List View</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(listViewsQuery.data || []).map((lv: any) => (
                          <DropdownMenuItem key={lv.id} onClick={() => bulkAddToListView(lv.id, lv.name)}>{lv.name}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => exportRows(rows.filter((r) => selectedRowIds.has(r.id)), "selected")}>
                      Export
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-lg border overflow-x-auto bg-[#F7F5F0]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"><Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} aria-label="Select all leads" /></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {browserQuery.isLoading ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No contacts found.</TableCell></TableRow>
                    ) : (
                      rows.map((c: any) => {
                        const meta = STATUS_META[c.status || "new"] || STATUS_META.new;
                        const cat = CATEGORY_META[c.database_type as DatabaseType];
                        return (
                          <TableRow key={c.id} className="cursor-pointer" onClick={() => setDetailContactId(c.id)}>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={selectedRowIds.has(c.id)} onCheckedChange={() => toggleRowSelected(c.id)} aria-label={`Select ${c.name}`} />
                            </TableCell>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell>{cat && <Badge variant="secondary" className={cat.className}>{cat.label}</Badge>}</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Select value={c.lead_source || "__unset__"} onValueChange={(v) => handleSourceChange(c.id, v === "__unset__" ? "" : v)}>
                                <SelectTrigger className={`h-7 w-[120px] text-xs border-0 ${c.lead_source ? SOURCE_META[c.lead_source]?.className : "bg-muted text-muted-foreground"}`}>
                                  <SelectValue placeholder="— Set —" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__unset__" className="text-xs">— Unset —</SelectItem>
                                  {SOURCE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{c.phone || "—"}</TableCell>
                            <TableCell className="text-xs">{c.email || "—"}</TableCell>
                            <TableCell>{c.state || "—"}</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {c.status === "converted" ? (
                                <Badge variant="secondary" className={meta.className}>{meta.label}</Badge>
                              ) : (
                                <Select value={c.status || "new"} onValueChange={(v) => handleStatusChange(c.id, v, c.status)}>
                                  <SelectTrigger className={`h-7 w-[150px] text-xs border-0 ${meta.className}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STATUS_OPTIONS.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {browserQuery.data && (
                <p className="text-xs text-muted-foreground">Showing {rows.length} of {browserQuery.data.total} lead{browserQuery.data.total === 1 ? "" : "s"}{activeListView ? ` in "${activeListView.name}"` : ""}</p>
              )}
            </>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-4 min-w-max bg-[#F7F5F0] p-2 rounded-lg">
                {BOARD_COLUMNS.map((col) => (
                  <div
                    key={col.status}
                    className="w-64 shrink-0 space-y-2"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleColumnDrop(e, col.status)}
                  >
                    <div className="flex items-center justify-between px-0.5">
                      <p className="text-xs font-semibold">{col.label}</p>
                      <span className="text-xs text-muted-foreground">{boardGroups.groups[col.status]?.length ?? 0}</span>
                    </div>
                    <div className="space-y-2 min-h-[60px]">
                      {(boardGroups.groups[col.status] || []).map((lead: any) => {
                        const cat = CATEGORY_META[lead.database_type as DatabaseType];
                        return (
                          <div
                            key={lead.id}
                            draggable
                            onDragStart={(e) => handleCardDragStart(e, lead.id)}
                            onClick={() => setDetailContactId(lead.id)}
                            className="rounded-lg border bg-card p-3 space-y-1.5 cursor-grab active:cursor-grabbing hover:border-primary transition-colors"
                          >
                            <p className="text-sm font-semibold">{lead.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{lead.phone || "—"}</p>
                            <div className="flex items-center gap-1 flex-wrap">
                              {cat && <Badge variant="secondary" className={`text-[10px] ${cat.className}`}>{cat.label}</Badge>}
                              {lead.lead_source && (
                                <Badge variant="secondary" className={`text-[10px] ${SOURCE_META[lead.lead_source]?.className}`}>{SOURCE_META[lead.lead_source]?.label}</Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="w-40 shrink-0 space-y-2">
                  <div className="flex items-center justify-between px-0.5">
                    <p className="text-xs font-semibold text-muted-foreground">Disqualified</p>
                    <span className="text-xs text-muted-foreground">{boardGroups.disqualifiedCount}</span>
                  </div>
                  <div className="rounded-lg border border-dashed p-3 text-center">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">Not Interested &amp; Wrong Data leads, collapsed by default</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>List Views</CardTitle>
            <CardDescription>Saved segments across every category, ready to import into Journey Builder.</CardDescription>
          </div>
          <Button size="sm" onClick={() => { setEditingListView(null); setPrefillFilters(undefined); setBuilderOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New List View
          </Button>
        </CardHeader>
        <CardContent>
          {(listViewsQuery.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No list views yet. Create one to define a reusable segment.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {listViewsQuery.data!.map((lv: any) => (
                <button
                  key={lv.id}
                  type="button"
                  onClick={() => { setEditingListView(lv); setBuilderOpen(true); }}
                  className="text-left rounded-lg border p-3 hover:border-primary transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{lv.name}</span>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className={`text-[10px] ${CATEGORY_META[lv.database_type as DatabaseType]?.className}`}>{CATEGORY_META[lv.database_type as DatabaseType]?.label}</Badge>
                    {lv.is_shared && <Badge variant="secondary" className="text-[10px]">Shared</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(lv.filters || []).length} filter{(lv.filters || []).length === 1 ? "" : "s"} · edited {new Date(lv.updated_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Upload Contacts
          </CardTitle>
          <CardDescription>
            Upload a CSV or Excel file with columns: Name, Category (Institutional, Distributor, or Event), Phone (or Mobile),
            Address, City, PIN, State, Country, Email, Website (optional), First Name, Last Name, Business Details. Column order
            doesn't matter, and any extra columns in your file are ignored. Phone numbers are normalized to +91xxxxxxxxxx.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isImporting}
          />
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
              <Upload className="h-4 w-4 mr-2" /> {isImporting ? "Importing..." : "Select File to Import"}
            </Button>
            <Button variant="outline" onClick={handleDownloadSample}>
              <Download className="h-4 w-4 mr-2" /> Download Sample
            </Button>
          </div>

          {(isImporting || statusMessage) && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{statusMessage}</span>
                {totalRecords > 0 && <span>{processedRecords.toLocaleString()} / {totalRecords.toLocaleString()}</span>}
              </div>
              {isImporting && <Progress value={progress} className="h-2" />}
            </div>
          )}

          {importResult && (
            <div className="rounded-lg border p-3 text-sm grid grid-cols-3 gap-4">
              <div><span className="text-muted-foreground">Processed:</span> <p className="font-medium">{importResult.processed.toLocaleString()}</p></div>
              <div><span className="text-muted-foreground">Inserted:</span> <p className="font-medium text-primary">{importResult.inserted.toLocaleString()}</p></div>
              <div><span className="text-muted-foreground">Skipped:</span> <p className="font-medium">{importResult.skipped.toLocaleString()}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      <MarketingListViewBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        initialDatabaseType={selectedCategories.length === 1 ? (selectedCategories[0] as DatabaseType) : undefined}
        listView={editingListView}
        initialFilters={prefillFilters}
      />

      <LeadDetailPanel
        open={!!detailContactId}
        onOpenChange={(open) => !open && setDetailContactId(null)}
        contactId={detailContactId}
        onChanged={invalidateLeads}
      />

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setNewLead(emptyNewLead); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Category *</Label>
                <Select value={newLead.database_type} onValueChange={(v) => setNewLead((s) => ({ ...s, database_type: v as DatabaseType }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_FILTER_VALUES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{CATEGORY_META[cat].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Name *</Label>
                <Input value={newLead.name} onChange={(e) => setNewLead((s) => ({ ...s, name: e.target.value }))} placeholder="Business / lead name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">First Name</Label>
                <Input value={newLead.first_name} onChange={(e) => setNewLead((s) => ({ ...s, first_name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Last Name</Label>
                <Input value={newLead.last_name} onChange={(e) => setNewLead((s) => ({ ...s, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={newLead.phone} onChange={(e) => setNewLead((s) => ({ ...s, phone: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={newLead.email} onChange={(e) => setNewLead((s) => ({ ...s, email: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Website</Label>
              <Input value={newLead.website} onChange={(e) => setNewLead((s) => ({ ...s, website: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Source</Label>
                <Select value={newLead.lead_source} onValueChange={(v) => setNewLead((s) => ({ ...s, lead_source: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={newLead.status} onValueChange={(v) => setNewLead((s) => ({ ...s, status: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">State</Label>
                <Input value={newLead.state} onChange={(e) => setNewLead((s) => ({ ...s, state: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Country</Label>
                <Input value={newLead.country} onChange={(e) => setNewLead((s) => ({ ...s, country: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">City</Label>
                <Input value={newLead.city} onChange={(e) => setNewLead((s) => ({ ...s, city: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Pincode</Label>
                <Input value={newLead.pincode} onChange={(e) => setNewLead((s) => ({ ...s, pincode: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Address</Label>
              <Input value={newLead.address} onChange={(e) => setNewLead((s) => ({ ...s, address: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Business Details</Label>
              <Textarea rows={3} value={newLead.business_details} onChange={(e) => setNewLead((s) => ({ ...s, business_details: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createLeadMutation.mutate()}
              disabled={!newLead.database_type || !newLead.name.trim() || createLeadMutation.isPending}
            >
              {createLeadMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
