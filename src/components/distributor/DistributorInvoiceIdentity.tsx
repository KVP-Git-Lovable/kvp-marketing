import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Store, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Whose name goes on an invoice raised to this distributor's retailers.
 *
 * Every invoice path used to read the single `companies` row and never look at
 * the distributor at all, so a shop that bought from its distributor got a
 * bill in our name. A distributor now bills as itself by default; an OEM arm
 * -- which IS the company, trading under its own type -- can follow the admin
 * Company Profile instead, so a change there reaches its invoices with no
 * second edit.
 */

interface Identity {
  source: "company" | "distributor";
  name: string | null;
  address: string | null;
  gstin: string | null;
  state: string | null;
  bank_name: string | null;
  bank_account: string | null;
  ifsc: string | null;
  qr_upi: string | null;
}

interface Props {
  distributorId: string;
  /** Type code from distributor_types, e.g. 'OEM'. */
  typeCode?: string | null;
  onChanged?: () => void;
}

const Row = ({ label, value }: { label: string; value: string | null }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="text-sm truncate">{value || <span className="text-muted-foreground">—</span>}</dd>
  </div>
);

export function DistributorInvoiceIdentity({ distributorId, typeCode, onChanged }: Props) {
  const [source, setSource] = useState<"own" | "company">("own");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [sampleRetailer, setSampleRetailer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isOem = (typeCode || "").toUpperCase() === "OEM";

  const load = useCallback(async () => {
    const { data: dist } = await supabase
      .from("distributors")
      .select("invoice_identity_source")
      .eq("id", distributorId)
      .maybeSingle();
    setSource(((dist as any)?.invoice_identity_source as "own" | "company") ?? "own");

    // Resolve against a real retailer of theirs, so this shows what would
    // actually print rather than a theoretical merge.
    const { data: ret } = await supabase
      .from("retailers")
      .select("id, name")
      .eq("distributor_id", distributorId)
      .limit(1)
      .maybeSingle();

    if (ret?.id) {
      setSampleRetailer(ret.name ?? null);
      const { data: res } = await supabase.rpc("invoice_identity_for_retailer", {
        p_retailer_id: ret.id,
      });
      setIdentity((res as any) ?? null);
    } else {
      setSampleRetailer(null);
      setIdentity(null);
    }
    setLoading(false);
  }, [distributorId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (useCompany: boolean) => {
    setSaving(true);
    const next = useCompany ? "company" : "own";
    const { error } = await supabase
      .from("distributors")
      .update({ invoice_identity_source: next, updated_at: new Date().toISOString() })
      .eq("id", distributorId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(
      next === "company"
        ? "Invoices will follow the admin Company Profile"
        : "Invoices will use this distributor's own details",
    );
    await load();
    onChanged?.();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-56" /></CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Invoice identity</CardTitle>
        <CardDescription>
          Whose name, GST, bank and logo print on an invoice raised to this distributor's retailers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOem ? (
          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Follow the admin Company Profile</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This is an OEM type — the company trading under its own name. Leave this on and a change
                in the admin Company Profile reaches these invoices with no second edit. Turn it off to
                bill under this distributor's own details instead.
              </p>
            </div>
            <Switch
              checked={source === "company"}
              disabled={saving}
              onCheckedChange={toggle}
            />
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <Store className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              This distributor bills under its own name, GST and bank. Anything left blank on their
              profile falls back to the company's. Following the Company Profile is offered for OEM
              types only.
            </p>
          </div>
        )}

        {identity ? (
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {identity.source === "company"
                ? <Building2 className="h-4 w-4 text-violet-500" />
                : <Store className="h-4 w-4 text-emerald-500" />}
              <span className="text-sm font-medium">
                {identity.source === "company" ? "Billing as the company" : "Billing as this distributor"}
              </span>
              <Badge variant="outline" className="text-[10px]">{identity.name || "No name"}</Badge>
              {sampleRetailer && (
                <span className="text-[11px] text-muted-foreground ml-auto">
                  As it would print for {sampleRetailer}
                </span>
              )}
            </div>
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
              <Row label="GSTIN" value={identity.gstin} />
              <Row label="State" value={identity.state} />
              <Row label="Bank" value={identity.bank_name} />
              <Row label="Account" value={identity.bank_account} />
              <Row label="IFSC" value={identity.ifsc} />
              <Row label="UPI" value={identity.qr_upi} />
              <div className="col-span-2 min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Address</dt>
                <dd className="text-sm leading-snug">
                  {identity.address || <span className="text-muted-foreground">—</span>}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No retailers are linked to this distributor yet, so there is nothing to preview.
          </p>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-900 dark:text-amber-200">
            Set here and read by the database, but the invoice PDF generators still print the company
            row. They have not been switched over yet, so this choice does not reach a printed invoice.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
