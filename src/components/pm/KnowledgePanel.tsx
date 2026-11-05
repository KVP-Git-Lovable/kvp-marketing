import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePMAI } from "@/hooks/usePMAI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileText, Trash2, Download, Upload, Sparkles, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  projectId: string;
}

export function KnowledgePanel({ projectId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [docName, setDocName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { invoke: aiInvoke, loading: gapsLoading, data: gapsData, setData: setGapsData } = usePMAI();
  const [showGaps, setShowGaps] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["pm_knowledge_documents", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_knowledge_documents")
        .select("*, profiles:uploaded_by(full_name)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createDoc = useMutation({
    mutationFn: async () => {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let fileUrl: string | null = null;
      let fileName: string | null = null;

      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${projectId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("pm-knowledge")
          .upload(path, file);
        if (uploadError) throw uploadError;
        fileUrl = path;
        fileName = file.name;
      }

      const { error } = await supabase.from("pm_knowledge_documents").insert({
        project_id: projectId,
        document_name: docName,
        description,
        file_url: fileUrl,
        file_name: fileName,
        uploaded_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_knowledge_documents", projectId] });
      setOpen(false);
      setDocName("");
      setDescription("");
      setFile(null);
      toast.success("Document added");
    },
    onError: () => toast.error("Failed to add document"),
    onSettled: () => setUploading(false),
  });

  const deleteDoc = useMutation({
    mutationFn: async (doc: any) => {
      if (doc.file_url) {
        await supabase.storage.from("pm-knowledge").remove([doc.file_url]);
      }
      const { error } = await supabase.from("pm_knowledge_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_knowledge_documents", projectId] });
      toast.success("Document deleted");
    },
  });

  const downloadFile = async (doc: any) => {
    if (!doc.file_url) return;
    const { data, error } = await supabase.storage.from("pm-knowledge").createSignedUrl(doc.file_url, 60);
    if (error || !data?.signedUrl) {
      toast.error("Failed to get download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" /> Knowledge Base
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={async () => { const r = await aiInvoke("knowledge_gaps", projectId); if (r) setShowGaps(true); }} disabled={gapsLoading} className="gap-1">
            {gapsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-500" />}
            {gapsLoading ? "Analyzing..." : "AI: Suggest Missing"}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Add Document</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Knowledge Document</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">Document Name *</label>
                <Input placeholder="e.g. API Design Guidelines" value={docName} onChange={e => setDocName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea placeholder="Brief description..." value={description} onChange={e => setDescription(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Attach File</label>
                <div className="mt-1 border border-dashed rounded-md p-4 text-center">
                  <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" id="knowledge-file" />
                  <label htmlFor="knowledge-file" className="cursor-pointer flex flex-col items-center gap-1">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{file ? file.name : "Click to select a file"}</span>
                  </label>
                </div>
              </div>
              <Button onClick={() => createDoc.mutate()} disabled={!docName.trim() || uploading} className="w-full">
                {uploading ? "Uploading..." : "Add Document"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* AI Knowledge Gaps */}
      {showGaps && gapsData?.suggestions?.length > 0 && (
        <div className="border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Suggested Missing Knowledge
            </span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowGaps(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          {gapsData.suggestions.map((s: any, i: number) => (
            <div key={i} className="p-2 rounded border bg-background text-sm">
              <h4 className="font-medium text-foreground">{s.document_name}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
              <p className="text-[10px] text-muted-foreground mt-1 italic">Why: {s.reason}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No documents yet. Add knowledge resources for your team.</div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc: any) => (
            <Card key={doc.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-blue-50 mt-0.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-foreground">{doc.document_name}</h3>
                      {doc.description && <p className="text-sm text-muted-foreground mt-0.5">{doc.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                        <span>{doc.profiles?.full_name || "Unknown"}</span>
                        <span>·</span>
                        <span>{format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                        {doc.file_name && <span className="text-primary">· {doc.file_name}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {doc.file_url && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadFile(doc)}>
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteDoc.mutate(doc)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
