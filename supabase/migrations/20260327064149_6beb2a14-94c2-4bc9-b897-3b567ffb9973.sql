-- Drop restrictive SELECT policy
DROP POLICY "Users can view own data" ON public.gamification_points;

-- Allow all authenticated users to read gamification points (needed for leaderboard)
CREATE POLICY "Authenticated users can view all gamification points"
  ON public.gamification_points FOR SELECT
  TO authenticated
  USING (true);