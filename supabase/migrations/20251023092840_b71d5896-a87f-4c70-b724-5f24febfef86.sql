-- Drop existing policies that allow all users to see/update all beats
DROP POLICY IF EXISTS "Authenticated users can view all beats" ON public.beats;
DROP POLICY IF EXISTS "Users can update beats" ON public.beats;
DROP POLICY IF EXISTS "Authenticated users can create beats" ON public.beats;

-- Create new policies that restrict visibility to creator only
CREATE POLICY "Users can view their own beats" 
ON public.beats 
FOR SELECT 
USING (auth.uid() = created_by);

CREATE POLICY "Admins can view all beats" 
ON public.beats 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create beats with themselves as creator" 
ON public.beats 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own beats" 
ON public.beats 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Admins can manage all beats" 
ON public.beats 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));