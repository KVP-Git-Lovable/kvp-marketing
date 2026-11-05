CREATE OR REPLACE FUNCTION public.get_activity_logging_summary(p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  cutoff timestamptz;
  has_access boolean := false;
BEGIN
  -- Check system admin OR admin permissions via profile_object_permissions
  has_access := is_system_admin(auth.uid());
  
  IF NOT has_access THEN
    SELECT EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN profile_object_permissions pop ON pop.profile_id = up.profile_id
      WHERE up.user_id = auth.uid()
        AND pop.object_name LIKE 'admin_%'
        AND pop.can_read = true
    ) INTO has_access;
  END IF;

  IF NOT has_access THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  cutoff := now() - (p_days || ' days')::interval;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      p.id::text AS user_id,
      COALESCE(p.full_name, p.username, 'Unknown') AS full_name,
      COALESCE((
        SELECT SUM(EXTRACT(EPOCH FROM (a.check_out_time::timestamp - a.check_in_time::timestamp)))::bigint
        FROM attendance a
        WHERE a.user_id = p.id
          AND a.date >= (cutoff::date)
          AND a.check_in_time IS NOT NULL
          AND a.check_out_time IS NOT NULL
      ), 0) AS total_usage_seconds,
      COALESCE((
        SELECT pv.page_path
        FROM user_page_views pv
        WHERE pv.user_id = p.id AND pv.viewed_at >= cutoff
        GROUP BY pv.page_path
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ), '-') AS most_used_module,
      COALESCE((
        SELECT COUNT(*)::int
        FROM user_page_views pv
        WHERE pv.user_id = p.id AND pv.viewed_at >= cutoff
        GROUP BY pv.page_path
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ), 0) AS most_used_count,
      COALESCE((
        SELECT pv.page_path
        FROM user_page_views pv
        WHERE pv.user_id = p.id AND pv.viewed_at >= cutoff
        GROUP BY pv.page_path
        ORDER BY COUNT(*) ASC
        LIMIT 1
      ), '-') AS least_used_module,
      COALESCE((
        SELECT COUNT(*)::int
        FROM user_page_views pv
        WHERE pv.user_id = p.id AND pv.viewed_at >= cutoff
        GROUP BY pv.page_path
        ORDER BY COUNT(*) ASC
        LIMIT 1
      ), 0) AS least_used_count,
      COALESCE((
        SELECT SUM(du.data_bytes)::bigint
        FROM user_data_usage du
        WHERE du.user_id = p.id AND du.recorded_at >= cutoff
      ), 0) AS data_usage_bytes
    FROM profiles p
    WHERE p.user_status = 'active'
      AND EXISTS (
        SELECT 1 FROM attendance a2
        WHERE a2.user_id = p.id AND a2.date >= cutoff::date
      )
    ORDER BY full_name
  ) t;

  RETURN result;
END;
$$;