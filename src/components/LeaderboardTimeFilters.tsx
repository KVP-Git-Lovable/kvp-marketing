import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface LeaderboardTimeFiltersProps {
  timeFilter: "today" | "yesterday" | "week" | "month" | "quarter" | "year" | "custom";
  onFilterChange: (filter: "today" | "yesterday" | "week" | "month" | "quarter" | "year" | "custom") => void;
  customStartDate?: Date;
  customEndDate?: Date;
  onCustomStartDateChange?: (date: Date | undefined) => void;
  onCustomEndDateChange?: (date: Date | undefined) => void;
  /** Lets a caller place the control; the trigger fills whatever width it gets. */
  className?: string;
  /** Lets a caller restyle the trigger — it sits on a dark hero here, not a page. */
  triggerClassName?: string;
}

export function LeaderboardTimeFilters({ 
  timeFilter, 
  onFilterChange,
  customStartDate,
  customEndDate,
  onCustomStartDateChange,
  onCustomEndDateChange,
  className,
  triggerClassName
}: LeaderboardTimeFiltersProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Select value={timeFilter} onValueChange={onFilterChange}>
        <SelectTrigger className={cn("h-10 w-full sm:w-[180px] bg-background text-foreground", triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today's Points</SelectItem>
          <SelectItem value="yesterday">Yesterday</SelectItem>
          <SelectItem value="week">This Week</SelectItem>
          <SelectItem value="month">This Month</SelectItem>
          <SelectItem value="quarter">This Quarter</SelectItem>
          <SelectItem value="year">Year-to-Date</SelectItem>
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>

      {timeFilter === "custom" && onCustomStartDateChange && onCustomEndDateChange && (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal bg-background text-foreground",
                  !customStartDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customStartDate ? format(customStartDate, "PP") : "Start date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customStartDate}
                onSelect={onCustomStartDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal bg-background text-foreground",
                  !customEndDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customEndDate ? format(customEndDate, "PP") : "End date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customEndDate}
                onSelect={onCustomEndDateChange}
                initialFocus
                disabled={(date) => customStartDate ? date < customStartDate : false}
              />
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  );
}