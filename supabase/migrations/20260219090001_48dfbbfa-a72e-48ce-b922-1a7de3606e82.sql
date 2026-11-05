
-- Fix 1: Close all orphaned sessions older than 12 hours
UPDATE public.user_sessions
SET logout_at = login_at + interval '30 minutes',
    is_active = false
WHERE is_active = true
  AND logout_at IS NULL
  AND login_at < now() - interval '12 hours';

-- Fix 2: Replace get_activity_logging_summary with fixed duration logic
CREATE OR REPLACE FUNCTION public.get_activity_logging_summary(p_days integer DEFAULT 7)
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
      -- Fixed: only count latest active session per user, sum closed sessions normally
      WITH ranked_sessions AS (
        SELECT user_id, is_active, login_at, logout_at,
          ROW_NUMBER() OVER (PARTITION BY user_id, is_active ORDER BY login_at DESC) as rn
        FROM public.user_sessions
        WHERE login_at >= now() - (p_days || ' days')::interval
      )
      SELECT user_id, SUM(
        CASE
          WHEN is_active = false AND logout_at IS NOT NULL
            THEN LEAST(EXTRACT(EPOCH FROM (logout_at - login_at)), 57600) -- cap at 16h
          WHEN is_active = true AND rn = 1
            THEN LEAST(EXTRACT(EPOCH FROM (now() - login_at)), 57600) -- only latest active, cap 16h
          ELSE 0 -- ignore orphaned active sessions
        END
      )::bigint as total_seconds
      FROM ranked_sessions
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
