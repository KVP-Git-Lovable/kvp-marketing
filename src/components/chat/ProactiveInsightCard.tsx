import { AlertTriangle, TrendingUp, Lightbulb, Trophy, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import type { AIInsight } from '@/hooks/useProactiveInsights';

interface ProactiveInsightCardProps {
  insight: AIInsight;
  onDismiss: (id: string) => void;
  onAction?: (insight: AIInsight) => void;
}

const INSIGHT_CONFIG = {
  alert: {
    icon: AlertTriangle,
    bgClass: 'bg-destructive/10 border-destructive/30',
    iconClass: 'text-destructive',
    label: 'Alert',
  },
  opportunity: {
    icon: TrendingUp,
    bgClass: 'bg-blue-500/10 border-blue-500/30',
    iconClass: 'text-blue-500',
    label: 'Opportunity',
  },
  recommendation: {
    icon: Lightbulb,
    bgClass: 'bg-amber-500/10 border-amber-500/30',
    iconClass: 'text-amber-500',
    label: 'Suggestion',
  },
  kudos: {
    icon: Trophy,
    bgClass: 'bg-green-500/10 border-green-500/30',
    iconClass: 'text-green-500',
    label: 'Achievement',
  },
};

const PRIORITY_STYLES = {
  critical: 'ring-2 ring-destructive/50 animate-pulse',
  high: 'ring-1 ring-destructive/30',
  medium: '',
  low: 'opacity-90',
};

export function ProactiveInsightCard({ insight, onDismiss, onAction }: ProactiveInsightCardProps) {
  const navigate = useNavigate();
  const config = INSIGHT_CONFIG[insight.insight_type] || INSIGHT_CONFIG.recommendation;
  const Icon = config.icon;

  const handleAction = () => {
    if (onAction) {
      onAction(insight);
      return;
    }

    // Default navigation action
    if (insight.action_type === 'navigate' && insight.action_data?.route) {
      navigate(insight.action_data.route as string);
    }
  };

  return (
    <div 
      className={cn(
        'relative p-3 rounded-xl border transition-all duration-200 hover:shadow-md',
        config.bgClass,
        PRIORITY_STYLES[insight.priority]
      )}
    >
      {/* Dismiss button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(insight.id);
        }}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/50 transition-colors"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>

      <div className="flex gap-3">
        {/* Icon */}
        <div className={cn('p-2 rounded-lg bg-background/50 h-fit', config.iconClass)}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-[10px] font-medium uppercase tracking-wide', config.iconClass)}>
              {config.label}
            </span>
            {insight.priority === 'critical' && (
              <span className="text-[10px] bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full font-medium">
                URGENT
              </span>
            )}
          </div>
          
          <h4 className="font-medium text-sm leading-tight mb-1 line-clamp-2">
            {insight.title}
          </h4>
          
          <p className="text-xs text-muted-foreground line-clamp-2">
            {insight.description}
          </p>

          {/* Action button */}
          {insight.action_type && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAction}
              className="h-7 mt-2 px-2 text-xs gap-1 hover:bg-background/50"
            >
              View Details
              <ChevronRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
