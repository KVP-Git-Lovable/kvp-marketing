import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3, MousePointerClick, Send, XCircle, Users, BookOpen, MessageSquare,
} from "lucide-react";

interface Node {
  id: string;
  type: string;
  data?: { template_name?: string };
}
interface Edge {
  source: string;
  target: string;
}

interface Props {
  journeyId: string;
  canvasData: { nodes?: Node[]; edges?: Edge[]; steps?: unknown[] };
  enrolledCount: number;
  completedCount: number;
}

function orderedMessageNodes(nodes: Node[], edges: Edge[]): Node[] {
  const entry = nodes.find((n) => n.type === "entry");
  if (!entry) return nodes.filter((n) => n.type === "message");
  const order: Node[] = [];
  const seen = new Set<string>([entry.id]);
  const queue = [entry.id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const outgoing = edges.filter((e) => e.source === current);
    for (const edge of outgoing) {
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

export function JourneyAnalyticsPanel({ journeyId, canvasData, enrolledCount, completedCount }: Props) {
  const { data: logs = [] } = useQuery({
    queryKey: ["journey-analytics-logs", journeyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journey_message_log").select("node_id, status, enrollment_id, created_at").eq("journey_id", journeyId);
      if (error) throw error;
      return data as Array<{ node_id: string; status: string; enrollment_id: string; created_at: string }>;
    },
  });

  const { data: clicks = { total: 0, retailerIds: [] as string[] } } = useQuery({
    queryKey: ["journey-analytics-clicks", journeyId],
    queryFn: async () => {
      const { data: links } = await supabase.from("whatsapp_tracked_links").select("id").eq("journey_id", journeyId);
      const ids = (links || []).map((l) => l.id);
      if (ids.length === 0) return { total: 0, retailerIds: [] as string[] };
      const { data: clickRows, count } = await supabase
        .from("whatsapp_link_clicks").select("retailer_id", { count: "exact" }).in("tracked_link_id", ids);
      return { total: count || 0, retailerIds: (clickRows || []).map((c) => c.retailer_id).filter(Boolean) as string[] };
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["journey-analytics-enrollments", journeyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journey_enrollments").select("id, status, retailer_id, enrolled_at").eq("journey_id", journeyId);
      if (error) throw error;
      return data as Array<{ id: string; status: string; retailer_id: string; enrolled_at: string }>;
    },
  });

  const retailerIds = Array.from(new Set(enrollments.map((e) => e.retailer_id).filter(Boolean)));
  const { data: retailerPhones = [] } = useQuery({
    queryKey: ["journey-analytics-retailer-phones", journeyId, retailerIds.join(",")],
    queryFn: async () => {
      if (retailerIds.length === 0) return [];
      const { data, error } = await supabase.from("retailers").select("id, phone").in("id", retailerIds);
      if (error) throw error;
      return data as Array<{ id: string; phone: string | null }>;
    },
    enabled: retailerIds.length > 0,
  });

  // Same approach used for the Message Response "Replied" condition in
  // process-journeys: match inbound WhatsApp messages to a contact by the
  // last 10 digits of their phone, arriving after their earliest send.
  const enrollmentToRetailer = new Map(enrollments.map((e) => [e.id, e.retailer_id]));
  const earliestSentByRetailer = new Map<string, number>();
  for (const log of logs) {
    const retailerId = enrollmentToRetailer.get(log.enrollment_id);
    if (!retailerId) continue;
    const ts = new Date(log.created_at).getTime();
    const existing = earliestSentByRetailer.get(retailerId);
    if (existing === undefined || ts < existing) earliestSentByRetailer.set(retailerId, ts);
  }
  const anchorByRetailer = new Map<string, number>();
  for (const e of enrollments) {
    anchorByRetailer.set(e.retailer_id, earliestSentByRetailer.get(e.retailer_id) ?? new Date(e.enrolled_at).getTime());
  }
  const earliestAnchor = anchorByRetailer.size > 0 ? Math.min(...Array.from(anchorByRetailer.values())) : Date.now();
  const phoneByRetailer = new Map(retailerPhones.map((r) => [r.id, (r.phone || "").replace(/\D/g, "").slice(-10)]));

  const { data: repliedRetailerIds = new Set<string>() } = useQuery({
    queryKey: ["journey-analytics-replies", journeyId, retailerIds.join(","), earliestAnchor],
    queryFn: async () => {
      if (retailerIds.length === 0) return new Set<string>();
      const { data, error } = await supabase
        .from("whatsapp_messages").select("from_number, created_at")
        .eq("direction", "inbound").gt("created_at", new Date(earliestAnchor).toISOString()).limit(500);
      if (error) throw error;
      const replied = new Set<string>();
      for (const msg of data || []) {
        const suffix = (msg.from_number || "").replace(/\D/g, "").slice(-10);
        if (!suffix) continue;
        for (const [retailerId, phoneSuffix] of phoneByRetailer.entries()) {
          if (phoneSuffix && phoneSuffix === suffix) {
            const anchor = anchorByRetailer.get(retailerId);
            if (anchor !== undefined && new Date(msg.created_at).getTime() > anchor) replied.add(retailerId);
          }
        }
      }
      return replied;
    },
    enabled: retailerIds.length > 0 && retailerPhones.length > 0,
  });

  const totalSent = logs.filter((l) => l.status === "sent" || l.status === "delivered" || l.status === "read").length;
  const totalFailed = logs.filter((l) => l.status === "failed" || l.status === "rate_limited").length;

  const deliveredRetailerIds = new Set<string>();
  const readRetailerIds = new Set<string>();
  for (const log of logs) {
    const retailerId = enrollmentToRetailer.get(log.enrollment_id);
    if (!retailerId) continue;
    if (log.status === "delivered" || log.status === "read") deliveredRetailerIds.add(retailerId);
    if (log.status === "read") readRetailerIds.add(retailerId);
  }
  const clickedRetailerIds = new Set(clicks.retailerIds);
  const activeCount = enrollments.filter((e) => e.status === "active").length;

  const pct = (count: number) => (enrolledCount > 0 ? `${Math.round((count / enrolledCount) * 100)}%` : "0%");

  const messageNodes = orderedMessageNodes(canvasData?.nodes || [], canvasData?.edges || []);
  const funnelSteps = [
    { label: "Enrolled", count: enrolledCount },
    ...messageNodes.map((n) => ({
      label: n.data?.template_name ? `Reached: ${n.data.template_name}` : "Reached message step",
      count: new Set(logs.filter((l) => l.node_id === n.id).map((l) => l.enrollment_id)).size,
    })),
    { label: "Completed", count: completedCount },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiTile label="Entered" value={String(enrolledCount)} icon={<Users className="h-3.5 w-3.5" />} />
        <KpiTile label="Active" value={String(activeCount)} />
        <KpiTile label="Completed" value={String(completedCount)} />
        <KpiTile label="Delivery Rate" value={pct(deliveredRetailerIds.size)} icon={<Send className="h-3.5 w-3.5" />} accent="text-green-600" />
        <KpiTile label="Read Rate" value={pct(readRetailerIds.size)} icon={<BookOpen className="h-3.5 w-3.5" />} accent="text-blue-600" />
        <KpiTile label="Click Rate" value={pct(clickedRetailerIds.size)} icon={<MousePointerClick className="h-3.5 w-3.5" />} accent="text-purple-600" />
        <KpiTile label="Reply Rate" value={pct(repliedRetailerIds.size)} icon={<MessageSquare className="h-3.5 w-3.5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><BarChart3 className="h-4 w-4" /> Funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {funnelSteps.map((step, idx) => {
              const max = funnelSteps[0].count || 1;
              const stepPct = Math.round((step.count / max) * 100);
              return (
                <div key={idx}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground">{step.label}</span>
                    <span className="font-medium">{step.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(stepPct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Delivery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Send className="h-3.5 w-3.5" /> Sent</span>
              <span className="font-medium">{totalSent}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground"><XCircle className="h-3.5 w-3.5" /> Failed</span>
              <span className="font-medium">{totalFailed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground"><MousePointerClick className="h-3.5 w-3.5" /> Link Clicks</span>
              <span className="font-medium">{clicks.total}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
