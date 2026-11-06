import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search } from "lucide-react";
import { format } from "date-fns";
import { isMarketingSegment } from "@/lib/marketingSegments";
import { last10 } from "@/lib/journeyAnalytics";

interface Props {
  journeyId: string;
  journeyName?: string;
  canvasData: { nodes?: Array<{ id: string; type: string; data?: { template_id?: string; template_name?: string } }> };
  onBack: () => void;
}
interface LogRow { id: string; node_id: string | null; status: string; created_at: string; contact_id: string | null; retailer_id: string | null; channel: string | null }
interface Person { id: string; name: string; phone: string }
interface Enrollment { id: string; status: string; enrolled_at: string; person: string }
interface Inbound { id: string; from_number: string | null; body: string | null; created_at: string }

const FILTERS = ["All", "Replied", "Not Replied", "Active", "Completed", "Read", "Unread"] as const;
type Filter = (typeof FILTERS)[number];
const personOf = (l: { contact_id: string | null; retailer_id: string | null }) => l.contact_id || l.retailer_id || "";
const statusLabel = (s: string) => (s === "rate_limited" ? "Rate limited" : s.charAt(0).toUpperCase() + s.slice(1));

export function JourneyConversations({ journeyId, journeyName, canvasData, onBack }: Props) {
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: meta } = useQuery({
    queryKey: ["jc-meta", journeyId],
    queryFn: async () => (await supabase.from("journeys").select("segment_type, status").eq("id", journeyId).single()).data as { segment_type: string; status: string } | null,
  });
  const marketing = isMarketingSegment(meta?.segment_type);

  const logsQ = useQuery({
    queryKey: ["jc-logs", journeyId],
    enabled: !!meta,
    refetchInterval: 20000,
    queryFn: async () => {
      const out: LogRow[] = [];
      for (let from = 0, i = 0; i < 100; i++, from += 1000) {
        const { data, error } = await supabase.from("journey_message_log")
          .select("id, node_id, status, created_at, contact_id, retailer_id, channel").eq("journey_id", journeyId).order("created_at").range(from, from + 999);
        if (error) throw error;
        out.push(...((data || []) as LogRow[]));
        if (!data || data.length < 1000) break;
      }
      return out.filter((l) => !l.channel || l.channel === "whatsapp");
    },
  });

  const enrollQ = useQuery({
    queryKey: ["jc-enroll", journeyId, marketing],
    enabled: !!meta,
    queryFn: async () => {
      const table = marketing ? "marketing_journey_enrollments" : "journey_enrollments";
      const col = marketing ? "contact_id" : "retailer_id";
      const out: Enrollment[] = [];
      for (let from = 0, i = 0; i < 100; i++, from += 1000) {
        const { data, error } = await (supabase.from(table) as any).select(`id, status, enrolled_at, ${col}`).eq("journey_id", journeyId).range(from, from + 999);
        if (error) throw error;
        for (const r of data || []) out.push({ id: r.id, status: r.status, enrolled_at: r.enrolled_at, person: r[col] });
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });

  const ids = useMemo(() => Array.from(new Set([...(enrollQ.data || []).map((e) => e.person), ...(logsQ.data || []).map(personOf)].filter(Boolean))), [enrollQ.data, logsQ.data]);
  const peopleQ = useQuery({
    queryKey: ["jc-people", journeyId, marketing, ids.length],
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

  const firstLog = logsQ.data?.[0]?.created_at;
  const inboundQ = useQuery({
    queryKey: ["jc-inbound", journeyId, firstLog],
    enabled: !!firstLog,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_messages").select("id, from_number, body, created_at")
        .eq("direction", "inbound").gte("created_at", firstLog!).order("created_at").limit(5000);
      if (error) throw error;
      return (data || []) as Inbound[];
    },
  });

  const templateIds = useMemo(() => Array.from(new Set((canvasData?.nodes || []).map((n) => n.data?.template_id).filter(Boolean) as string[])), [canvasData]);
  const templatesQ = useQuery({
    queryKey: ["jc-templates", templateIds.join(",")],
    enabled: templateIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_templates").select("id, name, body").in("id", templateIds);
      return new Map((data || []).map((t) => [t.id, t]));
    },
  });
  const bodyForNode = (nodeId: string | null) => {
    const node = (canvasData?.nodes || []).find((n) => n.id === nodeId);
    const t = node?.data?.template_id ? templatesQ.data?.get(node.data.template_id) : undefined;
    return t?.body || (node?.data?.template_name ? `Template: ${node.data.template_name}` : "Template message");
  };

  const participants = useMemo(() => {
    const logsBy = new Map<string, LogRow[]>();
    for (const l of logsQ.data || []) { const k = personOf(l); if (k) logsBy.set(k, [...(logsBy.get(k) || []), l]); }
    const enrBy = new Map<string, Enrollment>();
    for (const e of enrollQ.data || []) if (!enrBy.has(e.person) || e.enrolled_at > enrBy.get(e.person)!.enrolled_at) enrBy.set(e.person, e);
    const inbBy = new Map<string, Inbound[]>();
    for (const m of inboundQ.data || []) { const k = last10(m.from_number); if (k) inbBy.set(k, [...(inbBy.get(k) || []), m]); }

    return ids.map((id) => {
      const person = peopleQ.data?.get(id) || { id, name: "", phone: "" };
      const logs = logsBy.get(id) || [];
      const firstSent = logs[0] ? new Date(logs[0].created_at).getTime() : Infinity;
      const inbound = (inbBy.get(last10(person.phone)) || []).filter((m) => new Date(m.created_at).getTime() >= firstSent);
      const enrollment = enrBy.get(id);
      const lastAt = Math.max(0, ...logs.map((l) => new Date(l.created_at).getTime()), ...inbound.map((m) => new Date(m.created_at).getTime()));
      return { person, logs, inbound, enrollment, lastAt, read: logs.some((l) => l.status === "read") };
    }).sort((a, b) => b.lastAt - a.lastAt);
  }, [ids, logsQ.data, enrollQ.data, inboundQ.data, peopleQ.data]);

  const shown = participants.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.person.name.toLowerCase().includes(q) && !p.person.phone.includes(q)) return false;
    }
    switch (filter) {
      case "Replied": return p.inbound.length > 0;
      case "Not Replied": return p.inbound.length === 0;
      case "Active": return p.enrollment?.status === "active";
      case "Completed": return p.enrollment?.status === "completed";
      case "Read": return p.read;
      case "Unread": return p.logs.length > 0 && !p.read;
      default: return true;
    }
  });

  const current = participants.find((p) => p.person.id === activeId) || shown[0];
  const thread = current
    ? [
        ...current.logs.map((l) => ({ kind: "out" as const, at: l.created_at, text: bodyForNode(l.node_id), status: l.status })),
        ...current.inbound.map((m) => ({ kind: "in" as const, at: m.created_at, text: m.body || "", status: "" })),
      ].sort((a, b) => a.at.localeCompare(b.at))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h2 className="text-lg font-semibold">Journey Conversations</h2>
          <p className="text-xs text-muted-foreground">{journeyName ? `${journeyName} · ` : ""}WhatsApp conversations for participants of this journey. Replies appear once the incoming-message webhook points to whatsapp-inbound.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f}</Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr_280px]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Participants ({participants.length})</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-[560px] overflow-y-auto divide-y">
            {shown.length === 0 && <p className="p-4 text-sm text-muted-foreground">No participants match.</p>}
            {shown.map((p) => (
              <button key={p.person.id} onClick={() => setActiveId(p.person.id)}
                className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 ${current?.person.id === p.person.id ? "bg-muted" : ""}`}>
                <p className="text-sm font-medium truncate">{p.person.name || p.person.phone || "Contact"}</p>
                <p className="text-xs text-muted-foreground">{p.person.phone}</p>
                <p className="text-xs text-muted-foreground">{p.logs.length === 0 ? "No messages yet" : `${p.logs.length} sent${p.inbound.length ? ` · ${p.inbound.length} repl${p.inbound.length > 1 ? "ies" : "y"}` : ""}`}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{current ? (current.person.name || current.person.phone) : "Select a participant"}</CardTitle></CardHeader>
          <CardContent className="max-h-[560px] overflow-y-auto space-y-3">
            {thread.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            {thread.map((m, i) => (
              <div key={i} className={`flex ${m.kind === "out" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.kind === "out" ? "bg-green-100 text-green-950" : "bg-muted"}`}>
                  {m.text}
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {format(new Date(m.at), "dd MMM, p")}
                    {m.kind === "out" && <Badge variant="outline" className="text-[10px] py-0">{statusLabel(m.status)}</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Journey Context</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {([
              ["Journey", journeyName || "—"],
              ["Journey Status", meta?.status || "—"],
              ["Participant", current ? (current.person.name || current.person.phone) : "—"],
              ["Date Entered", current?.enrollment ? format(new Date(current.enrollment.enrolled_at), "MMM d, yyyy p") : "—"],
              ["Enrollment Status", current?.enrollment?.status || "—"],
              ["Replied", current ? (current.inbound.length > 0 ? "Yes" : "No") : "—"],
            ] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium capitalize">{v}</span></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
