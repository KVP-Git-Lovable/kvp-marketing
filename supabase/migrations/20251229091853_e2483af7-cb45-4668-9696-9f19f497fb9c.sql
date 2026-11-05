CREATE OR REPLACE FUNCTION get_productivity_summary(user_full_name TEXT)
RETURNS TABLE (
  full_name TEXT,
  planned_date TEXT,
  productive_visits BIGINT,
  unproductive_visits BIGINT,
  total_visits BIGINT,
  productivity_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.full_name::TEXT,
    TO_CHAR(v.planned_date, 'FMMonth FMDD, YYYY') AS planned_date,
    COUNT(CASE WHEN v.status = 'productive' THEN 1 END) AS productive_visits,
    COUNT(CASE WHEN v.status = 'unproductive' THEN 1 END) AS unproductive_visits,
    COUNT(v.id) AS total_visits,
    ROUND(
      COUNT(CASE WHEN v.status = 'productive' THEN 1 END)::NUMERIC /
      NULLIF(COUNT(v.id), 0) * 100,
      2
    ) AS productivity_percentage
  FROM visits v
  JOIN profiles p ON v.user_id = p.id
  WHERE v.status IN ('productive', 'unproductive')
    AND v.planned_date BETWEEN '2025-12-19' AND '2025-12-26'
    AND p.full_name ILIKE user_full_name
  GROUP BY p.full_name, v.planned_date
  ORDER BY v.planned_date DESC, p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;