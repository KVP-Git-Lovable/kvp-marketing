-- Settlement learns the third bucket.
--
-- With van_stock_items.returned_expired_qty now carrying what the rep counted
-- as expired, settlement has to post it to distributor_inventory.expired_quantity
-- and remember that it did, or the figure would be written again on every save.
--
-- Two functions change, and both have to, because they are the two directions
-- of the same posting:
--
--   dms_settle_van_day       posts a van day's figures forward
--   dms_auto_settle_van_day  reverses a posting when its van line is deleted
--
-- Changing only the first would leave expired stock stranded in inventory the
-- moment someone removed a line from a van sheet: the reversal loop subtracts
-- what was posted, and a bucket it does not know about never comes back out.
--
-- dms_settle_van_day is dropped rather than replaced. CREATE OR REPLACE cannot
-- change the shape of RETURNS TABLE, and this adds expired_delta to it. The new
-- column sits with the other two deltas rather than being appended last, which
-- is safe here because every caller reads by name: dms_auto_settle_van_day
-- loops over `select *` into a record and uses r.<name>, and the client reads
-- PostgREST's JSON objects in src/lib/vanSettlement.ts. Grants do not survive a
-- drop, so the two lines at the bottom restate exactly what was there before --
-- execute to authenticated, and nothing to PUBLIC.
--
-- Three things deliberately do not change:
--
--   The arithmetic that credits returns to quantity. A damaged or expired
--   return is physically back in the warehouse, so it belongs in quantity;
--   damaged_quantity and expired_quantity then mark it unusable. Available
--   stock is quantity - reserved - damaged - expired, so the goods are counted
--   once as held and once as unsellable, which is what makes that identity
--   hold. Crediting only the good portion would make the physical stock vanish.
--
--   Delta tracking. expired_posted starts at 0 on every existing row, which is
--   true rather than merely convenient, because no van has ever posted to
--   expired_quantity. A day still open therefore posts its full expired figure
--   on the next save; a day already closed has a delta of zero and does not
--   move. No historical van day is rewritten by this migration.
--
--   The refusal set. Nothing new can refuse a line, and the stock guard still
--   tests only quantity, because expired_quantity is a label on stock that is
--   present, not a claim on stock that is absent.

drop function if exists public.dms_settle_van_day(uuid, boolean);

