-- Fix RLS policies for gamification_actions table
DROP POLICY IF EXISTS "Admins can manage gamification actions" ON public.gamification_actions;

CREATE POLICY "Admins can manage gamification actions" 
ON public.gamification_actions
FOR ALL
TO authenticated
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- Fix RLS policies for gamification_games table
DROP POLICY IF EXISTS "Admins can manage gamification games" ON public.gamification_games;

CREATE POLICY "Admins can manage gamification games" 
ON public.gamification_games
FOR ALL
TO authenticated
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));