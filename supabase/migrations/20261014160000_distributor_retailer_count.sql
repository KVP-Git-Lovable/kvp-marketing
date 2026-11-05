-- How many retailers a distributor actually has.
--
-- The Distributor Detail card used to show network_retailers_count, a number
-- typed into the profile form, under the label "Retailers" — so Sahuayo read 0
-- while ten retailers pointed at it, and the delete that followed was refused by
-- a foreign key the screen had given no hint of.
--
-- Counting the retailers directly from the screen does not fix it: retailers_select
-- scopes rows to the viewer's own retailers and beats, so a Distributor Master
-- user counting Sahuayo's retailers gets 0 as well. Measured, not assumed.
--
-- SECURITY DEFINER for the same reason as distributor_delete_blockers: the
-- foreign key binds regardless of who is looking, so someone deciding whether a
-- distributor can be deleted has to be told what is attached to it. A count of
-- rows, never a row.
create or replace function public.distributor_retailer_count(p_distributor_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $function$
  select count(*) from public.retailers r where r.distributor_id = p_distributor_id;
$function$;

revoke all on function public.distributor_retailer_count(uuid) from public;
grant execute on function public.distributor_retailer_count(uuid) to authenticated;
