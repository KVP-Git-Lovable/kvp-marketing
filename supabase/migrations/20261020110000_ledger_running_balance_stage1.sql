-- Stage 1 of the running_balance repair: stop new rows being computed wrongly.
-- No historical balance is rewritten here.
--
-- Of 104 ledger streams, 35 disagreed with actual stock and 31 had gone
-- negative. calc_transaction_balance had three separate faults:
--
--   1. Its inward list was ('GRN','OPENING_STOCK','RETURN','ADJUSTMENT_IN',
--      'RELEASE'). The data also contains 'inward' (the GRN path writes
--      lowercase), 'UOM_CORRECTION', 'PRODUCT_MERGE' and NULL — 52 rows, all
--      inward in reality, every one of them subtracted. That alone explains
--      the 13 streams sitting at exactly minus their true quantity.
--
--   2. RESERVE, RELEASE, MARK_DAMAGED and MARK_EXPIRED move stock between
--      buckets; the total does not change. They were added or subtracted
--      anyway, so every reservation permanently skewed the balance.
--
--   3. "Previous row" was found with `order by created_at desc, id desc`.
--      Rows written in one transaction share a timestamp to the microsecond,
--      so the tiebreak fell to a random uuid. Four movements inserted in a
--      known order came back out of order in testing.
--
-- Fault 3 cannot be fixed by ordering alone — there was nothing stable to
-- order by — so this adds a sequence. Column defaults are evaluated before
-- BEFORE INSERT triggers fire, so NEW.seq is already populated when the
-- trigger reads it.
--
-- Deriving the balance from distributor_inventory instead would be tidier,
-- but dispatch_batch_stock and dispatch_packing_list_atomic write ledger rows
-- without updating distributor_inventory at all, so that figure cannot be
-- trusted as the post-movement total for every writer.

alter table public.distributor_inventory_transactions
  add column if not exists seq bigserial;

create index if not exists idx_dit_stream_seq
  on public.distributor_inventory_transactions (distributor_id, product_id, warehouse_id, seq);

create or replace function public.calc_transaction_balance()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
DECLARE
  v_prev_balance INTEGER;
  v_movement     INTEGER;
  v_delta        INTEGER;
BEGIN
  v_movement := COALESCE(NEW.balance_qty, 0);

  -- The previous row in this stream, by sequence rather than by timestamp.
  SELECT running_balance INTO v_prev_balance
  FROM public.distributor_inventory_transactions
  WHERE distributor_id = NEW.distributor_id
    AND product_id = NEW.product_id
    AND COALESCE(warehouse_id::text, '') = COALESCE(NEW.warehouse_id::text, '')
    AND seq < NEW.seq
  ORDER BY seq DESC
  LIMIT 1;

  v_prev_balance := COALESCE(v_prev_balance, 0);

  v_delta := CASE
    -- Bucket transfers: stock changes category, not quantity.
    WHEN NEW.transaction_type IN ('RESERVE', 'RELEASE', 'MARK_DAMAGED', 'MARK_EXPIRED')
      THEN 0

    -- Stock arriving. 'inward' is the lowercase form the GRN screen writes;
    -- UOM_CORRECTION and PRODUCT_MERGE are corrections that restate a holding.
    WHEN NEW.transaction_type IN (
           'GRN', 'OPENING_STOCK', 'RETURN', 'ADJUSTMENT_IN',
           'inward', 'UOM_CORRECTION', 'PRODUCT_MERGE')
      THEN ABS(v_movement)

    -- Stock leaving.
    WHEN NEW.transaction_type IN (
           'DISPATCH', 'ADJUSTMENT_OUT', 'RETURN_TO_COMPANY', 'primary_order')
      THEN -ABS(v_movement)

    -- Anything unrecognised, including NULL: trust the sign the caller gave
    -- rather than guessing a direction from a name nobody has classified.
    ELSE v_movement
  END;

  NEW.running_balance := v_prev_balance + v_delta;

  RETURN NEW;
END;
$function$;
