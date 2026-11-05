import { describe, it, expect, vi } from 'vitest';

// vanStockSync talks to Supabase at module scope through the shared client, so
// it has to be stubbed before the import. These tests only exercise the pure
// classification, which is the part that silently decides where a retailer's
// return lands in inventory.
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: vi.fn(), auth: {} } }));
vi.mock('@/lib/uomEngine', () => ({
  prefetchAllProductUnits: vi.fn(),
  getCachedProductUnits: vi.fn(),
}));

import { bucketForReason } from './vanStockSync';

describe('which closing bucket a return belongs in', () => {
  it('sends expiry to its own bucket', () => {
    expect(bucketForReason('expired')).toBe('expired');
    // The stored code and the word a person would type do not always agree.
    expect(bucketForReason('expiry')).toBe('expired');
    expect(bucketForReason('Expired')).toBe('expired');
  });

  it('sends damage to damaged', () => {
    expect(bucketForReason('damaged')).toBe('damaged');
    expect(bucketForReason('damage')).toBe('damaged');
  });

  it('treats a quality issue as damaged, not as sellable stock', () => {
    // The goods are physically back but cannot be sold, and
    // finalize_credit_note already dispositions them as scrap. Calling them
    // good here would make the van sheet and the return GRN disagree about
    // the same event.
    expect(bucketForReason('quality_issue')).toBe('damaged');
  });

  it('treats stock that simply did not sell as good', () => {
    expect(bucketForReason('unsold_stock')).toBe('good');
    expect(bucketForReason('other')).toBe('good');
  });

  it('reads a missing reason as good rather than inventing a category', () => {
    // Every credit note line written before credit_note_items had a reason
    // column carries null. Those notes already behave as good today, so
    // reading null as good leaves them exactly as they were instead of
    // quietly reclassifying history.
    expect(bucketForReason(null)).toBe('good');
    expect(bucketForReason(undefined)).toBe('good');
    expect(bucketForReason('')).toBe('good');
  });

  it('does not mistake an unfamiliar reason for an unusable one', () => {
    // A code nobody has seen before should leave the stock sellable: the rep
    // can still move it to damaged by hand, whereas stock wrongly written off
    // needs someone to notice first.
    expect(bucketForReason('returned_by_mistake')).toBe('good');
  });
});
