-- Update handle_new_user function to include hint_question and hint_answer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, phone_number, recovery_email, hint_question, hint_answer)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
    new.raw_user_meta_data->>'phone_number',
    new.raw_user_meta_data->>'recovery_email',
    COALESCE(new.raw_user_meta_data->>'hint_question', 'What is your favorite color?'),
    COALESCE(new.raw_user_meta_data->>'hint_answer', 'default')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;