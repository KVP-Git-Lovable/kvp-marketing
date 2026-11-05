-- Update the handle_new_user function to also create leave balances for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Insert into profiles table (existing functionality)
  INSERT INTO public.profiles (
    id, 
    username, 
    full_name, 
    phone_number, 
    recovery_email, 
    hint_question, 
    hint_answer
  )
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone_number',
    new.raw_user_meta_data ->> 'recovery_email',
    new.raw_user_meta_data ->> 'hint_question',
    new.raw_user_meta_data ->> 'hint_answer'
  );
  
  -- Assign default role as 'user'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  -- Create default leave balances for the new user
  INSERT INTO public.leave_balance (user_id, leave_type_id, opening_balance, used_balance, year)
  SELECT 
    NEW.id as user_id,
    lt.id as leave_type_id,
    CASE 
      WHEN lt.name = 'Annual Leave' THEN 25
      WHEN lt.name = 'Sick Leave' THEN 12
      WHEN lt.name = 'Casual Leave' THEN 10
      WHEN lt.name = 'Maternity Leave' THEN 180
      WHEN lt.name = 'Paternity Leave' THEN 15
      ELSE 10
    END as opening_balance,
    0 as used_balance,
    EXTRACT(year FROM CURRENT_DATE) as year
  FROM public.leave_types lt;
  
  RETURN new;
END;
$function$;