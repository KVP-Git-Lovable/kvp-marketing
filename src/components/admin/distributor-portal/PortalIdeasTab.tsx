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
import { Lightbulb, Building, Calendar, CheckCircle2, XCircle, Clock, Star, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Idea {
  id: string;
  idea_number: string;
  category: string;
  title: string;
  description: string;
  expected_impact: string;
  estimated_value: number | null;
  status: string;
  review_notes: string | null;
  points_awarded: number | null;
  distributor_id: string;
  distributor_name?: string;
  created_at: string;
}

interface PortalIdeasTabProps {
  searchQuery: string;
}

export const PortalIdeasTab = ({ searchQuery }: PortalIdeasTabProps) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [distributorFilter, setDistributorFilter] = useState('all');
  const [distributors, setDistributors] = useState<{ id: string; name: string }[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<'accept' | 'reject'>('accept');
  const [reviewNotes, setReviewNotes] = useState('');
  const [pointsAwarded, setPointsAwarded] = useState('');
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

      const { data: ideasData, error } = await supabase
        .from('distributor_ideas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const ideasWithDistributors = (ideasData || []).map(idea => ({
        ...idea,
        distributor_name: distributorData?.find(d => d.id === idea.distributor_id)?.name || 'Unknown'
      }));

      setIdeas(ideasWithDistributors);
    } catch (error) {
      console.error('Error loading ideas:', error);
      toast.error('Failed to load ideas');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedIdea) return;
    
    setProcessing(true);
    try {
      const updates: any = {
        status: actionType === 'accept' ? 'accepted' : 'rejected',
        review_notes: reviewNotes,
        reviewed_at: new Date().toISOString(),
      };

      if (actionType === 'accept' && pointsAwarded) {
        updates.points_awarded = parseInt(pointsAwarded);
      }

      const { error } = await supabase
        .from('distributor_ideas')
        .update(updates)
        .eq('id', selectedIdea.id);

      if (error) throw error;

      toast.success(`Idea ${actionType === 'accept' ? 'accepted' : 'rejected'} successfully`);
      setShowActionDialog(false);
      setSelectedIdea(null);
      setReviewNotes('');
      setPointsAwarded('');
      loadData();
    } catch (error) {
      console.error('Error updating idea:', error);
      toast.error('Failed to update idea');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any }> = {
      submitted: { color: 'bg-blue-100 text-blue-700', icon: Clock },
      under_review: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      accepted: { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
      implemented: { color: 'bg-emerald-100 text-emerald-700', icon: Sparkles },
      rejected: { color: 'bg-gray-100 text-gray-500', icon: XCircle },
    };
    const cfg = config[status] || config.submitted;
    const Icon = cfg.icon;
    return (
      <Badge className={`${cfg.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getImpactBadge = (impact: string) => {
    const config: Record<string, string> = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-green-100 text-green-700',
    };
    return <Badge className={config[impact] || 'bg-gray-100'}>{impact}</Badge>;
  };

  const filteredIdeas = ideas.filter(idea => {
    const matchesSearch = 
      idea.idea_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.distributor_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || idea.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || idea.category === categoryFilter;
    const matchesDistributor = distributorFilter === 'all' || idea.distributor_id === distributorFilter;
    
    return matchesSearch && matchesStatus && matchesCategory && matchesDistributor;
  });

  const pendingCount = filteredIdeas.filter(i => i.status === 'submitted' || i.status === 'under_review').length;
  const acceptedCount = filteredIdeas.filter(i => i.status === 'accepted' || i.status === 'implemented').length;
  const totalPoints = filteredIdeas.reduce((sum, i) => sum + (i.points_awarded || 0), 0);

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Total Ideas</p>
              <p className="text-xl font-bold">{filteredIdeas.length}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-xs text-yellow-600">Pending Review</p>
              <p className="text-xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-green-600">Accepted</p>
              <p className="text-xl font-bold text-green-600">{acceptedCount}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-xs text-amber-600">Points Awarded</p>
              <p className="text-xl font-bold text-amber-600">{totalPoints}</p>
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
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="implemented">Implemented</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="market_feedback">Market Feedback</SelectItem>
                <SelectItem value="product_suggestion">Product Suggestion</SelectItem>
                <SelectItem value="process_improvement">Process Improvement</SelectItem>
                <SelectItem value="new_opportunity">New Opportunity</SelectItem>
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
          {filteredIdeas.length === 0 ? (
            <div className="text-center py-12">
              <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No ideas found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Idea #</TableHead>
                    <TableHead>Distributor</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Impact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIdeas.map((idea) => (
                    <TableRow key={idea.id}>
                      <TableCell className="font-medium">{idea.idea_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{idea.distributor_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-48">
                          <p className="font-medium truncate">{idea.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{idea.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {idea.category?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getImpactBadge(idea.expected_impact)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(idea.status)}
                      </TableCell>
                      <TableCell>
                        {idea.points_awarded ? (
                          <div className="flex items-center gap-1 text-amber-600">
                            <Star className="h-4 w-4 fill-amber-400" />
                            <span className="font-bold">{idea.points_awarded}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(idea.status === 'submitted' || idea.status === 'under_review') && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:bg-green-50"
                              onClick={() => {
                                setSelectedIdea(idea);
                                setActionType('accept');
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
                                setSelectedIdea(idea);
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
              {actionType === 'accept' ? 'Accept Idea' : 'Reject Idea'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedIdea && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedIdea.idea_number}</p>
                <p className="text-sm font-medium mt-1">{selectedIdea.title}</p>
                <p className="text-sm text-muted-foreground">{selectedIdea.description}</p>
              </div>
            )}

            {actionType === 'accept' && (
              <div>
                <label className="text-sm font-medium">Points to Award</label>
                <Input
                  type="number"
                  value={pointsAwarded}
                  onChange={(e) => setPointsAwarded(e.target.value)}
                  placeholder="Enter points (optional)"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Feedback/Notes</label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={actionType === 'accept' ? 'Appreciation or implementation notes...' : 'Reason for rejection...'}
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
              className={actionType === 'accept' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {processing ? 'Processing...' : actionType === 'accept' ? 'Accept' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
