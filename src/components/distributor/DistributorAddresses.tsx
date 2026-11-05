import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, Truck, MapPin, Phone, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The two addresses an order actually needs: where the invoice is raised to,
 * and where the lorry goes. Resolved by distributor_addresses so that this
 * screen, the invoice and the primary order cannot each invent a different
 * fallback order.
 */

interface Side {
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  is_fallback?: boolean;
  same_as_billing?: boolean;
}

interface Props {
  distributorId: string;
}

const lines = (s: Side) =>
  [s.address, [s.city, s.state, s.pincode].filter(Boolean).join(", ")]
    .filter((x) => x && String(x).trim().length > 0);

export function DistributorAddresses({ distributorId }: Props) {
  const [data, setData] = useState<{ billing: Side; delivery: Side } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: res } = await supabase.rpc("distributor_addresses", {
        p_distributor_id: distributorId,
      });
      if (cancelled) return;
      setData((res as any) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [distributorId]);

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-20 w-full" /></CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const billing = lines(data.billing);
  const delivery = lines(data.delivery);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Addresses</CardTitle>
        <CardDescription>
          Where the invoice is raised to, and where the goods go. Edit them on the distributor form.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-amber-50/50 border-amber-200/70 p-3 dark:bg-amber-950/20 dark:border-amber-900/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-7 w-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Receipt className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Billing address
            </span>
            {data.billing.is_fallback && (
              <Badge variant="outline" className="text-[10px] ml-auto">From general address</Badge>
            )}
          </div>
          {billing.length > 0 ? (
            <div className="text-sm leading-snug space-y-0.5">
              {billing.map((l, i) => <p key={i}>{l}</p>)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not set — invoices will have no address on them.</p>
          )}
          {data.billing.is_fallback && billing.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              No billing address of its own, so the general address is being used.
            </p>
          )}
        </div>

        <div className="rounded-lg border bg-sky-50/50 border-sky-200/70 p-3 dark:bg-sky-950/20 dark:border-sky-900/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-7 w-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
              <Truck className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Goods delivery address
            </span>
            {data.delivery.same_as_billing && (
              <Badge variant="outline" className="text-[10px] ml-auto">Same as billing</Badge>
            )}
          </div>
          {delivery.length > 0 ? (
            <div className="text-sm leading-snug space-y-0.5">
              {delivery.map((l, i) => <p key={i}>{l}</p>)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not set.</p>
          )}
          {(data.delivery.contact_person || data.delivery.contact_phone) && (
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              {data.delivery.contact_person && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />{data.delivery.contact_person}
                </span>
              )}
              {data.delivery.contact_phone && (
                <a href={`tel:${data.delivery.contact_phone}`} className="flex items-center gap-1 text-primary">
                  <Phone className="h-3 w-3" />{data.delivery.contact_phone}
                </a>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
