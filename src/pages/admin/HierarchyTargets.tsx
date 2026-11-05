import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Target, Users, History, Plus, UserPlus, UserMinus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useSubordinates } from '@/hooks/useSubordinates';
import { useHierarchyTargets, useHierarchyTargetAllocations, useHierarchyTargetHistory } from '@/hooks/useHierarchyTargets';
import { HierarchyTargetBuilder } from '@/components/admin/HierarchyTargetBuilder';
import { AllocationSummaryTable } from '@/components/admin/AllocationSummaryTable';
import { MidwayAdjustmentDialog, AdjustmentType } from '@/components/admin/MidwayAdjustmentDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-image';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

const getCurrentFY = () => {
  const now = new Date();
  const month = now.getMonth();
  return month >= 3 ? now.getFullYear() + 1 : now.getFullYear();
};

const HierarchyTargets = () => {
  const navigate = useNavigate();
  const { hasAdminAccess } = useAdminAccess();
  const { subordinates, isManager } = useSubordinates();
  const [fyYear, setFyYear] = useState(getCurrentFY());
  const [selectedRootUserId, setSelectedRootUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('set-targets');
  
  // Midway adjustment dialog state
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('leave');
  const [selectedUserForAdjustment, setSelectedUserForAdjustment] = useState<string | null>(null);

  const { hierarchyTargets, isLoading, refetch } = useHierarchyTargets(fyYear);

  // Fetch users at the top of the reporting hierarchy (root users / managers)
  const { data: managers = [] } = useQuery({
    queryKey: ['hierarchy-root-users'],
    queryFn: async () => {
      // Note: There is NO FK relationship between employees.user_id and profiles.id in PostgREST,
      // so we fetch employees first, then fetch profiles in a second query.
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('user_id, manager_id')
        .not('user_id', 'is', null);

      if (employeesError) throw employeesError;

      // Find users who have subordinates (are managers of others)
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

      const uniqueUsers = topLevelUsers
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
          // True top-level first
          if (!a.hasManager && b.hasManager) return -1;
          if (a.hasManager && !b.hasManager) return 1;
          return (a.full_name || '').localeCompare(b.full_name || '');
        });

      return uniqueUsers;
    },
  });

  const existingTarget = hierarchyTargets.find(
    (t) => t.root_user_id === selectedRootUserId && t.fy_year === fyYear
  );

  // Fetch allocations for the allocations tab
  const { allocations, refetch: refetchAllocations } = useHierarchyTargetAllocations(existingTarget?.id);
  
  // Fetch history
  const { history } = useHierarchyTargetHistory(existingTarget?.id);

  const handleAdjustUser = (userId: string, type: AdjustmentType) => {
    setSelectedUserForAdjustment(userId);
    setAdjustmentType(type);
    setAdjustmentDialogOpen(true);
  };

  // Convert allocations to team members format for adjustment dialog
  const teamMembers = allocations.map(a => ({
    userId: a.user_id,
    fullName: a.user?.full_name || 'Unknown',
    profilePictureUrl: a.user?.profile_picture_url,
    currentQuantityTarget: a.quantity_target,
    currentRevenueTarget: a.revenue_target,
  }));

  const selectedUserInfo = teamMembers.find(m => m.userId === selectedUserForAdjustment);

  const fyYears = Array.from({ length: 5 }, (_, i) => getCurrentFY() - 2 + i);

  if (!hasAdminAccess && !isManager) {
    return (
      <Layout>
        <div className="p-4 text-center">
          <p className="text-muted-foreground">You don't have access to this page.</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Go to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-subtle p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
              <ArrowLeft size={20} />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">Hierarchy-wise Targets</h1>
              <p className="text-muted-foreground">Set targets from top and cascade to all team members</p>
            </div>
          </div>

          {/* Controls */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">FY Year:</span>
                  <Select value={fyYear.toString()} onValueChange={(v) => setFyYear(parseInt(v))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fyYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          FY {year - 1}-{year.toString().slice(-2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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

          {/* Main Content */}
          {selectedRootUserId ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                    <CardDescription>View all user allocations for FY {fyYear - 1}-{fyYear.toString().slice(-2)}</CardDescription>
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
      </div>

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
    </Layout>
  );
};

export default HierarchyTargets;
