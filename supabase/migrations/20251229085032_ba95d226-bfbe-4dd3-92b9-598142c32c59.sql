-- Allow all authenticated users to view profile names for dropdowns/reports
CREATE POLICY "Authenticated users can view profile names"
ON public.profiles
FOR SELECT
USING (auth.role() = 'authenticated');