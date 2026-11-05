import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Building2, Users, Calendar, FileText, TrendingUp, Target, Palette, Gift } from "lucide-react";
import { format } from "date-fns";

interface JointSalesDetailModalProps {
  open: boolean;
  onClose: () => void;
  data: any;
}

export function JointSalesDetailModal({ open, onClose, data }: JointSalesDetailModalProps) {
  if (!data) return null;

  const renderStars = (rating: number | null) => {
    if (rating === null) return <span className="text-muted-foreground">N/A</span>;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}
          />
        ))}
      </div>
    );
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 4) return "text-green-600";
    if (score >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  const getAverageRating = () => {
    const ratings = [
      data.product_feedback_rating,
      data.branding_rating,
      data.competition_rating,
      data.schemes_rating,
      data.future_growth_rating
    ].filter(r => r !== null);
    
    if (ratings.length === 0) return null;
    return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
  };

  const avgRating = getAverageRating();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              Joint Sales Feedback
            </DialogTitle>
            {avgRating && (
              <Badge className={`text-sm px-2 py-1 ${Number(avgRating) >= 4 ? 'bg-green-500/10 text-green-600' : Number(avgRating) >= 3 ? 'bg-yellow-500/10 text-yellow-600' : 'bg-red-500/10 text-red-600'}`}>
                Avg: {avgRating}/5
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="space-y-4 pr-2">
            {/* Header Section */}
            <div className="rounded-lg p-4 space-y-2 bg-indigo-50 dark:bg-indigo-950">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-semibold">{data.retailer_name || 'Unknown Retailer'}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {data.feedback_date ? format(new Date(data.feedback_date), 'dd MMM yyyy') : 'Unknown date'}
                </div>
              </div>
            </div>

            {/* Team Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                <Users className="h-3 w-3" />
                Team Information
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">FSE Name</span>
                  <Badge variant="outline">{data.fse_name || 'Unknown'}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Manager</span>
                  <Badge variant="secondary">{data.manager_name || 'Unknown'}</Badge>
                </div>
              </div>
            </div>

            {/* Ratings Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                <Star className="h-3 w-3" />
                Ratings
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                {/* Product Feedback */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Product Feedback</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStars(data.product_feedback_rating)}
                    <span className={`text-sm font-medium ${getScoreColor(data.product_feedback_rating)}`}>
                      ({data.product_feedback_rating ?? 'N/A'}/5)
                    </span>
                  </div>
                </div>

                {/* Branding */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Branding</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStars(data.branding_rating)}
                    <span className={`text-sm font-medium ${getScoreColor(data.branding_rating)}`}>
                      ({data.branding_rating ?? 'N/A'}/5)
                    </span>
                  </div>
                </div>

                {/* Competition */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Competition</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStars(data.competition_rating)}
                    <span className={`text-sm font-medium ${getScoreColor(data.competition_rating)}`}>
                      ({data.competition_rating ?? 'N/A'}/5)
                    </span>
                  </div>
                </div>

                {/* Schemes */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Schemes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStars(data.schemes_rating)}
                    <span className={`text-sm font-medium ${getScoreColor(data.schemes_rating)}`}>
                      ({data.schemes_rating ?? 'N/A'}/5)
                    </span>
                  </div>
                </div>

                {/* Future Growth */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Future Growth</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStars(data.future_growth_rating)}
                    <span className={`text-sm font-medium ${getScoreColor(data.future_growth_rating)}`}>
                      ({data.future_growth_rating ?? 'N/A'}/5)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Items */}
            {data.action_items && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                  <FileText className="h-3 w-3" />
                  Action Items
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap">{data.action_items}</p>
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
