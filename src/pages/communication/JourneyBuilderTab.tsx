import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Play, Pause, Trash2, Workflow, RefreshCw, Pencil, Send, CalendarIcon, BarChart3, X, History, Clock, Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import JourneyCanvas, { defaultScaffold } from "./journey/JourneyCanvas";
import { EditJourneyDetailsDialog } from "@/components/journey/EditJourneyDetailsDialog";
import { Textarea } from "@/components/ui/textarea";
import { JOURNEY_OBJECTIVES, objectiveLabel, fromDateTimeLocal, isInvalidWindow, isBlankOrInRange } from "@/lib/journeyCampaign";
import { CampaignPlanningFields, CampaignPlanningSummary, type PlanningValues } from "@/components/journey/CampaignPlanningFields";
import { MARKETING_SEGMENTS, isMarketingSegment, segmentToDatabaseType } from "@/lib/marketingSegments";
import { DeletedJourneysDialog } from "@/components/journey/DeletedJourneysDialog";

interface Journey {
  id: string;
  name: string;
  status: string;
  approval_status: string | null;
  segment_type: string;
  filters: { category?: string; territory_id?: string; beat_id?: string; list_view_id?: string };
  enrolled_count: number;
  schedule_type: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  objective?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget_cap?: number | null;
  description?: string | null;
  owner_id?: string | null;
  expected_revenue?: number | null;
  expected_response_pct?: number | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  archived: "bg-muted text-muted-foreground",
};

const approvalBadgeClass: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};
const approvalLabel: Record<string, string> = {
  pending: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
};

