import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddRecommendationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  currentUserId: string;
  onSuccess: () => void;
}

export const AddRecommendationModal = ({
  isOpen,
  onClose,
  targetUserId,
  currentUserId,
  onSuccess,
}: AddRecommendationModalProps) => {
  const [recommendation, setRecommendation] = useState("");
  const [relationship, setRelationship] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!recommendation.trim()) {
      toast.error("Please write a recommendation");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("employee_recommendations").insert({
        user_id: targetUserId,
        recommender_id: currentUserId,
        recommendation_text: recommendation,
        relationship: relationship || null,
      });

      if (error) throw error;

      toast.success("Recommendation added successfully!");
      setRecommendation("");
      setRelationship("");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error adding recommendation:", error);
      toast.error("Failed to add recommendation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Recommendation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="relationship">Relationship (Optional)</Label>
            <Input
              id="relationship"
              placeholder="e.g., Manager, Colleague, Client"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recommendation">Recommendation *</Label>
            <Textarea
              id="recommendation"
              placeholder="Write your recommendation here..."
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
