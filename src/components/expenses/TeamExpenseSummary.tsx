import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, CheckCircle, XCircle, Eye, CalendarRange, CalendarDays, Users, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSubordinates } from '@/hooks/useSubordinates';
import { useMonthlyExpenseSummary } from '@/hooks/useMonthlyExpenseSummary';
import { useAuth } from '@/hooks/useAuth';
import { useMyPendingSteps, useProcessApprovalStep } from '@/hooks/useApprovalEngine';
import WeeklyBreakdown from './WeeklyBreakdown';
import DailyBreakdown from './DailyBreakdown';
import MonthNavigator from './MonthNavigator';
import ExpenseSummaryCards from './ExpenseSummaryCards';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import RejectionReasonDialog from '@/components/RejectionReasonDialog';
import { SignedImage } from '@/components/ui/signed-image';
import { useSignedUrl } from '@/hooks/useSignedUrl';

interface TeamExpenseSummaryProps {
  yearMonth: string;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// ─── Approvals Tab ───────────────────────────────────────────────────────────

interface ExpenseRecord {
  id: string;
  user_id: string;
  category: string;
  custom_category: string | null;
  amount: number;
  description: string | null;
  bill_url: string | null;
  expense_date: string;
  status: string;
  employee_name?: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  approver_name?: string;
}

const STATUS_BADGE_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  submitted: { label: 'Pending', variant: 'outline' },
  manager_approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

// ─── Expense Detail Dialog ───────────────────────────────────────────────────

const BillPreview: React.FC<{ billUrl: string }> = ({ billUrl }) => {
  const signedUrl = useSignedUrl(billUrl, 'expense-bills');
  if (!signedUrl) return <p className="text-xs text-muted-foreground">Loading bill...</p>;
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(billUrl);
  return isImage ? (
    <a href={signedUrl} target="_blank" rel="noopener noreferrer">
      <img src={signedUrl} alt="Bill" className="rounded-lg border max-h-48 w-full object-contain bg-muted" />
    </a>
  ) : (
    <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary underline">
      <FileText className="h-3.5 w-3.5" /> View Bill Attachment
    </a>
  );
};

const ExpenseDetailDialog: React.FC<{
  expense: ExpenseRecord | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  actionLoading: string | null;
}> = ({ expense, open, onOpenChange, onApprove, onReject, actionLoading }) => {
  if (!expense) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Expense Details</DialogTitle>
          <DialogDescription className="text-xs">
            {expense.employee_name} · {new Date(expense.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{expense.category === 'Other' ? expense.custom_category : expense.category}</span>
            <span className="text-lg font-bold text-primary">₹{expense.amount.toLocaleString()}</span>
          </div>
          <Badge variant={STATUS_BADGE_MAP[expense.status]?.variant || 'secondary'} className="text-xs">
            {STATUS_BADGE_MAP[expense.status]?.label || expense.status}
          </Badge>
          {expense.description && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Description</p>
              <p className="text-sm">{expense.description}</p>
            </div>
          )}
          {expense.bill_url && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Bill Attachment</p>
              <BillPreview billUrl={expense.bill_url} />
            </div>
          )}
          {expense.approver_name && expense.approved_at && (
            <div className="rounded-md bg-muted/50 p-2 text-xs space-y-0.5">
              <p>
                <span className="font-medium">{expense.status === 'rejected' ? 'Rejected' : 'Approved'} by:</span>{' '}
                {expense.approver_name}
              </p>
              <p className="text-muted-foreground">
                {new Date(expense.approved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              {expense.status === 'rejected' && expense.rejection_reason && (
                <p className="text-destructive">Reason: {expense.rejection_reason}</p>
              )}
            </div>
          )}
          {expense.status === 'submitted' && (
            <div className="flex items-center gap-2 pt-2">
              <Button className="flex-1 h-9 text-xs gap-1.5" variant="default"
                onClick={() => onApprove(expense.id)} disabled={actionLoading === expense.id}>
                <CheckCircle className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button className="flex-1 h-9 text-xs gap-1.5" variant="destructive"
                onClick={() => onReject(expense.id)} disabled={actionLoading === expense.id}>
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TeamApprovalsList: React.FC<{ yearMonth: string }> = ({ yearMonth }) => {
  const { user } = useAuth();
  const { subordinates } = useSubordinates();
  const { data: pendingSteps, isLoading: stepsLoading } = useMyPendingSteps();
  const { processStep } = useProcessApprovalStep();
  const [pendingExpenses, setPendingExpenses] = useState<ExpenseRecord[]>([]);
  const [completedExpenses, setCompletedExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [selectedApprovalRequestId, setSelectedApprovalRequestId] = useState<string | null>(null);
  const [detailExpense, setDetailExpense] = useState<ExpenseRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [year, month] = yearMonth.split('-').map(Number);
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');

  // Filter expense pending steps
  const expensePendingSteps = useMemo(
    () => (pendingSteps || []).filter(s => s.entityType === 'expense'),
    [pendingSteps]
  );

  const fetchExpenses = async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      // Fetch pending expenses from approval engine
      let pendingData: any[] = [];
      if (expensePendingSteps.length > 0) {
        const entityIds = expensePendingSteps.map(s => s.entityId);
        const { data } = await (supabase as any)
          .from('additional_expenses')
          .select('*')
          .in('id', entityIds)
          .gte('expense_date', startStr)
          .lte('expense_date', endStr)
          .order('expense_date', { ascending: false });
        pendingData = data || [];
      }

      // Fetch completed expenses (where I was approver, from audit log)
      const { data: auditData } = await supabase
        .from('approval_audit_log')
        .select('entity_id')
        .eq('entity_type', 'expense')
        .eq('performed_by', user.id)
        .in('action', ['approved', 'rejected']);

      const completedEntityIds = [...new Set((auditData || []).map((a: any) => a.entity_id))];
      let completedData: any[] = [];
      if (completedEntityIds.length > 0) {
        const { data } = await (supabase as any)
          .from('additional_expenses')
          .select('*')
          .in('id', completedEntityIds)
          .gte('expense_date', startStr)
          .lte('expense_date', endStr)
          .in('status', ['manager_approved', 'rejected'])
          .order('expense_date', { ascending: false });
        completedData = data || [];
      }

      // Fetch approver names for completed
      const approverIds = [...new Set(completedData.filter((e: any) => e.approved_by).map((e: any) => e.approved_by))];
      let approverMap = new Map<string, string>();
      if (approverIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', approverIds);
        profiles?.forEach((p: any) => approverMap.set(p.id, p.full_name));
      }

      // Fetch employee names
      const allUserIds = [...new Set([...pendingData, ...completedData].map((e: any) => e.user_id))];
      let nameMap = new Map<string, string>();
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', allUserIds);
        profiles?.forEach((p: any) => nameMap.set(p.id, p.full_name));
      }

      setPendingExpenses(pendingData.map((exp: any) => ({
        ...exp,
        employee_name: nameMap.get(exp.user_id) || 'Unknown',
      })));

      setCompletedExpenses(completedData.map((exp: any) => ({
        ...exp,
        employee_name: nameMap.get(exp.user_id) || 'Unknown',
        approver_name: exp.approved_by ? approverMap.get(exp.approved_by) || 'Unknown' : null,
      })));
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!stepsLoading) fetchExpenses();
  }, [stepsLoading, expensePendingSteps.length, yearMonth]);

  const handleApprove = async (expenseId: string) => {
    const step = expensePendingSteps.find(s => s.entityId === expenseId);
    if (!step) { toast.error('No approval step found'); return; }
    setActionLoading(expenseId);
    try {
      await processStep(step.approvalRequestId, 'approved');
      setDetailOpen(false);
      fetchExpenses();
    } catch (err: any) { toast.error(err.message || 'Failed to approve'); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (reason: string) => {
    if (!selectedExpenseId) return;
    const step = expensePendingSteps.find(s => s.entityId === selectedExpenseId);
    if (!step) { toast.error('No approval step found'); return; }
    try {
      await processStep(step.approvalRequestId, 'rejected', reason);
      setSelectedExpenseId(null);
      setDetailOpen(false);
      fetchExpenses();
    } catch (err: any) { toast.error(err.message || 'Failed to reject'); }
  };

  const pending = pendingExpenses;
  const processed = completedExpenses;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (pendingExpenses.length === 0 && completedExpenses.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No expenses found for this month</p>;
  }

  const ExpenseCard: React.FC<{ exp: ExpenseRecord; showActions: boolean }> = ({ exp, showActions }) => (
    <Card className="border cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => { setDetailExpense(exp); setDetailOpen(true); }}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium truncate">{exp.employee_name}</p>
          <Badge variant={STATUS_BADGE_MAP[exp.status]?.variant || 'secondary'} className="text-[10px]">
            {STATUS_BADGE_MAP[exp.status]?.label || exp.status}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {new Date(exp.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            {' · '}
            {exp.category === 'Other' ? exp.custom_category : exp.category}
          </span>
          <span className="text-sm font-bold text-primary">₹{exp.amount.toLocaleString()}</span>
        </div>
        {exp.description && <p className="text-[11px] text-muted-foreground truncate">{exp.description}</p>}
        {!showActions && exp.approver_name && (
          <p className="text-[10px] text-muted-foreground">
            {exp.status === 'rejected' ? 'Rejected' : 'Approved'} by {exp.approver_name}
            {exp.approved_at && ` · ${new Date(exp.approved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
          </p>
        )}
        {showActions && (
          <div className="flex items-center justify-end gap-1 pt-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={(e) => { e.stopPropagation(); handleApprove(exp.id); }} disabled={actionLoading === exp.id}>
              <CheckCircle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:bg-destructive/10"
              onClick={(e) => { e.stopPropagation(); setSelectedExpenseId(exp.id); setRejectionDialogOpen(true); }}
              disabled={actionLoading === exp.id}>
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">Pending ({pending.length})</p>
          {pending.map(exp => <ExpenseCard key={exp.id} exp={exp} showActions />)}
        </div>
      )}
      {processed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Completed Approvals ({processed.length})</p>
          {processed.map(exp => <ExpenseCard key={exp.id} exp={exp} showActions={false} />)}
        </div>
      )}
      <ExpenseDetailDialog
        expense={detailExpense}
        open={detailOpen}
        onOpenChange={(v) => { setDetailOpen(v); if (!v) setDetailExpense(null); }}
        onApprove={handleApprove}
        onReject={(id) => { setSelectedExpenseId(id); setRejectionDialogOpen(true); }}
        actionLoading={actionLoading}
      />
      <RejectionReasonDialog
        isOpen={rejectionDialogOpen}
        onClose={() => { setRejectionDialogOpen(false); setSelectedExpenseId(null); }}
        onConfirm={handleReject}
        title="Reject Expense"
        description="Please provide a reason for rejecting this expense."
      />
    </div>
  );
};

// ─── Overview: Individual Member Rows ────────────────────────────────────────

const TeamMemberRow: React.FC<{ userId: string; name: string; yearMonth: string }> = ({
  userId, name, yearMonth
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [breakdownView, setBreakdownView] = useState<'weekly' | 'daily'>('weekly');
  const { data: summary, isLoading } = useMonthlyExpenseSummary(userId, yearMonth);

  return (
    <>
      <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setDialogOpen(true)}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-sm font-medium truncate min-w-0">{name}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {summary && summary.additionalPending > 0 && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-yellow-300 text-yellow-700">
                  Pending {fmt(summary.additionalPending)}
                </Badge>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
          {isLoading ? (
            <div className="h-8 rounded bg-muted animate-pulse" />
          ) : summary ? (
            <div className="grid grid-cols-5 gap-1 text-center">
              <div>
                <p className="text-[9px] text-muted-foreground">TA</p>
                <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">{fmt(summary.ta)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">DA</p>
                <p className="text-[11px] font-semibold text-green-600 dark:text-green-400">{fmt(summary.da)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Add</p>
                <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">{fmt(summary.additionalApproved)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Total</p>
                <p className="text-[11px] font-bold text-primary">{fmt(summary.total)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Orders</p>
                <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400">{fmt(summary.orderValue)}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{name} · Breakdown</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Button
                variant={breakdownView === 'weekly' ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs gap-1.5 px-3"
                onClick={() => setBreakdownView('weekly')}
              >
                <CalendarRange className="h-3.5 w-3.5" />
                Weekly
              </Button>
              <Button
                variant={breakdownView === 'daily' ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs gap-1.5 px-3"
                onClick={() => setBreakdownView('daily')}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Daily
              </Button>
            </div>

            {summary && (
              breakdownView === 'weekly' ? (
                <WeeklyBreakdown weeks={summary.weeklyBreakdown} />
              ) : (
                <DailyBreakdown days={summary.dailyBreakdown} />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Overview Tab with Aggregated Summary Cards ──────────────────────────────

// Helper component to collect a single subordinate's summary into aggregation
const useTeamAggregatedExpenses = (subordinateIds: string[], yearMonth: string) => {
  const [aggregated, setAggregated] = useState({ ta: 0, da: 0, additional: 0, total: 0, presentDays: 0, orderValue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (subordinateIds.length === 0) { setLoading(false); return; }

    const fetchAll = async () => {
      setLoading(true);
      const [yr, mo] = yearMonth.split('-').map(Number);
      const start = startOfMonth(new Date(yr, mo - 1));
      const end = endOfMonth(start);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      try {
        // Fetch all data + expense config hierarchy
        const { fetchExpenseConfigs, resolveExpenseConfig, fetchUserManagerIds } = await import('@/hooks/useResolvedExpenseConfig');
        const [{ globalConfig, userConfigMap, teamConfigMap, userGroupConfigMap }, managerMap, attendanceRes, beatPlansRes, beatsRes, additionalRes, ordersRes] = await Promise.all([
          fetchExpenseConfigs(),
          fetchUserManagerIds(subordinateIds),
          supabase.from('attendance').select('user_id, date, status')
            .in('user_id', subordinateIds).gte('date', startStr).lte('date', endStr),
          supabase.from('beat_plans').select('user_id, plan_date, beat_id')
            .in('user_id', subordinateIds).gte('plan_date', startStr).lte('plan_date', endStr),
          supabase.from('beats').select('beat_id, travel_allowance, average_km'),
          (supabase as any).from('additional_expenses').select('user_id, amount, status, expense_date')
            .in('user_id', subordinateIds).gte('expense_date', startStr).lte('expense_date', endStr),
          supabase.from('orders').select('user_id, total_amount')
            .in('user_id', subordinateIds).gte('order_date', startStr).lte('order_date', endStr)
            .eq('status', 'confirmed'),
        ]);

        // Build beat TA map with per-km rate support
        // Build base beat data map
        const beatDataMap = new Map<string, { travel_allowance: number; average_km: number }>();
        beatsRes.data?.forEach((b: any) => beatDataMap.set(b.beat_id, { travel_allowance: b.travel_allowance || 0, average_km: b.average_km || 0 }));

        let totalTA = 0, totalDA = 0, totalAdditional = 0, totalPresent = 0;

        subordinateIds.forEach(uid => {
          // Resolve per-user config
          const userConfig = resolveExpenseConfig(uid, managerMap.get(uid), globalConfig, userConfigMap, teamConfigMap, userGroupConfigMap);
          const taPerKmRate = userConfig.ta_per_km_rate || 0;
          
          const presentDates = new Set(
            attendanceRes.data?.filter((a: any) => a.user_id === uid && ['present', 'regularized'].includes(a.status)).map((a: any) => a.date) || []
          );
          totalPresent += presentDates.size;
          totalDA += presentDates.size * userConfig.da_amount;

          // TA
          if (userConfig.ta_type === 'fixed') {
            totalTA += presentDates.size * userConfig.fixed_ta_amount;
          } else {
            beatPlansRes.data?.filter((p: any) => p.user_id === uid && presentDates.has(p.plan_date)).forEach((plan: any) => {
              const beatData = beatDataMap.get(plan.beat_id);
              const km = beatData?.average_km || 0;
              const beatFixedTA = beatData?.travel_allowance || 0;
              const beatTA = (taPerKmRate > 0 && km > 0) ? (km * taPerKmRate) : beatFixedTA;
              totalTA += beatTA;
            });
          }

          // Additional approved
          const userAdditional = additionalRes.data?.filter((e: any) => e.user_id === uid && ['manager_approved', 'paid'].includes(e.status)) || [];
          totalAdditional += userAdditional.reduce((s: number, e: any) => s + (e.amount || 0), 0);
        });

        const totalOrderValue = (ordersRes.data || []).reduce((s: number, o: any) => s + (o.total_amount || 0), 0);

        setAggregated({
          ta: totalTA, da: totalDA, additional: totalAdditional,
          total: totalTA + totalDA + totalAdditional, presentDays: totalPresent,
          orderValue: totalOrderValue,
        });
      } catch (err) {
        console.error('Error aggregating team expenses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [subordinateIds.join(','), yearMonth]);

  return { aggregated, loading };
};

const TeamOverview: React.FC<{ yearMonth: string }> = ({ yearMonth }) => {
  const { subordinates, subordinateIds } = useSubordinates();
  const { aggregated, loading } = useTeamAggregatedExpenses(subordinateIds, yearMonth);

  return (
    <div className="space-y-3">
      <ExpenseSummaryCards
        ta={aggregated.ta}
        da={aggregated.da}
        additional={aggregated.additional}
        total={aggregated.total}
        presentDays={aggregated.presentDays}
        loading={loading}
        onTotalClick={() => {}}
        isExpanded={false}
        orderValue={aggregated.orderValue}
      />

      <div className="space-y-2">
        {subordinates.map((sub) => (
          <TeamMemberRow
            key={sub.subordinate_user_id}
            userId={sub.subordinate_user_id}
            name={sub.full_name}
            yearMonth={yearMonth}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Main TeamExpenseSummary ──────────────────────────────────────────────────

const TeamExpenseSummary: React.FC<TeamExpenseSummaryProps> = ({ yearMonth: parentYearMonth }) => {
  const { subordinates, isLoading: loadingSubs } = useSubordinates();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const yearMonth = format(selectedMonth, 'yyyy-MM');

  if (loadingSubs) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!subordinates.length) {
    return <p className="text-sm text-muted-foreground text-center py-6">No team members found</p>;
  }

  return (
    <div className="space-y-3">
      <MonthNavigator selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />

      <Tabs defaultValue="approvals" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-9">
          <TabsTrigger value="approvals" className="text-xs gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" />
            Approvals
          </TabsTrigger>
          <TabsTrigger value="overview" className="text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="mt-3">
          <TeamApprovalsList yearMonth={yearMonth} />
        </TabsContent>

        <TabsContent value="overview" className="mt-3">
          <TeamOverview yearMonth={yearMonth} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TeamExpenseSummary;
