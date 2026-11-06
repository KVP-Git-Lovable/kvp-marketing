import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, RefreshCw, Send, Wrench, CheckCircle2, XCircle, Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  body: string;
  status: string;
  rejection_reason: string | null;
  twilio_content_sid: string | null;
  twilio_template_type: string | null;
  twilio_media_url: string | null;
  twilio_media_is_variable: boolean | null;
  twilio_required_variables: string[] | null;
  twilio_synced_at: string | null;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-destructive/10 text-destructive",
};

export default function WhatsAppTemplateDetails({ templateId, onBack }: { templateId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [showSendTest, setShowSendTest] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testVars, setTestVars] = useState<Record<string, string>>({});
  const [twilioCheck, setTwilioCheck] = useState<Record<string, any> | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; status: number; content_type: string | null; content_length: string | null; error?: string } | null>(null);

  const invoke = async (payload: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    if (!response.ok || json?.success === false) throw new Error(json.error || "Request failed");
    return json;
  };

  const { data: template, isLoading } = useQuery({
    queryKey: ["whatsapp-template-details", templateId],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_templates").select("*").eq("id", templateId).single();
      if (error) throw error;
      return data as WhatsAppTemplate;
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => invoke({ action: "refresh-status", template_id: templateId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-template-details", templateId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Status refreshed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyMutation = useMutation({
    mutationFn: () => invoke({ action: "verify-media-url", template_id: templateId }),
    onSuccess: (data) => { setVerifyResult(data); toast(data.ok ? "Media URL is reachable" : "Media URL check failed", { icon: data.ok ? "✅" : "⚠️" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const repairMutation = useMutation({
    mutationFn: () => invoke({ action: "repair-media-url", template_id: templateId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-template-details", templateId] });
      toast.success("Media URL repaired — resubmitted for approval");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cacheMutation = useMutation({
    mutationFn: () => invoke({ action: "refresh-media-cache", template_id: templateId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-template-details", templateId] });
      toast.success("Media cache refreshed — resubmitted for approval");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const twilioCheckMutation = useMutation({
    mutationFn: () => invoke({ action: "twilio-check", template_id: templateId }),
    onSuccess: (data) => setTwilioCheck(data),
    onError: (e: Error) => toast.error(e.message),
  });

  const sendTestMutation = useMutation({
    mutationFn: () => invoke({ action: "send-test", template_id: templateId, to: testTo, variables: testVars }),
    onSuccess: () => {
      setShowSendTest(false); setTestTo(""); setTestVars({});
      toast.success("Test message sent");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !template) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Templates</Button>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const requiredVars = template.twilio_required_variables || [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Templates</Button>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">{template.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{template.category}</Badge>
            <Badge className={statusColors[template.status] || statusColors.draft}>{template.status}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending || !template.twilio_content_sid}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} /> Refresh Status
          </Button>
          <Button variant="outline" size="sm" onClick={() => twilioCheckMutation.mutate()} disabled={twilioCheckMutation.isPending}>
            {twilioCheckMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Stethoscope className="h-4 w-4 mr-2" />} Check Twilio
          </Button>
          <Button size="sm" onClick={() => setShowSendTest(true)} disabled={!template.twilio_content_sid || template.status !== "approved"} title={template.status !== "approved" ? "Only approved templates can be test-sent" : undefined}>
            <Send className="h-4 w-4 mr-2" /> Send Test
          </Button>
        </div>
      </div>

      {template.rejection_reason && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">Rejection reason: {template.rejection_reason}</div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Message Body</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border bg-muted/30 p-3 whitespace-pre-wrap text-sm">{template.body}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">API Content Definition</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Content SID</p>
            <p className="font-mono text-xs">{template.twilio_content_sid || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Content Type</p>
            <p className="font-medium">{template.twilio_template_type || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Media URL</p>
            <p className="text-xs break-all">
              {template.twilio_media_url || "—"}
              {template.twilio_media_url && (
                <Badge variant="outline" className="ml-2 text-[10px]">{template.twilio_media_is_variable ? "Variable" : "Static"}</Badge>
              )}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Required Variables</p>
            <p className="text-xs">{requiredVars.length ? requiredVars.join(", ") : "None"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Last Synced</p>
            <p className="text-xs">{template.twilio_synced_at ? format(new Date(template.twilio_synced_at), "MMM d, yyyy HH:mm") : "—"}</p>
          </div>
        </CardContent>
      </Card>

      {template.twilio_media_url && (
        <Card>
          <CardHeader><CardTitle className="text-base">Media URL Tools</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
                {verifyMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Test Reachability
              </Button>
              <Button variant="outline" size="sm" onClick={() => repairMutation.mutate()} disabled={repairMutation.isPending}>
                <Wrench className="h-4 w-4 mr-2" /> Repair Media URL
              </Button>
              <Button variant="outline" size="sm" onClick={() => cacheMutation.mutate()} disabled={cacheMutation.isPending}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh Media Cache
              </Button>
            </div>
            {verifyResult && (
              <div className={`flex items-start gap-2 rounded-md p-3 text-sm ${verifyResult.ok ? "bg-green-50 dark:bg-green-950" : "bg-destructive/10"}`}>
                {verifyResult.ok ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                <div className="text-xs">
                  <p>HTTP {verifyResult.status} · {verifyResult.content_type || "unknown type"} · {verifyResult.content_length ? `${verifyResult.content_length} bytes` : "unknown size"}</p>
                  {verifyResult.error && <p className="text-destructive mt-1">{verifyResult.error}</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!twilioCheck} onOpenChange={(o) => !o && setTwilioCheck(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Twilio setup check</DialogTitle></DialogHeader>
          {twilioCheck && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Sending route</span><span className="font-medium text-right">{twilioCheck.route}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Sender (TWILIO_WHATSAPP_NUMBER)</span><span className="font-mono text-right">{twilioCheck.configured_sender || "not set"}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Saved Account SID secret</span><span className="font-mono text-right">{twilioCheck.saved_account_sid || "not set"}</span></div>
              {twilioCheck.template && (
                <div className="rounded-md border p-2 space-y-1">
                  <p className="font-medium">Template {twilioCheck.template.name}</p>
                  <p>{twilioCheck.template.found_in_account ? "Found in this Twilio account" : "NOT found in this Twilio account"}{twilioCheck.template.account_sid ? ` (${twilioCheck.template.account_sid})` : ""}</p>
                  {twilioCheck.template.error && <p className="text-destructive">{twilioCheck.template.error}</p>}
                </div>
              )}
              <div className="rounded-md border p-2 space-y-1">
                <p className="font-medium">WhatsApp senders on this account</p>
                {twilioCheck.whatsapp_senders ? (
                  <>
                    <p className="font-mono break-all">{twilioCheck.whatsapp_senders.join(", ") || "none"}</p>
                    <p className={twilioCheck.configured_sender_registered ? "text-green-600" : "text-destructive"}>
                      {twilioCheck.configured_sender_registered ? "The configured sender is registered here." : "The configured sender is NOT registered on this account."}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Not available: {twilioCheck.whatsapp_senders_unavailable || "unknown"}</p>
                )}
              </div>
              {twilioCheck.problem && <p className="text-destructive">{twilioCheck.problem}</p>}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setTwilioCheck(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSendTest} onOpenChange={setShowSendTest}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Send Test Message</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">To (phone number)</Label>
              <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="+919876543210" />
            </div>
            {requiredVars.map((v) => (
              <div key={v}>
                <Label className="text-xs">{`{{${v}}}`}</Label>
                <Input
                  value={testVars[v] || ""}
                  onChange={(e) => setTestVars((f) => ({ ...f, [v]: e.target.value }))}
                  placeholder={`Value for ${v}`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendTest(false)}>Cancel</Button>
            <Button onClick={() => sendTestMutation.mutate()} disabled={!testTo.trim() || sendTestMutation.isPending}>
              {sendTestMutation.isPending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
