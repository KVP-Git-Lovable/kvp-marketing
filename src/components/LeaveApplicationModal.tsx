import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveLeavePolicy, validateLeaveRequestRPC } from '@/hooks/useGlobalLeavePolicy';

interface LeaveType {
  id: string;
  name: string;
  description?: string;
}

interface LeaveApplicationModalProps {
  trigger?: React.ReactNode;
  onApplicationSubmitted?: () => void;
  defaultLeaveTypeId?: string;
}

const LeaveApplicationModal: React.FC<LeaveApplicationModalProps> = ({ 
  trigger, 
  onApplicationSubmitted,
  defaultLeaveTypeId 
}) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  
  // Form state
  const [leaveTypeId, setLeaveTypeId] = useState(defaultLeaveTypeId || '');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState('');
  const [leaveDay, setLeaveDay] = useState<'full' | 'half'>('full');
  const [halfDayPeriod, setHalfDayPeriod] = useState<'first_half' | 'second_half'>('first_half');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Policy hook — now resolves via server-side RPC
  const { policy, constraints, isLoading: policyLoading } = useEffectiveLeavePolicy(leaveTypeId);

  // Force full day when half-day is disabled by policy
  useEffect(() => {
    if (constraints && !constraints.allow_half_day && leaveDay === 'half') {
      setLeaveDay('full');
    }
  }, [constraints, leaveDay]);

  // Update leaveTypeId when defaultLeaveTypeId changes
  useEffect(() => {
    if (defaultLeaveTypeId) {
      setLeaveTypeId(defaultLeaveTypeId);
    }
  }, [defaultLeaveTypeId]);

  useEffect(() => {
    if (isOpen) {
      fetchLeaveTypes();
      setValidationError(null);
    }
  }, [isOpen]);

  // Clear validation error when dates change
  useEffect(() => {
    setValidationError(null);
  }, [startDate, endDate, leaveTypeId]);

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setLeaveTypes(data || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
      toast.error('Failed to fetch leave types');
    }
  };

  const calculateLeaveDays = () => {
    if (startDate && endDate) {
      const timeDiff = endDate.getTime() - startDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      return leaveDay === 'half' ? daysDiff * 0.5 : daysDiff;
    }
    return 0;
  };

  // Date constraints driven by server-side RPC — no hardcoded logic
  const getStartDateDisabled = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!constraints) {
      // If constraints RPC hasn't loaded yet, allow all dates (don't block backdates)
      return false;
    }

    // Use server-calculated backdate limit
    const maxBackdate = new Date(constraints.max_backdate_date);
    maxBackdate.setHours(0, 0, 0, 0);
    if (date < maxBackdate) return true;

    // Use server-calculated notice period for future dates
    if (constraints.min_notice_period_days > 0 && date >= today) {
      const minNotice = new Date(constraints.min_notice_date);
      minNotice.setHours(0, 0, 0, 0);
      if (date > today && date < minNotice) return true;
    }

    return false;
  };

  const getEndDateDisabled = (date: Date): boolean => {
    const minDate = startDate || new Date();
    const compare = new Date(minDate);
    compare.setHours(0, 0, 0, 0);
    return date < compare;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !leaveTypeId || !startDate || !endDate || !reason.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (endDate < startDate) {
      toast.error('End date cannot be before start date');
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      // Server-side validation — all policy checks happen in DB
      const validation = await validateLeaveRequestRPC(
        user.id,
        leaveTypeId,
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd'),
        leaveDay === 'half'
      );

      if (!validation.is_valid) {
        setValidationError(validation.error_message || 'Validation failed');
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from('leave_applications')
        .insert({
          user_id: user.id,
          leave_type_id: leaveTypeId,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          reason: reason.trim(),
          status: 'pending',
          is_half_day: leaveDay === 'half',
          half_day_period: leaveDay === 'half' ? halfDayPeriod : null,
          days_requested: validation.days_requested ?? calculateLeaveDays(),
        });

      if (error) throw error;

      toast.success('Leave application submitted successfully');
      
      // Reset form
      setLeaveTypeId('');
      setStartDate(undefined);
      setEndDate(undefined);
      setReason('');
      setLeaveDay('full');
      setHalfDayPeriod('first_half');
      setValidationError(null);
      setIsOpen(false);
      
      onApplicationSubmitted?.();
    } catch (error) {
      console.error('Error submitting leave application:', error);
      toast.error('Failed to submit leave application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabledByPolicy = constraints ? !constraints.is_enabled : false;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Apply Leave
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
          <DialogDescription>
            Submit a new leave application for approval
          </DialogDescription>
        </DialogHeader>

        {isDisabledByPolicy && (
          <div className="bg-destructive/10 border border-destructive/30 p-3 rounded-md flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">
              Leave applications are currently disabled by your organization's policy.
            </p>
          </div>
        )}

        {validationError && (
          <div className="bg-destructive/10 border border-destructive/30 p-3 rounded-md flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{validationError}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="leaveType">Leave Type *</Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Only show half-day option when policy allows it */}
          {(!constraints || constraints.allow_half_day) && (
            <div className="space-y-2">
              <Label>Leave Duration *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="full"
                    checked={leaveDay === 'full'}
                    onChange={(e) => setLeaveDay(e.target.value as 'full' | 'half')}
                    className="w-4 h-4 text-primary"
                  />
                  <span>Full Day</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="half"
                    checked={leaveDay === 'half'}
                    onChange={(e) => setLeaveDay(e.target.value as 'full' | 'half')}
                    className="w-4 h-4 text-primary"
                  />
                  <span>Half Day</span>
                </label>
              </div>
            </div>
          )}

          {leaveDay === 'half' && (
            <div className="space-y-2">
              <Label>Half Day Period *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="first_half"
                    checked={halfDayPeriod === 'first_half'}
                    onChange={(e) => setHalfDayPeriod(e.target.value as 'first_half' | 'second_half')}
                    className="w-4 h-4 text-primary"
                  />
                  <span>First Half (Morning)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="second_half"
                    checked={halfDayPeriod === 'second_half'}
                    onChange={(e) => setHalfDayPeriod(e.target.value as 'first_half' | 'second_half')}
                    className="w-4 h-4 text-primary"
                  />
                  <span>Second Half (Afternoon)</span>
                </label>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    disabled={getStartDateDisabled}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={getEndDateDisabled}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {startDate && endDate && (
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Total Leave Days: <span className="font-semibold">{calculateLeaveDays()}</span>
                {constraints?.max_continuous_days && (
                  <span className="ml-2 text-muted-foreground">
                    (Max: {constraints.max_continuous_days})
                  </span>
                )}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              placeholder="Please provide a reason for your leave..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="min-h-[100px]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isDisabledByPolicy || policyLoading}>
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveApplicationModal;
