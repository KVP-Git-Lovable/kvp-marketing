-- Per-game leaderboards, for the "my rank in this game" card.
-- Same reason as gam_rankings: RLS on gamification_points only ever returns the
-- caller their own rows, so building this client-side gives every rep a
-- per-game board containing only themselves — rank #1 of 1 in every game.
-- Aggregate only; carries no retailer, order or reference data.
CREATE OR REPLACE FUNCTION public.gam_game_rankings(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(game_id uuid, user_id uuid, full_name text, points numeric, rank bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH agg AS (
    SELECT e.game_id, e.user_id, SUM(e.points) AS points
    FROM public.gam_eligible_points(p_from, p_to) e
    WHERE e.user_id IS NOT NULL AND e.game_id IS NOT NULL
    GROUP BY e.game_id, e.user_id
  )
  SELECT a.game_id,
         a.user_id,
         COALESCE(p.full_name, p.username, 'Unknown') AS full_name,
         a.points,
         RANK() OVER (PARTITION BY a.game_id ORDER BY a.points DESC) AS rank
  FROM agg a
  JOIN profiles p ON p.id = a.user_id
  ORDER BY a.game_id, a.points DESC;
$$;

REVOKE ALL ON FUNCTION public.gam_game_rankings(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gam_game_rankings(timestamptz, timestamptz) TO authenticated;
