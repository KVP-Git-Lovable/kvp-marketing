import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, CalendarClock, UserX, Trash2, Search, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ExcludedContact {
  id: string;
  retailer_id: string;
  reason: string | null;
  excluded_at: string;
  retailers: { name: string; phone: string } | null;
}

interface JourneySchedule {
  id: string;
  schedule_type: string;
  start_at: string;
  recurrence_rule: string | null;
  next_run_at: string | null;
}

interface CostSettings {
  whatsapp_cost_per_message: number;
}

interface JourneyDetail {
  id: string;
  approval_status: string;
  approval_notes: string | null;
  schedule: JourneySchedule | null;
  excluded_contacts: ExcludedContact[];
  cost_settings: CostSettings | null;
  sent_message_count: number;
}

import { JourneyActivityTimeline } from "@/components/journey/JourneyActivityTimeline";

const approvalColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function JourneySettingsPanel({ journeyId, journey }: { journeyId: string; journey: JourneyDetail }) {
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const queryClient = useQueryClient();

  const [scheduleType, setScheduleType] = useState(journey.schedule?.schedule_type || "one_time");
  const [startAt, setStartAt] = useState(
    journey.schedule?.start_at ? journey.schedule.start_at.slice(0, 16) : ""
  );
  const [costPerMessage, setCostPerMessage] = useState(
    journey.cost_settings?.whatsapp_cost_per_message?.toString() || ""
  );
  const [retailerSearch, setRetailerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [searching, setSearching] = useState(false);

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

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["journey-detail", journeyId] });
    queryClient.invalidateQueries({ queryKey: ["journeys"] });
  };

  const approvalMutation = useMutation({
    mutationFn: (action: "submit-approval" | "approve" | "reject") => {
      const notes = action === "reject" ? window.prompt("Reason for rejection (optional):") || "" : undefined;
      return invoke({ action, journey_id: journeyId, notes });
    },
    onSuccess: (_data, action) => {
      refetch();
      toast.success(action === "submit-approval" ? "Submitted for approval" : action === "approve" ? "Journey approved" : "Journey rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scheduleMutation = useMutation({
    mutationFn: () => invoke({
      action: "schedule", journey_id: journeyId,
      schedule_type: scheduleType, start_at: new Date(startAt).toISOString(),
    }),
    onSuccess: () => { refetch(); toast.success("Schedule saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const unscheduleMutation = useMutation({
    mutationFn: () => invoke({ action: "unschedule", journey_id: journeyId }),
    onSuccess: () => { refetch(); toast.success("Schedule removed"); },
  });

  const excludeMutation = useMutation({
    mutationFn: (retailer_id: string) => invoke({ action: "exclude", journey_id: journeyId, retailer_id, reason: "Manually excluded" }),
    onSuccess: () => { refetch(); setSearchResults([]); setRetailerSearch(""); toast.success("Retailer excluded"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const unexcludeMutation = useMutation({
    mutationFn: (retailer_id: string) => invoke({ action: "unexclude", journey_id: journeyId, retailer_id }),
    onSuccess: () => { refetch(); toast.success("Exclusion removed"); },
  });

  const costMutation = useMutation({
    mutationFn: () => invoke({ action: "save-cost-settings", journey_id: journeyId, whatsapp_cost_per_message: Number(costPerMessage) || 0 }),
    onSuccess: () => { refetch(); toast.success("Cost settings saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const searchRetailers = async () => {
    if (!retailerSearch.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("retailers").select("id, name, phone")
        .or(`name.ilike.%${retailerSearch}%,phone.ilike.%${retailerSearch}%`)
        .limit(8);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const costPerMsg = journey.cost_settings?.whatsapp_cost_per_message || 0;
  const estimatedSpend = costPerMsg * journey.sent_message_count;

  return (
    <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Badge className={approvalColors[journey.approval_status] || approvalColors.draft}>{journey.approval_status}</Badge>
          {journey.approval_notes && <p className="text-xs text-muted-foreground">Note: {journey.approval_notes}</p>}
          <div className="flex flex-col gap-2">
            {(journey.approval_status === "draft" || journey.approval_status === "rejected") && (
              <Button size="sm" variant="outline" onClick={() => approvalMutation.mutate("submit-approval")} disabled={approvalMutation.isPending}>
                Submit for Approval
              </Button>
            )}
            {journey.approval_status === "pending" && isAdmin && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approvalMutation.mutate("approve")} disabled={approvalMutation.isPending}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => approvalMutation.mutate("reject")} disabled={approvalMutation.isPending}>Reject</Button>
              </div>
            )}
            {journey.approval_status === "pending" && !isAdmin && (
              <p className="text-xs text-muted-foreground">Waiting on an admin to review.</p>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Scheduled re-fires only run once a journey is approved.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><CalendarClock className="h-4 w-4" /> Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Frequency</Label>
            <Select value={scheduleType} onValueChange={setScheduleType}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="one_time">One time</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Start</Label>
            <Input type="datetime-local" className="h-9" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => scheduleMutation.mutate()} disabled={!startAt || scheduleMutation.isPending}>Save Schedule</Button>
            {journey.schedule && (
              <Button size="sm" variant="outline" onClick={() => unscheduleMutation.mutate()} disabled={unscheduleMutation.isPending}>Remove</Button>
            )}
          </div>
          {journey.schedule?.next_run_at && (
            <p className="text-[11px] text-muted-foreground">Next run: {format(new Date(journey.schedule.next_run_at), "PPp")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><UserX className="h-4 w-4" /> Excluded Retailers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-1.5">
            <Input
              placeholder="Search name/phone" className="h-9"
              value={retailerSearch}
              onChange={(e) => setRetailerSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchRetailers()}
            />
            <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={searchRetailers} disabled={searching}>
              <Search className="h-3.5 w-3.5" />
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="rounded-md border divide-y text-xs max-h-28 overflow-y-auto">
              {searchResults.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-2 py-1.5">
                  <span className="truncate">{r.name} · {r.phone}</span>
                  <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => excludeMutation.mutate(r.id)}>Exclude</Button>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {journey.excluded_contacts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No exclusions.</p>
            ) : (
              journey.excluded_contacts.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between text-xs rounded-md border px-2 py-1.5">
                  <div className="truncate">
                    <span className="font-medium">{ex.retailers?.name || ex.retailer_id}</span>
                    {ex.reason && <span className="text-muted-foreground"> — {ex.reason}</span>}
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => unexcludeMutation.mutate(ex.retailer_id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><IndianRupee className="h-4 w-4" /> Cost Estimate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Cost per WhatsApp message (₹)</Label>
            <Input
              type="number" min={0} step="0.01" className="h-9"
              value={costPerMessage}
              onChange={(e) => setCostPerMessage(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={() => costMutation.mutate()} disabled={costMutation.isPending}>Save</Button>
          <div className="rounded-md border px-2 py-1.5 text-xs">
            <p>{journey.sent_message_count} messages sent</p>
            <p className="font-medium">≈ ₹{estimatedSpend.toFixed(2)} spent so far</p>
          </div>
        </CardContent>
      </Card>
    </div>
    <JourneyActivityTimeline journeyId={journeyId} />
    </div>
  );
}
