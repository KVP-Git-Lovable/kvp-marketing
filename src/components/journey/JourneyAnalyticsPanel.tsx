import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  MousePointerClick, Send, Users, BookOpen, MessageSquare, AlertTriangle, Lightbulb, Sparkles, CheckCircle2,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Legend, CartesianGrid } from "recharts";
import { isMarketingSegment } from "@/lib/marketingSegments";
import {
  computeJourneyAnalytics, FUNNEL_COLORS, type LogRow, type EventRow, type EnrollmentRow, type ClickRow, type InboundRow, type MessageNode,
} from "@/lib/journeyAnalytics";

interface Node { id: string; type: string; data?: { template_name?: string; label?: string } }
interface Edge { source: string; target: string }

interface Props {
  journeyId: string;
  canvasData: { nodes?: Node[]; edges?: Edge[]; steps?: unknown[] };
  enrolledCount: number;
  completedCount: number;
  /** Extra action buttons shown in the header (conversations, failed messages). */
  actions?: ReactNode;
}

const PAGE = 1000;
const CHUNK = 150;

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0, i = 0; i < 100; i++, from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const chunks = <T,>(arr: T[]) => Array.from({ length: Math.ceil(arr.length / CHUNK) }, (_, i) => arr.slice(i * CHUNK, (i + 1) * CHUNK));

function orderedMessageNodes(nodes: Node[], edges: Edge[]): MessageNode[] {
  const entry = nodes.find((n) => n.type === "entry");
  if (!entry) return nodes.filter((n) => n.type === "message");
  const order: Node[] = [];
  const seen = new Set<string>([entry.id]);
  const queue = [entry.id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges.filter((e) => e.source === current)) {
      if (seen.has(edge.target)) continue;
      seen.add(edge.target);
      const node = nodes.find((n) => n.id === edge.target);
      if (node) {
        if (node.type === "message") order.push(node);
        queue.push(node.id);
      }
    }
  }
  return order;
}

