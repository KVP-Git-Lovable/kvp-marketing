-- Expiry survives the journey from a retailer's counter to the warehouse books.
--
-- A rep records a return in Order Entry and picks a reason: Damaged, Expired,
-- Wrong Product, Quality Issue, Excess Stock, Customer Return, Other. At close
-- of day the goods physically on the van are split between what is sellable
-- and what is not, and van_stock_items had only two buckets for that split:
-- returned_good_qty and returned_damaged_qty. An expired return had nowhere to
-- go, so the rep had to enter it as damaged, and distributor_inventory's
-- expired_quantity column was never written by a van at all. The totals still
-- came out right -- available stock was correct either way -- but the books
-- said breakage where the truth was slow rotation, and those two facts lead to
-- different conversations with different people.
--
-- Three columns, one per place the figure has to survive:
--
--   van_stock_items.returned_expired_qty  what the rep counted as expired
--   van_day_postings.expired_posted       what settlement has already posted,
--                                         so it stays delta-based and settling
--                                         the same day twice writes nothing
--   van_settlement_log.expired_delta      so a refusal that is only about
--                                         expired stock still records a figure
--
-- Every existing row reads 0, which is the truthful value rather than a
-- convenient one: nothing has ever been posted to expired_quantity by a van.
-- So the first settlement of a day that is still open posts the full amount,
-- and a day already closed has a delta of zero and does not move. Nothing is
-- backfilled and no historical figure is rewritten.
--
-- The two quantity columns are NOT NULL DEFAULT 0 rather than nullable like
-- their older siblings. Settlement coalesces either way, but a bucket that
-- cannot be null is one fewer thing to reason about at every read site.
-- van_settlement_log.expired_delta stays nullable to match its own siblings,
-- which are left null on refusals that have no figure to report.

alter table public.van_stock_items
  add column if not exists returned_expired_qty numeric not null default 0;

alter table public.van_day_postings
  add column if not exists expired_posted numeric not null default 0;

alter table public.van_settlement_log
  add column if not exists expired_delta numeric;

comment on column public.van_stock_items.returned_expired_qty is
  'Of the goods physically on the van at close, how much is past its expiry date. Counted by the rep, pre-filled from the day''s credit note reasons. Settles to distributor_inventory.expired_quantity.';

comment on column public.van_day_postings.expired_posted is
  'What dms_settle_van_day has already posted to distributor_inventory.expired_quantity for this van day and product. The difference between this and the day''s current figure is what the next settle writes.';
