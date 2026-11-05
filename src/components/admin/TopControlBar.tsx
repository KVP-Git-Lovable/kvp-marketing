import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { UserSelector } from '@/components/UserSelector';
import { Users, User, UserCheck, ChevronDown, Copy, Download, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export type UserScope = 'self' | 'single' | 'multiple' | 'team';

interface TopControlBarProps {
  userScope: UserScope;
  onUserScopeChange: (scope: UserScope) => void;
  selectedUserId: string;
  onSelectedUserChange: (userId: string) => void;
  selectedUserIds: string[];
  fyYear: number;
  onFYYearChange: (year: number) => void;
  onBulkAction?: (action: 'copy' | 'export') => void;
  className?: string;
}

const USER_SCOPE_OPTIONS = [
  { value: 'self', label: 'My Data', icon: User },
  { value: 'single', label: 'Single User', icon: User },
  { value: 'multiple', label: 'Multiple Users', icon: Users },
  { value: 'team', label: 'All Team', icon: UserCheck },
] as const;

// Generate FY options (current FY - 2 to current FY + 2)
const generateFYOptions = () => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  // If before April, current FY ends this year. Otherwise, FY ends next year.
  const currentFY = currentMonth < 3 ? currentDate.getFullYear() : currentDate.getFullYear() + 1;
  
  const options = [];
  for (let i = -2; i <= 2; i++) {
    const year = currentFY + i;
    options.push({
      value: year,
      label: `FY ${year - 1}-${String(year).slice(-2)}`,
    });
  }
  return options;
};

export function TopControlBar({
  userScope,
  onUserScopeChange,
  selectedUserId,
  onSelectedUserChange,
  selectedUserIds,
  fyYear,
  onFYYearChange,
  onBulkAction,
  className,
}: TopControlBarProps) {
  const fyOptions = useMemo(() => generateFYOptions(), []);

  const getScopeIcon = () => {
    const option = USER_SCOPE_OPTIONS.find(o => o.value === userScope);
    return option?.icon || User;
  };

  const ScopeIcon = getScopeIcon();

  return (
    <div className={cn('flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border', className)}>
      {/* User Scope Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground hidden sm:inline">Scope:</span>
        <Select value={userScope} onValueChange={(v) => onUserScopeChange(v as UserScope)}>
          <SelectTrigger className="w-[140px] h-9">
            <div className="flex items-center gap-2">
              <ScopeIcon className="h-4 w-4" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {USER_SCOPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <option.icon className="h-4 w-4" />
                  {option.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Single User Selector - show when scope is 'single' */}
      {userScope === 'single' && (
        <UserSelector
          selectedUserId={selectedUserId}
          onUserChange={onSelectedUserChange}
          showAllOption={false}
          className="h-9"
        />
      )}

      {/* Multiple Users Badge - show when scope is 'multiple' */}
      {userScope === 'multiple' && selectedUserIds.length > 0 && (
        <Badge variant="secondary" className="gap-1">
          <Users className="h-3 w-3" />
          {selectedUserIds.length} users selected
        </Badge>
      )}

      {/* FY Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground hidden sm:inline">FY:</span>
        <Select value={String(fyYear)} onValueChange={(v) => onFYYearChange(parseInt(v))}>
          <SelectTrigger className="w-[120px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fyOptions.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bulk Actions */}
      {onBulkAction && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <MoreHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Actions</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onBulkAction('copy')}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Targets to Users
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBulkAction('export')}>
              <Download className="h-4 w-4 mr-2" />
              Export to Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
