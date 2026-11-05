import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePMAI } from "@/hooks/usePMAI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, HelpCircle, Trash2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  projectId: string;
}

const statusColors: Record<string, string> = {
  open: "bg-red-100 text-red-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const priorityColors: Record<string, string> = {
  low: "outline",
  medium: "secondary",
  high: "destructive",
  critical: "destructive",
};

export function SupportPanel({ projectId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const ai = usePMAI();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["pm_support_requests", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_support_requests")
        .select("*, profiles:requested_by(full_name)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createRequest = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase.from("pm_support_requests").insert({
        project_id: projectId,
        title,
        description,
        priority,
        requested_by: user.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      qc.invalidateQueries({ queryKey: ["pm_support_requests", projectId] });
      setOpen(false);
      const savedTitle = title;
      const savedDesc = description;
      setTitle("");
      setDescription("");
      setPriority("medium");
      toast.success("Support request created");
      // Auto-triage with AI
      if (data?.id) {
        const result = await ai.invoke("triage_support", projectId, {
          requestId: data.id,
          title: savedTitle,
          description: savedDesc,
        });
        if (result?.suggestion) {
          await supabase.from("pm_support_requests")
            .update({ ai_suggestion: result.suggestion, priority: result.priority || data.priority })
            .eq("id", data.id);
          qc.invalidateQueries({ queryKey: ["pm_support_requests", projectId] });
          toast.success("AI triage complete");
        }
      }
    },
    onError: () => toast.error("Failed to create request"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("pm_support_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_support_requests", projectId] });
      toast.success("Status updated");
    },
  });

  const deleteRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pm_support_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_support_requests", projectId] });
      toast.success("Request deleted");
    },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-orange-500" /> Support Requests
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> New Request</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Support Request</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="What do you need help with?" value={title} onChange={e => setTitle(e.target.value)} />
              <Textarea placeholder="Describe the issue or request in detail..." value={description} onChange={e => setDescription(e.target.value)} />
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => createRequest.mutate()} disabled={!title.trim() || createRequest.isPending} className="w-full">
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No support requests. Create one if you need help.</div>
      ) : (
        <div className="space-y-3">
          {requests.map((req: any) => (
             <Card key={req.id}>
               <CardContent className="p-4">
                 <div className="flex items-start justify-between gap-3">
                   <div className="flex-1 min-w-0">
                     <h3 className="font-medium text-foreground">{req.title}</h3>
                     {req.description && <p className="text-sm text-muted-foreground mt-1">{req.description}</p>}
                     {req.ai_suggestion && (
                       <div className="mt-2 p-2 rounded-md border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
                         <p className="text-xs font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                           <Sparkles className="w-3 h-3" /> AI Suggestion
                         </p>
                         <p className="text-xs text-green-600 dark:text-green-300 mt-0.5">{req.ai_suggestion}</p>
                       </div>
                     )}
                     <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                       <span>{req.profiles?.full_name || "Unknown"}</span>
                       <span>·</span>
                       <span>{format(new Date(req.created_at), "MMM d, yyyy")}</span>
                       <Badge variant={priorityColors[req.priority] as any || "outline"} className="text-[10px]">
                         {req.priority}
                       </Badge>
                     </div>
                   </div>
                   <div className="flex items-center gap-2">
                     {!req.ai_suggestion && (
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-7 w-7"
                         disabled={ai.loading}
                         onClick={async () => {
                           const result = await ai.invoke("triage_support", projectId, {
                             requestId: req.id,
                             title: req.title,
                             description: req.description,
                           });
                           if (result?.suggestion) {
                             await supabase.from("pm_support_requests")
                               .update({ ai_suggestion: result.suggestion, priority: result.priority || req.priority })
                               .eq("id", req.id);
                             qc.invalidateQueries({ queryKey: ["pm_support_requests", projectId] });
                             toast.success("AI triage complete");
                           }
                         }}
                       >
                         {ai.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                       </Button>
                     )}
                     <Select value={req.status} onValueChange={(status) => updateStatus.mutate({ id: req.id, status })}>
                       <SelectTrigger className="h-7 text-xs w-28">
                         <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusColors[req.status] || ""}`}>
                           {req.status.replace("_", " ")}
                         </span>
                       </SelectTrigger>
                       <SelectContent>
                         {["open", "in_progress", "resolved", "closed"].map(s => (
                           <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                     <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRequest.mutate(req.id)}>
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
