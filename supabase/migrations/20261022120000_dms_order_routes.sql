-- How each secondary order reaches the retailer: on a van, in a packing list,
-- or not yet either. Read by the distributor portal's Secondary Sales page.
--
-- An order does not carry its van. Nothing in the app writes
-- orders.assigned_van_id; the app treats an order as a van sale when the same
-- rep has a van_stock day on the order's date (vanStockSync.ts and
-- CancelOrderDialog.tsx use the same rule). This function applies that rule in
-- one place, preferring an explicit assigned_van_id when there is one.
--
--   packing_list   orders.packing_list_id is set
--   van            assigned_van_id is set, or the rep has a van day on that date
--   none           neither
--
-- A packing list outranks an inferred van: it is an explicit link; the van is a
-- guess from rep and date. When the rep has more than one van that day the van
-- is ambiguous, so the order is still 'van' but van_id and van_registration are
-- null rather than naming the wrong vehicle.
--
-- SECURITY DEFINER because portal users cannot read van_stock under its RLS.
-- Rows are returned only for orders the caller could already read: a portal user
-- of the order's distributor (portal_can_read_order), an admin, the rep who took
-- the order, or that rep's manager.

create or replace function public.dms_order_routes(p_order_ids uuid[])
 returns table(
   order_id uuid,
   route text,
   van_id uuid,
   van_registration text,
   packing_list_id uuid,
   packing_list_number text
 )
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select
    o.id,
    case
      when o.packing_list_id is not null then 'packing_list'
      when o.assigned_van_id is not null or vd.van_count > 0 then 'van'
      else 'none'
    end,
    case when o.packing_list_id is not null then null
         else coalesce(o.assigned_van_id, case when vd.van_count = 1 then vd.van_id end) end,
    v.registration_number,
    o.packing_list_id,
    pl.packing_list_number
  from public.orders o
  left join lateral (
    select count(distinct vs.van_id) as van_count, min(vs.van_id::text)::uuid as van_id
    from public.van_stock vs
    where vs.user_id = o.user_id and vs.stock_date = o.order_date
  ) vd on true
  left join public.vans v
    on v.id = coalesce(o.assigned_van_id, case when vd.van_count = 1 then vd.van_id end)
   and o.packing_list_id is null
  left join public.packing_lists pl on pl.id = o.packing_list_id
  where o.id = any(p_order_ids)
    and (
      public.portal_can_read_order(o.id)
      or public.has_role(auth.uid(), 'admin'::app_role)
      or o.user_id = auth.uid()
      or public.is_subordinate_of(auth.uid(), o.user_id)
    )
$function$;

revoke all on function public.dms_order_routes(uuid[]) from public;
grant execute on function public.dms_order_routes(uuid[]) to authenticated;
