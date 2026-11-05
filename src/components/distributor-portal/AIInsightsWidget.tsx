import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIInsight {
  id: string;
  type: 'tip' | 'warning' | 'opportunity' | 'trend';
  title: string;
  description: string;
  action?: string;
}

interface AIInsightsWidgetProps {
  distributorId: string;
}

// Static AI insights - in production, these would come from an AI service
const generateInsights = (): AIInsight[] => {
  const allInsights: AIInsight[] = [
    {
      id: '1',
      type: 'opportunity',
      title: 'Bulk Order Opportunity',
      description: 'Based on your order patterns, placing larger orders could save 12% on logistics costs.',
      action: 'Review Order History',
    },
    {
      id: '2',
      type: 'warning',
      title: 'Low Stock Alert',
      description: 'Top 3 selling products are running low. Consider reordering within 3 days.',
      action: 'View Inventory',
    },
    {
      id: '3',
      type: 'trend',
      title: 'Sales Trend',
      description: 'Your secondary sales have increased 18% this month compared to last month.',
    },
    {
      id: '4',
      type: 'tip',
      title: 'Scheme Optimization',
      description: 'Combine current schemes with bulk orders to maximize your margin this quarter.',
      action: 'View Schemes',
    },
    {
      id: '5',
      type: 'opportunity',
      title: 'Territory Expansion',
      description: 'Retailers in adjacent areas show high demand for your top products.',
    },
    {
      id: '6',
      type: 'trend',
      title: 'Seasonal Pattern',
      description: 'Based on last year data, expect 25% increase in demand next month.',
    },
  ];

  // Return random 3 insights
  return allInsights.sort(() => Math.random() - 0.5).slice(0, 3);
};

export const AIInsightsWidget = ({ distributorId }: AIInsightsWidgetProps) => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setInsights(generateInsights());
      setLoading(false);
    }, 500);
  };

  const refreshInsights = () => {
    setRefreshing(true);
    setTimeout(() => {
      setInsights(generateInsights());
      setRefreshing(false);
    }, 1000);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity':
        return <TrendingUp className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      case 'trend':
        return <TrendingUp className="w-4 h-4" />;
      case 'tip':
        return <Lightbulb className="w-4 h-4" />;
      default:
        return <Sparkles className="w-4 h-4" />;
    }
  };

  const getInsightStyle = (type: string) => {
    switch (type) {
      case 'opportunity':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      case 'warning':
        return 'bg-amber-500/10 text-amber-600 border-amber-200';
      case 'trend':
        return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'tip':
        return 'bg-purple-500/10 text-purple-600 border-purple-200';
      default:
        return 'bg-primary/10 text-primary';
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">AI Insights</CardTitle>
              <p className="text-xs text-muted-foreground">Personalized recommendations</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={refreshInsights}
            disabled={refreshing}
            className="text-purple-600"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {insights.map((insight) => (
          <div 
            key={insight.id}
            className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-lg flex-shrink-0",
                getInsightStyle(insight.type)
              )}>
                {getInsightIcon(insight.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">{insight.title}</h4>
                  <Badge variant="outline" className="text-xs capitalize">
                    {insight.type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {insight.description}
                </p>
                {insight.action && (
                  <Button variant="link" size="sm" className="p-0 h-auto mt-2 text-primary">
                    {insight.action}
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
