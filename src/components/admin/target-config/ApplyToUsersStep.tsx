import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ACTIVE_PROFILE } from '@/lib/activeUserFilter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, CheckCircle2, User, GitBranch, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserFYPlanTarget } from '@/components/profile/UserFYPlanTarget';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-image';
import { HierarchyUserTargetNode, HierarchyNodeData, EnabledParameters, EnabledBasis } from './HierarchyUserTargetNode';
import { useAuth } from '@/hooks/useAuth';

interface TargetConfig {
  enable_quantity: boolean;
  enable_revenue: boolean;
  enable_visits: boolean;
  quantity_unit: string;
  enabled_parameters: {
    product: boolean;
    retailer: boolean;
    beat: boolean;
    distributor: boolean;
    territory: boolean;
    monthly: boolean;
  };
  target_start_month?: number;
  target_end_month?: number;
}

interface FYTargets {
  total_quantity_target: number;
  total_revenue_target: number;
  total_visits_target: number;
}

interface ApplyToUsersStepProps {
  config: TargetConfig;
  targets: FYTargets;
  fyYear: number;
  onBack: () => void;
  onComplete: () => void;
}

type AllocationMode = 'individual' | 'hierarchy';
type TargetType = 'quantity' | 'revenue' | 'visits';

export function ApplyToUsersStep({ 
  config, 
  targets, 
  fyYear, 
  onBack,
  onComplete
}: ApplyToUsersStepProps) {
  const { user } = useAuth();
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('individual');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRootUserId, setSelectedRootUserId] = useState<string | null>(null);
  const [selectedTargetType, setSelectedTargetType] = useState<TargetType>('quantity');
  const [hierarchyData, setHierarchyData] = useState<HierarchyNodeData[]>([]);

  // Fetch all users/profiles for individual selection
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['all-profiles-for-targets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, profile_picture_url').match(ACTIVE_PROFILE)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch users at the top of the reporting hierarchy for hierarchy mode
  const { data: managers = [] } = useQuery({
    queryKey: ['hierarchy-root-users'],
    queryFn: async () => {
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('user_id, manager_id')
        .not('user_id', 'is', null);

      if (employeesError) throw employeesError;

      const managerIdsSet = new Set<string>();
      employees?.forEach((e: any) => {
        if (e.manager_id) managerIdsSet.add(e.manager_id);
      });

      const topLevelUsers = (employees || []).filter((e: any) => {
        const hasNoManager = !e.manager_id;
        const hasSubordinates = managerIdsSet.has(e.user_id);
        return hasNoManager || hasSubordinates;
      });

      const userIds = Array.from(
        new Set(topLevelUsers.map((e: any) => e.user_id).filter(Boolean))
      );

      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, profile_picture_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profilesById = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));

      return topLevelUsers
        .filter((e: any, index: number, self: any[]) =>
          index === self.findIndex((t: any) => t.user_id === e.user_id)
        )
        .map((e: any) => {
          const p = profilesById.get(e.user_id);
          return {
            id: e.user_id,
            full_name: p?.full_name || 'Unknown',
            profile_picture_url: p?.profile_picture_url,
            hasManager: !!e.manager_id,
          };
        })
        .sort((a: any, b: any) => {
          if (!a.hasManager && b.hasManager) return -1;
          if (a.hasManager && !b.hasManager) return 1;
          return (a.full_name || '').localeCompare(b.full_name || '');
        });
    },
    enabled: allocationMode === 'hierarchy',
  });

  // Fetch the hierarchy starting from root user
  const { data: subordinatesData, isLoading: loadingHierarchy } = useQuery({
    queryKey: ['all-subordinates', selectedRootUserId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_subordinates', {
        manager_user_id: selectedRootUserId!,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedRootUserId && allocationMode === 'hierarchy',
  });

  // Fetch profile pictures for hierarchy
  const { data: hierarchyProfiles } = useQuery({
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
    if (!subordinatesData || !hierarchyProfiles) return;

    const profileMap = new Map(hierarchyProfiles.map((p: any) => [p.id, p]));
    const managerMap = new Map(employeeData?.map((e: any) => [e.user_id, e.manager_id]) || []);

    // Calculate per-user targets (equal divide for now)
    const leafCount = subordinatesData.filter((s: any) => {
      const hasChildren = subordinatesData.some((other: any) => 
        managerMap.get(other.subordinate_user_id) === s.subordinate_user_id
      );
      return !hasChildren;
    }).length;

    const perLeafQty = leafCount > 0 ? targets.total_quantity_target / leafCount : 0;
    const perLeafRev = leafCount > 0 ? targets.total_revenue_target / leafCount : 0;
    const perLeafVisits = leafCount > 0 ? targets.total_visits_target / leafCount : 0;

    // Create nodes for all users
    const nodeMap = new Map<string, HierarchyNodeData>();
    
    subordinatesData.forEach((sub: any) => {
      const profile: any = profileMap.get(sub.subordinate_user_id);
      // Hide inactive users from this "assign new work" target picker, but always
      // keep the selected root user even if they were deactivated.
      if (sub.subordinate_user_id !== selectedRootUserId && profile?.is_active === false) {
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
        visitsTarget: 0,
        children: [],
      });
    });

    // Build tree structure
    const roots: HierarchyNodeData[] = [];
    
    nodeMap.forEach((node) => {
      if (node.level === 0 || node.userId === selectedRootUserId) {
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

    // Assign targets (equal divide to leaves, roll up to managers)
    const assignTargets = (nodes: HierarchyNodeData[]) => {
      nodes.forEach((node) => {
        if (node.children.length === 0) {
          // Leaf node
          node.quantityTarget = perLeafQty;
          node.revenueTarget = perLeafRev;
          node.visitsTarget = perLeafVisits;
        } else {
          // Manager - assign to children first, then sum up
          assignTargets(node.children);
          node.quantityTarget = node.children.reduce((sum, c) => sum + c.quantityTarget, 0);
          node.revenueTarget = node.children.reduce((sum, c) => sum + c.revenueTarget, 0);
          node.visitsTarget = node.children.reduce((sum, c) => sum + c.visitsTarget, 0);
        }
      });
    };
    assignTargets(roots);

    setHierarchyData(roots);
  }, [subordinatesData, hierarchyProfiles, employeeData, selectedRootUserId, targets]);

  useEffect(() => {
    if (allocationMode === 'hierarchy') {
      buildHierarchyTree();
    }
  }, [buildHierarchyTree, allocationMode]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const enabledParams = useMemo(() => {
    return Object.entries(config.enabled_parameters)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => key);
  }, [config.enabled_parameters]);

  const selectedUser = useMemo(() => {
    return users?.find(u => u.id === selectedUserId);
  }, [users, selectedUserId]);

  const enabledBasis: EnabledBasis = {
    quantity: config.enable_quantity,
    revenue: config.enable_revenue,
    visits: config.enable_visits,
  };

  const handleTargetChange = (userId: string, field: string, value: number) => {
    // Update target in hierarchy data - for future manual editing
    console.log('Target change:', userId, field, value);
  };

  // Get available target types for dropdown
  const availableTargetTypes = useMemo(() => {
    const types: { value: TargetType; label: string }[] = [];
    if (config.enable_quantity) types.push({ value: 'quantity', label: `Quantity (${config.quantity_unit})` });
    if (config.enable_revenue) types.push({ value: 'revenue', label: 'Revenue (₹)' });
    if (config.enable_visits) types.push({ value: 'visits', label: 'Visits' });
    return types;
  }, [config]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Step 3: Apply Targets to Users
          </CardTitle>
          <CardDescription>
            Allocate FY {fyYear - 1}-{String(fyYear).slice(-2)} targets to team members with parameter breakdowns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* FY Targets Summary */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-3">FY Targets to Allocate:</p>
            <div className="grid grid-cols-3 gap-4">
              {config.enable_quantity && (
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-2xl font-bold text-primary">{formatNumber(targets.total_quantity_target)}</p>
                  <p className="text-xs text-muted-foreground">{config.quantity_unit}</p>
                </div>
              )}
              {config.enable_revenue && (
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-2xl font-bold text-primary">₹{formatNumber(targets.total_revenue_target)}</p>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                </div>
              )}
              {config.enable_visits && (
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-2xl font-bold text-primary">{formatNumber(targets.total_visits_target)}</p>
                  <p className="text-xs text-muted-foreground">Visits</p>
                </div>
              )}
            </div>
          </div>

          {/* Allocation Mode */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Allocation Method</Label>
            <RadioGroup 
              value={allocationMode} 
              onValueChange={(v) => setAllocationMode(v as AllocationMode)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="individual" />
                <Label htmlFor="individual" className="font-normal cursor-pointer flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Individual User
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="hierarchy" id="hierarchy" />
                <Label htmlFor="hierarchy" className="font-normal cursor-pointer flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Hierarchy Cascade
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Enabled Parameters Info */}
          {enabledParams.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">Enabled breakdowns:</span>
              {enabledParams.map((param) => (
                <Badge key={param} variant="outline" className="capitalize">
                  {param}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Mode - User Selection */}
      {allocationMode === 'individual' && (
        <>
          <Card>
            <CardContent className="py-4">
              <div className="space-y-3">
                <Label className="text-base font-semibold">Select User</Label>
                {usersLoading ? (
                  <Skeleton className="h-10 w-64" />
                ) : (
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <SignedAvatarImage src={user.profile_picture_url} />
                              <AvatarFallback>{(user.full_name || user.username || 'U').charAt(0)}</AvatarFallback>
                            </Avatar>
                            {user.full_name || user.username || 'Unknown User'}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Individual User Target Setting */}
          {selectedUserId && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Setting Targets for: {selectedUser?.full_name || 'Selected User'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UserFYPlanTarget 
                  targetUserId={selectedUserId}
                  enabledParameters={config.enabled_parameters}
                  fyConfig={{
                    quantityTarget: targets.total_quantity_target,
                    revenueTarget: targets.total_revenue_target,
                    quantityUnit: config.quantity_unit,
                  }}
                  preselectedYear={fyYear}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Hierarchy Mode */}
      {allocationMode === 'hierarchy' && (
        <>
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Root User Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Root User:</span>
                  <Select value={selectedRootUserId || ''} onValueChange={setSelectedRootUserId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select hierarchy root" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((manager: any) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <SignedAvatarImage src={manager.profile_picture_url} />
                              <AvatarFallback>{manager.full_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span>{manager.full_name}</span>
                            {!manager.hasManager && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0">
                                Top Level
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Target Type Selector */}
                {availableTargetTypes.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">View:</span>
                    <Select value={selectedTargetType} onValueChange={(v) => setSelectedTargetType(v as TargetType)}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTargetTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Hierarchy Tree */}
          {selectedRootUserId ? (
            loadingHierarchy ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="mt-2 text-muted-foreground">Loading hierarchy...</p>
                </CardContent>
              </Card>
            ) : hierarchyData.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Hierarchy View</CardTitle>
                  <CardDescription>
                    Expand each user to set parameter breakdowns (Beat, Monthly, Retailer, etc.)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {hierarchyData.map((node) => (
                      <HierarchyUserTargetNode
                        key={node.userId}
                        node={node}
                        enabledParameters={config.enabled_parameters}
                        enabledBasis={enabledBasis}
                        quantityUnit={config.quantity_unit}
                        fyYear={fyYear}
                        selectedTargetType={selectedTargetType}
                        onTargetChange={handleTargetChange}
                        targetStartMonth={config.target_start_month ?? 1}
                        targetEndMonth={config.target_end_month ?? 12}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No subordinates found for this user</p>
                </CardContent>
              </Card>
            )
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Root User</h3>
                <p className="text-muted-foreground">
                  Choose a user from the dropdown above to view and set hierarchy targets
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={onComplete} variant="default">
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Complete Setup
        </Button>
      </div>
    </div>
  );
}
