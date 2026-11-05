-- Only administrators may delete a distributor.
--
-- The policy this replaces was called "Field staff can delete distributors" and
-- meant it literally:
--
--   DELETE  to authenticated  using (get_distributor_id_for_auth_user() IS NULL)
--
-- which allows anyone who does not belong to a distributor. Measured against the
-- real users, that is 16 of 20 — including 10 Field Sales Executives, 2 Sales
-- Managers and a Product Manager. Deleting a distributor takes its beats,
-- claims and support requests with it by cascade, so it is not a field action.
--
-- Uses the permission model the admin screens already use, under the object that
-- already exists for this module. No role is hardcoded: can_delete on
-- module_distributor_master is held only by the System Administrator profile
-- today, and granting it to another profile is a decision made in the permission
-- screens rather than in a migration.

drop policy if exists "Field staff can delete distributors" on public.distributors;

create policy "Distributor master managers can delete a distributor"
  on public.distributors for delete
  to authenticated
  using (public.user_has_permission(auth.uid(), 'module_distributor_master', 'can_delete'));
