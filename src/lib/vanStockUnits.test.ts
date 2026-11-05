import { describe, it, expect } from 'vitest';
import { totalOrderedInBase, vanLineUpdate, type VanLine } from './vanStockUnits';
import type { ProductUnit } from './uomEngine';


const unit = (code: string, factor: number, isBase = false): ProductUnit =>
  ({ code, conversionToBase: factor, isBase } as ProductUnit);

// A weight product: grams is the base, kilos and a 24-count carton above it.
const WEIGHT = [unit('GRAM', 1, true), unit('KG', 1000), unit('CARTON', 24000)];
// A counted product.
const PIECES = [unit('PIECE', 1, true), unit('BOX', 24)];

const units = { 'p-weight': WEIGHT, 'p-piece': PIECES };

const vanLine = (over: Partial<VanLine> = {}): VanLine => ({
  id: 'v-1',
  product_id: 'p-weight',
  product_name: 'VAYU 30G',
  unit: 'GRAM',
  start_qty: 10000,
  returned_qty: 0,
  ordered_qty: 0,
  left_qty: 10000,
  ...over,
});

describe('totalling what was ordered', () => {
  it('converts a sales unit into the base', () => {
    const { byKey } = totalOrderedInBase(
      [{ product_id: 'p-weight', quantity: 2, unit: 'KG' }], units);
    expect(byKey['p-weight']).toBe(2000);
  });

  it('converts a packed unit the old grams converter passed through untouched', () => {
    // This is the case that silently debited 5 instead of 120.
    const { byKey } = totalOrderedInBase(
      [{ product_id: 'p-piece', quantity: 5, unit: 'BOX' }], units);
    expect(byKey['p-piece']).toBe(120);
  });

  it('adds several lines for the same product', () => {
    const { byKey } = totalOrderedInBase([
      { product_id: 'p-weight', quantity: 1, unit: 'KG' },
      { product_id: 'p-weight', quantity: 500, unit: 'GRAM' },
    ], units);
    expect(byKey['p-weight']).toBe(1500);
  });

  it('keys a variant line by the variant, but converts by the product', () => {
    const { byKey, problems } = totalOrderedInBase(
      [{ product_id: 'p-weight', variant_id: 'var-9', quantity: 1, unit: 'KG' }], units);
    expect(byKey['var-9']).toBe(1000);
    expect(byKey['p-weight']).toBeUndefined();
    expect(problems).toHaveLength(0);
  });

  it('tolerates the spellings the data actually holds', () => {
    const { byKey } = totalOrderedInBase(
      [{ product_id: 'p-weight', quantity: 250, unit: 'grams' }], units);
    expect(byKey['p-weight']).toBe(250);
  });

  it('reports a unit the product is not set up for instead of guessing', () => {
    const { byKey, problems } = totalOrderedInBase(
      [{ product_id: 'p-weight', product_name: 'VAYU 30G', quantity: 5, unit: 'LITER' }], units);
    expect(byKey['p-weight']).toBeUndefined();
    expect(problems[0].message).toContain('VAYU 30G');
  });

  it('reports a product with no configuration rather than taking the number as-is', () => {
    const { byKey, problems } = totalOrderedInBase(
      [{ product_id: 'p-unmapped', product_name: 'Paras Josh Chai', quantity: 3, unit: 'KG' }], units);
    expect(byKey['p-unmapped']).toBeUndefined();
    expect(problems).toHaveLength(1);
  });

  it('never lets litres stand in for kilos, as the old converter did', () => {
    const { problems } = totalOrderedInBase(
      [{ product_id: 'p-weight', quantity: 2, unit: 'LITER' }], units);
    expect(problems).toHaveLength(1);
  });
});

