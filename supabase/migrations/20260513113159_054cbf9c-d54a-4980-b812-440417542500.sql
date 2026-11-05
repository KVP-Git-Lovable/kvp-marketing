
CREATE OR REPLACE FUNCTION public.partial_ownership_transfer(p_from uuid, p_to uuid, p_payload jsonb, p_dry_run boolean DEFAULT false, p_caller uuid DEFAULT NULL::uuid)
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
  v_cl_count int := 0; v_cl_amt numeric := 0;
  v_dp_count int := 0; v_dp_amt numeric := 0;
  v_ic_count int := 0; v_ic_amt numeric := 0;
  v_to_name text;
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

  SELECT COALESCE(NULLIF(trim(full_name), ''), username) INTO v_to_name
    FROM public.profiles WHERE id = p_to;

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

  IF v_retailer_ids IS NOT NULL THEN
    PERFORM 1 FROM public.retailers WHERE id = ANY(v_retailer_ids) FOR UPDATE;

    IF NOT p_dry_run THEN
      IF v_transfer_ownership THEN
        UPDATE public.retailers
          SET owner_id = p_to, user_id = p_to
          WHERE id = ANY(v_retailer_ids) AND (owner_id = p_from OR user_id = p_from);
      ELSE
        UPDATE public.retailers
          SET user_id = p_to
          WHERE id = ANY(v_retailer_ids) AND (owner_id = p_from OR user_id = p_from);
      END IF;
      GET DIAGNOSTICS v_count = ROW_COUNT;

      WITH affected_beats AS (
        SELECT DISTINCT beat_id
        FROM public.retailers
        WHERE id = ANY(v_retailer_ids)
          AND beat_id IS NOT NULL
          AND beat_id <> ''
          AND beat_id <> 'unassigned'
      ), beat_consensus AS (
        SELECT
          r.beat_id,
          count(DISTINCT r.user_id) FILTER (WHERE r.user_id IS NOT NULL) AS assignee_count,
          max((r.user_id)::text) FILTER (WHERE r.user_id IS NOT NULL)::uuid AS resolved_user_id,
          count(DISTINCT r.owner_id) FILTER (WHERE r.owner_id IS NOT NULL) AS owner_count,
          max((r.owner_id)::text) FILTER (WHERE r.owner_id IS NOT NULL)::uuid AS resolved_owner_id
        FROM public.retailers r
        JOIN affected_beats ab ON ab.beat_id = r.beat_id
        GROUP BY r.beat_id
      )
      UPDATE public.beats b
      SET user_id = bc.resolved_user_id,
          owner_id = CASE
            WHEN v_transfer_ownership AND bc.owner_count = 1 AND bc.resolved_owner_id IS NOT NULL THEN bc.resolved_owner_id
            ELSE b.owner_id
          END,
          owner_name = CASE
            WHEN v_transfer_ownership AND bc.owner_count = 1 AND bc.resolved_owner_id = p_to THEN v_to_name
            ELSE b.owner_name
          END
      FROM beat_consensus bc
      WHERE b.beat_id = bc.beat_id
        AND bc.assignee_count = 1
        AND bc.resolved_user_id IS NOT NULL
        AND (
          b.user_id IS DISTINCT FROM bc.resolved_user_id
          OR (
            v_transfer_ownership
            AND bc.owner_count = 1
            AND bc.resolved_owner_id IS NOT NULL
            AND b.owner_id IS DISTINCT FROM bc.resolved_owner_id
          )
        );
    ELSE
      SELECT count(*) INTO v_count FROM public.retailers
        WHERE id = ANY(v_retailer_ids) AND (owner_id = p_from OR user_id = p_from);
    END IF;
    v_counts := v_counts || jsonb_build_object('retailers', v_count);
  END IF;

  IF v_beat_ids IS NOT NULL THEN
    PERFORM 1 FROM public.beats WHERE beat_id = ANY(v_beat_ids) FOR UPDATE;

    IF NOT p_dry_run THEN
      IF v_transfer_ownership THEN
        UPDATE public.beats
          SET owner_id = p_to, owner_name = v_to_name, user_id = p_to
          WHERE beat_id = ANY(v_beat_ids) AND (owner_id = p_from OR user_id = p_from OR created_by = p_from);
        GET DIAGNOSTICS v_count = ROW_COUNT;
        UPDATE public.retailers
          SET owner_id = p_to, user_id = p_to
          WHERE beat_id = ANY(v_beat_ids) AND (owner_id = p_from OR user_id = p_from);
      ELSE
        UPDATE public.beats
          SET user_id = p_to
          WHERE beat_id = ANY(v_beat_ids) AND (owner_id = p_from OR user_id = p_from OR created_by = p_from);
        GET DIAGNOSTICS v_count = ROW_COUNT;
        UPDATE public.retailers
          SET user_id = p_to
          WHERE beat_id = ANY(v_beat_ids) AND (owner_id = p_from OR user_id = p_from);
      END IF;
    ELSE
      SELECT count(*) INTO v_count FROM public.beats
        WHERE beat_id = ANY(v_beat_ids) AND (owner_id = p_from OR user_id = p_from OR created_by = p_from);
    END IF;
    v_counts := v_counts || jsonb_build_object('beats', v_count);
  END IF;

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

  SELECT array_agg(DISTINCT rid) INTO v_affected_retailers FROM (
    SELECT unnest(COALESCE(v_retailer_ids, ARRAY[]::uuid[])) AS rid
    UNION
    SELECT id AS rid FROM public.retailers
      WHERE v_beat_ids IS NOT NULL
        AND beat_id = ANY(v_beat_ids)
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

  IF v_include_payments THEN
    v_warnings := v_warnings || jsonb_build_object(
      'bucket','pending_payments',
      'message','Pending-payment visibility is preview-only. Historical financial rows are not reassigned; visibility follows the transferred retailer assignment.'
    );
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'counts', v_counts,
    'warnings', v_warnings,
    'total_records', v_total_records,
    'include_pending_payments', v_include_payments,
    'transfer_ownership', v_transfer_ownership,
    'outstanding_preview', jsonb_build_object(
      'affected_retailers', COALESCE(array_length(v_affected_retailers,1), 0),
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

-- One-time backfill: align Manvith's beats and retailers to Mokshith
-- created_by stays Manvith (history preserved)
UPDATE public.beats
   SET owner_id   = '73044cad-2c19-4a47-89f1-6a755adc3362',
       owner_name = 'Mokshith',
       user_id    = '73044cad-2c19-4a47-89f1-6a755adc3362'
 WHERE created_by = 'd6d364d5-6f19-4da9-bb48-67b04a8065fa'
   AND (
     owner_id   = 'd6d364d5-6f19-4da9-bb48-67b04a8065fa'
     OR user_id = 'd6d364d5-6f19-4da9-bb48-67b04a8065fa'
     OR owner_name ILIKE 'manvith%'
   );

UPDATE public.retailers
   SET owner_id = '73044cad-2c19-4a47-89f1-6a755adc3362',
       user_id  = '73044cad-2c19-4a47-89f1-6a755adc3362'
 WHERE owner_id = 'd6d364d5-6f19-4da9-bb48-67b04a8065fa'
    OR user_id  = 'd6d364d5-6f19-4da9-bb48-67b04a8065fa';
