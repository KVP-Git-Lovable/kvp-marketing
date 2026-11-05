import { useState } from "react";
import { ArrowRightLeft, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AvailableUser {
  id: string;
  full_name: string;
}

interface BeatTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beatId: string;
  beatName: string;
  retailerCount: number;
  availableUsers: AvailableUser[];
  onTransferred: () => void;
}

export const BeatTransferDialog = ({
  open,
  onOpenChange,
  beatId,
  beatName,
  retailerCount,
  availableUsers,
  onTransferred,
}: BeatTransferDialogProps) => {
  const { user } = useAuth();
  const [targetUserId, setTargetUserId] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  const selectedUser = availableUsers.find((u) => u.id === targetUserId);

  const handleTransfer = async () => {
    if (!targetUserId || !user) return;

    setIsTransferring(true);
    try {
      // Update beat ownership
      const { error: beatError } = await supabase
        .from("beats")
        .update({ user_id: targetUserId, owner_id: targetUserId, owner_name: selectedUser?.full_name || null })
        .eq("beat_id", beatId);

      if (beatError) throw beatError;

      // Transfer all retailers
      const { error: retailerError } = await supabase
        .from("retailers")
        .update({ user_id: targetUserId })
        .eq("beat_id", beatId)
        .eq("user_id", user.id);

      if (retailerError) throw retailerError;

      // Insert audit log
      await supabase.from("beat_audit_log" as any).insert({
        beat_id: beatId,
        action: "transfer",
        old_user_id: user.id,
        new_user_id: targetUserId,
        metadata: { beat_name: beatName, retailer_count: retailerCount },
        performed_by: user.id,
      });

      toast.success(`Beat "${beatName}" transferred to ${selectedUser?.full_name}`);
      onTransferred();
      onOpenChange(false);
    } catch (error) {
      console.error("Error transferring beat:", error);
      toast.error("Failed to transfer beat");
    } finally {
      setIsTransferring(false);
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) setTargetUserId("");
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-primary" />
            Transfer Beat
          </DialogTitle>
          <DialogDescription>
            Transfer "<span className="font-medium text-foreground">{beatName}</span>" and all {retailerCount} retailer{retailerCount !== 1 ? "s" : ""} to another user.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select User</label>
            <Select value={targetUserId} onValueChange={setTargetUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a user" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers
                  .filter((u) => u.id !== user?.id)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex items-center gap-2">
                        <Users size={12} className="text-muted-foreground" />
                        <span>{u.full_name}</span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {targetUserId && selectedUser && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm">
                Transfer beat "<strong>{beatName}</strong>" and all <strong>{retailerCount}</strong> retailer{retailerCount !== 1 ? "s" : ""} to <strong>{selectedUser.full_name}</strong>?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Visit and order history will be preserved.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isTransferring} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={isTransferring || !targetUserId} className="flex-1 sm:flex-none">
            {isTransferring ? "Transferring..." : "Transfer Beat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
