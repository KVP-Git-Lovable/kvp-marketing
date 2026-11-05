import { useState } from "react";
import { Sprint, Task, useCreateSprint, useUpdateSprint, useDeleteSprint } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Layers, Plus, Clock, MoreVertical, Pencil, Trash2, Sparkles, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Props { projectId: string; sprints: Sprint[]; tasks: Task[]; }

const sprintStatusColor: Record<string, string> = {
  planning: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-700",
};

export function SprintsPanel({ projectId, sprints, tasks }: Props) {
  const createSprint = useCreateSprint();
  const updateSprint = useUpdateSprint();
  const deleteSprint = useDeleteSprint();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", goal: "", start_date: "", end_date: "" });

  // Edit state
  const [editSprint, setEditSprint] = useState<Sprint | null>(null);
  const [editForm, setEditForm] = useState({ name: "", goal: "", start_date: "", end_date: "" });

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // AI summary state
  const [summaryLoading, setSummaryLoading] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSprint.mutateAsync({
      project_id: projectId,
      name: form.name,
      goal: form.goal || undefined,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      status: "planning",
    });
    setForm({ name: "", goal: "", start_date: "", end_date: "" });
    setShowCreate(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSprint) return;
    await updateSprint.mutateAsync({
      id: editSprint.id,
      projectId,
      name: editForm.name,
      goal: editForm.goal || undefined,
      start_date: editForm.start_date || undefined,
      end_date: editForm.end_date || undefined,
    });
    setEditSprint(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteSprint.mutateAsync({ id: deleteTarget.id, projectId });
    setDeleteTarget(null);
  };

  const handleSummary = async (sprint: Sprint) => {
    setSummaryLoading(sprint.id);
    try {
      const { data, error } = await supabase.functions.invoke("sprint-summary", {
        body: { sprintId: sprint.id, projectId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSummaries(prev => ({ ...prev, [sprint.id]: data.summary }));
    } catch (e: any) {
      toast.error(e.message || "Failed to generate summary");
    } finally {
      setSummaryLoading(null);
    }
  };

  const openEdit = (sprint: Sprint) => {
    setEditForm({
      name: sprint.name,
      goal: sprint.goal || "",
      start_date: sprint.start_date || "",
      end_date: sprint.end_date || "",
    });
    setEditSprint(sprint);
  };

  const getSprintTasks = (sprint: Sprint) => {
    if (!sprint.start_date || !sprint.end_date) return [];
    return tasks.filter(t => t.due_date && t.due_date >= sprint.start_date! && t.due_date <= sprint.end_date!);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" /> Sprints
        </h2>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> New Sprint
        </Button>
      </div>

      {sprints.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <Layers className="w-10 h-10 text-primary/40 mx-auto mb-2" />
          <p className="font-medium text-foreground">No sprints yet</p>
          <p className="text-sm text-muted-foreground">Create sprints to organize your work into time-boxed iterations.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sprints.map(sprint => {
            const sprintTasks = getSprintTasks(sprint);
            const done = sprintTasks.filter(t => t.status === "done").length;
            const progress = sprintTasks.length > 0 ? Math.round((done / sprintTasks.length) * 100) : 0;
            const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.story_points ?? 0), 0);
            const donePoints = sprintTasks.filter(t => t.status === "done").reduce((sum, t) => sum + (t.story_points ?? 0), 0);
            return (
              <div key={sprint.id} className="border rounded-xl overflow-hidden bg-card">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground">{sprint.name}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sprintStatusColor[sprint.status])}>
                      {sprint.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {sprint.start_date && sprint.end_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {format(parseISO(sprint.start_date), "MMM d")} – {format(parseISO(sprint.end_date), "MMM d")}
                      </span>
                    )}
                    {totalPoints > 0 && <span>{donePoints}/{totalPoints} pts</span>}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(sprint)}>
                          <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Sprint
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ id: sprint.id, name: sprint.name })}>
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Sprint
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {sprint.goal && <p className="text-sm text-muted-foreground px-4 py-2 border-b italic">Goal: {sprint.goal}</p>}
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">{done}/{sprintTasks.length} tasks completed</span>
                    <span className="font-medium text-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  {sprintTasks.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {sprintTasks.slice(0, 5).map(t => (
                        <span key={t.id} className={cn(
                          "text-xs px-2 py-1 rounded",
                          t.status === "done" ? "bg-green-100 text-green-700 line-through opacity-60" : "bg-muted text-muted-foreground"
                        )}>
                          {t.title}
                        </span>
                      ))}
                      {sprintTasks.length > 5 && <span className="text-xs text-muted-foreground">+{sprintTasks.length - 5} more</span>}
                    </div>
                  )}

                  {/* AI Summary */}
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn("gap-1.5", summaries[sprint.id] && "border-green-500 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50")}
                        disabled={summaryLoading === sprint.id}
                        onClick={() => handleSummary(sprint)}
                      >
                        {summaryLoading === sprint.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className={cn("w-3.5 h-3.5", summaries[sprint.id] ? "text-green-600" : "text-primary")} />
                        )}
                        {summaries[sprint.id] ? "Regenerate Summary" : "AI Summary"}
                      </Button>
                    </div>
                    {summaries[sprint.id] && (
                      <Collapsible defaultOpen className="mt-2">
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 hover:underline group">
                            <ChevronDown className="w-3.5 h-3.5 group-data-[state=closed]:hidden" />
                            <ChevronRight className="w-3.5 h-3.5 group-data-[state=open]:hidden" />
                            AI Summary
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 p-3 rounded-lg bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 text-sm prose prose-sm max-w-none">
                            <ReactMarkdown>{summaries[sprint.id]}</ReactMarkdown>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Sprint Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Sprint</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div><Label>Sprint Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Sprint 1" /></div>
            <div><Label>Sprint Goal</Label><Textarea value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} rows={2} placeholder="What will we achieve this sprint?" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createSprint.isPending}>Create Sprint</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Sprint Dialog */}
      <Dialog open={!!editSprint} onOpenChange={(open) => !open && setEditSprint(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Sprint</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div><Label>Sprint Name *</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div><Label>Sprint Goal</Label><Textarea value={editForm.goal} onChange={e => setEditForm(f => ({ ...f, goal: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date</Label><Input type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>End Date</Label><Input type="date" value={editForm.end_date} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setEditSprint(null)}>Cancel</Button>
              <Button type="submit" disabled={updateSprint.isPending}>Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Sprint"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        isLoading={deleteSprint.isPending}
      />
    </div>
  );
}
