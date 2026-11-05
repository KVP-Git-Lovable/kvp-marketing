import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Copy, Check, Save, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface WhatsAppConfigData {
  phone_number: string;
  status: string;
  business_name: string;
  webhook_url: string;
  throughput: string;
  last_synced_at: string | null;
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b last:border-b-0">
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
    <div className="text-sm">{children}</div>
  </div>
);

export default function WhatsAppConfigPanel() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [businessName, setBusinessName] = useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["whatsapp-config"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-config", { method: "GET" });
      if (error) throw error;
      return data as WhatsAppConfigData;
    },
  });

  useEffect(() => {
    if (data?.business_name !== undefined) setBusinessName(data.business_name || "");
  }, [data?.business_name]);

  const saveMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-config", {
        method: "POST",
        body: { business_name: name },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-config"] });
      toast.success("Business display name saved");
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const isOnline = data?.status === "ONLINE";

  const handleCopy = async () => {
    if (!data?.webhook_url) return;
    await navigator.clipboard.writeText(data.webhook_url);
    setCopied(true);
    toast.success("Webhook URL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">WhatsApp Configuration</h2>
          <p className="text-xs text-muted-foreground">
            Live view of this project's WhatsApp sender setup (same number already used for order/invoice WhatsApp messages).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sender Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : error ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-destructive text-sm">Failed to load configuration.</p>
              <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
            </div>
          ) : data ? (
            <div className="space-y-0">
              <Row label="WhatsApp Sender Number">
                <div className="flex items-center gap-2 w-full sm:w-[28rem]">
                  <Input readOnly value={data.phone_number} className="font-mono text-sm h-9 bg-muted" />
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-label="Fixed to this project's existing QuickApp Messaging sender" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Fixed to this project's existing QuickApp Messaging WhatsApp number — not editable here.
                </p>
              </Row>
              <Row label="Status">
                {isOnline ? (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-transparent gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">{data.status}</Badge>
                )}
              </Row>
              <Row label="Business Display Name">
                <div className="flex items-center gap-2 w-full sm:w-[28rem]">
                  <Input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Acme Distribution"
                    className="h-9"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={() => saveMutation.mutate(businessName)}
                    disabled={saveMutation.isPending || businessName === (data.business_name || "")}
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    Save
                  </Button>
                </div>
              </Row>
              <Row label="Throughput">{data.throughput}</Row>
              <Row label="Webhook URL">
                <div className="flex items-center gap-2 w-full sm:w-[28rem]">
                  <Input readOnly value={data.webhook_url} className="font-mono text-xs h-9" />
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopy} aria-label="Copy webhook URL">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </Row>
              <Row label="Last Synced">
                <span className="text-muted-foreground">
                  {data.last_synced_at ? formatDistanceToNow(new Date(data.last_synced_at), { addSuffix: true }) : "—"}
                </span>
              </Row>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
