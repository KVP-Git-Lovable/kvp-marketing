-- Add missing columns to user_page_views
ALTER TABLE user_page_views
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS module_name text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

-- Add missing columns to user_data_usage
ALTER TABLE user_data_usage
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS bytes_uploaded bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bytes_downloaded bigint DEFAULT 0;

-- Update get_activity_logging_summary to use new columns
DROP FUNCTION IF EXISTS public.get_activity_logging_summary(integer);

CREATE OR REPLACE FUNCTION public.get_activity_logging_summary(p_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  cutoff timestamptz;
  has_access boolean := false;
BEGIN
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
        SELECT COALESCE(pv.module_name, pv.page)
        FROM user_page_views pv
        WHERE pv.user_id = p.id AND pv.created_at >= cutoff
        GROUP BY COALESCE(pv.module_name, pv.page)
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ), '-') AS most_used_module,
      COALESCE((
        SELECT COUNT(*)::int
        FROM user_page_views pv
        WHERE pv.user_id = p.id AND pv.created_at >= cutoff
        GROUP BY COALESCE(pv.module_name, pv.page)
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ), 0) AS most_used_count,
      COALESCE((
        SELECT COALESCE(pv.module_name, pv.page)
        FROM user_page_views pv
        WHERE pv.user_id = p.id AND pv.created_at >= cutoff
        GROUP BY COALESCE(pv.module_name, pv.page)
        ORDER BY COUNT(*) ASC
        LIMIT 1
      ), '-') AS least_used_module,
      COALESCE((
        SELECT COUNT(*)::int
        FROM user_page_views pv
        WHERE pv.user_id = p.id AND pv.created_at >= cutoff
        GROUP BY COALESCE(pv.module_name, pv.page)
        ORDER BY COUNT(*) ASC
        LIMIT 1
      ), 0) AS least_used_count,
      COALESCE((
        SELECT SUM(COALESCE(du.bytes_uploaded, 0) + COALESCE(du.bytes_downloaded, 0))::bigint
        FROM user_data_usage du
        WHERE du.user_id = p.id AND du.created_at >= cutoff
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
$function$;