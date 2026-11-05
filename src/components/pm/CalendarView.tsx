import { useState, useMemo } from "react";
import { Task, Section, useCreateTask } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import {
  format, startOfWeek, addDays, addWeeks, subWeeks, isToday,
  startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth
} from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  tasks: Task[];
  projectId: string;
  sections?: Section[];
  onTaskClick?: (task: Task) => void;
}

type ViewMode = "week" | "month";

export function CalendarView({ tasks, projectId, sections = [], onTaskClick }: Props) {
  const createTask = useCreateTask();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [inlineDate, setInlineDate] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  const uniqueAssignees = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach(t => {
      if (t.assignee_id && t.assignee?.full_name) map.set(t.assignee_id, t.assignee.full_name);
    });
    return Array.from(map.entries());
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (assigneeFilter !== "all" && t.assignee_id !== assigneeFilter) return false;
      return true;
    });
  }, [tasks, search, typeFilter, statusFilter, assigneeFilter]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthStart = startOfMonth(currentDate);
  const monthCalendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(monthCalendarStart, i));
  const days = viewMode === "week" ? weekDays : monthDays;

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    filteredTasks.forEach(t => {
      if (t.due_date) {
        const key = t.due_date.slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(t);
      }
    });
    return map;
  }, [filteredTasks]);

  const handleAddTask = async (dateStr: string) => {
    if (!inlineTitle.trim()) { setInlineDate(null); return; }
    await createTask.mutateAsync({
      project_id: projectId, title: inlineTitle.trim(), type: "task",
      status: "todo", priority: "medium", due_date: dateStr,
    });
    setInlineTitle("");
    setInlineDate(null);
  };

  const navigatePrev = () => {
    if (viewMode === "week") setCurrentDate(d => subWeeks(d, 1));
    else setCurrentDate(d => subMonths(d, 1));
  };
  const navigateNext = () => {
    if (viewMode === "week") setCurrentDate(d => addWeeks(d, 1));
    else setCurrentDate(d => addMonths(d, 1));
  };

  return (
    <div className="p-4 space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="idea">Idea</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="backlog">Backlog</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Resource" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            {uniqueAssignees.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigatePrev}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateNext}><ChevronRight className="w-4 h-4" /></Button>
          <span className="text-sm font-semibold text-foreground">{format(currentDate, "MMMM yyyy")}</span>
        </div>
        <div className="flex items-center gap-1 border rounded-lg p-0.5">
          <Button variant={viewMode === "week" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs px-3" onClick={() => setViewMode("week")}>Week</Button>
          <Button variant={viewMode === "month" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs px-3" onClick={() => setViewMode("month")}>Month</Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className={cn("grid grid-cols-7 border rounded-xl overflow-hidden bg-card")}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(dayName => (
          <div key={dayName} className="border-b border-r last:border-r-0 px-2 py-2 text-center">
            <div className="text-xs font-medium text-muted-foreground uppercase">{dayName}</div>
          </div>
        ))}
        {days.map(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDate[dateStr] || [];
          const isOutsideMonth = viewMode === "month" && !isSameMonth(day, currentDate);
          return (
            <div key={dateStr} className={cn("border-r border-b last:border-r-0 p-1.5 space-y-1", viewMode === "week" ? "min-h-[180px]" : "min-h-[100px]", isOutsideMonth && "bg-muted/20")}>
              {viewMode === "month" && (
                <div className="flex justify-end mb-0.5">
                  <div className={cn("text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full", isToday(day) && "bg-primary text-primary-foreground", isOutsideMonth && "text-muted-foreground/50")}>{format(day, "d")}</div>
                </div>
              )}
              {viewMode === "week" && (
                <div className="flex justify-center mb-1">
                  <div className={cn("text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full", isToday(day) && "bg-primary text-primary-foreground")}>{format(day, "d")}</div>
                </div>
              )}
              {dayTasks.map(task => (
                <button key={task.id} onClick={() => onTaskClick?.(task)} className="w-full text-left p-1.5 rounded-md bg-secondary/50 hover:bg-secondary text-xs truncate transition-colors border">{task.title}</button>
              ))}
              {inlineDate === dateStr ? (
                <input autoFocus value={inlineTitle} onChange={e => setInlineTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAddTask(dateStr); if (e.key === "Escape") { setInlineDate(null); setInlineTitle(""); } }}
                  onBlur={() => handleAddTask(dateStr)} placeholder="Task name..."
                  className="w-full text-xs px-1.5 py-1 rounded border bg-background outline-none focus:ring-1 focus:ring-primary" />
              ) : (
                <button onClick={() => { setInlineDate(dateStr); setInlineTitle(""); }} className="w-full text-left text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-1 py-0.5 rounded hover:bg-muted transition-colors">
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