describe('updating a van line', () => {
  it('subtracts what was ordered, in the unit the line is held in', () => {
    const r = vanLineUpdate(vanLine(), 2000, units);
    expect(r).toMatchObject({ ok: true, orderedQty: 2000, leftQty: 8000 });
  });

  it('converts into the line unit when van stock is not held in the base', () => {
    const r = vanLineUpdate(
      vanLine({ unit: 'KG', start_qty: 10, left_qty: 10 }), 2000, units);
    expect(r).toMatchObject({ ok: true, orderedQty: 2, leftQty: 8 });
  });

  it('adds returns back on', () => {
    const r = vanLineUpdate(vanLine({ returned_qty: 500 }), 2000, units);
    expect(r).toMatchObject({ leftQty: 8500 });
  });

  it('needs no units at all when nothing was ordered', () => {
    const r = vanLineUpdate(vanLine(), 0, {});
    expect(r).toMatchObject({ ok: true, orderedQty: 0, leftQty: 10000 });
  });

  it('accepts the unit spelling van stock actually holds', () => {
    // Real staging data stores "Grams", not "GRAM". An exact match refuses a
    // line that is perfectly correct, which is what the dry run turned up.
    const r = vanLineUpdate(vanLine({ unit: 'Grams' }), 2000, units);
    expect(r).toMatchObject({ ok: true, orderedQty: 2000, leftQty: 8000 });
  });

  it('refuses a line held in a unit the product is not set up for', () => {
    const r = vanLineUpdate(vanLine({ unit: 'LITER' }), 2000, units);
    expect(r.ok).toBe(false);
  });

  it('refuses when the product has no configuration', () => {
    const r = vanLineUpdate(vanLine(), 2000, { "p-weight": [] });
    expect(r.ok).toBe(false);
  });

  it('clamps a negative holding but says it happened', () => {
    const r = vanLineUpdate(vanLine({ start_qty: 1000, left_qty: 1000 }), 2000, units);
    expect(r).toMatchObject({ ok: true, leftQty: 0, overSold: true });
  });

  it('does not flag an exact sell-out as oversold', () => {
    const r = vanLineUpdate(vanLine({ start_qty: 2000, left_qty: 2000 }), 2000, units);
    expect(r).toMatchObject({ leftQty: 0, overSold: false });
  });

  it('reports no change when the line already says this', () => {
    const r = vanLineUpdate(vanLine({ ordered_qty: 2000, left_qty: 8000 }), 2000, units);
    expect(r).toMatchObject({ changed: false });
  });

  it('adds goods handed back during the day to what is still on board', () => {
    // 2000 loaded, 500 sold, 300 returned by a retailer -> 1800 on the van.
    const r = vanLineUpdate(
      vanLine({ start_qty: 2000, left_qty: 2000 }), 500, units, undefined, 300);
    expect(r).toMatchObject({ ok: true, orderedQty: 500, returnedQty: 300, leftQty: 1800 });
  });

  it('converts a return into the line unit, like an order', () => {
    const r = vanLineUpdate(
      vanLine({ unit: 'KG', start_qty: 10, left_qty: 10 }), 2000, units, undefined, 1000);
    expect(r).toMatchObject({ ok: true, orderedQty: 2, returnedQty: 1, leftQty: 9 });
  });

  it('leaves the stored return alone when the caller does not mention returns', () => {
    // An older caller that only knows about orders must not wipe the returns.
    const r = vanLineUpdate(vanLine({ returned_qty: 400, left_qty: 2400 }), 0, units);
    expect(r).toMatchObject({ ok: true, returnedQty: 400 });
  });

  it('clears the return when the credit notes no longer justify one', () => {
    const r = vanLineUpdate(vanLine({ returned_qty: 400 }), 0, units, undefined, 0);
    expect(r).toMatchObject({ ok: true, returnedQty: 0 });
  });

  it('notices a change in returns alone', () => {
    const r = vanLineUpdate(
      vanLine({ ordered_qty: 0, returned_qty: 0, left_qty: 10000 }), 0, units, undefined, 250);
    expect(r).toMatchObject({ changed: true });
  });

  it('refuses a return it cannot convert rather than guessing', () => {
    const r = vanLineUpdate(vanLine({ unit: 'LITER' }), 0, units, undefined, 300);
    expect(r.ok).toBe(false);
  });

  it('reports a change when it differs', () => {
    const r = vanLineUpdate(vanLine({ ordered_qty: 1, left_qty: 9999 }), 2000, units);
    expect(r).toMatchObject({ changed: true });
  });
});
