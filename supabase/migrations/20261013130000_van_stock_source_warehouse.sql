-- Which warehouse a van loaded from.
--
-- Without this, settling found the inventory row by distributor and product and
-- took LIMIT 1. That is unambiguous only while no product sits in two
-- warehouses -- true today, but one distributor already has two warehouses, so
-- it was a matter of time before stock was deducted from an arbitrary one.
--
-- Snapshotted on the day like distributor_id, for the same reason: a warehouse
-- renamed or a van reassigned later must not move where yesterday's stock came
-- from.
alter table public.van_stock
  add column if not exists warehouse_id uuid references public.warehouses(id);

comment on column public.van_stock.warehouse_id is
  'The warehouse this van loaded from. Settling deducts from this warehouse specifically; when null it falls back to the distributor''s default warehouse.';
