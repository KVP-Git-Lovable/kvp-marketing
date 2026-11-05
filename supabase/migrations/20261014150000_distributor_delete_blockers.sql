-- Why a distributor cannot be deleted, in words the screen can use.
--
-- Sixteen tables reference distributors with a blocking foreign key, so a delete
-- fails with "violates foreign key constraint retailers_distributor_id_fkey",
-- which tells the person nothing about what to do. Worse, the Distributor Detail
-- screen writes a recycle-bin entry before attempting the delete, so every
-- refusal left a bin entry claiming a distributor was deleted when it was not.
--
-- Read from the catalog rather than a list kept here: a table added later is
-- picked up without this function being reopened, which is exactly the kind of
-- drift that produced the misleading count on the screen in the first place.
--
-- SECURITY DEFINER on purpose. The foreign keys bind regardless of who is
-- looking, so a caller who cannot see the retailers still needs to be told the
-- retailers are there. Only table names and counts are returned, never any row.
create or replace function public.distributor_delete_blockers(p_distributor_id uuid)
returns table (referencing_table text, referencing_column text, row_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $function$
DECLARE
  r record;
  n bigint;
BEGIN
  IF p_distributor_id IS NULL THEN RETURN; END IF;

  FOR r IN
    SELECT con.conrelid::regclass::text AS tbl, a.attname::text AS col
    FROM pg_constraint con
    JOIN pg_attribute a
      ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.confrelid = 'public.distributors'::regclass
      AND con.contype = 'f'
      -- 'a' = NO ACTION, 'r' = RESTRICT. Both refuse the delete; CASCADE and
      -- SET NULL resolve themselves and are not worth reporting.
      AND con.confdeltype IN ('a', 'r')
      AND array_length(con.conkey, 1) = 1
    ORDER BY 1
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.tbl, r.col)
      INTO n USING p_distributor_id;

    IF n > 0 THEN
      referencing_table := r.tbl;
      referencing_column := r.col;
      row_count := n;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;

revoke all on function public.distributor_delete_blockers(uuid) from public;
grant execute on function public.distributor_delete_blockers(uuid) to authenticated;
