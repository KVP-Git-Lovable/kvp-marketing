import { useState } from "react";
import { Trash2, ArrowRightLeft, AlertTriangle, Store, Users, UserPlus, Calendar, Package, Unlink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AvailableBeat {
  id: string;
  name: string;
  retailer_count?: number;
}

interface AvailableUser {
  id: string;
  full_name: string;
}

interface BeatDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beatName: string | null;
  affectedRetailerCount: number;
  availableBeats: AvailableBeat[];
  availableUsers?: AvailableUser[];
  upcomingVisitsCount?: number;
  pendingOrdersCount?: number;
  onConfirm: (deleteOption: "delete" | "transfer" | "reassign" | "unassign", targetBeatId?: string, targetUserId?: string, createNewBeat?: boolean) => void;
  isLoading?: boolean;
}

export const BeatDeleteDialog = ({
  open,
  onOpenChange,
  beatName,
  affectedRetailerCount,
  availableBeats,
  availableUsers = [],
  upcomingVisitsCount = 0,
  pendingOrdersCount = 0,
  onConfirm,
  isLoading = false,
}: BeatDeleteDialogProps) => {
  const [deleteOption, setDeleteOption] = useState<"delete" | "transfer" | "reassign" | "unassign">("delete");
  const [targetBeatId, setTargetBeatId] = useState<string>("");
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [createNewBeat, setCreateNewBeat] = useState(false);

  const canConfirm =
    deleteOption === "delete" ||
    deleteOption === "unassign" ||
    (deleteOption === "transfer" && targetBeatId !== "") ||
    (deleteOption === "reassign" && targetUserId !== "");

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(
      deleteOption,
      deleteOption === "transfer" ? targetBeatId : undefined,
      deleteOption === "reassign" ? targetUserId : undefined,
      deleteOption === "reassign" ? createNewBeat : undefined
    );
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setDeleteOption("delete");
      setTargetBeatId("");
      setTargetUserId("");
      setCreateNewBeat(false);
    }
    onOpenChange(value);
  };

  const hasImpact = affectedRetailerCount > 0 || upcomingVisitsCount > 0 || pendingOrdersCount > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 size={18} />
            Delete Beat
          </DialogTitle>
          <DialogDescription>
            Delete "<span className="font-medium text-foreground">{beatName}</span>"?
          </DialogDescription>
        </DialogHeader>

        {/* Impact Summary */}
        {hasImpact && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Impact Summary</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <Users size={14} className="text-amber-600 dark:text-amber-400 mb-1" />
                <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{affectedRetailerCount}</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400">Retailers</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <Calendar size={14} className="text-blue-600 dark:text-blue-400 mb-1" />
                <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{upcomingVisitsCount}</span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400">Upcoming Visits</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                <Package size={14} className="text-purple-600 dark:text-purple-400 mb-1" />
                <span className="text-lg font-bold text-purple-700 dark:text-purple-300">{pendingOrdersCount}</span>
                <span className="text-[10px] text-purple-600 dark:text-purple-400">Pending Orders</span>
              </div>
            </div>
          </div>
        )}

        {affectedRetailerCount > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              What would you like to do with the retailers?
            </p>
            <RadioGroup
              value={deleteOption}
              onValueChange={(v) => {
                setDeleteOption(v as any);
                setTargetBeatId("");
                setTargetUserId("");
                setCreateNewBeat(false);
              }}
              className="space-y-2"
            >
              {/* Option 1: Delete all */}
              <label
                htmlFor="opt-delete"
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  deleteOption === "delete"
                    ? "border-destructive/50 bg-destructive/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="delete" id="opt-delete" className="mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Trash2 size={14} className="text-destructive" />
                    <span className="text-sm font-medium">Delete all retailers</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Move all {affectedRetailerCount} retailer{affectedRetailerCount !== 1 ? "s" : ""} to the recycle bin.
                  </p>
                </div>
              </label>

              {/* Option 2: Transfer to beat */}
              <label
                htmlFor="opt-transfer"
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  deleteOption === "transfer"
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="transfer" id="opt-transfer" className="mt-0.5" />
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft size={14} className="text-primary" />
                    <span className="text-sm font-medium">Transfer to another beat</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Move all retailers to a different beat before deletion.
                  </p>
                  {deleteOption === "transfer" && (
                    <Select value={targetBeatId} onValueChange={setTargetBeatId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select destination beat" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBeats.map((beat) => (
                          <SelectItem key={beat.id} value={beat.id}>
                            <div className="flex items-center gap-2">
                              <Store size={12} className="text-muted-foreground" />
                              <span>{beat.name}</span>
                              {beat.retailer_count !== undefined && (
                                <span className="text-xs text-muted-foreground">
                                  ({beat.retailer_count})
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                        {availableBeats.length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No other beats available
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </label>

              {/* Option 3: Reassign to user */}
              <label
                htmlFor="opt-reassign"
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  deleteOption === "reassign"
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="reassign" id="opt-reassign" className="mt-0.5" />
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <UserPlus size={14} className="text-primary" />
                    <span className="text-sm font-medium">Reassign to another user</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Transfer all retailers to a different sales user.
                  </p>
                  {deleteOption === "reassign" && (
                    <div className="space-y-2">
                      <Select value={targetUserId} onValueChange={setTargetUserId}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              <div className="flex items-center gap-2">
                                <Users size={12} className="text-muted-foreground" />
                                <span>{u.full_name}</span>
                              </div>
                            </SelectItem>
                          ))}
                          {availableUsers.length === 0 && (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              No users available
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="create-new-beat"
                          checked={createNewBeat}
                          onCheckedChange={(v) => setCreateNewBeat(v === true)}
                        />
                        <label htmlFor="create-new-beat" className="text-xs text-muted-foreground cursor-pointer">
                          Create a new beat for selected user
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {/* Option 4: Mark as unassigned */}
              <label
                htmlFor="opt-unassign"
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  deleteOption === "unassign"
                    ? "border-orange-500/50 bg-orange-500/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="unassign" id="opt-unassign" className="mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Unlink size={14} className="text-orange-500" />
                    <span className="text-sm font-medium">Mark as unassigned</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Remove beat assignment from all retailers. They'll appear in the unmapped pool.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No retailers are assigned to this beat. The beat will be moved to the recycle bin.
          </p>
        )}

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || !canConfirm}
            className="flex-1 sm:flex-none"
          >
            {isLoading ? "Deleting..." : "Confirm Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
