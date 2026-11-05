-- Stock Adjustments, Company Returns and Retailer Returns each moved stock with
-- a pair of client-side writes: an UPDATE on distributor_inventory and an INSERT
-- into distributor_inventory_transactions. Between them they named three columns
-- that cannot be written:
--
--   * available_quantity on distributor_inventory  — does not exist
--   * quantity on distributor_inventory_transactions — does not exist (it is balance_qty)
--   * total_value on distributor_inventory — GENERATED, so writing it raises 428C9
--
-- PostgREST refused the payloads with 400 PGRST204, and because a Supabase query
-- resolves with { data, error } rather than throwing, none of the three screens
-- noticed. Each reported success, marked return lines as added to stock, and
-- moved nothing.
--
-- Correcting the column names alone would not have been enough. There is no
-- stored availability figure at all; it is derived, exactly as
-- execute_stock_action already computes it:
--
--     available = quantity - reserved_quantity - damaged_quantity - expired_quantity
--
-- so a corrected client would still have to compute availability, check it,
-- write two tables in order, and hope nothing failed in between. This function
-- does the whole movement in one statement instead.
--
-- execute_stock_action is deliberately left alone. Opening Stock and Goods
-- Receipt work today and go through it; adding branches to it would put those
-- paths at risk for no gain. This mirrors it where it matters — the same row
-- lock, the same derived availability, the same ledger columns — and differs
-- in two deliberate ways: the caller's base unit wins, so the ledger says what
-- actually moved rather than falling back to the row's own unit (which is how
-- 'pcs' ended up on gram-stocked rows), and outward movements are signed
-- negative, matching how every existing DISPATCH row is recorded.

