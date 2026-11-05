import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Building2, Users, Calendar, FileText, TrendingUp, Target, Palette, Gift, Package, MessageSquare, IndianRupee, Lightbulb } from "lucide-react";
import { format } from "date-fns";

interface JointSalesData {
  id: string;
  retailer_name: string;
  fse_name: string;
  manager_name: string;
  product_feedback_rating: number | null;
  branding_rating: number | null;
  competition_rating: number | null;
  schemes_rating: number | null;
  future_growth_rating: number | null;
  action_items: string | null;
  feedback_date: string;
  created_at: string | null;
  // Additional fields
  retailing_rating: number | null;
  pricing_feedback_rating: number | null;
  sampling_rating: number | null;
  distributor_feedback_rating: number | null;
  sales_trends_rating: number | null;
  branding_status: string | null;
  shelf_visibility: string | null;
  pricing_compliance: string | null;
  scheme_awareness: string | null;
  competition_presence: string | null;
  sampling_status: string | null;
  distributor_service: string | null;
  sales_trend: string | null;
  growth_potential: string | null;
  retailer_notes: string | null;
  conversation_highlights: string | null;
  additional_notes: string | null;
  retailing_feedback: string | null;
  placement_feedback: string | null;
  sales_increase_feedback: string | null;
  new_products_introduced: string | null;
  competition_knowledge: string | null;
  trends_feedback: string | null;
  product_quality_feedback: string | null;
  service_feedback: string | null;
  schemes_feedback: string | null;
  pricing_feedback: string | null;
  consumer_feedback: string | null;
  joint_sales_impact: string | null;
  order_increase_amount: number | null;
  product_packaging_feedback: string | null;
  product_sku_range_feedback: string | null;
  promotion_vs_competition: string | null;
  product_usp_feedback: string | null;
  willingness_to_grow_range: string | null;
  monthly_potential_6months: number | null;
}

interface JointSalesDetailModalProps {
  open: boolean;
  onClose: () => void;
  data: JointSalesData | null;
}

