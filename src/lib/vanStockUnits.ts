import { resolveEntryUnit, type UnitsByProduct } from '@/lib/entryUnits';

/**
 * Turning order lines into van stock, in the units each product is configured for.
 *
 * vanStockSync used to carry its own converter. It mapped every quantity through
 * a hardcoded "grams" intermediate:
 *
 *     if (from === 'kg') inGrams = quantity * 1000;
 *     else if (from === 'l') inGrams = quantity * 1000;  // litres treated as kilos
 *     else return quantity;                              // anything else, unconverted
 *
 * so a product sold in cartons, boxes, dozens or any packed unit the admin had
 * configured went through untouched: order 5 boxes of 24 and the van was
 * debited 5. The same file carried a fixCorruptedStockUnits() routine to repair
 * the damage its own converter had done on earlier runs.
 *
 * Here the product's configured units decide, exactly as they do for opening
 * stock, goods receipt and the returns. A line that cannot be converted is
 * refused and reported rather than written at face value.
 */

export interface OrderLine {
  product_id: string;
  variant_id?: string | null;
  product_name?: string | null;
  quantity: number;
  unit: string;
}

export interface VanLine {
  id: string;
  /** Van stock keys variants by the variant's own id, products by product id. */
  product_id: string;
  product_name?: string | null;
  unit: string;
  start_qty: number;
  returned_qty: number;
  ordered_qty: number;
  left_qty: number;
}

export interface Problem {
  productName: string;
  message: string;
}

/**
 * What each van stock key was ordered, expressed in the product's base unit.
 *
 * Lines are keyed by `variant_id || product_id` to match how van stock stores
 * them, but the conversion is resolved against the real product, which is what
 * carries the UOM configuration.
 */
export function totalOrderedInBase(
  lines: OrderLine[],
  unitsByProduct: UnitsByProduct,
): {
  byKey: Record<string, number>;
  /** Van stock key → the product whose UOM configuration governs it. */
  productIdByKey: Record<string, string>;
  problems: Problem[];
} {
  const byKey: Record<string, number> = {};
  const productIdByKey: Record<string, string> = {};
  const problems: Problem[] = [];

  for (const line of lines) {
    const key = line.variant_id || line.product_id;
    const name = line.product_name || 'This product';
    // A variant line is keyed by the variant but configured on the product, so
    // remember the way back: the van line itself only carries the variant id.
    productIdByKey[key] = line.product_id;

    const resolved = resolveEntryUnit(
      { product_id: line.product_id, product_name: name, entryUnit: line.unit },
      unitsByProduct,
    );

    if (!resolved.ok) {
      problems.push({ productName: name, message: resolved.message });
      continue;
    }

    byKey[key] = (byKey[key] || 0) + line.quantity * resolved.factor;
  }

  return { byKey, productIdByKey, problems };
}

export type VanLineUpdate =
  | {
      ok: true;
      /** Always absent on the ok branch; it lets a caller read .message
       *  without narrowing first. */
      message?: undefined;
      orderedQty: number;
      returnedQty: number;
      leftQty: number;
      changed: boolean;
      overSold: boolean;
    }
  | { ok: false; message: string };

/**
 * What a van stock line should hold, given what was ordered against it.
 *
 * `orderedBase` arrives in the product's base unit. Van stock is written in the
 * base unit too, so the usual case is one to one; a line still stored in some
 * other configured unit is converted into it rather than assumed.
 */
export function vanLineUpdate(
  line: VanLine,
  orderedBase: number,
  unitsByProduct: UnitsByProduct,
  /** For a variant line, the product that carries the configuration. */
  governingProductId?: string,
  /**
   * Goods handed back by retailers during the day, in the product's base unit.
   *
   * This is `returned_qty` — stock that came back ONTO the van, which is why it
   * adds to what is still on board. It is not `returned_good_qty` /
   * `returned_damaged_qty`; those are the close-of-day split of what goes back
   * to the warehouse, and the van screen collects them separately.
   *
   * Left undefined, the line keeps whatever it already holds, so a caller that
   * only knows about orders does not wipe the returns.
   */
  returnedBase?: number,
): VanLineUpdate {
  const name = line.product_name || 'This product';
  let orderedQty = orderedBase;

  if (orderedBase !== 0) {
    // Resolved the same way an order line is, spelling included: van stock
    // holds units as they were typed — "Grams", "pcs" — and an exact match
    // would refuse a line that is perfectly correct.
    const stored = resolveEntryUnit(
      {
        product_id: governingProductId || line.product_id,
        product_name: name,
        entryUnit: line.unit,
      },
      unitsByProduct,
    );

    if (!stored.ok) return { ok: false, message: stored.message };

    orderedQty = orderedBase / stored.factor;
  }

  const start = line.start_qty || 0;

  // Returns are converted the same way orders are. A caller that passes
  // nothing leaves the stored figure alone.
  let returnedQty = line.returned_qty || 0;
  if (returnedBase !== undefined) {
    if (returnedBase === 0) {
      returnedQty = 0;
    } else {
      const stored = resolveEntryUnit(
        {
          product_id: governingProductId || line.product_id,
          product_name: name,
          entryUnit: line.unit,
        },
        unitsByProduct,
      );
      if (!stored.ok) return { ok: false, message: stored.message };
      returnedQty = returnedBase / stored.factor;
    }
  }

  const returned = returnedQty;
  const raw = start - orderedQty + returned;

  // Kept clamped, as before: a negative holding is not a thing a van can have.
  // The clamp is reported, because reaching it means more was sold than the van
  // was ever loaded with, and that is worth someone seeing.
  const leftQty = Math.max(0, raw);

  const changed =
    Math.abs((line.ordered_qty || 0) - orderedQty) > 0.001 ||
    Math.abs((line.returned_qty || 0) - returnedQty) > 0.001 ||
    Math.abs((line.left_qty || 0) - leftQty) > 0.001;

  return { ok: true, orderedQty, returnedQty, leftQty, changed, overSold: raw < 0 };
}
