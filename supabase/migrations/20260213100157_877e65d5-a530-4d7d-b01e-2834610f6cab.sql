
-- Drop redundant restrictive SELECT policies
DROP POLICY IF EXISTS "Users can view their own points" ON public.gamification_points;
DROP POLICY IF EXISTS "Admins can view all points" ON public.gamification_points;
DROP POLICY IF EXISTS "testuser_select_gamification_points" ON public.gamification_points;

-- Allow all authenticated users to view leaderboard points
CREATE POLICY "All authenticated users can view points"
  ON public.gamification_points
  FOR SELECT
  TO authenticated
  USING (true);
