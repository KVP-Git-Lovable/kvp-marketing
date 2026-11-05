-- Stage 2 of the running_balance repair: correct the history, and make the
-- trigger and the rebuild share one definition of what a row moves.
-- Stage 1 (20261020110000) stopped new rows being computed wrongly.
--
-- UOM_CORRECTION rows restate a holding: "50 pcs recorded as pcs is 2000 GRAM"
-- replaces the 50 that an earlier OPENING_STOCK row put in the stream with
-- 2000. The movement is therefore balance_qty minus the old figure, which only
-- the notes carry ("... : 50 pcs recorded as ..."). Stage 1 added the whole of
-- balance_qty (50 + 2000 = 2050), leaving every stream that went through a
-- correction too high by the old holding. Replaying history with the old
-- figure removed brings 88 of 104 streams to the actual stock, up from 60.
--
-- A note that cannot be parsed counts the old figure as 0, which is the
-- stage 1 behaviour (the whole of balance_qty is added) rather than a guess.
--
-- Not changed here: the 16 streams that still disagree with
-- distributor_inventory.quantity after the rebuild. They are real gaps — a
-- writer that moved stock without a ledger row (dispatch / packing list,
-- primary orders, mark-damaged, manual edits) — and no recomputation can
-- recover movements that were never recorded.
--
-- The previous values are kept in dit_running_balance_backup_20261022
-- (created before this ran). To restore:
--   update distributor_inventory_transactions t
--      set running_balance = b.running_balance
--     from dit_running_balance_backup_20261022 b where b.id = t.id;

create or replace function public.ledger_movement(p_type text, p_qty integer, p_notes text)
returns integer
language sql
immutable
set search_path to 'public'
as $function$
  select case
    -- Bucket transfers: stock changes category, not quantity.
    when p_type in ('RESERVE', 'RELEASE', 'MARK_DAMAGED', 'MARK_EXPIRED') then 0

    -- A restatement: the new holding less the one it replaces.
    when p_type = 'UOM_CORRECTION' then
      coalesce(p_qty, 0) - coalesce(
        substring(p_notes from ': (\d+) \S+ recorded as')::integer,
        0)

    when p_type in ('GRN', 'OPENING_STOCK', 'RETURN', 'ADJUSTMENT_IN',
                    'inward', 'PRODUCT_MERGE')
      then abs(coalesce(p_qty, 0))

    when p_type in ('DISPATCH', 'ADJUSTMENT_OUT', 'RETURN_TO_COMPANY', 'primary_order')
      then -abs(coalesce(p_qty, 0))

    -- Unrecognised, including NULL: trust the caller's sign.
    else coalesce(p_qty, 0)
  end
$function$;

create or replace function public.calc_transaction_balance()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
DECLARE
  v_prev_balance INTEGER;
  v_delta        INTEGER;
BEGIN
  SELECT running_balance INTO v_prev_balance
  FROM public.distributor_inventory_transactions
  WHERE distributor_id = NEW.distributor_id
    AND product_id = NEW.product_id
    AND COALESCE(warehouse_id::text, '') = COALESCE(NEW.warehouse_id::text, '')
    AND seq < NEW.seq
  ORDER BY seq DESC
  LIMIT 1;

  v_delta := public.ledger_movement(NEW.transaction_type, NEW.balance_qty, NEW.notes);

  NEW.running_balance := COALESCE(v_prev_balance, 0) + v_delta;
  RETURN NEW;
END;
$function$;

-- Rebuild: replay every stream in seq order.
with replay as (
  select id,
         sum(public.ledger_movement(transaction_type, balance_qty, notes))
           over (partition by distributor_id, product_id, coalesce(warehouse_id::text, '')
                 order by seq) as rb
  from public.distributor_inventory_transactions
)
update public.distributor_inventory_transactions t
set running_balance = r.rb
from replay r
where r.id = t.id
  and t.running_balance is distinct from r.rb;
