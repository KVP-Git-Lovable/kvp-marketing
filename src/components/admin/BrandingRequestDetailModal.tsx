import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Calendar, MessageSquare, Palette, FileText, Image, User, MapPin, IndianRupee, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type BrandingStatus = 'submitted' | 'pending' | 'approved' | 'rejected' | 'in_progress' | 'executed' | 'completed';

interface BrandingRequestData {
  id: string;
  title: string | null;
  description: string | null;
  status: BrandingStatus;
  requested_assets: string | null;
  created_at: string;
  retailer_name: string;
  retailer_id: string;
  submitted_by: string;
  pincode: string | null;
  size: string | null;
  budget: number | null;
  manager_comments: string | null;
  approved_at: string | null;
  due_date: string | null;
  executed_at: string | null;
  verification_photo_url: string | null;
  implementation_photo_urls: string[] | null;
  measurement_photo_urls: string[] | null;
  retailer_feedback_on_branding: string | null;
  order_impact_notes: string | null;
  vendor_due_date: string | null;
  vendor_budget: number | null;
  vendor_confirmation_status: string | null;
  vendor_rating: number | null;
  vendor_feedback: string | null;
  implementation_date: string | null;
  post_implementation_notes: string | null;
  retailer_address?: string | null;
}

interface BrandingRequestDetailModalProps {
  open: boolean;
  onClose: () => void;
  data: BrandingRequestData | null;
  onUpdate?: () => void;
}

const STATUS_OPTIONS: { value: BrandingStatus; label: string }[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'executed', label: 'Executed' },
  { value: 'completed', label: 'Completed' },
];

