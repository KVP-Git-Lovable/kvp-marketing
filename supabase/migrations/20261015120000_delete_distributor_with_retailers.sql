-- Clear the retailers out of the way, then delete the distributor — in one
-- transaction, so there is no state where the retailers have been moved and the
-- distributor is still there.
--
-- Two ways to clear them, and only two, because the schema allows only two:
--
--   reassign  the retailers move to another distributor, keeping everything.
--
--   archive   the retailers stay exactly where they are as rows, marked
--             inactive and detached from the distributor. NOT a delete.
--             A retailer cannot be deleted at all once it has an order
--             (orders.retailer_id is RESTRICT), and where it could be, the
--             delete would cascade away credit_ledger, distributor_retailer_ledger,
--             retailer_payment_collections, retailer_payment_allocations,
--             loyalty points and the audit log. Keeping the row is the only
--             form of "remove it" that leaves the history standing.
--
-- SECURITY DEFINER, and the first thing it does is check the same permission as
-- the delete policy. The definer rights are for reaching retailers whose RLS
-- scopes them to their own beats — not for skipping the rule about who may
-- delete. A caller without it gets nothing.
create or replace function public.delete_distributor_with_retailers(
  p_distributor_id uuid,
  p_retailer_action text,
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
  v_count integer;
  v_blockers text;
  v_deleted integer;
BEGIN
  IF NOT public.user_has_permission(auth.uid(), 'module_distributor_master', 'can_delete') THEN
    RAISE EXCEPTION 'NOT_PERMITTED';
  END IF;

  SELECT name INTO v_name FROM public.distributors WHERE id = p_distributor_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'NO_SUCH_DISTRIBUTOR';
  END IF;

  IF p_retailer_action NOT IN ('reassign', 'archive') THEN
    RAISE EXCEPTION 'BAD_ACTION: %', p_retailer_action;
  END IF;

  IF p_retailer_action = 'reassign' THEN
    IF p_reassign_to IS NULL OR p_reassign_to = p_distributor_id THEN
      RAISE EXCEPTION 'BAD_TARGET';
    END IF;
    SELECT name INTO v_target_name FROM public.distributors WHERE id = p_reassign_to;
    IF v_target_name IS NULL THEN
      RAISE EXCEPTION 'NO_SUCH_TARGET';
    END IF;

    UPDATE public.retailers
       SET distributor_id = p_reassign_to
     WHERE distributor_id = p_distributor_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    -- Detached and marked inactive. Every row, and everything pointing at it,
    -- stays exactly as it was.
    UPDATE public.retailers
       SET distributor_id = NULL,
           status = 'inactive'
     WHERE distributor_id = p_distributor_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  -- Retailers are rarely the only thing in the way. Checking here, rather than
  -- letting the delete fail on a constraint, means the caller is told what is
  -- left in the same words the screen uses everywhere else — and the whole
  -- transaction rolls back, so the retailers are not left moved.
  SELECT string_agg(b.referencing_table || '=' || b.row_count
                    || coalesce(' via ' || b.via, ''), ', ' ORDER BY b.row_count DESC)
    INTO v_blockers
    FROM public.distributor_delete_blockers(p_distributor_id) b;

  IF v_blockers IS NOT NULL THEN
    RAISE EXCEPTION 'STILL_BLOCKED: %', v_blockers;
  END IF;

  DELETE FROM public.distributors WHERE id = p_distributor_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted <> 1 THEN
    RAISE EXCEPTION 'NOT_DELETED';
  END IF;

  RETURN jsonb_build_object(
    'distributor', v_name,
    'action', p_retailer_action,
    'retailers', v_count,
    'moved_to', v_target_name
  );
END;
$function$;

revoke all on function public.delete_distributor_with_retailers(uuid, text, uuid) from public;
grant execute on function public.delete_distributor_with_retailers(uuid, text, uuid) to authenticated;
