import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserCheck, Star, Edit, Trash2, Calendar, IndianRupee, TrendingUp, Store, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { moveToRecycleBin } from "@/utils/recycleBinUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { calculateJointVisitScore } from "./JointSalesFeedbackModal";

interface JointSalesFeedbackViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  retailerId: string;
  retailerName: string;
  feedbackDate: string;
  onEdit: () => void;
  onDeleted: () => void;
}

interface FeedbackData {
  id: string;
  manager_id: string;
  manager_name?: string;
  feedback_date: string;
  product_packaging_feedback: string;
  product_sku_range_feedback: string;
  placement_feedback: string;
  willingness_to_grow_range: string;
  product_quality_feedback: string;
  service_feedback: string;
  schemes_feedback: string;
  pricing_feedback: string;
  consumer_feedback: string;
  promotion_vs_competition: string;
  product_usp_feedback: string;
  joint_sales_impact: string;
  order_increase_amount: number;
  monthly_potential_6months: number;
  created_at: string;
}

export const JointSalesFeedbackViewModal = ({
  isOpen,
  onClose,
  retailerId,
  retailerName,
  feedbackDate,
  onEdit,
  onDeleted
}: JointSalesFeedbackViewModalProps) => {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const score = feedback ? calculateJointVisitScore(feedback) : 0;

  useEffect(() => {
    if (isOpen && retailerId && feedbackDate) {
      loadFeedback();
    }
  }, [isOpen, retailerId, feedbackDate]);

  const loadFeedback = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('joint_sales_feedback')
        .select('*')
        .eq('retailer_id', retailerId)
        .eq('feedback_date', feedbackDate)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const { data: managerProfile } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', data.manager_id)
          .single();

        setFeedback({
          ...data,
          manager_name: managerProfile?.full_name || managerProfile?.username || 'Unknown'
        });
      }
    } catch (error) {
      console.error('Error loading feedback:', error);
      toast({
        title: "Error",
        description: "Failed to load feedback data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!feedback) return;
    
    setIsDeleting(true);
    try {
      // Move to recycle bin first
      const movedToRecycleBin = await moveToRecycleBin({
        tableName: 'joint_sales_feedback',
        recordId: feedback.id,
        recordData: feedback,
        moduleName: 'Joint Sales Feedback',
        recordName: `Joint visit with ${feedback.manager_name} - ${retailerName}`,
      });

      if (!movedToRecycleBin) {
        throw new Error("Failed to move to recycle bin");
      }

      const { error } = await supabase
        .from('joint_sales_feedback')
        .delete()
        .eq('id', feedback.id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Moved to recycle bin. You can restore it if needed."
      });
      
      onDeleted();
      onClose();
    } catch (error) {
      console.error('Error deleting feedback:', error);
      toast({
        title: "Error",
        description: "Failed to delete feedback",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const renderStars = (value: string) => {
    const rating = parseInt(value) || 0;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
          />
        ))}
      </div>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600 bg-green-100";
    if (score >= 6) return "text-yellow-600 bg-yellow-100";
    if (score >= 4) return "text-orange-600 bg-orange-100";
    return "text-red-600 bg-red-100";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return "Excellent";
    if (score >= 6) return "Good";
    if (score >= 4) return "Average";
    return "Needs Improvement";
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-purple-600" />
                Joint Sales Feedback
              </DialogTitle>
              {score > 0 && (
                <Badge className={`text-sm px-2 py-1 ${getScoreColor(score)}`}>
                  {score}/10 • {getScoreLabel(score)}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{retailerName}</p>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !feedback ? (
            <div className="text-center py-8 text-muted-foreground">
              No feedback found
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">{feedback.manager_name}</span>
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                    Joint Visit Partner
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(feedback.feedback_date), 'dd MMM yyyy')}
                  </div>
                  {feedback.order_increase_amount > 0 && (
                    <div className="flex items-center gap-1 text-green-600">
                      <IndianRupee className="h-3 w-3" />
                      +{feedback.order_increase_amount.toLocaleString('en-IN')}
                    </div>
                  )}
                  {feedback.monthly_potential_6months > 0 && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <TrendingUp className="h-3 w-3" />
                      6M: ₹{feedback.monthly_potential_6months.toLocaleString('en-IN')}/mo
                    </div>
                  )}
                </div>
              </div>

              {/* Performance Ratings */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-700">
                  <Star className="h-3 w-3" />
                  Performance Ratings
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  {feedback.product_packaging_feedback && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Product Packaging</span>
                      {renderStars(feedback.product_packaging_feedback)}
                    </div>
                  )}
                  {feedback.product_sku_range_feedback && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">SKU Range</span>
                      {renderStars(feedback.product_sku_range_feedback)}
                    </div>
                  )}
                  {feedback.product_quality_feedback && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Product Quality</span>
                      {renderStars(feedback.product_quality_feedback)}
                    </div>
                  )}
                  {feedback.service_feedback && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Service</span>
                      {renderStars(feedback.service_feedback)}
                    </div>
                  )}
                  {feedback.consumer_feedback && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Consumer Satisfaction</span>
                      {renderStars(feedback.consumer_feedback)}
                    </div>
                  )}
                </div>
              </div>

              {/* Store Assessment */}
              {(feedback.placement_feedback || feedback.schemes_feedback || feedback.pricing_feedback || feedback.willingness_to_grow_range || feedback.promotion_vs_competition || feedback.product_usp_feedback) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                    <Store className="h-3 w-3" />
                    Store Assessment
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
                    {feedback.placement_feedback && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Placement</span>
                        <span className="font-medium">{feedback.placement_feedback.split(' - ')[0]}</span>
                      </div>
                    )}
                    {feedback.promotion_vs_competition && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Promotion vs Competition</span>
                        <span className="font-medium">{feedback.promotion_vs_competition.split(' - ')[0]}</span>
                      </div>
                    )}
                    {feedback.product_usp_feedback && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">USP Awareness</span>
                        <span className="font-medium">{feedback.product_usp_feedback.split(' - ')[0]}</span>
                      </div>
                    )}
                    {feedback.schemes_feedback && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Schemes</span>
                        <span className="font-medium">{feedback.schemes_feedback.split(' - ')[0]}</span>
                      </div>
                    )}
                    {feedback.pricing_feedback && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pricing</span>
                        <span className="font-medium">{feedback.pricing_feedback}</span>
                      </div>
                    )}
                    {feedback.willingness_to_grow_range && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Willingness to Grow</span>
                        <span className="font-medium">{feedback.willingness_to_grow_range.split(' - ')[0]}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Impact Notes */}
              {feedback.joint_sales_impact && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-orange-700">
                    <MessageSquare className="h-3 w-3" />
                    Summary Notes
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-sm">{feedback.joint_sales_impact}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-destructive hover:text-destructive"
              disabled={loading || !feedback}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onEdit();
              }}
              disabled={loading || !feedback}
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button size="sm" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feedback?</AlertDialogTitle>
            <AlertDialogDescription>
              This feedback will be moved to recycle bin. You can restore it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
