import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HierarchyNode {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  directReports: string[];
}

export interface HierarchyGroup {
  managerId: string | null;
  managerName: string;
  managerAvatar: string | null;
  memberIds: string[];
  children: HierarchyGroup[];
}

/**
 * Fetches the org hierarchy structure for a given set of user IDs
 * using the employees table (user_id -> manager_id).
 * Builds a recursive tree so that managers who have sub-managers
 * appear as nested groups.
 */
export const useHierarchyTeamStructure = (userIds: string[]) => {
  return useQuery({
    queryKey: ['hierarchy-team-structure', userIds.length, userIds.slice(0, 5).join(',')],
    queryFn: async (): Promise<HierarchyGroup[]> => {
      if (!userIds.length) return [];

      // Fetch profiles for all users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, profile_picture_url')
        .in('id', userIds);

      // Fetch manager relationships from employees table for ALL users
      // We need relationships for users in the set AND their managers (even outside the set)
      const { data: employees } = await supabase
        .from('employees')
        .select('user_id, manager_id')
        .in('user_id', userIds);

      // Also fetch profiles for managers outside the user set
      const managerIdsOutside = (employees || [])
        .filter(e => e.manager_id && !userIds.includes(e.manager_id))
        .map(e => e.manager_id!);
      
      let allProfiles = profiles || [];
      if (managerIdsOutside.length > 0) {
        const { data: managerProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, profile_picture_url')
          .in('id', managerIdsOutside);
        allProfiles = [...allProfiles, ...(managerProfiles || [])];
      }

      const profileMap = new Map(allProfiles.map(p => [p.id, p]));
      const userIdSet = new Set(userIds);

      // Build parent->children map for ALL relationships
      const childrenMap = new Map<string, string[]>();
      const parentMap = new Map<string, string>();

      employees?.forEach(emp => {
        if (emp.manager_id) {
          parentMap.set(emp.user_id, emp.manager_id);
          if (!childrenMap.has(emp.manager_id)) {
            childrenMap.set(emp.manager_id, []);
          }
          childrenMap.get(emp.manager_id)!.push(emp.user_id);
        }
      });

      // Recursive function to build hierarchy group for a node
      const buildGroup = (managerId: string): HierarchyGroup => {
        const profile = profileMap.get(managerId);
        const directReports = (childrenMap.get(managerId) || []).filter(id => userIdSet.has(id));
        
        // Separate direct reports into sub-managers and leaf members
        const subManagers: string[] = [];
        const leafMembers: string[] = [];
        
        directReports.forEach(id => {
          const hasSubordinatesInSet = (childrenMap.get(id) || []).some(cid => userIdSet.has(cid));
          if (hasSubordinatesInSet) {
            subManagers.push(id);
          } else {
            leafMembers.push(id);
          }
        });

        // Recursively build children groups for sub-managers
        const children = subManagers.map(smId => buildGroup(smId));

        return {
          managerId,
          managerName: profile?.full_name || 'Unknown Manager',
          managerAvatar: profile?.profile_picture_url || null,
          memberIds: leafMembers,
          children,
        };
      };

      // Find root nodes: users whose manager is NOT in the userIdSet, but who have children in the set
      // OR managers outside the set who have children in the set
      const rootManagerIds = new Set<string>();
      
      userIds.forEach(uid => {
        // Walk up the parent chain to find the topmost ancestor
        let current = uid;
        let parent = parentMap.get(current);
        
        while (parent && (userIdSet.has(parent) || childrenMap.has(parent))) {
          if (!parentMap.has(parent) || !userIdSet.has(parentMap.get(parent)!)) {
            // parent is the root
            break;
          }
          current = parent;
          parent = parentMap.get(current);
        }
        
        // The root is either `parent` (if it has children in set) or `current` itself
        if (parent && (childrenMap.get(parent) || []).some(c => userIdSet.has(c))) {
          rootManagerIds.add(parent);
        } else {
          // Check if current itself is a manager with children in set
          if ((childrenMap.get(current) || []).some(c => userIdSet.has(c))) {
            rootManagerIds.add(current);
          }
        }
      });

      // If no roots found, fall back to finding managers who have direct reports in set
      if (rootManagerIds.size === 0) {
        childrenMap.forEach((children, managerId) => {
          if (children.some(c => userIdSet.has(c))) {
            rootManagerIds.add(managerId);
          }
        });
      }

      // Remove roots that are children of other roots
      const filteredRoots = new Set(rootManagerIds);
      rootManagerIds.forEach(rootId => {
        // Check if this root's parent is also a root
        let parent = parentMap.get(rootId);
        while (parent) {
          if (rootManagerIds.has(parent)) {
            filteredRoots.delete(rootId);
            break;
          }
          parent = parentMap.get(parent);
        }
      });

      const groups = Array.from(filteredRoots).map(rootId => buildGroup(rootId));

      // Collect all grouped user IDs
      const allGroupedIds = new Set<string>();
      const collectIds = (group: HierarchyGroup) => {
        if (group.managerId) allGroupedIds.add(group.managerId);
        group.memberIds.forEach(id => allGroupedIds.add(id));
        group.children.forEach(child => collectIds(child));
      };
      groups.forEach(g => collectIds(g));

      // Add ungrouped users
      const ungrouped = userIds.filter(id => !allGroupedIds.has(id));
      if (ungrouped.length > 0) {
        groups.push({
          managerId: null,
          managerName: 'Other Members',
          managerAvatar: null,
          memberIds: ungrouped,
          children: [],
        });
      }

      return groups;
    },
    enabled: userIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
};
