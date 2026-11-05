import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  kpiName: string;
  target: number;
  actual: number;
  unit: string;
  achievement: number;
}

export const KPICard = ({ kpiName, target, actual, unit, achievement }: KPICardProps) => {
  const formatValue = (value: number) => {
    if (unit === 'currency') return `₹${value.toLocaleString()}`;
    if (unit === 'percentage') return `${value.toFixed(1)}%`;
    return value.toLocaleString();
  };

  const getProgressColor = () => {
    if (achievement >= 100) return "bg-chart-1";
    if (achievement >= 80) return "bg-chart-2";
    if (achievement >= 60) return "bg-chart-3";
    return "bg-destructive";
  };

  const getTrendIcon = () => {
    if (achievement >= 100) return <TrendingUp className="h-4 w-4 text-chart-1" />;
    if (achievement < 80) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-sm">{kpiName}</h3>
            {getTrendIcon()}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Target:</span>
              <span className="font-semibold">{formatValue(target)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Actual:</span>
              <span className="font-semibold text-primary">{formatValue(actual)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Progress value={Math.min(achievement, 100)} className="h-2" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Achievement</span>
              <span className={`text-sm font-bold ${achievement >= 80 ? 'text-chart-1' : 'text-muted-foreground'}`}>
                {achievement.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
