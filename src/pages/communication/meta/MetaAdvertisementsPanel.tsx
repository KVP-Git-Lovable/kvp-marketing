import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, RefreshCw, ExternalLink, Rocket, Target, Megaphone, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import MetaCampaignsPanel from "./MetaCampaignsPanel";
import MetaAdSetsPanel from "./MetaAdSetsPanel";
import MetaAdsPanel from "./MetaAdsPanel";

const SAVED_AD_ACCOUNT_KEY = "meta-ads-saved-account-id";

function readSavedAdAccountId(): string {
  try {
    return localStorage.getItem(SAVED_AD_ACCOUNT_KEY) || "";
  } catch {
    return "";
  }
}

interface MetaAdAccount { id: string; ad_account_id: string; account_name: string | null }
interface BillingAccount {
  name: string; currency: string; account_status_label: string;
  is_prepay_account: boolean; amount_spent: string; balance: string; spend_cap: string | null;
  funding_source: { display_string?: string; type?: string } | null;
}

type View = "billing" | "campaigns" | "ad-sets" | "ads";

export default function MetaAdvertisementsPanel() {
  const [view, setView] = useState<View>("billing");
  const [adAccountId, setAdAccountId] = useState(readSavedAdAccountId);
  const [savedAdAccountId, setSavedAdAccountId] = useState(readSavedAdAccountId);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("meta-api", { body: { action, ...extra } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const { data: status } = useQuery({
    queryKey: ["meta-connection-status"],
    queryFn: () => invoke("status") as Promise<{ connection_id: string | null }>,
  });

  const { data: adAccounts = [] } = useQuery({
    queryKey: ["meta-ad-accounts-list", status?.connection_id],
    enabled: !!status?.connection_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("meta_ad_accounts").select("id, ad_account_id, account_name").eq("connection_id", status!.connection_id).order("account_name");
      if (error) throw error;
      return data as MetaAdAccount[];
    },
  });

  useEffect(() => {
    if (adAccounts.length === 0) return;
    const exists = adAccountId && adAccounts.some((a) => a.id === adAccountId);
    if (!exists) setAdAccountId(adAccounts[0].id);
  }, [adAccounts, adAccountId]);

  const selectedAccount = adAccounts.find((a) => a.id === adAccountId);

  const saveAdAccount = () => {
    try {
      localStorage.setItem(SAVED_AD_ACCOUNT_KEY, adAccountId);
    } catch {
      // ignore — selection still works for this session, just won't persist across navigation
    }
    setSavedAdAccountId(adAccountId);
    toast.success("Ad account saved — Campaigns, Ad Sets and Ads will keep using it.");
  };

  const { data: billing, isFetching: billingLoading, refetch: refetchBilling } = useQuery({
    queryKey: ["meta-billing", selectedAccount?.ad_account_id],
    enabled: !!selectedAccount,
    queryFn: () => invoke("billing_status", { ad_account_id: selectedAccount!.ad_account_id }) as Promise<{ account: BillingAccount; recharge_url: string; fallback_url: string }>,
  });

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const rechargeMutation = useMutation({
    mutationFn: async () => {
      if (!billing) throw new Error("Billing not loaded yet");
      return billing.recharge_url;
    },
    onSuccess: (url) => {
      const popup = window.open(url, "meta-recharge", "width=600,height=700");
      if (!popup) {
        window.open(url, "_blank");
        return;
      }
      popupRef.current = popup;
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(() => {
        if (popup.closed) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
          refetchBilling();
        }
      }, 1000);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (view === "campaigns") {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setView("billing")} className="-ml-2"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Advertisements</Button>
        <MetaCampaignsPanel adAccountRowId={adAccountId} />
      </div>
    );
  }
  if (view === "ad-sets") {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setView("billing")} className="-ml-2"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Advertisements</Button>
        <MetaAdSetsPanel adAccountId={selectedAccount?.ad_account_id || ""} adAccountRowId={adAccountId} />
      </div>
    );
  }
  if (view === "ads") {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setView("billing")} className="-ml-2"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Advertisements</Button>
        <MetaAdsPanel adAccountRowId={adAccountId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Meta Advertisements</h2>
          <p className="text-xs text-muted-foreground">Manage your Meta advertising campaigns, ad sets, and individual ads all in one place.</p>
        </div>
        <Badge className="bg-primary/10 text-primary border-transparent">Connected</Badge>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-medium text-sm flex items-center gap-1.5"><CreditCard className="h-4 w-4" /> Ads account billing</p>
            <div className="flex items-center gap-2">
              {adAccounts.length > 1 && (
                <>
                  <Select value={adAccountId} onValueChange={setAdAccountId}>
                    <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {adAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={saveAdAccount} disabled={adAccountId === savedAdAccountId}>
                    <Save className="h-3.5 w-3.5 mr-1.5" /> Save
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => refetchBilling()} disabled={billingLoading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${billingLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button size="sm" onClick={() => rechargeMutation.mutate()} disabled={!billing}>
                <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Recharge Ads account
              </Button>
            </div>
          </div>

          {adAccounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No ad accounts synced — connect a Meta account in the Meta Connection tab.</p>
          ) : billingLoading ? (
            <p className="text-xs text-muted-foreground">Loading billing...</p>
          ) : billing ? (
            <>
              <div className="grid sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Payment Method</p>
                  <p className="font-medium">{billing.account.funding_source?.display_string || "No payment method"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Payment Setting</p>
                  <p className="font-medium">{billing.account.is_prepay_account ? "Prepaid (manual payments)" : "Automatic payments"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Account Status</p>
                  <Badge className="bg-primary/10 text-primary border-transparent">{billing.account.account_status_label}</Badge>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Spend</p>
                  <p>Spent: {billing.account.amount_spent}</p>
                  <p>Balance due: {billing.account.balance}</p>
                  <p>Spend cap: {billing.account.spend_cap || "None"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t">
                <span>{billing.account.name} · act_{selectedAccount?.ad_account_id}</span>
                <a href={billing.fallback_url} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-1 hover:underline">
                  Open in Ads Manager <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setView("campaigns")}>
          <CardContent className="p-4 space-y-2">
            <Rocket className="h-5 w-5 text-primary" />
            <p className="font-medium text-sm">Campaigns</p>
            <p className="text-xs text-muted-foreground">Create and manage advertising campaigns across Meta platforms.</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setView("ad-sets")}>
          <CardContent className="p-4 space-y-2">
            <Target className="h-5 w-5 text-primary" />
            <p className="font-medium text-sm">Ad Sets</p>
            <p className="text-xs text-muted-foreground">Organize campaigns into ad sets with specific targeting and budgets.</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setView("ads")}>
          <CardContent className="p-4 space-y-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <p className="font-medium text-sm">Ads</p>
            <p className="text-xs text-muted-foreground">Create individual ads, upload creative content, and manage performance.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
