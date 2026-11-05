-- Retrying a stock movement applied it again. The in-flight button guard stops
-- a double click, but not a retry after a timeout, a refresh mid-request, or an
-- offline replay — and a return verified twice credited the stock twice.
--
-- A caller now passes a key that identifies the movement rather than the
-- attempt. The same key twice moves stock once.
--
-- Note on the unique index: an earlier reading of mine said two existing
-- duplicate groups blocked this. They block an index over
-- (reference_type, reference_id, product_id); they do not block a dedicated
-- key column, because Postgres permits unlimited NULLs in a unique index and
-- every existing row has none.

alter table public.distributor_inventory_transactions
  add column if not exists idempotency_key text;

create unique index if not exists idx_dit_idempotency_key
  on public.distributor_inventory_transactions (idempotency_key)
  where idempotency_key is not null;

-- Adding a parameter does not replace the function, it overloads it: the
-- 11-argument version would survive alongside the 12-argument one and every
-- existing call would become ambiguous ("could not choose a best candidate").
-- The old signature is dropped first.
drop function if exists public.apply_inventory_movement(
  uuid, uuid, text, numeric, text, text, uuid, uuid, text, uuid, text);

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
  p_reference_number text default null,
  p_idempotency_key  text default null
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
  v_seen      integer;
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

  -- A location is only used when it is unambiguous. is_default is never
  -- consulted: silently guessing between warehouses was the earlier defect.
  if p_warehouse_id is not null then
    if not exists (
      select 1 from public.warehouses
      where id = p_warehouse_id and distributor_id = p_distributor_id
    ) then
      return jsonb_build_object('success', false, 'error', 'Invalid warehouse for this distributor');
    end if;
    v_wh_id := p_warehouse_id;
  else
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

  -- Taken before the key is checked, so two simultaneous retries queue here
  -- and the second sees the first one's committed ledger row.
  select * into v_inv
  from public.distributor_inventory
  where distributor_id = p_distributor_id
    and product_id = p_product_id
    and warehouse_id = v_wh_id
  for update;

  if p_idempotency_key is not null then
    select 1 into v_seen
    from public.distributor_inventory_transactions
    where idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return jsonb_build_object(
        'success', true,
        'already_applied', true,
        'movement', p_movement,
        'applied_qty', 0,
        'new_quantity', coalesce(v_inv.quantity, 0),
        'warehouse_id', v_wh_id
      );
    end if;
  end if;

  v_txn_type := case p_movement
                  when 'ADJUST_INCREASE' then 'ADJUSTMENT_IN'
                  when 'ADJUST_DECREASE' then 'ADJUSTMENT_OUT'
                  when 'RETURN_IN'       then 'RETURN'
                  when 'RETURN_OUT'      then 'RETURN_TO_COMPANY'
                end;

  -- Both writes sit inside one subtransaction. If the ledger insert loses a
  -- race on the key, the inventory change is rolled back with it, so a
  -- duplicate retry cannot leave stock moved and the movement unrecorded.
  begin
    if v_inv.id is null then
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

    v_unit := coalesce(p_unit, v_inv.unit, 'pcs');

    insert into public.distributor_inventory_transactions (
      distributor_id, product_id, product_name, transaction_type,
      balance_qty, running_balance, unit, notes, created_by,
      batch_number, reference_type, reference_id, reference_number,
      warehouse_id, idempotency_key
    ) values (
      p_distributor_id, p_product_id, coalesce(v_inv.product_name, 'Product'), v_txn_type,
      v_signed, v_new_qty, v_unit, p_notes, p_created_by,
      v_inv.batch_number, p_reference_type, p_reference_id, p_reference_number,
      v_wh_id, p_idempotency_key
    );

  exception when unique_violation then
    -- Only a lost race on the key is an "already applied"; anything else is a
    -- real failure and must not be dressed up as success.
    if p_idempotency_key is not null and exists (
      select 1 from public.distributor_inventory_transactions
      where idempotency_key = p_idempotency_key
    ) then
      select quantity into v_new_qty
      from public.distributor_inventory
      where distributor_id = p_distributor_id
        and product_id = p_product_id
        and warehouse_id = v_wh_id;

      return jsonb_build_object(
        'success', true,
        'already_applied', true,
        'movement', p_movement,
        'applied_qty', 0,
        'new_quantity', coalesce(v_new_qty, 0),
        'warehouse_id', v_wh_id
      );
    end if;
    raise;
  end;

  return jsonb_build_object(
    'success', true,
    'already_applied', false,
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

grant execute on function public.apply_inventory_movement(
  uuid, uuid, text, numeric, text, text, uuid, uuid, text, uuid, text, text
) to authenticated;
