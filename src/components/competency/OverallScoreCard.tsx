import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface OverallScoreCardProps {
  score: number;
  performanceBand: 'exceptional' | 'strong' | 'developing' | 'needs_improvement';
  previousScore?: number;
  rankInTeam?: number | null;
  totalTeamMembers?: number | null;
  className?: string;
}

const bandConfig = {
  exceptional: {
    label: 'Exceptional',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    gradient: 'from-green-500 to-emerald-500',
  },
  strong: {
    label: 'Strong',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    gradient: 'from-blue-500 to-cyan-500',
  },
  developing: {
    label: 'Developing',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    gradient: 'from-amber-500 to-orange-500',
  },
  needs_improvement: {
    label: 'Needs Improvement',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    gradient: 'from-red-500 to-rose-500',
  },
};

export function OverallScoreCard({
  score,
  performanceBand,
  previousScore,
  rankInTeam,
  totalTeamMembers,
  className,
}: OverallScoreCardProps) {
  const config = bandConfig[performanceBand] || bandConfig.developing;
  const scoreDiff = previousScore ? score - previousScore : 0;
  const trendDirection = scoreDiff > 2 ? 'up' : scoreDiff < -2 ? 'down' : 'stable';

  // Calculate stroke dasharray for the circular progress
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-center gap-6">
          {/* Circular Score */}
          <div className="relative flex-shrink-0">
            <svg width="160" height="160" className="transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted/20"
              />
              {/* Progress circle */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={`url(#gradient-${performanceBand})`}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id={`gradient-${performanceBand}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className={cn("stop-color-current", config.gradient.split(' ')[0].replace('from-', 'text-'))} stopColor="currentColor" />
                  <stop offset="100%" className={cn("stop-color-current", config.gradient.split(' ')[1].replace('to-', 'text-'))} stopColor="currentColor" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold">{Math.round(score)}</span>
              <span className="text-sm text-muted-foreground">out of 100</span>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 space-y-4">
            {/* Performance Band Badge */}
            <div className={cn("inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium", config.bg, config.color, config.border, "border")}>
              {config.label}
            </div>

            {/* Trend */}
            {previousScore !== undefined && (
              <div className="flex items-center gap-2">
                {trendDirection === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : trendDirection === 'down' ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  trendDirection === 'up' && "text-green-600",
                  trendDirection === 'down' && "text-red-600",
                  trendDirection === 'stable' && "text-muted-foreground"
                )}>
                  {scoreDiff > 0 ? '+' : ''}{scoreDiff.toFixed(1)} vs last month
                </span>
              </div>
            )}

            {/* Team Rank */}
            {rankInTeam && totalTeamMembers && (
              <div className="text-sm text-muted-foreground">
                Ranked <span className="font-semibold text-foreground">#{rankInTeam}</span> of {totalTeamMembers} in team
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
