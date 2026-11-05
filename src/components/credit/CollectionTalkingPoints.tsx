import { MessageSquare, Lightbulb, TrendingUp, Clock, Gift, Star, IndianRupee, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CollectionTalkingPointsProps {
  outstandingAmount: number;
  creditLimit: number;
  creditScore?: number;
  avgDso?: number;
  targetDays?: number;
  loyaltyPoints?: number;
  onTimePaymentBonus?: number;
  retailerName?: string;
  compact?: boolean;
}

export const CollectionTalkingPoints = ({
  outstandingAmount,
  creditLimit,
  creditScore = 0,
  avgDso = 0,
  targetDays = 30,
  loyaltyPoints = 0,
  onTimePaymentBonus = 50,
  retailerName = "the retailer",
  compact = false
}: CollectionTalkingPointsProps) => {
  const utilizationPercent = creditLimit > 0 ? (outstandingAmount / creditLimit) * 100 : 0;
  const availableCredit = Math.max(0, creditLimit - outstandingAmount);
  const isPastDue = avgDso > targetDays;
  const potentialScoreImprovement = isPastDue ? Math.min(1.5, (avgDso - targetDays) / 10 * 0.5) : 0;

  const talkingPoints = [];

  // Point 1: Current outstanding status
  if (outstandingAmount > 0) {
    talkingPoints.push({
      icon: IndianRupee,
      title: "Outstanding Balance",
      message: `Current dues: ₹${outstandingAmount.toLocaleString()}`,
      highlight: `${utilizationPercent.toFixed(0)}% of credit limit used`,
      type: utilizationPercent > 70 ? "warning" : "info"
    });
  }

  // Point 2: Payment timing impact
  if (isPastDue) {
    talkingPoints.push({
      icon: Clock,
      title: "Payment Timing Matters",
      message: `Paying on time (within ${targetDays} days) can improve credit score by up to ${potentialScoreImprovement.toFixed(1)} points`,
      highlight: `Current avg: ${avgDso.toFixed(0)} days`,
      type: "warning"
    });
  } else if (avgDso > 0) {
    talkingPoints.push({
      icon: CheckCircle2,
      title: "Great Payment History!",
      message: `Average payment time: ${avgDso.toFixed(0)} days - within target of ${targetDays} days`,
      highlight: "Keep it up!",
      type: "success"
    });
  }

  // Point 3: Credit score impact
  if (creditScore > 0 && creditScore < 8) {
    talkingPoints.push({
      icon: TrendingUp,
      title: "Credit Score Opportunity",
      message: `Clearing dues today can help improve credit score from ${creditScore.toFixed(1)} towards 8+`,
      highlight: "Higher score = Higher credit limit",
      type: "info"
    });
  }

  // Point 4: Loyalty points incentive
  if (onTimePaymentBonus > 0) {
    talkingPoints.push({
      icon: Gift,
      title: "Loyalty Points Bonus",
      message: `Earn ${onTimePaymentBonus} bonus loyalty points for clearing dues today!`,
      highlight: loyaltyPoints > 0 ? `Current points: ${loyaltyPoints}` : "Start earning today",
      type: "success"
    });
  }

  // Point 5: Available credit reminder
  if (availableCredit > 0) {
    talkingPoints.push({
      icon: Star,
      title: "More Ordering Power",
      message: `₹${availableCredit.toLocaleString()} credit available for new orders`,
      highlight: "Full payment unlocks full limit",
      type: "info"
    });
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Talking Points
          </span>
        </div>
        {talkingPoints.slice(0, 3).map((point, index) => {
          const Icon = point.icon;
          return (
            <div 
              key={index}
              className={cn(
                "flex items-start gap-2 p-2 rounded-lg text-xs",
                point.type === "warning" ? "bg-orange-50 text-orange-800" :
                point.type === "success" ? "bg-green-50 text-green-800" :
                "bg-primary/5 text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">{point.title}</p>
                <p className="text-[10px] opacity-80">{point.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Talking Points for Collection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {talkingPoints.map((point, index) => {
          const Icon = point.icon;
          return (
            <div 
              key={index}
              className={cn(
                "p-3 rounded-lg border",
                point.type === "warning" ? "bg-orange-50 border-orange-100" :
                point.type === "success" ? "bg-green-50 border-green-100" :
                "bg-primary/5 border-primary/10"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-1.5 rounded",
                  point.type === "warning" ? "bg-orange-100" :
                  point.type === "success" ? "bg-green-100" :
                  "bg-primary/10"
                )}>
                  <Icon className={cn(
                    "h-4 w-4",
                    point.type === "warning" ? "text-orange-600" :
                    point.type === "success" ? "text-green-600" :
                    "text-primary"
                  )} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{point.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{point.message}</p>
                  {point.highlight && (
                    <Badge variant="secondary" className="mt-1.5 text-xs">
                      {point.highlight}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {talkingPoints.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>No outstanding dues - great payment history!</p>
          </div>
        )}

        {/* Quick Script */}
        <div className="p-3 bg-secondary/30 rounded-lg border border-secondary">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-primary mt-0.5" />
            <div>
              <p className="text-xs font-medium">Suggested Script</p>
              <p className="text-xs text-muted-foreground mt-1 italic">
                "{retailerName}, paying your ₹{outstandingAmount.toLocaleString()} dues today will 
                {potentialScoreImprovement > 0 ? ` boost your credit score by up to ${potentialScoreImprovement.toFixed(1)} points,` : ''} 
                {onTimePaymentBonus > 0 ? ` earn you ${onTimePaymentBonus} bonus loyalty points, and` : ''} 
                unlock your full ₹{creditLimit.toLocaleString()} credit limit for bigger orders!"
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
