import { supabase } from '@/integrations/supabase/db';
import { offlineStorage, STORES } from '@/lib/offlineStorage';

/**
 * Phase 3 — price-book driven order pricing.
 *
 * All pricing logic lives in the database (`resolve_prices_for_retailer`).
 * This module only fetches the resolved rows ONCE per retailer, caches them for
 * offline use and does a pure client-side slab lookup per order line.
 */

export interface ResolvedPriceRow {
  product_id: string;
  variant_id: string | null;
  min_quantity: number;
  /** The pack this price is for. NULL = any unit. */
  uom_id?: string | null;
  uom_code?: string | null;
  /** How many base units this pack holds, from product_uom_mapping. */
  conversion_to_base?: number | null;
  price: number;
  currency: string;
  price_book_id: string;
  price_book_name: string;
  matched_on: string;
  score: number;
}

interface CachedRetailerPrices {
  /** offlineStorage keys records by `id` */
  id: string;
  retailer_id: string;
  rows: ResolvedPriceRow[];
  cached_at: string;
}

/** Read the cached rows for a retailer (offline safe, returns null when never synced). */
export async function getCachedRetailerPrices(retailerId: string): Promise<ResolvedPriceRow[] | null> {
  if (!retailerId) return null;
  try {
    const all = await offlineStorage.getAll<CachedRetailerPrices>(STORES.PRICE_BOOK_PRICES);
    const hit = (all || []).find((r) => r.retailer_id === retailerId || r.id === retailerId);
    return hit ? hit.rows || [] : null;
  } catch (e) {
    console.warn('[priceBookCache] read failed', e);
    return null;
  }
}

async function writeCache(retailerId: string, rows: ResolvedPriceRow[]) {
  try {
    await offlineStorage.save(STORES.PRICE_BOOK_PRICES, {
      id: retailerId,
      retailer_id: retailerId,
      rows,
      cached_at: new Date().toISOString(),
    } as CachedRetailerPrices);
  } catch (e) {
    console.warn('[priceBookCache] write failed', e);
  }
}

/**
 * Fetch resolved prices for a retailer and cache them. Never throws — pricing
 * must degrade to the product default rather than block order entry.
 */
export async function fetchAndCacheRetailerPrices(
  retailerId: string,
  userId?: string | null,
): Promise<ResolvedPriceRow[] | null> {
  if (!retailerId) return null;
  try {
    const { data, error } = await supabase.rpc('resolve_prices_for_retailer', {
      p_retailer_id: retailerId,
      p_user_id: userId ?? null,
    } as any);
    if (error) throw error;
    const rows = ((data as any[]) || []).map((r) => ({
      product_id: r.product_id,
      variant_id: r.variant_id ?? null,
      min_quantity: Number(r.min_quantity) || 1,
      uom_id: r.uom_id ?? null,
      uom_code: r.uom_code ?? null,
      conversion_to_base: r.conversion_to_base != null ? Number(r.conversion_to_base) : null,
      price: Number(r.price) || 0,
      currency: r.currency,
      price_book_id: r.price_book_id,
      price_book_name: r.price_book_name,
      matched_on: r.matched_on,
      score: Number(r.score) || 0,
    })) as ResolvedPriceRow[];
    await writeCache(retailerId, rows);
    return rows;
  } catch (e) {
    console.warn('[priceBookCache] resolve_prices_for_retailer failed', e);
    return null;
  }
}

/** Refresh the cached price rows for many retailers (master-data warm-up). */
export async function cacheRetailerPricesBulk(retailerIds: string[], userId?: string | null) {
  const unique = Array.from(new Set((retailerIds || []).filter(Boolean)));
  for (const id of unique) {
    // Sequential on purpose: this runs in the background, not on the order path.
    await fetchAndCacheRetailerPrices(id, userId);
  }
}

export async function clearPriceBookCache() {
  try {
    await offlineStorage.clear(STORES.PRICE_BOOK_PRICES);
  } catch {
    /* noop */
  }
}

/**
 * Slab lookup for one order line.
 * - candidate rows: same product AND (same variant OR product-level row)
 * - only rows whose min_quantity <= quantity
 * - a row for THIS pack beats an any-unit row, then variant-specific beats
 *   product-level, then the highest min_quantity slab wins
 *
 * The pack comes first because it is the most specific thing the book can say.
 * A tray of 24 priced at 400 is not two trays of 12 at 200: once the book names
 * the pack, that price is the answer, and scaling a base price would quietly
 * contradict it.
 */
export function pickPriceRow(
  rows: ResolvedPriceRow[] | null | undefined,
  productId: string,
  variantId: string | null | undefined,
  quantity: number,
  /** The pack the line is being ordered in, when known. */
  uomId?: string | null,
): ResolvedPriceRow | null {
  if (!rows || rows.length === 0 || !productId) return null;
  const qty = Number(quantity) || 0;
  if (qty <= 0) return null;

  const candidates = rows.filter(
    (r) =>
      r.product_id === productId &&
      (r.variant_id == null || r.variant_id === (variantId ?? null)) &&
      // An any-unit row applies to every pack; a pack row only to its own.
      (r.uom_id == null || (!!uomId && r.uom_id === uomId)) &&
      Number(r.min_quantity || 1) <= qty,
  );
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aUom = a.uom_id ? 1 : 0;
    const bUom = b.uom_id ? 1 : 0;
    if (aUom !== bUom) return bUom - aUom;            // this pack's own price first
    const aVariant = a.variant_id ? 1 : 0;
    const bVariant = b.variant_id ? 1 : 0;
    if (aVariant !== bVariant) return bVariant - aVariant; // variant-specific next
    return Number(b.min_quantity || 1) - Number(a.min_quantity || 1); // highest slab
  });
  return candidates[0];
}
