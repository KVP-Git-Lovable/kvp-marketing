-- Milestones on the total weight of a purchase event.
--
-- Order-level, not per SKU: one threshold for the whole event, the same shape
-- as the value ladder. Line weight is quantity * the line's snapshotted net
-- weight per selling unit; the event's weight is the sum across its lines.
--
-- UNWEIGHABLE LINES. A line whose product has no net weight configured cannot
-- be weighed, and is reported rather than counted as zero. Summing only what
-- is known means the engine can under-award but never over-award, which is the
-- right way round: a missing weight delays a reward, it does not invent one.
-- unweighed_lines carries the count so the admin screen and the award panel
-- can say why a milestone has not landed.
--
-- No UoM conversion is touched. uom_master, conversion_to_base, base_unit and
-- conversion_factor are all left alone; net weight is its own attribute.
drop function if exists public.gam_retailer_purchase_events(uuid);

create function public.gam_retailer_purchase_events(p_retailer uuid)
returns table (
  ordinal integer,
  event_key text,
  first_at timestamptz,
  order_value numeric,
  order_quantity numeric,
  order_weight_kg numeric,
  unweighed_lines integer,
  weighed_lines integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with o as (
    select ord.id,
           coalesce(ord.visit_id::text, 'day:' || ord.order_date::text) as event_key,
           ord.order_date,
           ord.created_at,
           coalesce(ord.total_amount, 0)::numeric as val
    from public.orders ord
    where ord.retailer_id = p_retailer
      and coalesce(ord.status, '') not in ('cancelled', 'replaced')
      -- The remainder of a purchase already counted, not a new one.
      and coalesce(ord.is_backorder, false) = false
  ),
  li as (
    select o.event_key,
           coalesce(sum(oi.quantity), 0)::numeric as qty,
           coalesce(sum(oi.quantity * oi.net_weight_g) filter (where oi.net_weight_g is not null), 0)::numeric / 1000 as kg,
           count(*) filter (where oi.net_weight_g is null)::integer as unweighed,
           count(*) filter (where oi.net_weight_g is not null)::integer as weighed
    from o join public.order_items oi on oi.order_id = o.id
    group by o.event_key
  ),
  ev as (
    select o.event_key,
           min(o.order_date) as d,
           min(o.created_at) as first_at,
           sum(o.val) as order_value
    from o group by o.event_key
  )
  select (row_number() over (order by ev.d, ev.first_at, ev.event_key))::integer,
         ev.event_key, ev.first_at, ev.order_value,
         coalesce(li.qty, 0), coalesce(li.kg, 0),
         coalesce(li.unweighed, 0), coalesce(li.weighed, 0)
  from ev left join li on li.event_key = ev.event_key;
$function$;

revoke all on function public.gam_retailer_purchase_events(uuid) from public;
grant execute on function public.gam_retailer_purchase_events(uuid) to authenticated;


-- Judge a rung on value, raw quantity, or weight in kilograms.
create or replace function public.gam_milestone_met(
  p_retailer uuid, p_ordinal integer, p_basis text, p_operator text, p_threshold numeric
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((
    select case coalesce(p_operator, '>=')
             when '>='  then actual >= p_threshold
             when '>'   then actual >  p_threshold
             when '<='  then actual <= p_threshold
             when '<'   then actual <  p_threshold
             when '='   then actual =  p_threshold
             else false
           end
    from (
      select case coalesce(p_basis, 'order_value')
               when 'order_quantity' then e.order_quantity
               when 'order_weight'   then e.order_weight_kg
               else e.order_value
             end as actual
      from public.gam_retailer_purchase_events(p_retailer) e
      where e.ordinal = p_ordinal
    ) hit
  ), false);
$function$;

revoke all on function public.gam_milestone_met(uuid, integer, text, text, numeric) from public;
grant execute on function public.gam_milestone_met(uuid, integer, text, text, numeric) to authenticated;


alter table public.activity_tiers drop constraint if exists activity_tiers_basis_check;
alter table public.activity_tiers add constraint activity_tiers_basis_check
  check (basis is null or basis in ('order_value', 'order_quantity', 'order_weight'));
