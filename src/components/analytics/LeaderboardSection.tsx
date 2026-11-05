import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

interface LeaderboardSectionProps {
  selectedUserIds: string[];
  dateRange: { from: Date; to: Date };
  allUsers: { id: string; full_name: string | null }[];
}

interface RankedUser {
  user_id: string;
  full_name: string;
  total_points: number;
}

type ViewFilter = 'all' | 'top5' | 'bottom5';
type TimeFilter = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year';

const getTimeRange = (filter: TimeFilter): { from: Date; to: Date } => {
  const now = new Date();
  switch (filter) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': { const y = subDays(now, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case 'week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month': return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'quarter': return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case 'year': return { from: startOfYear(now), to: endOfYear(now) };
  }
};

export const LeaderboardSection = ({ selectedUserIds, dateRange, allUsers }: LeaderboardSectionProps) => {
  const [scopeFilter, setScopeFilter] = useState<'my_scope' | 'all_team'>('my_scope');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [allRankings, setAllRankings] = useState<RankedUser[]>([]);
  const [loading, setLoading] = useState(false);

  const effectiveRange = useMemo(() => getTimeRange(timeFilter), [timeFilter]);
  const startDate = useMemo(() => effectiveRange.from.toISOString(), [effectiveRange]);
  const endDate = useMemo(() => effectiveRange.to.toISOString(), [effectiveRange]);

  useEffect(() => {
    fetchRankings();
  }, [startDate, endDate, scopeFilter, selectedUserIds]);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('gamification_points')
        .select('user_id, points, earned_at')
        .gte('earned_at', startDate)
        .lte('earned_at', endDate);

      if (scopeFilter === 'my_scope' && selectedUserIds.length > 0) {
        query = query.in('user_id', selectedUserIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching leaderboard rankings:', error);
        setAllRankings([]);
        setLoading(false);
        return;
      }

      const userPointsMap = new Map<string, number>();
      data?.forEach(item => {
        const current = userPointsMap.get(item.user_id) || 0;
        userPointsMap.set(item.user_id, current + item.points);
      });

      const userIds = Array.from(userPointsMap.keys());
      if (userIds.length === 0) {
        setAllRankings([]);
        setLoading(false);
        return;
      }

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const ranked: RankedUser[] = userIds
        .map(userId => ({
          user_id: userId,
          full_name: profilesData?.find(p => p.id === userId)?.full_name || 'Unknown User',
          total_points: userPointsMap.get(userId) || 0,
        }))
        .sort((a, b) => b.total_points - a.total_points);

      setAllRankings(ranked);
    } catch (e) {
      console.error('Leaderboard fetch error:', e);
      setAllRankings([]);
    }
    setLoading(false);
  };

  const displayedRankings = useMemo(() => {
    if (viewFilter === 'top5') return allRankings.slice(0, 5);
    if (viewFilter === 'bottom5') return allRankings.slice(-5);
    return allRankings;
  }, [allRankings, viewFilter]);

  // For bottom5, we need to show the actual rank (not 1-5)
  const getRankForItem = (index: number): number => {
    if (viewFilter === 'bottom5') {
      return allRankings.length - 5 + index + 1;
    }
    return index + 1;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-600">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <CardTitle className="text-base sm:text-lg">Leaderboard</CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={scopeFilter} onValueChange={(v) => setScopeFilter(v as 'my_scope' | 'all_team')}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="my_scope">My Scope</SelectItem>
                <SelectItem value="all_team">All Team</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today's Points</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">Year-to-Date</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button
                variant={viewFilter === 'top5' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setViewFilter(viewFilter === 'top5' ? 'all' : 'top5')}
              >
                Top 5
              </Button>
              <Button
                variant={viewFilter === 'bottom5' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setViewFilter(viewFilter === 'bottom5' ? 'all' : 'bottom5')}
              >
                Bottom 5
              </Button>
            </div>
            <Select value="role" disabled>
              <SelectTrigger className="w-[90px] h-8 text-xs opacity-50">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="role">Role</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayedRankings.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No leaderboard data for this period
          </div>
        ) : (
          <ScrollArea className="h-[400px] w-full">
            <div className="min-w-[320px] px-4 pb-4 space-y-2">
              {displayedRankings.map((item, index) => {
                const rank = getRankForItem(index);
                const isTop3 = rank <= 3;
                const medalIcon = getRankIcon(rank);

                return (
                  <div
                    key={item.user_id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg ${
                      isTop3
                        ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/10 dark:to-orange-950/10'
                        : 'bg-muted/50'
                    }`}
                  >
                    {medalIcon ? (
                      <div className="text-xl w-7 text-center flex-shrink-0">{medalIcon}</div>
                    ) : (
                      <span className="text-xs font-semibold w-7 text-center text-muted-foreground flex-shrink-0">
                        #{rank}
                      </span>
                    )}
                    {/* Avatar hidden on mobile to save space */}
                    <Avatar className="h-7 w-7 hidden sm:flex flex-shrink-0">
                      <AvatarFallback className="text-[10px] bg-primary/10">
                        {item.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="flex-1 text-sm truncate min-w-0">{item.full_name}</p>
                    <Badge
                      variant={isTop3 ? 'secondary' : 'outline'}
                      className="text-xs font-semibold flex-shrink-0"
                    >
                      {item.total_points.toLocaleString()} pts
                    </Badge>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="vertical" />
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
