import { supabase } from '@/integrations/supabase/client';
import {
  prefetchAllProductUnits,
  getCachedProductUnits,
  type ProductUnit,
} from '@/lib/uomEngine';
import {
  totalOrderedInBase,
  vanLineUpdate,
  type OrderLine,
  type Problem,
  type VanLine,
} from '@/lib/vanStockUnits';
import { settleVanDay, describeRefusal } from '@/lib/vanSettlement';

// Van stock items store, for a variant line, the variant's own id in
// product_id — never a composite string. order_items keeps product_id
// (the base product FK) and variant_id as separate columns, so the id
// that matches a variant's van_stock_items row is order_items.variant_id,
// falling back to product_id for a simple (non-variant) line.
//
// What a quantity means is decided by the product's configured units, the same
// way opening stock, goods receipt and the returns decide it. This file used to
// carry its own converter that mapped everything through a hardcoded "grams"
// intermediate — litres counted as kilos, and any packed unit (box, carton,
// dozen) passed through unconverted, so ordering 5 boxes debited the van 5.
// It also carried a fixCorruptedStockUnits() routine to repair the damage that
// converter had done on earlier runs; that routine rewrote van stock on a
// heuristic every time an order was placed, and is gone with the cause.

/** Problems raised by the most recent sync, for the UI to surface. */
export interface VanStockSyncResult {
  ok: boolean;
  updated: number;
  problems: Problem[];
}

/** The three buckets a return can be split into when the van day closes. */
export interface ReturnSplit {
  good: number;
  damaged: number;
  expired: number;
}

/** A credit note line, with the reason it came back. */
type ReturnLine = OrderLine & { reason?: string | null };

/**
 * Which closing bucket a credit note line belongs in.
 *
 * Damage and expiry are the two unusable states inventory tracks separately, so
 * each gets a bucket. A quality issue joins damaged rather than good: the goods
 * are physically back but not sellable, and finalize_credit_note already
 * dispositions them as scrap, so putting them anywhere else would make the van
 * sheet and the return GRN disagree about the same event.
 *
 * Everything else is sellable stock coming back — unsold stock, a customer
 * return, 'other', and the null that every line written before credit_note_items
 * had a reason column carries. Reading null as good is deliberate: it is what
 * those notes already do today, so an older credit note behaves exactly as it
 * did rather than quietly reclassifying itself.
 *
 * Matched on substrings because the stored codes and the words a person would
 * type do not always agree — 'damaged' and 'damage', 'expired' and 'expiry'.
 */
export function bucketForReason(reason: string | null | undefined): keyof ReturnSplit {
  const r = (reason || '').toLowerCase();
  if (r.includes('expir')) return 'expired';
  if (r.includes('damag') || r.includes('quality')) return 'damaged';
  return 'good';
}

/**
 * How the day's returns divide between good, damaged and expired, per product.
 *
 * The Closing GRN uses this to pre-fill its split. The rep said why each line
 * came back when they recorded the return in Order Entry; without this they
 * would be asked for the same three figures again hours later, from memory.
 *
 * Totalled through the same unit resolution the sync itself uses, so a return
 * recorded in kilos against a product held in grams lands as grams here too,
 * and a line whose unit cannot be resolved is reported rather than written at
 * face value. Keys match van_stock_items.product_id, which carries the variant
 * id on a variant line.
 */
export async function returnBreakdownForVanDay(vanStockId: string): Promise<{
  byProduct: Record<string, ReturnSplit>;
  problems: Problem[];
}> {
  const problems: Problem[] = [];
  const byProduct: Record<string, ReturnSplit> = {};

  const { data: day, error: dayError } = await supabase
    .from('van_stock')
    .select('id, stock_date, user_id')
    .eq('id', vanStockId)
    .maybeSingle();

  if (dayError || !day) {
    if (dayError) console.error('Error loading the van day for its returns:', dayError);
    return { byProduct, problems };
  }

  // The same window the sync uses: everything from the day the sheet opened
  // through today, so a day still open picks up what has happened since.
  const from = day.stock_date as string;
  const today = getTodayDateString();
  const to = from > today ? from : today;

  const { data: creditNotes, error: cnError } = await supabase
    .from('credit_notes')
    .select('id')
    .eq('created_by', day.user_id)
    .gte('credit_note_date', from)
    .lte('credit_note_date', to);

  if (cnError) {
    console.error('Error fetching credit notes for the closing split:', cnError);
    return { byProduct, problems };
  }

  const creditNoteIds = (creditNotes || []).map(c => c.id);
  if (creditNoteIds.length === 0) return { byProduct, problems };

  const { data: items, error: ciError } = await supabase
    .from('credit_note_items')
    .select('product_id, variant_id, product_name, quantity, unit, reason')
    .in('credit_note_id', creditNoteIds);

  if (ciError) {
    console.error('Error fetching credit note items for the closing split:', ciError);
    return { byProduct, problems };
  }

  const lines = (items || []) as ReturnLine[];
  if (lines.length === 0) return { byProduct, problems };

  const unitsByProduct = await unitsFor(lines.map(l => l.product_id));

  // One pass per bucket rather than per line: totalOrderedInBase resolves units
  // and keys variants, and every line belongs to exactly one bucket, so no
  // quantity is counted twice and no problem is reported twice.
  for (const bucket of ['good', 'damaged', 'expired'] as const) {
    const subset = lines.filter(l => bucketForReason(l.reason) === bucket);
    if (subset.length === 0) continue;

    const { byKey, problems: bucketProblems } = totalOrderedInBase(subset, unitsByProduct);
    problems.push(...bucketProblems);

    for (const [key, qty] of Object.entries(byKey)) {
      const entry = byProduct[key]
        || (byProduct[key] = { good: 0, damaged: 0, expired: 0 });
      entry[bucket] += qty;
    }
  }

  return { byProduct, problems };
}

