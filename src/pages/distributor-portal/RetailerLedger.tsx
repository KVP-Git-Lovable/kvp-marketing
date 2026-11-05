import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { IndianRupee, Search, Plus, AlertTriangle, Clock, TrendingDown, Users } from 'lucide-react';
import { toast } from 'sonner';

interface OutletContext {
  user: { id: string; full_name: string; role: string; distributor_id: string };
  distributorId: string;
}

interface RetailerOutstanding {
  retailer_id: string;
  retailer_name: string;
  total_debit: number;
  total_credit: number;
  outstanding: number;
  last_payment_date: string | null;
  credit_limit: number;
  credit_days: number;
}

const RetailerLedger = () => {
  const { distributorId } = useOutletContext<OutletContext>();
  const navigate = useNavigate();
  const [retailers, setRetailers] = useState<RetailerOutstanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (distributorId) loadData();
  }, [distributorId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get all ledger entries grouped by retailer
      const { data: ledgerData, error: ledgerError } = await supabase
        .from('distributor_retailer_ledger')
        .select('retailer_id, debit_amount, credit_amount, transaction_date, transaction_type')
        .eq('distributor_id', distributorId);

      if (ledgerError) throw ledgerError;

      // Get retailer names
      const retailerIds = [...new Set((ledgerData || []).map(l => l.retailer_id))];
      
      let retailerMap: Record<string, string> = {};
      if (retailerIds.length > 0) {
        const { data: retailerNames } = await supabase
          .from('retailers')
          .select('id, name')
          .in('id', retailerIds);
        retailerMap = Object.fromEntries((retailerNames || []).map(r => [r.id, r.name]));
      }

      // Get credit limits
      const { data: creditData } = await supabase
        .from('distributor_retailer_credit_limits')
        .select('retailer_id, credit_limit, credit_days')
        .eq('distributor_id', distributorId);
      
      const creditMap = Object.fromEntries(
        (creditData || []).map(c => [c.retailer_id, { limit: Number(c.credit_limit), days: c.credit_days }])
      );

      // Aggregate per retailer
      const grouped: Record<string, RetailerOutstanding> = {};
      (ledgerData || []).forEach(entry => {
        if (!grouped[entry.retailer_id]) {
          grouped[entry.retailer_id] = {
            retailer_id: entry.retailer_id,
            retailer_name: retailerMap[entry.retailer_id] || 'Unknown',
            total_debit: 0,
            total_credit: 0,
            outstanding: 0,
            last_payment_date: null,
            credit_limit: creditMap[entry.retailer_id]?.limit || 0,
            credit_days: creditMap[entry.retailer_id]?.days || 30,
          };
        }
        grouped[entry.retailer_id].total_debit += Number(entry.debit_amount);
        grouped[entry.retailer_id].total_credit += Number(entry.credit_amount);
        if (entry.transaction_type === 'payment' && entry.transaction_date) {
          const existing = grouped[entry.retailer_id].last_payment_date;
          if (!existing || entry.transaction_date > existing) {
            grouped[entry.retailer_id].last_payment_date = entry.transaction_date;
          }
        }
      });

      const result = Object.values(grouped).map(r => ({
        ...r,
        outstanding: r.total_debit - r.total_credit,
      }));

      result.sort((a, b) => b.outstanding - a.outstanding);
      setRetailers(result);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  };

  const filtered = retailers.filter(r => {
    const matchSearch = r.retailer_name.toLowerCase().includes(search.toLowerCase());
    if (filter === 'overdue') return matchSearch && r.outstanding > 0;
    if (filter === 'over_limit') return matchSearch && r.credit_limit > 0 && r.outstanding > r.credit_limit;
    if (filter === 'clear') return matchSearch && r.outstanding <= 0;
    return matchSearch;
  });

  const totalOutstanding = filtered.reduce((s, r) => s + Math.max(0, r.outstanding), 0);
  const overLimitCount = filtered.filter(r => r.credit_limit > 0 && r.outstanding > r.credit_limit).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Retailer Ledger</h1>
          <p className="text-sm text-muted-foreground">Outstanding balances & payment tracking</p>
        </div>
        <Button size="sm" onClick={() => navigate('/distributor-portal/collect-payment')}>
          <Plus className="h-4 w-4 mr-1" /> Collect Payment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Outstanding</p>
                <p className="text-lg font-bold text-red-600">₹{totalOutstanding.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Retailers</p>
                <p className="text-lg font-bold">{filtered.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Over Credit Limit</p>
                <p className="text-lg font-bold text-orange-600">{overLimitCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Clear Accounts</p>
                <p className="text-lg font-bold text-green-600">
                  {retailers.filter(r => r.outstanding <= 0).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search retailer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="overdue">Outstanding</SelectItem>
            <SelectItem value="over_limit">Over Limit</SelectItem>
            <SelectItem value="clear">Clear</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <Card><CardContent className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <IndianRupee className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No ledger entries found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ledger entries are created automatically from secondary sales invoices and payment collections.
          </p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Retailer</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Credit Limit</TableHead>
                    <TableHead>Last Payment</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => {
                    const isOverLimit = r.credit_limit > 0 && r.outstanding > r.credit_limit;
                    return (
                      <TableRow
                        key={r.retailer_id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/distributor-portal/retailer-ledger/${r.retailer_id}`)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{r.retailer_name}</p>
                            {isOverLimit && (
                              <Badge variant="destructive" className="text-[10px] mt-0.5">
                                Over Limit
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={r.outstanding > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                            ₹{Math.abs(r.outstanding).toLocaleString('en-IN')}
                          </span>
                          {r.outstanding < 0 && (
                            <span className="text-xs text-green-500 block">Advance</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {r.credit_limit > 0 ? `₹${r.credit_limit.toLocaleString('en-IN')}` : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.last_payment_date || '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={e => {
                              e.stopPropagation();
                              navigate(`/distributor-portal/collect-payment?retailer=${r.retailer_id}`);
                            }}
                          >
                            <IndianRupee className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RetailerLedger;
