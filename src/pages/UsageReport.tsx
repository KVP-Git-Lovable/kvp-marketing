import { useState, useEffect, useMemo } from 'react';
import { ACTIVE_PROFILE } from '@/lib/activeUserFilter';
import { useNavigate } from 'react-router-dom';
import { Activity, Clock, Users, ChevronRight, Filter, Smartphone, BarChart3, ChevronLeft, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { filterActiveSubordinateRows } from '@/lib/activeUserFilter';

const CORE_MODULES = ['Attendance', 'Visit', 'Packing List', 'Delivery', 'My Beat', 'My Retailer', 'Orders'];
const PERFORMANCE_MODULES = ['Feedback', 'AI Features', 'Analytics', 'Schemes', 'Targets', 'Branding', 'GPS Track', 'Credit Management'];
const ALL_MODULES = [...CORE_MODULES, ...PERFORMANCE_MODULES];

const AI_FEATURES = ['Target Advisor', 'AI Chat', 'Sales Coach', 'Smart Basket', 'Visit AI Insights'];

interface UserUsage {
  userId: string;
  fullName: string;
  managerId: string | null;
  managerName: string | null;
  designation: string | null;
  modulesUsed: Set<string>;
  totalTimeSeconds: number;
  moduleDetails: Record<string, { timeSeconds: number; count: number }>;
  usagePercent: number;
}

interface DailyUsage {
  date: Date;
  totalSeconds: number;
  label: string;
}

type DateFilter = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_7_days' | 'last_30_days';

const getDateRange = (filter: DateFilter): { from: Date; to: Date } => {
  const now = new Date();
  switch (filter) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': { const y = subDays(now, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case 'this_week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case 'this_month': return { from: startOfMonth(now), to: endOfDay(now) };
    case 'last_7_days': return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'last_30_days': return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
  }
};

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatDurationLong = (seconds: number) => {
  if (seconds < 60) return `${seconds} seconds`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h} hour${h > 1 ? 's' : ''} ${m} min`;
  if (h > 0) return `${h} hour${h > 1 ? 's' : ''}`;
  return `${m} minute${m > 1 ? 's' : ''}`;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const UsageReport = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('this_week');
  const [usageData, setUsageData] = useState<UserUsage[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserUsage | null>(null);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const dateRange = useMemo(() => getDateRange(dateFilter), [dateFilter]);

  const fetchUsageData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = roleData?.some((r: any) => r.role === 'admin');

      let userIds: string[] = [];

      if (isAdmin) {
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id').match(ACTIVE_PROFILE)
          .limit(1000);
        userIds = (allProfiles || []).map((p: any) => p.id);
      } else {
        const { data: subordinates } = await supabase
          .rpc('get_all_subordinates', { manager_user_id: user.id });
        const activeSubordinates = await filterActiveSubordinateRows((subordinates || []) as any[]);
        userIds = activeSubordinates.map((s: any) => s.subordinate_user_id);
        if (!userIds.includes(user.id)) userIds.push(user.id);
      }

      if (userIds.length === 0) {
        setUsageData([]);
        setAllLogs([]);
        setLoading(false);
        return;
      }

      const allProfiles: any[] = [];
      const profileBatchSize = 50;
      for (let i = 0; i < userIds.length; i += profileBatchSize) {
        const batch = userIds.slice(i, i + profileBatchSize);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, manager_id, designation')
          .in('id', batch);
        if (profiles) allProfiles.push(...profiles);
      }

      const profileMap: Record<string, any> = {};
      allProfiles.forEach(p => { profileMap[p.id] = p; });

      const missingManagerIds = allProfiles
        .filter(p => p.manager_id && !profileMap[p.manager_id])
        .map(p => p.manager_id);

      if (missingManagerIds.length > 0) {
        const uniqueManagerIds = [...new Set(missingManagerIds)];
        for (let i = 0; i < uniqueManagerIds.length; i += profileBatchSize) {
          const batch = uniqueManagerIds.slice(i, i + profileBatchSize);
          const { data: managerProfiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', batch);
          if (managerProfiles) managerProfiles.forEach(p => { profileMap[p.id] = { ...profileMap[p.id], ...p }; });
        }
      }

      const fromStr = format(dateRange.from, "yyyy-MM-dd'T'HH:mm:ss");
      const toStr = format(dateRange.to, "yyyy-MM-dd'T'HH:mm:ss");

      const fetchedLogs: any[] = [];
      const batchSize = 50;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const { data: logs } = await supabase
          .from('module_usage_logs' as any)
          .select('user_id, module_name, module_category, duration_seconds, started_at')
          .in('user_id', batch)
          .gte('started_at', fromStr)
          .lte('started_at', toStr);
        if (logs) fetchedLogs.push(...logs);
      }

      setAllLogs(fetchedLogs);

      const userMap: Record<string, UserUsage> = {};

      userIds.forEach((uid: string) => {
        const profile = profileMap[uid];
        if (!profile) return;
        const managerProfile = profile.manager_id ? profileMap[profile.manager_id] : null;
        userMap[uid] = {
          userId: uid,
          fullName: profile.full_name || 'Unknown',
          managerId: profile.manager_id,
          managerName: managerProfile?.full_name || null,
          designation: profile.designation,
          modulesUsed: new Set(),
          totalTimeSeconds: 0,
          moduleDetails: {},
          usagePercent: 0,
        };
      });

      fetchedLogs.forEach((log: any) => {
        const u = userMap[log.user_id];
        if (!u) return;
        u.modulesUsed.add(log.module_name);
        u.totalTimeSeconds += (log.duration_seconds || 0);
        if (!u.moduleDetails[log.module_name]) {
          u.moduleDetails[log.module_name] = { timeSeconds: 0, count: 0 };
        }
        u.moduleDetails[log.module_name].timeSeconds += (log.duration_seconds || 0);
        u.moduleDetails[log.module_name].count += 1;
      });

      Object.values(userMap).forEach(u => {
        u.usagePercent = Math.round((u.modulesUsed.size / ALL_MODULES.length) * 100);
      });

      setUsageData(
        Object.values(userMap)
          .sort((a, b) => b.usagePercent - a.usagePercent || b.totalTimeSeconds - a.totalTimeSeconds)
      );
    } catch (e) {
      console.error('Error fetching usage data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageData();
  }, [user, dateFilter]);

  // Compute weekly bar chart data
  const weeklyData = useMemo((): DailyUsage[] => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const totalSeconds = allLogs
        .filter(log => {
          const logDate = new Date(log.started_at);
          return logDate >= dayStart && logDate <= dayEnd;
        })
        .reduce((sum, log) => sum + (log.duration_seconds || 0), 0);

      return {
        date: day,
        totalSeconds,
        label: DAY_LABELS[day.getDay()],
      };
    });
  }, [allLogs]);

  const totalScreenTime = useMemo(() => {
    return allLogs.reduce((sum, log) => sum + (log.duration_seconds || 0), 0);
  }, [allLogs]);

  // Module-wise breakdown for selected date
  const selectedDateModules = useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    const dayLogs = allLogs.filter(log => {
      const logDate = new Date(log.started_at);
      return logDate >= dayStart && logDate <= dayEnd;
    });

    const moduleMap: Record<string, number> = {};
    dayLogs.forEach(log => {
      moduleMap[log.module_name] = (moduleMap[log.module_name] || 0) + (log.duration_seconds || 0);
    });

    return Object.entries(moduleMap)
      .sort(([, a], [, b]) => b - a)
      .map(([name, seconds]) => ({ name, seconds }));
  }, [allLogs, selectedDate]);

  const maxBarSeconds = useMemo(() => {
    return Math.max(...weeklyData.map(d => d.totalSeconds), 1);
  }, [weeklyData]);

  const overallStats = useMemo(() => {
    const activeUsers = usageData.filter(u => u.modulesUsed.size > 0).length;
    const totalTime = usageData.reduce((sum, u) => sum + u.totalTimeSeconds, 0);
    const avgPercent = usageData.length > 0
      ? Math.round(usageData.reduce((sum, u) => sum + u.usagePercent, 0) / usageData.length)
      : 0;
    return { activeUsers, totalUsers: usageData.length, totalTime, avgPercent };
  }, [usageData]);

  const navigateDate = (direction: number) => {
    setSelectedDate(prev => subDays(prev, -direction));
  };

  const isToday = isSameDay(selectedDate, new Date());

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-4 space-y-5 max-w-4xl">

          {/* Screen Time Overview - Android style */}
          <Card className="overflow-hidden">
            <CardContent className="p-5 pb-3">
              <h1 className="text-2xl font-bold text-foreground mb-1">App Activity Details</h1>

              {/* Filter Chip */}
              <div className="flex justify-center my-4">
                <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                  <SelectTrigger className="w-auto min-w-[140px] rounded-full bg-muted/60 border-0 px-4 h-9 text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="this_week">This Week</SelectItem>
                    <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Total Screen Time */}
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-foreground">{formatDurationLong(totalScreenTime)}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {dateFilter === 'today' ? 'Today' : dateFilter === 'yesterday' ? 'Yesterday' : 'This period'}
                </div>
              </div>

              {/* Weekly Bar Chart */}
              <div className="flex items-end justify-between gap-1 h-28 px-2 mb-2">
                {weeklyData.map((day, i) => {
                  const heightPercent = maxBarSeconds > 0 ? (day.totalSeconds / maxBarSeconds) * 100 : 0;
                  const isSelected = isSameDay(day.date, selectedDate);
                  const isTodayBar = isSameDay(day.date, new Date());
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-1 cursor-pointer"
                      onClick={() => setSelectedDate(day.date)}
                    >
                      <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                        <div
                          className={cn(
                            "w-full max-w-[36px] rounded-t-md transition-all",
                            isSelected
                              ? "bg-primary"
                              : isTodayBar
                                ? "bg-primary/70"
                                : "bg-muted-foreground/20"
                          )}
                          style={{ height: `${Math.max(heightPercent, 4)}%` }}
                        />
                      </div>
                      <span className={cn(
                        "text-[11px]",
                        isSelected ? "font-bold text-primary" : "text-muted-foreground"
                      )}>
                        {day.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Y-axis labels */}
              <div className="flex justify-end gap-4 text-[10px] text-muted-foreground px-2 mb-2">
                <span>{formatDuration(maxBarSeconds)}</span>
                <span>{formatDuration(Math.round(maxBarSeconds / 2))}</span>
                <span>0</span>
              </div>
            </CardContent>
          </Card>

          {/* Date Navigator */}
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-foreground">
              {isToday ? 'Today' : format(selectedDate, 'EEE, d MMM')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateDate(1)}
              disabled={isToday}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Module List for Selected Date - Android style */}
          <Card>
            <CardContent className="p-0">
              {selectedDateModules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No module usage on this day
                </div>
              ) : (
                <div className="divide-y">
                  {selectedDateModules.map(mod => (
                    <div key={mod.name} className="flex items-center gap-4 px-4 py-3.5">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
                        CORE_MODULES.includes(mod.name)
                          ? "bg-primary/10 text-primary"
                          : "bg-amber-500/10 text-amber-600"
                      )}>
                        {mod.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground truncate">{mod.name}</div>
                        <div className="text-xs text-muted-foreground">{formatDurationLong(mod.seconds)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-3 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                <div className="text-xl font-bold text-primary">{overallStats.activeUsers}/{overallStats.totalUsers}</div>
                <div className="text-[10px] text-muted-foreground">Active Users</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <CardContent className="p-3 text-center">
                <Clock className="h-5 w-5 mx-auto mb-1 text-green-600" />
                <div className="text-xl font-bold text-green-600">{formatDuration(overallStats.totalTime)}</div>
                <div className="text-[10px] text-muted-foreground">Total Time</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
              <CardContent className="p-3 text-center">
                <Activity className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                <div className="text-xl font-bold text-amber-600">{overallStats.avgPercent}%</div>
                <div className="text-[10px] text-muted-foreground">Avg Usage</div>
              </CardContent>
            </Card>
          </div>

          {/* User List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                User-wise Module Usage ({usageData.length} users)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading usage data...</div>
              ) : usageData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No usage data found</div>
              ) : (
                <div className="divide-y max-h-[60vh] overflow-auto">
                  {usageData.map((u) => (
                    <div
                      key={u.userId}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedUser(u)}
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {u.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{u.fullName}</span>
                          {u.designation && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
                              {u.designation}
                            </Badge>
                          )}
                        </div>
                        {u.managerName && (
                          <p className="text-[10px] text-muted-foreground truncate">Reports to: {u.managerName}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <Progress value={u.usagePercent} className="h-1.5 flex-1" />
                          <span className="text-xs font-semibold text-primary shrink-0">{u.usagePercent}%</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium text-muted-foreground">
                          {u.modulesUsed.size}/{ALL_MODULES.length}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatDuration(u.totalTimeSeconds)}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* User Detail Dialog - Android App Activity Style */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="p-4 pb-2 border-b">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {selectedUser?.fullName.charAt(0).toUpperCase()}
                </div>
                {selectedUser?.fullName}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {selectedUser?.designation || 'Team Member'} • {formatDurationLong(selectedUser?.totalTimeSeconds || 0)} total
              </p>
            </DialogHeader>

            <div className="flex-1 overflow-auto">
              {selectedUser && (
                <UserDetailContent
                  selectedUser={selectedUser}
                  allLogs={allLogs}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

// Separate component for user detail content
const UserDetailContent = ({ selectedUser, allLogs }: { selectedUser: UserUsage; allLogs: any[] }) => {
  const [userSelectedDate, setUserSelectedDate] = useState<Date>(new Date());

  // Filter logs for this user only
  const userLogs = useMemo(() => {
    return allLogs.filter(log => log.user_id === selectedUser.userId);
  }, [allLogs, selectedUser.userId]);

  // Weekly bar chart for this user
  const userWeeklyData = useMemo((): DailyUsage[] => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return days.map(day => ({
      date: day,
      totalSeconds: userLogs
        .filter(log => isSameDay(new Date(log.started_at), day))
        .reduce((sum, log) => sum + (log.duration_seconds || 0), 0),
      label: DAY_LABELS[day.getDay()],
    }));
  }, [userLogs]);

  const userMaxBar = useMemo(() => Math.max(...userWeeklyData.map(d => d.totalSeconds), 1), [userWeeklyData]);

  const userTotalTime = useMemo(() => userLogs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0), [userLogs]);

  // Module breakdown for selected date, split by category
  const { coreModules, perfModules } = useMemo(() => {
    const dayLogs = userLogs.filter(log => isSameDay(new Date(log.started_at), userSelectedDate));
    const moduleMap: Record<string, { seconds: number; count: number }> = {};
    dayLogs.forEach(log => {
      if (!moduleMap[log.module_name]) moduleMap[log.module_name] = { seconds: 0, count: 0 };
      moduleMap[log.module_name].seconds += (log.duration_seconds || 0);
      moduleMap[log.module_name].count += 1;
    });

    const core = CORE_MODULES.map(name => ({
      name,
      seconds: moduleMap[name]?.seconds || 0,
      count: moduleMap[name]?.count || 0,
      used: !!moduleMap[name],
    }));

    const perf = PERFORMANCE_MODULES.map(name => ({
      name,
      seconds: moduleMap[name]?.seconds || 0,
      count: moduleMap[name]?.count || 0,
      used: !!moduleMap[name],
    }));

    return { coreModules: core, perfModules: perf };
  }, [userLogs, userSelectedDate]);

  const isUserToday = isSameDay(userSelectedDate, new Date());

  return (
    <div className="space-y-4">
      {/* Weekly Bar Chart */}
      <div className="px-4 pt-3">
        <div className="text-center mb-3">
          <div className="text-3xl font-bold text-foreground">{formatDurationLong(userTotalTime)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total screen time this week</div>
        </div>

        <div className="flex items-end justify-between gap-1 h-20 px-1 mb-1">
          {userWeeklyData.map((day, i) => {
            const heightPercent = userMaxBar > 0 ? (day.totalSeconds / userMaxBar) * 100 : 0;
            const isSelected = isSameDay(day.date, userSelectedDate);
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-0.5 cursor-pointer"
                onClick={() => setUserSelectedDate(day.date)}
              >
                <div className="w-full flex items-end justify-center" style={{ height: '56px' }}>
                  <div
                    className={cn(
                      "w-full max-w-[28px] rounded-t-sm transition-all",
                      isSelected ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                    style={{ height: `${Math.max(heightPercent, 4)}%` }}
                  />
                </div>
                <span className={cn(
                  "text-[10px]",
                  isSelected ? "font-bold text-primary" : "text-muted-foreground"
                )}>
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Date Navigator */}
      <div className="flex items-center justify-center gap-3 px-4">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setUserSelectedDate(prev => subDays(prev, 1))}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-medium">
          {isUserToday ? 'Today' : format(userSelectedDate, 'EEE, d MMM')}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setUserSelectedDate(prev => subDays(prev, -1))} disabled={isUserToday}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Core Modules Section */}
      <div className="px-4">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          Core Modules
        </h3>
        <div className="space-y-1">
          {coreModules.map(mod => (
            <div
              key={mod.name}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                mod.used ? "bg-primary/5" : "bg-muted/30"
              )}
            >
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                mod.used ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {mod.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm", mod.used ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {mod.name}
                </div>
                {mod.used && (
                  <div className="text-[10px] text-muted-foreground">
                    {mod.count} {mod.count === 1 ? 'session' : 'sessions'}
                  </div>
                )}
              </div>
              <span className={cn("text-xs font-medium", mod.used ? "text-primary" : "text-muted-foreground/50")}>
                {mod.used ? formatDuration(mod.seconds) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Modules Section */}
      <div className="px-4 pb-4">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          Performance Modules
        </h3>
        <div className="space-y-1">
          {perfModules.map(mod => (
            <div
              key={mod.name}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                mod.used ? "bg-amber-500/5" : "bg-muted/30"
              )}
            >
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                mod.used ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground"
              )}>
                {mod.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm", mod.used ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {mod.name}
                </div>
                {mod.used && (
                  <div className="text-[10px] text-muted-foreground">
                    {mod.count} {mod.count === 1 ? 'session' : 'sessions'}
                  </div>
                )}
              </div>
              <span className={cn("text-xs font-medium", mod.used ? "text-amber-600" : "text-muted-foreground/50")}>
                {mod.used ? formatDuration(mod.seconds) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
