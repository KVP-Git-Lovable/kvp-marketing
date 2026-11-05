import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { Calendar, CalendarDays, CalendarRange, Layers } from 'lucide-react';

export type PeriodType = 'annual' | 'biannual' | 'quarterly' | 'monthly';

interface PeriodTypeSelectorProps {
  value: PeriodType;
  onChange: (value: PeriodType) => void;
  disabled?: boolean;
}

const PERIOD_OPTIONS: { value: PeriodType; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'annual', label: 'Annual', description: 'Single FY total', icon: Calendar },
  { value: 'biannual', label: 'Bi-Annual', description: 'H1 & H2 targets', icon: CalendarRange },
  { value: 'quarterly', label: 'Quarterly', description: 'Q1-Q4 targets', icon: CalendarDays },
];

export function PeriodTypeSelector({ value, onChange, disabled }: PeriodTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-base font-semibold">Target Entry Level</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Select how granularly you want to define targets. Finer granularity rolls up to coarser levels.
        </p>
      </div>
      
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as PeriodType)}
        className="flex flex-wrap gap-2 justify-start"
        disabled={disabled}
      >
        {PERIOD_OPTIONS.map(({ value: optValue, label, description, icon: Icon }) => (
          <ToggleGroupItem
            key={optValue}
            value={optValue}
            aria-label={label}
            className={`
              flex flex-col items-center gap-1 px-4 py-3 h-auto min-w-[100px] rounded-lg border-2 transition-all
              ${value === optValue 
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 data-[state=on]:bg-emerald-50 dark:data-[state=on]:bg-emerald-950/30' 
                : 'bg-background border-border hover:border-emerald-300 hover:bg-emerald-50/50 data-[state=off]:bg-background'
              }
            `}
          >
            <Icon className="h-5 w-5" />
            <span className="font-medium text-sm">{label}</span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
