import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Plus, X, CheckCircle } from "lucide-react";
import type { CompetencyTemplate } from "@/hooks/useCompetencyScores";

interface CoachingNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  scorecardId?: string;
  templates?: CompetencyTemplate[];
  onSuccess?: () => void;
}

export function CoachingNotesDialog({
  open,
  onOpenChange,
  userId,
  userName,
  scorecardId,
  templates = [],
  onSuccess
}: CoachingNotesDialogProps) {
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [selectedCompetency, setSelectedCompetency] = useState<string>("");
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [newAction, setNewAction] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddAction = () => {
    if (newAction.trim()) {
      setActionItems([...actionItems, newAction.trim()]);
      setNewAction("");
    }
  };

  const handleRemoveAction = (index: number) => {
    setActionItems(actionItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!note.trim()) {
      toast.error("Please enter a coaching note");
      return;
    }

    if (!user?.id) {
      toast.error("You must be logged in");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('competency_coaching_notes').insert({
        user_id: userId,
        manager_id: user.id,
        note: note.trim(),
        competency_template_id: selectedCompetency || null,
        scorecard_id: scorecardId || null,
        action_items: actionItems.length > 0 ? actionItems : null,
      });

      if (error) throw error;

      toast.success("Coaching note added successfully");
      setNote("");
      setSelectedCompetency("");
      setActionItems([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error adding coaching note:", error);
      toast.error(error.message || "Failed to add coaching note");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Coaching Note for {userName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Competency Selection */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label>Related Competency (Optional)</Label>
              <Select value={selectedCompetency} onValueChange={setSelectedCompetency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a competency..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">General Feedback</SelectItem>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.competency_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Note Text */}
          <div className="space-y-2">
            <Label>Coaching Note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter your coaching feedback, observations, or recommendations..."
              rows={4}
            />
          </div>

          {/* Action Items */}
          <div className="space-y-2">
            <Label>Action Items (Optional)</Label>
            <div className="flex gap-2">
              <Input
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                placeholder="Add an action item..."
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAction())}
              />
              <Button type="button" size="icon" variant="outline" onClick={handleAddAction}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {actionItems.length > 0 && (
              <Card className="mt-2">
                <CardContent className="p-3 space-y-2">
                  {actionItems.map((action, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        <span>{action}</span>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleRemoveAction(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
