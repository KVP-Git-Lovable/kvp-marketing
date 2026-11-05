-- One row of the Secondary breakdowns, opened up.
-- p_dim is 'rep' | 'retailer' | 'product'; p_key is the id, or the product
-- name, or the literal 'unassigned' for orders carrying no user_id.
create or replace function public.distributor_secondary_drilldown(
  p_distributor_id uuid,
  p_dim text,
  p_key text,
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
mine as (
  select r.id from retailers r where r.distributor_id = p_distributor_id
  union
  select r.id from retailers r join dist d on lower(btrim(r.parent_name)) = lower(btrim(d.name))
  union
  select m.retailer_id from distributor_retailer_mappings m where m.distributor_id = p_distributor_id
),
scoped as (
  select o.id, o.retailer_id, o.retailer_name, o.user_id, o.total_amount, o.status,
         o.invoice_number, coalesce(o.order_date, o.created_at::date) as d
  from orders o cross join b
  where (o.retailer_id in (select id from mine) or o.distributor_id = p_distributor_id)
    and (p_include_cancelled or o.status is distinct from 'cancelled')
    and coalesce(o.order_date, o.created_at::date) between b.d_from and b.d_to
),
-- Orders kept for this row. A product narrows to the orders that contain it.
cur as (
  select s.* from scoped s
  where case p_dim
          when 'rep' then (case when p_key = 'unassigned' then s.user_id is null
                                else s.user_id = nullif(p_key,'')::uuid end)
          when 'retailer' then s.retailer_id = nullif(p_key,'')::uuid
          when 'product' then exists (
            select 1 from order_items oi
            where oi.order_id = s.id and btrim(oi.product_name) = btrim(p_key))
          else false
        end
),
li as (
  select c.id as order_id, c.user_id, c.retailer_id, c.retailer_name, c.d,
         btrim(oi.product_name) as product_name, oi.total, oi.quantity, oi.unit,
         case when lower(btrim(oi.unit)) in ('kg','kgs','kilogram','kilograms') then oi.quantity
              when lower(btrim(oi.unit)) in ('gram','grams','g','gm','gms') then oi.quantity/1000.0
              else 0 end as kg
  from order_items oi join cur c on c.id = oi.order_id
),
-- For a product the money is the product's own lines, not the whole basket
-- those lines happened to arrive in.
lif as (select * from li where p_dim <> 'product' or product_name = btrim(p_key)),
ok as (select order_id, sum(kg) kg, sum(total) val from lif group by order_id),
c2 as (select cur.*, coalesce(ok.kg,0) kg, coalesce(ok.val, cur.total_amount) line_val
       from cur left join ok on ok.order_id = cur.id)
select jsonb_build_object(
  'dim', p_dim,
  'totals', (select jsonb_build_object(
      'orders', count(*),
      'value', coalesce(sum(case when p_dim = 'product' then line_val else total_amount end),0),
      'kg', round(coalesce(sum(kg),0)::numeric,2),
      'retailers', count(distinct retailer_id),
      'reps', count(distinct user_id),
      'first_order', min(d), 'last_order', max(d)) from c2),
  'trend', coalesce((select jsonb_agg(x order by x.m) from (
      select to_char(date_trunc('month', d),'YYYY-MM') m, count(*) orders,
             coalesce(sum(case when p_dim = 'product' then line_val else total_amount end),0) value,
             round(coalesce(sum(kg),0)::numeric,2) kg
      from c2 group by 1) x), '[]'::jsonb),
  'retailers', coalesce((select jsonb_agg(x order by x.value desc) from (
      select retailer_id id, coalesce(max(retailer_name),'(unnamed)') name, count(*) orders,
             coalesce(sum(case when p_dim = 'product' then line_val else total_amount end),0) value,
             round(coalesce(sum(kg),0)::numeric,2) kg, max(d) last_order
      from c2 group by retailer_id) x), '[]'::jsonb),
  'reps', coalesce((select jsonb_agg(x order by x.value desc) from (
      select c2.user_id id, coalesce(pr.full_name,'Unassigned') name, count(*) orders,
             coalesce(sum(case when p_dim = 'product' then c2.line_val else c2.total_amount end),0) value,
             round(coalesce(sum(c2.kg),0)::numeric,2) kg
      from c2 left join profiles pr on pr.id = c2.user_id
      group by c2.user_id, pr.full_name) x), '[]'::jsonb),
  'products', coalesce((select jsonb_agg(x order by x.value desc) from (
      select product_name name, count(distinct order_id) orders,
             coalesce(sum(total),0) value, round(coalesce(sum(kg),0)::numeric,2) kg
      from lif group by product_name) x), '[]'::jsonb),
  'recent_orders', coalesce((select jsonb_agg(x order by x.d desc) from (
      select id, d, retailer_name, invoice_number, status,
             case when p_dim = 'product' then line_val else total_amount end value
      from c2 order by d desc limit 25) x), '[]'::jsonb)
);
$function$;

revoke all on function public.distributor_secondary_drilldown(uuid,text,text,date,date,boolean) from public, anon;
grant execute on function public.distributor_secondary_drilldown(uuid,text,text,date,date,boolean) to authenticated;
