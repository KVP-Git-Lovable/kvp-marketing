import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, User, FileText, Table as TableIcon, Calculator,
  CreditCard, FileSignature, RotateCcw, Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Per-distributor overrides of the company-wide invoice display settings.
 *
 * invoice_display_settings holds one global row per setting key, so a
 * distributor who did not want (say) the QR code on their invoices could only
 * get it by turning it off for everybody. A row in
 * distributor_invoice_settings says "for this distributor, this one is
 * different"; no row means follow the company.
 */

interface Row {
  setting_key: string;
  setting_category: string;
  display_label: string;
  sort_order: number;
  company_enabled: boolean;
  enabled: boolean;
  overridden: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  header: "Header section",
  billto: "Bill to (retailer)",
  details: "Invoice details",
  table: "Items table columns",
  totals: "Totals section",
  payment: "Payment section",
  footer: "Footer section",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  header: <Building2 className="h-4 w-4" />,
  billto: <User className="h-4 w-4" />,
  details: <FileText className="h-4 w-4" />,
  table: <TableIcon className="h-4 w-4" />,
  totals: <Calculator className="h-4 w-4" />,
  payment: <CreditCard className="h-4 w-4" />,
  footer: <FileSignature className="h-4 w-4" />,
};

interface Props {
  distributorId: string;
}

export function DistributorInvoiceSettings({ distributorId }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("distributor_invoice_display_settings", {
      p_distributor_id: distributorId,
    });
    if (error) {
      toast.error("Could not load invoice settings: " + error.message);
      setRows([]);
    } else {
      setRows((data as unknown as Row[]) ?? []);
    }
    setLoading(false);
  }, [distributorId]);

  useEffect(() => { load(); }, [load]);

  /** Writing the value the company already has still records an override --
   *  that is deliberate, it means "this distributor is pinned here". */
  const setOverride = async (row: Row, enabled: boolean) => {
    setBusy(row.setting_key);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("distributor_invoice_settings")
      .upsert(
        {
          distributor_id: distributorId,
          setting_key: row.setting_key,
          enabled,
          updated_by: userData?.user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "distributor_id,setting_key" },
      );
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const clearOverride = async (row: Row) => {
    setBusy(row.setting_key);
    const { error } = await supabase
      .from("distributor_invoice_settings")
      .delete()
      .eq("distributor_id", distributorId)
      .eq("setting_key", row.setting_key);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const clearAll = async () => {
    const { error } = await supabase
      .from("distributor_invoice_settings")
      .delete()
      .eq("distributor_id", distributorId);
    if (error) { toast.error(error.message); return; }
    toast.success("Back to the company settings for every line");
    load();
  };

  const byCategory = useMemo(() => {
    const m = new Map<string, Row[]>();
    rows.forEach((r) => {
      const list = m.get(r.setting_category) ?? [];
      list.push(r);
      m.set(r.setting_category, list);
    });
    return m;
  }, [rows]);

  const overrideCount = rows.filter((r) => r.overridden).length;

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-56" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No invoice display settings are configured for the company yet.
          Set them up under Invoice Management first.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Invoice layout for this distributor
            </CardTitle>
            <CardDescription className="mt-1">
              Every line follows the company setting unless you change it here.
              {overrideCount > 0 && (
                <> <b>{overrideCount}</b> line{overrideCount === 1 ? " is" : "s are"} overridden.</>
              )}
            </CardDescription>
          </div>
          {overrideCount > 0 && (
            <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={clearAll}>
              <RotateCcw className="h-4 w-4" /> Follow company for all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {[...byCategory.entries()].map(([cat, list]) => {
            const catOverrides = list.filter((r) => r.overridden).length;
            return (
              <AccordionItem key={cat} value={cat}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2 flex-1 text-left">
                    {CATEGORY_ICONS[cat]}
                    <span className="text-sm font-medium">{CATEGORY_LABELS[cat] ?? cat}</span>
                    {catOverrides > 0 && (
                      <Badge variant="outline" className="text-[10px] ml-1">
                        {catOverrides} changed
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1">
                    {list.map((row) => (
                      <div
                        key={row.setting_key}
                        className="flex items-center justify-between gap-3 py-2 px-2 rounded-md hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm">{row.display_label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {row.overridden
                              ? `Company has this ${row.company_enabled ? "on" : "off"}`
                              : "Following the company setting"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {row.overridden && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => clearOverride(row)}
                              disabled={busy === row.setting_key}
                            >
                              Reset
                            </Button>
                          )}
                          <Switch
                            checked={row.enabled}
                            disabled={busy === row.setting_key}
                            onCheckedChange={(v) => setOverride(row, v)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
