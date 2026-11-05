-- Primary side of a distributor, and whether the next order is coming.
--
-- The prediction is the point: stock on hand divided by how fast the
-- distributor's own shops are actually pulling it through. `last_issued_date`
-- on distributor_inventory is null on every row and total_value is mostly
-- zero, so neither can carry this -- secondary sell-through is the only live
-- depletion signal in the data.
create or replace function public.distributor_primary_summary(
  p_distributor_id uuid,
  p_from date default null,
  p_to date default null
) returns jsonb
language sql stable security definer set search_path to 'public'
as $function$
with dist as (select id, name, credit_limit, outstanding_amount from distributors where id = p_distributor_id),
b as (
  select coalesce(p_from, (date_trunc('month', current_date) - interval '11 months')::date) as d_from,
         coalesce(p_to, current_date) as d_to
),
mine as (
  select r.id from retailers r where r.distributor_id = p_distributor_id
  union
  select r.id from retailers r join dist d on lower(btrim(r.parent_name)) = lower(btrim(d.name))
  union
  select m.retailer_id from distributor_retailer_mappings m where m.distributor_id = p_distributor_id
),
po as (
  select o.*, coalesce(o.order_date, o.created_at::date) as d
  from primary_orders o
  where (o.distributor_id = p_distributor_id or o.target_distributor_id = p_distributor_id)
    and o.status is distinct from 'cancelled'
),
po_win as (select po.* from po cross join b where po.d between b.d_from and b.d_to),
so as (
  select coalesce(o.order_date, o.created_at::date) as d, o.total_amount, o.id
  from orders o
  where o.retailer_id in (select id from mine) and o.status is distinct from 'cancelled'
),
so_win as (select so.* from so cross join b where so.d between b.d_from and b.d_to),
inv as (
  select lower(btrim(i.product_name)) as pn,
         max(i.product_name) as display,
         case when lower(btrim(max(i.unit))) in ('kg','kgs','kilogram','kilograms',
                                                 'gram','grams','g','gm','gms') then 'KG'
              when lower(btrim(max(i.unit))) in ('ml','l','litre','litres','liter') then 'L'
              else 'PIECE' end as base,
         sum(case when lower(btrim(i.unit)) in ('gram','grams','g','gm','gms') then i.quantity/1000.0
                  when lower(btrim(i.unit)) in ('ml') then i.quantity/1000.0
                  else i.quantity end) as stock,
         max(i.reorder_level) as reorder_level
  from distributor_inventory i
  where i.distributor_id = p_distributor_id
  group by 1
),
burn as (
  select lower(btrim(oi.product_name)) as pn,
         case when lower(btrim(max(oi.unit))) in ('kg','kgs','kilogram','kilograms',
                                                  'gram','grams','g','gm','gms') then 'KG'
              when lower(btrim(max(oi.unit))) in ('ml','l','litre','litres','liter') then 'L'
              else 'PIECE' end as base,
         sum(case when lower(btrim(oi.unit)) in ('gram','grams','g','gm','gms') then oi.quantity/1000.0
                  when lower(btrim(oi.unit)) in ('ml') then oi.quantity/1000.0
                  else oi.quantity end) as sold90
  from order_items oi
  join orders o on o.id = oi.order_id
  where o.retailer_id in (select id from mine)
    and o.status is distinct from 'cancelled'
    and coalesce(o.order_date, o.created_at::date) >= current_date - 90
  group by 1
),
cover as (
  select inv.pn, inv.display, inv.base, inv.stock, inv.reorder_level,
         coalesce(burn.sold90, 0) as sold90,
         case when burn.base is distinct from inv.base then null
              else coalesce(burn.sold90,0) / 90.0 end as daily,
         case when burn.base is distinct from inv.base or coalesce(burn.sold90,0) = 0 then null
              else inv.stock / (burn.sold90 / 90.0) end as days_cover
  from inv left join burn on burn.pn = inv.pn
)
select jsonb_build_object(
  'range', jsonb_build_object('from', (select d_from from b), 'to', (select d_to from b)),
  'primary', (select jsonb_build_object(
      'orders', count(*), 'value', coalesce(sum(total_amount),0),
      'unpaid_value', coalesce(sum(total_amount) filter (
          where payment_status is distinct from 'paid'),0),
      'last_order', (select max(d) from po),
      'days_since_last', (select current_date - max(d) from po),
      'avg_value', case when count(*) > 0 then round(sum(total_amount)/count(*),2) else 0 end
    ) from po_win),
  'secondary', (select jsonb_build_object(
      'orders', count(*), 'value', coalesce(sum(total_amount),0)) from so_win),
  'credit', (select jsonb_build_object(
      'limit', coalesce((select credit_limit_at_order from po order by d desc limit 1), d.credit_limit, 0),
      'outstanding', coalesce((select outstanding_at_order from po order by d desc limit 1), d.outstanding_amount, 0),
      'available', coalesce((select available_credit_at_order from po order by d desc limit 1),
                            d.credit_limit - d.outstanding_amount, 0)) from dist d),
  'flow', coalesce((select jsonb_agg(x order by x.m) from (
      select m, sum(pv) primary_value, sum(sv) secondary_value from (
        select to_char(date_trunc('month', d),'YYYY-MM') m, total_amount pv, 0 sv from po_win
        union all
        select to_char(date_trunc('month', d),'YYYY-MM'), 0, total_amount from so_win
      ) u group by m) x), '[]'::jsonb),
  'inventory', (select jsonb_build_object(
      'skus', count(*),
      'below_reorder', count(*) filter (where reorder_level is not null and stock <= reorder_level),
      'critical', count(*) filter (where days_cover is not null and days_cover < 14),
      'soon', count(*) filter (where days_cover is not null and days_cover >= 14 and days_cover < 30),
      'healthy', count(*) filter (where days_cover is not null and days_cover >= 30),
      'no_signal', count(*) filter (where days_cover is null)) from cover),
  'replenishment', coalesce((select jsonb_agg(x order by x.days_cover nulls last) from (
      select display as product, base as unit,
             round(stock::numeric,2) stock, reorder_level,
             round(coalesce(daily,0)::numeric,3) daily_run,
             round(sold90::numeric,2) sold_90d,
             round(days_cover::numeric,1) days_cover,
             case when days_cover is null then 'no_signal'
                  when days_cover < 14 then 'critical'
                  when days_cover < 30 then 'soon'
                  else 'healthy' end as status,
             case when daily is null or daily = 0 then null
                  else greatest(0, round((daily * 45 - stock)::numeric, 0)) end as suggest_qty
      from cover) x), '[]'::jsonb)
);
$function$;

revoke all on function public.distributor_primary_summary(uuid,date,date) from public, anon;
grant execute on function public.distributor_primary_summary(uuid,date,date) to authenticated;
