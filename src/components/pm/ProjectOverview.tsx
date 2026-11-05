import { useState } from "react";
import { Project, Task, Sprint, Milestone, Risk } from "@/hooks/useProjects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Calendar, Clock, AlertTriangle, CheckCircle2, Users, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { AIHealthCheck } from "./AIHealthCheck";
import { usePMAI } from "@/hooks/usePMAI";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Props {
  project: Project;
  tasks: Task[];
  sprints: Sprint[];
  milestones: Milestone[];
  risks: Risk[];
}

export function ProjectOverview({ project, tasks, sprints, milestones, risks }: Props) {
  const { invoke: aiInvoke, loading: summaryLoading, data: summaryData } = usePMAI();
  const byStatus = ["todo", "in_progress", "in_review", "done", "backlog", "cancelled"].map(s => ({
    name: s.replace("_", " "),
    count: tasks.filter(t => t.status === s).length,
    fill: { todo: "#60a5fa", in_progress: "#fbbf24", in_review: "#a78bfa", done: "#4ade80", backlog: "#94a3b8", cancelled: "#f87171" }[s],
  })).filter(s => s.count > 0);

  const byPriority = ["critical", "high", "medium", "low"].map(p => ({
    name: p,
    count: tasks.filter(t => t.priority === p).length,
    fill: { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e" }[p],
  })).filter(p => p.count > 0);

  const progress = tasks.length > 0
    ? Math.round((tasks.filter(t => t.status === "done").length / tasks.length) * 100)
    : 0;

  const openRisks = risks.filter(r => r.status === "open");

  const metrics = [
    { label: "Total Tasks", value: tasks.length, icon: CheckCircle2, color: "text-primary" },
    { label: "In Progress", value: tasks.filter(t => t.status === "in_progress").length, icon: TrendingUp, color: "text-amber-500" },
    { label: "Logged Hours", value: `${(project.logged_hours ?? 0).toFixed(1)}h`, icon: Clock, color: "text-blue-500" },
    { label: "Open Risks", value: openRisks.length, icon: AlertTriangle, color: openRisks.length > 0 ? "text-red-500" : "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map(m => (
          <Card key={m.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <m.icon className={cn("w-8 h-8", m.color)} />
              <div>
                <div className="text-xl font-bold text-foreground">{m.value}</div>
                <div className="text-xs text-muted-foreground">{m.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Overall Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={progress} className="flex-1 h-3" />
            <span className="text-2xl font-bold text-foreground">{progress}%</span>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            {project.start_date && <span>Start: {format(parseISO(project.start_date), "MMM d, yyyy")}</span>}
            {project.end_date && <span>End: {format(parseISO(project.end_date), "MMM d, yyyy")}</span>}
            {project.estimated_hours && <span>Budget: {project.estimated_hours}h est / {project.logged_hours ?? 0}h logged</span>}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Tasks by Status chart */}
        {byStatus.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Tasks by Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byStatus} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={4}>
                    {byStatus.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Priority breakdown */}
        {byPriority.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Tasks by Priority</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byPriority} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={4}>
                    {byPriority.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* AI Health Check */}
      <AIHealthCheck projectId={project.id} />

      {/* AI Project Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> AI Project Report
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => aiInvoke("project_summary", project.id)} disabled={summaryLoading} className="gap-1 text-xs h-7">
              {summaryLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {summaryLoading ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        </CardHeader>
        {summaryData?.summary && (
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800 rounded-lg p-4">
              <ReactMarkdown>{summaryData.summary}</ReactMarkdown>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Milestones summary */}
      {milestones.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Milestones</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {milestones.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    {m.is_completed
                      ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                      : <div className="w-4 h-4 rounded-full border-2 border-amber-400" />
                    }
                    <span className={cn("text-sm", m.is_completed ? "line-through text-muted-foreground" : "text-foreground")}>
                      {m.name}
                    </span>
                  </div>
                  {m.due_date && (
                    <span className="text-xs text-muted-foreground">{format(parseISO(m.due_date), "MMM d, yyyy")}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
