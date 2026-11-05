import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import {
  QTY_TONE_CLASS,
  formatInventoryQuantity,
  getInventoryMovementTarget,
  getInventoryTransactionTypeLabel,
  resolveInventoryTransactionType,
} from './transactionDisplay';

interface Transaction {
  id: string;
  reference_type?: string | null;
  transaction_type?: string | null;
  batch_number?: string | null;
  quantity: number;
  notes: string | null;
  created_at: string;
  product_name?: string | null;
  product_id?: string | null;
  unit?: string | null;
}

interface RecentTransactionsPanelProps {
  transactions: Transaction[];
  loading?: boolean;
  /**
   * Why the list could not be loaded.
   *
   * Distinct from an empty list on purpose. A rejected query used to land
   * here as zero rows and read as "nothing moved today", which is the most
   * reassuring thing this panel can say and was the opposite of the truth.
   */
  error?: string | null;
}

const RecentTransactionsPanel = ({ transactions, loading, error }: RecentTransactionsPanelProps) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-destructive">Could not load recent transactions</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No recent transactions</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Details</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Qty</th>
                  <th className="text-center px-2 py-2"></th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Movement</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(txn => {
                  const txnType = resolveInventoryTransactionType(txn);
                  const target = getInventoryMovementTarget(txnType, txn.quantity);
                  const qty = formatInventoryQuantity(txn.quantity, txn.unit);

                  return (
                    <tr key={txn.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {format(new Date(txn.created_at), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {(txn.product_name || txn.product_id) && <span className="text-xs text-muted-foreground block">{txn.product_name || txn.product_id}</span>}
                        {getInventoryTransactionTypeLabel(txnType)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`font-semibold ${QTY_TONE_CLASS[qty.tone]}`}>
                          {qty.text}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center text-muted-foreground">
                        <ArrowRight className="w-4 h-4 inline-block" />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${target.color}`} />
                          <span className="font-medium">{target.label}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentTransactionsPanel;
