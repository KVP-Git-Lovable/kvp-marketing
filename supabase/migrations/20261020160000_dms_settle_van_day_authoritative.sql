-- The whole of dms_settle_van_day, written out, replacing three earlier
-- attempts that patched it by text replacement. Those were guarded but
-- fragile: they read the live definition, swapped a substring and re-executed
-- the result, which is unreviewable in a pull request and silently dependent on
-- whatever happened to be deployed. This file is the definition.
--
-- It supersedes and replaces:
--   20261020130000_dry_run_reports_insufficient_stock.sql   (never applied)
--   20261020150000_van_settlement_records_balance_qty.sql   (never applied)
--
-- Three changes from the deployed version, each marked CHANGE below.
--
-- CHANGE 1 — damaged stock returned from a van was lost
--
--   v_want_avail := -it.s + v_good;
--
-- Stock loaded onto a van is taken out of the warehouse; good stock coming back
-- is added again. Damaged stock coming back was added to damaged_quantity but
-- never to quantity — so it was subtracted from availability without ever being
-- credited to it. With 2,000 out and 1,500 good + 200 damaged returned, the
-- warehouse physically holds 9,700 of which 200 are unusable, so 9,500 is
-- available; the old arithmetic reported 9,300 and 200 units simply vanished.
--
-- The model everywhere else in this schema is that quantity is the total
-- physically held and damaged_quantity is the unusable subset of it —
-- execute_stock_action's MARK_DAMAGED leaves quantity alone for exactly this
-- reason, and available is derived as
--
--   quantity - reserved_quantity - damaged_quantity - expired_quantity
--
-- so returned damaged goods must be added to quantity as well as to
-- damaged_quantity. Then warehouse-physical plus on-van always reconciles back
-- to what was there before, less what was sold.
--
-- v_want_avail keeps its name because it is what van_day_postings.available_posted
-- stores; it is the warehouse quantity delta, not the derived "available" figure.
--
-- CHANGE 2 — the dry run skipped its own safety check
--
--   IF NOT p_dry_run AND COALESCE(inv.quantity,0) + v_d_avail < 0 THEN
--
-- The one check that decides whether a day can post at all was skipped in the
-- mode whose entire purpose is to find out whether a day can post. Previewing
-- the 2026-10-15 van day returned a contented 'dry_run' for three products a
-- real run would have refused. The branch RETURN NEXT ... CONTINUEs long before
-- any UPDATE, so running it in both modes keeps the dry run read-only.
--
-- CHANGE 3 — settlement movements were recorded only as prose
--
-- The ledger insert left balance_qty NULL, so calc_transaction_balance saw a
-- zero movement and the running balance did not shift for a van loadout. The
-- figures existed only inside the notes string.
--
-- The ledger models ONE stream: a single balance_qty, a single running_balance,
-- and no on-van column of any kind. running_balance has always tracked
-- distributor_inventory.quantity. So balance_qty takes the warehouse delta and
-- nothing else. The on-van leg is not lost — it is already held numerically in
-- distributor_inventory.on_van_quantity and van_day_postings.on_van_posted —
-- and forcing it into balance_qty as well would double-count the movement for
-- every existing reader.
--
-- VAN_LOADOUT and VAN_SETTLE are deliberately absent from the direction lists
-- in calc_transaction_balance. They are bidirectional: negative on a loadout,
-- positive when good stock comes back. The unlisted branch of that trigger
-- trusts the caller's sign, which is the correct classification. Adding them to
-- a fixed-direction list would apply ABS() and make returns subtract.

