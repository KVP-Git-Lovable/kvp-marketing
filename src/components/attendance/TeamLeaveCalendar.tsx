import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, getDay, isWeekend } from 'date-fns';
import { toast } from 'sonner';

interface LeaveApplication {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  status: string;
  is_half_day: boolean | null;
  half_day_period: string | null;
  profiles?: {
    full_name: string;
  };
  leave_types?: {
    name: string;
    code: string | null;
    color: string | null;
  };
}

interface Holiday {
  id: string;
  date: string;
  holiday_name: string;
}

const TeamLeaveCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [selectedUser, setSelectedUser] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [currentMonth, selectedUser]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      // Fetch approved leaves for the month
      let leaveQuery = supabase
        .from('leave_applications')
        .select('*')
        .eq('status', 'approved')
        .or(`start_date.lte.${monthEnd},end_date.gte.${monthStart}`);

      if (selectedUser !== 'all') {
        leaveQuery = leaveQuery.eq('user_id', selectedUser);
      }

      const [leavesRes, holidaysRes, usersRes] = await Promise.all([
        leaveQuery,
        supabase
          .from('holidays')
          .select('*')
          .gte('holiday_date', monthStart)
          .lte('holiday_date', monthEnd),
        supabase.from('profiles').select('id, full_name').order('full_name'),
      ]);

      if (leavesRes.error) throw leavesRes.error;
      if (holidaysRes.error) throw holidaysRes.error;

      // Enrich leaves with profile and leave type data
      const userIds = [...new Set(leavesRes.data?.map(l => l.user_id) || [])];
      const leaveTypeIds = [...new Set(leavesRes.data?.map(l => l.leave_type_id) || [])];

      const [profilesRes, leaveTypesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', userIds),
        (supabase as any).from('leave_types').select('id, name, code, color').in('id', leaveTypeIds),
      ]);

      const enrichedLeaves = (leavesRes.data || []).map(leave => ({
        ...leave,
        profiles: profilesRes.data?.find(p => p.id === leave.user_id),
        leave_types: leaveTypesRes.data?.find(lt => lt.id === leave.leave_type_id),
      }));

      setLeaves(enrichedLeaves as any);
      setHolidays(holidaysRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      toast.error('Failed to load calendar data');
    } finally {
      setIsLoading(false);
    }
  };

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [currentMonth]);

  const firstDayOfWeek = getDay(startOfMonth(currentMonth));

  const getLeavesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return leaves.filter(leave => {
      return dateStr >= leave.start_date && dateStr <= leave.end_date;
    });
  };

  const getHolidayForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.find(h => h.date === dateStr);
  };

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Team Leave Calendar
              </CardTitle>
              <CardDescription>
                Visual overview of team leave schedule
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-[200px]">
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Members</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Navigation */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
            </div>
            <h2 className="text-xl font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="text-sm text-muted-foreground">
              {leaves.length} approved leaves
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="border rounded-lg overflow-hidden">
            {/* Week day headers */}
            <div className="grid grid-cols-7 bg-muted/50">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="p-2 text-center text-sm font-medium text-muted-foreground border-b"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7">
              {/* Empty cells for days before the first of the month */}
              {Array.from({ length: firstDayOfWeek }).map((_, index) => (
                <div key={`empty-${index}`} className="min-h-[100px] bg-muted/20 border-b border-r" />
              ))}

              {days.map((day) => {
                const dayLeaves = getLeavesForDate(day);
                const holiday = getHolidayForDate(day);
                const isWeekendDay = isWeekend(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[100px] p-1 border-b border-r ${
                      isToday(day) ? 'bg-primary/10' : ''
                    } ${isWeekendDay ? 'bg-muted/30' : ''} ${
                      holiday ? 'bg-orange-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-sm font-medium ${
                          isToday(day)
                            ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center'
                            : ''
                        } ${!isSameMonth(day, currentMonth) ? 'text-muted-foreground' : ''}`}
                      >
                        {format(day, 'd')}
                      </span>
                      {holiday && (
                        <Badge variant="outline" className="text-[10px] bg-orange-100 text-orange-800 truncate max-w-[60px]">
                          {holiday.holiday_name}
                        </Badge>
                      )}
                    </div>

                    {/* Leave entries */}
                    <div className="space-y-0.5 overflow-hidden">
                      {dayLeaves.slice(0, 3).map((leave) => (
                        <div
                          key={leave.id}
                          className="text-[10px] px-1 py-0.5 rounded truncate"
                          style={{
                            backgroundColor: leave.leave_types?.color || '#3b82f6',
                            color: 'white',
                          }}
                          title={`${leave.profiles?.full_name} - ${leave.leave_types?.name}${leave.is_half_day ? ' (Half Day)' : ''}`}
                        >
                          {leave.profiles?.full_name?.split(' ')[0] || 'User'}
                          {leave.is_half_day && ' (½)'}
                        </div>
                      ))}
                      {dayLeaves.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          +{dayLeaves.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary/30" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted" />
              <span>Weekend</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-100" />
              <span>Holiday</span>
            </div>
            <div className="border-l pl-4 flex items-center gap-2">
              <span className="text-muted-foreground">Leave Types:</span>
              {[...new Set(leaves.map(l => l.leave_types?.name))].filter(Boolean).slice(0, 4).map((name) => {
                const leaveType = leaves.find(l => l.leave_types?.name === name)?.leave_types;
                return (
                  <div key={name} className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: leaveType?.color || '#3b82f6' }}
                    />
                    <span className="text-xs">{leaveType?.code || name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamLeaveCalendar;
