-- Rankings data layer.
-- RLS on gamification_points only ever exposes a user their own rows, so a
-- leaderboard is impossible from the client. These SECURITY DEFINER functions
-- return AGGREGATES to everyone and per-award DETAIL only where
-- report_can_view_user() passes (yourself, or someone who reports to you).

-- One eligibility rule, defined once: active, unexpired, on a leaderboard
-- activity, belonging to an active profile.
CREATE OR REPLACE FUNCTION public.gam_eligible_points(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(id uuid, user_id uuid, game_id uuid, action_id uuid, points numeric, earned_at timestamptz,
              reference_type text, reference_id uuid, retailer_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT gp.id, gp.user_id, gp.game_id, gp.action_id, gp.points, gp.earned_at,
         gp.reference_type, gp.reference_id, gp.retailer_id
  FROM gamification_points gp
  JOIN gamification_actions ga ON ga.id = gp.action_id
  JOIN profiles pr ON pr.id = gp.user_id
  WHERE gp.earned_at >= p_from AND gp.earned_at <= p_to
    AND COALESCE(gp.status, 'active') = 'active'
    AND (gp.expires_at IS NULL OR gp.expires_at > now())
    AND COALESCE(ga.leaderboard, true) = true
    AND COALESCE(pr.is_active, true) = true
    AND COALESCE(pr.user_status::text, 'active') <> 'inactive';
$$;

CREATE OR REPLACE FUNCTION public.gam_rankings(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(user_id uuid, full_name text, profile_picture_url text,
              points numeric, awards bigint, programs bigint, rank bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH agg AS (
    SELECT e.user_id, SUM(e.points) AS points, COUNT(*) AS awards,
           COUNT(DISTINCT e.game_id) AS programs
    FROM public.gam_eligible_points(p_from, p_to) e
    WHERE e.user_id IS NOT NULL
    GROUP BY e.user_id
  )
  SELECT a.user_id, COALESCE(p.full_name, p.username, 'Unknown') AS full_name,
         p.profile_picture_url, a.points, a.awards, a.programs,
         RANK() OVER (ORDER BY a.points DESC) AS rank
  FROM agg a JOIN profiles p ON p.id = a.user_id
  ORDER BY a.points DESC, full_name;
$$;

CREATE OR REPLACE FUNCTION public.gam_person_programs(p_user uuid, p_from timestamptz, p_to timestamptz)
RETURNS TABLE(game_id uuid, program text, category text, points numeric, awards bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT e.game_id, g.name AS program, g.category, SUM(e.points) AS points, COUNT(*) AS awards
  FROM public.gam_eligible_points(p_from, p_to) e
  JOIN gamification_games g ON g.id = e.game_id
  WHERE e.user_id = p_user
  GROUP BY e.game_id, g.name, g.category
  ORDER BY SUM(e.points) DESC;
$$;

REVOKE ALL ON FUNCTION public.gam_eligible_points(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gam_rankings(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gam_person_programs(uuid, timestamptz, timestamptz) TO authenticated;
