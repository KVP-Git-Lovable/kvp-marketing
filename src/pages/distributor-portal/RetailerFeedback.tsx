import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Star, Plus, Search, MessageSquare, ThumbsUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface OutletContext {
  user: { id: string; full_name: string; role: string; distributor_id: string };
  distributorId: string;
}

const FEEDBACK_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'product_quality', label: 'Product Quality' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'service', label: 'Service' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'suggestion', label: 'Suggestion' },
];

const StarRating = ({ value, onChange, size = 'md' }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map(star => (
      <button
        key={star}
        type="button"
        onClick={() => onChange?.(star)}
        disabled={!onChange}
        className={cn("transition-colors", onChange ? "cursor-pointer hover:scale-110" : "cursor-default")}
      >
        <Star
          className={cn(
            size === 'sm' ? 'w-4 h-4' : 'w-6 h-6',
            star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
          )}
        />
      </button>
    ))}
  </div>
);

const RetailerFeedback = () => {
  const { distributorId, user } = useOutletContext<OutletContext>();
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);

  // Form state
  const [selectedRetailer, setSelectedRetailer] = useState('');
  const [feedbackType, setFeedbackType] = useState('general');
  const [overallRating, setOverallRating] = useState(5);
  const [productRating, setProductRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [comments, setComments] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (distributorId) {
      loadFeedbacks();
      loadRetailers();
    }
  }, [distributorId]);

  const loadFeedbacks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('distributor_retailer_feedback')
      .select('*, retailers(name)')
      .eq('distributor_id', distributorId)
      .order('created_at', { ascending: false });
    setFeedbacks(data || []);
    setLoading(false);
  };

  const loadRetailers = async () => {
    const { data } = await supabase
      .from('retailers')
      .select('id, name')
      .or(`distributor_id.eq.${distributorId}`)
      .order('name');
    setRetailers(data || []);
  };

  const resetForm = () => {
    setSelectedRetailer('');
    setFeedbackType('general');
    setOverallRating(5);
    setProductRating(0);
    setDeliveryRating(0);
    setServiceRating(0);
    setComments('');
    setFollowUp(false);
    setFollowUpNotes('');
  };

  const saveFeedback = async () => {
    if (!selectedRetailer) { toast.error('Select a retailer'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('distributor_retailer_feedback').insert({
        distributor_id: distributorId,
        retailer_id: selectedRetailer,
        feedback_type: feedbackType,
        rating: overallRating,
        product_quality_rating: productRating || null,
        delivery_rating: deliveryRating || null,
        service_rating: serviceRating || null,
        comments,
        follow_up_required: followUp,
        follow_up_notes: followUp ? followUpNotes : null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success('Feedback recorded');
      setShowDialog(false);
      resetForm();
      loadFeedbacks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const avgRating = feedbacks.length > 0
    ? (feedbacks.reduce((s, f) => s + Number(f.rating), 0) / feedbacks.length).toFixed(1)
    : '—';

  const complaintCount = feedbacks.filter(f => f.feedback_type === 'complaint').length;
  const followUpPending = feedbacks.filter(f => f.follow_up_required && !f.follow_up_completed).length;

  const filtered = feedbacks.filter(f =>
    (f.retailers?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    f.comments?.toLowerCase().includes(search.toLowerCase())
  );

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      general: 'bg-blue-100 text-blue-700',
      product_quality: 'bg-purple-100 text-purple-700',
      delivery: 'bg-orange-100 text-orange-700',
      service: 'bg-green-100 text-green-700',
      complaint: 'bg-red-100 text-red-700',
      suggestion: 'bg-teal-100 text-teal-700',
    };
    return colors[type] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Retailer Feedback</h1>
          <p className="text-sm text-muted-foreground">{feedbacks.length} records</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Feedback
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-lg font-bold">{avgRating}</span>
            </div>
            <p className="text-xs text-muted-foreground">Avg Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-destructive">{complaintCount}</p>
            <p className="text-xs text-muted-foreground">Complaints</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-orange-600">{followUpPending}</p>
            <p className="text-xs text-muted-foreground">Follow-ups</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search feedback..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* List */}
      {loading ? (
        <Card><CardContent className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No feedback recorded yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(fb => (
            <Card key={fb.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{fb.retailers?.name || 'Unknown'}</span>
                      <Badge className={getTypeColor(fb.feedback_type)}>
                        {FEEDBACK_TYPES.find(t => t.value === fb.feedback_type)?.label || fb.feedback_type}
                      </Badge>
                      {fb.follow_up_required && !fb.follow_up_completed && (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Follow-up
                        </Badge>
                      )}
                    </div>
                    <StarRating value={fb.rating} size="sm" />
                    {fb.comments && <p className="text-sm text-muted-foreground line-clamp-2">{fb.comments}</p>}
                    <p className="text-xs text-muted-foreground">{format(new Date(fb.created_at), 'dd MMM yyyy')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Feedback Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Retailer</Label>
              <Select value={selectedRetailer} onValueChange={setSelectedRetailer}>
                <SelectTrigger><SelectValue placeholder="Select retailer" /></SelectTrigger>
                <SelectContent>
                  {retailers.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={feedbackType} onValueChange={setFeedbackType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FEEDBACK_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Overall Rating</Label>
              <StarRating value={overallRating} onChange={setOverallRating} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Product Quality</Label>
                <StarRating value={productRating} onChange={setProductRating} size="sm" />
              </div>
              <div>
                <Label className="text-xs">Delivery</Label>
                <StarRating value={deliveryRating} onChange={setDeliveryRating} size="sm" />
              </div>
              <div>
                <Label className="text-xs">Service</Label>
                <StarRating value={serviceRating} onChange={setServiceRating} size="sm" />
              </div>
            </div>
            <div>
              <Label>Comments</Label>
              <Textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="Details..." rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="followup"
                checked={followUp}
                onChange={e => setFollowUp(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="followup" className="cursor-pointer">Follow-up required</Label>
            </div>
            {followUp && (
              <div>
                <Label>Follow-up Notes</Label>
                <Textarea value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)} rows={2} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveFeedback} disabled={saving}>
              {saving ? 'Saving...' : 'Save Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RetailerFeedback;
