import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, TrendingUp, Target, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import type { PerformanceData } from '@/hooks/usePerformanceSummary';

interface AIRecommendationsProps {
  overall: {
    revenueTarget: number;
    revenueActual: number;
    revenueProgress: number;
    quantityTarget: number;
    quantityActual: number;
    quantityProgress: number;
  };
  territories: PerformanceData[];
  beats: PerformanceData[];
  retailers: PerformanceData[];
  isLoading?: boolean;
}

interface Recommendation {
  id: string;
  type: 'action' | 'insight' | 'warning' | 'success';
  title: string;
  description: string;
  action?: {
    label: string;
    path: string;
  };
  priority: 'high' | 'medium' | 'low';
}

function generateRecommendations(
  overall: AIRecommendationsProps['overall'],
  territories: PerformanceData[],
  beats: PerformanceData[],
  retailers: PerformanceData[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  
  // Overall performance insights
  if (overall.revenueProgress < 50) {
    recommendations.push({
      id: 'low-revenue',
      type: 'warning',
      title: 'Revenue Behind Target',
      description: `You're at ${overall.revenueProgress}% of your revenue target. Focus on high-value retailers and push key products to catch up.`,
      priority: 'high',
    });
  } else if (overall.revenueProgress >= 100) {
    recommendations.push({
      id: 'target-achieved',
      type: 'success',
      title: 'Excellent! Target Achieved',
      description: `You've exceeded your revenue target by ${(overall.revenueProgress - 100).toFixed(0)}%. Keep up the momentum!`,
      priority: 'low',
    });
  }

  // Find underperforming territories
  const underperformingTerritories = territories.filter(t => t.revenueProgress < 50);
  if (underperformingTerritories.length > 0) {
    const worst = underperformingTerritories.sort((a, b) => a.revenueProgress - b.revenueProgress)[0];
    recommendations.push({
      id: 'territory-focus',
      type: 'action',
      title: `Focus on ${worst.name}`,
      description: `This territory is at ${worst.revenueProgress}% of target. Increase visit frequency and identify high-potential retailers.`,
      action: {
        label: 'View Territory',
        path: `/territory/${worst.id}`,
      },
      priority: 'high',
    });
  }

  // Find retailers needing attention
  const needAttention = retailers.filter(r => r.revenueProgress < 50 && r.revenueTarget > 0);
  if (needAttention.length > 0) {
    recommendations.push({
      id: 'retailer-attention',
      type: 'action',
      title: `${needAttention.length} Retailers Need Attention`,
      description: `These retailers are below 50% of their targets. Schedule visits and understand their challenges.`,
      priority: 'high',
    });
  }

  // Top performing insights
  const topPerformers = retailers.filter(r => r.revenueProgress >= 100);
  if (topPerformers.length > 0) {
    recommendations.push({
      id: 'top-performers',
      type: 'insight',
      title: `${topPerformers.length} Retailers Exceeding Targets`,
      description: `Analyze what's working with these retailers and replicate success with others.`,
      priority: 'medium',
    });
  }

  // Beat coverage
  const activeBeats = beats.filter(b => b.revenueActual > 0);
  if (activeBeats.length < beats.length && beats.length > 0) {
    const inactiveCount = beats.length - activeBeats.length;
    recommendations.push({
      id: 'beat-coverage',
      type: 'warning',
      title: `${inactiveCount} Beats Without Orders`,
      description: `Some beats have no orders this period. Review your beat plan and ensure coverage.`,
      priority: 'medium',
    });
  }

  // Quantity vs Revenue gap
  if (overall.quantityProgress > 0 && overall.revenueProgress > 0) {
    const gap = overall.quantityProgress - overall.revenueProgress;
    if (gap > 20) {
      recommendations.push({
        id: 'value-mix',
        type: 'insight',
        title: 'Opportunity to Improve Value Mix',
        description: `Quantity achievement (${overall.quantityProgress}%) exceeds revenue (${overall.revenueProgress}%). Focus on higher-value products.`,
        priority: 'medium',
      });
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

const typeIcons = {
  action: Target,
  insight: TrendingUp,
  warning: AlertTriangle,
  success: CheckCircle2,
};

const typeStyles = {
  action: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
  insight: 'bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800',
  warning: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800',
  success: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
};

const iconStyles = {
  action: 'text-blue-600 dark:text-blue-400',
  insight: 'text-purple-600 dark:text-purple-400',
  warning: 'text-amber-600 dark:text-amber-400',
  success: 'text-green-600 dark:text-green-400',
};

export function AIRecommendations({ overall, territories, beats, retailers, isLoading }: AIRecommendationsProps) {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const recommendations = generateRecommendations(overall, territories, beats, retailers);

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
            <p>Great job! No immediate actions needed.</p>
            <p className="text-sm">Keep maintaining your performance.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Recommendations
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRefreshKey(k => k + 1)}
            className="text-muted-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.slice(0, 5).map((rec) => {
          const Icon = typeIcons[rec.type];
          return (
            <div
              key={rec.id}
              className={cn(
                "p-4 rounded-lg border transition-all",
                typeStyles[rec.type],
                rec.action && "cursor-pointer hover:shadow-md"
              )}
              onClick={() => rec.action && navigate(rec.action.path)}
            >
              <div className="flex items-start gap-3">
                <div className={cn("mt-0.5", iconStyles[rec.type])}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground">{rec.title}</h4>
                    {rec.priority === 'high' && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                        High Priority
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                  {rec.action && (
                    <div className="flex items-center gap-1 mt-2 text-sm text-primary font-medium">
                      {rec.action.label}
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
