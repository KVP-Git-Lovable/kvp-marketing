-- Everyone on the leaderboard can now open everyone's drill-down, read-only.
--
-- gam_person_detail used to refuse outright when the viewer was neither the
-- subject nor their manager, so the whole breakdown was hidden and a peer saw
-- a padlock. It now returns the same rows either way and blanks the columns
-- that identify the subject's customers: the shop, the beat, what the order was
-- worth, its status, and the ids that would link to it. Points, date, program,
-- activity, tier and achievement always come back, because those are what
-- explain how someone is ahead of you.
--
-- Anonymous callers are still refused. A uuid that earned nothing returns no
-- rows, so this cannot be used to enumerate anybody.
drop function if exists public.gam_person_detail(uuid, timestamptz, timestamptz);

create function public.gam_person_detail(
  p_user uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  id uuid,
  earned_at timestamptz,
  points numeric,
  program text,
  category text,
  activity text,
  trigger_type text,
  reference_type text,
  retailer_name text,
  beat_name text,
  order_value numeric,
  order_status text,
  period_key text,
  tier_pct numeric,
  achievement_pct numeric,
  order_id uuid,
  retailer_id uuid
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
DECLARE
  v_full boolean;
BEGIN
  IF p_user IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorised to view award detail'
      USING ERRCODE = '42501';
  END IF;

  -- Your own record, or someone who reports to you, comes back whole.
  v_full := COALESCE(public.report_can_view_user(auth.uid(), p_user), false);

  RETURN QUERY
  WITH src AS (
    SELECT e.id AS eid, e.earned_at AS eat, e.points AS pts,
           e.game_id, e.action_id, e.reference_id, e.reference_type AS rtype,
           gp.metadata, gp.period_key AS pkey,
           COALESCE(
             e.retailer_id,
             NULLIF(gp.metadata->>'retailer_id','')::uuid,
             NULLIF(gp.metadata->'context'->>'retailer_id','')::uuid
           ) AS rid
    FROM public.gam_eligible_points(p_from, p_to) e
    JOIN gamification_points gp ON gp.id = e.id
    WHERE e.user_id = p_user
  )
  SELECT s.eid, s.eat, s.pts,
         g.name, g.category, ga.action_name,
         ga.trigger_type, s.rtype,
         CASE WHEN v_full THEN COALESCE(o.retailer_name, r.name) END,
         CASE WHEN v_full THEN r.beat_name END,
         CASE WHEN v_full THEN COALESCE(o.total_amount,
                  NULLIF(s.metadata->>'order_value','')::numeric,
                  NULLIF(s.metadata->'context'->>'order_value','')::numeric) END,
         CASE WHEN v_full THEN o.status END,
         s.pkey,
         NULLIF(s.metadata->>'tier_threshold','')::numeric,
         NULLIF(s.metadata->>'achievement_percent','')::numeric,
         CASE WHEN v_full THEN o.id END,
         CASE WHEN v_full THEN s.rid END
  FROM src s
  JOIN gamification_games g ON g.id = s.game_id
  JOIN gamification_actions ga ON ga.id = s.action_id
  LEFT JOIN orders o ON o.id = s.reference_id
  LEFT JOIN retailers r ON r.id = s.rid
  ORDER BY s.eat DESC;
END;
$function$;

revoke all on function public.gam_person_detail(uuid, timestamptz, timestamptz) from public;
grant execute on function public.gam_person_detail(uuid, timestamptz, timestamptz) to authenticated;


-- The scalar facts behind the summary: an aggregate, so it is open to anyone
-- on the board. No row of it identifies a customer.
drop function if exists public.gam_person_profile(uuid, timestamptz, timestamptz);

create function public.gam_person_profile(
  p_user uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  points numeric,
  awards bigint,
  programs bigint,
  days bigint,
  order_count bigint,
  order_value numeric
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  WITH src AS (
    SELECT e.id, e.earned_at, e.points, e.game_id, e.reference_id,
           COALESCE(o.total_amount,
                    NULLIF(gp.metadata->>'order_value','')::numeric,
                    NULLIF(gp.metadata->'context'->>'order_value','')::numeric) AS val
    FROM public.gam_eligible_points(p_from, p_to) e
    JOIN gamification_points gp ON gp.id = e.id
    LEFT JOIN orders o ON o.id = e.reference_id
    WHERE e.user_id = p_user AND auth.uid() IS NOT NULL
  )
  SELECT COALESCE(SUM(points), 0),
         COUNT(*),
         COUNT(DISTINCT game_id),
         COUNT(DISTINCT date_trunc('day', earned_at)),
         COUNT(val),
         COALESCE(SUM(val), 0)
  FROM src;
$function$;

revoke all on function public.gam_person_profile(uuid, timestamptz, timestamptz) from public;
grant execute on function public.gam_person_profile(uuid, timestamptz, timestamptz) to authenticated;


-- The same, split by activity: what the comparison table and the observations
-- are built from. Still an aggregate, still open to the board.
drop function if exists public.gam_person_by_activity(uuid, timestamptz, timestamptz);

create function public.gam_person_by_activity(
  p_user uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  program text,
  category text,
  activity text,
  points numeric,
  awards bigint,
  order_count bigint,
  order_value numeric
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  WITH src AS (
    SELECT e.id, e.points, e.game_id, e.action_id,
           COALESCE(o.total_amount,
                    NULLIF(gp.metadata->>'order_value','')::numeric,
                    NULLIF(gp.metadata->'context'->>'order_value','')::numeric) AS val
    FROM public.gam_eligible_points(p_from, p_to) e
    JOIN gamification_points gp ON gp.id = e.id
    LEFT JOIN orders o ON o.id = e.reference_id
    WHERE e.user_id = p_user AND auth.uid() IS NOT NULL
  )
  SELECT g.name, g.category, ga.action_name,
         COALESCE(SUM(s.points), 0),
         COUNT(*),
         COUNT(s.val),
         COALESCE(SUM(s.val), 0)
  FROM src s
  JOIN gamification_games g ON g.id = s.game_id
  JOIN gamification_actions ga ON ga.id = s.action_id
  GROUP BY g.name, g.category, ga.action_name
  ORDER BY 4 DESC;
$function$;

revoke all on function public.gam_person_by_activity(uuid, timestamptz, timestamptz) from public;
grant execute on function public.gam_person_by_activity(uuid, timestamptz, timestamptz) to authenticated;
