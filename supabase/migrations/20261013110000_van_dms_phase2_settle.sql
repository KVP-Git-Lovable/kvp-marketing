-- dms_settle_van_day: make the distributor's books agree with a van-day.
--
-- SETTLE, DO NOT REPLAY. The van side recomputes absolute figures every time an
-- order changes (syncOrdersToVanStock), so a stream of per-event postings would
-- need a compensating entry for every recalculation and a reversal for every
-- edited order. Instead this asks one question -- what should the books show for
-- this van-day? -- and writes only the difference from what it has already
-- posted. That makes it idempotent, order-independent, and correct for a van
-- that was offline all day and arrives in one lump.
--
-- What a van-day contributes to the distributor:
--     available  -= start_qty              (issued to the van)
--     available  += returned_good          (came back saleable)
--     damaged    += returned_damaged       (came back broken)
--     on_van      = counted, else left_qty (still on board)
-- Anything unaccounted for is variance and is simply not in any bucket, which
-- is what makes it a loss.
create table if not exists public.van_day_postings (
  id uuid primary key default gen_random_uuid(),
  van_stock_id uuid not null references public.van_stock(id) on delete cascade,
  -- text, because van_stock_items.product_id is text and may hold a variant id
  product_id text not null,
  variant_id uuid,
  distributor_id uuid not null,
  available_posted numeric not null default 0,
  on_van_posted numeric not null default 0,
  damaged_posted numeric not null default 0,
  last_settled_at timestamptz not null default now(),
  unique (van_stock_id, product_id)
);

comment on table public.van_day_postings is
  'What dms_settle_van_day has already applied for a van-day and product. The difference between this and the day''s current facts is what the next settle writes, which is what makes settling idempotent.';

alter table public.van_day_postings enable row level security;

drop policy if exists van_day_postings_read on public.van_day_postings;
create policy van_day_postings_read on public.van_day_postings
  for select to authenticated using (public.is_admin_or_manager());


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
  v_closed boolean;
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

  -- Refuses rather than guesses. A van with no distributor cannot post, and
  -- saying so once is better than attributing stock to the wrong books.
  IF vs.distributor_id IS NULL THEN
    product_name := NULL; available_delta := 0; on_van_delta := 0; damaged_delta := 0;
    applied := false; reason := 'van_has_no_distributor'; RETURN NEXT; RETURN;
  END IF;

  v_closed := COALESCE(vs.status, '') = 'closing_verified';
  v_ref := 'van:' || p_van_stock_id::text;

  FOR it IN
    SELECT i.*, COALESCE(i.start_qty,0) AS s, COALESCE(i.ordered_qty,0) AS o,
           COALESCE(i.returned_qty,0) AS r, COALESCE(i.left_qty,0) AS l
    FROM public.van_stock_items i
    WHERE i.van_stock_id = p_van_stock_id
  LOOP
    -- Where no split has been recorded, the whole return is treated as good.
    -- That is the behaviour before the split existed, so old days settle the
    -- way they were recorded rather than inventing damage.
    v_good    := COALESCE(it.returned_good_qty, it.r - COALESCE(it.returned_damaged_qty,0));
    v_damaged := COALESCE(it.returned_damaged_qty, 0);

    -- Before close the expected figure is the best available. After close the
    -- counted figure wins, and the gap between them is the variance.
    v_onvan   := CASE WHEN v_closed AND it.counted_qty IS NOT NULL
                      THEN it.counted_qty ELSE it.l END;

    v_want_avail   := -it.s + v_good;
    v_want_onvan   := v_onvan;
    v_want_damaged := v_damaged;

    -- van_stock_items.product_id is TEXT and holds the VARIANT id on a variant
    -- line. Compared as text rather than cast to uuid: the column is free text
    -- and a row holding anything that is not a uuid would raise, taking down
    -- the settle for the whole day rather than skipping one line.
    SELECT di.* INTO inv
    FROM public.distributor_inventory di
    WHERE di.distributor_id = vs.distributor_id
      AND (di.variant_id::text = it.product_id
           OR (di.variant_id IS NULL AND di.product_id::text = it.product_id))
    ORDER BY (di.variant_id::text = it.product_id) DESC
    LIMIT 1;

    IF NOT FOUND THEN
      product_name := it.product_name; available_delta := 0; on_van_delta := 0;
      damaged_delta := 0; applied := false; reason := 'no_inventory_row'; RETURN NEXT; CONTINUE;
    END IF;

    -- Units are compared, never converted. A silent conversion between a van
    -- unit and an inventory unit is exactly how a stock ledger acquires numbers
    -- nobody can explain.
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