export function JointSalesDetailModal({ open, onClose, data }: JointSalesDetailModalProps) {
  if (!open || !data) return null;
  const renderStars = (rating: number | null) => {
    if (rating === null) return <span className="text-muted-foreground text-sm">N/A</span>;
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
      data.future_growth_rating,
      data.retailing_rating,
      data.pricing_feedback_rating,
      data.sampling_rating,
      data.distributor_feedback_rating,
      data.sales_trends_rating
    ].filter(r => r !== null);
    
    if (ratings.length === 0) return null;
    return (ratings.reduce((a, b) => (a ?? 0) + (b ?? 0), 0)! / ratings.length).toFixed(1);
  };

  const avgRating = getAverageRating();

  const renderTextSection = (label: string, value: string | null) => {
    if (!value) return null;
    return (
      <div>
        <span className="text-xs text-muted-foreground block mb-1">{label}</span>
        <p className="text-sm">{value}</p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              Joint Sales Feedback Details
            </DialogTitle>
            {avgRating && (
              <Badge className={`text-sm px-2 py-1 ${Number(avgRating) >= 4 ? 'bg-green-500/10 text-green-600' : Number(avgRating) >= 3 ? 'bg-yellow-500/10 text-yellow-600' : 'bg-red-500/10 text-red-600'}`}>
                Avg: {avgRating}/5
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[65vh]">
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

            {/* Main Ratings */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                <Star className="h-3 w-3" />
                Performance Ratings
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Product Feedback</span>
                  </div>
                  {renderStars(data.product_feedback_rating)}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Branding</span>
                  </div>
                  {renderStars(data.branding_rating)}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Competition</span>
                  </div>
                  {renderStars(data.competition_rating)}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Schemes</span>
                  </div>
                  {renderStars(data.schemes_rating)}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Future Growth</span>
                  </div>
                  {renderStars(data.future_growth_rating)}
                </div>
              </div>
            </div>

            {/* Additional Ratings */}
            {(data.retailing_rating || data.pricing_feedback_rating || data.sampling_rating || 
              data.distributor_feedback_rating || data.sales_trends_rating) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                  <Star className="h-3 w-3" />
                  Additional Ratings
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                  {data.retailing_rating !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Retailing</span>
                      {renderStars(data.retailing_rating)}
                    </div>
                  )}
                  {data.pricing_feedback_rating !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Pricing Feedback</span>
                      {renderStars(data.pricing_feedback_rating)}
                    </div>
                  )}
                  {data.sampling_rating !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Sampling</span>
                      {renderStars(data.sampling_rating)}
                    </div>
                  )}
                  {data.distributor_feedback_rating !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Distributor Feedback</span>
                      {renderStars(data.distributor_feedback_rating)}
                    </div>
                  )}
                  {data.sales_trends_rating !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Sales Trends</span>
                      {renderStars(data.sales_trends_rating)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Store Status Assessment */}
            {(data.branding_status || data.shelf_visibility || data.pricing_compliance || 
              data.scheme_awareness || data.competition_presence || data.growth_potential) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                  <Building2 className="h-3 w-3" />
                  Store Assessment
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  {data.branding_status && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Branding Status</span>
                      <Badge variant="outline">{data.branding_status}</Badge>
                    </div>
                  )}
                  {data.shelf_visibility && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Shelf Visibility</span>
                      <Badge variant="outline">{data.shelf_visibility}</Badge>
                    </div>
                  )}
                  {data.pricing_compliance && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pricing Compliance</span>
                      <Badge variant="outline">{data.pricing_compliance}</Badge>
                    </div>
                  )}
                  {data.scheme_awareness && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Scheme Awareness</span>
                      <Badge variant="outline">{data.scheme_awareness}</Badge>
                    </div>
                  )}
                  {data.competition_presence && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Competition Presence</span>
                      <Badge variant="outline">{data.competition_presence}</Badge>
                    </div>
                  )}
                  {data.growth_potential && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Growth Potential</span>
                      <Badge variant="outline">{data.growth_potential}</Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Business Impact */}
            {(data.order_increase_amount || data.monthly_potential_6months || data.joint_sales_impact) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                  <IndianRupee className="h-3 w-3" />
                  Business Impact
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  {typeof data.order_increase_amount === 'number' && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Order Increase</span>
                      <span className="font-medium flex items-center gap-1">
                        <IndianRupee className="h-3 w-3" />
                        {data.order_increase_amount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {typeof data.monthly_potential_6months === 'number' && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">6-Month Potential</span>
                      <span className="font-medium flex items-center gap-1">
                        <IndianRupee className="h-3 w-3" />
                        {data.monthly_potential_6months.toLocaleString()}/mo
                      </span>
                    </div>
                  )}
                  {data.joint_sales_impact && (
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Joint Sales Impact</span>
                      <p className="text-sm">{data.joint_sales_impact}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Detailed Feedback */}
            {(data.retailer_notes || data.conversation_highlights || data.action_items || 
              data.additional_notes || data.retailing_feedback || data.placement_feedback ||
              data.sales_increase_feedback || data.new_products_introduced || data.competition_knowledge ||
              data.trends_feedback || data.product_quality_feedback || data.service_feedback ||
              data.schemes_feedback || data.pricing_feedback || data.consumer_feedback ||
              data.product_packaging_feedback || data.product_sku_range_feedback || 
              data.promotion_vs_competition || data.product_usp_feedback || data.willingness_to_grow_range) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                  <MessageSquare className="h-3 w-3" />
                  Detailed Feedback & Notes
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                  {renderTextSection('Action Items', data.action_items)}
                  {renderTextSection('Retailer Notes', data.retailer_notes)}
                  {renderTextSection('Conversation Highlights', data.conversation_highlights)}
                  {renderTextSection('Additional Notes', data.additional_notes)}
                  {renderTextSection('Retailing Feedback', data.retailing_feedback)}
                  {renderTextSection('Placement Feedback', data.placement_feedback)}
                  {renderTextSection('Sales Increase Feedback', data.sales_increase_feedback)}
                  {renderTextSection('New Products Introduced', data.new_products_introduced)}
                  {renderTextSection('Competition Knowledge', data.competition_knowledge)}
                  {renderTextSection('Trends Feedback', data.trends_feedback)}
                  {renderTextSection('Product Quality Feedback', data.product_quality_feedback)}
                  {renderTextSection('Service Feedback', data.service_feedback)}
                  {renderTextSection('Schemes Feedback', data.schemes_feedback)}
                  {renderTextSection('Pricing Feedback', data.pricing_feedback)}
                  {renderTextSection('Consumer Feedback', data.consumer_feedback)}
                  {renderTextSection('Product Packaging Feedback', data.product_packaging_feedback)}
                  {renderTextSection('Product SKU Range Feedback', data.product_sku_range_feedback)}
                  {renderTextSection('Promotion vs Competition', data.promotion_vs_competition)}
                  {renderTextSection('Product USP Feedback', data.product_usp_feedback)}
                  {renderTextSection('Willingness to Grow Range', data.willingness_to_grow_range)}
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
