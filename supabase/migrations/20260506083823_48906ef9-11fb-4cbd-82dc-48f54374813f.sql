CREATE OR REPLACE FUNCTION public.partial_ownership_transfer(
  p_from uuid,
  p_to uuid,
  p_payload jsonb,
  p_dry_run boolean DEFAULT false,
  p_caller uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := COALESCE(p_caller, auth.uid());
  v_counts jsonb := '{}'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_retailer_ids uuid[];
  v_beat_ids text[];
  v_territory_ids uuid[];
  v_distributor_ids uuid[];
  v_van_ids uuid[];
  v_direct_report_ids uuid[];
  v_confirm_dr boolean := COALESCE((p_payload->>'confirmTransferDirectReports')::boolean, false);
  v_include_payments boolean := COALESCE((p_payload->>'include_pending_payments')::boolean, false);
  v_transfer_ownership boolean := COALESCE((p_payload->>'transfer_ownership')::boolean, false);
  v_count int;
  v_total_records int := 0;
  v_max_records int := 500;
  v_reason text := COALESCE(p_payload->>'transfer_reason', '');
  v_affected_retailers uuid[];
  v_outstanding_count int := 0;
  v_outstanding_amount numeric := 0;
  v_beat_alien_count int := 0;
  v_cl_count int := 0; v_cl_amt numeric := 0;
  v_dp_count int := 0; v_dp_amt numeric := 0;
  v_ic_count int := 0; v_ic_amt numeric := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'permission denied: caller unknown';
  END IF;
  IF NOT public.is_system_admin(v_caller) THEN
    RAISE EXCEPTION 'permission denied: requires system admin';
  END IF;
  IF p_from = p_to THEN
    RAISE EXCEPTION 'self-transfer not allowed';
  END IF;
  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'p_from and p_to are required';
  END IF;
  IF NOT p_dry_run AND (v_reason IS NULL OR length(trim(v_reason)) < 3) THEN
    RAISE EXCEPTION 'transfer_reason is required (min 3 chars)';
  END IF;

  IF p_payload ? 'retailers' THEN
    SELECT array_agg((value)::uuid) INTO v_retailer_ids FROM jsonb_array_elements_text(p_payload->'retailers');
  END IF;
  IF p_payload ? 'beats' THEN
    SELECT array_agg(value) INTO v_beat_ids FROM jsonb_array_elements_text(p_payload->'beats');
  END IF;
  IF p_payload ? 'territories' THEN
    SELECT array_agg((value)::uuid) INTO v_territory_ids FROM jsonb_array_elements_text(p_payload->'territories');
  END IF;
  IF p_payload ? 'distributors' THEN
    SELECT array_agg((value)::uuid) INTO v_distributor_ids FROM jsonb_array_elements_text(p_payload->'distributors');
  END IF;
  IF p_payload ? 'vans' THEN
    SELECT array_agg((value)::uuid) INTO v_van_ids FROM jsonb_array_elements_text(p_payload->'vans');
  END IF;
  IF p_payload ? 'direct_reports' THEN
    SELECT array_agg((value)::uuid) INTO v_direct_report_ids FROM jsonb_array_elements_text(p_payload->'direct_reports');
  END IF;

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
  IF v_direct_report_ids IS NOT NULL AND array_length(v_direct_report_ids,1) > 0 AND NOT v_confirm_dr THEN
    RAISE EXCEPTION 'direct_reports transfer requires confirmTransferDirectReports=true';
  END IF;

  -- ============ RETAILERS ============
  -- Selection is keyed on owner_id (the source-of-truth list of "what this user has").
  -- Default mode (assignee-only): only user_id is moved, owner_id stays with the source user
  --   so historical revenue continues to attribute to them. Pending payments stay visible
  --   to the new user because they filter by user_id.
  -- Ownership mode: both user_id and owner_id move (full handover, revenue moves too).
  IF v_retailer_ids IS NOT NULL THEN
    PERFORM 1 FROM public.retailers WHERE id = ANY(v_retailer_ids) FOR UPDATE;

    SELECT count(*) INTO v_count FROM public.retailers
      WHERE id = ANY(v_retailer_ids) AND owner_id IS DISTINCT FROM p_from;
    IF v_count > 0 THEN
      v_warnings := v_warnings || jsonb_build_object(
        'bucket','retailers',
        'message', v_count || ' selected retailer(s) are not currently owned by source user'
      );
    END IF;

    IF NOT p_dry_run THEN
      IF v_transfer_ownership THEN
        UPDATE public.retailers
          SET owner_id = p_to, user_id = p_to
          WHERE id = ANY(v_retailer_ids) AND owner_id = p_from;
      ELSE
        UPDATE public.retailers
          SET user_id = p_to
          WHERE id = ANY(v_retailer_ids) AND owner_id = p_from;
      END IF;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT count(*) INTO v_count FROM public.retailers
        WHERE id = ANY(v_retailer_ids) AND owner_id = p_from;
    END IF;
    v_counts := v_counts || jsonb_build_object('retailers', v_count);
  END IF;

  -- ============ BEATS ============
  -- Default mode: only the retailers under the beat get user_id moved; beat ownership stays.
  -- Ownership mode: beat owner_id and retailer owner_id+user_id all move.
  IF v_beat_ids IS NOT NULL THEN
    PERFORM 1 FROM public.beats WHERE beat_id = ANY(v_beat_ids) FOR UPDATE;

    SELECT count(*) INTO v_beat_alien_count FROM public.retailers
      WHERE beat_id = ANY(v_beat_ids) AND (owner_id IS DISTINCT FROM p_from);
    IF v_beat_alien_count > 0 THEN
      v_warnings := v_warnings || jsonb_build_object(
        'bucket','beats',
        'message', v_beat_alien_count || ' retailer(s) under selected beats are not owned by the source user and will NOT auto-move'
      );
    END IF;

    IF NOT p_dry_run THEN
      IF v_transfer_ownership THEN
        UPDATE public.beats SET owner_id = p_to
          WHERE beat_id = ANY(v_beat_ids) AND owner_id = p_from;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        UPDATE public.retailers
          SET owner_id = p_to, user_id = p_to
          WHERE beat_id = ANY(v_beat_ids) AND owner_id = p_from;
      ELSE
        -- Assignee-only: don't touch beats.owner_id; cascade user_id to retailers under those beats
        UPDATE public.retailers
          SET user_id = p_to
          WHERE beat_id = ANY(v_beat_ids) AND owner_id = p_from;
        SELECT count(*) INTO v_count FROM public.beats
          WHERE beat_id = ANY(v_beat_ids) AND owner_id = p_from;
      END IF;
    ELSE
      SELECT count(*) INTO v_count FROM public.beats
        WHERE beat_id = ANY(v_beat_ids) AND owner_id = p_from;
    END IF;
    v_counts := v_counts || jsonb_build_object('beats', v_count);
  END IF;

  -- ============ TERRITORIES (assigned_user_id only) ============
  -- assigned_user_id is the assignee. We always move it; owner_id is unaffected by this RPC.
  IF v_territory_ids IS NOT NULL THEN
    PERFORM 1 FROM public.territories WHERE id = ANY(v_territory_ids) FOR UPDATE;
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

  -- ============ DISTRIBUTORS ============
  -- Only one assignment column (owner_id). In assignee-only mode we still update owner_id here
  -- because there is no separate assignee column — distributors aren't tied to revenue history.
  IF v_distributor_ids IS NOT NULL THEN
    PERFORM 1 FROM public.distributors WHERE id = ANY(v_distributor_ids) FOR UPDATE;
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

  -- ============ VANS ============
  IF v_van_ids IS NOT NULL THEN
    PERFORM 1 FROM public.vans WHERE id = ANY(v_van_ids) FOR UPDATE;
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

  -- ============ DIRECT REPORTS ============
  IF v_direct_report_ids IS NOT NULL THEN
    PERFORM 1 FROM public.employees WHERE user_id = ANY(v_direct_report_ids) FOR UPDATE;
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

  -- Affected retailer set for outstanding-payment preview
  SELECT array_agg(DISTINCT rid) INTO v_affected_retailers FROM (
    SELECT unnest(COALESCE(v_retailer_ids, ARRAY[]::uuid[])) AS rid
    UNION
    SELECT id AS rid FROM public.retailers
      WHERE v_beat_ids IS NOT NULL
        AND beat_id = ANY(v_beat_ids)
        AND owner_id = p_from
  ) s WHERE rid IS NOT NULL;

  IF v_affected_retailers IS NOT NULL AND array_length(v_affected_retailers,1) > 0 THEN
    SELECT count(*), COALESCE(sum(amount),0) INTO v_cl_count, v_cl_amt
      FROM public.credit_ledger WHERE retailer_id = ANY(v_affected_retailers);
    SELECT count(*), COALESCE(sum(amount),0) INTO v_dp_count, v_dp_amt
      FROM public.distributor_payments
      WHERE retailer_id = ANY(v_affected_retailers)
        AND COALESCE(status,'') IN ('pending','open','unpaid','partial');
    SELECT count(*), COALESCE(sum(amount),0) INTO v_ic_count, v_ic_amt
      FROM public.inst_collections
      WHERE COALESCE(status,'') IN ('pending','open','unpaid','partial');
    v_outstanding_count := v_cl_count + v_dp_count + v_ic_count;
    v_outstanding_amount := v_cl_amt + v_dp_amt + v_ic_amt;
  END IF;

  IF v_include_payments AND v_affected_retailers IS NOT NULL AND array_length(v_affected_retailers,1) > 0 THEN
    v_counts := v_counts ||
      jsonb_build_object('pending_credit_ledger', v_cl_count) ||
      jsonb_build_object('pending_distributor_payments', v_dp_count) ||
      jsonb_build_object('pending_inst_collections', v_ic_count);
    v_warnings := v_warnings || jsonb_build_object(
      'bucket','pending_payments',
      'message', 'Pending payments are surfaced for review only. Reassignment of owning user on financial tables is not yet enabled — existing entries remain visible to both users via retailer ownership.'
    );
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'from', p_from,
    'to', p_to,
    'counts', v_counts,
    'warnings', v_warnings,
    'total_records', v_total_records,
    'reason', v_reason,
    'transfer_ownership', v_transfer_ownership,
    'include_pending_payments', v_include_payments,
    'outstanding_preview', jsonb_build_object(
      'affected_retailers', COALESCE(array_length(v_affected_retailers,1),0),
      'open_records', v_outstanding_count,
      'total_amount', v_outstanding_amount,
      'breakdown', jsonb_build_object(
        'credit_ledger', jsonb_build_object('count', v_cl_count, 'amount', v_cl_amt),
        'distributor_payments', jsonb_build_object('count', v_dp_count, 'amount', v_dp_amt),
        'inst_collections', jsonb_build_object('count', v_ic_count, 'amount', v_ic_amt)
      )
    )
  );
END;
$function$;