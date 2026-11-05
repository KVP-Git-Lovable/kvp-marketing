-- PROPOSED, NOT APPLIED, NOT TESTED. Kept out of supabase/migrations on purpose.
-- Written while the staging database was unreachable. Run the checks at the
-- bottom on staging, then move this into supabase/migrations.
--
-- Problem: a retailer return (ReturnStockForm -> finalize_credit_note) posts the
-- credit to the retailer ledger and, if the rep has an assigned van, writes a
-- van_return_grn. Nothing in that path reaches distributor_inventory or the van
-- day, so DMS inventory never moves.
--
-- Fix: when a credit note is issued (posted_to_ledger turns true) post its goods
-- back into stock, once. A trigger on credit_notes covers both ways a note is
-- issued, immediately and after approval, without redefining finalize_credit_note
-- or tg_credit_note_approval_complete.
--
-- Where the stock goes
--
--   Rep has a van day on the credit note's date
--       -> the van. The returned units are added to that day's van_stock_items
--          line (returned_qty and left_qty, the same fields a van Morning/Closing
--          sheet maintains). The trigger on van_stock_items then settles the day,
--          so distributor_inventory.on_van_quantity moves by itself.
--          Damaged goods are physically on the van too, so they are added the same
--          way; the rep declares good and damaged at Closing GRN, as today.
--   Otherwise
--       -> the distributor's warehouse. quantity goes up by the returned amount;
--          damaged returns also raise damaged_quantity (damaged is a subset of
--          quantity everywhere else). A RETURN ledger row records it.
--
-- Unit: the quantity is in the unit the goods were SOLD in, which is the unit on
-- the original order line. credit_note_items.unit is the catalogue unit (a known
-- gap in ReturnStockForm) and is only a fallback. If that unit does not match the
-- stock row's unit the line is refused and logged, never converted by guesswork.
--
-- Refusals never fail the credit note. They go to credit_note_inventory_log.

alter table public.credit_notes
  add column if not exists inventory_posted_at timestamptz;

create table if not exists public.credit_note_inventory_log (
  id             uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null,
  product_name   text,
  quantity       numeric,
  destination    text,
  outcome        text not null,
  created_at     timestamptz not null default now()
);
alter table public.credit_note_inventory_log enable row level security;

