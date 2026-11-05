-- apply_inventory_movement used to fall back to the distributor's default
-- warehouse whenever the caller did not name one. For a distributor with a
-- single warehouse that is harmless; for one holding the same product in two,
-- it silently moved stock in the wrong place — and worse, the lookup
--
--     where distributor_id = ... and product_id = ... and warehouse_id = <default>
--
-- would miss a row sitting in the other warehouse and report "Product not
-- found in inventory" for stock that plainly exists.
--
-- The rule now is that a location is only used when it is unambiguous. An
-- explicit warehouse is honoured; otherwise the function will use a single
-- obvious candidate and refuse to choose between several. It never falls back
-- to is_default.

create or replace function public.apply_inventory_movement(
  p_distributor_id   uuid,
  p_product_id       uuid,
  p_movement         text,
  p_quantity         numeric,
  p_unit             text default null,
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
  v_wh_count  integer;
  v_qty       integer;
  v_available integer;
  v_new_qty   integer;
  v_signed    integer;
  v_txn_type  text;
  v_unit      text;
  v_name      text;
begin
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

  if p_warehouse_id is not null then
    if not exists (
      select 1 from public.warehouses
      where id = p_warehouse_id and distributor_id = p_distributor_id
    ) then
      return jsonb_build_object('success', false, 'error', 'Invalid warehouse for this distributor');
    end if;
    v_wh_id := p_warehouse_id;
  else
    -- Where does this product already sit? One place is an answer; two is a
    -- question for the caller, not something to guess at.
    -- array_agg rather than min: there is no min(uuid).
    select count(distinct warehouse_id), (array_agg(distinct warehouse_id))[1]
      into v_wh_count, v_wh_id
    from public.distributor_inventory
    where distributor_id = p_distributor_id
      and product_id = p_product_id
      and warehouse_id is not null;

    if v_wh_count > 1 then
      return jsonb_build_object('success', false,
        'error', format('This product is held in %s warehouses. Choose which one this movement applies to.', v_wh_count),
        'ambiguous_warehouses', v_wh_count);
    end if;

    if v_wh_count = 0 then
      -- Nothing stocked yet. An inward movement still needs somewhere to go,
      -- so the same rule applies to the distributor's warehouses.
      select count(*), (array_agg(id))[1] into v_wh_count, v_wh_id
      from public.warehouses
      where distributor_id = p_distributor_id;

      if v_wh_count <> 1 then
        return jsonb_build_object('success', false,
          'error', case when v_wh_count = 0
                        then 'This distributor has no warehouse to record stock against.'
                        else format('This distributor has %s warehouses. Choose which one this movement applies to.', v_wh_count)
                   end);
      end if;
    end if;
  end if;

  select * into v_inv
  from public.distributor_inventory
  where distributor_id = p_distributor_id
    and product_id = p_product_id
    and warehouse_id = v_wh_id
  for update;

  if not found then
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

    -- total_value is GENERATED (quantity * unit_cost); writing it raises 428C9.
    update public.distributor_inventory
       set quantity   = v_new_qty,
           updated_at = now()
     where id = v_inv.id;
  end if;

  -- These names are not free choices. trg_calc_transaction_balance overwrites
  -- running_balance and decides direction from a fixed list:
  --   inward := transaction_type IN ('GRN','OPENING_STOCK','RETURN','ADJUSTMENT_IN','RELEASE')
  v_txn_type := case p_movement
                  when 'ADJUST_INCREASE' then 'ADJUSTMENT_IN'
                  when 'ADJUST_DECREASE' then 'ADJUSTMENT_OUT'
                  when 'RETURN_IN'       then 'RETURN'
                  when 'RETURN_OUT'      then 'RETURN_TO_COMPANY'
                end;

  v_unit := coalesce(p_unit, v_inv.unit, 'pcs');

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
    'warehouse_id', v_wh_id,
    'new_quantity', v_new_qty,
    'new_available', v_new_qty
                     - coalesce(v_inv.reserved_quantity, 0)
                     - coalesce(v_inv.damaged_quantity, 0)
                     - coalesce(v_inv.expired_quantity, 0)
  );
end;
$function$;
