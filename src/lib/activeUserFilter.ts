import { supabase } from '@/integrations/supabase/client';

/**
 * The both-flags test, as a PostgREST .match() filter, for the many places that
 * query profiles directly instead of going through the helpers above:
 *
 *   supabase.from('profiles').select('id, full_name').match(ACTIVE_PROFILE)
 *
 * Use it on anything that LISTS PEOPLE TO PICK. Do not use it on an id -> name
 * lookup, or a historic order loses its creator's name, and do not use it on the
 * figures behind analytics -- a departed rep's sales still count.
 */
export const ACTIVE_PROFILE = { is_active: true, user_status: 'active' } as const;


/**
 * Shared helpers for hiding inactive users from
 * "assign new work to X" pickers that are built on top of the get_all_subordinates
 * and get_profiles_for_selector RPCs.
 *
 * Neither RPC selects is_active (by design — they're also used inside RLS/report
 * scoping to determine which users' historical data a manager can see, so we must
 * not filter inside the RPCs themselves). These helpers do a small follow-up query
 * against profiles for just the ids already returned, and filter client-side.
 */

/**
 * A user counts as active only when BOTH flags say so. Checking is_active
 * alone is not enough: production holds rows with is_active = true and
 * user_status = 'inactive' ("Girish " and "MANVITH ", both with a trailing
 * space in the name), and those were still turning up in team lists.
 */
/**
 * Filters rows shaped like the get_all_subordinates RPC result down to active users.
 * The manager themselves (level 0) is always kept regardless of their own active status.
 */
export async function filterActiveSubordinateRows<
  T extends { subordinate_user_id: string; level: number }
>(rows: T[]): Promise<T[]> {
  const ids = rows.filter((r) => r.level > 0).map((r) => r.subordinate_user_id);
  if (ids.length === 0) return rows;

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .in('id', ids)
    .eq('is_active', true)
    .eq('user_status', 'active');

  if (error) {
    console.error('Error filtering active subordinates:', error);
    return rows;
  }

  const activeIds = new Set((data || []).map((p) => p.id));
  return rows.filter((r) => r.level === 0 || activeIds.has(r.subordinate_user_id));
}

/**
 * Filters rows shaped like the get_profiles_for_selector RPC result (or any row with
 * an `id`) down to active users only.
 */
export async function filterActiveProfileRows<T extends { id: string }>(
  rows: T[]
): Promise<T[]> {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return rows;

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .in('id', ids)
    .eq('is_active', true)
    .eq('user_status', 'active');

  if (error) {
    console.error('Error filtering active profiles:', error);
    return rows;
  }

  const activeIds = new Set((data || []).map((p) => p.id));
  return rows.filter((r) => activeIds.has(r.id));
}

/**
 * Filters a plain list of user ids down to active users only (for RPCs like
 * get_limited_profiles_for_admin / get_basic_profiles_for_admin that don't return
 * is_active themselves).
 */
export async function filterActiveUserIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return ids;

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .in('id', ids)
    .eq('is_active', true)
    .eq('user_status', 'active');

  if (error) {
    console.error('Error filtering active user ids:', error);
    return ids;
  }

  const activeIds = new Set((data || []).map((p) => p.id));
  return ids.filter((id) => activeIds.has(id));
}
