import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Truck, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Van reconciliation.
 *
 * Under Option B2 the van keeps its own inventory and the DMS learns about it
 * through postings, so the two can disagree. This is the screen that shows when
 * they do -- and, just as importantly, which days have never posted at all.
 *
 * It will look bad at first. Most van-days in this system have never been
 * closed and no returns have ever been recorded, so they cannot post. That is
 * the screen working.
 */

interface Row {
  van_stock_id: string;
  stock_date: string;
  van_id: string;
  van_registration: string | null;
  rep_name: string | null;
  status: string | null;
  loaded: number;
  sold: number;
  returned_good: number;
  returned_damaged: number;
  returned_expired: number;
  counted: number | null;
  expected: number;
  variance: number | null;
  variance_reason: string | null;
  lines: number;
  lines_counted: number;
  settled_at: string | null;
}

const PERIODS: { value: string; label: string; days: number | null }[] = [
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '90', label: 'Last 90 days', days: 90 },
  { value: 'all', label: 'All time', days: null },
];

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const VanReconciliation = () => {
  const distributorId = localStorage.getItem('distributor_id');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');
  const [onlyProblems, setOnlyProblems] = useState(false);

  const load = async () => {
    if (!distributorId) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    const days = PERIODS.find((p) => p.value === period)?.days ?? null;
    const from = days === null
      ? null
      : new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    const { data, error: rpcError } = await supabase.rpc('dms_van_reconciliation' as any, {
      p_distributor: distributorId,
      p_from: from,
      p_to: null,
    });

    if (rpcError) {
      setError(rpcError.message);
      setRows([]);
    } else {
      setRows((data as unknown as Row[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [distributorId, period]);

  /** A day is a problem if it has an unexplained variance, or never posted. */
  const isProblem = (r: Row) =>
    (r.variance !== null && Number(r.variance) !== 0 && !r.variance_reason) ||
    r.settled_at === null;

  const visible = useMemo(
    () => (onlyProblems ? rows.filter(isProblem) : rows),
    [rows, onlyProblems],
  );

  const summary = useMemo(() => ({
    days: rows.length,
    unsettled: rows.filter((r) => r.settled_at === null).length,
    uncounted: rows.filter((r) => r.lines_counted === 0).length,
    unexplained: rows.filter(
      (r) => r.variance !== null && Number(r.variance) !== 0 && !r.variance_reason,
    ).length,
  }), [rows]);

  if (!distributorId) {
    return <div className="py-12 text-center text-muted-foreground">No distributor selected.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="bg-slate-800 text-white rounded-lg px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Truck className="w-5 h-5" /> Van Reconciliation
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px] h-8 text-xs bg-slate-700 border-slate-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm" variant={onlyProblems ? 'default' : 'outline'}
            className={cn('h-8 text-xs', !onlyProblems && 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600')}
            onClick={() => setOnlyProblems((v) => !v)}
          >
            Needs attention
          </Button>
          <Button
            size="sm" variant="outline"
            className="h-8 text-xs bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            onClick={load} disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      {/* Counts that say where to look, rather than a single total nobody can act on */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg px-4 py-2.5 bg-slate-100 text-slate-700 flex items-center gap-3 min-w-[160px]">
          <span className="text-sm font-medium opacity-90">Van days</span>
          <span className="text-xl font-bold ml-auto">{summary.days}</span>
        </div>
        <div className="rounded-lg px-4 py-2.5 bg-blue-100 text-blue-800 flex items-center gap-3 min-w-[160px]">
          <span className="text-sm font-medium opacity-90">Not posted</span>
          <span className="text-xl font-bold ml-auto">{summary.unsettled}</span>
        </div>
        <div className="rounded-lg px-4 py-2.5 bg-amber-100 text-amber-800 flex items-center gap-3 min-w-[160px]">
          <span className="text-sm font-medium opacity-90">Never counted</span>
          <span className="text-xl font-bold ml-auto">{summary.uncounted}</span>
        </div>
        <div className="rounded-lg px-4 py-2.5 bg-red-100 text-red-800 flex items-center gap-3 min-w-[160px]">
          <span className="text-sm font-medium opacity-90">Unexplained</span>
          <span className="text-xl font-bold ml-auto">{summary.unexplained}</span>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-destructive/40 bg-destructive/5 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Could not load reconciliation</div>
            <div className="text-muted-foreground text-xs mt-0.5">{error}</div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Van</TableHead>
                <TableHead className="text-xs">Rep</TableHead>
                <TableHead className="text-xs text-right">Loaded</TableHead>
                <TableHead className="text-xs text-right">Sold</TableHead>
                <TableHead className="text-xs text-right">Ret. good</TableHead>
                <TableHead className="text-xs text-right">Ret. damaged</TableHead>
                <TableHead className="text-xs text-right">Ret. expired</TableHead>
                <TableHead className="text-xs text-right">Counted</TableHead>
                <TableHead className="text-xs text-right">Variance</TableHead>
                <TableHead className="text-xs">Day</TableHead>
                <TableHead className="text-xs">Posted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                    {rows.length === 0
                      ? 'No van days for this period.'
                      : 'Nothing needs attention in this period.'}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((r) => {
                  const variance = r.variance === null ? null : Number(r.variance);
                  const unexplained = variance !== null && variance !== 0 && !r.variance_reason;
                  return (
                    <TableRow key={r.van_stock_id} className={cn(unexplained && 'bg-destructive/5')}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(r.stock_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </TableCell>
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        {r.van_registration || '-'}
                      </TableCell>
                      <TableCell className="text-xs">{r.rep_name || '-'}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(r.loaded)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(r.sold)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(r.returned_good)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(r.returned_damaged)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(r.returned_expired)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">
                        {r.lines_counted === 0
                          ? <span className="text-muted-foreground italic">not counted</span>
                          : fmt(r.counted)}
                      </TableCell>
                      <TableCell className={cn(
                        'text-xs text-right tabular-nums font-semibold',
                        variance === null ? 'text-muted-foreground'
                          : variance === 0 ? 'text-green-700' : 'text-destructive',
                      )}>
                        {/* A day nobody counted shows a dash, not a zero: "it
                            balanced" and "nobody looked" are different facts. */}
                        {variance === null ? '-' : `${variance > 0 ? '+' : ''}${fmt(variance)}`}
                        {r.variance_reason && (
                          <div className="text-[10px] font-normal text-muted-foreground">
                            {r.variance_reason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={r.status === 'closing_verified' ? 'default' : 'secondary'}
                               className="text-[10px] font-normal">
                          {r.status === 'closing_verified' ? 'Closed' : 'Open'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {r.settled_at
                          ? new Date(r.settled_at).toLocaleString('en-IN',
                              { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        A day posts to your inventory once it is closed and settled. Days shown as not posted have
        not reached your stock figures yet.
      </p>
    </div>
  );
};

export default VanReconciliation;
