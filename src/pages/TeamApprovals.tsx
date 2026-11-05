import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, CalendarDays, ClipboardCheck, Check, X } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTeamAttendance, PendingApproval } from '@/hooks/useTeamAttendance';
import { useSubordinates } from '@/hooks/useSubordinates';
import RejectionReasonDialog from '@/components/RejectionReasonDialog';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Layout } from '@/components/Layout';

type ApprovalTab = 'leave' | 'regularization';
const PAGE_SIZE = 10;

export const TeamApprovals = () => {
  const navigate = useNavigate();
  const { subordinateIds, directReportIds } = useSubordinates();
  const {
    pendingApprovals,
    handleLeaveAction,
    handleRegularizationAction,
  } = useTeamAttendance(subordinateIds, directReportIds);

  const [activeTab, setActiveTab] = useState<ApprovalTab>('leave');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processed'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionTarget, setRejectionTarget] = useState<{ id: string; type: ApprovalTab; approvalRequestId?: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const leaveApprovals = useMemo(() => pendingApprovals.filter(a => a.type === 'leave'), [pendingApprovals]);
  const regApprovals = useMemo(() => pendingApprovals.filter(a => a.type === 'regularization'), [pendingApprovals]);
  const pendingCount = useMemo(() => pendingApprovals.filter(a => a.approvalStatus === 'pending').length, [pendingApprovals]);
  const pendingLeaveCount = useMemo(() => leaveApprovals.filter(a => a.approvalStatus === 'pending').length, [leaveApprovals]);
  const pendingRegCount = useMemo(() => regApprovals.filter(a => a.approvalStatus === 'pending').length, [regApprovals]);

  const filteredByTab = activeTab === 'leave' ? leaveApprovals : regApprovals;
  const currentList = useMemo(() => {
    if (statusFilter === 'pending') return filteredByTab.filter(a => !a.approvalStatus || a.approvalStatus === 'pending');
    if (statusFilter === 'processed') return filteredByTab.filter(a => a.approvalStatus === 'approved' || a.approvalStatus === 'rejected');
    return filteredByTab;
  }, [filteredByTab, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(currentList.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedList = currentList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const startIndex = currentList.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(safePage * PAGE_SIZE, currentList.length);

  const handleApprove = async (approval: PendingApproval) => {
    setProcessingId(approval.id);
    try {
      if (approval.type === 'leave') {
        await handleLeaveAction(approval.id, 'approved', approval.approvalRequestId);
      } else {
        await handleRegularizationAction(approval.id, 'approved', undefined, approval.approvalRequestId);
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (approval: PendingApproval) => {
    if (approval.type === 'regularization') {
      setRejectionTarget({ id: approval.id, type: 'regularization', approvalRequestId: approval.approvalRequestId });
    } else {
      setProcessingId(approval.id);
      handleLeaveAction(approval.id, 'rejected', approval.approvalRequestId).finally(() => setProcessingId(null));
    }
  };

  const handleConfirmRejection = async (reason: string) => {
    if (!rejectionTarget) return;
    setProcessingId(rejectionTarget.id);
    try {
      await handleRegularizationAction(rejectionTarget.id, 'rejected', reason, rejectionTarget.approvalRequestId);
    } finally {
      setProcessingId(null);
      setRejectionTarget(null);
    }
  };

  const getInitials = (name: string) => name?.substring(0, 2).toUpperCase() || '??';

  const getDayCount = (approval: PendingApproval) => {
    if (approval.isHalfDay || approval.daysRequested === 0.5) {
      const period = approval.halfDayPeriod === 'first_half' ? '1st Half' : 
                     approval.halfDayPeriod === 'second_half' ? '2nd Half' : '';
      return `Half Day${period ? ` - ${period}` : ''}`;
    }
    const days = approval.daysRequested ?? (
      !approval.endDate || approval.endDate === approval.date 
        ? 1 
        : differenceInDays(new Date(approval.endDate), new Date(approval.date)) + 1
    );
    return `${days} days`;
  };

  const switchTab = (tab: ApprovalTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const switchStatusFilter = (filter: 'all' | 'pending' | 'processed') => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  const getApproveLabel = () => 'Approve';

  return (
    <Layout>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-semibold">Approvals</h1>
        </div>
        {/* Summary */}
        <p className="text-center text-sm font-medium text-muted-foreground">
          You have {pendingCount} pending request{pendingCount !== 1 ? 's' : ''}
          {pendingApprovals.length - pendingCount > 0 && ` and ${pendingApprovals.length - pendingCount} processed`}
        </p>

        {/* Tabs */}
        <div className="flex bg-muted rounded-lg p-1 gap-1">
          <button
            onClick={() => switchTab('leave')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all',
              activeTab === 'leave'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Leave Requests
            <Badge className="h-4 min-w-4 px-1 text-[10px] bg-green-600 text-white hover:bg-green-600">
              {pendingLeaveCount}
            </Badge>
          </button>
          <button
            onClick={() => switchTab('regularization')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all',
              activeTab === 'regularization'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Regularization
            <Badge className="h-4 min-w-4 px-1 text-[10px] bg-green-600 text-white hover:bg-green-600">
              {pendingRegCount}
            </Badge>
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex gap-1">
          {(['all', 'pending', 'processed'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => switchStatusFilter(filter)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-all border',
                statusFilter === filter
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
              )}
            >
              {filter === 'all' ? 'All' : filter === 'pending' ? 'Pending' : 'Processed'}
            </button>
          ))}
        </div>

        {/* List */}
        {currentList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No {statusFilter === 'pending' ? 'pending' : statusFilter === 'processed' ? 'processed' : ''} {activeTab === 'leave' ? 'leave requests' : 'regularizations'}{statusFilter === 'all' ? '' : ' found'}
          </p>
        ) : (
          <div className="space-y-3">
            {paginatedList.map((approval) => (
              <Card key={`${approval.type}-${approval.id}`} className="border shadow-sm rounded-xl overflow-hidden">
                <CardContent className="p-0">
                  {/* Top section with avatar and info */}
                  <div className="flex items-start gap-3 p-3 pb-2">
                    <Avatar className="h-10 w-10 mt-0.5 border-2 border-muted">
                      <AvatarImage src={approval.profilePictureUrl || undefined} />
                      <AvatarFallback className="text-xs font-medium">{getInitials(approval.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate">{approval.fullName}</span>
                        {approval.type === 'regularization' && (
                          <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 border-0 text-[10px] px-1.5 py-0">
                            Regularization
                          </Badge>
                        )}
                        
                      </div>
                      {approval.designation && (
                        <p className="text-xs text-muted-foreground">{approval.designation}</p>
                      )}
                    </div>
                  </div>

                  {/* Details section */}
                  <div className="px-3 pb-2 space-y-1">
                    <p className="text-xs font-medium">
                      <span className="text-green-700 dark:text-green-400">
                        {approval.type === 'leave' ? 'Leave' : 'Type'}:
                      </span>{' '}
                      <span className="font-semibold text-foreground">
                        {approval.type === 'leave' ? (approval.leaveTypeName || 'Leave') : 'Regularization'}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {approval.type === 'leave'
                        ? `Date${approval.endDate && approval.endDate !== approval.date ? 's' : ''}: ${format(new Date(approval.date), 'MMM dd')}${approval.endDate && approval.endDate !== approval.date ? ` - ${format(new Date(approval.endDate), 'MMM dd')}` : ''} (${getDayCount(approval)})`
                        : `Date: ${format(new Date(approval.date), 'MMM dd, yyyy')}`}
                    </p>
                    {approval.type === 'regularization' && (
                      <div className="mt-1.5 space-y-1 bg-muted/50 rounded-md p-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground w-16">Actual:</span>
                          <span className="font-medium text-foreground">
                            {approval.actualCheckIn ? format(new Date(approval.actualCheckIn), 'hh:mm a') : '--:--'}
                            {' — '}
                            {approval.actualCheckOut ? format(new Date(approval.actualCheckOut), 'hh:mm a') : '--:--'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground w-16">Requested:</span>
                          <span className="font-semibold text-green-700 dark:text-green-400">
                            {approval.requestedCheckIn ? format(new Date(approval.requestedCheckIn), 'hh:mm a') : '--:--'}
                            {' — '}
                            {approval.requestedCheckOut ? format(new Date(approval.requestedCheckOut), 'hh:mm a') : '--:--'}
                          </span>
                        </div>
                      </div>
                    )}
                    {approval.reason && (
                      <p className="text-xs text-muted-foreground">
                        {approval.type === 'leave' ? 'Reason' : 'Issue'}: {approval.reason}
                      </p>
                    )}
                  </div>

                  {/* Action buttons or status badge */}
                  {approval.approvalStatus && approval.approvalStatus !== 'pending' ? (
                    <div className="flex px-3 pb-3">
                      <Badge className={cn(
                        'text-xs px-3 py-1.5 w-full justify-center',
                        approval.approvalStatus === 'approved'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0 hover:bg-green-100'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-0 hover:bg-red-100'
                      )}>
                        {approval.approvalStatus === 'approved'
                          ? `Approved by ${approval.approvedByName || 'Manager'}`
                          : 'Rejected'}
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex gap-2 px-3 pb-3">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-white text-xs rounded-lg bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(approval)}
                        disabled={processingId === approval.id}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        {getApproveLabel()}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-8 text-xs rounded-lg"
                        onClick={() => handleReject(approval)}
                        disabled={processingId === approval.id}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <PaginationControls
              currentPage={safePage}
              totalPages={totalPages}
              startIndex={startIndex}
              endIndex={endIndex}
              totalItems={currentList.length}
              hasNextPage={safePage < totalPages}
              hasPrevPage={safePage > 1}
              onNextPage={() => setCurrentPage(p => p + 1)}
              onPrevPage={() => setCurrentPage(p => p - 1)}
              onGoToPage={setCurrentPage}
            />
        </div>
        )}

        <RejectionReasonDialog
          isOpen={!!rejectionTarget}
          onClose={() => setRejectionTarget(null)}
          onConfirm={handleConfirmRejection}
          title="Reject Request"
          description="Please provide a reason for rejecting this request."
        />
      </div>
    </Layout>
  );
};
