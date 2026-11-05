import { describe, it, expect } from 'vitest';
import { buildTree, type TreeRow } from './buildDistributorTree';
import type { DistributorType } from '@/hooks/useDistributorTypes';

/**
 * What this decides is not cosmetic: a row sorted into `orphans` is one that
 * nothing walking the network will ever reach. On staging that is exactly how
 * Sri Tirumala Warehouses was found — a USS attached to nothing, invisible in
 * the old tab layout because unrecognised rows were filed under the first tier.
 */

const t = (
  code: string,
  parent_type_code: string | null,
  legacy_mapping: string | null,
): DistributorType => ({
  id: `id-${code}`,
  code,
  name: code,
  level: 1,
  sort_order: 0,
  parent_allowed: parent_type_code !== null,
  parent_type_code,
  legacy_mapping,
  description: null,
});

const TYPES: DistributorType[] = [
  t('OEM', null, 'company'),
  t('DD', 'OEM', 'direct_distributor'),
  t('SS', 'OEM', 'super_stockist'),
  t('USS', 'SS', 'under_super_stockist'),
];

const row = (
  id: string,
  name: string,
  parent_id: string | null,
  typeCode: string | null,
): TreeRow => ({
  id,
  name,
  parent_id,
  type_id: typeCode ? `id-${typeCode}` : null,
  distribution_level: null,
  status: 'active',
  archived_at: null,
});

describe('buildTree', () => {
  it('hangs the network off the company', () => {
    const { roots, orphans } = buildTree(
      [
        row('oem', 'KVP Business Solutions', null, 'OEM'),
        row('ss', 'BHARATH BEVERAGES', 'oem', 'SS'),
        row('uss', 'BHARATH BEVERAGES Bangalore', 'ss', 'USS'),
        row('dd', 'Mangaluru Masala', 'oem', 'DD'),
      ],
      TYPES,
    );

    expect(orphans).toHaveLength(0);
    expect(roots).toHaveLength(1);
    expect(roots[0].name).toBe('KVP Business Solutions');
    // Sorted by name, so BHARATH comes before Mangaluru.
    expect(roots[0].children.map((c) => c.name)).toEqual([
      'BHARATH BEVERAGES',
      'Mangaluru Masala',
    ]);
    expect(roots[0].children[0].children[0].name).toBe('BHARATH BEVERAGES Bangalore');
  });

  it('calls out a row with no parent that is not the company', () => {
    const { roots, orphans } = buildTree(
      [
        row('oem', 'KVP Business Solutions', null, 'OEM'),
        row('loose', 'Sri Tirumala Warehouses', null, 'USS'),
      ],
      TYPES,
    );

    expect(roots.map((r) => r.name)).toEqual(['KVP Business Solutions']);
    expect(orphans.map((o) => o.name)).toEqual(['Sri Tirumala Warehouses']);
  });

  it('calls out a row whose parent is filtered out of the list', () => {
    // Showing only archived rows can leave a child without its live parent.
    const { orphans } = buildTree([row('uss', 'Bangalore branch', 'missing', 'USS')], TYPES);
    expect(orphans.map((o) => o.name)).toEqual(['Bangalore branch']);
  });

  it('does not lose an untyped row', () => {
    const { roots, orphans } = buildTree(
      [row('oem', 'KVP', null, 'OEM'), row('x', 'VM Distributor', 'oem', null)],
      TYPES,
    );
    expect(orphans).toHaveLength(0);
    expect(roots[0].children.map((c) => c.name)).toEqual(['VM Distributor']);
    expect(roots[0].children[0].typeCode).toBeNull();
  });

  it('survives a parent cycle rather than hanging', () => {
    // The database refuses cycles, but the tree must not be the thing that
    // depends on that holding.
    const { roots, orphans } = buildTree(
      [row('a', 'A', 'b', 'DD'), row('b', 'B', 'a', 'DD')],
      TYPES,
    );
    expect(roots).toHaveLength(0);
    expect(orphans).toHaveLength(0);
  });

  it('returns nothing for an empty list', () => {
    expect(buildTree([], TYPES)).toEqual({ roots: [], orphans: [] });
  });
});
