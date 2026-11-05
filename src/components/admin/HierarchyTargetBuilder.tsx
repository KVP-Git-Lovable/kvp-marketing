import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Target, 
  Save, 
  Send, 
  Calculator, 
  Users, 
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { HierarchyTargetNode, HierarchyNodeData } from './HierarchyTargetNode';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  useHierarchyTargets, 
  useHierarchyTargetAllocations,
  HierarchyTarget 
} from '@/hooks/useHierarchyTargets';

interface HierarchyTargetBuilderProps {
  rootUserId: string;
  fyYear: number;
  existingTarget?: HierarchyTarget;
  onSave?: () => void;
  onPublish?: () => void;
}

export const HierarchyTargetBuilder: React.FC<HierarchyTargetBuilderProps> = ({
  rootUserId,
  fyYear,
  existingTarget,
  onSave,
  onPublish,
}) => {
  const [totalQuantity, setTotalQuantity] = useState(existingTarget?.total_quantity_target || 0);
  const [totalRevenue, setTotalRevenue] = useState(existingTarget?.total_revenue_target || 0);
  const [quantityUnit, setQuantityUnit] = useState(existingTarget?.quantity_unit || 'Kg');
  const [allocationMethod, setAllocationMethod] = useState<'equal' | 'percentage' | 'manual'>(
    (existingTarget?.allocation_method as any) || 'equal'
  );
  const [hierarchyData, setHierarchyData] = useState<HierarchyNodeData[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { createHierarchyTarget, updateHierarchyTarget, publishHierarchyTarget, isPublishing } = useHierarchyTargets();
  const { upsertAllocations } = useHierarchyTargetAllocations(existingTarget?.id);

  // Fetch the hierarchy starting from root user
  const { data: subordinatesData, isLoading: loadingHierarchy } = useQuery({
    queryKey: ['all-subordinates', rootUserId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_subordinates', {
        manager_user_id: rootUserId,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!rootUserId,
  });

  // Fetch profile pictures
  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-hierarchy', subordinatesData?.map((s: any) => s.subordinate_user_id)],
    queryFn: async () => {
      if (!subordinatesData?.length) return [];
      const userIds = subordinatesData.map((s: any) => s.subordinate_user_id);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, profile_picture_url, is_active')
        .in('id', userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!subordinatesData?.length,
  });

  // Fetch manager info for each user
  const { data: employeeData } = useQuery({
    queryKey: ['employees-for-hierarchy', subordinatesData?.map((s: any) => s.subordinate_user_id)],
    queryFn: async () => {
      if (!subordinatesData?.length) return [];
      const userIds = subordinatesData.map((s: any) => s.subordinate_user_id);
      const { data, error } = await supabase
        .from('employees')
        .select('user_id, manager_id')
        .in('user_id', userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!subordinatesData?.length,
  });

  // Build hierarchy tree from flat list
  const buildHierarchyTree = useCallback(() => {
    if (!subordinatesData || !profiles) return;

    const profileMap = new Map(profiles.map((p: any) => [p.id, p]));
    const managerMap = new Map(employeeData?.map((e: any) => [e.user_id, e.manager_id]) || []);

    // Create nodes for all users
    const nodeMap = new Map<string, HierarchyNodeData>();
    
    subordinatesData.forEach((sub: any) => {
      const profile: any = profileMap.get(sub.subordinate_user_id);
      // Hide inactive users from this "assign new work" target builder, but always
      // keep the root user itself even if they were deactivated.
      if (sub.subordinate_user_id !== rootUserId && profile?.is_active === false) {
        return;
      }
      const managerId = managerMap.get(sub.subordinate_user_id);

      nodeMap.set(sub.subordinate_user_id, {
        userId: sub.subordinate_user_id,
        fullName: profile?.full_name || sub.full_name || 'Unknown',
        profilePictureUrl: profile?.profile_picture_url || null,
        managerId: managerId || null,
        level: sub.level,
        allocationPercentage: 0,
        quantityTarget: 0,
        revenueTarget: 0,
        children: [],
      });
    });

    // Build tree structure
    const roots: HierarchyNodeData[] = [];
    
    nodeMap.forEach((node) => {
      if (node.level === 0 || node.userId === rootUserId) {
        roots.push(node);
      } else if (node.managerId && nodeMap.has(node.managerId)) {
        nodeMap.get(node.managerId)!.children.push(node);
      }
    });

    // Sort children by name
    const sortChildren = (nodes: HierarchyNodeData[]) => {
      nodes.sort((a, b) => a.fullName.localeCompare(b.fullName));
      nodes.forEach((node) => sortChildren(node.children));
    };
    sortChildren(roots);

    setHierarchyData(roots);
  }, [subordinatesData, profiles, employeeData, rootUserId]);

  useEffect(() => {
    buildHierarchyTree();
  }, [buildHierarchyTree]);

  // Calculate allocations based on method
  const calculateAllocations = useCallback(() => {
    if (!hierarchyData.length) return;

    const calculateNodeAllocation = (nodes: HierarchyNodeData[], parentQty: number, parentRev: number) => {
      if (allocationMethod === 'equal') {
        // Count all leaf nodes
        const countLeaves = (nodes: HierarchyNodeData[]): number => {
          return nodes.reduce((sum, node) => {
            if (node.children.length === 0) return sum + 1;
            return sum + countLeaves(node.children);
          }, 0);
        };

        const totalLeaves = countLeaves(nodes);
        const perLeafQty = totalLeaves > 0 ? parentQty / totalLeaves : 0;
        const perLeafRev = totalLeaves > 0 ? parentRev / totalLeaves : 0;

        const assignLeafTargets = (nodes: HierarchyNodeData[]) => {
          nodes.forEach((node) => {
            if (node.children.length === 0) {
              node.quantityTarget = perLeafQty;
              node.revenueTarget = perLeafRev;
              node.allocationPercentage = totalLeaves > 0 ? 100 / totalLeaves : 0;
            } else {
              // Manager's target is sum of children
              assignLeafTargets(node.children);
              node.quantityTarget = node.children.reduce((sum, c) => sum + c.quantityTarget, 0);
              node.revenueTarget = node.children.reduce((sum, c) => sum + c.revenueTarget, 0);
              node.allocationPercentage = 0;
            }
          });
        };

        assignLeafTargets(nodes);
      } else if (allocationMethod === 'percentage') {
        // Use percentages set by user
        const assignByPercentage = (nodes: HierarchyNodeData[], totalQty: number, totalRev: number) => {
          nodes.forEach((node) => {
            if (node.children.length === 0) {
              node.quantityTarget = (node.allocationPercentage / 100) * totalQty;
              node.revenueTarget = (node.allocationPercentage / 100) * totalRev;
            } else {
              assignByPercentage(node.children, totalQty, totalRev);
              node.quantityTarget = node.children.reduce((sum, c) => sum + c.quantityTarget, 0);
              node.revenueTarget = node.children.reduce((sum, c) => sum + c.revenueTarget, 0);
            }
          });
        };

        assignByPercentage(nodes, parentQty, parentRev);
      }
      // For 'manual', values are set directly by user
    };

    calculateNodeAllocation(hierarchyData, totalQuantity, totalRevenue);
    setHierarchyData([...hierarchyData]);
  }, [hierarchyData, allocationMethod, totalQuantity, totalRevenue]);

  useEffect(() => {
    if (allocationMethod !== 'manual') {
      calculateAllocations();
    }
  }, [allocationMethod, totalQuantity, totalRevenue, hierarchyData.length]);

  // Handlers for node changes
  const handlePercentageChange = (userId: string, percentage: number) => {
    const updateNode = (nodes: HierarchyNodeData[]): boolean => {
      for (const node of nodes) {
        if (node.userId === userId) {
          node.allocationPercentage = percentage;
          return true;
        }
        if (updateNode(node.children)) return true;
      }
      return false;
    };
    updateNode(hierarchyData);
    setHierarchyData([...hierarchyData]);
    calculateAllocations();
  };

  const handleQuantityChange = (userId: string, quantity: number) => {
    const updateNode = (nodes: HierarchyNodeData[]): boolean => {
      for (const node of nodes) {
        if (node.userId === userId) {
          node.quantityTarget = quantity;
          return true;
        }
        if (updateNode(node.children)) return true;
      }
      return false;
    };
    updateNode(hierarchyData);
    setHierarchyData([...hierarchyData]);
  };

  const handleRevenueChange = (userId: string, revenue: number) => {
    const updateNode = (nodes: HierarchyNodeData[]): boolean => {
      for (const node of nodes) {
        if (node.userId === userId) {
          node.revenueTarget = revenue;
          return true;
        }
        if (updateNode(node.children)) return true;
      }
      return false;
    };
    updateNode(hierarchyData);
    setHierarchyData([...hierarchyData]);
  };

  // Flatten hierarchy for saving
  const flattenHierarchy = (nodes: HierarchyNodeData[]): HierarchyNodeData[] => {
    const result: HierarchyNodeData[] = [];
    const flatten = (nodes: HierarchyNodeData[]) => {
      nodes.forEach((node) => {
        result.push(node);
        flatten(node.children);
      });
    };
    flatten(nodes);
    return result;
  };

  // Calculate totals for validation
  const allocatedTotals = useMemo(() => {
    const flatNodes = flattenHierarchy(hierarchyData);
    const leafNodes = flatNodes.filter(n => n.children.length === 0);
    return {
      quantity: leafNodes.reduce((sum, n) => sum + n.quantityTarget, 0),
      revenue: leafNodes.reduce((sum, n) => sum + n.revenueTarget, 0),
      percentage: leafNodes.reduce((sum, n) => sum + n.allocationPercentage, 0),
      userCount: flatNodes.length,
      leafCount: leafNodes.length,
    };
  }, [hierarchyData]);

  // Save handler
  const handleSave = async () => {
    setIsSaving(true);
    try {
      let targetId = existingTarget?.id;

      // Create or update hierarchy target
      if (existingTarget) {
        await updateHierarchyTarget({
          id: existingTarget.id,
          total_quantity_target: totalQuantity,
          total_revenue_target: totalRevenue,
          quantity_unit: quantityUnit,
          allocation_method: allocationMethod,
        });
      } else {
        const newTarget = await createHierarchyTarget({
          root_user_id: rootUserId,
          fy_year: fyYear,
          total_quantity_target: totalQuantity,
          total_revenue_target: totalRevenue,
          quantity_unit: quantityUnit,
          allocation_method: allocationMethod,
        });
        targetId = newTarget.id;
      }

      // Save allocations
      if (targetId) {
        const flatNodes = flattenHierarchy(hierarchyData);
        const allocations = flatNodes.map((node) => ({
          hierarchy_target_id: targetId!,
          user_id: node.userId,
          manager_id: node.managerId,
          level: node.level,
          allocation_percentage: node.allocationPercentage,
          quantity_target: node.quantityTarget,
          revenue_target: node.revenueTarget,
          effective_from: new Date().toISOString().split('T')[0],
          effective_to: null,
          allocation_method: allocationMethod === 'manual' ? 'manual' : 'inherited',
          is_synced_to_my_target: false,
          synced_at: null,
          notes: null,
        }));

        await upsertAllocations(allocations);
      }

      toast.success('Hierarchy targets saved successfully');
      onSave?.();
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Publish handler
  const handlePublish = async () => {
    if (!existingTarget) {
      toast.error('Please save the targets first before publishing');
      return;
    }

    try {
      await publishHierarchyTarget(existingTarget.id);
      onPublish?.();
    } catch (error: any) {
      toast.error('Failed to publish: ' + error.message);
    }
  };

  if (loadingHierarchy) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading hierarchy...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Target Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            FY {fyYear} Total Target
          </CardTitle>
          <CardDescription>
            Set the total target that will cascade down the hierarchy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quantity Target</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  value={totalQuantity || ''}
                  onChange={(e) => setTotalQuantity(parseFloat(e.target.value) || 0)}
                  placeholder="Enter quantity"
                  className="flex-1"
                />
                <select
                  value={quantityUnit}
                  onChange={(e) => setQuantityUnit(e.target.value)}
                  className="w-24 px-2 border rounded-md"
                >
                  {['Kg', 'Units', 'Liters', 'Pcs', 'Boxes', 'Tonnes'].map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Revenue Target (₹)</Label>
              <Input
                type="number"
                min="0"
                value={totalRevenue || ''}
                onChange={(e) => setTotalRevenue(parseFloat(e.target.value) || 0)}
                placeholder="Enter revenue target"
              />
            </div>

            <div className="space-y-2">
              <Label>Allocation Method</Label>
              <RadioGroup
                value={allocationMethod}
                onValueChange={(v) => setAllocationMethod(v as any)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="equal" id="equal" />
                  <Label htmlFor="equal" className="font-normal cursor-pointer">Equal</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percentage" id="percentage" />
                  <Label htmlFor="percentage" className="font-normal cursor-pointer">% Based</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="font-normal cursor-pointer">Manual</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Allocation Summary */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {allocatedTotals.userCount} users ({allocatedTotals.leafCount} leaf)
                </span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div className="text-sm">
                <span className="text-muted-foreground">Allocated:</span>{' '}
                <span className="font-medium">{allocatedTotals.quantity.toFixed(0)} {quantityUnit}</span>
                {' / '}
                <span className="font-medium">₹{allocatedTotals.revenue.toLocaleString()}</span>
              </div>
            </div>

            {allocatedTotals.percentage !== 100 && allocationMethod === 'percentage' && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {allocatedTotals.percentage.toFixed(1)}% allocated (should be 100%)
              </Badge>
            )}

            {allocatedTotals.percentage === 100 && allocationMethod === 'percentage' && (
              <Badge variant="default" className="gap-1 bg-green-600">
                <CheckCircle2 className="h-3 w-3" />
                100% allocated
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hierarchy Tree */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Hierarchy
          </CardTitle>
          <CardDescription>
            {allocationMethod === 'equal' && 'Targets are equally divided among all leaf-level team members'}
            {allocationMethod === 'percentage' && 'Set percentage for each leaf member to distribute targets'}
            {allocationMethod === 'manual' && 'Manually enter quantity and revenue targets for each member'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {hierarchyData.map((node) => (
              <HierarchyTargetNode
                key={node.userId}
                node={node}
                allocationMethod={allocationMethod}
                quantityUnit={quantityUnit}
                onPercentageChange={handlePercentageChange}
                onQuantityChange={handleQuantityChange}
                onRevenueChange={handleRevenueChange}
                isReadOnly={existingTarget?.status === 'locked'}
              />
            ))}

            {hierarchyData.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No team members found in the hierarchy. Please ensure the selected user has subordinates.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={handleSave}
          disabled={isSaving || !totalRevenue || hierarchyData.length === 0}
        >
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Draft
        </Button>

        <Button
          onClick={handlePublish}
          disabled={isPublishing || !existingTarget || existingTarget.status === 'published'}
        >
          {isPublishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Publish to My Target
        </Button>
      </div>
    </div>
  );
};
