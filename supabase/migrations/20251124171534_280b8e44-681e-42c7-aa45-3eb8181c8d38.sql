-- Drop ALL existing policies on notifications table
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert any notification" ON public.notifications;
DROP POLICY IF EXISTS "Users can read their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can create notifications" ON public.notifications;

-- Allow ALL authenticated users to insert notifications for anyone (no restrictions)
CREATE POLICY "All users can create any notification"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users to read their own notifications or admins can read all
CREATE POLICY "Users view own notifications or admins view all"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Allow users to update their own notifications (mark as read)
CREATE POLICY "Users update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());