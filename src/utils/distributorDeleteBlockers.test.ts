import { describe, it, expect } from 'vitest';
import { describeBlockers, retailerBlocker, type Blocker } from './distributorDeleteBlockers';

/**
 * The real blockers on staging, which is where this started: deleting Sahuayo
 * reported `violates foreign key constraint retailers_distributor_id_fkey on
 * table retailers` while the Overview card said it had 0 retailers.
 */
const b = (
  referencing_table: string,
  row_count: number,
  sample_names: string | null = null,
  via: string | null = null,
): Blocker => ({
  referencing_table,
  referencing_column: 'distributor_id',
  row_count,
  sample_names,
  via,
});

describe('describeBlockers', () => {
  it('says nothing when nothing is in the way', () => {
    expect(describeBlockers([], 'Sri Tirumala Warehouses')).toBeNull();
  });

  it('names the count and points at the fix', () => {
    expect(describeBlockers([b('retailers', 10)], 'Sahuayo')).toBe(
      'Sahuayo still has 10 retailers, so it cannot be deleted.' +
        ' Use Remap on the Distributor Master to move the retailers first.',
    );
  });

  it('uses the singular for one', () => {
    expect(describeBlockers([b('packing_lists', 1)], 'BHARATH BEVERAGES')).toBe(
      'BHARATH BEVERAGES still has 1 packing list, so it cannot be deleted.',
    );
  });

  it('lists several, biggest first, and joins them with an and', () => {
    // VM Distributor, exactly as the database reports it.
    const msg = describeBlockers(
      [
        b('delivery_challans', 1),
        b('primary_invoices', 9),
        b('packing_lists', 2),
        b('goods_receipt_notes', 9),
        b('primary_return_notes', 5),
      ],
      'VM Distributor',
    );
    expect(msg).toBe(
      'VM Distributor still has 9 primary invoices, 9 goods receipt notes, 5 return notes,' +
        ' 2 packing lists and 1 delivery challan, so it cannot be deleted.',
    );
  });

  it('only mentions Remap when retailers are the problem', () => {
    expect(describeBlockers([b('goods_receipt_notes', 4)], 'South Canara')).not.toContain('Remap');
  });

  it('reads properly for a self-reference, which is a child distributor not a row', () => {
    expect(describeBlockers([b('distributors', 3)], 'KVP Business Solutions Pvt. Ltd.')).toBe(
      'KVP Business Solutions Pvt. Ltd. still has 3 distributors under it, so it cannot be deleted.',
    );
  });

  it('names the blocker when the database supplied a name', () => {
    // The case this came from: the child was hidden from the Distributor Master
    // list, so "1 distributor under it" could not be acted on by looking.
    expect(
      describeBlockers(
        [b('distributors', 1, 'South Canara Pickle & Prawn Distributors')],
        'Mangaluru Masala Limited LLC',
      ),
    ).toBe(
      'Mangaluru Masala Limited LLC still has 1 distributor under it' +
        ' (South Canara Pickle & Prawn Distributors), so it cannot be deleted.',
    );
  });

  it('names several when there are only a few', () => {
    expect(
      describeBlockers(
        [b('distributors', 3, 'Mahaveer Super Stockists Pvt Ltd, Mangaluru Masala Limited LLC, VM Distributor')],
        'KVP Business Solutions Pvt. Ltd.',
      ),
    ).toContain('(Mahaveer Super Stockists Pvt Ltd, Mangaluru Masala Limited LLC, VM Distributor)');
  });

  it('does not try to name 224 retailers', () => {
    // The database stops supplying names past three, so the count carries it.
    const msg = describeBlockers([b('retailers', 224)], 'KVP Business Solutions Pvt. Ltd.');
    expect(msg).toContain('224 retailers,');
    expect(msg).not.toContain('(');
  });

  it('says where an obstacle hangs when it is not on the distributor itself', () => {
    // Sri Tirumala Warehouses, which I twice called deletable: nothing points
    // at the distributor, but deleting it cascades into its warehouses, and the
    // inventory under those warehouses is what refuses.
    expect(
      describeBlockers(
        [
          b('distributor_inventory_transactions', 6, null, 'warehouses'),
          b('inventory_batches', 5, null, 'warehouses'),
        ],
        'Sri Tirumala Warehouses',
      ),
    ).toBe(
      'Sri Tirumala Warehouses still has 6 stock movements and 5 batches' +
        ' under its warehouses, so it cannot be deleted.',
    );
  });

  it('keeps what hangs off the distributor separate from what hangs off its warehouses', () => {
    // KVP Business Solutions, the real shape: obstacles at both levels.
    expect(
      describeBlockers(
        [
          b('retailers', 224),
          b('distributor_inventory_transactions', 94, null, 'warehouses'),
          b('packing_lists', 16),
          b('inventory_batches', 72, null, 'warehouses'),
        ],
        'KVP Business Solutions Pvt. Ltd.',
      ),
    ).toBe(
      'KVP Business Solutions Pvt. Ltd. still has 224 retailers and 16 packing lists,' +
        ' plus 94 stock movements and 72 batches under its warehouses,' +
        ' so it cannot be deleted.' +
        ' Use Remap on the Distributor Master to move the retailers first.',
    );
  });

  it('falls back to the table name for a table nobody has labelled yet', () => {
    // A foreign key added later is picked up by the database function without
    // this file knowing about it, so the message has to stay sensible.
    expect(describeBlockers([b('future_widget_links', 2)], 'Sahuayo')).toBe(
      'Sahuayo still has 2 × future widget links, so it cannot be deleted.',
    );
  });
});

describe('retailerBlocker', () => {
  it('finds retailers attached straight to the distributor', () => {
    expect(retailerBlocker([b('retailers', 10)])?.row_count).toBe(10);
  });

  it('ignores retailers reached through something else', () => {
    // Moving this distributor's own retailers would not clear an obstacle that
    // hangs off one of its warehouses, so offering the choice would be a lie.
    expect(retailerBlocker([b('retailers', 4, null, 'warehouses')])).toBeUndefined();
  });

  it('gives nothing when retailers are not in the way at all', () => {
    expect(retailerBlocker([b('goods_receipt_notes', 4)])).toBeUndefined();
    expect(retailerBlocker([])).toBeUndefined();
  });
});
