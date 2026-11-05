import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { BrandingRequestModal } from "@/components/BrandingRequestModal";
import { useSearchParams } from "react-router-dom";
import { ModuleHelpButton } from "@/components/help/ModuleHelpButton";

interface BrandingRequestRow {
  id: string;
  title: string | null;
  status: string;
  pincode: string | null;
  budget: number | null;
  assigned_vendor_id: string | null;
  created_at: string;
  requested_assets: string | null;
  due_date: string | null;
  vendor_due_date: string | null;
  vendor_budget: number | null;
  vendor_confirmation_status: string | null;
  vendor_rating: number | null;
  implementation_date: string | null;
}

type BrandingStatus = 'submitted' | 'manager_approved' | 'manager_rejected' | 'assigned' | 'in_progress' | 'executed' | 'verified';

const statusCls = (status: string) => {
  switch (status) {
    case 'submitted': return 'bg-warning text-warning-foreground';
    case 'manager_approved': return 'bg-primary text-primary-foreground';
    case 'assigned': return 'bg-muted text-muted-foreground';
    case 'in_progress': return 'bg-warning text-warning-foreground';
    case 'executed': return 'bg-success text-success-foreground';
    case 'verified': return 'bg-success text-success-foreground';
    case 'manager_rejected': return 'bg-destructive text-destructive-foreground';
    default: return 'bg-muted text-muted-foreground'
  }
}

const BrandingRequests = () => {
  const [requests, setRequests] = useState<BrandingRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [retailerId, setRetailerId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<BrandingStatus | undefined>(undefined);

  useEffect(() => { document.title = 'Branding Requests'; }, []);

  useEffect(() => {
    const prefill = () => {
      const v = searchParams.get('visitId');
      const r = searchParams.get('retailerId');
      if (v) setVisitId(v);
      if (r) setRetailerId(r);
    };
    prefill();
  }, [searchParams]);

  const load = async () => {
    setLoading(true);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;

    let query = supabase
      .from('branding_requests')
      .select('id, title, status, pincode, budget, assigned_vendor_id, created_at, requested_assets, due_date, vendor_due_date, vendor_budget, vendor_confirmation_status, vendor_rating, implementation_date')
      .order('created_at', { ascending: false });

    // RLS allows user to see own; admins can see all; we don't filter to keep it simple
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (!error && data) setRequests(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  return (
    <Layout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Branding Requests</h1>
            <ModuleHelpButton categoryId="branding" />
          </div>
          <Button onClick={() => setOpen(true)}>New Request</Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">My Requests</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BrandingStatus)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="manager_approved">Manager Approved</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="executed">Executed</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="manager_rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={load}>Refresh</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Assets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead>Vendor Status</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && requests.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No requests found</TableCell></TableRow>
                )}
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title || 'Branding Request'}</TableCell>
                    <TableCell>{r.requested_assets || '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusCls(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                    </TableCell>
                    <TableCell>{r.due_date ? new Date(r.due_date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell className="text-right">{r.budget ? `₹${r.budget.toLocaleString()}` : '-'}</TableCell>
                    <TableCell>
                      {r.vendor_confirmation_status ? (
                        <Badge variant="outline">{r.vendor_confirmation_status}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}</TableBody>
            </Table>
          </CardContent>
        </Card>

        <BrandingRequestModal
          isOpen={open}
          onClose={() => setOpen(false)}
          defaultVisitId={visitId || undefined}
          defaultRetailerId={retailerId || undefined}
          onCreated={() => load()}
        />
      </div>
    </Layout>
  );
};

export default BrandingRequests;
