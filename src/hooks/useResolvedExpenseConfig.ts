import { supabase } from '@/integrations/supabase/client';

export interface ResolvedExpenseConfig {
  ta_type: 'fixed' | 'from_beat' | 'from_gps';
  fixed_ta_amount: number;
  da_amount: number;
  ta_per_km_rate: number;
}

/**
 * Fetches all config levels (global, user, team, group) and returns maps for resolution.
 * Priority: User > Group > Team (Manager) > Global
 */
export const fetchExpenseConfigs = async () => {
  const [globalRes, userRes, teamRes, groupRes, groupMemberRes] = await Promise.all([
    supabase.from('expense_master_config').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    (supabase as any).from('user_expense_config').select('*'),
    (supabase as any).from('team_expense_config').select('*'),
    (supabase as any).from('expense_groups').select('*'),
    (supabase as any).from('expense_group_members').select('*'),
  ]);

  const globalConfig = globalRes.data;
  const userConfigs: any[] = userRes.data || [];
  const teamConfigs: any[] = teamRes.data || [];
  const groups: any[] = groupRes.data || [];
  const groupMembers: any[] = groupMemberRes.data || [];

  const userConfigMap = new Map<string, any>();
  userConfigs.forEach((c: any) => userConfigMap.set(c.user_id, c));

  const teamConfigMap = new Map<string, any>();
  teamConfigs.forEach((c: any) => teamConfigMap.set(c.manager_id, c));

  // Build a map: user_id -> group config
  const groupMap = new Map<string, any>();
  groups.forEach((g: any) => groupMap.set(g.id, g));

  const userGroupConfigMap = new Map<string, any>();
  groupMembers.forEach((m: any) => {
    const group = groupMap.get(m.group_id);
    if (group) {
      userGroupConfigMap.set(m.user_id, group);
    }
  });

  return {
    globalConfig,
    userConfigMap,
    teamConfigMap,
    userGroupConfigMap,
  };
};

/**
 * Resolve expense config for a specific user given their manager_id.
 * Priority: user_expense_config > expense_group > team_expense_config (by manager_id) > global
 */
export const resolveExpenseConfig = (
  userId: string,
  managerId: string | null | undefined,
  globalConfig: any,
  userConfigMap: Map<string, any>,
  teamConfigMap: Map<string, any>,
  userGroupConfigMap?: Map<string, any>,
): ResolvedExpenseConfig => {
  const userConfig = userConfigMap.get(userId);
  const groupConfig = userGroupConfigMap?.get(userId);
  const teamConfig = managerId ? teamConfigMap.get(managerId) : undefined;

  return {
    ta_type: (userConfig?.ta_type ?? groupConfig?.ta_type ?? teamConfig?.ta_type ?? globalConfig?.ta_type ?? 'from_beat') as 'fixed' | 'from_beat',
    fixed_ta_amount: userConfig?.fixed_ta_amount ?? groupConfig?.fixed_ta_amount ?? teamConfig?.fixed_ta_amount ?? globalConfig?.fixed_ta_amount ?? 0,
    da_amount: userConfig?.da_amount ?? groupConfig?.da_amount ?? teamConfig?.da_amount ?? globalConfig?.da_amount ?? 0,
    ta_per_km_rate: userConfig?.ta_per_km_rate ?? groupConfig?.ta_per_km_rate ?? teamConfig?.ta_per_km_rate ?? globalConfig?.ta_per_km_rate ?? 0,
  };
};

/**
 * Helper to fetch manager_id for a user from employees table
 */
export const fetchUserManagerId = async (userId: string): Promise<string | null> => {
  const { data } = await supabase
    .from('employees')
    .select('manager_id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.manager_id || null;
};

/**
 * Helper to fetch manager_ids for multiple users
 */
export const fetchUserManagerIds = async (userIds: string[]): Promise<Map<string, string | null>> => {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase
    .from('employees')
    .select('user_id, manager_id')
    .in('user_id', userIds);
  const map = new Map<string, string | null>();
  data?.forEach((e: any) => map.set(e.user_id, e.manager_id));
  return map;
};
