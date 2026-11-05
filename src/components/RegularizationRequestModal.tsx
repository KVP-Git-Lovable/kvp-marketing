import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, AlertCircle, CheckCircle, XCircle, Loader2, ShieldAlert } from 'lucide-react';
import { format, differenceInDays, startOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useRegularizationPolicy } from '@/hooks/useRegularizationPolicy';

interface AttendanceRecord {
  id?: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status?: string;
  isAbsentPlaceholder?: boolean;
}

interface RegularizationRequest {
  id: string;
  status: string;
  requested_check_in_time: string | null;
  requested_check_out_time: string | null;
  reason: string;
  rejection_reason?: string | null;
  created_at: string;
}

interface RegularizationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceRecord: AttendanceRecord | null;
  existingRequest: RegularizationRequest | null;
  onSubmit: () => void;
  userId: string;
}

const RegularizationRequestModal: React.FC<RegularizationRequestModalProps> = ({
  isOpen,
  onClose,
  attendanceRecord,
  existingRequest,
  onSubmit,
  userId
}) => {
  const [requestedCheckIn, setRequestedCheckIn] = useState('');
  const [requestedCheckOut, setRequestedCheckOut] = useState('');
  const [requestedStatus, setRequestedStatus] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [policyBlock, setPolicyBlock] = useState<string | null>(null);
  const [isCheckingLimits, setIsCheckingLimits] = useState(false);

  const { data: policyResult, isLoading: policyLoading } = useRegularizationPolicy();
  const policy = policyResult?.data ?? null;

  // Reset form when opening
  useEffect(() => {
    if (isOpen && attendanceRecord) {
      setRequestedCheckIn('');
      setRequestedCheckOut('');
      setRequestedStatus('');
      setReason('');
      setPolicyBlock(null);
    }
  }, [isOpen, attendanceRecord]);

  // Check policy restrictions when modal opens
  useEffect(() => {
    if (!isOpen || !attendanceRecord || !policy || !userId) return;

    const checkPolicyRestrictions = async () => {
      setIsCheckingLimits(true);
      setPolicyBlock(null);

      try {
        // Check if regularization is enabled
        if (!policy.is_enabled) {
          setPolicyBlock('Regularization is not enabled for your organization.');
          return;
        }

        const attendanceDate = new Date(attendanceRecord.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check max backdate days
        const daysDiff = differenceInDays(today, attendanceDate);
        if (daysDiff > policy.max_backdate_days) {
          setPolicyBlock(`You can only regularize attendance within the last ${policy.max_backdate_days} days.`);
          return;
        }

        // Check previous month restriction
        if (!policy.allow_previous_month) {
          const currentMonthStart = startOfMonth(today);
          if (attendanceDate < currentMonthStart) {
            setPolicyBlock('Previous month regularization is not allowed.');
            return;
          }
        }

        // Check daily limit
        if (policy.daily_limit > 0) {
          const { count, error } = await supabase
            .from('regularization_requests')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('attendance_date', attendanceRecord.date)
            .in('status', ['pending', 'approved']);

          if (!error && count !== null && count >= policy.daily_limit) {
            setPolicyBlock(`Daily limit reached. You can only submit ${policy.daily_limit} request(s) per date.`);
            return;
          }
        }

        // Check monthly limit
        if (policy.monthly_limit !== null) {
          const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
          const { count, error } = await supabase
            .from('regularization_requests')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('attendance_date', monthStart)
            .in('status', ['pending', 'approved']);

          if (!error && count !== null && count >= policy.monthly_limit) {
            setPolicyBlock(`Monthly regularization limit reached (${policy.monthly_limit} requests/month).`);
            return;
          }
        }
      } catch (error) {
        console.error('Error checking policy restrictions:', error);
      } finally {
        setIsCheckingLimits(false);
      }
    };

    checkPolicyRestrictions();
  }, [isOpen, attendanceRecord, policy, userId]);

  const formatTime = (timeString: string | null): string => {
    if (!timeString) return '--';
    try {
      return format(new Date(timeString), 'HH:mm');
    } catch {
      return '--';
    }
  };

  const handleSubmit = async () => {
    if (!attendanceRecord || !userId || !policy) return;

    // Validation based on policy
    const hasCheckIn = policy.allow_checkin_edit && requestedCheckIn;
    const hasCheckOut = policy.allow_checkout_edit && requestedCheckOut;
    const hasStatusChange = policy.allow_status_edit && requestedStatus;

    if (!hasCheckIn && !hasCheckOut && !hasStatusChange) {
      toast.error('Please provide at least one correction');
      return;
    }

    if (policy.reason_mandatory && (!reason || reason.trim().length < 10)) {
      toast.error('Please provide a reason (minimum 10 characters)');
      return;
    }

    setIsSubmitting(true);
    try {
      const attendanceDate = attendanceRecord.date;
      const requestedCheckInTime = hasCheckIn
        ? new Date(`${attendanceDate}T${requestedCheckIn}:00`).toISOString()
        : null;
      const requestedCheckOutTime = hasCheckOut
        ? new Date(`${attendanceDate}T${requestedCheckOut}:00`).toISOString()
        : null;

      const { error } = await supabase
        .from('regularization_requests')
        .insert({
          user_id: userId,
          attendance_date: attendanceDate,
          current_check_in_time: attendanceRecord.check_in_time,
          current_check_out_time: attendanceRecord.check_out_time,
          requested_check_in_time: requestedCheckInTime,
          requested_check_out_time: requestedCheckOutTime,
          reason: reason.trim() || null,
          status: 'pending'
        });

      if (error) throw error;

      const approvalMsg = policy.approval_mode === 'auto'
        ? 'Regularization request auto-approved successfully'
        : 'Regularization request submitted successfully';
      toast.success(approvalMsg);
      onSubmit();
      onClose();
    } catch (error) {
      console.error('Error submitting regularization request:', error);
      toast.error('Failed to submit regularization request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!attendanceRecord) return null;

  const isAbsent = attendanceRecord.status === 'absent' || attendanceRecord.isAbsentPlaceholder;
  const isLoadingState = policyLoading || isCheckingLimits;
  const canSubmitNew = !existingRequest || existingRequest.status === 'rejected';
  const isBlocked = !!policyBlock;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Request Regularization
          </DialogTitle>
          <DialogDescription>
            Submit a request to correct your attendance for {format(new Date(attendanceRecord.date), 'MMMM dd, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Loading State */}
          {isLoadingState && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Checking policy...</span>
            </div>
          )}

          {/* Policy Block Message */}
          {!isLoadingState && isBlocked && (
            <div className="p-4 rounded-lg border bg-destructive/10 border-destructive/30">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                <span className="font-medium text-destructive">Request Blocked</span>
              </div>
              <p className="text-sm text-destructive/80">{policyBlock}</p>
            </div>
          )}

          {/* Existing Request Status */}
          {!isLoadingState && existingRequest && (
            <div className={`p-4 rounded-lg border ${
              existingRequest.status === 'pending' ? 'bg-yellow-50 border-yellow-200' :
              existingRequest.status === 'approved' ? 'bg-green-50 border-green-200' :
              'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {existingRequest.status === 'pending' && <Clock className="h-4 w-4 text-yellow-600" />}
                {existingRequest.status === 'approved' && <CheckCircle className="h-4 w-4 text-green-600" />}
                {existingRequest.status === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                <span className="font-medium capitalize">{existingRequest.status} Request</span>
              </div>
              {existingRequest.status === 'rejected' && existingRequest.rejection_reason && (
                <p className="text-sm text-red-700 mt-1">
                  Rejection Reason: {existingRequest.rejection_reason}
                </p>
              )}
              {existingRequest.status === 'pending' && (
                <p className="text-sm text-yellow-700">A request is already pending for this date.</p>
              )}
              {existingRequest.status === 'approved' && (
                <p className="text-sm text-green-700">Your request has been approved.</p>
              )}
            </div>
          )}

          {/* Current Attendance Info */}
          {!isLoadingState && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Current Attendance</Label>
              <div className="flex gap-4 p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Check-in</div>
                  <div className="font-medium">{formatTime(attendanceRecord.check_in_time)}</div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Check-out</div>
                  <div className="font-medium">{formatTime(attendanceRecord.check_out_time)}</div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <Badge variant={isAbsent ? 'destructive' : 'default'} className="mt-1">
                    {isAbsent ? 'Absent' : attendanceRecord.status || 'Present'}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Form - only show if not blocked and can submit */}
          {!isLoadingState && !isBlocked && canSubmitNew && policy && (
            <>
              {/* Requested Times */}
              <div className="grid grid-cols-2 gap-4">
                {policy.allow_checkin_edit && (
                  <div className="space-y-2">
                    <Label htmlFor="requestedCheckIn">Requested Check-in Time</Label>
                    <Input
                      id="requestedCheckIn"
                      type="time"
                      value={requestedCheckIn}
                      onChange={(e) => setRequestedCheckIn(e.target.value)}
                    />
                  </div>
                )}
                {policy.allow_checkout_edit && (
                  <div className="space-y-2">
                    <Label htmlFor="requestedCheckOut">Requested Check-out Time</Label>
                    <Input
                      id="requestedCheckOut"
                      type="time"
                      value={requestedCheckOut}
                      onChange={(e) => setRequestedCheckOut(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Status Edit */}
              {policy.allow_status_edit && (
                <div className="space-y-2">
                  <Label>Requested Status</Label>
                  <Select value={requestedStatus} onValueChange={setRequestedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select new status (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="half_day">Half Day</SelectItem>
                      <SelectItem value="leave">Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">
                  Reason {policy.reason_mandatory && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please explain why you need to regularize your attendance..."
                  rows={3}
                  className="resize-none"
                />
                {policy.reason_mandatory && (
                  <p className="text-xs text-muted-foreground">Minimum 10 characters required</p>
                )}
              </div>

              {/* Info */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {policy.approval_mode === 'auto'
                    ? 'This request will be auto-approved and your attendance will be updated immediately.'
                    : 'Your request will be sent to your manager for approval. Once approved, your attendance will be updated automatically.'}
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {!isLoadingState && !isBlocked && canSubmitNew && (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegularizationRequestModal;
