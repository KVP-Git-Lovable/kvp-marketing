import { useEffect, useState } from "react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle, Archive } from "lucide-react";
import { fetchDeleteBlockers, type Blocker } from "@/utils/distributorDeleteBlockers";
import type { RetailerAction } from "@/utils/deleteDistributor";

/**
 * What archiving this distributor actually does, before it happens.
 *
 * Archive used to fire on the click. It is reversible, but it takes the
 * distributor out of the live list and out of every picker, and anything
 * still pointing at it stays pointing at it -- which is how one ended up
 * holding 224 retailers nobody could reach.
 *
 * So the dialog says what is attached, and offers to move the retailers
 * somewhere live first. Leaving them is allowed, but it has to be chosen.
 */

interface Props {
  target: { id: string; name: string } | null;
  /** Live distributors the retailers could move to. */
  candidates: { id: string; name: string }[];
  working: boolean;
  onCancel: () => void;
  onConfirm: (retailerAction: RetailerAction | "leave", reassignTo?: string) => void;
}

/** "10 retailers", "1 van" — the plain-English count for a blocking table. */
const LABELS: Record<string, [string, string]> = {
  retailers: ["retailer", "retailers"],
  distributors: ["distributor under it", "distributors under it"],
  beats: ["beat", "beats"],
  vans: ["van", "vans"],
  warehouses: ["warehouse", "warehouses"],
  primary_orders: ["primary order", "primary orders"],
  primary_invoices: ["primary invoice", "primary invoices"],
  delivery_challans: ["delivery challan", "delivery challans"],
  distributor_inventory: ["stock record", "stock records"],
  inventory_batches: ["batch", "batches"],
};

function phrase(b: Blocker): string {
  const l = LABELS[b.referencing_table];
  const n = Number(b.row_count);
  return l ? `${n} ${n === 1 ? l[0] : l[1]}` : `${n} × ${b.referencing_table.replace(/_/g, " ")}`;
}

export function ArchiveDistributorDialog({
  target, candidates, working, onCancel, onConfirm,
}: Props) {
  const [blockers, setBlockers] = useState<Blocker[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<RetailerAction | "leave">("leave");
  const [moveTo, setMoveTo] = useState("");
  const [acceptStranding, setAcceptStranding] = useState(false);

  useEffect(() => {
    if (!target) { setBlockers(null); setAction("leave"); setMoveTo(""); setAcceptStranding(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rows = await fetchDeleteBlockers(target.id).catch(() => [] as Blocker[]);
      if (!cancelled) { setBlockers(rows); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [target]);

  if (!target) return null;

  const retailers = blockers?.find((b) => b.referencing_table === "retailers");
  const retailerCount = Number(retailers?.row_count ?? 0);
  const others = candidates.filter((c) => c.id !== target.id);
  const carrying = (blockers ?? []).filter((b) => Number(b.row_count) > 0);

  // Leaving shops on an archived distributor is the choice that strands them,
  // so it is the one that has to be ticked.
  const needsAcceptance = retailerCount > 0 && action === "leave";
  const blocked =
    working || loading || (action === "reassign" && !moveTo) || (needsAcceptance && !acceptStranding);

  return (
    <AlertDialog open onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            Archive {target.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            It leaves the live list and every dropdown. Its records are kept and you can
            restore it at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {carrying.length > 0 && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  It is currently carrying
                </p>
                <p className="text-sm">{carrying.map(phrase).join(" · ")}</p>
              </div>
            )}

            {retailerCount > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
                <p className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    {retailerCount} {retailerCount === 1 ? "shop stays" : "shops stay"} pointed at it.
                    An archived distributor is not offered in the pickers, so they become hard to reach.
                  </span>
                </p>

                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio" className="accent-primary"
                      checked={action === "reassign"}
                      onChange={() => setAction("reassign")}
                    />
                    Move {retailerCount === 1 ? "it" : "them"} to another distributor first
                  </label>
                  {action === "reassign" && (
                    <Select value={moveTo} onValueChange={setMoveTo}>
                      <SelectTrigger className="h-8 text-xs ml-6 w-[calc(100%-1.5rem)]">
                        <SelectValue placeholder="Choose a distributor" />
                      </SelectTrigger>
                      <SelectContent>
                        {others.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio" className="accent-primary"
                      checked={action === "leave"}
                      onChange={() => setAction("leave")}
                    />
                    Leave {retailerCount === 1 ? "it" : "them"} where {retailerCount === 1 ? "it is" : "they are"}
                  </label>

                  {needsAcceptance && (
                    <label className="flex items-start gap-2 text-xs ml-6 text-amber-900 dark:text-amber-200">
                      <Checkbox
                        checked={acceptStranding}
                        onCheckedChange={(v) => setAcceptStranding(v === true)}
                        className="mt-0.5"
                      />
                      <span>
                        I understand {retailerCount} {retailerCount === 1 ? "shop" : "shops"} will stay
                        on an archived distributor.
                      </span>
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
          <Button
            disabled={blocked}
            onClick={() => onConfirm(action, action === "reassign" ? moveTo : undefined)}
          >
            {working ? "Archiving…" : "Archive"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
