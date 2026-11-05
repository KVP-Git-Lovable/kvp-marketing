import { useState, useMemo } from 'react';
import { useSubordinates, Subordinate } from '@/hooks/useSubordinates';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Users, UserCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MultiUserSelectorProps {
  selectedUserIds: string[];
  onSelectionChange: (userIds: string[]) => void;
  className?: string;
}

export function MultiUserSelector({
  selectedUserIds,
  onSelectionChange,
  className,
}: MultiUserSelectorProps) {
  const { subordinates, isLoading } = useSubordinates();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSubordinates = useMemo(() => {
    if (!searchQuery.trim()) return subordinates;
    const query = searchQuery.toLowerCase();
    return subordinates.filter(sub =>
      sub.full_name.toLowerCase().includes(query)
    );
  }, [subordinates, searchQuery]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleToggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onSelectionChange(selectedUserIds.filter(id => id !== userId));
    } else {
      onSelectionChange([...selectedUserIds, userId]);
    }
  };

  const handleSelectAll = () => {
    const allIds = filteredSubordinates.map(s => s.subordinate_user_id);
    onSelectionChange(allIds);
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-4">
          <div className="h-48 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Select Team Members
          </CardTitle>
          {selectedUserIds.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <UserCheck className="h-3 w-3" />
              {selectedUserIds.length} selected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={filteredSubordinates.length === 0}
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeselectAll}
            disabled={selectedUserIds.length === 0}
          >
            Clear
          </Button>
        </div>

        {/* User List */}
        <ScrollArea className="h-[280px] pr-4">
          <div className="space-y-2">
            {filteredSubordinates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No matching team members' : 'No team members found'}
              </div>
            ) : (
              filteredSubordinates.map((sub) => (
                <div
                  key={sub.subordinate_user_id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    selectedUserIds.includes(sub.subordinate_user_id)
                      ? 'bg-primary/5 border-primary/30'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() => handleToggleUser(sub.subordinate_user_id)}
                  style={{ marginLeft: `${(sub.level - 1) * 16}px` }}
                >
                  <Checkbox
                    checked={selectedUserIds.includes(sub.subordinate_user_id)}
                    onCheckedChange={() => handleToggleUser(sub.subordinate_user_id)}
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(sub.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{sub.full_name}</p>
                    {sub.level > 1 && (
                      <p className="text-xs text-muted-foreground">Level {sub.level}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Selected Summary */}
        {selectedUserIds.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex flex-wrap gap-2">
              {selectedUserIds.slice(0, 5).map((userId) => {
                const user = subordinates.find(s => s.subordinate_user_id === userId);
                return (
                  <Badge
                    key={userId}
                    variant="outline"
                    className="gap-1 pr-1"
                  >
                    {user?.full_name || 'Unknown'}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleUser(userId);
                      }}
                      className="ml-1 hover:bg-muted rounded p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
              {selectedUserIds.length > 5 && (
                <Badge variant="secondary">
                  +{selectedUserIds.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
