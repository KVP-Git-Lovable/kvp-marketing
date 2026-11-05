-- Archiving: the answer to "delete it completely, but keep the history".
--
-- A distributor cannot actually be deleted once it has traded. 38 foreign keys
-- point at it — 16 that refuse the delete and 22 that would destroy inventory,
-- ledgers, payments and warehouses to allow it. The row itself is a name and a
-- few contact fields; it is the only thing making all of that history readable,
-- and removing it would cost far more than it saves.
--
-- So the row stays and stops being visible. Archived distributors drop out of
-- every list, count and picker, and every record naming them still makes sense.
-- Reversible, because nothing was destroyed.

alter table public.distributors add column if not exists archived_at timestamptz;
alter table public.distributors add column if not exists archived_by uuid;

comment on column public.distributors.archived_at is
  'When this distributor was archived. Non-null means it is hidden from every list, count and picker, while all of its history stays intact and attributable. Not a delete: see archive_distributor().';

-- Archived rows are the exception, so the index covers the common case of
-- "everything still live".
create index if not exists distributors_live_idx on public.distributors (id) where archived_at is null;


-- Archive, dealing with the retailers on the way.
--
-- Unlike deleting, this needs nothing cleared first — that is the point. The
-- retailers are asked about anyway, because leaving active retailers pointing
-- at a distributor nobody can see is a different kind of mess.
create or replace function public.archive_distributor(
  p_distributor_id uuid,
  p_retailer_action text default 'leave',
  p_reassign_to uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
DECLARE
  v_name text;
  v_target_name text;
  v_count integer := 0;
BEGIN
  IF NOT public.user_has_permission(auth.uid(), 'module_distributor_master', 'can_delete') THEN
    RAISE EXCEPTION 'NOT_PERMITTED';
  END IF;

  SELECT name INTO v_name FROM public.distributors
   WHERE id = p_distributor_id AND archived_at IS NULL;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'NO_SUCH_DISTRIBUTOR';
  END IF;

  IF p_retailer_action NOT IN ('leave', 'reassign', 'archive') THEN
    RAISE EXCEPTION 'BAD_ACTION: %', p_retailer_action;
  END IF;

  IF p_retailer_action = 'reassign' THEN
    IF p_reassign_to IS NULL OR p_reassign_to = p_distributor_id THEN
      RAISE EXCEPTION 'BAD_TARGET';
    END IF;
    SELECT name INTO v_target_name FROM public.distributors
     WHERE id = p_reassign_to AND archived_at IS NULL;
    IF v_target_name IS NULL THEN
      RAISE EXCEPTION 'NO_SUCH_TARGET';
    END IF;

    UPDATE public.retailers SET distributor_id = p_reassign_to
     WHERE distributor_id = p_distributor_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;

  ELSIF p_retailer_action = 'archive' THEN
    UPDATE public.retailers SET distributor_id = NULL, status = 'inactive'
     WHERE distributor_id = p_distributor_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  UPDATE public.distributors
     SET archived_at = now(), archived_by = auth.uid()
   WHERE id = p_distributor_id;

  RETURN jsonb_build_object(
    'distributor', v_name,
    'retailer_action', p_retailer_action,
    'retailers', v_count,
    'moved_to', v_target_name
  );
END;
$function$;


-- Bring one back. Nothing was destroyed, so this is a straight reversal; the
-- retailers that were moved or archived are not followed back, because where
-- they belong now is a separate decision.
create or replace function public.unarchive_distributor(p_distributor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
DECLARE v_name text;
BEGIN
  IF NOT public.user_has_permission(auth.uid(), 'module_distributor_master', 'can_delete') THEN
    RAISE EXCEPTION 'NOT_PERMITTED';
  END IF;

  UPDATE public.distributors
     SET archived_at = NULL, archived_by = NULL
   WHERE id = p_distributor_id AND archived_at IS NOT NULL
  RETURNING name INTO v_name;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'NOT_ARCHIVED';
  END IF;

  RETURN jsonb_build_object('distributor', v_name);
END;
$function$;

revoke all on function public.archive_distributor(uuid, text, uuid) from public;
grant execute on function public.archive_distributor(uuid, text, uuid) to authenticated;
revoke all on function public.unarchive_distributor(uuid) from public;
grant execute on function public.unarchive_distributor(uuid) to authenticated;
