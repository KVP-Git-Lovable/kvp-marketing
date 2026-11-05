
-- Step 1: Clean up existing duplicate sessions
-- Close all but the latest active session per user
WITH latest_active AS (
  SELECT DISTINCT ON (user_id) id
  FROM user_sessions
  WHERE is_active = true
  ORDER BY user_id, login_at DESC
)
UPDATE user_sessions
SET logout_at = login_at + interval '30 seconds', is_active = false
WHERE is_active = true
  AND id NOT IN (SELECT id FROM latest_active);

-- Close any orphaned active sessions older than 12 hours
UPDATE user_sessions
SET logout_at = login_at + interval '30 minutes', is_active = false
WHERE is_active = true
  AND login_at < now() - interval '12 hours';

-- Step 2: Replace the RPC with deduplication logic
CREATE OR REPLACE FUNCTION public.get_activity_logging_summary(p_days integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      -- Deduplicate: keep only ONE session per user per minute-window (the longest one)
      -- This eliminates StrictMode / HMR duplicate sessions created within seconds
      WITH deduped AS (
        SELECT DISTINCT ON (user_id, date_trunc('minute', login_at))
          user_id, login_at, logout_at, is_active
        FROM public.user_sessions
        WHERE login_at >= now() - (p_days || ' days')::interval
        ORDER BY user_id, date_trunc('minute', login_at),
          EXTRACT(EPOCH FROM (COALESCE(logout_at, now()) - login_at)) DESC
      ),
      ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id, is_active ORDER BY login_at DESC) as rn
        FROM deduped
      )
      SELECT user_id, SUM(
        CASE
          WHEN is_active = false AND logout_at IS NOT NULL
            THEN LEAST(EXTRACT(EPOCH FROM (logout_at - login_at)), 57600)
          WHEN is_active = true AND rn = 1
            THEN LEAST(EXTRACT(EPOCH FROM (now() - login_at)), 57600)
          ELSE 0
        END
      )::bigint as total_seconds
      FROM ranked
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
$$;
