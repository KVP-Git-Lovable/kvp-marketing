import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { filterActiveProfileRows } from '@/lib/activeUserFilter';
import { toast } from 'sonner';
import { CalendarIcon, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { downloadCSV } from '@/utils/fileDownloader';
import { useSubordinates } from '@/hooks/useSubordinates';
import { useAdminAccess } from '@/hooks/useAdminAccess';

interface AttendanceRecord {
  id: string;
  date: string;
  user_id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total_hours: number | null;
  status: string;
  employee_name: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'leave', label: 'On Leave' },
  { value: 'half_day_leave', label: 'Half Day' },
  { value: 'regularized', label: 'Regularized' },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'present':
    case 'regularized':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'absent':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'leave':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'half_day_leave':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'late':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const formatTime = (time: string | null) => {
  if (!time) return '-';
  try {
    return format(new Date(time), 'hh:mm a');
  } catch {
    return '-';
  }
};

const AttendanceReportGenerator = () => {
  const { hasAdminAccess } = useAdminAccess();
  const { subordinateIds, isManager, isLoading: subsLoading } = useSubordinates();
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string }>>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, [hasAdminAccess, subordinateIds]);

  const fetchEmployees = async () => {
    if (hasAdminAccess) {
      // Admin sees everyone
      const { data, error } = await supabase.rpc('get_limited_profiles_for_admin');
      if (!error && data) {
        const activeData = await filterActiveProfileRows(data as Array<{ id: string; full_name: string }>);
        setEmployees(
          activeData
            .filter((p) => p.full_name)
            .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
        );
      }
    } else if (subordinateIds.length > 0) {
      // Manager sees only subordinates
      const allEmployees: Array<{ id: string; full_name: string }> = [];
      for (let i = 0; i < subordinateIds.length; i += 100) {
        const batch = subordinateIds.slice(i, i + 100);
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', batch);
        if (data) allEmployees.push(...(data as Array<{ id: string; full_name: string }>));
      }
      setEmployees(
        allEmployees
          .filter((p) => p.full_name)
          .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
      );
    }
  };

  const fetchAllBatched = async (query: any) => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let keepGoing = true;

    while (keepGoing) {
      const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (data) allData = allData.concat(data);
      if (!data || data.length < PAGE_SIZE) keepGoing = false;
      else from += PAGE_SIZE;
    }
    return allData;
  };

  const generateReport = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('attendance')
        .select('id, date, user_id, check_in_time, check_out_time, total_hours, status')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (selectedEmployee !== 'all') {
        query = query.eq('user_id', selectedEmployee);
      } else if (!hasAdminAccess && subordinateIds.length > 0) {
        // Manager: scope to subordinates only
        query = query.in('user_id', subordinateIds);
      }
      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      const data = await fetchAllBatched(query);

      // Fetch profile names for all unique user_ids
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const profileMap: Record<string, string> = {};

      if (userIds.length > 0) {
        // Batch fetch profiles
        for (let i = 0; i < userIds.length; i += 100) {
          const batch = userIds.slice(i, i + 100);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, username')
            .in('id', batch);
          if (profiles) {
            profiles.forEach((p: any) => {
              profileMap[p.id] = p.full_name || p.username || 'Unknown';
            });
          }
        }
      }

      const mapped: AttendanceRecord[] = data.map((r: any) => ({
        ...r,
        employee_name: profileMap[r.user_id] || 'Unknown',
      }));

      setRecords(mapped);
      setHasGenerated(true);

      if (mapped.length === 0) {
        toast.info('No attendance records found for the selected filters.');
      }
    } catch (err: any) {
      console.error('Report generation error:', err);
      toast.error('Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  const exportCSV = () => {
    if (records.length === 0) return;
    const headers = 'Date,Employee Name,Check-in Time,Check-out Time,Total Hours,Status';
    const rows = records.map((r) =>
      [
        r.date,
        `"${r.employee_name}"`,
        r.check_in_time ? formatTime(r.check_in_time) : '',
        r.check_out_time ? formatTime(r.check_out_time) : '',
        r.total_hours?.toFixed(2) ?? '',
        r.status,
      ].join(',')
    );
    downloadCSV([headers, ...rows].join('\n'), `attendance-report-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const exportExcel = async () => {
    if (records.length === 0) return;
    try {
      const XLSX = await import('xlsx');
      const wsData = [
        ['Date', 'Employee Name', 'Check-in Time', 'Check-out Time', 'Total Hours', 'Status'],
        ...records.map((r) => [
          r.date,
          r.employee_name,
          r.check_in_time ? formatTime(r.check_in_time) : '',
          r.check_out_time ? formatTime(r.check_out_time) : '',
          r.total_hours?.toFixed(2) ?? '',
          r.status,
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
      XLSX.writeFile(wb, `attendance-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('Excel file downloaded');
    } catch {
      toast.error('Failed to export Excel');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Attendance Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Start Date */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Start Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-[150px] justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, 'dd MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">End Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-[150px] justify-start text-left font-normal', !endDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(endDate, 'dd MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Employee Select */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Employee</label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Select */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={generateReport} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Generate Report
          </Button>
        </div>

        {/* Export buttons + results */}
        {hasGenerated && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{records.length} record(s) found</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportCSV} disabled={records.length === 0}>
                  <Download className="mr-1 h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportExcel} disabled={records.length === 0}>
                  <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
                </Button>
              </div>
            </div>

            {records.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.employee_name}</TableCell>
                      <TableCell>{formatTime(r.check_in_time)}</TableCell>
                      <TableCell>{formatTime(r.check_out_time)}</TableCell>
                      <TableCell>{r.total_hours?.toFixed(2) ?? '-'}</TableCell>
                      <TableCell>
                        <Badge className={cn('capitalize', getStatusColor(r.status))}>{r.status.replace(/_/g, ' ')}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceReportGenerator;
