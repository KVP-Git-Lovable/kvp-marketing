
CREATE OR REPLACE FUNCTION public.get_activity_logging_summary(p_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_window_start timestamptz;
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: System Administrator required';
  END IF;

  v_window_start := date_trunc('day', now()) - ((p_days - 1) || ' days')::interval;

  SELECT jsonb_agg(row_data) INTO result
  FROM (
    SELECT jsonb_build_object(
      'user_id', p.id,
      'full_name', COALESCE(p.full_name, p.username, 'Unknown'),
      'total_usage_seconds', COALESCE(att.total_seconds, -1),
      'most_used_module', COALESCE(most.module_name, '-'),
      'most_used_count', COALESCE(most.visit_count, 0),
      'least_used_module', COALESCE(least.module_name, '-'),
      'least_used_count', COALESCE(least.visit_count, 0),
      'data_usage_bytes', COALESCE(du.total_bytes, 0)
    ) as row_data
    FROM public.profiles p
    INNER JOIN (
      -- Users who have either attendance or page views in the window
      SELECT user_id FROM public.attendance
      WHERE check_in_time >= v_window_start AND check_in_time <= now()
      UNION
      SELECT user_id FROM public.user_page_views
      WHERE visited_at >= v_window_start
    ) active_users ON active_users.user_id = p.id
    LEFT JOIN (
      SELECT
        user_id,
        SUM(
          EXTRACT(EPOCH FROM (COALESCE(check_out_time, now()) - check_in_time))
        )::bigint AS total_seconds
      FROM public.attendance
      WHERE check_in_time >= v_window_start
        AND check_in_time <= now()
      GROUP BY user_id
    ) att ON att.user_id = p.id
    LEFT JOIN LATERAL (
      SELECT module_name, COUNT(*)::integer as visit_count
      FROM public.user_page_views
      WHERE user_id = p.id AND visited_at >= v_window_start
      GROUP BY module_name
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) most ON true
    LEFT JOIN LATERAL (
      SELECT module_name, COUNT(*)::integer as visit_count
      FROM public.user_page_views
      WHERE user_id = p.id AND visited_at >= v_window_start
      GROUP BY module_name
      ORDER BY COUNT(*) ASC
      LIMIT 1
    ) least ON true
    LEFT JOIN (
      SELECT user_id, SUM(bytes_uploaded + bytes_downloaded)::bigint as total_bytes
      FROM public.user_data_usage
      WHERE recorded_at >= v_window_start
      GROUP BY user_id
    ) du ON du.user_id = p.id
    ORDER BY COALESCE(att.total_seconds, -1) DESC
  ) sub;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$function$;
