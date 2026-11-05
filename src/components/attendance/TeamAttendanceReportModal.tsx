import { useState, useMemo } from 'react';
import { format, subDays, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { CalendarIcon, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { downloadPDF, downloadExcel } from '@/utils/fileDownloader';
import { toast } from 'sonner';

interface TeamAttendanceReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subordinateIds: string[];
}

type DatePreset = 'today' | 'yesterday' | 'last-7' | 'last-week' | 'last-month' | 'custom';

const FIELD_OPTIONS = [
  { key: 'employee_name', label: 'Employee Name' },
  { key: 'date', label: 'Date' },
  { key: 'check_in_time', label: 'Check-in Time' },
  { key: 'check_out_time', label: 'Check-out Time' },
  { key: 'work_hours', label: 'Work Hours' },
  { key: 'status', label: 'Attendance Status' },
  { key: 'check_in_location', label: 'Check-in Location' },
  { key: 'check_out_location', label: 'Check-out Location' },
  { key: 'notes', label: 'Notes/Remarks' },
] as const;

type FieldKey = (typeof FIELD_OPTIONS)[number]['key'];

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last-7', label: 'Last 7 Days' },
  { key: 'last-week', label: 'Last Week' },
  { key: 'last-month', label: 'Last Month' },
  { key: 'custom', label: 'Custom Range' },
];

function getPresetRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  switch (preset) {
    case 'yesterday': {
      const y = format(subDays(now, 1), 'yyyy-MM-dd');
      return { start: y, end: y };
    }
    case 'last-7':
      return { start: format(subDays(now, 6), 'yyyy-MM-dd'), end: todayStr };
    case 'last-week': {
      const lw = subWeeks(now, 1);
      return { start: format(startOfWeek(lw, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(endOfWeek(lw, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
    }
    case 'last-month': {
      const lm = subMonths(now, 1);
      return { start: format(startOfMonth(lm), 'yyyy-MM-dd'), end: format(endOfMonth(lm), 'yyyy-MM-dd') };
    }
    default:
      return { start: todayStr, end: todayStr };
  }
}

export const TeamAttendanceReportModal = ({ open, onOpenChange, subordinateIds }: TeamAttendanceReportModalProps) => {
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(new Set(FIELD_OPTIONS.map(f => f.key)));
  const [loading, setLoading] = useState(false);

  const allSelected = selectedFields.size === FIELD_OPTIONS.length;

  const toggleField = (key: FieldKey) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedFields(allSelected ? new Set() : new Set(FIELD_OPTIONS.map(f => f.key)));
  };

  const { startDate, endDate } = useMemo(() => {
    if (datePreset === 'custom') {
      return {
        startDate: customStart ? format(customStart, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        endDate: customEnd ? format(customEnd, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      };
    }
    const r = getPresetRange(datePreset);
    return { startDate: r.start, endDate: r.end };
  }, [datePreset, customStart, customEnd]);

  const fetchData = async () => {
    // Fetch attendance records
    const { data: attendance, error: attError } = await supabase
      .from('attendance')
      .select('user_id, date, check_in_time, check_out_time, total_hours, status, check_in_address, check_out_address, notes')
      .in('user_id', subordinateIds)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (attError) throw attError;

    // Fetch profiles for names
    const userIds = [...new Set((attendance || []).map(a => a.user_id))];
    let profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      profiles?.forEach(p => profileMap.set(p.id, p.full_name));
    }

    return (attendance || []).map(a => ({
      employee_name: profileMap.get(a.user_id) || '-',
      date: a.date,
      check_in_time: a.check_in_time ? format(new Date(a.check_in_time), 'hh:mm a') : '-',
      check_out_time: a.check_out_time ? format(new Date(a.check_out_time), 'hh:mm a') : '-',
      work_hours: a.total_hours != null ? `${a.total_hours}h` : '-',
      status: a.status?.replace('_', ' ') || '-',
      check_in_location: a.check_in_address || '-',
      check_out_location: a.check_out_address || '-',
      notes: a.notes || '-',
    }));
  };

  const getHeaders = () => FIELD_OPTIONS.filter(f => selectedFields.has(f.key));

  const handleExport = async (type: 'pdf' | 'excel') => {
    if (selectedFields.size === 0) {
      toast.error('Please select at least one field');
      return;
    }
    setLoading(true);
    try {
      const data = await fetchData();
      if (data.length === 0) {
        toast.info('No attendance records found for the selected range');
        setLoading(false);
        return;
      }
      const headers = getHeaders();
      const filename = `Team_Attendance_${startDate}_to_${endDate}`;

      if (type === 'pdf') {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' });
        doc.setFontSize(14);
        doc.text('Team Attendance Report', 14, 15);
        doc.setFontSize(9);
        doc.text(`Period: ${startDate} to ${endDate}  |  Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 22);

        const rows = data.map(row => headers.map(h => (row as any)[h.key]));
        autoTable(doc, {
          startY: 27,
          head: [headers.map(h => h.label)],
          body: rows,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [34, 139, 34] },
        });

        const blob = doc.output('blob');
        await downloadPDF(blob, `${filename}.pdf`);
      } else {
        const XLSX = await import('xlsx');
        const sheetData = data.map(row => {
          const obj: Record<string, string> = {};
          headers.forEach(h => { obj[h.label] = (row as any)[h.key]; });
          return obj;
        });
        const ws = XLSX.utils.json_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Team Attendance');
        await downloadExcel(wb, `${filename}.xlsx`, XLSX);
      }

      onOpenChange(false);
    } catch (e) {
      console.error('Report export error:', e);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Attendance Report</DialogTitle>
          <DialogDescription>Select date range and fields to include in the report.</DialogDescription>
        </DialogHeader>

        {/* Date Range */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Date Range</h4>
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map(p => (
              <Button
                key={p.key}
                size="sm"
                variant={datePreset === p.key ? 'default' : 'outline'}
                className="text-xs h-7"
                onClick={() => setDatePreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          {datePreset === 'custom' && (
            <div className="flex gap-2 mt-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-xs", !customStart && "text-muted-foreground")}>
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {customStart ? format(customStart, 'dd MMM yyyy') : 'Start Date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customStart} onSelect={setCustomStart} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-xs", !customEnd && "text-muted-foreground")}>
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {customEnd ? format(customEnd, 'dd MMM yyyy') : 'End Date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {startDate} → {endDate}
          </p>
        </div>

        {/* Field Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">Fields</h4>
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={toggleAll}>
              {allSelected ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_OPTIONS.map(f => (
              <label key={f.key} className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={selectedFields.has(f.key)}
                  onCheckedChange={() => toggleField(f.key)}
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1"
            disabled={loading || selectedFields.size === 0}
            onClick={() => handleExport('pdf')}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            Generate PDF
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={loading || selectedFields.size === 0}
            onClick={() => handleExport('excel')}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
            Generate Excel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