function KpiTile({ label, value, icon, accent }: { label: string; value: string; icon?: ReactNode; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        <p className={`text-xl font-bold whitespace-nowrap ${accent || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function JourneyAnalyticsPanel({ journeyId, canvasData, enrolledCount, completedCount, actions }: Props) {
  const [rangeKey, setRangeKey] = useState<"7d" | "30d" | "all">("30d");

  const { data: journeyMeta } = useQuery({
    queryKey: ["ja-journey-meta", journeyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("journeys").select("segment_type").eq("id", journeyId).single();
      if (error) throw error;
      return data as { segment_type: string };
    },
  });
  const marketing = isMarketingSegment(journeyMeta?.segment_type);
  const ready = !!journeyMeta;

  const logsQ = useQuery({
    queryKey: ["ja-logs", journeyId],
    enabled: ready,
    queryFn: () => fetchAll<LogRow>((from, to) =>
      supabase.from("journey_message_log").select("id, node_id, status, created_at, contact_id, retailer_id, channel")
        .eq("journey_id", journeyId).order("created_at").range(from, to)),
    refetchInterval: 30000,
  });
  const logs = logsQ.data || [];

  const eventsQ = useQuery({
    queryKey: ["ja-events", journeyId, logs.length],
    enabled: logs.length > 0,
    queryFn: async () => {
      const out: EventRow[] = [];
      for (const ids of chunks(logs.map((l) => l.id))) {
        const { data, error } = await supabase.from("journey_message_events")
          .select("journey_message_log_id, event_type, occurred_at").in("journey_message_log_id", ids);
        if (error) throw error;
        out.push(...((data || []) as EventRow[]));
      }
      return out;
    },
  });

  const enrollQ = useQuery({
    queryKey: ["ja-enrollments", journeyId, marketing],
    enabled: ready,
    queryFn: () => fetchAll<EnrollmentRow>((from, to) =>
      (supabase.from(marketing ? "marketing_journey_enrollments" : "journey_enrollments") as any)
        .select("id, status, enrolled_at").eq("journey_id", journeyId).range(from, to)),
  });

  const clicksQ = useQuery({
    queryKey: ["ja-clicks", journeyId],
    enabled: ready,
    queryFn: async () => {
      const { data: links } = await supabase.from("whatsapp_tracked_links").select("id").eq("journey_id", journeyId);
      const out: ClickRow[] = [];
      for (const ids of chunks((links || []).map((l) => l.id))) {
        const { data } = await supabase.from("whatsapp_link_clicks").select("contact_id, retailer_id, clicked_at").in("tracked_link_id", ids);
        for (const c of data || []) out.push({ person: (c.contact_id || c.retailer_id) as string, clicked_at: c.clicked_at });
      }
      return out;
    },
  });

  const peopleKeys = useMemo(() => Array.from(new Set(logs.map((l) => l.contact_id || l.retailer_id).filter(Boolean) as string[])), [logs]);
  const phonesQ = useQuery({
    queryKey: ["ja-phones", journeyId, marketing, peopleKeys.length],
    enabled: peopleKeys.length > 0,
    queryFn: async () => {
      const map = new Map<string, string>();
      for (const ids of chunks(peopleKeys)) {
        const { data } = await supabase.from(marketing ? "marketing_contacts" : "retailers").select("id, phone").in("id", ids);
        for (const r of (data || []) as Array<{ id: string; phone: string | null }>) if (r.phone) map.set(r.id, r.phone);
      }
      return map;
    },
  });

  const firstLogAt = logs[0]?.created_at;
  const inboundQ = useQuery({
    queryKey: ["ja-inbound", journeyId, firstLogAt],
    enabled: !!firstLogAt,
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_messages").select("from_number, created_at")
        .eq("direction", "inbound").gte("created_at", firstLogAt!).order("created_at", { ascending: false }).limit(3000);
      if (error) throw error;
      return (data || []) as InboundRow[];
    },
  });

  const nodes = useMemo(() => orderedMessageNodes(canvasData?.nodes || [], canvasData?.edges || []), [canvasData]);
  const rangeFrom = useMemo(() => {
    if (rangeKey === "all") return undefined;
    const d = new Date();
    d.setDate(d.getDate() - (rangeKey === "7d" ? 7 : 30));
    return d;
  }, [rangeKey]);

  const a = useMemo(() => computeJourneyAnalytics({
    logs, events: eventsQ.data || [], enrollments: enrollQ.data || [], clicks: clicksQ.data || [],
    inbound: inboundQ.data || [], phones: phonesQ.data || new Map(), nodes, enrolledCount, completedCount, rangeFrom,
  }), [logs, eventsQ.data, enrollQ.data, clicksQ.data, inboundQ.data, phonesQ.data, nodes, enrolledCount, completedCount, rangeFrom]);

  const maxFunnel = Math.max(...a.funnel.map((f) => f.count), 1);
  const first = a.funnel[0]?.count || 0;
  const scoreColor = a.health.score >= 70 ? "text-green-600" : a.health.score >= 40 ? "text-amber-600" : "text-red-600";
  const heatMax = Math.max(1, ...a.heat.flat());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as "7d" | "30d" | "all")}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        {actions}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiTile label="Entered" value={String(a.kpis.entered)} icon={<Users className="h-3.5 w-3.5" />} />
        <KpiTile label="Active" value={String(a.kpis.active)} />
        <KpiTile label="Completed" value={String(a.kpis.completed)} />
        <KpiTile label="Delivery Rate" value={`${a.kpis.deliveryRate.toFixed(1)}%`} icon={<Send className="h-3.5 w-3.5" />} accent="text-green-600" />
        <KpiTile label="Read Rate" value={`${a.kpis.readRate.toFixed(1)}%`} icon={<BookOpen className="h-3.5 w-3.5" />} accent="text-blue-600" />
        <KpiTile label="Click Rate" value={`${a.kpis.clickRate.toFixed(1)}%`} icon={<MousePointerClick className="h-3.5 w-3.5" />} accent="text-purple-600" />
        <KpiTile label="Reply Rate" value={`${a.kpis.replyRate.toFixed(1)}%`} icon={<MessageSquare className="h-3.5 w-3.5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Journey Funnel</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {a.funnel.map((f, i) => (
              <div key={f.label} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 text-muted-foreground">{f.label}</span>
                <div className="flex-1 h-7 rounded bg-muted overflow-hidden relative">
                  <div className="h-full rounded flex items-center justify-end pr-2 text-white font-medium"
                    style={{ width: `${Math.max((f.count / maxFunnel) * 100, f.count > 0 ? 8 : 0)}%`, background: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }}>
                    {f.count > 0 ? f.count.toLocaleString("en-IN") : ""}
                  </div>
                  {f.count === 0 && <span className="absolute right-2 top-1.5 text-muted-foreground">0</span>}
                </div>
                <span className="w-12 text-right text-muted-foreground">{first ? ((f.count / first) * 100).toFixed(1) : "0.0"}%</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Engagement Over Time</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {a.trend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No activity yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={a.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" fontSize={10} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis fontSize={10} allowDecimals={false} />
                  <RTooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="delivered" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="read" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="clicked" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="replied" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Journey Health Score</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <span className={`text-5xl font-bold ${scoreColor}`}>{a.health.score}</span><span className="text-muted-foreground">/100</span>
            </div>
            {a.health.strengths.length > 0 && (
              <div>
                <p className="text-xs font-medium text-green-700 mb-1">Strengths</p>
                {a.health.strengths.map((s) => <p key={s} className="text-xs flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-600" /> {s}</p>)}
              </div>
            )}
            {a.health.areas.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-700 mb-1">Areas to Improve</p>
                {a.health.areas.map((s) => <p key={s} className="text-xs flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-amber-600" /> {s}</p>)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Node / Message Performance</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Node</TableHead><TableHead className="text-right">Sent</TableHead><TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Read</TableHead><TableHead className="text-right">Failed</TableHead><TableHead className="text-right">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.nodeRows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No message nodes</TableCell></TableRow>
                ) : a.nodeRows.map((n) => (
                  <TableRow key={n.nodeId}>
                    <TableCell className="font-medium">{n.label}</TableCell>
                    <TableCell className="text-right">{n.sent}</TableCell>
                    <TableCell className="text-right">{n.delivered}</TableCell>
                    <TableCell className="text-right">{n.read}</TableCell>
                    <TableCell className="text-right">{n.failed}</TableCell>
                    <TableCell className="text-right">{n.pending}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-amber-500" /> AI Insights</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {a.insights.length === 0 ? <p className="text-sm text-muted-foreground">Not enough data yet.</p> : a.insights.map((i) => (
              <p key={i.text} className="text-xs flex items-start gap-1.5">
                {i.kind === "warn" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5" /> : i.kind === "success" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5" /> : <Lightbulb className="h-3.5 w-3.5 text-blue-600 mt-0.5" />}
                {i.text}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Best Time to Engage</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[520px] space-y-0.5">
              {a.heat.map((row, d) => (
                <div key={d} className="flex items-center gap-0.5">
                  <span className="w-8 text-[10px] text-muted-foreground">{DAYS[d]}</span>
                  {row.map((v, h) => (
                    <div key={h} title={`${DAYS[d]} ${h}:00 · ${v} read`} className="h-4 flex-1 rounded-sm"
                      style={{ background: v ? `rgba(59,130,246,${0.25 + 0.75 * (v / heatMax)})` : "hsl(var(--muted))" }} />
                  ))}
                </div>
              ))}
              <div className="flex pl-8 text-[10px] text-muted-foreground justify-between"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Audience Segments</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {([
              ["Highly engaged", a.segments.highlyEngaged, "bg-green-50 text-green-700"],
              ["Warm", a.segments.warm, "bg-amber-50 text-amber-700"],
              ["Cold", a.segments.cold, "bg-blue-50 text-blue-700"],
              ["Lost", a.segments.lost, "bg-red-50 text-red-700"],
            ] as const).map(([label, v, cls]) => (
              <div key={label} className={`rounded-md p-3 ${cls}`}>
                <p className="text-[11px] uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold">{v}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Sent {a.kpis.sent} · Failed {a.kpis.failed} · Link clicks {a.kpis.clicks}. Reply rate counts WhatsApp replies recorded after the first send.
        {!logsQ.isLoading && logs.length === 0 && enrolledCount > 0 && " No message log rows are visible for this journey; if messages were sent, check that you have read access to the message log."}
      </p>
    </div>
  );
}
