import { useState } from "react";
import { MapPin, Sparkles, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { useUserTargetProgress, TargetPeriod, TargetBasis } from "@/hooks/useUserTargetProgress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface TargetVsActualCardProps {
  userId: string | undefined;
  compact?: boolean;
}

// Grouped period options - Past and Future
const PAST_PERIOD_OPTIONS: { value: TargetPeriod; label: string }[] = [
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_quarter', label: 'Last Quarter' },
];

const FUTURE_PERIOD_OPTIONS: { value: TargetPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This FY' },
];

const BASIS_OPTIONS: { value: TargetBasis; label: string }[] = [
  { value: 'quantity', label: 'Quantity' },
  { value: 'revenue', label: 'Revenue' },
];

export const TargetVsActualCard = ({ userId, compact = false }: TargetVsActualCardProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [targetPeriod, setTargetPeriod] = useState<TargetPeriod>('today');
  const [targetBasis, setTargetBasis] = useState<TargetBasis>('quantity');

  const { target, actual, progress, gap, unit, isLoading: targetLoading } = useUserTargetProgress(
    userId,
    targetPeriod,
    targetBasis
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatQuantity = (qty: number, unitLabel: string) => {
    // Don't use K suffix for quantity - always show actual number with unit
    return `${qty.toLocaleString('en-IN', { maximumFractionDigits: 1 })} ${unitLabel}`;
  };

  const formatValue = (value: number) => {
    if (targetBasis === 'revenue') {
      return formatCurrency(value);
    }
    return formatQuantity(value, unit);
  };

  const formatDeltaValue = (deltaValue: number) => {
    const absValue = Math.abs(deltaValue);
    if (targetBasis === 'revenue') {
      // Format with K/L/Cr suffix for compact display (no +/- here; label handles it)
      if (absValue >= 10000000) return `₹${(absValue / 10000000).toFixed(1)}Cr`;
      if (absValue >= 100000) return `₹${(absValue / 100000).toFixed(1)}L`;
      if (absValue >= 1000) return `₹${(absValue / 1000).toFixed(1)}K`;
      return `₹${Math.round(absValue)}`;
    }
    // For quantity - always show with unit, no K suffix
    return `${absValue.toLocaleString('en-IN', { maximumFractionDigits: 1 })} ${unit}`;
  };

  const getDeltaLabel = () => {
    if (gap > 0) return 'Overachieved';
    if (gap < 0) return 'Gap';
    return 'On Target';
  };

  const getGapColor = () => {
    if (gap >= 0) return 'text-success';
    return 'text-destructive';
  };

  const getGapBgColor = () => {
    if (gap >= 0) return 'bg-success/10 border-success/20';
    return 'bg-destructive/10 border-destructive/20';
  };

  const getPeriodLabel = (period: TargetPeriod) => {
    const allOptions = [...PAST_PERIOD_OPTIONS, ...FUTURE_PERIOD_OPTIONS];
    return allOptions.find(opt => opt.value === period)?.label || period;
  };

  const getProgressColor = () => {
    if (progress >= 100) return 'text-success';
    if (progress >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getProgressBgColor = () => {
    if (progress >= 100) return 'bg-success';
    if (progress >= 50) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "justify-between gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10",
            compact ? "h-8 text-xs px-2" : "h-9 text-sm px-3"
          )}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className={cn("text-primary", compact ? "h-3 w-3" : "h-4 w-4")} />
            <span>Target vs Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("font-bold", getProgressColor())}>
              {targetLoading ? '...' : `${progress}%`}
            </span>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2">
        <div className="space-y-3 p-3 rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
          {/* Period & Basis Selectors */}
          <div className="flex gap-2">
            <Select value={targetPeriod} onValueChange={(v) => setTargetPeriod(v as TargetPeriod)}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">Current / Future</SelectLabel>
                  {FUTURE_PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">Past</SelectLabel>
                  {PAST_PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select value={targetBasis} onValueChange={(v) => setTargetBasis(v as TargetBasis)}>
              <SelectTrigger className="h-7 text-xs w-24">
                <SelectValue placeholder="Basis" />
              </SelectTrigger>
              <SelectContent>
                {BASIS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Display */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">
                Target ({getPeriodLabel(targetPeriod)})
              </p>
              <p className="text-xs font-bold text-foreground">
                {targetLoading ? '...' : formatValue(target)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground mb-0.5">Achievement</p>
              <p className={cn("text-xs font-bold", getProgressColor())}>
                {targetLoading ? '...' : `${progress}%`}
              </p>
            </div>
          </div>
          
          {/* Progress Bar with Actual Marker */}
          <div className="relative h-10 flex items-center">
            {/* Track */}
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", getProgressBgColor())}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>

            {/* Pin Marker - positioned above the line showing Actual */}
            <div 
              className="absolute -translate-x-1/2 z-10 transition-all duration-500"
              style={{ left: `${Math.min(Math.max(progress, 5), 95)}%`, top: '-14px' }}
            >
              <div className="flex flex-col items-center">
                <div className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded shadow-lg text-[9px] font-bold whitespace-nowrap border border-background">
                  {targetLoading ? '...' : formatValue(actual)}
                </div>
                <MapPin className="h-3.5 w-3.5 text-primary drop-shadow fill-primary -mt-0.5" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-1">
            {!targetLoading && target > 0 && (
              <div className={cn(
                "text-[10px] font-medium px-2 py-1 rounded border flex-shrink-0",
                getGapColor(),
                getGapBgColor()
              )}>
                {gap === 0
                  ? 'On Target ✓'
                  : gap > 0
                    ? `${getDeltaLabel()}: +${formatDeltaValue(gap)}`
                    : `${getDeltaLabel()}: ${formatDeltaValue(gap)}`}

              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/target-advisor?period=${targetPeriod}`)}
              className="text-[10px] h-6 gap-1 flex-1"
            >
              <Sparkles className="h-3 w-3" />
              Advisor
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/performance-dashboard')}
              className="text-[10px] h-6 gap-1 flex-1"
            >
              <BarChart3 className="h-3 w-3" />
              Performance
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
