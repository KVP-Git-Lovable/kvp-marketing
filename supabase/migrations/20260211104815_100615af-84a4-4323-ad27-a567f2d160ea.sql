
-- Direct grants on retailers table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retailers TO authenticated;
GRANT SELECT ON public.retailers TO anon;
GRANT ALL ON public.retailers TO service_role;

-- Also verify profiles and employees have grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.employees TO anon;
