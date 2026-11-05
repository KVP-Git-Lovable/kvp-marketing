-- Settle van days into DMS inventory from the database, on every change.
--
-- Until now dms_settle_van_day was called only from three places in the
-- browser (Morning GRN save, Closing GRN save, order sync). Every other writer
-- of van_stock_items — VanSalesModal's delete-and-reinsert, the delete-item
-- button, a closed tab, an offline device — left DMS inventory behind, and
-- nothing ever caught it up. The database is the only place that sees every
-- write, so that is where the call belongs.
--
-- dms_settle_van_day is delta-based (it posts only the difference from
-- van_day_postings), so being called more than once for the same state is a
-- no-op. That is what makes a trigger safe here, and why the existing client
-- calls can stay as a harmless fallback.
--
-- Three pieces:
--
--   1. van_settlement_log   — what could not be posted, and why. A refusal must
--                             never block the person saving the van sheet, so
--                             it is recorded here instead of raised.
--   2. dms_auto_settle_van_day(uuid)
--                           — serialises per van day, settles, logs refusals,
--                             and reverses postings whose item no longer exists
--                             (dms_settle_van_day only walks existing items, so
--                             a deleted line would otherwise stay posted).
--   3. Statement-level triggers on van_stock_items and van_stock — one settle
--      per affected van day per statement, not one per row.

-- 1. Log -------------------------------------------------------------------

create table if not exists public.van_settlement_log (
  id             uuid primary key default gen_random_uuid(),
  van_stock_id   uuid not null,
  product_name   text,
  reason         text not null,
  available_delta numeric,
  on_van_delta   numeric,
  damaged_delta  numeric,
  created_at     timestamptz not null default now()
);

create index if not exists van_settlement_log_van_stock_idx
  on public.van_settlement_log (van_stock_id, created_at desc);

comment on table public.van_settlement_log is
  'Lines dms_auto_settle_van_day could not post to DMS inventory (refusals and errors). Rows are not removed when the van day is; read it alongside van_stock.';

alter table public.van_settlement_log enable row level security;

-- Visible to whoever can see the van day: the subquery runs under van_stock's
-- own policies, so this inherits owner / manager / admin visibility.
drop policy if exists "View settlement log for visible van days" on public.van_settlement_log;
create policy "View settlement log for visible van days"
  on public.van_settlement_log for select to authenticated
  using (exists (select 1 from public.van_stock vs where vs.id = van_settlement_log.van_stock_id));

-- 2. Settle wrapper ---------------------------------------------------------

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
  -- One settle per van day at a time. Without this two concurrent saves both
  -- read the same van_day_postings row and both post the same difference.
  perform pg_advisory_xact_lock(hashtextextended('van_settle:' || p_van_stock_id::text, 0));

  select * into vs from public.van_stock where id = p_van_stock_id;
  if not found then
    return;
  end if;

  -- A van day with no distributor cannot reach any inventory. The guard on
  -- insert makes this rare; old rows still hit it, and are logged once per
  -- change rather than silently skipped.
  for r in select * from public.dms_settle_van_day(p_van_stock_id, false) loop
    if not r.applied and r.reason not in ('already_settled') then
      insert into public.van_settlement_log
        (van_stock_id, product_name, reason, available_delta, on_van_delta, damaged_delta)
      values
        (p_van_stock_id, r.product_name, r.reason, r.available_delta, r.on_van_delta, r.damaged_delta);
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

  -- Reverse postings whose item has been deleted: the wanted state for a line
  -- that no longer exists is zero everywhere.
  for po in
    select p.* from public.van_day_postings p
    where p.van_stock_id = p_van_stock_id
      and not exists (select 1 from public.van_stock_items i
                      where i.van_stock_id = p.van_stock_id and i.product_id = p.product_id)
      and (p.available_posted <> 0 or p.on_van_posted <> 0 or p.damaged_posted <> 0)
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

    -- Removing a posting of positive available (stock that came back) would
    -- subtract from the warehouse; refuse rather than go below zero.
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
        updated_at = now()
    where id = inv.id;

    insert into public.distributor_inventory_transactions
      (distributor_id, product_id, variant_id, product_name, warehouse_id,
       transaction_type, reference_type, reference_number, unit, notes, created_at,
       balance_qty)
    values
      (vs.distributor_id, inv.product_id, inv.variant_id, inv.product_name, inv.warehouse_id,
       'VAN_SETTLE', 'adjustment', v_ref, inv.unit,
       format('van %s %s: item removed, available %s, on van %s, damaged %s',
              vs.van_id, vs.stock_date, -po.available_posted, -po.on_van_posted, -po.damaged_posted),
       now(), -po.available_posted);

    update public.van_day_postings
    set available_posted = 0, on_van_posted = 0, damaged_posted = 0, last_settled_at = now()
    where id = po.id;
  end loop;
exception when others then
  -- Never let settlement block saving a van sheet. The failure is recorded and
  -- the next change to the day retries the whole difference.
  insert into public.van_settlement_log (van_stock_id, reason)
  values (p_van_stock_id, 'error: ' || sqlerrm);
end;
$function$;

revoke all on function public.dms_auto_settle_van_day(uuid) from public;

-- 3. Triggers ---------------------------------------------------------------
-- Transition tables require one trigger per event.

create or replace function public.tg_van_items_auto_settle()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_id uuid;
begin
  if tg_op = 'DELETE' then
    for v_id in select distinct van_stock_id from old_rows where van_stock_id is not null loop
      perform public.dms_auto_settle_van_day(v_id);
    end loop;
  else
    for v_id in select distinct van_stock_id from new_rows where van_stock_id is not null loop
      perform public.dms_auto_settle_van_day(v_id);
    end loop;
  end if;
  return null;
end;
$function$;

drop trigger if exists trg_van_items_settle_ins on public.van_stock_items;
create trigger trg_van_items_settle_ins after insert on public.van_stock_items
  referencing new table as new_rows
  for each statement execute function public.tg_van_items_auto_settle();

drop trigger if exists trg_van_items_settle_upd on public.van_stock_items;
create trigger trg_van_items_settle_upd after update on public.van_stock_items
  referencing new table as new_rows
  for each statement execute function public.tg_van_items_auto_settle();

drop trigger if exists trg_van_items_settle_del on public.van_stock_items;
create trigger trg_van_items_settle_del after delete on public.van_stock_items
  referencing old table as old_rows
  for each statement execute function public.tg_van_items_auto_settle();

-- Status moves a day from open to closed (counted_qty then wins over left_qty),
-- and fixing a missing distributor / warehouse makes an unsettleable day
-- settleable.
create or replace function public.tg_van_stock_auto_settle()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_id uuid;
begin
  for v_id in select n.id from new_rows n join old_rows o on o.id = n.id
              where n.status is distinct from o.status
                 or n.distributor_id is distinct from o.distributor_id
                 or n.warehouse_id is distinct from o.warehouse_id loop
    perform public.dms_auto_settle_van_day(v_id);
  end loop;
  return null;
end;
$function$;

drop trigger if exists trg_van_stock_settle_upd on public.van_stock;
create trigger trg_van_stock_settle_upd after update on public.van_stock
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.tg_van_stock_auto_settle();

revoke all on function public.tg_van_items_auto_settle() from public;
revoke all on function public.tg_van_stock_auto_settle() from public;
