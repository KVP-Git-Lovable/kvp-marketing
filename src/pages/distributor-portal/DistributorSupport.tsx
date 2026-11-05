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
import { 
  ArrowLeft, 
  Plus, 
  HelpCircle,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Package,
  CreditCard,
  Truck,
  Monitor,
  Star
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SupportRequest {
  id: string;
  ticket_number: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  resolution_notes?: string;
  satisfaction_rating?: number;
  created_at: string;
  resolved_at?: string;
}

const categories = [
  { value: 'order_issue', label: 'Order Issues', icon: Package, description: 'Delivery delays, wrong items, shortages' },
  { value: 'payment_invoice', label: 'Payment/Invoice', icon: CreditCard, description: 'Payment status, invoice corrections' },
  { value: 'product_quality', label: 'Product Quality', icon: AlertCircle, description: 'Quality complaints, defective products' },
  { value: 'delivery', label: 'Delivery Issues', icon: Truck, description: 'Delivery problems, tracking' },
  { value: 'portal_technical', label: 'Portal/Technical', icon: Monitor, description: 'Login issues, app problems' },
];

const priorities = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-700' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' },
];

const DistributorSupport = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewRequestDialog, setShowNewRequestDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  
  // Form state
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');

  const distributorId = localStorage.getItem('distributor_id');

  useEffect(() => {
    if (!distributorId) {
      navigate('/distributor-portal/login');
      return;
    }
    loadRequests();
  }, [distributorId, navigate]);

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('distributor_support_requests')
        .select('*')
        .eq('distributor_id', distributorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error loading support requests:', error);
      toast.error('Failed to load support requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!category || !subject || !description) {
      toast.error('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('distributor_support_requests')
        .insert({
          distributor_id: distributorId,
          category,
          priority,
          subject,
          description,
          reference_number: referenceNumber || null,
        } as any);

      if (error) throw error;

      toast.success('Support request submitted');
      setShowNewRequestDialog(false);
      resetForm();
      loadRequests();
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedRequest || rating === 0) return;

    try {
      const { error } = await supabase
        .from('distributor_support_requests')
        .update({
          satisfaction_rating: rating,
          feedback_comment: feedbackComment || null,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast.success('Thank you for your feedback!');
      setShowDetailDialog(false);
      loadRequests();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback');
    }
  };

  const resetForm = () => {
    setCategory('');
    setPriority('medium');
    setSubject('');
    setDescription('');
    setReferenceNumber('');
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
    const found = priorities.find(p => p.value === priority);
    return <Badge className={found?.color || 'bg-gray-100'}>{priority}</Badge>;
  };

  const getCategoryIcon = (cat: string) => {
    const found = categories.find(c => c.value === cat);
    return found ? found.icon : HelpCircle;
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: requests.length,
    open: requests.filter(r => r.status === 'open' || r.status === 'in_progress').length,
    resolved: requests.filter(r => r.status === 'resolved' || r.status === 'closed').length,
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
              <h1 className="font-semibold text-foreground">Support Requests</h1>
              <p className="text-xs text-muted-foreground">{requests.length} tickets</p>
            </div>
          </div>
          <Button onClick={() => setShowNewRequestDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Open</p>
                <p className="text-lg font-bold text-yellow-600">{stats.open}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Resolved</p>
                <p className="text-lg font-bold text-green-600">{stats.resolved}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
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
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <Card className="p-8 text-center">
            <HelpCircle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No support requests found</p>
            <Button onClick={() => setShowNewRequestDialog(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Create Support Request
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((request) => {
              const Icon = getCategoryIcon(request.category);
              return (
                <Card 
                  key={request.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedRequest(request);
                    setRating(request.satisfaction_rating || 0);
                    setShowDetailDialog(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">{request.ticket_number}</span>
                            {getStatusBadge(request.status)}
                            {getPriorityBadge(request.priority)}
                          </div>
                          <h3 className="font-medium mt-1">{request.subject}</h3>
                          <p className="text-sm text-muted-foreground capitalize mt-0.5">
                            {request.category.replace('_', ' ')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(request.created_at), 'dd MMM yyyy, hh:mm a')}
                          </p>
                        </div>
                      </div>
                      {request.satisfaction_rating && (
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star}
                              className={`w-4 h-4 ${star <= request.satisfaction_rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* New Request Dialog */}
      <Dialog open={showNewRequestDialog} onOpenChange={setShowNewRequestDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Support Request</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Category Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Category *</label>
              <div className="grid grid-cols-1 gap-2">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <Card 
                      key={cat.value}
                      className={`p-3 cursor-pointer transition-all ${
                        category === cat.value 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:border-muted-foreground/30'
                      }`}
                      onClick={() => setCategory(cat.value)}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${category === cat.value ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div>
                          <span className="text-sm font-medium">{cat.label}</span>
                          <p className="text-xs text-muted-foreground">{cat.description}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="text-sm font-medium mb-1 block">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div>
              <label className="text-sm font-medium mb-1 block">Subject *</label>
              <Input
                placeholder="Brief description of your issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium mb-1 block">Description *</label>
              <Textarea
                placeholder="Provide detailed information about your issue..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Reference Number */}
            <div>
              <label className="text-sm font-medium mb-1 block">Reference Number</label>
              <Input
                placeholder="Order/Invoice number (optional)"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNewRequestDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitRequest} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedRequest?.ticket_number}</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(selectedRequest.status)}
                {getPriorityBadge(selectedRequest.priority)}
              </div>
              
              <div>
                <h3 className="font-medium">{selectedRequest.subject}</h3>
                <p className="text-sm text-muted-foreground capitalize">
                  {selectedRequest.category.replace('_', ' ')}
                </p>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">{selectedRequest.description}</p>
              </div>

              {selectedRequest.resolution_notes && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">Resolution:</p>
                  <p className="text-sm text-green-700">{selectedRequest.resolution_notes}</p>
                </div>
              )}

              {/* Feedback Section */}
              {(selectedRequest.status === 'resolved' || selectedRequest.status === 'closed') && !selectedRequest.satisfaction_rating && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Rate your experience:</p>
                  <div className="flex gap-2 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Button 
                        key={star}
                        variant="ghost"
                        size="sm"
                        onClick={() => setRating(star)}
                      >
                        <Star 
                          className={`w-6 h-6 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                        />
                      </Button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Additional feedback (optional)"
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    rows={2}
                  />
                  <Button onClick={handleSubmitFeedback} className="mt-2" disabled={rating === 0}>
                    Submit Feedback
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DistributorSupport;
