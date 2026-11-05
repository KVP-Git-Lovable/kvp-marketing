import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { AttendanceCalendarView } from './AttendanceCalendarView';
import { useQuery } from '@tanstack/react-query';

interface TeamMemberDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export const TeamMemberDetailSheet = ({ isOpen, onClose, userId, userName }: TeamMemberDetailSheetProps) => {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [regularizations, setRegularizations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const monthStart = format(startOfMonth(calendarMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(calendarMonth), 'yyyy-MM-dd');

  // Fetch attendance for selected month
  const { data: attendance = [] } = useQuery({
    queryKey: ['team-member-attendance', userId, monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false });
      return data || [];
    },
    enabled: isOpen && !!userId,
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });

  // Fetch leave applications for calendar
  const { data: leaveRecords = [] } = useQuery({
    queryKey: ['team-member-leaves-calendar', userId, monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_applications')
        .select('id, start_date, end_date, status, is_half_day, half_day_period, leave_types(name)')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .or(`start_date.lte.${monthEnd},end_date.gte.${monthStart}`);
      return data || [];
    },
    enabled: isOpen && !!userId,
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });

  // Fetch week-off config
  const { data: weekOffConfig = [{ id: 'default', day_of_week: 0, is_off: true, alternate_pattern: 'all' }] } = useQuery({
    queryKey: ['week-off-config-team'],
    queryFn: async () => {
      const { data } = await supabase
        .from('week_off_config')
        .select('id, day_of_week, is_off, alternate_pattern');
      return data && data.length > 0 ? data : [{ id: 'default', day_of_week: 0, is_off: true, alternate_pattern: 'all' }];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch holidays
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays-team', monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('holidays')
        .select('id, date, holiday_name')
        .gte('date', monthStart)
        .lte('date', monthEnd);
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const holidayDates = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchNonAttendanceData();
    }
  }, [isOpen, userId]);

  const fetchNonAttendanceData = async () => {
    setIsLoading(true);
    try {
      const [leaveRes, regRes] = await Promise.all([
        supabase
          .from('leave_applications')
          .select('*, leave_types(name)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('regularization_requests')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      setLeaves(leaveRes.data || []);
      setRegularizations(regRes.data || []);
    } catch (error) {
      console.error('Error fetching member detail:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (t: string | null) => {
    if (!t) return '--:--';
    return new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'regularized').length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle className="text-base">{userName} — Attendance</DialogTitle>
        </DialogHeader>

        {/* Monthly Summary */}
        <div className="flex items-center justify-center gap-6 py-2">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{presentCount}</div>
            <div className="text-xs text-muted-foreground">Present</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{attendance.length}</div>
            <div className="text-xs text-muted-foreground">Records</div>
          </div>
        </div>

        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="attendance" className="text-xs">Attendance</TabsTrigger>
            <TabsTrigger value="leaves" className="text-xs">Leaves</TabsTrigger>
            <TabsTrigger value="regularization" className="text-xs">Regularization</TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="space-y-3 mt-2">
            {/* Calendar View */}
            <AttendanceCalendarView
              attendanceRecords={attendance}
              leaveRecords={leaveRecords}
              weekOffConfig={weekOffConfig}
              holidayDates={holidayDates}
              currentMonth={calendarMonth}
              onMonthChange={setCalendarMonth}
            />
          </TabsContent>

          <TabsContent value="leaves" className="space-y-2 mt-2">
            {leaves.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No leave applications</p>
            ) : (
              leaves.map((leave) => (
                <div key={leave.id} className="p-3 rounded-lg border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {(leave.leave_types as any)?.name || 'Leave'}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        leave.status === 'approved' && 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
                        leave.status === 'pending' && 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                        leave.status === 'rejected' && 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                      )}
                    >
                      {leave.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd, yyyy')}
                  </p>
                  {leave.reason && <p className="text-xs text-muted-foreground line-clamp-1">{leave.reason}</p>}
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="regularization" className="space-y-2 mt-2">
            {regularizations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No regularization requests</p>
            ) : (
              regularizations.map((req) => (
                <div key={req.id} className="p-3 rounded-lg border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {format(new Date(req.attendance_date), 'EEE, MMM dd')}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        req.status === 'approved' && 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
                        req.status === 'pending' && 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                        req.status === 'rejected' && 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                      )}
                    >
                      {req.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(req.requested_check_in_time)} - {formatTime(req.requested_check_out_time)}
                  </p>
                  {req.reason && <p className="text-xs text-muted-foreground line-clamp-1">{req.reason}</p>}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
