-- Let the people who administer vans actually save one.
--
-- THE PROBLEM. vans was writable only through "Admins can manage vans", which
-- tests has_role(uid,'admin'). user_roles holds 14 rows and every one of them
-- is 'user' -- no row anywhere carries 'admin'. So nothing could be written to
-- this table at all, which the data corroborates: no van has ever been updated.
--
-- Worse, the two gates disagreed. The screen opens on profile permissions
-- (useAdminAccess -> hasAnyAdminPermission), so a user could reach the form,
-- fill it in, press save, and have RLS reject the write while the UI suggested
-- it had worked.
--
-- THE FIX uses the permission model this system already runs on --
-- user_has_permission, the same function van_stock's own policies use -- and
-- the van objects that already exist and are already granted:
--   admin_van_create  create
--   admin_van_edit    edit
--   admin_van_sales   the module-level grant, accepted for either
-- Three users hold all of these today, which is the same set the screen lets
-- in. No role is hardcoded, no policy is bypassed, and nobody gains access they
-- did not already have on paper.
--
-- The has_role policy is left in place rather than replaced: if an admin role
-- is granted later it should keep working, and removing a security policy is
-- not this change's business.
drop policy if exists "Van administrators can create vans" on public.vans;
create policy "Van administrators can create vans"
  on public.vans for insert to authenticated
  with check (
    public.user_has_permission(auth.uid(), 'admin_van_create', 'can_create')
    or public.user_has_permission(auth.uid(), 'admin_van_sales', 'can_create')
  );

drop policy if exists "Van administrators can update vans" on public.vans;
create policy "Van administrators can update vans"
  on public.vans for update to authenticated
  using (
    public.user_has_permission(auth.uid(), 'admin_van_edit', 'can_edit')
    or public.user_has_permission(auth.uid(), 'admin_van_sales', 'can_edit')
  )
  with check (
    public.user_has_permission(auth.uid(), 'admin_van_edit', 'can_edit')
    or public.user_has_permission(auth.uid(), 'admin_van_sales', 'can_edit')
  );

-- Deliberately NOT adding a delete policy. Nothing in the screen deletes a van,
-- and a van with history behind it should be deactivated rather than removed.
-- Granting a capability the product does not use is how permissions drift.
