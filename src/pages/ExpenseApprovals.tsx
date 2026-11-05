import React, { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, CheckCircle, XCircle, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMyPendingSteps, useProcessApprovalStep } from '@/hooks/useApprovalEngine';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import RejectionReasonDialog from '@/components/RejectionReasonDialog';

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
  submitted_at: string | null;
  employee_name?: string;
  // approval engine fields
  approvalRequestId?: string;
  stepId?: string;
}

type FilterStatus = 'pending' | 'manager_approved' | 'rejected' | 'all';
type DateFilter = 'this_week' | 'this_month' | 'last_month' | 'custom';

const STATUS_BADGE_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  submitted: { label: 'Submitted', variant: 'outline' },
  manager_approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  paid: { label: 'Paid', variant: 'default' },
};

const ExpenseApprovals = () => {
  const { user } = useAuth();
  const { data: pendingSteps, isLoading: stepsLoading } = useMyPendingSteps();
  const { processStep } = useProcessApprovalStep();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [completedExpenses, setCompletedExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('pending');
  const [dateFilter, setDateFilter] = useState<DateFilter>('this_month');
  const [dateRangeStart, setDateRangeStart] = useState<Date>();
  const [dateRangeEnd, setDateRangeEnd] = useState<Date>();
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRecord | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Get expense-related pending steps
  const expensePendingSteps = useMemo(
    () => (pendingSteps || []).filter(s => s.entityType === 'expense'),
    [pendingSteps]
  );

  const getDateRange = () => {
    const today = new Date();
    switch (dateFilter) {
      case 'this_week':
        return { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) };
      case 'this_month':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'last_month': {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      }
      case 'custom':
        if (dateRangeStart && dateRangeEnd) return { start: dateRangeStart, end: dateRangeEnd };
        return { start: startOfMonth(today), end: endOfMonth(today) };
      default:
        return { start: startOfMonth(today), end: endOfMonth(today) };
    }
  };

  // Fetch pending expenses using approval engine entity IDs
  const fetchPendingExpenses = async () => {
    if (expensePendingSteps.length === 0) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const entityIds = expensePendingSteps.map(s => s.entityId);
      const { start, end } = getDateRange();

      const { data, error } = await (supabase as any)
        .from('additional_expenses')
        .select('*')
        .in('id', entityIds)
        .gte('expense_date', format(start, 'yyyy-MM-dd'))
        .lte('expense_date', format(end, 'yyyy-MM-dd'))
        .order('expense_date', { ascending: false });

      if (error) throw error;

      // Fetch employee names
      const userIds = [...new Set((data || []).map((e: any) => e.user_id))];
      let nameMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        profiles?.forEach((p: any) => nameMap.set(p.id, p.full_name));
      }

      const mapped = (data || []).map((exp: any) => {
        const step = expensePendingSteps.find(s => s.entityId === exp.id);
        return {
          ...exp,
          employee_name: nameMap.get(exp.user_id) || 'Unknown',
          approvalRequestId: step?.approvalRequestId,
          stepId: step?.stepId,
        };
      });

      setExpenses(mapped);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  // Fetch completed (approved/rejected) expenses for history view
  const fetchCompletedExpenses = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { start, end } = getDateRange();

      // Get expense IDs where I was an approver (from audit log)
      const { data: auditData } = await supabase
        .from('approval_audit_log')
        .select('entity_id')
        .eq('entity_type', 'expense')
        .eq('performed_by', user.id)
        .in('action', ['approved', 'rejected']);

      const entityIds = [...new Set((auditData || []).map((a: any) => a.entity_id))];
      if (entityIds.length === 0) { setCompletedExpenses([]); setLoading(false); return; }

      const statusToFetch = statusFilter === 'manager_approved' ? 'manager_approved' :
                             statusFilter === 'rejected' ? 'rejected' :
                             undefined;

      let query = (supabase as any)
        .from('additional_expenses')
        .select('*')
        .in('id', entityIds)
        .gte('expense_date', format(start, 'yyyy-MM-dd'))
        .lte('expense_date', format(end, 'yyyy-MM-dd'))
        .order('expense_date', { ascending: false });

      if (statusToFetch) {
        query = query.eq('status', statusToFetch);
      } else {
        query = query.in('status', ['manager_approved', 'rejected']);
      }

      const { data, error } = await query;
      if (error) throw error;

      const userIds = [...new Set((data || []).map((e: any) => e.user_id))];
      let nameMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        profiles?.forEach((p: any) => nameMap.set(p.id, p.full_name));
      }

      setCompletedExpenses((data || []).map((exp: any) => ({
        ...exp,
        employee_name: nameMap.get(exp.user_id) || 'Unknown',
      })));
    } catch (error) {
      console.error('Error fetching completed expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!stepsLoading) {
      if (statusFilter === 'pending') {
        fetchPendingExpenses();
      } else {
        fetchCompletedExpenses();
      }
    }
  }, [stepsLoading, expensePendingSteps.length, statusFilter, dateFilter, dateRangeStart, dateRangeEnd]);

  const handleApprove = async (expense: ExpenseRecord) => {
    if (!expense.approvalRequestId) {
      toast.error('No approval request found for this expense');
      return;
    }
    setActionLoading(expense.id);
    try {
      await processStep(expense.approvalRequestId, 'approved');
      if (statusFilter === 'pending') fetchPendingExpenses();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve expense');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedExpense?.approvalRequestId) return;
    try {
      await processStep(selectedExpense.approvalRequestId, 'rejected', reason);
      setSelectedExpense(null);
      if (statusFilter === 'pending') fetchPendingExpenses();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject expense');
    }
  };

  const openBill = async (billUrl: string) => {
    try {
      const { data } = await supabase.storage
        .from('expense-bills')
        .createSignedUrl(billUrl, 300);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch {
      toast.error('Failed to open bill');
    }
  };

  const displayExpenses = statusFilter === 'pending' ? expenses : completedExpenses;

  const employeeSummary = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    displayExpenses.forEach(exp => {
      const existing = map.get(exp.user_id) || { name: exp.employee_name || 'Unknown', total: 0, count: 0 };
      existing.total += exp.amount;
      existing.count += 1;
      map.set(exp.user_id, existing);
    });
    return Array.from(map.entries()).map(([id, data]) => ({ id, ...data }));
  }, [displayExpenses]);

  if (stepsLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          <h1 className="text-2xl font-bold">Team Expense Approvals</h1>

          {/* Filters */}
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap items-center gap-3">
                <Select value={statusFilter} onValueChange={(v: FilterStatus) => setStatusFilter(v)}>
                  <SelectTrigger className="w-[140px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="manager_approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="all">All Completed</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateFilter} onValueChange={(v: DateFilter) => setDateFilter(v)}>
                  <SelectTrigger className="w-[140px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this_week">This Week</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>

                {dateFilter === 'custom' && (
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("h-9 w-[110px] text-xs", !dateRangeStart && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {dateRangeStart ? format(dateRangeStart, "MMM dd") : "Start"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateRangeStart} onSelect={setDateRangeStart} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("h-9 w-[110px] text-xs", !dateRangeEnd && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {dateRangeEnd ? format(dateRangeEnd, "MMM dd") : "End"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateRangeEnd} onSelect={setDateRangeEnd} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Employee Summary Cards */}
          {employeeSummary.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {employeeSummary.map(emp => (
                <Card key={emp.id} className="border">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate">{emp.name}</p>
                    <p className="text-lg font-bold text-primary">₹{emp.total.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{emp.count} expense{emp.count !== 1 ? 's' : ''}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Expenses Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Expenses ({displayExpenses.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Employee</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-right text-xs">Amount</TableHead>
                        <TableHead className="text-xs">Description</TableHead>
                        <TableHead className="text-center text-xs">Bill</TableHead>
                        <TableHead className="text-center text-xs">Status</TableHead>
                        <TableHead className="text-center text-xs">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayExpenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No expenses found for the selected filters
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayExpenses.map(exp => (
                          <TableRow key={exp.id}>
                            <TableCell className="text-xs font-medium">{exp.employee_name}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(exp.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </TableCell>
                            <TableCell className="text-xs">
                              {exp.category === 'Other' ? exp.custom_category : exp.category}
                            </TableCell>
                            <TableCell className="text-right text-xs font-medium">₹{exp.amount.toLocaleString()}</TableCell>
                            <TableCell className="text-xs max-w-[120px] truncate">{exp.description || '-'}</TableCell>
                            <TableCell className="text-center">
                              {exp.bill_url ? (
                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openBill(exp.bill_url!)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={STATUS_BADGE_MAP[exp.status]?.variant || 'secondary'} className="text-[10px]">
                                {STATUS_BADGE_MAP[exp.status]?.label || exp.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {exp.status === 'submitted' && exp.approvalRequestId && (
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handleApprove(exp)}
                                    disabled={actionLoading === exp.id}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-destructive hover:bg-destructive/10"
                                    onClick={() => { setSelectedExpense(exp); setRejectionDialogOpen(true); }}
                                    disabled={actionLoading === exp.id}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <RejectionReasonDialog
        isOpen={rejectionDialogOpen}
        onClose={() => { setRejectionDialogOpen(false); setSelectedExpense(null); }}
        onConfirm={handleReject}
        title="Reject Expense"
        description="Please provide a reason for rejecting this expense."
      />
    </Layout>
  );
};

export default ExpenseApprovals;
