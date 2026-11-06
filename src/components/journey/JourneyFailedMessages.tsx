import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CalendarClock, Loader2, RotateCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { isMarketingSegment } from "@/lib/marketingSegments";

interface Props {
  journeyId: string;
  canvasData: { nodes?: Array<{ id: string; type: string; data?: { template_name?: string; label?: string } }> };
  onBack: () => void;
}

interface LogRow {
  id: string; node_id: string | null; status: string; created_at: string;
  contact_id: string | null; retailer_id: string | null; error_code: string | null; error_message: string | null; channel: string | null;
}
interface ScheduleRow { id: string; log_id: string; scheduled_for: string; status: string; result_message: string | null }

const PAGE = 1000;
const personOf = (l: { contact_id: string | null; retailer_id: string | null }) => l.contact_id || l.retailer_id || "";

export function JourneyFailedMessages({ journeyId, canvasData, onBack }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [codeFilter, setCodeFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");

  const { data: meta } = useQuery({
    queryKey: ["jf-meta", journeyId],
    queryFn: async () => (await supabase.from("journeys").select("segment_type").eq("id", journeyId).single()).data as { segment_type: string } | null,
  });
  const marketing = isMarketingSegment(meta?.segment_type);

  const logsQ = useQuery({
    queryKey: ["jf-logs", journeyId],
    enabled: !!meta,
    queryFn: async () => {
      const out: LogRow[] = [];
      for (let from = 0, i = 0; i < 100; i++, from += PAGE) {
        const { data, error } = await supabase.from("journey_message_log")
          .select("id, node_id, status, created_at, contact_id, retailer_id, error_code, error_message, channel")
          .eq("journey_id", journeyId).order("created_at").range(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...((data || []) as LogRow[]));
        if (!data || data.length < PAGE) break;
      }
      return out;
    },
  });

  const schedulesQ = useQuery({
    queryKey: ["jf-schedules", journeyId],
    queryFn: async () => {
      const { data } = await (supabase.from("journey_retry_schedule" as never) as any)
        .select("id, log_id, scheduled_for, status, result_message").eq("journey_id", journeyId).order("scheduled_for");
      return (data || []) as ScheduleRow[];
    },
    retry: false,
  });

  // A failure is "open" until a later attempt for the same person and step succeeded.
  const failed = useMemo(() => {
    const logs = logsQ.data || [];
    const okAt = new Map<string, number>();
    for (const l of logs) {
      if (["sent", "delivered", "read"].includes(l.status) && (!l.channel || l.channel === "whatsapp")) {
        const k = `${personOf(l)}:${l.node_id}`;
        okAt.set(k, Math.max(okAt.get(k) ?? 0, new Date(l.created_at).getTime()));
      }
    }
    const latestFail = new Map<string, LogRow>();
    for (const l of logs) {
      if (!["failed", "rate_limited"].includes(l.status) || (l.channel && l.channel !== "whatsapp")) continue;
      const k = `${personOf(l)}:${l.node_id}`;
      if ((okAt.get(k) ?? 0) > new Date(l.created_at).getTime()) continue;
      const prev = latestFail.get(k);
      if (!prev || new Date(l.created_at) > new Date(prev.created_at)) latestFail.set(k, l);
    }
    return Array.from(latestFail.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [logsQ.data]);

  const peopleQ = useQuery({
    queryKey: ["jf-people", journeyId, marketing, failed.length],
    enabled: failed.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(failed.map(personOf).filter(Boolean)));
      const map = new Map<string, { name: string; phone: string }>();
      for (let i = 0; i < ids.length; i += 150) {
        const slice = ids.slice(i, i + 150);
        if (marketing) {
          const { data } = await supabase.from("marketing_contacts").select("id, name, phone").in("id", slice);
          for (const r of data || []) map.set(r.id, { name: r.name || "", phone: r.phone || "" });
        } else {
          const { data } = await supabase.from("retailers").select("id, phone").in("id", slice);
          for (const r of (data || []) as Array<{ id: string; phone: string | null }>) map.set(r.id, { name: "", phone: r.phone || "" });
        }
      }
      return map;
    },
  });

  const nodeLabel = (id: string | null) => {
    const n = (canvasData?.nodes || []).find((x) => x.id === id);
    return n?.data?.template_name || n?.data?.label || "Message";
  };
  const codes = useMemo(() => Array.from(new Set(failed.map((f) => f.error_code).filter(Boolean) as string[])), [failed]);
  const rows = failed.filter((f) => codeFilter === "all" || (codeFilter === "none" ? !f.error_code : f.error_code === codeFilter));
  const pendingByLog = new Map((schedulesQ.data || []).filter((s) => s.status === "pending").map((s) => [s.log_id, s]));

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["jf-logs", journeyId] });
    queryClient.invalidateQueries({ queryKey: ["jf-schedules", journeyId] });
    queryClient.invalidateQueries({ queryKey: ["ja-logs", journeyId] });
  };

  const callRetry = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("journey-retry", { body });
    if (error) {
      let msg = error.message;
      try { const j = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); if (j?.error) msg = j.error; } catch { /* keep message */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const resendNow = async () => {
    setBusy(true);
    try {
      const r = await callRetry({ action: "resend", log_ids: Array.from(selected) });
      toast.success(`Re-sent: ${r.sent} sent, ${r.failed} failed, ${r.skipped} skipped${r.truncated ? " (first 200 only; run again for the rest)" : ""}`);
      setSelected(new Set());
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Re-send failed"); } finally { setBusy(false); }
  };

  const schedule = async () => {
    if (!scheduleAt) return;
    setBusy(true);
    try {
      const r = await callRetry({ action: "schedule", log_ids: Array.from(selected), scheduled_for: new Date(scheduleAt).toISOString() });
      toast.success(`${r.scheduled} message(s) scheduled for ${format(new Date(r.scheduled_for), "dd MMM, p")}`);
      setScheduleOpen(false); setSelected(new Set()); refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not schedule"); } finally { setBusy(false); }
  };

  const cancelScheduled = async (s: ScheduleRow) => {
    try { await callRetry({ action: "cancel_schedule", schedule_ids: [s.id] }); toast.success("Schedule cancelled"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not cancel"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="text-lg font-semibold">Failed Messages</h2>
            <p className="text-xs text-muted-foreground">{failed.length} contact(s) with an unresolved failed send. Re-send now or schedule it.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={codeFilter} onValueChange={setCodeFilter}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Error code" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All error codes</SelectItem>
              {codes.map((c) => <SelectItem key={c} value={c}>Code {c}</SelectItem>)}
              <SelectItem value="none">No code recorded</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={selected.size === 0 || busy} onClick={() => setScheduleOpen(true)}>
            <CalendarClock className="h-4 w-4 mr-1" /> Schedule re-send
          </Button>
          <Button size="sm" disabled={selected.size === 0 || busy} onClick={resendNow}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RotateCw className="h-4 w-4 mr-1" />} Re-send now ({selected.size})
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={(c) => setSelected(c ? new Set(rows.map((r) => r.id)) : new Set())} /></TableHead>
                <TableHead>Contact</TableHead><TableHead>Message</TableHead><TableHead>Error</TableHead><TableHead>Failed at</TableHead><TableHead>Scheduled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsQ.isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No failed messages</TableCell></TableRow>
              ) : rows.map((r) => {
                const p = peopleQ.data?.get(personOf(r));
                const sch = pendingByLog.get(r.id);
                return (
                  <TableRow key={r.id}>
                    <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{p?.name || "Contact"}</div>
                      <div className="text-xs text-muted-foreground">{p?.phone || "No phone"}</div>
                    </TableCell>
                    <TableCell className="text-sm">{nodeLabel(r.node_id)}</TableCell>
                    <TableCell className="max-w-xs">
                      {r.error_code && <Badge variant="outline" className="mr-1 text-[10px]">{r.error_code}</Badge>}
                      <span className="text-xs text-muted-foreground">{r.error_message || (r.status === "rate_limited" ? "Rate limited" : "Failed")}</span>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.created_at), "dd MMM, p")}</TableCell>
                    <TableCell className="text-xs">
                      {sch ? (
                        <span className="flex items-center gap-1">
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{format(new Date(sch.scheduled_for), "dd MMM, p")}</Badge>
                          <Button variant="ghost" size="sm" className="h-6 px-1 text-[10px]" onClick={() => cancelScheduled(sch)}>Cancel</Button>
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Schedule re-send</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{selected.size} message(s) will be re-sent at this time (checked every 5 minutes).</p>
            <Label>Date and time</Label>
            <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button disabled={!scheduleAt || busy} onClick={schedule}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
