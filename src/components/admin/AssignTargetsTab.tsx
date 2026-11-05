import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-image';
import { Users, User, GitBranch, Target, History } from 'lucide-react';
import { AdminSetTarget } from './AdminSetTarget';
import { HierarchyTargetBuilder } from './HierarchyTargetBuilder';
import { AllocationSummaryTable } from './AllocationSummaryTable';
import { MidwayAdjustmentDialog, AdjustmentType } from './MidwayAdjustmentDialog';
import { TopControlBar, UserScope } from './TopControlBar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHierarchyTargets, useHierarchyTargetAllocations, useHierarchyTargetHistory } from '@/hooks/useHierarchyTargets';
import { format } from 'date-fns';

interface AssignTargetsTabProps {
  fyYear: number;
  userScope: UserScope;
  onUserScopeChange: (scope: UserScope) => void;
  selectedUserId: string;
  onSelectedUserChange: (userId: string) => void;
  selectedUserIds: string[];
  onSelectedUserIdsChange: (ids: string[]) => void;
}

type AssignMode = 'individual' | 'hierarchy';

export function AssignTargetsTab({
  fyYear,
  userScope,
  onUserScopeChange,
  selectedUserId,
  onSelectedUserChange,
  selectedUserIds,
  onSelectedUserIdsChange,
}: AssignTargetsTabProps) {
  const [mode, setMode] = useState<AssignMode>('individual');
  const [selectedRootUserId, setSelectedRootUserId] = useState<string | null>(null);
  const [hierarchySubTab, setHierarchySubTab] = useState('set-targets');
  
  // Midway adjustment dialog state
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('leave');
  const [selectedUserForAdjustment, setSelectedUserForAdjustment] = useState<string | null>(null);

  const { hierarchyTargets, refetch } = useHierarchyTargets(fyYear);

  // Fetch users at the top of the reporting hierarchy
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
  });

  const existingTarget = hierarchyTargets.find(
    (t) => t.root_user_id === selectedRootUserId && t.fy_year === fyYear
  );

  const { allocations, refetch: refetchAllocations } = useHierarchyTargetAllocations(existingTarget?.id);
  const { history } = useHierarchyTargetHistory(existingTarget?.id);

  const handleAdjustUser = (userId: string, type: AdjustmentType) => {
    setSelectedUserForAdjustment(userId);
    setAdjustmentType(type);
    setAdjustmentDialogOpen(true);
  };

  const teamMembers = allocations.map(a => ({
    userId: a.user_id,
    fullName: a.user?.full_name || 'Unknown',
    profilePictureUrl: a.user?.profile_picture_url,
    currentQuantityTarget: a.quantity_target,
    currentRevenueTarget: a.revenue_target,
  }));

  const selectedUserInfo = teamMembers.find(m => m.userId === selectedUserForAdjustment);

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium">Assignment Mode:</span>
            <Tabs value={mode} onValueChange={(v) => setMode(v as AssignMode)} className="w-auto">
              <TabsList>
                <TabsTrigger value="individual" className="gap-2">
                  <User className="h-4 w-4" />
                  Individual Users
                </TabsTrigger>
                <TabsTrigger value="hierarchy" className="gap-2">
                  <GitBranch className="h-4 w-4" />
                  Hierarchy Cascade
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Individual Mode */}
      {mode === 'individual' && (
        <div className="space-y-4">
          <TopControlBar
            userScope={userScope}
            onUserScopeChange={onUserScopeChange}
            selectedUserId={selectedUserId}
            onSelectedUserChange={onSelectedUserChange}
            selectedUserIds={selectedUserIds}
            fyYear={fyYear}
            onFYYearChange={() => {}} // FY is controlled at parent level
          />
          <AdminSetTarget
            userScope={userScope}
            selectedUserId={selectedUserId}
            selectedUserIds={selectedUserIds}
            onSelectedUserIdsChange={onSelectedUserIdsChange}
            fyYear={fyYear}
          />
        </div>
      )}

      {/* Hierarchy Mode */}
      {mode === 'hierarchy' && (
        <div className="space-y-4">
          {/* Root User Selector */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-4">
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

                {existingTarget && (
                  <Badge variant={existingTarget.status === 'published' ? 'default' : 'secondary'}>
                    {existingTarget.status}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Hierarchy Content */}
          {selectedRootUserId ? (
            <Tabs value={hierarchySubTab} onValueChange={setHierarchySubTab}>
              <TabsList>
                <TabsTrigger value="set-targets" className="gap-2">
                  <Target className="h-4 w-4" />
                  Set Targets
                </TabsTrigger>
                <TabsTrigger value="allocations" className="gap-2">
                  <Users className="h-4 w-4" />
                  Allocations
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2">
                  <History className="h-4 w-4" />
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="set-targets" className="mt-4">
                <HierarchyTargetBuilder
                  rootUserId={selectedRootUserId}
                  fyYear={fyYear}
                  existingTarget={existingTarget}
                  onSave={() => refetch()}
                  onPublish={() => refetch()}
                />
              </TabsContent>

              <TabsContent value="allocations" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Allocation Summary</CardTitle>
                    <CardDescription>View all user allocations for FY {fyYear - 1}-{String(fyYear).slice(-2)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {existingTarget && allocations.length > 0 ? (
                      <AllocationSummaryTable
                        allocations={allocations}
                        quantityUnit={existingTarget.quantity_unit}
                        onAdjustUser={handleAdjustUser}
                        isReadOnly={existingTarget.status === 'locked'}
                      />
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        No allocations yet. Set targets first.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Change History</CardTitle>
                    <CardDescription>Track all changes made to hierarchy targets</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {history.length > 0 ? (
                      <div className="space-y-3">
                        {history.map((h) => (
                          <div key={h.id} className="flex items-start gap-3 p-3 border rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{h.change_type}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(h.created_at), 'MMM d, yyyy h:mm a')}
                                </span>
                              </div>
                              {h.reason && (
                                <p className="text-sm mt-1">{h.reason}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No history yet.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Root User</h3>
                <p className="text-muted-foreground">
                  Choose a user from the dropdown above to start setting hierarchy targets
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Midway Adjustment Dialog */}
      {existingTarget && (
        <MidwayAdjustmentDialog
          open={adjustmentDialogOpen}
          onOpenChange={setAdjustmentDialogOpen}
          hierarchyTargetId={existingTarget.id}
          fyYear={fyYear}
          adjustmentType={adjustmentType}
          affectedUser={selectedUserInfo}
          teamMembers={teamMembers}
          onComplete={() => {
            refetch();
            refetchAllocations();
          }}
        />
      )}
    </div>
  );
}