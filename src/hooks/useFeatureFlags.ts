import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfilePermissions } from '@/hooks/useProfilePermissions';

/**
 * Maps navigation item IDs to their corresponding feature_key in the feature_flags table.
 */
export const NAV_ITEM_FEATURE_MAP: Record<string, string> = {
  'attendance': 'attendance',
  'my-visit': 'my_visit',
  'all-retailers': 'all_retailers',
  'my-target': 'my_target',
  'performance': 'target_vs_actual',
  'analytics': 'analytics',
  
  'distributor-master': 'distributor_master',
  'primary-orders': 'primary_orders',
  'territories': 'territories',
  'gps-track': 'gps_track',
  'my-beats': 'my_beats',
  'competition-master': 'competition_master',
  'schemes': 'schemes',
  'expenses': 'expenses',
  'leaderboard': 'gamification',
  'packing-list': 'packing_list_module',
  'my-deliveries': 'delivery_agent_app',
  'my-competency': 'competency',
  'recycle-bin': 'recycle_bin',
  'communication-center': 'communication_center_module',
};

/**
 * Maps navigation item IDs to their permission object name prefixes.
 * If a user's profile has can_read on ANY object matching this prefix, the module is visible.
 */
export const NAV_ITEM_PERMISSION_PREFIX: Record<string, string> = {
  'attendance': 'attendance_',
  'my-visit': 'visit_',
  'all-retailers': 'retailer_',
  'my-target': 'target_',
  'performance': 'performance_',
  'analytics': 'analytics_',
  
  'distributor-master': 'distributor_',
  'primary-orders': 'primary_order_',
  'territories': 'territory_',
  'gps-track': 'gps_',
  'my-beats': 'beat_',
  'competition-master': 'competition_',
  'schemes': 'scheme_',
  'expenses': 'expense_',
  'leaderboard': 'gamification_',
  'packing-list': 'packing_list_',
  'my-deliveries': 'delivery_',
  'my-competency': 'competency_',
  'recycle-bin': 'recycle_',
  'tax-master': 'tax_master_',
  'user-management': 'user_mgmt_',
  'communication-center': 'comm_',
};

/**
 * Maps navigation item IDs to their hierarchical module base name.
 * Used to check permissions like module_<name>, field_<name>_*, action_<name>_*, widget_<name>_*
 */
export const NAV_ITEM_MODULE_NAME: Record<string, string> = {
  'attendance': 'attendance',
  'my-visit': 'visit',
  'all-retailers': 'retailer',
  'my-target': 'target',
  'performance': 'performance',
  'analytics': 'analytics',
  
  'distributor-master': 'distributor',
  'primary-orders': 'primary_order',
  'territories': 'territory',
  'gps-track': 'gps_track',
  'my-beats': 'beat',
  'competition-master': 'competition',
  'schemes': 'scheme',
  'expenses': 'expense',
  'leaderboard': 'gamification',
  'packing-list': 'packing_list',
  'my-deliveries': 'delivery',
  'my-competency': 'competency',
  'recycle-bin': 'recycle',
  'communication-center': 'communication_center',
};

/**
 * Maps navigation item IDs to the `module_*` row shown in Security & Access →
 * Module Permission. When a profile has that row, it alone decides whether the
 * menu is visible. Items without a module row keep the legacy checks.
 */
export const NAV_ITEM_MODULE_ROW: Record<string, string> = {
  'attendance': 'module_attendance',
  'my-visit': 'module_my_visit',
  'all-retailers': 'module_all_retailers',
  'my-target': 'module_my_target',
  'performance': 'module_performance',
  'analytics': 'module_analytics',
  'distributor-master': 'module_distributor_master',
  'primary-orders': 'module_primary_orders',
  'territories': 'module_territories',
  'gps-track': 'module_gps_track',
  'my-beats': 'module_my_beats',
  'competition-master': 'module_competition_master',
  'schemes': 'module_check_schemes',
  'expenses': 'module_my_expenses',
  'leaderboard': 'module_gamification',
  'packing-list': 'module_packing_list',
  'my-deliveries': 'module_my_deliveries',
  'my-competency': 'module_competency',
  'recycle-bin': 'module_recycle_bin',
  'communication-center': 'module_communication_center',
};

const FEATURE_FLAGS_CACHE_KEY = 'feature_flags_cache';

interface FeatureFlag {
  feature_key: string;
  is_enabled: boolean;
}

