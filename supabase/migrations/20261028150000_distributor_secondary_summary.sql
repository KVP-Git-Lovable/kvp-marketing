create or replace function public.distributor_secondary_summary(
  p_distributor_id uuid,
  p_from date default null,
  p_to date default null,
  p_include_cancelled boolean default false
) returns jsonb
language sql stable security definer set search_path to 'public'
as $function$
with dist as (select id, name from distributors where id = p_distributor_id),
b as (
  select coalesce(p_from, (date_trunc('month', current_date) - interval '11 months')::date) as d_from,
         coalesce(p_to, current_date) as d_to
),
p as (select (d_from - (d_to - d_from + 1))::date as d_from, (d_from - 1)::date as d_to from b),
-- A retailer belongs to this distributor by any of the three links the app
-- uses. Matched on equality, not ILIKE: a name holding % or _ would otherwise
-- act as a wildcard and sweep in another distributor's shops.
mine as (
  select r.id from retailers r where r.distributor_id = p_distributor_id
  union
  select r.id from retailers r join dist d on lower(btrim(r.parent_name)) = lower(btrim(d.name))
  union
  select m.retailer_id from distributor_retailer_mappings m where m.distributor_id = p_distributor_id
),
o as (
  select o.id, o.retailer_id, o.retailer_name, o.user_id, o.total_amount, o.status,
         o.is_credit_order, coalesce(o.order_date, o.created_at::date) as d
  from orders o
  where (o.retailer_id in (select id from mine) or o.distributor_id = p_distributor_id)
    and (p_include_cancelled or o.status is distinct from 'cancelled')
),
cur as (select o.* from o cross join b where o.d between b.d_from and b.d_to),
pre as (select o.* from o cross join p where o.d between p.d_from and p.d_to),
-- Lines for the window. `unit` is written seven ways for pieces and four for
-- kilos, and a gram quantity summed raw reads a thousand times too large, so
-- weight folds to KG here and anything not sold by weight is counted apart.
li as (
  select c.id as order_id, btrim(oi.product_name) as product_name, oi.total,
         case when lower(btrim(oi.unit)) in ('kg','kgs','kilogram','kilograms') then oi.quantity
              when lower(btrim(oi.unit)) in ('gram','grams','g','gm','gms') then oi.quantity/1000.0
              else 0 end as kg,
         case when lower(btrim(oi.unit)) in ('kg','kgs','kilogram','kilograms',
                                             'gram','grams','g','gm','gms') then 0
              else oi.quantity end as qty_other
  from order_items oi join cur c on c.id = oi.order_id
),
-- Per order, so every breakdown below can carry KG with a plain join.
ok as (select order_id, sum(kg) as kg from li group by order_id),
c2 as (select cur.*, coalesce(ok.kg,0) as kg from cur left join ok on ok.order_id = cur.id)
select jsonb_build_object(
  'range', jsonb_build_object('from', (select d_from from b), 'to', (select d_to from b)),
  'previous_range', jsonb_build_object('from', (select d_from from p), 'to', (select d_to from p)),
  'totals', (select jsonb_build_object(
      'orders', count(*), 'value', coalesce(sum(total_amount),0),
      'kg', round(coalesce(sum(kg),0)::numeric,2),
      'retailers', count(distinct retailer_id), 'reps', count(distinct user_id),
      'pending_orders', count(*) filter (where status = 'pending'),
      'pending_value', coalesce(sum(total_amount) filter (where status = 'pending'),0),
      'credit_value', coalesce(sum(total_amount) filter (where is_credit_order),0),
      'avg_order_value', case when count(*) > 0 then round(sum(total_amount)/count(*),2) else 0 end
    ) from c2),
  'previous', (select jsonb_build_object(
      'orders', count(*), 'value', coalesce(sum(total_amount),0),
      'retailers', count(distinct retailer_id)) from pre),
  'trend', coalesce((select jsonb_agg(x order by x.m) from (
      select to_char(date_trunc('month', d),'YYYY-MM') as m, count(*) as orders,
             coalesce(sum(total_amount),0) as value, round(coalesce(sum(kg),0)::numeric,2) as kg,
             count(distinct retailer_id) as retailers
      from c2 group by 1) x), '[]'::jsonb),
  'by_rep', coalesce((select jsonb_agg(x order by x.value desc) from (
      select c2.user_id as id, coalesce(pr.full_name,'Unassigned') as name,
             count(*) as orders, coalesce(sum(c2.total_amount),0) as value,
             round(coalesce(sum(c2.kg),0)::numeric,2) as kg,
             count(distinct c2.retailer_id) as retailers
      from c2 left join profiles pr on pr.id = c2.user_id
      group by c2.user_id, pr.full_name) x), '[]'::jsonb),
  'by_retailer', coalesce((select jsonb_agg(x order by x.value desc) from (
      select retailer_id as id, coalesce(max(retailer_name),'(unnamed)') as name,
             count(*) as orders, coalesce(sum(total_amount),0) as value,
             round(coalesce(sum(kg),0)::numeric,2) as kg, max(d) as last_order
      from c2 group by retailer_id) x), '[]'::jsonb),
  'by_product', coalesce((select jsonb_agg(x order by x.value desc) from (
      select product_name as name, count(distinct order_id) as orders,
             coalesce(sum(total),0) as value,
             round(coalesce(sum(kg),0)::numeric,2) as kg,
             round(coalesce(sum(qty_other),0)::numeric,2) as qty_other
      from li group by product_name) x), '[]'::jsonb)
);
$function$;

revoke all on function public.distributor_secondary_summary(uuid,date,date,boolean) from public, anon;
grant execute on function public.distributor_secondary_summary(uuid,date,date,boolean) to authenticated;
