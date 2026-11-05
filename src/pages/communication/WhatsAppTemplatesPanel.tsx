import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Plus, RefreshCw, Eye, Trash2, MessageSquare, Download, Info, AlertTriangle, CheckCircle2, Clock, XCircle, Circle, Image as ImageIcon, Link2, Phone, Upload, X, FileText, MessageCircle, Copy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  buildStoredBody,
  transformFriendlyToTwilio,
  validateFriendlyBody,
  parseStoredBody,
  transformTwilioToFriendly,
} from "@/lib/whatsappVariables";
import { InsertVariablePicker } from "@/components/communication/InsertVariablePicker";
import WhatsAppTemplateDetails from "./WhatsAppTemplateDetails";

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  body: string;
  twilio_content_sid: string | null;
  status: string;
  rejection_reason: string | null;
  user_initiated_approved: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  twilio_content_types?: Record<string, any> | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-destructive/10 text-destructive",
};

type ContentType = "text" | "media" | "call_to_action";
type CtaButton = { type: "URL" | "PHONE_NUMBER"; title: string; url: string; phone: string };

const emptyCta = (): CtaButton => ({ type: "URL", title: "", url: "", phone: "" });

const TEMPLATE_PREFIX = "kvp_";

const initialForm = {
  name: "",
  category: "UTILITY",
  language: "en",
  body: "",
  contentType: "text" as ContentType,
  mediaUrl: "",
  ctaButtons: [emptyCta()] as CtaButton[],
  variableSamples: {} as Record<string, string>,
};

