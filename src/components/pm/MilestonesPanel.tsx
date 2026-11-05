import { useState } from "react";
import { Milestone, Task } from "@/hooks/useProjects";
import { useCreateMilestone } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Flag, Plus, CheckCircle2, Circle } from "lucide-react";
import { format, parseISO, isPast } from "date-fns";
import { cn } from "@/lib/utils";

interface Props { projectId: string; milestones: Milestone[]; tasks: Task[]; }

export function MilestonesPanel({ projectId, milestones, tasks }: Props) {
  const createMilestone = useCreateMilestone();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", due_date: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMilestone.mutateAsync({ ...form, project_id: projectId, due_date: form.due_date || undefined });
    setForm({ name: "", description: "", due_date: "" });
    setShowCreate(false);
  };

  const getMilestoneTasks = (milestoneId: string) => tasks.filter(t => t.milestone_id === milestoneId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Flag className="w-5 h-5 text-amber-500" /> Milestones
        </h2>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Milestone
        </Button>
      </div>

      {milestones.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <Flag className="w-10 h-10 text-amber-400 mx-auto mb-2" />
          <p className="font-medium text-foreground">No milestones yet</p>
          <p className="text-sm text-muted-foreground">Track major checkpoints in your project.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-4">
            {milestones.map(milestone => {
              const mTasks = getMilestoneTasks(milestone.id);
              const doneTasks = mTasks.filter(t => t.status === "done").length;
              const isOverdue = milestone.due_date && isPast(parseISO(milestone.due_date)) && !milestone.is_completed;
              return (
                <div key={milestone.id} className="flex gap-4 items-start">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 z-10",
                    milestone.is_completed ? "bg-green-500 border-green-500 text-white" : isOverdue ? "bg-red-100 border-red-400 text-red-500" : "bg-amber-50 border-amber-400 text-amber-500"
                  )}>
                    {milestone.is_completed ? <CheckCircle2 className="w-5 h-5" /> : <Flag className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 bg-card border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground">{milestone.name}</h3>
                      <div className="flex gap-2 flex-shrink-0">
                        {isOverdue && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">Overdue</span>}
                        {milestone.is_completed && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">Completed</span>}
                      </div>
                    </div>
                    {milestone.description && <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {milestone.due_date && <span>Due: {format(parseISO(milestone.due_date), "MMM d, yyyy")}</span>}
                      {mTasks.length > 0 && <span>{doneTasks}/{mTasks.length} tasks done</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Milestone</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Milestone Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Beta Release" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createMilestone.isPending}>Add Milestone</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