create or replace function public.dms_settle_van_day(
  p_van_stock_id uuid,
  p_dry_run boolean default true
)
returns table(
  product_name text,
  available_delta numeric,
  on_van_delta numeric,
  damaged_delta numeric,
  expired_delta numeric,
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
  v_good numeric; v_damaged numeric; v_expired numeric; v_onvan numeric;
  v_want_avail numeric; v_want_onvan numeric; v_want_damaged numeric; v_want_expired numeric;
  v_d_avail numeric; v_d_onvan numeric; v_d_damaged numeric; v_d_expired numeric;
  v_prev record; v_ref text;
BEGIN
  SELECT * INTO vs FROM public.van_stock WHERE id = p_van_stock_id;
  IF NOT FOUND THEN
    product_name := NULL; available_delta := 0; on_van_delta := 0; damaged_delta := 0;
    expired_delta := 0;
    applied := false; reason := 'van_day_not_found'; RETURN NEXT; RETURN;
  END IF;

  IF vs.distributor_id IS NULL THEN
    product_name := NULL; available_delta := 0; on_van_delta := 0; damaged_delta := 0;
    expired_delta := 0;
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
    -- CHANGE: the third bucket. Previously an expired return had to be entered
    -- as damaged, so expired_quantity was never written by a van.
    v_expired := COALESCE(it.returned_expired_qty, 0);

    -- What is still on the van. After close the counted figure wins; the gap
    -- between it and left_qty is the variance, and sits in no bucket.
    v_onvan   := CASE WHEN v_closed AND it.counted_qty IS NOT NULL
                      THEN it.counted_qty ELSE it.l END;

    -- Goods that come back damaged or expired are physically in the warehouse
    -- again and belong in quantity; damaged_quantity and expired_quantity then
    -- mark them unusable. Crediting only v_good subtracted them from
    -- availability without ever adding them to it.
    v_want_avail   := -it.s + v_good + v_damaged + v_expired;
    v_want_onvan   := v_onvan;
    v_want_damaged := v_damaged;
    v_want_expired := v_expired;

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
      damaged_delta := 0; expired_delta := 0; applied := false;
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
        damaged_delta := 0; expired_delta := 0; applied := false;
        reason := 'warehouse_ambiguous';
        RETURN NEXT; CONTINUE;
      END IF;
    END IF;

    IF COALESCE(public.normalise_unit(it.unit), 'x')
       IS DISTINCT FROM COALESCE(public.normalise_unit(inv.unit), 'x') THEN
      product_name := it.product_name; available_delta := 0; on_van_delta := 0;
      damaged_delta := 0; expired_delta := 0; applied := false;
      reason := 'unit_mismatch'; RETURN NEXT; CONTINUE;
    END IF;

    SELECT * INTO v_prev FROM public.van_day_postings
    WHERE van_stock_id = p_van_stock_id AND product_id = it.product_id;

    v_d_avail   := v_want_avail   - COALESCE(v_prev.available_posted, 0);
    v_d_onvan   := v_want_onvan   - COALESCE(v_prev.on_van_posted, 0);
    v_d_damaged := v_want_damaged - COALESCE(v_prev.damaged_posted, 0);
    v_d_expired := v_want_expired - COALESCE(v_prev.expired_posted, 0);

    IF v_d_avail = 0 AND v_d_onvan = 0 AND v_d_damaged = 0 AND v_d_expired = 0 THEN
      product_name := it.product_name; available_delta := 0; on_van_delta := 0;
      damaged_delta := 0; expired_delta := 0; applied := false;
      reason := 'already_settled'; RETURN NEXT; CONTINUE;
    END IF;

    -- A warehouse cannot hold less than nothing. Refusing leaves the day
    -- visible as unsettled on the reconciliation screen, which is recoverable;
    -- a negative balance quietly corrupts every figure derived from it.
    --
    -- This runs in dry run too. It writes nothing -- the branch returns and
    -- continues before any UPDATE -- but a preview that skips it reports a day
    -- as settleable when it is not.
    IF COALESCE(inv.quantity,0) + v_d_avail < 0 THEN
      product_name := it.product_name;
      available_delta := v_d_avail; on_van_delta := 0; damaged_delta := 0;
      expired_delta := 0;
      applied := false; reason := 'insufficient_stock_in_warehouse'; RETURN NEXT; CONTINUE;
    END IF;

    product_name := it.product_name;
    available_delta := v_d_avail; on_van_delta := v_d_onvan;
    damaged_delta := v_d_damaged; expired_delta := v_d_expired;

    IF p_dry_run THEN
      applied := false; reason := 'dry_run'; RETURN NEXT; CONTINUE;
    END IF;

    UPDATE public.distributor_inventory
    SET quantity         = COALESCE(quantity,0) + v_d_avail,
        on_van_quantity  = COALESCE(on_van_quantity,0) + v_d_onvan,
        damaged_quantity = COALESCE(damaged_quantity,0) + v_d_damaged,
        expired_quantity = COALESCE(expired_quantity,0) + v_d_expired,
        updated_at = now()
    WHERE id = inv.id;

    -- balance_qty carries the warehouse delta, so the movement is a number in
    -- the ledger rather than a sentence in notes.
    INSERT INTO public.distributor_inventory_transactions
      (distributor_id, product_id, variant_id, product_name, warehouse_id,
       transaction_type, reference_type, reference_number, unit, notes, created_at,
       balance_qty)
    VALUES
      (vs.distributor_id, inv.product_id, inv.variant_id, it.product_name, inv.warehouse_id,
       CASE WHEN v_closed THEN 'VAN_SETTLE' ELSE 'VAN_LOADOUT' END,
       'adjustment', v_ref, it.unit,
       format('van %s %s: available %s, on van %s, damaged %s, expired %s',
              vs.van_id, vs.stock_date, v_d_avail, v_d_onvan, v_d_damaged, v_d_expired),
       now(),
       v_d_avail);

    INSERT INTO public.van_day_postings
      (van_stock_id, product_id, variant_id, distributor_id,
       available_posted, on_van_posted, damaged_posted, expired_posted, last_settled_at)
    VALUES
      (p_van_stock_id, it.product_id, inv.variant_id, vs.distributor_id,
       v_want_avail, v_want_onvan, v_want_damaged, v_want_expired, now())
    ON CONFLICT (van_stock_id, product_id) DO UPDATE
      SET available_posted = EXCLUDED.available_posted,
          on_van_posted    = EXCLUDED.on_van_posted,
          damaged_posted   = EXCLUDED.damaged_posted,
          expired_posted   = EXCLUDED.expired_posted,
          last_settled_at  = now();

    applied := true; reason := CASE WHEN v_closed THEN 'settled_closed' ELSE 'settled_open' END;
    RETURN NEXT;
  END LOOP;
END;
$function$;

revoke all on function public.dms_settle_van_day(uuid, boolean) from public;
grant execute on function public.dms_settle_van_day(uuid, boolean) to authenticated;


-- The reverse direction.
--
-- This runs on every van_stock / van_stock_items change via the auto-settle
-- triggers. Its first loop forwards to dms_settle_van_day and logs refusals;
-- its second loop handles the case that function cannot see -- a van line that
-- has been deleted, whose posting is still standing in inventory. That loop
-- subtracts what was posted, so it needs the expired bucket or expired stock
-- would stay in the books after the line that put it there was removed.
--
-- Replaced rather than dropped: the signature is unchanged, so grants survive.

create or replace function public.dms_auto_settle_van_day(p_van_stock_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  vs record; po record; inv record; r record;
  v_wh uuid; v_ref text;
begin
  perform pg_advisory_xact_lock(hashtextextended('van_settle:' || p_van_stock_id::text, 0));

  select * into vs from public.van_stock where id = p_van_stock_id;
  if not found then
    return;
  end if;

  for r in select * from public.dms_settle_van_day(p_van_stock_id, false) loop
    if not r.applied and r.reason not in ('already_settled') then
      insert into public.van_settlement_log
        (van_stock_id, product_name, reason, available_delta, on_van_delta, damaged_delta,
         expired_delta)
      values
        (p_van_stock_id, r.product_name, r.reason, r.available_delta, r.on_van_delta,
         r.damaged_delta, r.expired_delta);
    end if;
  end loop;

  if vs.distributor_id is null then
    return;
  end if;

  v_wh := vs.warehouse_id;
  if v_wh is null then
    select w.id into v_wh from public.warehouses w
    where w.distributor_id = vs.distributor_id and w.is_default = true limit 1;
  end if;
  v_ref := 'van:' || p_van_stock_id::text;

  for po in
    select p.* from public.van_day_postings p
    where p.van_stock_id = p_van_stock_id
      and not exists (select 1 from public.van_stock_items i
                      where i.van_stock_id = p.van_stock_id and i.product_id = p.product_id)
      and (p.available_posted <> 0 or p.on_van_posted <> 0 or p.damaged_posted <> 0
           or p.expired_posted <> 0)
  loop
    select di.* into inv
    from public.distributor_inventory di
    where di.distributor_id = vs.distributor_id
      and (di.variant_id::text = po.product_id
           or (di.variant_id is null and di.product_id::text = po.product_id))
      and (v_wh is null or di.warehouse_id = v_wh)
    order by (di.variant_id::text = po.product_id) desc
    limit 1;

    if not found then
      insert into public.van_settlement_log (van_stock_id, product_name, reason)
      values (p_van_stock_id, po.product_id, 'deleted_item_no_inventory_row');
      continue;
    end if;

    if coalesce(inv.quantity, 0) - po.available_posted < 0 then
      insert into public.van_settlement_log
        (van_stock_id, product_name, reason, available_delta)
      values (p_van_stock_id, inv.product_name, 'insufficient_stock_in_warehouse', -po.available_posted);
      continue;
    end if;

    update public.distributor_inventory
    set quantity         = coalesce(quantity, 0) - po.available_posted,
        on_van_quantity  = coalesce(on_van_quantity, 0) - po.on_van_posted,
        damaged_quantity = coalesce(damaged_quantity, 0) - po.damaged_posted,
        expired_quantity = coalesce(expired_quantity, 0) - po.expired_posted,
        updated_at = now()
    where id = inv.id;

    insert into public.distributor_inventory_transactions
      (distributor_id, product_id, variant_id, product_name, warehouse_id,
       transaction_type, reference_type, reference_number, unit, notes, created_at,
       balance_qty)
    values
      (vs.distributor_id, inv.product_id, inv.variant_id, inv.product_name, inv.warehouse_id,
       'VAN_SETTLE', 'adjustment', v_ref, inv.unit,
       format('van %s %s: item removed, available %s, on van %s, damaged %s, expired %s',
              vs.van_id, vs.stock_date, -po.available_posted, -po.on_van_posted,
              -po.damaged_posted, -po.expired_posted),
       now(), -po.available_posted);

    update public.van_day_postings
    set available_posted = 0, on_van_posted = 0, damaged_posted = 0, expired_posted = 0,
        last_settled_at = now()
    where id = po.id;
  end loop;
exception when others then
  insert into public.van_settlement_log (van_stock_id, reason)
  values (p_van_stock_id, 'error: ' || sqlerrm);
end;
$function$;
