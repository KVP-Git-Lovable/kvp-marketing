import { describe, it, expect } from 'vitest';
import {
  hierarchyChain,
  codeForLegacyLevel,
  resolveTypeCode,
  type DistributorType,
} from './useDistributorTypes';

/**
 * These three functions decide which tab a distributor appears under, and
 * therefore whether it appears at all. The screen they replaced filed every
 * unrecognised row under "Direct Distributor", which is why the OEM row that
 * already exists in the data was invisible: its level is `company`, which
 * matched no tab.
 *
 * The fixture mirrors the real `distributor_types` table, AG included — a type
 * that is deliberately not a rung in the hierarchy.
 */
const t = (
  code: string,
  name: string,
  parent_allowed: boolean,
  parent_type_code: string | null,
  legacy_mapping: string | null,
  sort_order: number,
): DistributorType => ({
  id: `id-${code}`,
  code,
  name,
  level: 1,
  sort_order,
  parent_allowed,
  parent_type_code,
  legacy_mapping,
  description: null,
});

const TYPES: DistributorType[] = [
  t('OEM', 'OEM', false, null, 'company', 0),
  t('DD', 'Direct Distributor', true, 'OEM', 'direct_distributor', 1),
  t('SS', 'Super Stockist', true, 'OEM', 'super_stockist', 2),
  t('USS', 'Under Super Stockist', true, 'SS', 'under_super_stockist', 3),
  t('AG', 'Agents', false, null, 'agent', 9),
];

describe('hierarchyChain', () => {
  it('keeps the root and every rung below it', () => {
    expect(hierarchyChain(TYPES).map((x) => x.code)).toEqual(['OEM', 'DD', 'SS', 'USS']);
  });

  it('leaves out a type that is neither a parent nor a child', () => {
    // AG has no parent and nobody names it as one, so it is a label on a
    // distributor rather than a level in the ordering hierarchy.
    expect(hierarchyChain(TYPES).some((x) => x.code === 'AG')).toBe(false);
  });

  it('includes the root because something names it as a parent, not because it is called OEM', () => {
    const renamed = TYPES.map((x) =>
      x.code === 'OEM' ? { ...x, code: 'HQ' } : x.parent_type_code === 'OEM' ? { ...x, parent_type_code: 'HQ' } : x,
    );
    expect(hierarchyChain(renamed).map((x) => x.code)).toEqual(['HQ', 'DD', 'SS', 'USS']);
  });

  it('returns nothing rather than throwing when the table has not loaded', () => {
    expect(hierarchyChain([])).toEqual([]);
  });
});

describe('codeForLegacyLevel', () => {
  it('resolves a level through the mapping configured on the type', () => {
    expect(codeForLegacyLevel('company', TYPES)).toBe('OEM');
    expect(codeForLegacyLevel('super_stockist', TYPES)).toBe('SS');
    expect(codeForLegacyLevel('under_super_stockist', TYPES)).toBe('USS');
  });

  it('maps the two retired levels onto the type that replaced them', () => {
    // Both described buying from the company directly, and no type maps to
    // either, so without this they would resolve to nothing.
    expect(codeForLegacyLevel('distributor', TYPES)).toBe('DD');
    expect(codeForLegacyLevel('sub_distributor', TYPES)).toBe('DD');
  });

  it('gives nothing for a null or unknown level', () => {
    expect(codeForLegacyLevel(null, TYPES)).toBeNull();
    expect(codeForLegacyLevel('something_else', TYPES)).toBeNull();
  });
});

describe('resolveTypeCode', () => {
  it('prefers type_id over the mirrored level', () => {
    // The state three rows were actually in before the mirror trigger existed:
    // a deliberate type_id and a stale level that disagreed with it.
    expect(
      resolveTypeCode({ type_id: 'id-OEM', distribution_level: 'distributor' }, TYPES),
    ).toBe('OEM');
  });

  it('falls back to the level for the rows that predate type_id', () => {
    expect(resolveTypeCode({ type_id: null, distribution_level: 'super_stockist' }, TYPES)).toBe('SS');
  });

  it('falls back to the level when type_id names a type that is no longer there', () => {
    expect(
      resolveTypeCode({ type_id: 'id-GONE', distribution_level: 'super_stockist' }, TYPES),
    ).toBe('SS');
  });

  it('gives nothing when neither says anything', () => {
    expect(resolveTypeCode({ type_id: null, distribution_level: null }, TYPES)).toBeNull();
  });
});