async function unitsFor(productIds: string[]): Promise<Record<string, ProductUnit[]>> {
  await prefetchAllProductUnits();
  const map: Record<string, ProductUnit[]> = {};
  for (const id of new Set(productIds)) {
    const units = getCachedProductUnits(id);
    if (units && units.length > 0) map[id] = units;
  }
  return map;
}

export async function syncOrdersToVanStock(
  stockDate: string,
  userId?: string,
): Promise<boolean> {
  const result = await syncOrdersToVanStockDetailed(stockDate, userId);
  return result.ok;
}

/**
 * The same sync, with the problems it hit.
 *
 * A line whose unit cannot be resolved is left alone rather than written at
 * face value, and reported. The sync as a whole still succeeds for the lines
 * that are sound, in the same way a multi-line return does.
 */
export async function syncOrdersToVanStockDetailed(
  stockDate: string,
  userId?: string,
): Promise<VanStockSyncResult> {
  const problems: Problem[] = [];

  try {
    let currentUserId = userId;
    if (!currentUserId) {
      const { data: session } = await supabase.auth.getSession();
      currentUserId = session.session?.user?.id;
    }

    if (!currentUserId) {
      console.log('No user ID available for van stock sync');
      return { ok: false, updated: 0, problems };
    }

    // A van day belongs to a person and a date. Normally that is today's, and
    // everything matches on the date.
    const { data: sameDay, error: stockError } = await supabase
      .from('van_stock')
      .select('id, van_id, stock_date, status, van_stock_items(*)')
      .eq('stock_date', stockDate)
      .eq('user_id', currentUserId);

    if (stockError) {
      console.error('Error fetching van stock:', stockError);
      return { ok: false, updated: 0, problems };
    }

    let vanStocks = sameDay ?? [];

    // Nothing opened today. The goods are still physically on whichever van is
    // open, so a sale or a return made now belongs to that day — a rep who
    // records yesterday's return this morning should not have it vanish. Only a
    // day that has not been closed can take them: once it is sealed its figures
    // are the counted ones and must not move.
    if (vanStocks.length === 0) {
      const { data: openDay, error: openError } = await supabase
        .from('van_stock')
        .select('id, van_id, stock_date, status, van_stock_items(*)')
        .eq('user_id', currentUserId)
        .neq('status', 'closing_verified')
        .lte('stock_date', stockDate)
        .order('stock_date', { ascending: false })
        .limit(1);

      if (openError) {
        console.error('Error fetching the open van day:', openError);
        return { ok: false, updated: 0, problems };
      }
      vanStocks = openDay ?? [];
    }

    if (vanStocks.length === 0) {
      return { ok: true, updated: 0, problems };
    }

    // Everything from the day the sheet opened counts towards it. With a van
    // day opened today this is the same as matching the date exactly; with an
    // older one still open it catches what has happened since, which is the
    // point of falling back to it.
    const fromDate = vanStocks
      .map(v => v.stock_date as string)
      .sort()[0] ?? stockDate;

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('user_id', currentUserId)
      .gte('order_date', fromDate)
      .lte('order_date', stockDate)
      .in('status', ['confirmed', 'pending', 'delivered']);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return { ok: false, updated: 0, problems };
    }

    const orderIds = orders?.map(o => o.id) || [];
    let orderLines: OrderLine[] = [];

    if (orderIds.length > 0) {
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('product_id, variant_id, product_name, quantity, unit')
        .in('order_id', orderIds);

      if (itemsError) {
        console.error('Error fetching order items:', itemsError);
        return { ok: false, updated: 0, problems };
      }
      orderLines = (orderItems || []) as OrderLine[];
    }

    // Goods handed back by retailers during the day. A return recorded in
    // Order Entry writes a credit note; the goods themselves go back onto the
    // van, so the van has to hear about them or the rep ends up entering the
    // same physical event twice — once for the money, once at close — with
    // nothing cross-checking the two.
    //
    // Read from the credit notes rather than added as they happen, for the same
    // reason orders are: recomputing from the source is idempotent, so a repeat
    // or a retry cannot double the quantity.
    let returnLines: OrderLine[] = [];
    const { data: creditNotes, error: cnError } = await supabase
      .from('credit_notes')
      .select('id')
      .eq('created_by', currentUserId)
      .gte('credit_note_date', fromDate)
      .lte('credit_note_date', stockDate);

    if (cnError) {
      console.error('Error fetching credit notes:', cnError);
      return { ok: false, updated: 0, problems };
    }

    const creditNoteIds = (creditNotes || []).map(c => c.id);
    if (creditNoteIds.length > 0) {
      const { data: creditItems, error: ciError } = await supabase
        .from('credit_note_items')
        .select('product_id, variant_id, product_name, quantity, unit')
        .in('credit_note_id', creditNoteIds);

      if (ciError) {
        console.error('Error fetching credit note items:', ciError);
        return { ok: false, updated: 0, problems };
      }
      returnLines = (creditItems || []) as OrderLine[];
    }

    // Every product referenced, from either side.
    const vanLines = vanStocks.flatMap(
      vs => (vs.van_stock_items || []) as unknown as VanLine[],
    );
    const unitsByProduct = await unitsFor([
      ...orderLines.map(l => l.product_id),
      ...returnLines.map(l => l.product_id),
      ...vanLines.map(l => l.product_id),
    ]);

    const { byKey, productIdByKey, problems: orderProblems } =
      totalOrderedInBase(orderLines, unitsByProduct);
    problems.push(...orderProblems);

    // Returns are totalled exactly as orders are — same keying, same unit
    // resolution, same refusal when a line cannot be converted.
    const {
      byKey: returnedByKey,
      productIdByKey: returnProductIdByKey,
      problems: returnProblems,
    } = totalOrderedInBase(returnLines, unitsByProduct);
    problems.push(...returnProblems);

    let totalUpdateCount = 0;

    for (const vanStock of vanStocks) {
      const items = (vanStock.van_stock_items || []) as unknown as VanLine[];

      for (const stockItem of items) {
        const orderedBase = byKey[stockItem.product_id] || 0;
        const returnedBase = returnedByKey[stockItem.product_id] || 0;

        // A variant line carries the variant id; its units live on the product.
        const governingProductId =
          productIdByKey[stockItem.product_id]
          || returnProductIdByKey[stockItem.product_id]
          || stockItem.product_id;

        const next = vanLineUpdate(
          stockItem, orderedBase, unitsByProduct, governingProductId, returnedBase,
        );
        if (!next.ok) {
          problems.push({
            productName: stockItem.product_name || 'This product',
            message: next.message,
          });
          continue;
        }

        if (next.overSold) {
          problems.push({
            productName: stockItem.product_name || 'This product',
            message:
              `${stockItem.product_name}: more was sold than the van was loaded ` +
              `with. Van stock has been held at zero — check the day's figures.`,
          });
        }

        if (!next.changed) continue;

        const { error: updateError } = await supabase
          .from('van_stock_items')
          .update({
            ordered_qty: next.orderedQty,
            returned_qty: next.returnedQty,
            left_qty: next.leftQty,
          })
          .eq('id', stockItem.id);

        if (updateError) {
          console.error('Error updating van stock item:', updateError);
          problems.push({
            productName: stockItem.product_name || 'This product',
            message: updateError.message,
          });
        } else {
          totalUpdateCount++;
        }
      }
    }

    // Selling off a van changes what it holds, so DMS inventory has to hear
    // about it too — otherwise the On Vans figure keeps saying what was loaded
    // this morning rather than what is still on board. Only days that actually
    // changed are posted; settlement is delta-based, so a day whose figures did
    // not move reports 'already_settled' and writes nothing.
    if (totalUpdateCount > 0) {
      for (const vanStock of vanStocks) {
        const settled = await settleVanDay(vanStock.id);
        if (!settled.ok) {
          problems.push({
            productName: 'Van stock',
            message: `Van stock was updated but inventory was not: ${settled.message}`,
          });
        } else {
          for (const line of settled.refused) {
            problems.push({ productName: line.productName, message: describeRefusal(line) });
          }
        }
      }
    }

    window.dispatchEvent(new CustomEvent('vanStockUpdated', {
      detail: { stockDate, updateCount: totalUpdateCount, problems },
    }));

    return { ok: true, updated: totalUpdateCount, problems };
  } catch (error) {
    console.error('Error syncing orders to van stock:', error);
    return { ok: false, updated: 0, problems };
  }
}

/**
 * Recalculate every van stock line for a date.
 */
export async function recalculateVanStock(stockDate: string): Promise<boolean> {
  return await syncOrdersToVanStock(stockDate);
}

/** Today in YYYY-MM-DD. */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}
