-- Van Reconciliation stops calling a balanced day a shortfall.
--
-- This screen is the distributor's view of every van day: loaded, sold,
-- returned, counted, and the variance between them. Its variance was
--
--     counted - expected        where expected = start - sold + returned
--
-- which ignores the three return buckets entirely. The same mistake the
-- Closing GRN made, in a second place.
--
-- It held only while the buckets were empty. A rep who returned a thousand
-- grams to the warehouse and counted nothing left on the van was reported as a
-- thousand grams short, and the row was tinted red as an unexplained variance.
-- The only way to show a clean day was to leave the buckets blank, which is the
-- one thing that actually loses the figures.
--
-- Pre-filling the closing split from the day's credit notes is what makes this
-- urgent rather than theoretical: the buckets are no longer almost always zero,
-- so correctly closed days would start failing this check routinely.
--
-- The identity, as on the Closing GRN:
--
--     expected = counted + good + damaged + expired + variance
--
-- The split columns are read directly, with no fallback to returned_qty. The
-- displayed returned_good column does fall back, so that a historical day whose
-- split was never captured still shows something useful -- but returned_qty
-- means goods coming ONTO the van and is already inside expected, so counting
-- it again here would invent a variance rather than remove one.
--
-- That fallback difference is deliberate and has a useful consequence: for a
-- day with no split recorded, good, damaged and expired are all zero and the
-- formula collapses to counted - expected, exactly what it was. So no
-- historical row on this screen changes its variance. Only days that actually
-- carry a split are affected, and those are the ones that were wrong.
--
-- Days nobody counted still report null rather than zero, unchanged: "it
-- balanced" and "nobody looked" remain different facts.
--
-- Dropped and recreated because CREATE OR REPLACE cannot widen RETURNS TABLE,
-- and this adds returned_expired to it. Grants do not survive the drop, so the
-- lines at the bottom restate them exactly: execute to authenticated, nothing
-- to PUBLIC.

drop function if exists public.dms_van_reconciliation(uuid, date, date);

create or replace function public.dms_van_reconciliation(
  p_distributor uuid,
  p_from date default null::date,
  p_to date default null::date
)
returns table(
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
  returned_expired numeric,
  counted numeric,
  expected numeric,
  variance numeric,
  variance_reason text,
  lines integer,
  lines_counted integer,
  settled_at timestamp with time zone
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
    -- Falls back to returned_qty so a day recorded before the closing split
    -- existed still shows what came back. Display only; see the variance below.
    coalesce(sum(coalesce(i.returned_good_qty, i.returned_qty, 0)), 0),
    coalesce(sum(coalesce(i.returned_damaged_qty, 0)), 0),
    coalesce(sum(coalesce(i.returned_expired_qty, 0)), 0),
    sum(i.counted_qty),
    coalesce(sum(coalesce(i.start_qty,0) - coalesce(i.ordered_qty,0) + coalesce(i.returned_qty,0)), 0),
    -- expected = counted + good + damaged + expired + variance.
    --
    -- No fallback to returned_qty on the three buckets here, unlike the display
    -- column above: returned_qty is goods arriving ON the van and is already
    -- inside expected, so adding it again would manufacture a variance. With no
    -- split recorded all three are zero and this is counted - expected, which
    -- is what it has always been for those days.
    --
    -- Only lines that were actually counted contribute a variance. A day with
    -- no counts shows null rather than a confident zero, because "nobody
    -- looked" and "it balanced" are not the same thing.
    sum(coalesce(i.counted_qty, 0)
        + coalesce(i.returned_good_qty, 0)
        + coalesce(i.returned_damaged_qty, 0)
        + coalesce(i.returned_expired_qty, 0)
        - (coalesce(i.start_qty,0) - coalesce(i.ordered_qty,0) + coalesce(i.returned_qty,0)))
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
