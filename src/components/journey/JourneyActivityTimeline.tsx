import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { format } from "date-fns";

interface Item { at: string; title: string; detail?: string }

const fmt = (iso: string) => format(new Date(iso), "dd MMM yyyy, p");

/** Read-only "Activity" feed assembled from data the journey already stores. */
export function JourneyActivityTimeline({ journeyId }: { journeyId: string }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["journey-activity", journeyId],
    queryFn: async () => {
      const { data: j, error } = await supabase.from("journeys").select("*").eq("id", journeyId).single();
      if (error) throw error;
      const row = j as Record<string, any>;
      const userIds = [row.created_by, row.approved_by, row.owner_id].filter(Boolean) as string[];
      const { data: people } = userIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", Array.from(new Set(userIds)))
        : { data: [] as Array<{ id: string; full_name: string | null }> };
      const nameOf = (id?: string | null) => (people || []).find((p) => p.id === id)?.full_name || "a team member";

      const [first, last, count, retries] = await Promise.all([
        supabase.from("journey_message_log").select("created_at").eq("journey_id", journeyId).order("created_at").limit(1),
        supabase.from("journey_message_log").select("created_at, status").eq("journey_id", journeyId).order("created_at", { ascending: false }).limit(1),
        supabase.from("journey_message_log").select("id", { count: "exact", head: true }).eq("journey_id", journeyId),
        (supabase.from("journey_retry_schedule" as never) as any).select("scheduled_for, status, processed_at").eq("journey_id", journeyId),
      ]);

      const out: Item[] = [{ at: row.created_at, title: "Campaign created", detail: `by ${nameOf(row.created_by)}` }];
      if (row.owner_id && row.owner_id !== row.created_by) out.push({ at: row.updated_at, title: "Owner", detail: nameOf(row.owner_id) });
      if (row.approved_at) {
        out.push({
          at: row.approved_at,
          title: row.approval_status === "rejected" ? "Rejected" : "Approved",
          detail: [`by ${nameOf(row.approved_by)}`, row.approval_notes ? `Note: ${row.approval_notes}` : ""].filter(Boolean).join(" · "),
        });
      } else if (row.approval_status === "pending") {
        out.push({ at: row.updated_at, title: "Submitted for approval" });
      }
      if (row.start_date) out.push({ at: row.start_date, title: new Date(row.start_date) > new Date() ? "Scheduled to start" : "Campaign window opened" });
      if (first.data?.[0]) out.push({ at: first.data[0].created_at, title: "First message sent", detail: `${(count.count ?? 0).toLocaleString("en-IN")} message(s) logged in total` });
      if (last.data?.[0] && (count.count ?? 0) > 1) out.push({ at: last.data[0].created_at, title: "Latest message", detail: `status: ${last.data[0].status}` });
      for (const r of (retries.data || []) as Array<{ scheduled_for: string; status: string; processed_at: string | null }>) {
        out.push({ at: r.processed_at || r.scheduled_for, title: `Failed-message re-send ${r.status}`, detail: `scheduled for ${fmt(r.scheduled_for)}` });
      }
      if (row.end_date) out.push({ at: row.end_date, title: new Date(row.end_date) > new Date() ? "Scheduled to end" : "Campaign window closed" });
      out.push({ at: row.updated_at, title: `Current status: ${row.status}` });
      return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5"><Activity className="h-4 w-4" /> Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
          <ol className="relative border-l ml-2 space-y-3">
            {items.map((i, idx) => (
              <li key={idx} className="ml-4">
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border bg-background" />
                <p className="text-sm font-medium">{i.title}</p>
                <p className="text-xs text-muted-foreground">{fmt(i.at)}{i.detail ? ` · ${i.detail}` : ""}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
