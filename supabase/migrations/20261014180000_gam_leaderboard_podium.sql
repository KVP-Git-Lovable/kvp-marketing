-- leaderboard_snapshots is a PODIUM, not a full board: staging constrains it to
-- rank 1..3 and the banner history renders it as "top performers". The refresh
-- job never honoured that, so:
--   * in STAGING every run with more than three earners aborted on
--     leaderboard_snapshots_rank_check, leaving the podium frozen at whatever
--     an older version of the job had written;
--   * in PROD, which never got that constraint, it quietly stored EVERY earner
--     (17 rows for October, down to rank 17), so the banner listed the whole
--     company as top performers.
-- Capped at three, which is the shape both the constraint and the UI expect.
create or replace function public.gam_refresh_leaderboard(p_period_type text default 'month')
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_start timestamptz; v_end timestamptz; v_label text; v_rows integer;
  v_store_type text;
BEGIN
  IF p_period_type IN ('week', 'weekly') THEN
    v_start := date_trunc('week', now()); v_end := v_start + interval '1 week';
    v_label := to_char(v_start, 'IYYY-"W"IW');
    v_store_type := 'weekly';
  ELSIF p_period_type = 'all_time' THEN
    v_start := '-infinity'::timestamptz; v_end := 'infinity'::timestamptz; v_label := 'All time';
    v_store_type := 'all_time';
  ELSE
    v_start := date_trunc('month', now()); v_end := v_start + interval '1 month';
    v_label := to_char(v_start, 'YYYY-MM');
    v_store_type := 'monthly';
  END IF;

  DELETE FROM public.leaderboard_snapshots
  WHERE period_type = v_store_type AND period_label = v_label;

  INSERT INTO public.leaderboard_snapshots
    (period_type, period_start, period_end, period_label, user_id, rank, total_points, full_name, profile_picture_url, captured_at)
  SELECT v_store_type,
         CASE WHEN v_start = '-infinity'::timestamptz THEN now() - interval '100 years' ELSE v_start END,
         CASE WHEN v_end = 'infinity'::timestamptz THEN now() ELSE v_end END,
         v_label,
         r.user_id,
         r.rn,
         r.total,
         r.full_name,
         NULL,
         now()
  FROM (
    SELECT t.user_id,
           t.total,
           p.full_name,
           ROW_NUMBER() OVER (ORDER BY t.total DESC, p.full_name) AS rn
    FROM (
      SELECT gp.user_id, SUM(gp.points) AS total
      FROM public.gamification_points gp
      JOIN public.gamification_actions a ON a.id = gp.action_id
      WHERE gp.status = 'active'
        AND (gp.expires_at IS NULL OR gp.expires_at > now())
        AND COALESCE(a.leaderboard, true)
        AND gp.earned_at >= v_start AND gp.earned_at < v_end
      GROUP BY gp.user_id
    ) t
    JOIN public.profiles p ON p.id = t.user_id
    LEFT JOIN public.employees e ON e.user_id = p.id
    -- people who have left do not keep a place on the podium
    WHERE p.is_active IS NOT FALSE
      AND COALESCE(p.user_status::text, 'active') = 'active'
      AND (e.date_of_exit IS NULL OR e.date_of_exit > now())
  ) r
  WHERE r.rn <= 3;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$function$;
