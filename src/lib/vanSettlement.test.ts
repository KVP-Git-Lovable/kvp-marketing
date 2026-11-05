import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

import { settleVanDay, describeRefusal, type SettlementLine } from './vanSettlement';

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  product_name: 'ADRAK 40G',
  available_delta: -2000,
  on_van_delta: 2000,
  damaged_delta: 0,
  expired_delta: 0,
  applied: true,
  reason: 'settled_open',
  ...over,
});

beforeEach(() => rpc.mockReset());

describe('posting a van day', () => {
  it('asks the server to post, not to preview', async () => {
    rpc.mockResolvedValue({ data: [row()], error: null });
    await settleVanDay('day-1');
    expect(rpc).toHaveBeenCalledWith('dms_settle_van_day',
      { p_van_stock_id: 'day-1', p_dry_run: false });
  });

  it('separates what posted from what was refused', async () => {
    rpc.mockResolvedValue({
      data: [
        row(),
        row({ product_name: 'ADARAK 250G', applied: false,
              reason: 'not_stocked_in_that_warehouse', available_delta: 0, on_van_delta: 0 }),
      ],
      error: null,
    });
    const r = await settleVanDay('day-1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.applied.map(l => l.productName)).toEqual(['ADRAK 40G']);
    expect(r.refused.map(l => l.productName)).toEqual(['ADARAK 250G']);
  });

  it('does not count an unchanged line as a refusal', async () => {
    // Saving twice with nothing changed is normal, not a problem to report.
    rpc.mockResolvedValue({
      data: [row({ applied: false, reason: 'already_settled', available_delta: 0, on_van_delta: 0 })],
      error: null,
    });
    const r = await settleVanDay('day-1');
    if (!r.ok) return;
    expect(r.refused).toHaveLength(0);
    expect(r.unchanged).toHaveLength(1);
  });

  it('reports a failed call instead of claiming success', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    expect(await settleVanDay('day-1')).toEqual({ ok: false, message: 'permission denied' });
  });

  it('treats an empty response as nothing to post, not a failure', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const r = await settleVanDay('day-1');
    expect(r).toMatchObject({ ok: true, applied: [], refused: [] });
  });

  it('coerces the numbers, which arrive as strings from numeric columns', async () => {
    rpc.mockResolvedValue({
      data: [row({ available_delta: '-2000', on_van_delta: '2000', damaged_delta: '0',
                   expired_delta: '0' })],
      error: null,
    });
    const r = await settleVanDay('day-1');
    if (!r.ok) return;
    expect(r.applied[0]).toMatchObject({ availableDelta: -2000, onVanDelta: 2000 });
  });

  it('carries the expired delta, not just damaged', async () => {
    // A closing day that returns 300 damaged and 100 expired. Reading only
    // damaged_delta is how the expired figure went missing on the client even
    // after the server started reporting it.
    rpc.mockResolvedValue({
      data: [row({ available_delta: '-1000', on_van_delta: '0',
                   damaged_delta: '300', expired_delta: '100',
                   reason: 'settled_closed' })],
      error: null,
    });
    const r = await settleVanDay('day-1');
    if (!r.ok) return;
    expect(r.applied[0]).toMatchObject({ damagedDelta: 300, expiredDelta: 100 });
  });

  it('defaults a missing expired delta to zero rather than NaN', async () => {
    // An older deployment, or a cached response, may not carry the column.
    const { expired_delta: _omitted, ...withoutExpired } = row();
    rpc.mockResolvedValue({ data: [withoutExpired], error: null });
    const r = await settleVanDay('day-1');
    if (!r.ok) return;
    expect(r.applied[0].expiredDelta).toBe(0);
  });
});

describe('explaining a refusal', () => {
  const line = (reason: string, name = 'ADRAK 40G'): SettlementLine => ({
    productName: name, availableDelta: 0, onVanDelta: 0, damagedDelta: 0,
    expiredDelta: 0, applied: false, reason,
  });

  it('names the product and the problem', () => {
    expect(describeRefusal(line('not_stocked_in_that_warehouse')))
      .toContain('ADRAK 40G');
    expect(describeRefusal(line('insufficient_stock_in_warehouse')))
      .toContain('does not hold enough');
  });

  it('says what to do about an ambiguous warehouse', () => {
    expect(describeRefusal(line('warehouse_ambiguous'))).toContain('Choose which one');
  });

  it('does not pretend to know an unfamiliar reason', () => {
    expect(describeRefusal(line('something_new'))).toContain('something_new');
  });

  it('copes with a line that has no product name', () => {
    expect(describeRefusal(line('van_has_no_distributor', ''))).toContain('not linked to a distributor');
  });
});
