// PROPOSED — not yet in the repo. Destination: src/lib/inventoryMovement.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted above the imports, so the spies have to be hoisted with it.
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));

import {
  applyInventoryMovement,
  applyMovements,
  resolveStockLocation,
  type MovementRequest,
} from './inventoryMovement';

/** A thenable stand-in for `.from(...).select(...).eq(...).eq(...)`. */
function inventoryRows(data: unknown, error: unknown = null) {
  const settled = Promise.resolve({ data, error });
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    then: (res: unknown, rej: unknown) =>
      settled.then(res as never, rej as never),
  };
  return chain;
}

const base = (over: Partial<MovementRequest> = {}): MovementRequest => ({
  distributorId: 'd-1',
  productId: 'p-1',
  movement: 'ADJUST_DECREASE',
  baseQuantity: 1000,
  unit: 'GRAM',
  ...over,
});

const ok = (over = {}) => ({
  data: {
    success: true, applied_qty: 1000, new_quantity: 2000,
    unit: 'GRAM', already_applied: false, ...over,
  },
  error: null,
});

beforeEach(() => rpc.mockReset());

describe('a movement that works', () => {
  it('reports the applied quantity and the resulting stock', async () => {
    rpc.mockResolvedValue(ok());
    const r = await applyInventoryMovement(base());
    expect(r).toEqual({
      ok: true, appliedQty: 1000, newQuantity: 2000, unit: 'GRAM', alreadyApplied: false,
    });
  });

  it('sends the converted base quantity, never the typed one', async () => {
    rpc.mockResolvedValue(ok());
    await applyInventoryMovement(base({ baseQuantity: 2000, unit: 'GRAM' }));
    expect(rpc).toHaveBeenCalledWith('apply_inventory_movement',
      expect.objectContaining({ p_quantity: 2000, p_unit: 'GRAM' }));
  });

  it('passes the movement through unchanged, so direction cannot be lost', async () => {
    rpc.mockResolvedValue(ok());
    await applyInventoryMovement(base({ movement: 'RETURN_IN' }));
    expect(rpc).toHaveBeenCalledWith('apply_inventory_movement',
      expect.objectContaining({ p_movement: 'RETURN_IN' }));
  });
});

describe('a movement that fails', () => {
  it('does not report success when the call itself is rejected', async () => {
    // The shape PostgREST actually returned for the dead columns.
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST204', message: "Could not find the 'available_quantity' column" },
    });
    const r = await applyInventoryMovement(base());
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ message: expect.stringContaining('available_quantity') });
  });

  it('does not report success when the function declines the movement', async () => {
    rpc.mockResolvedValue({
      data: { success: false, error: 'Insufficient stock: 500 available, 1000 requested' },
      error: null,
    });
    const r = await applyInventoryMovement(base());
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ message: expect.stringContaining('Insufficient stock') });
  });

  it('treats an empty body as a failure, not a success', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await applyInventoryMovement(base())).ok).toBe(false);
  });

  it('treats a body with no success flag as a failure', async () => {
    rpc.mockResolvedValue({ data: { new_quantity: 5 }, error: null });
    expect((await applyInventoryMovement(base())).ok).toBe(false);
  });

  it('never returns ok when an error is present, whatever the body says', async () => {
    rpc.mockResolvedValue({
      data: { success: true, applied_qty: 10, new_quantity: 10 },
      error: { message: 'boom' },
    });
    expect((await applyInventoryMovement(base())).ok).toBe(false);
  });

  it('refuses a product that is not stocked', async () => {
    rpc.mockResolvedValue({ data: { success: false, error: 'Product not found in inventory' }, error: null });
    const r = await applyInventoryMovement(base());
    expect(r).toMatchObject({ ok: false, message: 'Product not found in inventory' });
  });
});

