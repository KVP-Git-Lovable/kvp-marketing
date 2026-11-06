import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, MessageCircle, Workflow } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, format, addMonths, subMonths, addDays, addWeeks,
} from "date-fns";
import { cn } from "@/lib/utils";
import { isMarketingSegment } from "@/lib/marketingSegments";

interface Schedule { schedule_type: string; start_at: string | null; next_run_at: string | null }
interface Journey {
  id: string; name: string; status: string; approval_status: string; segment_type: string;
  start_date: string | null; end_date: string | null;
  journey_schedules: Schedule[] | Schedule | null;
}
interface CalendarEntry { journeyId: string; name: string; time: string; scheduleType: string; segmentType: string; approved: boolean }

// Expands one schedule into the dates it fires on inside [from, to]. Recurring types repeat from
// the anchor until the journey's end date (or the end of the visible grid).
function occurrences(sched: Schedule, journey: Journey, from: Date, to: Date): Date[] {
  const anchorIso = sched.start_at || sched.next_run_at || journey.start_date;
  if (!anchorIso) return [];
  const anchor = new Date(anchorIso);
  const limit = journey.end_date && new Date(journey.end_date) < to ? new Date(journey.end_date) : to;
  const out: Date[] = [];
  if (sched.schedule_type === "daily" || sched.schedule_type === "weekly" || sched.schedule_type === "monthly") {
    const step = (d: Date, n: number) =>
      sched.schedule_type === "daily" ? addDays(d, n) : sched.schedule_type === "weekly" ? addWeeks(d, n) : addMonths(d, n);
    for (let n = 0, d = anchor; d <= limit && n < 1000; n++, d = step(anchor, n)) {
      if (d >= from) out.push(d);
    }
  } else if (anchor >= from && anchor <= to) {
    out.push(anchor);
  }
  return out;
}

export default function CommunicationCalendar() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Every Active journey (not deleted), with its schedule, regardless of audience type.
  const { data: journeys = [] } = useQuery({
    queryKey: ["calendar-active-journeys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journeys")
        .select("id, name, status, approval_status, segment_type, start_date, end_date, journey_schedules(schedule_type, start_at, next_run_at)")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as Journey[];
    },
  });

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const entriesByDay = new Map<string, CalendarEntry[]>();
  const unscheduled: Journey[] = [];
  for (const journey of journeys) {
    const raw = journey.journey_schedules;
    const scheds = Array.isArray(raw) ? raw : raw ? [raw] : [];
    // A journey with no schedule row still runs: place it on its start date if it has one.
    const effective: Schedule[] = scheds.length
      ? scheds
      : journey.start_date ? [{ schedule_type: "one_time", start_at: journey.start_date, next_run_at: null }] : [];
    if (!effective.length) { unscheduled.push(journey); continue; }
    for (const sched of effective) {
      for (const when of occurrences(sched, journey, gridStart, addDays(gridEnd, 1))) {
        const key = format(when, "yyyy-MM-dd");
        const list = entriesByDay.get(key) || [];
        list.push({
          journeyId: journey.id, name: journey.name, time: format(when, "p"), scheduleType: sched.schedule_type,
          segmentType: journey.segment_type, approved: journey.approval_status === "approved",
        });
        entriesByDay.set(key, list);
      }
    }
  }

  const { data: dayDetail } = useQuery({
    queryKey: ["calendar-day-detail", selectedDay ? format(selectedDay, "yyyy-MM-dd") : null, journeys.length],
    enabled: !!selectedDay,
    queryFn: async () => {
      const key = format(selectedDay!, "yyyy-MM-dd");
      const entries = entriesByDay.get(key) || [];
      return Promise.all(entries.map(async (e) => {
        const table = isMarketingSegment(e.segmentType) ? "marketing_journey_enrollments" : "journey_enrollments";
        const { count } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("journey_id", e.journeyId);
        const { data: lastLog } = await supabase
          .from("journey_message_log").select("status, created_at").eq("journey_id", e.journeyId)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        return { ...e, enrolledCount: count || 0, lastStatus: lastLog?.status || null };
      }));
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Calendar</h2>
          <p className="text-xs text-muted-foreground">Active journeys and when they run, read-only.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium w-32 text-center">{format(month, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-md border bg-border overflow-hidden text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-card px-2 py-1.5 font-medium text-muted-foreground text-center">{d}</div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const entries = entriesByDay.get(key) || [];
          const inMonth = isSameMonth(day, month);
          const selected = selectedDay && isSameDay(day, selectedDay);
          return (
            <button
              key={key}
              onClick={() => setSelectedDay(day)}
              className={cn(
                "bg-card min-h-20 p-1.5 text-left align-top hover:bg-muted/50 transition-colors",
                !inMonth && "opacity-40",
                selected && "ring-2 ring-inset ring-primary"
              )}
            >
              <div className="font-medium">{format(day, "d")}</div>
              {entries.slice(0, 2).map((e) => (
                <div key={`${e.journeyId}-${e.time}`} className={cn("mt-1 flex items-center gap-1 rounded px-1 py-0.5 truncate", e.approved ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400")}>
                  <MessageCircle className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{e.name}</span>
                </div>
              ))}
              {entries.length > 2 && <div className="text-muted-foreground mt-0.5">+{entries.length - 2} more</div>}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">{format(selectedDay, "EEEE, MMMM d, yyyy")}</p>
            {(dayDetail || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No active journeys run this day.</p>
            ) : (
              (dayDetail || []).map((e) => (
                <div key={`${e.journeyId}-${e.time}`} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5"><Workflow className="h-3.5 w-3.5" /> {e.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {e.time} · {e.scheduleType.replace("_", " ")} · {e.enrolledCount} enrolled
                      {e.lastStatus && <> · last message <Badge variant="outline" className="ml-1 text-[10px] py-0">{e.lastStatus}</Badge></>}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/communication-center?tab=journey-builder&journey=${e.journeyId}`)}>
                    Open
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
      {unscheduled.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Active, no date set ({unscheduled.length})</p>
            {unscheduled.map((j) => (
              <div key={j.id} className="flex items-center justify-between rounded-md border p-2">
                <span className="text-sm flex items-center gap-1.5"><Workflow className="h-3.5 w-3.5" /> {j.name}</span>
                <Button size="sm" variant="outline" onClick={() => navigate(`/communication-center?tab=journey-builder&journey=${j.id}`)}>Open</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