CREATE OR REPLACE FUNCTION public.dms_settle_van_day(p_van_stock_id uuid, p_dry_run boolean DEFAULT true)
 RETURNS TABLE(product_name text, available_delta numeric, on_van_delta numeric, damaged_delta numeric, applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  vs record; it record; inv record;
  v_closed boolean; v_wh uuid; v_candidates integer;
  v_good numeric; v_damaged numeric; v_onvan numeric;
  v_want_avail numeric; v_want_onvan numeric; v_want_damaged numeric;
  v_d_avail numeric; v_d_onvan numeric; v_d_damaged numeric;
  v_prev record; v_ref text;
BEGIN
  SELECT * INTO vs FROM public.van_stock WHERE id = p_van_stock_id;
  IF NOT FOUND THEN
    product_name := NULL; available_delta := 0; on_van_delta := 0; damaged_delta := 0;
    applied := false; reason := 'van_day_not_found'; RETURN NEXT; RETURN;
  END IF;

  IF vs.distributor_id IS NULL THEN
    product_name := NULL; available_delta := 0; on_van_delta := 0; damaged_delta := 0;
    applied := false; reason := 'van_has_no_distributor'; RETURN NEXT; RETURN;
  END IF;

  v_wh := vs.warehouse_id;
  IF v_wh IS NULL THEN
    SELECT w.id INTO v_wh FROM public.warehouses w
    WHERE w.distributor_id = vs.distributor_id AND w.is_default = true LIMIT 1;
  END IF;

  v_closed := COALESCE(vs.status, '') = 'closing_verified';
  v_ref := 'van:' || p_van_stock_id::text;

  FOR it IN
    SELECT i.*, COALESCE(i.start_qty,0) AS s, COALESCE(i.ordered_qty,0) AS o,
           COALESCE(i.returned_qty,0) AS r, COALESCE(i.left_qty,0) AS l
    FROM public.van_stock_items i
    WHERE i.van_stock_id = p_van_stock_id
  LOOP
    -- No fallback to returned_qty: that column means the opposite direction.
    v_good    := COALESCE(it.returned_good_qty, 0);
    v_damaged := COALESCE(it.returned_damaged_qty, 0);

    -- What is still on the van. After close the counted figure wins; the gap
    -- between it and left_qty is the variance, and sits in no bucket.
    v_onvan   := CASE WHEN v_closed AND it.counted_qty IS NOT NULL
                      THEN it.counted_qty ELSE it.l END;

    -- CHANGE 1: + v_damaged. Goods that come back damaged are physically in the
    -- warehouse again and belong in quantity; damaged_quantity then marks them
    -- unusable. Crediting only v_good subtracted them from availability without
    -- ever adding them to it.
    v_want_avail   := -it.s + v_good + v_damaged;
    v_want_onvan   := v_onvan;
    v_want_damaged := v_damaged;

    SELECT di.* INTO inv
    FROM public.distributor_inventory di
    WHERE di.distributor_id = vs.distributor_id
      AND (di.variant_id::text = it.product_id
           OR (di.variant_id IS NULL AND di.product_id::text = it.product_id))
      AND (v_wh IS NULL OR di.warehouse_id = v_wh)
    ORDER BY (di.variant_id::text = it.product_id) DESC
    LIMIT 1;

    IF NOT FOUND THEN
      product_name := it.product_name; available_delta := 0; on_van_delta := 0;
      damaged_delta := 0; applied := false;
      reason := CASE WHEN v_wh IS NULL THEN 'no_inventory_row'
                     ELSE 'not_stocked_in_that_warehouse' END;
      RETURN NEXT; CONTINUE;
    END IF;

    IF v_wh IS NULL THEN
      SELECT count(*) INTO v_candidates
      FROM public.distributor_inventory di
      WHERE di.distributor_id = vs.distributor_id
        AND (di.variant_id::text = it.product_id
             OR (di.variant_id IS NULL AND di.product_id::text = it.product_id));
      IF v_candidates > 1 THEN
        product_name := it.product_name; available_delta := 0; on_van_delta := 0;
        damaged_delta := 0; applied := false; reason := 'warehouse_ambiguous';
        RETURN NEXT; CONTINUE;
      END IF;
    END IF;

    IF COALESCE(public.normalise_unit(it.unit), 'x')
       IS DISTINCT FROM COALESCE(public.normalise_unit(inv.unit), 'x') THEN
      product_name := it.product_name; available_delta := 0; on_van_delta := 0;
      damaged_delta := 0; applied := false; reason := 'unit_mismatch'; RETURN NEXT; CONTINUE;
    END IF;

    SELECT * INTO v_prev FROM public.van_day_postings
    WHERE van_stock_id = p_van_stock_id AND product_id = it.product_id;

    v_d_avail   := v_want_avail   - COALESCE(v_prev.available_posted, 0);
    v_d_onvan   := v_want_onvan   - COALESCE(v_prev.on_van_posted, 0);
    v_d_damaged := v_want_damaged - COALESCE(v_prev.damaged_posted, 0);

    IF v_d_avail = 0 AND v_d_onvan = 0 AND v_d_damaged = 0 THEN
      product_name := it.product_name; available_delta := 0; on_van_delta := 0;
      damaged_delta := 0; applied := false; reason := 'already_settled'; RETURN NEXT; CONTINUE;
    END IF;

    -- A warehouse cannot hold less than nothing. Refusing leaves the day
    -- visible as unsettled on the reconciliation screen, which is recoverable;
    -- a negative balance quietly corrupts every figure derived from it.
    --
    -- CHANGE 2: this runs in dry run too. It writes nothing — the branch
    -- returns and continues before any UPDATE — but a preview that skips it
    -- reports a day as settleable when it is not.
    IF COALESCE(inv.quantity,0) + v_d_avail < 0 THEN
      product_name := it.product_name;
      available_delta := v_d_avail; on_van_delta := 0; damaged_delta := 0;
      applied := false; reason := 'insufficient_stock_in_warehouse'; RETURN NEXT; CONTINUE;
    END IF;

    product_name := it.product_name;
    available_delta := v_d_avail; on_van_delta := v_d_onvan; damaged_delta := v_d_damaged;

    IF p_dry_run THEN
      applied := false; reason := 'dry_run'; RETURN NEXT; CONTINUE;
    END IF;

    UPDATE public.distributor_inventory
    SET quantity         = COALESCE(quantity,0) + v_d_avail,
        on_van_quantity  = COALESCE(on_van_quantity,0) + v_d_onvan,
        damaged_quantity = COALESCE(damaged_quantity,0) + v_d_damaged,
        updated_at = now()
    WHERE id = inv.id;

    -- CHANGE 3: balance_qty carries the warehouse delta, so the movement is a
    -- number in the ledger rather than a sentence in notes.
    INSERT INTO public.distributor_inventory_transactions
      (distributor_id, product_id, variant_id, product_name, warehouse_id,
       transaction_type, reference_type, reference_number, unit, notes, created_at,
       balance_qty)
    VALUES
      (vs.distributor_id, inv.product_id, inv.variant_id, it.product_name, inv.warehouse_id,
       CASE WHEN v_closed THEN 'VAN_SETTLE' ELSE 'VAN_LOADOUT' END,
       'adjustment', v_ref, it.unit,
       format('van %s %s: available %s, on van %s, damaged %s',
              vs.van_id, vs.stock_date, v_d_avail, v_d_onvan, v_d_damaged),
       now(),
       v_d_avail);

    INSERT INTO public.van_day_postings
      (van_stock_id, product_id, variant_id, distributor_id,
       available_posted, on_van_posted, damaged_posted, last_settled_at)
    VALUES
      (p_van_stock_id, it.product_id, inv.variant_id, vs.distributor_id,
       v_want_avail, v_want_onvan, v_want_damaged, now())
    ON CONFLICT (van_stock_id, product_id) DO UPDATE
      SET available_posted = EXCLUDED.available_posted,
          on_van_posted    = EXCLUDED.on_van_posted,
          damaged_posted   = EXCLUDED.damaged_posted,
          last_settled_at  = now();

    applied := true; reason := CASE WHEN v_closed THEN 'settled_closed' ELSE 'settled_open' END;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- CREATE OR REPLACE keeps the existing privileges, so this is a no-op on an
-- environment where the function already exists. It is stated anyway so a
-- database built from these migrations alone ends up with the same grant
-- rather than the default PUBLIC EXECUTE a fresh CREATE would give it.
revoke all on function public.dms_settle_van_day(uuid, boolean) from public;
grant execute on function public.dms_settle_van_day(uuid, boolean) to authenticated;
