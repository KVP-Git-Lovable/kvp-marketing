import { describe, it, expect } from 'vitest';
import { isOwnedReturn, ownedReturns } from './returnAttribution';

/**
 * These guard a privacy boundary, not a calculation. The panel this serves
 * showed one distributor the credit notes of another -- retailer names, note
 * numbers and quantities -- because it filtered on product alone. The read
 * policy on credit_notes and credit_note_items is `USING (true)`, so there is
 * nothing underneath to catch a mistake here.
 *
 * Every case therefore asks the same question: can an unattributable row ever
 * be shown? The answer has to stay no.
 */

const MINE = 'd-mine';
const THEIRS = 'd-theirs';

const ownedRetailers = new Set(['r-mine-1', 'r-mine-2']);
const ownedOrders = new Set(['o-mine-1']);

const note = (retailer_id: string | null, original_order_id: string | null = null) => ({
  retailer_id,
  original_order_id,
});

describe('isOwnedReturn', () => {
  it('accepts a return against our retailer', () => {
    expect(isOwnedReturn(note('r-mine-1'), ownedRetailers, ownedOrders)).toBe(true);
  });

  it('accepts a return against our order even when the retailer is not ours', () => {
    expect(isOwnedReturn(note('r-theirs', 'o-mine-1'), ownedRetailers, ownedOrders)).toBe(true);
  });

  it('rejects a return against another distributor’s retailer', () => {
    expect(isOwnedReturn(note('r-theirs'), ownedRetailers, ownedOrders)).toBe(false);
  });

  describe('withholds anything it cannot attribute', () => {
    // The six credit notes that prompted this all landed here: field-sales
    // orders with a null distributor, against retailers with no distributor
    // set and no row in distributor_retailer_mappings.
    it.each([
      ['both links null', note(null, null)],
      ['retailer null, order not ours', note(null, 'o-theirs')],
      ['order null, retailer not ours', note('r-theirs', null)],
      ['both undefined', { retailer_id: undefined, original_order_id: undefined }],
    ])('%s', (_label, keys) => {
      expect(isOwnedReturn(keys, ownedRetailers, ownedOrders)).toBe(false);
    });
  });

  it('shows nothing when this distributor owns nothing', () => {
    const empty = new Set<string>();
    expect(isOwnedReturn(note('r-mine-1', 'o-mine-1'), empty, empty)).toBe(false);
  });

  it('does not treat an empty string as an id', () => {
    // An empty set member would otherwise make every blank row match.
    const withBlank = new Set(['']);
    expect(isOwnedReturn(note(''), withBlank, new Set())).toBe(false);
  });
});

describe('ownedReturns', () => {
  it('keeps only the attributable rows, in order', () => {
    const rows = [
      { id: 1, ...note('r-mine-1') },
      { id: 2, ...note('r-theirs') },
      { id: 3, ...note(null, 'o-mine-1') },
      { id: 4, ...note(null, null) },
      { id: 5, ...note('r-mine-2') },
    ];
    expect(ownedReturns(rows, ownedRetailers, ownedOrders).map(r => r.id)).toEqual([1, 3, 5]);
  });

  it('returns nothing rather than everything when attribution is unavailable', () => {
    // The failure that matters: a lookup that comes back empty must close the
    // panel, never open it.
    const rows = [{ id: 1, ...note('r-mine-1') }, { id: 2, ...note('r-theirs') }];
    expect(ownedReturns(rows, new Set(), new Set())).toEqual([]);
  });

  it('handles an empty list', () => {
    expect(ownedReturns([], ownedRetailers, ownedOrders)).toEqual([]);
  });

  it('never mixes two distributors in one result', () => {
    const theirRetailers = new Set(['r-theirs']);
    const rows = [{ id: 1, ...note('r-mine-1') }, { id: 2, ...note('r-theirs') }];

    expect(ownedReturns(rows, ownedRetailers, ownedOrders).map(r => r.id)).toEqual([1]);
    expect(ownedReturns(rows, theirRetailers, new Set()).map(r => r.id)).toEqual([2]);
    // Named only to make the intent explicit: these two never overlap.
    expect(MINE).not.toBe(THEIRS);
  });
});

describe('a note that records its own distributor', () => {
  /**
   * credit_notes.distributor_id exists from 28 Oct 2026, written at creation
   * from the van, then the order, then the retailer. When it is set it is the
   * answer: a retailer reassigned afterwards must not drag an old credit note
   * into a different portal.
   */
  it('is shown to the distributor it names', () => {
    expect(isOwnedReturn(
      { distributor_id: MINE, retailer_id: null, original_order_id: null },
      new Set(), new Set(), MINE,
    )).toBe(true);
  });

  it('is withheld from everyone else, whatever the links say', () => {
    // The retailer is ours; the note is not. The note wins.
    expect(isOwnedReturn(
      { distributor_id: THEIRS, retailer_id: 'r-mine-1', original_order_id: 'o-mine-1' },
      ownedRetailers, ownedOrders, MINE,
    )).toBe(false);
  });

  it('still falls back to the links while the column is null', () => {
    // Everything raised before the column existed.
    expect(isOwnedReturn(
      { distributor_id: null, retailer_id: 'r-mine-1', original_order_id: null },
      ownedRetailers, ownedOrders, MINE,
    )).toBe(true);
  });

  it('is withheld when the viewer is unknown', () => {
    expect(isOwnedReturn(
      { distributor_id: MINE, retailer_id: null, original_order_id: null },
      new Set(), new Set(), undefined,
    )).toBe(false);
  });

  it('separates two distributors on the same product', () => {
    const rows = [
      { id: 1, distributor_id: MINE, retailer_id: null, original_order_id: null },
      { id: 2, distributor_id: THEIRS, retailer_id: null, original_order_id: null },
    ];
    expect(ownedReturns(rows, new Set(), new Set(), MINE).map(r => r.id)).toEqual([1]);
    expect(ownedReturns(rows, new Set(), new Set(), THEIRS).map(r => r.id)).toEqual([2]);
  });
});
