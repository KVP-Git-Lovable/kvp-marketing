CREATE OR REPLACE FUNCTION public.get_missed_day_retailers(p_user uuid, p_date date)
RETURNS TABLE(visit_id uuid, retailer_id uuid, retailer_name text, city text, beat_id text, beat_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (p_user = auth.uid() OR public.is_subordinate_of(auth.uid(), p_user)) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v.id, v.retailer_id, r.name, r.city, r.beat_id, r.beat_name
  FROM visits v
  LEFT JOIN retailers r ON r.id = v.retailer_id
  WHERE v.user_id = p_user
    AND v.planned_date = p_date
    AND v.status IN ('planned','cancelled')
  ORDER BY r.name NULLS LAST;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reschedule_missed_visits(p_user uuid, p_from_date date, p_visit_ids uuid[], p_to_date date DEFAULT NULL::date)
RETURNS TABLE(moved integer, to_date date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_to date;
  v_count integer;
BEGIN
  IF NOT (p_user = auth.uid() OR public.is_subordinate_of(auth.uid(), p_user)) THEN
    RETURN;
  END IF;

  v_to := COALESCE(p_to_date, public.next_free_day(p_user, p_from_date));
  IF v_to IS NULL THEN
    RAISE EXCEPTION 'No free day available this month';
  END IF;

  WITH updated AS (
    UPDATE visits v
    SET planned_date = v_to,
        status = 'planned',
        cancel_source = NULL,
        is_rescheduled = true,
        rescheduled_from_date = p_from_date,
        updated_at = now()
    WHERE v.user_id = p_user
      AND v.planned_date = p_from_date
      AND v.status IN ('planned','cancelled')
      AND v.id = ANY(p_visit_ids)
      AND NOT EXISTS (
        SELECT 1 FROM visits v2
        WHERE v2.user_id = p_user
          AND v2.retailer_id = v.retailer_id
          AND v2.planned_date = v_to
          AND v2.status = 'planned'
      )
    RETURNING 1
  )
  SELECT COUNT(*)::integer INTO v_count FROM updated;

  moved := v_count;
  to_date := v_to;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_missed_day_retailers(uuid, date) FROM public;
REVOKE ALL ON FUNCTION public.reschedule_missed_visits(uuid, date, uuid[], date) FROM public;
GRANT EXECUTE ON FUNCTION public.get_missed_day_retailers(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_missed_visits(uuid, date, uuid[], date) TO authenticated;