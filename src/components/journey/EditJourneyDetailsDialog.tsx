import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { objectiveLabel, toDateTimeLocal, fromDateTimeLocal, isInvalidWindow, isBlankOrInRange } from "@/lib/journeyCampaign";
import { CampaignPlanningFields, CampaignPlanningSummary, type PlanningValues } from "@/components/journey/CampaignPlanningFields";

import { MARKETING_SEGMENTS, MARKETING_SEGMENT_TYPES, segmentToDatabaseType } from "@/lib/marketingSegments";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journeyId: string;
  currentName: string;
  // A journey created before this redesign (or still targeting the
  // retailers table) keeps its original category selector untouched —
  // only journeys already on a marketing segment get the new cascading
  // Database/View selector, so editing an existing retailer journey can
  // never silently reassign its audience to a marketing database.
  currentSegmentType: string;
  currentListViewId: string;
  currentCategory: string;
  // Campaign fields (optional; objective is read-only after creation).
  currentObjective?: string | null;
  currentStartDate?: string | null;
  currentEndDate?: string | null;
  currentBudgetCap?: number | null;
  currentDescription?: string | null;
  currentOwnerId?: string | null;
  currentExpectedRevenue?: number | null;
  currentExpectedResponsePct?: number | null;
}

export function EditJourneyDetailsDialog({
  open, onOpenChange, journeyId, currentName, currentSegmentType, currentListViewId, currentCategory,
  currentObjective, currentStartDate, currentEndDate, currentBudgetCap, currentDescription,
  currentOwnerId, currentExpectedRevenue, currentExpectedResponsePct,
}: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("any");
  const [segmentType, setSegmentType] = useState<string>("marketing_institutional");
  const [listViewId, setListViewId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetCap, setBudgetCap] = useState("");
  const [description, setDescription] = useState("");
  const [planning, setPlanning] = useState<PlanningValues>({ ownerId: "", expectedRevenue: "", expectedResponsePct: "" });

  const isMarketingJourney = MARKETING_SEGMENT_TYPES.has(currentSegmentType);

  useEffect(() => {
    if (!open) return;
    setName(currentName || "");
    setCategory(currentCategory || "any");
    setSegmentType(MARKETING_SEGMENT_TYPES.has(currentSegmentType) ? currentSegmentType : "marketing_institutional");
    setListViewId(currentListViewId || "");
    setStartDate(toDateTimeLocal(currentStartDate));
    setEndDate(toDateTimeLocal(currentEndDate));
    setBudgetCap(currentBudgetCap == null ? "" : String(currentBudgetCap));
    setDescription(currentDescription || "");
    setPlanning({
      ownerId: currentOwnerId || "",
      expectedRevenue: currentExpectedRevenue == null ? "" : String(currentExpectedRevenue),
      expectedResponsePct: currentExpectedResponsePct == null ? "" : String(currentExpectedResponsePct),
    });
  }, [open, currentName, currentCategory, currentSegmentType, currentListViewId, currentStartDate, currentEndDate, currentBudgetCap, currentDescription, currentOwnerId, currentExpectedRevenue, currentExpectedResponsePct]);

  const { data: marketingListViews = [] } = useQuery({
    queryKey: ["marketing-list-views", segmentType],
    queryFn: async () => {
      const databaseType = segmentToDatabaseType(segmentType);
      const { data, error } = await supabase
        .from("marketing_contact_list_views").select("id, name").eq("database_type", databaseType).order("name");
      if (error) throw error;
      return data as Array<{ id: string; name: string }>;
    },
    enabled: open && isMarketingJourney,
  });

  const invoke = async (payload: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/journey-actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Request failed");
    return json;
  };

  const audiencePreviewQuery = useQuery({
    queryKey: ["journey-edit-audience-preview", segmentType, listViewId],
    queryFn: () => invoke({ action: "preview-audience", segment_type: segmentType, list_view_id: listViewId }),
    enabled: open && isMarketingJourney && !!listViewId,
  });

  const campaignFields = () => ({
    start_date: fromDateTimeLocal(startDate),
    end_date: fromDateTimeLocal(endDate),
    budget_cap: budgetCap.trim() === "" ? null : Number(budgetCap),
    description: description.trim() || null,
    owner_id: planning.ownerId || null,
    expected_revenue: planning.expectedRevenue.trim() === "" ? null : Number(planning.expectedRevenue),
    expected_response_pct: planning.expectedResponsePct.trim() === "" ? null : Number(planning.expectedResponsePct),
  });

  const saveMutation = useMutation({
    mutationFn: () => invoke(
      isMarketingJourney
        ? { action: "update", journey_id: journeyId, name, segment_type: segmentType, list_view_id: listViewId, ...campaignFields() }
        : { action: "update", journey_id: journeyId, name, filters: category === "any" ? {} : { category }, ...campaignFields() }
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      queryClient.invalidateQueries({ queryKey: ["journey-detail", journeyId] });
      toast.success("Journey details updated");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[1500px] max-h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 py-4" style={{ background: "linear-gradient(90deg,#2c3447 0%,#31394c 15%,#40434e 30%,#5d554d 50%,#7b684d 70%,#90754e 85%,#a6834f 100%)" }}><DialogTitle className="text-white">Edit Journey</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Journey name" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-start">
          <div className="space-y-3 rounded-lg border p-3">
            <Label className="text-sm font-medium">Campaign Details</Label>
            <div>
              <Label className="text-xs text-muted-foreground">Objective</Label>
              <Input value={objectiveLabel(currentObjective) || "Not set"} disabled readOnly />
              <p className="text-xs text-muted-foreground mt-1">The objective can't be changed after the campaign is created.</p>
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
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          {isMarketingJourney ? (
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
          ) : (
            <div>
              <Label>Target Audience — Retailer View</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">All retailers</SelectItem>
                  <SelectItem value="A">Category A</SelectItem>
                  <SelectItem value="B">Category B</SelectItem>
                  <SelectItem value="C">Category C</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-3 rounded-lg border p-3">
            <Label className="text-sm font-medium">Planning</Label>
            <CampaignPlanningFields open={open} values={planning} onChange={setPlanning} />
            <CampaignPlanningSummary bare
              contacts={isMarketingJourney && listViewId ? (audiencePreviewQuery.isFetching ? null : (audiencePreviewQuery.data?.count ?? 0)) : null}
              budget={budgetCap} expectedRevenue={planning.expectedRevenue} expectedResponsePct={planning.expectedResponsePct}
            />
          </div>
          </div>
        </div>
        <DialogFooter className="px-6 py-3 border-t gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending || (isMarketingJourney && !listViewId) || isInvalidWindow(startDate, endDate) || (budgetCap.trim() !== "" && Number(budgetCap) < 0) || !isBlankOrInRange(planning.expectedRevenue, 0) || !isBlankOrInRange(planning.expectedResponsePct, 0, 100)}
          >
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
