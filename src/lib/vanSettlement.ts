import { supabase } from '@/integrations/supabase/client';

/**
 * Posting a van day to DMS inventory.
 *
 * Loading a van writes van_stock_items and stops there; nothing moved in
 * distributor_inventory until this ran, which is why the On Vans figure sat at
 * zero however many times the sheet was saved.
 *
 * dms_settle_van_day is delta-based: it compares the day against what has
 * already been posted and writes only the difference. That is what makes it
 * safe to call on every save. A call that is missed — a closed tab, a dropped
 * connection — is not permanent damage either, because the next call settles
 * the whole difference at once.
 */

export interface SettlementLine {
  productName: string;
  availableDelta: number;
  onVanDelta: number;
  damagedDelta: number;
  expiredDelta: number;
  applied: boolean;
  reason: string;
}

export type SettlementResult =
  | { ok: true; message?: undefined; applied: SettlementLine[]; refused: SettlementLine[]; unchanged: SettlementLine[] }
  | { ok: false; message: string };

/** Why a line could not be posted, in words a person can act on. */
export function describeRefusal(line: SettlementLine): string {
  const name = line.productName || 'This product';
  switch (line.reason) {
    case 'not_stocked_in_that_warehouse':
      return `${name} is not stocked in this warehouse, so it was not posted to inventory.`;
    case 'no_inventory_row':
      return `${name} has no inventory record for this distributor.`;
    case 'insufficient_stock_in_warehouse':
      return `${name}: the warehouse does not hold enough to cover what was loaded.`;
    case 'unit_mismatch':
      return `${name} is held in a different unit in inventory than on the van.`;
    case 'warehouse_ambiguous':
      return `${name} is held in more than one warehouse. Choose which one this van draws from.`;
    case 'van_has_no_distributor':
      return 'This van is not linked to a distributor, so its stock cannot reach inventory.';
    case 'van_day_not_found':
      return 'This van day no longer exists.';
    default:
      return `${name}: ${line.reason}`;
  }
}

export async function settleVanDay(vanStockId: string): Promise<SettlementResult> {
  const { data, error } = await supabase.rpc('dms_settle_van_day', {
    p_van_stock_id: vanStockId,
    p_dry_run: false,
  });

  if (error) {
    return { ok: false, message: error.message || 'Could not post van stock to inventory' };
  }

  const rows = (data ?? []) as Array<{
    product_name: string | null;
    available_delta: number | string | null;
    on_van_delta: number | string | null;
    damaged_delta: number | string | null;
    expired_delta: number | string | null;
    applied: boolean | null;
    reason: string | null;
  }>;

  const lines: SettlementLine[] = rows.map((r) => ({
    productName: r.product_name ?? '',
    availableDelta: Number(r.available_delta ?? 0),
    onVanDelta: Number(r.on_van_delta ?? 0),
    damagedDelta: Number(r.damaged_delta ?? 0),
    expiredDelta: Number(r.expired_delta ?? 0),
    applied: r.applied === true,
    reason: r.reason ?? '',
  }));

  return {
    ok: true,
    applied: lines.filter((l) => l.applied),
    // 'already_settled' is not a refusal. It means this line was posted by an
    // earlier save and nothing about it has changed since.
    refused: lines.filter((l) => !l.applied && l.reason !== 'already_settled'),
    unchanged: lines.filter((l) => l.reason === 'already_settled'),
  };
}
