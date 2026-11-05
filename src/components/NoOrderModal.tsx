import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, UserX, DoorClosed, XCircle, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface NoOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReasonSelect: (reason: string) => void;
  currentReason?: string;
  isSubmitting?: boolean;
}

export const NoOrderModal = ({ isOpen, onClose, onReasonSelect, currentReason, isSubmitting = false }: NoOrderModalProps) => {
  const [selectedReason, setSelectedReason] = useState<string>(currentReason || "");
  const [otherReason, setOtherReason] = useState<string>("");

  const reasons = [
    {
      value: "over-stocked",
      label: "Over Stocked",
      description: "Retailer has sufficient inventory",
      icon: Package,
      color: "text-warning"
    },
    {
      value: "owner-not-available",
      label: "Owner Not Available",
      description: "Decision maker is not present",
      icon: UserX,
      color: "text-muted-foreground"
    },
    {
      value: "store-closed",
      label: "Store Closed",
      description: "Store is temporarily closed",
      icon: DoorClosed,
      color: "text-destructive"
    },
    {
      value: "permanently-closed",
      label: "Permanently Closed",
      description: "Store has shut down permanently",
      icon: XCircle,
      color: "text-destructive"
    },
    {
      value: "other",
      label: "Other",
      description: "Specify a custom reason",
      icon: MessageSquare,
      color: "text-primary"
    }
  ];

  const handleReasonClick = (reason: string) => {
    setSelectedReason(reason);
    if (reason === "over-stocked") {
      toast({
        title: "Information",
        description: "Update stock quantities in Order Entry page - this option will auto-select",
        duration: 4000
      });
    }
  };

  const handleSubmit = () => {
    if (!selectedReason) {
      toast({
        title: "Error",
        description: "Please select a reason",
        variant: "destructive"
      });
      return;
    }

    if (selectedReason === "other" && !otherReason.trim()) {
      toast({
        title: "Error",
        description: "Please enter the reason in the text field",
        variant: "destructive"
      });
      return;
    }

    const finalReason = selectedReason === "other" ? otherReason.trim() : selectedReason;
    
    // Close modal and reset state IMMEDIATELY (before any async)
    onClose();
    setSelectedReason("");
    setOtherReason("");
    
    // Fire reason select non-blocking (caller handles async)
    onReasonSelect(finalReason);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select No Order Reason</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {reasons.map((reason) => {
            const IconComponent = reason.icon;
            return (
                <Card 
                key={reason.value}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                  selectedReason === reason.value ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => handleReasonClick(reason.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <IconComponent className={`size-5 ${reason.color}`} />
                    <div className="flex-1">
                      <h4 className="font-medium text-card-foreground">{reason.label}</h4>
                      <p className="text-sm text-muted-foreground">{reason.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {selectedReason === "other" && (
            <div className="space-y-2 mt-2">
              <Label htmlFor="other-reason">Enter Reason</Label>
              <Input
                id="other-reason"
                placeholder="Type your reason here..."
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                className="w-full"
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Saving...
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};