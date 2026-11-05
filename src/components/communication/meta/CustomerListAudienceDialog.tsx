import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Upload, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  parseAudienceFile, validateAudienceRows, downloadAudienceTemplateCSV,
  MIN_AUDIENCE_ROWS, MAX_AUDIENCE_ROWS, type AudienceRow, type AudienceSummary,
} from "@/lib/audienceImport";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adAccountId: string;
  onCreated: (audience: { id: string; name: string }) => void;
}

export function CustomerListAudienceDialog({ open, onOpenChange, adAccountId, onCreated }: Props) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<AudienceRow[]>([]);
  const [summary, setSummary] = useState<AudienceSummary | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFileName(""); setRows([]); setSummary(null); setName(""); setDescription("");
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      setFileName(file.name);
      const raw = await parseAudienceFile(file);
      const { rows: validated, summary: s } = validateAudienceRows(raw);
      setRows(validated);
      setSummary(s);
      if (!name) setName(file.name.replace(/\.(csv|xlsx|xls)$/i, ""));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read file");
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payloadRows = rows.filter((r) => r.resolved).map((r) => ({ email: r.normalizedEmail || "", phone: r.normalizedPhone || "" }));
      const { data, error } = await supabase.functions.invoke("meta-api", {
        body: {
          action: "create_customer_list_audience",
          name, description: description || undefined,
          ad_account_id: adAccountId, origin: "file", origin_ref: fileName,
          invalid_count: summary?.invalid || 0, duplicate_count: summary?.duplicates || 0,
          rows: payloadRows,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success("Customer list uploaded — Meta usually takes a few hours to finish matching it");
      onCreated(data.audience);
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const validCount = summary?.valid || 0;
  const canCreate = !!name && validCount >= MIN_AUDIENCE_ROWS && validCount <= MAX_AUDIENCE_ROWS;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Upload Customer List</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Upload a CSV or Excel file with email and/or phone columns. Identifiers are hashed before they reach Meta and are not stored in this app.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={downloadAudienceTemplateCSV}>
            <Download className="h-3.5 w-3.5 mr-2" /> Download template (CSV)
          </Button>
          <div>
            <input
              ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Button type="button" variant="outline" className="w-full" disabled={parsing} onClick={() => fileInputRef.current?.click()}>
              <Upload className={`h-4 w-4 mr-2 ${parsing ? "animate-pulse" : ""}`} />
              {parsing ? "Reading..." : fileName || "Choose file (CSV or Excel)"}
            </Button>
          </div>

          {summary && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-xs">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><p className="text-sm font-semibold">{summary.total}</p><p className="text-muted-foreground">Total</p></div>
                <div><p className="text-sm font-semibold text-green-600">{summary.valid}</p><p className="text-muted-foreground">Valid</p></div>
                <div><p className="text-sm font-semibold text-destructive">{summary.invalid}</p><p className="text-muted-foreground">Invalid</p></div>
                <div><p className="text-sm font-semibold text-amber-600">{summary.duplicates}</p><p className="text-muted-foreground">Duplicates</p></div>
              </div>
              {summary.valid < MIN_AUDIENCE_ROWS && (
                <p className="flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Meta needs at least {MIN_AUDIENCE_ROWS} valid people in a customer list.
                </p>
              )}
              {summary.valid > MAX_AUDIENCE_ROWS && (
                <p className="flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> The limit per list is {MAX_AUDIENCE_ROWS} people.
                </p>
              )}
            </div>
          )}

          <div>
            <Label className="text-xs">Audience Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali Repeat Customers" />
          </div>
          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!canCreate || createMutation.isPending}>
            {createMutation.isPending ? "Uploading..." : "Create Audience"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
