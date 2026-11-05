import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubordinates, Subordinate } from '@/hooks/useSubordinates';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface UserSelectorProps {
  selectedUserId: string;
  onUserChange: (userId: string) => void;
  showAllOption?: boolean;
  allOptionLabel?: string;
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'onDark';
}

export const UserSelector = ({
  selectedUserId,
  onUserChange,
  showAllOption = true,
  allOptionLabel = 'All Team Members',
  className,
  disabled = false,
  variant = 'default',
}: UserSelectorProps) => {
  const { user } = useAuth();
  const { subordinates, isManager, isLoading } = useSubordinates();

  // Group subordinates by level for visual hierarchy
  const groupedSubordinates = useMemo(() => {
    const groups = new Map<number, Subordinate[]>();
    subordinates.forEach((sub) => {
      const list = groups.get(sub.level) || [];
      list.push(sub);
      groups.set(sub.level, list);
    });
    return groups;
  }, [subordinates]);

  // Get display name for selected user
  const getDisplayName = (userId: string): string => {
    if (userId === 'all') return allOptionLabel;
    if (userId === user?.id || userId === 'self') return 'My Data';
    const sub = subordinates.find((s) => s.subordinate_user_id === userId);
    return sub?.full_name || 'Unknown User';
  };

  // Don't render if user is not a manager (no subordinates)
  if (!isManager && !isLoading) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={cn('h-8 w-32 bg-muted animate-pulse rounded-md', className)} />
    );
  }

  const triggerClassName = cn(
    'h-8 w-auto min-w-[120px] max-w-[160px] text-sm',
    variant === 'onDark' &&
      'bg-background/10 text-primary-foreground border-primary-foreground/20 hover:bg-background/15 focus:ring-primary-foreground/30 backdrop-blur-sm',
    className
  );

  return (
    <Select value={selectedUserId} onValueChange={onUserChange} disabled={disabled}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder="Select">
          <span className="truncate">{getDisplayName(selectedUserId)}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="self" className="text-sm">My Data</SelectItem>

        {showAllOption && (
          <SelectItem value="all" className="text-sm">{allOptionLabel}</SelectItem>
        )}

        {subordinates.length > 0 && (
          <div className="border-t my-1" />
        )}

        {subordinates.map((sub) => (
          <SelectItem 
            key={sub.subordinate_user_id} 
            value={sub.subordinate_user_id}
            className="text-sm"
          >
            <span className="truncate" style={{ paddingLeft: `${(sub.level - 1) * 8}px` }}>
              {sub.full_name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
