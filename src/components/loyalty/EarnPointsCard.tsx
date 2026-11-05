import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ShoppingCart, CreditCard, Calendar, Flame, Sparkles, 
  Package, TrendingUp, Award, Target
} from "lucide-react";

interface EarnPointsCardProps {
  parameter: {
    id: string;
    parameter_type: string;
    parameter_name: string;
    description?: string | null;
    points: number;
    min_value?: number | null;
    max_value?: number | null;
    frequency_days?: number | null;
    consecutive_required?: number | null;
    growth_percentage?: number | null;
    target_value?: number | null;
    tier_config?: any;
  };
  expanded?: boolean;
}

export function EarnPointsCard({ parameter, expanded }: EarnPointsCardProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "order_value": return <ShoppingCart className="h-4 w-4" />;
      case "payment_timeliness": return <CreditCard className="h-4 w-4" />;
      case "order_frequency": return <Calendar className="h-4 w-4" />;
      case "consecutive_orders": return <Flame className="h-4 w-4" />;
      case "new_product": return <Sparkles className="h-4 w-4" />;
      case "bulk_order": return <Package className="h-4 w-4" />;
      case "growth": return <TrendingUp className="h-4 w-4" />;
      case "target_achievement": return <Target className="h-4 w-4" />;
      default: return <Award className="h-4 w-4" />;
    }
  };

  const getColorClass = (type: string) => {
    switch (type) {
      case "order_value": return "bg-blue-100 text-blue-700";
      case "payment_timeliness": return "bg-green-100 text-green-700";
      case "order_frequency": return "bg-purple-100 text-purple-700";
      case "consecutive_orders": return "bg-orange-100 text-orange-700";
      case "new_product": return "bg-pink-100 text-pink-700";
      case "bulk_order": return "bg-indigo-100 text-indigo-700";
      case "growth": return "bg-emerald-100 text-emerald-700";
      default: return "bg-primary/10 text-primary";
    }
  };

  const getActionTip = (param: typeof parameter) => {
    switch (param.parameter_type) {
      case "order_value":
        if (param.min_value) {
          return `Place orders of ₹${param.min_value.toLocaleString()}+ to earn points`;
        }
        return "Higher order values = more points";
      case "payment_timeliness":
        return "Pay on or before due date to earn bonus";
      case "order_frequency":
        if (param.frequency_days) {
          return `Order every ${param.frequency_days} days to maintain streak`;
        }
        return "Regular orders earn bonus points";
      case "consecutive_orders":
        if (param.consecutive_required) {
          return `${param.consecutive_required} consecutive orders unlock bonus`;
        }
        return "Keep ordering consistently for streak bonus";
      case "new_product":
        return "Try new products you haven't ordered before";
      case "bulk_order":
        if (param.min_value) {
          return `Order ${param.min_value}+ units to earn bulk bonus`;
        }
        return "Large quantity orders earn extra points";
      case "growth":
        if (param.growth_percentage) {
          return `Grow your orders by ${param.growth_percentage}% vs last month`;
        }
        return "Increase your monthly order value";
      case "target_achievement":
        if (param.target_value) {
          return `Hit ₹${param.target_value.toLocaleString()} monthly target`;
        }
        return "Achieve your monthly target for bonus";
      default:
        return param.description || "Complete this action to earn points";
    }
  };

  const colorClass = getColorClass(parameter.parameter_type);

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className={`${expanded ? 'p-4' : 'p-3'}`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${colorClass}`}>
            {getIcon(parameter.parameter_type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-sm">{parameter.parameter_name}</h4>
              <Badge className="bg-amber-100 text-amber-700 border-0 shrink-0">
                +{parameter.points} pts
              </Badge>
            </div>
            {expanded && (
              <>
                <p className="text-xs text-muted-foreground mt-1">
                  {getActionTip(parameter)}
                </p>
                {/* Tier info if available */}
                {parameter.tier_config && Array.isArray(parameter.tier_config) && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {parameter.tier_config.slice(0, 3).map((tier: any, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">
                        ₹{tier.min_value?.toLocaleString()}+ = {tier.points} pts
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
