-- Create table to track password reset attempts
CREATE TABLE IF NOT EXISTS public.password_reset_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  was_successful BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  user_agent TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_attempts_email_time 
ON public.password_reset_attempts(email, attempted_at DESC);

-- Enable RLS
ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can view reset attempts
CREATE POLICY "Admins can view password reset attempts"
ON public.password_reset_attempts
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Create function to check if account is locked
CREATE OR REPLACE FUNCTION public.is_account_locked(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  failed_attempts INTEGER;
BEGIN
  -- Count failed attempts in the last hour
  SELECT COUNT(*) INTO failed_attempts
  FROM public.password_reset_attempts
  WHERE email = user_email
    AND attempted_at > NOW() - INTERVAL '1 hour'
    AND was_successful = false;
  
  -- Account is locked if 5 or more failed attempts in last hour
  RETURN failed_attempts >= 5;
END;
$$;

-- Create enhanced verify function with rate limiting
CREATE OR REPLACE FUNCTION public.verify_hint_answer_with_rate_limit(
  user_email TEXT,
  submitted_answer TEXT,
  user_ip TEXT DEFAULT NULL,
  user_agent_str TEXT DEFAULT NULL
)
RETURNS TABLE(is_valid BOOLEAN, is_locked BOOLEAN, attempts_remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash TEXT;
  computed_hash TEXT;
  recent_attempts INTEGER;
  answer_matches BOOLEAN := false;
BEGIN
  -- Check if account is locked
  IF public.is_account_locked(user_email) THEN
    RETURN QUERY SELECT false, true, 0;
    RETURN;
  END IF;
  
  -- Count recent failed attempts in last hour
  SELECT COUNT(*) INTO recent_attempts
  FROM public.password_reset_attempts
  WHERE email = user_email
    AND attempted_at > NOW() - INTERVAL '1 hour'
    AND was_successful = false;
  
  -- If already 4 failed attempts, this is the last one before lockout
  IF recent_attempts >= 4 THEN
    -- Log the attempt as failed (will trigger lockout)
    INSERT INTO public.password_reset_attempts (email, was_successful, ip_address, user_agent)
    VALUES (user_email, false, user_ip, user_agent_str);
    
    RETURN QUERY SELECT false, true, 0;
    RETURN;
  END IF;
  
  -- Get the stored hint answer hash
  SELECT p.hint_answer INTO stored_hash
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = user_email;
  
  IF stored_hash IS NULL THEN
    -- Log failed attempt for non-existent user
    INSERT INTO public.password_reset_attempts (email, was_successful, ip_address, user_agent)
    VALUES (user_email, false, user_ip, user_agent_str);
    
    RETURN QUERY SELECT false, false, (4 - recent_attempts);
    RETURN;
  END IF;
  
  -- Compute hash of submitted answer
  computed_hash := public.hash_hint_answer(submitted_answer);
  
  -- Check if stored value is already hashed or plaintext
  IF stored_hash LIKE 'hash:%' THEN
    answer_matches := stored_hash = computed_hash;
  ELSE
    -- Legacy: compare with plaintext
    answer_matches := LOWER(TRIM(stored_hash)) = LOWER(TRIM(submitted_answer));
  END IF;
  
  -- Log the attempt
  INSERT INTO public.password_reset_attempts (email, was_successful, ip_address, user_agent)
  VALUES (user_email, answer_matches, user_ip, user_agent_str);
  
  -- Return result with attempts remaining
  IF answer_matches THEN
    RETURN QUERY SELECT true, false, 5;
  ELSE
    RETURN QUERY SELECT false, false, (4 - recent_attempts);
  END IF;
END;
$$;

-- Create function to unlock account (admin only)
CREATE OR REPLACE FUNCTION public.unlock_password_reset(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can unlock accounts
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can unlock accounts';
  END IF;
  
  -- Delete recent failed attempts to unlock
  DELETE FROM public.password_reset_attempts
  WHERE email = user_email
    AND attempted_at > NOW() - INTERVAL '1 hour'
    AND was_successful = false;
  
  RETURN true;
END;
$$;

-- Create function to get reset attempt stats (for monitoring)
CREATE OR REPLACE FUNCTION public.get_password_reset_stats()
RETURNS TABLE(
  email TEXT,
  total_attempts BIGINT,
  failed_attempts BIGINT,
  is_locked BOOLEAN,
  last_attempt TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pra.email,
    COUNT(*)::BIGINT as total_attempts,
    COUNT(*) FILTER (WHERE was_successful = false)::BIGINT as failed_attempts,
    public.is_account_locked(pra.email) as is_locked,
    MAX(pra.attempted_at) as last_attempt
  FROM public.password_reset_attempts pra
  WHERE pra.attempted_at > NOW() - INTERVAL '24 hours'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  GROUP BY pra.email
  ORDER BY last_attempt DESC;
$$;