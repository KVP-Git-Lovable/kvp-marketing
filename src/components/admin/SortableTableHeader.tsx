import { useState } from 'react';
import { TableHead } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

interface SortableTableHeaderProps {
  label: string;
  columnKey: string;
  sortKey: string | null;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
  filterValue?: string;
  onFilter?: (key: string, value: string) => void;
  filterOptions?: string[];
  filterType?: 'text' | 'select';
  sortable?: boolean;
  filterable?: boolean;
  className?: string;
}

export function SortableTableHeader({
  label,
  columnKey,
  sortKey,
  sortDirection,
  onSort,
  filterValue = '',
  onFilter,
  filterOptions = [],
  filterType = 'text',
  sortable = true,
  filterable = true,
  className,
}: SortableTableHeaderProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const isActive = sortKey === columnKey;
  const hasFilter = filterValue !== '';

  const handleSort = () => {
    if (sortable) {
      onSort(columnKey);
    }
  };

  const handleFilterChange = (value: string) => {
    onFilter?.(columnKey, value);
  };

  const clearFilter = () => {
    onFilter?.(columnKey, '');
    setFilterOpen(false);
  };

  return (
    <TableHead className={cn("text-[11px] font-medium text-muted-foreground py-2 h-8", className)}>
      <div className="flex items-center gap-1">
        <button
          onClick={handleSort}
          className={cn(
            "flex items-center gap-1 hover:text-foreground transition-colors",
            sortable && "cursor-pointer",
            isActive && "text-foreground"
          )}
          disabled={!sortable}
        >
          <span>{label}</span>
          {sortable && (
            <span className="w-3 h-3 flex items-center justify-center">
              {isActive ? (
                sortDirection === 'asc' ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )
              ) : (
                <ArrowUpDown className="h-3 w-3 opacity-40" />
              )}
            </span>
          )}
        </button>

        {filterable && (
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "p-0.5 rounded hover:bg-muted transition-colors",
                  hasFilter && "text-primary"
                )}
              >
                <Filter className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Filter {label}</span>
                  {hasFilter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={clearFilter}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
                {filterType === 'select' && filterOptions.length > 0 ? (
                  <Select value={filterValue} onValueChange={handleFilterChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {filterOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder={`Filter by ${label.toLowerCase()}...`}
                    value={filterValue}
                    onChange={(e) => handleFilterChange(e.target.value)}
                    className="h-8 text-xs"
                  />
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </TableHead>
  );
}

export function useTableSort<T>(defaultKey: string | null = null) {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortData = (data: T[], getValueFn: (item: T, key: string) => any) => {
    if (!sortKey || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aVal = getValueFn(a, sortKey);
      const bVal = getValueFn(b, sortKey);

      if (aVal === null || aVal === undefined) return sortDirection === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return sortDirection === 'asc' ? -1 : 1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }

      if (aVal instanceof Date && bVal instanceof Date) {
        return sortDirection === 'asc' 
          ? aVal.getTime() - bVal.getTime() 
          : bVal.getTime() - aVal.getTime();
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  };

  return { sortKey, sortDirection, handleSort, sortData };
}

export function useTableFilters(initialFilters: Record<string, string> = {}) {
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);

  const handleFilter = (key: string, value: string) => {
    setFilters(prev => {
      if (value === '' || value === '__all__') {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  };

  const filterData = <T,>(data: T[], getValueFn: (item: T, key: string) => string) => {
    return data.filter(item => {
      return Object.entries(filters).every(([key, filterValue]) => {
        if (!filterValue) return true;
        const itemValue = getValueFn(item, key);
        return itemValue.toLowerCase().includes(filterValue.toLowerCase());
      });
    });
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  return { filters, handleFilter, filterData, clearAllFilters, hasActiveFilters };
}
