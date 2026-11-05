import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface BusinessSummaryCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  onClick?: () => void;
  isLoading?: boolean;
  className?: string;
  iconBgClass?: string;
}

export const BusinessSummaryCard = ({
  title,
  value,
  icon,
  trend,
  onClick,
  isLoading = false,
  className,
  iconBgClass = "bg-primary/10"
}: BusinessSummaryCardProps) => {
  if (isLoading) {
    return (
      <Card className={cn("shadow-md", className)}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "shadow-md transition-all duration-200 cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className={cn("p-1.5 md:p-2 rounded-md flex-shrink-0", iconBgClass)}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[8px] md:text-[10px] text-muted-foreground leading-tight truncate">{title}</p>
            <p className="text-sm md:text-base font-bold leading-tight">{value}</p>
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-0.5 text-[10px] font-medium flex-shrink-0",
              trend.isPositive ? "text-green-600" : "text-red-600"
            )}>
              {trend.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
