import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HelpCircle, Building, Calendar, CheckCircle2, Clock, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface SupportRequest {
  id: string;
  ticket_number: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  resolution_notes: string | null;
  distributor_id: string;
  distributor_name?: string;
  created_at: string;
}

interface PortalSupportTabProps {
  searchQuery: string;
}

export const PortalSupportTab = ({ searchQuery }: PortalSupportTabProps) => {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [distributorFilter, setDistributorFilter] = useState('all');
  const [distributors, setDistributors] = useState<{ id: string; name: string }[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
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

      const { data: requestsData, error } = await supabase
        .from('distributor_support_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const requestsWithDistributors = (requestsData || []).map(req => ({
        ...req,
        distributor_name: distributorData?.find(d => d.id === req.distributor_id)?.name || 'Unknown'
      }));

      setRequests(requestsWithDistributors);
    } catch (error) {
      console.error('Error loading support requests:', error);
      toast.error('Failed to load support requests');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedRequest) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('distributor_support_requests')
        .update({
          status: 'resolved',
          resolution_notes: resolutionNotes,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast.success('Ticket resolved successfully');
      setShowResolveDialog(false);
      setSelectedRequest(null);
      setResolutionNotes('');
      loadData();
    } catch (error) {
      console.error('Error resolving ticket:', error);
      toast.error('Failed to resolve ticket');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any }> = {
      open: { color: 'bg-blue-100 text-blue-700', icon: MessageSquare },
      in_progress: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      waiting_on_customer: { color: 'bg-orange-100 text-orange-700', icon: HelpCircle },
      resolved: { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
      closed: { color: 'bg-gray-100 text-gray-700', icon: CheckCircle2 },
    };
    const cfg = config[status] || config.open;
    const Icon = cfg.icon;
    return (
      <Badge className={`${cfg.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const config: Record<string, string> = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700',
    };
    return <Badge className={config[priority] || 'bg-gray-100'}>{priority}</Badge>;
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.ticket_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.distributor_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || req.priority === priorityFilter;
    const matchesDistributor = distributorFilter === 'all' || req.distributor_id === distributorFilter;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesDistributor;
  });

  const openCount = filteredRequests.filter(r => r.status === 'open' || r.status === 'in_progress').length;
  const urgentCount = filteredRequests.filter(r => r.priority === 'urgent' || r.priority === 'high').length;

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
              <p className="text-xs text-muted-foreground">Total Tickets</p>
              <p className="text-xl font-bold">{filteredRequests.length}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-xs text-yellow-600">Open/In Progress</p>
              <p className="text-xl font-bold text-yellow-600">{openCount}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-xs text-red-600">High/Urgent</p>
              <p className="text-xl font-bold text-red-600">{urgentCount}</p>
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
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
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
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No support requests found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Distributor</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.ticket_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{req.distributor_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-48">
                          <p className="font-medium truncate">{req.subject}</p>
                          <p className="text-xs text-muted-foreground truncate">{req.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {req.category?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getPriorityBadge(req.priority)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(req.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(req.created_at), 'dd MMM')}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(req.status === 'open' || req.status === 'in_progress') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:bg-green-50"
                            onClick={() => {
                              setSelectedRequest(req);
                              setShowResolveDialog(true);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
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

      {/* Resolve Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Support Ticket</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedRequest && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedRequest.ticket_number}</p>
                <p className="text-sm font-medium mt-1">{selectedRequest.subject}</p>
                <p className="text-sm text-muted-foreground">{selectedRequest.description}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Resolution Notes *</label>
              <Textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Describe how the issue was resolved..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={processing || !resolutionNotes.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? 'Processing...' : 'Mark as Resolved'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
