-- Settle against the day's warehouse rather than whichever inventory row
-- happens to match first.
--
-- Previously the row was found by distributor and product with LIMIT 1. That is
-- unambiguous only while no product sits in two warehouses -- true today, but
-- one distributor already has two, so it was a matter of time before stock was
-- deducted from an arbitrary one.
--
-- Resolution order: the warehouse recorded on the van-day, else the
-- distributor's default. A distributor with one warehouse, or with a default
-- set, therefore needs nobody to pick anything.
--
-- And where it genuinely cannot tell -- no warehouse on the day, no default,
-- and the product held in more than one -- it refuses with warehouse_ambiguous
-- rather than draining whichever row sorted first.
create or replace function public.dms_settle_van_day(
  p_van_stock_id uuid,
  p_dry_run boolean default true
)
returns table (
  product_name text,
  available_delta numeric,
  on_van_delta numeric,
  damaged_delta numeric,
  applied boolean,
  reason text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  -- The day's own warehouse, else the distributor's default. Only if neither
  -- exists does this fall back to matching on product alone.
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
    v_good    := COALESCE(it.returned_good_qty, it.r - COALESCE(it.returned_damaged_qty,0));
    v_damaged := COALESCE(it.returned_damaged_qty, 0);
    v_onvan   := CASE WHEN v_closed AND it.counted_qty IS NOT NULL
                      THEN it.counted_qty ELSE it.l END;

    v_want_avail   := -it.s + v_good;
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
      -- Said apart, because "this product is not stocked here" and "this
      -- product is not stocked at all" send you to different places.
      reason := CASE WHEN v_wh IS NULL THEN 'no_inventory_row'
                     ELSE 'not_stocked_in_that_warehouse' END;
      RETURN NEXT; CONTINUE;
    END IF;

    -- With no warehouse on the day and no default to fall back to, a product
    -- held in two warehouses has no single right answer. Refuse rather than
    -- deduct from an arbitrary one.
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

    -- Units are compared, never converted. A silent conversion between a van
    -- unit and an inventory unit is how a stock ledger acquires numbers nobody
    -- can explain.
    IF COALESCE(NULLIF(TRIM(LOWER(it.unit)),''), 'x')
       IS DISTINCT FROM COALESCE(NULLIF(TRIM(LOWER(inv.unit)),''), 'x') THEN
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

    INSERT INTO public.distributor_inventory_transactions
      (distributor_id, product_id, variant_id, product_name, warehouse_id,
       transaction_type, reference_type, reference_number, unit, notes, created_at)
    VALUES
      (vs.distributor_id, inv.product_id, inv.variant_id, it.product_name, inv.warehouse_id,
       CASE WHEN v_closed THEN 'VAN_SETTLE' ELSE 'VAN_LOADOUT' END,
       'adjustment', v_ref, it.unit,
       format('van %s %s: available %s, on van %s, damaged %s',
              vs.van_id, vs.stock_date, v_d_avail, v_d_onvan, v_d_damaged),
       now());

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

revoke all on function public.dms_settle_van_day(uuid, boolean) from public;
grant execute on function public.dms_settle_van_day(uuid, boolean) to authenticated;
