import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Receipt, Building, Calendar, CheckCircle2, XCircle, Clock, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Claim {
  id: string;
  claim_number: string;
  claim_type: string;
  claim_date: string;
  claim_amount: number;
  approved_amount: number;
  status: string;
  description: string;
  distributor_id: string;
  distributor_name?: string;
  created_at: string;
}

interface PortalClaimsTabProps {
  searchQuery: string;
}

export const PortalClaimsTab = ({ searchQuery }: PortalClaimsTabProps) => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [distributorFilter, setDistributorFilter] = useState('all');
  const [distributors, setDistributors] = useState<{ id: string; name: string }[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: distributorData } = await supabase
        .from('distributors')
        .select('id, name')
        .order('name');
      
      setDistributors(distributorData || []);

      const { data: claimsData, error } = await supabase
        .from('distributor_claims')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const claimsWithDistributors = (claimsData || []).map(claim => ({
        ...claim,
        distributor_name: distributorData?.find(d => d.id === claim.distributor_id)?.name || 'Unknown'
      }));

      setClaims(claimsWithDistributors);
    } catch (error) {
      console.error('Error loading claims:', error);
      toast.error('Failed to load claims');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedClaim) return;
    
    setProcessing(true);
    try {
      const updates: any = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        review_notes: reviewNotes,
        reviewed_at: new Date().toISOString(),
      };

      if (actionType === 'approve') {
        updates.approved_amount = parseFloat(approvedAmount) || selectedClaim.claim_amount;
      }

      const { error } = await supabase
        .from('distributor_claims')
        .update(updates)
        .eq('id', selectedClaim.id);

      if (error) throw error;

      toast.success(`Claim ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
      setShowActionDialog(false);
      setSelectedClaim(null);
      setApprovedAmount('');
      setReviewNotes('');
      loadData();
    } catch (error) {
      console.error('Error updating claim:', error);
      toast.error('Failed to update claim');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any }> = {
      pending: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      under_review: { color: 'bg-blue-100 text-blue-700', icon: Clock },
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

  const filteredClaims = claims.filter(claim => {
    const matchesSearch = 
      claim.claim_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.distributor_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
    const matchesType = typeFilter === 'all' || claim.claim_type === typeFilter;
    const matchesDistributor = distributorFilter === 'all' || claim.distributor_id === distributorFilter;
    
    return matchesSearch && matchesStatus && matchesType && matchesDistributor;
  });

  const totalClaimed = filteredClaims.reduce((sum, c) => sum + (c.claim_amount || 0), 0);
  const totalApproved = filteredClaims
    .filter(c => c.status === 'approved' || c.status === 'paid')
    .reduce((sum, c) => sum + (c.approved_amount || 0), 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Total Claims</p>
              <p className="text-xl font-bold">{filteredClaims.length}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-600">Total Claimed</p>
              <p className="text-xl font-bold text-blue-600">₹{totalClaimed.toLocaleString('en-IN')}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-green-600">Total Approved</p>
              <p className="text-xl font-bold text-green-600">₹{totalApproved.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
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

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="damage_return">Damage/Return</SelectItem>
                <SelectItem value="scheme_claim">Scheme Claim</SelectItem>
                <SelectItem value="credit_note">Credit Note</SelectItem>
              </SelectContent>
            </Select>

            <Select value={distributorFilter} onValueChange={setDistributorFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Distributor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Distributors</SelectItem>
                {distributors.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {filteredClaims.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No claims found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim #</TableHead>
                    <TableHead>Distributor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClaims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell className="font-medium">{claim.claim_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{claim.distributor_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {claim.claim_type?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(claim.claim_date), 'dd MMM yyyy')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{claim.claim_amount?.toLocaleString('en-IN') || '0'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(claim.status)}
                      </TableCell>
                      <TableCell>
                        {(claim.status === 'pending' || claim.status === 'under_review') && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:bg-green-50"
                              onClick={() => {
                                setSelectedClaim(claim);
                                setActionType('approve');
                                setApprovedAmount(claim.claim_amount?.toString() || '');
                                setShowActionDialog(true);
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setSelectedClaim(claim);
                                setActionType('reject');
                                setShowActionDialog(true);
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Claim' : 'Reject Claim'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedClaim && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedClaim.claim_number}</p>
                <p className="text-sm text-muted-foreground">{selectedClaim.description}</p>
                <p className="text-lg font-bold mt-2">₹{selectedClaim.claim_amount?.toLocaleString('en-IN')}</p>
              </div>
            )}

            {actionType === 'approve' && (
              <div>
                <label className="text-sm font-medium">Approved Amount (₹)</label>
                <Input
                  type="number"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  placeholder="Enter approved amount"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Review Notes</label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={actionType === 'approve' ? 'Optional notes...' : 'Reason for rejection...'}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {processing ? 'Processing...' : actionType === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
