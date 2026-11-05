import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Building2, Calendar, MessageSquare, Package, User, MapPin } from "lucide-react";
import { format } from "date-fns";

interface RetailerFeedbackData {
  id: string;
  retailer_name: string;
  submitted_by: string;
  feedback_type: string | null;
  rating: number | null;
  comments: string | null;
  created_at: string;
  feedback_date: string | null;
  product_packaging: number | null;
  product_sku_range: number | null;
  product_quality: number | null;
  product_placement: number | null;
  consumer_satisfaction: number | null;
  summary_notes: string | null;
  score: number | null;
  visit_id: string | null;
  retailer_address?: string | null;
}

interface RetailerFeedbackDetailModalProps {
  open: boolean;
  onClose: () => void;
  data: RetailerFeedbackData | null;
}

export function RetailerFeedbackDetailModal({ open, onClose, data }: RetailerFeedbackDetailModalProps) {
  if (!open || !data) return null;
  const renderStars = (rating: number | null) => {
    if (rating === null) return <span className="text-muted-foreground text-sm">Not rated</span>;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}
          />
        ))}
        <span className="ml-1 text-sm text-muted-foreground">({rating}/5)</span>
      </div>
    );
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 8) return "bg-green-500/10 text-green-600";
    if (score >= 5) return "bg-yellow-500/10 text-yellow-600";
    return "bg-red-500/10 text-red-600";
  };

  const getRatingLabel = (rating: number | null) => {
    if (rating === null) return '';
    if (rating >= 5) return 'Excellent';
    if (rating >= 4) return 'Good';
    if (rating >= 3) return 'Average';
    if (rating >= 2) return 'Below Average';
    return 'Poor';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              Retailer Feedback Details
            </DialogTitle>
            {data.score !== null && (
              <Badge className={`text-sm px-2 py-1 ${getScoreColor(data.score)}`}>
                Score: {data.score}/10
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[65vh]">
          <div className="space-y-4 pr-2">
            {/* Header Section */}
            <div className="rounded-lg p-4 space-y-3 bg-blue-50 dark:bg-blue-950">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-semibold">{data.retailer_name || 'Unknown Retailer'}</span>
              </div>
              {data.retailer_address && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {data.retailer_address}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {data.feedback_date 
                    ? format(new Date(data.feedback_date), 'dd MMM yyyy') 
                    : data.created_at 
                      ? format(new Date(data.created_at), 'dd MMM yyyy, hh:mm a')
                      : 'Unknown date'}
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {data.submitted_by}
                </div>
              </div>
            </div>

            {/* Feedback Type & Overall Rating */}
            {(data.feedback_type || data.rating) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                  <Star className="h-3 w-3" />
                  Overall Assessment
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  {data.feedback_type && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Feedback Type</span>
                      <Badge variant="outline" className="capitalize">
                        {data.feedback_type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  )}
                  {data.rating && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Overall Rating</span>
                      <div className="flex items-center gap-2">
                        {renderStars(data.rating)}
                        <Badge variant="secondary" className="ml-2">
                          {getRatingLabel(data.rating)}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Product Ratings */}
            {(data.product_packaging !== null || data.product_sku_range !== null || 
              data.product_quality !== null || data.product_placement !== null ||
              data.consumer_satisfaction !== null) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                  <Package className="h-3 w-3" />
                  Product Ratings
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                  {data.product_packaging !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Packaging</span>
                      {renderStars(data.product_packaging)}
                    </div>
                  )}
                  {data.product_sku_range !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">SKU Range</span>
                      {renderStars(data.product_sku_range)}
                    </div>
                  )}
                  {data.product_quality !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Quality</span>
                      {renderStars(data.product_quality)}
                    </div>
                  )}
                  {data.product_placement !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Placement</span>
                      {renderStars(data.product_placement)}
                    </div>
                  )}
                  {data.consumer_satisfaction !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Consumer Satisfaction</span>
                      {renderStars(data.consumer_satisfaction)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Comments */}
            {data.comments && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                  <MessageSquare className="h-3 w-3" />
                  Comments
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap">{data.comments}</p>
                </div>
              </div>
            )}

            {/* Summary Notes */}
            {data.summary_notes && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                  <MessageSquare className="h-3 w-3" />
                  Summary Notes
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap">{data.summary_notes}</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
