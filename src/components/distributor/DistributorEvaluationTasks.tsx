import { useState, useEffect, useRef } from "react";
import { ACTIVE_PROFILE } from '@/lib/activeUserFilter';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardCheck,
  Check,
  CircleDashed,
  CircleDot,
  CircleSlash,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Paperclip,
  User,
  Calendar,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ONBOARDING_STEPS,
  ONBOARDING_STAGES,
  STEP_BY_KEY,
  STEP_STATUSES,
  isSettled,
  type OnboardingStage,
} from "./onboardingSteps";

interface EvaluationTask {
  id: string;
  task_key: string;
  task_label: string;
  status: string;
  owner_user_id: string | null;
  notes: string | null;
  attachment_urls: string[];
  due_date: string | null;
  completed_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

interface User {
  id: string;
  full_name: string | null;
}

interface Props {
  distributorId: string;
  /** Lets the page header show a green tick the moment the last step settles. */
  onProgress?: (p: { done: number; total: number; blocked: number }) => void;
}

/** One visual language for status, shared by the row icon and the dialog. */
const STATUS_UI: Record<string, { icon: typeof Check; dot: string; text: string; chip: string }> = {
  completed: {
    icon: Check,
    dot: "bg-emerald-500 text-white border-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  in_progress: {
    icon: CircleDot,
    dot: "bg-sky-500 text-white border-sky-500",
    text: "text-sky-700 dark:text-sky-400",
    chip: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
  blocked: {
    icon: AlertTriangle,
    dot: "bg-red-500 text-white border-red-500",
    text: "text-red-700 dark:text-red-400",
    chip: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  not_applicable: {
    icon: CircleSlash,
    dot: "bg-muted text-muted-foreground border-border",
    text: "text-muted-foreground",
    chip: "bg-muted text-muted-foreground",
  },
  pending: {
    icon: CircleDashed,
    dot: "bg-background text-muted-foreground border-border",
    text: "text-foreground",
    chip: "bg-muted text-muted-foreground",
  },
};

const statusUi = (s: string) => STATUS_UI[s] ?? STATUS_UI.pending;
const statusLabel = (s: string) =>
  STEP_STATUSES.find((o) => o.value === s)?.label ?? s;

export function DistributorEvaluationTasks({ distributorId, onProgress }: Props) {
  const [tasks, setTasks] = useState<EvaluationTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [editingTask, setEditingTask] = useState<EvaluationTask | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    status: "pending",
    owner_user_id: "",
    notes: "",
    due_date: "",
    attachment_urls: [] as string[],
  });

  useEffect(() => {
    loadTasks();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distributorId]);

  const publish = (rows: EvaluationTask[]) => {
    onProgress?.({
      done: rows.filter((t) => isSettled(t.status)).length,
      total: rows.length,
      blocked: rows.filter((t) => t.status === "blocked").length,
    });
  };

  const applyRows = (rows: any[]) => {
    const mapped = (rows || []).map((t) => ({ ...t, attachment_urls: t.attachment_urls || [] }));
    setTasks(mapped);
    publish(mapped);
  };

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("distributor_evaluation_tasks")
        .select("*")
        .eq("distributor_id", distributorId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) await initializeTasks();
      else applyRows(data);
    } catch (error: any) {
      toast.error("Failed to load onboarding steps: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeTasks = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const { data, error } = await supabase
        .from("distributor_evaluation_tasks")
        .insert(
          ONBOARDING_STEPS.map((step) => ({
            distributor_id: distributorId,
            task_key: step.key,
            task_label: step.label,
            status: "pending",
            created_by: userId,
          })),
        )
        .select();

      if (error) throw error;
      applyRows(data || []);
    } catch (error: any) {
      toast.error("Failed to set up onboarding steps: " + error.message);
    }
  };

