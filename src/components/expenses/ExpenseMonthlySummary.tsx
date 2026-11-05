import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Car, Utensils, Receipt, IndianRupee, CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { fetchExpenseConfigs, resolveExpenseConfig, fetchUserManagerId } from '@/hooks/useResolvedExpenseConfig';

interface MonthlySummary {
  ta: number;
  da: number;
  additionalTotal: number;
  additionalApproved: number;
  additionalPending: number;
  additionalRejected: number;
  grandTotal: number;
  presentDays: number;
}

const ExpenseMonthlySummary = () => {
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy') };
  });

  useEffect(() => {
    fetchMonthlySummary();
  }, [selectedMonth]);

  const fetchMonthlySummary = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [year, month] = selectedMonth.split('-').map(Number);
      const start = startOfMonth(new Date(year, month - 1));
      const end = endOfMonth(start);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      // Fetch all configs + manager + data in parallel
      const [{ globalConfig, userConfigMap, teamConfigMap, userGroupConfigMap }, managerId, attendanceRes, beatPlansRes, allowancesRes, additionalRes] = await Promise.all([
        fetchExpenseConfigs(),
        fetchUserManagerId(user.id),
        supabase.from('attendance').select('date, status')
          .eq('user_id', user.id).gte('date', startStr).lte('date', endStr),
        supabase.from('beat_plans').select('plan_date, beat_id')
          .eq('user_id', user.id).gte('plan_date', startStr).lte('plan_date', endStr),
        supabase.from('beats').select('beat_id, travel_allowance, average_km'),
        (supabase as any).from('additional_expenses').select('amount, status')
          .eq('user_id', user.id).gte('expense_date', startStr).lte('expense_date', endStr),
      ]);

      // Resolve config with hierarchy
      const config = resolveExpenseConfig(user.id, managerId, globalConfig, userConfigMap, teamConfigMap, userGroupConfigMap);
      const daAmount = config.da_amount;
      const taType = config.ta_type;
      const fixedTa = config.fixed_ta_amount;
      const taPerKmRate = config.ta_per_km_rate;

      // Count present days (include regularized)
      const presentDays = attendanceRes.data?.filter(a => ['present', 'regularized'].includes(a.status)).length || 0;
      const da = presentDays * daAmount;

      // Calculate TA - uses per-km rate if configured, handles multiple beats per day
      let ta = 0;
      if (taType === 'fixed') {
        ta = presentDays * fixedTa;
      } else {
        // Build beat TA map with per-km rate support
        const beatTAMap = new Map<string, number>();
        allowancesRes.data?.forEach((b: any) => {
          const km = b.average_km || 0;
          const beatFixedTA = b.travel_allowance || 0;
          const beatTA = (taPerKmRate > 0 && km > 0) ? (km * taPerKmRate) : beatFixedTA;
          beatTAMap.set(b.beat_id, beatTA);
        });
        
        const presentDates = new Set(attendanceRes.data?.filter(a => ['present', 'regularized'].includes(a.status)).map(a => a.date));
        ta = beatPlansRes.data?.reduce((sum: number, plan: any) => {
          if (presentDates.has(plan.plan_date)) {
            return sum + (beatTAMap.get(plan.beat_id) || 0);
          }
          return sum;
        }, 0) || 0;
      }

      // Additional expenses breakdown
      const additional = additionalRes.data || [];
      const additionalApproved = additional
        .filter((e: any) => ['manager_approved', 'paid'].includes(e.status))
        .reduce((s: number, e: any) => s + (e.amount || 0), 0);
      const additionalPending = additional
        .filter((e: any) => ['submitted', 'draft'].includes(e.status))
        .reduce((s: number, e: any) => s + (e.amount || 0), 0);
      const additionalRejected = additional
        .filter((e: any) => e.status === 'rejected')
        .reduce((s: number, e: any) => s + (e.amount || 0), 0);
      const additionalTotal = additional.reduce((s: number, e: any) => s + (e.amount || 0), 0);

      setSummary({
        ta, da,
        additionalTotal, additionalApproved, additionalPending, additionalRejected,
        grandTotal: ta + da + additionalApproved,
        presentDays,
      });
    } catch (error) {
      console.error('Error fetching monthly summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <Card>
      <CardHeader className="pb-3 px-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-lg">Monthly Summary</CardTitle>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : summary ? (
          <div className="space-y-3">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <Car className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">TA</p>
                  <p className="text-sm font-bold text-blue-600">{fmt(summary.ta)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <Utensils className="h-4 w-4 text-green-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">DA ({summary.presentDays} days)</p>
                  <p className="text-sm font-bold text-green-600">{fmt(summary.da)}</p>
                </div>
              </div>
            </div>

            {/* Additional expenses with status */}
            <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-4 w-4 text-purple-600 shrink-0" />
                <p className="text-xs font-medium">Additional Expenses</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-[10px] gap-1 border-green-300 text-green-700">
                  <CheckCircle className="h-3 w-3" /> Approved: {fmt(summary.additionalApproved)}
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1 border-yellow-300 text-yellow-700">
                  <Clock className="h-3 w-3" /> Pending: {fmt(summary.additionalPending)}
                </Badge>
                {summary.additionalRejected > 0 && (
                  <Badge variant="outline" className="text-[10px] gap-1 border-red-300 text-red-700">
                    <XCircle className="h-3 w-3" /> Rejected: {fmt(summary.additionalRejected)}
                  </Badge>
                )}
              </div>
            </div>

            {/* Grand Total */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Total (Approved)</span>
              </div>
              <span className="text-lg font-bold text-primary">{fmt(summary.grandTotal)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ExpenseMonthlySummary;
