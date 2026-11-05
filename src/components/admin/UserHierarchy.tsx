import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-image';
import { Users, User, ChevronDown, ChevronRight, Network, List } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface HierarchyUser {
  id: string;
  full_name: string;
  username: string;
  profile_picture_url?: string;
  role_name?: string;
  is_system_profile?: boolean;
  manager_id?: string;
  /** False for anyone deactivated or marked inactive; hidden unless shown. */
  is_active_user?: boolean;
  directReports: HierarchyUser[];
}

interface UserHierarchyProps {
  className?: string;
}

// Default role colors — system profiles get a distinct style, others use a generic palette
const systemProfileColors = { bg: 'bg-rose-500/10', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-500/30', badge: 'bg-rose-500' };
const defaultProfileColors = { bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-400', border: 'border-slate-500/30', badge: 'bg-slate-500' };

const getRoleColors = (user: HierarchyUser) => {
  if (user.is_system_profile) return systemProfileColors;
  return defaultProfileColors;
};

// Level-based accent for depth indication
const levelAccents = [
  'border-l-rose-500',
  'border-l-purple-500',
  'border-l-blue-500',
  'border-l-emerald-500',
  'border-l-amber-500',
  'border-l-cyan-500',
];

const getLevelAccent = (level: number) => levelAccents[Math.min(level, levelAccents.length - 1)];

const HierarchyRow = ({ user, level = 0 }: { user: HierarchyUser; level?: number }) => {
  const [isOpen, setIsOpen] = useState(level < 1);
  const hasReports = user.directReports.length > 0;
  const colors = getRoleColors(user);
  const accentClass = getLevelAccent(level);

  return (
    <div className={cn("space-y-1", level > 0 && "ml-3 md:ml-5")}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div
          className={cn(
            "flex items-center gap-2.5 p-2 rounded-lg border-l-[3px] transition-colors",
            accentClass,
            hasReports ? "cursor-pointer hover:bg-muted/60" : "bg-transparent"
          )}
        >
          {hasReports ? (
            <CollapsibleTrigger asChild>
              <button className="shrink-0 p-0.5 rounded hover:bg-muted">
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
          ) : (
            <div className="w-[18px]" />
          )}

          {/* Avatar */}
          <Avatar className="h-7 w-7 shrink-0">
            <SignedAvatarImage src={user.profile_picture_url} />
            <AvatarFallback className={cn("text-[10px] font-semibold text-white", colors.badge)}>
              {user.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>

          {/* Name + Role */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <p className="text-xs font-medium truncate leading-tight">
                {user.full_name || user.username}
              </p>
              {user.is_active_user === false && (<span className="shrink-0 text-[9px] px-1 py-px rounded bg-muted text-muted-foreground font-normal">deactivated</span>)}
            </div>
          </div>

          {/* Role Badge */}
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 h-5 shrink-0 font-medium border",
              colors.bg, colors.text, colors.border
            )}
          >
            {user.role_name || 'No Role'}
          </Badge>

          {/* Report count */}
          {hasReports && (
            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
              {user.directReports.length}
            </span>
          )}
        </div>

        {hasReports && (
          <CollapsibleContent className="pt-1">
            {user.directReports.map((report) => (
              <HierarchyRow key={report.id} user={report} level={level + 1} />
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
};

// ========== Org Chart Tree View ==========
const OrgChartNode = ({ user }: { user: HierarchyUser }) => {
  const colors = getRoleColors(user);
  const hasReports = user.directReports.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Node */}
      <div className="flex flex-col items-center w-24">
        <div className={cn("rounded-full p-[2px] ring-2", colors.border.replace('border-', 'ring-'))}>
          <Avatar className="h-12 w-12">
            <SignedAvatarImage src={user.profile_picture_url} />
            <AvatarFallback className={cn("text-sm font-semibold text-white", colors.badge)}>
              {user.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
        <p
          className={cn("text-[11px] font-medium text-center mt-1 leading-tight truncate w-full",
            user.is_active_user === false && "text-muted-foreground italic")}
          title={user.is_active_user === false ? "Deactivated" : undefined}
        >
          {user.full_name || user.username}
        </p>
        <p className={cn("text-[9px] text-center truncate w-full", colors.text)}>
          {user.role_name || 'No Role'}
        </p>
      </div>

      {/* Connector line down + children */}
      {hasReports && (
        <>
          <div className="w-px h-4 bg-border" />
          <div className="relative flex items-start">
            {user.directReports.length > 1 && (
              <div
                className="absolute top-0 h-px bg-border"
                style={{
                  left: `calc(50% - ${(user.directReports.length - 1) * 52}px)`,
                  width: `${(user.directReports.length - 1) * 104}px`,
                }}
              />
            )}
            <div className="flex gap-2">
              {user.directReports.map(child => (
                <div key={child.id} className="flex flex-col items-center">
                  <div className="w-px h-4 bg-border" />
                  <OrgChartNode user={child} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Flat list row for list view
const FlatUserRow = ({ user }: { user: HierarchyUser }) => {
  const colors = getRoleColors(user);
  return (
    <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/60 transition-colors">
      <Avatar className="h-7 w-7 shrink-0">
        <SignedAvatarImage src={user.profile_picture_url} />
        <AvatarFallback className={cn("text-[10px] font-semibold text-white", colors.badge)}>
          {user.full_name?.charAt(0) || 'U'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p
          className={cn("text-xs font-medium truncate leading-tight",
            user.is_active_user === false && "text-muted-foreground italic")}
          title={user.is_active_user === false ? "Deactivated" : undefined}
        >
          {user.full_name || user.username}
        </p>
      </div>
      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 shrink-0 font-medium border", colors.bg, colors.text, colors.border)}>
        {user.role_name || 'No Role'}
      </Badge>
    </div>
  );
};

// Flatten hierarchy into a sorted list
const flattenHierarchy = (users: HierarchyUser[]): HierarchyUser[] => {
  const result: HierarchyUser[] = [];
  const walk = (list: HierarchyUser[]) => {
    list.forEach(u => { result.push(u); walk(u.directReports); });
  };
  walk(users);
  return result.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
};

const UserHierarchy: React.FC<UserHierarchyProps> = ({ className }) => {
  const [hierarchy, setHierarchy] = useState<HierarchyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  // This screen is where a deactivated person gets found and brought back, so
  // it is the one list that may show them -- behind a toggle, off by default.
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    fetchHierarchy();

    const channel = supabase
      .channel('hierarchy-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => fetchHierarchy())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => fetchHierarchy())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const firstToggleRun = useRef(true);
  useEffect(() => {
    if (firstToggleRun.current) { firstToggleRun.current = false; return; }
    fetchHierarchy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  const fetchHierarchy = async () => {
    try {
      setLoading(true);

      const [
        { data: profiles, error: pe },
        { data: employees, error: ee },
        { data: userProfiles, error: ue },
        { data: securityProfiles, error: se },
      ] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username, profile_picture_url, is_active, user_status'),
        supabase.from('employees').select('user_id, manager_id, secondary_manager_id'),
        supabase.from('user_profiles').select('user_id, profile_id'),
        supabase.from('security_profiles').select('id, name, is_system'),
      ]);

      if (pe || ee || ue || se) throw (pe || ee || ue || se);

      const userMap = new Map<string, HierarchyUser>();
      const childToParent = new Map<string, string>();

      const isActive = (p: any) => p?.is_active === true && p?.user_status === 'active';

      userProfiles?.forEach(up => {
        const profile = profiles?.find(p => p.id === up.user_id);
        if (!profile) return;
        if (!showInactive && !isActive(profile)) return;
        const emp = employees?.find(e => e.user_id === up.user_id);
        const secProfile = securityProfiles?.find(sp => sp.id === up.profile_id);

        userMap.set(up.user_id, {
          id: up.user_id,
          full_name: profile.full_name || '',
          username: profile.username || '',
          profile_picture_url: profile.profile_picture_url,
          role_name: secProfile?.name,
          is_system_profile: secProfile?.is_system || false,
          manager_id: emp?.manager_id,
          is_active_user: isActive(profile),
          directReports: [],
        });

        if (emp?.manager_id) childToParent.set(up.user_id, emp.manager_id);
      });

      employees?.forEach(emp => {
        if (emp.manager_id && !userMap.has(emp.manager_id)) {
          const profile = profiles?.find(p => p.id === emp.manager_id);
          if (profile && (showInactive || isActive(profile))) {
            const mp = userProfiles?.find(up => up.user_id === emp.manager_id);
            const sp = mp ? securityProfiles?.find(s => s.id === mp.profile_id) : null;
            userMap.set(emp.manager_id, {
              id: emp.manager_id,
              full_name: profile.full_name || '',
              username: profile.username || '',
              profile_picture_url: profile.profile_picture_url,
              role_name: sp?.name || 'Manager',
              is_system_profile: sp?.is_system || false,
              manager_id: undefined,
              is_active_user: isActive(profile),
              directReports: [],
            });
          }
        }
      });

      childToParent.forEach((managerId, userId) => {
        const manager = userMap.get(managerId);
        const user = userMap.get(userId);
        if (manager && user) manager.directReports.push(user);
      });

      const rootNodes: HierarchyUser[] = [];
      const superAdmins: HierarchyUser[] = [];

      userMap.forEach((user, userId) => {
        const managerId = childToParent.get(userId);
        if (!managerId || !userMap.has(managerId)) {
          if (user.is_system_profile) {
            superAdmins.push(user);
          } else {
            rootNodes.push(user);
          }
        }
      });

      userMap.forEach(user => user.directReports.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')));
      rootNodes.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
      superAdmins.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

      setHierarchy([...superAdmins, ...rootNodes]);
    } catch (error) {
      console.error('Error fetching hierarchy:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> User Hierarchy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-16 ml-auto rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Collect unique roles for legend
  const collectRoles = (users: HierarchyUser[]): Map<string, boolean> => {
    const roles = new Map<string, boolean>();
    users.forEach(u => {
      if (u.role_name) roles.set(u.role_name, u.is_system_profile || false);
      if (u.directReports.length) {
        collectRoles(u.directReports).forEach((isSys, name) => roles.set(name, isSys));
      }
    });
    return roles;
  };
  const uniqueRoles = collectRoles(hierarchy);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> User Hierarchy
          </CardTitle>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-primary"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show deactivated
            </label>
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'tree' | 'list')} size="sm">
            <ToggleGroupItem value="tree" aria-label="Tree view" className="h-7 w-7 p-0">
              <Network className="h-3.5 w-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="h-7 w-7 p-0">
              <List className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
          </div>
        </div>
        {/* Role color legend */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Array.from(uniqueRoles.entries()).map(([role, isSystem]) => {
            const c = isSystem ? systemProfileColors : defaultProfileColors;
            return (
              <span
                key={role}
                className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium", c.bg, c.text, c.border)}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", c.badge)} />
                {role}
              </span>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        {hierarchy.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hierarchy configured</p>
          </div>
        ) : viewMode === 'tree' ? (
          <ScrollArea className="w-full">
            <div className="flex justify-center py-4 min-w-max">
              <div className="flex gap-6">
                {hierarchy.map(user => (
                  <OrgChartNode key={user.id} user={user} />
                ))}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <div className="space-y-1">
            {hierarchy.map(user => (
              <HierarchyRow key={user.id} user={user} level={0} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserHierarchy;
