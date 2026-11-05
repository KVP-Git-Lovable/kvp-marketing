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
  Lightbulb,
  TrendingUp,
  Package,
  Cog,
  Target,
  CheckCircle2,
  Clock,
  Search,
  Star,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Idea {
  id: string;
  idea_number: string;
  category: string;
  title: string;
  description: string;
  expected_impact: string;
  estimated_value?: number;
  status: string;
  review_notes?: string;
  points_awarded?: number;
  created_at: string;
}

const categories = [
  { value: 'market_feedback', label: 'Market Feedback', icon: TrendingUp, description: 'Competition insights, customer demands' },
  { value: 'product_suggestion', label: 'Product Suggestion', icon: Package, description: 'SKU requests, packaging ideas' },
  { value: 'process_improvement', label: 'Process Improvement', icon: Cog, description: 'Delivery, ordering, payment process' },
  { value: 'new_opportunity', label: 'New Opportunity', icon: Target, description: 'New markets, retail expansion ideas' },
];

const impactLevels = [
  { value: 'low', label: 'Low Impact', color: 'bg-gray-100 text-gray-700' },
  { value: 'medium', label: 'Medium Impact', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High Impact', color: 'bg-green-100 text-green-700' },
];

const DistributorIdeas = () => {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showNewIdeaDialog, setShowNewIdeaDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expectedImpact, setExpectedImpact] = useState('medium');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [region, setRegion] = useState('');
  const [competitorName, setCompetitorName] = useState('');
  const [competitorInsight, setCompetitorInsight] = useState('');
  const [suggestedProduct, setSuggestedProduct] = useState('');

  const distributorId = localStorage.getItem('distributor_id');

  useEffect(() => {
    if (!distributorId) {
      navigate('/distributor-portal/login');
      return;
    }
    loadIdeas();
  }, [distributorId, navigate]);

  const loadIdeas = async () => {
    try {
      const { data, error } = await supabase
        .from('distributor_ideas')
        .select('*')
        .eq('distributor_id', distributorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIdeas(data || []);
    } catch (error) {
      console.error('Error loading ideas:', error);
      toast.error('Failed to load ideas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitIdea = async () => {
    if (!category || !title || !description) {
      toast.error('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('distributor_ideas')
        .insert({
          distributor_id: distributorId,
          category,
          title,
          description,
          expected_impact: expectedImpact,
          estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
          region: region || null,
          competitor_name: competitorName || null,
          competitor_insight: competitorInsight || null,
          suggested_product: suggestedProduct || null,
        } as any);

      if (error) throw error;

      toast.success('Idea submitted successfully!');
      setShowNewIdeaDialog(false);
      resetForm();
      loadIdeas();
    } catch (error) {
      console.error('Error submitting idea:', error);
      toast.error('Failed to submit idea');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setCategory('');
    setTitle('');
    setDescription('');
    setExpectedImpact('medium');
    setEstimatedValue('');
    setRegion('');
    setCompetitorName('');
    setCompetitorInsight('');
    setSuggestedProduct('');
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any }> = {
      submitted: { color: 'bg-blue-100 text-blue-700', icon: Clock },
      under_review: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      accepted: { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
      implemented: { color: 'bg-emerald-100 text-emerald-700', icon: Sparkles },
      rejected: { color: 'bg-gray-100 text-gray-500', icon: Clock },
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
    const found = impactLevels.find(l => l.value === impact);
    return <Badge className={found?.color || 'bg-gray-100'}>{impact}</Badge>;
  };

  const getCategoryIcon = (cat: string) => {
    const found = categories.find(c => c.value === cat);
    return found ? found.icon : Lightbulb;
  };

  const filteredIdeas = ideas.filter(idea => {
    const matchesSearch = idea.idea_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || idea.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    total: ideas.length,
    accepted: ideas.filter(i => i.status === 'accepted' || i.status === 'implemented').length,
    totalPoints: ideas.reduce((sum, i) => sum + (i.points_awarded || 0), 0),
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
              <h1 className="font-semibold text-foreground">Ideas & Suggestions</h1>
              <p className="text-xs text-muted-foreground">{ideas.length} ideas shared</p>
            </div>
          </div>
          <Button onClick={() => setShowNewIdeaDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Share Idea
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Ideas Shared</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Accepted</p>
                <p className="text-lg font-bold text-green-600">{stats.accepted}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Points Earned</p>
                <p className="text-lg font-bold text-yellow-600">{stats.totalPoints}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search ideas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ideas List */}
        {filteredIdeas.length === 0 ? (
          <Card className="p-8 text-center">
            <Lightbulb className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No ideas found</p>
            <p className="text-sm text-muted-foreground mt-1">Share your market insights and suggestions!</p>
            <Button onClick={() => setShowNewIdeaDialog(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Share Your First Idea
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredIdeas.map((idea) => {
              const Icon = getCategoryIcon(idea.category);
              return (
                <Card key={idea.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-100 to-orange-100 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">{idea.idea_number}</span>
                            {getStatusBadge(idea.status)}
                            {getImpactBadge(idea.expected_impact)}
                          </div>
                          <h3 className="font-medium mt-1">{idea.title}</h3>
                          <p className="text-sm text-muted-foreground capitalize">
                            {idea.category.replace('_', ' ')}
                          </p>
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {idea.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(idea.created_at), 'dd MMM yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {idea.points_awarded && idea.points_awarded > 0 && (
                          <div className="flex items-center gap-1 text-yellow-600">
                            <Star className="w-4 h-4 fill-yellow-400" />
                            <span className="font-bold">{idea.points_awarded}</span>
                          </div>
                        )}
                        {idea.estimated_value && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Est. ₹{idea.estimated_value.toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>
                    {idea.review_notes && (
                      <div className="mt-3 p-2 bg-muted rounded text-sm">
                        <span className="font-medium">Feedback:</span> {idea.review_notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* New Idea Dialog */}
      <Dialog open={showNewIdeaDialog} onOpenChange={setShowNewIdeaDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Share Your Idea
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Category Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Category *</label>
              <div className="grid grid-cols-2 gap-2">
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
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${category === cat.value ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium">{cat.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-sm font-medium mb-1 block">Title *</label>
              <Input
                placeholder="Brief title for your idea"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium mb-1 block">Description *</label>
              <Textarea
                placeholder="Describe your idea in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Expected Impact */}
            <div>
              <label className="text-sm font-medium mb-1 block">Expected Impact</label>
              <Select value={expectedImpact} onValueChange={setExpectedImpact}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {impactLevels.map(level => (
                    <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estimated Value */}
            <div>
              <label className="text-sm font-medium mb-1 block">Estimated Value (₹)</label>
              <Input
                type="number"
                placeholder="Potential revenue/savings (optional)"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
              />
            </div>

            {/* Market Feedback specific */}
            {category === 'market_feedback' && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">Competitor Name</label>
                  <Input
                    placeholder="If related to competition"
                    value={competitorName}
                    onChange={(e) => setCompetitorName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Competitor Insight</label>
                  <Textarea
                    placeholder="What are they doing differently?"
                    value={competitorInsight}
                    onChange={(e) => setCompetitorInsight(e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            )}

            {/* Product Suggestion specific */}
            {category === 'product_suggestion' && (
              <div>
                <label className="text-sm font-medium mb-1 block">Suggested Product/SKU</label>
                <Input
                  placeholder="Product name or type"
                  value={suggestedProduct}
                  onChange={(e) => setSuggestedProduct(e.target.value)}
                />
              </div>
            )}

            {/* Region */}
            <div>
              <label className="text-sm font-medium mb-1 block">Region/Market</label>
              <Input
                placeholder="Specific region or market (optional)"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNewIdeaDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitIdea} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Idea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DistributorIdeas;
