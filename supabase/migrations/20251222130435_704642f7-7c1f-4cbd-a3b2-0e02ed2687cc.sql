-- Fix can_view_profile function - remove INSERT that breaks SELECT queries
CREATE OR REPLACE FUNCTION public.can_view_profile(_target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow users to view their own profile or if they're admin
  RETURN (auth.uid() = _target_user_id) OR has_role(auth.uid(), 'admin'::app_role);
END;
$function$;

-- Fix can_view_employee function - remove INSERT that breaks SELECT queries
CREATE OR REPLACE FUNCTION public.can_view_employee(_target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow users to view their own employee record or if they're admin
  RETURN (auth.uid() = _target_user_id) OR has_role(auth.uid(), 'admin'::app_role);
END;
$function$;