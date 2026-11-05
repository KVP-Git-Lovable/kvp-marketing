-- Fix remaining functions missing SET search_path

-- Fix owns_completed_invitation function
CREATE OR REPLACE FUNCTION public.owns_completed_invitation(_user_id uuid, _email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users
    WHERE id = _user_id 
      AND email = _email
  );
$$;

-- Fix get_basic_profiles_for_admin function
CREATE OR REPLACE FUNCTION public.get_basic_profiles_for_admin()
RETURNS TABLE(id uuid, username text, full_name text, created_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    p.id,
    p.username,
    p.full_name,
    p.created_at
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- Fix get_limited_profiles_for_admin function
CREATE OR REPLACE FUNCTION public.get_limited_profiles_for_admin()
RETURNS TABLE(id uuid, username text, full_name text, created_at timestamp with time zone, user_status user_status)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    p.id,
    p.username,
    p.full_name,
    p.created_at,
    p.user_status
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;

-- Fix prevent_admin_sensitive_access function
CREATE OR REPLACE FUNCTION public.prevent_admin_sensitive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If user is admin and trying to access someone else's profile
  IF public.has_role(auth.uid(), 'admin'::public.app_role) AND auth.uid() != NEW.id THEN
    -- Prevent updates to sensitive fields
    IF OLD.hint_question IS DISTINCT FROM NEW.hint_question 
       OR OLD.hint_answer IS DISTINCT FROM NEW.hint_answer 
       OR OLD.recovery_email IS DISTINCT FROM NEW.recovery_email 
       OR OLD.phone_number IS DISTINCT FROM NEW.phone_number THEN
      RAISE EXCEPTION 'Admins cannot access or modify sensitive profile data';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix update_security_info function
CREATE OR REPLACE FUNCTION public.update_security_info(new_hint_question text, new_hint_answer text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow users to update their own security info
  UPDATE public.profiles 
  SET 
    hint_question = new_hint_question,
    hint_answer = new_hint_answer,
    updated_at = now()
  WHERE id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Fix create_approval_workflow function
CREATE OR REPLACE FUNCTION public.create_approval_workflow(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    approver_rec RECORD;
BEGIN
    -- Insert approval records for each level
    FOR approver_rec IN 
        SELECT user_id as approver_id, approver_level 
        FROM public.approvers 
        WHERE is_active = true 
        ORDER BY approver_level
    LOOP
        INSERT INTO public.user_approvals (user_id, approver_id, approval_level)
        VALUES (user_id_param, approver_rec.approver_id, approver_rec.approver_level);
    END LOOP;
END;
$$;

-- Fix send_notification function
CREATE OR REPLACE FUNCTION public.send_notification(user_id_param uuid, title_param text, message_param text, type_param text DEFAULT 'info'::text, related_table_param text DEFAULT NULL::text, related_id_param uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
    VALUES (user_id_param, title_param, message_param, type_param, related_table_param, related_id_param)
    RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$;

-- Fix validate_invitation_token function
CREATE OR REPLACE FUNCTION public.validate_invitation_token(_token text)
RETURNS TABLE(id uuid, email text, full_name text, phone_number text, manager_id uuid, expires_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    ui.id,
    ui.email,
    ui.full_name,
    ui.phone_number,
    ui.manager_id,
    ui.expires_at
  FROM public.user_invitations ui
  WHERE ui.invitation_token = _token
    AND ui.status = 'pending'
    AND ui.expires_at > now()
  LIMIT 1;
$$;

-- Fix update_security_info_secure function
CREATE OR REPLACE FUNCTION public.update_security_info_secure(new_hint_question text, new_hint_answer text, new_recovery_email text DEFAULT NULL::text, new_phone_number text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow users to update their own security info
  UPDATE public.profiles 
  SET 
    hint_question = new_hint_question,
    hint_answer = public.hash_hint_answer(new_hint_answer),
    recovery_email = COALESCE(new_recovery_email, recovery_email),
    phone_number = COALESCE(new_phone_number, phone_number),
    updated_at = now()
  WHERE id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Fix update_sensitive_profile_fields function
CREATE OR REPLACE FUNCTION public.update_sensitive_profile_fields(new_phone_number text DEFAULT NULL::text, new_recovery_email text DEFAULT NULL::text, new_hint_question text DEFAULT NULL::text, new_hint_answer text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  hashed_answer text;
BEGIN
  -- Hash the hint answer if provided
  IF new_hint_answer IS NOT NULL THEN
    hashed_answer := public.hash_hint_answer(new_hint_answer);
  END IF;
  
  -- Update only the fields that were provided and belong to the authenticated user
  UPDATE public.profiles 
  SET 
    phone_number = COALESCE(new_phone_number, phone_number),
    recovery_email = COALESCE(new_recovery_email, recovery_email),
    hint_question = COALESCE(new_hint_question, hint_question),
    hint_answer = COALESCE(hashed_answer, hint_answer),
    updated_at = now()
  WHERE id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Fix hash_hint_answer function
CREATE OR REPLACE FUNCTION public.hash_hint_answer(answer text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Use md5 with a salt for basic security (better than plaintext)
  RETURN 'hash:' || md5('security_salt_2024_' || LOWER(TRIM(answer)) || '_hint_protection');
END;
$$;

-- Fix verify_hint_answer_secure function
CREATE OR REPLACE FUNCTION public.verify_hint_answer_secure(user_email text, submitted_answer text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  stored_hash text;
  computed_hash text;
BEGIN
  -- Get the stored hint answer (hashed or unhashed)
  SELECT p.hint_answer INTO stored_hash
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = user_email;
  
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  -- Compute hash of submitted answer
  computed_hash := public.hash_hint_answer(submitted_answer);
  
  -- Check if stored value is already hashed or plaintext
  IF stored_hash LIKE 'hash:%' THEN
    -- Compare hashed values
    RETURN stored_hash = computed_hash;
  ELSE
    -- Legacy: compare with plaintext (and update to hash on next opportunity)
    RETURN LOWER(TRIM(stored_hash)) = LOWER(TRIM(submitted_answer));
  END IF;
END;
$$;

-- Fix hash_hint_answer_trigger function
CREATE OR REPLACE FUNCTION public.hash_hint_answer_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only hash if hint_answer is provided and not already hashed
  IF NEW.hint_answer IS NOT NULL AND NEW.hint_answer NOT LIKE 'hash:%' THEN
    NEW.hint_answer := public.hash_hint_answer(NEW.hint_answer);
  END IF;
  
  RETURN NEW;
END;
$$;