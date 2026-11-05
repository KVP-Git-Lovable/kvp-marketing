import { getDisplayValues } from '@/utils/unitDisplayUtils';

export type InventoryTransactionDisplayInput = {
  transaction_type?: string | null;
  reference_type?: string | null;
  batch_number?: string | null;
};

export const inventoryTransactionTypeLabels: Record<string, string> = {
  GRN: 'GRN',
  GRN_INWARD: 'GRN Inward',
  OPENING_STOCK: 'Opening Stock',
  RESERVE: 'Reserve Stock',
  RELEASE: 'Release Stock',
  MARK_DAMAGED: 'Mark Damaged',
  MARK_EXPIRED: 'Mark Expired',
  DISPATCH: 'Dispatch',
  OUTWARD: 'Outward',
  ADJUSTMENT: 'Adjustment',
  VAN_LOADOUT: 'Van Loadout',
  VAN_SETTLE: 'Van Day Settled',
  inward: 'Inward',
  LEGACY_ENTRY: 'Legacy Entry',
};

export const inventoryMovementTargets: Record<string, { label: string; color: string }> = {
  GRN: { label: 'Available', color: 'bg-green-500' },
  GRN_INWARD: { label: 'Available', color: 'bg-green-500' },
  OPENING_STOCK: { label: 'Available', color: 'bg-green-500' },
  RESERVE: { label: 'Reserved', color: 'bg-amber-500' },
  RELEASE: { label: 'Available', color: 'bg-green-500' },
  MARK_DAMAGED: { label: 'Damaged', color: 'bg-red-500' },
  MARK_EXPIRED: { label: 'Expired', color: 'bg-slate-400' },
  DISPATCH: { label: 'Dispatched', color: 'bg-purple-500' },
  OUTWARD: { label: 'Outward', color: 'bg-purple-500' },
  ADJUSTMENT: { label: 'Adjusted', color: 'bg-yellow-500' },
  VAN_LOADOUT: { label: 'On Vans', color: 'bg-blue-500' },
  // A settle can move stock in either direction -- returns come back, a
  // variance is written off -- so it is not labelled as one or the other.
  VAN_SETTLE: { label: 'Van Reconciled', color: 'bg-blue-500' },
  inward: { label: 'Available', color: 'bg-green-500' },
  LEGACY_ENTRY: { label: 'Inventory', color: 'bg-slate-400' },
};

/**
 * Transaction types whose ledger row records a warehouse delta that can be
 * zero while stock still moved -- on the van, not in the building.
 */
const VAN_MOVEMENT_TYPES = ['VAN_LOADOUT', 'VAN_SETTLE'];

export type InventoryQtyTone = 'in' | 'out' | 'flat' | 'unknown';

/** Colour per direction. A flat or unknown amount is not news, so it stays quiet. */
export const QTY_TONE_CLASS: Record<InventoryQtyTone, string> = {
  in: 'text-green-600',
  out: 'text-red-600',
  flat: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
};

export interface InventoryQtyDisplay {
  /** The amount with its sign and unit, e.g. "-2.002 KG". */
  text: string;
  tone: InventoryQtyTone;
}

/**
 * Render a ledger quantity from the value itself.
 *
 * `balance_qty` is a signed warehouse delta for every transaction type that
 * has rows: DISPATCH, RESERVE and MARK_EXPIRED are stored negative,
 * RECONCILIATION and MARK_DAMAGED carry both signs. Deriving the sign from
 * the transaction type instead of the number therefore got the direction
 * wrong in both directions at once -- a VAN_LOADOUT of +2002 printed as
 * "-2.002 KG" (stock returning to the warehouse, shown as leaving it), while
 * a stored -2000 printed as "--2 KG" and a RECONCILIATION of -33000 as
 * "+-33 KG".
 *
 * Zero prints bare. A warehouse delta of zero is a real reading, not a
 * direction, and "+0"/"-0" invited the question of which way nothing went.
 */
export const formatInventoryQuantity = (
  quantity: number | null | undefined,
  unit?: string | null,
): InventoryQtyDisplay => {
  const raw = Number(quantity);
  if (quantity === null || quantity === undefined || Number.isNaN(raw)) {
    return { text: '—', tone: 'unknown' };
  }

  const { displayQty, displayUnit } = getDisplayValues(raw, 1, 1, unit || '');
  const value = Number(displayQty);
  const suffix = displayUnit ? ` ${displayUnit}` : '';

  if (value === 0) return { text: `0${suffix}`, tone: 'flat' };

  const sign = value > 0 ? '+' : '-';
  return {
    text: `${sign}${Math.abs(value).toLocaleString('en-IN')}${suffix}`,
    tone: value > 0 ? 'in' : 'out',
  };
};

export const resolveInventoryTransactionType = (txn: InventoryTransactionDisplayInput) => {
  const explicitType = txn.transaction_type || txn.reference_type || null;
  if (explicitType) return explicitType;

  if (txn.batch_number) {
    return 'OPENING_STOCK';
  }

  return 'LEGACY_ENTRY';
};

export const getInventoryTransactionTypeLabel = (type?: string | null) => {
  if (!type) return inventoryTransactionTypeLabels.LEGACY_ENTRY;
  return inventoryTransactionTypeLabels[type] || type.replace(/_/g, ' ');
};

export const getInventoryMovementTarget = (type?: string | null, quantity?: number | null) => {
  // Settlement posts only the difference it still owes, so a van day whose
  // warehouse side was already settled but whose van side changed writes a
  // row with a zero warehouse delta and a real on-van delta. The stock did
  // move; it moved on the van. Saying "On Vans" next to a bare 0 read as a
  // broken number, so the label carries the fact the quantity cannot.
  //
  // The on-van amount itself is not shown: this row does not carry it as a
  // number, and the notes text it does appear in is prose, not data.
  if (
    !!type
    && VAN_MOVEMENT_TYPES.includes(type)
    && quantity !== null
    && quantity !== undefined
    && Number(quantity) === 0
  ) {
    return { label: 'Van side only', color: 'bg-blue-400' };
  }

  if (!type) return inventoryMovementTargets.LEGACY_ENTRY;
  return inventoryMovementTargets[type] || inventoryMovementTargets.LEGACY_ENTRY;
};
