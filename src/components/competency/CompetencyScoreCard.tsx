import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Map, TrendingUpIcon, IndianRupee, Clock, UserPlus, Package, Wallet, Users, GraduationCap, Calendar, Sparkles, MapPin } from "lucide-react";
import type { CompetencyScore } from "@/hooks/useCompetencyScores";

interface CompetencyScoreCardProps {
  score: CompetencyScore;
  compact?: boolean;
  onClick?: () => void;
}

const iconMap: Record<string, any> = {
  Map, TrendingUp: TrendingUpIcon, IndianRupee, Clock, UserPlus, Package, Wallet,
  Users, GraduationCap, Calendar, Sparkles, MapPin
};

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  productivity: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  achievement: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
  discipline: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  development: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
  leadership: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getProgressColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

export function CompetencyScoreCard({ score, compact = false, onClick }: CompetencyScoreCardProps) {
  const template = score.competency_templates;
  if (!template) return null;

  const IconComponent = iconMap[template.icon || 'Map'] || Map;
  const categoryStyle = categoryColors[template.category] || categoryColors.productivity;
  const trend = score.trend;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-lg border", categoryStyle.bg, categoryStyle.border)}>
        <div className={cn("p-2 rounded-lg", categoryStyle.bg)}>
          <IconComponent className={cn("h-4 w-4", categoryStyle.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate">{template.competency_name}</span>
            <span className={cn("text-sm font-bold", getScoreColor(score.score))}>{Math.round(score.score)}%</span>
          </div>
          <Progress value={score.score} className="h-1.5 mt-1" />
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("overflow-hidden", onClick && "cursor-pointer hover:shadow-lg transition-shadow")} onClick={onClick}>
      <CardHeader className={cn("pb-2", categoryStyle.bg)}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", categoryStyle.bg, categoryStyle.border, "border")}>
              <IconComponent className={cn("h-5 w-5", categoryStyle.text)} />
            </div>
            <div>
              <CardTitle className="text-base">{template.competency_name}</CardTitle>
              <p className="text-xs text-muted-foreground capitalize">{template.category}</p>
            </div>
          </div>
          <div className="text-right">
            <div className={cn("text-2xl font-bold", getScoreColor(score.score))}>
              {Math.round(score.score)}%
            </div>
            <div className="flex items-center justify-end gap-1 mt-0.5">
              {trend === 'improving' && <TrendingUp className="h-3 w-3 text-green-500" />}
              {trend === 'declining' && <TrendingDown className="h-3 w-3 text-red-500" />}
              {trend === 'stable' && <Minus className="h-3 w-3 text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">
                {score.previous_month_score ? `${score.previous_month_score.toFixed(0)}% prev` : 'New'}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-500", getProgressColor(score.score))}
            style={{ width: `${score.score}%` }}
          />
        </div>
        
        {/* Key Metrics */}
        {score.raw_metrics && Object.keys(score.raw_metrics).length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Object.entries(score.raw_metrics)
              .filter(([key]) => !['note', 'error'].includes(key))
              .slice(0, 4)
              .map(([key, value]) => (
                <div key={key} className="text-xs">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}: </span>
                  <span className="font-medium">{typeof value === 'number' ? value.toLocaleString() : value}</span>
                </div>
              ))
            }
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          Weight: {template.weightage}%
        </p>
      </CardContent>
    </Card>
  );
}
