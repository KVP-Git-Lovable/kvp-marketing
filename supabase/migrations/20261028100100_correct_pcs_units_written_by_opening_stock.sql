-- Correct the inventory rows that execute_stock_action stamped 'pcs' on.
--
-- Twelve BHARATH BEVERAGES rows were created by one opening-stock run on
-- 28 Oct 2026. Every one is a product whose configured base is GRAM, and every
-- one carries unit = 'pcs' because the function wrote that literal rather than
-- reading the configuration. normalise_unit('pcs') is 'piece', so
-- dms_settle_van_day would refuse each of them with unit_mismatch.
--
-- This changes the unit only. The stored quantity is untouched: 50 remains 50
-- base units, and whether 50 grams is what was meant is a separate question
-- that only the person who typed it can answer. Converting the number here
-- would turn a labelling mistake into a stock movement.
--
-- The ledger rows those twelve writes produced also carry 'pcs'. They are left
-- alone: they record what happened, settlement does not read them, and
-- rewriting an audit trail to match a later correction is how a trail stops
-- being worth keeping.
--
-- Out of scope, deliberately: one South Canara row from 23 Apr 2026
-- (KADAK PYALI ADARAK 250G, unit 'grams' against a configured PIECE base).
-- It predates this bug, points the other way, and belongs with the batch-unit
-- audit rather than with this fix.

DO $$
DECLARE
  v_expected CONSTANT integer := 12;
  v_found integer;
  v_updated integer;
BEGIN
  WITH target AS (
    SELECT di.id
    FROM public.distributor_inventory di
    JOIN public.products p ON p.id = di.product_id
    LEFT JOIN public.product_uom_mapping m
           ON m.product_id = p.id AND m.is_base AND COALESCE(m.is_active, true)
    LEFT JOIN public.uom_master u ON u.id = m.uom_id
    WHERE di.unit = 'pcs'
      AND di.created_at::date = DATE '2026-10-28'
      AND public.normalise_unit(COALESCE(u.code, p.base_unit)) = 'gram'
  )
  SELECT count(*) INTO v_found FROM target;

  IF v_found = 0 THEN
    RAISE NOTICE 'Nothing to correct: already applied, or the rows have moved on.';
    RETURN;
  END IF;

  -- A wider match than the twelve reviewed rows means the data is not what was
  -- reviewed. Stop rather than relabel stock nobody has looked at.
  IF v_found > v_expected THEN
    RAISE EXCEPTION
      'Expected at most % rows to correct, found %. Refusing to relabel unreviewed stock.',
      v_expected, v_found;
  END IF;

  WITH target AS (
    SELECT di.id, COALESCE(u.code, p.base_unit) AS configured_base
    FROM public.distributor_inventory di
    JOIN public.products p ON p.id = di.product_id
    LEFT JOIN public.product_uom_mapping m
           ON m.product_id = p.id AND m.is_base AND COALESCE(m.is_active, true)
    LEFT JOIN public.uom_master u ON u.id = m.uom_id
    WHERE di.unit = 'pcs'
      AND di.created_at::date = DATE '2026-10-28'
      AND public.normalise_unit(COALESCE(u.code, p.base_unit)) = 'gram'
  )
  UPDATE public.distributor_inventory di
     SET unit = t.configured_base,
         updated_at = now()
    FROM target t
   WHERE di.id = t.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Corrected % inventory rows from pcs to their configured base unit.', v_updated;
END;
$$;
