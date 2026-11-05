-- Allow users to delete their own gamification points (needed for order cancellation reversal)
CREATE POLICY "Users can delete their own points"
ON public.gamification_points
FOR DELETE
USING (auth.uid() = user_id);

-- Also add UPDATE policy in case it's needed for future point adjustments
CREATE POLICY "Users can update their own points"
ON public.gamification_points
FOR UPDATE
USING (auth.uid() = user_id);