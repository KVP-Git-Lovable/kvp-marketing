-- Fix notifications table security vulnerability
-- Drop the insecure policy that allows anyone to create notifications
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Create a secure policy that only allows admins to insert notifications
-- The send_notification RPC function will still work because it uses SECURITY DEFINER
CREATE POLICY "Only admins can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));