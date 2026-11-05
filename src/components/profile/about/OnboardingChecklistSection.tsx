import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck, Upload, Loader2, CheckCircle2, Circle, FileText, Pencil, X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface OnboardingTask {
  id: string;
  task_name: string;
  description: string | null;
  category: string | null;
  requires_attachment: boolean;
  sort_order: number;
}

interface UserProgress {
  id: string;
  task_id: string;
  is_completed: boolean;
  completed_at: string | null;
  attachment_url: string | null;
  notes: string | null;
}

export function OnboardingChecklistSection() {
  const { user } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [progress, setProgress] = useState<Record<string, UserProgress>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const [tasksResult, progressResult] = await Promise.all([
      supabase
        .from("onboarding_tasks")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("user_onboarding_progress")
        .select("*")
        .eq("user_id", user.id),
    ]);

    if (tasksResult.data) {
      setTasks(tasksResult.data);
    }

    if (progressResult.data) {
      const progressMap: Record<string, UserProgress> = {};
      progressResult.data.forEach((p) => {
        progressMap[p.task_id] = p;
      });
      setProgress(progressMap);
    }

    setLoading(false);
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    if (!user) return;

    const existing = progress[taskId];

    if (existing) {
      const { error } = await supabase
        .from("user_onboarding_progress")
        .update({
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (!error) {
        setProgress((prev) => ({
          ...prev,
          [taskId]: { ...existing, is_completed: completed, completed_at: completed ? new Date().toISOString() : null },
        }));
        toast.success(completed ? "Task completed!" : "Task uncompleted");
      }
    } else {
      const { data, error } = await supabase
        .from("user_onboarding_progress")
        .insert({
          user_id: user.id,
          task_id: taskId,
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (!error && data) {
        setProgress((prev) => ({
          ...prev,
          [taskId]: data,
        }));
        toast.success("Task completed!");
      }
    }
  };

  const handleFileUpload = async (taskId: string, file: File) => {
    if (!user) return;
    setUploading(taskId);

    const fileExt = file.name.split('.').pop();
    const filePath = `onboarding/${user.id}/${taskId}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("user-attachments")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("Failed to upload file");
      setUploading(null);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("user-attachments")
      .getPublicUrl(filePath);

    const existing = progress[taskId];
    if (existing) {
      await supabase
        .from("user_onboarding_progress")
        .update({
          attachment_url: urlData.publicUrl,
          is_completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("user_onboarding_progress").insert({
        user_id: user.id,
        task_id: taskId,
        attachment_url: urlData.publicUrl,
        is_completed: true,
        completed_at: new Date().toISOString(),
      });
    }

    toast.success("File uploaded!");
    setUploading(null);
    fetchData();
  };

  const completedCount = Object.values(progress).filter((p) => p.is_completed).length;
  const progressPercent = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  // Group tasks by category
  const tasksByCategory = tasks.reduce((acc, task) => {
    const cat = task.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(task);
    return acc;
  }, {} as Record<string, OnboardingTask[]>);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // View Mode
  if (!isEditMode) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Onboarding Checklist
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={progressPercent === 100 ? "default" : "secondary"}>
                {completedCount}/{tasks.length} Complete
              </Badge>
              <Button size="sm" variant="outline" onClick={() => setIsEditMode(true)}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            </div>
          </div>
          <Progress value={progressPercent} className="h-2 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No onboarding tasks configured yet.
            </p>
          ) : (
            Object.entries(tasksByCategory).map(([category, categoryTasks]) => (
              <div key={category}>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">{category}</h4>
                <div className="space-y-2">
                  {categoryTasks.map((task) => {
                    const taskProgress = progress[task.id];
                    const isCompleted = taskProgress?.is_completed;

                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          isCompleted ? "bg-primary/5" : "bg-muted/30"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm ${isCompleted ? "line-through text-muted-foreground" : "font-medium"}`}>
                            {task.task_name}
                          </span>
                          {task.requires_attachment && taskProgress?.attachment_url && (
                            <a
                              href={taskProgress.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-xs text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <FileText className="h-3 w-3" /> View
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    );
  }

  // Edit Mode
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Edit Onboarding Checklist
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={progressPercent === 100 ? "default" : "secondary"}>
              {completedCount}/{tasks.length} Complete
            </Badge>
            <Button size="sm" variant="ghost" onClick={() => setIsEditMode(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Progress value={progressPercent} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No onboarding tasks configured yet.
          </p>
        ) : (
          Object.entries(tasksByCategory).map(([category, categoryTasks]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">{category}</h4>
              <div className="space-y-3">
                {categoryTasks.map((task) => {
                  const taskProgress = progress[task.id];
                  const isCompleted = taskProgress?.is_completed;

                  return (
                    <div
                      key={task.id}
                      className={`border rounded-lg p-4 transition-colors ${
                        isCompleted ? "bg-primary/5 border-primary/20" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isCompleted}
                          onCheckedChange={(checked) => handleToggleTask(task.id, !!checked)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className={`font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                              {task.task_name}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                          )}

                          {task.requires_attachment && (
                            <div className="mt-3">
                              {taskProgress?.attachment_url ? (
                                <a
                                  href={taskProgress.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary flex items-center gap-1 hover:underline"
                                >
                                  <FileText className="h-4 w-4" />
                                  View uploaded file
                                </a>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="file"
                                    className="h-8 text-xs"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileUpload(task.id, file);
                                    }}
                                    disabled={uploading === task.id}
                                  />
                                  {uploading === task.id && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        <div className="pt-4">
          <Button variant="outline" onClick={() => setIsEditMode(false)} className="w-full">
            Done
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
