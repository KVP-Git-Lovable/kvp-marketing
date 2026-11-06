import { useEffect, useRef, useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Unlink, RefreshCw, Facebook, Instagram, CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface MetaStatus {
  connected: boolean;
  connection_id: string | null;
  meta_user_id: string | null;
  external_user_name: string | null;
  business_id: string | null;
  business_name: string | null;
  default_page_id: string | null;
  default_instagram_id: string | null;
  default_ad_account_id: string | null;
  default_ad_instagram_id: string | null;
  default_ad_instagram_username: string | null;
  connected_at: string | null;
  token_expires_at: string | null;
}

interface MetaPage {
  id: string;
  page_id: string;
  page_name: string | null;
  instagram_business_id: string | null;
  instagram_username: string | null;
}

interface MetaAdAccount {
  id: string;
  ad_account_id: string;
  account_name: string | null;
  currency: string | null;
}

const PAGE_DEFAULT = "__page__";

export default function MetaConnectionTab() {
  const queryClient = useQueryClient();
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);

  const [defaultPageId, setDefaultPageId] = useState("");
  const [defaultInstagramId, setDefaultInstagramId] = useState("");
  const [defaultAdAccountId, setDefaultAdAccountId] = useState("");
  const [defaultAdInstagramId, setDefaultAdInstagramId] = useState("");

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("meta-api", { body: { action, ...extra } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const { data: status, isLoading } = useQuery({
    queryKey: ["meta-connection-status"],
    queryFn: () => invoke("status") as Promise<MetaStatus>,
  });

  const { data: pages = [] } = useQuery({
    queryKey: ["meta-connection-pages", status?.connection_id],
    enabled: !!status?.connected && !!status?.connection_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("meta_pages").select("id, page_id, page_name, instagram_business_id, instagram_username").eq("connection_id", status!.connection_id).order("page_name");
      if (error) throw error;
      return data as MetaPage[];
    },
  });
  const igAccounts = pages.filter((p) => p.instagram_business_id);

  const { data: adAccounts = [] } = useQuery({
    queryKey: ["meta-connection-ad-accounts", status?.connection_id],
    enabled: !!status?.connected && !!status?.connection_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("meta_ad_accounts").select("id, ad_account_id, account_name, currency").eq("connection_id", status!.connection_id).order("account_name");
      if (error) throw error;
      return data as MetaAdAccount[];
    },
  });

  const { data: adIgAccounts = [] } = useQuery({
    queryKey: ["meta-connection-ad-ig-accounts", defaultAdAccountId],
    enabled: !!status?.connected && !!defaultAdAccountId,
    queryFn: async () => {
      const acc = adAccounts.find((a) => a.id === defaultAdAccountId);
      if (!acc) return [];
      const data = await invoke("list_ad_instagram_accounts", { ad_account_id: acc.ad_account_id });
      return (data.accounts || []) as Array<{ id: string; username: string }>;
    },
  });

  useEffect(() => {
    if (!status) return;
    setDefaultPageId(pages.find((p) => p.page_id === status.default_page_id)?.id || "");
    setDefaultInstagramId(pages.find((p) => p.instagram_business_id === status.default_instagram_id)?.id || "");
    setDefaultAdAccountId(adAccounts.find((a) => a.ad_account_id === status.default_ad_account_id)?.id || "");
  }, [status, pages, adAccounts]);

  useEffect(() => {
    if (!status) return;
    if (adIgAccounts.some((a) => a.id === status.default_ad_instagram_id)) {
      setDefaultAdInstagramId(status.default_ad_instagram_id || "");
    }
  }, [status, adIgAccounts]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      await invoke("sync-pages");
      await invoke("sync_instagram_accounts");
      await invoke("sync-ad-accounts");
      return invoke("campaigns_import");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-connection-pages"] });
      queryClient.invalidateQueries({ queryKey: ["meta-connection-ad-accounts"] });
      toast.success("Pages, Instagram accounts, ad accounts and campaigns synced");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // postMessage is a best-effort fast path — Facebook's own pages commonly set
  // cross-origin-opener-policy headers that sever window.opener partway through
  // the redirect chain, so the popup's message often never arrives even though
  // the connection succeeded server-side. Polling whether the popup has closed
  // is the reliable path: refetch status as soon as it does, regardless of
  // whether postMessage got through. Either path, a successful connect means
  // Pages/Instagram/Ad Accounts/Campaigns still need to be pulled from Meta —
  // kick that sync automatically rather than leaving it to a button nobody
  // knows to click.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source === "meta-oauth") {
        queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
        if (e.data.ok) {
          toast.success("Meta account connected");
          syncMutation.mutate();
        } else {
          toast.error("Meta connection was not completed");
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
  }, []);

  const watchPopupClose = useCallback((popup: Window | null) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (!popup) return;
    pollRef.current = window.setInterval(() => {
      if (popup.closed) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
        syncMutation.mutate();
      }
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-oauth-start", { method: "POST" });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { url: string };
    },
    onSuccess: (data) => {
      popupRef.current = window.open(data.url, "meta-oauth", "width=600,height=700");
      watchPopupClose(popupRef.current);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => invoke("disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
      toast.success("Meta account disconnected");
    },
  });

  const refreshInstagramMutation = useMutation({
    mutationFn: () => invoke("sync_instagram_accounts"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meta-connection-pages"] });
      const warningCount = Object.keys(data.warnings || {}).length;
      toast.success(warningCount ? `Refreshed — ${warningCount} page(s) need review` : "Instagram accounts refreshed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveConfigMutation = useMutation({
    mutationFn: () => {
      const page = pages.find((p) => p.id === defaultPageId);
      const igPage = pages.find((p) => p.id === defaultInstagramId);
      const adAcc = adAccounts.find((a) => a.id === defaultAdAccountId);
      const adIg = adIgAccounts.find((a) => a.id === defaultAdInstagramId);
      return invoke("save_config", {
        default_page_id: page?.page_id || null,
        default_instagram_id: igPage?.instagram_business_id || null,
        default_ad_account_id: adAcc?.ad_account_id || null,
        default_ad_instagram_id: defaultAdInstagramId === PAGE_DEFAULT ? PAGE_DEFAULT : adIg?.id || null,
        default_ad_instagram_username: adIg?.username || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
      toast.success("Configuration saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><Facebook className="h-5 w-5 text-primary" /> Meta Business Connection</h2>
        <p className="text-xs text-muted-foreground">One secure sign-in links your Pages, Instagram accounts and Ad Accounts.</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Checking...</p>
          ) : status?.connected ? (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2 rounded-md bg-primary/5 border border-primary/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Connected Successfully</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncMutation.isPending ? "animate-spin" : ""}`} /> Sync Pages &amp; Ad Accounts
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                    <Link2 className={`h-3.5 w-3.5 mr-1.5`} /> Reconnect
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
                    <Unlink className="h-3.5 w-3.5 mr-1.5" /> Disconnect
                  </Button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Facebook User</p>
                  <p className="font-medium">{status.external_user_name || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Business Name</p>
                  <p className="font-medium">{status.business_name || "—"}</p>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-4 pt-2 border-t">
                <div className="pt-3">
                  <p className="text-sm font-medium flex items-center gap-1.5 mb-2"><Facebook className="h-3.5 w-3.5" /> Connected Facebook Pages</p>
                  <div className="space-y-1">
                    {pages.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No pages found. Click "Sync Pages &amp; Ad Accounts".</p>
                    ) : pages.map((p) => (
                      <div key={p.id} className="text-sm rounded border px-2.5 py-1.5">{p.page_name}</div>
                    ))}
                  </div>
                </div>
                <div className="pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" /> Connected Instagram Accounts</p>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => refreshInstagramMutation.mutate()} disabled={refreshInstagramMutation.isPending}>
                      <RefreshCw className={`h-3 w-3 mr-1 ${refreshInstagramMutation.isPending ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {igAccounts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No Instagram business accounts linked.</p>
                    ) : igAccounts.map((p) => (
                      <div key={p.id} className="text-sm rounded border px-2.5 py-1.5">@{p.instagram_username || p.instagram_business_id}</div>
                    ))}
                  </div>
                </div>
                <div className="pt-3">
                  <p className="text-sm font-medium flex items-center gap-1.5 mb-2"><Link2 className="h-3.5 w-3.5" /> Connected Ad Accounts</p>
                  <div className="space-y-1">
                    {adAccounts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No ad accounts found. Click "Sync Pages &amp; Ad Accounts".</p>
                    ) : adAccounts.map((a) => (
                      <div key={a.id} className="text-sm rounded border px-2.5 py-1.5">{a.account_name} ({a.currency})</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <p className="text-xs font-medium mb-1.5">Default Facebook Page</p>
                  <Select value={defaultPageId} onValueChange={setDefaultPageId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select page" /></SelectTrigger>
                    <SelectContent>
                      {pages.map((p) => <SelectItem key={p.id} value={p.id}>{p.page_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1.5">Default Instagram account (organic)</p>
                  <Select value={defaultInstagramId} onValueChange={setDefaultInstagramId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {igAccounts.map((p) => <SelectItem key={p.id} value={p.id}>@{p.instagram_username || p.instagram_business_id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1.5">Default Ad Account</p>
                  <Select value={defaultAdAccountId} onValueChange={(v) => { setDefaultAdAccountId(v); setDefaultAdInstagramId(""); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select ad account" /></SelectTrigger>
                    <SelectContent>
                      {adAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1.5">Default Instagram profile for ads</p>
                  <Select value={defaultAdInstagramId} onValueChange={setDefaultAdInstagramId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Page default" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PAGE_DEFAULT}>Page default (Page-backed Instagram)</SelectItem>
                      {adIgAccounts.map((a) => <SelectItem key={a.id} value={a.id}>@{a.username}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending}>
                <Save className="h-4 w-4 mr-2" /> Save Configuration
              </Button>
            </>
          ) : (
            <>
              <Badge variant="secondary">Not connected</Badge>
              <p className="text-xs text-muted-foreground">
                Requires the <code>META_APP_ID</code>, <code>META_APP_SECRET</code> and <code>META_TOKEN_ENC_KEY</code> project secrets to be configured.
              </p>
              <Button size="sm" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                <Link2 className="h-4 w-4 mr-2" />
                Connect Meta Account
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
