import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Bot, 
  Eye, 
  Check, 
  X, 
  Edit2, 
  TrendingDown, 
  Users, 
  Target, 
  MapPin, 
  Calendar,
  Sparkles
} from 'lucide-react';
import { AISchemeSuggestion } from '@/hooks/useAISchemeSuggestions';
import { format } from 'date-fns';

interface AISuggestionCardProps {
  suggestion: AISchemeSuggestion;
  onPreview: () => void;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  isApproving?: boolean;
}

const analysisTypeIcons: Record<string, React.ReactNode> = {
  slow_moving_products: <TrendingDown className="h-4 w-4" />,
  retailer_category: <Users className="h-4 w-4" />,
  high_potential_acquisition: <Target className="h-4 w-4" />,
  territory_boost: <MapPin className="h-4 w-4" />,
  beat_trending: <Sparkles className="h-4 w-4" />,
  salesperson_boost: <Users className="h-4 w-4" />,
  seasonal: <Calendar className="h-4 w-4" />
};

const analysisTypeLabels: Record<string, string> = {
  slow_moving_products: 'Slow Mover Recovery',
  retailer_category: 'Category Targeting',
  high_potential_acquisition: 'Acquisition Boost',
  territory_boost: 'Territory Boost',
  beat_trending: 'Beat Trending',
  salesperson_boost: 'Sales Boost',
  seasonal: 'Seasonal Opportunity'
};

const schemeTypeLabels: Record<string, string> = {
  percentage_discount: '% Discount',
  flat_discount: 'Flat Discount',
  buy_x_get_y_free: 'Buy X Get Y',
  bundle_combo: 'Bundle',
  tiered_discount: 'Tiered',
  time_based_offer: 'Time-Based',
  first_order_discount: 'First Order',
  category_wide_discount: 'Category Wide'
};

export const AISuggestionCard = ({
  suggestion,
  onPreview,
  onApprove,
  onReject,
  onEdit,
  isApproving
}: AISuggestionCardProps) => {
  const confidencePercent = Math.round((suggestion.confidence_score || 0.75) * 100);

  const getDiscountDisplay = () => {
    if (suggestion.suggested_discount_percentage > 0) {
      return `${suggestion.suggested_discount_percentage}% Off`;
    }
    if (suggestion.suggested_discount_amount > 0) {
      return `₹${suggestion.suggested_discount_amount} Off`;
    }
    if (suggestion.suggested_buy_quantity > 0 && suggestion.suggested_free_quantity > 0) {
      return `Buy ${suggestion.suggested_buy_quantity} Get ${suggestion.suggested_free_quantity}`;
    }
    return 'Custom';
  };

  const getTargetDisplay = () => {
    if (suggestion.target_type === 'global') return 'Global (All)';
    const count = suggestion.target_names?.length || suggestion.target_ids?.length || 0;
    const typeLabel = suggestion.target_type === 'territory' ? 'Territories' :
                     suggestion.target_type === 'beat' ? 'Beats' :
                     suggestion.target_type === 'retailer' ? 'Retailers' :
                     suggestion.target_type === 'salesperson' ? 'Salespersons' :
                     suggestion.target_type === 'product' ? 'Products' : 'Entities';
    return `${count} ${typeLabel}`;
  };

  return (
    <Card className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 rounded-lg">
              <Bot className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                {suggestion.suggested_name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                  {analysisTypeIcons[suggestion.analysis_type]}
                  <span className="ml-1">{analysisTypeLabels[suggestion.analysis_type] || suggestion.analysis_type}</span>
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {schemeTypeLabels[suggestion.suggested_scheme_type] || suggestion.suggested_scheme_type}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-muted-foreground">Confidence</div>
            <div className="flex items-center gap-2">
              <Progress value={confidencePercent} className="w-16 h-2" />
              <span className="text-sm font-semibold">{confidencePercent}%</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Scheme Details */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Discount:</span>
            <span className="font-medium">{getDiscountDisplay()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Target:</span>
            <span className="font-medium">{getTargetDisplay()}</span>
          </div>
        </div>

        {/* Validity */}
        {(suggestion.suggested_start_date || suggestion.suggested_end_date) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {suggestion.suggested_start_date && format(new Date(suggestion.suggested_start_date), 'MMM d')}
              {' - '}
              {suggestion.suggested_end_date && format(new Date(suggestion.suggested_end_date), 'MMM d, yyyy')}
            </span>
          </div>
        )}

        {/* Reasoning Preview */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {suggestion.reasoning}
          </p>
        </div>

        {/* Expected Benefit */}
        {suggestion.expected_benefit && (
          <div className="flex items-start gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-amber-500 mt-0.5" />
            <span className="text-muted-foreground">{suggestion.expected_benefit}</span>
          </div>
        )}

        {/* Target Names Preview */}
        {suggestion.target_names && suggestion.target_names.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {suggestion.target_names.slice(0, 3).map((name, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {name}
              </Badge>
            ))}
            {suggestion.target_names.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{suggestion.target_names.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onPreview}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onEdit}
            className="flex-1"
          >
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={onApprove}
            disabled={isApproving}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4 mr-1" />
            Approve
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onReject}
            className="text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
