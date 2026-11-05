-- Name what is in the way, when it has a name.
--
-- "Mangaluru Masala Limited LLC still has 1 distributor under it" leaves the
-- person hunting for which one — and in the case that prompted this, the child
-- was hidden from the Distributor Master list, so it could not be found by
-- looking. Two of the sixteen blocking tables carry a name column (distributors
-- and retailers); the rest are invoices and notes identified by number, where a
-- count is the whole of the useful answer.
--
-- Found from the catalog like everything else here, so a blocking table added
-- later that happens to have a name gets this for free.
drop function if exists public.distributor_delete_blockers(uuid);

create or replace function public.distributor_delete_blockers(p_distributor_id uuid)
returns table (
  referencing_table text,
  referencing_column text,
  row_count bigint,
  sample_names text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
DECLARE
  r record;
  n bigint;
  s text;
BEGIN
  IF p_distributor_id IS NULL THEN RETURN; END IF;

  FOR r IN
    SELECT con.conrelid::regclass::text AS tbl,
           a.attname::text AS col,
           EXISTS (
             SELECT 1 FROM pg_attribute na
             WHERE na.attrelid = con.conrelid
               AND na.attname = 'name'
               AND na.attnum > 0
               AND NOT na.attisdropped
           ) AS has_name
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
      s := NULL;

      -- Three is enough to recognise what is meant; past that the count says
      -- more than a truncated list would.
      IF r.has_name AND n <= 3 THEN
        EXECUTE format(
          'SELECT string_agg(q.name, '', '' ORDER BY q.name)
             FROM (SELECT name FROM %s WHERE %I = $1 AND name IS NOT NULL
                   ORDER BY name LIMIT 3) q',
          r.tbl, r.col)
        INTO s USING p_distributor_id;
      END IF;

      referencing_table := r.tbl;
      referencing_column := r.col;
      row_count := n;
      sample_names := s;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;

revoke all on function public.distributor_delete_blockers(uuid) from public;
grant execute on function public.distributor_delete_blockers(uuid) to authenticated;
