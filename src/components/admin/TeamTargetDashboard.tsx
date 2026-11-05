import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Users, Trophy, TrendingUp, TrendingDown, Filter, Globe, ChevronDown, ChevronRight, Package, Network, User, Ban } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays, subWeeks, subMonths, subQuarters } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useSubordinates } from '@/hooks/useSubordinates';
import { useTeamTargetProgress, PeriodType, TargetBasis, TeamMemberProgress } from '@/hooks/useTeamTargetProgress';
import { useFYTargetConfig } from '@/hooks/useFYTargetConfig';
import { ProductMonthBreakdownTable } from './ProductMonthBreakdownTable';
import { UserScope } from '@/pages/admin/TargetVsActual';
import { useHierarchyTeamStructure, HierarchyGroup } from '@/hooks/useHierarchyTeamProgress';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TeamTargetDashboardProps {
  userScope?: UserScope;
  onUserScopeChange?: (scope: UserScope) => void;
  effectiveUserIds?: string[];
  fyYear?: number;
  hasAdminAccess?: boolean;
}

// Analytics-style period options
type DashboardPeriod = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_quarter' | 'this_fy' | 'last_week' | 'last_month' | 'last_quarter' | 'last_fy' | 'last_60_days';

const getWeekStart = (d: Date) => {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getFYStart = (d: Date) => {
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return new Date(year, 3, 1);
};

const getFYEnd = (d: Date) => {
  const year = d.getMonth() >= 3 ? d.getFullYear() + 1 : d.getFullYear();
  const end = new Date(year, 2, 31);
  end.setHours(23, 59, 59, 999);
  return end;
};

const getQuarterStart = (d: Date) => {
  const month = d.getMonth();
  if (month >= 3 && month <= 5) return new Date(d.getFullYear(), 3, 1);
  if (month >= 6 && month <= 8) return new Date(d.getFullYear(), 6, 1);
  if (month >= 9 && month <= 11) return new Date(d.getFullYear(), 9, 1);
  return new Date(d.getFullYear(), 0, 1);
};

const getQuarterEnd = (d: Date) => {
  const month = d.getMonth();
  if (month >= 3 && month <= 5) return new Date(d.getFullYear(), 5, 30, 23, 59, 59, 999);
  if (month >= 6 && month <= 8) return new Date(d.getFullYear(), 8, 30, 23, 59, 59, 999);
  if (month >= 9 && month <= 11) return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
  return new Date(d.getFullYear(), 2, 31, 23, 59, 59, 999);
};

const computeDateRange = (period: DashboardPeriod): { from: Date; to: Date } => {
  const today = new Date();
  switch (period) {
    case 'today': {
      const from = new Date(today);
      from.setHours(0, 0, 0, 0);
      const to = new Date(today);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    case 'yesterday': {
      const from = new Date(today);
      from.setDate(today.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    case 'this_week':
      return { from: getWeekStart(today), to: today };
    case 'this_month':
      return { from: startOfMonth(today), to: today };
    case 'this_quarter':
      return { from: getQuarterStart(today), to: today };
    case 'this_fy':
      return { from: getFYStart(today), to: today };
    case 'last_week': {
      const lastWeekDate = new Date(today);
      lastWeekDate.setDate(today.getDate() - 7);
      const from = getWeekStart(lastWeekDate);
      const to = new Date(from);
      to.setDate(from.getDate() + 6);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    case 'last_month': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    case 'last_quarter': {
      const currentQStart = getQuarterStart(today);
      const lastQEnd = new Date(currentQStart);
      lastQEnd.setDate(lastQEnd.getDate() - 1);
      lastQEnd.setHours(23, 59, 59, 999);
      const from = getQuarterStart(lastQEnd);
      return { from, to: lastQEnd };
    }
    case 'last_fy': {
      const currentFYStart = getFYStart(today);
      const lastFYEnd = new Date(currentFYStart);
      lastFYEnd.setDate(lastFYEnd.getDate() - 1);
      lastFYEnd.setHours(23, 59, 59, 999);
      const from = getFYStart(lastFYEnd);
      return { from, to: lastFYEnd };
    }
    case 'last_60_days': {
      const from = new Date(today);
      from.setDate(today.getDate() - 60);
      from.setHours(0, 0, 0, 0);
      return { from, to: today };
    }
    default:
      return { from: startOfMonth(today), to: today };
  }
};

const periodToPeriodType = (period: DashboardPeriod): PeriodType => {
  switch (period) {
    case 'today':
    case 'yesterday':
      return 'day';
    case 'this_week':
    case 'last_week':
      return 'week';
    case 'this_month':
    case 'last_month':
    case 'last_60_days':
      return 'month';
    case 'this_quarter':
    case 'last_quarter':
      return 'quarter';
    case 'this_fy':
    case 'last_fy':
      return 'year';
    default:
      return 'month';
  }
};

export function TeamTargetDashboard({
  userScope = 'team',
  onUserScopeChange,
  effectiveUserIds = [],
  fyYear,
  hasAdminAccess = false,
}: TeamTargetDashboardProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { subordinateIds, isManager } = useSubordinates();
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>('this_month');
  const [basis, setBasis] = useState<TargetBasis>('quantity');
  const [statusFilter, setStatusFilter] = useState<'all' | 'not_started' | 'in_progress' | 'almost_there' | 'good_to_go' | 'achieved'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // No Target toggle mutation
  const toggleNoTargetMutation = useMutation({
    mutationFn: async ({ userId, hasNoTarget }: { userId: string; hasNoTarget: boolean }) => {
      const currentFY = fyYear || (new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1);
      const { error } = await supabase
        .from('user_business_plans')
        .update({
          has_no_target: hasNoTarget,
          target_strategy: hasNoTarget ? 'no_target' : 'roll_down',
          quantity_target: hasNoTarget ? 0 : undefined,
          revenue_target: hasNoTarget ? 0 : undefined,
        } as any)
        .eq('user_id', userId)
        .eq('year', currentFY);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-target-progress'] });
      toast.success('Target status updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Fetch FY config to get enabled parameters
  const { data: fyConfig } = useFYTargetConfig(fyYear || new Date().getFullYear());
  const enabledParameters = fyConfig?.enabled_parameters;
  const hasProductAndMonthly = enabledParameters?.product && enabledParameters?.monthly;

  // Get all team member IDs
  const teamUserIds = effectiveUserIds.length > 0 ? effectiveUserIds : subordinateIds;

  // Compute period type and date from the dashboard period
  const periodType = useMemo(() => periodToPeriodType(dashboardPeriod), [dashboardPeriod]);
  const dateRange = useMemo(() => computeDateRange(dashboardPeriod), [dashboardPeriod]);

  const { data: teamProgress, isLoading } = useTeamTargetProgress({
    userIds: teamUserIds,
    periodType,
    date: dateRange.from,
    basis,
    enabledParameters,
  });

  // Fetch hierarchy structure for grouping
  const { data: hierarchyGroups } = useHierarchyTeamStructure(teamUserIds);

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!teamProgress?.length) {
      return { total: 0, achieved: 0, goodToGo: 0, almostThere: 0, inProgress: 0, notStarted: 0 };
    }
    return {
      total: teamProgress.length,
      achieved: teamProgress.filter(m => m.status === 'achieved').length,
      goodToGo: teamProgress.filter(m => m.status === 'good_to_go').length,
      almostThere: teamProgress.filter(m => m.status === 'almost_there').length,
      inProgress: teamProgress.filter(m => m.status === 'in_progress').length,
      notStarted: teamProgress.filter(m => m.status === 'not_started').length,
    };
  }, [teamProgress]);

  // Filter team progress based on selected status
  const filteredTeamProgress = useMemo(() => {
    if (!teamProgress?.length || statusFilter === 'all') return teamProgress;
    return teamProgress.filter(m => m.status === statusFilter);
  }, [teamProgress, statusFilter]);

  // Build progress lookup map
  const progressMap = useMemo(() => {
    const map = new Map<string, TeamMemberProgress>();
    filteredTeamProgress?.forEach(m => map.set(m.userId, m));
    return map;
  }, [filteredTeamProgress]);

  // Recursively aggregate hierarchy group data
  const buildGroupedData = (group: HierarchyGroup): any => {
    // Get leaf members that exist in filteredTeamProgress
    const members = group.memberIds
      .map(id => progressMap.get(id))
      .filter(Boolean) as TeamMemberProgress[];

    // Recursively build children
    const children = (group.children || [])
      .map(child => buildGroupedData(child))
      .filter((c: any) => c.members.length > 0 || c.children.length > 0);

    // Aggregate totals: leaf members + all nested children
    let teamTarget = members.reduce((sum, m) => sum + m.target, 0);
    let teamActual = members.reduce((sum, m) => sum + m.actual, 0);
    
    children.forEach((child: any) => {
      teamTarget += child.teamTarget;
      teamActual += child.teamActual;
    });
    
    const teamAchievement = teamTarget > 0 ? (teamActual / teamTarget) * 100 : 0;

    return {
      ...group,
      members,
      children,
      teamTarget,
      teamActual,
      teamAchievement,
    };
  };

  // Build hierarchy groups with aggregated data
  const groupedData = useMemo(() => {
    if (!hierarchyGroups?.length || !filteredTeamProgress?.length) {
      return null;
    }

    return hierarchyGroups
      .map(group => buildGroupedData(group))
      .filter((g: any) => g.members.length > 0 || g.children.length > 0);
  }, [hierarchyGroups, filteredTeamProgress, progressMap]);

  const handleStatusFilterClick = (filter: 'all' | 'not_started' | 'in_progress' | 'almost_there' | 'good_to_go' | 'achieved') => {
    setStatusFilter(prev => prev === filter ? 'all' : filter);
  };

  const toggleRowExpanded = (userId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleGroupCollapsed = (managerId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(managerId)) next.delete(managerId);
      else next.add(managerId);
      return next;
    });
  };

  const formatValue = (value: number): string => {
    if (basis === 'revenue') {
      if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
      if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
      return `₹${value.toFixed(0)}`;
    } else {
      if (value >= 1000) return `${value.toFixed(0)} KG`;
      if (value >= 100) return `${value.toFixed(1)} KG`;
      if (value >= 1) return `${value.toFixed(2)} KG`;
      return `${value.toFixed(2)} KG`;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'achieved':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Achieved</Badge>;
      case 'good_to_go':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Good to Go</Badge>;
      case 'almost_there':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Almost There</Badge>;
      case 'in_progress':
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">In Progress</Badge>;
      case 'not_started':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Not Started</Badge>;
      default:
        return null;
    }
  };

  const getInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Depth-based color accents
  const depthColors = [
    { border: 'border-l-rose-500', bg: 'bg-rose-500/8', badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
    { border: 'border-l-purple-500', bg: 'bg-purple-500/8', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
    { border: 'border-l-blue-500', bg: 'bg-blue-500/8', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    { border: 'border-l-emerald-500', bg: 'bg-emerald-500/8', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    { border: 'border-l-amber-500', bg: 'bg-amber-500/8', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  ];
  const getDepthColor = (depth: number) => depthColors[Math.min(depth, depthColors.length - 1)];

  const renderMemberCard = (member: TeamMemberProgress) => {
    const isExpanded = expandedRows.has(member.userId);
    const hasBreakdown = hasProductAndMonthly && member.productMonthBreakdown && member.productMonthBreakdown.length > 0;
    const gap = member.gap;

    return (
      <div key={member.userId} className="space-y-0">
        <div
          className={cn(
            "flex items-center gap-2 py-2 px-3 rounded-md transition-colors",
            hasBreakdown && "cursor-pointer hover:bg-muted/50",
            isExpanded && "bg-muted/30"
          )}
          onClick={() => hasBreakdown && toggleRowExpanded(member.userId)}
        >
          {/* Expand icon */}
          <div className="w-4 shrink-0">
            {hasBreakdown && (
              isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>

          {/* Avatar */}
          {!isMobile && (
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={member.avatarUrl || undefined} />
              <AvatarFallback className="text-[10px]">{getInitials(member.fullName)}</AvatarFallback>
            </Avatar>
          )}

          {/* Name */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{member.fullName}</p>
          </div>

          {/* Target & Actual */}
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground leading-tight">Target</p>
            <p className="text-xs font-semibold leading-tight">{formatValue(member.target)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground leading-tight">Actual</p>
            <p className="text-xs font-semibold leading-tight">{formatValue(member.actual)}</p>
          </div>

          {/* Progress */}
          {!isMobile && (
            <div className="flex items-center gap-1.5 shrink-0 w-24">
              <Progress value={Math.min(member.achievementPercentage, 100)} className="h-1.5 flex-1" />
              <span className="text-[10px] font-bold w-8 text-right">{member.achievementPercentage.toFixed(0)}%</span>
            </div>
          )}

          {/* Gap */}
          <span className={cn("text-[10px] font-semibold shrink-0 hidden sm:inline", gap >= 0 ? "text-green-600" : "text-red-600")}>
            {gap >= 0 ? '+' : ''}{formatValue(gap)}
          </span>

          {/* Status */}
          <div className="shrink-0">{getStatusBadge(member.status)}</div>

          {/* No Target toggle for managers */}
          {isManager && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                const isCurrentlyNoTarget = member.target === 0 && member.actual === 0;
                toggleNoTargetMutation.mutate({ userId: member.userId, hasNoTarget: !isCurrentlyNoTarget });
              }}
              disabled={toggleNoTargetMutation.isPending}
              title={member.target === 0 ? 'Assign target' : 'Set to No Target'}
            >
              <Ban className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Product breakdown */}
        {hasBreakdown && isExpanded && (
          <div className="ml-6 mr-2 mb-2 p-3 bg-muted/20 rounded-md border">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Product × Month Breakdown</span>
            </div>
            <ProductMonthBreakdownTable data={member.productMonthBreakdown!} basis={basis} />
          </div>
        )}
      </div>
    );
  };

  // Flatten hierarchy into a single ordered list
  interface FlatEntry {
    type: 'manager' | 'member';
    depth: number;
    roleLabel: string;
    managerId?: string; // for collapsible manager rows
    parentManagerId?: string; // to track visibility
    data: any; // group data for managers, TeamMemberProgress for members
  }

  const flattenHierarchy = (groups: any[]): FlatEntry[] => {
    const entries: FlatEntry[] = [];
    
    const walkGroup = (group: any, depth: number, parentManagerId?: string) => {
      const groupKey = group.managerId || `other-${entries.length}`;
      
      // Add manager row
      if (group.managerId) {
        entries.push({
          type: 'manager',
          depth,
          roleLabel: depth === 0 ? 'Top Manager' : depth === 1 ? 'Manager' : 'Team Lead',
          managerId: groupKey,
          parentManagerId,
          data: group,
        });
      }
      
      // Add child sub-managers
      (group.children || []).forEach((child: any) => {
        walkGroup(child, depth + 1, groupKey);
      });
      
      // Add leaf members
      group.members.forEach((member: TeamMemberProgress) => {
        entries.push({
          type: 'member',
          depth: group.managerId ? depth + 1 : depth,
          roleLabel: 'Member',
          parentManagerId: groupKey,
          data: member,
        });
      });
    };
    
    groups.forEach(g => walkGroup(g, 0));
    return entries;
  };

  const flatEntries = useMemo(() => {
    if (!groupedData?.length) return [];
    return flattenHierarchy(groupedData);
  }, [groupedData]);

  // Determine visible entries based on collapsed state
  const visibleEntries = useMemo(() => {
    if (!flatEntries.length) return [];
    
    // Build set of all collapsed manager IDs and their descendants
    const hiddenParents = new Set<string>();
    
    const isHidden = (entry: FlatEntry): boolean => {
      if (!entry.parentManagerId) return false;
      if (collapsedGroups.has(entry.parentManagerId)) return true;
      // Check if any ancestor is collapsed
      const parentEntry = flatEntries.find(e => e.managerId === entry.parentManagerId);
      if (parentEntry) return isHidden(parentEntry);
      return false;
    };
    
    return flatEntries.filter(entry => !isHidden(entry));
  }, [flatEntries, collapsedGroups]);

  const getRoleBadgeStyle = (depth: number) => {
    const styles = [
      'bg-rose-100 text-rose-700 border-rose-200',
      'bg-purple-100 text-purple-700 border-purple-200',
      'bg-blue-100 text-blue-700 border-blue-200',
      'bg-emerald-100 text-emerald-700 border-emerald-200',
      'bg-amber-100 text-amber-700 border-amber-200',
    ];
    return styles[Math.min(depth, styles.length - 1)];
  };

  const getRowBgStyle = (depth: number) => {
    const styles = [
      'bg-rose-50/60 dark:bg-rose-950/20 border-l-rose-500',
      'bg-purple-50/60 dark:bg-purple-950/20 border-l-purple-500',
      'bg-blue-50/60 dark:bg-blue-950/20 border-l-blue-500',
      'bg-emerald-50/60 dark:bg-emerald-950/20 border-l-emerald-500',
      'bg-amber-50/60 dark:bg-amber-950/20 border-l-amber-500',
    ];
    return styles[Math.min(depth, styles.length - 1)];
  };

  const renderFlatRow = (entry: FlatEntry, idx: number) => {
    if (entry.type === 'manager') {
      const group = entry.data;
      const groupKey = entry.managerId!;
      const isCollapsed = collapsedGroups.has(groupKey);
      const teamStatus = group.teamAchievement >= 100 ? 'achieved' : group.teamAchievement >= 90 ? 'good_to_go' : group.teamAchievement >= 50 ? 'almost_there' : group.teamAchievement >= 1 ? 'in_progress' : 'not_started';

      return (
        <div
          key={`mgr-${groupKey}-${idx}`}
          className={cn(
            "grid items-center py-2.5 px-3 border-l-[3px] cursor-pointer transition-colors hover:opacity-90 gap-x-2",
            getRowBgStyle(entry.depth),
            isMobile ? "grid-cols-[auto_1fr_auto_auto_auto]" : "grid-cols-[auto_auto_1fr_80px_80px_40px_auto]"
          )}
          onClick={() => toggleGroupCollapsed(groupKey)}
        >
          {/* Chevron */}
          {isCollapsed ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}

          {/* Avatar */}
          {!isMobile && (
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={group.managerAvatar || undefined} />
              <AvatarFallback className="text-[10px]">{getInitials(group.managerName)}</AvatarFallback>
            </Avatar>
          )}

          {/* Name + Role */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold truncate">{group.managerName}</span>
            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 border shrink-0", getRoleBadgeStyle(entry.depth))}>
              {entry.roleLabel}
            </Badge>
          </div>

          {/* Target */}
          <div className={cn("text-right", isMobile && "")}>
            <p className="text-[9px] text-muted-foreground leading-none">Target</p>
            <p className="text-xs font-bold leading-tight">{formatValue(group.teamTarget)}</p>
          </div>

          {/* Actual */}
          <div className="text-right">
            <p className="text-[9px] text-muted-foreground leading-none">Actual</p>
            <p className="text-xs font-bold leading-tight">{formatValue(group.teamActual)}</p>
          </div>

          {/* % */}
          {!isMobile && (
            <span className="text-xs font-bold text-right">{group.teamAchievement.toFixed(0)}%</span>
          )}

          {/* Status */}
          <div className="shrink-0 justify-self-end">{getStatusBadge(teamStatus)}</div>
        </div>
      );
    }

    // Member row
    const member = entry.data as TeamMemberProgress;
    const isExpanded = expandedRows.has(member.userId);
    const hasBreakdown = hasProductAndMonthly && member.productMonthBreakdown && member.productMonthBreakdown.length > 0;

    return (
      <div key={`mem-${member.userId}-${idx}`}>
        <div
          className={cn(
            "grid items-center py-2 px-3 border-l-[3px] transition-colors gap-x-2",
            getRowBgStyle(entry.depth),
            hasBreakdown && "cursor-pointer hover:opacity-90",
            isExpanded && "bg-muted/30",
            isMobile ? "grid-cols-[auto_1fr_auto_auto_auto]" : "grid-cols-[auto_auto_1fr_80px_80px_40px_auto]"
          )}
          onClick={() => hasBreakdown && toggleRowExpanded(member.userId)}
        >
          {/* Chevron / spacer */}
          <div className="w-4 shrink-0 flex justify-center">
            {hasBreakdown && (
              isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>

          {/* Avatar */}
          {!isMobile && (
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={member.avatarUrl || undefined} />
              <AvatarFallback className="text-[10px]">{getInitials(member.fullName)}</AvatarFallback>
            </Avatar>
          )}

          {/* Name + Role */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium truncate">{member.fullName}</span>
            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 border shrink-0", getRoleBadgeStyle(entry.depth))}>
              {entry.roleLabel}
            </Badge>
          </div>

          {/* Target */}
          <div className="text-right">
            <p className="text-[9px] text-muted-foreground leading-none">Target</p>
            <p className="text-xs font-semibold leading-tight">{formatValue(member.target)}</p>
          </div>

          {/* Actual */}
          <div className="text-right">
            <p className="text-[9px] text-muted-foreground leading-none">Actual</p>
            <p className="text-xs font-semibold leading-tight">{formatValue(member.actual)}</p>
          </div>

          {/* % */}
          {!isMobile && (
            <span className="text-xs font-bold text-right">{member.achievementPercentage.toFixed(0)}%</span>
          )}

          {/* Status */}
          <div className="shrink-0 justify-self-end">{getStatusBadge(member.status)}</div>
        </div>

        {hasBreakdown && isExpanded && (
          <div className="mx-3 mb-2 p-3 bg-muted/20 rounded-md border">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Product × Month Breakdown</span>
            </div>
            <ProductMonthBreakdownTable data={member.productMonthBreakdown!} basis={basis} />
          </div>
        )}
      </div>
    );
  };

  if (!isManager && teamUserIds.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No Team Members</p>
            <p className="text-sm mt-1">You don't have any team members assigned</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const colSpan = hasProductAndMonthly ? 7 : 6;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* User Scope - Only show for admins */}
            {hasAdminAccess && onUserScopeChange && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-muted-foreground">User Scope</label>
                <Select value={userScope} onValueChange={(v) => onUserScopeChange(v as UserScope)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        My Team
                      </div>
                    </SelectItem>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        All Users
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Period - Analytics-style dropdown */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">Period</label>
              <Select value={dashboardPeriod} onValueChange={(v) => setDashboardPeriod(v as DashboardPeriod)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="this_quarter">This Quarter</SelectItem>
                  <SelectItem value="this_fy">This FY</SelectItem>
                  <SelectItem value="last_week">Last Week</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="last_quarter">Last Quarter</SelectItem>
                  <SelectItem value="last_fy">Last FY</SelectItem>
                  <SelectItem value="last_60_days">Last 60 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Display */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">Date Range</label>
              <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted/30 text-sm text-muted-foreground">
                {format(dateRange.from, "dd MMM yyyy")} – {format(dateRange.to, "dd MMM yyyy")}
              </div>
            </div>

            {/* Basis Toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">Target Basis</label>
              <Select value={basis} onValueChange={(v) => setBasis(v as TargetBasis)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quantity">Quantity</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === 'all' && "ring-2 ring-blue-500 ring-offset-2")}
          onClick={() => handleStatusFilterClick('all')}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded-lg"><Users className="h-4 w-4 text-blue-600" /></div>
              <div>
                <p className="text-xl font-bold">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === 'achieved' && "ring-2 ring-green-500 ring-offset-2")}
          onClick={() => handleStatusFilterClick('achieved')}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-green-100 rounded-lg"><Trophy className="h-4 w-4 text-green-600" /></div>
              <div>
                <p className="text-xl font-bold text-green-600">{stats.achieved}</p>
                <p className="text-[10px] text-muted-foreground">Achieved ≥100%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === 'good_to_go' && "ring-2 ring-emerald-500 ring-offset-2")}
          onClick={() => handleStatusFilterClick('good_to_go')}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 rounded-lg"><TrendingUp className="h-4 w-4 text-emerald-600" /></div>
              <div>
                <p className="text-xl font-bold text-emerald-600">{stats.goodToGo}</p>
                <p className="text-[10px] text-muted-foreground">Good to Go 90-99%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === 'almost_there' && "ring-2 ring-yellow-500 ring-offset-2")}
          onClick={() => handleStatusFilterClick('almost_there')}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-yellow-100 rounded-lg"><TrendingUp className="h-4 w-4 text-yellow-600" /></div>
              <div>
                <p className="text-xl font-bold text-yellow-600">{stats.almostThere}</p>
                <p className="text-[10px] text-muted-foreground">Almost There 50-89%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === 'in_progress' && "ring-2 ring-orange-500 ring-offset-2")}
          onClick={() => handleStatusFilterClick('in_progress')}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange-100 rounded-lg"><TrendingDown className="h-4 w-4 text-orange-600" /></div>
              <div>
                <p className="text-xl font-bold text-orange-600">{stats.inProgress}</p>
                <p className="text-[10px] text-muted-foreground">In Progress 1-49%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === 'not_started' && "ring-2 ring-red-500 ring-offset-2")}
          onClick={() => handleStatusFilterClick('not_started')}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-100 rounded-lg"><TrendingDown className="h-4 w-4 text-red-600" /></div>
              <div>
                <p className="text-xl font-bold text-red-600">{stats.notStarted}</p>
                <p className="text-[10px] text-muted-foreground">Not Started 0%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Performance Table - Hierarchy Grouped */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Network className="h-5 w-5" />
              Team Performance (Hierarchy View)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !filteredTeamProgress?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{statusFilter === 'all' ? 'No data available for the selected period' : `No ${statusFilter.replace('_', ' ')} members found`}</p>
              {statusFilter !== 'all' && (
                <Button variant="link" onClick={() => setStatusFilter('all')} className="mt-2">Clear filter</Button>
              )}
            </div>
          ) : visibleEntries.length > 0 ? (
            <div className="rounded-lg overflow-hidden border divide-y divide-border/50">
              {visibleEntries.map((entry, idx) => renderFlatRow(entry, idx))}
            </div>
          ) : (
            // Fallback flat list when no hierarchy data
            <div className="divide-y">
              {filteredTeamProgress.map(member => renderMemberCard(member))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
