-- An archived company is not the company.
--
-- get_oem_distributor_id() took the oldest OEM, which was fine while there was
-- one. There are now two: a live "KVP Business Solutions COMPANY" and an
-- archived "KVP Business Solutions Pvt. Ltd." created earlier — so the function
-- was returning the archived one, and anything routed "to the company" would
-- have gone to a record deliberately taken out of the network.
--
-- My own omission: archiving was added without teaching this to ignore it.
--
-- Archived rows are skipped outright rather than merely ranked last. If every
-- OEM is archived the answer is nothing, which a caller can check, instead of a
-- confident pointer at a record nobody meant to use.
create or replace function public.get_oem_distributor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $function$
  select d.id
  from public.distributors d
  join public.distributor_types t on t.id = d.type_id
  where t.code = 'OEM'
    and d.archived_at is null
  order by d.created_at
  limit 1;
$function$;

revoke all on function public.get_oem_distributor_id() from public;
grant execute on function public.get_oem_distributor_id() to authenticated;
