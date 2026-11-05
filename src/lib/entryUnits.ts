import { findUnitIn, type ProductUnit } from '@/lib/uomEngine';

/**
 * Spelling, and only spelling.
 *
 * The engine matches a code exactly, case aside, which is right for a picker
 * because a picker always hands back a configured code. Two of these screens
 * do not have one: Goods Receipt takes the unit from the primary order line,
 * and the returns fall back to a stored value. Those carry the spellings the
 * data actually holds — `grams`, `pcs`, `pieces` — and refusing a line that
 * says `grams` against a product configured `GRAM` would block a receipt that
 * is perfectly correct.
 *
 * So `pcs` and `piece` are reconciled, and nothing else is: grams and pieces
 * are never the same thing, and the moment this table starts bridging
 * categories it becomes the place the whole exercise was meant to remove.
 */
const SPELLINGS: Record<string, string> = {
  PCS: 'PIECE', PC: 'PIECE', PIECES: 'PIECE',
  GRAMS: 'GRAM', GM: 'GRAM', GMS: 'GRAM', G: 'GRAM',
  KGS: 'KG', KILOGRAM: 'KG', KILOGRAMS: 'KG',
  LITRE: 'LITER', LITRES: 'LITER', LITERS: 'LITER', L: 'LITER',
  MILLILITER: 'ML', MILLILITRE: 'ML', MLS: 'ML',
};

const canonical = (code: string): string => {
  const upper = (code || '').trim().toUpperCase();
  return SPELLINGS[upper] ?? upper;
};

/** The product's unit matching `code`, allowing for how it is spelt. */
function findUnitBySpelling(
  units: ProductUnit[],
  code: string,
): ProductUnit | null {
  const exact = findUnitIn(units, code);
  if (exact) return exact;

  const wanted = canonical(code);
  return units.find((u) => canonical(u.code) === wanted) ?? null;
}

/**
 * Whether an opening-stock row can be converted into the product's base unit.
 *
 * Opening stock is a write, and the dialog used to carry its own converter that
 * knew only kg/g and l/ml and compared against `products.unit` — the legacy
 * text field, not the configured base. Anything it did not recognise fell
 * through its last line and was stored exactly as entered: choose "boxes" for a
 * product counted in pieces and ten boxes became ten pieces, with nothing
 * downstream able to tell afterwards.
 *
 * Kept apart from the dialog so the refusal can be tested without rendering it.
 */

export interface EntryToResolve {
  product_id: string;
  product_name: string;
  entryUnit: string;
}

export type UnitsByProduct = Record<string, ProductUnit[]>;

export type Resolution =
  | {
      ok: true;
      message?: undefined;
      /** Multiply an entered quantity by this to reach the base unit. */
      factor: number;
      /** The unit the quantity is stored in. */
      baseUnit: string;
    }
  | { ok: false; message: string };

export function resolveEntryUnit(
  entry: EntryToResolve,
  unitsByProduct: UnitsByProduct,
): Resolution {
  const configured = unitsByProduct[entry.product_id];

  if (!configured || configured.length === 0) {
    return {
      ok: false,
      message:
        `${entry.product_name} has no units configured. ` +
        `Set them in Admin Control → UOM Master before adding opening stock.`,
    };
  }

  if (!entry.entryUnit) {
    return { ok: false, message: `${entry.product_name}: choose a unit first.` };
  }

  const unit = findUnitBySpelling(configured, entry.entryUnit);
  if (!unit) {
    return {
      ok: false,
      message:
        `${entry.product_name}: "${entry.entryUnit}" is not a unit this product is ` +
        `set up for. It takes ${configured.map((u) => u.code).join(' or ')}.`,
    };
  }

  // A factor of zero would make every quantity zero, silently. Treat a
  // misconfigured mapping as unusable rather than as "no stock".
  if (!unit.conversionToBase) {
    return {
      ok: false,
      message:
        `${entry.product_name}: "${unit.code}" has no conversion rate set. ` +
        `Fix it in Admin Control → UOM Master.`,
    };
  }

  const base = configured.find((u) => u.isBase);
  return {
    ok: true,
    factor: unit.conversionToBase,
    baseUnit: base?.code ?? unit.code,
  };
}

/** The first row that cannot be converted, with the reason — or null when the
 *  whole set is safe to write. */
export function firstUnresolvable(
  entries: EntryToResolve[],
  unitsByProduct: UnitsByProduct,
): { entry: EntryToResolve; message: string } | null {
  for (const entry of entries) {
    const r = resolveEntryUnit(entry, unitsByProduct);
    if (!r.ok) return { entry, message: r.message };
  }
  return null;
}

/**
 * Split rows by whether a product can take one unit chosen for all of them.
 *
 * Opening stock is usually entered in bulk across a mixed list: products
 * weighed in grams next to products counted in pieces. One quantity and one
 * unit applied blindly across that list would either be refused on save or,
 * worse, converted by a factor the product does not have. So a bulk unit
 * reaches only the products configured for it, and the caller tells the user
 * which ones kept their own.
 *
 * Spelling is reconciled the same way as everywhere else here, so a stored
 * `pcs` still matches a configured `PIECE`.
 */
export function partitionByUnit<T extends { product_id: string }>(
  rows: T[],
  unitCode: string,
  unitsByProduct: UnitsByProduct,
): { takes: T[]; keepsOwn: T[] } {
  const takes: T[] = [];
  const keepsOwn: T[] = [];

  for (const row of rows) {
    const configured = unitsByProduct[row.product_id];
    const match = configured?.length
      ? findUnitBySpelling(configured, unitCode)
      : null;
    if (match) takes.push(row);
    else keepsOwn.push(row);
  }

  return { takes, keepsOwn };
}
