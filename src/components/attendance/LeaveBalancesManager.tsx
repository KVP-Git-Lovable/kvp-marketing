import { useState, useEffect } from 'react';
import { ACTIVE_PROFILE } from '@/lib/activeUserFilter';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, RefreshCw, Download, Edit, Plus, Users, FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type_id: string;
  opening_balance: number;
  used_balance: number;
  remaining_balance: number | null;
  year: number;
  profiles?: {
    full_name: string;
  };
  leave_types?: {
    name: string;
  };
}

interface LeaveType {
  id: string;
  name: string;
}

interface UserProfile {
  id: string;
  full_name: string;
}

const LeaveBalancesManager = () => {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLeaveType, setFilterLeaveType] = useState('all');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [isInitializing, setIsInitializing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBalance, setEditingBalance] = useState<LeaveBalance | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    user_id: '',
    leave_type_id: '',
    opening_balance: 0,
    used_balance: 0,
  });

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  useEffect(() => {
    fetchData();
  }, [filterYear, filterLeaveType]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch leave types
      const { data: ltData } = await supabase.from('leave_types').select('*').eq('is_active', true).order('name');
      setLeaveTypes(ltData || []);

      // Fetch users
      const { data: usersData } = await supabase.from('profiles').select('id, full_name').match(ACTIVE_PROFILE).order('full_name');
      setUsers(usersData || []);

      // Build balance query
      let query = supabase
        .from('leave_balance')
        .select('*')
        .eq('year', parseInt(filterYear));

      if (filterLeaveType !== 'all') {
        query = query.eq('leave_type_id', filterLeaveType);
      }

      const { data: balanceData, error } = await query;

      if (error) throw error;

      // Enrich with profiles and leave types
      const enriched = (balanceData || []).map(balance => ({
        ...balance,
        profiles: usersData?.find(u => u.id === balance.user_id),
        leave_types: ltData?.find(lt => lt.id === balance.leave_type_id),
      }));

      setBalances(enriched);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load leave balances');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitializeBalances = async () => {
    setIsInitializing(true);
    try {
      // Get leave policies
      const { data: policies, error: policiesError } = await supabase
        .from('leave_policy')
        .select('*')
        .eq('is_active', true);

      if (policiesError) throw policiesError;

      if (!policies || policies.length === 0) {
        toast.error('No active leave policies found. Please configure leave policies first.');
        return;
      }

      // Get all active users
      const { data: activeUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_status', 'active');

      if (usersError) throw usersError;

      if (!activeUsers || activeUsers.length === 0) {
        toast.error('No active users found');
        return;
      }

      const year = parseInt(filterYear);

      // Compute months elapsed: Jan=1, Feb=2, ..., Dec=12
      // If initializing for a past/future year, use full 12 months; for current year use actual month
      const currentYear = new Date().getFullYear();
      const monthsElapsed = year === currentYear
        ? new Date().getMonth() + 1  // Jan=1, Feb=2, ..., Dec=12
        : 12;

      const balancesToInsert: Array<{
        user_id: string;
        leave_type_id: string;
        opening_balance: number;
        used_balance: number;
        year: number;
      }> = [];

      // Create balance entries for each user and policy
      for (const user of activeUsers) {
        for (const policy of policies) {
          // For monthly accrual: credit only months elapsed so far
          // For yearly: grant full entitlement upfront
          const monthlyCredit = policy.yearly_entitlement / 12;
          const initialBalance = policy.accrual_type === 'monthly'
            ? Math.round(monthsElapsed * monthlyCredit)
            : policy.yearly_entitlement;

          balancesToInsert.push({
            user_id: user.id,
            leave_type_id: policy.leave_type_id,
            opening_balance: initialBalance,
            used_balance: 0,
            year,
            // NOTE: remaining_balance is a GENERATED column (opening_balance - used_balance)
            // and must NOT be included in insert/update payloads
          });
        }
      }

      // Upsert balances
      const { error: insertError } = await supabase
        .from('leave_balance')
        .upsert(balancesToInsert, { 
          onConflict: 'user_id,leave_type_id,year',
          ignoreDuplicates: false 
        });

      if (insertError) throw insertError;

      toast.success(`Initialized balances for ${activeUsers.length} users`);
      fetchData();
    } catch (error) {
      console.error('Error initializing balances:', error);
      toast.error('Failed to initialize leave balances');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleRecalculateBalances = async () => {
    setIsInitializing(true);
    try {
      const year = parseInt(filterYear);
      
      // Get approved leave applications for the year
      const { data: applications, error: appError } = await supabase
        .from('leave_applications')
        .select('user_id, leave_type_id, start_date, end_date, days_requested')
        .not('status', 'in', '("rejected","cancelled")')
        .gte('start_date', `${year}-01-01`)
        .lte('end_date', `${year}-12-31`);

      if (appError) throw appError;

      // Calculate used days per user per leave type using days_requested
      const usedDaysMap: Record<string, number> = {};

      for (const app of applications || []) {
        const key = `${app.user_id}_${app.leave_type_id}`;
        const startDate = new Date(app.start_date);
        const endDate = new Date(app.end_date);
        const days = app.days_requested != null
          ? app.days_requested
          : Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        usedDaysMap[key] = (usedDaysMap[key] || 0) + days;
      }

      // Update balances
      for (const balance of balances) {
        const key = `${balance.user_id}_${balance.leave_type_id}`;
        const usedDays = usedDaysMap[key] || 0;
        const remaining = balance.opening_balance - usedDays;

        await supabase
          .from('leave_balance')
          .update({
            used_balance: usedDays,
            // remaining_balance is a GENERATED column — do NOT include it
          })
          .eq('id', balance.id);
      }

      toast.success('Balances recalculated successfully');
      fetchData();
    } catch (error) {
      console.error('Error recalculating balances:', error);
      toast.error('Failed to recalculate balances');
    } finally {
      setIsInitializing(false);
    }
  };

  const openEditDialog = (balance: LeaveBalance) => {
    setEditingBalance(balance);
    setFormData({
      user_id: balance.user_id,
      leave_type_id: balance.leave_type_id,
      opening_balance: balance.opening_balance,
      used_balance: balance.used_balance,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingBalance(null);
    setFormData({
      user_id: '',
      leave_type_id: '',
      opening_balance: 0,
      used_balance: 0,
    });
    setIsDialogOpen(true);
  };

  const handleSaveBalance = async () => {
    if (!formData.user_id || !formData.leave_type_id) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const balanceData = {
        user_id: formData.user_id,
        leave_type_id: formData.leave_type_id,
        opening_balance: formData.opening_balance,
        used_balance: formData.used_balance,
        year: parseInt(filterYear),
      };

      if (editingBalance) {
        const { error } = await supabase
          .from('leave_balance')
          .update(balanceData)
          .eq('id', editingBalance.id);
        
        if (error) throw error;
        toast.success('Balance updated successfully');
      } else {
        const { error } = await supabase.from('leave_balance').insert(balanceData);
        
        if (error) {
          if (error.code === '23505') {
            toast.error('Balance already exists for this user and leave type');
            return;
          }
          throw error;
        }
        toast.success('Balance created successfully');
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving balance:', error);
      toast.error('Failed to save balance');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['Employee', 'Leave Type', 'Opening', 'Used', 'Remaining', 'Year'].join(','),
      ...filteredBalances.map(b => [
        b.profiles?.full_name || 'Unknown',
        b.leave_types?.name || 'Unknown',
        b.opening_balance,
        b.used_balance,
        b.remaining_balance || 0,
        b.year,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leave_balances_${filterYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export completed');
  };

  const filteredBalances = balances.filter(balance => {
    if (!searchQuery) return true;
    const name = balance.profiles?.full_name?.toLowerCase() || '';
    return name.includes(searchQuery.toLowerCase());
  });

  if (isLoading) {
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
                <Users className="h-5 w-5" />
                Leave Balances
              </CardTitle>
              <CardDescription>
                Manage employee leave balances and entitlements
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleInitializeBalances} disabled={isInitializing}>
                <Plus className="h-4 w-4 mr-2" />
                Initialize Year
              </Button>
              <Button variant="outline" onClick={handleRecalculateBalances} disabled={isInitializing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isInitializing ? 'animate-spin' : ''}`} />
                Recalculate
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Balance
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterLeaveType} onValueChange={setFilterLeaveType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Leave Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leave Types</SelectItem>
                {leaveTypes.map((lt) => (
                  <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Total Employees</div>
              <div className="text-2xl font-bold">{new Set(balances.map(b => b.user_id)).size}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Total Records</div>
              <div className="text-2xl font-bold">{balances.length}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Total Allocated</div>
              <div className="text-2xl font-bold">{balances.reduce((sum, b) => sum + b.opening_balance, 0)} days</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Total Used</div>
              <div className="text-2xl font-bold">{balances.reduce((sum, b) => sum + b.used_balance, 0)} days</div>
            </div>
          </div>

          {/* Table */}
          {filteredBalances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No leave balances found for {filterYear}</p>
              <p className="text-sm mt-2">Click "Initialize Year" to create balances based on leave policies</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead className="text-center">Opening</TableHead>
                  <TableHead className="text-center">Used</TableHead>
                  <TableHead className="text-center">Remaining</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBalances.map((balance) => (
                  <TableRow key={balance.id}>
                    <TableCell className="font-medium">
                      {balance.profiles?.full_name || 'Unknown'}
                    </TableCell>
                    <TableCell>{balance.leave_types?.name || 'Unknown'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{balance.opening_balance}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{balance.used_balance}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={
                        (balance.remaining_balance || 0) <= 0 
                          ? 'bg-red-100 text-red-800' 
                          : (balance.remaining_balance || 0) <= 3 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                      }>
                        {balance.remaining_balance || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(balance)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBalance ? 'Edit Leave Balance' : 'Add Leave Balance'}</DialogTitle>
            <DialogDescription>
              Manually adjust leave balance for an employee
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee</Label>
              <Select
                value={formData.user_id}
                onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                disabled={!!editingBalance}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Leave Type</Label>
              <Select
                value={formData.leave_type_id}
                onValueChange={(value) => setFormData({ ...formData, leave_type_id: value })}
                disabled={!!editingBalance}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Opening Balance (days)</Label>
              <Input
                type="number"
                step="0.5"
                value={formData.opening_balance}
                onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })}
                min={0}
              />
            </div>
            <div>
              <Label>Used Balance (days)</Label>
              <Input
                type="number"
                step="0.5"
                value={formData.used_balance}
                onChange={(e) => setFormData({ ...formData, used_balance: parseFloat(e.target.value) || 0 })}
                min={0}
              />
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm text-muted-foreground">Remaining Balance</div>
              <div className="text-lg font-semibold">{formData.opening_balance - formData.used_balance} days</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBalance} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Balance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveBalancesManager;
