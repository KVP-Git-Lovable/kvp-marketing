import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search } from "lucide-react";
import { format } from "date-fns";
import { isMarketingSegment } from "@/lib/marketingSegments";
import { last10 } from "@/lib/journeyAnalytics";

interface LogRow { id: string; status: string; created_at: string; contact_id: string | null; retailer_id: string | null; channel: string | null }
interface Enrollment { id: string; status: string; enrolled_at: string; person: string }
interface Person { id: string; name: string; phone: string }

const PAGE = 1000;
const personOf = (l: { contact_id: string | null; retailer_id: string | null }) => l.contact_id || l.retailer_id || "";
const label = (s: string) => (s === "rate_limited" ? "Rate limited" : s.charAt(0).toUpperCase() + s.slice(1));
const statusTone = (s: string) =>
  s === "read" ? "bg-green-100 text-green-800" : s === "delivered" ? "bg-blue-100 text-blue-800" : s === "failed" || s === "rate_limited" ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground";

/** Salesforce-style "Campaign Members": every contact in the journey with their status. Read-only. */
export function JourneyMembers({ journeyId }: { journeyId: string }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: meta } = useQuery({
    queryKey: ["jm-meta", journeyId],
    queryFn: async () => (await supabase.from("journeys").select("segment_type").eq("id", journeyId).single()).data as { segment_type: string } | null,
  });
  const marketing = isMarketingSegment(meta?.segment_type);

  const { data: logs = [] } = useQuery({
    queryKey: ["jm-logs", journeyId],
    enabled: !!meta,
    queryFn: async () => {
      const out: LogRow[] = [];
      for (let from = 0, i = 0; i < 100; i++, from += PAGE) {
        const { data, error } = await supabase.from("journey_message_log")
          .select("id, status, created_at, contact_id, retailer_id, channel").eq("journey_id", journeyId).order("created_at").range(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...((data || []) as LogRow[]));
        if (!data || data.length < PAGE) break;
      }
      return out.filter((l) => !l.channel || l.channel === "whatsapp");
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["jm-enroll", journeyId, marketing],
    enabled: !!meta,
    queryFn: async () => {
      const table = marketing ? "marketing_journey_enrollments" : "journey_enrollments";
      const col = marketing ? "contact_id" : "retailer_id";
      const out: Enrollment[] = [];
      for (let from = 0, i = 0; i < 100; i++, from += PAGE) {
        const { data, error } = await (supabase.from(table) as any).select(`id, status, enrolled_at, ${col}`).eq("journey_id", journeyId).range(from, from + PAGE - 1);
        if (error) throw error;
        for (const r of data || []) out.push({ id: r.id, status: r.status, enrolled_at: r.enrolled_at, person: r[col] });
        if (!data || data.length < PAGE) break;
      }
      return out;
    },
  });

  const ids = useMemo(() => Array.from(new Set(enrollments.map((e) => e.person).filter(Boolean))), [enrollments]);
  const { data: people } = useQuery({
    queryKey: ["jm-people", journeyId, marketing, ids.length],
    enabled: ids.length > 0,
    queryFn: async () => {
      const map = new Map<string, Person>();
      for (let i = 0; i < ids.length; i += 150) {
        const slice = ids.slice(i, i + 150);
        if (marketing) {
          const { data } = await supabase.from("marketing_contacts").select("id, name, phone").in("id", slice);
          for (const r of data || []) map.set(r.id, { id: r.id, name: r.name || "", phone: r.phone || "" });
        } else {
          const { data } = await supabase.from("retailers").select("id, phone").in("id", slice);
          for (const r of (data || []) as Array<{ id: string; phone: string | null }>) map.set(r.id, { id: r.id, name: "", phone: r.phone || "" });
        }
      }
      return map;
    },
  });

  const firstLog = logs[0]?.created_at;
  const { data: inbound = [] } = useQuery({
    queryKey: ["jm-inbound", journeyId, firstLog],
    enabled: !!firstLog,
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_messages").select("from_number, created_at").eq("direction", "inbound").gte("created_at", firstLog!).limit(5000);
      return (data || []) as Array<{ from_number: string | null; created_at: string }>;
    },
  });

  const rows = useMemo(() => {
    const lastLog = new Map<string, LogRow>();
    for (const l of logs) { const k = personOf(l); if (k) lastLog.set(k, l); }
    const repliedPhones = new Set(inbound.map((m) => last10(m.from_number)));
    const latest = new Map<string, Enrollment>();
    for (const e of enrollments) if (!latest.has(e.person) || e.enrolled_at > latest.get(e.person)!.enrolled_at) latest.set(e.person, e);
    return Array.from(latest.values()).map((e) => {
      const person = people?.get(e.person) || { id: e.person, name: "", phone: "" };
      const log = lastLog.get(e.person);
      return {
        id: e.person, name: person.name, phone: person.phone, entered: e.enrolled_at, enrollment: e.status,
        message: log?.status ?? "", replied: !!person.phone && repliedPhones.has(last10(person.phone)),
      };
    }).sort((a, b) => b.entered.localeCompare(a.entered));
  }, [logs, enrollments, people, inbound]);

  const shown = rows.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.phone.includes(search)) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "replied") return r.replied;
    if (statusFilter === "failed") return r.message === "failed" || r.message === "rate_limited";
    if (statusFilter === "not_sent") return !r.message;
    return r.message === statusFilter;
  });

  const exportCsv = () => {
    const csv = [["Name", "Phone", "Entered", "Enrollment", "Last message", "Replied"], ...shown.map((r) => [r.name, r.phone, r.entered, r.enrollment, r.message, r.replied ? "Yes" : "No"])]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `journey-${journeyId}-members.csv`;
    a.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="not_sent">Not sent yet</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{shown.length} of {rows.length}</p>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv} disabled={shown.length === 0}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Entered</TableHead><TableHead>Enrollment</TableHead><TableHead>Last message</TableHead><TableHead>Replied</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {shown.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No members</TableCell></TableRow>
              ) : shown.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name || "Contact"}</TableCell>
                  <TableCell className="text-xs">{r.phone || "—"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.entered), "dd MMM yyyy, p")}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{r.enrollment}</Badge></TableCell>
                  <TableCell>{r.message ? <Badge className={statusTone(r.message)}>{label(r.message)}</Badge> : <span className="text-xs text-muted-foreground">Not sent yet</span>}</TableCell>
                  <TableCell>{r.replied ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
