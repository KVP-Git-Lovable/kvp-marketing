import { CreditCard, AlertTriangle, CheckCircle2, TrendingUp, IndianRupee } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface CreditLimitWidgetProps {
  creditLimit: number;
  outstandingAmount: number;
  score?: number;
  scoreLabel?: string;
  compact?: boolean;
  showProgress?: boolean;
}

export const CreditLimitWidget = ({
  creditLimit,
  outstandingAmount,
  score,
  scoreLabel,
  compact = false,
  showProgress = true
}: CreditLimitWidgetProps) => {
  const availableCredit = Math.max(0, creditLimit - outstandingAmount);
  const utilizationPercent = creditLimit > 0 ? Math.min(100, (outstandingAmount / creditLimit) * 100) : 0;
  
  const getUtilizationStatus = (percent: number) => {
    if (percent >= 90) return { status: "critical", color: "text-red-600", bg: "bg-red-500", label: "Near Limit" };
    if (percent >= 70) return { status: "warning", color: "text-orange-600", bg: "bg-orange-500", label: "High Usage" };
    if (percent >= 50) return { status: "moderate", color: "text-yellow-600", bg: "bg-yellow-500", label: "Moderate" };
    return { status: "healthy", color: "text-green-600", bg: "bg-green-500", label: "Healthy" };
  };

  const utilStatus = getUtilizationStatus(utilizationPercent);

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-2 bg-secondary/30 rounded-lg">
        <div className="p-1.5 bg-primary/10 rounded">
          <CreditCard className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Credit Limit</span>
            <Badge variant="outline" className={cn("text-xs", utilStatus.color)}>
              {utilizationPercent.toFixed(0)}% used
            </Badge>
          </div>
          <div className="flex justify-between items-center mt-0.5">
            <span className="text-sm font-semibold">₹{availableCredit.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">of ₹{creditLimit.toLocaleString()}</span>
          </div>
          {showProgress && (
            <Progress value={utilizationPercent} className="h-1 mt-1" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-card border rounded-lg shadow-sm space-y-4">
      {/* Header with Score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold">Credit Status</h4>
            {score !== undefined && (
              <p className="text-xs text-muted-foreground">
                Score: {score.toFixed(1)}/10 {scoreLabel && `(${scoreLabel})`}
              </p>
            )}
          </div>
        </div>
        <Badge className={cn(utilStatus.color, "bg-secondary")}>
          {utilStatus.label}
        </Badge>
      </div>

      {/* Credit Details */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 bg-secondary/30 rounded-lg">
          <p className="text-xs text-muted-foreground">Limit</p>
          <p className="text-lg font-bold text-primary">₹{creditLimit.toLocaleString()}</p>
        </div>
        <div className="text-center p-2 bg-secondary/30 rounded-lg">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className={cn("text-lg font-bold", outstandingAmount > 0 ? "text-orange-600" : "text-green-600")}>
            ₹{outstandingAmount.toLocaleString()}
          </p>
        </div>
        <div className="text-center p-2 bg-secondary/30 rounded-lg">
          <p className="text-xs text-muted-foreground">Available</p>
          <p className={cn("text-lg font-bold", availableCredit > 0 ? "text-green-600" : "text-red-600")}>
            ₹{availableCredit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Utilization Bar */}
      {showProgress && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Credit Utilization</span>
            <span>{utilizationPercent.toFixed(0)}%</span>
          </div>
          <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
            <div 
              className={cn("h-full transition-all duration-500", utilStatus.bg)}
              style={{ width: `${utilizationPercent}%` }}
            />
            {/* Warning markers */}
            <div className="absolute top-0 left-[70%] w-px h-full bg-orange-300" />
            <div className="absolute top-0 left-[90%] w-px h-full bg-red-300" />
          </div>
        </div>
      )}

      {/* Status Messages */}
      {utilizationPercent >= 90 && (
        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-100 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <p className="text-xs text-red-700">
            Credit limit almost exhausted. Clear dues to enable more orders.
          </p>
        </div>
      )}
      
      {utilizationPercent < 50 && availableCredit > 0 && (
        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-100 rounded-lg">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <p className="text-xs text-green-700">
            Healthy credit status. ₹{availableCredit.toLocaleString()} available for new orders.
          </p>
        </div>
      )}
    </div>
  );
};
