import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  useTemplates, useCreateTemplate, useDeleteTemplate,
  useTemplate, useUpdateTemplate,
  useTemplateSections, useCreateTemplateSection, useDeleteTemplateSection,
  useTemplateTasks, useCreateTemplateTask, useUpdateTemplateTask, useDeleteTemplateTask,
  useTemplateDependencies, useCreateTemplateDependency, useDeleteTemplateDependency,
  useTemplateAttachments, useCreateTemplateAttachment, useDeleteTemplateAttachment,
  TemplateTask, TemplateDependency,
} from "@/hooks/useTemplates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Search, Trash2, ChevronRight, ChevronDown, MoreVertical,
  Paperclip, GitBranch, FileText, ChevronsUpDown, ChevronsDownUp,
  ArrowLeft, Edit2, Clock, Loader2, X, Link
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Template List (landing view) ───────────────────────
function TemplateListView({ onSelect }: { onSelect: (id: string) => void }) {
  const { data: templates = [], isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const t = await createTemplate.mutateAsync(form);
    setForm({ name: "", description: "" });
    setShowCreate(false);
    onSelect(t.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-base font-medium text-foreground mb-1">
            {templates.length === 0 ? "No templates yet" : "No matches"}
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            {templates.length === 0 ? "Create your first template to standardize project structures." : "Try a different search."}
          </p>
          {templates.length === 0 && (
            <Button onClick={() => setShowCreate(true)} size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Create First Template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(template => (
            <Card key={template.id} className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border"
              onClick={() => onSelect(template.id)}>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    <h3 className="font-semibold text-foreground truncate text-sm">{template.name}</h3>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); deleteTemplate.mutate(template.id); }}>
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {template.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Created {format(new Date(template.created_at), "MMM d, yyyy")}</span>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create New Template</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Template Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Website Redesign" required />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description..." rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createTemplate.isPending}>
                {createTemplate.isPending ? "Creating..." : "Create Template"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Inline Duration Editor ─────────────────────────────
function InlineDurationEditor({ task, templateId }: { task: TemplateTask; templateId: string }) {
  const updateTask = useUpdateTemplateTask();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(task.duration_days));

  const save = () => {
    const num = parseInt(value) || 1;
    if (num !== task.duration_days) {
      updateTask.mutate({ id: task.id, templateId, duration_days: num });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus type="number" min="1" value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        onClick={e => e.stopPropagation()}
        className="w-12 text-xs text-center bg-transparent border border-input rounded px-1 py-0.5 outline-none"
      />
    );
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setValue(String(task.duration_days)); setEditing(true); }}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {task.duration_days}d
    </button>
  );
}

// ─── Inline Hours Editor ────────────────────────────────
function InlineHoursEditor({ task, templateId }: { task: TemplateTask; templateId: string }) {
  const updateTask = useUpdateTemplateTask();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.estimated_hours?.toString() || "");

  const save = () => {
    const num = value ? parseFloat(value) : null;
    if (num !== (task.estimated_hours ?? null)) {
      updateTask.mutate({ id: task.id, templateId, estimated_hours: num });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus type="number" step="0.5" value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        onClick={e => e.stopPropagation()}
        className="w-12 text-xs text-center bg-transparent border border-input rounded px-1 py-0.5 outline-none"
      />
    );
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setValue(task.estimated_hours?.toString() || ""); setEditing(true); }}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {task.estimated_hours ? `${task.estimated_hours}h` : "—"}
    </button>
  );
}

