// PROPOSED — not yet in the repo. Destination: src/lib/inventoryMovement.ts
//
// Every stock movement in the DMS went out as two client-side writes with their
// results thrown away:
//
//     await supabase.from('distributor_inventory').update({ ... });
//     await supabase.from('distributor_inventory_transactions').insert({ ... });
//
// A Supabase query resolves with { data, error } rather than throwing, so a
// rejected write never reached the surrounding catch. Three screens therefore
// reported success, marked return lines as added to stock and moved nothing.
//
// One call, one transaction, one result that has to be read.

import { supabase } from '@/integrations/supabase/client';

export type Movement =
  | 'ADJUST_INCREASE'
  | 'ADJUST_DECREASE'
  | 'RETURN_IN'
  | 'RETURN_OUT';

export interface MovementRequest {
  distributorId: string;
  productId: string;
  movement: Movement;
  /** Already converted into the product's base unit by the caller. */
  baseQuantity: number;
  /** The base unit code, recorded on the ledger row. */
  unit: string;
  notes?: string;
  createdBy?: string | null;
  warehouseId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  referenceNumber?: string | null;
  /**
   * Identifies the movement, not the attempt. Sending it twice moves stock
   * once, which is what makes a retry after a timeout safe. Omitting it keeps
   * the old behaviour: every call applies.
   */
  idempotencyKey?: string | null;
}

export type MovementResult =
  | {
      ok: true;
      message?: undefined;
      appliedQty: number;
      newQuantity: number;
      unit: string;
      /** True when this key had already been applied, so nothing moved now. */
      alreadyApplied: boolean;
    }
  | { ok: false; message: string };

/**
 * Apply one stock movement.
 *
 * Two things can go wrong and both are checked: the call itself can fail
 * (`error`), and the function can decline the movement (`success: false`) —
 * for insufficient stock, an unknown product, a warehouse that belongs to
 * someone else. Neither returns ok.
 */
export async function applyInventoryMovement(
  req: MovementRequest,
): Promise<MovementResult> {
  const { data, error } = await supabase.rpc('apply_inventory_movement', {
    p_distributor_id: req.distributorId,
    p_product_id: req.productId,
    p_movement: req.movement,
    p_quantity: req.baseQuantity,
    p_unit: req.unit,
    p_notes: req.notes ?? null,
    p_created_by: req.createdBy ?? null,
    p_warehouse_id: req.warehouseId ?? null,
    p_reference_type: req.referenceType ?? null,
    p_reference_id: req.referenceId ?? null,
    p_reference_number: req.referenceNumber ?? null,
    p_idempotency_key: req.idempotencyKey ?? null,
  });

  if (error) {
    return { ok: false, message: error.message || 'Stock movement failed' };
  }

  // A null body is not a success. Treating it as one is how the old code
  // arrived at "saved" without a write.
  const result = data as
    | {
        success?: boolean;
        error?: string;
        applied_qty?: number;
        new_quantity?: number;
        unit?: string;
        already_applied?: boolean;
      }
    | null;

  if (!result || result.success !== true) {
    return { ok: false, message: result?.error || 'Stock movement failed' };
  }

  return {
    ok: true,
    appliedQty: Number(result.applied_qty ?? 0),
    newQuantity: Number(result.new_quantity ?? 0),
    unit: result.unit || req.unit,
    alreadyApplied: result.already_applied === true,
  };
}

export type StockLocation =
  | { ok: true; message?: undefined; warehouseId: string | null; unit: string | null }
  | { ok: false; message: string };

/**
 * Which warehouse a movement for this product should apply to.
 *
 * The returns screens used to look the row up with `.maybeSingle()`, which
 * throws the moment a distributor holds one product in two warehouses — and
 * before that, the server quietly fell back to the default warehouse, so a
 * movement could land on the wrong stock or miss it entirely and report
 * "product not found" for stock plainly on the books.
 *
 * One row is an answer. Two is a question for the person, not a guess.
 * Returning a null warehouseId means "nothing stocked yet" and lets the server
 * decide, which it will only do when the distributor has exactly one warehouse.
 */
export async function resolveStockLocation(
  distributorId: string,
  productId: string,
  productName: string,
): Promise<StockLocation> {
  const { data, error } = await supabase
    .from('distributor_inventory')
    .select('warehouse_id, unit')
    .eq('distributor_id', distributorId)
    .eq('product_id', productId);

  if (error) return { ok: false, message: error.message };

  const rows = data ?? [];
  if (rows.length === 0) return { ok: true, warehouseId: null, unit: null };

  const warehouses = [...new Set(rows.map((r) => r.warehouse_id).filter(Boolean))];
  if (warehouses.length > 1) {
    return {
      ok: false,
      message:
        `${productName} is held in ${warehouses.length} warehouses. ` +
        `Choose which one this movement applies to before continuing.`,
    };
  }

  return {
    ok: true,
    warehouseId: (warehouses[0] as string | undefined) ?? null,
    unit: rows[0].unit ?? null,
  };
}

/**
 * Apply a set of movements, stopping at the first refusal.
 *
 * Returns the index that failed so the caller can say which line it was. Note
 * what this does NOT claim: movements already applied stay applied. Each call
 * is atomic on its own; a set of them is not. For a multi-line return the
 * caller should either accept that, or the whole set should move into a single
 * server-side function — see the note in the proposal.
 */
export async function applyMovements(
  reqs: MovementRequest[],
): Promise<{ ok: true; message?: undefined } | { ok: false; index: number; message: string }> {
  for (let i = 0; i < reqs.length; i++) {
    const r = await applyInventoryMovement(reqs[i]);
    if (!r.ok) return { ok: false, index: i, message: r.message };
  }
  return { ok: true };
}
