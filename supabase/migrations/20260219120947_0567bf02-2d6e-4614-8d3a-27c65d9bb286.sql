
CREATE OR REPLACE FUNCTION public.get_activity_logging_summary(p_days integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: System Administrator required';
  END IF;

  SELECT jsonb_agg(row_data) INTO result
  FROM (
    SELECT jsonb_build_object(
      'user_id', p.id,
      'full_name', COALESCE(p.full_name, p.username, 'Unknown'),
      'total_usage_seconds', COALESCE(sess.total_seconds, 0),
      'most_used_module', COALESCE(most.module_name, '-'),
      'most_used_count', COALESCE(most.visit_count, 0),
      'least_used_module', COALESCE(least.module_name, '-'),
      'least_used_count', COALESCE(least.visit_count, 0),
      'data_usage_bytes', COALESCE(du.total_bytes, 0)
    ) as row_data
    FROM public.profiles p
    INNER JOIN (
      -- Interval-merging algorithm: merge overlapping sessions into wall-clock time
      WITH intervals AS (
        SELECT
          user_id,
          login_at AS s,
          COALESCE(logout_at, now()) AS e
        FROM public.user_sessions
        WHERE login_at >= now() - (p_days || ' days')::interval
      ),
      ordered AS (
        SELECT
          user_id, s, e,
          -- Track whether this row starts a new non-overlapping group
          CASE WHEN s > MAX(e) OVER (
            PARTITION BY user_id ORDER BY s, e
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
          ) THEN 1 ELSE 0 END AS new_group
        FROM intervals
      ),
      grouped AS (
        SELECT
          user_id, s, e,
          SUM(new_group) OVER (PARTITION BY user_id ORDER BY s, e) AS grp
        FROM ordered
      ),
      merged AS (
        SELECT
          user_id,
          MIN(s) AS merged_start,
          MAX(e) AS merged_end
        FROM grouped
        GROUP BY user_id, grp
      )
      SELECT
        user_id,
        SUM(LEAST(EXTRACT(EPOCH FROM (merged_end - merged_start)), 57600))::bigint AS total_seconds
      FROM merged
      GROUP BY user_id
    ) sess ON sess.user_id = p.id
    LEFT JOIN LATERAL (
      SELECT module_name, COUNT(*)::integer as visit_count
      FROM public.user_page_views
      WHERE user_id = p.id AND visited_at >= now() - (p_days || ' days')::interval
      GROUP BY module_name
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) most ON true
    LEFT JOIN LATERAL (
      SELECT module_name, COUNT(*)::integer as visit_count
      FROM public.user_page_views
      WHERE user_id = p.id AND visited_at >= now() - (p_days || ' days')::interval
      GROUP BY module_name
      ORDER BY COUNT(*) ASC
      LIMIT 1
    ) least ON true
    LEFT JOIN (
      SELECT user_id, SUM(bytes_uploaded + bytes_downloaded)::bigint as total_bytes
      FROM public.user_data_usage
      WHERE recorded_at >= now() - (p_days || ' days')::interval
      GROUP BY user_id
    ) du ON du.user_id = p.id
    ORDER BY sess.total_seconds DESC
  ) sub;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$function$;
