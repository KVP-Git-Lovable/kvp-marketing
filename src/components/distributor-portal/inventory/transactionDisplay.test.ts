import { describe, expect, it } from 'vitest';
import {
  formatInventoryQuantity,
  getInventoryMovementTarget,
  resolveInventoryTransactionType,
} from './transactionDisplay';

describe('formatInventoryQuantity', () => {
  describe('the direction comes from the value, not the transaction type', () => {
    // These four are the exact rows the ledger was getting wrong, taken from
    // staging. The type is no longer an input at all, which is the point.
    it('shows a positive warehouse delta as incoming', () => {
      // VAN_LOADOUT, +2002 g: stock came back into the warehouse. The old
      // type-based rule printed this as "-2.002 KG".
      expect(formatInventoryQuantity(2002, 'GRAM')).toEqual({
        text: '+2.002 KG',
        tone: 'in',
      });
    });

    it('shows a negative warehouse delta as outgoing, with one minus sign', () => {
      // The old rule prefixed '-' to an already-negative number: "--2 KG".
      expect(formatInventoryQuantity(-2000, 'GRAM')).toEqual({
        text: '-2 KG',
        tone: 'out',
      });
    });

    it('does not print a sign on a zero warehouse delta', () => {
      // Was "-0 KG" for VAN_LOADOUT and "+0 KG" for VAN_SETTLE: the same
      // reading shown two contradictory ways.
      expect(formatInventoryQuantity(0, 'GRAM')).toEqual({
        text: '0 KG',
        tone: 'flat',
      });
    });

    it('shows a negative RECONCILIATION without a plus in front of the minus', () => {
      // RECONCILIATION is absent from the old negative-type list, so every
      // negative row printed as "+-33 KG".
      expect(formatInventoryQuantity(-33000, 'GRAM')).toEqual({
        text: '-33 KG',
        tone: 'out',
      });
    });
  });

  describe('units', () => {
    it('converts grams to kilograms', () => {
      expect(formatInventoryQuantity(1500, 'GRAM').text).toBe('+1.5 KG');
    });

    it('leaves a non-gram unit as it is', () => {
      expect(formatInventoryQuantity(-100, 'piece')).toEqual({
        text: '-100 piece',
        tone: 'out',
      });
    });

    it('omits the unit when none is recorded', () => {
      expect(formatInventoryQuantity(42, null)).toEqual({
        text: '+42',
        tone: 'in',
      });
    });
  });

  describe('missing quantities', () => {
    // Six primary_order rows in staging carry a null balance_qty. Reading
    // .toLocaleString() off that used to throw and take the panel with it.
    it.each([
      ['null', null],
      ['undefined', undefined],
    ])('renders a %s quantity as unknown rather than throwing', (_label, value) => {
      expect(formatInventoryQuantity(value as null | undefined, 'GRAM')).toEqual({
        text: '—',
        tone: 'unknown',
      });
    });

    it('renders an unparseable quantity as unknown', () => {
      expect(formatInventoryQuantity(Number.NaN, 'GRAM')).toEqual({
        text: '—',
        tone: 'unknown',
      });
    });
  });
});

describe('getInventoryMovementTarget', () => {
  it('labels a van movement with no warehouse delta as van-side only', () => {
    expect(getInventoryMovementTarget('VAN_LOADOUT', 0).label).toBe('Van side only');
    expect(getInventoryMovementTarget('VAN_SETTLE', 0).label).toBe('Van side only');
  });

  it('keeps the normal label when the warehouse did move', () => {
    expect(getInventoryMovementTarget('VAN_LOADOUT', -2000).label).toBe('On Vans');
    expect(getInventoryMovementTarget('VAN_SETTLE', 2002).label).toBe('Van Reconciled');
  });

  it('does not relabel non-van types that happen to be zero', () => {
    // A zero here means something else and is not ours to reinterpret.
    expect(getInventoryMovementTarget('RESERVE', 0).label).toBe('Reserved');
    expect(getInventoryMovementTarget('MARK_DAMAGED', 0).label).toBe('Damaged');
  });

  it('keeps the plain label when no quantity is supplied', () => {
    expect(getInventoryMovementTarget('VAN_LOADOUT').label).toBe('On Vans');
  });

  it('falls back for an unknown or absent type', () => {
    expect(getInventoryMovementTarget(null).label).toBe('Inventory');
    expect(getInventoryMovementTarget('SOMETHING_NEW').label).toBe('Inventory');
  });
});

describe('resolveInventoryTransactionType', () => {
  it('prefers the explicit transaction type', () => {
    expect(resolveInventoryTransactionType({ transaction_type: 'VAN_SETTLE', reference_type: 'adjustment' }))
      .toBe('VAN_SETTLE');
  });

  it('falls back to the reference type', () => {
    expect(resolveInventoryTransactionType({ reference_type: 'inward' })).toBe('inward');
  });

  it('treats a batch number with no type as opening stock', () => {
    expect(resolveInventoryTransactionType({ batch_number: 'B001' })).toBe('OPENING_STOCK');
  });

  it('falls back to a legacy entry', () => {
    expect(resolveInventoryTransactionType({})).toBe('LEGACY_ENTRY');
  });
});
