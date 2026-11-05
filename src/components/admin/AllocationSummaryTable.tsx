import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-image';
import { 
  Download, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock,
  UserMinus,
  UserPlus
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HierarchyTargetAllocation } from '@/hooks/useHierarchyTargets';

interface AllocationSummaryTableProps {
  allocations: HierarchyTargetAllocation[];
  quantityUnit: string;
  onAdjustUser?: (userId: string, type: 'join' | 'leave') => void;
  isReadOnly?: boolean;
}

export const AllocationSummaryTable: React.FC<AllocationSummaryTableProps> = ({
  allocations,
  quantityUnit,
  onAdjustUser,
  isReadOnly = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [syncFilter, setSyncFilter] = useState<string>('all');

  // Get unique levels for filter
  const levels = [...new Set(allocations.map(a => a.level))].sort((a, b) => a - b);

  // Filter allocations
  const filteredAllocations = allocations.filter((alloc) => {
    const matchesSearch = alloc.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          searchQuery === '';
    const matchesLevel = levelFilter === 'all' || alloc.level.toString() === levelFilter;
    const matchesSync = syncFilter === 'all' || 
                        (syncFilter === 'synced' && alloc.is_synced_to_my_target) ||
                        (syncFilter === 'pending' && !alloc.is_synced_to_my_target);
    
    return matchesSearch && matchesLevel && matchesSync;
  });

  // Calculate totals
  const totals = filteredAllocations.reduce(
    (acc, alloc) => ({
      quantity: acc.quantity + alloc.quantity_target,
      revenue: acc.revenue + alloc.revenue_target,
      percentage: acc.percentage + alloc.allocation_percentage,
    }),
    { quantity: 0, revenue: 0, percentage: 0 }
  );

  // Export to CSV
  const handleExport = () => {
    const headers = ['Name', 'Level', 'Allocation %', `Quantity (${quantityUnit})`, 'Revenue (₹)', 'Synced', 'Effective From'];
    const rows = filteredAllocations.map((alloc) => [
      alloc.user?.full_name || 'Unknown',
      `L${alloc.level}`,
      `${alloc.allocation_percentage.toFixed(1)}%`,
      alloc.quantity_target.toFixed(0),
      alloc.revenue_target.toFixed(0),
      alloc.is_synced_to_my_target ? 'Yes' : 'No',
      alloc.effective_from,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hierarchy-allocations-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatNumber = (num: number): string => {
    if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `${(num / 100000).toFixed(2)} L`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)} K`;
    return num.toFixed(0);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {levels.map((level) => (
              <SelectItem key={level} value={level.toString()}>
                Level {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={syncFilter} onValueChange={setSyncFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Sync Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="synced">Synced</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>

        {!isReadOnly && onAdjustUser && (
          <Button variant="outline" size="sm" onClick={() => onAdjustUser('', 'join')}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Member</TableHead>
              <TableHead className="text-center">Level</TableHead>
              <TableHead className="text-right">Allocation %</TableHead>
              <TableHead className="text-right">Quantity ({quantityUnit})</TableHead>
              <TableHead className="text-right">Revenue (₹)</TableHead>
              <TableHead className="text-center">Synced</TableHead>
              {!isReadOnly && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAllocations.map((alloc) => (
              <TableRow key={alloc.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <SignedAvatarImage src={alloc.user?.profile_picture_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {alloc.user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{alloc.user?.full_name || 'Unknown'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">L{alloc.level}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {alloc.allocation_percentage.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatNumber(alloc.quantity_target)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  ₹{formatNumber(alloc.revenue_target)}
                </TableCell>
                <TableCell className="text-center">
                  {alloc.is_synced_to_my_target ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-500 mx-auto" />
                  )}
                </TableCell>
                {!isReadOnly && onAdjustUser && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAdjustUser(alloc.user_id, 'leave')}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}

            {filteredAllocations.length === 0 && (
              <TableRow>
                <TableCell colSpan={isReadOnly ? 6 : 7} className="text-center py-8 text-muted-foreground">
                  No allocations found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      {filteredAllocations.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
          <span className="font-medium">
            Total ({filteredAllocations.length} members)
          </span>
          <div className="flex items-center gap-6">
            <span>
              <span className="text-muted-foreground mr-1">Qty:</span>
              <span className="font-medium">{formatNumber(totals.quantity)} {quantityUnit}</span>
            </span>
            <span>
              <span className="text-muted-foreground mr-1">Rev:</span>
              <span className="font-medium">₹{formatNumber(totals.revenue)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