const loadCachedFeatureFlags = (): FeatureFlag[] | undefined => {
  try {
    const raw = localStorage.getItem(FEATURE_FLAGS_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const useFeatureFlags = () => {
  const { securityProfileName } = useAuth();
  const { permissions, isLoading: permissionsLoading } = useProfilePermissions();

  const { data: featureFlags = [], isLoading: flagsLoading } = useQuery({
    queryKey: ['all-feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('feature_key, is_enabled');
      
      if (error) {
        console.error('Error loading feature flags:', error);
        return [];
      }

      const result = (data || []) as FeatureFlag[];

      // ✅ Persist feature flags to localStorage for offline use
      try {
        localStorage.setItem(FEATURE_FLAGS_CACHE_KEY, JSON.stringify(result));
      } catch {
        // fail silently
      }

      return result;
    },
    // ✅ Load from localStorage instantly so nav flags are available offline
    placeholderData: () => loadCachedFeatureFlags(),
    staleTime: 30 * 60 * 1000,   // 30 min — background refresh only
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const isLoading = flagsLoading || permissionsLoading;
  const flagMap = new Map(featureFlags.map(f => [f.feature_key, f.is_enabled]));

  // Build a set of permission prefixes the user has can_read on
  const userPermissionPrefixes = useMemo(() => {
    const prefixes = new Set<string>();
    permissions.forEach(p => {
      if (p.can_read) {
        prefixes.add(p.object_name);
      }
    });
    return prefixes;
  }, [permissions]);

  /**
   * Check if a feature is globally enabled.
   */
  const isFeatureEnabled = useCallback((featureKey: string): boolean => {
    if (!flagMap.has(featureKey)) return true;
    return flagMap.get(featureKey) === true;
  }, [flagMap]);

  /**
   * Check if user has can_read permission on any object matching the given prefix (legacy).
   */
  const hasPermissionForPrefix = useCallback((prefix: string): boolean => {
    for (const objName of userPermissionPrefixes) {
      if (objName.startsWith(prefix)) return true;
    }
    return false;
  }, [userPermissionPrefixes]);

  /**
   * Check if user has can_read permission via the new hierarchical naming convention.
   * Matches: module_<name>, field_<name>_*, action_<name>_*, widget_<name>_*
   */
  const hasHierarchicalPermission = useCallback((moduleName: string): boolean => {
    for (const objName of userPermissionPrefixes) {
      if (
        objName === `module_${moduleName}` ||
        objName.startsWith(`field_${moduleName}_`) ||
        objName.startsWith(`action_${moduleName}_`) ||
        objName.startsWith(`widget_${moduleName}_`)
      ) {
        return true;
      }
    }
    return false;
  }, [userPermissionPrefixes]);

  /**
   * Check if a nav item should be visible based on:
   * 1. Global feature flag (must be enabled)
   * 2. User's profile permissions (must have can_read on at least one matching object)
   *
   * Loading guard:
   * - While loading with no cache → show all (never blank nav)
   * - While loading with cache (placeholderData) → filter correctly from cache
   * - After load with zero permissions → deny (profile assigned but nothing granted)
   */
  const isNavItemEnabled = useCallback((navItemId: string): boolean => {
    // Step 1: Check global feature flag
    const featureKey = NAV_ITEM_FEATURE_MAP[navItemId];
    if (featureKey && !isFeatureEnabled(featureKey)) return false;

    // Step 2: No profile assigned = show all (backward compat)
    if (!securityProfileName) return true;

    // Step 3: ✅ FIXED — distinguish "loading" from "loaded and empty"
    // If still loading AND no cached permissions yet → show items (never blank nav)
    if (isLoading && permissions.length === 0) return true;

    // Step 4: Loaded but confirmed zero permissions → deny all
    if (!isLoading && permissions.length === 0) return false;

    // Step 5-: If the profile has this menu's Module Permission row, it decides.
    // Legacy feature rows (e.g. attendance_check_in_out) must not keep a menu
    // open once the module is unticked in Security & Access.
    const moduleRowName = NAV_ITEM_MODULE_ROW[navItemId];
    if (moduleRowName) {
      const moduleRow = permissions.find(p => p.object_name === moduleRowName);
      if (moduleRow) return !!moduleRow.can_read;
    }

    // Step 5a: Check legacy permission prefix (e.g., attendance_list, visit_retailer)
    const prefix = NAV_ITEM_PERMISSION_PREFIX[navItemId];
    if (prefix && hasPermissionForPrefix(prefix)) return true;

    // Step 5b: Check new hierarchical permission names (e.g., module_attendance, field_attendance_*)
    const moduleName = NAV_ITEM_MODULE_NAME[navItemId];
    if (moduleName && hasHierarchicalPermission(moduleName)) return true;

    // Step 5c: No mapping at all = always visible
    if (!prefix && !moduleName) return true;

    return false;
  }, [isFeatureEnabled, securityProfileName, permissions, isLoading, hasPermissionForPrefix, hasHierarchicalPermission]);

  return {
    featureFlags,
    isLoading,
    isFeatureEnabled,
    isNavItemEnabled,
    hasPermissionForPrefix,
    hasHierarchicalPermission,
    permissions,
  };
};
