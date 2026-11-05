-- Applied to staging on 2026-10-16 as migration 20261016065750 and never
-- committed. This file is the exact SQL that ran, recovered from
-- supabase_migrations.schema_migrations so the repository matches the database.
--
-- Correct a merge I converted the wrong way.
--
-- The stock of VAYU 30G was moved off a deactivated duplicate onto the active
-- product. The two products are configured differently: the duplicate was
-- Quantity (base PIECE), the active one is Weight (base GRAM), like every other
-- weight product in the catalogue. The move converted toward PIECE, which was
-- right for where the stock came from and wrong for where it landed — leaving
-- four rows in a unit the destination product is not mapped to, which is the
-- exact fault the whole exercise was correcting.
--
-- 30 g per piece, from products.net_weight_g on both records.
--
--   KVP Business Solutions Pvt. Ltd.   33,000 PIECE  ->  990,000 GRAM
--   Sri Tirumala Warehouses            10,000 PIECE  ->  300,000 GRAM
--   Mahaveer Super Stockists              100 PIECE  ->    3,000 GRAM
--   South Canara Pickle & Prawn             6 PIECE  ->      180 GRAM
--
-- The first two return to exactly the figures they held before the move: only
-- their unit label was ever wrong. The other two are a real conversion from
-- packets to grams.
--
-- Batches go first, while the aggregate still reads PIECE — that condition is
-- what identifies the affected rows, and it is also what makes this safe to run
-- twice: once the aggregates are GRAM, neither statement matches anything. On a
-- database where the merge never happened it matches nothing at all.

update public.inventory_batches b
   set quantity      = b.quantity * 30,
       available_qty = coalesce(b.available_qty, 0) * 30,
       reserved_qty  = coalesce(b.reserved_qty, 0) * 30
 where b.product_id = '3edadb83-fea6-4650-b110-2a99ee407661'
   and exists (
     select 1 from public.distributor_inventory di
      where di.product_id = b.product_id
        and di.distributor_id = b.distributor_id
        and di.warehouse_id = b.warehouse_id
        and upper(trim(di.unit)) = 'PIECE'
   );

insert into public.distributor_inventory_transactions
  (distributor_id, product_id, variant_id, product_name, warehouse_id,
   transaction_type, reference_type, reference_number, unit, balance_qty, notes, created_at)
select di.distributor_id, di.product_id, di.variant_id, 'VAYU 30G', di.warehouse_id,
       'UOM_CORRECTION', 'adjustment', 'vayu30g-merge-direction-2026-10-16',
       'GRAM', di.quantity * 30,
       format('merge converted the wrong way: %s PIECE restated as %s GRAM at 30 g each, '
              || 'the active product being weight-configured (base GRAM) unlike the duplicate it came from',
              di.quantity, di.quantity * 30),
       now()
  from public.distributor_inventory di
 where di.product_id = '3edadb83-fea6-4650-b110-2a99ee407661'
   and upper(trim(di.unit)) = 'PIECE';

update public.distributor_inventory
   set quantity          = quantity * 30,
       reserved_quantity = coalesce(reserved_quantity, 0) * 30,
       damaged_quantity  = coalesce(damaged_quantity, 0) * 30,
       expired_quantity  = coalesce(expired_quantity, 0) * 30,
       on_van_quantity   = coalesce(on_van_quantity, 0) * 30,
       unit = 'GRAM',
       updated_at = now()
 where product_id = '3edadb83-fea6-4650-b110-2a99ee407661'
   and upper(trim(unit)) = 'PIECE';
