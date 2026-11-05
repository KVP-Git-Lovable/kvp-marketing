import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Plus, 
  Receipt, 
  FileText, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  IndianRupee,
  Search,
  Upload,
  Truck,
  Package
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Claim {
  id: string;
  claim_number: string;
  claim_type: string;
  claim_date: string;
  claim_amount: number;
  approved_amount: number;
  status: string;
  description: string;
  expense_category?: string;
  reference_number?: string;
  review_notes?: string;
  created_at: string;
}

const claimTypes = [
  { value: 'expense', label: 'Expense Claim', icon: Receipt, description: 'Transportation, marketing, promotional costs' },
  { value: 'damage_return', label: 'Damage/Return', icon: AlertTriangle, description: 'Damaged goods, expired stock returns' },
  { value: 'scheme_claim', label: 'Scheme Claim', icon: FileText, description: 'Target achievement, scheme fulfillment' },
  { value: 'credit_note', label: 'Credit Note', icon: IndianRupee, description: 'Billing adjustments, price corrections' },
];

const expenseCategories = [
  { value: 'transportation', label: 'Transportation' },
  { value: 'marketing', label: 'Marketing & Promotion' },
  { value: 'logistics', label: 'Logistics & Handling' },
  { value: 'other', label: 'Other' },
];

