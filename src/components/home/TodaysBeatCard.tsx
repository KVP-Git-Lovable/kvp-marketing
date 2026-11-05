import { MapPin, Users, CheckCircle, Clock, TrendingUp, UserPlus, Zap, Sparkles, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { useUserTargetProgress, TargetPeriod, TargetBasis } from "@/hooks/useUserTargetProgress";
import { usePeriodStats } from "@/hooks/usePeriodStats";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface TodaysBeatCardProps {
  beatPlan: any | null;
  beatName: string | null;
  beatProgress: {
    total: number;
    completed: number;
    remaining: number;
    planned: number;
    productive: number;
    unproductive: number;
  };
  revenueTarget: number;
  revenueAchieved: number;
  newRetailers: number;
  potentialRevenue: number;
  points: number;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  showTarget?: boolean;
}

// These will be replaced with translated versions in the component
const PAST_PERIOD_OPTIONS: { value: TargetPeriod; labelKey: string }[] = [
  { value: 'yesterday', labelKey: 'home.yesterday' },
  { value: 'last_week', labelKey: 'home.lastWeek' },
  { value: 'last_month', labelKey: 'home.lastMonth' },
  { value: 'last_quarter', labelKey: 'home.lastQuarter' },
];

const FUTURE_PERIOD_OPTIONS: { value: TargetPeriod; labelKey: string }[] = [
  { value: 'today', labelKey: 'home.today' },
  { value: 'this_week', labelKey: 'home.thisWeek' },
  { value: 'this_month', labelKey: 'home.thisMonth' },
  { value: 'this_quarter', labelKey: 'home.thisQuarter' },
  { value: 'this_year', labelKey: 'home.thisFY' },
];

const BASIS_OPTIONS: { value: TargetBasis; labelKey: string }[] = [
  { value: 'quantity', labelKey: 'home.quantity' },
  { value: 'revenue', labelKey: 'home.revenue' },
];

export const TodaysBeatCard = ({ 
  beatPlan, 
  beatName,
  beatProgress,
  revenueTarget,
  revenueAchieved,
  newRetailers,
  potentialRevenue,
  points,
  selectedDate,
  onDateChange,
  showTarget = true
}: TodaysBeatCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const [targetPeriod, setTargetPeriod] = useState<TargetPeriod>('today');
  const [targetBasis, setTargetBasis] = useState<TargetBasis>('quantity');

  const { target, actual, progress, gap, unit, isLoading: targetLoading } = useUserTargetProgress(
    user?.id,
    targetPeriod,
    targetBasis
  );

  // Fetch period-based stats
  const { data: periodStats, isLoading: statsLoading } = usePeriodStats(user?.id, targetPeriod);

  // Use period stats when not 'today', otherwise use props
  const isToday = targetPeriod === 'today';
  const displayPlanned = isToday ? beatProgress.planned : (periodStats?.planned ?? 0);
  const displayProductive = isToday ? beatProgress.productive : (periodStats?.productive ?? 0);
  const displayRemaining = isToday ? beatProgress.remaining : (periodStats?.remaining ?? 0);
  const displayNewRetailers = isToday ? newRetailers : (periodStats?.newRetailers ?? 0);
  const displayPotentialRevenue = isToday ? potentialRevenue : (periodStats?.potentialRevenue ?? 0);
  const displayPoints = isToday ? points : (periodStats?.points ?? 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatCurrencyShort = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(2)}K`;
    return formatCurrency(amount);
  };

  const formatCurrencyNoDecimal = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatQuantity = (qty: number, unitLabel: string) => {
    // Quantity should always show the actual unit (Kg/Units), not "K" short-format
    return `${qty.toLocaleString('en-IN', { maximumFractionDigits: 1 })} ${unitLabel}`;
  };

  const formatValue = (value: number) => {
    if (targetBasis === 'revenue') {
      return formatCurrency(value);
    }
    return formatQuantity(value, unit);
  };

  const formatGapValue = (value: number) => {
    const absValue = Math.abs(value);
    if (targetBasis === 'revenue') {
      return formatCurrencyNoDecimal(absValue);
    }
    return formatQuantity(absValue, unit);
  };

  // Get display label for current period
  const getPeriodLabel = (period: TargetPeriod) => {
    const allOptions = [...PAST_PERIOD_OPTIONS, ...FUTURE_PERIOD_OPTIONS];
    const option = allOptions.find(opt => opt.value === period);
    return option ? t(option.labelKey) : period;
  };

  // Determine beat name display based on period
  const getDisplayBeatName = () => {
    if (isToday) {
      return beatName || beatPlan?.beat_name || t('home.notPlanned');
    }
    // For week/month/quarter/year periods, show a summary label
    if (periodStats && periodStats.planned > 0) {
      return `${getPeriodLabel(targetPeriod)} ${t('home.schedule')}`;
    }
    return beatName || beatPlan?.beat_name || t('home.noSchedule');
  };

  const displayBeatName = getDisplayBeatName();

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 shadow-lg overflow-hidden">
      <CardContent className="p-5 space-y-5">
        {/* Beat Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{displayBeatName}</h3>
            {!beatPlan && !beatName && (
              <p className="text-xs text-muted-foreground">{t('home.noBeatPlanned')}</p>
            )}
          </div>
        </div>

        {/* Target Progress Section */}
        {showTarget && <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
          {/* Period & Basis Selectors */}
          <div className="flex gap-2">
            <Select value={targetPeriod} onValueChange={(v) => setTargetPeriod(v as TargetPeriod)}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('home.currentFuture')}</SelectLabel>
                  {FUTURE_PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {t(opt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('home.past')}</SelectLabel>
                  {PAST_PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {t(opt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select value={targetBasis} onValueChange={(v) => setTargetBasis(v as TargetBasis)}>
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue placeholder="Basis" />
              </SelectTrigger>
              <SelectContent>
                {BASIS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Display - Fixed target for period */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                {t('home.target')} ({getPeriodLabel(targetPeriod)})
              </p>
              <p className="text-sm font-bold text-foreground">
                {targetLoading ? '...' : formatValue(target)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-0.5">{t('home.achievement')}</p>
              <p className={`text-sm font-bold ${progress >= 100 ? 'text-success' : progress >= 50 ? 'text-warning' : 'text-destructive'}`}>
                {targetLoading ? '...' : `${progress}%`}
              </p>
            </div>
          </div>
          
          <div className="relative h-12 flex items-center">
            {/* Track */}
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    progress >= 100 ? 'bg-gradient-to-r from-success to-success/80' :
                    progress >= 50 ? 'bg-gradient-to-r from-warning to-warning/80' :
                    'bg-gradient-to-r from-destructive to-destructive/80'
                  }`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>

            {/* Pin Marker - positioned above the line showing Actual */}
            <div 
              className="absolute -translate-x-1/2 z-10 transition-all duration-500"
              style={{ left: `${Math.min(Math.max(progress, 5), 95)}%`, top: '-18px' }}
            >
              <div className="flex flex-col items-center">
                <div className="bg-primary text-primary-foreground px-2.5 py-1 rounded-lg shadow-lg text-[10px] font-bold whitespace-nowrap border-2 border-background">
                  {targetLoading ? '...' : formatValue(actual)}
                </div>
                <MapPin className="h-5 w-5 text-primary drop-shadow-lg fill-primary -mt-0.5" />
              </div>
            </div>
          </div>

          {/* Gap / Overachieved indicator with Target Advisor and Performance buttons */}
          {gap < 0 && !targetLoading && target > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-md border border-primary/20">
                  {t('home.gapToGo', { value: formatGapValue(gap) })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/target-advisor?period=${targetPeriod}`)}
                  className="text-xs h-8 gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  {t('home.targetAdvisor')}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/performance-dashboard')}
                className="text-xs h-8 gap-1 w-full"
              >
                <BarChart3 className="h-3 w-3" />
                {t('home.viewPerformance')}
              </Button>
            </div>
          )}

          {gap > 0 && !targetLoading && target > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-success bg-success/10 px-3 py-1.5 rounded-md border border-success/20">
                  {t('home.overachievedBy', { value: formatGapValue(gap) })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/target-advisor?period=${targetPeriod}`)}
                  className="text-xs h-8 gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  {t('home.targetAdvisor')}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/performance-dashboard')}
                className="text-xs h-8 gap-1 w-full"
              >
                <BarChart3 className="h-3 w-3" />
                {t('home.viewPerformance')}
              </Button>
            </div>
          )}

          {gap === 0 && !targetLoading && target > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="text-sm font-bold text-success bg-success/10 px-3 py-1.5 rounded-md border border-success/20 text-center">
                {t('home.targetAchieved')}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/performance-dashboard')}
                className="text-xs h-8 gap-1 w-full"
              >
                <BarChart3 className="h-3 w-3" />
                {t('home.viewPerformance')}
              </Button>
            </div>
          )}
          {target === 0 && !targetLoading && (
            <div className="flex items-center justify-between mt-2">
              <div className="text-xs text-muted-foreground italic">
                {t('home.noTargetSet')}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/performance-dashboard')}
                className="text-xs h-8 gap-1"
              >
                <BarChart3 className="h-3 w-3" />
                {t('home.performance')}
              </Button>
            </div>
          )}
        </div>}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center justify-center gap-1 mb-1.5">
                <Users className="h-4 w-4 text-primary" />
              </div>
              {!isToday && statsLoading ? (
                <Skeleton className="h-7 w-8 mx-auto mb-1" />
              ) : (
                <p className="text-xl font-bold text-foreground">{displayPlanned}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">{t('home.planned')}</p>
          </div>

          <div className="text-center p-3 rounded-lg bg-success/5 border border-success/10">
            <div className="flex items-center justify-center gap-1 mb-1.5">
              <CheckCircle className="h-4 w-4 text-success" />
            </div>
            {!isToday && statsLoading ? (
              <Skeleton className="h-7 w-8 mx-auto mb-1" />
            ) : (
              <p className="text-xl font-bold text-foreground">{displayProductive}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('home.productive')}</p>
          </div>

          <div className="text-center p-3 rounded-lg bg-warning/5 border border-warning/10">
            <div className="flex items-center justify-center gap-1 mb-1.5">
              <Clock className="h-4 w-4 text-warning" />
            </div>
            {!isToday && statsLoading ? (
              <Skeleton className="h-7 w-8 mx-auto mb-1" />
            ) : (
              <p className="text-xl font-bold text-foreground">{displayRemaining}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('home.remaining')}</p>
          </div>
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
            <div className="flex items-center justify-center gap-1 mb-1">
              <UserPlus className="h-3.5 w-3.5 text-blue-500" />
            </div>
            {!isToday && statsLoading ? (
              <Skeleton className="h-6 w-8 mx-auto mb-1" />
            ) : (
              <p className="text-base font-bold text-foreground">{displayNewRetailers}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('home.newAdded')}</p>
          </div>

          <div className="text-center p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
            </div>
            {!isToday && statsLoading ? (
              <Skeleton className="h-6 w-12 mx-auto mb-1" />
            ) : (
              <p className="text-base font-bold text-foreground">{formatCurrencyShort(displayPotentialRevenue)}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('home.potential')}</p>
          </div>

          <div className="text-center p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
            </div>
            {!isToday && statsLoading ? (
              <Skeleton className="h-6 w-8 mx-auto mb-1" />
            ) : (
              <p className="text-base font-bold text-foreground">{displayPoints}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('home.points')}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button 
            onClick={() => navigate(`/visits/retailers?date=${format(selectedDate, 'yyyy-MM-dd')}`)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {t('nav.myVisit')}
          </Button>
          <Button 
            onClick={() => navigate(`/today-summary?date=${format(selectedDate, 'yyyy-MM-dd')}`)}
            variant="default"
            size="sm"
            className="w-full"
          >
            {t('visits.summary')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
