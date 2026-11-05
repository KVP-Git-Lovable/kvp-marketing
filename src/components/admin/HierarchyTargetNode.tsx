import React, { useState } from 'react';
import { ChevronDown, ChevronRight, User, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface HierarchyNodeData {
  userId: string;
  fullName: string;
  profilePictureUrl: string | null;
  managerId: string | null;
  level: number;
  allocationPercentage: number;
  quantityTarget: number;
  revenueTarget: number;
  children: HierarchyNodeData[];
}

interface HierarchyTargetNodeProps {
  node: HierarchyNodeData;
  allocationMethod: 'equal' | 'percentage' | 'manual';
  quantityUnit: string;
  onPercentageChange: (userId: string, percentage: number) => void;
  onQuantityChange: (userId: string, quantity: number) => void;
  onRevenueChange: (userId: string, revenue: number) => void;
  isReadOnly?: boolean;
  depth?: number;
}

export const HierarchyTargetNode: React.FC<HierarchyTargetNodeProps> = ({
  node,
  allocationMethod,
  quantityUnit,
  onPercentageChange,
  onQuantityChange,
  onRevenueChange,
  isReadOnly = false,
  depth = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  const getLevelColor = (level: number): string => {
    const colors = [
      'bg-primary/10 border-primary/30',
      'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
      'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
      'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800',
      'bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800',
    ];
    return colors[level % colors.length];
  };

  const formatNumber = (num: number): string => {
    if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `${(num / 100000).toFixed(2)} L`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)} K`;
    return num.toFixed(0);
  };

  return (
    <div className="w-full">
      <div
        className={cn(
          'p-3 rounded-lg border transition-all',
          getLevelColor(node.level),
          depth > 0 && 'ml-6'
        )}
      >
        <div className="flex items-center gap-3">
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}

          {/* Avatar */}
          <Avatar className="h-10 w-10">
            <AvatarImage src={node.profilePictureUrl || undefined} />
            <AvatarFallback>
              {node.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>

          {/* Name and Level */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{node.fullName}</span>
              <Badge variant="outline" className="text-xs">
                L{node.level}
              </Badge>
              {hasChildren && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {node.children.length}
                </Badge>
              )}
            </div>
          </div>

          {/* Target Inputs */}
          <div className="flex items-center gap-2">
            {allocationMethod === 'percentage' && (
              <div className="w-20">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={node.allocationPercentage || ''}
                  onChange={(e) => onPercentageChange(node.userId, parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly}
                  className="h-8 text-sm text-right"
                  placeholder="%"
                />
              </div>
            )}

            <div className="w-28">
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  value={node.quantityTarget || ''}
                  onChange={(e) => onQuantityChange(node.userId, parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly || allocationMethod !== 'manual'}
                  className={cn(
                    'h-8 text-sm text-right pr-10',
                    allocationMethod !== 'manual' && 'bg-muted'
                  )}
                  placeholder="Qty"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {quantityUnit.slice(0, 3)}
                </span>
              </div>
            </div>

            <div className="w-32">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                <Input
                  type="number"
                  min="0"
                  value={node.revenueTarget || ''}
                  onChange={(e) => onRevenueChange(node.userId, parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly || allocationMethod !== 'manual'}
                  className={cn(
                    'h-8 text-sm text-right pl-6',
                    allocationMethod !== 'manual' && 'bg-muted'
                  )}
                  placeholder="Revenue"
                />
              </div>
            </div>

            {/* Display formatted values */}
            {allocationMethod !== 'manual' && (
              <div className="text-xs text-muted-foreground w-24 text-right">
                <div>₹{formatNumber(node.revenueTarget)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-2 space-y-2 border-l-2 border-muted ml-8 pl-2">
          {node.children.map((child) => (
            <HierarchyTargetNode
              key={child.userId}
              node={child}
              allocationMethod={allocationMethod}
              quantityUnit={quantityUnit}
              onPercentageChange={onPercentageChange}
              onQuantityChange={onQuantityChange}
              onRevenueChange={onRevenueChange}
              isReadOnly={isReadOnly}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
