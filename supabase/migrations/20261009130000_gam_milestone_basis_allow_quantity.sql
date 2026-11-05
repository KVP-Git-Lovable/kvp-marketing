-- Allow a milestone to be judged on the quantity the order was taken for.
--
-- gam_milestone_met already reads order_quantity, and
-- gam_retailer_purchase_events already returns it as the SUM of the event's
-- line quantities. The only thing stopping a quantity ladder was this check,
-- which I added when I withdrew the option.
--
-- WHAT THE NUMBER MEANS. It is the plain sum of order_items.quantity for the
-- purchase event, in whatever units the lines were entered. It is NOT
-- normalised through the UoM master, and deliberately so -- the master is not
-- the place this is decided, and 1,056 of 1,439 live lines (73.4%) carry no
-- conversion_to_base to normalise with.
--
-- So the figure is exactly "how many units were ordered", which is what a rep
-- and an admin both mean by quantity. Where an event mixes units -- 81 of 386
-- events (21%) mix base-unit categories -- it adds 1 KG to 1 PIECE and gets 2.
-- That is a rough measure, not a wrong one, and it is the measure the admin
-- chose; the award panel shows the per-unit breakdown so nobody has to guess
-- what was summed.
--
-- Order value remains the default and is unaffected.
alter table public.activity_tiers drop constraint if exists activity_tiers_basis_check;

alter table public.activity_tiers add constraint activity_tiers_basis_check
  check (basis is null or basis in ('order_value', 'order_quantity'));
