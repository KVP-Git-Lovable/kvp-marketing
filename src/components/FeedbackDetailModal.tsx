import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Building2, Palette, Target, Calendar, MessageSquare, FileText, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface FeedbackDetailModalProps {
  open: boolean;
  onClose: () => void;
  type: 'retailer' | 'branding' | 'competition';
  data: any;
}

export function FeedbackDetailModal({ open, onClose, type, data }: FeedbackDetailModalProps) {
  if (!data) return null;

  const renderStars = (rating: number) => (
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

  const getImpactColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'high': return 'text-destructive bg-destructive/10';
      case 'medium': return 'text-warning bg-warning/10';
      case 'low': return 'text-success bg-success/10';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-success/10 text-success';
      case 'pending': return 'bg-warning/10 text-warning';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      case 'executed': return 'bg-primary/10 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRatingLabel = (rating: number) => {
    if (rating >= 5) return 'Excellent';
    if (rating >= 4) return 'Good';
    if (rating >= 3) return 'Average';
    if (rating >= 2) return 'Below Average';
    return 'Poor';
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'retailer': return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case 'branding': return <Palette className="h-5 w-5 text-purple-500" />;
      case 'competition': return <Target className="h-5 w-5 text-orange-500" />;
    }
  };

  const getTypeTitle = () => {
    switch (type) {
      case 'retailer': return 'Retailer Feedback';
      case 'branding': return 'Branding Request';
      case 'competition': return 'Competition Insight';
    }
  };

  const getHeaderBgClass = () => {
    switch (type) {
      case 'retailer': return 'bg-blue-50 dark:bg-blue-950';
      case 'branding': return 'bg-purple-50 dark:bg-purple-950';
      case 'competition': return 'bg-orange-50 dark:bg-orange-950';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {getTypeIcon()}
              {getTypeTitle()}
            </DialogTitle>
            {type === 'retailer' && data.rating && (
              <Badge className={`text-sm px-2 py-1 ${data.rating >= 4 ? 'bg-success/10 text-success' : data.rating >= 3 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                {data.rating}/5 • {getRatingLabel(data.rating)}
              </Badge>
            )}
            {type === 'branding' && data.status && (
              <Badge className={`text-sm px-2 py-1 capitalize ${getStatusColor(data.status)}`}>
                {data.status}
              </Badge>
            )}
            {type === 'competition' && data.impact_level && (
              <Badge className={`text-sm px-2 py-1 capitalize ${getImpactColor(data.impact_level)}`}>
                {data.impact_level} Impact
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="space-y-4 pr-2">
            {/* Retailer Name Header */}
            <div className={`rounded-lg p-4 space-y-2 ${getHeaderBgClass()}`}>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-semibold">{data.retailer_name || 'Unknown Retailer'}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {data.created_at ? format(new Date(data.created_at), 'dd MMM yyyy, hh:mm a') : 'Unknown date'}
                </div>
              </div>
            </div>

            {/* Retailer Feedback Details */}
            {type === 'retailer' && (
              <>
                {/* Rating Section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                    <Star className="h-3 w-3" />
                    Rating
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Overall Rating</span>
                      <div className="flex items-center gap-2">
                        {renderStars(data.rating || 0)}
                        <span className="text-sm font-medium">({data.rating || 0}/5)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Feedback Type */}
                {data.feedback_type && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                      <FileText className="h-3 w-3" />
                      Feedback Category
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <Badge variant="outline" className="capitalize">
                        {data.feedback_type?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Notes Section */}
                {data.summary_notes && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                      <MessageSquare className="h-3 w-3" />
                      Feedback Notes
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">{data.summary_notes}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Branding Request Details */}
            {type === 'branding' && (
              <>
                {/* Title Section */}
                {data.title && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-400">
                      <FileText className="h-3 w-3" />
                      Request Title
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="font-medium">{data.title}</p>
                    </div>
                  </div>
                )}

                {/* Status Section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-400">
                    <AlertTriangle className="h-3 w-3" />
                    Status
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Status</span>
                      <Badge className={`capitalize ${getStatusColor(data.status)}`}>
                        {data.status || 'pending'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Requested Assets Section */}
                {data.requested_assets && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-400">
                      <Palette className="h-3 w-3" />
                      Requested Assets
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">{data.requested_assets}</p>
                    </div>
                  </div>
                )}

                {/* Description Section */}
                {data.description && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-400">
                      <MessageSquare className="h-3 w-3" />
                      Description
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">{data.description}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Competition Insight Details */}
            {type === 'competition' && (
              <>
                {/* Competitor Section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 dark:text-orange-400">
                    <Target className="h-3 w-3" />
                    Competitor Information
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Competitor Name</span>
                      <span className="font-medium">{data.competitor_name || 'Unknown'}</span>
                    </div>
                    {data.impact_level && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Impact Level</span>
                        <Badge className={`capitalize ${getImpactColor(data.impact_level)}`}>
                          {data.impact_level}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Insight Section */}
                {data.insight && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 dark:text-orange-400">
                      <MessageSquare className="h-3 w-3" />
                      Competition Insight
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">{data.insight}</p>
                    </div>
                  </div>
                )}
              </>
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
