-- Phase 1 of wiring van stock into the DMS: the columns the rest depends on.
-- Nothing posts yet. This migration only makes the facts recordable.
--
-- WHY distributor_id IS SNAPSHOTTED, NOT JOINED.
-- A van can be reassigned between distributors. If settling resolved the
-- distributor through vans.distributor_id at posting time, reassigning a van
-- would silently re-attribute every historical day to the new owner. The day
-- carries the distributor it belonged to when it was opened.
alter table public.van_stock
  add column if not exists distributor_id uuid references public.distributors(id);

comment on column public.van_stock.distributor_id is
  'The distributor whose books this van-day posts to, snapshotted from vans.distributor_id when the day was opened. Never re-derived, so reassigning a van does not rewrite history.';

-- Deliberately NOT NULL-able yet: the only van in this database has no
-- distributor, so enforcing it would reject the existing rows. Settling
-- refuses to post a day with no distributor instead, which fails loudly in one
-- place rather than blocking the day the rep is trying to record.
create or replace function public.van_stock_capture_distributor()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  IF NEW.distributor_id IS NULL THEN
    SELECT v.distributor_id INTO NEW.distributor_id
    FROM public.vans v WHERE v.id = NEW.van_id;
  END IF;
  RETURN NEW;
END;
$function$;

drop trigger if exists trg_van_stock_capture_distributor on public.van_stock;
create trigger trg_van_stock_capture_distributor
  before insert on public.van_stock
  for each row execute function public.van_stock_capture_distributor();

update public.van_stock vs
set distributor_id = v.distributor_id
from public.vans v
where v.id = vs.van_id and vs.distributor_id is null and v.distributor_id is not null;


-- The return split. returned_qty stays the total and remains the figure the
-- existing left_qty arithmetic uses, so nothing in the app changes meaning.
-- The two new columns say how that total divides, because good stock goes back
-- to the godown and damaged stock does not.
alter table public.van_stock_items
  add column if not exists returned_good_qty numeric,
  add column if not exists returned_damaged_qty numeric;

comment on column public.van_stock_items.returned_good_qty is
  'Part of returned_qty that came back saleable. Null means not yet split; treat the whole of returned_qty as good.';
comment on column public.van_stock_items.returned_damaged_qty is
  'Part of returned_qty that came back damaged. Null means none.';


-- The physical count at close.
--
-- left_qty is DERIVED (start - ordered + returned) and is never typed, so the
-- numbers balance by construction and shrinkage cannot appear. counted_qty is
-- what the rep actually finds on the van. The difference between the two is the
-- variance, and it is the only reason any of this is worth building.
alter table public.van_stock_items
  add column if not exists counted_qty numeric;

comment on column public.van_stock_items.counted_qty is
  'Physically counted quantity at day close. Kept separate from the derived left_qty so the variance between expected and actual stays visible.';

alter table public.van_stock
  add column if not exists variance_reason text;

comment on column public.van_stock.variance_reason is
  'Why the counted stock differs from the expected stock. Required before a day with a non-zero variance can be verified.';


-- The DMS side: one bucket, in the same spirit as reserved/damaged/expired.
--
--   owned = quantity + reserved_quantity + on_van_quantity
--         + damaged_quantity + expired_quantity
--
-- Stock on a van is still the distributor's. Loading it moves it between
-- buckets and must leave the total alone.
alter table public.distributor_inventory
  add column if not exists on_van_quantity numeric not null default 0;

comment on column public.distributor_inventory.on_van_quantity is
  'Stock issued to a van and not yet sold, returned or written off. Owned stock, not sellable from the godown. Maintained only by dms_settle_van_day.';
