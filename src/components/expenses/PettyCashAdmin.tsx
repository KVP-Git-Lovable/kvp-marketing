import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { filterActiveProfileRows } from '@/lib/activeUserFilter';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Wallet, Snowflake, XCircle, CheckCircle, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Fund {
  id: string;
  user_id: string;
  allocated_amount: number;
  balance: number;
  valid_from: string;
  valid_to: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
}

interface Transaction {
  id: string;
  fund_id: string;
  user_id: string;
  amount: number;
  category: string;
  description: string | null;
  bill_url: string | null;
  transaction_date: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  frozen: 'outline',
  closed: 'destructive',
  draft: 'secondary',
  submitted: 'outline',
  approved: 'default',
  rejected: 'destructive',
};

const PettyCashAdmin: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAssign, setShowAssign] = useState(false);
  const [expandedFund, setExpandedFund] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ txId: string; open: boolean }>({ txId: '', open: false });
  const [rejectReason, setRejectReason] = useState('');

  const [assignForm, setAssignForm] = useState({
    user_id: '',
    allocated_amount: '',
    valid_from: format(new Date(), 'yyyy-MM-dd'),
    valid_to: '',
    notes: '',
    max_per_transaction: '',
    max_per_day: '',
    require_bill_above: '',
  });

  // Fetch all funds with user names
  const { data: funds = [], isLoading: fundsLoading } = useQuery({
    queryKey: ['admin-petty-cash-funds'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('petty_cash_funds')
        .select('*, profiles!petty_cash_funds_user_id_fkey(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Fund[];
    },
  });

  // Fetch all profiles for assignment
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-petty-cash'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_profiles_for_selector');
      return filterActiveProfileRows(data || []);
    },
  });

  // Fetch transactions for expanded fund
  const { data: fundTransactions = [] } = useQuery({
    queryKey: ['admin-petty-cash-txns', expandedFund],
    queryFn: async () => {
      if (!expandedFund) return [];
      const { data, error } = await (supabase as any)
        .from('petty_cash_transactions')
        .select('*, profiles!petty_cash_transactions_user_id_fkey(full_name)')
        .eq('fund_id', expandedFund)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Transaction[];
    },
    enabled: !!expandedFund,
  });

  // Assign fund mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !assignForm.user_id || !assignForm.allocated_amount) throw new Error('Missing fields');
      const amount = parseFloat(assignForm.allocated_amount);

      const { data: fundData, error: fundErr } = await (supabase as any).from('petty_cash_funds').insert({
        user_id: assignForm.user_id,
        allocated_amount: amount,
        balance: amount,
        valid_from: assignForm.valid_from,
        valid_to: assignForm.valid_to || null,
        notes: assignForm.notes || null,
        created_by: user.id,
      }).select('id').single();
      if (fundErr) throw fundErr;

      // Insert limits if any set
      const hasLimits = assignForm.max_per_transaction || assignForm.max_per_day || assignForm.require_bill_above;
      if (hasLimits && fundData) {
        const { error: limErr } = await (supabase as any).from('petty_cash_limits').insert({
          fund_id: fundData.id,
          max_per_transaction: assignForm.max_per_transaction ? parseFloat(assignForm.max_per_transaction) : null,
          max_per_day: assignForm.max_per_day ? parseFloat(assignForm.max_per_day) : null,
          require_bill_above: assignForm.require_bill_above ? parseFloat(assignForm.require_bill_above) : null,
        });
        if (limErr) throw limErr;
      }
    },
    onSuccess: () => {
      toast.success('Petty cash fund assigned');
      queryClient.invalidateQueries({ queryKey: ['admin-petty-cash-funds'] });
      setShowAssign(false);
      setAssignForm({ user_id: '', allocated_amount: '', valid_from: format(new Date(), 'yyyy-MM-dd'), valid_to: '', notes: '', max_per_transaction: '', max_per_day: '', require_bill_above: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateFundStatus = async (fundId: string, status: string) => {
    const { error } = await (supabase as any).from('petty_cash_funds').update({ status, updated_at: new Date().toISOString() }).eq('id', fundId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Fund ${status}`);
    queryClient.invalidateQueries({ queryKey: ['admin-petty-cash-funds'] });
  };

  const approveTx = async (txId: string) => {
    const { error } = await (supabase as any).from('petty_cash_transactions').update({ status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() }).eq('id', txId);
    if (error) { toast.error(error.message); return; }
    toast.success('Transaction approved');
    queryClient.invalidateQueries({ queryKey: ['admin-petty-cash-txns'] });
  };

  const rejectTx = async () => {
    const { error } = await (supabase as any).from('petty_cash_transactions').update({ status: 'rejected', rejection_reason: rejectReason || null }).eq('id', rejectDialog.txId);
    if (error) { toast.error(error.message); return; }
    toast.success('Transaction rejected');
    queryClient.invalidateQueries({ queryKey: ['admin-petty-cash-txns'] });
    queryClient.invalidateQueries({ queryKey: ['admin-petty-cash-funds'] });
    setRejectDialog({ txId: '', open: false });
    setRejectReason('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" /> Petty Cash Funds
        </h3>
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowAssign(true)}>
          <Plus className="h-3.5 w-3.5" /> Assign Fund
        </Button>
      </div>

      {fundsLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading funds...</p>
      ) : funds.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No petty cash funds assigned yet</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {funds.map(fund => (
            <Card key={fund.id} className="overflow-hidden">
              <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedFund(expandedFund === fund.id ? null : fund.id)}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{fund.profiles?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      ₹{fund.balance.toLocaleString()} / ₹{fund.allocated_amount.toLocaleString()}
                      {fund.valid_to && ` · Until ${format(new Date(fund.valid_to), 'dd MMM yy')}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_COLORS[fund.status] || 'secondary'} className="text-xs capitalize">
                    {fund.status}
                  </Badge>
                  {fund.status === 'active' && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); updateFundStatus(fund.id, 'frozen'); }}>
                      <Snowflake className="h-3.5 w-3.5 text-primary" />
                    </Button>
                  )}
                  {fund.status === 'frozen' && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); updateFundStatus(fund.id, 'active'); }}>
                      <CheckCircle className="h-3.5 w-3.5 text-primary" />
                    </Button>
                  )}
                  {fund.status !== 'closed' && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); updateFundStatus(fund.id, 'closed'); }}>
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                  {expandedFund === fund.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              {expandedFund === fund.id && (
                <div className="border-t px-3 pb-3 pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Transactions</p>
                  {fundTransactions.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No transactions</p>
                  ) : (
                    <div className="space-y-1.5">
                      {fundTransactions.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between p-2 rounded border bg-muted/20 text-sm">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-xs">{tx.category}</span>
                              <Badge variant={STATUS_COLORS[tx.status] || 'secondary'} className="text-[10px] px-1">
                                {tx.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.transaction_date), 'dd MMM')}
                              {tx.description && ` · ${tx.description}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">₹{tx.amount.toLocaleString()}</span>
                            {tx.status === 'submitted' && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" className="h-6 text-[10px] px-2" onClick={() => approveTx(tx.id)}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={() => setRejectDialog({ txId: tx.id, open: true })}>
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Assign Fund Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Assign Petty Cash Fund</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Select User</Label>
              <Select value={assignForm.user_id} onValueChange={v => setAssignForm(f => ({ ...f, user_id: v }))}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Choose user" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Allocated Amount (₹)</Label>
              <Input type="number" value={assignForm.allocated_amount} onChange={e => setAssignForm(f => ({ ...f, allocated_amount: e.target.value }))} className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Valid From</Label>
                <Input type="date" value={assignForm.valid_from} onChange={e => setAssignForm(f => ({ ...f, valid_from: e.target.value }))} className="h-10" />
              </div>
              <div>
                <Label className="text-xs">Valid To (optional)</Label>
                <Input type="date" value={assignForm.valid_to} onChange={e => setAssignForm(f => ({ ...f, valid_to: e.target.value }))} className="h-10" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Spending Limits (optional)</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px]">Max/Txn</Label>
                  <Input type="number" placeholder="—" value={assignForm.max_per_transaction} onChange={e => setAssignForm(f => ({ ...f, max_per_transaction: e.target.value }))} className="h-9 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px]">Max/Day</Label>
                  <Input type="number" placeholder="—" value={assignForm.max_per_day} onChange={e => setAssignForm(f => ({ ...f, max_per_day: e.target.value }))} className="h-9 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px]">Bill Req Above</Label>
                  <Input type="number" placeholder="—" value={assignForm.require_bill_above} onChange={e => setAssignForm(f => ({ ...f, require_bill_above: e.target.value }))} className="h-9 text-xs" />
                </div>
              </div>
            </div>

            <Button className="w-full h-9 text-xs" onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending}>
              {assignMutation.isPending ? 'Assigning...' : 'Assign Fund'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={o => setRejectDialog(d => ({ ...d, open: o }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-base">Reject Transaction</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Reason (optional)</Label>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} />
            </div>
            <Button variant="destructive" className="w-full h-9 text-xs" onClick={rejectTx}>Reject</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PettyCashAdmin;
