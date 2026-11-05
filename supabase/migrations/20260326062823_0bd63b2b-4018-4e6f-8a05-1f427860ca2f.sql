-- Assign System Administrator security profile to Prajwal C
INSERT INTO public.user_profiles (user_id, profile_id)
VALUES (
  'd63ecc6f-4ef4-468b-a237-7a6617bb7cdd',
  '98c1259e-0368-4e1a-a4e8-01e173cbfb10'
)
ON CONFLICT (user_id) DO UPDATE SET profile_id = EXCLUDED.profile_id;