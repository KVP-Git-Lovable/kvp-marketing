import { describe, it, expect } from 'vitest';
import { resolveEntryUnit, firstUnresolvable, partitionByUnit, type UnitsByProduct } from './entryUnits';
import type { ProductUnit } from '@/lib/uomEngine';

/**
 * Opening stock is a write path, so the question these answer is not "does the
 * arithmetic work" — that is covered on the engine — but "does it refuse".
 * The converter this replaced returned the entered quantity unchanged for
 * anything outside kg/g and l/ml, so 10 boxes of a piece-counted product were
 * stored as 10 pieces and nothing afterwards could tell.
 */

const unit = (
  code: string,
  conversionToBase: number,
  isBase = false,
): ProductUnit => ({
  mappingId: `m-${code}`,
  uomId: `u-${code}`,
  code,
  name: code,
  category: 'Quantity',
  conversionToBase,
  isBase,
  isDefaultSales: false,
  isPriceBasis: false,
});

/** ADRAK 40G: weight, base GRAM, sold by KG. */
const WEIGHT = [unit('GRAM', 1, true), unit('KG', 1000)];
/** A piece-counted product with a 24-piece box. */
const QUANTITY = [unit('PIECE', 1, true), unit('BOX', 24), unit('CARTON', 1000)];

const UNITS: UnitsByProduct = { 'p-weight': WEIGHT, 'p-qty': QUANTITY, 'p-empty': [] };

const entry = (product_id: string, entryUnit: string, product_name = 'Test product') => ({
  product_id,
  product_name,
  entryUnit,
});

describe('valid conversions', () => {
  it('converts a sales unit to the base', () => {
    const r = resolveEntryUnit(entry('p-weight', 'KG'), UNITS);
    expect(r).toEqual({ ok: true, factor: 1000, baseUnit: 'GRAM' });
    // 2.75 KG entered becomes 2,750 g stored.
    expect(r.ok && 2.75 * r.factor).toBe(2750);
  });

  it('leaves a base-unit entry at one to one', () => {
    const r = resolveEntryUnit(entry('p-weight', 'GRAM'), UNITS);
    expect(r).toEqual({ ok: true, factor: 1, baseUnit: 'GRAM' });
  });

  it('handles a packed unit the old converter knew nothing about', () => {
    const r = resolveEntryUnit(entry('p-qty', 'BOX'), UNITS);
    expect(r).toEqual({ ok: true, factor: 24, baseUnit: 'PIECE' });
    // The case that used to be stored as 10 pieces.
    expect(r.ok && 10 * r.factor).toBe(240);
  });

  it('matches the code case-insensitively', () => {
    expect(resolveEntryUnit(entry('p-weight', 'kg'), UNITS)).toMatchObject({ ok: true, factor: 1000 });
  });
});

describe('unsupported units', () => {
  it('refuses a unit from another category', () => {
    const r = resolveEntryUnit(entry('p-qty', 'GRAM', 'TAJ MAHAL TEA'), UNITS);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain('not a unit this product is set up for');
    expect(!r.ok && r.message).toContain('PIECE or BOX or CARTON');
  });

  it('refuses a unit the product simply does not have', () => {
    expect(resolveEntryUnit(entry('p-weight', 'BOX'), UNITS).ok).toBe(false);
    expect(resolveEntryUnit(entry('p-weight', 'packets'), UNITS).ok).toBe(false);
    expect(resolveEntryUnit(entry('p-qty', 'ML'), UNITS).ok).toBe(false);
  });

  it('refuses when no unit has been chosen', () => {
    const r = resolveEntryUnit(entry('p-weight', ''), UNITS);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain('choose a unit');
  });
});

