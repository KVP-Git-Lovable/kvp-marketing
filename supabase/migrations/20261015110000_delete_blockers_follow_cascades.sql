-- Follow the cascades, not just the first level.
--
-- The previous version looked only at tables referencing distributors directly,
-- and so reported "Sri Tirumala Warehouses" as deletable. It is not: deleting a
-- distributor cascades into warehouses, and warehouses is itself blocked by
-- inventory_batches, distributor_inventory, distributor_inventory_transactions,
-- packing_lists and van_stock. The delete failed on a constraint the check had
-- never looked at, which is the same class of bug as the message that named a
-- constraint instead of a reason.
--
-- Walks the cascade graph breadth-first from the distributor: a blocking
-- reference is reported, a cascading one is followed. `via` names the table the
-- obstacle hangs off when it is not the distributor itself, so the screen can
-- say "under its warehouses" rather than leaving someone hunting for an
-- inventory batch that has no visible connection to the distributor.
--
-- Depth is capped at 4. Nothing in this schema goes past 2, and a cap means a
-- cascade cycle added later degrades to an incomplete answer rather than a hang.
drop function if exists public.distributor_delete_blockers(uuid);

create or replace function public.distributor_delete_blockers(p_distributor_id uuid)
returns table (
  referencing_table text,
  referencing_column text,
  row_count bigint,
  sample_names text,
  via text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
DECLARE
  queue jsonb;
  item jsonb;
  r record;
  child_rows text;
  n bigint;
  s text;
  depth int;
BEGIN
  IF p_distributor_id IS NULL THEN RETURN; END IF;

  -- Each entry carries the SQL that selects the rows of that table which the
  -- delete would remove, so a child's set is built from its parent's.
  queue := jsonb_build_array(jsonb_build_object(
    'tbl', 'public.distributors',
    'rows', 'select * from public.distributors where id = $1',
    'depth', 0
  ));

  WHILE jsonb_array_length(queue) > 0 LOOP
    item  := queue -> 0;
    queue := queue - 0;
    depth := (item ->> 'depth')::int;

    FOR r IN
      SELECT con.conrelid::regclass::text AS child,
             ca.attname::text AS ccol,
             pa.attname::text AS refcol,
             con.confdeltype AS dtype,
             EXISTS (
               SELECT 1 FROM pg_attribute na
               WHERE na.attrelid = con.conrelid
                 AND na.attname = 'name' AND na.attnum > 0 AND NOT na.attisdropped
             ) AS has_name
      FROM pg_constraint con
      JOIN pg_attribute ca ON ca.attrelid = con.conrelid  AND ca.attnum = con.conkey[1]
      JOIN pg_attribute pa ON pa.attrelid = con.confrelid AND pa.attnum = con.confkey[1]
      WHERE con.confrelid = (item ->> 'tbl')::regclass
        AND con.contype = 'f'
        AND array_length(con.conkey, 1) = 1
      ORDER BY 1
    LOOP
      child_rows := format(
        'select * from %s where %I in (select t.%I from (%s) t)',
        r.child, r.ccol, r.refcol, item ->> 'rows');

      EXECUTE format('select count(*) from (%s) x', child_rows)
        INTO n USING p_distributor_id;

      CONTINUE WHEN n = 0;

      IF r.dtype IN ('a', 'r') THEN
        s := NULL;
        -- Three is enough to recognise what is meant; past that the count says
        -- more than a truncated list would.
        IF r.has_name AND n <= 3 THEN
          EXECUTE format(
            'select string_agg(q.name, '', '' order by q.name)
               from (select name from (%s) z where name is not null
                     order by name limit 3) q', child_rows)
          INTO s USING p_distributor_id;
        END IF;

        referencing_table  := r.child;
        referencing_column := r.ccol;
        row_count          := n;
        sample_names       := s;
        via := CASE WHEN depth = 0 THEN NULL
                    ELSE replace(item ->> 'tbl', 'public.', '') END;
        RETURN NEXT;

      ELSIF r.dtype = 'c' AND depth < 4 THEN
        queue := queue || jsonb_build_object(
          'tbl', r.child,
          'rows', child_rows,
          'depth', depth + 1
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

revoke all on function public.distributor_delete_blockers(uuid) from public;
grant execute on function public.distributor_delete_blockers(uuid) to authenticated;
