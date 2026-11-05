import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, Sparkles, TrendingUp, AlertCircle } from 'lucide-react';
import { Recommendation } from '@/hooks/useRecommendations';
import { Progress } from '@/components/ui/progress';

interface RecommendationCardProps {
  recommendation: Recommendation;
  onFeedback: (feedbackType: 'like' | 'dislike' | 'implemented' | 'ignored') => void;
  compact?: boolean;
}

export function RecommendationCard({ recommendation, onFeedback, compact = false }: RecommendationCardProps) {
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      beat_visit: 'Beat Visit Priority',
      retailer_priority: 'Retailer Priority',
      discussion_points: 'Discussion Points',
      beat_performance: 'Performance Prediction',
      optimal_day: 'Best Visit Day',
    };
    return labels[type] || type;
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      beat_visit: TrendingUp,
      retailer_priority: TrendingUp,
      discussion_points: Sparkles,
      beat_performance: TrendingUp,
      optimal_day: AlertCircle,
    };
    const Icon = icons[type] || Sparkles;
    return <Icon className="h-4 w-4" />;
  };

  const confidencePercentage = Math.round((recommendation.confidence_score || 0) * 100);

  const renderRecommendationContent = () => {
    const data = recommendation.recommendation_data;

    if (typeof data === 'string') {
      return <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data}</p>;
    }

    if (recommendation.recommendation_type === 'beat_visit' && Array.isArray(data)) {
      return (
        <div className="space-y-3">
          {data.slice(0, compact ? 2 : 3).map((beat: any, idx: number) => (
            <div key={idx} className="p-3 bg-secondary/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{beat.beat_name || beat.name}</span>
                <Badge variant="secondary">{Math.round((beat.score || 0) * 100)}%</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{beat.reason || beat.reasoning}</p>
            </div>
          ))}
        </div>
      );
    }

    if (recommendation.recommendation_type === 'retailer_priority' && Array.isArray(data)) {
      const getPriorityBadge = (score: number) => {
        if (score >= 80) return { label: 'High Priority', variant: 'destructive' as const, color: 'text-red-600' };
        if (score >= 60) return { label: 'Medium Priority', variant: 'default' as const, color: 'text-yellow-600' };
        return { label: 'Low Priority', variant: 'secondary' as const, color: 'text-green-600' };
      };

      return (
        <div className="space-y-3">
          {data.slice(0, compact ? 3 : 5).map((retailer: any, idx: number) => {
            const scoreValue = Math.round((retailer.score || 0) * 100);
            const priority = getPriorityBadge(scoreValue);
            
            return (
              <div key={idx} className="p-4 bg-card border rounded-lg hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-base mb-1.5 truncate">{retailer.name}</h4>
                    <Badge variant={priority.variant} className="text-xs">
                      {priority.label}
                    </Badge>
                  </div>
                  <div className="text-center shrink-0">
                    <div className={`text-2xl font-bold ${priority.color}`}>{scoreValue}</div>
                    <div className="text-xs text-muted-foreground">Score</div>
                  </div>
                </div>
                {retailer.reason && (
                  <p className="text-sm text-muted-foreground leading-relaxed mt-3 pt-3 border-t">
                    {retailer.reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (recommendation.recommendation_type === 'discussion_points' && Array.isArray(data)) {
      return (
        <ul className="space-y-2">
          {data.slice(0, compact ? 3 : 7).map((point: any, idx: number) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <span className="text-primary mt-0.5">•</span>
              <span className="text-muted-foreground">{typeof point === 'string' ? point : point.point || point.text}</span>
            </li>
          ))}
        </ul>
      );
    }

    if (recommendation.recommendation_type === 'beat_performance') {
      return (
        <div className="space-y-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <div className="text-sm font-medium mb-1">Predicted Revenue</div>
            <div className="text-2xl font-bold text-primary">₹{data.predicted_revenue || data.prediction || 'N/A'}</div>
          </div>
          <p className="text-sm text-muted-foreground">{data.analysis || data.reasoning}</p>
          {data.factors && (
            <div className="text-xs text-muted-foreground">
              <strong>Key Factors:</strong> {Array.isArray(data.factors) ? data.factors.join(', ') : data.factors}
            </div>
          )}
        </div>
      );
    }

    if (recommendation.recommendation_type === 'optimal_day') {
      return (
        <div className="space-y-3">
          <div className="p-3 bg-primary/10 rounded-lg text-center">
            <div className="text-sm text-muted-foreground mb-1">Best Day to Visit</div>
            <div className="text-xl font-bold text-primary">{data.recommended_day || data.day}</div>
          </div>
          <p className="text-sm text-muted-foreground">{data.reasoning || data.reason}</p>
          {data.alternatives && (
            <div className="text-xs text-muted-foreground">
              <strong>Alternative Days:</strong> {Array.isArray(data.alternatives) ? data.alternatives.join(', ') : data.alternatives}
            </div>
          )}
        </div>
      );
    }

    return <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
  };

  const hasFeedback = recommendation.feedback?.feedback_type;

  return (
    <Card className={compact ? 'shadow-sm' : ''}>
      <CardHeader className={compact ? 'pb-3' : ''}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getTypeIcon(recommendation.recommendation_type)}
            <div>
              <CardTitle className={compact ? 'text-base' : 'text-lg'}>
                {getTypeLabel(recommendation.recommendation_type)}
              </CardTitle>
              {recommendation.entity_name && (
                <CardDescription className="text-xs mt-1">
                  {recommendation.entity_name}
                </CardDescription>
              )}
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            AI
          </Badge>
        </div>
        {!compact && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Confidence</span>
              <span className="font-medium">{confidencePercentage}%</span>
            </div>
            <Progress value={confidencePercentage} className="h-1" />
          </div>
        )}
      </CardHeader>
      <CardContent className={compact ? 'pt-0' : ''}>
        {renderRecommendationContent()}
        
        {!compact && recommendation.reasoning && (
          <div className="mt-4 p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs text-muted-foreground">{recommendation.reasoning}</p>
          </div>
        )}

        <div className="flex items-center gap-2 mt-4">
          <Button
            size="sm"
            variant={hasFeedback && recommendation.feedback?.feedback_type === 'like' ? 'default' : 'outline'}
            onClick={() => onFeedback('like')}
            disabled={!!hasFeedback}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            Helpful
          </Button>
          <Button
            size="sm"
            variant={hasFeedback && recommendation.feedback?.feedback_type === 'dislike' ? 'default' : 'outline'}
            onClick={() => onFeedback('dislike')}
            disabled={!!hasFeedback}
          >
            <ThumbsDown className="h-4 w-4 mr-1" />
            Not Helpful
          </Button>
          {hasFeedback && (
            <span className="text-xs text-muted-foreground ml-auto">
              Feedback submitted
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
