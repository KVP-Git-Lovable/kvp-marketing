-- Milestone basis is order value only.
--
-- A quantity basis was offered alongside it, summing order_items.quantity --
-- but quantities carry a unit, and 106 of 769 orders mix units within a single
-- order (PIECE, KG, GRAM, ML, plus casing variants of each). Summing them
-- produces "3 KG + 2 PIECE + 500 Grams = 505" and compares that to a
-- threshold, which means nothing.
--
-- Doing it properly means converting through the UoM master and its conversion
-- rules, which is a deeper piece of logic that this feature has no business
-- reaching into. Rupees add up correctly, so order value stays and quantity is
-- withdrawn until it can be designed around those rules.
--
-- No rung used it: of 17 activity_tiers rows, 4 are order_value and 13 are the
-- target/visit ladders with a null basis. Tightening the constraint is
-- therefore a no-op on data and makes the rule enforceable rather than relying
-- on the dropdown not offering it.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'activity_tiers_basis_check') then
    alter table public.activity_tiers drop constraint activity_tiers_basis_check;
  end if;

  alter table public.activity_tiers
    add constraint activity_tiers_basis_check
    check (basis is null or basis = 'order_value');
end $$;

comment on column public.activity_tiers.basis is
  'Order milestones only: order_value. A quantity basis is deliberately not supported — quantities carry units that would have to be converted through the UoM master first.';
