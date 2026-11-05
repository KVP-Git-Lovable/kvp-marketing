import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, RefreshCw, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Allocation {
  // present on payment rows: which invoice this payment cleared
  order_id?: string;
  invoice_number?: string;
  order_date?: string;
  // present on order rows: which collection settled it
  collection_id?: string;
  paid_at?: string;
  payment_method?: string;
  amount: number;
}

interface LedgerRow {
  entry_at: string;
  entry_type: 'order' | 'payment';
  reference: string | null;
  detail: string | null;
  debit: number;
  credit: number;
  running_balance: number;
  payment_method: string | null;
  order_id: string | null;
  collection_id: string | null;
  order_status: string | null;
  payment_status: string | null;
  is_credit_order: boolean | null;
  allocations: Allocation[] | null;
  order_paid: number | null;
  order_pending: number | null;
}

const money = (n: number) =>
  `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

const dayOf = (iso: string) => format(new Date(iso), 'yyyy-MM-dd');

/**
 * A collection that only settles orders raised the same day is the second half
 * of a single visit — the rep billed and collected in one go. Showing it as its
 * own row is what made the ledger look like it recorded every sale twice, so it
 * is folded into the order line instead.
 *
 * A collection that reaches back to an earlier invoice is a genuinely separate
 * event (the retailer clearing dues on a later visit) and keeps its own row,
 * captioned with the invoices it cleared.
 *
 * Needs get_retailer_payment_ledger to return `allocations`, which in turn needs
 * reconcile_retailer_account to record them. Both landed 2026-09-10.
 */
function isSameVisitSettlement(row: LedgerRow): boolean {
  if (row.entry_type !== 'payment') return false;
  const allocs = row.allocations ?? [];
  if (allocs.length === 0) return false;          // advance money — always show
  const payDay = dayOf(row.entry_at);
  return allocs.every((a) => a.order_date && dayOf(a.order_date) === payDay);
}

type Tone = 'success' | 'warning' | 'muted';

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  muted: 'bg-muted text-muted-foreground',
};

function orderStatus(row: LedgerRow): { label: string; tone: Tone } {
  if (row.is_credit_order === false) return { label: 'Cash order', tone: 'muted' };
  const paid = Math.round(Number(row.order_paid ?? 0));
  const pending = Math.round(Number(row.order_pending ?? 0));
  if (pending <= 0 && paid > 0) return { label: 'Paid', tone: 'success' };
  if (paid > 0 && pending > 0) return { label: `Part paid · ${money(pending)} left`, tone: 'warning' };
  return { label: 'On credit', tone: 'warning' };
}

/** "cash" / "cash, upi" — how an order was settled, from its allocations. */
function methodsUsed(row: LedgerRow): string {
  const set = new Set(
    (row.allocations ?? []).map((a) => a.payment_method).filter(Boolean) as string[],
  );
  return Array.from(set).join(', ');
}

/** "INV2026-368, INV2026-376" — what a payment cleared. */
function invoicesCleared(row: LedgerRow): string {
  const allocs = row.allocations ?? [];
  if (allocs.length === 0) return 'Advance — not against an invoice';
  const names = allocs.map((a) => a.invoice_number).filter(Boolean) as string[];
  if (names.length <= 2) return `Against ${names.join(', ')}`;
  return `Against ${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}

