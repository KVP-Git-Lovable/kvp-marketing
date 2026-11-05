import { useState } from "react";
import { usePMAI } from "@/hooks/usePMAI";
import { useCreateTask } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  sectionName?: string;
  onDone?: () => void;
}

interface Subtask {
  title: string;
  description?: string;
  priority: string;
  estimated_hours: number;
  selected?: boolean;
}

export function AISubtaskGenerator({ projectId, taskId, taskTitle, taskDescription, sectionName, onDone }: Props) {
  const { invoke, loading } = usePMAI();
  const createTask = useCreateTask();
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [creating, setCreating] = useState(false);

  const generate = async () => {
    const result = await invoke("generate_subtasks", projectId, { taskTitle, taskDescription, sectionName });
    if (result?.subtasks) {
      setSubtasks(result.subtasks.map((s: Subtask) => ({ ...s, selected: true })));
    }
  };

  const toggleSubtask = (idx: number) => {
    setSubtasks(prev => prev.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s));
  };

  const createSelected = async () => {
    const selected = subtasks.filter(s => s.selected);
    if (selected.length === 0) { toast.info("Select at least one sub-task"); return; }
    setCreating(true);
    try {
      for (const st of selected) {
        await createTask.mutateAsync({
          project_id: projectId,
          parent_task_id: taskId,
          title: st.title,
          description: st.description,
          priority: st.priority as any,
          estimated_hours: st.estimated_hours,
          status: "todo",
          type: "task",
        });
      }
      toast.success(`${selected.length} sub-tasks created`);
      setSubtasks([]);
      onDone?.();
    } catch {
      toast.error("Failed to create some sub-tasks");
    } finally {
      setCreating(false);
    }
  };

  if (subtasks.length === 0) {
    return (
      <Button variant="outline" size="sm" onClick={generate} disabled={loading} className="gap-1.5 text-xs">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
        {loading ? "Generating..." : "AI: Break Down"}
      </Button>
    );
  }

  return (
    <div className="border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" /> AI Suggested Sub-tasks
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setSubtasks([])}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        {subtasks.map((st, i) => (
          <label key={i} className={cn(
            "flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-colors text-sm",
            st.selected ? "bg-background border-green-300 dark:border-green-700" : "bg-muted/30 border-transparent opacity-60"
          )}>
            <input type="checkbox" checked={st.selected} onChange={() => toggleSubtask(i)} className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="font-medium text-foreground">{st.title}</span>
              {st.description && <p className="text-xs text-muted-foreground mt-0.5">{st.description}</p>}
              <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                <span className="capitalize">{st.priority}</span>
                <span>{st.estimated_hours}h</span>
              </div>
            </div>
          </label>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={createSelected} disabled={creating} className="gap-1 text-xs flex-1">
          <Check className="w-3 h-3" /> {creating ? "Creating..." : `Create ${subtasks.filter(s => s.selected).length} Sub-tasks`}
        </Button>
        <Button size="sm" variant="outline" onClick={generate} disabled={loading} className="gap-1 text-xs">
          <Sparkles className="w-3 h-3" /> Regenerate
        </Button>
      </div>
    </div>
  );
}
