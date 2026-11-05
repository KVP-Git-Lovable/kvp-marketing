import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Clock, Users } from 'lucide-react';

interface LeaveApplication {
  id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  applied_date: string;
  approved_date?: string;
  rejection_reason?: string;
  days_requested?: number | null;
  is_half_day?: boolean | null;
  half_day_period?: string | null;
  leave_types?: {
    name: string;
  } | null;
}

interface ApprovalTracker {
  entity_id: string;
  current_level: number;
  total_levels: number;
  approver_name: string;
}

interface MyLeaveApplicationsProps {
  refreshTrigger?: number;
}

const MyLeaveApplications: React.FC<MyLeaveApplicationsProps> = ({ refreshTrigger }) => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [approvalTrackers, setApprovalTrackers] = useState<Map<string, ApprovalTracker>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMyApplications();
    }
  }, [user, refreshTrigger]);

  const fetchMyApplications = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const [leaveResult, approvalResult] = await Promise.all([
        supabase
          .from('leave_applications')
          .select(`
            *,
            leave_types!leave_applications_leave_type_id_fkey (
              name
            )
          `)
          .eq('user_id', user.id)
          .order('applied_date', { ascending: false }),
        // Fetch approval tracker for pending requests
        supabase
          .from('approval_requests')
          .select(`
            entity_id,
            current_level,
            total_levels,
            approval_steps!inner(
              approver_id,
              level,
              status
            )
          `)
          .eq('requester_id', user.id)
          .eq('status', 'pending')
          .eq('entity_type', 'leave'),
      ]);

      if (leaveResult.error) throw leaveResult.error;

      // Transform leave data
      const transformedData = (leaveResult.data || []).map(item => ({
        ...item,
        leave_types: Array.isArray(item.leave_types)
          ? (item.leave_types.length > 0 ? item.leave_types[0] : null)
          : (item.leave_types || null),
      }));
      setApplications(transformedData as LeaveApplication[]);

      // Build approval tracker map
      if (!approvalResult.error && approvalResult.data?.length) {
        const trackerMap = new Map<string, ApprovalTracker>();
        const pendingRequests = approvalResult.data as any[];

        // Collect all current approver IDs
        const approverIds: string[] = [];
        pendingRequests.forEach(ar => {
          const currentStep = (ar.approval_steps || []).find(
            (s: any) => s.level === ar.current_level && s.status === 'pending'
          );
          if (currentStep) approverIds.push(currentStep.approver_id);
        });

        // Fetch approver names
        let nameMap = new Map<string, string>();
        if (approverIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', [...new Set(approverIds)]);
          profiles?.forEach((p: any) => nameMap.set(p.id, p.full_name));
        }

        pendingRequests.forEach(ar => {
          const currentStep = (ar.approval_steps || []).find(
            (s: any) => s.level === ar.current_level && s.status === 'pending'
          );
          if (currentStep) {
            trackerMap.set(ar.entity_id, {
              entity_id: ar.entity_id,
              current_level: ar.current_level,
              total_levels: ar.total_levels,
              approver_name: nameMap.get(currentStep.approver_id) || 'Manager',
            });
          }
        });
        setApprovalTrackers(trackerMap);
      } else {
        setApprovalTrackers(new Map());
      }
    } catch (error) {
      console.error('Error fetching leave applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'secondary' | 'default' | 'destructive'; className: string; label: string }> = {
      pending: {
        variant: 'secondary',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
        label: 'Pending',
      },
      approved: {
        variant: 'default',
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
        label: 'Approved',
      },
      rejected: {
        variant: 'destructive',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
        label: 'Rejected',
      },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getDisplayDays = (application: LeaveApplication) => {
    if (application.days_requested != null) {
      return application.days_requested;
    }
    const start = new Date(application.start_date);
    const end = new Date(application.end_date);
    const timeDiff = end.getTime() - start.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
  };

  const formatDays = (days: number, isHalfDay?: boolean | null) => {
    if (isHalfDay || days === 0.5) return 'Half Day';
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          My Leave Applications
        </CardTitle>
      </CardHeader>
      <CardContent>
        {applications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium">No leave applications found</p>
            <p className="text-sm">Apply for leave to see your applications here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((application) => {
              const tracker = approvalTrackers.get(application.id);
              return (
                <div
                  key={application.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg">
                        {application.leave_types?.name || 'Unknown Leave Type'}
                      </h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Applied on {format(new Date(application.applied_date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(application.status)}
                      {/* Approval tracker — only shown for pending requests */}
                      {application.status === 'pending' && tracker && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Awaiting {tracker.approver_name} (L{tracker.current_level}/{tracker.total_levels})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-muted-foreground">Duration:</span>
                      <p className="mt-1">
                        {format(new Date(application.start_date), 'MMM dd')} -{' '}
                        {format(new Date(application.end_date), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDays(getDisplayDays(application), application.is_half_day)}
                      </p>
                    </div>

                    <div className="col-span-1 sm:col-span-2">
                      <span className="font-medium text-muted-foreground">Reason:</span>
                      <p className="mt-1 text-sm leading-relaxed">{application.reason}</p>
                    </div>
                  </div>

                  {application.status === 'approved' && application.approved_date && (
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded-md">
                      <p className="text-sm text-green-700 dark:text-green-300">
                        ✅ Approved on {format(new Date(application.approved_date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  )}

                  {application.status === 'rejected' && application.rejection_reason && (
                    <div className="bg-red-50 dark:bg-red-950 p-3 rounded-md">
                      <p className="text-sm text-red-700 dark:text-red-300">
                        ❌ Rejected: {application.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MyLeaveApplications;
