import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Package, IndianRupee, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { OverallPerformance } from '@/hooks/usePerformanceSummary';

interface OverallPerformanceHeaderProps {
  performance: OverallPerformance;
  isLoading?: boolean;
  period?: string;
}

const formatCurrency = (amount: number): string => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
};

const formatQuantity = (qty: number, unit: string): string => {
  // For Kg quantities, show decimal precision without K suffix to avoid confusion
  if (qty >= 1000) return `${(qty / 1000).toFixed(2)}K`;
  return `${qty.toFixed(1)}`;
};

const getProgressColor = (progress: number): string => {
  if (progress >= 80) return 'bg-green-500';
  if (progress >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getProgressBg = (progress: number): string => {
  if (progress >= 80) return 'bg-green-100';
  if (progress >= 50) return 'bg-yellow-100';
  return 'bg-red-100';
};

export function OverallPerformanceHeader({ performance, isLoading, period = 'this_month' }: OverallPerformanceHeaderProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="animate-pulse">
            <CardContent className="p-6 h-40 bg-muted/50" />
          </Card>
          <Card className="animate-pulse">
            <CardContent className="p-6 h-40 bg-muted/50" />
          </Card>
        </div>
      </div>
    );
  }

  const revenueOnTrack = performance.revenueProgress >= 80;
  const quantityOnTrack = performance.quantityProgress >= 80;
  const hasGap = performance.revenueGap > 0 || performance.quantityGap > 0;

  return (
    <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Revenue Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className={cn(
            "p-4 text-white",
            revenueOnTrack ? "bg-gradient-to-r from-green-500 to-green-600" : 
            performance.revenueProgress >= 50 ? "bg-gradient-to-r from-yellow-500 to-yellow-600" :
            "bg-gradient-to-r from-red-500 to-red-600"
          )}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-5 w-5" />
                <span className="font-semibold">Revenue</span>
              </div>
              <div className="flex items-center gap-1">
                {revenueOnTrack ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span className="text-sm font-medium">{performance.revenueProgress}%</span>
              </div>
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(performance.revenueActual)}
            </div>
            <div className="text-sm opacity-90">
              of {formatCurrency(performance.revenueTarget)} target
            </div>
          </div>
          <div className="p-4 bg-card">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">Gap: {formatCurrency(performance.revenueGap)}</span>
            </div>
            <div className={cn("h-2 rounded-full overflow-hidden", getProgressBg(performance.revenueProgress))}>
              <div 
                className={cn("h-full rounded-full transition-all duration-500", getProgressColor(performance.revenueProgress))}
                style={{ width: `${Math.min(performance.revenueProgress, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quantity Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className={cn(
            "p-4 text-white",
            quantityOnTrack ? "bg-gradient-to-r from-green-500 to-green-600" : 
            performance.quantityProgress >= 50 ? "bg-gradient-to-r from-yellow-500 to-yellow-600" :
            "bg-gradient-to-r from-red-500 to-red-600"
          )}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <span className="font-semibold">Quantity (Kg)</span>
              </div>
              <div className="flex items-center gap-1">
                {quantityOnTrack ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span className="text-sm font-medium">{Math.min(performance.quantityProgress, 999)}%</span>
              </div>
            </div>
            <div className="text-2xl font-bold">
              {formatQuantity(performance.quantityActual, '')} Kg
            </div>
            <div className="text-sm opacity-90">
              of {formatQuantity(performance.quantityTarget, '')} Kg target
            </div>
          </div>
          <div className="p-4 bg-card">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">Gap: {formatQuantity(performance.quantityGap, '')} Kg</span>
            </div>
            <div className={cn("h-2 rounded-full overflow-hidden", getProgressBg(performance.quantityProgress))}>
              <div 
                className={cn("h-full rounded-full transition-all duration-500", getProgressColor(performance.quantityProgress))}
                style={{ width: `${Math.min(performance.quantityProgress, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    
    {/* Target Advisor Button - Always visible below progress bars */}
    <Button
      onClick={() => navigate(`/target-advisor?period=${period}`)}
      className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 gap-2"
    >
      <Sparkles className="h-4 w-4" />
      Target Advisor - Get AI Recommendations
    </Button>
    </div>
  );
}
