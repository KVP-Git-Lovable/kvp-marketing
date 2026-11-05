-- The opening stock run of 28 Oct 2026 was entered in kilograms.
--
-- Twelve BHARATH BEVERAGES products took "50" from the bulk-apply field. The
-- dialog resolved that against each product's base unit, so for these twelve --
-- all based in GRAM -- it stored 50 grams. The intent was 50 kilograms. The
-- previous migration corrected the unit label; this corrects the number it
-- labels.
--
-- 50 kg is 50,000 g by definition, not by configuration, so the factor is a
-- literal 1000 rather than a lookup: a product whose KG mapping said anything
-- else would be wrong about grams, not about this stock.
--
-- Three things carry the figure and all three move together, because leaving
-- any one behind is how the batch-vs-stock gaps in
-- docs/inventory-batch-unit-audit.md were made:
--
--   distributor_inventory.quantity          50 -> 50000
--   inventory_batches.quantity/available    50 -> 50000
--   a UOM_CORRECTION ledger row             +49950, so the running balance
--                                           arrives at 50000 honestly
--
-- The ledger row is an addition, not an edit. The original OPENING_STOCK entry
-- still says 50: it records what was actually entered, and the correction sits
-- after it saying what it should have been. calc_transaction_balance derives
-- the delta for a UOM_CORRECTION by reading the old figure out of the note, so
-- the note's shape is load-bearing and matches the rows the 16 Oct migration
-- left behind.
--
-- Scope is deliberately narrow: only rows still untouched since that run. If
-- any of this stock has since been reserved, damaged, expired, loaded onto a
-- van or settled, the correction stops rather than multiply a figure other
-- records have already been derived from.

DO $$
DECLARE
  v_expected CONSTANT integer := 12;
  v_factor   CONSTANT integer := 1000;
  v_found integer;
  v_inv integer;
  v_batches integer;
  v_ledger integer;
BEGIN
  CREATE TEMP TABLE _kg_fix ON COMMIT DROP AS
  SELECT di.id AS inventory_id,
         di.distributor_id,
         di.product_id,
         di.warehouse_id,
         di.product_name,
         di.unit,
         di.quantity AS old_qty,
         di.quantity * v_factor AS new_qty
  FROM public.distributor_inventory di
  JOIN public.distributors d ON d.id = di.distributor_id
  WHERE d.name = 'BHARATH BEVERAGES'
    AND di.created_at::date = DATE '2026-10-28'
    AND public.normalise_unit(di.unit) = 'gram'
    AND di.quantity = 50
    AND COALESCE(di.reserved_quantity, 0) = 0
    AND COALESCE(di.damaged_quantity, 0) = 0
    AND COALESCE(di.expired_quantity, 0) = 0
    AND COALESCE(di.on_van_quantity, 0) = 0
    -- Still exactly as that run left it: one ledger entry, nothing since.
    AND (SELECT count(*) FROM public.distributor_inventory_transactions t
          WHERE t.distributor_id = di.distributor_id
            AND t.product_id = di.product_id) = 1;

  SELECT count(*) INTO v_found FROM _kg_fix;

  IF v_found = 0 THEN
    RAISE NOTICE 'Nothing to correct: already applied, or the stock has moved since.';
    RETURN;
  END IF;

  IF v_found <> v_expected THEN
    RAISE EXCEPTION
      'Expected exactly % rows to correct, found %. Refusing: this is a stock movement, not a relabel.',
      v_expected, v_found;
  END IF;

  UPDATE public.distributor_inventory di
     SET quantity = f.new_qty,
         updated_at = now()
    FROM _kg_fix f
   WHERE di.id = f.inventory_id;
  GET DIAGNOSTICS v_inv = ROW_COUNT;

  UPDATE public.inventory_batches b
     SET quantity = b.quantity * v_factor,
         available_qty = b.available_qty * v_factor
    FROM _kg_fix f
   WHERE b.distributor_id = f.distributor_id
     AND b.product_id = f.product_id
     AND b.warehouse_id = f.warehouse_id
     AND b.quantity = f.old_qty
     AND COALESCE(b.reserved_qty, 0) = 0;
  GET DIAGNOSTICS v_batches = ROW_COUNT;

  INSERT INTO public.distributor_inventory_transactions (
    distributor_id, product_id, product_name, transaction_type,
    balance_qty, unit, notes, warehouse_id, reference_type
  )
  SELECT f.distributor_id, f.product_id, f.product_name, 'UOM_CORRECTION',
         f.new_qty, f.unit,
         format('opening stock entered in KG: %s %s recorded as %s is %s %s',
                f.old_qty, f.unit, f.unit, f.new_qty, f.unit),
         f.warehouse_id, 'adjustment'
  FROM _kg_fix f;
  GET DIAGNOSTICS v_ledger = ROW_COUNT;

  IF v_batches <> v_expected THEN
    RAISE EXCEPTION
      'Corrected % inventory rows but % batch rows. Rolling back rather than leaving batches behind stock.',
      v_inv, v_batches;
  END IF;

  RAISE NOTICE 'Corrected % inventory rows, % batch rows, and wrote % ledger corrections.',
    v_inv, v_batches, v_ledger;
END;
$$;