const DistributorClaims = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewClaimDialog, setShowNewClaimDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [claimType, setClaimType] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [kmTraveled, setKmTraveled] = useState('');
  const [damageReason, setDamageReason] = useState('');
  const [schemeName, setSchemeName] = useState('');

  const distributorId = localStorage.getItem('distributor_id');

  useEffect(() => {
    if (!distributorId) {
      navigate('/distributor-portal/login');
      return;
    }
    loadClaims();
  }, [distributorId, navigate]);

  const loadClaims = async () => {
    try {
      const { data, error } = await supabase
        .from('distributor_claims')
        .select('*')
        .eq('distributor_id', distributorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClaims(data || []);
    } catch (error) {
      console.error('Error loading claims:', error);
      toast.error('Failed to load claims');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitClaim = async () => {
    if (!claimType || !claimAmount || !description) {
      toast.error('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('distributor_claims')
        .insert({
          distributor_id: distributorId,
          claim_type: claimType,
          claim_amount: parseFloat(claimAmount),
          description,
          expense_category: claimType === 'expense' ? expenseCategory : null,
          reference_number: referenceNumber || null,
          expense_date: expenseDate || null,
          vehicle_number: claimType === 'expense' ? vehicleNumber : null,
          km_traveled: claimType === 'expense' && kmTraveled ? parseFloat(kmTraveled) : null,
          damage_reason: claimType === 'damage_return' ? damageReason : null,
          scheme_name: claimType === 'scheme_claim' ? schemeName : null,
        } as any);

      if (error) throw error;

      toast.success('Claim submitted successfully');
      setShowNewClaimDialog(false);
      resetForm();
      loadClaims();
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast.error('Failed to submit claim');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setClaimType('');
    setClaimAmount('');
    setDescription('');
    setExpenseCategory('');
    setReferenceNumber('');
    setExpenseDate('');
    setVehicleNumber('');
    setKmTraveled('');
    setDamageReason('');
    setSchemeName('');
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any }> = {
      pending: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      under_review: { color: 'bg-blue-100 text-blue-700', icon: FileText },
      approved: { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
      rejected: { color: 'bg-red-100 text-red-700', icon: XCircle },
      paid: { color: 'bg-emerald-100 text-emerald-700', icon: IndianRupee },
    };
    const cfg = config[status] || config.pending;
    const Icon = cfg.icon;
    return (
      <Badge className={`${cfg.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getClaimTypeIcon = (type: string) => {
    const found = claimTypes.find(t => t.value === type);
    return found ? found.icon : Receipt;
  };

  const filteredClaims = claims.filter(claim => {
    const matchesSearch = claim.claim_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: claims.length,
    pending: claims.filter(c => c.status === 'pending').length,
    approved: claims.filter(c => c.status === 'approved' || c.status === 'paid').length,
    totalAmount: claims.reduce((sum, c) => sum + (c.claim_amount || 0), 0),
    approvedAmount: claims.filter(c => c.status === 'approved' || c.status === 'paid')
      .reduce((sum, c) => sum + (c.approved_amount || c.claim_amount || 0), 0),
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <header className="sticky-header-safe z-50 bg-card border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/distributor-portal/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-foreground">Claims & Expenses</h1>
              <p className="text-xs text-muted-foreground">{claims.length} claims</p>
            </div>
          </div>
          <Button onClick={() => setShowNewClaimDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Claim
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total Claims</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-lg font-bold text-yellow-600">{stats.pending}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Claimed</p>
                <p className="text-lg font-bold">₹{stats.totalAmount.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Approved</p>
                <p className="text-lg font-bold text-green-600">₹{stats.approvedAmount.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search claims..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Claims List */}
        {filteredClaims.length === 0 ? (
          <Card className="p-8 text-center">
            <Receipt className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No claims found</p>
            <Button onClick={() => setShowNewClaimDialog(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Submit Your First Claim
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredClaims.map((claim) => {
              const Icon = getClaimTypeIcon(claim.claim_type);
              return (
                <Card key={claim.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{claim.claim_number}</h3>
                            {getStatusBadge(claim.status)}
                          </div>
                          <p className="text-sm text-muted-foreground capitalize">
                            {claim.claim_type.replace('_', ' ')}
                            {claim.expense_category && ` • ${claim.expense_category}`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(claim.claim_date), 'dd MMM yyyy')}
                          </p>
                          {claim.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {claim.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">₹{claim.claim_amount.toLocaleString('en-IN')}</p>
                        {claim.approved_amount > 0 && claim.status !== 'pending' && (
                          <p className="text-sm text-green-600">
                            Approved: ₹{claim.approved_amount.toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>
                    {claim.review_notes && (
                      <div className="mt-3 p-2 bg-muted rounded text-sm">
                        <span className="font-medium">Review Notes:</span> {claim.review_notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* New Claim Dialog */}
      <Dialog open={showNewClaimDialog} onOpenChange={setShowNewClaimDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit New Claim</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Claim Type Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Claim Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {claimTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <Card 
                      key={type.value}
                      className={`p-3 cursor-pointer transition-all ${
                        claimType === type.value 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:border-muted-foreground/30'
                      }`}
                      onClick={() => setClaimType(type.value)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${claimType === type.value ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium">{type.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-sm font-medium mb-1 block">Claim Amount (₹) *</label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
              />
            </div>

            {/* Expense-specific fields */}
            {claimType === 'expense' && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">Expense Category</label>
                  <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Vehicle Number</label>
                    <Input
                      placeholder="e.g., KA01XX1234"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">KM Traveled</label>
                    <Input
                      type="number"
                      placeholder="Distance"
                      value={kmTraveled}
                      onChange={(e) => setKmTraveled(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Damage-specific fields */}
            {claimType === 'damage_return' && (
              <div>
                <label className="text-sm font-medium mb-1 block">Damage Reason</label>
                <Textarea
                  placeholder="Describe the damage or return reason..."
                  value={damageReason}
                  onChange={(e) => setDamageReason(e.target.value)}
                />
              </div>
            )}

            {/* Scheme-specific fields */}
            {claimType === 'scheme_claim' && (
              <div>
                <label className="text-sm font-medium mb-1 block">Scheme Name</label>
                <Input
                  placeholder="Enter scheme name"
                  value={schemeName}
                  onChange={(e) => setSchemeName(e.target.value)}
                />
              </div>
            )}

            {/* Reference Number */}
            <div>
              <label className="text-sm font-medium mb-1 block">Reference Number</label>
              <Input
                placeholder="Invoice/Order number (optional)"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium mb-1 block">Description *</label>
              <Textarea
                placeholder="Provide details about your claim..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNewClaimDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitClaim} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Claim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DistributorClaims;
