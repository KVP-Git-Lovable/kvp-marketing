import { useState, useEffect } from 'react';
import { fullNameProps } from "@/lib/displayName";
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, IndianRupee, CheckCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface OutletContext {
  user: { id: string; full_name: string; role: string; distributor_id: string };
  distributorId: string;
}

interface RetailerOption {
  id: string;
  name: string;
  outstanding: number;
}

const CollectPayment = () => {
  const { user, distributorId } = useOutletContext<OutletContext>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedRetailer = searchParams.get('retailer');

  const [retailers, setRetailers] = useState<RetailerOption[]>([]);
  const [retailerSearch, setRetailerSearch] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState<string>(preselectedRetailer || '');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [loadingRetailers, setLoadingRetailers] = useState(true);

  useEffect(() => {
    if (distributorId) loadRetailers();
  }, [distributorId]);

  const loadRetailers = async () => {
    setLoadingRetailers(true);
    try {
      // Get all retailers linked to this distributor via ledger or secondary orders
      const { data: ledgerRetailers } = await supabase
        .from('distributor_retailer_ledger')
        .select('retailer_id, debit_amount, credit_amount')
        .eq('distributor_id', distributorId);

      const retailerIds = [...new Set((ledgerRetailers || []).map(l => l.retailer_id))];

      // Also get retailers from beats/territory
      const { data: allRetailers } = await supabase
        .from('retailers')
        .select('id, name')
        .order('name');

      // Calculate outstanding per retailer
      const outstandingMap: Record<string, number> = {};
      (ledgerRetailers || []).forEach(e => {
        outstandingMap[e.retailer_id] = (outstandingMap[e.retailer_id] || 0) + Number(e.debit_amount) - Number(e.credit_amount);
      });

      const result: RetailerOption[] = (allRetailers || []).map(r => ({
        id: r.id,
        name: r.name,
        outstanding: outstandingMap[r.id] || 0,
      }));

      // Sort: retailers with outstanding first
      result.sort((a, b) => b.outstanding - a.outstanding);
      setRetailers(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRetailers(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedRetailer) return toast.error('Select a retailer');
    if (!amount || Number(amount) <= 0) return toast.error('Enter a valid amount');

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('distributor_payments')
        .insert({
          distributor_id: distributorId,
          retailer_id: selectedRetailer,
          payment_date: paymentDate,
          amount: Number(amount),
          payment_mode: paymentMode,
          reference_number: referenceNumber || null,
          cheque_number: chequeNumber || null,
          cheque_date: chequeDate || null,
          bank_name: bankName || null,
          notes: notes || null,
          created_by: user.full_name,
        })
        .select('receipt_number')
        .single();

      if (error) throw error;
      setReceiptNumber(data.receipt_number || '');
      setSuccess(true);
      toast.success('Payment recorded successfully');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const selectedRetailerData = retailers.find(r => r.id === selectedRetailer);
  const filteredRetailers = retailers.filter(r =>
    r.name.toLowerCase().includes(retailerSearch.toLowerCase())
  ).slice(0, 50);

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <div>
              <h2 className="text-xl font-bold">Payment Recorded!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Receipt: <span className="font-mono font-semibold">{receiptNumber}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                ₹{Number(amount).toLocaleString('en-IN')} from {selectedRetailerData?.name}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => {
                setSuccess(false);
                setAmount('');
                setReferenceNumber('');
                setChequeNumber('');
                setChequeDate('');
                setBankName('');
                setNotes('');
              }}>
                Collect Another
              </Button>
              <Button className="flex-1" onClick={() => navigate('/distributor-portal/retailer-ledger')}>
                View Ledger
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Collect Payment</h1>
          <p className="text-sm text-muted-foreground">Record payment from retailer</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* Retailer Selection */}
          <div className="space-y-2">
            <Label>Retailer *</Label>
            <Select value={selectedRetailer} onValueChange={setSelectedRetailer}>
              <SelectTrigger>
                <SelectValue placeholder="Select retailer" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 pb-2">
                  <Input
                    placeholder="Search..."
                    value={retailerSearch}
                    onChange={e => setRetailerSearch(e.target.value)}
                    className="h-8"
                  />
                </div>
                {filteredRetailers.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span {...fullNameProps(r.name)} />
                      {r.outstanding > 0 && (
                        <span className="text-xs text-red-500">₹{r.outstanding.toLocaleString('en-IN')}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRetailerData && selectedRetailerData.outstanding > 0 && (
              <p className="text-xs text-red-500">
                Outstanding: ₹{selectedRetailerData.outstanding.toLocaleString('en-IN')}
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount *</Label>
            <div className="relative">
              <IndianRupee className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
            />
          </div>

          {/* Payment Mode */}
          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="neft">NEFT</SelectItem>
                <SelectItem value="rtgs">RTGS</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Cheque Fields */}
          {paymentMode === 'cheque' && (
            <div className="space-y-3 pl-3 border-l-2 border-muted">
              <div className="space-y-2">
                <Label>Cheque Number</Label>
                <Input value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} placeholder="Enter cheque number" />
              </div>
              <div className="space-y-2">
                <Label>Cheque Date</Label>
                <Input type="date" value={chequeDate} onChange={e => setChequeDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank name" />
              </div>
            </div>
          )}

          {/* Reference Number (for UPI/NEFT/RTGS/Online) */}
          {['upi', 'neft', 'rtgs', 'online'].includes(paymentMode) && (
            <div className="space-y-2">
              <Label>Transaction Reference</Label>
              <Input
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
                placeholder="UTR / Transaction ID"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional remarks..."
              rows={2}
            />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Recording...' : `Record Payment${amount ? ` — ₹${Number(amount).toLocaleString('en-IN')}` : ''}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CollectPayment;
