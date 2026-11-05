-- Van reconciliation for the distributor portal.
--
-- A SECURITY DEFINER function rather than a view, because van_stock is not
-- readable by a distributor user: its policies cover admins, managers and the
-- rep who owns the day. The distributor needs to see the days that affect
-- THEIR books without being handed the whole van module, so the authorisation
-- here mirrors the one on distributor_inventory exactly -- an active row in
-- distributor_users, an admin, or a parent distributor.
--
-- The parent case is deliberate and matches the existing "Parent distributors
-- can view child inventory" policy; a parent that can already see the child's
-- stock would gain nothing from being blind to how it moved.
--
-- This is the screen that makes Option B2 safe to run. The van and the DMS are
-- two systems holding one truth, so they can disagree; somebody has to be shown
-- when they do, and which days have not posted at all.
create or replace function public.dms_van_reconciliation(
  p_distributor uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  van_stock_id uuid,
  stock_date date,
  van_id uuid,
  van_registration text,
  rep_name text,
  status text,
  loaded numeric,
  sold numeric,
  returned_good numeric,
  returned_damaged numeric,
  counted numeric,
  expected numeric,
  variance numeric,
  variance_reason text,
  lines integer,
  lines_counted integer,
  settled_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    vs.id,
    vs.stock_date,
    vs.van_id,
    v.registration_number,
    p.full_name,
    vs.status,
    coalesce(sum(i.start_qty), 0),
    coalesce(sum(i.ordered_qty), 0),
    coalesce(sum(coalesce(i.returned_good_qty, i.returned_qty, 0)), 0),
    coalesce(sum(coalesce(i.returned_damaged_qty, 0)), 0),
    sum(i.counted_qty),
    coalesce(sum(coalesce(i.start_qty,0) - coalesce(i.ordered_qty,0) + coalesce(i.returned_qty,0)), 0),
    -- Only lines that were actually counted contribute a variance. A day with
    -- no counts shows null rather than a confident zero, because "nobody
    -- looked" and "it balanced" are not the same thing.
    sum(i.counted_qty - (coalesce(i.start_qty,0) - coalesce(i.ordered_qty,0) + coalesce(i.returned_qty,0)))
      filter (where i.counted_qty is not null),
    vs.variance_reason,
    count(i.id)::integer,
    count(i.counted_qty)::integer,
    max(dp.last_settled_at)
  from public.van_stock vs
  join public.vans v on v.id = vs.van_id
  left join public.profiles p on p.id = vs.user_id
  left join public.van_stock_items i on i.van_stock_id = vs.id
  left join public.van_day_postings dp on dp.van_stock_id = vs.id
  where vs.distributor_id = p_distributor
    and (p_from is null or vs.stock_date >= p_from)
    and (p_to   is null or vs.stock_date <= p_to)
    and (
      exists (
        select 1 from public.distributor_users du
        where du.auth_user_id = auth.uid()
          and du.distributor_id = p_distributor
          and du.is_active = true
      )
      or public.has_role(auth.uid(), 'admin'::app_role)
      or public.is_system_admin(auth.uid())
      or public.can_view_distributor(p_distributor)
    )
  group by vs.id, vs.stock_date, vs.van_id, v.registration_number, p.full_name,
           vs.status, vs.variance_reason
  order by vs.stock_date desc, v.registration_number;
$function$;

revoke all on function public.dms_van_reconciliation(uuid, date, date) from public;
grant execute on function public.dms_van_reconciliation(uuid, date, date) to authenticated;
