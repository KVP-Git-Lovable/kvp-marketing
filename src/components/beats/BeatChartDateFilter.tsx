import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export type ChartRangePreset =
  | 'today'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'custom';

export const CHART_RANGE_LABELS: Record<ChartRangePreset, string> = {
  today: 'Today',
  this_week: 'This Week',
  last_week: 'Last Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  custom: 'Date Range',
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** Monday-start week beginning for a date. */
const weekStart = (d: Date) => {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const s = startOfDay(d);
  s.setDate(s.getDate() - diff);
  return s;
};

export interface ResolvedRange {
  start: Date;
  end: Date;
  label: string;
}

export function resolveChartRange(
  preset: ChartRangePreset,
  from?: Date,
  to?: Date,
): ResolvedRange {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now), label: 'Today' };
    case 'this_week': {
      const s = weekStart(now);
      return { start: s, end: endOfDay(now), label: 'This Week' };
    }
    case 'last_week': {
      const s = weekStart(now);
      s.setDate(s.getDate() - 7);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      return { start: s, end: endOfDay(e), label: 'Last Week' };
    }
    case 'this_month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: s, end: endOfDay(now), label: 'This Month' };
    }
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: s, end: endOfDay(e), label: 'Last Month' };
    }
    case 'custom':
    default: {
      const s = from ? startOfDay(from) : new Date(now.getFullYear(), now.getMonth(), 1);
      const e = to ? endOfDay(to) : endOfDay(now);
      return {
        start: s,
        end: e,
        label: `${format(s, 'dd MMM yyyy')} – ${format(e, 'dd MMM yyyy')}`,
      };
    }
  }
}

interface Props {
  preset: ChartRangePreset;
  onPresetChange: (p: ChartRangePreset) => void;
  from?: Date;
  to?: Date;
  onFromChange: (d: Date | undefined) => void;
  onToChange: (d: Date | undefined) => void;
  /** Human-readable currently selected period. */
  periodLabel: string;
}

export function BeatChartDateFilter({
  preset,
  onPresetChange,
  from,
  to,
  onFromChange,
  onToChange,
  periodLabel,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Period</span>

      <Select value={preset} onValueChange={(v) => onPresetChange(v as ChartRangePreset)}>
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(CHART_RANGE_LABELS) as ChartRangePreset[]).map((k) => (
            <SelectItem key={k} value={k}>
              {CHART_RANGE_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn('justify-start text-left font-normal', !from && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {from ? format(from, 'dd MMM yyyy') : 'Start date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={from}
                onSelect={onFromChange}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn('justify-start text-left font-normal', !to && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {to ? format(to, 'dd MMM yyyy') : 'End date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={to}
                onSelect={onToChange}
                initialFocus
                disabled={(date) => (from ? date < from : false)}
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </>
      )}

      <Badge variant="secondary" className="font-normal">
        Showing: {periodLabel}
      </Badge>
    </div>
  );
}
