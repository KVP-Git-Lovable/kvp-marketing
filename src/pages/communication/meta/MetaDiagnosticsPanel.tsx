import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, CheckCircle2, XCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface MetaStatus {
  connected: boolean; connection_id: string | null; business_name: string | null; external_user_name: string | null;
  default_ad_account_id: string | null;
}
interface AdAccount { ad_account_id: string; account_name: string | null; currency: string | null; timezone_name: string | null; account_status: number | null }
interface DiagnosticRow {
  id: string; check_name: string; status: string; detail: string | null; category: string | null;
  endpoint: string | null; method: string | null; http_status: number | null; duration_ms: number | null; run_at: string;
}

export default function MetaDiagnosticsPanel() {
  const queryClient = useQueryClient();

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("meta-api", { body: { action, ...extra } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const { data: status } = useQuery({
    queryKey: ["meta-connection-status"],
    queryFn: () => invoke("status") as Promise<MetaStatus>,
  });

  const { data: adAccount } = useQuery({
    queryKey: ["meta-diagnostics-ad-account", status?.default_ad_account_id, status?.connection_id],
    enabled: !!status?.default_ad_account_id && !!status?.connection_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("meta_ad_accounts").select("ad_account_id, account_name, currency, timezone_name, account_status").eq("ad_account_id", status!.default_ad_account_id!).eq("connection_id", status!.connection_id).maybeSingle();
      if (error) throw error;
      return data as AdAccount | null;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["meta-diagnostics-history"],
    queryFn: () => invoke("diagnostics_history") as Promise<DiagnosticRow[]>,
  });

  const runMutation = useMutation({
    mutationFn: () => invoke("diagnostics_run"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meta-diagnostics-history"] });
      const failed = (data.results || []).filter((r: { status: string }) => r.status === "fail").length;
      toast(failed ? `${failed} check(s) failed` : "All checks passed", { icon: failed ? "⚠️" : "✅" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Meta Diagnostics</h2>
          <p className="text-xs text-muted-foreground">Check the health of the Meta connection, tokens, permissions and recent API calls.</p>
        </div>
        <Button size="sm" onClick={() => runMutation.mutate()} disabled={!status?.connected || runMutation.isPending}>
          <PlayCircle className={`h-4 w-4 mr-2 ${runMutation.isPending ? "animate-spin" : ""}`} /> Run Diagnostics
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Meta Connection</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Status</p>
            <Badge className={status?.connected ? "bg-green-100 text-green-800 border-transparent" : "bg-muted text-muted-foreground"}>
              {status?.connected ? "Connected" : "Not connected"}
            </Badge>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Business Name</p>
            <p className="font-medium">{status?.business_name || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Facebook User</p>
            <p className="font-medium">{status?.external_user_name || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Ad Account</p>
            <p className="font-medium">{adAccount?.account_name || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Currency / Timezone</p>
            <p className="font-medium">{adAccount ? `${adAccount.currency || "—"} / ${adAccount.timezone_name || "—"}` : "—"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Account Status</p>
            <p className="font-medium">{adAccount?.account_status ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">API Activity</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No diagnostic runs yet</TableCell></TableRow>
              ) : (
                history.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.run_at), { addSuffix: true })}</TableCell>
                    <TableCell className="text-xs">{r.category || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.endpoint || "—"}</TableCell>
                    <TableCell>
                      {r.status === "pass" ? (
                        <span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> Pass</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3.5 w-3.5" /> Fail</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.duration_ms != null ? `${r.duration_ms}ms` : "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
