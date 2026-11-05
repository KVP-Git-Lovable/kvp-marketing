import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Calendar, MessageSquare, Target, AlertTriangle, Package, Image, User, IndianRupee, Boxes } from "lucide-react";
import { format } from "date-fns";

interface CompetitionData {
  id: string;
  competitor_name: string;
  sku_name: string;
  selling_price: number | null;
  stock_quantity: number | null;
  unit: string | null;
  impact_level: string | null;
  insight: string | null;
  needs_attention: boolean | null;
  photo_urls: string[] | null;
  created_at: string;
  retailer_name: string;
  submitted_by: string;
  retailer_address?: string | null;
}

interface CompetitionDetailModalProps {
  open: boolean;
  onClose: () => void;
  data: CompetitionData | null;
}

export function CompetitionDetailModal({ open, onClose, data }: CompetitionDetailModalProps) {
  if (!open || !data) return null;
  const getImpactColor = (level: string | null) => {
    switch (level?.toLowerCase()) {
      case 'high': return 'bg-destructive/10 text-destructive';
      case 'medium': return 'bg-warning/10 text-warning';
      case 'low': return 'bg-green-500/10 text-green-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-500" />
              Competition Data Details
            </DialogTitle>
            {data.needs_attention && (
              <Badge className="bg-destructive/10 text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Needs Attention
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[65vh]">
          <div className="space-y-4 pr-2">
            {/* Header Section */}
            <div className="rounded-lg p-4 space-y-3 bg-orange-50 dark:bg-orange-950">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-semibold">{data.retailer_name || 'Unknown Retailer'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {data.created_at ? format(new Date(data.created_at), 'dd MMM yyyy, hh:mm a') : 'Unknown date'}
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {data.submitted_by}
                </div>
              </div>
            </div>

            {/* Competitor Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 dark:text-orange-400">
                <Target className="h-3 w-3" />
                Competitor Information
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Competitor</span>
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

            {/* SKU Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 dark:text-orange-400">
                <Package className="h-3 w-3" />
                Product Details
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">SKU Name</span>
                  <span className="font-medium">{data.sku_name || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Selling Price</span>
                  <span className="font-medium flex items-center gap-1">
                    <IndianRupee className="h-3 w-3" />
                    {typeof data.selling_price === 'number' ? data.selling_price.toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Stock Quantity</span>
                  <span className="font-medium flex items-center gap-1">
                    <Boxes className="h-3 w-3" />
                    {typeof data.stock_quantity === 'number' ? `${data.stock_quantity} ${data.unit || 'units'}` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Insight */}
            {data.insight && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 dark:text-orange-400">
                  <MessageSquare className="h-3 w-3" />
                  Market Insight
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap">{data.insight}</p>
                </div>
              </div>
            )}

            {/* Photos */}
            {data.photo_urls && data.photo_urls.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 dark:text-orange-400">
                  <Image className="h-3 w-3" />
                  Photos ({data.photo_urls.length})
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {data.photo_urls.map((url, index) => (
                    <a 
                      key={index} 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                    >
                      <img src={url} alt={`Competition photo ${index + 1}`} className="w-full h-24 object-cover" />
                    </a>
                  ))}
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