export function PaymentLedgerTab({ retailerId }: { retailerId: string }) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc(
        'get_retailer_payment_ledger' as any,
        { p_retailer_id: retailerId },
      );
      if (error) throw error;
      setRows((data as unknown as LedgerRow[]) ?? []);
    } catch (e: any) {
      // The RPC raises its own permission message — surface it verbatim.
      setError(e?.message ?? 'Could not load the payment ledger');
    } finally {
      setLoading(false);
    }
  }, [retailerId]);

  useEffect(() => { if (retailerId) load(); }, [retailerId, load]);

  const summary = useMemo(() => {
    const billed = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
    const received = rows.reduce((s, r) => s + Number(r.credit || 0), 0);
    const closing = rows.length ? Number(rows[rows.length - 1].running_balance) : 0;
    return { billed, received, closing };
  }, [rows]);

  // Newest first, and same-visit collections folded into their order line.
  const visible = useMemo(
    () => rows.filter((r) => !isSameVisitSettlement(r)).slice().reverse(),
    [rows],
  );
  const foldedCount = rows.length - visible.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
        {error}
      </CardContent></Card>
    );
  }

  if (!rows.length) {
    return (
      <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
        No orders or payments recorded for this retailer yet.
      </CardContent></Card>
    );
  }

  const closingLabel = summary.closing < 0 ? 'Advance held' : 'Outstanding';
  const closingClass = summary.closing > 0 ? 'text-amber-600'
    : summary.closing < 0 ? 'text-blue-600' : '';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Card className={`col-span-2 sm:col-span-1 sm:order-3 ${summary.closing > 0 ? 'border-amber-400' : ''}`}>
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">{closingLabel}</div>
            <div className={`text-2xl sm:text-lg font-bold tabular-nums ${closingClass}`}>
              {money(Math.abs(summary.closing))}
            </div>
          </CardContent>
        </Card>
        <Card><CardContent className="p-3">
          <div className="text-[11px] text-muted-foreground">Billed on credit</div>
          <div className="text-lg font-bold tabular-nums">{money(summary.billed)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[11px] text-muted-foreground">Payments received</div>
          <div className="text-lg font-bold tabular-nums text-emerald-600">
            {money(summary.received)}
          </div>
        </CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>

      {/* Mobile */}
      <div className="space-y-2 sm:hidden">
        {visible.map((r, i) => {
          const isPayment = r.entry_type === 'payment';
          const st = isPayment ? null : orderStatus(r);
          const methods = isPayment ? '' : methodsUsed(r);
          return (
            <div key={`${r.entry_type}-${r.order_id ?? r.collection_id}-${i}`}
                 className={`rounded-lg border px-3 py-2.5 ${isPayment ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{format(new Date(r.entry_at), 'dd MMM yy')}</span>
                {!isPayment && r.reference && (
                  <span className="font-mono text-[11px] text-muted-foreground truncate">{r.reference}</span>
                )}
                <span className={`ml-auto text-base font-semibold tabular-nums ${
                  isPayment ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                  {isPayment ? `−${money(r.credit)}` : money(r.debit)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {isPayment ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                      <ArrowDownCircle className="h-3 w-3" />
                      Payment{r.payment_method ? ` · ${r.payment_method}` : ''}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{invoicesCleared(r)}</span>
                  </>
                ) : (
                  <>
                    <span className={`rounded px-2 py-0.5 text-[11px] ${TONE_CLASS[st!.tone]}`}>{st!.label}</span>
                    {methods && <span className="text-[11px] text-muted-foreground">{methods}</span>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop. No overflow wrapper — an overflow ancestor becomes the sticky
          containing block and the header would stop pinning to the modal body. */}
      <table className="hidden w-full caption-bottom text-sm sm:table">
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead className="whitespace-nowrap">Date</TableHead>
            <TableHead>Entry</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((r, i) => {
            const isPayment = r.entry_type === 'payment';
            const st = isPayment ? null : orderStatus(r);
            const methods = isPayment ? '' : methodsUsed(r);
            return (
              <TableRow key={`${r.entry_type}-${r.order_id ?? r.collection_id}-${i}`}
                        className={isPayment ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}>
                <TableCell className="text-xs whitespace-nowrap">
                  {format(new Date(r.entry_at), 'dd MMM yy')}
                </TableCell>
                <TableCell className="text-xs">
                  <span className="inline-flex items-center gap-1">
                    {isPayment
                      ? <ArrowDownCircle className="h-3 w-3 text-emerald-600" />
                      : <ArrowUpCircle className="h-3 w-3 text-muted-foreground" />}
                    {isPayment ? 'Payment' : 'Order'}
                  </span>
                  {isPayment && r.payment_method && (
                    <Badge variant="outline" className="ml-1 text-[10px] capitalize">{r.payment_method}</Badge>
                  )}
                  {!isPayment && (
                    <Badge variant="outline" className={`ml-1 text-[10px] ${TONE_CLASS[st!.tone]}`}>{st!.label}</Badge>
                  )}
                  {!isPayment && methods && (
                    <span className="ml-1 text-[10px] capitalize text-muted-foreground">{methods}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {isPayment
                    ? <span className="text-muted-foreground">{invoicesCleared(r)}</span>
                    : <span className="font-mono">{r.reference || '—'}</span>}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {isPayment ? `−${money(r.credit)}` : (Number(r.debit) ? money(r.debit) : '—')}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums text-emerald-700">
                  {isPayment ? money(r.credit) : (Number(r.order_paid) ? money(r.order_paid!) : '—')}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums font-semibold">
                  {isPayment ? '—' : (
                    <span className={Number(r.order_pending) > 0 ? 'text-amber-700' : ''}>
                      {money(r.order_pending ?? 0)}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </table>

      <p className="text-[11px] text-muted-foreground">
        {foldedCount > 0 && (
          <>Orders billed and collected on the same visit show as one line. </>
        )}
        A payment made on a later visit gets its own line, captioned with the invoices it cleared.
        Cash orders are listed for history but do not add to the balance.
      </p>
    </div>
  );
}
