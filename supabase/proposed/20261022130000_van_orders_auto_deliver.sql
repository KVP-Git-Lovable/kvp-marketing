-- PROPOSED, NOT APPLIED, NOT TESTED. Kept out of supabase/migrations on purpose.
-- Written while the staging database was unreachable; run the checks at the
-- bottom on staging before moving this into supabase/migrations.
--
-- Goal: an order taken on a van is delivered the moment it is taken, so nobody
-- has to mark it by hand.
--
-- Rule (the same one the Secondary Sales page and the van stock sync use):
-- the order is a van sale when assigned_van_id is set, or the rep has a van_stock
-- day on the order's date. An order already in a packing list is left alone.
--
-- WHY AFTER INSERT, NOT BEFORE INSERT
--
-- trg_create_invoice_on_order_confirmed (20260622122747) is
-- "AFTER INSERT OR UPDATE OF status" and only acts when an order arrives as
-- 'confirmed'. A BEFORE INSERT trigger that rewrote the status to 'delivered'
-- would mean that trigger never sees 'confirmed', and van orders would stop
-- getting invoices. Doing it AFTER the insert lets the order be created as
-- 'confirmed' first (invoice, gamification and target triggers all see the
-- usual event), then be moved to 'delivered'. AFTER triggers run in name order,
-- and this one is named so it sorts after the invoice trigger (trg_c... < trg_v...).
-- The UPDATE it issues fires UPDATE OF status triggers; the invoice trigger
-- ignores a move to 'delivered'.
--
-- What it deliberately does not do: touch distributor_inventory, credit_paid_amount
-- or any ledger. A van sale's stock leaves the van (posted by the van day) and its
-- payment is taken at order time.

create or replace function public.tg_van_order_auto_deliver()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.status is distinct from 'confirmed' or new.packing_list_id is not null then
    return null;
  end if;

  if new.assigned_van_id is not null
     or exists (select 1 from public.van_stock vs
                where vs.user_id = new.user_id and vs.stock_date = new.order_date) then
    update public.orders
       set status = 'delivered',
           delivered_at = coalesce(delivered_at, now())
     where id = new.id and status = 'confirmed';
  end if;
  return null;
end;
$function$;

revoke all on function public.tg_van_order_auto_deliver() from public;

drop trigger if exists trg_van_order_auto_deliver on public.orders;
create trigger trg_van_order_auto_deliver
after insert on public.orders
for each row execute function public.tg_van_order_auto_deliver();

-- ---------------------------------------------------------------------------
-- CHECK ON STAGING BEFORE APPLYING
--   1. List every trigger on public.orders and read each one for what it does on
--      status = 'delivered' (gamification, targets, ledgers, notifications):
--        select tgname, pg_get_triggerdef(oid) from pg_trigger
--         where tgrelid = 'public.orders'::regclass and not tgisinternal order by 1;
--   2. Confirm trg_create_invoice_on_order_confirmed sorts before
--      trg_van_order_auto_deliver in that list, and that a van order placed after
--      applying still gets an invoice.
--   3. Confirm orders.delivered_at is a plain timestamp with no check against status.
--   4. Place a van order and a non-van order; only the van order should end at
--      'delivered'.
--
-- ONE-OFF FIX FOR EXISTING ORDERS (run only after the checks, review the count first)
--   select count(*) from public.orders o
--    where o.status = 'confirmed' and o.packing_list_id is null
--      and (o.assigned_van_id is not null
--           or exists (select 1 from public.van_stock vs
--                       where vs.user_id = o.user_id and vs.stock_date = o.order_date));
--   update public.orders o set status = 'delivered', delivered_at = coalesce(delivered_at, now())
--    where o.status = 'confirmed' and o.packing_list_id is null
--      and (o.assigned_van_id is not null
--           or exists (select 1 from public.van_stock vs
--                       where vs.user_id = o.user_id and vs.stock_date = o.order_date));
