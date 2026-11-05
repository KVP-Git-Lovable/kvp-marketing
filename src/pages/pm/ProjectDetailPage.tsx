import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  useProject, useTasks, useSprints, useMilestones, useRisks, useSections,
  useUpdateTask, useDeleteTask, Task, TaskStatus
} from "@/hooks/useProjects";
import { CreateTaskModal } from "@/components/pm/CreateTaskModal";
import { GanttChart } from "@/components/pm/GanttChart";
import { CalendarView } from "@/components/pm/CalendarView";
import { KanbanBoard } from "@/components/pm/KanbanBoard";
import { BacklogView } from "@/components/pm/BacklogView";
import { RisksPanel } from "@/components/pm/RisksPanel";
import { MilestonesPanel } from "@/components/pm/MilestonesPanel";
import { SprintsPanel } from "@/components/pm/SprintsPanel";
import { ProjectOverview } from "@/components/pm/ProjectOverview";
import { TaskDetailPanel } from "@/components/pm/TaskDetailPanel";
import { TimesheetView } from "@/components/pm/TimesheetView";
import { ResourcesPanel } from "@/components/pm/ResourcesPanel";
import { cn } from "@/lib/utils";
import { TemplateWorkPlanView } from "@/components/pm/TemplateWorkPlanView";
import { IdeasPanel } from "@/components/pm/IdeasPanel";
import { KnowledgePanel } from "@/components/pm/KnowledgePanel";
import { SupportPanel } from "@/components/pm/SupportPanel";
import {
  ArrowLeft, Plus, Kanban, List, BarChart3,
  AlertTriangle, Layers, Grid, Calendar, Clock, FileText, Users,
  Lightbulb, BookOpen, HelpCircle, ChevronDown, MoreHorizontal
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: loadingProject } = useProject(id!);
  const { data: tasks = [] } = useTasks(id!);
  const { data: sprints = [] } = useSprints(id!);
  const { data: milestones = [] } = useMilestones(id!);
  const { data: risks = [] } = useRisks(id!);
  const { data: sections = [] } = useSections(id!);
  const updateTask = useUpdateTask();
  const [tab, setTab] = useState("board");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isFullView, setIsFullView] = useState(false);

  const taskStats = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter(t => t.status === "todo").length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    done: tasks.filter(t => t.status === "done").length,
    backlog: tasks.filter(t => t.status === "backlog").length,
  }), [tasks]);

  const progress = taskStats.total > 0
    ? Math.round((taskStats.done / taskStats.total) * 100)
    : 0;

  // Keep selected task in sync with latest data
  const currentSelectedTask = useMemo(() => {
    if (!selectedTask) return null;
    return tasks.find(t => t.id === selectedTask.id) || null;
  }, [selectedTask, tasks]);

  if (loadingProject) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <div className="h-8 bg-muted animate-pulse rounded w-48" />
          <div className="h-32 bg-muted animate-pulse rounded" />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Project not found.</p>
          <Button variant="outline" onClick={() => navigate("/projects")} className="mt-4">Back to Projects</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Project Header */}
        <div className="border-b bg-card px-6 py-4 flex-shrink-0">
          <button
            onClick={() => navigate("/projects")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> All Projects
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground truncate">{project.name}</h1>
                {project.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{project.description}</p>
                )}
              </div>
            </div>
            {tab !== "sprints" && (
              <Button onClick={() => setShowCreateTask(true)} size="sm" className="gap-2 flex-shrink-0">
                <Plus className="w-4 h-4" /> Add Task
              </Button>
            )}
          </div>

          {/* Mini stats */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>{taskStats.total} tasks</span>
              <span className="text-amber-600">{taskStats.in_progress} in progress</span>
              <span className="text-green-600">{taskStats.done} done</span>
              {risks.filter(r => r.status === "open").length > 0 && (
                <span className="text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {risks.filter(r => r.status === "open").length} risks
                </span>
              )}
            </div>
            <div className="flex-1 max-w-48">
              <Progress value={progress} className="h-1.5" />
            </div>
            <span className="text-xs text-muted-foreground">{progress}%</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={tab} onValueChange={setTab} className="h-full flex flex-col">
            <div className="border-b bg-card px-6">
              <TabsList className="h-9 bg-transparent gap-0 p-0">
                {[
                  { value: "board", label: "Board", icon: Kanban },
                  { value: "backlog", label: "Work Plan", icon: List },
                  { value: "calendar", label: "Calendar", icon: Calendar },
                  { value: "gantt", label: "Gantt", icon: BarChart3 },
                  { value: "timesheet", label: "Timesheet", icon: Clock },
                  { value: "sprints", label: "Sprints", icon: Layers },
                  { value: "resources", label: "Resources", icon: Users },
                ].map(({ value, label, icon: Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-9 px-3 text-sm gap-1.5"
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </TabsTrigger>
                ))}
                {/* More dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap h-9 px-3 text-sm font-medium gap-1.5 rounded-none border-b-2 transition-all",
                      ["overview", "risks", "ideas", "knowledge", "support", "templates"].includes(tab)
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}>
                      <MoreHorizontal className="w-3.5 h-3.5" /> More <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {[
                      { value: "overview", label: "Overview", icon: Grid },
                      { value: "risks", label: "Risks", icon: AlertTriangle },
                      { value: "ideas", label: "Ideas", icon: Lightbulb },
                      { value: "knowledge", label: "Knowledge", icon: BookOpen },
                      { value: "support", label: "Support", icon: HelpCircle },
                      { value: "templates", label: "Templates", icon: FileText },
                    ].map(({ value, label, icon: Icon }) => (
                      <DropdownMenuItem key={value} onClick={() => setTab(value)} className={cn("gap-2", tab === value && "bg-accent")}>
                        <Icon className="w-4 h-4" /> {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden flex">
              <div className="flex-1 overflow-auto">
                <TabsContent value="board" className="mt-0 h-full">
                  <KanbanBoard
                    tasks={tasks}
                    onUpdateTask={(id, status) => updateTask.mutate({ id, status })}
                    onAddTask={(status) => setShowCreateTask(true)}
                    projectId={project.id}
                    sprints={sprints}
                    milestones={milestones}
                    sections={sections}
                    onTaskClick={(task) => setSelectedTask(task)}
                  />
                </TabsContent>
                <TabsContent value="backlog" className="mt-0 p-6">
                  <BacklogView tasks={tasks} sprints={sprints} milestones={milestones} projectId={project.id} sections={sections} onTaskClick={(task) => setSelectedTask(task)} />
                </TabsContent>
                <TabsContent value="calendar" className="mt-0">
                  <CalendarView tasks={tasks} projectId={project.id} sections={sections} onTaskClick={(task) => setSelectedTask(task)} />
                </TabsContent>
                <TabsContent value="timesheet" className="mt-0">
                  <TimesheetView tasks={tasks} projectId={project.id} onTaskClick={(task) => setSelectedTask(task)} />
                </TabsContent>
                <TabsContent value="resources" className="mt-0">
                  <ResourcesPanel projectId={project.id} />
                </TabsContent>
                <TabsContent value="gantt" className="mt-0 p-4">
                  <GanttChart tasks={tasks} project={project} milestones={milestones} sections={sections} onTaskClick={(task) => setSelectedTask(task)} />
                </TabsContent>
                <TabsContent value="sprints" className="mt-0 p-6">
                  <SprintsPanel projectId={project.id} sprints={sprints} tasks={tasks} />
                </TabsContent>
                <TabsContent value="risks" className="mt-0 p-6">
                  <RisksPanel projectId={project.id} risks={risks} />
                </TabsContent>
                <TabsContent value="overview" className="mt-0 p-6">
                  <ProjectOverview project={project} tasks={tasks} sprints={sprints} milestones={milestones} risks={risks} />
                </TabsContent>
                <TabsContent value="templates" className="mt-0 p-6">
                  <TemplateWorkPlanView />
                </TabsContent>
                <TabsContent value="ideas" className="mt-0">
                  <IdeasPanel projectId={project.id} />
                </TabsContent>
                <TabsContent value="knowledge" className="mt-0">
                  <KnowledgePanel projectId={project.id} />
                </TabsContent>
                <TabsContent value="support" className="mt-0">
                  <SupportPanel projectId={project.id} />
                </TabsContent>
              </div>

              {/* Shared Task Detail Side Panel — overlapping */}
              {currentSelectedTask && (
                <>
                  {/* Backdrop overlay — click to dismiss */}
                  <div
                    className="fixed inset-0 z-40 bg-black/10"
                    onClick={() => setSelectedTask(null)}
                  />
                  <div className={cn(
                    "fixed right-0 bottom-0 z-50 border-l bg-card overflow-hidden shadow-[-8px_0_24px_-4px_hsl(var(--foreground)/0.12)] transition-all duration-200",
                    isFullView ? "w-full max-w-full" : "w-[540px] max-w-[95vw]"
                  )} style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
                    <TaskDetailPanel
                      task={currentSelectedTask}
                      onClose={() => { setSelectedTask(null); setIsFullView(false); }}
                      projectId={project.id}
                      allTasks={tasks}
                      onSelectTask={(t) => setSelectedTask(t)}
                      onExpand={() => setIsFullView(prev => !prev)}
                    />
                  </div>
                </>
              )}
            </div>
          </Tabs>
        </div>
      </div>

      <CreateTaskModal
        open={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        projectId={project.id}
        sprints={sprints}
        milestones={milestones}
        sections={sections}
      />
    </Layout>
  );
}
