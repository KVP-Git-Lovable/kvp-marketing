import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Pins what the UoM engine actually does, before its callers are moved onto it.
 *
 * The conversion factors come from product_uom_mapping and are sound — every
 * mapping in the system carries one. What these tests exist to record is the
 * behaviour at the edges, which is where the damage has come from: an unknown
 * unit, a spelling the configuration does not use, and a product with no
 * mapping at all.
 */

const rpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null }) }),
        or: () => ({ limit: async () => ({ data: [] }) }),
      }),
    }),
  },
}));

vi.mock('@/lib/offlineStorage', () => ({
  offlineStorage: { getAll: async () => [] },
  STORES: { PRODUCT_UOM_MAPPING: 'a', UOM_MASTER: 'b', PRODUCTS: 'c' },
}));

import {
  loadProductUnits,
  getBaseUnit,
  convertToBase,
  convertFromBase,
  convert,
  clearProductUnitsCache,
  findUnit,
  convertToBaseStrict,
  convertFromBaseStrict,
  findUnitIn,
  toBaseIn,
  fromBaseIn,
  defaultSalesUnitIn,
} from './uomEngine';

/** ADRAK 40G as configured on staging: a weight product, base GRAM, sold by KG. */
const WEIGHT_ROWS = [
  { mapping_id: 'm1', uom_id: 'u1', code: 'GRAM', name: 'Gram', category: 'Weight',
    conversion_to_base: 1, is_base: true, is_default_sales: false, is_price_basis: false },
  { mapping_id: 'm2', uom_id: 'u2', code: 'KG', name: 'Kilogram', category: 'Weight',
    conversion_to_base: 1000, is_base: false, is_default_sales: true, is_price_basis: true },
];

/** A quantity product: base PIECE, with a 24-piece box. */
const QUANTITY_ROWS = [
  { mapping_id: 'm3', uom_id: 'u3', code: 'PIECE', name: 'Piece', category: 'Quantity',
    conversion_to_base: 1, is_base: true, is_default_sales: true, is_price_basis: true },
  { mapping_id: 'm4', uom_id: 'u4', code: 'BOX', name: 'Box', category: 'Quantity',
    conversion_to_base: 24, is_base: false, is_default_sales: false, is_price_basis: false },
];

beforeEach(() => {
  clearProductUnitsCache();
  rpc.mockReset();
});

const serve = (rows: unknown[]) => rpc.mockResolvedValue({ data: rows, error: null });

