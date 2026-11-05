-- The figures the network view puts beside each distributor, in one read.
--
-- SECURITY DEFINER for the reason distributor_retailer_count already is:
-- retailers_select scopes rows to the viewer's own beats, so counting from the
-- browser reports 0 for a distributor with ten. Counts only, never a row.
--
-- One call for the whole network rather than four per distributor selected.
create or replace function public.distributor_network_summary()
returns table (
  distributor_id uuid,
  retailers bigint,
  warehouses bigint,
  orders_placed bigint,
  children bigint
)
language sql
stable
security definer
set search_path = public
as $function$
  select d.id,
         (select count(*) from public.retailers r      where r.distributor_id = d.id),
         (select count(*) from public.warehouses w     where w.distributor_id = d.id),
         (select count(*) from public.primary_orders o where o.source_distributor_id = d.id),
         (select count(*) from public.distributors c   where c.parent_id = d.id)
  from public.distributors d;
$function$;

revoke all on function public.distributor_network_summary() from public;
grant execute on function public.distributor_network_summary() to authenticated;
