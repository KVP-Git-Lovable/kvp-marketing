import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, ChevronsUpDown, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const daysOfWeek = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' }
];

const weeksOfMonth = [
  { value: 'week1', label: '1st Week' },
  { value: 'week2', label: '2nd Week' },
  { value: 'week3', label: '3rd Week' },
  { value: 'week4', label: '4th Week' }
];

const monthsOfYear = [
  { value: 'january', label: 'January' },
  { value: 'february', label: 'February' },
  { value: 'march', label: 'March' },
  { value: 'april', label: 'April' },
  { value: 'may', label: 'May' },
  { value: 'june', label: 'June' },
  { value: 'july', label: 'July' },
  { value: 'august', label: 'August' },
  { value: 'september', label: 'September' },
  { value: 'october', label: 'October' },
  { value: 'november', label: 'November' },
  { value: 'december', label: 'December' }
];

interface Territory {
  id: string;
  name: string;
  region: string;
}

interface VariantFocusedFieldsProps {
  isFocused: boolean;
  focusedType?: 'fixed_date' | 'recurring' | 'keep_open';
  focusedDueDate: string;
  focusedTargetQuantity: number;
  focusedTerritories: string[];
  focusedRecurringConfig?: {
    days_of_week?: string[];
    weeks_of_month?: string[];
    months_of_year?: string[];
  };
  territories: Territory[];
  onIsFocusedChange: (value: boolean) => void;
  onFocusedTypeChange: (value: 'fixed_date' | 'recurring' | 'keep_open') => void;
  onFocusedDueDateChange: (value: string) => void;
  onFocusedTargetQuantityChange: (value: number) => void;
  onFocusedTerritoriesChange: (value: string[]) => void;
  onFocusedRecurringConfigChange: (value: any) => void;
}

