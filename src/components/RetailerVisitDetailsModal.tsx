import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Clock, MapPin, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RetailerVisitDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retailerName: string;
  startTime: string;
  endTime: string | null;
  timeSpent: number;
  distance: number | null;
  locationStatus: 'at_store' | 'within_range' | 'not_at_store' | 'location_unavailable';
  actionType: string;
  isPhoneOrder: boolean;
  logId: string;
}

export const RetailerVisitDetailsModal = ({
  open,
  onOpenChange,
  retailerName,
  startTime,
  endTime,
  timeSpent,
  distance,
  locationStatus,
  actionType,
  isPhoneOrder,
  logId
}: RetailerVisitDetailsModalProps) => {
  const [feedbackReason, setFeedbackReason] = useState<string>('');
  const [feedbackNotes, setFeedbackNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTimeSpent = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getLocationIcon = () => {
    switch (locationStatus) {
      case 'at_store':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'within_range':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'not_at_store':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <MapPin className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getLocationColor = () => {
    switch (locationStatus) {
      case 'at_store':
        return 'bg-success text-success-foreground';
      case 'within_range':
        return 'bg-warning text-warning-foreground';
      case 'not_at_store':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getLocationText = () => {
    switch (locationStatus) {
      case 'at_store':
        return 'At Store';
      case 'within_range':
        return '<50m from Store';
      case 'not_at_store':
        return 'Not at Store';
      default:
        return 'Location Not Detected';
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackReason) {
      toast({
        title: "Feedback Required",
        description: "Please select a reason for your feedback.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      // Update the log with feedback
      const { error } = await supabase
        .from('retailer_visit_logs')
        .update({
          location_feedback_reason: feedbackReason,
          location_feedback_notes: feedbackNotes || null
        })
        .eq('id', logId);

      if (error) throw error;

      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback about the location tracking."
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Visit Details - {retailerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Time Information */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Start Time</span>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{formatTime(startTime)}</span>
              </div>
            </div>

            {endTime && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">End Time</span>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{formatTime(endTime)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Time Spent</span>
              <Badge variant="secondary" className="font-medium">
                {formatTimeSpent(timeSpent)}
              </Badge>
            </div>
          </div>

          {/* Location Information */}
          <div className="border-t pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Location Distance</span>
              <span className="text-sm font-medium">
                {distance !== null ? `${distance.toFixed(1)} m` : 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-2">
                {getLocationIcon()}
                <Badge className={getLocationColor()}>
                  {getLocationText()}
                </Badge>
              </div>
            </div>
          </div>

          {/* Action Type */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Action Type</span>
              <Badge variant="outline" className="capitalize">
                {isPhoneOrder ? 'Phone Order' : actionType}
              </Badge>
            </div>
          </div>

          {/* Feedback Section */}
          {locationStatus !== 'at_store' && (
            <div className="border-t pt-3 space-y-3">
              <p className="text-sm font-medium">Location Feedback</p>
              <p className="text-xs text-muted-foreground">
                Help us improve location tracking accuracy
              </p>
              
              <Select value={feedbackReason} onValueChange={setFeedbackReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gps_issue">GPS Issue / Weak Signal</SelectItem>
                  <SelectItem value="order_taken_remotely">Order Taken Remotely</SelectItem>
                  <SelectItem value="retailer_location_incorrect">Retailer Location Incorrect</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>

              <Textarea
                placeholder="Additional notes (optional)"
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                className="text-sm resize-none"
                rows={3}
              />

              <Button 
                onClick={handleSubmitFeedback}
                disabled={submitting}
                className="w-full"
                size="sm"
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
