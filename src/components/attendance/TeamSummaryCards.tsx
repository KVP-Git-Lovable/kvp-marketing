import { CheckCircle, Cloud, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TeamFilter = 'all' | 'present' | 'on_leave' | 'absent';

interface TeamSummaryCardsProps {
  presentCount: number;
  onLeaveCount: number;
  absentCount: number;
  activeFilter: TeamFilter;
  onFilterChange: (filter: TeamFilter) => void;
  periodLabel?: string;
}

export const TeamSummaryCards = ({
  presentCount,
  onLeaveCount,
  absentCount,
  activeFilter,
  onFilterChange,
  periodLabel,
}: TeamSummaryCardsProps) => {
  const totalMembers = presentCount + onLeaveCount + absentCount;

  const cards = [
    {
      key: 'present' as TeamFilter,
      label: periodLabel ? `Present\n${periodLabel}` : 'Present\nToday',
      count: presentCount,
      icon: CheckCircle,
      bg: 'bg-[hsl(150,40%,94%)]',
      activeBg: 'bg-[hsl(150,45%,89%)] ring-2 ring-[hsl(150,45%,65%)]',
      iconColor: 'text-[hsl(150,50%,45%)]',
      countColor: 'text-[hsl(150,50%,35%)]',
      labelColor: 'text-[hsl(150,40%,40%)]',
    },
    {
      key: 'on_leave' as TeamFilter,
      label: 'On Leave',
      count: onLeaveCount,
      icon: Cloud,
      bg: 'bg-[hsl(30,60%,95%)]',
      activeBg: 'bg-[hsl(30,60%,90%)] ring-2 ring-[hsl(30,50%,65%)]',
      iconColor: 'text-[hsl(30,60%,55%)]',
      countColor: 'text-[hsl(30,50%,40%)]',
      labelColor: 'text-[hsl(30,45%,45%)]',
    },
    {
      key: 'absent' as TeamFilter,
      label: 'Absent',
      count: absentCount,
      icon: XCircle,
      bg: 'bg-[hsl(0,50%,95%)]',
      activeBg: 'bg-[hsl(0,50%,91%)] ring-2 ring-[hsl(0,50%,70%)]',
      iconColor: 'text-[hsl(0,55%,55%)]',
      countColor: 'text-[hsl(0,50%,40%)]',
      labelColor: 'text-[hsl(0,40%,45%)]',
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted-foreground font-medium">
        {totalMembers} Members
      </p>
      <div className="grid grid-cols-3 gap-3">
        {cards.map((card) => {
          const isActive = activeFilter === card.key;
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className={cn(
                'cursor-pointer transition-all rounded-2xl p-3 flex flex-col items-center justify-center text-center',
                isActive ? card.activeBg : card.bg,
              )}
              onClick={() => onFilterChange(isActive ? 'all' : card.key)}
            >
              <Icon className={cn('h-5 w-5 mb-1.5', card.iconColor)} />
              <div className="flex items-baseline gap-1">
                <span className={cn('text-2xl font-bold leading-none', card.countColor)}>
                  {card.count}
                </span>
                <span className={cn('text-[11px] leading-tight whitespace-pre-line', card.labelColor)}>
                  {card.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
