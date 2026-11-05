import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Activity, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface DayProductivity {
  date: string;
  displayDate: string;
  userName?: string; // deprecated - resolve from userNameMap at render time
  userId: string;
  planned: number;
  productive: number;
  unproductive: number;
  pending: number;
}

interface UserProductivitySummary {
  userId: string;
  full_name: string;
  planned_visits: number;
  productive_visits: number;
  unproductive_visits: number;
  pending_visits: number;
  total_visits: number;
  productivity_percentage: number;
  days_count: number;
}

interface ProductivitySummarySectionProps {
  selectedUsers: string[]; // user names (for backward compat display)
  selectedUserIds?: string[]; // user IDs for querying
  dateRange: { from: Date; to: Date };
  allUsers?: { id: string; full_name: string | null }[];
  onDataLoaded?: (data: { full_name: string; productivity_percentage: number; productive_visits: number; total_visits: number }[]) => void;
}

export const ProductivitySummarySection = ({ selectedUsers, selectedUserIds, dateRange, allUsers = [], onDataLoaded }: ProductivitySummarySectionProps) => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [dayData, setDayData] = useState<DayProductivity[]>([]);
  const [selectedUserForDrilldown, setSelectedUserForDrilldown] = useState<string | null>(null);

  // Resolve effective user IDs
  const effectiveUserIds = useMemo(() => {
    if (selectedUserIds && selectedUserIds.length > 0) return selectedUserIds;
    // Fallback: resolve from names
    if (selectedUsers.length > 0) {
      return allUsers
        .filter(u => u.full_name && selectedUsers.includes(u.full_name))
        .map(u => u.id);
    }
    // All users
    return allUsers.map(u => u.id);
  }, [selectedUserIds, selectedUsers, allUsers]);

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    allUsers.forEach(u => map.set(u.id, u.full_name || 'Unknown'));
    return map;
  }, [allUsers]);

  const isSingleUserMode = effectiveUserIds.length === 1;
  const hasNoData = effectiveUserIds.length === 0;

  const fetchProductivityData = async () => {
    if (hasNoData) {
      setDayData([]);
      return;
    }

    setLoading(true);
    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Generate all dates in range
      const datesInRange: string[] = [];
      const current = new Date(dateRange.from);
      current.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.to);
      end.setHours(23, 59, 59, 999);
      while (current <= end) {
        datesInRange.push(format(current, 'yyyy-MM-dd'));
        current.setDate(current.getDate() + 1);
      }

      // Fetch all data in parallel (matching My Visits / Today's Progress logic)
      const [beatPlansRes, visitsRes, ordersRes] = await Promise.all([
        supabase
          .from('beat_plans')
          .select('beat_id, beat_name, plan_date, user_id, beat_data')
          .in('user_id', effectiveUserIds)
          .gte('plan_date', fromDate)
          .lte('plan_date', toDate),

        supabase
          .from('visits')
          .select('id, retailer_id, status, no_order_reason, user_id, planned_date')
          .in('user_id', effectiveUserIds)
          .gte('planned_date', fromDate)
          .lte('planned_date', toDate),

        supabase
          .from('orders')
          .select('retailer_id, user_id, order_date')
          .eq('status', 'confirmed')
          .in('user_id', effectiveUserIds)
          .gte('order_date', fromDate)
          .lte('order_date', toDate),
      ]);

      const beatPlans = beatPlansRes.data || [];
      const visits = visitsRes.data || [];
      const orders = ordersRes.data || [];

      // Get all beat IDs and fetch retailers for those beats
      const beatIds = [...new Set(beatPlans.map(bp => bp.beat_id).filter(Boolean))];

      let beatRetailers: { id: string; beat_id: string; user_id: string }[] = [];
      if (beatIds.length > 0) {
        const { data } = await supabase
          .from('retailers')
          .select('id, beat_id, user_id')
          .in('user_id', effectiveUserIds)
          .in('beat_id', beatIds);
        beatRetailers = data || [];
      }

      // Build per-user per-date: beat plan retailers
      const beatPlanRetailersMap = new Map<string, Set<string>>();
      beatPlans.forEach(bp => {
        const key = `${bp.user_id}_${bp.plan_date}`;
        if (!beatPlanRetailersMap.has(key)) beatPlanRetailersMap.set(key, new Set());
        const set = beatPlanRetailersMap.get(key)!;
        beatRetailers.filter(r => r.beat_id === bp.beat_id && r.user_id === bp.user_id)
          .forEach(r => set.add(r.id));
      });

      // Build per-user per-date: visit retailers grouped by retailer with best status + no_order_reason
      // Key: `userId_date` → Map<retailerId, { status, hasNoOrderReason }>
      const visitRetailerStatusMap = new Map<string, Map<string, { status: string; hasNoOrderReason: boolean }>>();
      visits.forEach(v => {
        if (!v.retailer_id || !v.planned_date) return;
        const key = `${v.user_id}_${v.planned_date}`;
        if (!visitRetailerStatusMap.has(key)) visitRetailerStatusMap.set(key, new Map());
        const retailerStatuses = visitRetailerStatusMap.get(key)!;
        const existing = retailerStatuses.get(v.retailer_id);
        // Priority: productive wins over everything
        if (v.status === 'productive') {
          retailerStatuses.set(v.retailer_id, { status: 'productive', hasNoOrderReason: false });
        } else if (!existing || existing.status === 'planned') {
          retailerStatuses.set(v.retailer_id, { 
            status: v.status, 
            hasNoOrderReason: !!(v as any).no_order_reason 
          });
        } else {
          // Merge: if any visit has no_order_reason, mark it
          if ((v as any).no_order_reason && !existing.hasNoOrderReason) {
            retailerStatuses.set(v.retailer_id, { ...existing, hasNoOrderReason: true });
          }
        }
      });

      // Build per-user per-date: order retailers
      const orderRetailersMap = new Map<string, Set<string>>();
      orders.forEach(o => {
        if (!o.retailer_id) return;
        const key = `${o.user_id}_${o.order_date}`;
        if (!orderRetailersMap.has(key)) orderRetailersMap.set(key, new Set());
        orderRetailersMap.get(key)!.add(o.retailer_id);
      });

      // Calculate per-user per-date metrics using unique-retailer logic (matching My Visits Today's Progress)
      const results: DayProductivity[] = [];

      for (const userId of effectiveUserIds) {
        for (const dateStr of datesInRange) {
          const key = `${userId}_${dateStr}`;
          const beatRetailerIds = beatPlanRetailersMap.get(key) || new Set<string>();
          const retailerStatuses = visitRetailerStatusMap.get(key) || new Map<string, string>();
          const orderRetailerIds = orderRetailersMap.get(key) || new Set<string>();

          // All unique retailers involved (beat plans + visits + orders) = "Planned"
          const allRetailerIds = new Set<string>();
          beatRetailerIds.forEach(id => allRetailerIds.add(id));
          retailerStatuses.forEach((_, id) => allRetailerIds.add(id));
          orderRetailerIds.forEach(id => allRetailerIds.add(id));

          const planned = allRetailerIds.size;
          if (planned === 0) continue;

          // Productive: unique retailers with confirmed order OR productive visit
          const productiveSet = new Set<string>();
          orderRetailerIds.forEach(rid => productiveSet.add(rid));
          retailerStatuses.forEach((info, rid) => {
            if (info.status === 'productive') productiveSet.add(rid);
          });

          // Unproductive: retailers with visit status 'unproductive' OR has no_order_reason
          // (matching useVisitsData/calculateStats logic - cancelled/store-closed without reason = pending)
          const unproductiveSet = new Set<string>();
          retailerStatuses.forEach((info, rid) => {
            if (!productiveSet.has(rid)) {
              if (info.status === 'unproductive' || info.hasNoOrderReason) {
                unproductiveSet.add(rid);
              }
            }
          });

          const productive = productiveSet.size;
          const unproductive = unproductiveSet.size;
          const pending = Math.max(0, planned - productive - unproductive);

          results.push({
            date: dateStr,
            displayDate: format(new Date(dateStr + 'T00:00:00'), 'MMMM d, yyyy'),
            userName: undefined, // resolved at render time from userNameMap
            userId,
            planned,
            productive,
            unproductive,
            pending,
          });
        }
      }

      setDayData(results);
    } catch (error) {
      console.error('Error fetching productivity data:', error);
      setDayData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductivityData();
  }, [effectiveUserIds.join(','), dateRange.from.getTime(), dateRange.to.getTime()]);

  // Group data by user for multi-user mode
  const userSummaries = useMemo((): UserProductivitySummary[] => {
    const grouped: Record<string, UserProductivitySummary> = {};

    dayData.forEach(row => {
      if (!grouped[row.userId]) {
        grouped[row.userId] = {
          userId: row.userId,
          full_name: userNameMap.get(row.userId) || 'Unknown',
          planned_visits: 0,
          productive_visits: 0,
          unproductive_visits: 0,
          pending_visits: 0,
          total_visits: 0,
          productivity_percentage: 0,
          days_count: 0,
        };
      }
      const g = grouped[row.userId];
      g.planned_visits += row.planned;
      g.productive_visits += row.productive;
      g.unproductive_visits += row.unproductive;
      g.pending_visits += row.pending;
      g.total_visits += row.productive + row.unproductive;
      g.days_count += 1;
    });

    Object.values(grouped).forEach(user => {
      // Re-resolve name in case userNameMap updated after initial grouping
      user.full_name = userNameMap.get(user.userId) || 'Unknown';
      user.productivity_percentage = user.planned_visits > 0
        ? Math.round((user.productive_visits / user.planned_visits) * 100 * 100) / 100
        : 0;
    });

    return Object.values(grouped).sort((a, b) => b.productivity_percentage - a.productivity_percentage);
  }, [dayData, userNameMap]);

  // Notify parent
  useEffect(() => {
    if (onDataLoaded && userSummaries.length > 0) {
      onDataLoaded(userSummaries.map(u => ({
        full_name: u.full_name,
        productivity_percentage: u.productivity_percentage,
        productive_visits: u.productive_visits,
        total_visits: u.total_visits,
      })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSummaries]);

  // Single-user day-wise data
  const singleUserData = useMemo(() => {
    if (!isSingleUserMode) return [];
    return dayData.sort((a, b) => a.date.localeCompare(b.date));
  }, [dayData, isSingleUserMode]);

  // Drilldown data for multi-user mode
  const drilldownData = useMemo(() => {
    if (!selectedUserForDrilldown) return [];
    return dayData
      .filter(row => row.userId === selectedUserForDrilldown)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [dayData, selectedUserForDrilldown]);

  // Calculate totals
  const singleUserTotals = useMemo(() => {
    const totalPlanned = singleUserData.reduce((s, r) => s + r.planned, 0);
    const totalProductive = singleUserData.reduce((s, r) => s + r.productive, 0);
    const totalUnproductive = singleUserData.reduce((s, r) => s + r.unproductive, 0);
    const totalPending = singleUserData.reduce((s, r) => s + r.pending, 0);
    const avgProductivity = totalPlanned > 0 ? Math.round((totalProductive / totalPlanned) * 100 * 100) / 100 : 0;
    return { planned: totalPlanned, productive: totalProductive, unproductive: totalUnproductive, pending: totalPending, avgProductivity };
  }, [singleUserData]);

  const multiUserTotals = useMemo(() => {
    const totalPlanned = userSummaries.reduce((s, r) => s + r.planned_visits, 0);
    const totalProductive = userSummaries.reduce((s, r) => s + r.productive_visits, 0);
    const totalUnproductive = userSummaries.reduce((s, r) => s + r.unproductive_visits, 0);
    const totalPending = userSummaries.reduce((s, r) => s + r.pending_visits, 0);
    const avgProductivity = totalPlanned > 0 ? Math.round((totalProductive / totalPlanned) * 100 * 100) / 100 : 0;
    return { planned: totalPlanned, productive: totalProductive, unproductive: totalUnproductive, pending: totalPending, avgProductivity, usersCount: userSummaries.length };
  }, [userSummaries]);

  const drilldownTotals = useMemo(() => {
    const totalPlanned = drilldownData.reduce((s, r) => s + r.planned, 0);
    const totalProductive = drilldownData.reduce((s, r) => s + r.productive, 0);
    const totalUnproductive = drilldownData.reduce((s, r) => s + r.unproductive, 0);
    const totalPending = drilldownData.reduce((s, r) => s + r.pending, 0);
    const avgProductivity = totalPlanned > 0 ? Math.round((totalProductive / totalPlanned) * 100 * 100) / 100 : 0;
    return { planned: totalPlanned, productive: totalProductive, unproductive: totalUnproductive, pending: totalPending, avgProductivity };
  }, [drilldownData]);

  const getProductivityColor = (percentage: number) => {
    if (percentage >= 70) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const effectiveUserDisplay = isSingleUserMode
    ? (userNameMap.get(effectiveUserIds[0]) || selectedUsers[0] || 'Unknown')
    : `${effectiveUserIds.length} users`;

  return (
    <>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base sm:text-lg md:text-xl">Productivity Summary</CardTitle>
              <p className="text-sm text-muted-foreground">
                Visit productivity {isSingleUserMode ? 'by date' : 'by user'} • {
                  hasNoData ? 'Loading users...' : effectiveUserDisplay
                } • {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd, yyyy')}
              </p>
              {!isSingleUserMode && (
                <p className="text-xs text-muted-foreground mt-1">
                  PTV indicates Planned to Visit productivity and VTO indicates Visit to Order productivity
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {hasNoData ? (
            <div className="text-center py-8 text-muted-foreground">
              No user data available
            </div>
          ) : loading ? (
            <div className="text-center py-8">
              <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
              <p className="text-muted-foreground">Loading productivity data...</p>
            </div>
          ) : dayData.length > 0 ? (
            <div className={cn(
              "relative border rounded-lg scrollbar-always-visible",
              dayData.length > 8 && "max-h-[400px]"
            )}>
              <div className="min-w-max">
                {isSingleUserMode ? (
                  // Single user: Day-wise breakdown
                  <table className={cn("w-full caption-bottom", isMobile ? "text-[9px]" : "text-sm")}>
                    <thead className="sticky top-0 bg-muted z-20">
                      <TableRow className="border-b">
                        <TableHead className={cn("whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>Date</TableHead>
                        <TableHead className={cn("text-right whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>Planned</TableHead>
                        <TableHead className={cn("text-right whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>Productive</TableHead>
                        <TableHead className={cn("text-right whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>Unproductive</TableHead>
                        <TableHead className={cn("text-right whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>Pending</TableHead>
                        <TableHead className={cn("text-right whitespace-nowrap", isMobile ? "py-1 px-1" : "py-1.5")}>{isMobile ? "PTV %" : "PTV %"}</TableHead>
                        <TableHead className={cn("text-right whitespace-nowrap", isMobile ? "py-1 px-1" : "py-1.5")}>{isMobile ? "VTO %" : "VTO %"}</TableHead>
                      </TableRow>
                    </thead>
                    <TableBody>
                      {singleUserData.map((row, index) => {
                        const pct = row.planned > 0 ? Math.round((row.productive / row.planned) * 100 * 100) / 100 : 0;
                        const actualPct = (row.productive + row.unproductive) > 0 ? Math.round((row.productive / (row.productive + row.unproductive)) * 100 * 100) / 100 : 0;
                        return (
                          <TableRow key={index} className="hover:bg-muted/30">
                            <TableCell className={cn("font-medium whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{row.displayDate}</TableCell>
                            <TableCell className={cn("text-right text-blue-600 font-medium whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{row.planned}</TableCell>
                            <TableCell className={cn("text-right text-green-600 font-medium whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{row.productive}</TableCell>
                            <TableCell className={cn("text-right text-orange-600 font-medium whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{row.unproductive}</TableCell>
                            <TableCell className={cn("text-right text-yellow-600 font-medium whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{row.pending}</TableCell>
                            <TableCell className={cn("text-right font-semibold whitespace-nowrap", isMobile ? "py-1 px-1" : "py-1.5")}>
                              <span className={getProductivityColor(pct)}>{pct}%</span>
                            </TableCell>
                            <TableCell className={cn("text-right font-semibold whitespace-nowrap", isMobile ? "py-1 px-1" : "py-1.5")}>
                              <span className={getProductivityColor(actualPct)}>{actualPct}%</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <tfoot className="bg-background border-t sticky bottom-0 z-10">
                      <TableRow>
                        <TableCell className={cn("font-semibold whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>Total ({singleUserData.length} days)</TableCell>
                        <TableCell className={cn("text-right font-bold text-blue-600 whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{singleUserTotals.planned}</TableCell>
                        <TableCell className={cn("text-right font-bold text-green-600 whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{singleUserTotals.productive}</TableCell>
                        <TableCell className={cn("text-right font-bold text-orange-600 whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{singleUserTotals.unproductive}</TableCell>
                        <TableCell className={cn("text-right font-bold text-yellow-600 whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{singleUserTotals.pending}</TableCell>
                        <TableCell className={cn("text-right font-bold text-primary whitespace-nowrap", isMobile ? "py-1 px-1" : "py-1.5")}>{singleUserTotals.avgProductivity}%</TableCell>
                        <TableCell className={cn("text-right font-bold text-primary whitespace-nowrap", isMobile ? "py-1 px-1" : "py-1.5")}>{(singleUserTotals.productive + singleUserTotals.unproductive) > 0 ? Math.round((singleUserTotals.productive / (singleUserTotals.productive + singleUserTotals.unproductive)) * 100 * 100) / 100 : 0}%</TableCell>
                      </TableRow>
                    </tfoot>
                  </table>
                ) : (
                  // Multi-user: User-wise summary
                  <table className={cn("w-full caption-bottom", isMobile ? "text-[9px]" : "text-sm")}>
                    <thead className="sticky top-0 bg-muted z-20">
                      <TableRow className="border-b">
                        <TableHead className={cn("whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>User</TableHead>
                        <TableHead className={cn("text-right whitespace-nowrap", isMobile ? "py-1 px-1" : "py-1.5")}>{isMobile ? "PTV %" : "PTV %"}</TableHead>
                        <TableHead className={cn("text-right whitespace-nowrap", isMobile ? "py-1 px-1" : "py-1.5")}>{isMobile ? "VTO %" : "VTO %"}</TableHead>
                        <TableHead className={cn("text-right whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>Planned</TableHead>
                        <TableHead className={cn("text-right whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>Productive</TableHead>
                        <TableHead className={cn("text-right whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>Unproductive</TableHead>
                        <TableHead className={cn("text-right whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>Pending</TableHead>
                        <TableHead className={cn(isMobile ? "w-6 py-1 px-1" : "w-8 py-1.5")}></TableHead>
                      </TableRow>
                    </thead>
                    <TableBody>
                      {userSummaries.map((row, index) => (
                        <TableRow
                          key={index}
                          className="hover:bg-muted/30 cursor-pointer"
                          onClick={() => setSelectedUserForDrilldown(row.userId)}
                        >
                          <TableCell className={cn("font-medium whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{row.full_name}</TableCell>
                          <TableCell className={cn("text-right font-semibold whitespace-nowrap", isMobile ? "py-1 px-1" : "py-1.5")}>
                            <span className={getProductivityColor(row.productivity_percentage)}>{row.productivity_percentage}%</span>
                          </TableCell>
                          <TableCell className={cn("text-right font-semibold whitespace-nowrap", isMobile ? "py-1 px-1" : "py-1.5")}>
                            {(() => { const ap = (row.productive_visits + row.unproductive_visits) > 0 ? Math.round((row.productive_visits / (row.productive_visits + row.unproductive_visits)) * 100 * 100) / 100 : 0; return <span className={getProductivityColor(ap)}>{ap}%</span>; })()}
                          </TableCell>
                          <TableCell className={cn("text-right text-blue-600 font-medium whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{row.planned_visits}</TableCell>
                          <TableCell className={cn("text-right text-green-600 font-medium whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{row.productive_visits}</TableCell>
                          <TableCell className={cn("text-right text-orange-600 font-medium whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{row.unproductive_visits}</TableCell>
                          <TableCell className={cn("text-right text-yellow-600 font-medium whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{row.pending_visits}</TableCell>
                          <TableCell className={cn(isMobile ? "py-1 px-1" : "py-1.5")}>
                            <ChevronRight className={cn(isMobile ? "h-3 w-3" : "h-4 w-4", "text-muted-foreground")} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <tfoot className="bg-background border-t sticky bottom-0 z-10">
                      <TableRow>
                        <TableCell className={cn("font-semibold whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>Total ({multiUserTotals.usersCount} users)</TableCell>
                        <TableCell className={cn("text-right font-bold text-primary whitespace-nowrap", isMobile ? "py-1 px-1" : "py-1.5")}>{multiUserTotals.avgProductivity}%</TableCell>
                        <TableCell className={cn("text-right font-bold text-primary whitespace-nowrap", isMobile ? "py-1 px-1" : "py-1.5")}>{(multiUserTotals.productive + multiUserTotals.unproductive) > 0 ? Math.round((multiUserTotals.productive / (multiUserTotals.productive + multiUserTotals.unproductive)) * 100 * 100) / 100 : 0}%</TableCell>
                        <TableCell className={cn("text-right font-bold text-blue-600 whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{multiUserTotals.planned}</TableCell>
                        <TableCell className={cn("text-right font-bold text-green-600 whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{multiUserTotals.productive}</TableCell>
                        <TableCell className={cn("text-right font-bold text-orange-600 whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{multiUserTotals.unproductive}</TableCell>
                        <TableCell className={cn("text-right font-bold text-yellow-600 whitespace-nowrap", isMobile ? "py-1 px-2" : "py-1.5")}>{multiUserTotals.pending}</TableCell>
                        <TableCell className={cn(isMobile ? "py-1 px-1" : "py-1.5")}></TableCell>
                      </TableRow>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No productivity data found for the selected filters
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day-wise Drilldown Dialog for Multi-user mode */}
      <Dialog open={!!selectedUserForDrilldown} onOpenChange={() => setSelectedUserForDrilldown(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Day-wise Productivity - {selectedUserForDrilldown ? (userNameMap.get(selectedUserForDrilldown) || 'Unknown') : ''}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd, yyyy')}
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-lg">
            {drilldownData.length > 0 ? (
              <table className="w-full caption-bottom text-sm">
                <TableHeader className="sticky top-0 bg-muted/50 z-10">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Planned</TableHead>
                    <TableHead className="text-right">Productive</TableHead>
                    <TableHead className="text-right">Unproductive</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">PTV %</TableHead>
                    <TableHead className="text-right">VTO %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drilldownData.map((row, index) => {
                    const pct = row.planned > 0 ? Math.round((row.productive / row.planned) * 100 * 100) / 100 : 0;
                    const actualPct = (row.productive + row.unproductive) > 0 ? Math.round((row.productive / (row.productive + row.unproductive)) * 100 * 100) / 100 : 0;
                    return (
                      <TableRow key={index} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{row.displayDate}</TableCell>
                        <TableCell className="text-right text-blue-600 font-medium">{row.planned}</TableCell>
                        <TableCell className="text-right text-green-600 font-medium">{row.productive}</TableCell>
                        <TableCell className="text-right text-orange-600 font-medium">{row.unproductive}</TableCell>
                        <TableCell className="text-right text-yellow-600 font-medium">{row.pending}</TableCell>
                        <TableCell className="text-right font-semibold">
                          <span className={getProductivityColor(pct)}>{pct}%</span>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          <span className={getProductivityColor(actualPct)}>{actualPct}%</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <tfoot className="bg-muted/30 sticky bottom-0">
                  <TableRow>
                    <TableCell className="font-semibold">Total ({drilldownData.length} days)</TableCell>
                    <TableCell className="text-right font-bold text-blue-600">{drilldownTotals.planned}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">{drilldownTotals.productive}</TableCell>
                    <TableCell className="text-right font-bold text-orange-600">{drilldownTotals.unproductive}</TableCell>
                    <TableCell className="text-right font-bold text-yellow-600">{drilldownTotals.pending}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{drilldownTotals.avgProductivity}%</TableCell>
                    <TableCell className="text-right font-bold text-primary">{(drilldownTotals.productive + drilldownTotals.unproductive) > 0 ? Math.round((drilldownTotals.productive / (drilldownTotals.productive + drilldownTotals.unproductive)) * 100 * 100) / 100 : 0}%</TableCell>
                  </TableRow>
                </tfoot>
              </table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No data available for this user
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
