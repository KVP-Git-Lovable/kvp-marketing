import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { Recommendation } from '@/hooks/useRecommendations';
import { RecommendationCard } from './RecommendationCard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface AIRecommendationBannerProps {
  recommendations: Recommendation[];
  onGenerate: () => void;
  onFeedback: (recId: string, feedbackType: 'like' | 'dislike' | 'implemented' | 'ignored') => void;
  loading?: boolean;
  type: 'beat_visit' | 'retailer_priority' | 'discussion_points' | 'optimal_day';
  beatId?: string;
  retailerId?: string;
  compact?: boolean;
}

export function AIRecommendationBanner({
  recommendations,
  onGenerate,
  onFeedback,
  loading,
  type,
  compact = false,
}: AIRecommendationBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getTitle = () => {
    switch (type) {
      case 'beat_visit':
        return 'Beat Recommendations';
      case 'retailer_priority':
        return compact ? 'Priority' : 'Priority Retailers';
      case 'discussion_points':
        return 'Discussion Points';
      case 'optimal_day':
        return 'Best Visit Day';
      default:
        return 'AI Recommendations';
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'beat_visit':
        return 'AI-recommended beats to visit for maximum impact';
      case 'retailer_priority':
        return 'AI-recommended retailers to visit based on potential and last visit';
      case 'discussion_points':
        return 'Personalized talking points for better retailer engagement';
      case 'optimal_day':
        return 'Best day of the week to visit this beat';
      default:
        return 'AI-powered insights';
    }
  };

  // Compact mode - collapsible button style for MyVisits
  if (compact) {
    return (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="justify-between gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10 h-8 text-xs px-2 w-full"
          >
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3 text-primary" />
              <span>{getTitle()}</span>
            </div>
            <div className="flex items-center gap-2">
              {recommendations.length > 0 && (
                <span className="text-[10px] font-medium text-muted-foreground">
                  {recommendations.length}
                </span>
              )}
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-2">
          <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
            {recommendations.length === 0 ? (
              <div className="text-center py-2">
                <p className="text-[10px] text-muted-foreground mb-2">{getDescription()}</p>
                <Button
                  size="sm"
                  onClick={onGenerate}
                  disabled={loading}
                  className="flex items-center gap-1 h-6 text-[10px] px-2"
                >
                  <Sparkles className="h-3 w-3" />
                  {loading ? '...' : 'Get Insights'}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recommendations.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    onFeedback={(feedbackType) => onFeedback(rec.id, feedbackType)}
                    compact
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // Original non-compact mode
  if (recommendations.length === 0) {
    return (
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <div>
                <h3 className="font-medium text-xs">{getTitle()}</h3>
                <p className="text-[10px] text-muted-foreground leading-tight">{getDescription()}</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={onGenerate}
              disabled={loading}
              className="flex items-center gap-1 h-7 text-xs px-2"
            >
              <Sparkles className="h-3 w-3" />
              {loading ? 'Generating...' : 'Get Insights'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
      <CardContent className="p-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <div>
                <h3 className="font-medium text-xs">{getTitle()}</h3>
                <p className="text-[10px] text-muted-foreground leading-tight">{getDescription()}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 w-7 p-0"
              >
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="pt-1 space-y-2">
              {recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onFeedback={(feedbackType) => onFeedback(rec.id, feedbackType)}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
