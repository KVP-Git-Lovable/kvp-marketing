import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useMyTargets } from "@/hooks/useMyTargets";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PerformanceGauge } from "@/components/targets/PerformanceGauge";
import { KPICard } from "@/components/targets/KPICard";
import { PerformanceSummaryTable } from "@/components/targets/PerformanceSummaryTable";
import { PerformanceComments } from "@/components/targets/PerformanceComments";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Target as TargetIcon } from "lucide-react";
import { format, subMonths, subQuarters, subYears, startOfQuarter, endOfQuarter, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { UserSelector } from "@/components/UserSelector";
import { useSubordinates } from "@/hooks/useSubordinates";

type PeriodType = 'day' | 'month' | 'quarter' | 'year';

export default function MyTargets() {
  const { userProfile, user } = useAuth();
  const { isManager } = useSubordinates();
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedQuarter, setSelectedQuarter] = useState<string>("Q1");
  const [selectedUserId, setSelectedUserId] = useState<string>('self');
  
  // Calculate effective user ID for data fetching
  const effectiveUserId = useMemo(() => {
    if (selectedUserId === 'self' || selectedUserId === user?.id) {
      return user?.id;
    }
    return selectedUserId;
  }, [selectedUserId, user?.id]);
  
  const { targets, performanceScore, isLoading } = useMyTargets(periodType, selectedDate, effectiveUserId);

  const getRatingColor = (rating: string) => {
    const colors = {
      excellent: "bg-chart-1/10 text-chart-1 border-chart-1/20",
      good: "bg-chart-2/10 text-chart-2 border-chart-2/20",
      average: "bg-chart-3/10 text-chart-3 border-chart-3/20",
      needs_improvement: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return colors[rating as keyof typeof colors] || colors.needs_improvement;
  };

  const getRatingLabel = (rating: string) => {
    return rating?.replace('_', ' ').toUpperCase() || 'N/A';
  };

  const getPeriodLabel = () => {
    if (periodType === 'day') return format(selectedDate, 'MMMM d, yyyy');
    if (periodType === 'month') return format(selectedDate, 'MMMM yyyy');
    if (periodType === 'quarter') return `${selectedQuarter} ${selectedDate.getFullYear()}`;
    return selectedDate.getFullYear().toString();
  };

  const getPeriodDates = () => {
    let start: Date, end: Date;
    
    if (periodType === 'day') {
      start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
    } else if (periodType === 'month') {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
    } else if (periodType === 'quarter') {
      const quarterNum = parseInt(selectedQuarter.replace('Q', ''));
      const quarterStart = new Date(selectedDate.getFullYear(), (quarterNum - 1) * 3, 1);
      start = startOfQuarter(quarterStart);
      end = endOfQuarter(quarterStart);
    } else {
      start = startOfYear(selectedDate);
      end = endOfYear(selectedDate);
    }
    
    return { start, end };
  };

  const getHistoricalData = () => {
    // Generate mock historical data (in production, fetch from API)
    const periods = [];
    for (let i = 0; i < 6; i++) {
      let date: Date;
      if (periodType === 'month') date = subMonths(selectedDate, i);
      else if (periodType === 'quarter') date = subQuarters(selectedDate, i);
      else date = subYears(selectedDate, i);

      periods.push({
        period: periodType === 'month' 
          ? format(date, 'MMM yyyy')
          : periodType === 'quarter'
          ? `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`
          : date.getFullYear().toString(),
        avgScore: 75 + Math.random() * 25,
        rating: Math.random() > 0.5 ? 'good' : 'average',
        kpiScores: {},
      });
    }
    return periods;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TargetIcon className="h-8 w-8" />
              My Performance Targets
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your progress against set targets
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* User Selector for managers */}
            <UserSelector
              selectedUserId={selectedUserId}
              onUserChange={setSelectedUserId}
              showAllOption={false}
              allOptionLabel="All Team"
            />
            
            <Select value={periodType} onValueChange={(value) => setPeriodType(value as PeriodType)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="quarter">Quarterly</SelectItem>
                <SelectItem value="year">Yearly</SelectItem>
              </SelectContent>
            </Select>

            {periodType === 'quarter' && (
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Q1">Quarter 1</SelectItem>
                  <SelectItem value="Q2">Quarter 2</SelectItem>
                  <SelectItem value="Q3">Quarter 3</SelectItem>
                  <SelectItem value="Q4">Quarter 4</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1 md:col-span-2">
            <CardHeader>
              <CardTitle>Overall Achievement</CardTitle>
              <CardDescription>{getPeriodLabel()}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <PerformanceGauge value={performanceScore?.weighted_average_score || 0} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Rating</CardTitle>
              <CardDescription>Current period evaluation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge 
                variant="outline" 
                className={`text-lg py-2 px-4 ${getRatingColor(performanceScore?.performance_rating || 'needs_improvement')}`}
              >
                {getRatingLabel(performanceScore?.performance_rating || 'needs_improvement')}
              </Badge>
              
              <div className="pt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-chart-1" />
                  <span className="text-muted-foreground">
                    {targets?.filter(t => t.achievement_percent >= 100).length || 0} KPIs achieved
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Out of {targets?.length || 0} total KPIs
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KPI Cards Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-4">KPI Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {targets?.map((target: any) => (
              <KPICard
                key={target.id}
                kpiName={target.kpi?.kpi_name || 'Unknown KPI'}
                target={target.target_value}
                actual={target.actual_value}
                unit={target.kpi?.unit || 'number'}
                achievement={target.achievement_percent}
              />
            ))}
            {(!targets || targets.length === 0) && (
              <Card className="col-span-full">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <TargetIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No Target Assigned</p>
                  <p className="text-sm mt-1">
                    You have no targets set for this period. This may be intentional — please contact your admin if you believe this is an error.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Historical Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Performance History</CardTitle>
            <CardDescription>Your performance over the last 6 periods</CardDescription>
          </CardHeader>
          <CardContent>
            <PerformanceSummaryTable data={getHistoricalData()} />
          </CardContent>
        </Card>

        {/* Comments Section */}
        {effectiveUserId && (
          <PerformanceComments
            userId={effectiveUserId}
            periodType={periodType}
            periodStart={getPeriodDates().start.toISOString().split('T')[0]}
            periodEnd={getPeriodDates().end.toISOString().split('T')[0]}
          />
        )}
      </div>
    </Layout>
  );
}
