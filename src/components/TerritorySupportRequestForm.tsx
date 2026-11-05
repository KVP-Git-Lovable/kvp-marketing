import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { HeartHandshake } from 'lucide-react';

interface TerritorySupportRequestFormProps {
  territoryId: string;
  territoryName: string;
  onSuccess?: () => void;
}

const SUPPORT_TYPES = [
  { value: 'marketing_campaign', label: 'Marketing Campaign' },
  { value: 'branding_material', label: 'Branding Material' },
  { value: 'additional_manpower', label: 'Additional Manpower' },
  { value: 'training_program', label: 'Training Program' },
  { value: 'promotional_scheme', label: 'Promotional Scheme' },
  { value: 'infrastructure', label: 'Infrastructure Support' },
  { value: 'inventory_support', label: 'Inventory Support' },
  { value: 'technology_tools', label: 'Technology/Tools' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const EXPECTED_IMPACTS = [
  { value: 'high_revenue', label: 'High Revenue Increase (>20%)' },
  { value: 'moderate_revenue', label: 'Moderate Revenue Increase (10-20%)' },
  { value: 'low_revenue', label: 'Low Revenue Increase (<10%)' },
  { value: 'market_share', label: 'Market Share Growth' },
  { value: 'retailer_coverage', label: 'Improved Retailer Coverage' },
  { value: 'brand_visibility', label: 'Enhanced Brand Visibility' },
  { value: 'customer_retention', label: 'Better Customer Retention' },
  { value: 'operational_efficiency', label: 'Operational Efficiency' },
];

const TerritorySupportRequestForm: React.FC<TerritorySupportRequestFormProps> = ({ territoryId, territoryName, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  
  // Form fields
  const [supportType, setSupportType] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('open');
  const [expectedImpact, setExpectedImpact] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState('');

  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        setCurrentUser({
          id: user.id,
          name: profile?.full_name || user.email || 'Unknown'
        });
      }
    };
    loadCurrentUser();
  }, []);

  const getSupportTypeLabel = (value: string) => {
    return SUPPORT_TYPES.find(t => t.value === value)?.label || value;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) return; // Prevent double submission
    
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error('You must be logged in to submit a request');
      setLoading(false);
      return;
    }

    // Get the label for support type to use as subject
    const supportTypeLabel = getSupportTypeLabel(supportType);
    
    // Store structured data as JSON in description
    const structuredDescription = JSON.stringify({
      support_type: supportType,
      priority: priority,
      estimated_budget: estimatedBudget ? parseFloat(estimatedBudget) : null,
      expected_impact: expectedImpact,
      territory_id: territoryId,
      territory_name: territoryName,
      created_by_name: currentUser?.name || 'Unknown',
      description: description,
    });

    const { error: insertError } = await supabase.from('support_requests').insert({
      user_id: user.id,
      subject: `${supportTypeLabel} - ${territoryName}`,
      description: structuredDescription,
      status: status,
      support_category: 'territory_support',
    });

    if (insertError) {
      console.error('Error creating support request:', insertError);
      toast.error('Failed to create support request');
    } else {
      toast.success('Support request created successfully!');
      setOpen(false);
      // Reset form
      setSupportType('');
      setPriority('medium');
      setStatus('open');
      setExpectedImpact('');
      setDescription('');
      setEstimatedBudget('');
      onSuccess?.();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 w-full sm:w-auto">
          <HeartHandshake className="h-4 w-4" />
          Support Request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Territory Growth Support Request</DialogTitle>
          <DialogDescription>
            Request resources or support to grow {territoryName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supportType">Support Type *</Label>
              <Select value={supportType} onValueChange={setSupportType} required>
                <SelectTrigger id="supportType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Select value={priority} onValueChange={setPriority} required>
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={status} onValueChange={setStatus} required>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedImpact">Expected Impact</Label>
              <Select value={expectedImpact} onValueChange={setExpectedImpact}>
                <SelectTrigger id="expectedImpact">
                  <SelectValue placeholder="Select expected impact" />
                </SelectTrigger>
                <SelectContent>
                  {EXPECTED_IMPACTS.map(impact => (
                    <SelectItem key={impact.value} value={impact.value}>{impact.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimatedBudget">Estimated Budget (₹)</Label>
            <Input
              id="estimatedBudget"
              type="number"
              value={estimatedBudget}
              onChange={(e) => setEstimatedBudget(e.target.value)}
              placeholder="Enter estimated budget"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the support needed and how it will help grow the territory..."
              rows={4}
              required
            />
          </div>

          {/* Created By Info */}
          <div className="bg-muted/30 p-3 rounded-lg text-sm text-muted-foreground">
            <p><span className="font-medium">Created By:</span> {currentUser?.name || 'Loading...'}</p>
            <p><span className="font-medium">Date/Time:</span> {new Date().toLocaleString()}</p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading || !supportType}>
              {loading ? 'Submitting...' : 'Submit Request'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TerritorySupportRequestForm;
