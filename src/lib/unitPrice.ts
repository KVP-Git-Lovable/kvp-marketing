/**
 * Scaling a resolved rate into the unit actually being ordered.
 *
 * A price book quotes one number per product. That number is quoted in the
 * product's price basis -- `products.price_basis_uom_id`, which for every
 * weight-category product in this catalogue is KG -- and NOT in the product's
 * base unit, which under the two-tier UOM rule is usually GRAM. Pick GRAM on
 * an order line and the quoted rate has to come down by a factor of 1000
 * before it means anything.
 *
 * This lived only inside the secondary order form. The primary order screen
 * never had it, so every primary line priced in a gram-family unit was quoted
 * at the per-KG rate: ADRAK 40G at Rs 319.05 per GRAM instead of Rs 0.31905,
 * and a cart of 100 g totalling Rs 31,905 instead of Rs 31.91. Extracted here
 * so both screens answer from one implementation rather than two that drift.
 *
 * Nothing in here chooses a price book or a price. The caller resolves that
 * first -- book row, then product rate -- and passes the winning number in.
 * This only restates it in a different unit.
 */

import { normalizeUnit } from '@/utils/productFuzzyMatch';

export interface UnitPriceInput {
  /** The resolved rate, quoted in `priceBasisUnit`. */
  baseRate: number;
  /** The unit the rate is quoted in: price basis first, base unit as fallback. */
  priceBasisUnit?: string | null;
  /** The unit the line is being ordered in. */
  targetUnit?: string | null;
  /** `product_uom_mapping.conversion_to_base` for the target unit. */
  conversionToBase?: number | null;
  /** `product_uom_mapping.conversion_to_base` for the price basis unit. */
  priceBasisConversionToBase?: number | null;
}

const KG_WORDS = ['kg', 'kilogram', 'kilograms'];
const GRAM_WORDS = ['gram', 'grams', 'g', 'gm'];
const LITRE_WORDS = ['litre', 'liter', 'l'];
const ML_WORDS = ['ml', 'milliliter', 'milliliters'];

/**
 * True when the two conversion factors claim a gram-family unit costs exactly
 * what its kilogram-family sibling costs.
 *
 * That is never legitimate -- one gram cannot cost what one kilogram costs --
 * and it has a known cause: the price basis silently resolving to the base
 * GRAM row because the KG sibling failed to load, leaving both factors at 1.
 * This exact shape shipped roughly 700 order lines at 1000x the correct price
 * over ten months before anyone noticed, so when the ratio looks like this we
 * distrust it and fall through to the string-based conversion below.
 */
export function isSuspiciousUnityRatio(
  priceBasisUnit: string,
  targetUnit: string,
  conversionToBase?: number | null,
  priceBasisConversionToBase?: number | null,
): boolean {
  if (!conversionToBase || !priceBasisConversionToBase) return false;
  if (Number(conversionToBase) !== Number(priceBasisConversionToBase)) return false;

  return (
    (priceBasisUnit === 'kg' && GRAM_WORDS.includes(targetUnit)) ||
    (GRAM_WORDS.includes(priceBasisUnit) && targetUnit === 'kg') ||
    (LITRE_WORDS.includes(priceBasisUnit) && ML_WORDS.includes(targetUnit)) ||
    (ML_WORDS.includes(priceBasisUnit) && LITRE_WORDS.includes(targetUnit))
  );
}

/**
 * `baseRate` restated per one `targetUnit`.
 *
 * The conversion factors answer first, since they describe this product's own
 * packs. Failing those -- or failing the sanity check above -- weight units
 * fall back to the fixed KG/gram relation. Anything else is returned as it
 * came in: a rate per piece is already a rate per piece.
 */
export function priceInUnit({
  baseRate,
  priceBasisUnit,
  targetUnit,
  conversionToBase,
  priceBasisConversionToBase,
}: UnitPriceInput): number {
  const rate = Number(baseRate) || 0;
  const basis = normalizeUnit(priceBasisUnit || '');
  const target = normalizeUnit(targetUnit || '');

  if (!target || basis === target) return rate;

  if (
    conversionToBase &&
    priceBasisConversionToBase &&
    !isSuspiciousUnityRatio(basis, target, conversionToBase, priceBasisConversionToBase)
  ) {
    return rate * (Number(conversionToBase) / Number(priceBasisConversionToBase));
  }

  if (!basis) return rate;

  if (KG_WORDS.includes(basis) || GRAM_WORDS.includes(basis)) {
    if (GRAM_WORDS.includes(target)) return rate / 1000;
    if (KG_WORDS.includes(target)) return rate;
  }

  // Piece-based or anything else: the rate already means what it says.
  return rate;
}
