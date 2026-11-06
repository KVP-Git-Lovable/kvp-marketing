// Pure calculations for the Journey Analytics panel. Works for retailer journeys
// (people keyed by retailer_id) and marketing journeys (keyed by contact_id).

export interface LogRow {
  id: string;
  node_id: string | null;
  status: string;
  created_at: string;
  contact_id: string | null;
  retailer_id: string | null;
  channel?: string | null;
}
export interface EventRow { journey_message_log_id: string | null; event_type: string; occurred_at: string }
export interface EnrollmentRow { id: string; status: string; enrolled_at: string }
export interface ClickRow { person: string; clicked_at: string }
export interface InboundRow { from_number: string | null; created_at: string }
export interface MessageNode { id: string; type: string; data?: { template_name?: string; label?: string } }

export interface AnalyticsInput {
  logs: LogRow[];
  events: EventRow[];
  enrollments: EnrollmentRow[];
  clicks: ClickRow[];
  inbound: InboundRow[];
  /** person key (contact_id / retailer_id) -> phone */
  phones: Map<string, string>;
  /** message nodes in journey order */
  nodes: MessageNode[];
  enrolledCount: number;
  completedCount: number;
  rangeFrom?: Date;
}

export const last10 = (p: string | null | undefined) => String(p || "").replace(/\D/g, "").slice(-10);
export const personKey = (l: { contact_id: string | null; retailer_id: string | null }) => l.contact_id || l.retailer_id || null;

const DELIVERED = new Set(["delivered", "read"]);
const FAILED = new Set(["failed", "rate_limited"]);

export const FUNNEL_COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#f97316"];

