import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ChevronRight, ChevronDown, Loader2, Users, Circle, Building2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StrategyBadge, type TargetStrategy } from './TargetStrategySelector';
import { filterActiveSubordinateRows } from '@/lib/activeUserFilter';

interface TreeNode {
  userId: string;
  fullName: string;
  profilePictureUrl: string | null;
  level: number;
  children: TreeNode[];
  isManager: boolean;
  targetStrategy?: TargetStrategy;
}

interface OrganizationTreeProps {
  selectedNodeId: string | null;
  onNodeSelect: (userId: string, fullName: string, level: number) => void;
}

// Get role-based icon based on hierarchy level
const getRoleIcon = (level: number, isManager: boolean) => {
  if (level === 0) {
    // Root/CEO level - filled circle
    return <Circle className="h-4 w-4 fill-primary text-primary" />;
  } else if (level === 1 || isManager) {
    // Manager level - building icon
    return <Building2 className="h-4 w-4 text-muted-foreground" />;
  }
  // Field staff level - map pin
  return <MapPin className="h-4 w-4 text-muted-foreground" />;
};

export function OrganizationTree({ selectedNodeId, onNodeSelect }: OrganizationTreeProps) {
  const { user } = useAuth();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Fetch hierarchy
  const { data: hierarchy, isLoading } = useQuery({
    queryKey: ['organization-hierarchy', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase.rpc('get_all_subordinates', {
        manager_user_id: user.id,
      });

      if (error) throw error;

      // Hide inactive users from this "assign new work" org tree.
      const activeData = await filterActiveSubordinateRows((data || []) as any[]);

      // Fetch strategies for all users in the tree
      const userIds = activeData.map((d: any) => d.subordinate_user_id);
      const { data: plans } = await supabase
        .from('user_business_plans')
        .select('user_id, target_strategy')
        .in('user_id', userIds);

      const strategyMap = new Map<string, TargetStrategy>();
      plans?.forEach((p: any) => {
        if (p.target_strategy) strategyMap.set(p.user_id, p.target_strategy as TargetStrategy);
      });

      // Build tree structure
      const tree = buildTree(activeData, strategyMap);
      return tree;
    },
    enabled: !!user?.id,
  });

  const buildTree = (flatData: Array<{ subordinate_user_id: string; full_name: string; level: number }>, strategyMap: Map<string, TargetStrategy>): TreeNode[] => {
    if (flatData.length === 0) return [];

    // Group by level
    const levelMap = new Map<number, typeof flatData>();
    flatData.forEach(item => {
      const level = item.level;
      if (!levelMap.has(level)) {
        levelMap.set(level, []);
      }
      levelMap.get(level)!.push(item);
    });

    // Find the root (level 0)
    const root = levelMap.get(0)?.[0];
    if (!root) return [];

    // Simple approach: create tree from flat data
    const nodeMap = new Map<string, TreeNode>();
    
    // First pass: create all nodes
    flatData.forEach(item => {
      nodeMap.set(item.subordinate_user_id, {
        userId: item.subordinate_user_id,
        fullName: item.full_name || 'Unknown',
        profilePictureUrl: null,
        level: item.level,
        children: [],
        isManager: false,
        targetStrategy: strategyMap.get(item.subordinate_user_id),
      });
    });

    // Find direct children for each user
    const rootNode = nodeMap.get(root.subordinate_user_id);
    if (!rootNode) return [];

    // For now, attach level 1 users to root
    const level1Users = levelMap.get(1) || [];
    level1Users.forEach(l1 => {
      const node = nodeMap.get(l1.subordinate_user_id);
      if (node) {
        rootNode.children.push(node);
        rootNode.isManager = true;
        
        // Attach level 2 to level 1
        const level2Users = levelMap.get(2) || [];
        level2Users.forEach(l2 => {
          const l2Node = nodeMap.get(l2.subordinate_user_id);
          if (l2Node) {
            node.children.push(l2Node);
            node.isManager = true;
          }
        });
      }
    });

    return [rootNode];
  };

  const toggleExpand = (userId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.userId);
    const isSelected = selectedNodeId === node.userId;
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.userId} className="relative">
        {/* Vertical connector line for nested items */}
        {depth > 0 && (
          <div 
            className="absolute left-0 top-0 bottom-0 border-l-2 border-border"
            style={{ left: `${(depth - 1) * 20 + 10}px` }}
          />
        )}
        
        {/* Horizontal connector line */}
        {depth > 0 && (
          <div 
            className="absolute top-4 h-0.5 bg-border"
            style={{ 
              left: `${(depth - 1) * 20 + 10}px`,
              width: '10px'
            }}
          />
        )}

        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer transition-all',
            isSelected 
              ? 'bg-primary/10 text-primary border border-primary/30' 
              : 'hover:bg-muted border border-transparent',
          )}
          style={{ marginLeft: `${depth * 20}px` }}
          onClick={() => {
            onNodeSelect(node.userId, node.fullName, node.level);
            if (hasChildren) {
              toggleExpand(node.userId);
            }
          }}
        >
          {/* Expand/Collapse chevron */}
          {hasChildren ? (
            <button
              className="p-0.5 hover:bg-muted-foreground/10 rounded shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.userId);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          {/* Role-based icon */}
          <div className="shrink-0">
            {getRoleIcon(node.level, node.isManager)}
          </div>

          {/* Name */}
          <span className={cn(
            "flex-1 truncate text-sm font-medium",
            isSelected && "text-primary"
          )}>
            {node.fullName}
          </span>

          {/* Manager indicator + Strategy badge */}
          {node.isManager && (
            <div className="flex items-center gap-1 shrink-0">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {node.targetStrategy && (
                <StrategyBadge strategy={node.targetStrategy} />
              )}
            </div>
          )}
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="relative">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hierarchy || hierarchy.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No team hierarchy found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="p-3">
        <div className="space-y-1">
          {hierarchy.map(node => renderNode(node))}
        </div>
      </div>
    </ScrollArea>
  );
}
