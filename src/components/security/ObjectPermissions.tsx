import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Shield, Save, ChevronDown, ChevronRight, Layers, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSION_MODULES, PERMISSION_FIELDS, PermissionField, getAllPermissionItems, getTotalFeatureCount, getAllModulePermissionItems } from './permissionModules';
import { clearAllCachedPermissions } from '@/utils/cachedAuthIntegrity';

interface ObjectPermission {
  id: string;
  profile_id: string;
  object_name: string;
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_view_all: boolean;
  can_modify_all: boolean;
}

export const ObjectPermissions = () => {
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<ObjectPermission>>>({});
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());

  // Fetch profiles
  const { data: profiles } = useQuery({
    queryKey: ['security-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_profiles')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch permissions for selected profile
  const { data: permissions, isLoading } = useQuery({
    queryKey: ['profile-object-permissions', selectedProfileId],
    queryFn: async () => {
      if (!selectedProfileId) return [];
      
      const { data, error } = await supabase
        .from('profile_object_permissions')
        .select('*')
        .eq('profile_id', selectedProfileId);
      
      if (error) throw error;
      return data as ObjectPermission[];
    },
    enabled: !!selectedProfileId
  });

  // Save mutations
  const saveMutation = useMutation({
    mutationFn: async (changes: Record<string, Partial<ObjectPermission>>) => {
      const updates = Object.entries(changes).map(([objectName, perms]) => ({
        profile_id: selectedProfileId,
        object_name: objectName,
        permission_type: 'feature',
        ...perms
      }));

      const { error } = await supabase
        .from('profile_object_permissions')
        .upsert(updates, { onConflict: 'profile_id,object_name,permission_type' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-object-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['profile-permissions'] });
      clearAllCachedPermissions();
      setPendingChanges({});
      toast.success('Permissions updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update permissions');
    }
  });

  const handlePermissionChange = (objectName: string, field: string, value: boolean) => {
    setPendingChanges(prev => ({
      ...prev,
      [objectName]: {
        ...prev[objectName],
        [field]: value
      }
    }));
  };

  // Grant All / Revoke All: writes real pending changes for every permission item
  const handleGrantAll = () => {
    const allItems = getAllModulePermissionItems();
    const newChanges: Record<string, Partial<ObjectPermission>> = { ...pendingChanges };
    allItems.forEach(itemName => {
      PERMISSION_FIELDS.forEach(field => {
        newChanges[itemName] = {
          ...newChanges[itemName],
          [field.key]: true,
        };
      });
    });
    setPendingChanges(newChanges);
    toast.info('All permissions granted — click Save to persist');
  };

  const handleRevokeAll = () => {
    const allItems = getAllModulePermissionItems();
    const newChanges: Record<string, Partial<ObjectPermission>> = { ...pendingChanges };
    allItems.forEach(itemName => {
      PERMISSION_FIELDS.forEach(field => {
        newChanges[itemName] = {
          ...newChanges[itemName],
          [field.key]: false,
        };
      });
    });
    setPendingChanges(newChanges);
    toast.info('All permissions revoked — click Save to persist');
  };

  const getPermissionValue = (objectName: string, field: string): boolean => {
    if (pendingChanges[objectName]?.[field] !== undefined) {
      return pendingChanges[objectName][field] as boolean;
    }
    const perm = permissions?.find(p => p.object_name === objectName);
    return perm?.[field as keyof ObjectPermission] as boolean || false;
  };

  const handleSave = () => {
    if (Object.keys(pendingChanges).length === 0) {
      toast.info('No changes to save');
      return;
    }
    saveMutation.mutate(pendingChanges);
  };

  const toggleModule = (moduleName: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleName)) {
        newSet.delete(moduleName);
      } else {
        newSet.add(moduleName);
      }
      return newSet;
    });
  };

  const toggleFeature = (featureName: string) => {
    setExpandedFeatures(prev => {
      const newSet = new Set(prev);
      if (newSet.has(featureName)) {
        newSet.delete(featureName);
      } else {
        newSet.add(featureName);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedModules(new Set(PERMISSION_MODULES.map(m => m.name)));
    // Also expand all features with sub-features
    const allFeatures: string[] = [];
    PERMISSION_MODULES.forEach(m => {
      m.features.forEach(f => {
        if (f.subFeatures && f.subFeatures.length > 0) {
          allFeatures.push(f.name);
        }
      });
    });
    setExpandedFeatures(new Set(allFeatures));
  };

  const collapseAll = () => {
    setExpandedModules(new Set());
    setExpandedFeatures(new Set());
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  // Check if all items in a module have a specific permission enabled
  const isColumnAllChecked = (moduleName: string, field: string): boolean => {
    const module = PERMISSION_MODULES.find(m => m.name === moduleName);
    if (!module) return false;
    const items = getAllPermissionItems(module);
    return items.every(item => getPermissionValue(item.name, field));
  };

  // Check if some (but not all) items have a permission enabled
  const isColumnIndeterminate = (moduleName: string, field: string): boolean => {
    const module = PERMISSION_MODULES.find(m => m.name === moduleName);
    if (!module) return false;
    const items = getAllPermissionItems(module);
    const checkedCount = items.filter(item => getPermissionValue(item.name, field)).length;
    return checkedCount > 0 && checkedCount < items.length;
  };

  // Toggle all items in a module for a specific permission
  const handleColumnToggle = (moduleName: string, field: string, checked: boolean) => {
    const module = PERMISSION_MODULES.find(m => m.name === moduleName);
    if (!module) return;

    const items = getAllPermissionItems(module);
    const newChanges: Record<string, Partial<ObjectPermission>> = { ...pendingChanges };
    items.forEach(item => {
      newChanges[item.name] = {
        ...newChanges[item.name],
        [field]: checked
      };
    });
    setPendingChanges(newChanges);
  };

  // Feature-level column helpers for sub-features
  const isFeatureColumnAllChecked = (featureName: string, subFeatures: { name: string; label: string }[], field: string): boolean => {
    return subFeatures.every(sf => getPermissionValue(sf.name, field));
  };

  const isFeatureColumnIndeterminate = (featureName: string, subFeatures: { name: string; label: string }[], field: string): boolean => {
    const checkedCount = subFeatures.filter(sf => getPermissionValue(sf.name, field)).length;
    return checkedCount > 0 && checkedCount < subFeatures.length;
  };

  const handleFeatureColumnToggle = (subFeatures: { name: string; label: string }[], field: string, checked: boolean) => {
    const newChanges: Record<string, Partial<ObjectPermission>> = { ...pendingChanges };
    subFeatures.forEach(sf => {
      newChanges[sf.name] = {
        ...newChanges[sf.name],
        [field]: checked
      };
    });
    setPendingChanges(newChanges);
  };

  // Count enabled permissions per module
  const getModuleEnabledCount = (moduleName: string) => {
    const module = PERMISSION_MODULES.find(m => m.name === moduleName);
    if (!module) return 0;
    
    const items = getAllPermissionItems(module);
    let count = 0;
    items.forEach(item => {
      PERMISSION_FIELDS.forEach(field => {
        if (getPermissionValue(item.name, field.key)) count++;
      });
    });
    return count;
  };

  const renderPermissionCheckboxes = (objectName: string) => (
    <>
      {PERMISSION_FIELDS.map((field) => (
        <TableCell key={field.key} className="text-center">
          <Checkbox
            checked={getPermissionValue(objectName, field.key)}
            onCheckedChange={(checked) => 
              handlePermissionChange(objectName, field.key, checked as boolean)
            }
          />
        </TableCell>
      ))}
    </>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Object Permissions</CardTitle>
            <CardDescription>Configure what features each profile can access</CardDescription>
          </div>
          {hasPendingChanges && (
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Selector */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Label>Select Profile</Label>
            <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Choose a profile to configure" />
              </SelectTrigger>
              <SelectContent>
                {profiles?.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {profile.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProfileId && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleGrantAll}>
                Grant All
              </Button>
              <Button variant="outline" size="sm" onClick={handleRevokeAll}>
                Revoke All
              </Button>
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
            </div>
          )}
        </div>

        {/* Module-based Permissions */}
        {selectedProfileId && (
          <div className="space-y-3">
            {PERMISSION_MODULES.map((module) => {
              const isExpanded = expandedModules.has(module.name);
              const enabledCount = getModuleEnabledCount(module.name);
              const totalCount = getTotalFeatureCount(module);
              const hasSubFeatures = module.features.some(f => f.subFeatures && f.subFeatures.length > 0);
              
              return (
                <Collapsible
                  key={module.name}
                  open={isExpanded}
                  onOpenChange={() => toggleModule(module.name)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 bg-muted/50 hover:bg-muted/70 transition-colors">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <Layers className="h-4 w-4 text-primary" />
                          <span className="font-medium">{module.label}</span>
                          <span className="text-xs text-muted-foreground">
                            ({totalCount} {hasSubFeatures ? 'sub-features' : 'features'})
                          </span>
                        </div>
                        {enabledCount > 0 && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                            {enabledCount} permissions enabled
                          </span>
                        )}
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      {hasSubFeatures ? (
                        // Render 3-level hierarchy for modules with sub-features
                        <div className="divide-y">
                          {module.features.map((feature) => {
                            const isFeatureExpanded = expandedFeatures.has(feature.name);
                            const subFeatures = feature.subFeatures || [];
                            
                            if (subFeatures.length === 0) {
                              // Simple feature without sub-features
                              return (
                                <Table key={feature.name}>
                                  <TableBody>
                                    <TableRow>
                                      <TableCell className="w-[250px] font-medium text-sm pl-8">
                                        {feature.label}
                                      </TableCell>
                                      {renderPermissionCheckboxes(feature.name)}
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              );
                            }
                            
                            return (
                              <Collapsible
                                key={feature.name}
                                open={isFeatureExpanded}
                                onOpenChange={() => toggleFeature(feature.name)}
                              >
                                <CollapsibleTrigger className="w-full">
                                  <div className="flex items-center gap-3 p-3 pl-6 bg-muted/30 hover:bg-muted/50 transition-colors border-b">
                                    {isFeatureExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm font-medium">{feature.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                      ({subFeatures.length} sub-features)
                                    </span>
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-background">
                                        <TableHead className="w-[250px] pl-12">Sub-feature</TableHead>
                                        {PERMISSION_FIELDS.map((field) => (
                                          <TableHead key={field.key} className="text-center w-[100px]">
                                            <div className="flex flex-col items-center gap-1">
                                              <span className="text-xs">{field.label}</span>
                                              <Checkbox
                                                checked={isFeatureColumnAllChecked(feature.name, subFeatures, field.key)}
                                                ref={(el) => {
                                                  if (el) {
                                                    (el as any).indeterminate = isFeatureColumnIndeterminate(feature.name, subFeatures, field.key);
                                                  }
                                                }}
                                                onCheckedChange={(checked) => 
                                                  handleFeatureColumnToggle(subFeatures, field.key, checked as boolean)
                                                }
                                              />
                                            </div>
                                          </TableHead>
                                        ))}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {subFeatures.map((subFeature) => (
                                        <TableRow key={subFeature.name}>
                                          <TableCell className="font-medium text-sm pl-12">
                                            {subFeature.label}
                                          </TableCell>
                                          {renderPermissionCheckboxes(subFeature.name)}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}
                        </div>
                      ) : (
                        // Render 2-level hierarchy for modules without sub-features
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-background">
                              <TableHead className="w-[250px]">Feature</TableHead>
                              {PERMISSION_FIELDS.map((field) => (
                                <TableHead key={field.key} className="text-center w-[100px]">
                                  <div className="flex flex-col items-center gap-1">
                                    <span>{field.label}</span>
                                    <Checkbox
                                      checked={isColumnAllChecked(module.name, field.key)}
                                      ref={(el) => {
                                        if (el) {
                                          (el as any).indeterminate = isColumnIndeterminate(module.name, field.key);
                                        }
                                      }}
                                      onCheckedChange={(checked) => 
                                        handleColumnToggle(module.name, field.key, checked as boolean)
                                      }
                                    />
                                  </div>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {module.features.map((feature) => (
                              <TableRow key={feature.name}>
                                <TableCell className="font-medium text-sm">
                                  {feature.label}
                                </TableCell>
                                {renderPermissionCheckboxes(feature.name)}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}

        {!selectedProfileId && (
          <div className="text-center py-8 text-muted-foreground">
            Select a profile to configure object permissions
          </div>
        )}
      </CardContent>
    </Card>
  );
};
