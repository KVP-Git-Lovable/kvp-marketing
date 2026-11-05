import { useState } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Lock, MoreVertical, Power, PowerOff, Trash2 } from "lucide-react";
import { ProgramUsage, useDeleteProgram, useToggleProgram } from "./hooks";

/**
 * Activate / deactivate / delete for one reward program.
 *
 * Deleting is deliberately the weaker of the two destructive options: it is
 * offered ONLY for a program that has never awarded a point, because the
 * database refuses the rest outright (trigger
 * trg_gamification_games_block_delete_with_history). Deactivate is the answer
 * for everything else — the award engine matches only is_active games, so an
 * inactive program stops paying out while its ledger stays readable.
 *
 * `usage` undefined means the counts have not arrived (or the RPC failed), and
 * Delete stays locked: never hard-delete on the back of a check that did not run.
 */
export function ProgramActions({
  program,
  usage,
  align = "end",
  className = "",
  iconClassName = "",
  onDeleted,
}: {
  program: { id: string; name: string; is_active?: boolean | null };
  usage?: ProgramUsage;
  align?: "start" | "end";
  className?: string;
  iconClassName?: string;
  /** Called after a successful delete — the program detail page uses it to
   *  leave, since the record it is rendering no longer exists. */
  onDeleted?: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toggle = useToggleProgram();
  const remove = useDeleteProgram();

  const awarded = usage ? usage.points_rows : null;
  const redemptions = usage ? usage.redemptions : 0;
  const activities = usage ? usage.activities : 0;
  const hasHistory = awarded === null ? true : awarded > 0 || redemptions > 0;
  const busy = toggle.isPending || remove.isPending;

  // The card underneath is a big click target; none of this should navigate.
  const swallow = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <span onClick={swallow} onKeyDown={swallow} className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${program.name}`}
            disabled={busy}
            className={`w-[26px] h-[26px] rounded-[8px] inline-flex items-center justify-center transition-colors hover:bg-black/5 disabled:opacity-50 ${iconClassName}`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align={align} className="w-[230px]">
          <DropdownMenuItem
            onSelect={() => toggle.mutate({ id: program.id, is_active: !program.is_active })}
          >
            {program.is_active ? (
              <><PowerOff className="h-4 w-4 mr-2" /> Deactivate</>
            ) : (
              <><Power className="h-4 w-4 mr-2" /> Activate</>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {hasHistory ? (
            // Not a disabled menu item — a disabled row goes grey and says nothing
            // about why, and "why" is the whole point here.
            <div className="px-2 py-1.5 text-[11.5px] leading-snug text-muted-foreground flex gap-2">
              <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                {awarded === null
                  ? "Checking points history…"
                  : `Can't delete — ${awarded.toLocaleString()} point ${
                      awarded === 1 ? "award" : "awards"
                    }${redemptions ? ` and ${redemptions} redemptions` : ""} recorded. Deactivate instead.`}
              </span>
            </div>
          ) : (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete game
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{program.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This program has never awarded a point, so nothing is lost from the ledger.
              {activities > 0
                ? ` Its ${activities} ${activities === 1 ? "activity" : "activities"} will be removed with it.`
                : ""}{" "}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                remove.mutate(
                  { id: program.id, name: program.name },
                  { onSuccess: () => onDeleted?.() }
                )
              }
            >
              Delete game
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );
}
