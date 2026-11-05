import { useState, useMemo, useCallback, useRef } from "react";
import { ACTIVE_PROFILE } from '@/lib/activeUserFilter';
import { Task, useTimeLogs } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft, ChevronRight, Clock, TrendingUp, Filter, X
} from "lucide-react";
import {
  format, startOfWeek, addDays, addWeeks, subWeeks, isToday,
  startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths,
  eachWeekOfInterval, isSameMonth
} from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  tasks: Task[];
  projectId: string;
  onTaskClick?: (task: Task) => void;
}

interface TimeEntryForm {
  taskId: string;
  date: string;
  hours: string;
  workType: string;
  description: string;
  allocation: "billable" | "non-billable";
}

const WORK_TYPES = [
  "Internal Meeting / Planning",
  "Development or Executing",
  "Testing",
  "Customer Meeting",
  "Documentation",
] as const;

type ViewMode = "week" | "month";

export function TimesheetView({ tasks, projectId, onTaskClick }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: timeLogs = [] } = useTimeLogs(projectId);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");

  // Time entry dialog
  const [entryForm, setEntryForm] = useState<TimeEntryForm | null>(null);

  // Filters
  const [filterMember, setFilterMember] = useState<string>("me");
  const [filterPeriod, setFilterPeriod] = useState<string>("all");

  // Drill-down from month view
  const [drillWeekDate, setDrillWeekDate] = useState<Date | null>(null);

  // Fetch project members for filter
  const { data: projectMembers = [] } = useQuery({
    queryKey: ["pm_timesheet_members", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name").match(ACTIVE_PROFILE)
        .order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string }[];
    },
  });

  // Week calculations
  const weekStart = startOfWeek(drillWeekDate || currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Month calculations
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Filter tasks: only tasks where user is owner or collaborator
  const myTasks = useMemo(() => {
    if (!user) return [];
    return tasks.filter(t => {
      if (t.parent_task_id) return false;
      // Show only tasks owned by or collaborated on by filter user
      const targetUser = filterMember === "me" ? user.id : filterMember === "all" ? null : filterMember;
      if (!targetUser) return t.status !== "done";
      return t.assignee_id === targetUser || t.collaborator_id === targetUser;
    });
  }, [tasks, user, filterMember]);

  // Also filter by collaborator table
  const { data: myCollabTaskIds = [] } = useQuery({
    queryKey: ["pm_my_collab_tasks", projectId, filterMember, user?.id],
    queryFn: async () => {
      const targetUser = filterMember === "me" ? user!.id : filterMember === "all" ? null : filterMember;
      if (!targetUser) return [];
      const { data, error } = await supabase
        .from("pm_task_collaborators")
        .select("task_id")
        .eq("user_id", targetUser);
      if (error) throw error;
      return (data || []).map(d => d.task_id);
    },
    enabled: !!user,
  });

  const timesheetTasks = useMemo(() => {
    if (!user) return [];
    const targetUser = filterMember === "me" ? user.id : filterMember === "all" ? null : filterMember;
    if (!targetUser) {
      return tasks.filter(t => !t.parent_task_id && t.status !== "done");
    }
    const collabSet = new Set(myCollabTaskIds);
    return tasks.filter(t => {
      if (t.parent_task_id) return false;
      if (t.status === "done") return false;
      return t.assignee_id === targetUser || t.collaborator_id === targetUser || collabSet.has(t.id);
    });
  }, [tasks, user, filterMember, myCollabTaskIds]);

  // Sorted stably by id to prevent shifting
  const stableTasks = useMemo(() => {
    return [...timesheetTasks].sort((a, b) => a.id.localeCompare(b.id));
  }, [timesheetTasks]);

  // Build log maps
  const logMap = useMemo(() => {
    const map: Record<string, number> = {};
    timeLogs.forEach((log: any) => {
      const key = `${log.task_id}-${log.date}`;
      map[key] = (map[key] || 0) + Number(log.hours);
    });
    return map;
  }, [timeLogs]);

  const allocationMap = useMemo(() => {
    const billable: Record<string, number> = {};
    const nonBillable: Record<string, number> = {};
    timeLogs.forEach((log: any) => {
      const key = `${log.task_id}-${log.date}`;
      if (log.allocation === "non-billable") {
        nonBillable[key] = (nonBillable[key] || 0) + Number(log.hours);
      } else {
        billable[key] = (billable[key] || 0) + Number(log.hours);
      }
    });
    return { billable, nonBillable };
  }, [timeLogs]);

  const totalLoggedByTask = useMemo(() => {
    const map: Record<string, number> = {};
    timeLogs.forEach((log: any) => {
      map[log.task_id] = (map[log.task_id] || 0) + Number(log.hours);
    });
    return map;
  }, [timeLogs]);

  // Week totals
  const weekTotalByTask = useMemo(() => {
    const map: Record<string, number> = {};
    stableTasks.forEach(t => {
      let total = 0;
      weekDays.forEach(day => {
        const key = `${t.id}-${format(day, "yyyy-MM-dd")}`;
        total += logMap[key] || 0;
      });
      map[t.id] = total;
    });
    return map;
  }, [stableTasks, weekDays, logMap]);

  const dayTotals = useMemo(() => {
    const days = viewMode === "week" ? weekDays : monthDays;
    return days.map(day => {
      let total = 0;
      stableTasks.forEach(t => {
        const key = `${t.id}-${format(day, "yyyy-MM-dd")}`;
        total += logMap[key] || 0;
      });
      return total;
    });
  }, [viewMode, weekDays, monthDays, stableTasks, logMap]);

  const grandTotal = dayTotals.reduce((s, v) => s + v, 0);

  // Billable / non-billable totals for summary
  const billableTotals = useMemo(() => {
    const days = viewMode === "week" ? weekDays : monthDays;
    let billable = 0;
    let nonBillable = 0;
    days.forEach(day => {
      stableTasks.forEach(t => {
        const key = `${t.id}-${format(day, "yyyy-MM-dd")}`;
        billable += allocationMap.billable[key] || 0;
        nonBillable += allocationMap.nonBillable[key] || 0;
      });
    });
    return { billable, nonBillable };
  }, [viewMode, weekDays, monthDays, stableTasks, allocationMap]);

  // Month day totals (sum per day of month for each task)
  const monthDayTotalByTask = useMemo(() => {
    if (viewMode !== "month") return {};
    const map: Record<string, number> = {};
    stableTasks.forEach(t => {
      monthDays.forEach(day => {
        const dayKey = format(day, "d");
        const logKey = `${t.id}-${format(day, "yyyy-MM-dd")}`;
        const mapKey = `${t.id}-${dayKey}`;
        map[mapKey] = (map[mapKey] || 0) + (logMap[logKey] || 0);
      });
    });
    return map;
  }, [viewMode, stableTasks, monthDays, logMap]);

  const handleCellClick = (taskId: string, date: string) => {
    // Get existing log details
    const existing = timeLogs.find((l: any) => l.task_id === taskId && l.date === date);
    setEntryForm({
      taskId,
      date,
      hours: existing ? String(existing.hours) : "",
      workType: (existing as any)?.work_type || "",
      description: existing?.description || "",
      allocation: (existing as any)?.allocation || "billable",
    });
  };

  const handleSave = useCallback(async () => {
    if (!entryForm || !user) return;
    const hours = parseFloat(entryForm.hours);
    if (isNaN(hours) || hours <= 0) {
      toast.error("Please enter valid hours");
      return;
    }
    if (!entryForm.workType) {
      toast.error("Please select a work type");
      return;
    }
    if (!entryForm.description.trim()) {
      toast.error("Please enter a description");
      return;
    }
    if (!entryForm.allocation) {
      toast.error("Please select an allocation");
      return;
    }

    setSaving(true);
    try {
      await supabase
        .from("pm_time_logs")
        .delete()
        .eq("task_id", entryForm.taskId)
        .eq("date", entryForm.date)
        .eq("user_id", user.id)
        .eq("project_id", projectId);

      if (hours > 0) {
        const { error } = await supabase
          .from("pm_time_logs")
          .insert({
            task_id: entryForm.taskId,
            project_id: projectId,
            user_id: user.id,
            date: entryForm.date,
            hours,
            work_type: entryForm.workType,
            description: entryForm.description || null,
            allocation: entryForm.allocation,
          });
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["pm_time_logs", projectId] });
      queryClient.invalidateQueries({ queryKey: ["pm_tasks", projectId] });
      toast.success("Time logged");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
      setEntryForm(null);
    }
  }, [entryForm, user, projectId, queryClient]);

  const handleMonthDayClick = (day: Date) => {
    setDrillWeekDate(day);
    setViewMode("week");
  };

  const getVarianceColor = (estimated: number, logged: number) => {
    if (!estimated) return "text-muted-foreground";
    const ratio = logged / estimated;
    if (ratio > 1.1) return "text-destructive";
    if (ratio > 0.9) return "text-amber-600";
    return "text-green-600";
  };

  const navigatePrev = () => {
    if (viewMode === "week") setCurrentDate(d => subWeeks(d, 1));
    else setCurrentDate(d => subMonths(d, 1));
    setDrillWeekDate(null);
  };

  const navigateNext = () => {
    if (viewMode === "week") setCurrentDate(d => addWeeks(d, 1));
    else setCurrentDate(d => addMonths(d, 1));
    setDrillWeekDate(null);
  };

  const resetToNow = () => {
    setCurrentDate(new Date());
    setDrillWeekDate(null);
  };

  const activeDays = viewMode === "week" ? weekDays : monthDays;
  const periodLabel = viewMode === "week"
    ? `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d, yyyy")}`
    : format(currentDate, "MMMM yyyy");

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Timesheet</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode */}
          <div className="flex border rounded-md overflow-hidden">
            <button
              onClick={() => { setViewMode("week"); setDrillWeekDate(null); }}
              className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "week" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}
            >
              Week
            </button>
            <button
              onClick={() => { setViewMode("month"); setDrillWeekDate(null); }}
              className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "month" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}
            >
              Month
            </button>
          </div>

          {/* Filters */}
          <Select value={filterMember} onValueChange={setFilterMember}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Team member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="me">My Tasks</SelectItem>
              <SelectItem value="all">All Members</SelectItem>
              {projectMembers.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.full_name || "Unknown"}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Navigation */}
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={resetToNow}>
            {viewMode === "week" ? "This Week" : "This Month"}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigatePrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">{periodLabel}</span>
        </div>
      </div>

      {drillWeekDate && viewMode === "week" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            onClick={() => { setViewMode("month"); setDrillWeekDate(null); }}
            className="text-primary hover:underline"
          >
            ← Back to Month View
          </button>
          <span>Drilling into week of {format(weekStart, "MMM d")}</span>
        </div>
      )}

      {/* Timesheet Grid */}
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="overflow-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="border-b bg-muted/50 backdrop-blur">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[260px] min-w-[260px] sticky left-0 bg-muted/50 z-30">
                  Task
                </th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-14 min-w-[56px] bg-muted/50">
                  Est.
                </th>
                {activeDays.map((day, i) => (
                  <th
                    key={i}
                    className={cn(
                      "text-center px-0.5 py-2.5 font-medium min-w-[52px] bg-muted/50",
                      viewMode === "week" && isToday(day) ? "text-primary" : "text-muted-foreground",
                      viewMode === "week" && (i === 5 || i === 6) && "bg-muted/30"
                    )}
                  >
                    {viewMode === "week" ? (
                      <>
                        <div className="text-[10px] uppercase">{format(day, "EEE")}</div>
                        <div className={cn("text-xs", isToday(day) && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center mx-auto")}>
                          {format(day, "d")}
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => handleMonthDayClick(day)}
                        className="text-xs hover:text-primary hover:underline cursor-pointer"
                        title={`Click to view week of ${format(day, "MMM d")}`}
                      >
                        {format(day, "d")}
                      </button>
                    )}
                  </th>
                ))}
                {viewMode === "week" && (
                  <>
                    <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-14 min-w-[56px] bg-muted/50">
                      Week
                    </th>
                    <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-14 min-w-[56px] bg-muted/50">
                      Total
                    </th>
                    <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-16 min-w-[64px] bg-muted/50">
                      <TrendingUp className="w-3.5 h-3.5 inline mr-1" />Var.
                    </th>
                  </>
                )}
                {viewMode === "month" && (
                  <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-14 min-w-[56px] bg-muted/50">
                    Month
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {stableTasks.length === 0 && (
                <tr>
                  <td colSpan={99} className="text-center py-8 text-muted-foreground">
                    No tasks assigned to you. Create tasks or get assigned first.
                  </td>
                </tr>
              )}
              {stableTasks.map((task) => {
                const estimated = task.estimated_hours || 0;
                const totalLogged = totalLoggedByTask[task.id] || 0;
                const weekTotal = weekTotalByTask[task.id] || 0;
                const variance = estimated > 0 ? totalLogged - estimated : 0;

                // Month total for this task
                let monthTotal = 0;
                if (viewMode === "month") {
                  monthDays.forEach(day => {
                    const key = `${task.id}-${format(day, "yyyy-MM-dd")}`;
                    monthTotal += logMap[key] || 0;
                  });
                }

                return (
                  <tr key={task.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-2 max-w-[240px]">
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full flex-shrink-0",
                            task.status === "in_progress" ? "bg-amber-500" :
                            task.status === "todo" ? "bg-muted-foreground" :
                            "bg-green-500"
                          )}
                        />
                        <button
                          onClick={() => onTaskClick?.(task)}
                          className="truncate text-foreground text-xs hover:text-primary hover:underline text-left cursor-pointer transition-colors"
                          title={task.title}
                        >
                          {task.title}
                        </button>
                      </div>
                    </td>
                    <td className="text-center px-2 py-2 text-muted-foreground text-xs tabular-nums">
                      {estimated > 0 ? `${estimated}h` : "–"}
                    </td>

                    {activeDays.map((day, i) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const key = `${task.id}-${dateStr}`;
                      const hours = logMap[key] || 0;

                      if (viewMode === "month") {
                        return (
                          <td key={i} className="text-center px-0.5 py-1">
                            <button
                              onClick={() => handleCellClick(task.id, dateStr)}
                              className={cn(
                                "w-10 h-6 rounded text-[11px] tabular-nums mx-auto flex items-center justify-center transition-colors",
                                hours > 0
                                  ? "bg-primary/10 text-primary font-medium hover:bg-primary/20"
                                  : "hover:bg-muted text-muted-foreground/40 hover:text-muted-foreground"
                              )}
                            >
                              {hours > 0 ? hours : "·"}
                            </button>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={i}
                          className={cn(
                            "text-center px-0.5 py-1",
                            (i === 5 || i === 6) && "bg-muted/20"
                          )}
                        >
                          <button
                            onClick={() => handleCellClick(task.id, dateStr)}
                            className={cn(
                              "w-12 h-7 rounded text-xs tabular-nums mx-auto flex items-center justify-center transition-colors",
                              hours > 0
                                ? "bg-primary/10 text-primary font-medium hover:bg-primary/20"
                                : "hover:bg-muted text-muted-foreground/50 hover:text-muted-foreground"
                            )}
                          >
                            {hours > 0 ? hours : "–"}
                          </button>
                        </td>
                      );
                    })}

                    {viewMode === "week" && (
                      <>
                        <td className="text-center px-2 py-2 text-xs font-semibold tabular-nums text-foreground">
                          {weekTotal > 0 ? `${weekTotal}h` : "–"}
                        </td>
                        <td className="text-center px-2 py-2 text-xs tabular-nums text-foreground">
                          {totalLogged > 0 ? `${totalLogged}h` : "–"}
                        </td>
                        <td className={cn("text-center px-2 py-2 text-xs font-medium tabular-nums", getVarianceColor(estimated, totalLogged))}>
                          {estimated > 0 ? (variance > 0 ? `+${variance}h` : `${variance}h`) : "–"}
                        </td>
                      </>
                    )}
                    {viewMode === "month" && (
                      <td className="text-center px-2 py-2 text-xs font-semibold tabular-nums text-foreground">
                        {monthTotal > 0 ? `${monthTotal}h` : "–"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="sticky bottom-0 z-20">
              <tr className="border-t bg-muted/50 backdrop-blur font-semibold text-xs">
                <td className="px-3 py-2.5 sticky left-0 bg-muted/50 z-30 text-foreground">
                  Daily Total
                </td>
                <td className="text-center px-2 py-2.5 text-muted-foreground bg-muted/50">
                  {stableTasks.reduce((s, t) => s + (t.estimated_hours || 0), 0)}h
                </td>
                {dayTotals.map((total, i) => (
                  <td
                    key={i}
                    className={cn(
                      "text-center px-0.5 py-2.5 tabular-nums bg-muted/50",
                      viewMode === "week" && (i === 5 || i === 6) && "bg-muted/30",
                      total > 0 ? "text-foreground" : "text-muted-foreground/50"
                    )}
                  >
                    {total > 0 ? `${total}h` : "–"}
                  </td>
                ))}
                {viewMode === "week" && (
                  <>
                    <td className="text-center px-2 py-2.5 tabular-nums text-primary bg-muted/50">
                      {grandTotal > 0 ? `${grandTotal}h` : "–"}
                    </td>
                    <td className="text-center px-2 py-2.5 tabular-nums text-foreground bg-muted/50">
                      {Object.values(totalLoggedByTask).reduce((s, v) => s + v, 0) > 0
                        ? `${Object.values(totalLoggedByTask).reduce((s, v) => s + v, 0)}h`
                        : "–"}
                    </td>
                    <td className="bg-muted/50" />
                  </>
                )}
                {viewMode === "month" && (
                  <td className="text-center px-2 py-2.5 tabular-nums text-primary bg-muted/50">
                    {grandTotal > 0 ? `${grandTotal}h` : "–"}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-[10px] uppercase text-muted-foreground font-medium">
            {viewMode === "week" ? "This Week" : "This Month"}
          </div>
          <div className="text-lg font-bold text-foreground tabular-nums">{grandTotal}h</div>
        </div>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-[10px] uppercase text-muted-foreground font-medium">Estimated</div>
          <div className="text-lg font-bold text-foreground tabular-nums">
            {stableTasks.reduce((s, t) => s + (t.estimated_hours || 0), 0)}h
          </div>
        </div>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-[10px] uppercase text-muted-foreground font-medium">Total Logged</div>
          <div className="text-lg font-bold text-foreground tabular-nums">
            {Object.values(totalLoggedByTask).reduce((s, v) => s + v, 0)}h
          </div>
        </div>
        <div className="border rounded-lg p-3 bg-card border-green-500/30">
          <div className="text-[10px] uppercase text-green-600 font-medium">Billable</div>
          <div className="text-lg font-bold text-green-600 tabular-nums">{billableTotals.billable}h</div>
        </div>
        <div className="border rounded-lg p-3 bg-card border-amber-500/30">
          <div className="text-[10px] uppercase text-amber-600 font-medium">Non-Billable</div>
          <div className="text-lg font-bold text-amber-600 tabular-nums">{billableTotals.nonBillable}h</div>
        </div>
      </div>

      {/* Time Entry Dialog */}
      <Dialog open={!!entryForm} onOpenChange={(open) => { if (!open) setEntryForm(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base">Log Time</DialogTitle>
          </DialogHeader>
          {entryForm && (() => {
            const entryTask = stableTasks.find(t => t.id === entryForm.taskId);
            return (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {entryTask?.title || "Task"} — {format(new Date(entryForm.date + "T00:00:00"), "EEE, MMM d")}
              </div>

              {/* Read-only task info */}
              <div className="flex gap-4 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 border border-border/50">
                <div>
                  <span className="uppercase tracking-wider font-medium">Est. Hours: </span>
                  <span className="tabular-nums">{entryTask?.estimated_hours ? `${entryTask.estimated_hours}h` : "–"}</span>
                </div>
                <div>
                  <span className="uppercase tracking-wider font-medium">Due Date: </span>
                  <span>{entryTask?.due_date ? format(new Date(entryTask.due_date + "T00:00:00"), "MMM d, yyyy") : "–"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Hours <span className="text-destructive">*</span></Label>
                <Input
                  autoFocus
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  value={entryForm.hours}
                  onChange={e => setEntryForm({ ...entryForm, hours: e.target.value })}
                  placeholder="0"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Work Type <span className="text-destructive">*</span></Label>
                <Select
                  value={entryForm.workType}
                  onValueChange={(v) => setEntryForm({ ...entryForm, workType: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select work type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_TYPES.map(wt => (
                      <SelectItem key={wt} value={wt}>{wt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Brief Description <span className="text-destructive">*</span></Label>
                <Textarea
                  value={entryForm.description}
                  onChange={e => setEntryForm({ ...entryForm, description: e.target.value })}
                  placeholder="What did you work on?"
                  className="min-h-[60px] text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Allocation <span className="text-destructive">*</span></Label>
                <Select
                  value={entryForm.allocation}
                  onValueChange={(v: "billable" | "non-billable") => setEntryForm({ ...entryForm, allocation: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="billable">Billable</SelectItem>
                    <SelectItem value="non-billable">Non-Billable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEntryForm(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