create or replace function public.post_credit_note_to_inventory(p_cn uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  cn record; ci record; ord record; inv record; vs record; vi record;
  v_unit text; v_damaged boolean; v_wh uuid; v_key text;
begin
  perform pg_advisory_xact_lock(hashtextextended('cn_inventory:' || p_cn::text, 0));

  select * into cn from public.credit_notes where id = p_cn;
  if not found or cn.inventory_posted_at is not null or not coalesce(cn.posted_to_ledger, false) then
    return;
  end if;

  -- Same rule finalize_credit_note uses to choose scrap over restock.
  v_damaged := lower(coalesce(cn.reason, '')) ~ 'damag|expir|quality';

  for ci in select * from public.credit_note_items where credit_note_id = p_cn loop
    select o.* into ord from public.orders o where o.id = ci.original_order_id;

    select oi.unit into v_unit
    from public.order_items oi
    where oi.order_id = ci.original_order_id
      and oi.product_id = ci.product_id
      and (ci.variant_id is null or oi.variant_id = ci.variant_id)
    limit 1;
    v_unit := coalesce(v_unit, ci.unit);

    -- 1. The van, when the rep has a van day for the credit note's date.
    select s.* into vs from public.van_stock s
    where s.user_id = cn.created_by and s.stock_date = cn.credit_note_date
    order by s.created_at desc limit 1;

    if found then
      v_key := coalesce(ci.variant_id::text, ci.product_id::text);
      select i.* into vi from public.van_stock_items i
      where i.van_stock_id = vs.id and i.product_id in (v_key, ci.product_id::text)
      order by (i.product_id = v_key) desc limit 1;

      if found then
        if coalesce(public.normalise_unit(vi.unit), 'x') is distinct from coalesce(public.normalise_unit(v_unit), 'x') then
          insert into public.credit_note_inventory_log (credit_note_id, product_name, quantity, destination, outcome)
          values (p_cn, ci.product_name, ci.quantity, 'van', 'unit_mismatch');
        else
          update public.van_stock_items
             set returned_qty = coalesce(returned_qty, 0) + ci.quantity,
                 left_qty     = coalesce(left_qty, 0) + ci.quantity
           where id = vi.id;
          insert into public.credit_note_inventory_log (credit_note_id, product_name, quantity, destination, outcome)
          values (p_cn, ci.product_name, ci.quantity, 'van', 'posted');
        end if;
      else
        insert into public.van_stock_items
          (van_stock_id, product_id, product_name, start_qty, ordered_qty, returned_qty, left_qty, unit)
        values (vs.id, v_key, ci.product_name, 0, 0, ci.quantity, ci.quantity, v_unit);
        insert into public.credit_note_inventory_log (credit_note_id, product_name, quantity, destination, outcome)
        values (p_cn, ci.product_name, ci.quantity, 'van', 'posted_new_line');
      end if;
      continue;
    end if;

    -- 2. The warehouse.
    if ord.distributor_id is null then
      insert into public.credit_note_inventory_log (credit_note_id, product_name, quantity, destination, outcome)
      values (p_cn, ci.product_name, ci.quantity, 'warehouse', 'order_has_no_distributor');
      continue;
    end if;

    select w.id into v_wh from public.warehouses w
    where w.distributor_id = ord.distributor_id and w.is_default = true limit 1;

    select di.* into inv from public.distributor_inventory di
    where di.distributor_id = ord.distributor_id
      and (di.variant_id = ci.variant_id
           or (di.variant_id is null and di.product_id = ci.product_id))
      and (v_wh is null or di.warehouse_id = v_wh)
    order by (di.variant_id is not distinct from ci.variant_id) desc
    limit 1;

    if not found then
      insert into public.credit_note_inventory_log (credit_note_id, product_name, quantity, destination, outcome)
      values (p_cn, ci.product_name, ci.quantity, 'warehouse', 'no_inventory_row');
      continue;
    end if;

    if coalesce(public.normalise_unit(inv.unit), 'x') is distinct from coalesce(public.normalise_unit(v_unit), 'x') then
      insert into public.credit_note_inventory_log (credit_note_id, product_name, quantity, destination, outcome)
      values (p_cn, ci.product_name, ci.quantity, 'warehouse', 'unit_mismatch');
      continue;
    end if;

    update public.distributor_inventory
       set quantity         = coalesce(quantity, 0) + ci.quantity,
           damaged_quantity = coalesce(damaged_quantity, 0) + case when v_damaged then ci.quantity else 0 end,
           updated_at = now()
     where id = inv.id;

    insert into public.distributor_inventory_transactions
      (distributor_id, product_id, variant_id, product_name, warehouse_id,
       transaction_type, reference_type, reference_number, unit, notes, balance_qty)
    values
      (ord.distributor_id, inv.product_id, inv.variant_id, ci.product_name, inv.warehouse_id,
       'RETURN', 'adjustment', cn.credit_note_number, inv.unit,
       format('Retailer return on credit note %s (%s)', cn.credit_note_number,
              case when v_damaged then 'damaged' else 'good' end),
       ci.quantity);

    insert into public.credit_note_inventory_log (credit_note_id, product_name, quantity, destination, outcome)
    values (p_cn, ci.product_name, ci.quantity, 'warehouse', 'posted');
  end loop;

  update public.credit_notes set inventory_posted_at = now() where id = p_cn;
exception when others then
  -- Never block issuing a credit note. Recorded, and the note stays unposted so a
  -- later call can retry it.
  insert into public.credit_note_inventory_log (credit_note_id, outcome)
  values (p_cn, 'error: ' || sqlerrm);
end;
$function$;

revoke all on function public.post_credit_note_to_inventory(uuid) from public;

create or replace function public.tg_credit_note_inventory()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.posted_to_ledger and not coalesce(old.posted_to_ledger, false) then
    perform public.post_credit_note_to_inventory(new.id);
  end if;
  return null;
end;
$function$;

revoke all on function public.tg_credit_note_inventory() from public;

drop trigger if exists trg_credit_note_inventory on public.credit_notes;
create trigger trg_credit_note_inventory
after update of posted_to_ledger on public.credit_notes
for each row execute function public.tg_credit_note_inventory();

-- ---------------------------------------------------------------------------
-- CHECK ON STAGING BEFORE APPLYING
--   1. Column names I assumed, none verified against the live schema:
--      credit_notes(created_by, credit_note_date, credit_note_number, reason,
--        posted_to_ledger), credit_note_items(original_order_id, product_id,
--        variant_id, product_name, unit, quantity), van_stock.created_at,
--      van_stock_items(returned_qty, left_qty, unit), orders.distributor_id.
--   2. A caution on the van path: van_stock_items.product_id is text and holds the
--      variant id for variant lines; confirm that matches how Morning GRN writes it.
--   3. After applying, issue a credit note on staging for (a) a rep with a van day
--      today and (b) a user with no van day. Expect (a) the van line's returned_qty
--      and left_qty up by the quantity and, via the settle trigger,
--      distributor_inventory.on_van_quantity up; (b) quantity up, a RETURN ledger
--      row, damaged_quantity up only for a damaged / expired / quality reason.
--   4. Issue the same credit note's approval twice; inventory must move once.
--   5. Return in a unit that differs from the stock row's unit; expect a
--      credit_note_inventory_log row, no stock change, and the credit note issued.
--
-- NOT COVERED: the existing return that prompted this (made before this trigger
-- existed) is not posted. It would need a one-off call:
--   select public.post_credit_note_to_inventory('<credit_note_id>');
-- Its inventory_posted_at starts out null, so the call posts it once.
