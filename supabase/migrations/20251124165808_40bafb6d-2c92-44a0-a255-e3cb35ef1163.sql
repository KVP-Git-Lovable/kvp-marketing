-- Fix notifications RLS policy to allow edge functions and users to create notifications

-- Drop the restrictive admin-only insert policy
DROP POLICY IF EXISTS "Only admins can create notifications" ON public.notifications;

-- Create new policies that allow:
-- 1. Service role (edge functions) to insert any notification
-- 2. Users to insert notifications for themselves
CREATE POLICY "Service role can create any notification"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    auth.jwt()->>'role' = 'service_role'
  );

CREATE POLICY "Users can create notifications for themselves"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY "Admins can create any notification"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
  );