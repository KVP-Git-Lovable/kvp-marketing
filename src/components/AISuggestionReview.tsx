import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Bot, Sparkles, TrendingUp, Calendar, Check, X, Edit2 } from 'lucide-react';
import { AISchemeSuggestion } from '@/hooks/useAISchemeSuggestions';
import { format } from 'date-fns';

interface AISuggestionReviewProps {
  suggestion: AISchemeSuggestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (suggestion: AISchemeSuggestion, modifications?: Partial<AISchemeSuggestion>) => void;
  onReject: (suggestionId: string, reason: string) => void;
  mode: 'preview' | 'edit';
  isApproving?: boolean;
  isRejecting?: boolean;
}

const schemeTypeOptions = [
  { value: 'percentage_discount', label: 'Percentage Discount' },
  { value: 'flat_discount', label: 'Flat Discount' },
  { value: 'buy_x_get_y_free', label: 'Buy X Get Y Free' },
  { value: 'bundle_combo', label: 'Bundle Combo' },
  { value: 'tiered_discount', label: 'Tiered Discount' },
  { value: 'time_based_offer', label: 'Time-Based Offer' },
  { value: 'first_order_discount', label: 'First Order Discount' },
  { value: 'category_wide_discount', label: 'Category Wide Discount' }
];

export const AISuggestionReview = ({
  suggestion,
  open,
  onOpenChange,
  onApprove,
  onReject,
  mode,
  isApproving,
  isRejecting
}: AISuggestionReviewProps) => {
  const [editedData, setEditedData] = useState<Partial<AISchemeSuggestion>>({});
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  if (!suggestion) return null;

  const currentData = { ...suggestion, ...editedData };
  const confidencePercent = Math.round((suggestion.confidence_score || 0.75) * 100);

  const handleFieldChange = (field: keyof AISchemeSuggestion, value: any) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const handleApprove = () => {
    const hasModifications = Object.keys(editedData).length > 0;
    onApprove(suggestion, hasModifications ? editedData : undefined);
    setEditedData({});
    onOpenChange(false);
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      return;
    }
    onReject(suggestion.id, rejectionReason);
    setRejectionReason('');
    onOpenChange(false);
  };

  const isEditing = mode === 'edit';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bot className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <DialogTitle>{isEditing ? 'Edit & Approve' : 'Review'} AI Suggestion</DialogTitle>
              <DialogDescription>
                {isEditing 
                  ? 'Modify the suggestion before approving' 
                  : 'Review the AI-generated scheme suggestion'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Scheme Details</TabsTrigger>
            <TabsTrigger value="targeting">Targeting</TabsTrigger>
            <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[50vh] mt-4">
            <TabsContent value="details" className="space-y-4 pr-4">
              {/* Scheme Name */}
              <div className="space-y-2">
                <Label>Scheme Name</Label>
                {isEditing ? (
                  <Input
                    value={currentData.suggested_name}
                    onChange={(e) => handleFieldChange('suggested_name', e.target.value)}
                  />
                ) : (
                  <p className="text-sm font-medium">{currentData.suggested_name}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Description</Label>
                {isEditing ? (
                  <Textarea
                    value={currentData.suggested_description || ''}
                    onChange={(e) => handleFieldChange('suggested_description', e.target.value)}
                    rows={2}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{currentData.suggested_description || 'No description'}</p>
                )}
              </div>

              {/* Scheme Type */}
              <div className="space-y-2">
                <Label>Scheme Type</Label>
                {isEditing ? (
                  <Select
                    value={currentData.suggested_scheme_type}
                    onValueChange={(value) => handleFieldChange('suggested_scheme_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {schemeTypeOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary">
                    {schemeTypeOptions.find(o => o.value === currentData.suggested_scheme_type)?.label}
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Discount Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount %</Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={currentData.suggested_discount_percentage || 0}
                      onChange={(e) => handleFieldChange('suggested_discount_percentage', parseFloat(e.target.value) || 0)}
                    />
                  ) : (
                    <p className="text-sm font-medium">{currentData.suggested_discount_percentage || 0}%</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Discount Amount</Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={currentData.suggested_discount_amount || 0}
                      onChange={(e) => handleFieldChange('suggested_discount_amount', parseFloat(e.target.value) || 0)}
                    />
                  ) : (
                    <p className="text-sm font-medium">₹{currentData.suggested_discount_amount || 0}</p>
                  )}
                </div>
              </div>

              {/* Buy X Get Y */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Buy Quantity</Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={currentData.suggested_buy_quantity || 0}
                      onChange={(e) => handleFieldChange('suggested_buy_quantity', parseInt(e.target.value) || 0)}
                    />
                  ) : (
                    <p className="text-sm font-medium">{currentData.suggested_buy_quantity || 0}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Free Quantity</Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={currentData.suggested_free_quantity || 0}
                      onChange={(e) => handleFieldChange('suggested_free_quantity', parseInt(e.target.value) || 0)}
                    />
                  ) : (
                    <p className="text-sm font-medium">{currentData.suggested_free_quantity || 0}</p>
                  )}
                </div>
              </div>

              {/* Min Order Value */}
              <div className="space-y-2">
                <Label>Minimum Order Value</Label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={currentData.suggested_min_order_value || 0}
                    onChange={(e) => handleFieldChange('suggested_min_order_value', parseFloat(e.target.value) || 0)}
                  />
                ) : (
                  <p className="text-sm font-medium">₹{currentData.suggested_min_order_value || 0}</p>
                )}
              </div>

              <Separator />

              {/* Validity Period */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={currentData.suggested_start_date || ''}
                      onChange={(e) => handleFieldChange('suggested_start_date', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm font-medium">
                      {currentData.suggested_start_date 
                        ? format(new Date(currentData.suggested_start_date), 'MMM d, yyyy') 
                        : 'Not set'}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={currentData.suggested_end_date || ''}
                      onChange={(e) => handleFieldChange('suggested_end_date', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm font-medium">
                      {currentData.suggested_end_date 
                        ? format(new Date(currentData.suggested_end_date), 'MMM d, yyyy') 
                        : 'Not set'}
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="targeting" className="space-y-4 pr-4">
              {/* Target Type */}
              <div className="space-y-2">
                <Label>Target Level</Label>
                <Badge variant="outline" className="text-sm capitalize">
                  {currentData.target_type}
                </Badge>
              </div>

              {/* Target Entities */}
              {currentData.target_names && currentData.target_names.length > 0 ? (
                <div className="space-y-2">
                  <Label>Target Entities ({currentData.target_names.length})</Label>
                  <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                    {currentData.target_names.map((name, idx) => (
                      <Badge key={idx} variant="secondary" className="text-sm">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
                    This scheme will apply globally to all entities
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4 pr-4">
              {/* Confidence Score */}
              <div className="space-y-2">
                <Label>AI Confidence Score</Label>
                <div className="flex items-center gap-3">
                  <Progress value={confidencePercent} className="flex-1 h-3" />
                  <span className="text-lg font-bold">{confidencePercent}%</span>
                </div>
              </div>

              {/* Analysis Type */}
              <div className="space-y-2">
                <Label>Analysis Type</Label>
                <Badge variant="outline" className="bg-purple-50 text-purple-700">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {currentData.analysis_type?.replace(/_/g, ' ')}
                </Badge>
              </div>

              {/* Reasoning */}
              <div className="space-y-2">
                <Label>AI Reasoning</Label>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">{currentData.reasoning}</p>
                </div>
              </div>

              {/* Expected Benefit */}
              {currentData.expected_benefit && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    Expected Benefit
                  </Label>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">{currentData.expected_benefit}</p>
                  </div>
                </div>
              )}

              {/* Data Signals */}
              {currentData.data_signals && Object.keys(currentData.data_signals).length > 0 && (
                <div className="space-y-2">
                  <Label>Data Signals Used</Label>
                  <div className="p-4 bg-muted rounded-lg">
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(currentData.data_signals, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Rejection Reason (for rejecting) */}
              <Separator />
              <div className="space-y-2">
                <Label>Rejection Reason (required to reject)</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this suggestion is not suitable..."
                  rows={3}
                />
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            variant="outline" 
            onClick={handleReject}
            disabled={isRejecting || !rejectionReason.trim()}
            className="text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button 
            onClick={handleApprove}
            disabled={isApproving}
            className="bg-green-600 hover:bg-green-700"
          >
            {isApproving ? (
              'Creating...'
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                {Object.keys(editedData).length > 0 ? 'Approve with Changes' : 'Approve'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