export const VariantFocusedFields: React.FC<VariantFocusedFieldsProps> = ({
  isFocused,
  focusedType,
  focusedDueDate,
  focusedTargetQuantity,
  focusedTerritories,
  focusedRecurringConfig,
  territories,
  onIsFocusedChange,
  onFocusedTypeChange,
  onFocusedDueDateChange,
  onFocusedTargetQuantityChange,
  onFocusedTerritoriesChange,
  onFocusedRecurringConfigChange
}) => {
  const [territoryComboOpen, setTerritoryComboOpen] = useState(false);
  const [recurringType, setRecurringType] = useState<'days' | 'weeks' | 'months'>('days');

  return (
    <div className="space-y-4 pt-4 border-t">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_focused_variant"
          checked={isFocused}
          onCheckedChange={(checked) => onIsFocusedChange(!!checked)}
        />
        <Label htmlFor="is_focused_variant" className="font-semibold">
          Mark as Focused Product
        </Label>
      </div>

      {isFocused && (
        <div className="space-y-4 pl-6 border-l-2 border-primary/20">
          <div className="flex items-center gap-2">
            <Label className="font-semibold">Focused Product Schedules</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">Choose how to schedule this focused product</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <RadioGroup
            value={focusedType}
            onValueChange={(value) => onFocusedTypeChange(value as 'fixed_date' | 'recurring' | 'keep_open')}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fixed_date" id="v_fixed_date" />
              <Label htmlFor="v_fixed_date" className="cursor-pointer flex items-center gap-1">
                Fixed Date
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">One-time campaign with specific end date</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="recurring" id="v_recurring" />
              <Label htmlFor="v_recurring" className="cursor-pointer flex items-center gap-1">
                Recurring
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Automated schedule based on selected pattern</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="keep_open" id="v_keep_open" />
              <Label htmlFor="v_keep_open" className="cursor-pointer flex items-center gap-1">
                Keep it Open
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">No expiry date, active until manually disabled</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
            </div>
          </RadioGroup>

          {/* Fixed Date Configuration */}
          {focusedType === 'fixed_date' && (
            <div className="space-y-4 pl-6 border-l-2 border-primary/20">
              <div>
                <Label htmlFor="v_focused_due_date">Due Date</Label>
                <Input
                  id="v_focused_due_date"
                  type="date"
                  value={focusedDueDate}
                  onChange={(e) => onFocusedDueDateChange(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* Recurring Configuration */}
          {focusedType === 'recurring' && (
            <div className="space-y-4 pl-6 border-l-2 border-primary/20">
              <div>
                <Label className="font-medium">Recurring Pattern</Label>
                <RadioGroup
                  value={recurringType}
                  onValueChange={(value) => setRecurringType(value as 'days' | 'weeks' | 'months')}
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="days" id="v_days" />
                    <Label htmlFor="v_days" className="cursor-pointer">Days of Week</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="weeks" id="v_weeks" />
                    <Label htmlFor="v_weeks" className="cursor-pointer">Weeks of Month</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="months" id="v_months" />
                    <Label htmlFor="v_months" className="cursor-pointer">Months of Year</Label>
                  </div>
                </RadioGroup>
              </div>

              {recurringType === 'days' && (
                <div>
                  <Label>Select Days</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {daysOfWeek.map(day => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`v_day-${day.value}`}
                          checked={focusedRecurringConfig?.days_of_week?.includes(day.value)}
                          onCheckedChange={(checked) => {
                            const current = focusedRecurringConfig?.days_of_week || [];
                            const updated = checked
                              ? [...current, day.value]
                              : current.filter(d => d !== day.value);
                            onFocusedRecurringConfigChange({
                              days_of_week: updated,
                              weeks_of_month: [],
                              months_of_year: []
                            });
                          }}
                        />
                        <Label htmlFor={`v_day-${day.value}`} className="cursor-pointer text-sm">
                          {day.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recurringType === 'weeks' && (
                <div>
                  <Label>Select Weeks</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {weeksOfMonth.map(week => (
                      <div key={week.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`v_week-${week.value}`}
                          checked={focusedRecurringConfig?.weeks_of_month?.includes(week.value)}
                          onCheckedChange={(checked) => {
                            const current = focusedRecurringConfig?.weeks_of_month || [];
                            const updated = checked
                              ? [...current, week.value]
                              : current.filter(w => w !== week.value);
                            onFocusedRecurringConfigChange({
                              days_of_week: [],
                              weeks_of_month: updated,
                              months_of_year: []
                            });
                          }}
                        />
                        <Label htmlFor={`v_week-${week.value}`} className="cursor-pointer text-sm">
                          {week.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recurringType === 'months' && (
                <div>
                  <Label>Select Months</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {monthsOfYear.map(month => (
                      <div key={month.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`v_month-${month.value}`}
                          checked={focusedRecurringConfig?.months_of_year?.includes(month.value)}
                          onCheckedChange={(checked) => {
                            const current = focusedRecurringConfig?.months_of_year || [];
                            const updated = checked
                              ? [...current, month.value]
                              : current.filter(m => m !== month.value);
                            onFocusedRecurringConfigChange({
                              days_of_week: [],
                              weeks_of_month: [],
                              months_of_year: updated
                            });
                          }}
                        />
                        <Label htmlFor={`v_month-${month.value}`} className="cursor-pointer text-sm">
                          {month.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Target Quantity - shown for all types */}
          <div>
            <Label htmlFor="v_focused_target_quantity">Target Quantity</Label>
            <Input
              id="v_focused_target_quantity"
              type="number"
              value={focusedTargetQuantity}
              onChange={(e) => onFocusedTargetQuantityChange(parseInt(e.target.value) || 0)}
              placeholder="Enter target quantity"
            />
          </div>

          {/* Territories Multi-select - shown for all types */}
          <div>
            <Label>Territories</Label>
            <Popover open={territoryComboOpen} onOpenChange={setTerritoryComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={territoryComboOpen}
                  className="w-full justify-between"
                >
                  {focusedTerritories.length > 0
                    ? `${focusedTerritories.length} selected`
                    : "Select territories..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search territories..." />
                  <CommandList>
                    <CommandEmpty>No territory found.</CommandEmpty>
                    <CommandGroup>
                      {territories.map((territory) => (
                        <CommandItem
                          key={territory.id}
                          value={territory.name}
                          onSelect={() => {
                            const isSelected = focusedTerritories.includes(territory.id);
                            const updated = isSelected
                              ? focusedTerritories.filter(id => id !== territory.id)
                              : [...focusedTerritories, territory.id];
                            onFocusedTerritoriesChange(updated);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              focusedTerritories.includes(territory.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {territory.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {focusedTerritories.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {focusedTerritories.map((id) => {
                  const territory = territories.find(t => t.id === id);
                  return territory ? (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {territory.name}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => onFocusedTerritoriesChange(
                          focusedTerritories.filter(tid => tid !== id)
                        )}
                      />
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
