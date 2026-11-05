import { TrendingUp, Clock, ShoppingCart, Lightbulb, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface CreditScoreRationaleProps {
  score: number;
  growthRateScore?: number;
  repaymentDsoScore?: number;
  orderFrequencyScore?: number;
  avgGrowthRate?: number;
  avgDso?: number;
  avgOrderFrequency?: number;
  weightGrowthRate?: number;
  weightRepaymentDso?: number;
  weightOrderFrequency?: number;
  targetDays?: number;
  isNewRetailer?: boolean;
  compact?: boolean;
}

export const CreditScoreRationale = ({
  score,
  growthRateScore = 0,
  repaymentDsoScore = 0,
  orderFrequencyScore = 0,
  avgGrowthRate = 0,
  avgDso = 0,
  avgOrderFrequency = 0,
  weightGrowthRate = 4,
  weightRepaymentDso = 4,
  weightOrderFrequency = 2,
  targetDays = 30,
  isNewRetailer = false,
  compact = false
}: CreditScoreRationaleProps) => {

  const getScoreLabel = (score: number) => {
    if (score >= 8) return { label: "Excellent", color: "text-green-600", bg: "bg-green-50" };
    if (score >= 6) return { label: "Good", color: "text-yellow-600", bg: "bg-yellow-50" };
    if (score >= 4) return { label: "Fair", color: "text-orange-600", bg: "bg-orange-50" };
    return { label: "Needs Improvement", color: "text-red-600", bg: "bg-red-50" };
  };

  const getFactorPerformance = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return { status: "excellent", icon: ArrowUp, color: "text-green-600" };
    if (percentage >= 60) return { status: "good", icon: Minus, color: "text-yellow-600" };
    return { status: "needs_improvement", icon: ArrowDown, color: "text-red-600" };
  };

  const scoreInfo = getScoreLabel(score);
  
  // Find lowest scoring factor for improvement tip
  const factors = [
    { 
      name: "Growth Rate", 
      score: growthRateScore, 
      max: weightGrowthRate,
      percentage: (growthRateScore / weightGrowthRate) * 100,
      tip: "Increase your monthly order value to improve this score",
      icon: TrendingUp,
      value: `${avgGrowthRate?.toFixed(1)}% monthly growth`
    },
    { 
      name: "Payment Speed", 
      score: repaymentDsoScore, 
      max: weightRepaymentDso,
      percentage: (repaymentDsoScore / weightRepaymentDso) * 100,
      tip: `Pay within ${targetDays} days to maximize this score`,
      icon: Clock,
      value: `${avgDso?.toFixed(0)} days average`
    },
    { 
      name: "Order Frequency", 
      score: orderFrequencyScore, 
      max: weightOrderFrequency,
      percentage: (orderFrequencyScore / weightOrderFrequency) * 100,
      tip: "Order more frequently during visits to improve this score",
      icon: ShoppingCart,
      value: `${avgOrderFrequency?.toFixed(1)} orders per visit`
    }
  ];

  const lowestFactor = factors.reduce((a, b) => a.percentage < b.percentage ? a : b);

  if (isNewRetailer) {
    return (
      <div className="space-y-3">
        <div className={cn("p-3 rounded-lg", scoreInfo.bg)}>
          <p className="text-sm font-medium">New Retailer</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your score will be calculated after more order history is available. 
            Currently using default starting score.
          </p>
        </div>
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Build Your Score</p>
              <p className="text-xs text-muted-foreground mt-1">
                Place regular orders and pay on time to build a strong credit history.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {factors.map((factor) => {
          const perf = getFactorPerformance(factor.score, factor.max);
          const Icon = factor.icon;
          return (
            <div key={factor.name} className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex justify-between items-center text-xs">
                  <span>{factor.name}</span>
                  <span className={cn("font-medium", perf.color)}>
                    {factor.score.toFixed(1)}/{factor.max}
                  </span>
                </div>
                <Progress 
                  value={factor.percentage} 
                  className="h-1 mt-0.5"
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score Header */}
      <div className={cn("p-3 rounded-lg flex items-center justify-between", scoreInfo.bg)}>
        <div>
          <p className="text-sm font-medium">Credit Score</p>
          <p className={cn("text-2xl font-bold", scoreInfo.color)}>{score.toFixed(1)}/10</p>
        </div>
        <Badge className={cn(scoreInfo.color, "bg-white/80")}>{scoreInfo.label}</Badge>
      </div>

      {/* Score Breakdown */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          What Drives Your Score
        </p>
        
        {factors.map((factor) => {
          const perf = getFactorPerformance(factor.score, factor.max);
          const Icon = factor.icon;
          const PerfIcon = perf.icon;
          return (
            <div key={factor.name} className="p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-primary/10 rounded">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{factor.name}</span>
                    <div className="flex items-center gap-1">
                      <PerfIcon className={cn("h-3 w-3", perf.color)} />
                      <span className="text-sm font-bold">
                        {factor.score.toFixed(1)}/{factor.max}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{factor.value}</p>
                  <Progress 
                    value={factor.percentage} 
                    className="h-1.5 mt-2"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Improvement Tip */}
      {lowestFactor.percentage < 80 && (
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">How to Improve</p>
              <p className="text-xs text-muted-foreground mt-1">
                Focus on <strong>{lowestFactor.name}</strong>: {lowestFactor.tip}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
