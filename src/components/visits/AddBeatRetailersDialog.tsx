import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, Store } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMissedDayRetailers, useNextFreeDay, type MissedDayRetailer } from "@/hooks/useMissedDays";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  fromDate: string;
  /** Target date the retailers will be added to. Null = next free day (resolved on save). */
  toDate: string | null;
  isSaving?: boolean;
  onConfirm: (visitIds: string[]) => void;
}

export function AddBeatRetailersDialog({
  open,
  onOpenChange,
  userId,
  fromDate,
  toDate,
  isSaving,
  onConfirm,
}: Props) {
  const { data: retailers = [], isLoading } = useMissedDayRetailers(userId, open ? fromDate : null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open, fromDate]);

  const beatLabel = useMemo(() => {
    const names = Array.from(
      new Set(retailers.map((r) => r.beat_name).filter(Boolean) as string[]),
    );
    if (names.length === 0) return null;
    if (names.length === 1) return names[0];
    return `${names.length} beats`;
  }, [retailers]);

  const allSelected = retailers.length > 0 && selected.size === retailers.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(retailers.map((r) => r.visit_id)));
  };

  const toggleOne = (r: MissedDayRetailer) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(r.visit_id) ? next.delete(r.visit_id) : next.add(r.visit_id);
      return next;
    });
  };

  // Resolve the implicit target so the rep is told which day this lands on
  // before confirming, rather than after.
  const { data: resolved, isLoading: resolving } = useNextFreeDay(userId, toDate ? null : fromDate);
  const landsOn = toDate ?? resolved ?? null;
  const targetLabel = landsOn
    ? `Moving to ${format(parseISO(landsOn), "EEE d MMM")}`
    : resolving
      ? "Finding the next free day…"
      : "No free day left this month — pick a date instead";
  const blocked = !landsOn && !resolving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-background">
        <DialogHeader>
          <DialogTitle>Add Retailers to Journey</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1">
              <div className={`text-sm font-medium ${blocked ? "text-destructive" : "text-foreground"}`}>
                {targetLabel}
                {beatLabel ? ` · Beat: ${beatLabel}` : ""}
              </div>
              <div>
                Left over from {format(parseISO(fromDate), "EEE d MMM")}. Tick the ones to carry forward.
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {isLoading ? "Loading…" : `${retailers.length} retailer${retailers.length === 1 ? "" : "s"} available`}
            </span>
            {retailers.length > 0 && (
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                Select All
              </label>
            )}
          </div>

          <ScrollArea className="max-h-64 rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : retailers.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No unvisited retailers on {format(parseISO(fromDate), "d MMM")}.
              </div>
            ) : (
              <div className="divide-y">
                {retailers.map((r) => (
                  <label
                    key={r.visit_id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selected.has(r.visit_id)}
                      onCheckedChange={() => toggleOne(r)}
                    />
                    <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{r.retailer_name || "Unnamed retailer"}</div>
                      {(r.city || r.beat_name) && (
                        <div className="text-xs text-muted-foreground truncate">
                          {[r.city, r.beat_name].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </ScrollArea>

          {selected.size > 0 && (
            <Badge variant="outline" className="text-[11px]">
              {selected.size} selected
            </Badge>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(Array.from(selected))}
            disabled={selected.size === 0 || !!isSaving || blocked}
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Add Selected Retailers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
