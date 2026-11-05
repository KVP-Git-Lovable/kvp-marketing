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
  isSameMonth, isSameDay, format, addMonths, subMonths,
} from "date-fns";
import { cn } from "@/lib/utils";

interface Journey { id: string; name: string; status: string }
interface Schedule { journey_id: string; schedule_type: string; start_at: string; next_run_at: string | null }
interface CalendarEntry { journeyId: string; name: string; time: string; scheduleType: string }

export default function CommunicationCalendar() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data: journeys = [] } = useQuery({
    queryKey: ["calendar-journeys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("journeys").select("id, name, status");
      if (error) throw error;
      return data as Journey[];
    },
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["calendar-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("journey_schedules").select("journey_id, schedule_type, start_at, next_run_at");
      if (error) throw error;
      return data as Schedule[];
    },
  });

  const journeyById = new Map(journeys.map((j) => [j.id, j]));
  const entriesByDay = new Map<string, CalendarEntry[]>();
  for (const sched of schedules) {
    const journey = journeyById.get(sched.journey_id);
    if (!journey) continue;
    const dates = new Set<string>([sched.start_at]);
    if (sched.next_run_at) dates.add(sched.next_run_at);
    for (const iso of dates) {
      const key = format(new Date(iso), "yyyy-MM-dd");
      const list = entriesByDay.get(key) || [];
      list.push({ journeyId: journey.id, name: journey.name, time: format(new Date(iso), "p"), scheduleType: sched.schedule_type });
      entriesByDay.set(key, list);
    }
  }

  const { data: dayDetail } = useQuery({
    queryKey: ["calendar-day-detail", selectedDay ? format(selectedDay, "yyyy-MM-dd") : null],
    enabled: !!selectedDay,
    queryFn: async () => {
      const key = format(selectedDay!, "yyyy-MM-dd");
      const entries = entriesByDay.get(key) || [];
      const details = await Promise.all(entries.map(async (e) => {
        const { count } = await supabase.from("journey_enrollments").select("id", { count: "exact", head: true }).eq("journey_id", e.journeyId);
        const { data: lastLog } = await supabase
          .from("journey_message_log").select("status, created_at").eq("journey_id", e.journeyId)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        return { ...e, enrolledCount: count || 0, lastStatus: lastLog?.status || null };
      }));
      return details;
    },
  });

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Calendar</h2>
          <p className="text-xs text-muted-foreground">Scheduled journey sends, read-only.</p>
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
                <div key={e.journeyId} className="mt-1 flex items-center gap-1 rounded bg-primary/10 text-primary px-1 py-0.5 truncate">
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
              <p className="text-sm text-muted-foreground">No scheduled journeys this day.</p>
            ) : (
              (dayDetail || []).map((e) => (
                <div key={e.journeyId} className="flex items-center justify-between rounded-md border p-3">
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
    </div>
  );
}
