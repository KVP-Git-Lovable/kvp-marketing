import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, BookOpen, User, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface AccrualLog {
  id: string;
  user_id: string;
  leave_type_id: string;
  year: number;
  month: number | null;
  accrual_type: string | null;
  days_credited: number;
  days_debited: number | null;
  balance_after: number;
  notes: string | null;
  created_at: string;
  leave_types?: {
    name: string;
    code: string | null;
    color: string | null;
  };
}

interface LeaveBalance {
  id: string;
  leave_type_id: string;
  opening_balance: number;
  used_balance: number;
  remaining_balance: number | null;
  leave_types?: {
    name: string;
    code: string | null;
    color: string | null;
  };
}

const LeaveLedger = () => {
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedLeaveType, setSelectedLeaveType] = useState('all');
  const [accrualLogs, setAccrualLogs] = useState<AccrualLog[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [leaveTypes, setLeaveTypes] = useState<Array<{ id: string; name: string; code: string | null }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchLedgerData();
    }
  }, [selectedUser, selectedYear, selectedLeaveType]);

  const fetchInitialData = async () => {
    try {
      const [usersRes, leaveTypesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').order('full_name'),
        supabase.from('leave_types').select('id, name, code' as any).eq('is_active', true).order('sort_order'),
      ]);

      setUsers(usersRes.data || []);
      setLeaveTypes((leaveTypesRes.data || []) as any);

      // Set first user as default if available
      if (usersRes.data && usersRes.data.length > 0) {
        setSelectedUser(usersRes.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLedgerData = async () => {
    if (!selectedUser) return;

    setIsLoading(true);
    try {
      // Fetch accrual logs
      let logsQuery = (supabase as any)
        .from('leave_accrual_log')
        .select('*')
        .eq('user_id', selectedUser)
        .eq('year', parseInt(selectedYear))
        .order('created_at', { ascending: true });

      if (selectedLeaveType !== 'all') {
        logsQuery = logsQuery.eq('leave_type_id', selectedLeaveType);
      }

      // Fetch balances
      let balancesQuery = supabase
        .from('leave_balance')
        .select('*')
        .eq('user_id', selectedUser)
        .eq('year', parseInt(selectedYear));

      if (selectedLeaveType !== 'all') {
        balancesQuery = balancesQuery.eq('leave_type_id', selectedLeaveType);
      }

      const [logsRes, balancesRes] = await Promise.all([logsQuery, balancesQuery]);

      if (logsRes.error) throw logsRes.error;
      if (balancesRes.error) throw balancesRes.error;

      // Enrich with leave type data
      const leaveTypeIds = [...new Set([
        ...(logsRes.data?.map(l => l.leave_type_id) || []),
        ...(balancesRes.data?.map(b => b.leave_type_id) || []),
      ])];

      const { data: leaveTypesData } = await (supabase as any)
        .from('leave_types')
        .select('id, name, code, color')
        .in('id', leaveTypeIds);

      const enrichedLogs = (logsRes.data || []).map(log => ({
        ...log,
        leave_types: leaveTypesData?.find(lt => lt.id === log.leave_type_id),
      }));

      const enrichedBalances = (balancesRes.data || []).map(balance => ({
        ...balance,
        leave_types: leaveTypesData?.find(lt => lt.id === balance.leave_type_id),
      }));

      setAccrualLogs(enrichedLogs as any);
      setBalances(enrichedBalances as any);
    } catch (error) {
      console.error('Error fetching ledger data:', error);
      toast.error('Failed to load ledger data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    const userName = users.find(u => u.id === selectedUser)?.full_name || 'Unknown';
    const csvContent = [
      ['Date', 'Leave Type', 'Transaction Type', 'Credit', 'Debit', 'Balance After', 'Notes'].join(','),
      ...accrualLogs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd'),
        log.leave_types?.name || 'Unknown',
        log.accrual_type || '-',
        log.days_credited,
        log.days_debited || 0,
        log.balance_after,
        `"${log.notes || ''}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leave_ledger_${userName.replace(/\s+/g, '_')}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export completed');
  };

  const getAccrualTypeLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      monthly: 'Monthly Accrual',
      quarterly: 'Quarterly Accrual',
      yearly: 'Yearly Credit',
      carry_forward: 'Carry Forward',
      adjustment: 'Manual Adjustment',
      encashment: 'Encashment',
      deduction: 'Leave Deduction',
    };
    return labels[type || ''] || type || '-';
  };

  const getAccrualTypeColor = (type: string | null) => {
    const colors: Record<string, string> = {
      monthly: 'bg-blue-100 text-blue-800',
      quarterly: 'bg-blue-100 text-blue-800',
      yearly: 'bg-green-100 text-green-800',
      carry_forward: 'bg-purple-100 text-purple-800',
      adjustment: 'bg-yellow-100 text-yellow-800',
      encashment: 'bg-orange-100 text-orange-800',
      deduction: 'bg-red-100 text-red-800',
    };
    return colors[type || ''] || 'bg-gray-100 text-gray-800';
  };

  const selectedUserName = users.find(u => u.id === selectedUser)?.full_name || 'Select User';

  if (isLoading && !selectedUser) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Leave Ledger
              </CardTitle>
              <CardDescription>
                Individual employee leave transaction history
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-[200px]">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Leave Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {leaveTypes.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id}>
                      {lt.code ? `${lt.code} - ${lt.name}` : lt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExport} disabled={!selectedUser || accrualLogs.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Balance Summary */}
          {balances.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {balances.map((balance) => (
                <div
                  key={balance.id}
                  className="rounded-lg p-4 border"
                  style={{ borderLeftWidth: 4, borderLeftColor: balance.leave_types?.color || '#3b82f6' }}
                >
                  <div className="text-sm text-muted-foreground">
                    {balance.leave_types?.code || balance.leave_types?.name || 'Leave'}
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold">{balance.remaining_balance || 0}</span>
                    <span className="text-sm text-muted-foreground">/ {balance.opening_balance}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Used: {balance.used_balance} days
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Transaction History */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : accrualLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions found for {selectedUserName} in {selectedYear}</p>
              <p className="text-sm mt-2">Leave accruals and deductions will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Transaction Type</TableHead>
                  <TableHead className="text-center">Credit</TableHead>
                  <TableHead className="text-center">Debit</TableHead>
                  <TableHead className="text-center">Balance</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accrualLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: log.leave_types?.color || '#3b82f6' }}
                        />
                        <span>{log.leave_types?.code || log.leave_types?.name || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getAccrualTypeColor(log.accrual_type)}>
                        {getAccrualTypeLabel(log.accrual_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {log.days_credited > 0 && (
                        <div className="flex items-center justify-center gap-1 text-green-600">
                          <ArrowUpCircle className="h-4 w-4" />
                          <span>+{log.days_credited}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {(log.days_debited || 0) > 0 && (
                        <div className="flex items-center justify-center gap-1 text-red-600">
                          <ArrowDownCircle className="h-4 w-4" />
                          <span>-{log.days_debited}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{log.balance_after}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {log.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeaveLedger;
