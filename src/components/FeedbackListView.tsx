import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, MessageSquare, Paintbrush, Users, Target, Calendar, Loader2, Eye, Star, X, WifiOff } from "lucide-react";
import { format } from "date-fns";
import { moveToRecycleBin } from "@/utils/recycleBinUtils";
import { offlineStorage, STORES } from "@/lib/offlineStorage";
import { withTimeout } from "@/utils/supabaseWithTimeout";
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

type FeedbackType = "retailer" | "branding" | "competition" | "joint-sales";

interface FeedbackListViewProps {
  isOpen: boolean;
  onClose: () => void;
  feedbackType: FeedbackType;
  retailerId: string;
  retailerName: string;
  visitId?: string | null;
  selectedDate?: string;
  onAddNew: () => void;
  onEdit?: (id: string, data: any) => void;
}

interface FeedbackItem {
  id: string;
  created_at: string;
  summary: string;
  details: Record<string, any>;
}

const feedbackConfig = {
  retailer: {
    title: "Retailer Feedback",
    icon: MessageSquare,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
  branding: {
    title: "Branding Requests",
    icon: Paintbrush,
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950",
  },
  competition: {
    title: "Competition Data",
    icon: Target,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950",
  },
  "joint-sales": {
    title: "Joint Sales Feedback",
    icon: Users,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950",
  },
};

export const FeedbackListView = ({
  isOpen,
  onClose,
  feedbackType,
  retailerId,
  retailerName,
  visitId,
  selectedDate,
  onAddNew,
  onEdit,
}: FeedbackListViewProps) => {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewItem, setViewItem] = useState<FeedbackItem | null>(null);
  const [isOfflineData, setIsOfflineData] = useState(false);

  const config = feedbackConfig[feedbackType];
  const Icon = config.icon;

  // Generate a cache key for this feedback query
  const getCacheKey = () => `feedback_${feedbackType}_${retailerId}_${selectedDate || 'today'}`;

  useEffect(() => {
    if (isOpen) {
      fetchFeedbackFast();
    }
  }, [isOpen, feedbackType, retailerId, selectedDate]);

  // CACHE-FIRST: Load from cache instantly, then try network with a hard 5s wait limit
  const fetchFeedbackFast = async () => {
    const cacheKey = getCacheKey();
    let hasShownCache = false;

    setLoading(true);

    // STEP 1: Try to load from cache IMMEDIATELY (no network dependency)
    try {
      await offlineStorage.init();
      const cached = await offlineStorage.getById<{ items: FeedbackItem[]; timestamp: number }>(STORES.VISITS, cacheKey);
      if (cached && Array.isArray(cached.items)) {
        setItems(cached.items);
        setLoading(false);

        if (cached.items.length > 0) {
          setIsOfflineData(true);
          hasShownCache = true;
          console.log(`[FeedbackListView] Loaded ${cached.items.length} items from cache instantly`);
        } else {
          setIsOfflineData(false);
        }
      }
    } catch (e) {
      console.log('[FeedbackListView] Cache read failed:', e);
    }

    // STEP 2: Try network but never wait more than 5 seconds
    try {
      const networkData = await withTimeout(fetchFeedbackFromNetwork(), { timeoutMs: 5000 });

      setItems(networkData);
      setIsOfflineData(false);
      setLoading(false);

      // Cache the data for offline use
      try {
        await offlineStorage.save(STORES.VISITS, {
          id: cacheKey,
          items: networkData,
          timestamp: Date.now(),
        });
      } catch (e) {
        console.log('[FeedbackListView] Cache save failed:', e);
      }
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg.includes('timeout')) {
        console.log('[FeedbackListView] Network request timed out (>5s), using cache');
      } else {
        console.error('[FeedbackListView] Network error:', error);
      }

      // Keep showing cached data if available, but never keep spinner stuck
      setLoading(false);
      if (!hasShownCache) {
        setIsOfflineData(false);
      }
    }
  };

  // Fetch from network
  const fetchFeedbackFromNetwork = async (): Promise<FeedbackItem[]> => {
    // Use getSession (local) instead of getUser (can hang on slow/offline)
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || localStorage.getItem('cached_user_id');
    if (!userId) return [];

    const targetDate = selectedDate || new Date().toISOString().split('T')[0];
    let data: FeedbackItem[] = [];

    switch (feedbackType) {
      case "retailer": {
        const { data: feedbackData, error } = await supabase
          .from('retailer_feedback')
          .select('*')
          .eq('retailer_id', retailerId)
          .eq('user_id', userId)
          .gte('created_at', targetDate + 'T00:00:00')
          .lte('created_at', targetDate + 'T23:59:59')
          .order('created_at', { ascending: false });

        if (!error && feedbackData) {
          data = feedbackData.map((item: any) => ({
            id: item.id,
            created_at: item.created_at,
            summary: `${item.feedback_type || 'Feedback'} - Rating: ${item.rating || item.score || 'N/A'}`,
            details: item,
          }));
        }
        break;
      }
      case "branding": {
        const { data: brandingData, error } = await supabase
          .from('branding_requests')
          .select('*')
          .eq('retailer_id', retailerId)
          .eq('user_id', userId)
          .gte('created_at', targetDate + 'T00:00:00')
          .lte('created_at', targetDate + 'T23:59:59')
          .order('created_at', { ascending: false });

        if (!error && brandingData) {
          data = brandingData.map((item: any) => ({
            id: item.id,
            created_at: item.created_at,
            summary: `${item.title || item.requested_assets || 'Request'} - ${item.status}`,
            details: item,
          }));
        }
        break;
      }
      case "competition": {
        const { data: compData, error } = await supabase
          .from('competition_data')
          .select('*, competition_master(competitor_name), competition_skus(sku_name)')
          .eq('retailer_id', retailerId)
          .eq('user_id', userId)
          .gte('created_at', targetDate + 'T00:00:00')
          .lte('created_at', targetDate + 'T23:59:59')
          .order('created_at', { ascending: false });

        if (!error && compData) {
          data = compData.map((item: any) => ({
            id: item.id,
            created_at: item.created_at,
            summary: `${item.competition_master?.competitor_name || 'Competitor'} - ${item.competition_skus?.sku_name || 'SKU'}`,
            details: item,
          }));
        }
        break;
      }
      case "joint-sales": {
        const { data: jointData, error } = await supabase
          .from('joint_sales_feedback')
          .select('*, profiles:manager_id(full_name)')
          .eq('retailer_id', retailerId)
          .eq('fse_user_id', userId)
          .eq('feedback_date', targetDate)
          .order('created_at', { ascending: false });

        if (!error && jointData) {
          data = jointData.map((item: any) => ({
            id: item.id,
            created_at: item.created_at || '',
            summary: `Joint visit with ${item.profiles?.full_name || 'Manager'}`,
            details: item,
          }));
        }
        break;
      }
    }

    return data;
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    setDeleting(true);
    try {
      const itemToDelete = items.find(item => item.id === deleteId);
      if (!itemToDelete) throw new Error("Item not found");

      const tableMap: Record<FeedbackType, string> = {
        "retailer": "retailer_feedback",
        "branding": "branding_requests",
        "competition": "competition_data",
        "joint-sales": "joint_sales_feedback",
      };

      const tableName = tableMap[feedbackType];
      const moduleName = config.title;

      // Move to recycle bin first
      const movedToRecycleBin = await moveToRecycleBin({
        tableName,
        recordId: deleteId,
        recordData: itemToDelete.details,
        moduleName,
        recordName: itemToDelete.summary,
      });

      if (!movedToRecycleBin) {
        throw new Error("Failed to move to recycle bin");
      }

      // Then delete from original table
      const { error } = await supabase.from(tableName as any).delete().eq('id', deleteId);
      if (error) throw error;

      toast({ title: "Deleted", description: "Moved to recycle bin. You can restore it if needed." });
      const updatedItems = items.filter(item => item.id !== deleteId);
      setItems(updatedItems);
      
      // Update cache after deletion
      try {
        const cacheKey = getCacheKey();
        await offlineStorage.save(STORES.VISITS, {
          id: cacheKey,
          items: updatedItems,
          timestamp: Date.now()
        });
      } catch (e) {
        console.log('[FeedbackListView] Cache update after delete failed:', e);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const renderDetails = (item: FeedbackItem) => {
    const details = item.details;
    
    switch (feedbackType) {
      case "retailer":
        return (
          <div className="space-y-1 text-xs text-muted-foreground">
            {details.product_feedback && <p><strong>Product:</strong> {details.product_feedback}</p>}
            {details.delivery_feedback && <p><strong>Delivery:</strong> {details.delivery_feedback}</p>}
            {details.service_feedback && <p><strong>Service:</strong> {details.service_feedback}</p>}
            {details.additional_notes && <p><strong>Notes:</strong> {details.additional_notes}</p>}
          </div>
        );
      case "branding":
        return (
          <div className="space-y-1 text-xs text-muted-foreground">
            {details.requested_assets && <p><strong>Assets:</strong> {details.requested_assets}</p>}
            {details.size && <p><strong>Size:</strong> {details.size}</p>}
            {details.description && <p><strong>Description:</strong> {details.description}</p>}
            <Badge variant="outline" className="mt-1">{details.status}</Badge>
          </div>
        );
      case "competition":
        return (
          <div className="space-y-1 text-xs text-muted-foreground">
            {details.selling_price && <p><strong>Price:</strong> ₹{details.selling_price}</p>}
            {details.stock_quantity && <p><strong>Stock:</strong> {details.stock_quantity}</p>}
            {details.insight && <p><strong>Insight:</strong> {details.insight}</p>}
            {details.impact_level && <Badge variant="outline" className="mt-1">{details.impact_level}</Badge>}
          </div>
        );
      case "joint-sales":
        return (
          <div className="space-y-1 text-xs text-muted-foreground">
            {details.joint_sales_impact && <p><strong>Impact:</strong> {details.joint_sales_impact}</p>}
            {details.order_increase_amount > 0 && <p><strong>Order Increase:</strong> ₹{details.order_increase_amount}</p>}
            {details.monthly_potential_6months > 0 && <p><strong>6-Month Potential:</strong> ₹{details.monthly_potential_6months}</p>}
            <div className="flex gap-1 flex-wrap mt-1">
              {details.product_packaging_feedback && (
                <Badge variant="outline" className="text-[10px]">
                  Packaging: {details.product_packaging_feedback}★
                </Badge>
              )}
              {details.service_feedback && (
                <Badge variant="outline" className="text-[10px]">
                  Service: {details.service_feedback}★
                </Badge>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderStars = (value: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={14}
          className={star <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}
        />
      ))}
    </div>
  );

  const renderFullDetails = (item: FeedbackItem) => {
    const details = item.details;
    
    switch (feedbackType) {
      case "retailer":
        return (
          <div className="space-y-4">
            {details.score && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Overall Score</span>
                <Badge className={`${details.score >= 7 ? 'bg-green-500' : details.score >= 5 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                  {details.score}/10
                </Badge>
              </div>
            )}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Star className="h-4 w-4" /> Performance Ratings
              </h4>
              <div className="grid gap-2 text-sm">
                {details.product_availability !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Product Availability</span>
                    {renderStars(details.product_availability)}
                  </div>
                )}
                {details.shelf_visibility !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Shelf Visibility</span>
                    {renderStars(details.shelf_visibility)}
                  </div>
                )}
                {details.retailer_engagement !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Retailer Engagement</span>
                    {renderStars(details.retailer_engagement)}
                  </div>
                )}
                {details.order_potential !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Order Potential</span>
                    {renderStars(details.order_potential)}
                  </div>
                )}
                {details.payment_behavior !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Payment Behavior</span>
                    {renderStars(details.payment_behavior)}
                  </div>
                )}
              </div>
            </div>
            {details.summary_notes && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Summary Notes</h4>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">{details.summary_notes}</p>
              </div>
            )}
          </div>
        );
      case "branding":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge variant="outline">{details.status}</Badge>
            </div>
            {details.title && (
              <div>
                <span className="text-sm font-medium">Title</span>
                <p className="text-sm text-muted-foreground mt-1">{details.title}</p>
              </div>
            )}
            {details.requested_assets && (
              <div>
                <span className="text-sm font-medium">Requested Assets</span>
                <p className="text-sm text-muted-foreground mt-1">{details.requested_assets}</p>
              </div>
            )}
            {details.size && (
              <div>
                <span className="text-sm font-medium">Size</span>
                <p className="text-sm text-muted-foreground mt-1">{details.size}</p>
              </div>
            )}
            {details.budget && (
              <div>
                <span className="text-sm font-medium">Budget</span>
                <p className="text-sm text-muted-foreground mt-1">₹{details.budget}</p>
              </div>
            )}
            {details.description && (
              <div>
                <span className="text-sm font-medium">Description</span>
                <p className="text-sm text-muted-foreground mt-1 bg-muted/50 p-3 rounded-lg">{details.description}</p>
              </div>
            )}
            {details.measurement_photo_urls?.length > 0 && (
              <div>
                <span className="text-sm font-medium">Photos</span>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {details.measurement_photo_urls.map((url: string, i: number) => (
                    <img key={i} src={url} alt={`Photo ${i+1}`} className="w-20 h-20 object-cover rounded-lg border" />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case "competition":
        return (
          <div className="space-y-4">
            {details.competition_master?.competitor_name && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Competitor</span>
                <span className="font-semibold">{details.competition_master.competitor_name}</span>
              </div>
            )}
            {details.competition_skus?.sku_name && (
              <div>
                <span className="text-sm font-medium">SKU</span>
                <p className="text-sm text-muted-foreground mt-1">{details.competition_skus.sku_name}</p>
              </div>
            )}
            {details.selling_price && (
              <div>
                <span className="text-sm font-medium">Selling Price</span>
                <p className="text-sm text-muted-foreground mt-1">₹{details.selling_price}</p>
              </div>
            )}
            {details.stock_quantity && (
              <div>
                <span className="text-sm font-medium">Stock Quantity</span>
                <p className="text-sm text-muted-foreground mt-1">{details.stock_quantity} {details.unit || 'units'}</p>
              </div>
            )}
            {details.impact_level && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Impact Level</span>
                <Badge variant="outline" className={
                  details.impact_level === 'high' ? 'border-red-500 text-red-500' :
                  details.impact_level === 'medium' ? 'border-yellow-500 text-yellow-500' :
                  'border-green-500 text-green-500'
                }>{details.impact_level}</Badge>
              </div>
            )}
            {details.insight && (
              <div>
                <span className="text-sm font-medium">Insight</span>
                <p className="text-sm text-muted-foreground mt-1 bg-muted/50 p-3 rounded-lg">{details.insight}</p>
              </div>
            )}
            {details.photo_urls?.length > 0 && (
              <div>
                <span className="text-sm font-medium">Photos</span>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {details.photo_urls.map((url: string, i: number) => (
                    <img key={i} src={url} alt={`Photo ${i+1}`} className="w-20 h-20 object-cover rounded-lg border" />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case "joint-sales":
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Star className="h-4 w-4" /> Performance Ratings
              </h4>
              <div className="grid gap-2 text-sm">
                {details.product_packaging_feedback && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Product Packaging</span>
                    {renderStars(parseInt(details.product_packaging_feedback) || 0)}
                  </div>
                )}
                {details.product_sku_range_feedback && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">SKU Range</span>
                    {renderStars(parseInt(details.product_sku_range_feedback) || 0)}
                  </div>
                )}
                {details.product_quality_feedback && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Product Quality</span>
                    {renderStars(parseInt(details.product_quality_feedback) || 0)}
                  </div>
                )}
                {details.service_feedback && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Service</span>
                    {renderStars(parseInt(details.service_feedback) || 0)}
                  </div>
                )}
                {details.consumer_feedback && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Consumer Satisfaction</span>
                    {renderStars(parseInt(details.consumer_feedback) || 0)}
                  </div>
                )}
              </div>
            </div>
            {(details.order_increase_amount > 0 || details.monthly_potential_6months > 0) && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Business Impact</h4>
                <div className="grid gap-2 text-sm">
                  {details.order_increase_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order Increase</span>
                      <span className="font-medium text-green-600">₹{details.order_increase_amount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {details.monthly_potential_6months > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">6-Month Monthly Potential</span>
                      <span className="font-medium text-blue-600">₹{details.monthly_potential_6months.toLocaleString('en-IN')}/mo</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {details.joint_sales_impact && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Summary Notes</h4>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">{details.joint_sales_impact}</p>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${config.color}`} />
              {config.title}
              {isOfflineData && (
                <Badge variant="outline" className="ml-2 text-xs font-normal">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Cached
                </Badge>
              )}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{retailerName}</p>
          </DialogHeader>

          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8">
                <Icon className={`h-12 w-12 mx-auto mb-3 ${config.color} opacity-50`} />
                <p className="text-muted-foreground text-sm">No {config.title.toLowerCase()} recorded for this visit</p>
                <Button onClick={onAddNew} className="mt-4" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add New
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-3">
                <div className="space-y-3">
                  {items.map((item) => (
                    <Card 
                      key={item.id} 
                      className={`${config.bgColor} border-0 cursor-pointer hover:opacity-90 transition-opacity`}
                      onClick={() => setViewItem(item)}
                    >
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.summary}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                              <Calendar className="h-3 w-3" />
                              {item.created_at ? format(new Date(item.created_at), 'dd MMM yyyy, h:mm a') : 'N/A'}
                            </p>
                            <p className="text-[10px] text-primary mt-1 flex items-center gap-1">
                              <Eye className="h-3 w-3" /> Tap to view details
                            </p>
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setViewItem(item)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {onEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onEdit(item.id, item.details)}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {items.length > 0 && (
            <div className="pt-3 border-t">
              <Button onClick={onAddNew} className="w-full" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add New {config.title.replace('s', '')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feedback?</AlertDialogTitle>
            <AlertDialogDescription>
              This feedback will be moved to recycle bin. You can restore it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Detail Modal */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${config.color}`} />
              {config.title} Details
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{retailerName}</p>
            {viewItem && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {viewItem.created_at ? format(new Date(viewItem.created_at), 'dd MMM yyyy, h:mm a') : 'N/A'}
              </p>
            )}
          </DialogHeader>

          {viewItem && (
            <div className="py-2">
              {renderFullDetails(viewItem)}
            </div>
          )}

          <div className="flex gap-2 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                if (viewItem) {
                  setDeleteId(viewItem.id);
                  setViewItem(null);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-1 text-destructive" />
              Delete
            </Button>
            {onEdit && viewItem && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  onEdit(viewItem.id, viewItem.details);
                  setViewItem(null);
                }}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            <Button
              size="sm"
              className="flex-1"
              onClick={() => setViewItem(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
