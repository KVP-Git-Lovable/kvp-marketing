import { describe, it, expect } from 'vitest';
import { priceInUnit, isSuspiciousUnityRatio } from './unitPrice';

/**
 * ADRAK 40G is the case that prompted this: rate 319.05, price basis KG,
 * UOM mapping of GRAM (base, x1) and KG (x1000). Ordering 100 GRAM on the
 * primary screen quoted Rs 319.05/g and totalled Rs 31,905 instead of
 * Rs 31.91 -- a clean factor of 1000.
 */
const ADRAK = { baseRate: 319.05, priceBasisUnit: 'KG' };

describe('priceInUnit', () => {
  it('leaves the rate alone in the unit it was quoted in', () => {
    expect(priceInUnit({ ...ADRAK, targetUnit: 'KG' })).toBeCloseTo(319.05, 5);
  });

  it('divides by a thousand for grams', () => {
    expect(priceInUnit({ ...ADRAK, targetUnit: 'GRAM' })).toBeCloseTo(0.31905, 7);
  });

  it.each(['g', 'gm', 'gram', 'grams', 'GRAM'])('recognises %s as a gram', (unit) => {
    expect(priceInUnit({ ...ADRAK, targetUnit: unit })).toBeCloseTo(0.31905, 7);
  });

  it('prefers this product’s own conversion factors over the fixed relation', () => {
    // A tray of 24 against a price basis of 12: two trays' worth, not a weight
    // conversion at all.
    expect(priceInUnit({
      baseRate: 200, priceBasisUnit: 'DOZEN', targetUnit: 'TRAY',
      conversionToBase: 24, priceBasisConversionToBase: 12,
    })).toBe(400);
  });

  it('uses the factors for grams too when they are present and sane', () => {
    expect(priceInUnit({
      ...ADRAK, targetUnit: 'GRAM', conversionToBase: 1, priceBasisConversionToBase: 1000,
    })).toBeCloseTo(0.31905, 7);
  });

  describe('the 1000x trap', () => {
    /**
     * Both factors arriving as 1 means the price basis resolved to the base
     * GRAM row rather than KG. Trusting the ratio would return the per-KG
     * rate per gram, which is the original bug.
     */
    it('ignores a 1:1 ratio between kilograms and grams', () => {
      expect(priceInUnit({
        ...ADRAK, targetUnit: 'GRAM', conversionToBase: 1, priceBasisConversionToBase: 1,
      })).toBeCloseTo(0.31905, 7);
    });

    it('ignores it in the other direction too', () => {
      expect(priceInUnit({
        baseRate: 0.31905, priceBasisUnit: 'GRAM', targetUnit: 'KG',
        conversionToBase: 1, priceBasisConversionToBase: 1,
      })).toBeCloseTo(0.31905, 5);
    });

    it.each([
      ['kg', 'g', 1, 1, true],
      ['g', 'kg', 5, 5, true],
      ['litre', 'ml', 1, 1, true],
      ['ml', 'litre', 2, 2, true],
      ['kg', 'g', 1, 1000, false],   // a real ratio, not the trap
      ['dozen', 'tray', 12, 12, false], // same factor, but not a weight pair
      ['kg', 'g', 0, 0, false],      // nothing to judge
    ])('%s -> %s at %s/%s is suspicious: %s', (basis, target, c, pb, expected) => {
      expect(isSuspiciousUnityRatio(basis, target, c, pb)).toBe(expected);
    });
  });

  describe('falls back safely', () => {
    it('returns the rate unchanged for pieces', () => {
      expect(priceInUnit({ baseRate: 45, priceBasisUnit: 'piece', targetUnit: 'piece' })).toBe(45);
    });

    it('returns the rate unchanged when the basis is unknown', () => {
      expect(priceInUnit({ baseRate: 45, priceBasisUnit: null, targetUnit: 'GRAM' })).toBe(45);
    });

    it('returns the rate unchanged when no unit was selected', () => {
      expect(priceInUnit({ ...ADRAK, targetUnit: null })).toBe(319.05);
    });

    it('does not convert between units it has no relation for', () => {
      expect(priceInUnit({ baseRate: 45, priceBasisUnit: 'KG', targetUnit: 'piece' })).toBe(45);
    });

    it('treats a missing rate as zero rather than NaN', () => {
      expect(priceInUnit({ baseRate: undefined as any, priceBasisUnit: 'KG', targetUnit: 'GRAM' })).toBe(0);
    });
  });

  it('is the same answer whichever way the line is entered', () => {
    // 100 g and 0.1 kg are the same purchase and must cost the same.
    const perGram = priceInUnit({ ...ADRAK, targetUnit: 'GRAM' }) * 100;
    const perKg = priceInUnit({ ...ADRAK, targetUnit: 'KG' }) * 0.1;
    expect(perGram).toBeCloseTo(perKg, 7);
    expect(perGram).toBeCloseTo(31.905, 5);
  });
});
