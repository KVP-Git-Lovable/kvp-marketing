import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FileText, Plus, Search, Download, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface OutletContext {
  user: { id: string; full_name: string; role: string; distributor_id: string };
  distributorId: string;
}

const SecondaryInvoiceList = () => {
  const navigate = useNavigate();
  const { distributorId } = useOutletContext<OutletContext>();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (distributorId) loadInvoices();
  }, [distributorId]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('distributor_secondary_invoices')
        .select('*, retailers(name)')
        .eq('distributor_id', distributorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const filtered = invoices.filter(inv =>
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    (inv.retailers?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalOutstanding = invoices.reduce((s, inv) => s + Number(inv.balance_due || 0), 0);
  const totalInvoiced = invoices.reduce((s, inv) => s + Number(inv.total_amount || 0), 0);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      issued: { label: 'Issued', className: 'bg-blue-100 text-blue-700' },
      paid: { label: 'Paid', className: 'bg-green-100 text-green-700' },
      partial: { label: 'Partial', className: 'bg-yellow-100 text-yellow-700' },
      cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
    };
    const c = config[status] || { label: status, className: 'bg-muted text-muted-foreground' };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Secondary Invoices</h1>
          <p className="text-sm text-muted-foreground">{invoices.length} invoices</p>
        </div>
        <Button onClick={() => navigate('/distributor-portal/secondary-invoices/create')}>
          <Plus className="h-4 w-4 mr-1" /> New Invoice
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Invoiced</p>
            <p className="text-lg font-bold">₹{totalInvoiced.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-lg font-bold text-destructive">₹{totalOutstanding.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search invoices..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <Card><CardContent className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No invoices found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => (
            <Card key={inv.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{inv.invoice_number}</span>
                      {getStatusBadge(inv.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{inv.retailers?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(inv.invoice_date), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">₹{Number(inv.total_amount).toLocaleString('en-IN')}</p>
                    {Number(inv.balance_due) > 0 && (
                      <p className="text-xs text-destructive">Due: ₹{Number(inv.balance_due).toLocaleString('en-IN')}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SecondaryInvoiceList;