create or replace function public.apply_inventory_movement(
  p_distributor_id   uuid,
  p_product_id       uuid,
  p_movement         text,              -- ADJUST_INCREASE | ADJUST_DECREASE | RETURN_IN | RETURN_OUT
  p_quantity         numeric,           -- ALREADY converted to the product's base unit by the caller
  p_unit             text default null, -- the base unit code, recorded on the ledger row
  p_notes            text default null,
  p_created_by       uuid default null,
  p_warehouse_id     uuid default null,
  p_reference_type   text default null,
  p_reference_id     uuid default null,
  p_reference_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inv       record;
  v_wh_id     uuid;
  v_qty       integer;
  v_available integer;
  v_new_qty   integer;
  v_signed    integer;
  v_txn_type  text;
  v_unit      text;
  v_name      text;
begin
  -- Quantities are integers throughout this schema, so a converted figure is
  -- rounded here rather than silently truncated by the column.
  if p_quantity is null or p_quantity <= 0 then
    return jsonb_build_object('success', false, 'error', 'Quantity must be positive');
  end if;
  v_qty := round(p_quantity)::integer;

  if v_qty = 0 then
    return jsonb_build_object('success', false,
      'error', 'Quantity rounds to zero in the base unit');
  end if;

  if p_movement not in ('ADJUST_INCREASE', 'ADJUST_DECREASE', 'RETURN_IN', 'RETURN_OUT') then
    return jsonb_build_object('success', false,
      'error', 'Unknown movement: ' || coalesce(p_movement, 'null'));
  end if;

  v_wh_id := p_warehouse_id;
  if v_wh_id is null then
    select id into v_wh_id
    from public.warehouses
    where distributor_id = p_distributor_id and is_default = true
    limit 1;
  end if;

  if v_wh_id is not null and not exists (
    select 1 from public.warehouses
    where id = v_wh_id and distributor_id = p_distributor_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Invalid warehouse for this distributor');
  end if;

  -- The lock is the point: two returns verified at the same moment would
  -- otherwise both read the same starting figure and one would overwrite
  -- the other.
  select * into v_inv
  from public.distributor_inventory
  where distributor_id = p_distributor_id
    and product_id = p_product_id
    and (v_wh_id is null or warehouse_id = v_wh_id)
  for update;

  if not found then
    -- Only an inward movement may create a row. Taking stock off a product
    -- that was never stocked is a mistake, not a new row at zero.
    if p_movement in ('ADJUST_DECREASE', 'RETURN_OUT') then
      return jsonb_build_object('success', false, 'error', 'Product not found in inventory');
    end if;

    select coalesce(p.name, 'Product') into v_name
    from public.products p where p.id = p_product_id;

    insert into public.distributor_inventory (
      distributor_id, product_id, product_name, quantity,
      reserved_quantity, damaged_quantity, expired_quantity,
      unit, warehouse_id
    ) values (
      p_distributor_id, p_product_id, coalesce(v_name, 'Product'), v_qty,
      0, 0, 0, coalesce(p_unit, 'pcs'), v_wh_id
    )
    returning * into v_inv;

    v_new_qty := v_qty;
    v_signed  := v_qty;
  else
    v_available := v_inv.quantity
                 - coalesce(v_inv.reserved_quantity, 0)
                 - coalesce(v_inv.damaged_quantity, 0)
                 - coalesce(v_inv.expired_quantity, 0);

    if p_movement in ('ADJUST_DECREASE', 'RETURN_OUT') then
      -- Checked against what is actually free, not the gross figure: stock
      -- that is reserved, damaged or expired cannot be sent back or adjusted away.
      if v_available < v_qty then
        return jsonb_build_object(
          'success', false,
          'error', format('Insufficient stock: %s available, %s requested', v_available, v_qty),
          'available', v_available,
          'requested', v_qty
        );
      end if;
      v_new_qty := v_inv.quantity - v_qty;
      v_signed  := -v_qty;
    else
      v_new_qty := v_inv.quantity + v_qty;
      v_signed  := v_qty;
    end if;

    -- total_value is a GENERATED column: Postgres recomputes it from quantity
    -- and unit_cost. Writing it raises 428C9, which is a third reason the
    -- three screens' updates could never have succeeded.
    update public.distributor_inventory
       set quantity   = v_new_qty,
           updated_at = now()
     where id = v_inv.id;
  end if;

  -- These names are not free choices. A BEFORE INSERT trigger,
  -- trg_calc_transaction_balance, overwrites running_balance and decides the
  -- direction from a fixed list:
  --
  --   inward := transaction_type IN ('GRN','OPENING_STOCK','RETURN','ADJUSTMENT_IN','RELEASE')
  --
  -- Anything else is treated as outward and subtracted. A name the trigger does
  -- not recognise therefore drives the running balance the wrong way, so the
  -- two inward movements use names it already knows.
  v_txn_type := case p_movement
                  when 'ADJUST_INCREASE' then 'ADJUSTMENT_IN'
                  when 'ADJUST_DECREASE' then 'ADJUSTMENT_OUT'
                  when 'RETURN_IN'       then 'RETURN'
                  when 'RETURN_OUT'      then 'RETURN_TO_COMPANY'
                end;

  v_unit := coalesce(p_unit, v_inv.unit, 'pcs');

  -- balance_qty is signed, matching how every DISPATCH row is recorded.
  -- running_balance is passed for intent, but the trigger above recomputes it
  -- from the previous ledger row rather than from the inventory row.
  insert into public.distributor_inventory_transactions (
    distributor_id, product_id, product_name, transaction_type,
    balance_qty, running_balance, unit, notes, created_by,
    batch_number, reference_type, reference_id, reference_number, warehouse_id
  ) values (
    p_distributor_id, p_product_id, coalesce(v_inv.product_name, 'Product'), v_txn_type,
    v_signed, v_new_qty, v_unit, p_notes, p_created_by,
    v_inv.batch_number, p_reference_type, p_reference_id, p_reference_number, v_wh_id
  );

  return jsonb_build_object(
    'success', true,
    'movement', p_movement,
    'applied_qty', v_qty,
    'unit', v_unit,
    'new_quantity', v_new_qty,
    'new_available', v_new_qty
                     - coalesce(v_inv.reserved_quantity, 0)
                     - coalesce(v_inv.damaged_quantity, 0)
                     - coalesce(v_inv.expired_quantity, 0)
  );
end;
$function$;

grant execute on function public.apply_inventory_movement(
  uuid, uuid, text, numeric, text, text, uuid, uuid, text, uuid, text
) to authenticated;
