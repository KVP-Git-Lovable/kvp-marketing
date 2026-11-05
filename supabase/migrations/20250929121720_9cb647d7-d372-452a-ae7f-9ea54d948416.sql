-- Fix the final functions missing SET search_path
-- These are likely the update_updated_at_column and update_leave_balance_on_approval functions

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_leave_balance_on_approval function  
CREATE OR REPLACE FUNCTION public.update_leave_balance_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    leave_days INTEGER;
BEGIN
    -- Only update balance when status changes to approved
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        -- Calculate number of leave days
        leave_days := NEW.end_date - NEW.start_date + 1;
        
        -- Update or insert leave balance
        INSERT INTO public.leave_balance (user_id, leave_type_id, used_balance)
        VALUES (NEW.user_id, NEW.leave_type_id, leave_days)
        ON CONFLICT (user_id, leave_type_id, year)
        DO UPDATE SET 
            used_balance = public.leave_balance.used_balance + leave_days,
            updated_at = now();
    END IF;
    
    RETURN NEW;
END;
$$;

-- Fix get_authenticated_email function
CREATE OR REPLACE FUNCTION public.get_authenticated_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;