const frequencyLabel: Record<string, string> = {
  one_time: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export default function JourneyBuilderTab() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [segmentType, setSegmentType] = useState<string>("marketing_institutional");
  const [listViewId, setListViewId] = useState<string>("");
  const [objective, setObjective] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [budgetCap, setBudgetCap] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [planning, setPlanning] = useState<PlanningValues>({ ownerId: "", expectedRevenue: "", expectedResponsePct: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialTab, setInitialTab] = useState<string>("canvas");
  const [deleteTargetId, setDeleteTargetId] = useState<string | string[] | null>(null);
  const [editDetailsTarget, setEditDetailsTarget] = useState<Journey | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  const [statusFilter, setStatusFilter] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [createdByFilter, setCreatedByFilter] = useState("anyone");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const journeyParam = searchParams.get("journey");
    if (journeyParam) {
      setEditingId(journeyParam);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("journey");
        return next;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Deep-link from a Marketing Database List View's "Use in Journey
  // Builder" button: opens the create dialog with the audience source
  // pre-filled.
  useEffect(() => {
    const newSegmentType = searchParams.get("new_segment_type");
    const newListViewId = searchParams.get("new_list_view_id");
    if (newSegmentType && newListViewId) {
      setSegmentType(newSegmentType);
      setListViewId(newListViewId);
      setShowCreate(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("new_segment_type");
        next.delete("new_list_view_id");
        return next;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { data: marketingListViews = [] } = useQuery({
    queryKey: ["marketing-list-views", segmentType],
    queryFn: async () => {
      const databaseType = segmentToDatabaseType(segmentType);
      const { data, error } = await supabase
        .from("marketing_contact_list_views").select("id, name").eq("database_type", databaseType).order("name");
      if (error) throw error;
      return data as Array<{ id: string; name: string }>;
    },
    enabled: isMarketingSegment(segmentType),
  });

  const audiencePreviewQuery = useQuery({
    queryKey: ["journey-create-audience-preview", segmentType, listViewId],
    queryFn: () => invoke({ action: "preview-audience", segment_type: segmentType, list_view_id: listViewId }),
    enabled: showCreate && !!listViewId,
  });

  const invoke = async (payload: Record<string, unknown>, method: "GET" | "POST" | "DELETE" = "POST") => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/journey-actions`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: method === "GET" ? undefined : JSON.stringify(payload),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Request failed");
    return json;
  };

  const { data: journeys = [], isLoading } = useQuery({
    queryKey: ["journeys"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/journey-actions`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load journeys");
      return res.json() as Promise<Journey[]>;
    },
    enabled: !editingId,
  });

  const creatorIds = useMemo(() => Array.from(new Set(journeys.map((j) => j.created_by).filter(Boolean))) as string[], [journeys]);
  const { data: creatorProfiles = [] } = useQuery({
    queryKey: ["journey-creators", creatorIds.join(",")],
    queryFn: async () => {
      if (creatorIds.length === 0) return [];
      const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", creatorIds);
      if (error) throw error;
      return data as Array<{ id: string; full_name: string | null }>;
    },
    enabled: creatorIds.length > 0,
  });
  const creatorName = (id: string | null) => (id && creatorProfiles.find((p) => p.id === id)?.full_name) || "Unknown";

  const filteredJourneys = useMemo(() => {
    return journeys.filter((j) => {
      if (statusFilter !== "all") {
        const matches =
          statusFilter === "draft" ? j.status === "draft" :
          statusFilter === "scheduled" ? j.status === "scheduled" :
          statusFilter === "active" ? j.status === "active" :
          statusFilter === "paused" ? j.status === "paused" :
          statusFilter === "pending" ? j.approval_status === "pending" :
          statusFilter === "approved" ? j.approval_status === "approved" :
          statusFilter === "rejected" ? j.approval_status === "rejected" : true;
        if (!matches) return false;
      }
      if (frequencyFilter !== "all") {
        const isRecurring = j.schedule_type ? ["daily", "weekly", "monthly"].includes(j.schedule_type) : false;
        const matches =
          frequencyFilter === "one_time" ? j.schedule_type === "one_time" :
          frequencyFilter === "recurring" ? isRecurring :
          frequencyFilter === "none" ? !j.schedule_type : true;
        if (!matches) return false;
      }
      if (channelFilter !== "all" && channelFilter !== "whatsapp") return false;
      if (createdByFilter !== "anyone" && j.created_by !== createdByFilter) return false;
      if (dateFrom && new Date(j.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(j.created_at) > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [journeys, statusFilter, frequencyFilter, channelFilter, createdByFilter, dateFrom, dateTo]);

  const hasActiveFilters = statusFilter !== "all" || frequencyFilter !== "all" || channelFilter !== "all" || createdByFilter !== "anyone" || !!dateFrom || !!dateTo;
  const clearFilters = () => {
    setStatusFilter("all"); setFrequencyFilter("all"); setChannelFilter("all");
    setCreatedByFilter("anyone"); setDateFrom(""); setDateTo("");
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const scaffold = defaultScaffold();
      return invoke({
        action: "create",
        name,
        nodes: scaffold.nodes,
        edges: scaffold.edges,
        segment_type: segmentType,
        list_view_id: listViewId,
        objective: objective || undefined,
        start_date: fromDateTimeLocal(startDate) ?? undefined,
        end_date: fromDateTimeLocal(endDate) ?? undefined,
        budget_cap: budgetCap.trim() === "" ? undefined : Number(budgetCap),
        description: description.trim() || undefined,
        owner_id: planning.ownerId || undefined,
        expected_revenue: planning.expectedRevenue.trim() === "" ? undefined : Number(planning.expectedRevenue),
        expected_response_pct: planning.expectedResponsePct.trim() === "" ? undefined : Number(planning.expectedResponsePct),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      setShowCreate(false);
      setName("");
      setSegmentType("marketing_institutional");
      setListViewId("");
      setObjective("");
      setStartDate("");
      setEndDate("");
      setBudgetCap("");
      setDescription("");
      setPlanning({ ownerId: "", expectedRevenue: "", expectedResponsePct: "" });
      toast.success("Journey created as draft");
      setInitialTab("canvas");
      setEditingId(data.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: (journey_id: string) => invoke({ action: "publish", journey_id }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      toast.success(data.scheduled && data.start_date
        ? `Campaign scheduled to start ${format(new Date(data.start_date), "MMM d, h:mm a")}`
        : `Journey published — ${data.newly_enrolled} retailer(s) enrolled`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revertToDraftMutation = useMutation({
    mutationFn: (journey_id: string) => invoke({ action: "revert-to-draft", journey_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      toast.success("Campaign moved back to draft");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pauseMutation = useMutation({
    mutationFn: (journey_id: string) => invoke({ action: "pause", journey_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      toast.success("Journey paused");
    },
  });

  const submitApprovalMutation = useMutation({
    mutationFn: (journey_id: string) => invoke({ action: "submit-approval", journey_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      toast.success("Submitted for approval");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (journeyIds: string | string[]) => {
      const ids = Array.isArray(journeyIds) ? journeyIds : [journeyIds];
      for (const journey_id of ids) await invoke({ journey_id }, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      toast.success("Journey deleted");
      setDeleteTargetId(null);
      setSelectedIds([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runNowMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-journeys`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      toast.success(`Swept ${data.swept} due step(s) — ${data.sent} sent, ${data.failed} failed`);
    },
  });

  const openJourney = (id: string, tab = "canvas") => {
    setInitialTab(tab);
    setEditingId(id);
  };

  if (editingId) {
    return <JourneyCanvas journeyId={editingId} initialTab={initialTab} onBack={() => setEditingId(null)} />;
  }

  const allSelected = filteredJourneys.length > 0 && filteredJourneys.every((j) => selectedIds.includes(j.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Journey Builder</h2>
          <p className="text-xs text-muted-foreground">
            Build branching WhatsApp campaigns targeting a retailer segment (category / territory / beat).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => runNowMutation.mutate()} disabled={runNowMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${runNowMutation.isPending ? "animate-spin" : ""}`} />
            Run Due Steps Now
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowDeleted(true)}>
            <History className="h-4 w-4 mr-2" />
            View Deleted Journeys
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Journey Campaign
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px] flex-1">
              <Label className="text-xs">Frequency</Label>
              <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All frequencies</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                  <SelectItem value="none">Not Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px] flex-1">
              <Label className="text-xs">Channel</Label>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px] flex-1">
              <Label className="text-xs">Created By</Label>
              <Select value={createdByFilter} onValueChange={setCreatedByFilter}>
                <SelectTrigger><SelectValue placeholder="Anyone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="anyone">Anyone</SelectItem>
                  {creatorIds.map((id) => <SelectItem key={id} value={id}>{creatorName(id)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <Label className="text-xs">Created From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="w-[150px]">
              <Label className="text-xs">Created To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
          {hasActiveFilters && (
            <p className="text-xs text-muted-foreground">Showing {filteredJourneys.length} of {journeys.length} journeys</p>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="px-4 py-2 border-b bg-muted/40 flex items-center justify-between">
            <p className="text-sm">{selectedIds.length} selected</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Clear</Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteTargetId(selectedIds)}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete selected
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => setSelectedIds(checked ? filteredJourneys.map((j) => j.id) : [])}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filteredJourneys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Workflow className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">{journeys.length === 0 ? "No journeys yet" : "No journeys match these filters"}</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredJourneys.map((j) => {
                  const approval = j.approval_status;
                  const showApprovalBadge = approval && approval !== "draft";
                  const canSubmit = !approval || approval === "draft" || approval === "rejected";
                  const category_ = j.filters?.category;
                  return (
                    <TableRow
                      key={j.id}
                      className={`cursor-pointer ${j.status === "active" ? "bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-950/50" : ""}`}
                      onClick={() => openJourney(j.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(j.id)}
                          onCheckedChange={(checked) => setSelectedIds((ids) => checked ? [...ids, j.id] : ids.filter((id) => id !== j.id))}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{j.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge className={statusColors[j.status] || statusColors.draft}>
                            {j.status === "scheduled" && j.start_date ? `Starts ${format(new Date(j.start_date), "MMM d, h:mm a")}` : j.status}
                          </Badge>
                          {showApprovalBadge && (
                            <Badge className={approvalBadgeClass[approval!] || ""}>{approvalLabel[approval!] || approval}</Badge>
                          )}
                          {j.schedule_type && (
                            <Badge variant="outline" className="gap-1">
                              <CalendarIcon className="h-3 w-3" /> {frequencyLabel[j.schedule_type] || j.schedule_type}
                            </Badge>
                          )}
                          {objectiveLabel(j.objective) && <Badge variant="secondary">{objectiveLabel(j.objective)}</Badge>}
                        </div>
                        {(j.start_date || j.end_date) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {j.start_date ? format(new Date(j.start_date), "MMM d") : "…"} – {j.end_date ? format(new Date(j.end_date), "MMM d") : "…"}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {category_ && category_ !== "any" ? (
                          <Badge variant="outline">Category {category_}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">All retailers</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(j.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>{j.enrolled_count}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {canSubmit && (
                            <Button variant="ghost" size="icon" onClick={() => submitApprovalMutation.mutate(j.id)} title="Submit for Approval">
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => setEditDetailsTarget(j)} title="Edit Journey">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {(j.status === "draft" || j.status === "paused") && (
                            j.start_date && new Date(j.start_date).getTime() > Date.now() ? (
                              <Button variant="ghost" size="icon" onClick={() => publishMutation.mutate(j.id)} title="Schedule campaign start">
                                <Clock className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon" onClick={() => publishMutation.mutate(j.id)} title="Publish">
                                <Play className="h-4 w-4" />
                              </Button>
                            )
                          )}
                          {j.status === "scheduled" && (
                            <Button variant="ghost" size="icon" onClick={() => revertToDraftMutation.mutate(j.id)} title="Back to draft">
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                          {j.status === "active" && (
                            <Button variant="ghost" size="icon" onClick={() => pauseMutation.mutate(j.id)} title="Pause">
                              <Pause className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openJourney(j.id, "settings")} title="Schedule">
                            <CalendarIcon className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openJourney(j.id, "analytics")} title="Analytics">
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setDeleteTargetId(j.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="w-[96vw] max-w-5xl max-h-[88vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-3 border-b"><DialogTitle>New Journey Campaign</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <Label>Journey Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New Season Offer" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 items-start">
            <div className="space-y-3 rounded-lg border p-3">
              <Label className="text-sm font-medium">Campaign Details <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
              <div>
                <Label className="text-xs text-muted-foreground">Objective</Label>
                <Select value={objective} onValueChange={setObjective}>
                  <SelectTrigger><SelectValue placeholder="Select an objective" /></SelectTrigger>
                  <SelectContent>
                    {JOURNEY_OBJECTIVES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Start Date</Label>
                  <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">End Date</Label>
                  <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              {isInvalidWindow(startDate, endDate) && (
                <p className="text-xs text-destructive">End date must be after the start date.</p>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Budget Cap (₹)</Label>
                <Input type="number" min="0" step="any" value={budgetCap} onChange={(e) => setBudgetCap(e.target.value)} placeholder="No cap" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this campaign for?" />
              </div>
              <CampaignPlanningFields open={showCreate} values={planning} onChange={setPlanning} />
            </div>
            <div className="space-y-3 rounded-lg border p-3">
              <Label className="text-sm font-medium">Target Audience</Label>
              <div>
                <Label className="text-xs text-muted-foreground">Database</Label>
                <Select value={segmentType} onValueChange={(v) => { setSegmentType(v); setListViewId(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MARKETING_SEGMENTS.map((s) => (
                      <SelectItem key={s.segment} value={s.segment}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">View</Label>
                <Select value={listViewId} onValueChange={setListViewId}>
                  <SelectTrigger><SelectValue placeholder="Select a saved List View" /></SelectTrigger>
                  <SelectContent>
                    {marketingListViews.map((lv) => (
                      <SelectItem key={lv.id} value={lv.id}>{lv.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {marketingListViews.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No List Views yet — create one from the Marketing Database tabs on the Retailer External Database page.
                  </p>
                )}
              </div>
              {listViewId && (
                <div className="rounded-md bg-muted/50 p-2.5 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Live preview</p>
                  <p className="font-medium">
                    Final audience: <span className="font-bold">
                      {audiencePreviewQuery.isFetching ? "…" : (audiencePreviewQuery.data?.count ?? 0).toLocaleString()}
                    </span> unique contacts
                  </p>
                </div>
              )}
            </div>
            </div>
            <CampaignPlanningSummary
              contacts={listViewId ? (audiencePreviewQuery.isFetching ? null : (audiencePreviewQuery.data?.count ?? 0)) : null}
              budget={budgetCap} expectedRevenue={planning.expectedRevenue} expectedResponsePct={planning.expectedResponsePct}
            />
            <p className="text-xs text-muted-foreground">You'll build the message flow on the next screen using the visual canvas.</p>
          </div>
          <DialogFooter className="px-6 py-3 border-t gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || !listViewId || isInvalidWindow(startDate, endDate) || (budgetCap.trim() !== "" && Number(budgetCap) < 0) || !isBlankOrInRange(planning.expectedRevenue, 0) || !isBlankOrInRange(planning.expectedResponsePct, 0, 100) || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create & Open Canvas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editDetailsTarget && (
        <EditJourneyDetailsDialog
          open={!!editDetailsTarget}
          onOpenChange={(open) => !open && setEditDetailsTarget(null)}
          journeyId={editDetailsTarget.id}
          currentSegmentType={editDetailsTarget.segment_type || "retailers"}
          currentListViewId={editDetailsTarget.filters?.list_view_id || ""}
          currentCategory={editDetailsTarget.filters?.category || "any"}
          currentName={editDetailsTarget.name}
          currentObjective={editDetailsTarget.objective}
          currentStartDate={editDetailsTarget.start_date}
          currentEndDate={editDetailsTarget.end_date}
          currentBudgetCap={editDetailsTarget.budget_cap}
          currentDescription={editDetailsTarget.description}
          currentOwnerId={editDetailsTarget.owner_id ?? editDetailsTarget.created_by}
          currentExpectedRevenue={editDetailsTarget.expected_revenue}
          currentExpectedResponsePct={editDetailsTarget.expected_response_pct}
        />
      )}

      <DeletedJourneysDialog open={showDeleted} onOpenChange={setShowDeleted} />

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{Array.isArray(deleteTargetId) && deleteTargetId.length > 1 ? `Delete ${deleteTargetId.length} journeys?` : "Delete this journey?"}</AlertDialogTitle>
            <AlertDialogDescription>
              This moves the journey(s) to Deleted Journeys, where they can be restored within 30 days before being permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTargetId && deleteMutation.mutate(deleteTargetId)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