export function BrandingRequestDetailModal({ open, onClose, data, onUpdate }: BrandingRequestDetailModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState<BrandingStatus | ''>('');
  const [managerComments, setManagerComments] = useState('');

  useEffect(() => {
    if (!data) return;

    const status =
      typeof (data as any).status === "string" && (data as any).status
        ? ((data as any).status as BrandingStatus)
        : "submitted";

    setNewStatus(status);
    setManagerComments(data.manager_comments || "");
  }, [data]);

  if (!open || !data) return null;

  const currentStatus: BrandingStatus =
    typeof (data as any).status === "string" && (data as any).status
      ? ((data as any).status as BrandingStatus)
      : "submitted";

  const statusLabel = currentStatus.replace(/_/g, " ");

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-green-500/10 text-green-600';
      case 'pending': 
      case 'submitted': return 'bg-yellow-500/10 text-yellow-600';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      case 'in_progress': return 'bg-blue-500/10 text-blue-600';
      case 'executed':
      case 'completed': return 'bg-primary/10 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'completed':
      case 'executed':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const handleUpdateStatus = async () => {
    const commentsChanged = managerComments !== (data.manager_comments || "");
    const statusChanged = !!newStatus && newStatus !== currentStatus;

    if (!newStatus || (!statusChanged && !commentsChanged)) {
      toast({ title: "No changes", description: "Status or comments haven't changed" });
      return;
    }

    setIsUpdating(true);
    try {
      const updateData: Record<string, any> = {
        status: newStatus || currentStatus,
        manager_comments: managerComments ? managerComments : null,
        updated_at: new Date().toISOString(),
      };

      if (statusChanged && newStatus === 'approved' && !data.approved_at) {
        updateData.approved_at = new Date().toISOString();
      }
      if (statusChanged && newStatus === 'executed' && !data.executed_at) {
        updateData.executed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('branding_requests')
        .update(updateData)
        .eq('id', data.id);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `Branding request status changed to ${newStatus}`,
      });

      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Error updating branding request:', error);
      toast({
        title: "Error",
        description: "Failed to update branding request",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const renderPhotoSection = (title: string, urls: string[] | null) => {
    if (!urls || urls.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-400">
          <Image className="h-3 w-3" />
          {title} ({urls.length})
        </div>
        <div className="grid grid-cols-2 gap-2">
          {urls.map((url, index) => (
            <a 
              key={index} 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
            >
              <img src={url} alt={`${title} ${index + 1}`} className="w-full h-24 object-cover" />
            </a>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-purple-500" />
              Branding Request Details
            </DialogTitle>
            <Badge className={`flex items-center gap-1 capitalize ${getStatusColor(currentStatus)}`}>
              {getStatusIcon(currentStatus)}
              {statusLabel}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[55vh]">
          <div className="space-y-4 pr-2">
            {/* Header Section */}
            <div className="rounded-lg p-4 space-y-3 bg-purple-50 dark:bg-purple-950">
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
                  Created: {data.created_at ? format(new Date(data.created_at), 'dd MMM yyyy') : 'Unknown'}
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {data.submitted_by}
                </div>
                {data.pincode && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {data.pincode}
                  </div>
                )}
              </div>
            </div>

            {/* Request Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-400">
                <FileText className="h-3 w-3" />
                Request Details
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                {data.title && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-muted-foreground">Title</span>
                    <span className="font-medium text-right max-w-[60%]">{data.title}</span>
                  </div>
                )}
                {data.requested_assets && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-muted-foreground">Requested Assets</span>
                    <span className="font-medium text-right max-w-[60%]">{data.requested_assets}</span>
                  </div>
                )}
                {data.size && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Size</span>
                    <span className="font-medium">{data.size}</span>
                  </div>
                )}
                {typeof data.budget === 'number' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Budget</span>
                    <span className="font-medium flex items-center gap-1">
                      <IndianRupee className="h-3 w-3" />
                      {data.budget.toLocaleString()}
                    </span>
                  </div>
                )}
                {data.due_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Due Date</span>
                    <span className="font-medium">{format(new Date(data.due_date), 'dd MMM yyyy')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
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

            {/* Status Timeline */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-400">
                <Clock className="h-3 w-3" />
                Status Timeline
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                {data.approved_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Approved</span>
                    <span className="text-sm">{format(new Date(data.approved_at), 'dd MMM yyyy, hh:mm a')}</span>
                  </div>
                )}
                {data.implementation_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Implementation</span>
                    <span className="text-sm">{format(new Date(data.implementation_date), 'dd MMM yyyy')}</span>
                  </div>
                )}
                {data.executed_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Executed</span>
                    <span className="text-sm">{format(new Date(data.executed_at), 'dd MMM yyyy, hh:mm a')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Vendor Details */}
            {(data.vendor_budget || data.vendor_due_date || data.vendor_confirmation_status) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-400">
                  <Building2 className="h-3 w-3" />
                  Vendor Details
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  {typeof data.vendor_budget === 'number' && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Vendor Budget</span>
                      <span className="font-medium flex items-center gap-1">
                        <IndianRupee className="h-3 w-3" />
                        {data.vendor_budget.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {data.vendor_due_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Vendor Due Date</span>
                      <span className="text-sm">{format(new Date(data.vendor_due_date), 'dd MMM yyyy')}</span>
                    </div>
                  )}
                  {data.vendor_confirmation_status && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Vendor Status</span>
                      <Badge variant="outline">{data.vendor_confirmation_status}</Badge>
                    </div>
                  )}
                  {data.vendor_rating !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Vendor Rating</span>
                      <span className="font-medium">{data.vendor_rating}/5</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Feedback & Notes */}
            {(data.retailer_feedback_on_branding || data.order_impact_notes || data.post_implementation_notes || data.vendor_feedback) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-400">
                  <MessageSquare className="h-3 w-3" />
                  Feedback & Notes
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                  {data.retailer_feedback_on_branding && (
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Retailer Feedback</span>
                      <p className="text-sm">{data.retailer_feedback_on_branding}</p>
                    </div>
                  )}
                  {data.order_impact_notes && (
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Order Impact</span>
                      <p className="text-sm">{data.order_impact_notes}</p>
                    </div>
                  )}
                  {data.post_implementation_notes && (
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Post Implementation Notes</span>
                      <p className="text-sm">{data.post_implementation_notes}</p>
                    </div>
                  )}
                  {data.vendor_feedback && (
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Vendor Feedback</span>
                      <p className="text-sm">{data.vendor_feedback}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Photos */}
            {renderPhotoSection('Measurement Photos', data.measurement_photo_urls)}
            {renderPhotoSection('Implementation Photos', data.implementation_photo_urls)}
            {data.verification_photo_url && renderPhotoSection('Verification Photo', [data.verification_photo_url])}
          </div>
        </ScrollArea>

        {/* Status Update Section */}
        <div className="border-t pt-4 mt-2 space-y-3">
          <div className="text-sm font-medium">Update Status</div>
          <div className="flex gap-3">
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as BrandingStatus)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Add manager comments (optional)..."
            value={managerComments}
            onChange={(e) => setManagerComments(e.target.value)}
            className="min-h-[60px]"
          />
        </div>

        <DialogFooter className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            size="sm" 
            onClick={handleUpdateStatus}
            disabled={isUpdating || (!newStatus || (newStatus === currentStatus && managerComments === (data.manager_comments || '')))}
          >
            {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
