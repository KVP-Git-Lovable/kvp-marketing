import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Store, UserCheck, Users, ArrowRight } from "lucide-react";
import { supabase } from '@/integrations/supabase/db';
import { toast } from "sonner";

/**
 * Who serves this distributor.
 *
 * The tile could only say how many. The names come from distributor_salesmen:
 * our active users who own retailers linked to this distributor, plus anyone
 * explicitly assigned to it on the user form.
 */

interface Salesman {
  user_id: string;
  full_name: string;
  retailer_count: number;
  assigned: boolean;
}

interface Props {
  distributorId: string;
  distributorName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Picking a person closes this and opens their coverage in the Network tab. */
  onPick?: (rep: { id: string; name: string }) => void;
}

export function DistributorSalesmenDialog({
  distributorId, distributorName, open, onOpenChange, onPick,
}: Props) {
  const [rows, setRows] = useState<Salesman[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("distributor_salesmen", {
        p_distributor_id: distributorId,
      });
      if (cancelled) return;
      if (error) {
        toast.error("Could not load salesmen: " + error.message);
        setRows([]);
      } else {
        setRows((data as unknown as Salesman[]) ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, distributorId]);

  const totalRetailers = rows.reduce((n, r) => n + Number(r.retailer_count || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Salesmen serving {distributorName}
          </DialogTitle>
          <DialogDescription>
            Our people who own shops linked to this distributor, plus anyone assigned to it on
            their user record.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nobody yet. A person appears here once they own a shop linked to this distributor,
            or once you assign them to it when creating or editing the user.
          </p>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? "person" : "people"} ·{" "}
              {totalRetailers} retailer{totalRetailers === 1 ? "" : "s"} between them
            </div>
            <div className="divide-y max-h-80 overflow-y-auto -mx-2">
              {rows.map((r) => (
                <button
                  key={r.user_id}
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onPick?.({ id: r.user_id, name: r.full_name });
                  }}
                  className="w-full text-left flex items-center gap-3 px-2 py-2.5 rounded-md hover:bg-muted/60 transition-colors group"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-[11px] font-semibold">
                      {r.full_name?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.full_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Store className="h-3 w-3" />
                      {Number(r.retailer_count) === 0
                        ? "No shops here yet"
                        : `${r.retailer_count} shop${Number(r.retailer_count) === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  {r.assigned && (
                    <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                      <UserCheck className="h-3 w-3" /> Assigned
                    </Badge>
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    Coverage <ArrowRight className="h-3 w-3" />
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tap a name to see their territories, beats and shops. “Assigned” means this
              distributor was picked on their user record, which also limits what they see when
              adding a retailer; the others got here by owning shops.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
