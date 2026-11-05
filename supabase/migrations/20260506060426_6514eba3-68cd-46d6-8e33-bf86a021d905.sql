
-- Partial Ownership Transfer RPC
-- Transfers selected master-data record ownership from one user to another
-- using ONLY safe ownership columns. Never touches creator/history columns.
-- All updates run inside this function's implicit transaction; any RAISE rolls back.

CREATE OR REPLACE FUNCTION public.partial_ownership_transfer(
  p_from uuid,
  p_to uuid,
  p_payload jsonb,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_counts jsonb := '{}'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_retailer_ids uuid[];
  v_beat_ids text[];
  v_territory_ids uuid[];
  v_distributor_ids uuid[];
  v_van_ids uuid[];
  v_direct_report_ids uuid[];
  v_confirm_dr boolean := COALESCE((p_payload->>'confirmTransferDirectReports')::boolean, false);
  v_count int;
  v_total_records int := 0;
  v_max_records int := 500;
  v_reason text := COALESCE(p_payload->>'transfer_reason', '');
BEGIN
  -- Authz: only system admins
  IF NOT public.is_system_admin(v_caller) THEN
    RAISE EXCEPTION 'permission denied: requires system admin';
  END IF;

  -- Self-transfer guard (DB layer)
  IF p_from = p_to THEN
    RAISE EXCEPTION 'self-transfer not allowed';
  END IF;

  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'p_from and p_to are required';
  END IF;

  -- Mandatory reason on real runs
  IF NOT p_dry_run AND (v_reason IS NULL OR length(trim(v_reason)) < 3) THEN
    RAISE EXCEPTION 'transfer_reason is required (min 3 chars)';
  END IF;

  -- Parse selected ID arrays (each may be missing)
  IF p_payload ? 'retailers' THEN
    SELECT array_agg((value)::uuid) INTO v_retailer_ids
    FROM jsonb_array_elements_text(p_payload->'retailers');
  END IF;
  IF p_payload ? 'beats' THEN
    SELECT array_agg(value) INTO v_beat_ids
    FROM jsonb_array_elements_text(p_payload->'beats');
  END IF;
  IF p_payload ? 'territories' THEN
    SELECT array_agg((value)::uuid) INTO v_territory_ids
    FROM jsonb_array_elements_text(p_payload->'territories');
  END IF;
  IF p_payload ? 'distributors' THEN
    SELECT array_agg((value)::uuid) INTO v_distributor_ids
    FROM jsonb_array_elements_text(p_payload->'distributors');
  END IF;
  IF p_payload ? 'vans' THEN
    SELECT array_agg((value)::uuid) INTO v_van_ids
    FROM jsonb_array_elements_text(p_payload->'vans');
  END IF;
  IF p_payload ? 'direct_reports' THEN
    SELECT array_agg((value)::uuid) INTO v_direct_report_ids
    FROM jsonb_array_elements_text(p_payload->'direct_reports');
  END IF;

  -- Total record cap
  v_total_records :=
    COALESCE(array_length(v_retailer_ids,1),0) +
    COALESCE(array_length(v_beat_ids,1),0) +
    COALESCE(array_length(v_territory_ids,1),0) +
    COALESCE(array_length(v_distributor_ids,1),0) +
    COALESCE(array_length(v_van_ids,1),0) +
    COALESCE(array_length(v_direct_report_ids,1),0);

  IF v_total_records = 0 THEN
    RAISE EXCEPTION 'no records selected for transfer';
  END IF;

  IF v_total_records > v_max_records THEN
    RAISE EXCEPTION 'transfer exceeds max % records per request (got %)', v_max_records, v_total_records;
  END IF;

  -- Direct reports gating
  IF v_direct_report_ids IS NOT NULL AND array_length(v_direct_report_ids,1) > 0
     AND NOT v_confirm_dr THEN
    RAISE EXCEPTION 'direct_reports transfer requires confirmTransferDirectReports=true';
  END IF;

  -- ============ RETAILERS (owner_id only) ============
  IF v_retailer_ids IS NOT NULL THEN
    -- Lock & validate ownership
    PERFORM 1 FROM public.retailers
      WHERE id = ANY(v_retailer_ids) FOR UPDATE;

    SELECT count(*) INTO v_count FROM public.retailers
      WHERE id = ANY(v_retailer_ids) AND owner_id IS DISTINCT FROM p_from;
    IF v_count > 0 THEN
      v_warnings := v_warnings || jsonb_build_object(
        'bucket','retailers',
        'message', v_count || ' selected retailer(s) are not currently owned by source user'
      );
    END IF;

    IF NOT p_dry_run THEN
      UPDATE public.retailers SET owner_id = p_to
        WHERE id = ANY(v_retailer_ids) AND owner_id = p_from;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT count(*) INTO v_count FROM public.retailers
        WHERE id = ANY(v_retailer_ids) AND owner_id = p_from;
    END IF;
    v_counts := v_counts || jsonb_build_object('retailers', v_count);
  END IF;

  -- ============ BEATS (owner_id only) ============
  IF v_beat_ids IS NOT NULL THEN
    PERFORM 1 FROM public.beats
      WHERE beat_id = ANY(v_beat_ids) FOR UPDATE;

    IF NOT p_dry_run THEN
      UPDATE public.beats SET owner_id = p_to
        WHERE beat_id = ANY(v_beat_ids) AND owner_id = p_from;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT count(*) INTO v_count FROM public.beats
        WHERE beat_id = ANY(v_beat_ids) AND owner_id = p_from;
    END IF;
    v_counts := v_counts || jsonb_build_object('beats', v_count);
  END IF;

  -- ============ TERRITORIES (assigned_user_id) ============
  IF v_territory_ids IS NOT NULL THEN
    PERFORM 1 FROM public.territories
      WHERE id = ANY(v_territory_ids) FOR UPDATE;

    IF NOT p_dry_run THEN
      UPDATE public.territories SET assigned_user_id = p_to
        WHERE id = ANY(v_territory_ids) AND assigned_user_id = p_from;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT count(*) INTO v_count FROM public.territories
        WHERE id = ANY(v_territory_ids) AND assigned_user_id = p_from;
    END IF;
    v_counts := v_counts || jsonb_build_object('territories', v_count);
  END IF;

  -- ============ DISTRIBUTORS (owner_id) ============
  IF v_distributor_ids IS NOT NULL THEN
    PERFORM 1 FROM public.distributors
      WHERE id = ANY(v_distributor_ids) FOR UPDATE;

    IF NOT p_dry_run THEN
      UPDATE public.distributors SET owner_id = p_to
        WHERE id = ANY(v_distributor_ids) AND owner_id = p_from;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT count(*) INTO v_count FROM public.distributors
        WHERE id = ANY(v_distributor_ids) AND owner_id = p_from;
    END IF;
    v_counts := v_counts || jsonb_build_object('distributors', v_count);
  END IF;

  -- ============ VANS (assigned_user_id) ============
  IF v_van_ids IS NOT NULL THEN
    PERFORM 1 FROM public.vans
      WHERE id = ANY(v_van_ids) FOR UPDATE;

    IF NOT p_dry_run THEN
      UPDATE public.vans SET assigned_user_id = p_to
        WHERE id = ANY(v_van_ids) AND assigned_user_id = p_from;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT count(*) INTO v_count FROM public.vans
        WHERE id = ANY(v_van_ids) AND assigned_user_id = p_from;
    END IF;
    v_counts := v_counts || jsonb_build_object('vans', v_count);
  END IF;

  -- ============ DIRECT REPORTS (employees.manager_id) ============
  IF v_direct_report_ids IS NOT NULL THEN
    PERFORM 1 FROM public.employees
      WHERE user_id = ANY(v_direct_report_ids) FOR UPDATE;

    IF NOT p_dry_run THEN
      UPDATE public.employees SET manager_id = p_to
        WHERE user_id = ANY(v_direct_report_ids) AND manager_id = p_from;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT count(*) INTO v_count FROM public.employees
        WHERE user_id = ANY(v_direct_report_ids) AND manager_id = p_from;
    END IF;
    v_counts := v_counts || jsonb_build_object('direct_reports', v_count);
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'from', p_from,
    'to', p_to,
    'counts', v_counts,
    'warnings', v_warnings,
    'total_records', v_total_records,
    'reason', v_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.partial_ownership_transfer(uuid,uuid,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partial_ownership_transfer(uuid,uuid,jsonb,boolean) TO authenticated;
