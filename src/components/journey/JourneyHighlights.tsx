import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Star, Check } from "lucide-react";
import { format } from "date-fns";
import { objectiveLabel } from "@/lib/journeyCampaign";
import { computeJourneyAnalytics, type LogRow } from "@/lib/journeyAnalytics";
import { journeyStatusPath, timeElapsedPct, budgetUsedPct, budgetTone } from "@/lib/journeyStatusPath";

interface JourneyHighlightsProps {
  journeyId: string;
  journey: {
    status: string;
    approval_status: string;
    objective?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    budget_cap?: number | null;
    owner_id?: string | null;
    created_by?: string | null;
    enrolled_count: number;
    completed_count: number;
    sent_message_count: number;
    cost_settings: { whatsapp_cost_per_message: number } | null;
  };
  /** Total Meta spend (₹) across this journey's linked ad sets, from the cached insights. */
  metaSpend: number;
}

const PAGE = 1000;
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const toneClass = { ok: "bg-primary", warn: "bg-amber-500", bad: "bg-red-600" } as const;

function Bar({ label, pct, caption, tone = "ok" }: { label: string; pct: number | null; caption: string; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="min-w-[180px] flex-1">
      <div className="flex justify-between text-[11px] text-muted-foreground mb-1"><span>{label}</span><span>{caption}</span></div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${toneClass[tone]}`} style={{ width: `${pct === null ? 0 : Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  );
}

/** Salesforce-style campaign header: status path, key fields and progress bars. Read-only. */
export function JourneyHighlights({ journeyId, journey, metaSpend }: JourneyHighlightsProps) {
  const ownerId = journey.owner_id || journey.created_by;
  const { data: ownerName } = useQuery({
    queryKey: ["journey-owner-name", ownerId],
    enabled: !!ownerId,
    staleTime: 10 * 60_000,
    queryFn: async () => (await supabase.from("profiles").select("full_name").eq("id", ownerId!).maybeSingle()).data?.full_name ?? null,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["jh-logs", journeyId],
    staleTime: 60_000,
    queryFn: async () => {
      const out: LogRow[] = [];
      for (let from = 0, i = 0; i < 100; i++, from += PAGE) {
        const { data, error } = await supabase.from("journey_message_log")
          .select("id, node_id, status, created_at, contact_id, retailer_id, channel").eq("journey_id", journeyId).order("created_at").range(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...((data || []) as LogRow[]));
        if (!data || data.length < PAGE) break;
      }
      return out;
    },
  });

  const health = logs.length > 0
    ? computeJourneyAnalytics({
        logs, events: [], enrollments: [], clicks: [], inbound: [], phones: new Map(), nodes: [],
        enrolledCount: journey.enrolled_count, completedCount: journey.completed_count,
      }).health.score
    : null;
  const stars = health === null ? null : Math.max(1, Math.min(5, Math.round(health / 20)));

  const path = journeyStatusPath(journey.status, journey.approval_status);
  const whatsappEstimate = journey.sent_message_count * (journey.cost_settings?.whatsapp_cost_per_message || 0);
  const used = whatsappEstimate + (metaSpend || 0);
  const usedPct = budgetUsedPct(used, journey.budget_cap);
  const timePct = timeElapsedPct(journey.start_date, journey.end_date);
  const daysLeft = journey.end_date ? Math.ceil((new Date(journey.end_date).getTime() - Date.now()) / 86400000) : null;
  const audiencePct = journey.enrolled_count > 0 ? (journey.completed_count / journey.enrolled_count) * 100 : null;
  const fmt = (iso?: string | null) => (iso ? format(new Date(iso), "dd MMM yyyy") : "—");

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-stretch overflow-x-auto border-b">
        {path.stages.map((s, i) => (
          <div key={s.key}
            className={`flex-1 min-w-[110px] px-3 py-2 text-center text-xs font-medium relative ${
              s.state === "current" ? "bg-primary text-primary-foreground" : s.state === "done" ? "bg-primary/10 text-primary" : "text-muted-foreground"
            } ${i === 0 ? "rounded-tl-lg" : ""} ${i === path.stages.length - 1 ? "rounded-tr-lg" : "border-r"}`}>
            {s.state === "done" && <Check className="inline h-3 w-3 mr-1" />}{s.label}
          </div>
        ))}
        {path.chips.length > 0 && (
          <div className="flex items-center gap-1 px-3">
            {path.chips.map((c) => (
              <Badge key={c.label} className={c.tone === "bad" ? "bg-red-100 text-red-800" : c.tone === "warn" ? "bg-yellow-100 text-yellow-800" : "bg-muted text-muted-foreground"}>{c.label}</Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-x-4 gap-y-2 px-4 py-3 text-sm">
        {([
          ["Type", objectiveLabel(journey.objective) || "—"],
          ["Owner", ownerName || "—"],
          ["Start", fmt(journey.start_date)],
          ["End", fmt(journey.end_date)],
          ["Budget", journey.budget_cap ? inr(Number(journey.budget_cap)) : "No cap"],
          ["Audience", journey.enrolled_count.toLocaleString("en-IN")],
        ] as const).map(([k, v]) => (
          <div key={k}><p className="text-[11px] text-muted-foreground">{k}</p><p className="font-medium truncate">{v}</p></div>
        ))}
        <div title="Based on delivery, read and failure rates of this journey's messages">
          <p className="text-[11px] text-muted-foreground">Effectiveness</p>
          <p className="flex">
            {stars === null ? <span className="text-muted-foreground">—</span> : [1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className={`h-4 w-4 ${n <= stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
            ))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-3 px-4 pb-3">
        <Bar label="Time elapsed" pct={timePct} caption={timePct === null ? "No end date" : daysLeft !== null && daysLeft >= 0 ? `${daysLeft} day(s) left` : "Ended"} />
        <Bar label="Audience completed" pct={audiencePct} caption={`${journey.completed_count} / ${journey.enrolled_count}`} />
        <Bar label="Budget used" pct={usedPct} tone={budgetTone(usedPct)}
          caption={journey.budget_cap ? `${inr(used)} of ${inr(Number(journey.budget_cap))}` : `${inr(used)} (no cap set)`} />
      </div>
    </div>
  );
}