describe('loadProductUnits', () => {
  it('maps the RPC rows, factors included', async () => {
    serve(WEIGHT_ROWS);
    const units = await loadProductUnits('p-weight');
    expect(units.map(u => u.code)).toEqual(['GRAM', 'KG']);
    expect(units.find(u => u.code === 'KG')?.conversionToBase).toBe(1000);
    expect(units.find(u => u.code === 'GRAM')?.isBase).toBe(true);
  });

  it('caches, so a second read costs no round trip', async () => {
    serve(WEIGHT_ROWS);
    await loadProductUnits('p-weight');
    await loadProductUnits('p-weight');
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('does not cache an empty result, so a later mapping edit can surface', async () => {
    serve([]);
    await loadProductUnits('p-none');
    await loadProductUnits('p-none');
    expect(rpc.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('getBaseUnit', () => {
  it('finds the unit stock is stored in', async () => {
    serve(WEIGHT_ROWS);
    expect((await getBaseUnit('p-weight'))?.code).toBe('GRAM');
    clearProductUnitsCache();
    serve(QUANTITY_ROWS);
    expect((await getBaseUnit('p-qty'))?.code).toBe('PIECE');
  });
});

describe('convertToBase', () => {
  it('applies the configured factor', async () => {
    serve(WEIGHT_ROWS);
    expect(await convertToBase('p-weight', 2.75, 'KG')).toBe(2750);
    clearProductUnitsCache();
    serve(QUANTITY_ROWS);
    expect(await convertToBase('p-qty', 3, 'BOX')).toBe(72);
  });

  it('leaves a base-unit quantity alone', async () => {
    serve(WEIGHT_ROWS);
    expect(await convertToBase('p-weight', 500, 'GRAM')).toBe(500);
  });

  it('matches a code case-insensitively', async () => {
    serve(WEIGHT_ROWS);
    expect(await convertToBase('p-weight', 2, 'kg')).toBe(2000);
  });

  /* ------------------------------------------------------------------ *
   * The two below are the hazard. They are recorded as the engine's
   * current behaviour, not endorsed: both return the number unchanged
   * and let it be stored as though it were already the base unit.
   * ------------------------------------------------------------------ */

  it('ASSUMES BASE for a unit the product is not configured for', async () => {
    serve(QUANTITY_ROWS);
    // 10,000 grams against a product counted in pieces. There is no factor
    // between weight and quantity, and the engine does not say so — it hands
    // back 10,000, which a caller then stores as 10,000 pieces.
    expect(await convertToBase('p-qty', 10000, 'GRAM')).toBe(10000);
  });

  it('ASSUMES BASE for a spelling the configuration does not use', async () => {
    serve(WEIGHT_ROWS);
    // The van screen stored "Grams"; the configured code is "GRAM". Here the
    // two happen to mean the same thing and the answer is right by luck — but
    // the same path returns "pcs" unchanged against a weight product too.
    expect(await convertToBase('p-weight', 10000, 'Grams')).toBe(10000);
    expect(await convertToBase('p-weight', 50, 'pcs')).toBe(50);
  });
});

describe('convertFromBase', () => {
  it('divides by the configured factor', async () => {
    serve(WEIGHT_ROWS);
    expect(await convertFromBase('p-weight', 2750, 'KG')).toBe(2.75);
    expect(await convertFromBase('p-weight', 990000, 'KG')).toBe(990);
  });

  it('ASSUMES BASE for an unknown unit, so a label can disagree with its number', async () => {
    serve(WEIGHT_ROWS);
    // Asked for pieces, given grams, with nothing to signal the mismatch.
    expect(await convertFromBase('p-weight', 2750, 'PIECE')).toBe(2750);
  });
});

describe('convert', () => {
  it('goes through the base unit', async () => {
    serve(QUANTITY_ROWS);
    expect(await convert('p-qty', 2, 'BOX', 'PIECE')).toBe(48);
    expect(await convert('p-qty', 48, 'PIECE', 'BOX')).toBe(2);
  });

  it('short-circuits when the two units are the same', async () => {
    serve(WEIGHT_ROWS);
    expect(await convert('p-weight', 7, 'KG', 'kg')).toBe(7);
  });
});

/* -------------------------------------------------------------------------- *
 * The strict pair, added for write paths. Same factors, different answer when
 * the unit is not one the product is configured for.
 * -------------------------------------------------------------------------- */

describe('findUnit', () => {
  it('returns the configured unit, matching the code case-insensitively', async () => {
    serve(WEIGHT_ROWS);
    expect((await findUnit('p-weight', 'kg'))?.conversionToBase).toBe(1000);
    expect((await findUnit('p-weight', 'GRAM'))?.isBase).toBe(true);
  });

  it('returns null for a unit the product does not have', async () => {
    serve(WEIGHT_ROWS);
    expect(await findUnit('p-weight', 'PIECE')).toBeNull();
    expect(await findUnit('p-weight', 'pcs')).toBeNull();
  });
});

describe('convertToBaseStrict', () => {
  it('applies the configured factor, exactly as the lenient one does', async () => {
    serve(WEIGHT_ROWS);
    expect(await convertToBaseStrict('p-weight', 2.75, 'KG')).toBe(2750);
    expect(await convertToBaseStrict('p-weight', 500, 'GRAM')).toBe(500);
    clearProductUnitsCache();
    serve(QUANTITY_ROWS);
    expect(await convertToBaseStrict('p-qty', 3, 'BOX')).toBe(72);
  });

  it('refuses the cross-category case the lenient one waves through', async () => {
    serve(QUANTITY_ROWS);
    // The lenient path returns 10000 here, which a caller stores as pieces.
    expect(await convertToBase('p-qty', 10000, 'GRAM')).toBe(10000);
    expect(await convertToBaseStrict('p-qty', 10000, 'GRAM')).toBeNull();
  });

  it('refuses a spelling the configuration does not use', async () => {
    serve(WEIGHT_ROWS);
    expect(await convertToBaseStrict('p-weight', 50, 'pcs')).toBeNull();
    expect(await convertToBaseStrict('p-weight', 5, 'ML')).toBeNull();
  });

  it('refuses when the product has no mapping at all', async () => {
    serve([]);
    expect(await convertToBaseStrict('p-none', 10, 'KG')).toBeNull();
  });
});

describe('convertFromBaseStrict', () => {
  it('divides by the configured factor', async () => {
    serve(WEIGHT_ROWS);
    expect(await convertFromBaseStrict('p-weight', 990000, 'KG')).toBe(990);
    expect(await convertFromBaseStrict('p-weight', 2750, 'GRAM')).toBe(2750);
  });

  it('refuses rather than letting a label disagree with its number', async () => {
    serve(WEIGHT_ROWS);
    expect(await convertFromBase('p-weight', 2750, 'PIECE')).toBe(2750);
    expect(await convertFromBaseStrict('p-weight', 2750, 'PIECE')).toBeNull();
  });

  it('round-trips through the strict pair', async () => {
    serve(QUANTITY_ROWS);
    const base = await convertToBaseStrict('p-qty', 4, 'BOX');
    expect(base).toBe(96);
    expect(await convertFromBaseStrict('p-qty', base!, 'BOX')).toBe(4);
  });
});

/* The synchronous core the render paths use, with the units already in hand. */
describe('the sync helpers', () => {
  const WEIGHT = [
    { mappingId: 'm1', uomId: 'u1', code: 'GRAM', name: 'Gram', category: 'Weight',
      conversionToBase: 1, isBase: true, isDefaultSales: false, isPriceBasis: false },
    { mappingId: 'm2', uomId: 'u2', code: 'KG', name: 'Kilogram', category: 'Weight',
      conversionToBase: 1000, isBase: false, isDefaultSales: true, isPriceBasis: true },
  ];

  it('convert without awaiting', () => {
    expect(toBaseIn(WEIGHT, 2.75, 'KG')).toBe(2750);
    expect(fromBaseIn(WEIGHT, 990000, 'KG')).toBe(990);
    expect(findUnitIn(WEIGHT, 'gram')?.isBase).toBe(true);
  });

  it('refuse an unconfigured unit, like their async forms', () => {
    expect(toBaseIn(WEIGHT, 50, 'PIECE')).toBeNull();
    expect(fromBaseIn(WEIGHT, 50, 'pcs')).toBeNull();
    expect(findUnitIn(WEIGHT, 'ML')).toBeNull();
  });

  it('cope with units that have not loaded yet', () => {
    expect(toBaseIn(undefined, 5, 'KG')).toBeNull();
    expect(fromBaseIn([], 5, 'KG')).toBeNull();
    expect(findUnitIn(undefined, 'KG')).toBeNull();
  });

  it('pick the unit marked for selling, else the base', () => {
    expect(defaultSalesUnitIn(WEIGHT)?.code).toBe('KG');
    expect(defaultSalesUnitIn(WEIGHT.map(u => ({ ...u, isDefaultSales: false })))?.code).toBe('GRAM');
    expect(defaultSalesUnitIn(undefined)).toBeNull();
  });
});