describe('missing mappings', () => {
  it('refuses a product with no units configured, and says where to set them', () => {
    const r = resolveEntryUnit(entry('p-unknown', 'KG', 'Paras Josh Chai'), UNITS);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain('has no units configured');
    expect(!r.ok && r.message).toContain('UOM Master');
  });

  it('treats an empty configured list the same as none', () => {
    expect(resolveEntryUnit(entry('p-empty', 'KG'), UNITS).ok).toBe(false);
  });

  it('refuses a unit whose conversion rate is missing, rather than storing zero', () => {
    const broken: UnitsByProduct = { p: [unit('PIECE', 1, true), unit('BOX', 0)] };
    const r = resolveEntryUnit(entry('p', 'BOX'), broken);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain('no conversion rate set');
  });
});

describe('blocking the save', () => {
  it('passes a set where every row converts', () => {
    expect(firstUnresolvable(
      [entry('p-weight', 'KG'), entry('p-qty', 'BOX'), entry('p-qty', 'PIECE')],
      UNITS,
    )).toBeNull();
  });

  it('stops on the first row that cannot, before anything is written', () => {
    const blocked = firstUnresolvable(
      [entry('p-weight', 'KG'), entry('p-qty', 'GRAM', 'Second product'), entry('p-weight', 'GRAM')],
      UNITS,
    );
    expect(blocked?.entry.product_name).toBe('Second product');
    expect(blocked?.message).toContain('not a unit this product is set up for');
  });

  it('names the product so the person knows which row to fix', () => {
    const blocked = firstUnresolvable([entry('p-unknown', 'KG', 'Paras Josh Chai')], UNITS);
    expect(blocked?.message).toContain('Paras Josh Chai');
  });

  it('is empty-set safe', () => {
    expect(firstUnresolvable([], UNITS)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- *
 * The shapes the seven DMS transaction screens hand this, taken from what each
 * one was actually doing before it was changed.
 * -------------------------------------------------------------------------- */

describe('the DMS transaction screens', () => {
  it('Goods Receipt: converts a line in the order unit into the stocked unit', () => {
    // Received 10 KG against a product stocked in grams. The GRN used to post
    // the 10 straight through, a thousandfold under-receipt.
    const r = resolveEntryUnit(entry('p-weight', 'KG', 'ADRAK 40G'), UNITS);
    expect(r.ok && 10 * r.factor).toBe(10000);
    expect(r.ok && r.baseUnit).toBe('GRAM');
  });

  it('Stock Adjustments: a decrease is compared in the stored unit', () => {
    // 2 KG off a row holding 5,000 g is allowed; it is 2,000 g, not 2.
    const r = resolveEntryUnit(entry('p-weight', 'KG'), UNITS);
    expect(r.ok).toBe(true);
    const typed = 2;
    const inStoredUnit = r.ok ? typed * r.factor : typed;
    expect(inStoredUnit).toBe(2000);
    expect(inStoredUnit <= 5000).toBe(true);
  });

  it('Returns: a line defaulting to pcs on a weight product is refused', () => {
    // Both return screens fell back to products.unit or the string 'pcs' when
    // no inventory row matched, then applied that quantity to the books.
    expect(resolveEntryUnit(entry('p-weight', 'pcs', 'ADRAK 40G'), UNITS).ok).toBe(false);
  });

  it('Returns: the whole set is judged before any stock moves', () => {
    const lines = [
      entry('p-weight', 'KG', 'First'),
      entry('p-qty', 'pcs', 'Second'),      // PIECE spelt pcs — same unit, fine
      entry('p-weight', 'BOX', 'Third'),    // not configured for a weight product
    ];
    const blocked = firstUnresolvable(lines, UNITS);
    expect(blocked?.entry.product_name).toBe('Third');
  });

  it('Stock actions: marking damaged in an unconfigured unit is refused', () => {
    expect(resolveEntryUnit(entry('p-qty', 'KG', 'TAJ MAHAL TEA'), UNITS).ok).toBe(false);
  });

  it('a product stocked in its base unit needs no conversion at all', () => {
    const r = resolveEntryUnit(entry('p-qty', 'PIECE'), UNITS);
    expect(r).toEqual({ ok: true, factor: 1, baseUnit: 'PIECE' });
  });
});

describe('spelling, and only spelling', () => {
  it('accepts the spellings the data actually holds', () => {
    // Goods Receipt takes its unit from the order line, which holds these.
    expect(resolveEntryUnit(entry('p-qty', 'pcs'), UNITS)).toMatchObject({ ok: true, factor: 1 });
    expect(resolveEntryUnit(entry('p-qty', 'pieces'), UNITS)).toMatchObject({ ok: true, factor: 1 });
    expect(resolveEntryUnit(entry('p-weight', 'grams'), UNITS)).toMatchObject({ ok: true, factor: 1 });
    expect(resolveEntryUnit(entry('p-weight', 'Kilogram'), UNITS)).toMatchObject({ ok: true, factor: 1000 });
  });

  it('still never bridges one category to another', () => {
    expect(resolveEntryUnit(entry('p-weight', 'pcs'), UNITS).ok).toBe(false);
    expect(resolveEntryUnit(entry('p-weight', 'pieces'), UNITS).ok).toBe(false);
    expect(resolveEntryUnit(entry('p-qty', 'grams'), UNITS).ok).toBe(false);
    expect(resolveEntryUnit(entry('p-qty', 'KG'), UNITS).ok).toBe(false);
  });

  it('refuses a value that is not a unit at all', () => {
    // 'S' and 'UNIT' are both in order_items today.
    expect(resolveEntryUnit(entry('p-qty', 'S'), UNITS).ok).toBe(false);
    expect(resolveEntryUnit(entry('p-qty', 'UNIT'), UNITS).ok).toBe(false);
  });
});

describe('partitionByUnit', () => {
  it('gives the bulk unit only to products configured for it', () => {
    const rows = [entry('p-weight', ''), entry('p-qty', '')];
    const { takes, keepsOwn } = partitionByUnit(rows, 'KG', UNITS);

    expect(takes.map(r => r.product_id)).toEqual(['p-weight']);
    expect(keepsOwn.map(r => r.product_id)).toEqual(['p-qty']);
  });

  it('reconciles spelling, so pcs matches a configured PIECE', () => {
    const { takes } = partitionByUnit([entry('p-qty', '')], 'pcs', UNITS);
    expect(takes).toHaveLength(1);
  });

  it('never crosses categories: KG is not offered to a counted product', () => {
    // The whole point of the split. A piece-counted product taking KG would
    // be converted by a factor it does not have, or refused on save.
    const { takes, keepsOwn } = partitionByUnit([entry('p-qty', '')], 'KG', UNITS);
    expect(takes).toHaveLength(0);
    expect(keepsOwn).toHaveLength(1);
  });

  it('leaves a product with no configured units alone', () => {
    const { takes, keepsOwn } = partitionByUnit([entry('p-empty', '')], 'KG', UNITS);
    expect(takes).toHaveLength(0);
    expect(keepsOwn).toHaveLength(1);
  });

  it('leaves a product missing from the map alone rather than throwing', () => {
    const { keepsOwn } = partitionByUnit([entry('p-unknown', '')], 'KG', UNITS);
    expect(keepsOwn).toHaveLength(1);
  });

  it('splits a mixed list the way an opening stock run actually looks', () => {
    // Twelve gram products and three counted ones is the 28 Oct run that
    // prompted this: one quantity, one unit, two different meanings.
    const rows = [
      entry('p-weight', '', 'ADRAK 40G'),
      entry('p-weight', '', 'ADUKU 20G'),
      entry('p-qty', '', 'RED LABEL'),
    ];
    const { takes, keepsOwn } = partitionByUnit(rows, 'KG', UNITS);

    expect(takes.map(r => r.product_name)).toEqual(['ADRAK 40G', 'ADUKU 20G']);
    expect(keepsOwn.map(r => r.product_name)).toEqual(['RED LABEL']);
  });

  it('returns both sides empty for an empty list', () => {
    expect(partitionByUnit([], 'KG', UNITS)).toEqual({ takes: [], keepsOwn: [] });
  });
});