export function computeJourneyAnalytics(input: AnalyticsInput) {
  const { logs, events, enrollments, clicks, inbound, phones, nodes } = input;
  const messageLogs = logs.filter((l) => !l.channel || l.channel === "whatsapp");
  const eventTime = new Map<string, number>();
  for (const e of events) {
    if (e.journey_message_log_id) eventTime.set(`${e.journey_message_log_id}:${e.event_type}`, new Date(e.occurred_at).getTime());
  }
  const tsFor = (l: LogRow, type: string) => eventTime.get(`${l.id}:${type}`) ?? new Date(l.created_at).getTime();

  const sent = new Set<string>();
  const delivered = new Set<string>();
  const read = new Set<string>();
  const failedOnly = new Set<string>();
  const firstSent = new Map<string, number>();
  const phoneToKey = new Map<string, string>();
  for (const [key, phone] of phones) { const p = last10(phone); if (p) phoneToKey.set(p, key); }

  for (const l of messageLogs) {
    const key = personKey(l);
    if (!key) continue;
    if (l.status !== "queued") sent.add(key);
    if (DELIVERED.has(l.status)) delivered.add(key);
    if (l.status === "read") read.add(key);
    const t = new Date(l.created_at).getTime();
    if (!firstSent.has(key) || t < firstSent.get(key)!) firstSent.set(key, t);
  }
  for (const k of sent) if (!delivered.has(k)) failedOnly.add(k);

  const clicked = new Set<string>();
  for (const c of clicks) if (c.person) clicked.add(c.person);

  const replied = new Set<string>();
  const replyEvents: Array<{ key: string; at: number }> = [];
  for (const m of inbound) {
    const key = phoneToKey.get(last10(m.from_number));
    if (!key) continue;
    const first = firstSent.get(key);
    const at = new Date(m.created_at).getTime();
    if (first === undefined || at < first) continue;
    replied.add(key);
    replyEvents.push({ key, at });
  }

  const entered = input.enrolledCount || enrollments.length;
  const completed = input.completedCount;
  const active = enrollments.filter((e) => e.status === "active").length;
  const pct = (n: number) => (entered > 0 ? (n / entered) * 100 : 0);

  const funnel = [
    { label: "Entered Journey", count: entered },
    { label: "Delivered", count: delivered.size },
    { label: "Read", count: read.size },
    { label: "Clicked", count: clicked.size },
    { label: "Replied", count: replied.size },
  ];

  // Per-message-node performance (unique people).
  const nodeRows = nodes.map((n) => {
    const nl = messageLogs.filter((l) => l.node_id === n.id);
    const set = (pred: (l: LogRow) => boolean) => new Set(nl.filter(pred).map(personKey).filter(Boolean) as string[]);
    const s = set((l) => l.status !== "queued");
    const d = set((l) => DELIVERED.has(l.status));
    const r = set((l) => l.status === "read");
    const f = set((l) => FAILED.has(l.status));
    return {
      nodeId: n.id, label: n.data?.template_name || n.data?.label || "Message",
      sent: s.size, delivered: d.size, read: r.size, failed: f.size,
      pending: nl.filter((l) => l.status === "queued").length,
    };
  });

  // Daily trend.
  const from = input.rangeFrom?.getTime();
  const within = (t: number) => from === undefined || t >= from;
  const dayMap = new Map<string, { delivered: number; read: number; clicked: number; replied: number }>();
  const bump = (t: number, k: "delivered" | "read" | "clicked" | "replied") => {
    if (!within(t)) return;
    const d = new Date(t).toISOString().slice(0, 10);
    if (!dayMap.has(d)) dayMap.set(d, { delivered: 0, read: 0, clicked: 0, replied: 0 });
    dayMap.get(d)![k]++;
  };
  for (const l of messageLogs) {
    if (DELIVERED.has(l.status)) bump(tsFor(l, "delivered"), "delivered");
    if (l.status === "read") bump(tsFor(l, "read"), "read");
  }
  for (const c of clicks) bump(new Date(c.clicked_at).getTime(), "clicked");
  for (const r of replyEvents) bump(r.at, "replied");
  const trend = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v }));

  // Best-time heatmap (day of week x hour) of reads.
  const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const l of messageLogs) {
    if (l.status !== "read") continue;
    const d = new Date(tsFor(l, "read"));
    if (!within(d.getTime())) continue;
    heat[d.getDay()][d.getHours()]++;
  }

  // Audience segments (unique people).
  const segments = { highlyEngaged: 0, warm: 0, cold: 0, lost: 0 };
  for (const k of sent) {
    if (read.has(k) && clicked.has(k) && replied.has(k)) segments.highlyEngaged++;
    else if (read.has(k)) segments.warm++;
    else if (delivered.has(k)) segments.cold++;
    else segments.lost++;
  }

  // Health score (same weights as the reference implementation).
  const deliveryRate = pct(delivered.size), readRate = pct(read.size), replyRate = pct(replied.size), failRate = pct(failedOnly.size);
  let health = Math.min(30, deliveryRate * 0.3) + Math.min(30, readRate * 0.4) + Math.min(20, replyRate * 2) - Math.min(20, failRate);
  health = Math.max(0, Math.min(100, Math.round(health + 40)));
  const strengths: string[] = [], areas: string[] = [];
  if (deliveryRate >= 90) strengths.push("High delivery rate"); else areas.push("Delivery rate below 90%");
  if (readRate >= 60) strengths.push("Good read rate"); else areas.push("Read rate below 60%");
  if (replyRate >= 5) strengths.push("Engagement improving"); else areas.push("Reply rate is low");
  if (failRate >= 5) areas.push("Failed deliveries elevated");

  const insights: Array<{ kind: "info" | "warn" | "success"; text: string }> = [];
  if (entered > 0) {
    if (readRate > 60) insights.push({ kind: "success", text: `Strong read rate at ${readRate.toFixed(1)}%` });
    else if (readRate < 30 && entered > 20) insights.push({ kind: "warn", text: `Read rate is low at ${readRate.toFixed(1)}%` });
    if (failRate > 10) insights.push({ kind: "warn", text: `Failed delivery rate is high (${failRate.toFixed(1)}%)` });
  }
  let bestH = -1, bestV = 0;
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) if (heat[d][h] > bestV) { bestV = heat[d][h]; bestH = h; }
  if (bestH >= 0 && bestV > 3) insights.push({ kind: "info", text: `Best engagement around ${bestH}:00–${bestH + 1}:00` });

  const sentCount = messageLogs.filter((l) => l.status !== "queued" && !FAILED.has(l.status)).length;
  const failedCount = messageLogs.filter((l) => FAILED.has(l.status)).length;

  return {
    kpis: {
      entered, active, completed,
      deliveryRate, readRate, clickRate: pct(clicked.size), replyRate,
      sent: sentCount, failed: failedCount, clicks: clicks.length,
    },
    funnel, nodeRows, trend, heat, segments, health: { score: health, strengths, areas }, insights,
  };
}
