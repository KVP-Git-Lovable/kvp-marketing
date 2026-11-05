-- vans.distributor_id had no foreign key.
--
-- Two consequences, one of which was reported from the field: PostgREST can
-- only embed a related row across a foreign key, so selecting
-- distributors(id, name) from vans failed outright, and the screen concluded a
-- van had no distributor when it plainly did. The other is the ordinary one --
-- nothing stopped the column holding an id no distributor has.
--
-- van_stock.distributor_id, added days ago, does have this constraint. The
-- column it is copied from did not, which is the sort of asymmetry that only
-- shows up when something tries to follow the relationship.
--
-- ON DELETE RESTRICT rather than CASCADE or SET NULL: a distributor with vans
-- attached should not be deletable in passing, and silently orphaning a van
-- from its distributor would detach every future day from the books it belongs
-- to.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vans'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) ilike '%distributors%'
  ) then
    -- Any value that does not point at a real distributor is cleared first,
    -- so the constraint can be added without rejecting existing rows.
    update public.vans v
    set distributor_id = null
    where v.distributor_id is not null
      and not exists (select 1 from public.distributors d where d.id = v.distributor_id);

    alter table public.vans
      add constraint vans_distributor_id_fkey
      foreign key (distributor_id) references public.distributors(id)
      on delete restrict;
  end if;
end $$;
