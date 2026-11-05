import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * The distributor hierarchy, read from the table that defines it.
 *
 * `distributor_types` is the source of truth for who may sit under whom:
 * `parent_allowed` marks a root, `parent_type_code` names the only type a parent
 * may be, and `legacy_mapping` gives the value written to the old
 * `distributors.distribution_level` column that most of the UI still reads.
 * Database triggers enforce exactly these rules, so a screen built from this
 * hook cannot offer a combination the database will then refuse.
 *
 * Previously the levels, their labels and the "only a USS has a parent" rule
 * were hardcoded in three different components, which is why adding the OEM as
 * a root needed a code change at all.
 */

export interface DistributorType {
  id: string;
  code: string;
  name: string;
  level: number;
  sort_order: number;
  /** false means this type sits at the top and may not be given a parent. */
  parent_allowed: boolean;
  /** The code of the only type a parent may be, when that is constrained. */
  parent_type_code: string | null;
  /** The `distributors.distribution_level` value mirrored from this type. */
  legacy_mapping: string | null;
  description: string | null;
}

const QUERY_KEY = ['distributor-types'];

export function useDistributorTypes() {
  const query = useQuery({
    queryKey: QUERY_KEY,
    // The hierarchy definition changes when someone deliberately changes it,
    // which is roughly never, so it is not worth refetching per screen.
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<DistributorType[]> => {
      const { data, error } = await supabase
        .from('distributor_types')
        .select('id, code, name, level, sort_order, parent_allowed, parent_type_code, legacy_mapping, description')
        .order('sort_order')
        .order('level');

      if (error) throw error;
      return (data ?? []) as DistributorType[];
    },
  });

  const types = query.data ?? [];

  return {
    types,
    /** Types that take part in the parent/child chain, in hierarchy order.
     *
     *  A type qualifies if it has a parent type, or if some other type names it
     *  as one. That picks out OEM > (DD, SS) > USS and leaves out a type like
     *  AG, which neither has a parent nor is anyone's — it is a label on a
     *  distributor rather than a rung on the ladder. Derived rather than listed
     *  so configuring a new rung does not need this file reopened. */
    hierarchyTypes: hierarchyChain(types),
    byCode: Object.fromEntries(types.map((t) => [t.code, t])) as Record<string, DistributorType>,
    byId: Object.fromEntries(types.map((t) => [t.id, t])) as Record<string, DistributorType>,
    loading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function hierarchyChain(types: DistributorType[]): DistributorType[] {
  const namedAsParent = new Set(
    types.map((t) => t.parent_type_code).filter((c): c is string => !!c),
  );
  return types.filter((t) => t.parent_type_code !== null || namedAsParent.has(t.code));
}

/** The `distribution_level` of an untyped row, read as a type code.
 *
 *  Half the distributor rows predate `type_id` and carry only the old text
 *  column, including values retired long ago. Resolving them through
 *  `legacy_mapping` rather than a hardcoded table means a row shows up under the
 *  type it was always meant to be, instead of vanishing from every tab. */
export function codeForLegacyLevel(
  level: string | null,
  types: DistributorType[],
): string | null {
  if (!level) return null;
  const exact = types.find((t) => t.legacy_mapping === level);
  if (exact) return exact.code;

  // Values dropped from the UI before `distributor_types` existed. They have no
  // mapping of their own, and all three described someone buying from the
  // company directly.
  if (level === 'distributor' || level === 'sub_distributor') {
    return types.find((t) => t.legacy_mapping === 'direct_distributor')?.code ?? null;
  }
  return null;
}

/** The type code a distributor row should be filed under, typed or not. */
export function resolveTypeCode(
  row: { type_id?: string | null; distribution_level?: string | null },
  types: DistributorType[],
): string | null {
  if (row.type_id) {
    const t = types.find((x) => x.id === row.type_id);
    if (t) return t.code;
  }
  return codeForLegacyLevel(row.distribution_level ?? null, types);
}
