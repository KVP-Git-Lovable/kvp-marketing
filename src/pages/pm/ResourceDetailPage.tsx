import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  ArrowLeft, Users, Clock, TrendingUp, IndianRupee, CheckCircle2, AlertCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export default function ResourceDetailPage() {
  const { id: projectId, resourceId } = useParams<{ id: string; resourceId: string }>();
  const navigate = useNavigate();

  // Fetch resource
  const { data: resource, isLoading: loadingResource } = useQuery({
    queryKey: ["pm_resource_detail", resourceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_project_resources")
        .select("*, profile:profiles!pm_project_resources_user_id_fkey(full_name, profile_picture_url)")
        .eq("id", resourceId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!resourceId,
  });

  // Fetch project info
  const { data: project } = useQuery({
    queryKey: ["pm_project_name", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_projects")
        .select("name, color")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch tasks where this user is assignee or collaborator
  const { data: tasks = [] } = useQuery({
    queryKey: ["pm_resource_tasks", projectId, resource?.user_id],
    queryFn: async () => {
      const userId = resource!.user_id;
      // Tasks where user is assignee
      const { data: assigneeTasks } = await supabase
        .from("pm_tasks")
        .select("id, title, status, priority, type, estimated_hours, logged_hours, due_date, start_date")
        .eq("project_id", projectId!)
        .eq("assignee_id", userId);

      // Tasks where user is collaborator
      const { data: collabTaskIds } = await supabase
        .from("pm_task_collaborators")
        .select("task_id")
        .eq("user_id", userId);

      let collabTasks: any[] = [];
      if (collabTaskIds && collabTaskIds.length > 0) {
        const ids = collabTaskIds.map(c => c.task_id);
        const { data } = await supabase
          .from("pm_tasks")
          .select("id, title, status, priority, type, estimated_hours, logged_hours, due_date, start_date")
          .eq("project_id", projectId!)
          .in("id", ids);
        collabTasks = data || [];
      }

      // Merge and dedupe
      const all = [...(assigneeTasks || []), ...collabTasks];
      const unique = Array.from(new Map(all.map(t => [t.id, t])).values());
      return unique;
    },
    enabled: !!resource?.user_id && !!projectId,
  });

  // Fetch time logs
  const { data: timeLogs = [] } = useQuery({
    queryKey: ["pm_resource_timelogs", projectId, resource?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_time_logs")
        .select("hours, date, allocation, work_type, description, task_id")
        .eq("project_id", projectId!)
        .eq("user_id", resource!.user_id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!resource?.user_id && !!projectId,
  });

  // Compute metrics
  const metrics = useMemo(() => {
    if (!resource) return null;
    const totalHours = timeLogs.reduce((s, l) => s + l.hours, 0);
    const billableHours = timeLogs.filter(l => l.allocation === "Billable").reduce((s, l) => s + l.hours, 0);
    const nonBillableHours = totalHours - billableHours;
    const revenue = totalHours * (resource.selling_rate || 0);
    const cost = totalHours * (resource.cost_rate || 0);
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const effortBudget = resource.budget_allocated || 0;
    const utilization = effortBudget > 0 ? Math.min((totalHours / effortBudget) * 100, 100) : 0;
    const tasksDone = tasks.filter(t => t.status === "done").length;
    const tasksInProgress = tasks.filter(t => t.status === "in_progress").length;

    return {
      totalHours, billableHours, nonBillableHours,
      revenue, cost, profit, margin,
      effortBudget, utilization,
      totalTasks: tasks.length, tasksDone, tasksInProgress,
    };
  }, [resource, timeLogs, tasks]);

  // Weekly hours chart data
  const weeklyData = useMemo(() => {
    const map = new Map<string, number>();
    timeLogs.forEach(l => {
      const week = format(parseISO(l.date), "dd MMM");
      map.set(week, (map.get(week) || 0) + l.hours);
    });
    return Array.from(map.entries())
      .map(([date, hours]) => ({ date, hours: Math.round(hours * 10) / 10 }))
      .reverse()
      .slice(-14);
  }, [timeLogs]);

  if (loadingResource) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <div className="h-8 bg-muted animate-pulse rounded w-48" />
          <div className="h-32 bg-muted animate-pulse rounded" />
        </div>
      </Layout>
    );
  }

  if (!resource || !metrics) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Resource not found.</p>
          <Button variant="outline" onClick={() => navigate(`/projects/${projectId}`)} className="mt-4">Back to Project</Button>
        </div>
      </Layout>
    );
  }

  const statusColors: Record<string, string> = {
    done: "text-green-600 bg-green-50",
    in_progress: "text-amber-600 bg-amber-50",
    todo: "text-blue-600 bg-blue-50",
    backlog: "text-muted-foreground bg-muted",
    blocked: "text-red-600 bg-red-50",
  };

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card px-6 py-4">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {project?.name || "Back to Project"}
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary text-lg font-bold">
              {(resource as any).profile?.full_name?.charAt(0) || "?"}
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{(resource as any).profile?.full_name || "Unknown"}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{resource.role}</span>
                <span>•</span>
                <Badge variant={resource.deployment_type === "full_time" ? "default" : "secondary"} className="text-[10px]">
                  {resource.deployment_type === "full_time" ? "Full Time" : "Part Time"}
                </Badge>
                {resource.start_date && (
                  <>
                    <span>•</span>
                    <span>{format(parseISO(resource.start_date), "dd MMM yyyy")} – {resource.release_date ? format(parseISO(resource.release_date), "dd MMM yyyy") : "Ongoing"}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 max-w-6xl">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Hours", value: `${metrics.totalHours.toFixed(1)}h`, icon: Clock, color: "text-blue-500" },
              { label: "Effort Budget", value: `${metrics.effortBudget}h`, icon: Clock, color: "text-indigo-500" },
              { label: "Utilization", value: `${metrics.utilization.toFixed(0)}%`, icon: TrendingUp, color: "text-amber-500" },
              { label: "Revenue", value: `₹${metrics.revenue.toFixed(0)}`, icon: IndianRupee, color: "text-green-600" },
              { label: "Cost", value: `₹${metrics.cost.toFixed(0)}`, icon: IndianRupee, color: "text-red-500" },
              { label: "Margin", value: `${metrics.margin.toFixed(0)}%`, icon: TrendingUp, color: metrics.profit >= 0 ? "text-green-600" : "text-red-500" },
            ].map((m) => (
              <Card key={m.label}>
                <CardContent className="p-3 flex items-center gap-2">
                  <m.icon className={cn("w-6 h-6", m.color)} />
                  <div>
                    <div className="text-lg font-bold text-foreground">{m.value}</div>
                    <div className="text-[10px] text-muted-foreground">{m.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Profitability Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Profitability Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Sell Rate/hr</p>
                  <p className="font-semibold">₹{resource.selling_rate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Cost Rate/hr</p>
                  <p className="font-semibold">₹{resource.cost_rate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Profit</p>
                  <p className={cn("font-semibold", metrics.profit >= 0 ? "text-green-600" : "text-red-500")}>
                    ₹{metrics.profit.toFixed(0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Utilization</p>
                  <div className="flex items-center gap-2">
                    <Progress value={metrics.utilization} className="h-2 flex-1" />
                    <span className="font-semibold text-xs">{metrics.utilization.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Hours Chart */}
          {weeklyData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Hours Logged (Daily)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={weeklyData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => `${v}h`} />
                    <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tasks Table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Associated Tasks ({tasks.length})</CardTitle>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> {metrics.tasksDone} done</span>
                  <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-amber-500" /> {metrics.tasksInProgress} in progress</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">No tasks associated with this resource.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Priority</TableHead>
                      <TableHead className="text-right">Estimated</TableHead>
                      <TableHead className="text-right">Logged</TableHead>
                      <TableHead className="text-center">Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map(t => (
                      <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">{t.title}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={cn("text-[10px]", statusColors[t.status] || "")} variant="outline">
                            {t.status?.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{t.estimated_hours ? `${t.estimated_hours}h` : "—"}</TableCell>
                        <TableCell className="text-right">{t.logged_hours ? `${t.logged_hours}h` : "—"}</TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">
                          {t.due_date ? format(parseISO(t.due_date), "dd MMM") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Recent Time Logs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Time Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {timeLogs.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">No time entries recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Allocation</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeLogs.slice(0, 20).map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground text-xs">{format(parseISO(l.date), "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-right font-medium">{l.hours}h</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{l.work_type || "—"}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={l.allocation === "Billable" ? "default" : "secondary"} className="text-[10px]">
                            {l.allocation}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">{l.description || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
