import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiUserSelector } from './MultiUserSelector';
import { useAuth } from '@/hooks/useAuth';
import { useSubordinates } from '@/hooks/useSubordinates';
import { UserFYPlanTarget } from '@/components/profile/UserFYPlanTarget';
import { Users, Target, User, AlertCircle } from 'lucide-react';
import { UserScope } from './TopControlBar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AdminSetTargetProps {
  userScope: UserScope;
  selectedUserId: string;
  selectedUserIds: string[];
  onSelectedUserIdsChange: (ids: string[]) => void;
  fyYear: number;
}

export function AdminSetTarget({
  userScope,
  selectedUserId,
  selectedUserIds,
  onSelectedUserIdsChange,
  fyYear,
}: AdminSetTargetProps) {
  const { user } = useAuth();
  const { subordinates, isManager } = useSubordinates();
  const [activeUserTab, setActiveUserTab] = useState<string>('');

  // Get effective user ID for single-user mode
  const getEffectiveUserId = (): string | undefined => {
    if (userScope === 'self') {
      return user?.id;
    }
    if (userScope === 'single') {
      if (selectedUserId === 'self' || !selectedUserId) {
        return undefined; // Show "select user" message
      }
      return selectedUserId;
    }
    return undefined;
  };

  const effectiveUserId = getEffectiveUserId();
  const selectedUser = subordinates.find(s => s.subordinate_user_id === effectiveUserId);

  // For multiple users mode
  const selectedUsers = subordinates.filter(s => selectedUserIds.includes(s.subordinate_user_id));

  // Render based on user scope
  const renderContent = () => {
    switch (userScope) {
      case 'self':
        return (
          <div className="space-y-6">
            <UserFYPlanTarget />
          </div>
        );

      case 'single':
        if (!effectiveUserId) {
          return (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Select a Team Member</p>
                  <p className="text-sm mt-1">Choose a team member from the top control bar to set their targets</p>
                </div>
              </CardContent>
            </Card>
          );
        }
        return (
          <div className="space-y-6">
            {selectedUser && (
              <Alert>
                <Target className="h-4 w-4" />
                <AlertDescription>
                  Setting targets for: <span className="font-medium">{selectedUser.full_name}</span>
                </AlertDescription>
              </Alert>
            )}
            <UserFYPlanTarget targetUserId={effectiveUserId} />
          </div>
        );

      case 'multiple':
        return (
          <div className="space-y-6">
            <MultiUserSelector
              selectedUserIds={selectedUserIds}
              onSelectionChange={onSelectedUserIdsChange}
            />

            {selectedUserIds.length > 0 && (
              <>
                {/* User Tabs for editing */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Target className="h-5 w-5" />
                      Edit Individual Targets
                      <Badge variant="secondary">{selectedUsers.length} users</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs 
                      value={activeUserTab || selectedUserIds[0]} 
                      onValueChange={setActiveUserTab}
                    >
                      <ScrollArea className="w-full">
                        <TabsList className="inline-flex w-auto mb-4">
                          {selectedUsers.map((user) => (
                            <TabsTrigger 
                              key={user.subordinate_user_id} 
                              value={user.subordinate_user_id}
                              className="text-sm"
                            >
                              {user.full_name.split(' ')[0]}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </ScrollArea>

                      {selectedUsers.map((user) => (
                        <TabsContent 
                          key={user.subordinate_user_id} 
                          value={user.subordinate_user_id}
                        >
                          <UserFYPlanTarget targetUserId={user.subordinate_user_id} />
                        </TabsContent>
                      ))}
                    </Tabs>
                  </CardContent>
                </Card>
              </>
            )}

            {selectedUserIds.length === 0 && (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Select Team Members</p>
                    <p className="text-sm mt-1">Choose one or more team members above to set their targets</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'team':
        return (
          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Team-wide target setting: Changes will apply to all {subordinates.length} team members. 
                For individual adjustments, switch to "Multiple Users" mode.
              </AlertDescription>
            </Alert>


            {/* Show tabs for all team members */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Team Targets
                  <Badge variant="secondary">{subordinates.length} members</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {subordinates.length > 0 ? (
                  <Tabs 
                    value={activeUserTab || subordinates[0]?.subordinate_user_id} 
                    onValueChange={setActiveUserTab}
                  >
                    <ScrollArea className="w-full">
                      <TabsList className="inline-flex w-auto mb-4">
                        {subordinates.map((sub) => (
                          <TabsTrigger 
                            key={sub.subordinate_user_id} 
                            value={sub.subordinate_user_id}
                            className="text-sm"
                          >
                            {sub.full_name.split(' ')[0]}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </ScrollArea>

                    {subordinates.map((sub) => (
                      <TabsContent 
                        key={sub.subordinate_user_id} 
                        value={sub.subordinate_user_id}
                      >
                        <UserFYPlanTarget targetUserId={sub.subordinate_user_id} />
                      </TabsContent>
                    ))}
                  </Tabs>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No team members found
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return <div className="space-y-6">{renderContent()}</div>;
}
