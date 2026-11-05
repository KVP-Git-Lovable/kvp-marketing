-- distributor_types had RLS enabled and then four policies that gave it away:
--
--   "Allow read for all users"    authenticated, anon   using (true)
--   "Allow insert for all users"  authenticated, anon   with check (true)
--   "Allow update for all users"  PUBLIC                using (true)
--   "Allow delete for all users"  PUBLIC                using (true)
--
-- So any unauthenticated caller could rewrite or delete the rows that define the
-- distributor hierarchy. That was already wrong; it matters more now, because
-- the triggers added in 20261014120000 read this table to decide which parent a
-- distributor may have, and the Distributor Master screen builds its tabs from
-- it. Deleting a row here would quietly remove a tier.
--
-- Writes now go through the permission model the rest of the admin screens use,
-- under the object that already exists for this module. No role is hardcoded and
-- nothing is granted to anon.

drop policy if exists "Allow read for all users"   on public.distributor_types;
drop policy if exists "Allow insert for all users" on public.distributor_types;
drop policy if exists "Allow update for all users" on public.distributor_types;
drop policy if exists "Allow delete for all users" on public.distributor_types;

-- Every signed-in user needs to read this: it is how the distributor screens
-- resolve a type to its name, and how the field app resolves the OEM.
create policy "Signed-in users can read distributor types"
  on public.distributor_types for select
  to authenticated
  using (true);

create policy "Distributor master managers can add a type"
  on public.distributor_types for insert
  to authenticated
  with check (public.user_has_permission(auth.uid(), 'module_distributor_master', 'can_create'));

create policy "Distributor master managers can change a type"
  on public.distributor_types for update
  to authenticated
  using (public.user_has_permission(auth.uid(), 'module_distributor_master', 'can_edit'))
  with check (public.user_has_permission(auth.uid(), 'module_distributor_master', 'can_edit'));

create policy "Distributor master managers can remove a type"
  on public.distributor_types for delete
  to authenticated
  using (public.user_has_permission(auth.uid(), 'module_distributor_master', 'can_delete'));
