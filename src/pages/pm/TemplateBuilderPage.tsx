import { useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  useTemplate, useUpdateTemplate,
  useTemplateSections, useCreateTemplateSection, useUpdateTemplateSection, useDeleteTemplateSection,
  useTemplateTasks, useCreateTemplateTask, useUpdateTemplateTask, useDeleteTemplateTask,
  useTemplateDependencies, useCreateTemplateDependency, useDeleteTemplateDependency,
  useTemplateAttachments, useCreateTemplateAttachment, useDeleteTemplateAttachment,
  TemplateTask, TemplateDependency,
} from "@/hooks/useTemplates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, Edit2, Link, Paperclip,
  GripVertical, Clock, Loader2, X, Download
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Task Row (recursive for subtasks) ──────────────────
function TaskRow({
  task, allTasks, sections, dependencies, templateId, level = 0,
  expandedTasks, toggleExpand, onEdit,
}: {
  task: TemplateTask;
  allTasks: TemplateTask[];
  sections: { id: string; name: string }[];
  dependencies: TemplateDependency[];
  templateId: string;
  level?: number;
  expandedTasks: Set<string>;
  toggleExpand: (id: string) => void;
  onEdit: (task: TemplateTask) => void;
}) {
  const deleteTask = useDeleteTemplateTask();
  const subtasks = allTasks.filter(t => t.parent_task_id === task.id);
  const isExpanded = expandedTasks.has(task.id);
  const taskDeps = dependencies.filter(d => d.task_id === task.id);
  const section = sections.find(s => s.id === task.section_id);

  const priorityColors: Record<string, string> = {
    critical: "text-red-600", high: "text-orange-600", medium: "text-amber-600", low: "text-green-600",
  };

  return (
    <>
      <tr className="group hover:bg-muted/30 border-b transition-colors">
        <td className="px-3 py-2" style={{ paddingLeft: `${12 + level * 24}px` }}>
          <div className="flex items-center gap-2">
            {subtasks.length > 0 ? (
              <button onClick={() => toggleExpand(task.id)} className="text-muted-foreground hover:text-foreground">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className="text-sm font-medium text-foreground truncate">{task.title}</span>
            {subtasks.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5">{subtasks.length}</Badge>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{section?.name || "—"}</td>
        <td className="px-3 py-2">
          <span className={cn("text-xs font-medium", priorityColors[task.priority])}>
            {task.priority}
          </span>
        </td>
        <td className="px-3 py-2 text-sm text-center">{task.duration_days}d</td>
        <td className="px-3 py-2 text-sm text-center text-muted-foreground">
          {task.estimated_hours ? `${task.estimated_hours}h` : "—"}
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[150px]">
          {taskDeps.length > 0
            ? taskDeps.map(d => allTasks.find(t => t.id === d.depends_on_task_id)?.title || "?").join(", ")
            : "—"}
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(task)}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-destructive"
              onClick={() => deleteTask.mutate({ id: task.id, templateId })}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </td>
      </tr>
      {isExpanded && subtasks.map(sub => (
        <TaskRow key={sub.id} task={sub} allTasks={allTasks} sections={sections}
          dependencies={dependencies} templateId={templateId} level={level + 1}
          expandedTasks={expandedTasks} toggleExpand={toggleExpand} onEdit={onEdit} />
      ))}
    </>
  );
}

// ─── Task Edit / Add Dialog ─────────────────────────────
function TaskDialog({
  open, onClose, templateId, sections, allTasks, dependencies,
  editTask, parentTaskId,
}: {
  open: boolean;
  onClose: () => void;
  templateId: string;
  sections: { id: string; name: string }[];
  allTasks: TemplateTask[];
  dependencies: TemplateDependency[];
  editTask?: TemplateTask | null;
  parentTaskId?: string;
}) {
  const createTask = useCreateTemplateTask();
  const updateTask = useUpdateTemplateTask();
  const createDep = useCreateTemplateDependency();
  const deleteDep = useDeleteTemplateDependency();

  const [form, setForm] = useState({
    title: editTask?.title || "",
    description: editTask?.description || "",
    type: editTask?.type || "task",
    priority: editTask?.priority || "medium",
    section_id: editTask?.section_id || "",
    duration_days: String(editTask?.duration_days ?? 1),
    estimated_hours: editTask?.estimated_hours ? String(editTask.estimated_hours) : "",
  });

  const [depTaskId, setDepTaskId] = useState("");
  const [depType, setDepType] = useState("blocked_by");

  const existingDeps = editTask ? dependencies.filter(d => d.task_id === editTask.id) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = {
      title: form.title,
      description: form.description || undefined,
      type: form.type,
      priority: form.priority,
      section_id: form.section_id || undefined,
      duration_days: parseInt(form.duration_days) || 1,
      estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : undefined,
    };
    if (editTask) {
      await updateTask.mutateAsync({ id: editTask.id, templateId, ...payload });
    } else {
      await createTask.mutateAsync({
        template_id: templateId,
        parent_task_id: parentTaskId || undefined,
        sort_order: allTasks.length,
        ...payload,
      });
    }
    onClose();
  };

  const handleAddDep = async () => {
    if (!depTaskId || !editTask) return;
    await createDep.mutateAsync({
      template_id: templateId,
      task_id: editTask.id,
      depends_on_task_id: depTaskId,
      dependency_type: depType,
    });
    setDepTaskId("");
  };

  const availableDepTasks = allTasks.filter(t => t.id !== editTask?.id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editTask ? "Edit Task" : parentTaskId ? "Add Sub-task" : "Add Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title..." required />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">✅ Task</SelectItem>
                  <SelectItem value="bug">🐛 Bug</SelectItem>
                  <SelectItem value="idea">💡 Idea</SelectItem>
                  <SelectItem value="milestone">🏁 Milestone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">🔴 Critical</SelectItem>
                  <SelectItem value="high">🟠 High</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="low">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Duration (days) *</Label>
              <Input type="number" min="1" value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {sections.length > 0 && (
              <div>
                <Label>Section</Label>
                <Select value={form.section_id || "__none"} onValueChange={v => setForm(f => ({ ...f, section_id: v === "__none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="No section" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No section</SelectItem>
                    {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Est. Hours</Label>
              <Input type="number" placeholder="0" value={form.estimated_hours} onChange={e => setForm(f => ({ ...f, estimated_hours: e.target.value }))} />
            </div>
          </div>

          {/* Dependencies (only in edit mode) */}
          {editTask && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Link className="w-3 h-3" /> Dependencies</Label>
              {existingDeps.map(d => {
                const depTask = allTasks.find(t => t.id === d.depends_on_task_id);
                return (
                  <div key={d.id} className="flex items-center gap-2 p-2 rounded border bg-muted/20 text-sm">
                    <span className="text-xs px-1.5 py-0.5 bg-secondary rounded">{d.dependency_type.replace("_", " ")}</span>
                    <span className="flex-1 truncate">{depTask?.title || "?"}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteDep.mutate({ id: d.id, templateId })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}
              <div className="flex gap-2">
                <Select value={depType} onValueChange={setDepType}>
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blocked_by">Blocked by</SelectItem>
                    <SelectItem value="blocks">Blocks</SelectItem>
                    <SelectItem value="related">Related to</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={depTaskId} onValueChange={setDepTaskId}>
                  <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Select task..." /></SelectTrigger>
                  <SelectContent>
                    {availableDepTasks.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="outline" onClick={handleAddDep} disabled={!depTaskId} className="h-8">
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Attachments (only in edit mode) */}
          {editTask && (
            <TemplateTaskAttachments taskId={editTask.id} templateId={templateId} />
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>
              {editTask ? "Save Changes" : "Add Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Attachments mini-component ─────────────────────────
function TemplateTaskAttachments({ taskId, templateId }: { taskId: string; templateId: string }) {
  const { data: attachments = [] } = useTemplateAttachments(taskId);
  const createAttachment = useCreateTemplateAttachment();
  const deleteAttachment = useDeleteTemplateAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `templates/${templateId}/${taskId}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from("pm-attachments").upload(filePath, file);
      if (uploadError) throw uploadError;
      await createAttachment.mutateAsync({
        template_id: templateId,
        task_id: taskId,
        file_name: file.name,
        file_url: filePath,
        file_size: file.size,
        file_type: file.type,
      });
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> Attachments</Label>
      {attachments.map((att: any) => (
        <div key={att.id} className="flex items-center gap-2 p-2 rounded border bg-muted/20 text-sm group">
          <Paperclip className="w-3 h-3 text-muted-foreground" />
          <span className="flex-1 truncate">{att.file_name}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100"
            onClick={() => deleteAttachment.mutate({ id: att.id, taskId, fileUrl: att.file_url })}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
      <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
        className="w-full text-left text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 px-3 py-2 border border-dashed rounded-md transition-colors hover:bg-muted/20">
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        {uploading ? "Uploading..." : "Add attachment..."}
      </button>
    </div>
  );
}

// ─── Main Builder Page ──────────────────────────────────
export default function TemplateBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: template, isLoading } = useTemplate(id!);
  const updateTemplate = useUpdateTemplate();
  const { data: sections = [] } = useTemplateSections(id!);
  const { data: tasks = [] } = useTemplateTasks(id!);
  const { data: dependencies = [] } = useTemplateDependencies(id!);

  const createSection = useCreateTemplateSection();
  const deleteSection = useDeleteTemplateSection();

  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editTask, setEditTask] = useState<TemplateTask | null>(null);
  const [parentTaskId, setParentTaskId] = useState<string | undefined>();
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [showSectionDialog, setShowSectionDialog] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameForm, setNameForm] = useState({ name: "", description: "" });

  const toggleExpand = (id: string) => {
    setExpandedTasks(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const rootTasks = useMemo(() => tasks.filter(t => !t.parent_task_id), [tasks]);

  const handleAddSection = async () => {
    if (!sectionName.trim()) return;
    await createSection.mutateAsync({ template_id: id!, name: sectionName, position: sections.length });
    setSectionName("");
    setShowSectionDialog(false);
  };

  const openAddTask = (parentId?: string) => {
    setEditTask(null);
    setParentTaskId(parentId);
    setShowTaskDialog(true);
  };

  const openEditTask = (task: TemplateTask) => {
    setEditTask(task);
    setParentTaskId(undefined);
    setShowTaskDialog(true);
  };

  if (isLoading) {
    return <Layout><div className="p-6"><div className="h-8 bg-muted animate-pulse rounded w-48" /></div></Layout>;
  }

  if (!template) {
    return <Layout><div className="p-6 text-center"><p className="text-muted-foreground">Template not found.</p></div></Layout>;
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card px-6 py-4">
          <button onClick={() => navigate("/templates")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" /> All Templates
          </button>
          <div className="flex items-start justify-between gap-4">
            {editingName ? (
              <div className="flex-1 space-y-2">
                <Input value={nameForm.name} onChange={e => setNameForm(f => ({ ...f, name: e.target.value }))} className="text-xl font-bold" />
                <Textarea value={nameForm.description} onChange={e => setNameForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Description..." />
                <div className="flex gap-2">
                  <Button size="sm" onClick={async () => {
                    await updateTemplate.mutateAsync({ id: template.id, name: nameForm.name, description: nameForm.description });
                    setEditingName(false);
                  }}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="min-w-0 cursor-pointer" onClick={() => { setNameForm({ name: template.name, description: template.description || "" }); setEditingName(true); }}>
                <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                  {template.name} <Edit2 className="w-4 h-4 text-muted-foreground" />
                </h1>
                {template.description && <p className="text-sm text-muted-foreground mt-0.5">{template.description}</p>}
              </div>
            )}
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowSectionDialog(true)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Section
              </Button>
              <Button size="sm" onClick={() => openAddTask()} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Task
              </Button>
            </div>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span>{sections.length} sections</span>
            <span>{tasks.length} tasks</span>
            <span>{dependencies.length} dependencies</span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Sections list */}
          {sections.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Sections</h3>
              <div className="flex flex-wrap gap-2">
                {sections.map(s => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/30 text-sm group">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span>{s.name}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100"
                      onClick={() => deleteSection.mutate({ id: s.id, templateId: id! })}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Task</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 w-28">Section</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 w-20">Priority</th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-3 py-2 w-20">Duration</th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-3 py-2 w-20">Est. Hrs</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 w-36">Depends On</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2 w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rootTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      No tasks yet. Click "Task" to add your first template task.
                    </td>
                  </tr>
                ) : (
                  rootTasks.map(task => (
                    <TaskRow key={task.id} task={task} allTasks={tasks} sections={sections}
                      dependencies={dependencies} templateId={id!}
                      expandedTasks={expandedTasks} toggleExpand={toggleExpand}
                      onEdit={openEditTask} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Quick add subtask buttons */}
          {rootTasks.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Quick add sub-task to:</p>
              <div className="flex flex-wrap gap-2">
                {rootTasks.map(t => (
                  <Button key={t.id} variant="outline" size="sm" onClick={() => openAddTask(t.id)} className="gap-1 text-xs">
                    <Plus className="w-3 h-3" /> {t.title}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section dialog */}
      <Dialog open={showSectionDialog} onOpenChange={setShowSectionDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Section</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Section Name</Label>
              <Input value={sectionName} onChange={e => setSectionName(e.target.value)} placeholder="e.g. Design Phase" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowSectionDialog(false)}>Cancel</Button>
              <Button onClick={handleAddSection} disabled={!sectionName.trim()}>Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task dialog */}
      {showTaskDialog && (
        <TaskDialog
          open={showTaskDialog}
          onClose={() => { setShowTaskDialog(false); setEditTask(null); setParentTaskId(undefined); }}
          templateId={id!}
          sections={sections}
          allTasks={tasks}
          dependencies={dependencies}
          editTask={editTask}
          parentTaskId={parentTaskId}
        />
      )}
    </Layout>
  );
}