describe('a set of movements', () => {
  it('passes when every line applies', async () => {
    rpc.mockResolvedValue(ok());
    expect(await applyMovements([base(), base(), base()])).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('stops at the first refusal and names the line', async () => {
    rpc.mockResolvedValueOnce(ok())
       .mockResolvedValueOnce({ data: { success: false, error: 'Insufficient stock' }, error: null });
    const r = await applyMovements([base(), base(), base()]);
    expect(r).toMatchObject({ ok: false, index: 1 });
  });

  it('does not keep going after a refusal', async () => {
    rpc.mockResolvedValueOnce(ok())
       .mockResolvedValueOnce({ data: { success: false, error: 'nope' }, error: null });
    await applyMovements([base(), base(), base()]);
    expect(rpc).toHaveBeenCalledTimes(2); // the third is never attempted
  });
});

describe('repeated submission', () => {
  it('sends the key, so the server can recognise a retry', async () => {
    rpc.mockResolvedValue(ok());
    await applyInventoryMovement(base({ idempotencyKey: 'retailer_return:line-7' }));
    expect(rpc).toHaveBeenCalledWith('apply_inventory_movement',
      expect.objectContaining({ p_idempotency_key: 'retailer_return:line-7' }));
  });

  it('sends null when no key is given, keeping the old behaviour', async () => {
    rpc.mockResolvedValue(ok());
    await applyInventoryMovement(base());
    expect(rpc).toHaveBeenCalledWith('apply_inventory_movement',
      expect.objectContaining({ p_idempotency_key: null }));
  });

  it('reports a replayed movement as success that changed nothing', async () => {
    rpc.mockResolvedValue(ok({ already_applied: true, applied_qty: 0, new_quantity: 4000 }));
    const r = await applyInventoryMovement(base({ idempotencyKey: 'k' }));
    expect(r).toEqual({
      ok: true, appliedQty: 0, newQuantity: 4000, unit: 'GRAM', alreadyApplied: true,
    });
  });

  it('marks a first application as not already applied', async () => {
    rpc.mockResolvedValue(ok());
    const r = await applyInventoryMovement(base({ idempotencyKey: 'k' }));
    expect(r).toMatchObject({ ok: true, alreadyApplied: false, appliedQty: 1000 });
  });

  it('treats a missing already_applied flag as a fresh application', async () => {
    rpc.mockResolvedValue({ data: { success: true, applied_qty: 5, new_quantity: 5 }, error: null });
    const r = await applyInventoryMovement(base({ idempotencyKey: 'k' }));
    expect(r).toMatchObject({ ok: true, alreadyApplied: false });
  });

  it('does not treat a replay as an excuse to skip the error check', async () => {
    rpc.mockResolvedValue({
      data: { success: false, error: 'Insufficient stock', already_applied: true },
      error: null,
    });
    expect((await applyInventoryMovement(base({ idempotencyKey: 'k' }))).ok).toBe(false);
  });
});

describe('choosing the warehouse', () => {
  beforeEach(() => from.mockReset());

  it('returns the one warehouse holding the product', async () => {
    from.mockReturnValue(inventoryRows([{ warehouse_id: 'wh-1', unit: 'GRAM' }]));
    expect(await resolveStockLocation('d-1', 'p-1', 'VAYU 30G'))
      .toEqual({ ok: true, warehouseId: 'wh-1', unit: 'GRAM' });
  });

  it('treats several rows in the same warehouse as one place', async () => {
    from.mockReturnValue(inventoryRows([
      { warehouse_id: 'wh-1', unit: 'GRAM' },
      { warehouse_id: 'wh-1', unit: 'GRAM' },
    ]));
    const r = await resolveStockLocation('d-1', 'p-1', 'VAYU 30G');
    expect(r).toMatchObject({ ok: true, warehouseId: 'wh-1' });
  });

  it('refuses to choose when the product is in two warehouses', async () => {
    from.mockReturnValue(inventoryRows([
      { warehouse_id: 'wh-1', unit: 'GRAM' },
      { warehouse_id: 'wh-2', unit: 'GRAM' },
    ]));
    const r = await resolveStockLocation('d-1', 'p-1', 'VAYU 30G');
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ message: expect.stringContaining('2 warehouses') });
    // and it names the product, so the person knows which line to fix
    expect(r).toMatchObject({ message: expect.stringContaining('VAYU 30G') });
  });

  it('reports no warehouse when nothing is stocked yet, rather than failing', async () => {
    from.mockReturnValue(inventoryRows([]));
    expect(await resolveStockLocation('d-1', 'p-1', 'VAYU 30G'))
      .toEqual({ ok: true, warehouseId: null, unit: null });
  });

  it('ignores rows with no warehouse at all', async () => {
    from.mockReturnValue(inventoryRows([{ warehouse_id: null, unit: 'GRAM' }]));
    const r = await resolveStockLocation('d-1', 'p-1', 'VAYU 30G');
    expect(r).toMatchObject({ ok: true, warehouseId: null });
  });

  it('surfaces a lookup failure instead of guessing', async () => {
    from.mockReturnValue(inventoryRows(null, { message: 'permission denied' }));
    expect(await resolveStockLocation('d-1', 'p-1', 'VAYU 30G'))
      .toEqual({ ok: false, message: 'permission denied' });
  });
});
