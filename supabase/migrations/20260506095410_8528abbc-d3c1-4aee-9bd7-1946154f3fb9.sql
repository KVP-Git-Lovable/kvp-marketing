CREATE OR REPLACE FUNCTION public.transfer_user_data_partial(
  p_from uuid,
  p_to uuid,
  p_payload jsonb,
  p_dry_run boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retailer_ids uuid[] := NULL;
  v_beat_ids uuid[] := NULL;
  v_territory_ids uuid[] := NULL;
  v_distributor_ids uuid[] := NULL;
  v_van_ids uuid[] := NULL;
  v_direct_report_ids uuid[] := NULL;
  v_confirm_dr boolean := COALESCE((p_payload->>'confirmTransferDirectReports')::boolean, false);
  v_reason text := COALESCE(p_payload->>'transferReason','');
  v_count int := 0;
  v_total_records int := 0;
  v_counts jsonb := '{}'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_include_payments boolean := COALESCE((p_payload->>'include_pending_payments')::boolean, false);
  v_transfer_ownership boolean := COALESCE((p_payload->>'transfer_ownership')::boolean, false);
  v_affected_retailers uuid[];
  v_outstanding_count int := 0;
  v_outstanding_amount numeric := 0;
  v_cl_count int := 0;
  v_cl_amt numeric := 0;
  v_dp_count int := 0;
  v_dp_amt numeric := 0;
  v_ic_count int := 0;
  v_ic_amt numeric := 0;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from = p_to THEN
    RAISE EXCEPTION 'Invalid from/to users';
  END IF;

  v_retailer_ids := CASE WHEN p_payload ? 'retailers' THEN ARRAY(SELECT (jsonb_array_elements_text(p_payload->'retailers'))::uuid) END;
  v_beat_ids := CASE WHEN p_payload ? 'beats' THEN ARRAY(SELECT (jsonb_array_elements_text(p_payload->'beats'))::uuid) END;
  v_territory_ids := CASE WHEN p_payload ? 'territories' THEN ARRAY(SELECT (jsonb_array_elements_text(p_payload->'territories'))::uuid) END;
  v_distributor_ids := CASE WHEN p_payload ? 'distributors' THEN ARRAY(SELECT (jsonb_array_elements_text(p_payload->'distributors'))::uuid) END;
  v_van_ids := CASE WHEN p_payload ? 'vans' THEN ARRAY(SELECT (jsonb_array_elements_text(p_payload->'vans'))::uuid) END;
  v_direct_report_ids := CASE WHEN p_payload ? 'direct_reports' THEN ARRAY(SELECT (jsonb_array_elements_text(p_payload->'direct_reports'))::uuid) END;

  -- Retailers
  IF v_retailer_ids IS NOT NULL THEN
    PERFORM 1 FROM public.retailers WHERE id = ANY(v_retailer_ids) FOR UPDATE;
    IF NOT p_dry_run THEN
      UPDATE public.retailers SET user_id = p_to
        WHERE id = ANY(v_retailer_ids) AND user_id = p_from;
      IF v_transfer_ownership THEN
        UPDATE public.retailers SET owner_id = p_to
          WHERE id = ANY(v_retailer_ids) AND owner_id = p_from;
      END IF;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT count(*) INTO v_count FROM public.retailers
        WHERE id = ANY(v_retailer_ids) AND user_id = p_from;
    END IF;
    v_counts := v_counts || jsonb_build_object('retailers', v_count);
    v_total_records := v_total_records + v_count;
  END IF;

  -- Beats
  IF v_beat_ids IS NOT NULL THEN
    IF NOT p_dry_run THEN
      UPDATE public.beats SET user_id = p_to::text
        WHERE beat_id = ANY(v_beat_ids) AND user_id = p_from::text;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      -- Move retailer assignment under those beats
      UPDATE public.retailers SET user_id = p_to
        WHERE beat_id::uuid = ANY(v_beat_ids) AND user_id = p_from;
      IF v_transfer_ownership THEN
        UPDATE public.retailers SET owner_id = p_to
          WHERE beat_id::uuid = ANY(v_beat_ids) AND owner_id = p_from;
      END IF;
    ELSE
      SELECT count(*) INTO v_count FROM public.beats
        WHERE beat_id = ANY(v_beat_ids) AND user_id = p_from::text;
    END IF;
    v_counts := v_counts || jsonb_build_object('beats', v_count);
    v_total_records := v_total_records + v_count;
  END IF;

  -- Territories
  IF v_territory_ids IS NOT NULL THEN
    IF NOT p_dry_run THEN
      UPDATE public.territories SET user_id = p_to
        WHERE id = ANY(v_territory_ids) AND user_id = p_from;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT count(*) INTO v_count FROM public.territories
        WHERE id = ANY(v_territory_ids) AND user_id = p_from;
    END IF;
    v_counts := v_counts || jsonb_build_object('territories', v_count);
    v_total_records := v_total_records + v_count;
  END IF;

  -- Distributors
  IF v_distributor_ids IS NOT NULL THEN
    IF NOT p_dry_run THEN
      UPDATE public.distributors SET user_id = p_to
        WHERE id = ANY(v_distributor_ids) AND user_id = p_from;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT count(*) INTO v_count FROM public.distributors
        WHERE id = ANY(v_distributor_ids) AND user_id = p_from;
    END IF;
    v_counts := v_counts || jsonb_build_object('distributors', v_count);
    v_total_records := v_total_records + v_count;
  END IF;

  -- Vans
  IF v_van_ids IS NOT NULL THEN
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

  -- Direct reports
  IF v_direct_report_ids IS NOT NULL THEN
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

  -- Affected retailers for outstanding preview
  SELECT array_agg(DISTINCT rid) INTO v_affected_retailers FROM (
    SELECT unnest(COALESCE(v_retailer_ids, ARRAY[]::uuid[])) AS rid
    UNION
    SELECT id AS rid FROM public.retailers
      WHERE v_beat_ids IS NOT NULL
        AND beat_id::uuid = ANY(v_beat_ids)
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

  IF v_outstanding_count > 0 THEN
    v_warnings := v_warnings || jsonb_build_object(
      'bucket','pending_payments',
      'message', 'Pending payments will be visible to the new user (via transferred retailer ownership) so they can collect them. Revenue from those collections is credited to the original user — historical revenue is preserved. New orders placed by the new user after this transfer will be credited to the new user automatically.'
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
$$;