export default function WhatsAppTemplatesPanel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showAll, setShowAll] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaTab, setMediaTab] = useState<"url" | "upload">("url");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleMediaUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("File too large (max 16 MB)");
      return;
    }
    setMediaUploading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${authUser.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("whatsapp-media").upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      setForm((f) => ({ ...f, mediaUrl: pub.publicUrl }));
      toast.success("File uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setMediaUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const invoke = async (payload: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      }
    );
    return response;
  };

  const createMutation = useMutation({
    mutationFn: async (templateData: typeof form) => {
      const { storedBody } = buildStoredBody(templateData.body);
      const payload: Record<string, unknown> = {
        name: `${TEMPLATE_PREFIX}${templateData.name}`,
        category: templateData.category,
        language: templateData.language,
        body: storedBody,
        content_type: templateData.contentType,
      };
      if (templateData.contentType === "media") {
        payload.media_url = templateData.mediaUrl.trim();
      }
      if (templateData.contentType === "call_to_action") {
        payload.cta_actions = templateData.ctaButtons.map((b) => ({
          type: b.type,
          title: b.title.trim(),
          url: b.type === "URL" ? b.url.trim() : undefined,
          phone: b.type === "PHONE_NUMBER" ? b.phone.trim() : undefined,
        }));
      }
      const friendlyVars = validation.variables;
      if (friendlyVars.length > 0) {
        const samples: Record<string, string> = {};
        friendlyVars.forEach((name, idx) => {
          samples[String(idx + 1)] = (templateData.variableSamples[name] || "").trim();
        });
        payload.variable_samples = samples;
      }
      const response = await invoke(payload);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create template");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      setShowCreateDialog(false);
      setForm(initialForm);
      setMediaTab("url");
      toast.success("Template created successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
  });

  const bulkSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await invoke({ action: "bulk-sync" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Statuses synced");
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const response = await invoke({ action: "import-from-twilio" });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to import");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success(`Imported ${data.imported} templates, ${data.skipped} already existed`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("whatsapp_templates")
        .delete()
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Template deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filteredTemplates = templates.filter((t) => {
    if (!/^kvp_/i.test(t.name)) return false;
    if (!showAll && t.created_by !== user?.id) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    return true;
  });

  const insertVariableAtCursor = (varName: string) => {
    const placeholder = `{{${varName}}}`;
    const ta = textareaRef.current;
    if (!ta) {
      setForm((f) => ({ ...f, body: f.body + placeholder }));
      return;
    }
    const start = ta.selectionStart ?? form.body.length;
    const end = ta.selectionEnd ?? form.body.length;
    const newBody = form.body.slice(0, start) + placeholder + form.body.slice(end);
    setForm({ ...form, body: newBody });
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + placeholder.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const validation = validateFriendlyBody(form.body);
  const { twilioBody } = transformFriendlyToTwilio(form.body);

  const ctaValid =
    form.contentType !== "call_to_action" ||
    (form.ctaButtons.length > 0 &&
      form.ctaButtons.length <= 2 &&
      form.ctaButtons.every(
        (b) =>
          b.title.trim().length > 0 &&
          (b.type === "URL" ? b.url.trim().length > 0 : b.phone.trim().length > 0),
      ));
  const mediaValid = form.contentType !== "media" || form.mediaUrl.trim().length > 0;
  const samplesValid = validation.variables.every(
    (v) => (form.variableSamples[v] || "").trim().length > 0,
  );
  const canSubmit =
    !!form.name &&
    !!form.body &&
    validation.valid &&
    ctaValid &&
    mediaValid &&
    samplesValid &&
    !createMutation.isPending;

  const updateCta = (idx: number, patch: Partial<CtaButton>) =>
    setForm((f) => ({
      ...f,
      ctaButtons: f.ctaButtons.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    }));
  const addCta = () =>
    setForm((f) => (f.ctaButtons.length >= 2 ? f : { ...f, ctaButtons: [...f.ctaButtons, emptyCta()] }));
  const removeCta = (idx: number) =>
    setForm((f) => ({ ...f, ctaButtons: f.ctaButtons.filter((_, i) => i !== idx) }));

  const handleDuplicate = (tpl: WhatsAppTemplate) => {
    const { twilioBody: tBody, mapping } = parseStoredBody(tpl.body || "");
    const friendlyBody = mapping ? transformTwilioToFriendly(tBody, mapping) : tBody;

    const types = tpl.twilio_content_types || {};
    let contentType: ContentType = "text";
    let mediaUrl = "";
    let ctaButtons: CtaButton[] = [emptyCta()];

    if (types["twilio/media"]) {
      contentType = "media";
      const mediaArr = types["twilio/media"]?.media;
      if (Array.isArray(mediaArr) && typeof mediaArr[0] === "string") {
        mediaUrl = mediaArr[0];
      }
    } else if (types["twilio/call-to-action"]) {
      contentType = "call_to_action";
      const actions = types["twilio/call-to-action"]?.actions;
      if (Array.isArray(actions) && actions.length > 0) {
        ctaButtons = actions.slice(0, 2).map((a: any) => ({
          type: a?.type === "PHONE_NUMBER" ? "PHONE_NUMBER" : "URL",
          title: typeof a?.title === "string" ? a.title : "",
          url: typeof a?.url === "string" ? a.url : "",
          phone: typeof a?.phone === "string" ? a.phone : "",
        }));
      }
    }

    const baseName = (tpl.name || "template").replace(/^kvp_/, "").replace(/_copy(_\d+)?$/, "");
    let candidate = `${baseName}_copy`;
    const existingNames = new Set(templates.map((t) => t.name));
    let n = 2;
    while (existingNames.has(`${TEMPLATE_PREFIX}${candidate}`)) {
      candidate = `${baseName}_copy_${n++}`;
    }

    setForm({
      name: candidate,
      category: tpl.category || "UTILITY",
      language: tpl.language || "en",
      body: friendlyBody,
      contentType,
      mediaUrl,
      ctaButtons,
      variableSamples: {},
    });
    setShowCreateDialog(true);
    toast.info("Duplicated — review and click Create to submit");
  };

  if (detailsId) {
    return <WhatsAppTemplateDetails templateId={detailsId} onBack={() => setDetailsId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">WhatsApp Templates</h2>
          <p className="text-xs text-muted-foreground">Create and manage WhatsApp message templates via the QuickApp Messaging Content API</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
            <Download className={`h-4 w-4 sm:mr-2 ${importMutation.isPending ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Import from API</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => bulkSyncMutation.mutate()} disabled={bulkSyncMutation.isPending}>
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${bulkSyncMutation.isPending ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Sync All</span>
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[48%] sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[48%] sm:w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="UTILITY">Utility</SelectItem>
            <SelectItem value="MARKETING">Marketing</SelectItem>
            <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showAll ? "default" : "outline"}
          size="sm"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show Mine" : "Show All"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : filteredTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">No templates found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{template.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge className={statusColors[template.status] || statusColors.draft}>{template.status}</Badge>
                          {template.user_initiated_approved && template.status !== "approved" && (
                            <Badge variant="outline" className="text-xs">User-initiated</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(template.updated_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setDetailsId(template.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleDuplicate(template)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Duplicate template</TooltipContent>
                          </Tooltip>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Delete this template?")) {
                                deleteMutation.mutate(template.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden divide-y">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground text-sm">No templates found</p>
              </div>
            ) : (
              filteredTemplates.map((template) => {
                const StatusIcon =
                  template.status === "approved" ? CheckCircle2
                  : template.status === "submitted" ? Clock
                  : template.status === "rejected" ? XCircle
                  : Circle;
                return (
                  <button
                    key={template.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/50 active:bg-muted transition-colors flex items-start gap-2"
                    onClick={() => setDetailsId(template.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-sm font-medium truncate">{template.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1 py-0 leading-tight">{template.category}</Badge>
                        <span className="text-[11px] text-muted-foreground">{format(new Date(template.updated_at), "MMM d")}</span>
                        <span className="text-[10px] capitalize">{template.status}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>


      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create WhatsApp Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Content Type</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {([
                  { v: "text", icon: MessageCircle, label: "Text", desc: "Plain message" },
                  { v: "media", icon: ImageIcon, label: "Media", desc: "Image, video or PDF" },
                  { v: "call_to_action", icon: Link2, label: "Call to action", desc: "Button to URL or phone" },
                ] as const).map(({ v, icon: Icon, label, desc }) => {
                  const active = form.contentType === v;
                  return (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setForm((f) => ({ ...f, contentType: v }))}
                      className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors ${
                        active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>Template Name</Label>
              <Input
                placeholder="e.g. order_confirmation"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase with underscores only. Will be saved as{" "}
                <span className="font-mono">{TEMPLATE_PREFIX}{form.name || "your_template_name"}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Language</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.contentType === "media" && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-medium">Header Media</Label>
                </div>
                <Tabs value={mediaTab} onValueChange={(v) => setMediaTab(v as "url" | "upload")}>
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="url" className="text-xs">Paste URL</TabsTrigger>
                    <TabsTrigger value="upload" className="text-xs">Upload file</TabsTrigger>
                  </TabsList>
                  <TabsContent value="url" className="mt-2">
                    <Input
                      placeholder="https://example.com/image.jpg"
                      value={form.mediaUrl}
                      onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })}
                    />
                  </TabsContent>
                  <TabsContent value="upload" className="mt-2 space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleMediaUpload(f);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={mediaUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className={`h-4 w-4 mr-2 ${mediaUploading ? "animate-pulse" : ""}`} />
                      {mediaUploading ? "Uploading..." : "Choose file (image / video / PDF, max 16 MB)"}
                    </Button>
                    {form.mediaUrl && (
                      <p className="text-[11px] text-muted-foreground break-all">Uploaded: {form.mediaUrl}</p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Message Body</Label>
                <InsertVariablePicker onInsert={insertVariableAtCursor} />
              </div>
              <Textarea
                ref={textareaRef}
                rows={5}
                placeholder="Hello {{retailer_name}}, your order {{order_id}} has been confirmed."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Click "Insert Variable" to add named variables — they get auto-mapped to {"{{1}}, {{2}}"} for the API.
              </p>

              {validation.warnings.length > 0 && (
                <div className="mt-2 rounded-md bg-destructive/10 p-2 space-y-1">
                  {validation.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {validation.variables.length > 0 && (
                <div className="mt-3 rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-primary" />
                    <Label className="text-sm font-medium">Sample values for variables</Label>
                  </div>
                  <div className="space-y-2">
                    {validation.variables.map((v, i) => (
                      <div key={v} className="grid grid-cols-[auto,1fr] items-center gap-2">
                        <Badge variant="secondary" className="text-xs whitespace-nowrap">
                          {`{{${i + 1}}}`} · {v}
                        </Badge>
                        <Input
                          value={form.variableSamples[v] || ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              variableSamples: { ...f.variableSamples, [v]: e.target.value },
                            }))
                          }
                          placeholder={`Example value for ${v}`}
                          className="h-8 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {form.contentType === "call_to_action" && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-primary" />
                    <Label className="text-sm font-medium">Call to Action Buttons</Label>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{form.ctaButtons.length}/2</span>
                </div>
                {form.ctaButtons.map((btn, idx) => (
                  <div key={idx} className="rounded border bg-background p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Button {idx + 1}</span>
                      {form.ctaButtons.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeCta(idx)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Type of action</Label>
                        <Select value={btn.type} onValueChange={(v) => updateCta(idx, { type: v as "URL" | "PHONE_NUMBER" })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="URL"><span className="flex items-center gap-2"><Link2 className="h-3 w-3" /> Visit Website</span></SelectItem>
                            <SelectItem value="PHONE_NUMBER"><span className="flex items-center gap-2"><Phone className="h-3 w-3" /> Call Phone Number</span></SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Button Text</Label>
                        <Input className="h-9" maxLength={25} placeholder="e.g. Shop Now" value={btn.title} onChange={(e) => updateCta(idx, { title: e.target.value })} />
                      </div>
                    </div>
                    {btn.type === "URL" ? (
                      <div>
                        <Label className="text-xs">URL</Label>
                        <Input className="h-9" placeholder="https://example.com" value={btn.url} onChange={(e) => updateCta(idx, { url: e.target.value })} />
                      </div>
                    ) : (
                      <div>
                        <Label className="text-xs">Phone Number (E.164)</Label>
                        <Input className="h-9" placeholder="+14155551234" value={btn.phone} onChange={(e) => updateCta(idx, { phone: e.target.value })} />
                      </div>
                    )}
                  </div>
                ))}
                {form.ctaButtons.length < 2 && (
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={addCta}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add another button
                  </Button>
                )}
              </div>
            )}

            {form.body && (
              <div>
                <Label className="text-sm">Preview</Label>
                <Tabs defaultValue="friendly" className="mt-1">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="friendly" className="text-xs">WhatsApp preview</TabsTrigger>
                    <TabsTrigger value="twilio" className="text-xs">API format</TabsTrigger>
                  </TabsList>
                  <TabsContent value="friendly">
                    <div className="rounded-md border bg-[#e5ddd5] dark:bg-muted/50 p-3">
                      <div className="rounded-lg bg-background shadow-sm p-3 space-y-2 max-w-sm">
                        {form.contentType === "media" && form.mediaUrl && (
                          /\.(jpe?g|png|gif|webp)$/i.test(form.mediaUrl) ? (
                            <img src={form.mediaUrl} alt="" className="rounded max-h-40 w-full object-cover" />
                          ) : (
                            <div className="flex items-center gap-2 rounded bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              <span className="truncate">{form.mediaUrl}</span>
                            </div>
                          )
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{form.body}</p>
                        {form.contentType === "call_to_action" && (
                          <div className="border-t pt-1 -mx-3 px-3 -mb-3 pb-1 space-y-1">
                            {form.ctaButtons.map((b, i) => (
                              <div key={i} className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-primary border-t first:border-t-0">
                                {b.type === "URL" ? <Link2 className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                                {b.title || <span className="text-muted-foreground">Button text</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="twilio">
                    <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap leading-relaxed border font-mono">
                      {twilioBody || <span className="text-muted-foreground">Empty</span>}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!canSubmit}>
              {createMutation.isPending ? "Creating..." : "Create & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