// ─── Inline Dependency Editor ───────────────────────────
function InlineTemplateDependencyEditor({
  taskId, allTasks, dependencies, templateId
}: {
  taskId: string; allTasks: TemplateTask[]; dependencies: TemplateDependency[]; templateId: string;
}) {
  const createDep = useCreateTemplateDependency();
  const deleteDep = useDeleteTemplateDependency();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const taskDeps = dependencies.filter(d => d.task_id === taskId);
  const depTaskIds = taskDeps.map(d => d.depends_on_task_id);
  const filtered = allTasks.filter(t => t.id !== taskId && !depTaskIds.includes(t.id) && t.title.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  if (taskDeps.length === 0 && !open) {
    return (
      <div ref={ref} onClick={e => e.stopPropagation()}>
        <button onClick={() => setOpen(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">—</button>
        {open && renderDropdown()}
      </div>
    );
  }

  function renderDropdown() {
    return (
      <div className="absolute top-full left-0 mt-1 w-56 bg-popover border rounded-lg shadow-lg z-50 p-2">
        <input
          autoFocus value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search tasks..."
          className="w-full text-xs bg-transparent border-b pb-1.5 mb-1 outline-none text-foreground placeholder:text-muted-foreground/50"
        />
        {filtered.map(t => (
          <button key={t.id}
            onClick={() => { createDep.mutate({ template_id: templateId, task_id: taskId, depends_on_task_id: t.id, dependency_type: "blocked_by" }); setQuery(""); }}
            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors truncate"
          >{t.title}</button>
        ))}
        {query && filtered.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No tasks found</p>}
      </div>
    );
  }

  const firstDep = taskDeps[0];
  const firstTask = allTasks.find(t => t.id === firstDep.depends_on_task_id);
  const firstName = firstTask?.title || "Unknown";
  const truncated = firstName.length > 14 ? firstName.slice(0, 14) + "…" : firstName;

  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <GitBranch className="w-3 h-3 flex-shrink-0" />
        <span className="truncate max-w-[100px]">{truncated}</span>
        {taskDeps.length > 1 && <span className="text-[10px] font-medium text-primary">+({taskDeps.length - 1})</span>}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-popover border rounded-lg shadow-lg z-50 p-2">
          <div className="text-[10px] font-medium text-muted-foreground uppercase mb-1.5">Current</div>
          {taskDeps.map(d => {
            const t = allTasks.find(x => x.id === d.depends_on_task_id);
            return (
              <div key={d.id} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-muted/50">
                <span className="truncate">{t?.title || "Unknown"}</span>
                <button onClick={() => deleteDep.mutate({ id: d.id, templateId })} className="text-destructive hover:underline text-[10px]">×</button>
              </div>
            );
          })}
          <div className="border-t mt-1.5 pt-1.5">
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Add dependency..."
              className="w-full text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50"
            />
            {filtered.map(t => (
              <button key={t.id}
                onClick={() => { createDep.mutate({ template_id: templateId, task_id: taskId, depends_on_task_id: t.id, dependency_type: "blocked_by" }); setQuery(""); }}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors truncate"
              >{t.title}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Attachment indicator ───────────────────────────────
function TemplateAttachmentIndicator({ taskId }: { taskId: string }) {
  const { data: attachments = [] } = useTemplateAttachments(taskId);
  if (attachments.length === 0) return null;
  return (
    <div className="flex items-center gap-0.5 text-muted-foreground" title={`${attachments.length} attachment(s)`}>
      <Paperclip className="w-3 h-3" />
      {attachments.length > 1 && <span className="text-[10px]">{attachments.length}</span>}
    </div>
  );
}

// ─── Priority Badge ─────────────────────────────────────
function TemplatePriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", colors[priority] || "bg-muted text-muted-foreground")}>
      {priority}
    </span>
  );
}

// ─── Task Edit Dialog (for editing full details + attachments) ───
function TemplateTaskEditDialog({
  open, onClose, task, templateId, allTasks, dependencies, sections,
}: {
  open: boolean; onClose: () => void; task: TemplateTask; templateId: string;
  allTasks: TemplateTask[]; dependencies: TemplateDependency[];
  sections: { id: string; name: string }[];
}) {
  const updateTask = useUpdateTemplateTask();
  const createDep = useCreateTemplateDependency();
  const deleteDep = useDeleteTemplateDependency();

  const [form, setForm] = useState({
    title: task.title,
    description: task.description || "",
    type: task.type,
    priority: task.priority,
    section_id: task.section_id || "",
    duration_days: String(task.duration_days),
    estimated_hours: task.estimated_hours ? String(task.estimated_hours) : "",
  });
  const [depTaskId, setDepTaskId] = useState("");

  const taskDeps = dependencies.filter(d => d.task_id === task.id);
  const availableDepTasks = allTasks.filter(t => t.id !== task.id && !taskDeps.some(d => d.depends_on_task_id === t.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await updateTask.mutateAsync({
      id: task.id, templateId,
      title: form.title,
      description: form.description || undefined,
      type: form.type,
      priority: form.priority,
      section_id: form.section_id || undefined,
      duration_days: parseInt(form.duration_days) || 1,
      estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
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
              <Label>Duration (days)</Label>
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
              <Input type="number" step="0.5" value={form.estimated_hours} onChange={e => setForm(f => ({ ...f, estimated_hours: e.target.value }))} />
            </div>
          </div>

          {/* Dependencies */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Link className="w-3 h-3" /> Dependencies</Label>
            {taskDeps.map(d => {
              const depTask = allTasks.find(t => t.id === d.depends_on_task_id);
              return (
                <div key={d.id} className="flex items-center gap-2 p-2 rounded border bg-muted/20 text-sm">
                  <span className="text-xs px-1.5 py-0.5 bg-secondary rounded">{d.dependency_type.replace("_", " ")}</span>
                  <span className="flex-1 truncate">{depTask?.title || "?"}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" type="button"
                    onClick={() => deleteDep.mutate({ id: d.id, templateId })}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
            <div className="flex gap-2">
              <Select value={depTaskId} onValueChange={setDepTaskId}>
                <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Select task..." /></SelectTrigger>
                <SelectContent>
                  {availableDepTasks.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" variant="outline" className="h-8"
                disabled={!depTaskId}
                onClick={async () => {
                  await createDep.mutateAsync({ template_id: templateId, task_id: task.id, depends_on_task_id: depTaskId, dependency_type: "blocked_by" });
                  setDepTaskId("");
                }}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Attachments */}
          <TemplateTaskAttachmentsEditor taskId={task.id} templateId={templateId} />

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={updateTask.isPending}>Save Changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Attachments editor ─────────────────────────────────
function TemplateTaskAttachmentsEditor({ taskId, templateId }: { taskId: string; templateId: string }) {
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
        template_id: templateId, task_id: taskId,
        file_name: file.name, file_url: filePath, file_size: file.size, file_type: file.type,
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
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100" type="button"
            onClick={() => deleteAttachment.mutate({ id: att.id, taskId, fileUrl: att.file_url })}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
        className="w-full text-left text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 px-3 py-2 border border-dashed rounded-md transition-colors hover:bg-muted/20">
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        {uploading ? "Uploading..." : "Add attachment..."}
      </button>
    </div>
  );
}

// ─── Template Builder (Work Plan style) ─────────────────
function TemplateBuilder({ templateId, onBack }: { templateId: string; onBack: () => void }) {
  const { data: template } = useTemplate(templateId);
  const updateTemplate = useUpdateTemplate();
  const { data: sections = [] } = useTemplateSections(templateId);
  const { data: tasks = [] } = useTemplateTasks(templateId);
  const { data: dependencies = [] } = useTemplateDependencies(templateId);

  const createSection = useCreateTemplateSection();
  const deleteSection = useDeleteTemplateSection();
  const createTask = useCreateTemplateTask();
  const deleteTask = useDeleteTemplateTask();

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [inlineAddTarget, setInlineAddTarget] = useState<{ sectionId: string | null; parentTaskId: string | null } | null>(null);
  const [inlineTitle, setInlineTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const sectionInputRef = useRef<HTMLInputElement>(null);
  const [editTask, setEditTask] = useState<TemplateTask | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameForm, setNameForm] = useState({ name: "", description: "" });

  const rootTasks = useMemo(() => tasks.filter(t => !t.parent_task_id), [tasks]);
  const getSubtasks = (parentId: string) => tasks.filter(t => t.parent_task_id === parentId);

  const sectionGroups = useMemo(() => {
    const groups: { id: string; name: string; tasks: TemplateTask[] }[] = [];
    sections.forEach(s => {
      groups.push({ id: s.id, name: s.name, tasks: rootTasks.filter(t => t.section_id === s.id) });
    });
    const unsectioned = rootTasks.filter(t => !t.section_id);
    if (unsectioned.length > 0 || sections.length === 0) {
      groups.unshift({ id: "__unsectioned", name: "No section", tasks: unsectioned });
    }
    return groups;
  }, [sections, rootTasks]);

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleTaskExpand = (id: string) => {
    setExpandedTasks(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleInlineSubmit = async () => {
    if (!inlineTitle.trim()) { setInlineAddTarget(null); setInlineTitle(""); return; }
    await createTask.mutateAsync({
      template_id: templateId,
      parent_task_id: inlineAddTarget?.parentTaskId || undefined,
      section_id: inlineAddTarget?.sectionId === "__unsectioned" ? undefined : (inlineAddTarget?.sectionId || undefined),
      title: inlineTitle.trim(),
      type: "task",
      priority: "medium",
      duration_days: 1,
      sort_order: tasks.length,
    });
    setInlineTitle("");
  };

  const startInlineAdd = (sectionId: string | null, parentTaskId: string | null = null) => {
    setInlineAddTarget({ sectionId, parentTaskId });
    setInlineTitle("");
    if (parentTaskId) {
      setExpandedTasks(prev => new Set(prev).add(parentTaskId));
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleAddSection = async () => {
    if (!newSectionName.trim()) { setShowAddSection(false); return; }
    await createSection.mutateAsync({ template_id: templateId, name: newSectionName.trim(), position: sections.length });
    setNewSectionName("");
    setShowAddSection(false);
  };

  const TaskRow = ({ task, depth = 0, sectionId }: { task: TemplateTask; depth?: number; sectionId: string }) => {
    const subtasks = getSubtasks(task.id);
    const isExpanded = expandedTasks.has(task.id);
    const isInlineTarget = inlineAddTarget?.parentTaskId === task.id;

    return (
      <>
        <tr className="border-b hover:bg-muted/30 transition-colors group cursor-pointer"
          onClick={() => setEditTask(task)}>
          {/* Name */}
          <td className="py-2 px-4">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 20}px` }}>
              {subtasks.length > 0 ? (
                <button onClick={e => { e.stopPropagation(); toggleTaskExpand(task.id); }} className="text-muted-foreground hover:text-foreground">
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ) : <span className="w-3.5" />}
              <span className="text-sm font-medium text-foreground truncate">{task.title}</span>
              <TemplateAttachmentIndicator taskId={task.id} />
            </div>
          </td>
          {/* Duration */}
          <td className="py-2 px-3 text-center">
            <InlineDurationEditor task={task} templateId={templateId} />
          </td>
          {/* Est. Hours */}
          <td className="py-2 px-3 text-center">
            <InlineHoursEditor task={task} templateId={templateId} />
          </td>
          {/* Dependencies */}
          <td className="py-2 px-3 whitespace-nowrap">
            <InlineTemplateDependencyEditor taskId={task.id} allTasks={tasks} dependencies={dependencies} templateId={templateId} />
          </td>
          {/* Priority */}
          <td className="py-2 px-3"><TemplatePriorityBadge priority={task.priority} /></td>
          {/* Actions */}
          <td className="py-2 px-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                  <MoreVertical className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={e => { e.stopPropagation(); startInlineAdd(sectionId, task.id); }}>
                  <Plus className="w-3.5 h-3.5 mr-2" /> Add subtask
                </DropdownMenuItem>
                <DropdownMenuItem onClick={e => { e.stopPropagation(); setEditTask(task); }}>
                  <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit details
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); deleteTask.mutate({ id: task.id, templateId }); }}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </td>
        </tr>
        {isExpanded && subtasks.map(sub => <TaskRow key={sub.id} task={sub} depth={depth + 1} sectionId={sectionId} />)}
        {isExpanded && isInlineTarget && (
          <tr className="border-b bg-muted/10">
            <td colSpan={6} className="py-1.5 px-4">
              <div className="flex items-center gap-2" style={{ paddingLeft: `${(depth + 1) * 20}px` }}>
                <span className="w-3.5" />
                <span className="text-xs text-muted-foreground">↳ subtask</span>
                <input
                  ref={inputRef} autoFocus value={inlineTitle}
                  onChange={e => setInlineTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleInlineSubmit();
                    if (e.key === "Escape") { setInlineAddTarget(null); setInlineTitle(""); }
                  }}
                  onBlur={() => handleInlineSubmit()}
                  placeholder="Type subtask name and press Enter..."
                  className="flex-1 text-sm bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
            </td>
          </tr>
        )}
      </>
    );
  };

  if (!template) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          {editingName ? (
            <div className="flex-1 space-y-2">
              <Input value={nameForm.name} onChange={e => setNameForm(f => ({ ...f, name: e.target.value }))} className="text-lg font-bold" />
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
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2 truncate">
                {template.name} <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
              </h2>
              {template.description && <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>}
            </div>
          )}
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground items-center">
          <span>{sections.length} sections</span>
          <span>{tasks.length} tasks</span>
          <span>{dependencies.length} deps</span>
        </div>
      </div>

      {/* Expand/Collapse */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
          onClick={() => {
            const parentIds = tasks.filter(t => tasks.some(s => s.parent_task_id === t.id)).map(t => t.id);
            setExpandedTasks(new Set(parentIds));
          }}>
          <ChevronsUpDown className="w-3.5 h-3.5" /> Expand all
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
          onClick={() => setExpandedTasks(new Set())}>
          <ChevronsDownUp className="w-3.5 h-3.5" /> Collapse all
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">Name</th>
              <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground w-20">Duration</th>
              <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground w-16">Hours</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground w-36">Depends on</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground w-20">Priority</th>
              <th className="py-2.5 px-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {sectionGroups.map(group => {
              const isCollapsed = collapsedSections.has(group.id);
              const isInlineForSection = inlineAddTarget?.sectionId === group.id && !inlineAddTarget?.parentTaskId;
              return (
                <TemplateSectionGroup
                  key={group.id}
                  group={group}
                  isCollapsed={isCollapsed}
                  onToggle={() => toggleSection(group.id)}
                  onDeleteSection={group.id !== "__unsectioned" ? () => deleteSection.mutate({ id: group.id, templateId }) : undefined}
                  isInlineAdd={isInlineForSection}
                  inlineTitle={inlineTitle}
                  inputRef={inputRef}
                  onInlineTitleChange={setInlineTitle}
                  onInlineSubmit={handleInlineSubmit}
                  onCancelInline={() => { setInlineAddTarget(null); setInlineTitle(""); }}
                  onStartInlineAdd={() => startInlineAdd(group.id)}
                  TaskRowComponent={TaskRow}
                  sectionId={group.id}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add section */}
      <div className="px-1">
        {showAddSection ? (
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-muted-foreground" />
            <input
              ref={sectionInputRef} autoFocus value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleAddSection();
                if (e.key === "Escape") { setShowAddSection(false); setNewSectionName(""); }
              }}
              onBlur={handleAddSection}
              placeholder="New section name..."
              className="flex-1 text-sm font-semibold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
        ) : (
          <button
            onClick={() => { setShowAddSection(true); setTimeout(() => sectionInputRef.current?.focus(), 50); }}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add section
          </button>
        )}
      </div>

      {/* Edit dialog */}
      {editTask && (
        <TemplateTaskEditDialog
          open={!!editTask}
          onClose={() => setEditTask(null)}
          task={editTask}
          templateId={templateId}
          allTasks={tasks}
          dependencies={dependencies}
          sections={sections}
        />
      )}
    </div>
  );
}

// ─── Section group ──────────────────────────────────────
function TemplateSectionGroup({ group, isCollapsed, onToggle, onDeleteSection, isInlineAdd, inlineTitle, inputRef, onInlineTitleChange, onInlineSubmit, onCancelInline, onStartInlineAdd, TaskRowComponent, sectionId }: {
  group: { id: string; name: string; tasks: TemplateTask[] };
  isCollapsed: boolean;
  onToggle: () => void;
  onDeleteSection?: () => void;
  isInlineAdd: boolean;
  inlineTitle: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onInlineTitleChange: (v: string) => void;
  onInlineSubmit: () => void;
  onCancelInline: () => void;
  onStartInlineAdd: () => void;
  TaskRowComponent: any;
  sectionId: string;
}) {
  return (
    <>
      <tr className="bg-muted/20 border-b">
        <td colSpan={6} className="py-2 px-4">
          <div className="flex items-center gap-2">
            <button onClick={onToggle} className="text-muted-foreground hover:text-foreground">
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <span className="text-sm font-bold text-foreground">{group.name}</span>
            <span className="text-xs text-muted-foreground">({group.tasks.length})</span>
            {onDeleteSection && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto">
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-destructive" onClick={onDeleteSection}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete section
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </td>
      </tr>
      {!isCollapsed && group.tasks.map(task => (
        <TaskRowComponent key={task.id} task={task} sectionId={sectionId} />
      ))}
      {!isCollapsed && (
        <tr className="border-b hover:bg-muted/10 transition-colors">
          <td colSpan={6} className="py-1.5 px-4">
            {isInlineAdd ? (
              <div className="flex items-center gap-2 pl-6">
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  ref={inputRef} autoFocus value={inlineTitle}
                  onChange={e => onInlineTitleChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") onInlineSubmit();
                    if (e.key === "Escape") onCancelInline();
                  }}
                  onBlur={onInlineSubmit}
                  placeholder="Type task name and press Enter..."
                  className="flex-1 text-sm bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
            ) : (
              <button onClick={onStartInlineAdd}
                className="w-full text-left text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 pl-6 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add task...
              </button>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Export ─────────────────────────────────────────
export function TemplateWorkPlanView() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  if (selectedTemplateId) {
    return <TemplateBuilder templateId={selectedTemplateId} onBack={() => setSelectedTemplateId(null)} />;
  }

  return <TemplateListView onSelect={setSelectedTemplateId} />;
}
