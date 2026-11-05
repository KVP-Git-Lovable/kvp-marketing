import { useState, useRef, useCallback, useMemo } from "react";
import { Task, Project, Milestone, Section, useUpdateTask, useAllProjectDependencies } from "@/hooks/useProjects";
import { format, differenceInDays, parseISO, addDays } from "date-fns";
import { Flag, ChevronRight, ChevronDown, Download, Search, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import html2canvas from "html2canvas";
// jspdf loaded dynamically in handler

interface Props {
  tasks: Task[];
  project: Project;
  milestones: Milestone[];
  sections: Section[];
  onTaskClick?: (task: Task) => void;
}

export function GanttChart({ tasks, project, milestones, sections, onTaskClick }: Props) {
  const updateTask = useUpdateTask();
  const { data: dependencies = [] } = useAllProjectDependencies(project.id);
  const chartRef = useRef<HTMLDivElement>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [showDependencies, setShowDependencies] = useState(false);

  // Collapse state for parent tasks
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    taskId: string;
    type: "move" | "resize-left" | "resize-right";
    startX: number;
    origStart: string;
    origEnd: string;
  } | null>(null);

  // Unique assignees for filter
  const uniqueAssignees = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach(t => {
      if (t.assignee_id && t.assignee?.full_name) map.set(t.assignee_id, t.assignee.full_name);
    });
    return Array.from(map.entries());
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (assigneeFilter !== "all" && t.assignee_id !== assigneeFilter) return false;
      return true;
    });
  }, [tasks, search, typeFilter, statusFilter, assigneeFilter]);

  // Build parent→subtask hierarchy
  const { displayTasks, parentMap } = useMemo(() => {
    const parentIds = new Set(filteredTasks.filter(t => !t.parent_task_id).map(t => t.id));
    const childMap = new Map<string, Task[]>();
    const topLevel: Task[] = [];

    filteredTasks.forEach(t => {
      if (!t.parent_task_id) {
        topLevel.push(t);
      } else {
        const children = childMap.get(t.parent_task_id) || [];
        children.push(t);
        childMap.set(t.parent_task_id, children);
      }
    });

    // Build ordered list: parent, then children (if not collapsed)
    const result: Task[] = [];
    const pMap = new Map<string, boolean>(); // which tasks have children

    // Group by section
    const sectionMap = new Map<string, Task[]>();
    const noSection: Task[] = [];
    topLevel.forEach(t => {
      if (t.section_id) {
        const arr = sectionMap.get(t.section_id) || [];
        arr.push(t);
        sectionMap.set(t.section_id, arr);
      } else {
        noSection.push(t);
      }
    });

    const addTask = (t: Task) => {
      result.push(t);
      const children = childMap.get(t.id);
      if (children && children.length > 0) {
        pMap.set(t.id, true);
        if (!collapsedParents.has(t.id)) {
          children.forEach(c => result.push(c));
        }
      }
    };

    // Add section-grouped tasks first, then unsectioned
    sections.forEach(s => {
      const sTasks = sectionMap.get(s.id) || [];
      sTasks.forEach(addTask);
    });
    noSection.forEach(addTask);

    return { displayTasks: result, parentMap: pMap };
  }, [filteredTasks, collapsedParents, sections]);

  const { startDate, endDate, days } = useMemo(() => {
    const allDates: Date[] = [];
    if (project.start_date) allDates.push(parseISO(project.start_date));
    if (project.end_date) allDates.push(parseISO(project.end_date));
    displayTasks.forEach(t => {
      if (t.start_date) allDates.push(parseISO(t.start_date));
      if (t.due_date) allDates.push(parseISO(t.due_date));
    });
    milestones.forEach(m => { if (m.due_date) allDates.push(parseISO(m.due_date)); });
    if (allDates.length === 0) {
      const start = new Date();
      return { startDate: start, endDate: addDays(start, 30), days: 30 };
    }
    const start = addDays(new Date(Math.min(...allDates.map(d => d.getTime()))), -2);
    const end = addDays(new Date(Math.max(...allDates.map(d => d.getTime()))), 2);
    const totalDays = Math.max(differenceInDays(end, start) + 1, 30);
    return { startDate: start, endDate: end, days: totalDays };
  }, [project, displayTasks, milestones]);

  const DAY_WIDTH = 28;
  const ROW_H = 36;
  const LEFT_W = 260;
  const dayArray = Array.from({ length: days }, (_, i) => addDays(startDate, i));

  const getBar = (start: string, end: string) => {
    const s = parseISO(start);
    const e = parseISO(end);
    const left = Math.max(0, differenceInDays(s, startDate)) * DAY_WIDTH;
    const width = Math.max(DAY_WIDTH, (differenceInDays(e, s) + 1) * DAY_WIDTH);
    return { left, width };
  };

  const statusColors: Record<string, string> = {
    backlog: "bg-muted", todo: "bg-blue-400", in_progress: "bg-amber-400",
    in_review: "bg-purple-400", done: "bg-green-500", cancelled: "bg-red-400", overdue: "bg-red-500",
  };

  const priorityBorder: Record<string, string> = {
    critical: "border-l-4 border-l-red-500",
    high: "border-l-4 border-l-orange-500",
    medium: "border-l-4 border-l-amber-400",
    low: "border-l-4 border-l-green-500",
  };

  const toggleCollapse = (taskId: string) => {
    setCollapsedParents(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // Get section for a task
  const getSectionName = (task: Task) => {
    if (!task.section_id) return null;
    return sections.find(s => s.id === task.section_id)?.name || null;
  };

  // Get parent task name
  const getParentName = (task: Task) => {
    if (!task.parent_task_id) return null;
    return tasks.find(t => t.id === task.parent_task_id)?.title || null;
  };

  // Drag handlers
  const handleBarMouseDown = useCallback((e: React.MouseEvent, task: Task, type: "move" | "resize-left" | "resize-right") => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({ taskId: task.id, type, startX: e.clientX, origStart: task.start_date!, origEnd: task.due_date! });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - e.clientX;
      const deltaDays = Math.round(deltaX / DAY_WIDTH);
      if (deltaDays === 0) return;
      const origS = parseISO(task.start_date!);
      const origE = parseISO(task.due_date!);
      let newStart: Date, newEnd: Date;
      if (type === "move") { newStart = addDays(origS, deltaDays); newEnd = addDays(origE, deltaDays); }
      else if (type === "resize-left") { newStart = addDays(origS, deltaDays); newEnd = origE; if (newStart >= newEnd) return; }
      else { newStart = origS; newEnd = addDays(origE, deltaDays); if (newEnd <= newStart) return; }
      const bar = document.querySelector(`[data-gantt-bar="${task.id}"]`) as HTMLElement;
      if (bar) {
        const { left, width } = getBar(format(newStart, "yyyy-MM-dd"), format(newEnd, "yyyy-MM-dd"));
        bar.style.left = `${left}px`;
        bar.style.width = `${Math.max(width, 20)}px`;
        bar.dataset.newStart = format(newStart, "yyyy-MM-dd");
        bar.dataset.newEnd = format(newEnd, "yyyy-MM-dd");
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      setDragState(null);
      const bar = document.querySelector(`[data-gantt-bar="${task.id}"]`) as HTMLElement;
      if (bar?.dataset.newStart && bar?.dataset.newEnd) {
        const newStart = bar.dataset.newStart;
        const newEnd = bar.dataset.newEnd;
        if (newStart !== task.start_date || newEnd !== task.due_date) {
          updateTask.mutate({ id: task.id, start_date: newStart, due_date: newEnd });
        }
        delete bar.dataset.newStart;
        delete bar.dataset.newEnd;
      }
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [DAY_WIDTH, updateTask]);

  // Download handlers
  const downloadAsImage = async (format: "jpeg" | "png") => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current, { useCORS: true, scale: 2 });
    const link = document.createElement("a");
    link.download = `gantt-chart.${format}`;
    link.href = canvas.toDataURL(`image/${format}`);
    link.click();
  };

  const downloadAsPDF = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current, { useCORS: true, scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width / 2, canvas.height / 2] });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
    pdf.save("gantt-chart.pdf");
  };

  // Build dependency lines data
  const depLines = useMemo(() => {
    if (!showDependencies) return [];
    const taskIndexMap = new Map<string, number>();
    displayTasks.forEach((t, i) => taskIndexMap.set(t.id, i));

    return dependencies
      .filter(d => taskIndexMap.has(d.task_id) && taskIndexMap.has(d.depends_on_task_id))
      .map(d => {
        const fromTask = displayTasks[taskIndexMap.get(d.depends_on_task_id)!];
        const toTask = displayTasks[taskIndexMap.get(d.task_id)!];
        if (!fromTask?.start_date || !fromTask?.due_date || !toTask?.start_date || !toTask?.due_date) return null;
        const fromBar = getBar(fromTask.start_date, fromTask.due_date);
        const toBar = getBar(toTask.start_date!, toTask.due_date!);
        const fromIdx = taskIndexMap.get(d.depends_on_task_id)!;
        const toIdx = taskIndexMap.get(d.task_id)!;
        return {
          x1: fromBar.left + fromBar.width,
          y1: fromIdx * ROW_H + ROW_H / 2,
          x2: toBar.left,
          y2: toIdx * ROW_H + ROW_H / 2,
        };
      })
      .filter(Boolean);
  }, [showDependencies, dependencies, displayTasks, startDate]);

  if (tasks.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">📊</div>
        <h3 className="font-semibold text-foreground mb-1">No tasks</h3>
        <p className="text-muted-foreground text-sm">Add tasks to see the Gantt chart.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
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

        {/* Show Dependencies Toggle */}
        <div className="flex items-center gap-2">
          <Switch checked={showDependencies} onCheckedChange={setShowDependencies} />
          <span className="text-xs text-muted-foreground">{showDependencies ? <Eye className="w-3.5 h-3.5 inline mr-1" /> : <EyeOff className="w-3.5 h-3.5 inline mr-1" />}Dependencies</span>
        </div>

        {/* Download */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => downloadAsImage("jpeg")}>Download as JPEG</DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadAsPDF()}>Download as PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadAsImage("png")}>Download as PNG</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Chart */}
      <div ref={chartRef} className="border rounded-xl overflow-hidden bg-card">
        <div className="flex overflow-x-auto">
          {/* Left panel: task names */}
          <div className="flex-shrink-0" style={{ width: LEFT_W }}>
            <div className="h-10 border-b border-r bg-muted/40 flex items-center px-4">
              <span className="text-xs font-semibold text-muted-foreground">Task</span>
            </div>
            {displayTasks.map(task => {
              const isSubtask = !!task.parent_task_id;
              const hasChildren = parentMap.has(task.id);
              const isCollapsed = collapsedParents.has(task.id);
              return (
                <div
                  key={task.id}
                  className={cn(
                    "border-b border-r flex items-center text-sm cursor-pointer transition-colors",
                    hoveredTask === task.id ? "bg-primary/5" : "hover:bg-muted/30",
                    isSubtask ? "pl-8 pr-4" : "px-4"
                  )}
                  style={{ height: ROW_H }}
                  onMouseEnter={() => setHoveredTask(task.id)}
                  onMouseLeave={() => setHoveredTask(null)}
                  onClick={() => onTaskClick?.(task)}
                >
                  {hasChildren && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCollapse(task.id); }}
                      className="mr-1 p-0.5 hover:bg-muted rounded flex-shrink-0"
                    >
                      {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                  <span className={cn(
                    "truncate font-medium text-xs",
                    isSubtask ? "text-primary/80 italic" : "text-foreground",
                    (!task.start_date || !task.due_date) && "text-muted-foreground"
                  )}>
                    {task.title}
                  </span>
                </div>
              );
            })}
            {milestones.filter(m => m.due_date).map(m => (
              <div key={m.id} className="border-b border-r flex items-center px-4 gap-1.5" style={{ height: ROW_H }}>
                <Flag className="w-3 h-3 text-amber-500 flex-shrink-0" />
                <span className="truncate text-xs font-medium text-amber-600">{m.name}</span>
              </div>
            ))}
          </div>

          {/* Right panel: timeline */}
          <div className="flex-1 overflow-x-auto relative">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-muted/40 border-b flex" style={{ height: 40 }}>
              {dayArray.map((day, i) => (
                <div key={i} className="flex-shrink-0 border-r flex items-center justify-center" style={{ width: DAY_WIDTH }}>
                  <span className="text-xs text-muted-foreground" style={{ fontSize: 10 }}>
                    {day.getDate() === 1 ? format(day, "MMM") : day.getDate() % 5 === 0 ? day.getDate() : ""}
                  </span>
                </div>
              ))}
            </div>

            {/* SVG for dependency lines */}
            {showDependencies && depLines.length > 0 && (
              <svg
                className="absolute top-10 left-0 pointer-events-none z-10"
                style={{ width: days * DAY_WIDTH, height: displayTasks.length * ROW_H }}
              >
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--primary))" />
                  </marker>
                </defs>
                {depLines.map((line, i) => {
                  if (!line) return null;
                  const midX = (line.x1 + line.x2) / 2;
                  return (
                    <path
                      key={i}
                      d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`}
                      stroke="hsl(var(--primary))"
                      strokeWidth="1.5"
                      fill="none"
                      opacity="0.6"
                      markerEnd="url(#arrowhead)"
                    />
                  );
                })}
              </svg>
            )}

            {/* Task bars */}
            {displayTasks.map(task => {
              const isSubtask = !!task.parent_task_id;
              if (!task.start_date || !task.due_date) {
                return (
                  <div
                    key={task.id}
                    className={cn("border-b relative", hoveredTask === task.id && "bg-primary/5")}
                    style={{ height: ROW_H, minWidth: days * DAY_WIDTH }}
                    onMouseEnter={() => setHoveredTask(task.id)}
                    onMouseLeave={() => setHoveredTask(null)}
                  >
                    {dayArray.map((_, i) => (
                      <div key={i} className="absolute top-0 bottom-0 border-r border-muted/50" style={{ left: i * DAY_WIDTH }} />
                    ))}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground italic">No dates set</span>
                    </div>
                  </div>
                );
              }
              const { left, width } = getBar(task.start_date!, task.due_date!);
              const isHovered = hoveredTask === task.id;
              return (
                <div
                  key={task.id}
                  className={cn("border-b relative", isHovered && "bg-primary/5")}
                  style={{ height: ROW_H, minWidth: days * DAY_WIDTH }}
                  onMouseEnter={() => setHoveredTask(task.id)}
                  onMouseLeave={() => setHoveredTask(null)}
                >
                  {dayArray.map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-r border-muted/50" style={{ left: i * DAY_WIDTH }} />
                  ))}
                  {/* Bar */}
                  <div
                    data-gantt-bar={task.id}
                    className={cn(
                      "absolute top-2 bottom-2 rounded flex items-center px-2 text-white text-xs font-medium cursor-pointer transition-shadow",
                      statusColors[task.status],
                      priorityBorder[task.priority],
                      isSubtask && "opacity-80",
                      isHovered && "shadow-lg ring-2 ring-primary/50"
                    )}
                    style={{ left, width: Math.max(width, 20) }}
                    onClick={() => onTaskClick?.(task)}
                    onMouseDown={e => handleBarMouseDown(e, task, "move")}
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/20 rounded-l"
                      onMouseDown={e => handleBarMouseDown(e, task, "resize-left")}
                    />
                    <span className="truncate select-none">{task.title}</span>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/20 rounded-r"
                      onMouseDown={e => handleBarMouseDown(e, task, "resize-right")}
                    />
                  </div>

                  {/* Enhanced hover tooltip */}
                  {isHovered && (
                    <div
                      className="absolute z-30 bg-popover text-popover-foreground border rounded-lg shadow-xl p-3 text-xs pointer-events-none min-w-56 max-w-72"
                      style={{ left: Math.min(left + width + 8, days * DAY_WIDTH - 290), top: -4 }}
                    >
                      <p className="font-semibold mb-1.5 text-sm">{task.title}</p>
                      {getSectionName(task) && (
                        <p className="text-muted-foreground mb-0.5"><span className="font-medium text-foreground">Section:</span> {getSectionName(task)}</p>
                      )}
                      {getParentName(task) && (
                        <p className="text-muted-foreground mb-0.5"><span className="font-medium text-foreground">Parent:</span> {getParentName(task)}</p>
                      )}
                      {task.description && (
                        <p className="text-muted-foreground mb-0.5 line-clamp-2"><span className="font-medium text-foreground">Description:</span> {task.description}</p>
                      )}
                      <div className="flex gap-3 mt-1.5 pt-1.5 border-t">
                        <span className="text-muted-foreground">{task.start_date} → {task.due_date}</span>
                      </div>
                      <div className="flex gap-3 mt-0.5">
                        <span className="capitalize">Status: {task.status.replace(/_/g, " ")}</span>
                        <span className="capitalize">Priority: {task.priority}</span>
                      </div>
                      {task.assignee && <p className="mt-0.5">Assignee: {task.assignee.full_name}</p>}
                      {task.estimated_hours != null && <p className="mt-0.5">Est: {task.estimated_hours}h</p>}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Milestone markers */}
            {milestones.filter(m => m.due_date).map(m => {
              const left = differenceInDays(parseISO(m.due_date!), startDate) * DAY_WIDTH;
              return (
                <div key={m.id} className="border-b relative" style={{ height: ROW_H, minWidth: days * DAY_WIDTH }}>
                  {dayArray.map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-r border-muted/50" style={{ left: i * DAY_WIDTH }} />
                  ))}
                  <div className="absolute top-1/2 -translate-y-1/2" style={{ left }}>
                    <div className="w-4 h-4 rotate-45 bg-amber-400 border-2 border-amber-600" title={m.name} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