  const loadUsers = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name").match(ACTIVE_PROFILE).order("full_name");
    setUsers(data || []);
  };

  const handleEdit = (task: EvaluationTask) => {
    setEditingTask(task);
    setFormData({
      status: task.status,
      owner_user_id: task.owner_user_id || "",
      notes: task.notes || "",
      due_date: task.due_date || "",
      attachment_urls: task.attachment_urls || [],
    });
    setDialogOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTask) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${distributorId}/${editingTask.task_key}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("distributor-attachments")
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("distributor-attachments")
        .getPublicUrl(fileName);

      setFormData((prev) => ({ ...prev, attachment_urls: [...prev.attachment_urls, publicUrl] }));
      toast.success("File uploaded");
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (urlToRemove: string) =>
    setFormData((prev) => ({
      ...prev,
      attachment_urls: prev.attachment_urls.filter((url) => url !== urlToRemove),
    }));

  const handleSave = async () => {
    if (!editingTask) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const updateData: any = {
        status: formData.status,
        owner_user_id: formData.owner_user_id || null,
        notes: formData.notes || null,
        due_date: formData.due_date || null,
        attachment_urls: formData.attachment_urls,
        updated_by: userId,
      };
      if (formData.status === "completed" && editingTask.status !== "completed") {
        updateData.completed_date = new Date().toISOString().split("T")[0];
      } else if (formData.status !== "completed") {
        updateData.completed_date = null;
      }

      const { error } = await supabase
        .from("distributor_evaluation_tasks")
        .update(updateData)
        .eq("id", editingTask.id);
      if (error) throw error;

      toast.success("Step updated");
      setDialogOpen(false);
      loadTasks();
    } catch (error: any) {
      toast.error("Failed to save: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  /** Marks a step done straight from the row, without opening the dialog. */
  const quickComplete = async (task: EvaluationTask) => {
    const next = task.status === "completed" ? "pending" : "completed";
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("distributor_evaluation_tasks")
      .update({
        status: next,
        updated_by: userData?.user?.id,
        completed_date: next === "completed" ? new Date().toISOString().split("T")[0] : null,
      })
      .eq("id", task.id);
    if (error) { toast.error(error.message); return; }
    loadTasks();
  };

  const doneCount = tasks.filter((t) => isSettled(t.status)).length;
  const totalCount = tasks.length;
  const blockedCount = tasks.filter((t) => t.status === "blocked").length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const allDone = totalCount > 0 && doneCount === totalCount;

  const getUserName = (userId: string | null) =>
    userId ? users.find((u) => u.id === userId)?.full_name || "Unknown" : null;

  /** Tasks in the order the checklist defines, grouped by stage. */
  const byStage = (stage: OnboardingStage) =>
    ONBOARDING_STEPS.filter((s) => s.stage === stage)
      .map((s) => ({ step: s, task: tasks.find((t) => t.task_key === s.key) }))
      .filter((x): x is { step: typeof ONBOARDING_STEPS[number]; task: EvaluationTask } => !!x.task);

  /** Steps in the database that the checklist no longer defines. */
  const unknownTasks = tasks.filter((t) => !STEP_BY_KEY[t.task_key]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-20 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const renderRow = (step: typeof ONBOARDING_STEPS[number] | null, task: EvaluationTask) => {
    const ui = statusUi(task.status);
    const Icon = ui.icon;
    const done = task.status === "completed";
    return (
      <div
        key={task.id}
        className="group flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
      >
        <button
          type="button"
          onClick={() => quickComplete(task)}
          title={done ? "Mark as not started" : "Mark as done"}
          className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border flex items-center justify-center transition-colors ${ui.dot}`}
        >
          <Icon className="h-3 w-3" />
        </button>

        <button
          type="button"
          onClick={() => handleEdit(task)}
          className="flex-1 text-left min-w-0"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${done ? "text-muted-foreground" : ""}`}>
              {step?.label ?? task.task_label}
            </span>
            {task.status !== "pending" && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ui.chip}`}>
                {statusLabel(task.status)}
              </span>
            )}
          </div>
          {step?.help && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{step.help}</p>
          )}
          {(task.owner_user_id || task.due_date || task.attachment_urls?.length > 0) && (
            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
              {task.owner_user_id && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />{getUserName(task.owner_user_id)}
                </span>
              )}
              {task.due_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(task.due_date), "d MMM yyyy")}
                </span>
              )}
              {task.attachment_urls?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />{task.attachment_urls.length}
                </span>
              )}
            </div>
          )}
        </button>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div
          className="flex items-start justify-between gap-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              Onboarding
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {allDone
                ? "Every step is settled — this distributor is fully onboarded."
                : `${totalCount - doneCount} step${totalCount - doneCount === 1 ? "" : "s"} left before this distributor is fully onboarded.`}
              {blockedCount > 0 && (
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {" "}{blockedCount} stuck.
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className={`text-lg font-semibold leading-none tabular-nums ${allDone ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                {doneCount}<span className="text-muted-foreground font-normal">/{totalCount}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">{progressPercent}% done</div>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-3">
          <div
            className={`h-full transition-all duration-500 ${allDone ? "bg-emerald-500" : "bg-primary"}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-5">
          {ONBOARDING_STAGES.map((stage) => {
            const rows = byStage(stage.key);
            if (rows.length === 0) return null;
            const stageDone = rows.filter((r) => isSettled(r.task.status)).length;
            return (
              <div key={stage.key}>
                <div className="flex items-baseline justify-between gap-2 px-3 pb-1 border-b mb-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <h4 className="text-xs font-semibold uppercase tracking-wide">{stage.title}</h4>
                    <span className="text-xs text-muted-foreground truncate">{stage.blurb}</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {stageDone}/{rows.length}
                  </span>
                </div>
                {rows.map(({ step, task }) => renderRow(step, task))}
              </div>
            );
          })}

          {unknownTasks.length > 0 && (
            <div>
              <div className="px-3 pb-1 border-b mb-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide">Other</h4>
              </div>
              {unknownTasks.map((task) => renderRow(null, task))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground px-3">
            Tap the circle to mark a step done. Tap the step itself to set who owns it, a due date,
            notes or a document.
          </p>
        </CardContent>
      )}

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? STEP_BY_KEY[editingTask.task_key]?.label ?? editingTask.task_label : ""}
            </DialogTitle>
            {editingTask && STEP_BY_KEY[editingTask.task_key]?.help && (
              <DialogDescription>{STEP_BY_KEY[editingTask.task_key].help}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STEP_STATUSES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Who is doing it</Label>
              <Select
                value={formData.owner_user_id}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, owner_user_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Not assigned" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || "Unnamed"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Due date</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                rows={3}
                placeholder="What was checked, what is pending"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div>
              <Label>Documents</Label>
              <div className="space-y-2 mt-1">
                {formData.attachment_urls.map((url) => (
                  <div key={url} className="flex items-center gap-2 text-sm border rounded px-2 py-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <a href={url} target="_blank" rel="noreferrer" className="flex-1 truncate text-primary">
                      {url.split("/").pop()}
                    </a>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAttachment(url)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Uploading..." : "Attach a document"}
                </Button>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
